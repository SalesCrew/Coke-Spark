"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Car,
  ChevronDown,
  Clock,
  Coffee,
  Home,
  Loader2,
  Route,
  Store,
  Warehouse,
  X,
} from "lucide-react";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { GM_MENU_ITEMS } from "@/components/dashboard/gmMenuItems";
import Aurora from "@/components/ui/Aurora";
import {
  fetchGmZeiterfassung,
  fetchGmTimeEntryChangeRequests,
  logoutCurrentUser,
  requestGmTimeEntryChange,
  type AdminZeiterfassungSession,
  type AdminZeiterfassungTimelineSegment,
  type GmZeiterfassungPayload,
  type TimeEntryChangeRequest,
  type TimeEntryChangeRequestSourceKind,
} from "@/lib/api/backend";

const R = "#DC2626";
const WEEKLY_REINE_ARBEITSZEIT_TARGET_MIN = 38.5 * 60;

type SegmentKind = "anfahrt" | "marktbesuch" | "fahrtzeit" | "zusatzzeit" | "pause" | "heimfahrt";

type GmZeitSegment = {
  id: string;
  kind: SegmentKind;
  start: string;
  end: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  timeChange?: {
    status: "pending" | "approved" | "rejected" | "cancelled";
    originalStart: string;
    originalEnd: string;
    requestedStart: string;
    requestedEnd: string;
    reviewedAt: string | null;
  };
};

type GmZeitDay = {
  id: string;
  dateLabel: string;
  dateShort: string;
  isToday?: boolean;
  startTime: string;
  endTime: string;
  reineAzMin: number;
  pauseMin: number;
  km: number | null;
  visits: number;
  segments: GmZeitSegment[];
};

type EditableTimeSegmentKind = Extract<SegmentKind, "marktbesuch" | "pause" | "zusatzzeit">;

type TimeChangeDraft = {
  day: GmZeitDay;
  segment: GmZeitSegment & { kind: EditableTimeSegmentKind };
  startTime: string;
  endTime: string;
  note: string;
};

