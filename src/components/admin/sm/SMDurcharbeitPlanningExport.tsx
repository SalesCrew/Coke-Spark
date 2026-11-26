"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FileSpreadsheet, LoaderCircle, Search, X } from "lucide-react";
import { AdminControlPortal, AdminDatePicker, AdminDropdown, SMDurcharbeitFilterTheme } from "@/components/admin/AdminFilterControls";
import { getAuthPrincipalKey, readAuthSession, requestSMDurcharbeitCampaign, subscribeAuthSession } from "@/lib/api/backend";
import { SMDurcharbeitExportDateRange, SMDurcharbeitExportPeriods, type SMDurcharbeitExportTime } from "@/lib/sm/SMDurcharbeitExportSelection";
import { SMDurcharbeitExportQuery, type SMDurcharbeitExportOptions, type SMDurcharbeitExportPreview, type SMDurcharbeitExportSelection, type SMDurcharbeitPlanningReport } from "@/types/smSMDurcharbeitExport";
import styles from "./SMDurcharbeitPlanningExport.module.css";

export const SMDurcharbeitPlanningExportEvent = "admin:sm-durcharbeit-planning:export";
const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;
const emptySelection = (): SMDurcharbeitExportSelection => ({ campaignIds: [], smUserIds: [], regions: [], chains: [], status: "all" });
const emptyTime = (): SMDurcharbeitExportTime => ({ mode: "all", week: "", month: "", from: "", to: "" });

function Choices({ title, options, selected, onChange, disabled, searchable = false }: {
  title: string; options: Array<{ value: string; label: string; description?: string }>; selected: string[];
  onChange: (values: string[]) => void; disabled: boolean; searchable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const visible = options.filter(option => option.label.toLocaleLowerCase("de-AT").includes(search.trim().toLocaleLowerCase("de-AT")));
  return <section className={styles.panel} aria-label={title}>
    <div className={styles.panelHead}><div><h3>{title}</h3><p className={styles.hint}>{selected.length ? `${selected.length} ausgewählt` : "Keine Auswahl bedeutet alle."}</p></div>
      <button type="button" className={styles.reset} disabled={disabled || !selected.length} onClick={() => onChange([])}>Alle</button></div>
    {searchable ? <label className={styles.search}><Search size={12} /><input aria-label={`${title} suchen`} placeholder="Suchen …" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} /></label> : null}
    <div className={styles.list}>{visible.map(option => <label key={option.value} className={styles.choice}>
      <input type="checkbox" disabled={disabled} checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter(value => value !== option.value) : [...selected, option.value])} />
      <span>{option.label}{option.description ? <small>{option.description}</small> : null}</span>
    </label>)}{!visible.length ? <p className={styles.hint}>Keine passenden Einträge.</p> : null}</div>
  </section>;
}

