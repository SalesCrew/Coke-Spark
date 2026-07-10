"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Store,
  Star,
  HeartPulse,
  Wrench,
  Home,
  GraduationCap,
  Warehouse,
  BedDouble,
  Coffee,
  Clock,
  Camera,
  ChevronLeft,
  Check,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  fetchActiveGmVisitSession,
  fetchCurrentDaySession,
  fetchActiveTimeTrackingDrafts,
  fetchLatestActiveGmVisitSession,
  fetchGmVisitSession,
  fetchGmVisitStartPayload,
  fetchGmAssignedStartMarkets,
  fetchGmFlexStartMarkets,
  fetchGmMarketDetail,
  startDayPause,
  endDayPause,
  createManualDayPause,
  startTimeTrackingDraft,
  endTimeTrackingDraft,
  commentTimeTrackingDraft,
  uploadTimeTrackingDoctorConfirmation,
  submitTimeTrackingEntry,
  cancelTimeTrackingEntry,
  setGmVisitPreloadCache,
  setGmVisitStartPreloadCache,
  type DaySessionCurrentPayload,
  type GmVisitSessionPayload,
  type TimeTrackingActivityType,
  type TimeTrackingEntry,
} from "@/lib/api/backend";
import {
  isLocalDaySessionSnapshotUsableForStartGate,
  readLatestLocalDaySessionSnapshot,
} from "@/lib/gm/daySessionPersistence";
import { getMarketChainLabel } from "@/lib/marketDisplay";
import { ActiveFragebogenBlockModal } from "./ActiveFragebogenBlockModal";
import { DashboardGateOverlay } from "./DashboardLockOverlay";
import { GmSkeletonMarketRows } from "./GmDashboardSkeleton";
import type { MarketRecord } from "@/types/markets";

const TODAY_SUBMISSIONS_UPDATED_EVENT = "gm:today-submissions-updated";
const DAY_SESSION_UPDATED_EVENT = "gm:day-session-updated";
const CARD_MENU_SPACE = 80;
const MIN_CARD_HEIGHT = 260;
const LIVE_STOP_CONFIRM_AFTER_MS = 10 * 60 * 1000;
const DOCTOR_CONFIRMATION_MAX_BYTES = 10 * 1024 * 1024;
const DOCTOR_CONFIRMATION_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

type ZusatzActivityKey = TimeTrackingActivityType | "pause";
type ZusatzActivity = {
  key: ZusatzActivityKey;
  label: string;
  icon: LucideIcon;
  manualOnly?: boolean;
};

interface Market {
  id: string;
  chain: string;
  name: string;
  address: string;
  stammnr: string;
  activeNowCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    section: "standard" | "flex" | "kuehler" | "mhd" | "billa";
  }>;
}

