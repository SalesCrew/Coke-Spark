"use client";

import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { useSmSMDurcharbeitTargets } from "@/hooks/useSmSMDurcharbeitTargets";
import { SMDurcharbeitMonthLabel, SMDurcharbeitTargetProgress } from "@/lib/sm/SMDurcharbeitTargetView";

export function SmSMDurcharbeitSummary() {
  const { loaded, error } = useSmSMDurcharbeitTargets();
  const progress = loaded ? SMDurcharbeitTargetProgress(loaded.targets) : null;
  return <Link href="/sm/durcharbeit" aria-label="Durcharbeit-Märkte öffnen" aria-describedby="sm-durcharbeit-summary" data-sm-durcharbeit-entry
    className="flex min-h-[160px] w-full flex-1 flex-col justify-between gap-6 rounded-xl bg-white p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,.04)] transition-colors hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    <span className="flex items-center gap-3">
      <ClipboardCheck size={18} className="shrink-0 text-blue-600" />
      <span className="flex-1 text-[14px] font-semibold text-gray-900">Durcharbeit</span>
      <ChevronRight size={16} className="shrink-0 text-gray-500" />
    </span>
    <span id="sm-durcharbeit-summary" className="block text-[12px] leading-5 text-gray-600">
      {error ? "Aktueller Stand nicht erreichbar"
        : loaded ? <>
          <span className="block">{SMDurcharbeitMonthLabel(loaded.month)}</span>
          {progress?.required ? <>
            <span className="mt-1 flex items-baseline gap-2"><span className="text-[24px] font-semibold leading-8 tracking-tight text-gray-900">{progress.completed}</span><span>von {progress.required} erledigt</span></span>
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${100 * progress.completed / progress.required}%` }} /></span>
          </> : <span className="mt-1 block">Keine offenen Monatsziele</span>}
        </> : <span role="status" className="block space-y-2 motion-safe:animate-pulse"><span className="block h-3 w-28 rounded bg-gray-100" /><span className="block h-6 w-36 rounded bg-gray-100" /><span className="sr-only">Durcharbeit wird geladen</span></span>}
    </span>
  </Link>;
}
