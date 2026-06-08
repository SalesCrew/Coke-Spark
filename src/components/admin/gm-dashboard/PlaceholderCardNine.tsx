"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { fetchGmUsers, fetchMarkets } from "@/lib/api/backend";
import {
  IppFilterBar,
  type IppFilterState,
  type IppGmOption,
  type IppMarketOption,
} from "@/components/admin/gm-dashboard/IppFilterBar";

type ActivityPeriod = "year" | "month";

type DateRangeFilter = {
  start: string | null;
  end: string | null;
};

const EMPTY_FILTERS: IppFilterState = {
  region: null,
  gmId: null,
  chain: null,
  marketId: null,
  stc: null,
};

const EMPTY_DATE_RANGE: DateRangeFilter = {
  start: null,
  end: null,
};

const CALENDAR_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deriveChainFromMarketName(name: string): string {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token.toUpperCase();
}

function formatMarketLabel(name: string, address?: string | null, postalCode?: string | null, city?: string | null): string {
  const displayName = address?.trim() || name.trim();
  const plzOrt = [postalCode?.trim(), city?.trim()].filter((part): part is string => Boolean(part && part.length > 0)).join(" ");
  if (displayName && plzOrt) return `${displayName} · ${plzOrt}`;
  return displayName || plzOrt || "Unbekannter Markt";
}

function buildMarketSearchText(market: {
  name?: string | null;
  dbName?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  emEh?: string | null;
  currentGmName?: string | null;
}): string {
  return [
    market.name,
    market.dbName,
    market.address,
    market.postalCode,
    market.city,
    market.region,
    market.emEh,
    market.currentGmName,
  ]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(" ");
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function parseMonthKey(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1);
}

function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(parseDateKey(value));
}

function formatMonthLabel(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    month: "long",
    year: "numeric",
  }).format(parseMonthKey(value));
}

function formatDateRangeLabel(range: DateRangeFilter): string {
  if (!range.start) return "";
  if (!range.end || range.end === range.start) return formatDateShort(range.start);
  return `${formatDateShort(range.start)} - ${formatDateShort(range.end)}`;
}

function moveMonth(value: string, delta: number): string {
  const date = parseMonthKey(value);
  date.setMonth(date.getMonth() + delta);
  return formatMonthKey(date);
}

