"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Car } from "lucide-react";
import {
  deferDaySessionEndKm,
  deferDaySessionStartKm,
  endDayPause,
  endDaySession,
  fetchTodaySubmissions,
  fetchCurrentDaySession,
  setDaySessionEndKm,
  setDaySessionStartKm,
  startDayPause,
  startDaySession,
  submitDaySession,
  type DaySession,
  type TodaySubmissionItem,
} from "@/lib/api/backend";
import {
  persistLocalDaySessionFromBackend,
  readLatestLocalDaySessionSnapshot,
  saveLocalDaySessionStartSnapshot,
  type LocalDaySessionSnapshot,
} from "@/lib/gm/daySessionPersistence";

interface TimeTrackerProps {
  currentPhase?: string; // exposed for debug panel
}

interface DaySummarySnapshot {
  startKm:        number;
  endKm:          number;
  deltaKm:        number;
  marketCount:    number;
  zusatzCount:    number;
  trackedSeconds: number;
}

const TODAY_SUBMISSIONS_UPDATED_EVENT = "gm:today-submissions-updated";
const DAY_SESSION_UPDATED_EVENT = "gm:day-session-updated";

function fmt(s: number): string {
  const h   = String(Math.floor(s / 3600)).padStart(2, "0");
  const m   = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function fmtKm(raw: string): string {
  const num = parseInt(raw.replace(/\D/g, ""), 10);
  if (isNaN(num)) return raw;
  return num.toLocaleString("de-AT");
}

function secondsSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

function toYmdInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toIsoFromWorkDateHm(workDate: string, hm: string, timeZone: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const [yearRaw, monthRaw, dayRaw] = workDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  let candidateEpoch = utcGuess.getTime() - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(candidateEpoch), timeZone);
  if (secondOffset !== firstOffset) {
    candidateEpoch = utcGuess.getTime() - secondOffset;
  }
  const candidate = new Date(candidateEpoch);
  if (toYmdInTimezone(candidate, timeZone) !== workDate) return null;
  return candidate.toISOString();
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get("year") ?? "0");
  const month = Number(map.get("month") ?? "1");
  const day = Number(map.get("day") ?? "1");
  const hour = Number(map.get("hour") ?? "0");
  const minute = Number(map.get("minute") ?? "0");
  const second = Number(map.get("second") ?? "0");
  const asUtcEpoch = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return asUtcEpoch - date.getTime();
}

function msUntilNextTimezoneMidnight(timeZone: string): number {
  const now = new Date();
  const nowOffset = getTimeZoneOffsetMs(now, timeZone);
  const tzWallNow = new Date(now.getTime() + nowOffset);
  const nextWallMidnightEpoch = Date.UTC(
    tzWallNow.getUTCFullYear(),
    tzWallNow.getUTCMonth(),
    tzWallNow.getUTCDate() + 1,
    0,
    0,
    1,
    0,
  );
  let candidateUtcEpoch = nextWallMidnightEpoch - nowOffset;
  const targetOffset = getTimeZoneOffsetMs(new Date(candidateUtcEpoch), timeZone);
  candidateUtcEpoch = nextWallMidnightEpoch - targetOffset;
  return Math.max(1000, candidateUtcEpoch - now.getTime());
}

function isStaleOpenDaySession(session: DaySession | null, timeZone: string): boolean {
  if (!session || session.status !== "started" || !session.dayStartedAt) return false;
  const sessionWorkDate = session.workDate || toYmdInTimezone(new Date(session.dayStartedAt), timeZone);
  const today = toYmdInTimezone(new Date(), timeZone);
  return sessionWorkDate < today;
}

