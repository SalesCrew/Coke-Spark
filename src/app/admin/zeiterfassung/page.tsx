"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown, Clock, Store, Car, Coffee,
  GraduationCap, Wrench, Home, Warehouse, Star, Search,
  X,
} from "lucide-react";
import {
  fetchAdminDiaetenExport,
  fetchAdminZeiterfassungDays,
  fetchAdminZeiterfassungGmAggregates,
  patchAdminZeiterfassungDaySession,
  patchAdminZeiterfassungSegment,
  type AdminZeiterfassungAggregateRow,
} from "@/lib/api/backend";
import { DoctorConfirmationProofButton } from "@/components/dashboard/DoctorConfirmationProofButton";
import { exportAdminDiaeten, MONTH_LABELS } from "@/lib/exports/diaetenExport";
import { exportAdminZeiterfassung, getMonthBoundsForZeiterfassungExport } from "@/lib/exports/zeiterfassungExport";
import type { EntrySubtype, TimeDaySession } from "@/types/zeiterfassung";

// ── Constants ─────────────────────────────────────────────────
const R  = "#DC2626";
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROW_GRID_TEMPLATE = "minmax(260px, 1.35fr) repeat(4, minmax(112px, 1fr)) 52px 52px 18px";
const ROW_GRID_COLUMN_GAP = 14;

