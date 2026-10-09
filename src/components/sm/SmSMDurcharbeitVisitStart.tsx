"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Clock, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchMySMDurcharbeitTarget, getSmVisitStartTokenStorageKey, startMySMDurcharbeitTarget, getAuthPrincipalKey, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";
import { SMDurcharbeitVisitReference, smVisitResumeHref } from "@/lib/sm/SMDurcharbeitVisitReference";
import type { SMDurcharbeitTargetPreview } from "@/types/smSMDurcharbeitCampaign";

const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;

export function SmSMDurcharbeitVisitStart({ targetId }: { targetId: string }) {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return <VisitStart key={`${owner}:${targetId}`} targetId={targetId} />;
}

function VisitStart({ targetId }: { targetId: string }) {
  const router = useRouter(), pending = useRef(false);
  const [context, setContext] = useState<SMDurcharbeitTargetPreview | null>(null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"timer" | "manual">("timer"), [travel, setTravel] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let current = true;
    fetchMySMDurcharbeitTarget(targetId).then(result => {
      if (!current) return;
      if (result.target.draftVisitId) { router.replace(smVisitResumeHref(SMDurcharbeitVisitReference(result.target.draftVisitId))); return; }
      setContext(result);
    }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Der Besuch konnte nicht vorbereitet werden."); });
    return () => { current = false; };
  }, [targetId, reloadKey, router]);
  const start = async () => {
    if (!context || pending.current || !context.target.available) return;
    const travelMinutes = travel.trim() ? Number(travel) : null;
    if (travelMinutes !== null && (!Number.isInteger(travelMinutes) || travelMinutes < 0 || travelMinutes > 1440)) { setError("Bitte eine Fahrtzeit zwischen 0 und 1440 Minuten eingeben."); return; }
    pending.current = true; setBusy(true); setError(null);
    const key = getSmVisitStartTokenStorageKey(`SMDurcharbeitTarget:${targetId}`);
    let token = crypto.randomUUID();
    try { token = window.localStorage.getItem(key) || token; window.localStorage.setItem(key, token); } catch { /* The server still provides target-level idempotency. */ }
    try {
      const result = await startMySMDurcharbeitTarget(targetId, { expectedRevision: context.target.revision, followUp: context.target.completed,
        mode, travelMinutes: context.profile.travelTimeEnabled ? travelMinutes : null, clientSubmissionToken: token });
      try { window.localStorage.removeItem(key); } catch { /* Optional cache. */ }
      router.replace(smVisitResumeHref(SMDurcharbeitVisitReference(result.visitId)));
    } catch (error) { setError(error instanceof Error ? error.message : "Der Besuch konnte nicht gestartet werden."); pending.current = false; setBusy(false); }
  };
  const month = context ? new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${context.target.month}T12:00:00Z`)) : "";
  return <main className="min-h-screen bg-[#f5f5f7] px-6 pb-12 pt-6"><div className="mx-auto max-w-[380px]">
    <button type="button" onClick={() => router.push("/sm/durcharbeit")} disabled={busy} className="mb-5 flex min-h-10 items-center gap-2 rounded-lg text-[12px] font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft size={16} />Durcharbeit</button>
    <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,.04)]">
      <p className="text-[11px] font-medium text-blue-700">{month || "Monatsbesuch"}</p>
      {!context && !error ? <div className="mt-4 space-y-3 motion-safe:animate-pulse" aria-label="Besuch wird vorbereitet"><div className="h-4 w-3/4 rounded bg-gray-100" /><div className="h-3 w-full rounded bg-gray-100" /><div className="h-24 rounded-xl bg-gray-50" /></div> : null}
      {context ? <><h1 className="mt-1 text-[21px] font-semibold tracking-tight text-gray-900">{context.target.market.name}</h1><p className="mt-1 text-[12px] leading-5 text-gray-600">{context.target.market.address}<br />{context.target.market.postalCode} {context.target.market.city}</p>
        <div className="mt-5 border-y border-black/[.05] py-3"><p className="text-[12px] font-semibold text-gray-800">{context.questionnaire.name}</p><p className="mt-1 text-[11px] leading-5 text-gray-600">{context.target.campaignName}</p></div>
        {context.target.completed ? <p className="mt-4 text-[12px] leading-5 text-gray-600">Das Monatsziel ist erledigt. Beim Folgebesuch prüfst du die letzten Antworten dieses Monats. Frühere Besuche und Fotos bleiben erhalten.</p> : <p className="mt-4 text-[12px] leading-5 text-gray-600">Besuche diesen Markt einmal im Monat. Den Zeitpunkt wählst du selbst.</p>}
        <fieldset disabled={busy || !context.target.available} className="mt-5"><legend className="mb-2 text-[11px] font-medium text-gray-600">Besuchszeit</legend><div className="grid grid-cols-2 gap-2">{(["timer", "manual"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${mode === value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-black/[.08] bg-white text-gray-500"}`}><Clock size={12} />{value === "timer" ? "Timer starten" : "Zeit eintragen"}</button>)}</div>
          {context.profile.travelTimeEnabled ? <label className="mt-4 block text-[11px] font-medium text-gray-600">Fahrtzeit in Minuten<input inputMode="numeric" type="number" min={0} max={1440} value={travel} onChange={event => setTravel(event.target.value)} placeholder="Optional" className="mt-1.5 h-10 w-full rounded-xl border border-black/[.08] bg-white px-3 text-[16px] font-normal text-gray-700 sm:text-[12px] outline-none focus:border-blue-400" /></label> : null}
        </fieldset>
        {!context.target.available ? <p className="mt-4 text-[12px] leading-5 text-gray-600">Dieser Monat ist derzeit geschlossen. Der Verlauf bleibt erhalten.</p> : null}
      </> : null}
      {error ? <div className="mt-4"><p role="alert" className="text-[12px] leading-5 text-red-700">{error}</p><button type="button" disabled={busy} onClick={() => { setContext(null); setError(null); setReloadKey(key => key + 1); }} className="mt-2 text-[10px] font-semibold text-blue-700">Aktuellen Stand laden</button></div> : null}
      {context ? <button type="button" disabled={busy || !context.target.available} onClick={() => void start()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-600 bg-gradient-to-b from-blue-600 to-blue-700 text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_3px_8px_rgba(37,99,235,.15)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 hover:from-blue-700 disabled:opacity-45">{busy ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <ArrowRight size={14} />}{context.target.completed ? "Folgebesuch starten" : "Besuch starten"}</button> : null}
    </section>
  </div></main>;
}
