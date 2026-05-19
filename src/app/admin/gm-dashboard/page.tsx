"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  MapPin,
  Minus,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type DateRange = "Heute" | "Woche" | "Monat" | "Quartal";
type PageState = "loading" | "ready" | "error" | "empty";
type MapStatus = "visited" | "planned" | "overdue";

interface FilterState {
  dateRange: DateRange;
  gm: string;
  campaign: string;
  region: string;
  status: string;
}

interface VisitDonutSegment {
  key: "standard" | "flex" | "kuehler";
  label: string;
  count: number;
  color: string;
}

interface ChartCardShellProps {
  title: string;
  count?: string;
  controls?: React.ReactNode;
  legend?: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

interface MapPoint {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  status: MapStatus;
}

const TOKENS = {
  color: {
    pageBg: "#f5f5f7",
    cardBg: "#ffffff",
    cardBorder: "rgba(0,0,0,0.07)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.04)",
    textPrimary: "#1a1a1a",
    textSecondary: "rgba(0,0,0,0.55)",
    textMuted: "rgba(0,0,0,0.35)",
    label: "rgba(0,0,0,0.28)",
    red: "#DC2626",
    redDark: "#b91c1c",
    success: "#16a34a",
    warning: "#f59e0b",
    blue: "#3A9DDF",
    cyan: "#7EDCFF",
    yellow: "#F2D335",
    purple: "#8b5cf6",
    lineBlue: "#3B82F6",
    lineOrange: "#F59E0B",
    lineGreen: "#22c55e",
    lineViolet: "#8b5cf6",
  },
  radius: {
    card: 14,
    inner: 10,
    control: 8,
    chip: 999,
  },
  spacing: {
    cardPadding: 18,
    sectionGap: 14,
  },
};

const DASHBOARD_CSS = `
@keyframes gmFadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes gmShimmer {
  0% { opacity: .55; }
  50% { opacity: 1; }
  100% { opacity: .55; }
}
@keyframes gmCountIn {
  from { opacity: .45; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}
.gm-anim {
  animation: gmFadeUp .36s cubic-bezier(0.4,0,0.2,1) both;
}
.gm-skeleton {
  animation: gmShimmer 1.25s ease-in-out infinite;
}
.gm-chart-surface {
  background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0);
  background-size: 16px 16px;
}
.gm-kpi-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.gm-row-a {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
  gap: 14px;
}
.gm-row-b {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 14px;
}
.gm-row-c {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 14px;
}
.gm-row-d {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
  gap: 14px;
}
@media (max-width: 1400px) {
  .gm-kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1180px) {
  .gm-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gm-row-a, .gm-row-b, .gm-row-c, .gm-row-d { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .gm-kpi-row { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .gm-anim { animation: none !important; }
  * {
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }
}
`;

const TEMP_GMS = [
  "Alle GMs",
  "Thomas Huber",
  "Anna Gruber",
  "Markus Steiner",
  "Lisa Wagner",
  "Michael Berger",
];
const TEMP_CAMPAIGNS = [
  "Alle Kampagnen",
  "Q2 Frühjahr 2026",
  "RED Month April",
  "Sommerlinie 2026",
];
const TEMP_REGIONS = [
  "Alle Regionen",
  "Wien",
  "Graz",
  "Linz",
  "Salzburg",
  "Klagenfurt",
];
const TEMP_STATUSES = ["Alle Status", "Geplant", "Laufend", "Abgeschlossen", "Überfällig"];
const DATE_RANGES: DateRange[] = ["Heute", "Woche", "Monat", "Quartal"];

const TEMP_KPI = {
  visitCompletionPct: 78,
  visitsDone: 312,
  visitsTarget: 400,
  ippCurrent: 5.4,
  ippDelta: 0.3,
  trackedHours: 148.5,
  dataQualityPct: 91,
};

const TEMP_VISIT_DONUT: VisitDonutSegment[] = [
  { key: "standard", label: "Standardbesuche", count: 680, color: TOKENS.color.blue },
  { key: "flex", label: "Flexbesuche", count: 270, color: TOKENS.color.cyan },
  { key: "kuehler", label: "Kühlerinventuren", count: 73, color: TOKENS.color.yellow },
];

const TEMP_IPP_SERIES = [
  { period: "KW 17", ipp: 5.1, baseline: 4.7, display: 4.5 },
  { period: "KW 18", ipp: 5.2, baseline: 4.7, display: 4.6 },
  { period: "KW 19", ipp: 5.4, baseline: 4.8, display: 4.6 },
  { period: "KW 20", ipp: 5.3, baseline: 4.7, display: 4.5 },
  { period: "KW 21", ipp: 5.5, baseline: 4.8, display: 4.7 },
  { period: "KW 22", ipp: 5.6, baseline: 4.9, display: 4.7 },
  { period: "KW 23", ipp: 5.5, baseline: 4.9, display: 4.8 },
  { period: "KW 24", ipp: 5.7, baseline: 5.0, display: 4.9 },
  { period: "KW 25", ipp: 5.8, baseline: 5.0, display: 4.9 },
  { period: "KW 26", ipp: 5.7, baseline: 5.1, display: 4.8 },
  { period: "KW 27", ipp: 5.9, baseline: 5.1, display: 4.9 },
  { period: "KW 28", ipp: 6.0, baseline: 5.2, display: 5.0 },
];

const TEMP_CATEGORY_SERIES = [
  { label: "Cooler", color: TOKENS.color.red, values: [72, 69, 75, 71, 74, 77, 76, 79, 78, 76, 81, 83] },
  { label: "SingleServe", color: TOKENS.color.lineBlue, values: [68, 70, 66, 69, 71, 73, 72, 74, 75, 73, 76, 78] },
  { label: "MultiServe", color: TOKENS.color.lineViolet, values: [64, 63, 65, 66, 67, 69, 68, 70, 71, 69, 72, 73] },
  { label: "Promos", color: TOKENS.color.lineOrange, values: [58, 61, 59, 62, 64, 63, 65, 67, 66, 65, 68, 70] },
  { label: "Warehouse", color: TOKENS.color.lineGreen, values: [74, 73, 75, 76, 77, 78, 77, 79, 81, 80, 82, 84] },
];
const TEMP_X_LABELS = TEMP_IPP_SERIES.map((item) => item.period);

const TEMP_MAP_POINTS: MapPoint[] = [
  { id: "m1", name: "Billa Mariahilf", region: "Wien", x: 340, y: 70, status: "visited" },
  { id: "m2", name: "Spar Wien Nord", region: "Wien", x: 355, y: 56, status: "visited" },
  { id: "m3", name: "Hofer Wien Süd", region: "Wien", x: 351, y: 84, status: "planned" },
  { id: "m4", name: "Merkur Burgenland", region: "Burgenland", x: 372, y: 84, status: "visited" },
  { id: "m5", name: "Spar Graz Hauptplatz", region: "Graz", x: 284, y: 136, status: "visited" },
  { id: "m6", name: "Billa Graz West", region: "Graz", x: 272, y: 144, status: "visited" },
  { id: "m7", name: "Hofer Graz Süd", region: "Graz", x: 295, y: 147, status: "planned" },
  { id: "m8", name: "Merkur Linz Center", region: "Linz", x: 224, y: 66, status: "visited" },
  { id: "m9", name: "Billa Linz Nord", region: "Linz", x: 238, y: 58, status: "overdue" },
  { id: "m10", name: "Spar Salzburg Getreideg.", region: "Salzburg", x: 170, y: 96, status: "visited" },
  { id: "m11", name: "Billa Salzburg Rainerstr.", region: "Salzburg", x: 182, y: 103, status: "visited" },
  { id: "m12", name: "Spar Klagenfurt", region: "Klagenfurt", x: 248, y: 162, status: "visited" },
  { id: "m13", name: "Hofer Innsbruck", region: "Tirol", x: 126, y: 112, status: "planned" },
  { id: "m14", name: "Billa Innsbruck", region: "Tirol", x: 139, y: 105, status: "visited" },
  { id: "m15", name: "Spar Wels", region: "Oberösterreich", x: 210, y: 76, status: "visited" },
  { id: "m16", name: "Merkur St. Pölten", region: "Niederösterreich", x: 309, y: 73, status: "overdue" },
];

const TEMP_DAILY = {
  daysStarted: 18,
  daysEnded: 16,
  missingKmStart: 3,
  missingKmEnd: 4,
  avgPauseMin: 27,
  streak: 5,
};

const TEMP_MARKET_RANKING = [
  { name: "Billa Wien Mariahilf", ipp: 7.2, visits: 4, quality: 96 },
  { name: "Spar Graz Hauptplatz", ipp: 6.9, visits: 3, quality: 93 },
  { name: "Merkur Linz Center", ipp: 6.7, visits: 5, quality: 90 },
  { name: "Spar Salzburg Getreideg.", ipp: 6.4, visits: 3, quality: 88 },
  { name: "Billa Innsbruck", ipp: 6.1, visits: 2, quality: 85 },
  { name: "Billa Linz Nord", ipp: 4.8, visits: 1, quality: 61 },
  { name: "Merkur St. Pölten", ipp: 4.4, visits: 1, quality: 54 },
  { name: "Hofer Innsbruck", ipp: 4.1, visits: 0, quality: 0 },
];

const TEMP_CAMPAIGNS_TABLE = [
  { name: "Q2 Frühjahr 2026", markets: 40, target: 60, done: 42, quality: 88 },
  { name: "RED Month April", markets: 18, target: 36, done: 28, quality: 91 },
  { name: "Sommerlinie 2026", markets: 25, target: 25, done: 8, quality: 72 },
];

const TEMP_TIME_TRACKING = {
  totalH: 148.5,
  marketWorkH: 110.2,
  zusatzH: 38.3,
  submitted: 82,
  draft: 18,
};

const DEFAULT_FILTERS: FilterState = {
  dateRange: "Monat",
  gm: "Alle GMs",
  campaign: "Alle Kampagnen",
  region: "Alle Regionen",
  status: "Alle Status",
};

function withComma(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function useCountUp(value: number, durationMs = 800): number {
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    const startVal = current;
    const startTs = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const progress = Math.min((now - startTs) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + (value - startVal) * eased;
      setCurrent(next);
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [value]);

  return current;
}

function useStaggerStyle(index: number): React.CSSProperties {
  return { animationDelay: `${index * 55}ms` };
}

function Skeleton({
  width,
  height,
  radius = 8,
}: {
  width: string | number;
  height: number;
  radius?: number;
}) {
  return (
    <div
      className="gm-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        background: "rgba(0,0,0,0.08)",
      }}
    />
  );
}

