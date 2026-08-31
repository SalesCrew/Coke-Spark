"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Store,
} from "lucide-react";

import { BackendApiError, fetchSmDashboard } from "@/lib/api/backend";
import { AdminDatePicker, AdminDropdown, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import type {
  SmDashboardDimensionRow,
  SmDashboardFilterOption,
  SmDashboardMetricSummary,
  SmDashboardPayload,
  SmDashboardQuery,
} from "@/types/smDashboard";

const RED = "#DC2626";
const GREEN = "#11965a";
const AMBER = "#d97706";

type DashboardFilters = {
  from: string;
  to: string;
  region: string;
  chain: string;
  smUserId: string;
  marketId: string;
};

function viennaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function initialFilters(): DashboardFilters {
  const to = viennaToday();
  return { from: `${to.slice(0, 7)}-01`, to, region: "", chain: "", smUserId: "", marketId: "" };
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-AT");
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    timeZone: "Europe/Vienna",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof BackendApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Das SM-Dashboard konnte nicht geladen werden.";
}

function progressWidth(value: number | null): string {
  return `${Math.max(0, Math.min(100, value ?? 0))}%`;
}

function MetricCard({
  label,
  value,
  detail,
  subdetail,
  tone = "neutral",
  progress,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  subdetail?: string;
  tone?: "neutral" | "red" | "green" | "amber";
  progress: number | null;
  icon: ReactNode;
}) {
  return (
    <article className={`sm-live-metric is-${tone}`}>
      <div className="sm-live-metric-top">
        <span className="sm-live-metric-icon">{icon}</span>
        <span className="sm-live-metric-label">{label}</span>
      </div>
      <strong className="sm-live-metric-value">{value}</strong>
      <p>{detail}</p>
      {subdetail ? <small>{subdetail}</small> : null}
      <span className="sm-live-progress" aria-hidden="true"><i style={{ width: progressWidth(progress) }} /></span>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: SmDashboardFilterOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const filterOptions = useMemo(() => [{ value: "", label: placeholder }, ...options], [options, placeholder]);
  return (
    <div className="sm-live-filter">
      <span>{label}</span>
      <AdminDropdown ariaLabel={label} value={value} options={filterOptions} placeholder={placeholder} onChange={onChange} searchable={options.length > 10} />
    </div>
  );
}

function RateCell({ value, tone }: { value: number | null; tone: "red" | "green" }) {
  return (
    <span className={`sm-live-rate is-${tone}`}>
      <span>{formatPercent(value)}</span>
      <i aria-hidden="true"><b style={{ width: progressWidth(value) }} /></i>
    </span>
  );
}

function DimensionTable({ title, subtitle, rows, emptyLabel }: {
  title: string;
  subtitle: string;
  rows: SmDashboardDimensionRow[];
  emptyLabel: string;
}) {
  return (
    <article className="sm-live-card">
      <div className="sm-live-card-head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      <div className="sm-live-dimension">
        <div className="sm-live-dimension-head">
          <span>Bereich</span><span>Besuche</span><span>OOS</span><span>Behoben</span><span>Märkte mit OOS</span>
        </div>
        {rows.length ? rows.map((row) => (
          <div className="sm-live-dimension-row" key={row.id}>
            <strong title={row.label}>{row.label}</strong>
            <span>{formatNumber(row.completedVisits)}</span>
            <span className="sm-live-case-count">{formatNumber(row.foundCases)}</span>
            <RateCell value={row.fixedRate} tone="green" />
            <RateCell value={row.affectedMarketRate} tone="red" />
          </div>
        )) : <div className="sm-live-empty-row">{emptyLabel}</div>}
      </div>
    </article>
  );
}

async function exportDashboardWorkbook(payload: SmDashboardPayload) {
  const XLSX = await import("xlsx-js-style");
  const workbook = XLSX.utils.book_new();
  const { summary } = payload;
  const overview = XLSX.utils.aoa_to_sheet([
    ["Shelf Merchandising · Live OOS-Auswertung"],
    ["Zeitraum", `${formatDate(payload.meta.from)} – ${formatDate(payload.meta.to)}`],
    ["Berechnet", new Date(payload.meta.generatedAt).toLocaleString("de-AT", { timeZone: payload.meta.timezone })],
    [],
    ["Kennzahl", "Wert", "Zähler", "Nenner"],
    ["Abgeschlossene Besuche", summary.completedVisits, summary.completedVisits, "—"],
    ["Besuchte Märkte", summary.submittedMarkets, summary.submittedMarkets, "—"],
    ["OOS gefunden", summary.foundCases, summary.foundCases, summary.classifiedChecks],
    ["OOS-Quote", summary.foundRate === null ? "nicht verfügbar" : summary.foundRate / 100, summary.foundCases, summary.classifiedChecks],
    ["OOS behoben", summary.fixedRate === null ? "nicht erforderlich" : summary.fixedRate / 100, summary.fixedCases, summary.foundCases],
    ["Märkte mit OOS", summary.affectedMarketRate === null ? "nicht verfügbar" : summary.affectedMarketRate / 100, summary.marketsWithOos, summary.observedMarkets],
    ["Offene Behebungsdokumentation", summary.openRemediationDocumentation, summary.openRemediationDocumentation, summary.foundCases],
  ]);
  overview["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 14 }];
  const categories = XLSX.utils.json_to_sheet(payload.categories.map((row) => ({
    Kategorie: row.label,
    "OOS-Prüfungen": row.classifiedChecks,
    "OOS gefunden": row.foundCases,
    "OOS-Quote (%)": row.foundRate ?? "—",
    "OOS behoben": row.fixedCases,
    "Behebungsquote (%)": row.fixedRate ?? "—",
    "Märkte mit OOS": row.marketsWithOos,
    "Geprüfte Märkte": row.observedMarkets,
  })));
  const dimensionSheet = (rows: SmDashboardDimensionRow[], label: string) => XLSX.utils.json_to_sheet(rows.map((row) => ({
    [label]: row.label,
    Besuche: row.completedVisits,
    "Besuchte Märkte": row.submittedMarkets,
    "OOS-Prüfungen": row.classifiedChecks,
    "OOS gefunden": row.foundCases,
    "OOS behoben (%)": row.fixedRate ?? "—",
    "Märkte mit OOS (%)": row.affectedMarketRate ?? "—",
  })));
  XLSX.utils.book_append_sheet(workbook, overview, "Übersicht");
  XLSX.utils.book_append_sheet(workbook, categories, "OOS Kategorien");
  XLSX.utils.book_append_sheet(workbook, dimensionSheet(payload.chains, "Handelskette"), "Handelsketten");
  XLSX.utils.book_append_sheet(workbook, dimensionSheet(payload.regions, "Region"), "Regionen");
  XLSX.writeFile(workbook, `CokeSpark_SM_OOS_${payload.meta.from}_${payload.meta.to}.xlsx`);
}

export function SmDashboardWorkspace() {
  const [filters, setFilters] = useState<DashboardFilters>(() => initialFilters());
  const [payload, setPayload] = useState<SmDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);
  const payloadRef = useRef<SmDashboardPayload | null>(null);

  const updateFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const query: SmDashboardQuery = {
      from: filters.from,
      to: filters.to,
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.chain ? { chain: filters.chain } : {}),
      ...(filters.smUserId ? { smUserId: filters.smUserId } : {}),
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
    };
    setError(null);
    if (payloadRef.current) setRefreshing(true);
    else setLoading(true);
    void fetchSmDashboard(query)
      .then((nextPayload) => {
        if (requestId !== requestIdRef.current) return;
        setPayload(nextPayload);
      })
      .catch((nextError: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(apiErrorMessage(nextError));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [filters, refreshKey]);

  useEffect(() => {
    const excelHandler = () => {
      if (payloadRef.current) void exportDashboardWorkbook(payloadRef.current);
    };
    const reportHandler = () => window.print();
    window.addEventListener("admin:sm-dashboard:export", excelHandler);
    window.addEventListener("sm-dashboard:export-report", reportHandler);
    return () => {
      window.removeEventListener("admin:sm-dashboard:export", excelHandler);
      window.removeEventListener("sm-dashboard:export-report", reportHandler);
    };
  }, []);

  const resetFilters = () => {
    setFilters(initialFilters());
  };
  const defaultRange = initialFilters();
  const hasDimensionFilters = Boolean(
    filters.from !== defaultRange.from
    || filters.to !== defaultRange.to
    || filters.region
    || filters.chain
    || filters.smUserId
    || filters.marketId,
  );
  const summary: SmDashboardMetricSummary | null = payload?.summary ?? null;

  return (
    <div className="sm-live-page">
      <AdminFilterControlStyles />
      <style>{`
        .sm-live-page{min-width:980px;color:#172033;font-variant-numeric:tabular-nums}.sm-live-page *{box-sizing:border-box}
        .sm-live-shell{overflow:hidden;border:1px solid rgba(15,23,42,.07);border-radius:15px;background:#f6f7f9;box-shadow:0 1px 2px rgba(15,23,42,.02)}
        .sm-live-shell-head{min-height:58px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(15,23,42,.055);background:rgba(255,255,255,.74)}
        .sm-live-eyebrow{display:block;margin-bottom:3px;color:${RED};font-size:9px;font-weight:800;letter-spacing:.085em;text-transform:uppercase}.sm-live-shell-head h1{margin:0;font-size:17px;font-weight:760;letter-spacing:-.02em}.sm-live-freshness{display:flex;align-items:center;gap:9px;color:#7b8494;font-size:10px;font-weight:650}.sm-live-refresh{width:30px;height:30px;border:1px solid rgba(15,23,42,.08);border-radius:8px;background:#fff;color:#667085;display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,.04)}.sm-live-refresh:hover{color:${RED};border-color:rgba(220,38,38,.18)}.sm-live-refresh:disabled{cursor:wait;opacity:.65}.sm-live-refresh.is-spinning svg{animation:sm-live-spin .8s linear infinite}@keyframes sm-live-spin{to{transform:rotate(360deg)}}
        .sm-live-content{padding:11px;display:flex;flex-direction:column;gap:11px}.sm-live-toolbar{padding:12px 13px;display:grid;grid-template-columns:repeat(2,138px) repeat(4,minmax(145px,1fr)) auto;align-items:end;gap:8px;border:1px solid rgba(15,23,42,.06);border-radius:12px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.035)}
        .sm-live-filter,.sm-live-date{min-width:0}.sm-live-filter>span,.sm-live-date>span{display:block;margin-bottom:5px;color:#8b93a1;font-size:8.5px;font-weight:760;letter-spacing:.065em;text-transform:uppercase}
        .sm-live-toolbar-actions{height:32px;display:flex;gap:6px}.sm-live-reset{height:32px;padding:0 10px;border:1px solid rgba(15,23,42,.08);border-radius:8px;background:#fff;color:#667085;font-family:inherit;font-size:10px;font-weight:600;white-space:nowrap;cursor:pointer}.sm-live-reset:disabled{opacity:.4;cursor:default}
        .sm-live-error{min-height:48px;padding:10px 13px;border:1px solid rgba(220,38,38,.15);border-radius:10px;background:#fff7f7;color:#9f1f24;display:flex;align-items:center;gap:9px;font-size:10.5px;font-weight:650}.sm-live-error button{margin-left:auto;border:0;background:transparent;color:${RED};font:750 10px/1 inherit;cursor:pointer}
        .sm-live-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.sm-live-metric{position:relative;min-height:151px;padding:14px 14px 13px;overflow:hidden;border:1px solid rgba(15,23,42,.06);border-radius:12px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.035)}.sm-live-metric:before{content:"";position:absolute;inset:0 0 auto;height:2px;background:#cbd0d8}.sm-live-metric.is-red:before{background:${RED}}.sm-live-metric.is-green:before{background:${GREEN}}.sm-live-metric.is-amber:before{background:${AMBER}}.sm-live-metric-top{display:flex;align-items:center;gap:7px}.sm-live-metric-icon{width:24px;height:24px;border-radius:7px;background:#f3f4f6;color:#7a8493;display:grid;place-items:center}.sm-live-metric.is-red .sm-live-metric-icon{background:#fff0f1;color:${RED}}.sm-live-metric.is-green .sm-live-metric-icon{background:#eaf9f1;color:${GREEN}}.sm-live-metric.is-amber .sm-live-metric-icon{background:#fff7e9;color:${AMBER}}.sm-live-metric-label{color:#7a8493;font-size:9px;font-weight:790;letter-spacing:.06em;text-transform:uppercase}.sm-live-metric-value{display:block;margin-top:12px;color:#111827;font-size:27px;font-weight:770;line-height:1;letter-spacing:-.035em}.sm-live-metric p{height:16px;margin:10px 0 0;overflow:hidden;color:#586174;font-size:10.5px;font-weight:650;white-space:nowrap;text-overflow:ellipsis}.sm-live-metric small{display:block;height:14px;margin-top:2px;overflow:hidden;color:#98a2b3;font-size:9px;font-weight:580;white-space:nowrap;text-overflow:ellipsis}.sm-live-progress{position:absolute;left:14px;right:14px;bottom:12px;height:4px;overflow:hidden;border-radius:99px;background:#eef0f3}.sm-live-progress i{display:block;height:100%;border-radius:inherit;background:#9ca3af}.sm-live-metric.is-red .sm-live-progress i{background:${RED}}.sm-live-metric.is-green .sm-live-progress i{background:${GREEN}}.sm-live-metric.is-amber .sm-live-progress i{background:${AMBER}}
        .sm-live-card{min-width:0;overflow:hidden;border:1px solid rgba(15,23,42,.06);border-radius:12px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.035)}.sm-live-card-head{min-height:59px;padding:13px 15px 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(15,23,42,.05)}.sm-live-card-head h2{margin:0;color:#172033;font-size:14px;font-weight:750;letter-spacing:-.012em}.sm-live-card-head p{margin:4px 0 0;color:#8a93a2;font-size:9.5px;font-weight:570}
        .sm-live-category{padding:0 15px 11px}.sm-live-category-head,.sm-live-category-row{display:grid;grid-template-columns:minmax(170px,1.15fr) 88px minmax(120px,1fr) 88px minmax(120px,1fr) 125px;align-items:center;column-gap:14px}.sm-live-category-head{height:34px;color:#98a2b3;font-size:8.5px;font-weight:780;letter-spacing:.06em;text-transform:uppercase}.sm-live-category-row{min-height:50px;border-top:1px solid rgba(15,23,42,.045);font-size:10.5px}.sm-live-category-row>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#344054;font-weight:690}.sm-live-category-row>span:not(.sm-live-rate){color:#596273;font-weight:650}.sm-live-market-ratio{font-size:10px!important}.sm-live-market-ratio b{color:${RED};font-weight:780}.sm-live-rate{display:grid;grid-template-columns:52px minmax(54px,1fr);align-items:center;gap:8px;color:#4b5565;font-size:9.5px;font-weight:690}.sm-live-rate>i{height:4px;overflow:hidden;border-radius:99px;background:#eef0f3}.sm-live-rate>i>b{display:block;height:100%;border-radius:inherit}.sm-live-rate.is-red>i>b{background:${RED}}.sm-live-rate.is-green>i>b{background:${GREEN}}
        .sm-live-bottom{display:grid;grid-template-columns:1.25fr .75fr;gap:11px}.sm-live-dimension{padding:0 15px 10px}.sm-live-dimension-head,.sm-live-dimension-row{display:grid;grid-template-columns:minmax(130px,1.05fr) 60px 55px minmax(118px,.9fr) minmax(135px,1fr);align-items:center;column-gap:12px}.sm-live-dimension-head{height:34px;color:#98a2b3;font-size:8.5px;font-weight:780;letter-spacing:.055em;text-transform:uppercase}.sm-live-dimension-row{min-height:45px;border-top:1px solid rgba(15,23,42,.045);color:#596273;font-size:10px;font-weight:630}.sm-live-dimension-row>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#344054;font-weight:700}.sm-live-case-count{color:${RED}!important;font-weight:780!important}.sm-live-empty-row{padding:34px 10px;border-top:1px solid rgba(15,23,42,.045);color:#98a2b3;text-align:center;font-size:10px;font-weight:620}
        .sm-live-loading{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.sm-live-skeleton{height:151px;border-radius:12px;background:linear-gradient(90deg,#fff,#f4f5f7,#fff);background-size:220% 100%;animation:sm-live-shimmer 1.25s infinite}@keyframes sm-live-shimmer{to{background-position:-220% 0}}
        @media(max-width:1450px){.sm-live-toolbar{grid-template-columns:repeat(4,minmax(145px,1fr))}.sm-live-bottom{grid-template-columns:1fr}.sm-live-page{min-width:920px}}@media(max-width:1180px){.sm-live-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media print{nav,header,.sm-live-toolbar,.sm-live-refresh{display:none!important}.sm-live-page{min-width:0}.sm-live-shell{border:0;background:#fff}.sm-live-content{padding:0}.sm-live-bottom{grid-template-columns:1fr}.sm-live-card,.sm-live-metric{break-inside:avoid}}
      `}</style>

      <section className="sm-live-shell">
        <header className="sm-live-shell-head">
          <div><span className="sm-live-eyebrow">Shelf Merchandising</span><h1>OOS Dashboard</h1></div>
          <div className="sm-live-freshness">
            {payload ? <span>{formatDate(payload.meta.from)} – {formatDate(payload.meta.to)} · berechnet {formatGeneratedAt(payload.meta.generatedAt)}</span> : <span>Live aus SM-Fragebögen</span>}
            <button type="button" className={`sm-live-refresh${refreshing ? " is-spinning" : ""}`} onClick={() => setRefreshKey((value) => value + 1)} disabled={refreshing} aria-label="Dashboard aktualisieren" title="Dashboard aktualisieren">
              <RefreshCw size={13} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div className="sm-live-content">
          <div className="sm-live-toolbar">
            <div className="sm-live-date"><span>Von</span><AdminDatePicker ariaLabel="Von" value={filters.from} maxDate={filters.to} onChange={(value) => updateFilter("from", value)} /></div>
            <div className="sm-live-date"><span>Bis</span><AdminDatePicker ariaLabel="Bis" value={filters.to} minDate={filters.from} onChange={(value) => updateFilter("to", value)} /></div>
            <FilterSelect label="Region" value={filters.region} options={payload?.filterOptions.regions ?? []} placeholder="Alle Regionen" onChange={(value) => updateFilter("region", value)} />
            <FilterSelect label="Handelskette" value={filters.chain} options={payload?.filterOptions.chains ?? []} placeholder="Alle Handelsketten" onChange={(value) => updateFilter("chain", value)} />
            <FilterSelect label="Shelf Merchandiser" value={filters.smUserId} options={payload?.filterOptions.sms ?? []} placeholder="Alle SMs" onChange={(value) => updateFilter("smUserId", value)} />
            <FilterSelect label="Markt" value={filters.marketId} options={payload?.filterOptions.markets ?? []} placeholder="Alle Märkte" onChange={(value) => updateFilter("marketId", value)} />
            <div className="sm-live-toolbar-actions"><button type="button" className="sm-live-reset" onClick={resetFilters} disabled={!hasDimensionFilters}>Filter zurücksetzen</button></div>
          </div>

          {error ? <div className="sm-live-error"><AlertCircle size={15} /><span>{error}</span><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Erneut laden</button></div> : null}

          {loading && !payload ? (
            <div className="sm-live-loading" aria-label="Dashboard wird geladen">{Array.from({ length: 5 }, (_, index) => <span className="sm-live-skeleton" key={index} />)}</div>
          ) : summary ? (
            <>
              <div className="sm-live-metrics">
                <MetricCard label="OOS gefunden" value={formatNumber(summary.foundCases)} detail={`${formatNumber(summary.foundCases)} von ${formatNumber(summary.classifiedChecks)} Prüfungen`} subdetail={`OOS-Quote ${formatPercent(summary.foundRate)}`} tone="red" progress={summary.foundRate} icon={<AlertCircle size={13} strokeWidth={2.3} />} />
                <MetricCard label="OOS behoben" value={formatPercent(summary.fixedRate)} detail={summary.foundCases ? `${formatNumber(summary.fixedCases)} von ${formatNumber(summary.foundCases)} Fällen` : "Nicht erforderlich"} subdetail={summary.foundCases ? "Nur nachgewiesene Behebung" : "Kein OOS im gewählten Bereich"} tone="green" progress={summary.fixedRate} icon={<CheckCircle2 size={13} strokeWidth={2.3} />} />
                <MetricCard label="Märkte mit OOS" value={formatPercent(summary.affectedMarketRate)} detail={`${formatNumber(summary.marketsWithOos)} von ${formatNumber(summary.observedMarkets)} geprüften Märkten`} subdetail="Nur Märkte mit klassifizierter OOS-Prüfung" tone="red" progress={summary.affectedMarketRate} icon={<Store size={13} strokeWidth={2.3} />} />
                <MetricCard label="Abgeschlossene Besuche" value={formatNumber(summary.completedVisits)} detail={`${formatNumber(summary.submittedMarkets)} besuchte Märkte`} subdetail="Eingereichte SM-Fragebögen" progress={summary.completedVisits ? 100 : 0} icon={<CalendarDays size={13} strokeWidth={2.3} />} />
                <MetricCard label="Dokumentation offen" value={formatNumber(summary.openRemediationDocumentation)} detail={`${formatNumber(summary.documentedRemediations)} von ${formatNumber(summary.foundCases)} OOS-Fällen dokumentiert`} subdetail={summary.openRemediationDocumentation ? "Behebungsantwort fehlt" : "Keine offene Behebungsdokumentation"} tone={summary.openRemediationDocumentation ? "amber" : "green"} progress={summary.foundCases ? (summary.documentedRemediations / summary.foundCases) * 100 : null} icon={<ClipboardCheck size={13} strokeWidth={2.3} />} />
              </div>

              <article className="sm-live-card">
                <div className="sm-live-card-head"><div><h2>OOS & Behebung nach Kategorie</h2><p>Fallzahl, Besuchsquote und Marktbetroffenheit aus denselben aktuellen Antworten</p></div></div>
                <div className="sm-live-category">
                  <div className="sm-live-category-head"><span>Kategorie</span><span>Gefunden</span><span>OOS-Quote</span><span>Behoben</span><span>Behebungsquote</span><span>Märkte mit OOS</span></div>
                  {(payload?.categories ?? []).map((row) => (
                    <div className="sm-live-category-row" key={row.category}>
                      <strong>{row.label}</strong>
                      <span>{formatNumber(row.foundCases)} / {formatNumber(row.classifiedChecks)}</span>
                      <RateCell value={row.foundRate} tone="red" />
                      <span>{formatNumber(row.fixedCases)} / {formatNumber(row.foundCases)}</span>
                      <RateCell value={row.fixedRate} tone="green" />
                      <span className="sm-live-market-ratio"><b>{formatNumber(row.marketsWithOos)}</b> / {formatNumber(row.observedMarkets)} · {formatPercent(row.affectedMarketRate)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <div className="sm-live-bottom">
                <DimensionTable title="Handelsketten im Vergleich" subtitle="Live-Fälle · Besuchsgewichtet" rows={payload?.chains ?? []} emptyLabel="Keine Handelsketten für diese Auswahl." />
                <DimensionTable title="Regionen im Vergleich" subtitle="Live-Fälle · Besuchsgewichtet" rows={payload?.regions ?? []} emptyLabel="Keine Regionen für diese Auswahl." />
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