function buildCalendarDays(monthKey: string): Array<{ key: string; label: number; inMonth: boolean }> {
  const monthDate = parseMonthKey(monthKey);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      key: formatDateKey(day),
      label: day.getDate(),
      inMonth: day.getMonth() === month,
    };
  });
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeDonutSegment(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const outerSweepFlag = endAngle > startAngle ? 1 : 0;
  const innerSweepFlag = outerSweepFlag === 1 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${outerSweepFlag} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${innerSweepFlag} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function DateRangeDropdown({
  value,
  onChange,
  minWidth = 186,
}: {
  value: DateRangeFilter;
  onChange: (next: DateRangeFilter) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRangeFilter>(value);
  const [draftMonth, setDraftMonth] = useState(() => formatMonthKey(value.start ? parseDateKey(value.start) : new Date()));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const applied = Boolean(value.start && value.end);
  const draftComplete = Boolean(draftRange.start && draftRange.end);
  const calendarDays = useMemo(() => buildCalendarDays(draftMonth), [draftMonth]);

  useEffect(() => {
    if (!open) return;
    setDraftRange(value);
    setDraftMonth(formatMonthKey(value.start ? parseDateKey(value.start) : new Date()));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleDateClick = (dateKey: string) => {
    setDraftRange((current) => {
      if (!current.start || current.end) return { start: dateKey, end: null };
      if (dateKey === current.start) return current;
      return dateKey < current.start ? { start: dateKey, end: current.start } : { start: current.start, end: dateKey };
    });
  };

  const triggerLabel = applied ? formatDateRangeLabel(value) : "Alle Zeiträume";

  return (
    <div ref={containerRef} style={{ minWidth, position: "relative" }}>
      <style>{`
        .distribution-date-trigger:hover {
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.09) !important;
          transform: translateY(-1px);
        }
        .distribution-date-day:hover {
          background: rgba(0,0,0,0.06) !important;
          color: #111827 !important;
        }
      `}</style>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
        Zeitraum
      </div>
      <button
        className="distribution-date-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(to bottom,#fff,#f5f5f5)",
          color: "#111827",
          fontSize: 11,
          fontWeight: 700,
          padding: "6px 9px",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          cursor: "pointer",
          boxShadow: open
            ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)"
            : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          transition: "all 0.14s ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: applied ? "#111827" : "rgba(0,0,0,0.42)" }}>
          {triggerLabel}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(0,0,0,0.45)", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>
          <Calendar size={11} strokeWidth={1.9} />
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            marginTop: 4,
            width: 292,
            zIndex: 90,
            borderRadius: 11,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "#fff",
            boxShadow: "0 14px 32px rgba(0,0,0,0.15)",
            padding: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              aria-label="Vorheriger Monat"
              onClick={() => setDraftMonth((current) => moveMonth(current, -1))}
              style={{
                width: 25,
                height: 25,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "linear-gradient(to bottom,#fff,#f5f5f6)",
                color: "rgba(15,23,42,0.55)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={13} strokeWidth={2.2} />
            </button>
            <div style={{ fontSize: 12, fontWeight: 850, color: "#111827", textTransform: "capitalize" }}>
              {formatMonthLabel(draftMonth)}
            </div>
            <button
              type="button"
              aria-label="Nächster Monat"
              onClick={() => setDraftMonth((current) => moveMonth(current, 1))}
              style={{
                width: 25,
                height: 25,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "linear-gradient(to bottom,#fff,#f5f5f6)",
                color: "rgba(15,23,42,0.55)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ChevronRight size={13} strokeWidth={2.2} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 3 }}>
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <div key={weekday} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: "rgba(100,116,139,0.58)", padding: "2px 0 4px" }}>
                {weekday}
              </div>
            ))}
            {calendarDays.map((day) => {
              const isStart = day.key === draftRange.start;
              const isEnd = day.key === draftRange.end;
              const inRange = Boolean(draftRange.start && draftRange.end && day.key >= draftRange.start && day.key <= draftRange.end);
              const active = isStart || isEnd;
              return (
                <button
                  key={day.key}
                  className="distribution-date-day"
                  type="button"
                  onClick={() => handleDateClick(day.key)}
                  style={{
                    height: 28,
                    border: active ? "1px solid rgba(220,38,38,0.24)" : "1px solid transparent",
                    borderRadius: active ? 8 : 7,
                    background: active
                      ? "linear-gradient(to bottom,rgba(254,242,242,0.96),rgba(255,255,255,0.92))"
                      : inRange
                        ? "rgba(220,38,38,0.035)"
                        : "transparent",
                    color: active ? "#B91C1C" : day.inMonth ? "#111827" : "rgba(100,116,139,0.30)",
                    fontSize: 10,
                    fontWeight: active ? 850 : inRange ? 800 : 700,
                    cursor: "pointer",
                    boxShadow: active ? "inset 0 1px 0.6px rgba(255,255,255,0.92), 0 1px 4px rgba(220,38,38,0.08)" : "none",
                    boxSizing: "border-box",
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                onChange(EMPTY_DATE_RANGE);
                setDraftRange(EMPTY_DATE_RANGE);
                setOpen(false);
              }}
              disabled={!value.start && !draftRange.start}
              style={{
                border: "none",
                borderRadius: 8,
                background: "rgba(0,0,0,0.05)",
                color: "rgba(15,23,42,0.58)",
                fontSize: 10,
                fontWeight: 800,
                padding: "7px 10px",
                cursor: value.start || draftRange.start ? "pointer" : "not-allowed",
                opacity: value.start || draftRange.start ? 1 : 0.55,
              }}
            >
              Zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => {
                if (!draftRange.start || !draftRange.end) return;
                onChange(draftRange);
                setOpen(false);
              }}
              disabled={!draftComplete}
              style={{
                border: "none",
                borderRadius: 8,
                background: draftComplete ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(220,38,38,0.28)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 850,
                padding: "7px 10px",
                cursor: draftComplete ? "pointer" : "not-allowed",
                opacity: draftComplete ? 1 : 0.55,
                boxShadow: draftComplete ? "inset 0 1px 0.6px rgba(255,255,255,0.30), 0 6px 14px rgba(220,38,38,0.14)" : "none",
              }}
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlaceholderCardNine() {
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("year");
  const [dateRange, setDateRange] = useState<DateRangeFilter>(EMPTY_DATE_RANGE);
  const [filters, setFilters] = useState<IppFilterState>(EMPTY_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [markets, setMarkets] = useState<IppMarketOption[]>([]);
  const [gms, setGms] = useState<IppGmOption[]>([]);
  const [filterSourcesLoaded, setFilterSourcesLoaded] = useState(false);
  const [filterSourcesLoading, setFilterSourcesLoading] = useState(false);
  const [filterLoadError, setFilterLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!filterModalOpen || filterSourcesLoaded) return;
    let cancelled = false;
    setFilterSourcesLoading(true);
    setFilterLoadError(null);
    void Promise.all([fetchMarkets(), fetchGmUsers()])
      .then(([marketRows, gmRows]) => {
        if (cancelled) return;
        setMarkets(
          marketRows
            .filter((market) => !market.isDeleted)
            .map((market) => ({
              id: market.id,
              label: formatMarketLabel(market.name, market.address, market.postalCode, market.city),
              region: market.region || "Unbekannt",
              gmName: market.currentGmName || "",
              chain: deriveChainFromMarketName(market.name),
              searchText: buildMarketSearchText(market),
            }))
            .sort((left, right) => left.label.localeCompare(right.label, "de")),
        );
        setGms(
          gmRows
            .map((gm) => ({
              id: gm.id,
              label: `${gm.firstName} ${gm.lastName}`.trim(),
              region: gm.region || "Unbekannt",
            }))
            .sort((left, right) => left.label.localeCompare(right.label, "de")),
        );
        setFilterSourcesLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setFilterLoadError(error instanceof Error ? error.message : "Filterdaten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setFilterSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterModalOpen, filterSourcesLoaded]);

  const regionOptions = useMemo(() => {
    const unique = new Set(markets.map((market) => market.region).filter(Boolean));
    return Array.from(unique).sort((left, right) => left.localeCompare(right, "de"));
  }, [markets]);

  const dateRangeActive = Boolean(dateRange.start && dateRange.end);
  const selectedDateRangeLabel = dateRangeActive ? formatDateRangeLabel(dateRange) : "";
  const dateRangeDays =
    dateRange.start && dateRange.end
      ? Math.max(1, Math.round((parseDateKey(dateRange.end).getTime() - parseDateKey(dateRange.start).getTime()) / 86_400_000) + 1)
      : null;
  const dateWindowScale = dateRangeActive && dateRangeDays ? clamp(dateRangeDays / 365, 0.08, 1) : 1;
  const standardFilterCount = [filters.region, filters.gmId, filters.chain, filters.marketId, filters.stc].filter((value) => value != null).length;
  const activeFilterCount = standardFilterCount + (dateRangeActive ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
  const filterScale = hasActiveFilters ? clamp((1 - standardFilterCount * 0.13 - (filters.marketId ? 0.08 : 0)) * dateWindowScale, dateRangeActive ? 0.08 : 0.32, 1) : 1;
  const stcBias = filters.stc === "gold" ? 4 : filters.stc === "silver" ? 1 : filters.stc === "bronze" ? -3 : 0;
  const standartShare = clamp(63 + activeFilterCount * 1.8 + stcBias - (dateRangeActive ? 1 : 0), 42, 88);
  const flexShare = 100 - standartShare;
  const totalVisits = Math.max(hasActiveFilters ? 8 : 0, Math.round(138 * filterScale));
  const standartVisits = Math.round(totalVisits * (standartShare / 100));
  const flexVisits = Math.max(0, totalVisits - standartVisits);
  const activityMetricsByPeriod = {
    year: {
      redSurveyCount: 54,
      redSurveyShare: 39,
      visitCount: 138,
      visitBarShare: 84,
      averageVisitDuration: "38 min",
    },
    month: {
      redSurveyCount: 12,
      redSurveyShare: 48,
      visitCount: 28,
      visitBarShare: 62,
      averageVisitDuration: "34 min",
    },
  };
  const baseActivityMetrics = dateRangeActive ? activityMetricsByPeriod.year : activityMetricsByPeriod[activityPeriod];
  const activityMetrics = {
    redSurveyCount: Math.max(hasActiveFilters ? 2 : 0, Math.round(baseActivityMetrics.redSurveyCount * filterScale)),
    redSurveyShare: clamp(baseActivityMetrics.redSurveyShare + activeFilterCount * 2.2 + stcBias, 8, 92),
    visitCount: totalVisits,
    visitBarShare: clamp(baseActivityMetrics.visitBarShare - activeFilterCount * 5 + stcBias, 16, 94),
    averageVisitDuration: `${Math.max(18, Number.parseInt(baseActivityMetrics.averageVisitDuration, 10) - activeFilterCount * 2 + (filters.marketId ? 1 : 0))} min`,
  };
  const activityDotPatternId = "placeholder-nine-activity-dot-pattern";
  const gaugeStart = 180;
  const gaugeEnd = 360;
  const splitAngle = gaugeStart + (gaugeEnd - gaugeStart) * (standartShare / 100);
  const segmentGap = 4;
  const leftEnd = Math.max(gaugeStart, splitAngle - segmentGap / 2);
  const rightStart = Math.min(gaugeEnd, splitAngle + segmentGap / 2);

  return (
    <section
      style={{
        background: "rgba(0,0,0,0.025)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14,
        padding: 10,
        minHeight: 360,
        height: "100%",
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "10px 14px 12px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.75)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Verteilung
          </div>
          <button
            type="button"
            aria-label="Filter öffnen"
            onClick={() => setFilterModalOpen(true)}
            style={{
              position: "relative",
              width: 26,
              height: 26,
              borderRadius: 8,
              border: hasActiveFilters ? "1px solid rgba(220,38,38,0.28)" : "1px solid rgba(0,0,0,0.08)",
              background: hasActiveFilters ? "linear-gradient(to bottom,#fff7f7,#fff)" : "linear-gradient(to bottom,#fff,#f6f6f7)",
              color: hasActiveFilters ? "#DC2626" : "rgba(15,23,42,0.48)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: hasActiveFilters
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(220,38,38,0.10), 0 4px 12px rgba(220,38,38,0.12)"
                : "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.06)",
              transition: "all 0.16s ease",
            }}
          >
            <Filter size={13} strokeWidth={2.1} />
            {hasActiveFilters && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: 5,
                  top: 5,
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "#DC2626",
                  boxShadow: "0 0 0 2px #fff",
                }}
              />
            )}
          </button>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignSelf: "center",
            margin: "0 auto",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <svg viewBox="0 0 360 160" width="100%" height={160} style={{ display: "block" }}>
            <path
              d={describeDonutSegment(180, 146, 123, 93, gaugeStart, leftEnd)}
              fill="rgba(239,68,68,0.14)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <path
              d={describeDonutSegment(180, 146, 123, 93, rightStart, gaugeEnd)}
              fill="rgba(239,68,68,0.08)"
              stroke="#ef4444"
              strokeWidth={2}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 28,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1,
                background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 62%, #EF4444 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {totalVisits}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Gesamt
            </span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: 0 }}>
          <div
            style={{
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              padding: "10px 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Standart Visit</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{standartShare.toFixed(1).replace(".", ",")}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 2 }}>{standartVisits} Fälle</div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(220,38,38,0.45)", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Flex Visit</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{flexShare.toFixed(1).replace(".", ",")}%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 2 }}>{flexVisits} Fälle</div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 26,
          }}
        >
          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.06)",
              paddingTop: 16,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 750, color: "rgba(100,116,139,0.72)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Aktivität
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(0,0,0,0.03)",
                  padding: 2,
                }}
              >
                {dateRangeActive ? (
                  <span
                    style={{
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 10,
                      fontWeight: 850,
                      lineHeight: 1,
                      color: "#111827",
                      background: "linear-gradient(to bottom,#fff,#f4f4f5)",
                      boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedDateRangeLabel}
                  </span>
                ) : ([
                  { id: "year" as const, label: "Jährl.", ariaLabel: "Jährlich anzeigen" },
                  { id: "month" as const, label: "Monatl.", ariaLabel: "Monatlich anzeigen" },
                ].map((option) => {
                  const active = activityPeriod === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={option.ariaLabel}
                      onClick={() => setActivityPeriod(option.id)}
                      style={{
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 7px",
                        fontFamily: "inherit",
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: active ? "#1f2937" : "rgba(0,0,0,0.56)",
                        background: active ? "linear-gradient(to bottom,#fff,#f4f4f5)" : "transparent",
                        boxShadow: active ? "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08)" : "none",
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                }))}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.58)", lineHeight: 1 }}>
                  Ø Besuchsdauer
                </div>
                <div style={{ fontSize: 13, fontWeight: 850, color: "#111827", lineHeight: 1.15, marginTop: 3 }}>
                  {activityMetrics.averageVisitDuration}
                </div>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "1fr 1px 1fr",
                alignItems: "stretch",
                gap: 18,
                minHeight: 190,
                borderRadius: 10,
                overflow: "hidden",
                isolation: "isolate",
              }}
            >
              <svg
                aria-hidden="true"
                width="100%"
                height="100%"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <pattern id={activityDotPatternId} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="1.8" cy="1.8" r="0.72" fill="rgba(0,0,0,0.22)" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill={`url(#${activityDotPatternId})`} opacity={0.46} />
              </svg>
              <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "66px minmax(0,1fr)", alignItems: "end", gap: 14 }}>
                <div
                  style={{
                    height: 152,
                    borderRadius: 7,
                    border: "1.5px solid rgba(220,38,38,0.32)",
                    background: "rgba(220,38,38,0.06)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 3,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${activityMetrics.redSurveyShare}%`,
                      borderRadius: 5,
                      border: "1.5px solid rgba(220,38,38,0.82)",
                      background: "rgba(220,38,38,0.34)",
                      boxShadow: "0 8px 16px rgba(220,38,38,0.10)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ paddingBottom: 2 }}>
                  <div style={{ fontSize: 20, fontWeight: 850, color: "#DC2626", lineHeight: 1 }}>
                    {activityMetrics.redSurveyCount}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#111827", marginTop: 6, lineHeight: 1.2 }}>
                    RedSurvey
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 3 }}>
                    {activityMetrics.redSurveyShare.toFixed(1).replace(".", ",")}% Anteil
                  </div>
                </div>
              </div>

              <div style={{ position: "relative", zIndex: 1, width: 1, background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.08), transparent)" }} />

              <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "minmax(0,1fr) 66px", alignItems: "end", gap: 14 }}>
                <div style={{ paddingBottom: 2, textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 850, color: "#2563EB", lineHeight: 1 }}>
                    {activityMetrics.visitCount}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#111827", marginTop: 6, lineHeight: 1.2 }}>
                    Visits
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 3 }}>
                    Gesamtfälle
                  </div>
                </div>
                <div
                  style={{
                    height: 152,
                    borderRadius: 7,
                    border: "1.5px solid rgba(37,99,235,0.30)",
                    background: "rgba(37,99,235,0.06)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 3,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${activityMetrics.visitBarShare}%`,
                      borderRadius: 5,
                      border: "1.5px solid rgba(37,99,235,0.82)",
                      background: "rgba(37,99,235,0.34)",
                      boxShadow: "0 8px 16px rgba(37,99,235,0.10)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {filterModalOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFilterModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15,23,42,0.20)",
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Verteilung Filter"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(760px, calc(100vw - 28px))",
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "linear-gradient(180deg,#ffffff 0%,#fbfbfc 100%)",
              boxShadow: "0 24px 70px rgba(15,23,42,0.24), inset 0 1px 0.6px rgba(255,255,255,0.95)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(100,116,139,0.70)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Verteilung filtern
                </div>
                <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 850, color: "#111827", lineHeight: 1 }}>
                    Aktivität & Visits
                  </span>
                  <span
                    style={{
                      borderRadius: 999,
                      border: hasActiveFilters ? "1px solid rgba(220,38,38,0.20)" : "1px solid rgba(0,0,0,0.07)",
                      background: hasActiveFilters ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.035)",
                      color: hasActiveFilters ? "#DC2626" : "rgba(100,116,139,0.72)",
                      padding: "4px 8px",
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {hasActiveFilters ? `${activeFilterCount} aktiv` : "Alle Daten"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Filter schließen"
                onClick={() => setFilterModalOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "linear-gradient(to bottom,#fff,#f5f5f6)",
                  color: "rgba(15,23,42,0.55)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>

            <div
              style={{
                borderRadius: 13,
                border: "1px solid rgba(0,0,0,0.06)",
                background: "#fff",
                boxShadow: "0 1px 7px rgba(0,0,0,0.05)",
                padding: 10,
                overflow: "visible",
              }}
            >
              {filterLoadError && (
                <div style={{ borderRadius: 9, border: "1px solid rgba(185,28,28,0.24)", background: "rgba(185,28,28,0.07)", color: "#991b1b", padding: "8px 10px", fontSize: 11, fontWeight: 750, marginBottom: 10 }}>
                  {filterLoadError}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <DateRangeDropdown value={dateRange} onChange={setDateRange} />
                <button
                  className="ipp-reset-filters-btn"
                  type="button"
                  onClick={() => {
                    setDateRange(EMPTY_DATE_RANGE);
                    setFilters(EMPTY_FILTERS);
                  }}
                  disabled={!hasActiveFilters}
                  style={{
                    borderRadius: 7,
                    border: "none",
                    background: hasActiveFilters ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(220,38,38,0.28)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "7px 10px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    cursor: hasActiveFilters ? "pointer" : "not-allowed",
                    opacity: hasActiveFilters ? 1 : 0.55,
                    boxShadow: hasActiveFilters
                      ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)"
                      : "none",
                    transition: "all 0.16s ease",
                  }}
                >
                  Alle Filter zurücksetzen
                </button>
              </div>
              <IppFilterBar
                filters={filters}
                regions={regionOptions}
                gms={gms}
                markets={markets}
                onChange={setFilters}
                showReset={false}
              />
              {filterSourcesLoading && (
                <div style={{ marginTop: 9, fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)" }}>
                  Filterquellen werden geladen...
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                style={{
                  border: "none",
                  borderRadius: 9,
                  background: "linear-gradient(to bottom,#111827,#020617)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 850,
                  padding: "8px 13px",
                  cursor: "pointer",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(2,6,23,0.72), 0 1px 6px rgba(15,23,42,0.28)",
                }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