function FilterSelect({
  id,
  value,
  options,
  icon,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  icon?: React.ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const listId = `${id}-listbox`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: TOKENS.radius.control,
          border: "1px solid rgba(0,0,0,0.1)",
          background: open ? "rgba(0,0,0,0.03)" : "#fff",
          color: TOKENS.color.textPrimary,
          fontSize: 11,
          fontWeight: 500,
          padding: "0 10px 0 8px",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {icon ? <span style={{ color: TOKENS.color.textMuted }}>{icon}</span> : null}
        <span style={{ maxWidth: 126, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        <ChevronDown
          size={10}
          strokeWidth={2}
          color="rgba(0,0,0,0.4)"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="gm-anim"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            zIndex: 50,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 9,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            padding: 4,
          }}
        >
          {options.map((option) => (
            <button
              key={option}
              role="option"
              aria-selected={value === option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 6,
                textAlign: "left",
                padding: "6px 10px",
                background: value === option ? "rgba(220,38,38,0.08)" : "transparent",
                color: value === option ? TOKENS.color.red : "#374151",
                fontWeight: value === option ? 600 : 500,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DateRangeTabs({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.05)", borderRadius: 9, padding: 2 }}>
      {DATE_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          style={{
            border: "none",
            borderRadius: 7,
            padding: "4px 11px",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            background: value === range ? "#fff" : "transparent",
            color: value === range ? TOKENS.color.textPrimary : "rgba(0,0,0,0.45)",
            boxShadow: value === range ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

function ChartCardShell({
  title,
  count,
  controls,
  legend,
  footer,
  style,
  children,
}: ChartCardShellProps) {
  return (
    <div
      className="gm-anim"
      style={{
        background: TOKENS.color.cardBg,
        borderRadius: TOKENS.radius.card,
        border: `1px solid ${TOKENS.color.cardBorder}`,
        boxShadow: TOKENS.color.cardShadow,
        padding: TOKENS.spacing.cardPadding,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: TOKENS.color.label,
            }}
          >
            {title}
          </div>
          {count ? (
            <div style={{ marginTop: 4, fontSize: 9.5, fontWeight: 600, color: TOKENS.color.textMuted }}>
              {count}
            </div>
          ) : null}
        </div>
        {controls}
      </div>
      <div
        className="gm-chart-surface"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: TOKENS.radius.inner,
          backgroundColor: "rgba(0,0,0,0.015)",
          padding: 12,
        }}
      >
        {children}
      </div>
      {legend ? <div style={{ marginTop: 10 }}>{legend}</div> : null}
      {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  delta,
  icon,
  color,
  loading,
  index,
}: {
  label: string;
  value: number;
  helper: string;
  delta?: number;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
  index: number;
}) {
  const shown = useCountUp(value);

  if (loading) {
    return (
      <div style={{ borderRadius: TOKENS.radius.card, border: `1px solid ${TOKENS.color.cardBorder}`, background: "#fff", padding: 16 }}>
        <Skeleton width={88} height={8} />
        <div style={{ marginTop: 10 }}><Skeleton width={72} height={25} /></div>
        <div style={{ marginTop: 8 }}><Skeleton width={120} height={7} /></div>
      </div>
    );
  }

  return (
    <div
      className="gm-anim"
      style={{
        ...useStaggerStyle(index),
        borderRadius: TOKENS.radius.card,
        border: `1px solid ${TOKENS.color.cardBorder}`,
        background: "#fff",
        boxShadow: TOKENS.color.cardShadow,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TOKENS.color.label }}>{label}</span>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: `${color}1a`, display: "inline-flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: TOKENS.color.textPrimary, fontVariantNumeric: "tabular-nums", lineHeight: 1, animation: "gmCountIn 220ms ease both" }}>
        {Number.isInteger(value) ? Math.round(shown) : shown.toFixed(1).replace(".", ",")}
      </div>
      <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 7 }}>
        {delta != null ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: delta > 0 ? TOKENS.color.success : delta < 0 ? TOKENS.color.red : TOKENS.color.textMuted,
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {delta > 0 ? "+" : ""}{withComma(Math.abs(delta))}
          </span>
        ) : null}
        <span style={{ fontSize: 9.5, color: TOKENS.color.textMuted, fontWeight: 500 }}>{helper}</span>
      </div>
    </div>
  );
}

function DonutVisitChart({ loading }: { loading: boolean }) {
  const total = TEMP_VISIT_DONUT.reduce((acc, item) => acc + item.count, 0);
  const center = `IPP ${withComma(TEMP_KPI.ippCurrent)}`;
  const size = 238;
  const cx = size / 2;
  const outer = 89;
  const inner = 59;
  const gap = 0.03;

  if (loading) {
    return (
      <ChartCardShell title="Dashboard Piechart" count="1023 Visits">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 14, alignItems: "center" }}>
          <Skeleton width="100%" height={136} />
          <Skeleton width={220} height={220} radius={110} />
        </div>
      </ChartCardShell>
    );
  }

  let running = -Math.PI / 2;
  const arcs = TEMP_VISIT_DONUT.map((segment) => {
    const slice = (segment.count / total) * Math.PI * 2;
    const start = running + gap;
    const end = running + slice - gap;
    running += slice;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + outer * Math.cos(start);
    const y1 = cx + outer * Math.sin(start);
    const x2 = cx + outer * Math.cos(end);
    const y2 = cx + outer * Math.sin(end);
    const xi1 = cx + inner * Math.cos(end);
    const yi1 = cx + inner * Math.sin(end);
    const xi2 = cx + inner * Math.cos(start);
    const yi2 = cx + inner * Math.sin(start);
    return {
      ...segment,
      path: `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`,
    };
  });

  return (
    <ChartCardShell title="Dashboard Piechart" count={`${total} Visits`}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 240px", gap: 16, alignItems: "center" }}>
        <div style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "#fff", padding: 10 }}>
          {TEMP_VISIT_DONUT.map((segment) => (
            <div key={segment.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: segment.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: TOKENS.color.textSecondary, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{segment.label}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: TOKENS.color.blue, fontVariantNumeric: "tabular-nums" }}>{segment.count}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 9, color: TOKENS.color.textMuted, textAlign: "center", fontWeight: 600, letterSpacing: "0.04em" }}>
            • {total} VISITS
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cx} r={outer} fill="#fff" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
            {arcs.map((arc) => (
              <path key={arc.key} d={arc.path} fill={arc.color}>
                <title>{arc.label}: {arc.count}</title>
              </path>
            ))}
            <circle cx={cx} cy={cx} r={inner - 1} fill="#fff" />
            <text x={cx} y={cx + 8} textAnchor="middle" fill={TOKENS.color.success} style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em" }}>
              {center}
            </text>
          </svg>
        </div>
      </div>
    </ChartCardShell>
  );
}

function IppTrendChart({ loading }: { loading: boolean }) {
  const [interval, setInterval] = useState<"täglich" | "wöchentlich" | "monatlich">("wöchentlich");
  const gradientId = useId().replace(/:/g, "");
  const width = 760;
  const height = 220;
  const padL = 34;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const values = TEMP_IPP_SERIES.map((p) => p.ipp);
  const minVal = Math.min(...values, ...TEMP_IPP_SERIES.map((p) => p.baseline), ...TEMP_IPP_SERIES.map((p) => p.display)) - 0.25;
  const maxVal = Math.max(...values, ...TEMP_IPP_SERIES.map((p) => p.baseline), ...TEMP_IPP_SERIES.map((p) => p.display)) + 0.2;
  const toX = (i: number) => padL + (i / Math.max(1, TEMP_IPP_SERIES.length - 1)) * plotW;
  const toY = (v: number) => padT + plotH - ((v - minVal) / Math.max(0.0001, maxVal - minVal)) * plotH;
  const buildPath = (arr: number[]) =>
    arr.map((value, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(value)}`).join(" ");

  if (loading) {
    return (
      <ChartCardShell title="IPP-Werte im Zeitverlauf">
        <Skeleton width="100%" height={168} />
      </ChartCardShell>
    );
  }

  const mainPath = buildPath(TEMP_IPP_SERIES.map((p) => p.ipp));
  const baselinePath = buildPath(TEMP_IPP_SERIES.map((p) => p.baseline));
  const displayPath = buildPath(TEMP_IPP_SERIES.map((p) => p.display));
  const area = `${mainPath} L ${toX(TEMP_IPP_SERIES.length - 1)} ${toY(minVal)} L ${toX(0)} ${toY(minVal)} Z`;
  const yTicks = [minVal, minVal + (maxVal - minVal) * 0.33, minVal + (maxVal - minVal) * 0.66, maxVal];

  return (
    <ChartCardShell
      title="IPP-Werte im Zeitverlauf"
      controls={
        <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.05)", borderRadius: 7, padding: 2 }}>
          {(["täglich", "wöchentlich", "monatlich"] as const).map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => setInterval(step)}
              style={{
                border: "none",
                borderRadius: 5,
                padding: "3px 8px",
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                background: interval === step ? "#fff" : "transparent",
                color: interval === step ? TOKENS.color.textPrimary : TOKENS.color.textMuted,
                boxShadow: interval === step ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
                fontFamily: "inherit",
              }}
            >
              {step[0].toUpperCase() + step.slice(1)}
            </button>
          ))}
        </div>
      }
      legend={
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
          {[
            { label: "IPP-Werte", color: TOKENS.color.lineGreen },
            { label: "Schnitten", color: TOKENS.color.red },
            { label: "Displays", color: TOKENS.color.lineBlue },
          ].map((item) => (
            <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 2.5, borderRadius: 2, background: item.color }} />
              <span style={{ fontSize: 9.5, color: TOKENS.color.textSecondary }}>{item.label}</span>
            </span>
          ))}
        </div>
      }
    >
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`ippArea-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TOKENS.color.lineGreen} stopOpacity={0.22} />
            <stop offset="100%" stopColor={TOKENS.color.lineGreen} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line x1={padL} y1={toY(tick)} x2={width - padR} y2={toY(tick)} stroke="rgba(0,0,0,0.06)" strokeDasharray="3 3" />
            <text x={padL - 6} y={toY(tick) + 4} textAnchor="end" style={{ fontSize: 8, fill: "rgba(0,0,0,0.3)" }}>
              {withComma(tick)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#ippArea-${gradientId})`} />
        <path d={mainPath} fill="none" stroke={TOKENS.color.lineGreen} strokeWidth={2.2} />
        <path d={baselinePath} fill="none" stroke={TOKENS.color.red} strokeWidth={1.6} opacity={0.85} />
        <path d={displayPath} fill="none" stroke={TOKENS.color.lineBlue} strokeWidth={1.6} opacity={0.82} />
        {TEMP_IPP_SERIES.map((point, idx) => (
          <circle key={point.period} cx={toX(idx)} cy={toY(point.ipp)} r={2.7} fill="#fff" stroke={TOKENS.color.lineGreen} strokeWidth={1.6}>
            <title>{point.period}: {withComma(point.ipp)}</title>
          </circle>
        ))}
        {TEMP_IPP_SERIES.map((point, idx) => (
          <text key={`${point.period}-label`} x={toX(idx)} y={height - 8} textAnchor="middle" style={{ fontSize: 8, fill: "rgba(0,0,0,0.34)" }}>
            {idx % 2 === 0 ? point.period : ""}
          </text>
        ))}
      </svg>
    </ChartCardShell>
  );
}

function CategoryTrendChart({ loading }: { loading: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const width = 760;
  const height = 210;
  const padL = 32;
  const padR = 18;
  const padT = 14;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const allValues = TEMP_CATEGORY_SERIES.flatMap((series) => series.values);
  const minVal = Math.min(...allValues) - 4;
  const maxVal = Math.max(...allValues) + 2;
  const toX = (idx: number) => padL + (idx / Math.max(1, TEMP_X_LABELS.length - 1)) * plotW;
  const toY = (value: number) => padT + plotH - ((value - minVal) / Math.max(0.0001, maxVal - minVal)) * plotH;

  if (loading) {
    return (
      <ChartCardShell title="Kategorie-Füllstand">
        <Skeleton width="100%" height={160} />
      </ChartCardShell>
    );
  }

  return (
    <ChartCardShell
      title="Kategorie-Füllstand"
      controls={
        <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.05)", borderRadius: 7, padding: 2 }}>
          {["Täglich", "Wöchentlich", "Monatlich"].map((label) => (
            <button key={label} type="button" style={{ border: "none", borderRadius: 5, background: label === "Wöchentlich" ? "#fff" : "transparent", color: label === "Wöchentlich" ? TOKENS.color.textPrimary : TOKENS.color.textMuted, fontSize: 9, fontWeight: 700, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
      }
      legend={
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 13px" }}>
          {TEMP_CATEGORY_SERIES.map((series) => {
            const selected = active == null || active === series.label;
            return (
              <button
                key={series.label}
                type="button"
                onMouseEnter={() => setActive(series.label)}
                onMouseLeave={() => setActive(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  opacity: selected ? 1 : 0.45,
                }}
              >
                <span style={{ width: 9, height: 2.5, borderRadius: 2, background: series.color }} />
                <span style={{ fontSize: 9.5, color: TOKENS.color.textSecondary }}>{series.label}</span>
              </button>
            );
          })}
        </div>
      }
    >
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {[minVal + (maxVal - minVal) * 0.33, minVal + (maxVal - minVal) * 0.66].map((tick, idx) => (
          <line key={idx} x1={padL} y1={toY(tick)} x2={width - padR} y2={toY(tick)} stroke="rgba(0,0,0,0.06)" strokeDasharray="3 3" />
        ))}
        {TEMP_CATEGORY_SERIES.map((series) => {
          const path = series.values.map((value, idx) => `${idx === 0 ? "M" : "L"} ${toX(idx)} ${toY(value)}`).join(" ");
          const selected = active == null || active === series.label;
          return (
            <g key={series.label} style={{ opacity: selected ? 0.95 : 0.28, transition: "opacity 150ms ease" }}>
              <path d={path} fill="none" stroke={series.color} strokeWidth={active === series.label ? 2.2 : 1.6} />
              {series.values.map((value, idx) => (
                <circle key={`${series.label}-${idx}`} cx={toX(idx)} cy={toY(value)} r={2.4} fill="#fff" stroke={series.color} strokeWidth={1.2} />
              ))}
            </g>
          );
        })}
        {TEMP_X_LABELS.map((label, idx) => (
          <text key={label} x={toX(idx)} y={height - 8} textAnchor="middle" style={{ fontSize: 8, fill: "rgba(0,0,0,0.35)" }}>
            {idx % 2 === 0 ? label : ""}
          </text>
        ))}
      </svg>
    </ChartCardShell>
  );
}

function statusColor(status: MapStatus): string {
  if (status === "planned") return TOKENS.color.lineBlue;
  if (status === "overdue") return TOKENS.color.red;
  return TOKENS.color.success;
}

function clusterPoints(points: MapPoint[], radius: number): Array<{
  id: string;
  x: number;
  y: number;
  members: MapPoint[];
  status: MapStatus;
}> {
  const clusters: Array<{ x: number; y: number; members: MapPoint[] }> = [];

  points.forEach((point) => {
    const cluster = clusters.find((candidate) => {
      const dx = candidate.x - point.x;
      const dy = candidate.y - point.y;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });
    if (!cluster) {
      clusters.push({ x: point.x, y: point.y, members: [point] });
      return;
    }
    cluster.members.push(point);
    const sum = cluster.members.reduce((acc, item) => ({ x: acc.x + item.x, y: acc.y + item.y }), { x: 0, y: 0 });
    cluster.x = sum.x / cluster.members.length;
    cluster.y = sum.y / cluster.members.length;
  });

  return clusters.map((cluster, idx) => {
    const counts = cluster.members.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { visited: 0, planned: 0, overdue: 0 },
    );
    const dominant = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "visited") as MapStatus;
    return {
      id: `cluster-${idx}`,
      x: cluster.x,
      y: cluster.y,
      members: cluster.members,
      status: dominant,
    };
  });
}

function CoverageMapCard({ loading }: { loading: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<null | { x: number; y: number; originX: number; originY: number }>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const clusters = useMemo(() => clusterPoints(TEMP_MAP_POINTS, 18 / zoom), [zoom]);
  const hovered = clusters.find((cluster) => cluster.id === hoveredClusterId) ?? null;
  const visited = TEMP_MAP_POINTS.filter((point) => point.status === "visited").length;
  const planned = TEMP_MAP_POINTS.filter((point) => point.status === "planned").length;
  const overdue = TEMP_MAP_POINTS.filter((point) => point.status === "overdue").length;

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!drag) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.x),
      y: drag.originY + (event.clientY - drag.y),
    });
  }, [drag]);

  if (loading) {
    return (
      <ChartCardShell title="Marktabdeckung Karte">
        <Skeleton width="100%" height={230} />
      </ChartCardShell>
    );
  }

  const AUSTRIA_PATH =
    "M 68 90 L 82 78 L 98 75 L 120 80 L 132 72 L 150 68 L 170 62 L 196 60 L 216 58 L 241 55 L 266 52 L 289 58 L 310 55 L 332 52 L 353 54 L 376 60 L 386 68 L 382 79 L 375 88 L 380 98 L 372 110 L 360 120 L 344 126 L 328 130 L 313 136 L 300 145 L 286 152 L 270 158 L 255 162 L 240 165 L 224 161 L 208 156 L 194 158 L 180 154 L 164 148 L 149 141 L 136 133 L 118 129 L 102 118 L 86 108 L 72 100 Z";

  return (
    <ChartCardShell
      title="Marktabdeckung Karte"
      count={`${TEMP_MAP_POINTS.length} Märkte`}
      controls={
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.8, Number((current - 0.2).toFixed(2))))}
            style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", cursor: "pointer", color: TOKENS.color.textSecondary }}
          >
            <ZoomOut size={12} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(2, Number((current + 0.2).toFixed(2))))}
            style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", cursor: "pointer", color: TOKENS.color.textSecondary }}
          >
            <ZoomIn size={12} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7, background: "#fff", fontSize: 9, fontWeight: 700, color: TOKENS.color.textMuted, padding: "0 8px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Reset
          </button>
        </div>
      }
      legend={
        <div style={{ display: "flex", gap: 14 }}>
          {[
            { label: `${visited} Besucht`, color: TOKENS.color.success },
            { label: `${planned} Geplant`, color: TOKENS.color.lineBlue },
            { label: `${overdue} Überfällig`, color: TOKENS.color.red },
          ].map((item) => (
            <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: TOKENS.radius.chip, background: item.color }} />
              <span style={{ fontSize: 9.5, color: TOKENS.color.textSecondary }}>{item.label}</span>
            </span>
          ))}
        </div>
      }
    >
      <div
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2.05 / 1",
          borderRadius: 10,
          background: "linear-gradient(180deg, rgba(52,211,153,0.10) 0%, rgba(125,211,252,0.06) 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          overflow: "hidden",
          cursor: drag ? "grabbing" : "grab",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 450 220" style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            <path d={AUSTRIA_PATH} fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.12)" strokeWidth={1.5} />
            {clusters.map((cluster) => {
              const count = cluster.members.length;
              const base = count === 1 ? 5 : 7 + Math.min(6, Math.sqrt(count) * 1.8);
              const fill = statusColor(cluster.status);
              return (
                <g
                  key={cluster.id}
                  onMouseEnter={() => setHoveredClusterId(cluster.id)}
                  onMouseLeave={() => setHoveredClusterId(null)}
                  onMouseDown={(event) =>
                    setDrag({
                      x: event.clientX,
                      y: event.clientY,
                      originX: offset.x,
                      originY: offset.y,
                    })
                  }
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={cluster.x} cy={cluster.y} r={base + 2} fill={`${fill}26`} />
                  <circle cx={cluster.x} cy={cluster.y} r={base} fill={fill} stroke="#fff" strokeWidth={2} />
                  {count > 1 ? (
                    <text x={cluster.x} y={cluster.y + 3} textAnchor="middle" style={{ fontSize: 8, fill: "#fff", fontWeight: 800 }}>
                      {count}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
        {hovered ? (
          <div
            className="gm-anim"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#fff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
              padding: "6px 10px",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: TOKENS.color.textPrimary }}>
              {hovered.members.length > 1 ? `${hovered.members.length} Märkte` : hovered.members[0].name}
            </div>
            <div style={{ marginTop: 2, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: TOKENS.radius.chip, background: statusColor(hovered.status) }} />
              <span style={{ fontSize: 9, color: TOKENS.color.textSecondary }}>
                {hovered.members[0].region} · {hovered.status === "visited" ? "Besucht" : hovered.status === "planned" ? "Geplant" : "Überfällig"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </ChartCardShell>
  );
}

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div style={{ height: 5, borderRadius: 5, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, height: "100%", borderRadius: 5, background: color, transition: "width 700ms cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function DailyConsistencyCard({ loading }: { loading: boolean }) {
  const completion = Math.round((TEMP_DAILY.daysEnded / TEMP_DAILY.daysStarted) * 100);
  const rows = [
    { label: "Tage gestartet", value: TEMP_DAILY.daysStarted, max: 20, color: TOKENS.color.lineBlue },
    { label: "Tage beendet", value: TEMP_DAILY.daysEnded, max: 20, color: TOKENS.color.success },
    { label: "KM Start fehlend", value: TEMP_DAILY.missingKmStart, max: TEMP_DAILY.daysStarted, color: TOKENS.color.red },
    { label: "KM Ende fehlend", value: TEMP_DAILY.missingKmEnd, max: TEMP_DAILY.daysEnded, color: TOKENS.color.red },
  ];

  return (
    <ChartCardShell title="Tagesdisziplin & Compliance">
      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} width="100%" height={40} />
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row) => (
              <div key={row.label} style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "9px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: TOKENS.color.textSecondary }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: TOKENS.color.textPrimary }}>{row.value}</span>
                </div>
                <ProgressBar percentage={(row.value / Math.max(1, row.max)) * 100} color={row.color} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, marginTop: 10 }}>
            <div style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "9px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TOKENS.color.label }}>Ø Pause</div>
              <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900, color: TOKENS.color.textPrimary }}>
                {TEMP_DAILY.avgPauseMin}<span style={{ fontSize: 10, color: TOKENS.color.textMuted }}> min</span>
              </div>
            </div>
            <div style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "9px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TOKENS.color.label }}>Abschlussrate</div>
              <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900, color: completion >= 80 ? TOKENS.color.success : TOKENS.color.red }}>{completion}%</div>
            </div>
            <div style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "9px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TOKENS.color.label }}>Streak</div>
              <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900, color: TOKENS.color.warning }}>🔥 {TEMP_DAILY.streak}</div>
            </div>
          </div>
        </>
      )}
    </ChartCardShell>
  );
}

