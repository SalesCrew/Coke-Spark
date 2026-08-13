"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, RotateCcw, Search, X } from "lucide-react";

const RED = "#DC2626";
const GREEN = "#16883f";

type SelectOption = { value: string; label: string };

type DashboardFilterKey = "region" | "chain" | "sm" | "basis";

const FILTER_OPTIONS: Record<DashboardFilterKey, SelectOption[]> = {
  region: ["Alle", "Nord", "Ost", "Süd", "West"].map((value) => ({ value, label: value })),
  chain: ["Alle", "Interspar", "Eurospar", "Billa / Billa Plus", "Spar", "Maxi Markt", "Adeg"].map((value) => ({ value, label: value })),
  sm: ["Alle", "Adriana Maier", "Selina Huber", "Lukas Steiner"].map((value) => ({ value, label: value })),
  basis: [
    { value: "Markt-Ø", label: "Markt-Ø" },
    { value: "Besuchsgewichtet", label: "Besuchsgewichtet" },
  ],
};

const CATEGORY_ROWS = [
  { label: "Aktionsplatzierungen", oos: 7.9, fixed: 79.4 },
  { label: "Limonaden & Energy", oos: 20.6, fixed: 86.7 },
  { label: "Wasser & Near Water", oos: 13.8, fixed: 83.4 },
  { label: "Säfte & Eistee", oos: 6.5, fixed: 80.0 },
];

const CATEGORY_VISIT_ROWS = [
  { label: "Aktionsplatzierungen", oos: 9.9, fixed: 94.5 },
  { label: "Limonaden & Energy", oos: 21.3, fixed: 88.6 },
  { label: "Wasser & Near Water", oos: 14.4, fixed: 89.0 },
  { label: "Säfte & Eistee", oos: 7.2, fixed: 94.1 },
];

const QUALITY_SECTIONS = [
  { label: "Getränkekühler", value: 98.8 },
  { label: "Aktionsplatzierungen", value: 96.1 },
  { label: "Limonaden & Energy", value: 94.4 },
  { label: "Wasser & Near Water", value: 94.7 },
  { label: "Säfte & Eistee", value: 93.9 },
  { label: "Information", value: 97.5 },
];

const QUALITY_TREND = [
  { label: "Jan", value: 96.2 },
  { label: "Feb", value: 96.5 },
  { label: "Mär", value: 95.6 },
  { label: "Apr", value: 96.6 },
  { label: "Mai", value: 96.4 },
];

const CHAIN_ROWS = [
  { label: "INTERSPAR", visits: 432, quality: 96.1, oos: 9.8, fixed: 76.5 },
  { label: "EUROSPAR", visits: 216, quality: 96.3, oos: 16.0, fixed: 85.4 },
  { label: "BILLA PLUS", visits: 175, quality: 95.9, oos: 9.4, fixed: 68.3 },
  { label: "SPAR", visits: 65, quality: 98.5, oos: 21.1, fixed: 95.8 },
  { label: "MAXI MARKT", visits: 55, quality: 98.5, oos: 6.1, fixed: 100 },
  { label: "ADEG", visits: 4, quality: 100, oos: 0, fixed: null },
] as const;

const REGION_ROWS = [
  { label: "Nord", markets: 13, oos: 3.8, fixed: 100 },
  { label: "Ost", markets: 58, oos: 13.3, fixed: 90.8 },
  { label: "Süd", markets: 51, oos: 11.3, fixed: 68.6 },
  { label: "West", markets: 27, oos: 16.7, fixed: 80.8 },
];

