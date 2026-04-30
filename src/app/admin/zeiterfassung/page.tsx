"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, Clock, Store, Car, Coffee,
  GraduationCap, Wrench, Home, Warehouse, Star, Search,
} from "lucide-react";
import {
  fetchAdminZeiterfassungDays,
  fetchAdminZeiterfassungGmAggregates,
  type AdminZeiterfassungAggregateRow,
} from "@/lib/api/backend";
import type { TimeDaySession } from "@/types/zeiterfassung";

// ── Constants ─────────────────────────────────────────────────
const R  = "#DC2626";

// ── Helpers ───────────────────────────────────────────────────
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function diffMin(start: string, end: string): number {
  return Math.max(0, toMin(end) - toMin(start));
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

// ── Display segment types ─────────────────────────────────────
type SegmentKind = "anfahrt" | "marktbesuch" | "fahrtzeit" | "pause" | "zusatzzeit" | "heimfahrt";
interface DisplaySegment {
  kind: SegmentKind;
  start: string;
  end?: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  kmNote?: string;
  subtype?: string;
  questionnaireType?: string;
}

function deriveTimeline(session: TimeDaySession): DisplaySegment[] {
  if (Array.isArray(session.timeline) && session.timeline.length > 0) {
    return session.timeline.map((segment) => ({
      kind: segment.kind,
      start: segment.start,
      end: segment.end,
      durationMin: segment.durationMin,
      title: segment.title,
      subtitle: segment.subtitle,
      subtype: segment.subtype,
      questionnaireType: segment.questionnaireType,
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
      if (gap > 0) segments.push({ kind: "fahrtzeit", start: prev.endTime, end: entry.startTime, durationMin: gap, title: "Fahrtzeit" });
    }
    if (entry.kind === "marktbesuch") {
      segments.push({ kind: "marktbesuch", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: entry.marketName ?? "Marktbesuch", subtitle: entry.marketAddress, questionnaireType: entry.questionnaireType });
    } else if (entry.kind === "pause") {
      segments.push({ kind: "pause", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: "Pause" });
    } else if (entry.kind === "zusatzzeit") {
      const label = entry.subtype ? SUBTYPE_META[entry.subtype]?.label ?? entry.subtype : "Zusatzzeit";
      segments.push({ kind: "zusatzzeit", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: label, subtype: entry.subtype });
    }
  });
  if (!isOpenDay) {
    const lastEntryEnd = sorted[sorted.length - 1]?.endTime ?? session.startTime;
    if (toMin(session.endTime) > toMin(lastEntryEnd)) {
      segments.push({
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

// ── Action Row ────────────────────────────────────────────────
function ActionRow({ seg }: { seg: DisplaySegment }) {
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
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isFahrtzeit ? "5px 14px" : "8px 14px", background: bg, borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
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
        {seg.subtitle && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{seg.subtitle}</div>}
        {seg.kmNote && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{seg.kmNote}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" as const }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: isFahrtzeit ? "rgba(0,0,0,0.35)" : "#374151", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>
          {seg.end ? `${seg.start}–${seg.end}` : `${seg.start}`}
        </div>
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{fmtDur(seg.durationMin)}</div>
      </div>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────
function StatTile({ label, value, color = "#1a1a1a" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.055)", padding: "9px 11px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
    </div>
  );
}

// ── GM Day Row (daily view) ───────────────────────────────────
function GMDayRow({ session }: { session: TimeDaySession }) {
  const [expanded, setExpanded] = useState(false);
  const stats = deriveStats(session);
  const timeline = useMemo(() => deriveTimeline(session), [session]);
  const av = gmAvatarColor(session.gmName);
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 180, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{gmInitials(session.gmName)}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>{session.gmName}</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{session.region}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: stats.kmGefahren == null ? "—" : `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ maxHeight: expanded ? "1200px" : "0", overflow: "hidden", transition: "max-height 0.36s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.22s ease 0.05s" }}>
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
            {timeline.map((seg, i) => <ActionRow key={i} seg={seg} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date group (daily view) ───────────────────────────────────
function DateGroup({ dateISO, sessions }: { dateISO: string; sessions: TimeDaySession[] }) {
  const { weekday, date } = fmtDateLabel(dateISO);
  const isToday = dateISO === TODAY;
  const totalEntries = sessions.reduce((s, sess) => s + sess.entries.length, 0);
  return (
    <div>
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
          {sessions.map(s => <GMDayRow key={s.id} session={s} />)}
        </div>
      </div>
    </div>
  );
}

// ── History Day Row (inside GM expansion) ────────────────────
function HistoryDayRow({ session, timeline, stats }: {
  session: TimeDaySession;
  timeline: DisplaySegment[];
  stats: ReturnType<typeof deriveStats>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { weekday, date } = fmtDateLabel(session.date);
  const isToday = session.date === TODAY;

  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      {/* Collapsed row — same column structure as daily GMDayRow */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Date identity — same width as daily identity block */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, flexShrink: 0 }}>
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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: stats.kmGefahren == null ? "—" : `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Same right counts as daily row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
        </div>
      </div>

      {/* Expanded timeline */}
      <div style={{ maxHeight: expanded ? "1000px" : "0", overflow: "hidden", transition: "max-height 0.32s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s ease 0.05s", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
          {timeline.map((seg, i) => <ActionRow key={i} seg={seg} />)}
        </div>
      </div>
    </div>
  );
}

// ── GM Ansicht Row ────────────────────────────────────────────
function GMAnsichtRow({ gm }: { gm: AggregatedGmRow }) {
  const [expanded, setExpanded] = useState(false);
  const av = gmAvatarColor(gm.gmName);

  // Build sorted history groups
  const historyGroups = useMemo(() => {
    const sorted = [...gm.sessions].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map(s => ({ session: s, timeline: deriveTimeline(s), stats: deriveStats(s) }));
  }, [gm.sessions]);

  const metrics = [
    { label: "Aktuelle KW", value: fmtDur(gm.currentKwReineArbeitszeitMin), sub: `KW ${gm.currentKwNumber}`, color: "#1a1a1a" },
    { label: "Reine AZ gesamt", value: fmtDur(gm.totalReineArbeitszeitMin), sub: `${gm.sessions.length} Tage`, color: "#374151" },
    { label: "Ø Arbeitstag", value: fmtDur(gm.averageWorkdayMin), sub: "", color: "#374151" },
    { label: "KM", value: `${gm.totalKmDriven.toLocaleString("de-AT")} km`, sub: "", color: "#374151" },
    { label: "Privatnutzung", value: gm.privatnutzungKm > 0 ? `${gm.privatnutzungKm} km` : "—", sub: "", color: gm.privatnutzungKm > 0 ? R : "rgba(0,0,0,0.2)" },
  ];

  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
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
      <div style={{ maxHeight: expanded ? "1600px" : "0", overflow: "hidden", transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.22s ease 0.06s" }}>

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
          <div className="map-scroll" style={{ maxHeight: 800, overflowY: "auto", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {historyGroups.map(({ session, timeline, stats }) => (
              <HistoryDayRow key={session.id} session={session} timeline={timeline} stats={stats} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function ZeiterfassungPage() {
  const [view, setView] = useState<"tage" | "gm">("tage");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<TimeDaySession[]>([]);
  const [aggregateRows, setAggregateRows] = useState<AdminZeiterfassungAggregateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      fetchAdminZeiterfassungDays({ timezone: "Europe/Vienna", includeLive: true }),
      fetchAdminZeiterfassungGmAggregates({ timezone: "Europe/Vienna", includeLive: true }),
    ])
      .then(([dayPayload, aggregatePayload]) => {
        if (cancelled) return;
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
            entries: session.entries,
            timeline: session.timeline,
            stats: session.stats,
          })),
        );
        setAggregateRows(aggregatePayload.rows ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Zeiterfassung konnte nicht geladen werden.";
        setLoadError(message || "Zeiterfassung konnte nicht geladen werden.");
        setSessions([]);
        setAggregateRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const isBodyEmpty = loading || (view === "tage" ? dateGroups.length === 0 : gmRows.length === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes ztFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ztBodyFade { from { opacity:0 } to { opacity:1 } }
        .zt-main { animation: ztFadeIn 0.25s ease both; }
        .zt-body { animation: ztBodyFade 0.2s ease both; }
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
                {dateGroups.map(g => <DateGroup key={g.date} dateISO={g.date} sessions={g.sessions} />)}
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
                  {gmRows.map(gm => <GMAnsichtRow key={gm.gmId} gm={gm} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
