"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronRight, RotateCcw, Search } from "lucide-react";
import { AdminDropdown, AdminFilterControlStyles, SMDurcharbeitFilterTheme } from "@/components/admin/AdminFilterControls";
import { getAuthPrincipalKey, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";
import { useSmSMDurcharbeitTargets } from "@/hooks/useSmSMDurcharbeitTargets";
import { smHomeDate } from "@/lib/sm/homeDashboard";
import { SMDurcharbeitMonthLabel, SMDurcharbeitTargetAction, SMDurcharbeitTargetProgress } from "@/lib/sm/SMDurcharbeitTargetView";
import type { SMDurcharbeitTarget } from "@/types/smSMDurcharbeitCampaign";

const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function SmSMDurcharbeitTargets() {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return <TargetList key={owner ?? "signed-out"} />;
}

function TargetList() {
  const [monthSelection, setMonthSelection] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("all");
  const [search, setSearch] = useState("");
  const [display, setDisplay] = useState({ key: "", count: 50 });
  const { state, loaded, error, reload } = useSmSMDurcharbeitTargets(monthSelection);
  const currentMonth = state?.currentMonth ?? `${smHomeDate().slice(0, 7)}-01`;
  const months = [...new Set([...(state?.months ?? []), ...(monthSelection ? [monthSelection] : [])])].sort();
  const monthOptions = [{ value: "current", label: `Aktuell · ${SMDurcharbeitMonthLabel(currentMonth)}` },
    ...months.filter(month => month !== currentMonth).map(month => ({ value: month, label: SMDurcharbeitMonthLabel(month) }))];
  if (monthSelection === currentMonth) monthOptions.push({ value: currentMonth, label: SMDurcharbeitMonthLabel(currentMonth) });
  const campaigns = useMemo(() => [...new Map((loaded?.targets ?? []).map(target => [target.campaignId, { value: target.campaignId, label: target.campaignName }])).values()], [loaded?.targets]);
  const selectedCampaign = campaigns.some(campaign => campaign.value === campaignId) ? campaignId : "all";
  const targets = (loaded?.targets ?? []).filter(target => selectedCampaign === "all" || target.campaignId === selectedCampaign).sort((a, b) =>
    Number(a.eligibility === "waived") - Number(b.eligibility === "waived") || Number(a.completed) - Number(b.completed) || Number(Boolean(b.draftVisitId)) - Number(Boolean(a.draftVisitId)) || a.market.name.localeCompare(b.market.name, "de-AT") || a.id.localeCompare(b.id));
  const visibleTargets = targets.filter(target => `${target.market.name} ${target.market.address} ${target.market.postalCode} ${target.market.city}`.toLocaleLowerCase("de-AT").includes(search.trim().toLocaleLowerCase("de-AT")));
  const displayKey = `${loaded?.month ?? ""}:${selectedCampaign}:${search}`;
  const displayCount = display.key === displayKey ? display.count : 50;
  const progress = SMDurcharbeitTargetProgress(targets);

  return <section aria-label="Monatliche Durcharbeit">
    <AdminFilterControlStyles />
    <div className="mb-5 grid gap-3">
      <div className={`grid gap-3 ${campaigns.length > 1 ? "sm:grid-cols-2" : ""}`}>
        <div><p className="mb-1.5 text-[11px] font-medium text-gray-600">Monat</p><SMDurcharbeitFilterTheme enabled><AdminDropdown value={monthSelection ?? "current"} options={monthOptions} onChange={month => setMonthSelection(month === "current" ? null : month)} ariaLabel="Durcharbeit-Monat" placeholder="Kalendermonat" /></SMDurcharbeitFilterTheme></div>
        {campaigns.length > 1 ? <div><p className="mb-1.5 text-[11px] font-medium text-gray-600">Kampagne</p><SMDurcharbeitFilterTheme enabled><AdminDropdown value={selectedCampaign} options={[{ value: "all", label: "Alle Kampagnen" }, ...campaigns]} onChange={setCampaignId} ariaLabel="Durcharbeit-Kampagne" placeholder="Kampagne" /></SMDurcharbeitFilterTheme></div> : null}
      </div>
      <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-black/[.08] bg-white px-3 focus-within:border-blue-500">
        <Search size={16} className="shrink-0 text-gray-500" /><input aria-label="Durcharbeit-Markt suchen" value={search} onChange={event => setSearch(event.target.value)} placeholder="Markt oder Adresse suchen" className="min-w-0 flex-1 bg-transparent text-[16px] text-gray-800 sm:text-[12px] outline-none placeholder:text-gray-500" />
      </label>
    </div>

    {loaded ? <div className="mb-5" aria-label="Monatsfortschritt">
      <div className="mb-2 flex items-baseline justify-between gap-3"><h2 className="text-[13px] font-semibold text-gray-900">{SMDurcharbeitMonthLabel(loaded.month)}</h2><span className="text-[11px] tabular-nums text-gray-600">{progress.completed} von {progress.required} erledigt</span></div>
      {progress.required ? <div role="progressbar" aria-label="Erledigte Monatsziele" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.completed} className="h-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress.completed / progress.required * 100}%` }} /></div> : null}
    </div> : null}

    {error ? <div className="mb-4 rounded-xl bg-white p-4"><p role="alert" className="text-[12px] leading-5 text-red-700">{error}{loaded ? " Der letzte geladene Stand wird angezeigt." : ""}</p><button type="button" onClick={reload} className={`mt-2 flex min-h-10 items-center gap-2 rounded-lg text-[12px] font-semibold text-blue-700 ${focus}`}><RotateCcw size={14} />Erneut laden</button></div> : null}
    {!loaded && !error ? <div className="space-y-6 rounded-xl bg-white p-4" role="status"><span className="sr-only">Durcharbeit wird geladen</span>{[0, 1, 2].map(id => <div key={id} className="space-y-2 motion-safe:animate-pulse"><span className="block h-3 w-3/4 rounded bg-gray-100" /><span className="block h-2 w-1/2 rounded bg-gray-100" /></div>)}</div>
      : !loaded ? null
        : !visibleTargets.length ? <div className="rounded-xl bg-white px-4 py-8"><p className="text-[13px] font-semibold text-gray-800">{search.trim() ? "Keine passenden Märkte" : "Keine Monatsziele"}</p><p className="mt-1 text-[12px] leading-5 text-gray-600">{search.trim() ? "Versuche einen anderen Marktnamen oder eine Adresse." : "Für diesen Monat sind keine Durcharbeit-Märkte zugewiesen."}</p></div>
          : <ul className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,.025)]">
            {visibleTargets.slice(0, displayCount).map(target => <TargetRow key={target.id} target={target} currentMonth={currentMonth} showCampaign={campaigns.length > 1} />)}
            {visibleTargets.length > displayCount ? <li className="px-4 py-2"><button type="button" onClick={() => setDisplay({ key: displayKey, count: displayCount + 50 })} className={`min-h-11 rounded-lg text-[12px] font-semibold text-blue-700 ${focus}`}>Weitere Märkte anzeigen · {displayCount}/{visibleTargets.length}</button></li> : null}
          </ul>}
  </section>;
}

function TargetRow({ target, currentMonth, showCampaign }: { target: SMDurcharbeitTarget; currentMonth: string; showCampaign: boolean }) {
  const action = SMDurcharbeitTargetAction(target, currentMonth);
  const content = <>
    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold leading-5 text-gray-900">{target.market.name}</span><span className="mt-1 block text-[11px] leading-4 text-gray-600">{target.market.address} · {target.market.postalCode} {target.market.city}</span>{showCampaign ? <span className="mt-1 block text-[10px] leading-4 text-gray-600">{target.campaignName}</span> : null}
      <span className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${action.href ? "text-blue-700" : "text-gray-600"}`}>{target.completed ? <Check size={12} /> : null}{action.label}</span>
    </span>
    {action.href ? <ChevronRight size={16} className="shrink-0 text-gray-500" /> : null}
  </>;
  const rowStyle = `flex min-h-[88px] w-full items-center gap-3 px-4 py-4 text-left ${focus}`;
  return <li className="border-b border-black/[.05] last:border-0">{action.href
    ? <Link href={action.href} className={`${rowStyle} transition-colors hover:bg-blue-50/40`}>{content}</Link>
    : <div aria-disabled="true" className={rowStyle}>{content}</div>}</li>;
}