function formatPercent(value: number): string {
  return `${value.toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function DashboardFilter({ label, value, placeholder, options, minWidth, onChange, allowClear = true, active }: {
  label: string;
  value: string | null;
  placeholder: string;
  options: SelectOption[];
  minWidth: number;
  onChange: (value: string | null) => void;
  allowClear?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const isActive = active ?? Boolean(value);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div style={{ minWidth }}>
      <span className="sm-dashboard-filter-label">{label}</span>
      <button ref={triggerRef} type="button" className={`sm-dashboard-filter-trigger${isActive ? " is-active" : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={10} strokeWidth={2} className={open ? "is-open" : ""} />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div ref={menuRef} className="sm-dashboard-filter-menu" style={{ top: position.top, left: position.left, minWidth: Math.max(position.width, 160) }}>
          {allowClear ? (
            <button type="button" className={!value ? "is-selected" : ""} onClick={() => { onChange(null); setOpen(false); }}>
              <span>{placeholder}</span>{!value ? <Check size={11} strokeWidth={2.5} /> : null}
            </button>
          ) : null}
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button type="button" className={active ? "is-selected" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>
                <span>{option.label}</span>{active ? <Check size={11} strokeWidth={2.5} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function BasisSegment({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="sm-dashboard-basis-segment" aria-label="Auswertungsbasis">
      {FILTER_OPTIONS.basis.map((option) => (
        <button type="button" key={option.value} className={value === option.value ? "is-active" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChainPill({ label }: { label: string }) {
  const normalized = label.toLocaleUpperCase("de-AT");
  const colors = normalized.includes("BILLA")
    ? { background: "rgba(234,179,8,0.12)", color: "#a16207" }
    : normalized.includes("SPAR")
      ? { background: "rgba(220,38,38,0.08)", color: RED }
      : normalized.includes("ADEG")
        ? { background: "rgba(34,197,94,0.08)", color: "#15803d" }
        : { background: "rgba(0,0,0,0.05)", color: "#6b7280" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 18,
        maxWidth: "100%",
        padding: "2px 7px",
        borderRadius: 5,
        overflow: "hidden",
        color: colors.color,
        background: colors.background,
        fontSize: 9,
        fontWeight: 750,
        lineHeight: 1,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  detail,
  tone = "neutral",
  progress,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  tone?: "neutral" | "red" | "green" | "amber";
  progress: number;
}) {
  const toneColor = tone === "red" ? RED : tone === "green" ? GREEN : tone === "amber" ? "#d97706" : "#23272d";
  return (
    <article className="sm-dashboard-metric-card">
      <span className="sm-dashboard-micro-label">{label}</span>
      <div className="sm-dashboard-metric-value" style={{ color: toneColor }}>
        {value}{suffix ? <small>{suffix}</small> : null}
      </div>
      <p className={tone === "amber" ? "is-warning" : ""}>{detail}</p>
      <DashboardBar value={progress} tone={tone === "neutral" ? "gray" : tone} />
    </article>
  );
}

function DashboardBar({ value, max = 100, tone }: { value: number; max?: number; tone: "red" | "green" | "amber" | "gray" }) {
  const color = tone === "red" ? "#ef2028" : tone === "green" ? "#159447" : tone === "amber" ? "#d97706" : "rgba(0,0,0,.35)";
  return (
    <span className="sm-dashboard-progress-track">
      <span style={{ width: `${Math.max(0, Math.min((value / max) * 100, 100))}%`, background: color }} />
    </span>
  );
}

function QualityChart() {
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(800);
  const height = 142;
  const left = 38;
  const right = 8;
  const top = 28;
  const bottom = 30;
  const min = 90;
  const max = 100;
  const x = (index: number) => left + (index * (width - left - right)) / (QUALITY_TREND.length - 1);
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = QUALITY_TREND.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const syncWidth = () => setWidth(Math.max(520, Math.round(chart.getBoundingClientRect().width)));
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={chartRef} className="sm-dashboard-quality-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ausführungsqualität Januar bis Mai 2026">
      {[90, 95, 100].map((tick) => (
        <g key={tick}>
          <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} stroke="rgba(0,0,0,.07)" strokeWidth="1" />
          <text x="0" y={y(tick) + 4} fill="rgba(0,0,0,.48)" fontSize="11.5" fontWeight="600">{tick} %</text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.35" />
      {QUALITY_TREND.map((item, index) => {
        const current = index === QUALITY_TREND.length - 1;
        const first = index === 0;
        const last = index === QUALITY_TREND.length - 1;
        return (
          <g key={item.label}>
            <circle cx={x(index)} cy={y(item.value)} r="3.2" fill={current ? RED : "#4b4f55"} />
            <text
              x={x(index) + (first ? 7 : last ? -7 : 0)}
              y={y(item.value) - 11}
              textAnchor={first ? "start" : last ? "end" : "middle"}
              fill={current ? RED : "#363a40"}
              fontSize="11.5"
              fontWeight="700"
            >
              {formatPercent(item.value)}
            </text>
            <text x={x(index)} y={height - 5} textAnchor={first ? "start" : last ? "end" : "middle"} fill="rgba(0,0,0,.54)" fontSize="11.5" fontWeight="600">{item.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function exportDashboardWorkbook() {
  const XLSX = await import("xlsx-js-style");
  const workbook = XLSX.utils.book_new();
  const overview = XLSX.utils.aoa_to_sheet([
    ["Shelf Merchandising Auswertung", "Mai 2026"],
    [],
    ["Kennzahl", "Wert", "Basis"],
    ["Besuche", "947 / 947", "Abgeschlossen"],
    ["Stammmärkte", 149, "Workbook"],
    ["Ausführungsqualität", 0.964, "28.920 / 29.992 Punkte"],
    ["OOS-Quote", 0.1238, "Ungewichteter Markt-Ø"],
    ["OOS behoben", 0.8131, "53 relevante Märkte"],
    ["Ist-Zeit", 1628, "Stunden"],
    ["Ø je Besuch", 1.72, "Stunden"],
  ]);
  overview["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 30 }];
  const categories = XLSX.utils.json_to_sheet(CATEGORY_ROWS.map((row) => ({ Kategorie: row.label, "OOS vorhanden (%)": row.oos, "OOS behoben (%)": row.fixed })));
  categories["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
  const chains = XLSX.utils.json_to_sheet(CHAIN_ROWS.map((row) => ({ Handelskette: row.label, Besuche: row.visits, "Qualität (%)": row.quality, "OOS Markt-Ø (%)": row.oos, "Behoben (%)": row.fixed ?? "nicht erforderlich" })));
  chains["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 18 }];
  const regions = XLSX.utils.json_to_sheet(REGION_ROWS.map((row) => ({ Region: row.label, Märkte: row.markets, "OOS Markt-Ø (%)": row.oos, "Behoben (%)": row.fixed })));
  regions["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, overview, "Übersicht");
  XLSX.utils.book_append_sheet(workbook, categories, "Kategorien");
  XLSX.utils.book_append_sheet(workbook, chains, "Handelsketten");
  XLSX.utils.book_append_sheet(workbook, regions, "Regionen");
  XLSX.writeFile(workbook, "CokeSpark_SM_Auswertung_Mai_2026.xlsx");
}

export function SmDashboardWorkspace() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<DashboardFilterKey, string>>({ region: "Alle", chain: "Alle", sm: "Alle", basis: "Markt-Ø" });

  const categoryRows = filters.basis === "Besuchsgewichtet" ? CATEGORY_VISIT_ROWS : CATEGORY_ROWS;
  const activeFilterCount = [filters.region, filters.chain, filters.sm].filter((value) => value !== "Alle").length
    + (filters.basis !== "Markt-Ø" ? 1 : 0)
    + (search.trim() ? 1 : 0);
  const visibleChains = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-AT");
    return CHAIN_ROWS.filter((row) => {
      const matchesSearch = !query || row.label.toLocaleLowerCase("de-AT").includes(query);
      const matchesFilter = filters.chain === "Alle" || row.label.includes(filters.chain.toLocaleUpperCase("de-AT")) || filters.chain.toLocaleUpperCase("de-AT").includes(row.label);
      return matchesSearch && matchesFilter;
    });
  }, [filters.chain, search]);
  const visibleRegions = filters.region === "Alle" ? REGION_ROWS : REGION_ROWS.filter((row) => row.label === filters.region);

  useEffect(() => {
    const excelHandler = () => { void exportDashboardWorkbook(); };
    const reportHandler = () => window.print();
    window.addEventListener("admin:sm-dashboard:export", excelHandler);
    window.addEventListener("sm-dashboard:export-report", reportHandler);
    return () => {
      window.removeEventListener("admin:sm-dashboard:export", excelHandler);
      window.removeEventListener("sm-dashboard:export-report", reportHandler);
    };
  }, []);

  const setFilter = (key: DashboardFilterKey, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => {
    setSearch("");
    setFilters({ region: "Alle", chain: "Alle", sm: "Alle", basis: "Markt-Ø" });
  };

  return (
    <div className="sm-dashboard-page">
      <style>{`
        .sm-dashboard-page{min-width:1040px;color:#1a1a1a;font-variant-numeric:tabular-nums}.sm-dashboard-page *{box-sizing:border-box}
        .sm-dashboard-shell{overflow:visible;border:1px solid rgba(0,0,0,.07);border-radius:14px;background:rgba(0,0,0,.025)}
        .sm-dashboard-shell-head{height:46px;padding:0 18px;display:flex;align-items:center;justify-content:space-between}.sm-dashboard-shell-head>span:first-child{font-size:11px;font-weight:700;letter-spacing:.055em;text-transform:uppercase;color:rgba(0,0,0,.4)}.sm-dashboard-shell-head>span:last-child{font-size:11px;font-weight:600;color:rgba(0,0,0,.5)}
        .sm-dashboard-content{margin:0 10px 10px;display:flex;flex-direction:column;gap:10px}
        .sm-dashboard-toolbar{position:relative;z-index:30;min-height:72px;padding:11px 14px;display:flex;align-items:flex-end;gap:10px;border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.05)}
        .sm-dashboard-search-field{width:290px;flex-shrink:0}.sm-dashboard-filter-label{display:block;margin-bottom:4px;color:rgba(0,0,0,.36);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.sm-dashboard-search{height:27px;padding:0 10px;display:flex;align-items:center;gap:6px;border:1px solid transparent;border-radius:7px;background:rgba(0,0,0,.03);color:rgba(0,0,0,.3)}.sm-dashboard-search:focus-within{border-color:rgba(0,0,0,.14);background:#fff}.sm-dashboard-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#1a1a1a;font-family:inherit;font-size:11px;font-weight:400;line-height:1}.sm-dashboard-search input::placeholder{color:rgba(0,0,0,.42);font-weight:400}.sm-dashboard-search button{padding:0;border:0;background:transparent;color:rgba(0,0,0,.3);cursor:pointer;display:flex}
        .sm-dashboard-filter-row{margin-left:auto;display:flex;align-items:flex-end;gap:6px}.sm-dashboard-filter-trigger{height:27px;width:100%;padding:0 10px;border-radius:7px;border:1px solid rgba(0,0,0,.08);outline:0;background:#fff;color:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:space-between;gap:5px;font-family:inherit;font-size:10px;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer}.sm-dashboard-filter-trigger.is-active{border-color:rgba(220,38,38,.25);background:rgba(220,38,38,.04);color:${RED}}.sm-dashboard-filter-trigger svg{flex:none;transition:transform .2s}.sm-dashboard-filter-trigger svg.is-open{transform:rotate(180deg)}
        .sm-dashboard-filter-menu{position:fixed;z-index:9999;max-height:360px;overflow-y:auto;padding:4px;border:1px solid rgba(0,0,0,.08);border-radius:9px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.1);scrollbar-width:none}.sm-dashboard-filter-menu::-webkit-scrollbar{display:none}.sm-dashboard-filter-menu button{width:100%;min-height:29px;padding:6px 10px;border:0;outline:0;border-radius:5px;background:transparent;color:#374151;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font-family:inherit;font-size:11px;font-weight:400;cursor:pointer}.sm-dashboard-filter-menu button.is-selected{background:rgba(220,38,38,.06);color:${RED};font-weight:600}.sm-dashboard-filter-menu button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sm-dashboard-reset-shell{display:flex;flex-direction:column}.sm-dashboard-reset{height:27px;padding:0 9px;border:0;outline:0;border-radius:7px;display:flex;align-items:center;justify-content:center;gap:5px;background:rgba(220,38,38,.28);color:#fff;font-family:inherit;font-size:9px;font-weight:800;line-height:1;white-space:nowrap;cursor:not-allowed;opacity:.55}.sm-dashboard-reset.has-filters{cursor:pointer;opacity:1;background:linear-gradient(to bottom,#dc2626,#b91c1c);box-shadow:inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.18)}
        .sm-dashboard-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.sm-dashboard-metric-card{position:relative;min-height:118px;padding:15px;border:1px solid rgba(0,0,0,.06);border-radius:10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.045)}.sm-dashboard-micro-label{display:block;color:rgba(0,0,0,.46);font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.sm-dashboard-metric-value{margin-top:9px;font-size:24px;font-weight:730;line-height:1;letter-spacing:-.025em}.sm-dashboard-metric-value small{margin-left:5px;color:rgba(0,0,0,.43);font-size:16px;font-weight:600}.sm-dashboard-metric-card p{height:17px;margin:10px 0 9px;overflow:hidden;color:rgba(0,0,0,.54);font-size:11px;font-weight:550;white-space:nowrap;text-overflow:ellipsis}.sm-dashboard-metric-card p.is-warning{color:#d97706;font-weight:650}.sm-dashboard-progress-track{position:relative;display:block;width:100%;height:4px!important;min-height:4px!important;max-height:4px!important;flex:0 0 4px;overflow:hidden;border-radius:999px;background:rgba(0,0,0,.075)}.sm-dashboard-progress-track>span{position:absolute;top:0;bottom:0;left:0;display:block;height:4px!important;min-height:4px!important;max-height:4px!important;border-radius:999px}
        .sm-dashboard-middle{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);gap:10px}.sm-dashboard-bottom{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(360px,1fr);gap:10px}.sm-dashboard-card{min-width:0;overflow:hidden;border:1px solid rgba(0,0,0,.06);border-radius:10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.045)}.sm-dashboard-card-head{min-height:58px;padding:15px 16px 11px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(0,0,0,.035)}.sm-dashboard-card-title h2{margin:0;font-size:16px;font-weight:700;line-height:1.2;letter-spacing:-.012em}.sm-dashboard-card-title p{margin:5px 0 0;color:rgba(0,0,0,.5);font-size:11px;font-weight:550}.sm-dashboard-card-filter{display:flex;align-items:center}
        .sm-dashboard-basis-segment{display:inline-flex;padding:2px;border:1px solid rgba(0,0,0,.08);border-radius:9px;background:rgba(0,0,0,.04);gap:2px}.sm-dashboard-basis-segment button{height:26px;padding:0 9px;border:0;outline:0;border-radius:7px;background:transparent;color:rgba(0,0,0,.58);font-family:inherit;font-size:10px;font-weight:700;line-height:1;cursor:pointer}.sm-dashboard-basis-segment button.is-active{background:linear-gradient(to bottom,#fff,#f5f5f5);color:#1f2937;box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07)}
        .sm-dashboard-category{padding:6px 16px 13px}.sm-dashboard-category-head,.sm-dashboard-category-row{display:grid;grid-template-columns:minmax(160px,1.15fr) minmax(150px,1fr) minmax(150px,1fr);column-gap:20px;align-items:center}.sm-dashboard-category-head{height:36px;color:rgba(0,0,0,.4);font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.sm-dashboard-category-row{min-height:45px;border-top:1px solid rgba(0,0,0,.045)}.sm-dashboard-category-row>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#34383d;font-size:12px;font-weight:650}.sm-dashboard-bar-value{display:grid;grid-template-columns:minmax(90px,1fr) 50px;align-items:center;gap:10px;color:#34383d;font-size:11px;font-weight:650}.sm-dashboard-legend{height:40px;display:flex;align-items:flex-end;justify-content:center;gap:28px;color:rgba(0,0,0,.54);font-size:10.5px}.sm-dashboard-legend span{display:flex;align-items:center;gap:6px}.sm-dashboard-legend i{width:11px;height:4px;border-radius:2px}
        .sm-dashboard-quality{padding:0 16px 12px}.sm-dashboard-quality-chart{display:block;width:100%;height:142px}.sm-dashboard-quality-list{border-top:1px solid rgba(0,0,0,.045)}.sm-dashboard-quality-row{height:29px;display:grid;grid-template-columns:minmax(160px,1fr) minmax(120px,1fr) 53px;gap:10px;align-items:center;border-bottom:1px solid rgba(0,0,0,.035);color:#34383d;font-size:11px}.sm-dashboard-quality-row:last-child{border-bottom:0}.sm-dashboard-quality-row strong{text-align:right;font-size:11px;font-weight:650}
        .sm-dashboard-table{padding:0 16px 10px}.sm-dashboard-table-head,.sm-dashboard-chain-row{display:grid;grid-template-columns:minmax(126px,1.2fr) 62px repeat(3,minmax(122px,1fr));column-gap:14px;align-items:center}.sm-dashboard-table-head{height:34px;color:rgba(0,0,0,.42);font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.sm-dashboard-chain-row{height:39px;border-top:1px solid rgba(0,0,0,.045);font-size:11px}.sm-dashboard-chain-metric{display:grid;grid-template-columns:49px minmax(60px,1fr);gap:8px;align-items:center}.sm-dashboard-chain-metric>span:first-child{white-space:nowrap}.sm-dashboard-na{color:rgba(0,0,0,.46);font-size:10px;white-space:nowrap}
        .sm-dashboard-region{padding:0 16px 11px}.sm-dashboard-region-head,.sm-dashboard-region-row{display:grid;grid-template-columns:1fr 60px repeat(2,minmax(120px,1fr));column-gap:15px;align-items:center}.sm-dashboard-region-head{height:34px;color:rgba(0,0,0,.42);font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.sm-dashboard-region-row{height:46px;border-top:1px solid rgba(0,0,0,.045);color:#34383d;font-size:11px}.sm-dashboard-region-metric{display:grid;grid-template-columns:49px minmax(60px,1fr);gap:8px;align-items:center}.sm-dashboard-region-note{min-height:45px;padding-top:13px;border-top:1px solid rgba(0,0,0,.045);color:rgba(0,0,0,.54);font-size:10.5px}.sm-dashboard-region-note strong{color:#373b41;font-weight:700}
        @media(max-width:1450px){.sm-dashboard-toolbar{flex-wrap:wrap}.sm-dashboard-filter-row{margin-left:0;flex:1;justify-content:flex-end}.sm-dashboard-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.sm-dashboard-middle,.sm-dashboard-bottom{grid-template-columns:1fr}.sm-dashboard-page{min-width:920px}}
        @media print{nav,header,.sm-dashboard-toolbar{display:none!important}.sm-dashboard-page{min-width:0}.sm-dashboard-shell{border:0;background:#fff}.sm-dashboard-content{margin:0}.sm-dashboard-middle,.sm-dashboard-bottom{break-inside:avoid}main{padding:0!important}}
      `}</style>

      <section className="sm-dashboard-shell">
        <div className="sm-dashboard-shell-head">
          <span>Shelf Merchandising · Auswertung</span>
          <span>Mai 2026 · 947 Besuche</span>
        </div>

        <div className="sm-dashboard-content">
          <div className="sm-dashboard-toolbar">
            <div className="sm-dashboard-search-field">
              <span className="sm-dashboard-filter-label">Suche</span>
              <label className="sm-dashboard-search">
                <Search size={12} strokeWidth={2} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Markt oder SM suchen…" />
                {search ? <button type="button" aria-label="Suche leeren" onClick={() => setSearch("")}><X size={11} strokeWidth={2} /></button> : null}
              </label>
            </div>
            <div className="sm-dashboard-filter-row">
              <DashboardFilter label="Region" value={filters.region === "Alle" ? null : filters.region} placeholder="Alle Regionen" options={FILTER_OPTIONS.region.filter((option) => option.value !== "Alle")} minWidth={122} onChange={(value) => setFilter("region", value ?? "Alle")} />
              <DashboardFilter label="Handelskette" value={filters.chain === "Alle" ? null : filters.chain} placeholder="Alle Handelsketten" options={FILTER_OPTIONS.chain.filter((option) => option.value !== "Alle")} minWidth={154} onChange={(value) => setFilter("chain", value ?? "Alle")} />
              <DashboardFilter label="Shelf Merchandiser" value={filters.sm === "Alle" ? null : filters.sm} placeholder="Alle SMs" options={FILTER_OPTIONS.sm.filter((option) => option.value !== "Alle")} minWidth={154} onChange={(value) => setFilter("sm", value ?? "Alle")} />
              <DashboardFilter label="Ansicht" value={filters.basis} placeholder="Markt-Ø" options={FILTER_OPTIONS.basis} minWidth={138} allowClear={false} active={filters.basis !== "Markt-Ø"} onChange={(value) => setFilter("basis", value ?? "Markt-Ø")} />
              <div className="sm-dashboard-reset-shell">
                <span className="sm-dashboard-filter-label">Aktion</span>
                <button type="button" disabled={!activeFilterCount} className={`sm-dashboard-reset${activeFilterCount ? " has-filters" : ""}`} onClick={resetFilters}>
                  <RotateCcw size={11} strokeWidth={2.2} /> Alle Filter zurücksetzen
                </button>
              </div>
            </div>
          </div>

          <div className="sm-dashboard-metrics">
            <MetricCard label="Besuche" value="947" suffix="/ 947" detail="100 % abgeschlossen" tone="green" progress={100} />
            <MetricCard label="Stammmärkte" value="149" detail="⚠ Deck nennt 150" tone="amber" progress={99.3} />
            <MetricCard label="Ausführungsqualität" value="96,4 %" detail="28.920 / 29.992 Punkte" progress={96.4} />
            <MetricCard label="OOS-Quote" value="12,4 %" detail="Markt-Ø · 53 Märkte betroffen" tone="red" progress={32} />
            <MetricCard label="OOS behoben" value="81,3 %" detail="Markt-Ø · 53 relevante Märkte" tone="green" progress={81.3} />
            <MetricCard label="Ist-Zeit" value="1.628 h" detail="Ø 1,72 h je Besuch" progress={86} />
          </div>

          <div className="sm-dashboard-middle">
            <article className="sm-dashboard-card">
              <div className="sm-dashboard-card-head">
                <div className="sm-dashboard-card-title"><h2>OOS & Behebung nach Kategorie</h2></div>
                <div className="sm-dashboard-card-filter">
                  <BasisSegment value={filters.basis} onChange={(value) => setFilter("basis", value)} />
                </div>
              </div>
              <div className="sm-dashboard-category">
                <div className="sm-dashboard-category-head"><span>Kategorie</span><span>OOS vorhanden</span><span>OOS behoben</span></div>
                {categoryRows.map((row) => (
                  <div key={row.label} className="sm-dashboard-category-row">
                    <strong>{row.label}</strong>
                    <span className="sm-dashboard-bar-value"><DashboardBar value={row.oos} max={35} tone="red" /><span>{formatPercent(row.oos)}</span></span>
                    <span className="sm-dashboard-bar-value"><DashboardBar value={row.fixed} tone="green" /><span>{formatPercent(row.fixed)}</span></span>
                  </div>
                ))}
                <div className="sm-dashboard-legend"><span><i style={{ background: "#ef2028" }} />OOS vorhanden</span><span><i style={{ background: "#159447" }} />OOS behoben</span></div>
              </div>
            </article>

            <article className="sm-dashboard-card">
              <div className="sm-dashboard-card-head"><div className="sm-dashboard-card-title"><h2>Ausführungsqualität</h2></div></div>
              <div className="sm-dashboard-quality">
                <QualityChart />
                <div className="sm-dashboard-quality-list">
                  {QUALITY_SECTIONS.map((section) => <div key={section.label} className="sm-dashboard-quality-row"><span>{section.label}</span><DashboardBar value={section.value} tone="gray" /><strong>{formatPercent(section.value)}</strong></div>)}
                </div>
              </div>
            </article>
          </div>

          <div className="sm-dashboard-bottom">
            <article className="sm-dashboard-card">
              <div className="sm-dashboard-card-head"><div className="sm-dashboard-card-title"><h2>Handelsketten im Vergleich</h2><p>Ausführungsqualität · Besuchsgewichtet</p></div></div>
              <div className="sm-dashboard-table">
                <div className="sm-dashboard-table-head"><span>Kette</span><span>Besuche</span><span>Qualität</span><span>OOS Markt-Ø</span><span>Behoben</span></div>
                {visibleChains.length ? visibleChains.map((row) => (
                  <div key={row.label} className="sm-dashboard-chain-row">
                    <span><ChainPill label={row.label} /></span><span>{row.visits}</span>
                    <span className="sm-dashboard-chain-metric"><span>{formatPercent(row.quality)}</span><DashboardBar value={row.quality} tone="gray" /></span>
                    <span className="sm-dashboard-chain-metric"><span>{formatPercent(row.oos)}</span><DashboardBar value={row.oos} max={30} tone="red" /></span>
                    {row.fixed === null ? <span className="sm-dashboard-na">nicht erforderlich</span> : <span className="sm-dashboard-chain-metric"><span>{formatPercent(row.fixed)}</span><DashboardBar value={row.fixed} tone="green" /></span>}
                  </div>
                )) : <div style={{ padding: "38px 0", color: "rgba(0,0,0,.35)", fontSize: 10, textAlign: "center" }}>Keine Handelsketten für diese Auswahl.</div>}
              </div>
            </article>

            <article className="sm-dashboard-card">
              <div className="sm-dashboard-card-head"><div className="sm-dashboard-card-title"><h2>Regionen im Vergleich</h2><p>Markt-Ø · OOS vorhanden / behoben</p></div></div>
              <div className="sm-dashboard-region">
                <div className="sm-dashboard-region-head"><span>Region</span><span>Märkte</span><span>OOS</span><span>Behoben</span></div>
                {visibleRegions.map((row) => (
                  <div key={row.label} className="sm-dashboard-region-row">
                    <strong>{row.label}</strong><span>{row.markets}</span>
                    <span className="sm-dashboard-region-metric"><span>{formatPercent(row.oos)}</span><DashboardBar value={row.oos} max={20} tone="red" /></span>
                    <span className="sm-dashboard-region-metric"><span>{formatPercent(row.fixed)}</span><DashboardBar value={row.fixed} tone="green" /></span>
                  </div>
                ))}
                <div className="sm-dashboard-region-note">Höchster Handlungsbedarf: <strong>Süd</strong> bei Behebung · <strong>West</strong> bei OOS</div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