// ── Mini clock picker (borrowed from ActivityLauncher pattern) ────────────────
function ClockOverlay({ onSelect, onCancel }: {
  onSelect: (h: number, m: number) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);

  const items  = step === "hour" ? Array.from({ length: 24 }, (_, i) => i) : Array.from({ length: 12 }, (_, i) => i * 5);
  const CENTER = 90;
  const NUM_R  = 62;

  function posFor(val: number) {
    const inner = step === "hour" && val >= 12;
    const r   = inner ? NUM_R - 22 : NUM_R;
    const count = step === "hour" ? 12 : 12;
    const idx   = step === "hour" ? val % 12 : val / 5;
    const a     = (idx / count) * 360 - 90;
    const rad   = (a * Math.PI) / 180;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  }

  const selIdx   = step === "hour" ? hour % 12 : minute / 5;
  const selAngle = (selIdx / 12) * 360 - 90;
  const selRad   = (selAngle * Math.PI) / 180;
  const innerSel = step === "hour" && hour >= 12;
  const lineR    = innerSel ? NUM_R - 22 : NUM_R;

  function handleTap(val: number) {
    if (step === "hour") { setHour(val); setTimeout(() => setStep("minute"), 200); }
    else                 { setMinute(val); setTimeout(() => onSelect(hour, val), 150); }
  }

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 14, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "clockOverlayIn 0.18s ease both" }}>
      <style>{`@keyframes clockOverlayIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.38)", marginBottom: 8 }}>
        {step === "hour" ? "Stunde" : "Minute"}
      </span>
      <svg width={170} height={170} viewBox="0 0 180 180">
        <circle cx={CENTER} cy={CENTER} r={76} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
        <line x1={CENTER} y1={CENTER} x2={CENTER + lineR * Math.cos(selRad)} y2={CENTER + lineR * Math.sin(selRad)} stroke="#DC2626" strokeWidth={1.5} strokeLinecap="round" style={{ transition: "all 0.15s ease" }} />
        <circle cx={CENTER} cy={CENTER} r={3} fill="#DC2626" />
        {items.map(val => {
          const p = posFor(val);
          const isSel = step === "hour" ? val === hour : val === minute;
          const label = step === "hour" ? String(val) : String(val).padStart(2, "0");
          return (
            <g key={val} onClick={() => handleTap(val)} style={{ cursor: "pointer" }}>
              {isSel && <circle cx={p.x} cy={p.y} r={13} fill="#DC2626" style={{ transition: "all 0.15s ease" }} />}
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={step === "hour" && val >= 12 ? 8 : 9} fontWeight={isSel ? 700 : 500} fill={isSel ? "#fff" : "rgba(0,0,0,0.55)"} style={{ userSelect: "none" }}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#DC2626", fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
        {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
      </span>
      <button onClick={onCancel} style={{ marginTop: 8, fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px 12px" }}>
        Abbrechen
      </button>
    </div>
  );
}

// ── KM input: raw digits while focused, formatted when blurred ───────────────
function KmInput({ inputRef, rawValue, isValid, isFocused, placeholder, onChange, onKeyDown, onFocus, onBlur }: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  rawValue: string; isValid: boolean; isFocused: boolean; placeholder?: string;
  onChange: (digits: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void; onBlur: () => void;
}) {
  const displayValue = isFocused ? rawValue : (rawValue ? fmtKm(rawValue) : "");
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 200 }}>
      <input ref={inputRef} type="text" inputMode="numeric" placeholder={placeholder ?? "0"} value={displayValue}
        onChange={e => onChange(e.target.value.replace(/\D/g, ""))} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur}
        style={{ width: "100%", padding: "11px 44px 11px 16px", fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", textAlign: "right", color: isValid ? "#1a1a1a" : "rgba(0,0,0,0.32)", backgroundColor: isFocused ? "#fff" : "rgba(0,0,0,0.025)", border: isFocused ? `1px solid ${isValid ? "rgba(5,150,105,0.55)" : "rgba(0,0,0,0.22)"}` : isValid ? "1px solid rgba(5,150,105,0.4)" : "1px solid rgba(0,0,0,0.1)", borderRadius: 9, outline: "none", transition: "border 0.18s ease, color 0.18s ease, background 0.18s ease", boxSizing: "border-box", MozAppearance: "textfield" as never }} />
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", color: isValid ? "rgba(5,150,105,0.7)" : "rgba(0,0,0,0.28)", pointerEvents: "none", transition: "color 0.18s ease" }}>km</span>
    </div>
  );
}

// ── Grey outer / white inner shell ────────────────────────────────────────────
function KmCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", background: "rgba(0,0,0,0.028)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden", position: "relative" as const }}>
      <div style={{ margin: "8px 8px 8px", background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" as const }}>
        {children}
      </div>
    </div>
  );
}

// ── Compact stat cell ─────────────────────────────────────────────────────────
function StatCell({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 6px", borderRadius: 8, background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.12)" }}>
      <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", marginBottom: 4, whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: accent ? "#16a34a" : "#1a1a1a" }}>
        {value}{unit ? <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)", marginLeft: 2 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

// ── Time field (compact, with clock button) ────────────────────────────────────
function TimeField({ value, onOpenClock }: { value: string; onOpenClock: () => void }) {
  const hasValue = !!value;
  return (
    <div onClick={onOpenClock} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 10px", borderRadius: 9, border: hasValue ? "1px solid rgba(5,150,105,0.4)" : "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.025)", cursor: "pointer", width: "100%", boxSizing: "border-box", transition: "border 0.18s ease" }}>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", color: hasValue ? "#1a1a1a" : "rgba(0,0,0,0.28)" }}>
        {hasValue ? value : "––:––"}
      </span>
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", color: hasValue ? "rgba(5,150,105,0.7)" : "rgba(0,0,0,0.28)" }}>Uhr</span>
    </div>
  );
}

export function TimeTracker(_: TimeTrackerProps) {
  const trackerTimezone = "Europe/Vienna";
  const [running, setRunning] = useState(false);
  const [paused, setPaused]   = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [daySession, setDaySession] = useState<DaySession | null>(null);
  const [todayItems, setTodayItems] = useState<TodaySubmissionItem[]>([]);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [openEndKmOnly, setOpenEndKmOnly] = useState(false);

  // ── KM state ─────────────────────────────────────────────────────────────
  const [startKmInput, setStartKmInput]         = useState("");
  const [confirmedStartKm, setConfirmedStartKm] = useState<number | null>(null);
  const [endKmInput, setEndKmInput]             = useState("");
  const [activeKmField, setActiveKmField]       = useState<"start" | "end" | null>(null);

  // New-car flow
  const [newCarSlot, setNewCarSlot]           = useState<"input" | "confirm">("input");
  const [newCarConfirmed, setNewCarConfirmed] = useState(false);

  // ── Day summary ───────────────────────────────────────────────────────────
  const [daySummarySnapshot, setDaySummarySnapshot] = useState<DaySummarySnapshot | null>(null);
  const [summaryProgress, setSummaryProgress]       = useState(1);
  const summaryTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SUMMARY_DURATION  = 20;

  // ── forgotEnd state ───────────────────────────────────────────────────────
  const [forgotEndTime, setForgotEndTime]           = useState("");
  const [forgotEndClockOpen, setForgotEndClockOpen] = useState(false);
  const [hasTriggeredForgotEnd, setHasTriggeredForgotEnd] = useState(false);
  // newCarSlot / newCarConfirmed / endKmInput are reused in forgotEnd too

  // ── Phase ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"idle" | "startKm" | "recording" | "endKm" | "daySummary" | "forgotEnd">("idle");
  const [phaseVisible, setPhaseVisible] = useState(true);
  const canStartButton = !persistBusy && daySession?.status !== "submitted";

  const startKmRef = useRef<HTMLInputElement>(null);
  const endKmRef   = useRef<HTMLInputElement>(null);

  // ── Debug panel ───────────────────────────────────────────────────────────
  const [debugOpen, setDebugOpen]     = useState(false);
  const [debugPos, setDebugPos]       = useState({ x: 20, y: 80 });
  const [debugOpacity, setDebugOpacity] = useState(0.92);
  const debugDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ── Key combo: Shift + J + K ──────────────────────────────────────────────
  useEffect(() => {
    const pressed = new Set<string>();
    const onDown  = (e: KeyboardEvent) => {
      pressed.add(e.key.toLowerCase());
      if (pressed.has("shift") && pressed.has("j") && pressed.has("k")) {
        setDebugOpen(o => !o);
      }
    };
    const onUp = (e: KeyboardEvent) => { pressed.delete(e.key.toLowerCase()); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // ── Debug panel drag ──────────────────────────────────────────────────────
  const handleDebugHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    debugDragRef.current = { startX: e.clientX, startY: e.clientY, origX: debugPos.x, origY: debugPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!debugDragRef.current) return;
      setDebugPos({
        x: Math.max(0, debugDragRef.current.origX + ev.clientX - debugDragRef.current.startX),
        y: Math.max(0, debugDragRef.current.origY + ev.clientY - debugDragRef.current.startY),
      });
    };
    const onUp = () => { debugDragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [debugPos]);

  const active = running && !paused;
  const notifyDaySessionUpdated = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DAY_SESSION_UPDATED_EVENT));
    }
  }, []);

  const enterForgotEndMode = useCallback(() => {
    setHasTriggeredForgotEnd(true);
    setStartKmInput("");
    setEndKmInput("");
    setNewCarSlot("input");
    setNewCarConfirmed(false);
    setActiveKmField(null);
    setForgotEndTime("");
    setForgotEndClockOpen(false);
    setRunning(false);
    setPaused(false);
    transitionTo("forgotEnd");
  }, []);

  const applyLocalDaySessionSnapshot = useCallback((snapshot: LocalDaySessionSnapshot) => {
    const session = snapshot.session;
    setDaySession(session);
    setConfirmedStartKm(session?.startKm ?? null);
    setEndKmInput(session?.endKm != null ? String(session.endKm) : "");
    setPaused(false);
    setSeconds(secondsSince(snapshot.clientStartedAt));
    if (snapshot.status === "ended") {
      setRunning(false);
      setPhase(session && !session.isEndKmCompleted ? "endKm" : "idle");
      return;
    }
    if (
      (session && isStaleOpenDaySession(session, trackerTimezone)) ||
      (!session && snapshot.workDate < toYmdInTimezone(new Date(), snapshot.timezone || trackerTimezone))
    ) {
      enterForgotEndMode();
      return;
    }
    setRunning(true);
    if (session?.isStartKmCompleted) {
      setPhase("recording");
    } else {
      setPhase("startKm");
    }
  }, [enterForgotEndMode, trackerTimezone]);

  const reconcileLocalDayStart = useCallback(async (snapshot: LocalDaySessionSnapshot) => {
    try {
      const { session } = await startDaySession({
        timezone: snapshot.timezone,
        startedAt: snapshot.clientStartedAt,
      });
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setConfirmedStartKm(session.startKm ?? null);
      setEndKmInput(session.endKm != null ? String(session.endKm) : "");
      if (session.status === "started") {
        setRunning(true);
        setPaused(false);
        setSeconds(secondsSince(session.dayStartedAt));
        setPhase(session.isStartKmCompleted ? "recording" : "startKm");
      }
      setPersistError(null);
      notifyDaySessionUpdated();
    } catch {
      setPersistError("Tagesstart ist lokal gesichert. Synchronisierung laeuft, sobald die Verbindung wieder da ist.");
    }
  }, [notifyDaySessionUpdated]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const hydrateFromBackend = useCallback(async () => {
    setPersistError(null);
    const localSnapshot = readLatestLocalDaySessionSnapshot();
    try {
      const payload = await fetchCurrentDaySession();
      const session = payload.session;
      setDaySession(session);
      if (!session) {
        if (localSnapshot) {
          applyLocalDaySessionSnapshot(localSnapshot);
          setPersistError("Tagesstart ist lokal gesichert. Synchronisierung laeuft, sobald die Verbindung wieder da ist.");
          void reconcileLocalDayStart(localSnapshot);
          return;
        }
        setRunning(false);
        setPaused(false);
        setSeconds(0);
        setConfirmedStartKm(null);
        setPhase("idle");
        return;
      }
      persistLocalDaySessionFromBackend(session);
      setConfirmedStartKm(session.startKm ?? null);
      setEndKmInput(session.endKm != null ? String(session.endKm) : "");
      if (session.status === "started") {
        setPaused(Boolean(payload.gate.pauseOpen));
        setSeconds(secondsSince(session.dayStartedAt));
        if (isStaleOpenDaySession(session, trackerTimezone)) {
          enterForgotEndMode();
          return;
        }
        setRunning(true);
        if (!session.isStartKmCompleted) {
          setPhase("startKm");
        } else {
          setPhase("recording");
        }
        return;
      }
      if (session.status === "ended") {
        setRunning(false);
        setPaused(false);
        setSeconds(secondsSince(session.dayStartedAt));
        if (!session.isEndKmCompleted) {
          setPhase("endKm");
        } else {
          setPhase("idle");
        }
        return;
      }
      setRunning(false);
      setPaused(false);
      setSeconds(0);
      setPhase("idle");
    } catch (error) {
      if (localSnapshot) {
        applyLocalDaySessionSnapshot(localSnapshot);
        setPersistError("Tagesstart ist lokal gesichert. Synchronisierung laeuft, sobald die Verbindung wieder da ist.");
        void reconcileLocalDayStart(localSnapshot);
        return;
      }
      const message = error instanceof Error ? error.message : "Arbeitstag konnte nicht geladen werden.";
      setPersistError(message);
    }
  }, [applyLocalDaySessionSnapshot, enterForgotEndMode, reconcileLocalDayStart, trackerTimezone]);

  const hydrateTodaySubmissions = useCallback(async (): Promise<TodaySubmissionItem[]> => {
    try {
      const data = await fetchTodaySubmissions();
      const items = data.items ?? [];
      setTodayItems(items);
      return items;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Einträge konnten nicht geladen werden.";
      setPersistError(message);
      return [];
    }
  }, []);

  useEffect(() => {
    void hydrateFromBackend();
    void hydrateTodaySubmissions();
  }, [hydrateFromBackend, hydrateTodaySubmissions]);

  // ── Auto-focus KM fields ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "startKm")  setTimeout(() => startKmRef.current?.focus(), 220);
    if (phase === "endKm")    setTimeout(() => endKmRef.current?.focus(),   220);
    if (phase === "forgotEnd") setTimeout(() => endKmRef.current?.focus(),  220);
  }, [phase]);

  // Stale open day trigger: after midnight, yesterday's open day must be closed first.
  useEffect(() => {
    if (!isStaleOpenDaySession(daySession, trackerTimezone)) {
      if (phase !== "forgotEnd") setHasTriggeredForgotEnd(false);
      return;
    }
    if (phase !== "forgotEnd") {
      enterForgotEndMode();
    }
  }, [daySession, enterForgotEndMode, phase, trackerTimezone]);

  // ── Summary cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (summaryTimerRef.current)   clearInterval(summaryTimerRef.current);
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const waitMs = msUntilNextTimezoneMidnight(trackerTimezone);
      timer = setTimeout(() => {
        void hydrateFromBackend();
        void hydrateTodaySubmissions();
        scheduleMidnightRefresh();
      }, waitMs);
    };
    scheduleMidnightRefresh();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hydrateFromBackend, hydrateTodaySubmissions, trackerTimezone]);

  useEffect(() => {
    const handleExternalTodayUpdate = () => {
      void hydrateTodaySubmissions();
    };
    window.addEventListener(TODAY_SUBMISSIONS_UPDATED_EVENT, handleExternalTodayUpdate);
    return () => {
      window.removeEventListener(TODAY_SUBMISSIONS_UPDATED_EVENT, handleExternalTodayUpdate);
    };
  }, [hydrateTodaySubmissions]);

  function transitionTo(next: typeof phase) {
    setPhaseVisible(false);
    setTimeout(() => { setPhase(next); setPhaseVisible(true); }, 200);
  }

  function resetToIdle() {
    if (summaryTimerRef.current)   clearInterval(summaryTimerRef.current);
    if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    setConfirmedStartKm(null);
    setEndKmInput("");
    setNewCarConfirmed(false);
    setNewCarSlot("input");
    setSeconds(0);
    setDaySummarySnapshot(null);
    setSummaryProgress(1);
    setForgotEndTime("");
    setForgotEndClockOpen(false);
    setHasTriggeredForgotEnd(false);
    transitionTo("idle");
  }

  // ── Shared confirm-end logic (used by both endKm and forgotEnd) ───────────
  function commitEndKm(endKm: number, itemsOverride?: TodaySubmissionItem[]) {
    const startKm = confirmedStartKm ?? 0;
    const sourceItems = itemsOverride ?? todayItems;
    const marketCount = sourceItems.filter((item) => item.kind === "markt").length;
    const zusatzCount = sourceItems.filter((item) => item.kind === "zusatz").length;
    const snapshot: DaySummarySnapshot = {
      startKm, endKm, deltaKm: endKm - startKm,
      marketCount,
      zusatzCount,
      trackedSeconds: seconds,
    };
    setDaySummarySnapshot(snapshot);
    setSummaryProgress(1);
    transitionTo("daySummary");
    let elapsed = 0;
    summaryTimerRef.current = setInterval(() => {
      elapsed += 0.1;
      setSummaryProgress(Math.max(0, 1 - elapsed / SUMMARY_DURATION));
    }, 100);
    summaryTimeoutRef.current = setTimeout(() => {
      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
      resetToIdle();
    }, SUMMARY_DURATION * 1000);
  }

  // ── Start KM ─────────────────────────────────────────────────────────────
  const handleStartPressed = useCallback(async () => {
    if (persistBusy) return;
    const clientStartedAt = new Date().toISOString();
    const localSnapshot = saveLocalDaySessionStartSnapshot({
      startedAt: clientStartedAt,
      timezone: trackerTimezone,
    });
    setPersistBusy(true);
    setPersistError(null);
    setStartKmInput("");
    setActiveKmField(null);
    setRunning(true);
    setPaused(false);
    setSeconds(0);
    transitionTo("startKm");
    notifyDaySessionUpdated();
    try {
      const { session } = await startDaySession({
        timezone: trackerTimezone,
        startedAt: clientStartedAt,
      });
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setStartKmInput("");
      setActiveKmField(null);
      setRunning(true);
      setPaused(false);
      setSeconds(secondsSince(session.dayStartedAt));
      if (session.isStartKmCompleted) {
        transitionTo("recording");
      } else {
        transitionTo("startKm");
      }
      notifyDaySessionUpdated();
    } catch (error) {
      const message = localSnapshot
        ? "Tagesstart ist lokal gesichert. Synchronisierung laeuft, sobald die Verbindung wieder da ist."
        : error instanceof Error ? error.message : "Tagesstart konnte nicht gespeichert werden.";
      if (!localSnapshot) {
        setRunning(false);
        setPaused(false);
        setSeconds(0);
        transitionTo("idle");
      }
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy, trackerTimezone]);
  const handleStartKmCancel  = useCallback(() => { transitionTo("idle"); }, []);
  const handleStartKmConfirm = useCallback(async () => {
    const num = parseInt(startKmInput, 10);
    if (!num || num <= 0 || persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const { session } = await setDaySessionStartKm(num);
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setConfirmedStartKm(num);
      setRunning(true);
      setPaused(false);
      transitionTo("recording");
      notifyDaySessionUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Start-KM konnte nicht gespeichert werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy, startKmInput]);
  const handleStartKmDefer = useCallback(async () => {
    if (persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const { session } = await deferDaySessionStartKm();
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setConfirmedStartKm(null);
      setRunning(true);
      setPaused(false);
      transitionTo("recording");
      notifyDaySessionUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Start-KM konnte nicht auf später gesetzt werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy]);
  const startKmValid = startKmInput.length > 0 && parseInt(startKmInput, 10) > 0;

  // ── End KM (manual STOP) ──────────────────────────────────────────────────
  const handleStopPressed = useCallback(async () => {
    if (persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const { session } = await endDaySession();
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setOpenEndKmOnly(false);
      setConfirmedStartKm(session.startKm ?? null);
      if (session.startKm == null) setStartKmInput("");
      setEndKmInput(session.endKm != null ? String(session.endKm) : "");
      setNewCarSlot("input");
      setNewCarConfirmed(false);
      setActiveKmField(null);
      setRunning(false);
      setPaused(false);
      transitionTo("endKm");
      notifyDaySessionUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tagesende konnte nicht gespeichert werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy]);
  const handleEndKmCancel = useCallback(() => {
    setOpenEndKmOnly(false);
    setRunning(true); setPaused(false); transitionTo("recording");
  }, []);
  const knownStartKmForEnd = confirmedStartKm ?? daySession?.startKm ?? null;
  const needsStartKmForEnd = knownStartKmForEnd === null;
  const pendingStartKmForEnd = parseInt(startKmInput, 10);
  const startKmReadyForEnd = !needsStartKmForEnd || (startKmInput.length > 0 && pendingStartKmForEnd > 0);
  const compareStartKmForEnd = needsStartKmForEnd ? (startKmReadyForEnd ? pendingStartKmForEnd : null) : knownStartKmForEnd;
  const endKmNum   = parseInt(endKmInput, 10);
  const endKmValid = startKmReadyForEnd && endKmInput.length > 0 && endKmNum > 0 &&
    (newCarConfirmed || compareStartKmForEnd === null || endKmNum > compareStartKmForEnd);

  const handleEndKmConfirm = useCallback(async () => {
    const num = parseInt(endKmInput, 10);
    if (!num || num <= 0 || persistBusy) return;
    const startNum = needsStartKmForEnd ? parseInt(startKmInput, 10) : knownStartKmForEnd;
    if (needsStartKmForEnd && (!startNum || startNum <= 0)) return;
    if (!newCarConfirmed && startNum !== null && num <= startNum) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      if (needsStartKmForEnd && startNum !== null) {
        const startResult = await setDaySessionStartKm(startNum);
        persistLocalDaySessionFromBackend(startResult.session);
        setDaySession(startResult.session);
        setConfirmedStartKm(startNum);
      }
      const endResult = await setDaySessionEndKm(num);
      persistLocalDaySessionFromBackend(endResult.session);
      setDaySession(endResult.session);
      if (openEndKmOnly) {
        setOpenEndKmOnly(false);
        transitionTo("recording");
        return;
      }
      const submitResult = await submitDaySession();
      persistLocalDaySessionFromBackend(submitResult.session);
      setDaySession(submitResult.session);
      notifyDaySessionUpdated();
      const freshItems = await hydrateTodaySubmissions();
      commitEndKm(num, freshItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "End-KM konnte nicht gespeichert werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy, endKmInput, newCarConfirmed, needsStartKmForEnd, startKmInput, knownStartKmForEnd, hydrateTodaySubmissions, openEndKmOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleEndKmDefer = useCallback(async () => {
    if (persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const { session } = await deferDaySessionEndKm();
      persistLocalDaySessionFromBackend(session);
      setDaySession(session);
      setOpenEndKmOnly(false);
      if (openEndKmOnly) {
        transitionTo("recording");
      } else {
        transitionTo("idle");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "End-KM konnte nicht auf später gesetzt werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [persistBusy, openEndKmOnly]);
  const handleOpenEndKmOnly = useCallback(() => {
    if (!running || persistBusy) return;
    setOpenEndKmOnly(true);
    setConfirmedStartKm(daySession?.startKm ?? confirmedStartKm);
    if ((daySession?.startKm ?? confirmedStartKm) == null) setStartKmInput("");
    setEndKmInput(daySession?.endKm != null ? String(daySession.endKm) : "");
    setNewCarSlot("input");
    setNewCarConfirmed(false);
    setActiveKmField(null);
    transitionTo("endKm");
  }, [running, persistBusy, daySession, confirmedStartKm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── forgotEnd confirm ─────────────────────────────────────────────────────
  const handleForgotEndConfirm = useCallback(async () => {
    const num = parseInt(endKmInput, 10);
    if (!num || num <= 0 || persistBusy) return;
    const startNum = needsStartKmForEnd ? parseInt(startKmInput, 10) : knownStartKmForEnd;
    if (needsStartKmForEnd && (!startNum || startNum <= 0)) return;
    if (!newCarConfirmed && startNum !== null && num <= startNum) return;
    if (!forgotEndTime) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const endAt = daySession
        ? toIsoFromWorkDateHm(daySession.workDate, forgotEndTime, daySession.timezone || trackerTimezone)
        : null;
      if (!endAt) {
        setPersistError("Endzeit konnte nicht auf den Arbeitstag gesetzt werden.");
        return;
      }
      if (needsStartKmForEnd && startNum !== null) {
        const startResult = await setDaySessionStartKm(startNum);
        persistLocalDaySessionFromBackend(startResult.session);
        setDaySession(startResult.session);
        setConfirmedStartKm(startNum);
      }
      const ended = await endDaySession({ endAt });
      persistLocalDaySessionFromBackend(ended.session);
      const endResult = await setDaySessionEndKm(num);
      persistLocalDaySessionFromBackend(endResult.session);
      setDaySession(endResult.session);
      const submitResult = await submitDaySession();
      persistLocalDaySessionFromBackend(submitResult.session);
      setDaySession(submitResult.session);
      notifyDaySessionUpdated();
      const freshItems = await hydrateTodaySubmissions();
      commitEndKm(num, freshItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nachträgliches Tagesende konnte nicht gespeichert werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [notifyDaySessionUpdated, persistBusy, endKmInput, newCarConfirmed, needsStartKmForEnd, startKmInput, knownStartKmForEnd, forgotEndTime, hydrateTodaySubmissions, daySession, trackerTimezone]); // eslint-disable-line react-hooks/exhaustive-deps

  const forgotEndValid = endKmValid && !!forgotEndTime;

  // ── New-car ───────────────────────────────────────────────────────────────
  const handleNewCarPress   = useCallback(() => { setNewCarSlot("confirm"); }, []);
  const handleNewCarCancel  = useCallback(() => { setNewCarSlot("input"); setTimeout(() => endKmRef.current?.focus(), 120); }, []);
  const handleNewCarConfirm = useCallback(() => { setNewCarConfirmed(true); setNewCarSlot("input"); setEndKmInput(""); setTimeout(() => endKmRef.current?.focus(), 120); }, []);

  const handlePause = useCallback(async () => {
    if (!running || persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      if (!paused) {
        await startDayPause();
        setPaused(true);
        await hydrateTodaySubmissions();
      } else {
        await endDayPause();
        setPaused(false);
        await hydrateTodaySubmissions();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pause konnte nicht gespeichert werden.";
      setPersistError(message);
    } finally {
      setPersistBusy(false);
    }
  }, [running, persistBusy, paused, hydrateTodaySubmissions]);

  // ── Debug: force forgotEnd ────────────────────────────────────────────────
  const forceDebugForgotEnd = useCallback(() => {
    setHasTriggeredForgotEnd(true);
    setEndKmInput(""); setNewCarSlot("input"); setNewCarConfirmed(false);
    setActiveKmField(null); setForgotEndTime(""); setForgotEndClockOpen(false);
    if (phase === "recording") { setRunning(false); setPaused(false); }
    transitionTo("forgotEnd");
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const contentStyle: React.CSSProperties = {
    opacity: phaseVisible ? 1 : 0,
    transform: phaseVisible ? "translateY(0)" : "translateY(5px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
  };
  const feedItems = todayItems;

  function kindLabel(kind: TodaySubmissionItem["kind"]): string {
    if (kind === "day") return "Tag";
    if (kind === "markt") return "Marktbesuch";
    if (kind === "pause") return "Pause";
    return "Zusatz";
  }

  // ── Shared new-car slot (reused in both endKm and forgotEnd) ──────────────
  function NewCarSlotContent() {
    return (
      <div style={{ position: "relative", width: "100%", height: 48, display: "flex", alignItems: "center" }}>
        {/* Input */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: newCarSlot === "input" ? 1 : 0, transform: newCarSlot === "input" ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.18s ease, transform 0.18s ease", pointerEvents: newCarSlot === "input" ? "auto" : "none" }}>
          <KmInput inputRef={endKmRef} rawValue={endKmInput} isValid={endKmValid}
            isFocused={activeKmField === "end"} onChange={v => setEndKmInput(v)}
            onFocus={() => setActiveKmField("end")} onBlur={() => setActiveKmField(null)}
            onKeyDown={e => { if (e.key === "Enter" && endKmValid) { if (phase === "endKm") handleEndKmConfirm(); else handleForgotEndConfirm(); } if (e.key === "Escape") { if (phase === "endKm") handleEndKmCancel(); } }} />
        </div>
        {/* New-car confirm */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", opacity: newCarSlot === "confirm" ? 1 : 0, transform: newCarSlot === "confirm" ? "translateY(0)" : "translateY(5px)", transition: "opacity 0.18s ease, transform 0.18s ease", pointerEvents: newCarSlot === "confirm" ? "auto" : "none" }}>
          <div style={{ width: "100%", padding: "7px 10px", borderRadius: 9, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.14)", display: "flex", flexDirection: "column", gap: 6, boxSizing: "border-box" }}>
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.5)", lineHeight: 1.4, fontWeight: 500 }}>Neues Fahrzeug erfassen?</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={handleNewCarCancel} style={{ flex: 1, padding: "3px 0", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 5, cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.05)"; }}>Abbrechen</button>
              <button onClick={handleNewCarConfirm} style={{ flex: 1, padding: "3px 0", fontSize: 9, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 5, cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.14)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.08)"; }}>Ja, weiter</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Hidden debug panel ─────────────────────────────── */}
      {debugOpen && (
        <div
          style={{ position: "fixed", left: debugPos.x, top: debugPos.y, zIndex: 99999, opacity: debugOpacity, transition: "opacity 0.15s ease", userSelect: "none" as const }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.14)", minWidth: 180, overflow: "hidden", fontSize: 11 }}>
            {/* Header — drag handle */}
            <div
              onMouseDown={handleDebugHeaderMouseDown}
              style={{ padding: "8px 12px", background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab" }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Zeit-Test</span>
              <button onClick={() => setDebugOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(0,0,0,0.35)", lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Phase indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>Phase:</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", fontFamily: "monospace" }}>{phase}</span>
              </div>
              {/* Trigger button */}
              <button
                onClick={forceDebugForgotEnd}
                style={{ padding: "6px 0", fontSize: 10, fontWeight: 700, color: "#fff", background: "linear-gradient(to bottom,#DC2626,#e84040)", border: "none", borderRadius: 6, cursor: "pointer", letterSpacing: "0.01em", boxShadow: "0 0 0 1px #c42020" }}
              >
                9pm State aktivieren
              </button>
              {/* Opacity slider */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", flexShrink: 0 }}>Deckkraft</span>
                <input type="range" min={0.15} max={1} step={0.05} value={debugOpacity}
                  onChange={e => setDebugOpacity(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: "#DC2626", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", minWidth: 28, textAlign: "right" as const }}>{Math.round(debugOpacity * 100)}%</span>
              </div>
              {/* Future buttons space */}
              <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginTop: 2 }} />
              <span style={{ fontSize: 8, color: "rgba(0,0,0,0.22)", letterSpacing: "0.04em" }}>weitere Buttons folgen</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TimeTracker card ───────────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Start KM ─────────────────────────────────────────── */}
        {phase === "startKm" && (
          <div style={contentStyle}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}>
              <KmCard>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Tagesstart</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 4 }}>KM-Stand eingeben</span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", textAlign: "center", lineHeight: 1.5, maxWidth: 190, marginBottom: 14 }}>
                  Bitte den aktuellen Kilometerstand des Fahrzeugs erfassen.
                </span>
                <KmInput inputRef={startKmRef} rawValue={startKmInput} isValid={startKmValid} isFocused={activeKmField === "start"}
                  onChange={v => setStartKmInput(v)} onFocus={() => setActiveKmField("start")} onBlur={() => setActiveKmField(null)}
                  onKeyDown={e => { if (e.key === "Enter" && startKmValid) handleStartKmConfirm(); if (e.key === "Escape") handleStartKmCancel(); }} />
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", marginTop: 7, letterSpacing: "0.01em" }}>wird als Startwert für den Tag gespeichert</span>
              </KmCard>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleStartKmCancel} style={{ flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}>Abbrechen</button>
              <button onClick={() => { void handleStartKmDefer(); }} disabled={persistBusy} style={{ flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7, cursor: persistBusy ? "not-allowed" : "pointer" }}>
                Später ausfüllen
              </button>
              <button onClick={() => { void handleStartKmConfirm(); }} disabled={!startKmValid || persistBusy} style={{ flex: 2, padding: "7px 0", fontSize: 10, fontWeight: 700, color: "#fff", background: startKmValid ? "linear-gradient(to bottom, #059669, #0cb880)" : "rgba(0,0,0,0.1)", border: "none", borderRadius: 7, cursor: startKmValid ? "pointer" : "not-allowed", boxShadow: startKmValid ? "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #048560,0 1px 6px rgba(5,80,50,0.14)" : "none", opacity: persistBusy ? 0.7 : 1 }}>
                {persistBusy ? "Speichert..." : "KM-Stand speichern"}
              </button>
            </div>
            {persistError && <div style={{ marginTop: 8, fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{persistError}</div>}
          </div>
        )}

        {/* ── End KM (manual) ──────────────────────────────────── */}
        {phase === "endKm" && (
          <div style={contentStyle}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}>
              <KmCard>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Tagesende</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 8 }}>KM-Stand eingeben</span>
                {needsStartKmForEnd && (
                  <>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.42)", textAlign: "center", lineHeight: 1.45, maxWidth: 200, marginBottom: 10 }}>
                      Noch kein Start-KM erfasst. Bitte auch nachfüllen.
                    </span>
                    <div style={{ width: "100%", maxWidth: 200, marginBottom: 10 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 4 }}>Start-KM</span>
                      <KmInput inputRef={startKmRef} rawValue={startKmInput} isValid={startKmValid} isFocused={activeKmField === "start"}
                        onChange={v => setStartKmInput(v)} onFocus={() => setActiveKmField("start")} onBlur={() => setActiveKmField(null)}
                        onKeyDown={e => { if (e.key === "Enter" && endKmValid) handleEndKmConfirm(); if (e.key === "Escape") handleEndKmCancel(); }} />
                    </div>
                  </>
                )}
                {knownStartKmForEnd !== null && !newCarConfirmed && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", marginBottom: 10, width: "100%", maxWidth: 200, boxSizing: "border-box" }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,0.2)", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontWeight: 500, flex: 1 }}>Start heute</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.55)", fontVariantNumeric: "tabular-nums" }}>{knownStartKmForEnd.toLocaleString("de-AT")} km</span>
                  </div>
                )}
                {newCarConfirmed && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.14)", marginBottom: 10, width: "100%", maxWidth: 200, boxSizing: "border-box" }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#DC2626", fontWeight: 600 }}>Neues Fahrzeug</span>
                    <button onClick={() => { setNewCarConfirmed(false); setEndKmInput(""); setTimeout(() => endKmRef.current?.focus(), 60); }}
                      style={{ marginLeft: "auto", fontSize: 8, fontWeight: 600, color: "rgba(220,38,38,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(220,38,38,0.5)"; }}>Rückgängig</button>
                  </div>
                )}
                {NewCarSlotContent()}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 200, marginTop: 6, minHeight: 16 }}>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", letterSpacing: "0.01em" }}>
                    {newCarConfirmed ? "neuer Startwert für morgen" : "wird als Endwert gespeichert"}
                  </span>
                  {!newCarConfirmed && newCarSlot === "input" && (
                    <button onClick={handleNewCarPress} style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.28)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.28)"; }}>Neues Fahrzeug?</button>
                  )}
                </div>
              </KmCard>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleEndKmCancel} style={{ flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}>Abbrechen</button>
              <button onClick={() => { void handleEndKmDefer(); }} disabled={persistBusy} style={{ flex: 1, padding: "7px 0", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7, cursor: persistBusy ? "not-allowed" : "pointer" }}>
                Später ausfüllen
              </button>
              <button onClick={() => { void handleEndKmConfirm(); }} disabled={!endKmValid || persistBusy} style={{ flex: 2, padding: "7px 0", fontSize: 10, fontWeight: 700, color: "#fff", background: endKmValid ? "linear-gradient(to bottom, #DC2626, #e84040)" : "rgba(0,0,0,0.1)", border: "none", borderRadius: 7, cursor: endKmValid ? "pointer" : "not-allowed", boxShadow: endKmValid ? "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #c42020,0 1px 6px rgba(180,20,20,0.14)" : "none", opacity: persistBusy ? 0.7 : 1 }}>
                {persistBusy ? "Speichert..." : openEndKmOnly ? "KM-Stand speichern" : "Tag beenden"}
              </button>
            </div>
            {persistError && <div style={{ marginTop: 8, fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{persistError}</div>}
          </div>
        )}

        {/* ── Forgot-end reminder ───────────────────────────────── */}
        {phase === "forgotEnd" && (
          <div style={contentStyle}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}>
              {/* Outer card — neutral amber tint for gentle urgency */}
              <div style={{ width: "100%", background: "rgba(217,119,6,0.055)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 14, overflow: "hidden", position: "relative" as const }}>
                <div style={{ margin: "8px 8px 8px", background: "radial-gradient(ellipse 160% 80% at 50% -10%, rgba(217,119,6,0.10) 0%, rgba(255,255,255,1) 60%)", borderRadius: 10, border: "1px solid rgba(217,119,6,0.12)", boxShadow: "0 1px 6px rgba(217,119,6,0.06)", padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" as const }}>

                  {/* Clock overlay */}
                  {forgotEndClockOpen && (
                    <ClockOverlay
                      onSelect={(h, m) => { setForgotEndTime(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`); setForgotEndClockOpen(false); }}
                      onCancel={() => setForgotEndClockOpen(false)}
                    />
                  )}

                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(217,119,6,0.7)", marginBottom: 4 }}>Tagesende</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 3, textAlign: "center" as const, lineHeight: 1.3 }}>
                    Du hast vergessen<br />den Tag zu beenden
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", textAlign: "center" as const, lineHeight: 1.5, maxWidth: 190, marginBottom: 12 }}>
                    Bitte tatsächliche Endzeit und finalen KM-Stand erfassen.
                  </span>

                  {needsStartKmForEnd && (
                    <>
                      <span style={{ fontSize: 9, color: "rgba(146,64,14,0.72)", textAlign: "center" as const, lineHeight: 1.45, maxWidth: 200, marginBottom: 10, fontWeight: 600 }}>
                        Noch kein Start-KM erfasst. Bitte auch nachfüllen.
                      </span>
                      <div style={{ width: "100%", maxWidth: 200, marginBottom: 10 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 4 }}>Start-KM</span>
                        <KmInput inputRef={startKmRef} rawValue={startKmInput} isValid={startKmValid} isFocused={activeKmField === "start"}
                          onChange={v => setStartKmInput(v)} onFocus={() => setActiveKmField("start")} onBlur={() => setActiveKmField(null)}
                          onKeyDown={e => { if (e.key === "Enter" && forgotEndValid) handleForgotEndConfirm(); }} />
                      </div>
                    </>
                  )}

                  {/* Context reference row */}
                  {knownStartKmForEnd !== null && !newCarConfirmed && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", marginBottom: 10, width: "100%", maxWidth: 200, boxSizing: "border-box" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,0.2)", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontWeight: 500, flex: 1 }}>Start-KM</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.55)", fontVariantNumeric: "tabular-nums" }}>{knownStartKmForEnd.toLocaleString("de-AT")} km</span>
                    </div>
                  )}
                  {newCarConfirmed && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.14)", marginBottom: 10, width: "100%", maxWidth: 200, boxSizing: "border-box" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "#DC2626", fontWeight: 600 }}>Neues Fahrzeug</span>
                      <button onClick={() => { setNewCarConfirmed(false); setEndKmInput(""); setTimeout(() => endKmRef.current?.focus(), 60); }}
                        style={{ marginLeft: "auto", fontSize: 8, fontWeight: 600, color: "rgba(220,38,38,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(220,38,38,0.5)"; }}>Rückgängig</button>
                    </div>
                  )}

                  {/* Time + KM fields in one row */}
                  <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 200 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 4 }}>Endzeit</span>
                      <TimeField value={forgotEndTime} onOpenClock={() => setForgotEndClockOpen(true)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 4 }}>End-KM</span>
                      {NewCarSlotContent()}
                    </div>
                  </div>

                  {/* Sub row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 200, marginTop: 6, minHeight: 16 }}>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", letterSpacing: "0.01em" }}>
                      {newCarConfirmed ? "neuer Startwert für morgen" : "wird als Endwert gespeichert"}
                    </span>
                    {!newCarConfirmed && newCarSlot === "input" && (
                      <button onClick={handleNewCarPress} style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.28)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.28)"; }}>Neues Fahrzeug?</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 14 }}>
              <button onClick={() => { void handleForgotEndConfirm(); }} disabled={!forgotEndValid || persistBusy}
                style={{ width: "100%", padding: "7px 0", fontSize: 10, fontWeight: 700, color: "#fff", background: forgotEndValid ? "linear-gradient(to bottom, #D97706, #f59e0b)" : "rgba(0,0,0,0.1)", border: "none", borderRadius: 7, cursor: forgotEndValid ? "pointer" : "not-allowed", boxShadow: forgotEndValid ? "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #b45309,0 1px 6px rgba(180,100,8,0.14)" : "none", transition: "all 0.18s ease" }}>
                {persistBusy ? "Speichert..." : "Tag nachträglich beenden"}
              </button>
            </div>
            {persistError && <div style={{ marginTop: 8, fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{persistError}</div>}
          </div>
        )}

        {/* ── Day Summary ──────────────────────────────────────── */}
        {phase === "daySummary" && daySummarySnapshot && (
          <div style={contentStyle}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}>
              <div style={{ width: "100%", background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.22)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ margin: "8px 8px 8px", background: "radial-gradient(ellipse 160% 90% at 50% -10%, rgba(5,150,105,0.18) 0%, rgba(255,255,255,1) 65%)", borderRadius: 10, border: "1px solid rgba(5,150,105,0.14)", boxShadow: "0 1px 6px rgba(5,150,105,0.07)", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#059669", letterSpacing: "-0.02em", marginBottom: 2 }}>Tag gespeichert</span>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginBottom: 14, letterSpacing: "0.01em" }}>Deine Zeiterfassung wurde erfasst.</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, width: "100%", maxWidth: 200 }}>
                    <StatCell label="Gefahren" value={daySummarySnapshot.deltaKm.toLocaleString("de-AT")} unit="km" accent />
                    <StatCell label="Dauer"    value={fmtDuration(daySummarySnapshot.trackedSeconds)} />
                    <StatCell label="Märkte"   value={daySummarySnapshot.marketCount} />
                    <StatCell label="Zusatz"   value={daySummarySnapshot.zusatzCount} />
                  </div>
                  <div style={{ width: "100%", maxWidth: 200, marginTop: 12, height: 2, borderRadius: 99, background: "rgba(5,150,105,0.12)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "rgba(5,150,105,0.5)", width: `${summaryProgress * 100}%`, transition: "width 0.1s linear" }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button onClick={() => { if (summaryTimerRef.current) clearInterval(summaryTimerRef.current); if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current); resetToIdle(); }}
                style={{ width: "100%", padding: "7px 0", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}>
                Schließen
              </button>
            </div>
          </div>
        )}

        {/* ── Idle & Recording ─────────────────────────────────── */}
        {(phase === "idle" || phase === "recording") && (
          <div style={{ ...contentStyle, position: "relative" }}>
            {running && (
              <button
                onClick={handleOpenEndKmOnly}
                disabled={persistBusy}
                style={{
                  position: "absolute",
                  top: -2,
                  right: 0,
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: persistBusy ? "not-allowed" : "pointer",
                  opacity: persistBusy ? 0.48 : 0.74,
                }}
              >
                <Car size={13} strokeWidth={1.8} color="rgba(0,0,0,0.52)" />
              </button>
            )}
            <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 0 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#DC2626", letterSpacing: "0.06em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(seconds)}</span>
              <div className="flex items-center gap-1.5 mt-2" style={{ color: active ? "#ef4444" : "rgba(239,68,68,0.5)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "currentColor", ...(active ? { animation: "pulse 1.4s ease-in-out infinite" } : {}) }} />
                <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em" }}>{active ? "RECORDING" : paused ? "PAUSED" : "STOPPED"}</span>
              </div>
              {confirmedStartKm !== null && running && (
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontWeight: 500, marginTop: 6, letterSpacing: "0.01em", fontVariantNumeric: "tabular-nums" }}>
                  Start: {confirmedStartKm.toLocaleString("de-AT")} km
                </span>
              )}
            </div>
            <div className="mt-4" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.08) 50%, transparent)" }} />
            <div className="mt-3" style={{ minHeight: 93, maxHeight: 93, overflowY: "auto", paddingRight: 2 }}>
              <div className="space-y-1.5">
                {feedItems.length > 0 ? feedItems.map((item) => (
                  <div key={`${item.kind}-${item.id}-${item.submittedAt}`} className="flex items-center justify-between" style={{ backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 7, padding: "7px 10px" }}>
                    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#DC2626", opacity: 0.8 }} />
                      <span style={{ width: 60, fontSize: 9, color: "rgba(0,0,0,0.42)", fontWeight: 700, letterSpacing: "0.01em", textTransform: "uppercase", flexShrink: 0 }}>{kindLabel(item.kind)}</span>
                      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, letterSpacing: "0.02em", marginLeft: 8 }}>{item.timeText}</span>
                  </div>
                )) : (
                  <div
                    style={{
                      minHeight: 93,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 7,
                      background: "rgba(0,0,0,0.018)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.34)", fontWeight: 500 }}>Noch keine Einträge heute</span>
                  </div>
                )}
              </div>
            </div>
            {running ? (
              <div className="flex gap-2" style={{ marginTop: 14 }}>
                <button onClick={handleStopPressed} style={{ flex: 1, padding: "6px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", color: "#fff", background: "linear-gradient(to bottom, #DC2626, #e84040)", border: "none", borderRadius: 7, cursor: "pointer", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #c42020,0 1px 6px rgba(180,20,20,0.14)" }}>STOP</button>
                <button onClick={() => { void handlePause(); }} disabled={persistBusy} style={{ flex: 1, padding: "6px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", color: "#fff", background: paused ? "linear-gradient(to bottom, #059669, #0cb880)" : "linear-gradient(to bottom, #ea580c, #f0722e)", border: "none", borderRadius: 7, cursor: persistBusy ? "not-allowed" : "pointer", boxShadow: paused ? "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #048560,0 1px 6px rgba(5,80,50,0.14)" : "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #d4500b,0 1px 6px rgba(180,60,8,0.14)", opacity: persistBusy ? 0.7 : 1 }}>
                  {persistBusy ? (paused ? "START..." : "PAUSE...") : paused ? "START" : "PAUSE"}
                </button>
              </div>
            ) : (
              <button onClick={() => { void handleStartPressed(); }} disabled={!canStartButton} style={{ marginTop: 14, width: "100%", padding: "6px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", color: "#fff", background: "linear-gradient(to bottom, #059669, #0cb880)", border: "none", borderRadius: 7, cursor: canStartButton ? "pointer" : "not-allowed", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #048560,0 1px 6px rgba(5,80,50,0.14)", opacity: canStartButton ? 1 : 0.7 }}>
                {persistBusy ? "START..." : "START"}
              </button>
            )}
            {persistError && <div style={{ marginTop: 8, fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{persistError}</div>}
          </div>
        )}
      </div>
    </>
  );
}
