"use client";

import { useCustomerPageAccess } from "@/hooks/useCustomerPageAccess";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, ClipboardCheck, LoaderCircle, Plus, Search, X } from "lucide-react";
import { AdminControlPortal, AdminDatePicker, AdminDropdown, AdminFilterControlStyles, SMDurcharbeitFilterTheme } from "@/components/admin/AdminFilterControls";
import { requestSMDurcharbeitCampaign } from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import type { SMDurcharbeitCampaign, SMDurcharbeitCampaignDraft, SMDurcharbeitCampaignOptions, SMDurcharbeitMonthlySummary, SMDurcharbeitPublicationPreview, SMDurcharbeitTarget } from "@/types/smSMDurcharbeitCampaign";
import { SMDurcharbeitMonthlyReport } from "./SMDurcharbeitMonthlyReport";
import { SMDurcharbeitCampaignHistory } from "./SMDurcharbeitCampaignHistory";
import { SMDurcharbeitCampaignMarketsEditor } from "./SMDurcharbeitCampaignMarketsEditor";
import { filterSMDurcharbeitMarkets, updateSMDurcharbeitMarketSelection } from "@/lib/sm/SMDurcharbeitMarketSelection";
import styles from "./SMDurcharbeitCampaignWorkspace.module.css";

const primary = styles.primary;
const secondary = styles.secondary;
const field = styles.field;
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function monthName(month: string) { return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`)); }
function dateName(date: string) { return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function campaignStatus(campaign: SMDurcharbeitCampaign) {
  if (campaign.status === "draft") return { label: "Entwurf", tone: "neutral" };
  if (campaign.status === "archived") return { label: "Archiviert", tone: "neutral" };
  if (campaign.status === "paused") return { label: "Pausiert", tone: "paused" };
  if (today() > campaign.endDate) return { label: "Beendet", tone: "neutral" };
  if (today() < campaign.startDate) return { label: "Geplant", tone: "planned" };
  return { label: "Laufend", tone: "active" };
}
function campaignMonths(campaign: SMDurcharbeitCampaign) {
  const result: string[] = [];
  for (let date = new Date(`${campaign.startDate.slice(0, 7)}-01T12:00:00Z`); date.toISOString().slice(0, 7) <= campaign.endDate.slice(0, 7) && result.length < 24; date.setUTCMonth(date.getUTCMonth() + 1)) result.push(date.toISOString().slice(0, 10));
  return result;
}
function emptyDraft(): SMDurcharbeitCampaignDraft {
  const startDate = today(), end = new Date(`${startDate}T12:00:00Z`); end.setUTCMonth(Math.floor(end.getUTCMonth() / 3) * 3 + 3, 0);
  return { name: "", startDate, endDate: end.toISOString().slice(0, 10), questionnaireVersionId: "", rosterDraft: [] };
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><p className="mb-1.5 text-[10px] font-semibold text-gray-500">{label}</p>{children}</div>; }
function CampaignDialog({ title, children, onClose, error }: { title: string; children: ReactNode; onClose: () => void; error: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useEffect(() => { const dialog = ref.current; setPortalContainer(dialog); dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[min(520px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-black/[.06] bg-white p-5 shadow-2xl backdrop:bg-slate-950/20 [scrollbar-width:thin] [scrollbar-color:#d4d8de_transparent]">
    <header className="mb-4 flex items-center justify-between gap-3"><h2 id={titleId} className="text-[14px] font-semibold text-gray-900">{title}</h2><button type="button" onClick={onClose} aria-label="Dialog schließen" className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><X size={14} /></button></header>{error ? <p role="alert" className="mb-4 text-[11px] leading-relaxed text-red-700">{error}</p> : null}<AdminControlPortal container={portalContainer}>{children}</AdminControlPortal>
  </dialog>;
}

export function SmSMDurcharbeitCampaignWorkspace() {
  const { canWrite, canUpdate } = useCustomerPageAccess();
  const [campaigns, setCampaigns] = useState<SMDurcharbeitCampaign[]>([]), [options, setOptions] = useState<SMDurcharbeitCampaignOptions | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null), [month, setMonth] = useState(() => `${today().slice(0, 7)}-01`);
  const [draft, setDraft] = useState<SMDurcharbeitCampaignDraft | null>(null), [query, setQuery] = useState("");
  const [result, setResult] = useState<{ targets: SMDurcharbeitTarget[]; summary: SMDurcharbeitMonthlySummary } | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0), [preview, setPreview] = useState<SMDurcharbeitPublicationPreview | null>(null), [confirmOverlap, setConfirmOverlap] = useState(false);
  const [editTarget, setEditTarget] = useState<SMDurcharbeitTarget | null>(null), [editEligibility, setEditEligibility] = useState<"required" | "waived">("required"), [editScope, setEditScope] = useState("month");
  const [reason, setReason] = useState(""), [extend, setExtend] = useState(false), [endDate, setEndDate] = useState(""), [reactivate, setReactivate] = useState(false);
  const [marketDisplay, setMarketDisplay] = useState({ key: "", count: 100 });
  const [targetDisplay, setTargetDisplay] = useState({ key: "", count: 100 });
  const [cancelTarget, setCancelTarget] = useState<SMDurcharbeitTarget | null>(null);
  const [stateAction, setStateAction] = useState<SMDurcharbeitCampaign["status"] | null>(null);
  const [periodEdit, setPeriodEdit] = useState(false), [futureVersion, setFutureVersion] = useState("");
  const [marketEditor, setMarketEditor] = useState(false), [marketChain, setMarketChain] = useState("");
  const [targetFilter, setTargetFilter] = useState("required");
  const [changeSmTarget, setChangeSmTarget] = useState<SMDurcharbeitTarget | null>(null), [monthSm, setMonthSm] = useState("automatic");
  const pending = useRef(false), selected = campaigns.find(campaign => campaign.id === selectedId) ?? null;
  const reload = useCallback(() => setReloadKey(key => key + 1), []);
  useEffect(() => subscribeToAuthSessionChanges(() => { setCampaigns([]); setOptions(null); setResult(null); setDraft(null); setSelectedId(null); setPreview(null); setMarketEditor(false); setChangeSmTarget(null); reload(); }), [reload]);
  useEffect(() => {
    let current = true; setLoading(true);
    Promise.all([requestSMDurcharbeitCampaign<{ campaigns: SMDurcharbeitCampaign[] }>(""), requestSMDurcharbeitCampaign<SMDurcharbeitCampaignOptions>("/options")])
      .then(([list, options]) => { if (!current) return; setCampaigns(list.campaigns); setOptions(options); setError(null); setSelectedId(id => id && list.campaigns.some(campaign => campaign.id === id) ? id : list.campaigns.find(campaign => campaign.status === "published")?.id ?? list.campaigns[0]?.id ?? null); })
      .catch(error => { if (current) setError(error instanceof Error ? error.message : "Kampagnen konnten nicht geladen werden."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reloadKey]);
  useEffect(() => {
    if (!selected || selected.status === "draft") { setResult(null); return; }
    let current = true; setResult(null);
    requestSMDurcharbeitCampaign<{ targets: SMDurcharbeitTarget[]; summary: SMDurcharbeitMonthlySummary }>(`/${selected.id}/targets?month=${encodeURIComponent(month)}`)
      .then(result => { if (current) setResult(result); }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Monatsziele konnten nicht geladen werden."); });
    return () => { current = false; };
  }, [selected, month, reloadKey]);
  const act = async (action: () => Promise<void>) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Die Änderung konnte nicht gespeichert werden."); }
    finally { pending.current = false; setBusy(false); }
  };
  const choose = (campaign: SMDurcharbeitCampaign) => {
    setSelectedId(campaign.id); setDraft(campaign.status === "draft" && (canWrite || canUpdate) ? { name: campaign.name, startDate: campaign.startDate, endDate: campaign.endDate, questionnaireVersionId: campaign.questionnaireVersionId, rosterDraft: campaign.rosterDraft } : null);
    const months = campaignMonths(campaign), currentMonth = `${today().slice(0, 7)}-01`; setMonth(months.includes(currentMonth) ? currentMonth : months[0] ?? currentMonth); setError(null);
  };
  const rosterByMarket = useMemo(() => new Map(draft?.rosterDraft.map(row => [row.smMarketId, row]) ?? []), [draft?.rosterDraft]);
  const visibleMarkets = useMemo(() => filterSMDurcharbeitMarkets(options?.markets ?? [], marketChain, query), [options?.markets, marketChain, query]);
  const marketChains = [{ value: "", label: "Alle Handelsketten" }, ...[...new Set(options?.markets.map(row => row.chain).filter(Boolean) ?? [])].sort((a, b) => a.localeCompare(b, "de-AT")).map(value => ({ value, label: value }))];
  const marketDisplayKey = `${selectedId ?? "new"}:${marketChain}:${query}`;
  const marketDisplayCount = marketDisplay.key === marketDisplayKey ? marketDisplay.count : 100;
  const visibleTargets = result?.targets.filter(target => targetFilter === "all" || target.eligibility === targetFilter) ?? [];
  const targetDisplayKey = `${selectedId}:${month}:${targetFilter}`;
  const targetDisplayCount = targetDisplay.key === targetDisplayKey ? targetDisplay.count : 100;
  const updateRoster = (marketId: string, checked = true) => {
    if (!draft) return;
    const next = new Map(draft.rosterDraft.map(row => [row.smMarketId, row]));
    if (!checked) next.delete(marketId); else next.set(marketId, { smMarketId: marketId, smUserId: options?.markets.find(market => market.id === marketId)?.assignedSmUserId ?? null });
    setDraft({ ...draft, rosterDraft: [...next.values()] });
  };
  const selectFiltered = (action: "include" | "exclude" | "only") => {
    if (!draft || !options) return;
    const ids = updateSMDurcharbeitMarketSelection(new Set(draft.rosterDraft.map(row => row.smMarketId)), visibleMarkets.map(row => row.id), action);
    setDraft({ ...draft, rosterDraft: [...ids].map(smMarketId => rosterByMarket.get(smMarketId) ?? { smMarketId, smUserId: options.markets.find(row => row.id === smMarketId)?.assignedSmUserId ?? null }) });
  };
  const saveDraft = async () => {
    if (!draft || !(selectedId ? canUpdate : canWrite)) return;
    await act(async () => {
      const response = await requestSMDurcharbeitCampaign<{ campaign: SMDurcharbeitCampaign }>(selected?.status === "draft" ? `/${selected.id}` : "", { ...draft, ...(selected?.status === "draft" ? { expectedRevision: selected.revision } : {}) }, selected?.status === "draft" ? "PATCH" : "POST");
      setSelectedId(response.campaign.id); setDraft(null); reload();
    });
  };
  const showPreview = () => { if (selected) void act(async () => { setPreview(await requestSMDurcharbeitCampaign<SMDurcharbeitPublicationPreview>(`/${selected.id}/preview`)); setConfirmOverlap(false); }); };
  const peopleById = new Map(options?.people.map(person => [person.id, `${person.firstName} ${person.lastName}`.trim()]));
  const questionnaires = options?.questionnaires.map(questionnaire => ({ value: questionnaire.id, label: questionnaire.name, description: `Version ${questionnaire.versionNumber}` })) ?? [];
  const editableMonths = selected ? campaignMonths(selected).filter(value => value >= `${today().slice(0, 7)}-01`) : [];
  const monthDefaultSm = options?.people.find(person => person.id === options?.markets.find(market => market.id === changeSmTarget?.market.id)?.assignedSmUserId);
  return <SMDurcharbeitFilterTheme enabled><AdminFilterControlStyles /><div className={styles.workspace}>
    <header className={styles.toolbar}>
      <span className={styles.eyebrow}>Monatliche Kampagnen</span>
      <div className={styles.compactCampaigns}><AdminDropdown
        value={selectedId ?? ""}
        options={campaigns.map(campaign => ({ value: campaign.id, label: campaign.name, description: `${campaignStatus(campaign).label} · ${dateName(campaign.startDate)} – ${dateName(campaign.endDate)}` }))}
        onChange={id => { const campaign = campaigns.find(row => row.id === id); if (campaign) choose(campaign); }}
        ariaLabel="Durcharbeit-Kampagne auswählen" placeholder={loading ? "Kampagnen werden geladen…" : "Kampagne auswählen"} disabled={busy || loading || !campaigns.length} searchable
      /></div>
      <div className={styles.actions}>
        <Link href="/admin/sm/durcharbeit-verplanung/alt" className={secondary}>Datierte Einsätze</Link>
        <button type="button" disabled={!canWrite || busy} onClick={() => { setSelectedId(null); setDraft(emptyDraft()); setResult(null); setError(null); }} className={primary}><Plus size={12} />Kampagne erstellen</button>
      </div>
    </header>
    {error ? <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-white px-4 py-3"><p role="alert" className="text-[11px] leading-relaxed text-red-700">{error}</p><button type="button" disabled={busy} onClick={reload} className={secondary}>Neu laden</button></div> : null}
    <div className={styles.layout}>
      <aside aria-label="Durcharbeit-Kampagnen" className={styles.campaigns}>
        <h2 className={styles.campaignsHeader}>Kampagnen <span className={styles.count}>{campaigns.length}</span></h2>
        {loading && !campaigns.length ? <div role="status" className={`${styles.loading} motion-safe:animate-pulse`}><span className="sr-only">Kampagnen werden geladen</span>{[0, 1, 2].map(i => <div key={i} className={styles.loadingRow} />)}</div>
          : !campaigns.length ? <p className={styles.empty}>Noch keine monatlichen Kampagnen. Bestehende datierte Einsätze bleiben über den Verlauf erreichbar.</p>
            : <ul>{campaigns.map(campaign => <li key={campaign.id}>
              <button type="button" disabled={busy} aria-pressed={selectedId === campaign.id} onClick={() => choose(campaign)} className={styles.campaignButton}>
                <span className="min-w-0"><span className={styles.campaignName}>{campaign.name}</span><span className={styles.campaignMeta}>{campaignStatus(campaign).label} · {dateName(campaign.startDate)} – {dateName(campaign.endDate)}</span></span>
                <ChevronRight size={12} className="shrink-0 text-gray-400" />
              </button>
            </li>)}</ul>}
      </aside>
      <section className={styles.content}>
        {draft ? <div className={`${styles.surface} ${styles.draft}`}><h2 className={styles.draftHeading}><ClipboardCheck size={16} className="text-blue-600" />Kampagnenentwurf</h2><div className={styles.fields}><Field label="Name"><input aria-label="Kampagnenname" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={field} /></Field><Field label="Fragebogen"><AdminDropdown value={draft.questionnaireVersionId} options={questionnaires} onChange={questionnaireVersionId => setDraft({ ...draft, questionnaireVersionId })} ariaLabel="Durcharbeit-Fragebogen" placeholder="Fragebogen wählen" searchable disabled={busy} /></Field><Field label="Beginn"><AdminDatePicker value={draft.startDate} onChange={startDate => setDraft({ ...draft, startDate })} ariaLabel="Kampagnenbeginn" /></Field><Field label="Ende"><AdminDatePicker value={draft.endDate} minDate={draft.startDate} onChange={endDate => setDraft({ ...draft, endDate })} ariaLabel="Kampagnenende" /></Field></div>
          <div className={styles.draftMarketsHeader}><h3 className="text-[12px] font-semibold text-gray-700">Märkte <span className="ml-1 text-gray-600">{draft.rosterDraft.length}</span></h3><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !options || !visibleMarkets.length} onClick={() => selectFiltered("include")} className={secondary}>{marketChain || query.trim() ? "Gefilterte Märkte auswählen" : "Alle Märkte auswählen"}</button>{marketChain || query.trim() ? <button type="button" disabled={busy || !visibleMarkets.length} onClick={() => selectFiltered("only")} className={secondary}>Nur diese Märkte</button> : null}<button type="button" disabled={busy || !visibleMarkets.length} onClick={() => selectFiltered("exclude")} className={secondary}>Auswahl aufheben</button></div></div>
          <p className="mt-2 text-[11px] text-gray-500">Der SM wird automatisch aus der gespeicherten Verplanung im Durcharbeit-Marktbestand übernommen.</p>
          <div className={styles.draftMarketFilters}><AdminDropdown value={marketChain} options={marketChains} onChange={setMarketChain} ariaLabel="Handelskette der Entwurfsmarktauswahl" placeholder="Alle Handelsketten" disabled={busy} /><label className={styles.search}><Search size={12} className="text-gray-600" /><input aria-label="Durcharbeit-Märkte suchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Markt, Adresse oder Verplanung suchen" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" /></label></div>
          <div className={styles.marketList}>{visibleMarkets.slice(0, marketDisplayCount).map(market => { const row = rosterByMarket.get(market.id); return <div key={market.id} className="flex flex-wrap items-center gap-3 border-b border-black/[.04] px-3 py-2.5 last:border-0"><input type="checkbox" aria-label={`${market.name} auswählen`} checked={Boolean(row)} disabled={busy} onChange={event => updateRoster(market.id, event.target.checked)} className="accent-blue-600" /><div className="min-w-[180px] flex-1"><p className="text-[11px] font-semibold text-gray-700">{market.name}</p><p className="mt-0.5 text-[10px] text-gray-600">{market.address} · {market.postalCode} {market.city}</p>{market.sourcePerson ? <p className="mt-0.5 text-[10px] text-gray-600">Verplanung: {market.sourcePerson}</p> : null}</div><p className={`text-[11px] ${market.assignedSmUserId && peopleById.has(market.assignedSmUserId) ? "text-gray-600" : "text-red-700"}`}>{market.assignedSmUserId && peopleById.get(market.assignedSmUserId) || "Keine gültige SM-ID hinterlegt"}</p></div>; })}{!visibleMarkets.length ? <p className="p-4 text-[11px] text-gray-600">Keine passenden Durcharbeit-Märkte.</p> : null}</div>
          {visibleMarkets.length > marketDisplayCount ? <button type="button" className={`${secondary} mt-3`} onClick={() => setMarketDisplay({ key: marketDisplayKey, count: marketDisplayCount + 100 })}>Weitere Märkte · {marketDisplayCount}/{visibleMarkets.length}</button> : null}
          <footer className={styles.draftFooter}><button type="button" disabled={busy} onClick={() => setDraft(null)} className={secondary}>Abbrechen</button><button type="button" disabled={!(selectedId ? canUpdate : canWrite) || (busy || !draft.name.trim() || !draft.questionnaireVersionId)} onClick={() => void saveDraft()} className={primary}>{busy ? <LoaderCircle size={12} className="motion-safe:animate-spin" /> : <Check size={12} />}Entwurf speichern</button></footer>
        </div> : selected ? <>
          <div className={`${styles.surface} ${styles.campaignHeader}`}>
            <div className={styles.headerTop}>
              <div className={styles.identity}>
                <h2 className={styles.title}>{selected.name}</h2>
                <div className={styles.metadata}>
                  <span className={styles.date}><CalendarDays size={11} />{dateName(selected.startDate)} – {dateName(selected.endDate)}</span>
                  <span className={styles.status} data-tone={campaignStatus(selected).tone}>{campaignStatus(selected).label}</span>
                </div>
              </div>
              <div className={styles.actions}>
                {selected.status === "draft" ? <>
                  <button type="button" onClick={() => choose(selected)} className={secondary} disabled={!canUpdate}>Bearbeiten</button>
                  <button type="button" disabled={!canUpdate || busy} onClick={showPreview} className={primary}>Vorschau &amp; Veröffentlichen</button>
                </> : selected.status !== "archived" ? <>
                  <button type="button" disabled={!canUpdate || busy || !options || !editableMonths.length || selected.endDate < today()} onClick={() => setMarketEditor(true)} className={secondary}>Märkte bearbeiten</button>
                  <button type="button" disabled={!canUpdate || busy} onClick={() => { setExtend(true); setEndDate(selected.endDate); setReason(""); setReactivate(false); }} className={secondary}>Verlängern</button>
                  <button type="button" disabled={!canUpdate || busy} onClick={() => { setStateAction(selected.status === "paused" ? "published" : "paused"); setReason(""); }} className={secondary}>{selected.status === "paused" ? "Fortsetzen" : "Pausieren"}</button>
                  <button type="button" disabled={!canUpdate || busy} onClick={() => { setStateAction("archived"); setReason(""); }} className={secondary}>Archivieren</button>
                </> : null}
              </div>
            </div>
            {selected.status === "draft" ? <p className="mt-4 text-[11px] leading-5 text-gray-600">Der Entwurf ist für SMs noch nicht sichtbar. Vor der Veröffentlichung werden Zuordnungen und Überschneidungen geprüft.</p> : null}
          </div>
          {selected.status !== "draft" ? <section className={styles.tableFrame} aria-labelledby="SMDurcharbeit-monthly-targets">
            <header className={styles.frameHeader}>
              <h3 id="SMDurcharbeit-monthly-targets" className={styles.sectionTitle}>Monatsziele</h3>
              <span className={styles.count}>{result ? `${result.summary.required} erforderliche Märkte` : "Wird geladen…"}</span>
            </header>
            <div className={styles.tableSurface}>
              <div className={styles.tableToolbar}>
                <div className={styles.monthControl}><AdminDropdown value={month} options={campaignMonths(selected).map(value => ({ value, label: monthName(value) }))} onChange={setMonth} ariaLabel="Kampagnenmonat" placeholder="Monat auswählen" /></div>
                <div className={styles.actions}>
                  <AdminDropdown compact value={targetFilter} options={[{ value: "required", label: "Aktive Märkte" }, { value: "waived", label: "Ausgenommene Märkte" }, { value: "all", label: "Alle Märkte" }]} onChange={setTargetFilter} ariaLabel="Marktstatus der Monatsziele" placeholder="Marktstatus" />
                  {month > `${today().slice(0, 7)}-01` && selected.status !== "archived" ? <button type="button" disabled={busy} onClick={() => { setPeriodEdit(true); setFutureVersion(""); setReason(""); }} className={secondary}>Fragebogen für diesen Monat</button> : null}
                </div>
              </div>
              <div className={styles.metrics} aria-live="polite">
                {result ? <>
                  <span className={styles.metric}><strong>{result.summary.completed}/{result.summary.required}</strong> erledigt</span>
                  <span className={styles.metric}><strong>{result.summary.waived}</strong> ausgenommen</span>
                  <span className={styles.metric}><strong>{result.summary.physicalVisits}</strong> tatsächliche Besuche</span>
                </> : <span className="h-3 w-48 rounded bg-gray-100 motion-safe:animate-pulse"><span className="sr-only">Monatsziele werden geladen</span></span>}
              </div>
              {!result ? <div role="status" className={`${styles.loading} motion-safe:animate-pulse`}>{[0, 1, 2].map(id => <div key={id} className={styles.loadingRow} />)}</div>
                : <div className={styles.scrollRegion} role="region" aria-label="Monatsziele der Durcharbeit-Kampagne" tabIndex={0}>
                  <table className={styles.table}>
                    <thead><tr><th scope="col">Markt</th><th scope="col">SM</th><th scope="col">Monatsstand</th><th scope="col" className={styles.visits}>Besuche</th><th scope="col"><span className="sr-only">Aktionen</span></th></tr></thead>
                    <tbody>{visibleTargets.slice(0, targetDisplayCount).map(target => <tr key={target.id}>
                      <td><p className={styles.marketName}>{target.market.name}</p><p className={styles.marketAddress}>{target.market.address} · {target.market.city}</p></td>
                      <td className={styles.owner}>{target.smName}{target.SMDurcharbeitSmOverride ? <p className={styles.override}>Nur {monthName(target.month)}</p> : null}</td>
                      <td><span className={styles.status} data-tone={target.eligibility === "waived" ? "neutral" : target.completed ? "active" : target.draftVisitId ? "planned" : "neutral"}>{target.eligibility === "waived" ? "Ausgenommen" : target.completed ? "Erledigt" : target.draftVisitId ? "In Arbeit" : "Offen"}</span></td>
                      <td className={styles.visits}>{target.visitCount}</td>
                      <td><div className={styles.rowActions}>
                        {selected.status !== "archived" && selected.endDate >= today() && target.month >= `${today().slice(0, 7)}-01` && !target.completed && !target.draftVisitId ? <button type="button" disabled={!canUpdate || busy} className={secondary} aria-label={`SM für ${target.market.name} wechseln`} onClick={() => { setChangeSmTarget(target); setMonthSm(target.SMDurcharbeitSmOverride ? target.smUserId ?? "automatic" : "automatic"); setReason(""); setError(null); }}>SM wechseln</button> : null}
                        {target.latestSubmissionId ? <Link href={`/admin/sm/fbmanagement?submissionId=${encodeURIComponent(target.latestSubmissionId)}`} className={secondary}>Antworten</Link> : null}
                        {target.draftVisitId ? <button type="button" disabled={!canUpdate || busy} onClick={() => { setCancelTarget(target); setReason(""); }} className={secondary}>Entwurf verwerfen</button> : null}
                        {selected.status !== "archived" && target.month >= `${today().slice(0, 7)}-01` ? <button type="button" disabled={!canUpdate || busy} onClick={() => { setEditTarget(target); setEditEligibility(target.eligibility); setEditScope("month"); setReason(""); }} className={secondary}>Marktstatus</button> : null}
                      </div></td>
                    </tr>)}</tbody>
                  </table>
                  {visibleTargets.length > targetDisplayCount ? <div className="p-4"><button type="button" className={secondary} onClick={() => setTargetDisplay({ key: targetDisplayKey, count: targetDisplayCount + 100 })}>Weitere Monatsziele · {targetDisplayCount}/{visibleTargets.length}</button></div> : null}
                  {!visibleTargets.length ? <p className={styles.empty}>Keine Monatsziele in diesem Zeitraum.</p> : null}
                </div>}
            </div>
          </section> : null}
          {selected.status !== "draft" && result ? <SMDurcharbeitMonthlyReport campaign={selected} month={month} targets={result.targets} reloadKey={reloadKey} /> : null}
          <SMDurcharbeitCampaignHistory campaignId={selected.id} revision={selected.revision + reloadKey} />
        </> : !draft && !loading ? <div className={`${styles.surface} ${styles.empty}`}>Kampagne auswählen oder einen neuen Entwurf erstellen.</div> : null}
      </section>
    </div>
    {preview ? <CampaignDialog error={error} title="Kampagne veröffentlichen" onClose={() => { if (!busy) setPreview(null); }}><p className="text-[12px] font-semibold text-gray-800">{preview.campaign.name}</p><p className="mt-2 text-[11px] leading-relaxed text-gray-500">{preview.marketCount} Märkte · {preview.months.map(monthName).join(", ")} · {preview.targetCount} Monatsziele</p>{preview.unresolved.length ? <p className="mt-4 text-[11px] text-red-700">{preview.unresolved.length} Märkten fehlt ein aktiver SM. Bitte die Verplanung im Durcharbeit-Marktbestand prüfen.</p> : null}{preview.overlapping.length || preview.legacy.length ? <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-600"><input type="checkbox" checked={confirmOverlap} onChange={event => setConfirmOverlap(event.target.checked)} className="mt-0.5 accent-blue-600" />{preview.overlapping.length} Überschneidungen mit Kampagnen und {preview.legacy.length} offenen datierten Einsätzen. Ich bestätige, dass dies separate Verpflichtungen sind.</label> : null}<p className="mt-4 text-[10px] leading-relaxed text-gray-600">Nach der Veröffentlichung sehen zugewiesene SMs ihre Märkte. Die Kampagne erzeugt keine geplanten Besuchstage oder Sollzeiten.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setPreview(null)} className={secondary}>Abbrechen</button><button type="button" disabled={!canUpdate || (busy || Boolean(preview.unresolved.length) || Boolean((preview.overlapping.length || preview.legacy.length) && !confirmOverlap))} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/${preview.campaign.id}/publish`, { expectedRevision: preview.campaign.revision, previewToken: preview.previewToken, confirmOverlap }, "POST"); setPreview(null); reload(); })} className={primary}>Veröffentlichen</button></footer></CampaignDialog> : null}
    {editTarget ? <CampaignDialog error={error} title="Marktstatus bearbeiten" onClose={() => { if (!busy) setEditTarget(null); }}><p className="mb-4 text-[11px] text-gray-500">{editTarget.market.name} · {monthName(editTarget.month)}</p><div className="space-y-4"><Field label="Verpflichtung"><AdminDropdown value={editEligibility} options={[{ value: "required", label: "Besuch erforderlich" }, { value: "waived", label: "Markt ausnehmen" }]} onChange={value => setEditEligibility(value as "required" | "waived")} ariaLabel="Monatsverpflichtung" placeholder="Status" /></Field><Field label="Zeitraum"><AdminDropdown value={editScope} options={[{ value: "month", label: "Nur dieser Kalendermonat" }, { value: "future", label: "Ab diesem Kalendermonat" }]} onChange={setEditScope} ariaLabel="Änderungszeitraum" placeholder="Zeitraum" /></Field><Field label="Begründung"><input aria-label="Grund der Marktstatusänderung" value={reason} onChange={event => setReason(event.target.value)} className={field} /></Field></div><p className="mt-4 text-[10px] leading-relaxed text-gray-600">Laufende Entwürfe sind geschützt. Frühere Besuche behalten ihren ursprünglichen SM und ihre Antworten.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setEditTarget(null)} className={secondary}>Abbrechen</button><button type="button" disabled={!canUpdate || (busy || reason.trim().length < 3)} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/targets/${editTarget.id}`, { expectedRevision: editTarget.revision, eligibility: editEligibility, scope: editScope, reason }, "PATCH"); setEditTarget(null); reload(); })} className={primary}>Speichern</button></footer></CampaignDialog> : null}
    {changeSmTarget && options ? <CampaignDialog error={error} title={`SM wechseln · ${monthName(changeSmTarget.month)}`} onClose={() => { if (!busy) setChangeSmTarget(null); }}>
      <p className="mb-4 text-[11px] text-gray-600">{changeSmTarget.market.name}</p>
      <div className="space-y-4">
        <Field label="Shelf Merchandiser"><AdminDropdown value={monthSm} options={[{ value: "automatic", label: "Marktstandard verwenden", description: monthDefaultSm ? `${monthDefaultSm.firstName} ${monthDefaultSm.lastName}` : "Kein aktiver Marktstandard" }, ...options.people.map(person => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }))]} onChange={setMonthSm} ariaLabel="SM für diesen Durcharbeit-Monat" placeholder="SM auswählen" searchable disabled={busy} /></Field>
        <Field label="Begründung"><input aria-label="Grund des SM-Wechsels" value={reason} onChange={event => setReason(event.target.value)} className={field} /></Field>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">Gilt nur für {monthName(changeSmTarget.month)} in dieser Kampagne. Danach gilt wieder der Marktstandard. Die Zuordnung im Marktbestand bleibt unverändert.</p>
      <footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setChangeSmTarget(null)} className={secondary}>Abbrechen</button><button type="button" className={primary} disabled={!canUpdate || busy || reason.trim().length < 3 || (monthSm === "automatic" && !monthDefaultSm) || monthSm === (changeSmTarget.SMDurcharbeitSmOverride ? changeSmTarget.smUserId : "automatic")} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/targets/${changeSmTarget.id}/owner`, { expectedRevision: changeSmTarget.revision, SMDurcharbeitSmUserId: monthSm === "automatic" ? null : monthSm, reason }, "PATCH"); setChangeSmTarget(null); reload(); })}>SM speichern</button></footer>
    </CampaignDialog> : null}
    {cancelTarget?.draftVisitId ? <CampaignDialog error={error} title="Laufenden Entwurf verwerfen" onClose={() => { if (!busy) setCancelTarget(null); }}><p className="mb-4 text-[11px] leading-relaxed text-gray-500">{cancelTarget.market.name} · {monthName(cancelTarget.month)} · {cancelTarget.smName}</p><Field label="Begründung"><input value={reason} aria-label="Grund für das Verwerfen" onChange={event => setReason(event.target.value)} className={field} /></Field><p className="mt-4 text-[11px] leading-relaxed text-gray-500">Die noch nicht abgeschlossenen Antworten dieses Besuchs werden verworfen. Bereits abgeschlossene Besuche, ihr Monatsstand, Fotos und Zeiten bleiben erhalten. Dieser Schritt wird im Verlauf protokolliert.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setCancelTarget(null)} className={secondary}>Abbrechen</button><button type="button" disabled={!canUpdate || (busy || reason.trim().length < 3)} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/targets/${cancelTarget.id}/cancel-draft`, { expectedRevision: cancelTarget.revision, visitId: cancelTarget.draftVisitId, reason, confirmation: "CANCEL_SMDURCHARBEIT_DRAFT" }, "POST"); setCancelTarget(null); reload(); })} className={primary}>Entwurf verwerfen</button></footer></CampaignDialog> : null}
    {extend && selected ? <CampaignDialog error={error} title="Kampagne verlängern" onClose={() => { if (!busy) setExtend(false); }}><div className="space-y-4"><Field label="Neues Enddatum"><AdminDatePicker value={endDate} minDate={selected.endDate} onChange={setEndDate} ariaLabel="Neues Kampagnenende" /></Field><Field label="Begründung"><input aria-label="Grund der Verlängerung" value={reason} onChange={event => setReason(event.target.value)} className={field} /></Field>{selected.status === "paused" ? <label className="flex items-center gap-2 text-[11px] text-gray-600"><input type="checkbox" checked={reactivate} onChange={event => setReactivate(event.target.checked)} className="accent-blue-600" />Kampagne wieder freigeben</label> : null}</div><p className="mt-4 text-[10px] text-gray-600">Bestehende Monate bleiben erhalten. Zusätzliche Monate beginnen mit leeren Antworten. Die SM-Zuordnung kommt aus dem Durcharbeit-Marktbestand.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setExtend(false)} className={secondary}>Abbrechen</button><button type="button" disabled={!canUpdate || (busy || reason.trim().length < 3 || endDate <= selected.endDate)} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/${selected.id}/extend`, { expectedRevision: selected.revision, endDate, reason, reactivate }, "POST"); setExtend(false); reload(); })} className={primary}>Verlängern</button></footer></CampaignDialog> : null}
    {stateAction && selected ? <CampaignDialog error={error} title={stateAction === "archived" ? "Kampagne archivieren" : stateAction === "paused" ? "Kampagne pausieren" : "Kampagne fortsetzen"} onClose={() => { if (!busy) setStateAction(null); }}><Field label="Begründung"><input aria-label="Grund der Statusänderung" value={reason} onChange={event => setReason(event.target.value)} className={field} /></Field><p className="mt-3 text-[11px] leading-relaxed text-gray-500">Der Verlauf, gespeicherte Antworten, Fotos und Zeiten bleiben erhalten.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setStateAction(null)} className={secondary}>Abbrechen</button><button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void act(async () => { await requestSMDurcharbeitCampaign(`/${selected.id}/state`, { expectedRevision: selected.revision, status: stateAction, reason }, "PATCH"); setStateAction(null); reload(); })} className={primary}>Bestätigen</button></footer></CampaignDialog> : null}
    {periodEdit && selected ? <CampaignDialog error={error} title={`Fragebogen · ${monthName(month)}`} onClose={() => { if (!busy) setPeriodEdit(false); }}><div className="space-y-4"><Field label="Neue veröffentlichte Version"><AdminDropdown value={futureVersion} options={questionnaires} onChange={setFutureVersion} ariaLabel="Zukünftiger Fragebogen" placeholder="Fragebogen wählen" searchable /></Field><Field label="Begründung"><input value={reason} aria-label="Grund des Fragebogenwechsels" onChange={event => setReason(event.target.value)} className={field} /></Field></div><p className="mt-3 text-[10px] leading-relaxed text-gray-600">Der Wechsel ist nur möglich, solange in diesem zukünftigen Monat noch kein Besuch gestartet wurde.</p><footer className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setPeriodEdit(false)} className={secondary}>Abbrechen</button><button type="button" disabled={!canUpdate || (busy || !futureVersion || reason.trim().length < 3)} onClick={() => void act(async () => { const data = await requestSMDurcharbeitCampaign<{ periods: Array<{ id: string; month: string }> }>(`/${selected.id}/periods`); const period = data.periods.find(period => period.month === month); if (!period) throw new Error("Kalendermonat nicht gefunden."); await requestSMDurcharbeitCampaign(`/${selected.id}/periods/${period.id}/questionnaire`, { expectedRevision: selected.revision, questionnaireVersionId: futureVersion, reason }, "PATCH"); setPeriodEdit(false); reload(); })} className={primary}>Speichern</button></footer></CampaignDialog> : null}
    {marketEditor && selected && options && editableMonths.length ? <SMDurcharbeitCampaignMarketsEditor campaign={selected} options={options} months={editableMonths} initialMonth={editableMonths.includes(month) ? month : editableMonths[0]} onClose={() => setMarketEditor(false)} onSaved={() => { setMarketEditor(false); reload(); }} /> : null}
  </div></SMDurcharbeitFilterTheme>;
}