export function SMDurcharbeitPlanningExport() {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return owner ? <Export key={owner} /> : null;
}
function Export() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const show = () => setOpen(true); window.addEventListener(SMDurcharbeitPlanningExportEvent, show); return () => window.removeEventListener(SMDurcharbeitPlanningExportEvent, show); }, []);
  return open ? <ExportDialog onClose={() => setOpen(false)} /> : null;
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), generation = useRef(0), heading = useId();
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [options, setOptions] = useState<SMDurcharbeitExportOptions | null>(null), [catalogError, setCatalogError] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptySelection), [time, setTime] = useState(emptyTime), [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<{ key: string; data: SMDurcharbeitExportPreview | null; error: string | null }>({ key: "", data: null, error: null });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const range = useMemo(() => SMDurcharbeitExportDateRange(time), [time]);
  const query = range ? SMDurcharbeitExportQuery({ ...filters, ...range }) : null;
  const periods = useMemo(() => SMDurcharbeitExportPeriods(options?.range.from ?? null, options?.range.to ?? null), [options]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current; setPortal(dialog); dialog?.showModal();
    return () => { generation.current++; dialog?.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => {
    let active = true; setCatalogError(null);
    requestSMDurcharbeitCampaign<SMDurcharbeitExportOptions>("/export/options").then(data => { if (active) setOptions(data); })
      .catch(failure => { if (active) setCatalogError(failure instanceof Error ? failure.message : "Exportauswahl konnte nicht geladen werden."); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    const version = ++generation.current;
    setError(null);
    if (query === null || !options) return;
    setPreview({ key: query, data: null, error: null });
    const timer = window.setTimeout(() => {
      requestSMDurcharbeitCampaign<SMDurcharbeitExportPreview>(`/export/preview?${query}`)
        .then(data => { if (generation.current === version) setPreview({ key: query, data, error: null }); })
        .catch(failure => { if (generation.current === version) setPreview({ key: query, data: null, error: failure instanceof Error ? failure.message : "Auswahl konnte nicht geprüft werden." }); });
    }, 180);
    return () => { window.clearTimeout(timer); generation.current++; };
  }, [query, options, retry]);
  const data = preview.key === query ? preview.data : null;
  const currentError = error ?? catalogError ?? (preview.key === query ? preview.error : null);
  const update = <K extends keyof SMDurcharbeitExportSelection>(key: K, value: SMDurcharbeitExportSelection[K]) => { setError(null); setFilters(current => ({ ...current, [key]: value })); };
  const download = async () => {
    if (query === null || !data?.visits || busy) return;
    const version = generation.current, owner = ownerKey(); setBusy(true); setError(null);
    const current = () => generation.current === version && ownerKey() === owner;
    try {
      const report = await requestSMDurcharbeitCampaign<SMDurcharbeitPlanningReport>(`/export/report?${query}`);
      if (!current()) return;
      if (!report.visits.length) throw new Error("Für diese Auswahl liegen keine abgeschlossenen Besuche mehr vor. Bitte erneut prüfen.");
      const { exportSMDurcharbeitPlanningReport } = await import("@/lib/exports/smSMDurcharbeitPlanningExport");
      await exportSMDurcharbeitPlanningReport(report, current);
      if (current()) onClose();
    } catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Export konnte nicht erstellt werden."); }
    finally { setBusy(false); }
  };
  const chooseTime = (mode: SMDurcharbeitExportTime["mode"]) => { setError(null); setTime(current => ({ ...current, mode,
    week: current.week || periods.weeks[0]?.value || "", month: current.month || periods.months[0]?.value || "",
    from: current.from || options?.range.from || "", to: current.to || options?.range.to || "" })); };
  const chooseStatus = (status: SMDurcharbeitExportSelection["status"]) => {
    const allowed = new Set(options?.campaigns.filter(campaign => status === "all" || (status === "inactive" ? campaign.status === "archived" : campaign.status !== "archived")).map(campaign => campaign.id));
    setFilters(current => ({ ...current, status, campaignIds: current.campaignIds.filter(id => allowed.has(id)) }));
  };
  return <dialog ref={ref} aria-labelledby={heading} className={styles.dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className={styles.frame}>
      <header className={styles.header}><div><div className={styles.eyebrow}>Auswertungs-Export</div><h2 id={heading} className={styles.title}>Durcharbeit exportieren</h2>
        <p className={styles.description}>Wähle Durcharbeiten, Zeitraum und Mitarbeitende. Der Export enthält die abgeschlossenen Besuche mit ihren Antworten und Kommentaren.</p></div>
        <button type="button" aria-label="Export schließen" disabled={busy} onClick={onClose} className={styles.close}><X size={14} /></button></header>
      <AdminControlPortal container={portal}><SMDurcharbeitFilterTheme enabled>
      <div className={styles.body}>
        <div className={styles.stats} aria-live="polite">{[["Durcharbeiten", data?.campaigns], ["Märkte", data?.markets], ["Besuche", data?.visits]].map(([label, value]) => <div key={label} className={styles.stat}><div className={styles.eyebrow}>{label}</div><strong>{value ?? "—"}</strong><span>{data ? "in deiner Auswahl" : "wird geprüft"}</span></div>)}</div>
        {!options && !catalogError ? <p role="status" className={styles.loading}><LoaderCircle size={13} className="animate-spin" />Exportauswahl wird geladen …</p> : null}
        {currentError ? <div role="alert" className={styles.error}>{currentError} <button type="button" disabled={busy} className={styles.reset} onClick={() => { setError(null); setCatalogError(null); setOptions(null); setPreview({ key: "", data: null, error: null }); setRetry(value => value + 1); }}>Erneut versuchen</button></div> : null}
        {options ? <>
          <section className={styles.panel} aria-label="Exportzeitraum"><h3>Zeitraum</h3><p className={styles.hint}>Nach Kalenderwoche, Kalendermonat oder eigenem Zeitraum eingrenzen.</p>
            <div className={styles.tabs}>{([["all", "Alle"], ["week", "Woche"], ["month", "Monat"], ["range", "Zeitraum"]] as const).map(([mode, label]) => <button type="button" key={mode} disabled={busy} aria-pressed={time.mode === mode} onClick={() => chooseTime(mode)}>{label}</button>)}</div>
            {time.mode === "week" ? <AdminDropdown ariaLabel="Kalenderwoche für Export" value={time.week} options={periods.weeks} placeholder="Woche wählen" searchable disabled={busy} onChange={week => setTime(current => ({ ...current, week }))} /> : null}
            {time.mode === "month" ? <AdminDropdown ariaLabel="Kalendermonat für Export" value={time.month} options={periods.months} placeholder="Monat wählen" searchable disabled={busy} onChange={month => setTime(current => ({ ...current, month }))} /> : null}
            {time.mode === "range" ? <fieldset disabled={busy} className={styles.dates}><label>Von<AdminDatePicker ariaLabel="Export von" value={time.from} onChange={from => setTime(current => ({ ...current, from }))} /></label><label>Bis<AdminDatePicker ariaLabel="Export bis" value={time.to} minDate={time.from} onChange={to => setTime(current => ({ ...current, to }))} /></label></fieldset> : null}
            {!range ? <p className={styles.error}>Bitte einen vollständigen gültigen Zeitraum wählen.</p> : null}
          </section>
          <div className={styles.columns}><div className={styles.stack}>
            <Choices title="Durcharbeiten" options={options.campaigns.filter(campaign => filters.status === "all" || (filters.status === "inactive" ? campaign.status === "archived" : campaign.status !== "archived")).map(campaign => ({ value: campaign.id, label: campaign.name, description: `${campaign.from.split("-").reverse().join(".")} – ${campaign.to.split("-").reverse().join(".")}` }))} selected={filters.campaignIds} onChange={value => update("campaignIds", value)} disabled={busy} searchable />
            <AdminDropdown ariaLabel="Status der Durcharbeiten im Export" value={filters.status} options={[{ value: "all", label: "Alle Durcharbeiten" }, { value: "active", label: "Aktive Durcharbeiten" }, { value: "inactive", label: "Archivierte Durcharbeiten" }]} placeholder="Status" disabled={busy} onChange={value => chooseStatus(value as SMDurcharbeitExportSelection["status"])} />
            <Choices title="Regionen" options={options.regions.map(value => ({ value, label: value }))} selected={filters.regions} onChange={value => update("regions", value)} disabled={busy} />
          </div><div className={styles.stack}>
            <Choices title="SMs" options={options.people.map(person => ({ value: person.id, label: person.name }))} selected={filters.smUserIds} onChange={value => update("smUserIds", value)} disabled={busy} searchable />
            <Choices title="Handelsketten" options={options.chains.map(value => ({ value, label: value }))} selected={filters.chains} onChange={value => update("chains", value)} disabled={busy} />
          </div></div>
          <p className={styles.hint}>Eine Zeile je abgeschlossenem Besuch. Wiederholungsbesuche bleiben einzeln enthalten. Filter kombinieren sich miteinander.</p>
          {data?.visits === 0 ? <p role="status" className={styles.hint}>Für diese Auswahl liegen keine abgeschlossenen Besuche vor.</p> : null}
        </> : null}
      </div>
      <footer className={styles.footer}><button type="button" disabled={busy} className={styles.secondary} onClick={() => { setFilters(emptySelection()); setTime(emptyTime()); setError(null); }}>Filter zurücksetzen</button><div>
        <button type="button" disabled={busy} className={styles.secondary} onClick={onClose}>Abbrechen</button>
        <button type="button" disabled={busy || !data?.visits || query === null || Boolean(currentError)} className={styles.primary} onClick={() => void download()}>{busy ? <LoaderCircle size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}{busy ? "Antworten werden geladen …" : "Excel exportieren"}</button>
      </div></footer>
      </SMDurcharbeitFilterTheme></AdminControlPortal>
    </div>
  </dialog>;
}