function fmtDur(min: number): string {
  const safe = Math.max(0, min);
  if (safe < 60) return `${safe} Min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDateRange(range: "week" | "month" | "all"): { from: string; to: string; label: string } {
  const today = new Date();
  const to = toYmd(today);
  if (range === "week") return { from: toYmd(startOfWeek(today)), to, label: "Diese Woche" };
  if (range === "month") return { from: toYmd(startOfMonth(today)), to, label: "Dieser Monat" };
  return { from: toYmd(addDays(today, -365)), to, label: "Letzte 12 Monate" };
}

function fmtDateShort(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateLabel(ymd: string): string {
  const today = toYmd(new Date());
  if (ymd === today) return "Heute";
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("de-AT", { weekday: "long" });
}

function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function mapTimelineSegment(segment: AdminZeiterfassungTimelineSegment): GmZeitSegment {
  return {
    id: segment.id,
    kind: segment.kind,
    start: segment.start,
    end: segment.end,
    durationMin: segment.durationMin,
    title: segment.title,
    subtitle: segment.subtitle ?? segment.comment,
  };
}

function fmtRequestHm(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isEditableTimeSegmentKind(kind: SegmentKind): kind is EditableTimeSegmentKind {
  return kind === "marktbesuch" || kind === "pause" || kind === "zusatzzeit";
}

function buildTimeChangeMap(requests: TimeEntryChangeRequest[]): Map<string, TimeEntryChangeRequest> {
  const sorted = [...requests].sort((a, b) => {
    const statusRank = (value: TimeEntryChangeRequest["status"]) => value === "pending" ? 0 : value === "approved" ? 1 : 2;
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const map = new Map<string, TimeEntryChangeRequest>();
  for (const request of sorted) {
    const key = `${request.daySessionId}:${request.sourceKind}:${request.sourceId}`;
    if (!map.has(key)) map.set(key, request);
  }
  return map;
}

function mapSessionToDay(session: AdminZeiterfassungSession, timeChangeMap: Map<string, TimeEntryChangeRequest>): GmZeitDay {
  const segments = session.timeline.map((segment) => {
    const mapped = mapTimelineSegment(segment);
    if (!isEditableTimeSegmentKind(mapped.kind)) return mapped;
    const request = timeChangeMap.get(`${session.id}:${mapped.kind}:${mapped.id}`);
    if (!request || request.status === "rejected" || request.status === "cancelled") return mapped;
    return {
      ...mapped,
      timeChange: {
        status: request.status,
        originalStart: fmtRequestHm(request.originalStartAt),
        originalEnd: fmtRequestHm(request.originalEndAt),
        requestedStart: fmtRequestHm(request.requestedStartAt),
        requestedEnd: fmtRequestHm(request.requestedEndAt),
        reviewedAt: request.reviewedAt,
      },
    };
  });
  return {
    id: session.id,
    dateLabel: fmtDateLabel(session.date),
    dateShort: fmtDateShort(session.date),
    isToday: session.date === toYmd(new Date()),
    startTime: session.startTime,
    endTime: session.endTime,
    reineAzMin: session.stats.reineArbeitszeit,
    pauseMin: session.stats.pauseMin,
    km: session.stats.kmGefahren,
    visits: session.stats.marktbesuche,
    segments,
  };
}

function segmentMeta(kind: SegmentKind) {
  if (kind === "marktbesuch") return { label: "Marktbesuch", color: R, icon: Store, quiet: false };
  if (kind === "zusatzzeit") return { label: "Zusatz", color: "#4b5563", icon: Warehouse, quiet: false };
  if (kind === "pause") return { label: "Pause", color: "#D97706", icon: Coffee, quiet: false };
  if (kind === "fahrtzeit") return { label: "Fahrtzeit", color: "rgba(15,23,42,0.34)", icon: Route, quiet: true };
  if (kind === "heimfahrt") return { label: "Heimfahrt", color: "rgba(15,23,42,0.42)", icon: Home, quiet: true };
  return { label: "Anfahrt", color: "rgba(15,23,42,0.42)", icon: Car, quiet: true };
}

function GmZeitStatsPanel({ stats }: {
  stats: {
    drivenKm: number;
    privateKm: number;
    averageWorkdayMin: number;
    weekWorkedMin: number;
    weekTargetMin: number;
    recordedDays: number;
  };
}) {
  const kmTotal = Math.max(1, stats.drivenKm + stats.privateKm);
  const drivenPct = Math.round((stats.drivenKm / kmTotal) * 100);
  const privatePct = Math.max(0, 100 - drivenPct);
  const weekPct = Math.min(100, Math.round((stats.weekWorkedMin / stats.weekTargetMin) * 100));
  return (
    <section className="gm-zeit-stats-panel">
      <div className="gm-zeit-stats-primary">
        <div style={{ paddingRight: 72 }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)" }}>
              Woche bisher
            </div>
            <div style={{ marginTop: 7, fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
              {fmtDur(stats.weekWorkedMin)}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 650, color: "rgba(15,23,42,0.42)" }}>
              Reine Arbeitszeit · {stats.recordedDays} Tage erfasst
            </div>
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={20} strokeWidth={1.9} color="#059669" />
          </div>
        </div>
        <div style={{ marginTop: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 750, color: "rgba(15,23,42,0.38)" }}>Wochenziel</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.48)", fontVariantNumeric: "tabular-nums" }}>{weekPct}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "rgba(15,23,42,0.055)", overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.025)" }}>
            <div style={{ width: `${weekPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #059669, #12b981)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)" }} />
          </div>
        </div>
      </div>

      <div className="gm-zeit-stats-secondary">
        <div className="gm-zeit-stat-chip">
          <div style={{ paddingRight: 28 }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)" }}>Kilometer</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                  <span style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1, color: "rgba(15,23,42,0.92)", fontVariantNumeric: "tabular-nums" }}>{stats.drivenKm} km</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: R, fontVariantNumeric: "tabular-nums" }}>{stats.privateKm} km privat</span>
                </div>
                <div style={{ marginTop: 5, fontSize: 10, fontWeight: 650, color: "rgba(15,23,42,0.42)" }}>Gesamtstrecke</div>
              </div>
            </div>
            <div style={{ position: "absolute", top: 16, right: 15, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={18} strokeWidth={1.9} color="rgba(15,23,42,0.42)" />
            </div>
          </div>
          <div style={{ marginTop: 13, display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.36)" }}>
            <span style={{ color: "rgba(37,99,235,0.72)" }}>Dienstlich {drivenPct}%</span>
            <span style={{ color: "rgba(226,35,43,0.72)" }}>Privat {privatePct}%</span>
          </div>
          <div style={{ marginTop: 7, height: 7, borderRadius: 999, display: "flex", overflow: "hidden", background: "rgba(15,23,42,0.055)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.025)" }}>
            <div style={{ width: `${drivenPct}%`, minWidth: drivenPct > 0 ? 4 : 0, height: "100%", background: "linear-gradient(90deg, #1d4ed8, #60a5fa)" }} />
            {privatePct > 0 ? (
              <div style={{ width: `${privatePct}%`, minWidth: 7, height: "100%", background: "linear-gradient(90deg, #b91c1c, #fb7185)" }} />
            ) : null}
          </div>
        </div>

        <div className="gm-zeit-stat-mini-grid">
          <div className="gm-zeit-stat-mini">
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)" }}>Ø Arbeitstag</div>
            <div aria-hidden="true" style={{ position: "absolute", left: 14, right: 14, top: 28, height: 1, background: "rgba(15,23,42,0.055)" }} />
            <div style={{ marginTop: 5, fontSize: 20, fontWeight: 750, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.92)", fontVariantNumeric: "tabular-nums" }}>{fmtDur(stats.averageWorkdayMin)}</div>
          </div>
          <div className="gm-zeit-stat-mini">
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)" }}>KM privat</div>
            <div aria-hidden="true" style={{ position: "absolute", left: 14, right: 14, top: 28, height: 1, background: "rgba(15,23,42,0.055)" }} />
            <div style={{ marginTop: 5, fontSize: 20, fontWeight: 750, letterSpacing: "-0.02em", color: R, fontVariantNumeric: "tabular-nums" }}>{stats.privateKm} km</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SkeletonBlock({ style }: { style?: CSSProperties }) {
  return <div className="gm-zeit-skeleton" style={style} />;
}

function GmZeitPageSkeleton() {
  return (
    <>
      <section className="gm-zeit-stats-panel" aria-label="Zeiterfassung wird geladen">
        <div className="gm-zeit-stats-primary">
          <SkeletonBlock style={{ width: 94, height: 8, borderRadius: 999 }} />
          <SkeletonBlock style={{ marginTop: 11, width: 145, height: 30, borderRadius: 9 }} />
          <SkeletonBlock style={{ marginTop: 9, width: 188, height: 10, borderRadius: 999 }} />
          <SkeletonBlock style={{ position: "absolute", top: 17, right: 17, width: 20, height: 20, borderRadius: 8 }} />
          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <SkeletonBlock style={{ width: 74, height: 8, borderRadius: 999 }} />
            <SkeletonBlock style={{ width: 34, height: 8, borderRadius: 999 }} />
          </div>
          <SkeletonBlock style={{ marginTop: 8, width: "100%", height: 7, borderRadius: 999 }} />
        </div>

        <div className="gm-zeit-stats-secondary">
          <div className="gm-zeit-stat-chip">
            <SkeletonBlock style={{ width: 74, height: 8, borderRadius: 999 }} />
            <SkeletonBlock style={{ marginTop: 12, width: 172, height: 30, borderRadius: 9 }} />
            <SkeletonBlock style={{ marginTop: 8, width: 106, height: 10, borderRadius: 999 }} />
            <SkeletonBlock style={{ position: "absolute", top: 17, right: 17, width: 18, height: 18, borderRadius: 7 }} />
            <div style={{ marginTop: 19, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <SkeletonBlock style={{ width: 88, height: 8, borderRadius: 999 }} />
              <SkeletonBlock style={{ width: 62, height: 8, borderRadius: 999 }} />
            </div>
            <SkeletonBlock style={{ marginTop: 8, width: "100%", height: 7, borderRadius: 999 }} />
          </div>

          <div className="gm-zeit-stat-mini-grid">
            {[0, 1].map((item) => (
              <div key={item} className="gm-zeit-stat-mini">
                <SkeletonBlock style={{ width: 96, height: 8, borderRadius: 999 }} />
                <SkeletonBlock style={{ position: "absolute", left: 14, right: 14, top: 28, height: 1, borderRadius: 999 }} />
                <SkeletonBlock style={{ marginTop: 13, width: item === 0 ? 94 : 58, height: 20, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gm-zeit-week-strip">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          <div>
            <SkeletonBlock style={{ width: 46, height: 8, borderRadius: 999 }} />
            <SkeletonBlock style={{ marginTop: 8, width: 104, height: 10, borderRadius: 999 }} />
          </div>
          <div style={{ flex: 1, maxWidth: 420 }}>
            <SkeletonBlock style={{ width: "100%", height: 28, borderRadius: 999 }} />
          </div>
        </div>
      </section>

      <section className="gm-zeit-main-card">
        <div style={{ padding: "15px 16px 13px", borderBottom: "1px solid rgba(15,23,42,0.055)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <SkeletonBlock style={{ width: 58, height: 8, borderRadius: 999 }} />
            <SkeletonBlock style={{ marginTop: 8, width: 102, height: 14, borderRadius: 999 }} />
          </div>
          <SkeletonBlock style={{ width: 148, height: 30, borderRadius: 9 }} />
        </div>
        <div style={{ padding: 16 }}>
          {[0, 1, 2, 3].map((item) => (
            <SkeletonBlock key={item} style={{ height: 52, borderRadius: 12, marginBottom: item === 3 ? 0 : 8 }} />
          ))}
        </div>
      </section>
    </>
  );
}

function GmZeitSegmentedControl({ value, onChange }: {
  value: "week" | "month" | "all";
  onChange: (value: "week" | "month" | "all") => void;
}) {
  const options = [
    { value: "week", label: "Woche" },
    { value: "month", label: "Monat" },
    { value: "all", label: "Alle" },
  ] as const;
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, background: "rgba(15,23,42,0.045)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.045)" }}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              height: 24,
              padding: "0 12px",
              border: "none",
              borderRadius: 7,
              background: active ? "#ffffff" : "transparent",
              boxShadow: active ? "0 1px 4px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" : "none",
              color: active ? "rgba(15,23,42,0.86)" : "rgba(15,23,42,0.42)",
              fontSize: 10,
              fontWeight: 750,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WeeklyProgress({ sessions }: { sessions: AdminZeiterfassungSession[] }) {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const sessionDates = new Set(sessions.map((session) => session.date));
  const currentWeekdayIndex = Math.min(4, Math.max(0, (today.getDay() + 6) % 7));
  const days = ["Mo", "Di", "Mi", "Do", "Fr"].map((label, index) => {
    const date = addDays(weekStart, index);
    const ymd = toYmd(date);
    const hasEntry = sessionDates.has(ymd);
    const elapsed = index <= currentWeekdayIndex;
    return { label, hasEntry, elapsed };
  });
  const dayProgress = Math.min(1, Math.max(0, (today.getHours() * 60 + today.getMinutes()) / (24 * 60)));
  const timeBasedWeekIndex = Math.min(days.length - 1, currentWeekdayIndex + dayProgress);
  const progressPct = days.length > 1 ? Math.round((timeBasedWeekIndex / (days.length - 1)) * 1000) / 10 : 0;
  return (
    <div className="gm-zeit-week-strip">
      <div style={{ display: "grid", gridTemplateColumns: "180px minmax(180px, 1fr) minmax(260px, 380px)", alignItems: "center", columnGap: 22 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)" }}>KW {getIsoWeek(today)}</div>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 650, color: "rgba(15,23,42,0.48)" }}>Aktuelle Woche</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minWidth: 0, color: "rgba(15,23,42,0.32)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.3px solid rgba(220,38,38,0.58)", background: "#fff", boxSizing: "border-box" }} />
            vorbei
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.3px solid rgba(220,38,38,0.68)", background: R, boxSizing: "border-box" }} />
            Eintrag
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>
            <span style={{ width: 16, height: 2, borderRadius: 99, background: "rgba(220,38,38,0.48)" }} />
            Stand
          </span>
        </div>
        <div style={{ width: "100%", maxWidth: 380, minWidth: 260, justifySelf: "end" }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 28, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", alignItems: "center", gap: 0 }}>
            <div style={{ position: "absolute", left: "10%", right: "10%", top: 12, height: 2, borderRadius: 99, background: "rgba(15,23,42,0.06)", zIndex: 0 }} />
            <div style={{ position: "absolute", left: "10%", top: 12, width: `calc(80% * ${progressPct / 100})`, height: 2, borderRadius: 99, background: "rgba(220,38,38,0.6)", zIndex: 0 }} />
            {days.map((day) => {
              const dotBorder = day.elapsed || day.hasEntry ? "rgba(220,38,38,0.78)" : "rgba(15,23,42,0.1)";
              return (
                <div key={day.label} style={{ position: "relative", zIndex: 1, height: 28, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <span
                    style={{
                      display: "block",
                      width: 9,
                      height: 9,
                      flex: "0 0 9px",
                      borderRadius: "50%",
                      boxSizing: "border-box",
                      background: day.hasEntry ? R : "#ffffff",
                      border: `1.5px solid ${dotBorder}`,
                    }}
                  />
                  <span style={{ fontSize: 9, fontWeight: 750, color: day.elapsed || day.hasEntry ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0.26)" }}>{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="gm-zeit-metric-cell">
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent ?? "rgba(15,23,42,0.88)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

function GmZeitTimelineRow({ segment, first, last, onRequestChange }: {
  segment: GmZeitSegment;
  first: boolean;
  last: boolean;
  onRequestChange?: (segment: GmZeitSegment & { kind: EditableTimeSegmentKind }) => void;
}) {
  const meta = segmentMeta(segment.kind);
  const Icon = meta.icon;
  const editable = isEditableTimeSegmentKind(segment.kind) && Boolean(onRequestChange);
  return (
    <button
      type="button"
      className={`gm-zeit-timeline-row ${editable ? "is-editable" : ""}`}
      onClick={() => {
        if (editable) onRequestChange?.(segment as GmZeitSegment & { kind: EditableTimeSegmentKind });
      }}
      disabled={!editable}
    >
      <div style={{ position: "relative", width: 28, alignSelf: "stretch", display: "flex", justifyContent: "center" }}>
        {!first && <span style={{ position: "absolute", top: 0, bottom: "calc(50% + 9px)", width: 1, background: "rgba(15,23,42,0.08)" }} />}
        {!last && <span style={{ position: "absolute", top: "calc(50% + 9px)", bottom: 0, width: 1, background: "rgba(15,23,42,0.08)" }} />}
        <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: 18, height: 18, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", background: meta.quiet ? "rgba(15,23,42,0.035)" : `${meta.color}12`, boxShadow: `inset 0 0 0 1px ${meta.quiet ? "rgba(15,23,42,0.06)" : `${meta.color}24`}` }}>
          <Icon size={10} strokeWidth={2} color={meta.color} />
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1, padding: "9px 0" }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)", marginBottom: 2 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 12, fontWeight: meta.quiet ? 680 : 780, letterSpacing: 0, color: meta.quiet ? "rgba(15,23,42,0.62)" : "rgba(15,23,42,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {segment.title}
        </div>
        {segment.subtitle && (
          <div style={{ marginTop: 2, fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {segment.subtitle}
          </div>
        )}
        {segment.timeChange?.status === "approved" ? (
          <div style={{ marginTop: 3, fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.34)" }}>
            Original {segment.timeChange.originalStart} - {segment.timeChange.originalEnd}
          </div>
        ) : segment.timeChange?.status === "pending" ? (
          <div style={{ marginTop: 3, fontSize: 9, fontWeight: 760, color: "#D97706" }}>
            Änderung angefragt: {segment.timeChange.requestedStart} - {segment.timeChange.requestedEnd}
          </div>
        ) : null}
      </div>
      <div style={{ padding: "9px 0", textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.86)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {segment.start} - {segment.end}
        </div>
        <div style={{ marginTop: 2, fontSize: 9, fontWeight: 650, color: "rgba(15,23,42,0.32)" }}>
          {segment.durationMin} Min
        </div>
      </div>
    </button>
  );
}

function GmZeitDayRow({ day, defaultExpanded = false, onRequestChange }: {
  day: GmZeitDay;
  defaultExpanded?: boolean;
  onRequestChange?: (day: GmZeitDay, segment: GmZeitSegment & { kind: EditableTimeSegmentKind }) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div style={{ borderBottom: "1px solid rgba(15,23,42,0.045)" }}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="gm-zeit-day-row"
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.92)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              {day.dateLabel}, {day.dateShort}
            </span>
            {day.isToday && (
              <span style={{ height: 18, display: "inline-flex", alignItems: "center", padding: "0 7px", borderRadius: 999, background: "rgba(220,38,38,0.08)", color: R, fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Heute
              </span>
            )}
          </div>
          <div style={{ marginTop: 3, fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.36)" }}>
            {day.segments.length} Zeilen im Tagesverlauf
          </div>
        </div>
        <MetricCell label="Arbeitstag" value={`${day.startTime}-${day.endTime}`} />
        <MetricCell label="Reine AZ" value={fmtDur(day.reineAzMin)} accent="#059669" />
        <MetricCell label="Pause" value={fmtDur(day.pauseMin)} accent="#D97706" />
        <MetricCell label="KM" value={day.km == null ? "-" : `${day.km} km`} />
        <MetricCell label="Besuche" value={String(day.visits)} accent={day.visits > 0 ? R : undefined} />
        <ChevronDown size={14} strokeWidth={2.1} color="rgba(15,23,42,0.32)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.24s cubic-bezier(0.4,0,0.2,1)", justifySelf: "end" }} />
      </button>
      <div
        className="gm-zeit-timeline-scroll"
        style={{
          maxHeight: expanded ? "min(760px, calc(100dvh - 210px))" : 0,
          overflowX: "hidden",
          overflowY: expanded ? "auto" : "hidden",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          transition: "max-height 0.34s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.18s ease 0.05s", padding: "0 14px 24px" }}>
          <div style={{ borderRadius: 13, border: "1px solid rgba(15,23,42,0.055)", background: "linear-gradient(180deg, rgba(15,23,42,0.018), rgba(15,23,42,0.006))", padding: "4px 12px" }}>
            {day.segments.map((segment, index) => (
              <GmZeitTimelineRow
                key={segment.id}
                segment={segment}
                first={index === 0}
                last={index === day.segments.length - 1}
                onRequestChange={isEditableTimeSegmentKind(segment.kind) ? (selected) => onRequestChange?.(day, selected) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GmZeiterfassungPage() {
  const router = useRouter();
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const [payload, setPayload] = useState<GmZeiterfassungPayload | null>(null);
  const [timeRequests, setTimeRequests] = useState<TimeEntryChangeRequest[]>([]);
  const [changeDraft, setChangeDraft] = useState<TimeChangeDraft | null>(null);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedRange = useMemo(() => getDateRange(range), [range]);
  const timeChangeMap = useMemo(() => buildTimeChangeMap(timeRequests), [timeRequests]);
  const days = useMemo(() => (payload?.sessions ?? []).map((session) => mapSessionToDay(session, timeChangeMap)), [payload?.sessions, timeChangeMap]);
  const currentWeekNumber = getIsoWeek(new Date());
  const weeklySessions = useMemo(
    () => (payload?.sessions ?? []).filter((session) => getIsoWeek(new Date(`${session.date}T12:00:00`)) === currentWeekNumber),
    [currentWeekNumber, payload?.sessions],
  );
  const stats = useMemo(() => ({
    drivenKm: payload?.aggregate?.totalKmDriven ?? 0,
    privateKm: payload?.aggregate?.privatnutzungKm ?? 0,
    averageWorkdayMin: payload?.aggregate?.averageWorkdayMin ?? 0,
    weekWorkedMin: payload?.aggregate?.currentKwReineArbeitszeitMin ?? 0,
    weekTargetMin: WEEKLY_REINE_ARBEITSZEIT_TARGET_MIN,
    recordedDays: weeklySessions.filter((session) => session.status === "submitted" && session.hasCompleteKm).length,
  }), [payload?.aggregate, weeklySessions]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchGmZeiterfassung({
        from: selectedRange.from,
        to: selectedRange.to,
        includeLive: true,
        timezone: "Europe/Vienna",
      }),
      fetchGmTimeEntryChangeRequests({
        from: selectedRange.from,
        to: selectedRange.to,
      }),
    ])
      .then(([result, requestRows]) => {
        if (cancelled) return;
        setPayload(result);
        setTimeRequests(requestRows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Zeiterfassung konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRange.from, selectedRange.to]);

  const openTimeChangeRequest = (day: GmZeitDay, segment: GmZeitSegment & { kind: EditableTimeSegmentKind }) => {
    setChangeError(null);
    setChangeDraft({
      day,
      segment,
      startTime: segment.start,
      endTime: segment.end,
      note: "",
    });
  };

  const submitTimeChangeRequest = async () => {
    if (!changeDraft) return;
    setChangeSubmitting(true);
    setChangeError(null);
    try {
      const result = await requestGmTimeEntryChange({
        sessionId: changeDraft.day.id,
        kind: changeDraft.segment.kind as TimeEntryChangeRequestSourceKind,
        segmentId: changeDraft.segment.id,
        requestedStartTime: changeDraft.startTime,
        requestedEndTime: changeDraft.endTime,
        requestNote: changeDraft.note,
      });
      if (result.request) {
        setTimeRequests((current) => {
          const withoutCurrent = current.filter((request) => request.id !== result.request?.id);
          return [result.request as TimeEntryChangeRequest, ...withoutCurrent];
        });
      }
      setChangeDraft(null);
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : "Änderungsanfrage konnte nicht gesendet werden.");
    } finally {
      setChangeSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen" style={{ position: "relative", backgroundColor: "#f5f5f7", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", paddingBottom: 112 }}>
      <style>{`
        @keyframes gmZeitFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gmZeitSkeletonShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        .gm-zeit-page { animation: gmZeitFadeIn 0.24s ease both; }
        .gm-zeit-skeleton {
          background: linear-gradient(90deg, rgba(15,23,42,0.045), rgba(15,23,42,0.078), rgba(15,23,42,0.045));
          background-size: 220% 100%;
          animation: gmZeitSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .gm-zeit-stats-panel,
        .gm-zeit-week-strip,
        .gm-zeit-main-card {
          background: #ffffff;
          border: 1px solid rgba(15,23,42,0.06);
          border-radius: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .gm-zeit-stats-panel {
          display: grid;
          grid-template-columns: minmax(260px, 0.95fr) minmax(340px, 1.35fr);
          gap: 12px;
          padding: 12px;
        }
        .gm-zeit-stats-primary {
          position: relative;
          border-radius: 12px;
          padding: 16px;
          background: radial-gradient(circle at 92% 4%, rgba(5,150,105,0.14), transparent 34%), linear-gradient(180deg, rgba(5,150,105,0.045), rgba(15,23,42,0.012));
          border: 1px solid rgba(5,150,105,0.12);
        }
        .gm-zeit-stats-secondary {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(176px, 0.78fr);
          gap: 10px;
          min-width: 0;
        }
        .gm-zeit-stat-chip,
        .gm-zeit-stat-mini {
          position: relative;
          border-radius: 12px;
          background: rgba(15,23,42,0.018);
          border: 1px solid rgba(15,23,42,0.055);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.82);
        }
        .gm-zeit-stat-chip {
          padding: 15px;
        }
        .gm-zeit-stat-mini-grid {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
        }
        .gm-zeit-stat-mini {
          padding: 13px 14px;
        }
        .gm-zeit-week-strip {
          margin-top: 12px;
          padding: 14px 16px;
        }
        .gm-zeit-main-card {
          margin-top: 16px;
          overflow: hidden;
        }
        .gm-zeit-day-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(188px, 1.35fr) repeat(5, minmax(70px, 0.72fr)) 18px;
          column-gap: 12px;
          align-items: center;
          padding: 13px 16px;
          border: none;
          background: transparent;
          text-align: left;
          font-family: inherit;
          cursor: pointer;
        }
        .gm-zeit-day-row:hover {
          background: rgba(15,23,42,0.018);
        }
        .gm-zeit-metric-cell {
          min-width: 0;
        }
        .gm-zeit-timeline-row {
          width: 100%;
          min-height: 58px;
          display: flex;
          align-items: stretch;
          gap: 10px;
          border-bottom: 1px solid rgba(15,23,42,0.04);
          border-left: none;
          border-right: none;
          border-top: none;
          background: transparent;
          padding: 0;
          text-align: left;
          font-family: inherit;
          color: inherit;
        }
        .gm-zeit-timeline-row:last-child {
          border-bottom: none;
        }
        .gm-zeit-timeline-row:disabled {
          cursor: default;
        }
        .gm-zeit-timeline-row.is-editable {
          cursor: pointer;
        }
        .gm-zeit-timeline-row.is-editable:hover {
          background: rgba(15,23,42,0.016);
        }
        @media (max-width: 780px) {
          .gm-zeit-stats-panel,
          .gm-zeit-stats-secondary {
            grid-template-columns: 1fr;
          }
          .gm-zeit-stat-mini-grid {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: none;
          }
          .gm-zeit-day-row {
            grid-template-columns: 1fr 18px;
            row-gap: 10px;
          }
          .gm-zeit-day-row > .gm-zeit-metric-cell {
            display: none;
          }
          .gm-zeit-day-row > svg {
            grid-column: 2;
            grid-row: 1;
          }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 420,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.35,
        }}
      >
        <Aurora colorStops={["#F4B4B4", "#DC2626", "#F4B4B4"]} blend={0.6} amplitude={0.8} speed={0.3} />
      </div>

      <div className="gm-zeit-page mx-auto px-6 pt-6 lg:px-10 lg:pt-8" style={{ maxWidth: 960, position: "relative", zIndex: 1 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.62)", marginBottom: 5 }}>
              Zeiterfassung
            </div>
            <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.08, fontWeight: 700, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.94)" }}>
              Meine Zeiten
            </h1>
            <p style={{ margin: "7px 0 0", maxWidth: 440, fontSize: 12, lineHeight: 1.55, fontWeight: 560, color: "rgba(15,23,42,0.48)" }}>
              Arbeitszeit, Kilometer und Tagesverlauf im Überblick.
            </p>
          </div>
          <span style={{ height: 28, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: 999, background: "#ffffff", boxShadow: "0 1px 5px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)", fontSize: 10, fontWeight: 750, color: "rgba(15,23,42,0.48)", whiteSpace: "nowrap" }}>
            <CalendarDays size={12} strokeWidth={2} />
            {selectedRange.label}
          </span>
        </header>

        {loading ? (
          <GmZeitPageSkeleton />
        ) : (
          <>
            <GmZeitStatsPanel stats={stats} />

            <WeeklyProgress sessions={weeklySessions} />

            <section className="gm-zeit-main-card">
              <div style={{ padding: "15px 16px 13px", borderBottom: "1px solid rgba(15,23,42,0.055)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)", marginBottom: 4 }}>
                    Verlauf
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, color: "rgba(15,23,42,0.92)" }}>
                    Meine Tage
                  </div>
                </div>
                <GmZeitSegmentedControl value={range} onChange={setRange} />
              </div>

              {error ? (
                <div style={{ margin: 16, padding: "13px 14px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(220,38,38,0.045)", color: R, fontSize: 11, fontWeight: 750 }}>
                  {error}
                </div>
              ) : days.length > 0 ? (
                <div>
                  {days.map((day, index) => (
                    <GmZeitDayRow
                      key={day.id}
                      day={day}
                      defaultExpanded={index === 0}
                      onRequestChange={openTimeChangeRequest}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ padding: "34px 16px 38px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.72)" }}>Keine Zeiten gefunden</div>
                  <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.38)" }}>
                    Für den gewählten Zeitraum gibt es noch keine abgeschlossenen oder laufenden Tage.
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {changeDraft ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15,23,42,0.22)",
            backdropFilter: "blur(12px)",
          }}
        >
          <section
            style={{
              width: "min(430px, 100%)",
              borderRadius: 20,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#fff",
              boxShadow: "0 24px 70px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.9)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(15,23,42,0.055)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 780, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.62)", marginBottom: 5 }}>
                  Zeitanfrage
                </div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 760, letterSpacing: "-0.02em", color: "rgba(15,23,42,0.92)" }}>
                  Zeit korrigieren
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.5, fontWeight: 600, color: "rgba(15,23,42,0.45)" }}>
                  Deine Änderung wird geprüft. Bis zur Freigabe bleibt der bestehende Eintrag gültig.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangeDraft(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.06)",
                  background: "rgba(15,23,42,0.025)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(15,23,42,0.48)",
                  cursor: "pointer",
                }}
                aria-label="Schließen"
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.06)", background: "rgba(15,23,42,0.018)", padding: 13, marginBottom: 14 }}>
                <div style={{ fontSize: 8, fontWeight: 780, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.32)", marginBottom: 4 }}>
                  {segmentMeta(changeDraft.segment.kind).label} · {changeDraft.day.dateShort}
                </div>
                <div style={{ fontSize: 13, fontWeight: 760, color: "rgba(15,23,42,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {changeDraft.segment.title}
                </div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, fontWeight: 760, color: "rgba(15,23,42,0.54)", fontVariantNumeric: "tabular-nums" }}>
                  <span>Aktuell</span>
                  <span>{changeDraft.segment.start} - {changeDraft.segment.end}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 780, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>Start</span>
                  <input
                    type="time"
                    value={changeDraft.startTime}
                    onChange={(event) => setChangeDraft((current) => current ? { ...current, startTime: event.target.value } : current)}
                    style={{ height: 42, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.025)", padding: "0 12px", fontSize: 14, fontWeight: 760, color: "rgba(15,23,42,0.9)", fontFamily: "inherit" }}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 780, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>Ende</span>
                  <input
                    type="time"
                    value={changeDraft.endTime}
                    onChange={(event) => setChangeDraft((current) => current ? { ...current, endTime: event.target.value } : current)}
                    style={{ height: 42, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.025)", padding: "0 12px", fontSize: 14, fontWeight: 760, color: "rgba(15,23,42,0.9)", fontFamily: "inherit" }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 780, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>Notiz optional</span>
                <textarea
                  value={changeDraft.note}
                  onChange={(event) => setChangeDraft((current) => current ? { ...current, note: event.target.value } : current)}
                  rows={3}
                  placeholder="Warum soll diese Zeit geändert werden?"
                  style={{ resize: "none", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", padding: "11px 12px", fontSize: 12, lineHeight: 1.45, fontWeight: 620, color: "rgba(15,23,42,0.86)", fontFamily: "inherit" }}
                />
              </label>

              {changeError ? (
                <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(220,38,38,0.16)", background: "rgba(220,38,38,0.055)", padding: "10px 12px", color: R, fontSize: 11, fontWeight: 760, lineHeight: 1.45 }}>
                  {changeError}
                </div>
              ) : null}
            </div>

            <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => setChangeDraft(null)}
                disabled={changeSubmitting}
                style={{ height: 40, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", color: "rgba(15,23,42,0.55)", fontSize: 12, fontWeight: 780, fontFamily: "inherit", cursor: "pointer" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void submitTimeChangeRequest()}
                disabled={changeSubmitting}
                style={{ height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.34)", background: "linear-gradient(180deg, #f43f46, #d71920)", color: "#fff", fontSize: 12, fontWeight: 820, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 10px 18px rgba(215,25,32,0.22), inset 0 1px 0 rgba(255,255,255,0.25)" }}
              >
                {changeSubmitting ? <Loader2 size={14} className="animate-spin" style={{ display: "inline", marginRight: 6 }} /> : null}
                Anfrage senden
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={GM_MENU_ITEMS}
          defaultIndex={2}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") {
                window.location.assign("/");
                return;
              }
              router.replace("/");
              router.refresh();
              return;
            }
            if (item.href) {
              router.push(item.href);
            }
          }}
        />
      </div>
    </main>
  );
}
