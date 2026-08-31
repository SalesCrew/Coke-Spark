"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, MapPin } from "lucide-react";

export type SmVisitTimeConflictDetails = {
  proposedStartedAt: string; proposedCompletedAt: string;
  conflicts: Array<{ submissionId: string; marketName: string; marketAddress: string; startedAt: string; completedAt: string }>;
};
const dateTime = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function range(start: string, end: string) { return `${dateTime.format(new Date(start))} – ${dateTime.format(new Date(end))} Uhr`; }

export function SmVisitTimeConflict({ details }: { details: SmVisitTimeConflictDetails }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [details]);
  return <section ref={panel} tabIndex={-1} role="alert" className="mt-4 rounded-[14px] border border-red-200 bg-white p-4 shadow-sm outline-none">
    <div className="flex items-center gap-2 text-red-700"><AlertCircle size={18} className="shrink-0" /><h2 className="text-[14px] font-bold">Abschluss blockiert: Zeiten überschneiden sich</h2></div>
    <p className="mt-2 text-[12px] leading-relaxed text-gray-700">Du hast in dieser Zeit bereits einen Fragebogen abgeschlossen:</p>
    <div className="mt-3 space-y-2">{details.conflicts.map((conflict) => <div key={conflict.submissionId} className="rounded-[10px] bg-red-50 p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-gray-900"><MapPin size={13} />{conflict.marketName}</p>
      <p className="mt-1 text-[11px] text-gray-600">{conflict.marketAddress}</p>
      <p className="mt-2 text-[12px] font-bold tabular-nums text-red-700">{range(conflict.startedAt, conflict.completedAt)}</p>
    </div>)}</div>
    <p className="mt-3 text-[11px] text-gray-500">Dein letzter Versuch</p>
    <p className="mt-1 text-[12px] font-semibold tabular-nums text-gray-900">{range(details.proposedStartedAt, details.proposedCompletedAt)}</p>
    <p className="mt-3 text-[12px] font-semibold leading-relaxed text-gray-900">Du kannst nicht gleichzeitig in zwei Märkten sein. Ändere oben Start und Ende und schließe den Besuch erneut ab.</p>
    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">Dieser Abschluss wurde nicht gespeichert. Deine Antworten bleiben erhalten.</p>
  </section>;
}
