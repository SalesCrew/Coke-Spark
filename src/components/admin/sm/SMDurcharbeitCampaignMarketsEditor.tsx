"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { AdminControlPortal, AdminDropdown } from "@/components/admin/AdminFilterControls";
import { requestSMDurcharbeitCampaign } from "@/lib/api/backend";
import { filterSMDurcharbeitMarkets, updateSMDurcharbeitMarketSelection } from "@/lib/sm/SMDurcharbeitMarketSelection";
import type { SMDurcharbeitCampaign, SMDurcharbeitCampaignOptions, SMDurcharbeitMarketEdit, SMDurcharbeitMarketEditPreview, SMDurcharbeitTarget } from "@/types/smSMDurcharbeitCampaign";

const primary = "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3 text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#1d4ed8,0_2px_6px_rgba(37,99,235,.14)] disabled:bg-none disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none";
const secondary = "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-black/[.08] bg-gradient-to-b from-white to-gray-50 px-3 text-[11px] font-semibold text-gray-600 disabled:opacity-45";
const label = "mb-1.5 block text-[10px] font-semibold text-gray-500";
const monthName = (month: string) => new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));
export function SMDurcharbeitCampaignMarketsEditor({ campaign, options, months, initialMonth, onClose, onSaved }: {
  campaign: SMDurcharbeitCampaign; options: SMDurcharbeitCampaignOptions; months: string[]; initialMonth: string;
  onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), pending = useRef(false);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [month, setMonth] = useState(initialMonth), [scope, setScope] = useState<"month" | "future">("future");
  const [targets, setTargets] = useState<SMDurcharbeitTarget[] | null>(null), [selected, setSelected] = useState(new Set<string>());
  const [revision, setRevision] = useState(campaign.revision);
  const [query, setQuery] = useState(""), [chain, setChain] = useState(""), [reason, setReason] = useState("Marktauswahl angepasst");
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [reloadKey, setReloadKey] = useState(0);
  const [display, setDisplay] = useState({ key: "", count: 100 });
  const [preview, setPreview] = useState<{ result: SMDurcharbeitMarketEditPreview; input: SMDurcharbeitMarketEdit } | null>(null), [confirmOverlap, setConfirmOverlap] = useState(false);
  useEffect(() => {
    const previousFocus = document.activeElement, element = dialog.current;
    setPortal(element); element?.showModal();
    return () => { element?.close(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => {
    let current = true; setTargets(null); setPreview(null); setError(null);
    Promise.all([
      requestSMDurcharbeitCampaign<{ targets: SMDurcharbeitTarget[] }>(`/${campaign.id}/targets?month=${encodeURIComponent(month)}`),
      requestSMDurcharbeitCampaign<{ campaigns: SMDurcharbeitCampaign[] }>(""),
    ]).then(([data, list]) => {
      if (!current) return;
      const latest = list.campaigns.find(row => row.id === campaign.id);
      if (!latest || !["published", "paused"].includes(latest.status)) throw new Error("Die Kampagne kann derzeit nicht bearbeitet werden. Bitte schließen und neu laden.");
      setRevision(latest.revision); setTargets(data.targets);
      setSelected(new Set(data.targets.filter(row => row.eligibility === "required").map(row => row.market.id)));
    }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Märkte konnten nicht geladen werden."); });
    return () => { current = false; };
  }, [campaign.id, month, options.markets, reloadKey]);
  const targetByMarket = useMemo(() => new Map(targets?.map(row => [row.market.id, row]) ?? []), [targets]);
  const markets = useMemo(() => {
    const rows = new Map(options.markets.map(row => [row.id, { ...row, selectable: true }]));
    for (const target of targets ?? []) {
      const row = rows.get(target.market.id);
      if (row) rows.set(target.market.id, { ...row, sourcePerson: target.smName });
      else rows.set(target.market.id, { ...target.market, assignedSmUserId: target.smUserId, sourcePerson: target.smName, selectable: false });
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "de-AT") || a.id.localeCompare(b.id));
  }, [options.markets, targets]);
  const visible = useMemo(() => filterSMDurcharbeitMarkets(markets, chain, query), [markets, chain, query]);
  const chains = useMemo(() => [{ value: "", label: "Alle Handelsketten" }, ...[...new Set(markets.map(row => row.chain).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de-AT")).map(value => ({ value, label: value }))], [markets]);
  const peopleById = new Map(options.people.map(person => [person.id, `${person.firstName} ${person.lastName}`.trim()]));
  const key = `${month}:${chain}:${query}`, count = display.key === key ? display.count : 100;
  const filteredIds = visible.filter(row => row.selectable || selected.has(row.id)).map(row => row.id);
  const bulk = (action: "include" | "exclude" | "only") => setSelected(updateSMDurcharbeitMarketSelection(selected, action === "exclude" ? visible.map(row => row.id) : filteredIds, action));
  const submit = async () => {
    if (pending.current || !targets) return; pending.current = true; setBusy(true); setError(null);
    try {
      if (preview) {
        await requestSMDurcharbeitCampaign(`/${campaign.id}/markets`, { ...preview.input, previewToken: preview.result.previewToken, confirmOverlap }, "PATCH");
        onSaved();
      } else {
        const input: SMDurcharbeitMarketEdit = { expectedRevision: revision, month, scope, reason,
          roster: [...selected].sort().map(smMarketId => ({ smMarketId })) };
        const result = await requestSMDurcharbeitCampaign<SMDurcharbeitMarketEditPreview>(`/${campaign.id}/markets/preview`, input, "POST");
        setPreview({ result, input }); setConfirmOverlap(false);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Die Marktauswahl konnte nicht gespeichert werden."); setPreview(null); }
    finally { pending.current = false; setBusy(false); }
  };
  const missingOwner = [...selected].some(id => { const row = options.markets.find(market => market.id === id); return !targetByMarket.has(id) && (!row?.assignedSmUserId || !peopleById.has(row.assignedSmUserId)); });
  const overlaps = preview ? preview.result.overlapping + preview.result.legacy : 0;
  return <dialog ref={dialog} aria-labelledby="smdurcharbeit-markets-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto hidden max-h-[90dvh] w-[min(860px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl open:flex border border-black/[.06] bg-white p-0 text-gray-800 shadow-2xl backdrop:bg-slate-950/20">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[.06] px-5 py-4"><div className="min-w-0"><h2 id="smdurcharbeit-markets-title" className="text-[15px] font-semibold">{preview ? "Marktauswahl prüfen" : "Märkte bearbeiten"}</h2><p className="mt-1 truncate text-[11px] text-gray-500">{campaign.name}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Markteditor schließen" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600"><X size={14} /></button></header>
    <AdminControlPortal container={portal}><div className="min-h-0 overflow-y-auto px-5 py-4 [scrollbar-width:thin] [scrollbar-color:#dbe1e8_transparent]">
      {error ? <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2.5 text-[11px] text-red-700"><span>{error}</span><button type="button" disabled={busy} className="shrink-0 font-semibold" onClick={() => setReloadKey(key => key + 1)}>Neu laden</button></div> : null}
      {preview ? <>
        <p className="mb-4 text-[11px] leading-relaxed text-gray-500">{preview.input.scope === "future" ? `Ab ${monthName(month)} für alle folgenden Kampagnenmonate.` : `Nur ${monthName(month)}.`} Bestehende Besuche, Antworten und Fotos bleiben erhalten.</p>
        <div className="overflow-x-auto rounded-xl border border-black/[.06]"><table className="w-full text-left text-[11px]"><thead className="bg-gray-50 text-[10px] font-semibold text-gray-500"><tr><th className="px-3 py-3">Monat</th><th className="px-3 py-3">Aktiv</th><th className="px-3 py-3">Ausgenommen</th><th className="px-3 py-3">Neu</th><th className="px-3 py-3">Geschützt</th></tr></thead><tbody>{preview.result.months.map(row => <tr key={row.month} className="border-t border-black/[.04]"><td className="whitespace-nowrap px-3 py-3 font-medium">{monthName(row.month)}</td><td className="px-3 py-3 tabular-nums">{row.required}</td><td className="px-3 py-3 tabular-nums">{row.excluded}</td><td className="px-3 py-3 tabular-nums">{row.added}</td><td className="px-3 py-3 tabular-nums">{row.protected || "–"}</td></tr>)}</tbody></table></div>
        {preview.result.protected.length ? <details className="mt-4 rounded-xl border border-black/[.06] px-3 py-3"><summary className="cursor-pointer text-[11px] font-semibold">{preview.result.protected.length} Monatszuordnungen bleiben geschützt</summary><p className="mt-2 text-[11px] leading-relaxed text-gray-500">Begonnene und erledigte Besuche behalten ihren bisherigen Status. Die übrigen Änderungen werden gespeichert.</p><ul className="mt-3 max-h-40 overflow-y-auto space-y-2 text-[10px] text-gray-600">{preview.result.protected.slice(0, 100).map(row => <li key={row.targetId}>{row.name} · {monthName(row.month)} · {row.reason === "in_progress" ? "In Arbeit" : "Erledigt"}</li>)}</ul>{preview.result.protected.length > 100 ? <p className="mt-2 text-[10px] text-gray-500">Weitere {preview.result.protected.length - 100} geschützte Zuordnungen.</p> : null}</details> : null}
        {overlaps ? <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-600"><input type="checkbox" checked={confirmOverlap} onChange={event => setConfirmOverlap(event.target.checked)} className="mt-0.5 accent-blue-600" />{preview.result.overlapping} Überschneidungen mit Kampagnen und {preview.result.legacy} mit datierten Einsätzen. Als separate Verpflichtungen bestätigen.</label> : null}
        <p className="mt-4 text-[11px] text-gray-500">{preview.result.changedTargets ? `${preview.result.changedTargets} Monatszuordnungen werden geändert.` : "Keine Änderungen anwendbar."}</p>
      </> : <>
        <p className="mb-4 text-[11px] text-gray-500">Der SM wird automatisch aus dem Durcharbeit-Marktbestand übernommen.</p>
        <div className="grid gap-3 sm:grid-cols-2"><div><span className={label}>Monat</span><AdminDropdown value={month} options={months.map(value => ({ value, label: monthName(value) }))} onChange={setMonth} ariaLabel="Monat der Marktauswahl" placeholder="Monat wählen" disabled={busy} /></div><div><span className={label}>Änderung gilt</span><AdminDropdown value={scope} options={[{ value: "future", label: "Ab diesem Kalendermonat" }, { value: "month", label: "Nur dieser Kalendermonat" }]} onChange={value => setScope(value as "month" | "future")} ariaLabel="Zeitraum der Marktauswahl" placeholder="Zeitraum" disabled={busy} /></div></div>
        <div className="mt-5 grid items-end gap-3 sm:grid-cols-[210px_1fr]"><div><span className={label}>Handelskette</span><AdminDropdown value={chain} options={chains} onChange={setChain} ariaLabel="Handelskette der Marktauswahl" placeholder="Alle Handelsketten" disabled={busy || !targets} /></div><label className="flex h-9 items-center gap-2 rounded-lg border border-black/[.08] px-3"><Search size={13} className="text-gray-400" /><input aria-label="Kampagnenmärkte suchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Markt, Adresse oder SM suchen" disabled={busy || !targets} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" /></label></div>
        <div className="my-3 flex flex-wrap items-center gap-2 text-[10px]"><span className="mr-auto text-gray-500">{selected.size} ausgewählt · {visible.length} Treffer</span><button type="button" disabled={busy || !targets || !visible.length} onClick={() => bulk("include")} className="rounded-md px-2 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">{chain || query.trim() ? "Treffer aufnehmen" : "Alle aufnehmen"}</button><button type="button" disabled={busy || !targets || !visible.length} onClick={() => bulk("exclude")} className="rounded-md px-2 py-1.5 font-semibold text-gray-600 hover:bg-gray-50">{chain || query.trim() ? "Treffer ausschließen" : "Alle ausschließen"}</button>{chain || query.trim() ? <button type="button" disabled={busy || !targets || !visible.length} onClick={() => bulk("only")} className="rounded-md bg-blue-50 px-2 py-1.5 font-semibold text-blue-700">Nur diese Märkte</button> : null}</div>
        <div className="max-h-[35dvh] min-h-24 overflow-y-auto rounded-xl border border-black/[.06] [scrollbar-width:thin] [scrollbar-color:#dbe1e8_transparent]">{!targets && error ? <p className="px-3 py-8 text-center text-[11px] text-gray-500">Marktauswahl derzeit nicht verfügbar. Bitte neu laden.</p> : !targets ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-[11px] text-gray-500"><LoaderCircle size={14} className="motion-safe:animate-spin" />Märkte werden geladen</div> : visible.slice(0, count).map(market => {
          const target = targetByMarket.get(market.id), checked = selected.has(market.id);
          return <div key={market.id} className="flex flex-wrap items-center gap-3 border-b border-black/[.04] px-3 py-3 last:border-0"><label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"><input type="checkbox" aria-label={`${market.name} aufnehmen`} checked={checked} disabled={busy || (!market.selectable && !checked)} onChange={event => setSelected(updateSMDurcharbeitMarketSelection(selected, [market.id], event.target.checked ? "include" : "exclude"))} className="mt-0.5 accent-blue-600" /><span className="min-w-0"><span className="block text-[11px] font-semibold">{market.name}</span><span className="mt-0.5 block text-[10px] text-gray-500">{market.chain} · {market.address} · {market.city}</span><span className="mt-1 block text-[10px] text-gray-500">{target ? `${target.smName}${target.draftVisitId ? " · In Arbeit" : target.completed ? " · Erledigt" : ""}` : market.sourcePerson ? `Verplanung: ${market.sourcePerson}` : "Neuer Kampagnenmarkt"}{!market.selectable ? " · Markt nicht aktiv" : ""}</span></span></label>{!target && checked ? <p className={`text-[11px] ${market.assignedSmUserId && peopleById.has(market.assignedSmUserId) ? "text-gray-600" : "text-red-700"}`}>{market.assignedSmUserId && peopleById.get(market.assignedSmUserId) || "Keine gültige SM-ID im Durcharbeit-Marktbestand"}</p> : null}</div>;
        })}{targets && !visible.length ? <p className="py-8 text-center text-[11px] text-gray-500">Keine passenden Märkte.</p> : null}</div>
        {targets && visible.length > count ? <button type="button" className={`${secondary} mt-3`} onClick={() => setDisplay({ key, count: count + 100 })}>Weitere Märkte · {count}/{visible.length}</button> : null}
        <label className="mt-4 block"><span className={label}>Begründung</span><input aria-label="Begründung der Marktauswahl" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="h-9 w-full rounded-lg border border-black/[.08] bg-white px-3 text-[11px] outline-none focus:border-blue-400" /></label>
        <p className="mt-3 text-[10px] leading-relaxed text-gray-500">Ausgenommene Märkte zählen nicht mehr als offene Besuche. Vergangene Monate, begonnene Besuche und gespeicherte Antworten bleiben erhalten.</p>
      </>}
    </div></AdminControlPortal>
    <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/[.06] px-5 py-4"><button type="button" disabled={busy} onClick={preview ? () => setPreview(null) : onClose} className={secondary}>{preview ? "Zurück" : "Abbrechen"}</button><button type="button" onClick={() => void submit()} disabled={busy || !targets || reason.trim().length < 3 || missingOwner || Boolean(preview && (!preview.result.changedTargets || (overlaps && !confirmOverlap)))} className={primary}>{busy ? <LoaderCircle size={12} className="motion-safe:animate-spin" /> : preview ? <Check size={12} /> : null}{preview ? "Änderungen speichern" : "Änderungen prüfen"}</button></footer>
  </dialog>;
}