function MarketRankingCard({ loading }: { loading: boolean }) {
  const [tab, setTab] = useState<"top" | "bottom">("top");
  const sorted = [...TEMP_MARKET_RANKING].sort((a, b) => b.ipp - a.ipp);
  const records = tab === "top" ? sorted.slice(0, 5) : sorted.slice(-5).reverse();

  return (
    <ChartCardShell
      title="Markt Ranking"
      controls={
        <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.05)", borderRadius: 7, padding: 2 }}>
          {(["top", "bottom"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              style={{
                border: "none",
                borderRadius: 5,
                background: tab === mode ? "#fff" : "transparent",
                color: tab === mode ? TOKENS.color.textPrimary : TOKENS.color.textMuted,
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 8px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {mode === "top" ? "Top 5" : "Nachzügler"}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} width="100%" height={34} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {records.map((record, idx) => (
            <div key={record.name} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)", background: "#fff", padding: "7px 9px" }}>
              <span style={{ width: 16, textAlign: "center", fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.28)" }}>{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: TOKENS.color.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.name}</div>
                <div style={{ marginTop: 1, fontSize: 8.5, color: TOKENS.color.textMuted }}>{record.visits} Besuche · Qualität {record.quality}%</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 900, color: record.ipp >= 6 ? TOKENS.color.success : TOKENS.color.red }}>{withComma(record.ipp)}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCardShell>
  );
}

function CampaignProgressCard({ loading }: { loading: boolean }) {
  return (
    <ChartCardShell title="Kampagnenfortschritt" count={`${TEMP_CAMPAIGNS_TABLE.length} aktiv`}>
      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, idx) => <Skeleton key={idx} width="100%" height={52} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {TEMP_CAMPAIGNS_TABLE.map((campaign) => {
            const pct = Math.round((campaign.done / campaign.target) * 100);
            const color = pct >= 70 ? TOKENS.color.success : pct >= 40 ? TOKENS.color.warning : TOKENS.color.red;
            return (
              <div key={campaign.name} style={{ borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: TOKENS.color.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{campaign.name}</div>
                    <div style={{ marginTop: 2, fontSize: 8.5, color: TOKENS.color.textMuted }}>{campaign.markets} Märkte · Qualität {campaign.quality}%</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color }}>{pct}%</div>
                    <div style={{ fontSize: 8.5, color: TOKENS.color.textMuted }}>{campaign.done}/{campaign.target}</div>
                  </div>
                </div>
                <ProgressBar percentage={pct} color={color} />
              </div>
            );
          })}
        </div>
      )}
    </ChartCardShell>
  );
}

function TimeTrackingCard({ loading }: { loading: boolean }) {
  const marketPct = Math.round((TEMP_TIME_TRACKING.marketWorkH / TEMP_TIME_TRACKING.totalH) * 100);
  const zusatzPct = Math.round((TEMP_TIME_TRACKING.zusatzH / TEMP_TIME_TRACKING.totalH) * 100);

  return (
    <ChartCardShell title="Zeiterfassung">
      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          <Skeleton width="100%" height={38} />
          <Skeleton width="100%" height={38} />
          <Skeleton width="100%" height={8} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <div style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "9px 10px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TOKENS.color.label }}>Marktarbeit</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: TOKENS.color.red }}>{withComma(TEMP_TIME_TRACKING.marketWorkH)}<span style={{ fontSize: 10, color: TOKENS.color.textMuted }}> h</span></div>
              <div style={{ marginTop: 2, fontSize: 8.5, color: TOKENS.color.textMuted }}>{marketPct}% gesamt</div>
            </div>
            <div style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "9px 10px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TOKENS.color.label }}>Zusatz</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: TOKENS.color.purple }}>{withComma(TEMP_TIME_TRACKING.zusatzH)}<span style={{ fontSize: 10, color: TOKENS.color.textMuted }}> h</span></div>
              <div style={{ marginTop: 2, fontSize: 8.5, color: TOKENS.color.textMuted }}>{zusatzPct}% gesamt</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 8.5, color: TOKENS.color.textMuted, marginBottom: 5 }}>Aufteilung</div>
            <div style={{ height: 8, borderRadius: 8, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${marketPct}%`, background: TOKENS.color.red }} />
              <div style={{ width: `${zusatzPct}%`, background: TOKENS.color.purple }} />
            </div>
          </div>
        </>
      )}
    </ChartCardShell>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ padding: "64px 0", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(220,38,38,0.08)", margin: "0 auto 12px" }}>
          <BarChart3 size={24} color={TOKENS.color.red} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.color.textPrimary }}>Keine Daten im gewählten Zeitraum</div>
        <div style={{ marginTop: 5, fontSize: 11, color: TOKENS.color.textSecondary }}>Passe die Filter an oder setze sie zurück.</div>
        <button
          type="button"
          onClick={onReset}
          style={{ marginTop: 12, border: "none", borderRadius: 8, background: `linear-gradient(to bottom, ${TOKENS.color.red}, ${TOKENS.color.redDark})`, color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}
        >
          Filter zurücksetzen
        </button>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ padding: "64px 0", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(220,38,38,0.08)", margin: "0 auto 12px" }}>
          <AlertCircle size={24} color={TOKENS.color.red} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.color.textPrimary }}>Fehler beim Laden</div>
        <div style={{ marginTop: 5, fontSize: 11, color: TOKENS.color.textSecondary }}>Bitte erneut versuchen.</div>
        <button
          type="button"
          onClick={onRetry}
          style={{ marginTop: 12, border: "none", borderRadius: 8, background: `linear-gradient(to bottom, ${TOKENS.color.red}, ${TOKENS.color.redDark})`, color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}
        >
          Erneut laden
        </button>
      </div>
    </div>
  );
}

function DashboardFilters({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (value: FilterState) => void;
}) {
  return (
    <div
      className="gm-anim"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.07)",
        background: "#fff",
        boxShadow: TOKENS.color.cardShadow,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 2 }}>
        <Filter size={11} color={TOKENS.color.textMuted} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: TOKENS.color.label }}>Filter settings</span>
      </span>
      <DateRangeTabs value={filters.dateRange} onChange={(dateRange) => onChange({ ...filters, dateRange })} />
      <div style={{ width: 1, height: 20, background: "rgba(0,0,0,0.09)" }} />
      <FilterSelect id="gm-filter" value={filters.gm} onChange={(gm) => onChange({ ...filters, gm })} options={TEMP_GMS} icon={<Users size={10} />} />
      <FilterSelect id="campaign-filter" value={filters.campaign} onChange={(campaign) => onChange({ ...filters, campaign })} options={TEMP_CAMPAIGNS} icon={<Activity size={10} />} />
      <FilterSelect id="region-filter" value={filters.region} onChange={(region) => onChange({ ...filters, region })} options={TEMP_REGIONS} icon={<MapPin size={10} />} />
      <FilterSelect id="status-filter" value={filters.status} onChange={(status) => onChange({ ...filters, status })} options={TEMP_STATUSES} icon={<CheckCircle2 size={10} />} />
      <button
        type="button"
        style={{
          marginLeft: "auto",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
          color: "#fff",
          background: `linear-gradient(to bottom, ${TOKENS.color.red}, ${TOKENS.color.redDark})`,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "inherit",
        }}
      >
        <Calendar size={10} />
        Anwenden
      </button>
    </div>
  );
}

export default function GmDashboardPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setPageState("ready"), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const handleFilterChange = useCallback((next: FilterState) => {
    setFilters(next);
    setRefreshing(true);
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => setRefreshing(false), 620);
  }, []);

  const loading = pageState === "loading" || refreshing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{DASHBOARD_CSS}</style>

      <div className="gm-anim" style={{ ...useStaggerStyle(0), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: TOKENS.color.label, fontWeight: 700 }}>
            Gebietsmanagement
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: TOKENS.color.textSecondary, fontWeight: 500 }}>
            Chart-Ansicht (UI/UX Preview mit Temp-Daten)
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, color: TOKENS.color.textMuted, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: TOKENS.radius.chip, background: TOKENS.color.success, boxShadow: "0 0 0 2px rgba(22,163,74,0.18)" }} />
          Aktualisiert vor 1 Min
        </span>
      </div>

      <DashboardFilters filters={filters} onChange={handleFilterChange} />

      {pageState === "error" ? (
        <div style={{ background: "#fff", borderRadius: TOKENS.radius.card, border: `1px solid ${TOKENS.color.cardBorder}` }}>
          <ErrorState onRetry={() => setPageState("ready")} />
        </div>
      ) : pageState === "empty" ? (
        <div style={{ background: "#fff", borderRadius: TOKENS.radius.card, border: `1px solid ${TOKENS.color.cardBorder}` }}>
          <EmptyState onReset={() => setFilters(DEFAULT_FILTERS)} />
        </div>
      ) : (
        <>
          <div className="gm-kpi-row">
            <KpiCard label="Besuchsabschluss" value={TEMP_KPI.visitCompletionPct} helper="% der geplanten Besuche" delta={5} icon={<CheckCircle2 size={13} />} color={TOKENS.color.success} loading={loading} index={1} />
            <KpiCard label="Besuche Total" value={TEMP_KPI.visitsDone} helper={`von ${TEMP_KPI.visitsTarget} geplant`} icon={<MapPin size={13} />} color={TOKENS.color.lineBlue} loading={loading} index={2} />
            <KpiCard label="IPP Score" value={TEMP_KPI.ippCurrent} helper="Ø aktuell" delta={TEMP_KPI.ippDelta} icon={<Star size={13} />} color={TOKENS.color.warning} loading={loading} index={3} />
            <KpiCard label="Zeiterfassung" value={TEMP_KPI.trackedHours} helper="Stunden im Zeitraum" icon={<Clock size={13} />} color={TOKENS.color.purple} loading={loading} index={4} />
            <KpiCard label="Datenqualität" value={TEMP_KPI.dataQualityPct} helper="% vollständig" delta={2} icon={<BarChart3 size={13} />} color={TOKENS.color.lineGreen} loading={loading} index={5} />
          </div>

          <div className="gm-row-a">
            <DonutVisitChart loading={loading} />
            <IppTrendChart loading={loading} />
          </div>

          <div className="gm-row-b">
            <CategoryTrendChart loading={loading} />
            <CoverageMapCard loading={loading} />
          </div>

          <div className="gm-row-c">
            <DailyConsistencyCard loading={loading} />
            <MarketRankingCard loading={loading} />
            <CampaignProgressCard loading={loading} />
          </div>

          <div className="gm-row-d">
            <TimeTrackingCard loading={loading} />
            <ChartCardShell title="GM Übersicht" count={`${TEMP_GMS.length - 1} GMs`}>
              {loading ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} width="100%" height={40} />)}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {TEMP_GMS.slice(1).map((name, idx) => {
                    const ipp = [5.3, 5.1, 4.9, 5.4, 5.6][idx] ?? 5.0;
                    const bonus = [87, 94, 73, 89, 81][idx] ?? 80;
                    const cooler = [23, 41, 37, 52, 28][idx] ?? 30;
                    return (
                      <div key={name} style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "8px 10px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.10)", color: TOKENS.color.red, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                          {name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: TOKENS.color.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                          <div style={{ marginTop: 1, fontSize: 8.5, color: TOKENS.color.textMuted }}>
                            Boni {bonus}% · Kühlerinventur {cooler}/121
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: TOKENS.color.success }}>IPP {withComma(ipp)}</div>
                          <div style={{ fontSize: 8, color: TOKENS.color.textMuted }}>Region</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCardShell>
          </div>
        </>
      )}

      <div style={{ display: "none" }}>
        <button type="button" onClick={() => setPageState("error")}>set-error</button>
        <button type="button" onClick={() => setPageState("empty")}>set-empty</button>
        <button type="button" onClick={() => setPageState("ready")}>set-ready</button>
      </div>
    </div>
  );
}