// ── Helpers ───────────────────────────────────────────────────
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function diffMin(start: string, end: string): number {
  return Math.max(0, toMin(end) - toMin(start));
}
function isValidHm(value: string): boolean {
  return HHMM_REGEX.test(value.trim());
}
function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}
function fmtDur(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
function fmtKm(km: number | null): string {
  if (km == null) return "—";
  return km.toLocaleString("de-AT") + " km";
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmtDateLabel(dateISO: string): { weekday: string; date: string } {
  const d = new Date(dateISO + "T12:00:00");
  return {
    weekday: d.toLocaleDateString("de-AT", { weekday: "long" }),
    date: d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
  };
}
function gmInitials(name: string): string {
  const parts = name.split(" ");
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
function gmAvatarColor(name: string): { bg: string; text: string } {
  const palettes = [
    { bg: "rgba(220,38,38,0.10)",  text: R },
    { bg: "rgba(37,99,235,0.10)",  text: "#2563eb" },
    { bg: "rgba(22,163,74,0.10)",  text: "#16a34a" },
    { bg: "rgba(217,119,6,0.10)",  text: "#D97706" },
    { bg: "rgba(124,58,237,0.10)", text: "#7c3aed" },
  ];
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

const ENTRY_SUBTYPE_VALUES: readonly EntrySubtype[] = [
  "schulung",
  "sonderaufgabe",
  "arztbesuch",
  "werkstatt",
  "homeoffice",
  "lager",
  "hoteluebernachtung",
];

function toEntrySubtype(value: string | undefined): EntrySubtype | null {
  if (!value) return null;
  if (value === "hotel") return "hoteluebernachtung";
  return (ENTRY_SUBTYPE_VALUES as readonly string[]).includes(value)
    ? (value as EntrySubtype)
    : null;
}

// ── Display segment types ─────────────────────────────────────
type SegmentKind = "anfahrt" | "marktbesuch" | "fahrtzeit" | "pause" | "zusatzzeit" | "heimfahrt";
interface DisplaySegment {
  id: string;
  kind: SegmentKind;
  start: string;
  end?: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  kmNote?: string;
  subtype?: string;
  comment?: string;
  questionnaireType?: string;
  doctorConfirmation?: TimeDaySession["entries"][number]["doctorConfirmation"];
}

function deriveTimeline(session: TimeDaySession): DisplaySegment[] {
  if (Array.isArray(session.timeline)) {
    const entryIdByKey = new Map<string, string>();
    const entryCommentByKey = new Map<string, string | undefined>();
    const entryDoctorConfirmationByKey = new Map<string, TimeDaySession["entries"][number]["doctorConfirmation"]>();
    for (const entry of session.entries) {
      const key = `${entry.kind}|${entry.startTime}|${entry.endTime}`;
      entryIdByKey.set(key, entry.id);
      if (entry.kind === "zusatzzeit" && entry.doctorConfirmation) {
        entryDoctorConfirmationByKey.set(key, entry.doctorConfirmation);
      }
      if (entry.kind === "zusatzzeit" && entry.comment) {
        entryCommentByKey.set(key, entry.comment);
      }
    }
    return session.timeline.map((segment) => ({
      id:
        segment.id ||
        entryIdByKey.get(`${segment.kind}|${segment.start}|${segment.end}`) ||
        `${segment.kind}-${segment.start}-${segment.end}`,
      kind: segment.kind,
      start: segment.start,
      end: segment.end,
      durationMin: segment.durationMin,
      title: segment.title,
      subtitle: segment.subtitle,
      subtype: segment.subtype,
      comment:
        segment.comment ??
        entryCommentByKey.get(`${segment.kind}|${segment.start}|${segment.end}`),
      questionnaireType: segment.questionnaireType,
      doctorConfirmation:
        segment.doctorConfirmation ??
        entryDoctorConfirmationByKey.get(`${segment.kind}|${segment.start}|${segment.end}`),
      kmNote:
        segment.kind === "anfahrt"
          ? `KM Start: ${fmtKm(session.startKm)}`
          : segment.kind === "heimfahrt"
            ? `KM Ende: ${fmtKm(session.endKm)}`
            : undefined,
    }));
  }
  const segments: DisplaySegment[] = [];
  const sorted = [...session.entries].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const isOpenDay = session.status === "started" || session.isLive;
  if (sorted.length === 0) {
    segments.push({
      id: `anfahrt-${session.id}-0`,
      kind: "anfahrt",
      start: session.startTime,
      end: isOpenDay ? undefined : session.endTime,
      durationMin: isOpenDay ? 0 : diffMin(session.startTime, session.endTime),
      title: "Anfahrt",
      kmNote: `KM Start: ${fmtKm(session.startKm)}`,
    });
    return segments;
  }
  const firstEntryStart = sorted[0]?.startTime ?? session.endTime;
  if (toMin(firstEntryStart) > toMin(session.startTime)) {
    segments.push({
      id: `anfahrt-${session.id}-1`,
      kind: "anfahrt",
      start: session.startTime,
      end: firstEntryStart,
      durationMin: diffMin(session.startTime, firstEntryStart),
      title: "Anfahrt",
      kmNote: `KM Start: ${fmtKm(session.startKm)}`,
    });
  }
  sorted.forEach((entry, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = diffMin(prev.endTime, entry.startTime);
      if (gap > 0) {
        segments.push({
          id: `fahrtzeit-${session.id}-${i}`,
          kind: "fahrtzeit",
          start: prev.endTime,
          end: entry.startTime,
          durationMin: gap,
          title: "Fahrtzeit",
        });
      }
    }
    if (entry.kind === "marktbesuch") {
      segments.push({
        id: entry.id,
        kind: "marktbesuch",
        start: entry.startTime,
        end: entry.endTime,
        durationMin: entry.durationMin,
        title: entry.marketName ?? "Marktbesuch",
        subtitle: entry.marketAddress,
        questionnaireType: entry.questionnaireType,
      });
    } else if (entry.kind === "pause") {
      segments.push({
        id: entry.id,
        kind: "pause",
        start: entry.startTime,
        end: entry.endTime,
        durationMin: entry.durationMin,
        title: "Pause",
      });
    } else if (entry.kind === "zusatzzeit") {
      const label = entry.subtype ? SUBTYPE_META[entry.subtype]?.label ?? entry.subtype : "Zusatzzeit";
      segments.push({
        id: entry.id,
        kind: "zusatzzeit",
        start: entry.startTime,
        end: entry.endTime,
        durationMin: entry.durationMin,
        title: label,
        subtype: entry.subtype,
        comment: entry.comment,
        doctorConfirmation: entry.doctorConfirmation,
      });
    }
  });
  if (!isOpenDay) {
    const lastEntryEnd = sorted[sorted.length - 1]?.endTime ?? session.startTime;
    if (toMin(session.endTime) > toMin(lastEntryEnd)) {
      segments.push({
        id: `heimfahrt-${session.id}-0`,
        kind: "heimfahrt",
        start: lastEntryEnd,
        end: session.endTime,
        durationMin: diffMin(lastEntryEnd, session.endTime),
        title: "Heimfahrt",
        kmNote: `KM Ende: ${fmtKm(session.endKm)}`,
      });
    }
  }
  return segments;
}

function deriveStats(session: TimeDaySession) {
  if (session.stats) return session.stats;
  const arbeitstag = diffMin(session.startTime, session.endTime);
  const pauseMin = session.entries.filter(e => e.kind === "pause").reduce((s, e) => s + e.durationMin, 0);
  const reineArbeitszeit = arbeitstag - pauseMin;
  const kmGefahren =
    session.startKm != null && session.endKm != null
      ? Math.max(0, session.endKm - session.startKm)
      : null;
  const marktbesuche = session.entries.filter(e => e.kind === "marktbesuch").length;
  const zusatz = session.entries.filter(e => e.kind === "zusatzzeit").length;
  return { arbeitstag, pauseMin, reineArbeitszeit, kmGefahren, marktbesuche, zusatz };
}

// ── Subtype + questionnaire meta ──────────────────────────────
const SUBTYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }> = {
  schulung:           { label: "Schulung",              color: "#2563eb", bg: "rgba(37,99,235,0.08)",   icon: GraduationCap },
  sonderaufgabe:      { label: "Sonderaufgabe",          color: "#D97706", bg: "rgba(217,119,6,0.08)",   icon: Star },
  arztbesuch:         { label: "Arztbesuch",             color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  icon: Coffee },
  werkstatt:          { label: "Werkstatt/Autoreinigung",color: "#6b7280", bg: "rgba(107,114,128,0.08)", icon: Wrench },
  homeoffice:         { label: "Homeoffice",             color: "#16a34a", bg: "rgba(22,163,74,0.08)",   icon: Home },
  lager:              { label: "Lager",                  color: "#0891B2", bg: "rgba(8,145,178,0.08)",   icon: Warehouse },
  hoteluebernachtung: { label: "Hotelübernachtung",      color: "#9333ea", bg: "rgba(147,51,234,0.08)",  icon: Coffee },
};
const QUESTIONNAIRE_META: Record<string, { label: string; color: string }> = {
  standard: { label: "Standard", color: R },
  flex:     { label: "Flex",     color: "#65a30d" },
  kuehler:  { label: "Kühler",   color: "#D97706" },
  mhd:      { label: "MHD",      color: "#7C3AED" },
  billa:    { label: "Billa",    color: "#0891B2" },
};

// ── Aggregated GM model ───────────────────────────────────────
interface AggregatedGmRow {
  gmId: string;
  gmName: string;
  region: string;
  sessions: TimeDaySession[];
  currentKwNumber: number;
  currentKwReineArbeitszeitMin: number;
  totalReineArbeitszeitMin: number;
  averageWorkdayMin: number;
  totalKmDriven: number;
  privatnutzungKm: number;
}

// ── Current date marker ───────────────────────────────────────
const TODAY = todayISO();

type EditableSegmentKind = "day_start" | "day_end" | "marktbesuch" | "pause" | "zusatzzeit";

function resolveEditableSegmentKind(seg: DisplaySegment): EditableSegmentKind | null {
  if (seg.kind === "anfahrt") return "day_start";
  if (seg.kind === "heimfahrt") return "day_end";
  if (seg.kind !== "marktbesuch" && seg.kind !== "pause" && seg.kind !== "zusatzzeit") return null;
  if (!seg.id || seg.id.includes("::seg:") || !isUuid(seg.id)) return null;
  return seg.kind;
}

// ── Action Row ────────────────────────────────────────────────
const ActionRow = React.memo(function ActionRow({
  seg,
  session,
  onSegmentPatched,
}: {
  seg: DisplaySegment;
  session: Pick<TimeDaySession, "id" | "date" | "timezone">;
  onSegmentPatched: () => Promise<void>;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingMode, setEditingMode] = useState<"time" | "comment" | null>(null);
  const [draftStart, setDraftStart] = useState(seg.start);
  const [draftEnd, setDraftEnd] = useState(seg.end ?? "");
  const [draftComment, setDraftComment] = useState(seg.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isAnfahrt   = seg.kind === "anfahrt";
  const isHeimfahrt = seg.kind === "heimfahrt";
  const isFahrtzeit = seg.kind === "fahrtzeit";
  const isPause     = seg.kind === "pause";
  const isMarkt     = seg.kind === "marktbesuch";
  const isZusatz    = seg.kind === "zusatzzeit";
  const smeta = seg.subtype ? SUBTYPE_META[seg.subtype] : null;
  const qmeta = seg.questionnaireType ? QUESTIONNAIRE_META[seg.questionnaireType] : null;
  const color = isMarkt ? R : isAnfahrt || isHeimfahrt ? "#374151" : isFahrtzeit ? "rgba(0,0,0,0.32)" : isPause ? "#D97706" : smeta?.color ?? "#6b7280";
  const bg = isMarkt ? "rgba(220,38,38,0.04)" : isAnfahrt || isHeimfahrt ? "rgba(0,0,0,0.025)" : isFahrtzeit ? "transparent" : isPause ? "rgba(217,119,6,0.05)" : smeta?.bg ?? "rgba(0,0,0,0.03)";
  const Icon = isMarkt ? Store : isAnfahrt || isHeimfahrt || isFahrtzeit ? Car : isPause ? Coffee : smeta?.icon ?? Clock;
  const typeLabel = isFahrtzeit ? "Fahrtzeit" : isAnfahrt ? "Anfahrt" : isHeimfahrt ? "Heimfahrt" : isPause ? "Pause" : isMarkt ? "Markt" : "Zusatz";
  const zusatzComment = isZusatz ? seg.comment?.trim() : "";
  const editableKind = resolveEditableSegmentKind(seg);
  const isDayStartEdit = editableKind === "day_start";
  const isDayEndEdit = editableKind === "day_end";
  const isDayWrapperEdit = isDayStartEdit || isDayEndEdit;

  useEffect(() => {
    setDraftStart(seg.start);
    setDraftEnd(seg.end ?? "");
    setDraftComment(seg.comment ?? "");
    setEditingMode(null);
    setSaving(false);
    setEditError(null);
  }, [seg.comment, seg.end, seg.id, seg.start]);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setContextMenu(null);
      setMenuPosition(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setContextMenu(null);
      setMenuPosition(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const width = menuRef.current?.offsetWidth ?? 170;
    const height = menuRef.current?.offsetHeight ?? (isZusatz && editableKind ? 78 : 42);
    const pad = 8;
    let x = contextMenu.x;
    let y = contextMenu.y;
    if (x + width + pad > window.innerWidth) {
      x = window.innerWidth - width - pad;
    }
    if (y + height + pad > window.innerHeight) {
      y = window.innerHeight - height - pad;
    }
    setMenuPosition({
      x: Math.max(pad, x),
      y: Math.max(pad, y),
    });
  }, [contextMenu, editableKind, isZusatz]);

  async function saveTimeEdit() {
    if (!editableKind || saving) return;
    if (isDayStartEdit && !isValidHm(draftStart)) {
      setEditError("Bitte gültige Uhrzeit im Format HH:MM eingeben.");
      return;
    }
    if (isDayEndEdit && !isValidHm(draftEnd)) {
      setEditError("Bitte gültige Uhrzeit im Format HH:MM eingeben.");
      return;
    }
    if (!isDayWrapperEdit && (!isValidHm(draftStart) || !isValidHm(draftEnd))) {
      setEditError("Bitte gültige Uhrzeiten im Format HH:MM eingeben.");
      return;
    }
    if (!isDayWrapperEdit && toMin(draftEnd) <= toMin(draftStart)) {
      setEditError("Endzeit muss nach Startzeit liegen.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      if (isDayWrapperEdit) {
        await patchAdminZeiterfassungDaySession({
          sessionId: session.id,
          ...(isDayStartEdit ? { startTime: draftStart } : {}),
          ...(isDayEndEdit ? { endTime: draftEnd } : {}),
        });
      } else {
        const segmentKind = editableKind as Exclude<EditableSegmentKind, "day_start" | "day_end">;
        await patchAdminZeiterfassungSegment({
          sessionId: session.id,
          segmentKind,
          segmentId: seg.id,
          startTime: draftStart,
          endTime: draftEnd,
        });
      }
      setEditingMode(null);
      await onSegmentPatched();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zeit konnte nicht gespeichert werden.";
      setEditError(message || "Zeit konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCommentEdit() {
    if (editableKind !== "zusatzzeit" || saving) return;
    setSaving(true);
    setEditError(null);
    try {
      await patchAdminZeiterfassungSegment({
        sessionId: session.id,
        segmentKind: editableKind,
        segmentId: seg.id,
        comment: draftComment.trim() ? draftComment.trim() : null,
      });
      setEditingMode(null);
      await onSegmentPatched();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kommentar konnte nicht gespeichert werden.";
      setEditError(message || "Kommentar konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  const displayedDuration =
    editingMode === "time" && isValidHm(draftStart) && isValidHm(draftEnd) && toMin(draftEnd) > toMin(draftStart)
      ? fmtDur(diffMin(draftStart, draftEnd))
      : fmtDur(seg.durationMin);
  const secondaryActionButtonStyle = {
    border: "none",
    borderRadius: 6,
    background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
    color: "rgba(0,0,0,0.5)",
    cursor: saving ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  } as const;
  const primaryActionButtonStyle = {
    border: "none",
    borderRadius: 6,
    background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
    color: "#fff",
    cursor: saving ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  } as const;

  const openContextMenuAt = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
    setMenuPosition({ x, y });
    setEditError(null);
  }, []);

  return (
    <div
      className="zt-timeline-row"
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isFahrtzeit ? "5px 14px" : "8px 14px", background: bg, borderBottom: "1px solid rgba(0,0,0,0.03)", position: "relative" }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openContextMenuAt(event.clientX, event.clientY);
      }}
    >
      <div style={{ width: 74, flexShrink: 0, paddingTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={10} strokeWidth={isFahrtzeit ? 1.4 : 2} color={color} />
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color, whiteSpace: "nowrap" as const }}>
          {typeLabel}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: isMarkt || isAnfahrt || isHeimfahrt ? 600 : 500, color: isFahrtzeit ? "rgba(0,0,0,0.35)" : "#1a1a1a", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{seg.title}</span>
          {qmeta && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${qmeta.color}14`, color: qmeta.color, letterSpacing: "0.04em", flexShrink: 0 }}>{qmeta.label}</span>}
        </div>
        {isZusatz && (
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>
            Zusatzzeiterfassung
          </div>
        )}
        {isZusatz && zusatzComment && (
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.5)", marginTop: 2, lineHeight: 1.45, whiteSpace: "pre-wrap" as const }}>
            Kommentar: {zusatzComment}
          </div>
        )}
        {isZusatz && editingMode === "comment" && (
          <div style={{ marginTop: 4 }}>
            <textarea
              value={draftComment}
              onChange={(event) => setDraftComment(event.target.value)}
              maxLength={2000}
              rows={2}
              style={{
                width: "100%",
                minWidth: 220,
                resize: "vertical",
                border: "1px solid rgba(0,0,0,0.14)",
                borderRadius: 6,
                background: "#fff",
                fontSize: 10,
                color: "#1a1a1a",
                lineHeight: 1.4,
                padding: "6px 8px",
                outline: "none",
              }}
            />
            <div style={{ marginTop: 4, display: "flex", gap: 5 }}>
              <button
                onClick={() => {
                  setEditingMode(null);
                  setDraftComment(seg.comment ?? "");
                  setEditError(null);
                }}
                disabled={saving}
                style={{ ...secondaryActionButtonStyle, fontSize: 9, fontWeight: 600, padding: "3px 8px", opacity: saving ? 0.8 : 1 }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { void saveCommentEdit(); }}
                disabled={saving}
                style={{ ...primaryActionButtonStyle, fontSize: 9, fontWeight: 700, padding: "3px 8px", opacity: saving ? 0.85 : 1 }}
              >
                {saving ? "Speichern..." : "Speichern"}
              </button>
            </div>

          </div>
        )}
        {seg.subtitle && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{seg.subtitle}</div>}
        {seg.kmNote && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{seg.kmNote}</div>}
        {editError && <div style={{ fontSize: 9, color: "#b91c1c", marginTop: 4, fontWeight: 600 }}>{editError}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" as const }}>
        {editingMode === "time" && editableKind ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
              <input
                value={draftStart}
                onChange={(event) => setDraftStart(event.target.value.slice(0, 5))}
                disabled={isDayEndEdit || saving}
                inputMode="numeric"
                title={isDayEndEdit ? "Wird vom letzten Eintrag berechnet" : "Arbeitsbeginn"}
                style={{ width: 42, border: "1px solid rgba(0,0,0,0.18)", borderRadius: 5, background: isDayEndEdit ? "rgba(0,0,0,0.035)" : "#fff", fontSize: 10, fontWeight: 600, color: isDayEndEdit ? "rgba(0,0,0,0.35)" : "#374151", textAlign: "center", padding: "2px 3px", fontVariantNumeric: "tabular-nums", outline: "none", cursor: isDayEndEdit ? "not-allowed" : "text" }}
              />
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>-</span>
              <input
                value={draftEnd}
                onChange={(event) => setDraftEnd(event.target.value.slice(0, 5))}
                disabled={isDayStartEdit || saving}
                inputMode="numeric"
                title={isDayStartEdit ? "Wird vom ersten Eintrag berechnet" : "Arbeitsende"}
                style={{ width: 42, border: "1px solid rgba(0,0,0,0.18)", borderRadius: 5, background: isDayStartEdit ? "rgba(0,0,0,0.035)" : "#fff", fontSize: 10, fontWeight: 600, color: isDayStartEdit ? "rgba(0,0,0,0.35)" : "#374151", textAlign: "center", padding: "2px 3px", fontVariantNumeric: "tabular-nums", outline: "none", cursor: isDayStartEdit ? "not-allowed" : "text" }}
              />
            </div>
            <div style={{ marginTop: 3, display: "flex", gap: 4, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setEditingMode(null);
                  setDraftStart(seg.start);
                  setDraftEnd(seg.end ?? "");
                  setEditError(null);
                }}
                disabled={saving}
                style={{ ...secondaryActionButtonStyle, fontSize: 8.5, fontWeight: 600, borderRadius: 5, padding: "2px 6px", opacity: saving ? 0.8 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => { void saveTimeEdit(); }}
                disabled={saving}
                style={{ ...primaryActionButtonStyle, fontSize: 8.5, fontWeight: 700, borderRadius: 5, padding: "2px 6px", opacity: saving ? 0.85 : 1 }}
              >
                {saving ? "..." : "Save"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            <DoctorConfirmationProofButton
              entryId={seg.id}
              doctorConfirmation={seg.doctorConfirmation}
              canUpload={false}
            />
            <span style={{ fontSize: 10, fontWeight: 600, color: isFahrtzeit ? "rgba(0,0,0,0.35)" : "#374151", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>
              {seg.end ? `${seg.start}–${seg.end}` : `${seg.start}`}
            </span>
          </div>
        )}
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{displayedDuration}</div>
      </div>
      {contextMenu && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            position: "fixed",
            top: menuPosition?.y ?? contextMenu.y,
            left: menuPosition?.x ?? contextMenu.x,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 9,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
            minWidth: 150,
            overflow: "hidden",
            padding: 4,
          }}
        >
          {editableKind ? (
            <>
              <button
                onClick={() => {
                  setContextMenu(null);
                  setMenuPosition(null);
                  setEditingMode("time");
                  setEditError(null);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", borderRadius: 6, background: "transparent", padding: "7px 10px", fontSize: 10.5, fontWeight: 600, color: "#374151", cursor: "pointer", transition: "background-color 0.1s ease", fontFamily: "inherit" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {isDayStartEdit ? "Arbeitsbeginn bearbeiten" : isDayEndEdit ? "Arbeitsende bearbeiten" : "Zeit bearbeiten"}
              </button>
              {isZusatz && (
                <button
                  onClick={() => {
                    setContextMenu(null);
                    setMenuPosition(null);
                    setEditingMode("comment");
                    setEditError(null);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", borderRadius: 6, background: "transparent", padding: "7px 10px", fontSize: 10.5, fontWeight: 600, color: "#374151", cursor: "pointer", transition: "background-color 0.1s ease", fontFamily: "inherit" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  ✏ Kommentar bearbeiten
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setContextMenu(null);
                setMenuPosition(null);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", borderRadius: 6, background: "transparent", padding: "7px 10px", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", cursor: "default", fontFamily: "inherit" }}
            >
              Fahrtzeit wird automatisch berechnet
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
});

// ── Stat tile ─────────────────────────────────────────────────
const StatTile = React.memo(function StatTile({ label, value, color = "#1a1a1a" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.055)", padding: "9px 11px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
    </div>
  );
});

const RowMetricCell = React.memo(function RowMetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth: 0, textAlign: "left" as const }}>
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{value}</div>
    </div>
  );
});

// ── GM Day Row (daily view) ───────────────────────────────────
const GMDayRow = React.memo(function GMDayRow({
  session,
  onSegmentPatched,
}: {
  session: TimeDaySession;
  onSegmentPatched: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const stats = deriveStats(session);
  const timeline = useMemo(() => (expanded ? deriveTimeline(session) : []), [expanded, session]);
  const av = gmAvatarColor(session.gmName);
  return (
    <div className="zt-session-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "grid", gridTemplateColumns: ROW_GRID_TEMPLATE, columnGap: ROW_GRID_COLUMN_GAP, alignItems: "center", padding: "11px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{gmInitials(session.gmName)}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>{session.gmName}</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{session.region}</div>
          </div>
        </div>
        <>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: stats.kmGefahren == null ? "—" : `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <RowMetricCell key={m.label} label={m.label} value={m.value} color={m.color} />
          ))}
        </>
        <>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", justifySelf: "end" }} />
        </>
      </div>
      <div className="zt-expanded-shell" style={{ maxHeight: expanded ? "none" : "0", overflow: expanded ? "visible" : "hidden", transition: expanded ? "none" : "max-height 0.36s cubic-bezier(0.4,0,0.2,1)" }}>
        {expanded && (
        <div style={{ opacity: 1, transition: "opacity 0.22s ease 0.05s" }}>
          <div style={{ padding: "8px 18px 10px", borderTop: "1px solid rgba(0,0,0,0.045)" }}>
            <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 6 }}>
              <StatTile label="Start-KM" value={fmtKm(session.startKm)} />
              <StatTile label="End-KM" value={fmtKm(session.endKm)} />
              <StatTile label="Gefahren" value={stats.kmGefahren == null ? "—" : `${stats.kmGefahren.toLocaleString("de-AT")} km`} color="#374151" />
              <StatTile label="Arbeitstag" value={fmtDur(stats.arbeitstag)} color="#1a1a1a" />
              <StatTile label="Reine AZ" value={fmtDur(stats.reineArbeitszeit)} color="#16a34a" />
              <StatTile label="Pause" value={fmtDur(stats.pauseMin)} color="#D97706" />
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {timeline.map((seg) => (
              <ActionRow
                key={seg.id}
                seg={seg}
                session={session}
                onSegmentPatched={onSegmentPatched}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
});

// ── Date group (daily view) ───────────────────────────────────
const DateGroup = React.memo(function DateGroup({
  dateISO,
  sessions,
  onSegmentPatched,
}: {
  dateISO: string;
  sessions: TimeDaySession[];
  onSegmentPatched: () => Promise<void>;
}) {
  const { weekday, date } = fmtDateLabel(dateISO);
  const isToday = dateISO === TODAY;
  const totalEntries = sessions.reduce((s, sess) => s + sess.entries.length, 0);
  return (
    <div className="zt-day-group">
      <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{weekday},</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{date}</span>
          {isToday && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(220,38,38,0.09)", color: R, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>Heute</span>}
        </div>
        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {sessions.length} {sessions.length === 1 ? "GM" : "GMs"} · {totalEntries} Einträge
        </span>
      </div>
      <div style={{ margin: "0 10px 16px", background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: "#fff", margin: "8px 8px 8px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {sessions.map((s) => (
            <GMDayRow key={s.id} session={s} onSegmentPatched={onSegmentPatched} />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── History Day Row (inside GM expansion) ────────────────────
const HistoryDayRow = React.memo(function HistoryDayRow({ session, timeline, stats, onSegmentPatched }: {
  session: TimeDaySession;
  timeline: DisplaySegment[];
  stats: ReturnType<typeof deriveStats>;
  onSegmentPatched: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { weekday, date } = fmtDateLabel(session.date);
  const isToday = session.date === TODAY;

  return (
    <div className="zt-session-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      {/* Collapsed row — same column structure as daily GMDayRow */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "grid", gridTemplateColumns: ROW_GRID_TEMPLATE, columnGap: ROW_GRID_COLUMN_GAP, alignItems: "center", padding: "10px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Date identity — same width as daily identity block */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>
            {weekday}, {date}
          </div>
          {isToday && (
            <span style={{ fontSize: 7.5, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(220,38,38,0.09)", color: R, letterSpacing: "0.05em", textTransform: "uppercase" as const, flexShrink: 0 }}>
              Heute
            </span>
          )}
        </div>

        {/* Same center metrics as daily collapsed row */}
        <>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: stats.kmGefahren == null ? "—" : `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <RowMetricCell key={m.label} label={m.label} value={m.value} color={m.color} />
          ))}
        </>

        {/* Same right counts as daily row */}
        <>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", justifySelf: "end" }} />
        </>
      </div>

      {/* Expanded timeline */}
      <div className="zt-expanded-shell" style={{ maxHeight: expanded ? "none" : "0", overflow: expanded ? "visible" : "hidden", transition: expanded ? "none" : "max-height 0.32s cubic-bezier(0.4,0,0.2,1)" }}>
        {expanded && (
        <div style={{ opacity: 1, transition: "opacity 0.2s ease 0.05s", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
          {timeline.map((seg) => (
            <ActionRow
              key={seg.id}
              seg={seg}
              session={session}
              onSegmentPatched={onSegmentPatched}
            />
          ))}
        </div>
        )}
      </div>
    </div>
  );
});

// ── GM Ansicht Row ────────────────────────────────────────────
const GMAnsichtRow = React.memo(function GMAnsichtRow({
  gm,
  onSegmentPatched,
}: {
  gm: AggregatedGmRow;
  onSegmentPatched: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const av = gmAvatarColor(gm.gmName);

  // Build sorted history groups
  const historyGroups = useMemo(() => {
    if (!expanded) return [];
    const sorted = [...gm.sessions].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map(s => ({ session: s, timeline: deriveTimeline(s), stats: deriveStats(s) }));
  }, [expanded, gm.sessions]);

  const metrics = [
    { label: "Aktuelle KW", value: fmtDur(gm.currentKwReineArbeitszeitMin), sub: `KW ${gm.currentKwNumber}`, color: "#1a1a1a" },
    { label: "Reine AZ gesamt", value: fmtDur(gm.totalReineArbeitszeitMin), sub: `${gm.sessions.length} Tage`, color: "#374151" },
    { label: "Ø Arbeitstag", value: fmtDur(gm.averageWorkdayMin), sub: "", color: "#374151" },
    { label: "KM", value: `${gm.totalKmDriven.toLocaleString("de-AT")} km`, sub: "", color: "#374151" },
    { label: "Privatnutzung", value: gm.privatnutzungKm > 0 ? `${gm.privatnutzungKm} km` : "—", sub: "", color: gm.privatnutzungKm > 0 ? R : "rgba(0,0,0,0.2)" },
  ];

  return (
    <div className="zt-session-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      {/* Collapsed row */}
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

        {/* Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 180, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{gmInitials(gm.gmName)}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>{gm.gmName}</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{gm.region}</div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {metrics.map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const, lineHeight: 1.3 }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.32)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
      </div>

      {/* Expanded history */}
      <div className="zt-expanded-shell" style={{ maxHeight: expanded ? "1600px" : "0", overflow: "hidden", transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
        {expanded && (
        <div style={{ opacity: 1, transition: "opacity 0.22s ease 0.06s" }}>

          {/* Summary strip */}
          <div style={{ padding: "8px 18px 10px", borderTop: "1px solid rgba(0,0,0,0.045)" }}>
            <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 6 }}>
              <StatTile label={`KW ${gm.currentKwNumber}`} value={fmtDur(gm.currentKwReineArbeitszeitMin)} color="#1a1a1a" />
              <StatTile label="Reine AZ gesamt" value={fmtDur(gm.totalReineArbeitszeitMin)} color="#16a34a" />
              <StatTile label="Ø Arbeitstag" value={fmtDur(gm.averageWorkdayMin)} color="#374151" />
              <StatTile label="KM gesamt" value={`${gm.totalKmDriven.toLocaleString("de-AT")} km`} color="#374151" />
              <StatTile label="Privatnutzung" value={gm.privatnutzungKm > 0 ? `${gm.privatnutzungKm} km` : "—"} color={gm.privatnutzungKm > 0 ? R : "rgba(0,0,0,0.25)"} />
              <StatTile label="Tage erfasst" value={`${gm.sessions.length}`} color="#374151" />
            </div>
          </div>

          {/* Historical date blocks — each day is its own collapsible row */}
          <div className="map-scroll zt-history-list" style={{ maxHeight: 800, overflowY: "auto", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {historyGroups.map(({ session, timeline, stats }) => (
              <HistoryDayRow
                key={session.id}
                session={session}
                timeline={timeline}
                stats={stats}
                onSegmentPatched={onSegmentPatched}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
});

// ── Page ─────────────────────────────────────────────────────
export default function ZeiterfassungPage() {
  const [view, setView] = useState<"tage" | "gm">("tage");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<TimeDaySession[]>([]);
  const [aggregateRows, setAggregateRows] = useState<AdminZeiterfassungAggregateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportKind, setExportKind] = useState<"zeiterfassung" | "diaeten">("diaeten");
  const [exportMonth, setExportMonth] = useState(currentDate.getMonth());
  const [exportYear, setExportYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const openExportModal = useCallback(() => {
    setExportKind("zeiterfassung");
    setExportModalOpen(true);
    setExportError(null);
  }, []);

  const loadZeiterfassungData = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    if (showLoader) setLoading(true);
    setLoadError(null);
    try {
      const [dayPayload, aggregatePayload] = await Promise.all([
        fetchAdminZeiterfassungDays({ timezone: "Europe/Vienna", includeLive: true }),
        fetchAdminZeiterfassungGmAggregates({ timezone: "Europe/Vienna", includeLive: true }),
      ]);
      setSessions(
        (dayPayload.sessions ?? []).map((session) => ({
          id: session.id,
          date: session.date,
          gmId: session.gmId,
          gmName: session.gmName,
          region: session.region,
          status: session.status,
          isLive: session.isLive,
          timezone: session.timezone,
          startTime: session.startTime,
          endTime: session.endTime,
          startKm: session.startKm,
          endKm: session.endKm,
          entries: session.entries.map((entry) => {
            const subtype = toEntrySubtype(entry.subtype);
            return {
              id: entry.id,
              kind: entry.kind,
              startTime: entry.startTime,
              endTime: entry.endTime,
              durationMin: entry.durationMin,
              ...(entry.marketName ? { marketName: entry.marketName } : {}),
              ...(entry.marketAddress ? { marketAddress: entry.marketAddress } : {}),
              ...(entry.questionnaireType ? { questionnaireType: entry.questionnaireType } : {}),
              ...(subtype ? { subtype } : {}),
              ...(entry.comment ? { comment: entry.comment } : {}),
            };
          }),
          timeline: session.timeline,
          stats: session.stats,
        })),
      );
      setAggregateRows(aggregatePayload.rows ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zeiterfassung konnte nicht geladen werden.";
      setLoadError(message || "Zeiterfassung konnte nicht geladen werden.");
      setSessions([]);
      setAggregateRows([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  const refreshZeiterfassungSilently = useCallback(async () => {
    await loadZeiterfassungData({ showLoader: false });
  }, [loadZeiterfassungData]);

  useEffect(() => {
    void loadZeiterfassungData({ showLoader: true });
  }, [loadZeiterfassungData]);

  useEffect(() => {
    window.addEventListener("zeiterfassung:openExport", openExportModal);
    return () => window.removeEventListener("zeiterfassung:openExport", openExportModal);
  }, [openExportModal]);

  const handleExport = useCallback(async () => {
    if (exportKind === "zeiterfassung") {
      setExporting(true);
      setExportError(null);
      try {
        const range = getMonthBoundsForZeiterfassungExport(exportYear, exportMonth);
        const payload = await fetchAdminZeiterfassungDays({
          from: range.from,
          to: range.to,
          timezone: "Europe/Vienna",
          includeLive: true,
        });
        await exportAdminZeiterfassung({
          sessions: payload.sessions,
          range,
          timezone: payload.meta.timezone,
        });
        setExportModalOpen(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export konnte nicht erstellt werden.";
        setExportError(message || "Export konnte nicht erstellt werden.");
      } finally {
        setExporting(false);
      }
      return;
    }
    if (exportKind !== "diaeten") {
      setExportError("Bitte Diäten auswählen.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const payload = await fetchAdminDiaetenExport({
        month: exportMonth,
        year: exportYear,
        timezone: "Europe/Vienna",
      });
      await exportAdminDiaeten(payload);
      setExportModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export konnte nicht erstellt werden.";
      setExportError(message || "Export konnte nicht erstellt werden.");
    } finally {
      setExporting(false);
    }
  }, [exportKind, exportMonth, exportYear]);

  // Daily view: group by date, newest first
  const dateGroups = useMemo(() => {
    if (view !== "tage") return [] as Array<{ date: string; sessions: TimeDaySession[] }>;
    const filtered = sessions.filter(s =>
      !search.trim() ||
      s.gmName.toLowerCase().includes(search.toLowerCase()) ||
      s.entries.some(e => e.marketName?.toLowerCase().includes(search.toLowerCase()))
    );
    const map = new Map<string, TimeDaySession[]>();
    filtered.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, sessions]) => ({ date, sessions }));
  }, [sessions, view, search]);

  // GM view: aggregate per GM
  const gmRows = useMemo(() => {
    if (view !== "gm") return [] as AggregatedGmRow[];
    const sessionsByGm = new Map<string, TimeDaySession[]>();
    for (const session of sessions) {
      const bucket = sessionsByGm.get(session.gmId) ?? [];
      bucket.push(session);
      sessionsByGm.set(session.gmId, bucket);
    }
    return aggregateRows
      .filter((row) => !search.trim() || row.gmName.toLowerCase().includes(search.toLowerCase()))
      .map((row) => ({
        gmId: row.gmId,
        gmName: row.gmName,
        region: row.region,
        sessions: (sessionsByGm.get(row.gmId) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
        currentKwNumber: row.currentKwNumber,
        currentKwReineArbeitszeitMin: row.currentKwReineArbeitszeitMin,
        totalReineArbeitszeitMin: row.totalReineArbeitszeitMin,
        averageWorkdayMin: row.averageWorkdayMin,
        totalKmDriven: row.totalKmDriven,
        privatnutzungKm: row.privatnutzungKm,
      }))
      .sort((a, b) => a.gmName.localeCompare(b.gmName));
  }, [aggregateRows, sessions, view, search]);

  const totalDays = dateGroups.length;
  const totalGmDays = dateGroups.reduce((s, g) => s + g.sessions.length, 0);

  if (loading) {
    return <ZeiterfassungPageSkeleton />;
  }

  const isBodyEmpty = loading || (view === "tage" ? dateGroups.length === 0 : gmRows.length === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes ztFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ztBodyFade { from { opacity:0 } to { opacity:1 } }
        .zt-main { animation: ztFadeIn 0.25s ease both; }
        .zt-body { animation: ztBodyFade 0.2s ease both; }
        .zt-day-group {
          content-visibility: auto;
          contain: layout paint style;
          contain-intrinsic-size: auto 420px;
        }
        .zt-session-row,
        .zt-expanded-shell,
        .zt-history-list {
          contain: layout paint style;
        }
        .zt-timeline-row {
          content-visibility: auto;
          contain: layout paint style;
          contain-intrinsic-size: auto 42px;
        }
      `}</style>

      <div className="zt-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>

        {/* Grey header */}
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>Zeiterfassung</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
            {view === "tage"
              ? `${totalDays} ${totalDays === 1 ? "Tag" : "Tage"} · ${totalGmDays} GM-Tage`
              : `${gmRows.length} ${gmRows.length === 1 ? "GM" : "GMs"}`}
          </span>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12 }}>

            {/* View switcher — two tabs only */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 2 }}>
              {([
                { key: "tage", label: "Tage" },
                { key: "gm",   label: "GM Ansicht" },
              ] as const).map(v => (
                <div key={v.key} onClick={() => { setView(v.key); setSearch(""); }}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: view === v.key ? "#fff" : "transparent", color: view === v.key ? "#1a1a1a" : "rgba(0,0,0,0.38)", boxShadow: view === v.key ? "0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0.5px rgba(255,255,255,0.9)" : "none", cursor: "pointer", transition: "all 0.15s", userSelect: "none" as const, whiteSpace: "nowrap" as const }}>
                  {v.label}
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 220px", transition: "border 0.15s, background 0.15s" }}
              onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
              <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
              <input type="text" placeholder={view === "tage" ? "GM / Markt suchen…" : "GM suchen…"} value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
            </div>

          </div>

          {/* Body — fade key forces re-mount on tab switch */}
          <div key={view} className="zt-body">
            {isBodyEmpty ? (
              <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" as const }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={22} strokeWidth={1.5} color={R} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>
                    {loading
                      ? "Zeiterfassung wird geladen..."
                      : loadError
                        ? "Zeiterfassung konnte nicht geladen werden."
                        : search
                          ? "Keine Einträge gefunden."
                          : "Noch keine Zeiterfassungseinträge."}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 320, lineHeight: 1.6 }}>
                    {loading
                      ? "Bitte kurz warten."
                      : loadError
                        ? "Bitte erneut versuchen."
                        : search
                          ? "Versuche einen anderen Suchbegriff."
                          : "Sobald GMs ihren Arbeitstag starten, erscheinen die Einträge hier."}
                  </div>
                </div>
              </div>
            ) : view === "tage" ? (
              <div style={{ padding: "4px 0 0" }}>
                {dateGroups.map((g) => (
                  <DateGroup
                    key={g.date}
                    dateISO={g.date}
                    sessions={g.sessions}
                    onSegmentPatched={refreshZeiterfassungSilently}
                  />
                ))}
              </div>
            ) : (
              <div>
                {/* Column header for GM view */}
                <div style={{ padding: "6px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ minWidth: 180, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
                    {["Aktuelle KW", "Reine AZ gesamt", "Ø Arbeitstag", "KM", "Privatnutzung"].map(h => (
                      <span key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ width: 22 }} />
                </div>
                {/* GM rows */}
                <div>
                  {gmRows.map((gm) => (
                    <GMAnsichtRow
                      key={gm.gmId}
                      gm={gm}
                      onSegmentPatched={refreshZeiterfassungSilently}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {exportModalOpen && typeof document !== "undefined" && createPortal(
        <DiaetenExportModal
          exportKind={exportKind}
          month={exportMonth}
          year={exportYear}
          yearOptions={[currentYear - 1, currentYear]}
          exporting={exporting}
          error={exportError}
          onKindChange={(kind) => {
            setExportKind(kind);
            setExportError(null);
          }}
          onMonthChange={setExportMonth}
          onYearChange={setExportYear}
          onClose={() => {
            if (!exporting) setExportModalOpen(false);
          }}
          onExport={() => { void handleExport(); }}
        />,
        document.body,
      )}
    </div>
  );
}

function DiaetenExportModal({
  exportKind,
  month,
  year,
  yearOptions,
  exporting,
  error,
  onKindChange,
  onMonthChange,
  onYearChange,
  onClose,
  onExport,
}: {
  exportKind: "zeiterfassung" | "diaeten";
  month: number;
  year: number;
  yearOptions: number[];
  exporting: boolean;
  error: string | null;
  onKindChange: (kind: "zeiterfassung" | "diaeten") => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  onExport: () => void;
}) {
  const choiceStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: active ? "1px solid rgba(220,38,38,0.32)" : "1px solid rgba(0,0,0,0.07)",
    borderRadius: 12,
    background: active ? "rgba(220,38,38,0.055)" : "#fff",
    padding: "13px 14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: active ? "0 10px 26px rgba(220,38,38,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" : "0 2px 8px rgba(0,0,0,0.04)",
    fontFamily: "inherit",
  });

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !exporting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        background: "rgba(17,24,39,0.22)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 24px 80px rgba(15,23,42,0.20), 0 2px 8px rgba(15,23,42,0.08)",
          overflow: "hidden",
          fontFamily: "inherit",
        }}
      >
        <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.72)", marginBottom: 6 }}>
              Export
            </div>
            <div style={{ fontSize: 20, fontWeight: 850, letterSpacing: "-0.04em", color: "#111827" }}>
              Zeiterfassung exportieren
            </div>
            <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.55, color: "rgba(17,24,39,0.48)", maxWidth: 390 }}>
              Wähle den Exporttyp. Zeiterfassung exportiert alle Einträge inklusive berechneter Fahrtzeiten.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.07)",
              background: "rgba(0,0,0,0.025)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: exporting ? "default" : "pointer",
              opacity: exporting ? 0.55 : 1,
            }}
          >
            <X size={15} strokeWidth={2} color="rgba(17,24,39,0.56)" />
          </button>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => onKindChange("zeiterfassung")} style={choiceStyle(exportKind === "zeiterfassung")}>
              <div style={{ fontSize: 12, fontWeight: 850, color: "#111827", marginBottom: 4 }}>Zeiterfassung</div>
              <div style={{ fontSize: 10, color: "rgba(17,24,39,0.45)", lineHeight: 1.45 }}>Filterbare Monatsdatei mit Einträgen, Fahrtzeiten, Tages- und GM-Summen.</div>
            </button>
            <button type="button" onClick={() => onKindChange("diaeten")} style={choiceStyle(exportKind === "diaeten")}>
              <div style={{ fontSize: 12, fontWeight: 850, color: "#111827", marginBottom: 4 }}>Diäten</div>
              <div style={{ fontSize: 10, color: "rgba(17,24,39,0.45)", lineHeight: 1.45 }}>Monatsdatei mit Taggeld, KM und Pausenformeln.</div>
            </button>
          </div>

          {exportKind === "diaeten" || exportKind === "zeiterfassung" ? (
            <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, background: "rgba(0,0,0,0.018)", padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(17,24,39,0.35)", marginBottom: 10 }}>
                Zeitraum
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.55fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 750, color: "rgba(17,24,39,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monat</span>
                  <select
                    value={month}
                    onChange={(event) => onMonthChange(Number(event.target.value))}
                    style={{ height: 34, borderRadius: 9, border: "1px solid rgba(0,0,0,0.09)", background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, color: "#111827", outline: "none", fontFamily: "inherit" }}
                  >
                    {MONTH_LABELS.map((label, index) => (
                      <option key={label} value={index}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 750, color: "rgba(17,24,39,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Jahr</span>
                  <select
                    value={year}
                    onChange={(event) => onYearChange(Number(event.target.value))}
                    style={{ height: 34, borderRadius: 9, border: "1px solid rgba(0,0,0,0.09)", background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, color: "#111827", outline: "none", fontFamily: "inherit" }}
                  >
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {error && (
            <div style={{ border: "1px solid rgba(220,38,38,0.20)", borderRadius: 12, background: "rgba(220,38,38,0.055)", padding: "9px 11px", fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, paddingTop: 2 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              style={{ height: 34, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "0 14px", fontSize: 10.5, fontWeight: 800, color: "rgba(17,24,39,0.62)", cursor: exporting ? "default" : "pointer", fontFamily: "inherit" }}
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              style={{
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(185,28,28,0.42)",
                background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff",
                padding: "0 16px",
                fontSize: 10.5,
                fontWeight: 850,
                cursor: exporting ? "default" : "pointer",
                opacity: exporting ? 0.6 : 1,
                boxShadow: "0 8px 18px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.28)",
                fontFamily: "inherit",
              }}
            >
              {exporting ? "Exportiert..." : "Exportieren"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZeiterfassungPageSkeleton() {
  const shimmer: React.CSSProperties = {
    backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)",
    backgroundSize: "400% 100%",
    animation: "zeitSkeletonShimmer 1.25s ease-in-out infinite",
    borderRadius: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes zeitSkeletonShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...shimmer, height: 10, width: 120 }} />
          <div style={{ ...shimmer, height: 10, width: 110 }} />
        </div>

        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 2 }}>
              <div style={{ ...shimmer, height: 22, width: 58, borderRadius: 6 }} />
              <div style={{ ...shimmer, height: 22, width: 86, borderRadius: 6 }} />
            </div>
            <div style={{ ...shimmer, height: 28, width: 220, borderRadius: 7 }} />
          </div>

          <div style={{ padding: "4px 0 0" }}>
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                style={{
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  padding: "12px 18px",
                  display: "grid",
                  gridTemplateColumns: "1.1fr 0.7fr 0.7fr 0.7fr 0.55fr 0.55fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ ...shimmer, height: 12, width: `${40 + (index % 4) * 10}%` }} />
                  <div style={{ ...shimmer, height: 9, width: `${55 + (index % 3) * 10}%` }} />
                </div>
                <div style={{ ...shimmer, height: 12, width: "85%" }} />
                <div style={{ ...shimmer, height: 12, width: "75%" }} />
                <div style={{ ...shimmer, height: 12, width: "72%" }} />
                <div style={{ ...shimmer, height: 12, width: "62%" }} />
                <div style={{ ...shimmer, height: 12, width: "62%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
