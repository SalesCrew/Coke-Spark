"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAuthPrincipalKey, readAuthSession, requestSMDurcharbeitCampaign, subscribeAuthSession } from "@/lib/api/backend";

type HistoryPage = { events: Array<{ id: string; action: string; reason: string; actorName: string | null; createdAt: string }>; nextCursor: { beforeCreatedAt: string; beforeId: string } | null };
const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;
const labels: Record<string, string> = {
  draft_created: "Entwurf erstellt", draft_updated: "Entwurf bearbeitet", published: "Veröffentlicht", state_changed: "Status geändert",
  extended: "Verlängert", future_questionnaire_changed: "Fragebogen geändert", roster_changed: "Zuordnung geändert",
  draft_cancelled_by_admin: "Entwurf durch Admin verworfen", draft_discarded: "Entwurf verworfen", visit_started: "Besuch gestartet",
  followup_started: "Folgebesuch gestartet", time_corrected: "Besuchszeit korrigiert", time_request_approved: "Zeitanfrage freigegeben", time_request_rejected: "Zeitanfrage abgelehnt",
  visit_submitted: "Besuch abgegeben", answer_corrected: "Antwort korrigiert", submission_invalidated: "Abgabe geändert",
};
export function SMDurcharbeitCampaignHistory({ campaignId, revision }: { campaignId: string; revision: number }) {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return owner ? <History key={`${owner}:${campaignId}:${revision}`} campaignId={campaignId} /> : null;
}
function History({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState<HistoryPage | null>(null), [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const generation = useRef(0), pending = useRef(false);
  useEffect(() => {
    if (!open) return;
    const requests = generation, request = ++requests.current; setLoading(true); setError(null);
    requestSMDurcharbeitCampaign<HistoryPage>(`/${campaignId}/history`)
      .then(result => { if (request === requests.current) setPage(result); })
      .catch(failure => { if (request === requests.current) setError(failure instanceof Error ? failure.message : "Verlauf konnte nicht geladen werden."); })
      .finally(() => { if (request === requests.current) setLoading(false); });
    return () => { requests.current++; };
  }, [campaignId, open, retry]);
  const more = async () => {
    if (!page?.nextCursor || pending.current) return;
    pending.current = true; const request = generation.current; setLoading(true); setError(null);
    try {
      const result = await requestSMDurcharbeitCampaign<HistoryPage>(`/${campaignId}/history?${new URLSearchParams(page.nextCursor)}`);
      if (request === generation.current) setPage(current => current ? { events: [...current.events, ...result.events.filter(event => !current.events.some(previous => previous.id === event.id))], nextCursor: result.nextCursor } : result);
    } catch (failure) { if (request === generation.current) setError(failure instanceof Error ? failure.message : "Verlauf konnte nicht geladen werden."); }
    finally { pending.current = false; if (request === generation.current) setLoading(false); }
  };
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,.025)]">
    <summary className="cursor-pointer px-4 py-4 text-[13px] font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600">Kampagnenverlauf</summary>
    {open ? <div className="border-t border-black/[.05] p-4">
      {error ? <p role="alert" className="mb-3 text-[11px] text-red-700">{error} <button type="button" onClick={() => page?.nextCursor ? void more() : setRetry(value => value + 1)} className="ml-2 underline">Erneut laden</button></p> : null}
      {page ? <ol className="divide-y divide-black/[.04]">{page.events.map(event => <li key={event.id} className="py-3 first:pt-0"><div className="flex flex-wrap justify-between gap-2"><p className="text-[12px] font-semibold text-gray-800">{labels[event.action] ?? "Monatsstand aktualisiert"}</p><time dateTime={event.createdAt} className="text-[10px] tabular-nums text-gray-600">{new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna" }).format(new Date(event.createdAt))}</time></div><p className="mt-1 break-words text-[11px] leading-5 text-gray-600">{event.reason}</p>{event.actorName ? <p className="mt-1 text-[10px] text-gray-600">{event.actorName}</p> : null}</li>)}</ol> : null}
      {!page && !loading && !error ? <p className="text-[11px] text-gray-600">Noch keine Änderungen.</p> : null}
      {loading ? <p role="status" className="py-3 text-[11px] text-gray-600 motion-safe:animate-pulse">Verlauf wird geladen…</p> : null}
      {page?.nextCursor ? <button type="button" disabled={loading} onClick={() => void more()} className="mt-3 min-h-9 text-[10px] font-semibold text-blue-700 disabled:opacity-40">Ältere Änderungen</button> : null}
    </div> : null}
  </details>;
}