function chainColor(chain: string): { bg: string; text: string } {
  const k = chain.toUpperCase();
  if (k.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (k.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (k.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (k.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (k.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function mapRecordToLauncherMarket(record: MarketRecord): Market {
  return {
    id: record.id,
    chain: getMarketChainLabel(record),
    name: record.name?.trim() || record.dbName?.trim() || "",
    address: `${record.address}, ${record.postalCode} ${record.city}`.trim(),
    stammnr: record.cokeMasterNumber?.trim() || record.kuehlerStammnr?.trim() || record.flexNumber?.trim() || "",
    activeNowCampaigns: [],
  };
}

const activities: readonly ZusatzActivity[] = [
  { key: "sonderaufgabe", label: "Sonderaufgabe", icon: Star },
  { key: "arztbesuch", label: "Arztbesuch", icon: HeartPulse },
  { key: "werkstatt", label: "Werkstatt/Autoreinigung", icon: Wrench },
  { key: "homeoffice", label: "Homeoffice", icon: Home },
  { key: "schulung", label: "Schulung", icon: GraduationCap },
  { key: "lager", label: "Lager", icon: Warehouse },
  { key: "pause", label: "Pause", icon: Coffee, manualOnly: true },
  { key: "hotel", label: "Hotelübernachtung", icon: BedDouble },
] as const;

type View =
  | "idle"
  | "selectMarket"
  | "selectSections";

type MarketListMode = "assigned" | "flex";

type MarketSectionStatus = "nicht_ausgefuellt" | "ausgefuellt" | "teils_ausgefuellt";

function sectionLabel(section: "standard" | "flex" | "kuehler" | "mhd" | "billa"): string {
  if (section === "standard") return "Standardbesuch";
  if (section === "flex") return "Flexbesuch";
  if (section === "kuehler") return "Kühlerinventur";
  if (section === "mhd") return "MHD";
  return "Billa";
}

function sectionStatusMeta(status: MarketSectionStatus): { label: string; color: string; bg: string; ring: string } {
  if (status === "ausgefuellt") {
    return { label: "ausgefüllt", color: "#15803d", bg: "rgba(34,197,94,0.12)", ring: "rgba(22,163,74,0.35)" };
  }
  if (status === "teils_ausgefuellt") {
    return { label: "teils ausgefüllt", color: "#2563eb", bg: "rgba(59,130,246,0.12)", ring: "rgba(37,99,235,0.32)" };
  }
  return { label: "nicht ausgefüllt", color: "#DC2626", bg: "rgba(220,38,38,0.1)", ring: "rgba(220,38,38,0.28)" };
}

function fmtTimer(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function fmtDurationCompact(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} Min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function isValidHm(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toIsoForLocalTime(baseDate: Date, hm: string): string {
  const [hRaw, mRaw] = hm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  const local = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    h,
    m,
    0,
    0,
  );
  return local.toISOString();
}

function formatHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatHmWithSeconds(date: Date): string {
  return `${formatHm(date)}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function firstMinuteAfter(date: Date): string {
  const next = new Date(date);
  if (next.getSeconds() > 0 || next.getMilliseconds() > 0) {
    next.setMinutes(next.getMinutes() + 1);
  }
  next.setSeconds(0, 0);
  return formatHm(next);
}

function manualStartBeforeDayStart(dayStartedAt: string | null | undefined, hm: string): boolean {
  if (!dayStartedAt || !isValidHm(hm)) return false;
  const dayStart = new Date(dayStartedAt);
  if (!Number.isFinite(dayStart.getTime())) return false;
  const manualStart = new Date(toIsoForLocalTime(dayStart, hm));
  return manualStart.getTime() < dayStart.getTime();
}

// ── Clock Picker ──────────────────────────────────────────────

function isAllowedDoctorConfirmationFile(file: File): boolean {
  if (file.type && !file.type.toLowerCase().startsWith("image/")) return false;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return !extension || DOCTOR_CONFIRMATION_EXTENSIONS.has(extension);
}

function DoctorConfirmationUploadField({
  file,
  error,
  disabled,
  onFileChange,
}: {
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasFile = Boolean(file);
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        marginTop: 8,
        padding: "8px 9px",
        borderRadius: 10,
        border: `1px solid ${hasFile ? "rgba(5,150,105,0.18)" : "rgba(220,38,38,0.14)"}`,
        background: hasFile ? "rgba(5,150,105,0.045)" : "rgba(220,38,38,0.035)",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: hasFile ? "#059669" : "#DC2626",
            background: hasFile ? "rgba(5,150,105,0.08)" : "rgba(220,38,38,0.06)",
            boxShadow: `inset 0 0 0 1px ${hasFile ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.14)"}`,
            flexShrink: 0,
          }}
        >
          <Camera size={13} strokeWidth={2} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)" }}>
            Arztbestätigung
          </span>
          <span style={{ display: "block", marginTop: 1, fontSize: 10, fontWeight: 700, color: hasFile ? "#047857" : "rgba(15,23,42,0.56)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file?.name ?? "Foto auswählen"}
          </span>
        </span>
      </button>
      {error ? (
        <div style={{ marginTop: 6, fontSize: 9, fontWeight: 700, color: "#b91c1c", lineHeight: 1.35 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

interface ClockPickerProps {
  onSelect: (h: number, m: number) => void;
  onCancel: () => void;
}

function ClockPicker({ onSelect, onCancel }: ClockPickerProps) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const items = step === "hour" ? hours : minutes;
  const selected = step === "hour" ? hour : minute;

  const R = 76;
  const CENTER = 90;
  const NUM_R = 62;

  function angleFor(val: number): number {
    const count = step === "hour" ? 24 : 12;
    return (val / (step === "hour" ? 24 : 60)) * 360 - 90;
  }

  function posFor(val: number) {
    const inner = step === "hour" && val >= 12;
    const r = inner ? NUM_R - 22 : NUM_R;
    const displayVal = step === "hour" ? val : val;
    const count = step === "hour" ? 12 : 12;
    const idx = step === "hour" ? val % 12 : val / 5;
    const a = (idx / count) * 360 - 90;
    const rad = (a * Math.PI) / 180;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  }

  function handleTap(val: number) {
    if (step === "hour") {
      setHour(val);
      setTimeout(() => setStep("minute"), 200);
    } else {
      setMinute(val);
      setTimeout(() => onSelect(hour, val), 150);
    }
  }

  const selPos = posFor(selected);
  const selAngle = (() => {
    const count = 12;
    const idx = step === "hour" ? selected % 12 : selected / 5;
    return (idx / count) * 360 - 90;
  })();
  const selRad = (selAngle * Math.PI) / 180;
  const inner = step === "hour" && selected >= 12;
  const lineR = inner ? NUM_R - 22 : NUM_R;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(255,255,255,0.97)",
        borderRadius: 14,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        animation: "clockIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes clockIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <span
        className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400"
        style={{ marginBottom: 8 }}
      >
        {step === "hour" ? "Stunde" : "Minute"}
      </span>

      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />

        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER + lineR * Math.cos(selRad)}
          y2={CENTER + lineR * Math.sin(selRad)}
          stroke="#DC2626"
          strokeWidth={1.5}
          strokeLinecap="round"
          style={{ transition: "all 0.15s ease" }}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={3}
          fill="#DC2626"
        />

        {items.map((val) => {
          const p = posFor(val);
          const isSel = val === selected;
          const label = step === "hour"
            ? String(val)
            : String(val).padStart(2, "0");
          return (
            <g
              key={val}
              onClick={() => handleTap(val)}
              style={{ cursor: "pointer" }}
            >
              {isSel && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="#DC2626"
                  style={{ transition: "all 0.15s ease" }}
                />
              )}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={step === "hour" && val >= 12 ? 8 : 9}
                fontWeight={isSel ? 700 : 500}
                fill={isSel ? "#ffffff" : "rgba(0,0,0,0.55)"}
                style={{ transition: "fill 0.15s ease", userSelect: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <span
        className="text-[16px] font-semibold tabular-nums"
        style={{ marginTop: 6, color: "#DC2626" }}
      >
        {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
      </span>

      <button
        onClick={onCancel}
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 500,
          color: "rgba(0,0,0,0.35)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 12px",
        }}
      >
        Abbrechen
      </button>
    </div>
  );
}

// ── Accordion Row ─────────────────────────────────────────────

interface AccordionRowProps {
  activity: ZusatzActivity;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
  onRequestClock: (target: "von" | "bis", onSelect: (h: number, m: number) => void) => void;
  onManualSave: (input: { activityType: ZusatzActivityKey; fromHm: string; toHm: string; comment?: string; doctorConfirmationFile?: File | null }) => Promise<void>;
  dayStarted: boolean;
  dayStartedAt?: string | null;
  initialDraft?: TimeTrackingEntry | null;
  onRunningLockChange?: (activityKey: TimeTrackingActivityType, locked: boolean) => void;
}

function AccordionRow({
  activity,
  isOpen,
  onToggle,
  isLast,
  onRequestClock,
  onManualSave,
  dayStarted,
  dayStartedAt,
  initialDraft,
  onRunningLockChange,
}: AccordionRowProps) {
  const Icon = activity.icon;
  const isManualOnly = activity.manualOnly === true;
  const [mode, setMode] = useState<"live" | "manual">(isManualOnly ? "manual" : "live");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isPersistingLive, setIsPersistingLive] = useState(false);
  const [isPersistingPause, setIsPersistingPause] = useState(false);
  const [awaitingLiveDecision, setAwaitingLiveDecision] = useState(false);
  const [liveStoppedAtIso, setLiveStoppedAtIso] = useState<string | null>(null);
  const [staleStopConfirmation, setStaleStopConfirmation] = useState<{
    comment: string;
    stoppedAtIso: string;
    nowIso: string;
    delayMs: number;
  } | null>(null);
  const [liveComment, setLiveComment] = useState("");
  const [liveCommentDraft, setLiveCommentDraft] = useState("");
  const [isLiveCommentOpen, setIsLiveCommentOpen] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [vonVal, setVonVal] = useState("");
  const [bisVal, setBisVal] = useState("");
  const [manualComment, setManualComment] = useState("");
  const [doctorConfirmationFile, setDoctorConfirmationFile] = useState<File | null>(null);
  const [doctorConfirmationError, setDoctorConfirmationError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaved, setManualSaved] = useState(false);
  const [manualStartConflict, setManualStartConflict] = useState<{
    fromHm: string;
    toHm: string;
    actualStartLabel: string;
    minimumHm: string;
    error: string | null;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);

  const active = running && !paused;
  const supportsComment = activity.key === "sonderaufgabe" || activity.key === "lager" || activity.key === "homeoffice";
  const supportsDoctorConfirmation = activity.key === "arztbesuch";
  const commentPlaceholder =
    activity.key === "lager"
      ? "Kommentar zum Lagerbesuch (optional)..."
      : activity.key === "homeoffice"
        ? "Kommentar zum Homeoffice (optional)..."
        : "Kommentar zum Sondereinsatz...";

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentH(contentRef.current.scrollHeight);
    }
  }, [awaitingLiveDecision, doctorConfirmationError, doctorConfirmationFile, isOpen, mode, running]);

  useEffect(() => {
    if (!isOpen) {
      if (isManualOnly) setMode("manual");
      setRunning(false);
      setPaused(false);
      setSeconds(0);
      setActiveDraftId(null);
      setIsPersistingLive(false);
      setIsPersistingPause(false);
      setAwaitingLiveDecision(false);
      setLiveStoppedAtIso(null);
      setStaleStopConfirmation(null);
      setLiveComment("");
      setLiveCommentDraft("");
      setIsLiveCommentOpen(false);
      setLiveError(null);
      setManualError(null);
      setManualSaved(false);
      setManualComment("");
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError(null);
      setManualStartConflict(null);
    }
  }, [isManualOnly, isOpen]);

  useEffect(() => {
    if (isManualOnly) return;
    if (!initialDraft || initialDraft.status !== "draft") return;
    setMode("live");
    setActiveDraftId(initialDraft.id);
    const hasEnd = Boolean(initialDraft.endAt);
    if (hasEnd) {
      setRunning(false);
      setPaused(false);
      setAwaitingLiveDecision(true);
      setLiveStoppedAtIso(initialDraft.endAt ?? null);
      const startMs = initialDraft.startAt ? new Date(initialDraft.startAt).getTime() : Date.now();
      const endMs = initialDraft.endAt ? new Date(initialDraft.endAt).getTime() : Date.now();
      setSeconds(Math.max(0, Math.floor((endMs - startMs) / 1000)));
      setLiveComment(initialDraft.comment ?? "");
      setLiveCommentDraft(initialDraft.comment ?? "");
      return;
    }
    const startMs = initialDraft.startAt ? new Date(initialDraft.startAt).getTime() : Date.now();
    setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    setRunning(true);
    setPaused(false);
    setAwaitingLiveDecision(false);
    setLiveStoppedAtIso(null);
    setLiveComment(initialDraft.comment ?? "");
    setLiveCommentDraft(initialDraft.comment ?? "");
  }, [initialDraft, isManualOnly]);

  useEffect(() => {
    if (!onRunningLockChange || isManualOnly || activity.key === "pause") return;
    onRunningLockChange(activity.key, running);
  }, [activity.key, isManualOnly, onRunningLockChange, running]);

  function formatTimeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  }

  function openClockFor(target: "von" | "bis") {
    onRequestClock(target, (h, m) => {
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (target === "von") setVonVal(val);
      else setBisVal(val);
    });
  }

  function handleDoctorConfirmationFile(file: File | null) {
    setDoctorConfirmationError(null);
    if (!file) {
      setDoctorConfirmationFile(null);
      return;
    }
    if (file.size > DOCTOR_CONFIRMATION_MAX_BYTES) {
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError("Foto ist zu groß. Maximal 10 MB sind erlaubt.");
      return;
    }
    if (!isAllowedDoctorConfirmationFile(file)) {
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError("Bitte ein Foto hochladen.");
      return;
    }
    setDoctorConfirmationFile(file);
  }

  function buildManualStartConflict(fromHm: string, toHm: string) {
    if (!dayStartedAt || !manualStartBeforeDayStart(dayStartedAt, fromHm)) return null;
    const dayStart = new Date(dayStartedAt);
    return {
      fromHm: firstMinuteAfter(dayStart),
      toHm,
      actualStartLabel: formatHmWithSeconds(dayStart),
      minimumHm: firstMinuteAfter(dayStart),
      error: null,
    };
  }

  async function handleManualSave() {
    if (manualSaving) return;
    if (!isValidHm(vonVal) || !isValidHm(bisVal)) {
      setManualError("Bitte gültige Zeiten im Format HH:MM eingeben.");
      return;
    }
    const conflict = buildManualStartConflict(vonVal, bisVal);
    if (conflict) {
      setManualError(null);
      setManualSaved(false);
      setManualStartConflict(conflict);
      return;
    }
    setManualSaving(true);
    setManualError(null);
    setManualSaved(false);
    try {
      await onManualSave({
        activityType: activity.key,
        fromHm: vonVal,
        toHm: bisVal,
        comment: supportsComment ? manualComment.trim() : undefined,
        doctorConfirmationFile: supportsDoctorConfirmation ? doctorConfirmationFile : null,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TODAY_SUBMISSIONS_UPDATED_EVENT));
      }
      setManualSaved(true);
      setVonVal("");
      setBisVal("");
      setManualComment("");
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      setManualError(message || "Speichern fehlgeschlagen.");
    } finally {
      setManualSaving(false);
    }
  }

  async function handleManualConflictSave() {
    if (!manualStartConflict || manualSaving) return;
    if (!isValidHm(manualStartConflict.fromHm) || !isValidHm(manualStartConflict.toHm)) {
      setManualStartConflict((current) =>
        current ? { ...current, error: "Bitte gueltige Zeiten im Format HH:MM eingeben." } : current,
      );
      return;
    }
    if (dayStartedAt && manualStartBeforeDayStart(dayStartedAt, manualStartConflict.fromHm)) {
      setManualStartConflict((current) =>
        current
          ? {
              ...current,
              error: `Die Von-Zeit muss nach dem Arbeitstagsstart ${current.actualStartLabel} liegen.`,
            }
          : current,
      );
      return;
    }
    const nextFrom = manualStartConflict.fromHm;
    const nextTo = manualStartConflict.toHm;
    setManualStartConflict(null);
    setVonVal(nextFrom);
    setBisVal(nextTo);
    setManualSaving(true);
    setManualError(null);
    setManualSaved(false);
    try {
      await onManualSave({
        activityType: activity.key,
        fromHm: nextFrom,
        toHm: nextTo,
        comment: supportsComment ? manualComment.trim() : undefined,
        doctorConfirmationFile: supportsDoctorConfirmation ? doctorConfirmationFile : null,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TODAY_SUBMISSIONS_UPDATED_EVENT));
      }
      setManualSaved(true);
      setVonVal("");
      setBisVal("");
      setManualComment("");
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      setManualError(message || "Speichern fehlgeschlagen.");
    } finally {
      setManualSaving(false);
    }
  }

  async function handleLiveStart() {
    if (isManualOnly || activity.key === "pause") return;
    if (isPersistingLive || running || awaitingLiveDecision) return;
    if (!dayStarted) {
      setLiveError("Bitte zuerst den Arbeitstag starten.");
      return;
    }
    setIsPersistingLive(true);
    setLiveError(null);
    try {
      const now = new Date();
      const token = `${activity.key}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const started = await startTimeTrackingDraft({
        activityType: activity.key,
        startAt: now.toISOString(),
        clientEntryToken: token,
      });
      setActiveDraftId(started.entry.id);
      setRunning(true);
      setPaused(false);
      setSeconds(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Start fehlgeschlagen.";
      setLiveError(message || "Start fehlgeschlagen.");
    } finally {
      setIsPersistingLive(false);
    }
  }

  async function handleLiveStop() {
    if (!activeDraftId || isPersistingLive) return;
    setIsPersistingLive(true);
    setLiveError(null);
    try {
      if (paused) {
        await endDayPause();
      }
      const stopIso = new Date().toISOString();
      const result = await endTimeTrackingDraft(activeDraftId, { endAt: stopIso });
      setLiveStoppedAtIso(result.entry.endAt ?? stopIso);
      setRunning(false);
      setPaused(false);
      setAwaitingLiveDecision(true);
      setLiveComment("");
      setLiveCommentDraft("");
      setIsLiveCommentOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stop fehlgeschlagen.";
      setLiveError(message || "Stop fehlgeschlagen.");
    } finally {
      setIsPersistingLive(false);
    }
  }

  async function handleLivePauseToggle() {
    if (!running || isPersistingLive || isPersistingPause) return;
    setIsPersistingPause(true);
    setLiveError(null);
    try {
      if (paused) {
        await endDayPause();
        setPaused(false);
      } else {
        await startDayPause();
        setPaused(true);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TODAY_SUBMISSIONS_UPDATED_EVENT));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pause konnte nicht gespeichert werden.";
      setLiveError(message || "Pause konnte nicht gespeichert werden.");
    } finally {
      setIsPersistingPause(false);
    }
  }

  function getStaleStopConfirmation(comment: string) {
    if (!liveStoppedAtIso) return null;
    const stoppedMs = new Date(liveStoppedAtIso).getTime();
    if (!Number.isFinite(stoppedMs)) return null;
    const nowMs = Date.now();
    const delayMs = nowMs - stoppedMs;
    if (delayMs < LIVE_STOP_CONFIRM_AFTER_MS) return null;
    return {
      comment,
      stoppedAtIso: liveStoppedAtIso,
      nowIso: new Date(nowMs).toISOString(),
      delayMs,
    };
  }

  async function persistLiveSubmit(comment: string, options?: { updateEndToNow?: boolean }) {
    if (!activeDraftId || isPersistingLive) return;
    setIsPersistingLive(true);
    setLiveError(null);
    try {
      if (options?.updateEndToNow) {
        const nowIso = new Date().toISOString();
        const result = await endTimeTrackingDraft(activeDraftId, { endAt: nowIso });
        setLiveStoppedAtIso(result.entry.endAt ?? nowIso);
        if (result.entry.startAt && result.entry.endAt) {
          const startMs = new Date(result.entry.startAt).getTime();
          const endMs = new Date(result.entry.endAt).getTime();
          if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
            setSeconds(Math.max(0, Math.floor((endMs - startMs) / 1000)));
          }
        }
      }
      const trimmedComment = comment.trim();
      if (trimmedComment.length > 0) {
        await commentTimeTrackingDraft(activeDraftId, { comment: trimmedComment });
      }
      if (supportsDoctorConfirmation && doctorConfirmationFile) {
        await uploadTimeTrackingDoctorConfirmation(activeDraftId, doctorConfirmationFile);
      }
      await submitTimeTrackingEntry(activeDraftId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TODAY_SUBMISSIONS_UPDATED_EVENT));
      }
      setActiveDraftId(null);
      setAwaitingLiveDecision(false);
      setLiveStoppedAtIso(null);
      setStaleStopConfirmation(null);
      setLiveComment("");
      setLiveCommentDraft("");
      setIsLiveCommentOpen(false);
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError(null);
      setSeconds(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      setLiveError(message || "Speichern fehlgeschlagen.");
    } finally {
      setIsPersistingLive(false);
    }
  }

  async function handleLiveSubmit(commentOverride?: string) {
    if (!activeDraftId || isPersistingLive) return;
    const nextComment = (commentOverride ?? liveComment).trim();
    const confirmation = getStaleStopConfirmation(nextComment);
    if (confirmation) {
      setStaleStopConfirmation(confirmation);
      return;
    }
    await persistLiveSubmit(nextComment);
  }

  async function handleStaleStopConfirm(updateEndToNow: boolean) {
    const pending = staleStopConfirmation;
    if (!pending || !activeDraftId || isPersistingLive) return;
    setStaleStopConfirmation(null);
    await persistLiveSubmit(pending.comment, { updateEndToNow });
  }

  async function handleLiveCancel() {
    if (!activeDraftId || isPersistingLive) return;
    setIsPersistingLive(true);
    setLiveError(null);
    try {
      await cancelTimeTrackingEntry(activeDraftId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TODAY_SUBMISSIONS_UPDATED_EVENT));
      }
      setActiveDraftId(null);
      setAwaitingLiveDecision(false);
      setLiveStoppedAtIso(null);
      setStaleStopConfirmation(null);
      setLiveComment("");
      setLiveCommentDraft("");
      setIsLiveCommentOpen(false);
      setDoctorConfirmationFile(null);
      setDoctorConfirmationError(null);
      setSeconds(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Abbrechen fehlgeschlagen.";
      setLiveError(message || "Abbrechen fehlgeschlagen.");
    } finally {
      setIsPersistingLive(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => {
          if (running) return;
          onToggle();
        }}
        className="flex items-center gap-3"
        style={{
          height: 38,
          padding: "0 2px",
          cursor: "pointer",
          transition: "background-color 0.12s ease",
          borderRadius: 7,
          borderBottom: !isLast && !isOpen ? "1px solid rgba(0,0,0,0.04)" : "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Icon size={13} strokeWidth={1.5} color="rgba(0,0,0,0.35)" />
        <span className="text-[11px] font-medium text-gray-700">{activity.label}</span>
      </div>

      <div
        style={{
          maxHeight: isOpen ? contentH : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        }}
      >
        <div ref={contentRef} style={{ padding: "6px 0 10px" }}>
          {/* Mode toggle */}
          <div className="flex gap-1.5" style={{ marginBottom: 10 }}>
            {(isManualOnly ? (["manual"] as const) : (["live", "manual"] as const)).map((m) => (
              <button
                key={m}
                onClick={(e) => { e.stopPropagation(); setMode(m); }}
                style={{
                  padding: "3px 14px",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: mode === m ? "rgba(220,38,38,0.08)" : "transparent",
                  color: mode === m ? "#DC2626" : "rgba(0,0,0,0.35)",
                }}
              >
                {m === "live" ? "Live" : "Manuell"}
              </button>
            ))}
          </div>

          {mode === "live" ? (
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[14px] font-semibold tabular-nums"
                  style={{ color: "#DC2626", letterSpacing: "0.04em" }}
                >
                  {fmtTimer(seconds)}
                </span>

                {running ? (
                  <div className="flex gap-1.5 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleLiveStop();
                      }}
                      style={{
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: "#ffffff",
                        background: "linear-gradient(to bottom, #DC2626, #e84040)",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow:
                          "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                      }}
                    >
                      {isPersistingLive ? "STOP..." : "STOP"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleLivePauseToggle();
                      }}
                      disabled={isPersistingPause || isPersistingLive}
                      style={{
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: "#ffffff",
                        background: paused
                          ? "linear-gradient(to bottom, #059669, #0cb880)"
                          : "linear-gradient(to bottom, #ea580c, #f0722e)",
                        border: "none",
                        borderRadius: 7,
                        cursor: isPersistingPause || isPersistingLive ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: paused
                          ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)"
                          : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #d4500b, 0 1px 6px rgba(180,60,8,0.14)",
                      }}
                    >
                      {isPersistingPause ? (paused ? "RESUME..." : "PAUSE...") : paused ? "RESUME" : "PAUSE"}
                    </button>
                  </div>
                ) : awaitingLiveDecision ? (
                  <div className="flex-1" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {supportsDoctorConfirmation && (
                      <DoctorConfirmationUploadField
                        file={doctorConfirmationFile}
                        error={doctorConfirmationError}
                        disabled={isPersistingLive}
                        onFileChange={handleDoctorConfirmationFile}
                      />
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleLiveCancel();
                        }}
                        disabled={isPersistingLive}
                        style={{
                          flex: 1,
                          padding: "4px 0",
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "rgba(0,0,0,0.52)",
                          background: "rgba(0,0,0,0.06)",
                          border: "none",
                          borderRadius: 7,
                          cursor: isPersistingLive ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                          opacity: isPersistingLive ? 0.7 : 1,
                        }}
                      >
                        ABBRECHEN
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLiveCommentDraft(liveComment);
                          setIsLiveCommentOpen(true);
                        }}
                        disabled={isPersistingLive}
                        style={{
                          flex: 1,
                          padding: "4px 0",
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "#ffffff",
                          background: "linear-gradient(to bottom, #059669, #0cb880)",
                          border: "none",
                          borderRadius: 7,
                          cursor: isPersistingLive ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                          boxShadow:
                            "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                          opacity: isPersistingLive ? 0.7 : 1,
                        }}
                      >
                        SPEICHERN
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleLiveStart();
                    }}
                    disabled={isPersistingLive}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      color: "#ffffff",
                      background: "linear-gradient(to bottom, #059669, #0cb880)",
                      border: "none",
                      borderRadius: 7,
                      cursor: isPersistingLive ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                      boxShadow:
                        "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                    }}
                  >
                    {isPersistingLive ? "START..." : "START"}
                  </button>
                )}
              </div>
              {liveError && (
                <div style={{ marginTop: 6, fontSize: 9, color: "#b91c1c", fontWeight: 600 }}>
                  {liveError}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-gray-400 font-medium">Von</span>
                  <input
                    type="text"
                    value={vonVal}
                    onChange={(e) => setVonVal(formatTimeInput(e.target.value))}
                    placeholder="HH:MM"
                    maxLength={5}
                    inputMode="numeric"
                    pattern="[0-9:]*"
                    autoComplete="off"
                    onClick={(e) => e.stopPropagation()}
                    className="outline-none text-[11px] tabular-nums text-gray-700"
                    style={{
                      width: 48,
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(0,0,0,0.08)",
                      border: "none",
                      borderBlockEnd: "1px solid rgba(0,0,0,0.08)",
                      background: "transparent",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); openClockFor("von"); }}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: "rgba(220,38,38,0.06)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Clock size={10} strokeWidth={1.8} color="#DC2626" />
                  </button>
                </div>

                <span className="text-[10px] text-gray-300">–</span>

                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-gray-400 font-medium">Bis</span>
                  <input
                    type="text"
                    value={bisVal}
                    onChange={(e) => setBisVal(formatTimeInput(e.target.value))}
                    placeholder="HH:MM"
                    maxLength={5}
                    inputMode="numeric"
                    pattern="[0-9:]*"
                    autoComplete="off"
                    onClick={(e) => e.stopPropagation()}
                    className="outline-none text-[11px] tabular-nums text-gray-700"
                    style={{
                      width: 48,
                      padding: "3px 0",
                      border: "none",
                      borderBlockEnd: "1px solid rgba(0,0,0,0.08)",
                      background: "transparent",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); openClockFor("bis"); }}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: "rgba(220,38,38,0.06)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Clock size={10} strokeWidth={1.8} color="#DC2626" />
                  </button>
                </div>
              </div>

              {supportsComment && (
                <textarea
                  value={manualComment}
                  onChange={(e) => setManualComment(e.target.value.slice(0, 2000))}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={commentPlaceholder}
                  maxLength={2000}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    minHeight: 58,
                    padding: "8px 9px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.07)",
                    background: "rgba(15,23,42,0.025)",
                    color: "rgba(15,23,42,0.86)",
                    outline: "none",
                    resize: "none",
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
                  }}
                />
              )}

              {supportsDoctorConfirmation && (
                <DoctorConfirmationUploadField
                  file={doctorConfirmationFile}
                  error={doctorConfirmationError}
                  disabled={manualSaving}
                  onFileChange={handleDoctorConfirmationFile}
                />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleManualSave();
                }}
                disabled={manualSaving}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "5px 0",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "linear-gradient(to bottom, #DC2626, #e84040)",
                  border: "none",
                  borderRadius: 7,
                  cursor: manualSaving ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  boxShadow:
                    "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                  letterSpacing: "0.02em",
                  opacity: manualSaving ? 0.7 : 1,
                }}
              >
                {manualSaving ? "Speichern..." : "Speichern"}
              </button>
              {manualError && (
                <div style={{ marginTop: 6, fontSize: 9, color: "#b91c1c", fontWeight: 600 }}>
                  {manualError}
                </div>
              )}
              {!manualError && manualSaved && (
                <div style={{ marginTop: 6, fontSize: 9, color: "#15803d", fontWeight: 600 }}>
                  Gespeichert.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {manualStartConflict &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setManualStartConflict(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 18px",
              backgroundColor: "rgba(15,23,42,0.22)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 370,
                borderRadius: 20,
                background: "#ffffff",
                border: "1px solid rgba(15,23,42,0.08)",
                boxShadow: "0 24px 70px rgba(15,23,42,0.22), 0 2px 10px rgba(15,23,42,0.06)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "22px 22px 18px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 8px",
                    borderRadius: 999,
                    backgroundColor: "rgba(220,38,38,0.08)",
                    color: "#DC2626",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Zeit prüfen
                </div>
                <h3 style={{ margin: "12px 0 6px", fontSize: 18, lineHeight: 1.15, fontWeight: 800, color: "#111827" }}>
                  Startzeit liegt vor dem Arbeitstag
                </h3>
                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "rgba(17,24,39,0.55)", fontWeight: 500 }}>
                  Der Arbeitstag wurde um <strong style={{ color: "#111827" }}>{manualStartConflict.actualStartLabel} Uhr</strong> gestartet.
                  Deine manuelle Von-Zeit muss danach liegen.
                </p>

                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {(["fromHm", "toHm"] as const).map((field) => (
                    <label
                      key={field}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                        padding: "10px 11px",
                        borderRadius: 13,
                        backgroundColor: "#f8fafc",
                        border: "1px solid rgba(15,23,42,0.07)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: field === "fromHm" ? "#DC2626" : "rgba(15,23,42,0.38)",
                        }}
                      >
                        {field === "fromHm" ? "Von" : "Bis"}
                      </span>
                      <input
                        value={manualStartConflict[field]}
                        onChange={(event) => {
                          const value = formatTimeInput(event.target.value);
                          setManualStartConflict((current) =>
                            current ? { ...current, [field]: value, error: null } : current,
                          );
                        }}
                        maxLength={5}
                        inputMode="numeric"
                        pattern="[0-9:]*"
                        autoComplete="off"
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 20,
                          lineHeight: 1,
                          fontWeight: 800,
                          color: "#111827",
                          letterSpacing: "0",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "9px 11px",
                    borderRadius: 12,
                    backgroundColor: "rgba(220,38,38,0.05)",
                    color: "rgba(127,29,29,0.72)",
                    fontSize: 10,
                    lineHeight: 1.45,
                    fontWeight: 600,
                  }}
                >
                  Früheste auswählbare Von-Zeit: {manualStartConflict.minimumHm} Uhr.
                </div>
                {manualStartConflict.error && (
                  <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 10, fontWeight: 700 }}>
                    {manualStartConflict.error}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderTop: "1px solid rgba(15,23,42,0.06)",
                }}
              >
                <button
                  onClick={() => setManualStartConflict(null)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#ffffff",
                    color: "rgba(15,23,42,0.58)",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => void handleManualConflictSave()}
                  disabled={manualSaving}
                  style={{
                    flex: 1.35,
                    height: 36,
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(to bottom, #DC2626, #e84040)",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: manualSaving ? "not-allowed" : "pointer",
                    opacity: manualSaving ? 0.72 : 1,
                    boxShadow:
                      "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                  }}
                >
                  {manualSaving ? "Speichern..." : "Korrigiert speichern"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {staleStopConfirmation &&
        awaitingLiveDecision &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 18px",
              backgroundColor: "rgba(15,23,42,0.22)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 382,
                backgroundColor: "rgba(255,255,255,0.98)",
                borderRadius: 18,
                boxShadow: "0 14px 50px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.8)",
              }}
            >
              <div
                style={{
                  padding: "17px 18px 12px",
                  borderBottom: "1px solid rgba(15,23,42,0.06)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92))",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.11em",
                    textTransform: "uppercase",
                    color: "rgba(220,38,38,0.62)",
                  }}
                >
                  Endzeit prüfen
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 18,
                    lineHeight: 1.15,
                    fontWeight: 850,
                    color: "#111827",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Stimmt diese Dauer?
                </div>
                <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.45, color: "rgba(15,23,42,0.58)", fontWeight: 600 }}>
                  Der Eintrag wurde vor {fmtDurationCompact(staleStopConfirmation.delayMs)} gestoppt. Bitte prüfe, ob die gespeicherte Endzeit richtig ist.
                </div>
              </div>

              <div style={{ padding: 16, backgroundColor: "#ffffff" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div
                    style={{
                      padding: "10px 11px",
                      borderRadius: 13,
                      backgroundColor: "rgba(15,23,42,0.035)",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>
                      Gestoppt
                    </div>
                    <div style={{ marginTop: 4, fontSize: 20, fontWeight: 850, color: "#111827", letterSpacing: "-0.02em" }}>
                      {formatHm(new Date(staleStopConfirmation.stoppedAtIso))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "10px 11px",
                      borderRadius: 13,
                      backgroundColor: "rgba(5,150,105,0.06)",
                      border: "1px solid rgba(5,150,105,0.14)",
                    }}
                  >
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(5,95,70,0.48)" }}>
                      Jetzt
                    </div>
                    <div style={{ marginTop: 4, fontSize: 20, fontWeight: 850, color: "#047857", letterSpacing: "-0.02em" }}>
                      {formatHm(new Date(staleStopConfirmation.nowIso))}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 11,
                    padding: "10px 12px",
                    borderRadius: 13,
                    backgroundColor: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.14)",
                    color: "rgba(120,53,15,0.74)",
                    fontSize: 10,
                    lineHeight: 1.45,
                    fontWeight: 700,
                  }}
                >
                  Wenn die Tätigkeit weitergelaufen ist, setze die Endzeit auf jetzt. Wenn wirklich früher gestoppt wurde, speichere die bestehende Endzeit.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.85fr 1fr 1.45fr",
                  gap: 7,
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderTop: "1px solid rgba(15,23,42,0.06)",
                }}
              >
                <button
                  onClick={() => setStaleStopConfirmation(null)}
                  disabled={isPersistingLive}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#ffffff",
                    color: "rgba(15,23,42,0.54)",
                    fontSize: 10,
                    fontWeight: 850,
                    cursor: isPersistingLive ? "not-allowed" : "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => void handleStaleStopConfirm(false)}
                  disabled={isPersistingLive}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#ffffff",
                    color: "#111827",
                    fontSize: 10,
                    fontWeight: 850,
                    cursor: isPersistingLive ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                  }}
                >
                  So speichern
                </button>
                <button
                  onClick={() => void handleStaleStopConfirm(true)}
                  disabled={isPersistingLive}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(to bottom, #059669, #0cb880)",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 850,
                    cursor: isPersistingLive ? "not-allowed" : "pointer",
                    boxShadow:
                      "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                  }}
                >
                  Endzeit auf jetzt
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isLiveCommentOpen &&
        awaitingLiveDecision &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setIsLiveCommentOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 20px",
              backgroundColor: "rgba(0,0,0,0.18)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 360,
                backgroundColor: "rgba(255,255,255,0.98)",
                borderRadius: 16,
                boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 16px 10px", backgroundColor: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)" }}>
                  Kommentar
                </div>
              </div>
              <div style={{ padding: "12px 16px", backgroundColor: "#fff" }}>
                <textarea
                  value={liveCommentDraft}
                  onChange={(e) => setLiveCommentDraft(e.target.value)}
                  placeholder="Anmerkung zur Zusatzzeiterfassung..."
                  maxLength={2000}
                  style={{
                    width: "100%",
                    minHeight: 80,
                    fontSize: 12,
                    color: "#1a1a1a",
                    background: "#fff",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div style={{ padding: "10px", display: "flex", alignItems: "center", gap: 7, backgroundColor: "rgba(0,0,0,0.03)", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <button
                  onClick={() => {
                  setLiveComment("");
                  setLiveCommentDraft("");
                    setIsLiveCommentOpen(false);
                  void handleLiveSubmit("");
                  }}
                  style={{
                  flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.4)",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.07), inset 0 0 0 1px rgba(0,0,0,0.06)",
                  }}
                >
                Überspringen
              </button>
              <button
                onClick={() => {
                  const nextComment = liveCommentDraft;
                  setLiveComment(nextComment);
                  setIsLiveCommentOpen(false);
                  void handleLiveSubmit(nextComment);
                }}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(to bottom, #059669, #0cb880)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.28), 0 0 0 1px #04856080, 0 2px 8px rgba(5,150,105,0.25)",
                }}
              >
                Speichern
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function ActivityLauncher({
  activeVisitLocked = false,
  daySessionPayload,
  activeDrafts,
  daySessionLoading = false,
}: {
  activeVisitLocked?: boolean;
  daySessionPayload?: DaySessionCurrentPayload | null;
  activeDrafts?: TimeTrackingEntry[] | null;
  daySessionLoading?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("idle");
  const [marketListMode, setMarketListMode] = useState<MarketListMode>("flex");
  const [openActivity, setOpenActivity] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isMarketsLoading, setIsMarketsLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [blockedActiveVisit, setBlockedActiveVisit] = useState<GmVisitSessionPayload | null>(null);
  const [blockedActiveOpening, setBlockedActiveOpening] = useState(false);
  const [cardMaxH, setCardMaxH] = useState<number | undefined>(undefined);
  const [clockHandler, setClockHandler] = useState<((h: number, m: number) => void) | null>(null);
  const [marketSearch, setMarketSearch] = useState("");
  const [dayStarted, setDayStarted] = useState(true);
  const [currentDayStartedAt, setCurrentDayStartedAt] = useState<string | null>(null);
  const [dayGateLoading, setDayGateLoading] = useState(true);
  const [activeDraftsByActivity, setActiveDraftsByActivity] = useState<Partial<Record<TimeTrackingActivityType, TimeTrackingEntry>>>({});
  const [lockedRunningActivity, setLockedRunningActivity] = useState<TimeTrackingActivityType | null>(null);
  const [sectionStatusByCampaignId, setSectionStatusByCampaignId] = useState<Record<string, MarketSectionStatus>>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const launchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const launchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchRequestSeqRef = useRef(0);

  const filteredMarkets = useMemo(() => {
    if (!marketSearch.trim()) return markets;
    const q = marketSearch.toLowerCase();
    return markets.filter(
      (m) =>
        m.chain.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q) ||
        m.stammnr.toLowerCase().includes(q)
    );
  }, [marketSearch, markets]);

  const refreshDayGate = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setDayGateLoading(true);
    try {
      if (daySessionPayload === null) {
        setDayStarted(false);
        setCurrentDayStartedAt(null);
        return;
      }
      if (daySessionLoading && daySessionPayload === undefined) return;
      const payload = daySessionPayload ?? await fetchCurrentDaySession();
      const localSnapshot = readLatestLocalDaySessionSnapshot();
      const localDayStarted = isLocalDaySessionSnapshotUsableForStartGate(localSnapshot);
      setDayStarted(Boolean(payload.gate?.dayStarted) || localDayStarted);
      setCurrentDayStartedAt(
        payload.session?.dayStartedAt ??
          (localDayStarted ? (localSnapshot?.session?.dayStartedAt ?? localSnapshot?.clientStartedAt) : null) ??
          null,
      );
    } catch {
      const localSnapshot = readLatestLocalDaySessionSnapshot();
      const localDayStarted = isLocalDaySessionSnapshotUsableForStartGate(localSnapshot);
      setDayStarted(localDayStarted);
      setCurrentDayStartedAt(localDayStarted ? (localSnapshot?.session?.dayStartedAt ?? localSnapshot?.clientStartedAt ?? null) : null);
    } finally {
      if (!silent) setDayGateLoading(daySessionLoading && daySessionPayload === undefined);
    }
  }, [daySessionLoading, daySessionPayload]);

  useEffect(() => {
    let cancelled = false;
    setIsMarketsLoading(true);
    const loader = marketListMode === "flex" ? fetchGmFlexStartMarkets : fetchGmAssignedStartMarkets;
    void loader()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map((entry) => ({
          ...mapRecordToLauncherMarket(entry.market),
          activeNowCampaigns:
            marketListMode === "flex"
              ? (entry.activeNowCampaigns ?? []).filter((campaign) => campaign.section === "flex")
              : entry.activeNowCampaigns,
        }));
        const deduped = Array.from(new Map(mapped.map((entry) => [entry.id, entry])).values());
        setMarkets(deduped);
      })
      .catch(() => {
        if (cancelled) return;
        setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setIsMarketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marketListMode]);

  useEffect(() => {
    if (activeDrafts) {
      const map: Partial<Record<TimeTrackingActivityType, TimeTrackingEntry>> = {};
      let preferredOpen: TimeTrackingActivityType | null = null;
      for (const entry of activeDrafts) {
        const key = entry.activityType as TimeTrackingActivityType;
        if (!activities.some((activity) => activity.key === key)) continue;
        if (map[key]) continue;
        map[key] = entry;
        if (!preferredOpen) preferredOpen = key;
        if (!entry.endAt) preferredOpen = key;
      }
      setActiveDraftsByActivity(map);
      if (preferredOpen) setOpenActivity(preferredOpen);
      return;
    }
    let cancelled = false;
    void fetchActiveTimeTrackingDrafts()
      .then((payload) => {
        if (cancelled) return;
        const map: Partial<Record<TimeTrackingActivityType, TimeTrackingEntry>> = {};
        let preferredOpen: TimeTrackingActivityType | null = null;
        for (const entry of payload.entries ?? []) {
          const key = entry.activityType as TimeTrackingActivityType;
          if (!activities.some((activity) => activity.key === key)) continue;
          // API returns newest drafts first. Keep first per activity so older
          // leftovers cannot override the latest state during hydration.
          if (map[key]) continue;
          map[key] = entry;
          if (!preferredOpen) preferredOpen = key;
          if (!entry.endAt) preferredOpen = key;
        }
        setActiveDraftsByActivity(map);
        if (preferredOpen) setOpenActivity(preferredOpen);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveDraftsByActivity({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeDrafts, activities]);

  useEffect(() => {
    if (!selectedMarket) {
      setSectionStatusByCampaignId({});
      return;
    }
    let cancelled = false;
    setSectionStatusByCampaignId({});
    void fetchGmMarketDetail(selectedMarket.id)
      .then((payload) => {
        if (cancelled) return;
        const next: Record<string, MarketSectionStatus> = {};
        for (const campaign of payload.activeCampaigns ?? []) {
          next[campaign.campaignId] = campaign.isComplete
            ? "ausgefuellt"
            : campaign.submittedVisitCount > 0
              ? "teils_ausgefuellt"
              : "nicht_ausgefuellt";
        }
        setSectionStatusByCampaignId(next);
      })
      .catch(() => {
        if (cancelled) return;
        setSectionStatusByCampaignId({});
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMarket]);

  useEffect(() => {
    void refreshDayGate();
  }, [refreshDayGate]);

  useEffect(() => {
    const handleDaySessionUpdated = () => {
      void refreshDayGate({ silent: true });
    };
    window.addEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
    return () => {
      window.removeEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
    };
  }, [refreshDayGate]);

  useEffect(() => {
    function calc() {
      if (!cardRef.current) return;
      const top = cardRef.current.getBoundingClientRect().top;
      const available = Math.floor(window.innerHeight - top - CARD_MENU_SPACE);
      if (!Number.isFinite(available)) return;
      setCardMaxH(Math.max(MIN_CARD_HEIGHT, available));
    }
    requestAnimationFrame(() => requestAnimationFrame(calc));
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    return () => {
      if (launchIntervalRef.current) clearInterval(launchIntervalRef.current);
      if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
    };
  }, []);

  const handleRequestClock = useCallback((_target: "von" | "bis", onSelect: (h: number, m: number) => void) => {
    setClockHandler(() => onSelect);
  }, []);

  const handleManualSave = useCallback(async (input: {
    activityType: ZusatzActivityKey;
    fromHm: string;
    toHm: string;
    comment?: string;
    doctorConfirmationFile?: File | null;
  }) => {
    if (!dayStarted) {
      throw new Error("Bitte zuerst den Arbeitstag starten.");
    }
    const dayStartDate = currentDayStartedAt ? new Date(currentDayStartedAt) : null;
    const baseDate = dayStartDate && Number.isFinite(dayStartDate.getTime()) ? dayStartDate : new Date();
    const startIso = toIsoForLocalTime(baseDate, input.fromHm);
    if (currentDayStartedAt && new Date(startIso).getTime() < new Date(currentDayStartedAt).getTime()) {
      throw new Error(`Startzeit liegt vor dem Arbeitstagsstart ${formatHmWithSeconds(new Date(currentDayStartedAt))}.`);
    }
    let endIso = toIsoForLocalTime(baseDate, input.toHm);
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      const nextDay = new Date(baseDate);
      nextDay.setDate(nextDay.getDate() + 1);
      endIso = toIsoForLocalTime(nextDay, input.toHm);
    }
    if (input.activityType === "pause") {
      await createManualDayPause({ startAt: startIso, endAt: endIso });
      return;
    }
    const token = `${input.activityType}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const started = await startTimeTrackingDraft({
      activityType: input.activityType,
      startAt: startIso,
      endAt: endIso,
      clientEntryToken: token,
    });
    const trimmedComment = input.comment?.trim();
    if (trimmedComment) {
      await commentTimeTrackingDraft(started.entry.id, { comment: trimmedComment });
    }
    if (input.doctorConfirmationFile) {
      await uploadTimeTrackingDoctorConfirmation(started.entry.id, input.doctorConfirmationFile);
    }
    await endTimeTrackingDraft(started.entry.id, { endAt: endIso });
    await submitTimeTrackingEntry(started.entry.id);
  }, [currentDayStartedAt, dayStarted]);

  const handleMarketSelect = useCallback((market: Market) => {
    if (isLaunching) return;
    setMarketSearch("");
    setLaunchError(null);
    setSelectedMarket(market);
    setSelectedSectionIds([]);
    setView("selectSections");
  }, [isLaunching]);

  const toggleSection = useCallback((sectionId: string) => {
    if (isLaunching) return;
    setSelectedSectionIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId],
    );
  }, [isLaunching]);

  const selectableSections = useMemo(
    () =>
      (selectedMarket?.activeNowCampaigns ?? []).filter((campaign) =>
        marketListMode === "flex" ? campaign.section === "flex" : true,
      ),
    [marketListMode, selectedMarket],
  );

  const blockedActiveCampaignNames = useMemo(
    () => Array.from(new Set((blockedActiveVisit?.sections ?? []).map((section) => section.campaignName).filter(Boolean))),
    [blockedActiveVisit],
  );

  const openBlockedActiveVisit = useCallback(async () => {
    if (!blockedActiveVisit || blockedActiveOpening) return;
    setBlockedActiveOpening(true);
    try {
      const payload = await fetchGmVisitSession(blockedActiveVisit.session.id);
      setGmVisitPreloadCache(payload);
      const campaignIds = Array.from(new Set(payload.sections.map((section) => section.campaignId).filter(Boolean)));
      const address = [
        payload.market.address,
        [payload.market.postalCode, payload.market.city].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      router.push(
        `/gm/marktbesuch?chain=${encodeURIComponent(payload.market.name)}&address=${encodeURIComponent(address)}&marketId=${encodeURIComponent(payload.market.id)}&campaignIds=${encodeURIComponent(campaignIds.join(","))}&sessionId=${encodeURIComponent(payload.session.id)}`,
      );
    } catch {
      setBlockedActiveOpening(false);
      setLaunchError("Aktiver Fragebogen konnte nicht geoeffnet werden. Bitte erneut versuchen.");
    }
  }, [blockedActiveOpening, blockedActiveVisit, router]);

  const handleConfirmSections = useCallback(() => {
    if (!selectedMarket || selectedSectionIds.length === 0 || isLaunching) return;
    const requestSeq = ++launchRequestSeqRef.current;
    if (launchIntervalRef.current) clearInterval(launchIntervalRef.current);
    if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
    setIsLaunching(true);
    setLaunchError(null);
    setBlockedActiveVisit(null);
    setLaunchProgress(8);

    launchIntervalRef.current = setInterval(() => {
      setLaunchProgress((current) => (current >= 90 ? 90 : current + 2.5));
    }, 80);

    void (async () => {
      const isStale = () => launchRequestSeqRef.current !== requestSeq;
      try {
        const activeVisit = await fetchActiveGmVisitSession({
          marketId: selectedMarket.id,
          campaignIds: selectedSectionIds,
        });
        if (isStale()) return;
        if (activeVisit.session?.id) {
          const payload = await fetchGmVisitSession(activeVisit.session.id);
          if (isStale()) return;
          setGmVisitPreloadCache(payload);
        } else {
          const latestActiveVisit = await fetchLatestActiveGmVisitSession();
          if (isStale()) return;
          if (latestActiveVisit.session?.id) {
            if (launchIntervalRef.current) {
              clearInterval(launchIntervalRef.current);
              launchIntervalRef.current = null;
            }
            setIsLaunching(false);
            setLaunchProgress(0);
            setBlockedActiveVisit(latestActiveVisit as GmVisitSessionPayload);
            return;
          }
          const payload = await fetchGmVisitStartPayload(selectedMarket.id, selectedSectionIds);
          if (isStale()) return;
          setGmVisitStartPreloadCache({
            marketId: selectedMarket.id,
            campaignIds: selectedSectionIds,
            payload,
          });
        }
        if (launchIntervalRef.current) {
          clearInterval(launchIntervalRef.current);
          launchIntervalRef.current = null;
        }
        setLaunchProgress(100);
        const sessionParam = activeVisit.session?.id ? `&sessionId=${encodeURIComponent(activeVisit.session.id)}` : "";
        router.push(
          `/gm/marktbesuch?chain=${encodeURIComponent(selectedMarket.chain)}&address=${encodeURIComponent(selectedMarket.address)}&marketId=${encodeURIComponent(selectedMarket.id)}&campaignIds=${encodeURIComponent(selectedSectionIds.join(","))}${sessionParam}`,
        );
      } catch {
        if (isStale()) return;
        if (launchIntervalRef.current) {
          clearInterval(launchIntervalRef.current);
          launchIntervalRef.current = null;
        }
        setIsLaunching(false);
        setLaunchProgress(0);
        setLaunchError("Marktbesuch konnte nicht vorbereitet werden. Bitte erneut versuchen.");
      }
    })();
  }, [isLaunching, router, selectedMarket, selectedSectionIds]);

  const canConfirmSections = selectedSectionIds.length > 0 && !isLaunching && !!selectedMarket;

  return (
    <div
      ref={cardRef}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
        overflow: "hidden",
        maxHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        minHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Idle View ── */}
      <div
        style={{
          opacity: view === "idle" ? 1 : 0,
          pointerEvents: view === "idle" ? "auto" : "none",
          transform: view === "idle" ? "translateY(0)" : "translateY(-6px)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Marktbesuch row */}
        <div
          className="flex items-center justify-between"
          style={{ paddingBottom: 12 }}
        >
          <div className="flex items-center gap-2.5">
            <Store size={14} strokeWidth={1.6} color="#DC2626" />
            <span className="text-[12px] font-semibold text-gray-800">
              Marktbesuch
            </span>
          </div>
          <button
            onClick={() => {
              if (!dayStarted || dayGateLoading || activeVisitLocked) return;
              setSelectedMarket(null);
              setSelectedSectionIds([]);
              setView("selectMarket");
            }}
            disabled={!dayStarted || dayGateLoading || activeVisitLocked}
            style={{
              padding: "4px 14px",
              fontSize: 10,
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(to bottom, #DC2626, #e84040)",
              border: "none",
              borderRadius: 7,
              cursor: !dayStarted || dayGateLoading || activeVisitLocked ? "not-allowed" : "pointer",
              boxShadow:
                "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
              transition: "all 0.15s ease",
              letterSpacing: "0.01em",
              opacity: !dayStarted || dayGateLoading || activeVisitLocked ? 0.6 : 1,
            }}
          >
            Starten
          </button>
        </div>

        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />

        {/* Zusatzzeiterfassung */}
        <div style={{ marginTop: 12, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-400 shrink-0">
            Zusatzzeiterfassung
          </span>

          <div
            style={{
              marginTop: 8,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {activities.map((a, i) => (
              <AccordionRow
                key={a.key}
                activity={a}
                isOpen={openActivity === a.key}
                onToggle={() => {
                  if (lockedRunningActivity && lockedRunningActivity !== a.key) return;
                  setOpenActivity((prev) => (prev === a.key ? null : a.key));
                }}
                isLast={i === activities.length - 1}
                onRequestClock={handleRequestClock}
                onManualSave={handleManualSave}
                dayStarted={dayStarted}
                dayStartedAt={currentDayStartedAt}
                initialDraft={a.key === "pause" ? null : activeDraftsByActivity[a.key] ?? null}
                onRunningLockChange={
                  a.key === "pause"
                    ? undefined
                    : (activityKey, locked) => {
                        setLockedRunningActivity((prev) => {
                          if (locked) return activityKey;
                          if (prev === activityKey) return null;
                          return prev;
                        });
                      }
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Market Selection View ── */}
      <DashboardGateOverlay
        loading={dayGateLoading}
        locked={!dayStarted}
        lockTitle="Arbeitstag nicht gestartet"
        lockText="Starte zuerst deinen Arbeitstag, dann sind Marktbesuch und Zusatzzeiten freigegeben."
        readyTitle="Arbeitstag aktiv"
        readyText="Du kannst jetzt Marktbesuche und Zusatzzeiten erfassen."
        inset={10}
      />

      {!dayGateLoading && dayStarted && activeVisitLocked && (
        <DashboardGateOverlay
          loading={false}
          locked
          lockTitle="Aktiver Fragebogen offen"
          lockText="Schliesse den laufenden Fragebogen ab, bevor du einen neuen Marktbesuch startest."
          inset={10}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "18px 20px 16px",
          backgroundColor: "#ffffff",
          borderRadius: 14,
          opacity: view === "selectMarket" ? 1 : 0,
          pointerEvents: view === "selectMarket" ? "auto" : "none",
          transform:
            view === "selectMarket" ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflowY: "auto",
          scrollbarWidth: "none" as const,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <button
            onClick={() => setView("idle")}
            className="flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              backgroundColor: "rgba(0,0,0,0.04)",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            <ChevronLeft size={13} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          </button>
          <span className="text-[12px] font-semibold text-gray-700">
            Markt auswählen
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                if (marketListMode === "assigned") return;
                setMarketListMode("assigned");
                setMarketSearch("");
                setSelectedMarket(null);
                setSelectedSectionIds([]);
              }}
              style={{
                padding: "5px 11px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.02em",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                color: marketListMode === "assigned" ? "#ffffff" : "rgba(0,0,0,0.48)",
                background:
                  marketListMode === "assigned"
                    ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                    : "rgba(0,0,0,0.06)",
                boxShadow:
                  marketListMode === "assigned"
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.28), 0 0 0 1px #b91c1c, 0 1px 5px rgba(185,28,28,0.18)"
                    : "none",
              }}
            >
              Zugewiesen
            </button>
            <button
              type="button"
              onClick={() => {
                if (marketListMode === "flex") return;
                setMarketListMode("flex");
                setMarketSearch("");
                setSelectedMarket(null);
                setSelectedSectionIds([]);
              }}
              style={{
                padding: "5px 11px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.02em",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                color: marketListMode === "flex" ? "#ffffff" : "rgba(0,0,0,0.48)",
                background:
                  marketListMode === "flex"
                    ? "linear-gradient(to bottom, #111827, #1f2937)"
                    : "rgba(0,0,0,0.06)",
                boxShadow:
                  marketListMode === "flex"
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.24), 0 0 0 1px #111827, 0 1px 5px rgba(0,0,0,0.22)"
                    : "none",
              }}
            >
              Flex
            </button>
          </div>
        </div>

        <div className="relative" style={{ marginBottom: 8 }}>
          <Search
            size={11}
            strokeWidth={1.8}
            className="absolute"
            style={{ left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.25)" }}
          />
          <input
            type="text"
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Suchen..."
            className="w-full text-[10px] text-gray-600 placeholder-gray-300 outline-none"
            style={{
              padding: "5px 10px 5px 24px",
              backgroundColor: "transparent",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderRadius: 0,
            }}
          />
        </div>

        <div>
          {!isMarketsLoading && filteredMarkets.map((m, i) => {
            const cc = chainColor(m.chain);
            return (
              <div
                key={m.id}
                onClick={() => handleMarketSelect(m)}
                className="flex items-center gap-2"
                style={{
                  padding: "9px 6px",
                  borderRadius: 7,
                  cursor: "pointer",
                  borderBottom:
                    i < filteredMarkets.length - 1
                      ? "1px solid rgba(0,0,0,0.04)"
                      : "none",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span
                  className="shrink-0 text-[9px] font-semibold uppercase"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 5,
                    backgroundColor: cc.bg,
                    color: cc.text,
                    letterSpacing: "0.02em",
                  }}
                >
                  {m.chain}
                </span>
                <span className="min-w-0 flex-1 text-[10px] font-medium text-gray-600 truncate">
                  {m.address}
                </span>
                {m.stammnr && (
                  <span
                    className="shrink-0 text-[9px] font-semibold text-gray-400"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {m.stammnr}
                  </span>
                )}
              </div>
            );
          })}
          {isMarketsLoading && (
            <div style={{ padding: "2px 0 8px" }}>
              <GmSkeletonMarketRows count={5} />
            </div>
          )}

          {!isMarketsLoading && markets.length === 0 && (
            <div style={{ padding: "14px 6px", fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
              {marketListMode === "flex"
                ? "Keine Flex-Startmärkte verfügbar."
                : "Keine zugewiesenen Märkte in diesem RED-Monat."}
            </div>
          )}
        </div>
      </div>

      {/* ── Section Selection View ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "18px 20px 16px",
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 14,
          opacity: view === "selectSections" ? 1 : 0,
          pointerEvents: view === "selectSections" ? "auto" : "none",
          transform: view === "selectSections" ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflowY: "auto",
          scrollbarWidth: "none" as const,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <button
            onClick={() => {
              if (isLaunching) return;
              setView("selectMarket");
            }}
            className="flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              backgroundColor: "rgba(0,0,0,0.04)",
              border: "none",
              cursor: isLaunching ? "not-allowed" : "pointer",
              transition: "background-color 0.15s ease",
              opacity: isLaunching ? 0.45 : 1,
            }}
          >
            <ChevronLeft size={13} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          </button>
          <span className="text-[12px] font-semibold text-gray-700">Sektionen auswählen</span>
        </div>

        {selectedMarket && (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(0,0,0,0.015)",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              className="shrink-0 text-[9px] font-semibold uppercase"
              style={{
                padding: "2px 8px",
                borderRadius: 5,
                backgroundColor: chainColor(selectedMarket.chain).bg,
                color: chainColor(selectedMarket.chain).text,
                letterSpacing: "0.02em",
              }}
            >
              {selectedMarket.chain}
            </span>
            <span className="text-[10px] font-medium text-gray-600 truncate">{selectedMarket.address}</span>
          </div>
        )}
        {launchError && (
          <div
            style={{
              marginBottom: 10,
              borderRadius: 8,
              border: "1px solid rgba(220,38,38,0.24)",
              background: "rgba(220,38,38,0.06)",
              color: "#991b1b",
              fontSize: 10,
              fontWeight: 600,
              padding: "7px 9px",
            }}
          >
            {launchError}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 58 }}>
          {selectableSections.map((section) => {
            const selected = selectedSectionIds.includes(section.campaignId);
            const status = sectionStatusMeta(sectionStatusByCampaignId[section.campaignId] ?? "nicht_ausgefuellt");
            return (
              <button
                key={section.campaignId}
                type="button"
                onClick={() => toggleSection(section.campaignId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 10,
                  border: `1px solid ${selected ? "rgba(220,38,38,0.26)" : "rgba(0,0,0,0.06)"}`,
                  background: selected ? "rgba(220,38,38,0.04)" : "#fff",
                  padding: "9px 10px",
                  cursor: isLaunching ? "not-allowed" : "pointer",
                  transition: "all 0.16s ease",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  gap: 8,
                  opacity: isLaunching ? 0.6 : 1,
                }}
                disabled={isLaunching}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1f2937", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {section.campaignName}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 9, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sectionLabel(section.section)}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: status.color,
                    background: status.bg,
                    boxShadow: `inset 0 0 0 1px ${status.ring}`,
                    borderRadius: 99,
                    padding: "3px 8px",
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {status.label}
                </span>

                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    border: selected ? "1px solid rgba(220,38,38,0.55)" : "1px solid rgba(0,0,0,0.16)",
                    background: selected ? "linear-gradient(to bottom, #DC2626, #b91c1c)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  {selected && <Check size={10} strokeWidth={2.8} color="#fff" />}
                </div>
              </button>
            );
          })}
          {selectableSections.length === 0 && (
            <div style={{ padding: "10px 6px", fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
              {marketListMode === "flex"
                ? "Keine aktiven Flexkampagnen für diesen Markt verfügbar."
                : "Keine aktuell aktiven Kampagnen für diesen Markt."}
            </div>
          )}
        </div>

        <div style={{ position: "sticky", bottom: -16, marginTop: "auto", marginLeft: -20, marginRight: -20, marginBottom: 0, height: 34, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.96)" }}>
          <button
            type="button"
            onClick={handleConfirmSections}
            disabled={!canConfirmSections}
            style={{
              padding: "5px 12px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.01em",
              borderRadius: 7,
              border: "none",
              cursor: canConfirmSections ? "pointer" : "not-allowed",
              color: "#fff",
              background: canConfirmSections
                ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                : "rgba(0,0,0,0.14)",
              boxShadow: canConfirmSections
                ? "inset 0 1px 0.6px rgba(255,255,255,0.3), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.15)"
                : "none",
              opacity: canConfirmSections ? 1 : 0.8,
              transition: "all 0.15s ease",
            }}
          >
            Bestätigen
          </button>
        </div>
      </div>

      {/* ── Clock Picker (card-level overlay) ── */}
      {clockHandler && (
        <ClockPicker
          onSelect={(h, m) => {
            clockHandler(h, m);
            setClockHandler(null);
          }}
          onCancel={() => setClockHandler(null)}
        />
      )}

      {/* ── Launching overlay ── */}
      {isLaunching && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.96)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            animation: "confirmIn 0.24s ease",
            padding: "20px 24px",
          }}
        >
          <style>{`
            @keyframes confirmIn {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes launchStripe {
              from { background-position: 0 0; }
              to { background-position: 26px 0; }
            }
          `}</style>
          <div style={{ width: "100%", maxWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", letterSpacing: "-0.01em", textAlign: "center" }}>
              Markt wird gestartet...
            </div>
            <div
              style={{
                marginTop: 9,
                height: 8,
                borderRadius: 99,
                background: "rgba(0,0,0,0.06)",
                overflow: "hidden",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: `${launchProgress}%`,
                  height: "100%",
                  borderRadius: 99,
                  backgroundImage: "repeating-linear-gradient(-45deg, rgba(220,38,38,0.92) 0px, rgba(220,38,38,0.92) 4px, rgba(248,113,113,0.45) 4px, rgba(248,113,113,0.45) 8px)",
                  backgroundColor: "#DC2626",
                  animation: "launchStripe 0.8s linear infinite",
                  transition: "width 0.08s linear",
                }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(0,0,0,0.42)", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(launchProgress)}%
            </div>
          </div>
        </div>
      )}
      <ActiveFragebogenBlockModal
        open={Boolean(blockedActiveVisit)}
        opening={blockedActiveOpening}
        marketName={blockedActiveVisit?.market.name}
        campaignNames={blockedActiveCampaignNames}
        onClose={() => {
          if (blockedActiveOpening) return;
          setBlockedActiveVisit(null);
        }}
        onOpenActive={() => {
          void openBlockedActiveVisit();
        }}
      />
    </div>
  );
}
