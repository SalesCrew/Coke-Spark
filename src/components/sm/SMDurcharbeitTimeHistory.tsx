"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fetchSMDurcharbeitTimeHistory, getAuthPrincipalKey, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";
import type { SMDurcharbeitTimeHistory as History } from "@/types/smSMDurcharbeitTime";

const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;
const clock = (value: string | null) => value ? new Intl.DateTimeFormat("de-AT", {
  timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(value)) : "—";

/** Lazy read-only history; a corrected clock never relabels the original visit. */
export function SMDurcharbeitTimeHistory({ visitId, admin = false, revision }: { visitId: string; admin?: boolean; revision: number | null }) {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return owner ? <TimeHistory key={`${owner}:${visitId}:${revision}`} visitId={visitId} admin={admin} /> : null;
}

function TimeHistory({ visitId, admin }: { visitId: string; admin: boolean }) {
  const [history, setHistory] = useState<History | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => { const requests = generation; return () => { requests.current++; }; }, []);
  const load = async (beforeRevision?: number) => {
    if (busy) return;
    const request = ++generation.current; setBusy(true); setError(null);
    try {
      const page = await fetchSMDurcharbeitTimeHistory(visitId, admin, beforeRevision);
      if (request !== generation.current) return;
      setHistory(previous => beforeRevision && previous ? { ...page, revisions: [...previous.revisions, ...page.revisions.filter(row => !previous.revisions.some(old => old.revision === row.revision))] } : page);
    } catch (failure) { if (request === generation.current) setError(failure instanceof Error ? failure.message : "Zeitverlauf konnte nicht geladen werden."); }
    finally { if (request === generation.current) setBusy(false); }
  };
  return <details className="mt-3 text-[11px] text-gray-600" onToggle={event => { if (event.currentTarget.open && !history) void load(); }}>
    <summary className="w-fit cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Zeitverlauf</summary>
    <div className="mt-2 border-l-2 border-gray-200 pl-3">
      {error ? <p role="alert" className="text-red-700">{error} <button type="button" disabled={busy} onClick={() => void load()} className="ml-2 underline">Erneut laden</button></p> : null}
      {history ? <>
        <p className="mb-3 text-[11px] leading-5 text-gray-600">Originalbesuch: {clock(history.originalStartedAt)} – {clock(history.originalCompletedAt)}</p>
        {history.timeRemoved ? <p className="mb-2 text-amber-700">Zeit nach Prüfung entfernt. Der ursprüngliche Verlauf bleibt erhalten.</p> : null}
        <ol className="space-y-4">
          {history.revisions.map(row => <li key={row.revision} className="">
            <div className="flex flex-wrap items-center justify-between gap-1"><strong className="font-semibold text-gray-800">Version {row.revision}{row.isCurrent ? " · Aktuell" : ""}</strong><span>{row.actualMinutes} Min{row.travelMinutes ? ` + ${row.travelMinutes} Min Fahrt` : ""}</span></div>
            <p className="mt-1 tabular-nums">{clock(row.startedAt)} – {clock(row.completedAt)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-5 text-gray-600">{row.reason} · erfasst {clock(row.recordedAt)}</p>
          </li>)}
        </ol>
        {history.nextRevision ? <button type="button" disabled={busy} onClick={() => void load(history.nextRevision!)} className="mt-3 min-h-10 rounded text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50">Ältere Versionen</button> : null}
      </> : null}
      {busy ? <p role="status" className="py-2 text-gray-600">Zeitverlauf wird geladen…</p> : null}
    </div>
  </details>;
}
