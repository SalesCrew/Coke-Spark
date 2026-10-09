"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { AdminDropdown } from "@/components/admin/AdminFilterControls";
import { getAuthPrincipalKey, readAuthSession, requestSMDurcharbeitCampaign, subscribeAuthSession } from "@/lib/api/backend";
import { exportSMDurcharbeitReport } from "@/lib/exports/smSMDurcharbeitReportExport";
import type { SMDurcharbeitCampaign, SMDurcharbeitReport, SMDurcharbeitTarget } from "@/types/smSMDurcharbeitCampaign";

const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;
const button = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-black/[.08] bg-gradient-to-b from-white to-gray-50 px-3 text-[10px] font-semibold text-gray-600 shadow-sm disabled:opacity-40";
const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("de-AT", { maximumFractionDigits: 1 })} %`;

export function SMDurcharbeitMonthlyReport({ campaign, month, targets, reloadKey }: {
  campaign: SMDurcharbeitCampaign; month: string; targets: SMDurcharbeitTarget[]; reloadKey: number;
}) {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  return owner ? <Report key={`${owner}:${campaign.id}:${campaign.revision}:${month}:${reloadKey}`} campaign={campaign} month={month} targets={targets} /> : null;
}

function Report({ campaign, month, targets }: { campaign: SMDurcharbeitCampaign; month: string; targets: SMDurcharbeitTarget[] }) {
  const [open, setOpen] = useState(false), [sm, setSm] = useState(""), [retry, setRetry] = useState(0);
  const [report, setReport] = useState<SMDurcharbeitReport | null>(null), [error, setError] = useState<string | null>(null), [exporting, setExporting] = useState(false);
  const generation = useRef(0), latestReport = useRef(report); latestReport.current = report;
  useEffect(() => {
    if (!open) return;
    const requests = generation, request = ++requests.current; setReport(null); setError(null);
    requestSMDurcharbeitCampaign<SMDurcharbeitReport>(`/${campaign.id}/results?month=${encodeURIComponent(month)}${sm ? `&smUserId=${encodeURIComponent(sm)}` : ""}`)
      .then(result => { if (request === generation.current) setReport(result); })
      .catch(failure => { if (request === generation.current) setError(failure instanceof Error ? failure.message : "Auswertung konnte nicht geladen werden."); });
    return () => { requests.current++; latestReport.current = null; };
  }, [campaign.id, month, open, retry, sm]);
  const exportReport = async () => {
    if (!report || exporting) return;
    const version = generation.current; setExporting(true);
    try { await exportSMDurcharbeitReport(report, campaign.name, () => version === generation.current && latestReport.current === report); }
    catch (failure) { if (version === generation.current) setError(failure instanceof Error ? failure.message : "Export konnte nicht erstellt werden."); }
    finally { if (version === generation.current) setExporting(false); }
  };
  const people = [...new Map(targets.map(target => [target.smUserId, { value: target.smUserId, label: target.smName }])).values()];
  return <details className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,.025)]" onToggle={event => { setOpen(event.currentTarget.open); if (!event.currentTarget.open) setExporting(false); }}>
    <summary className="cursor-pointer px-4 py-4 text-[13px] font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600">Monatsauswertung</summary>
    {open ? <div className="border-t border-black/[.05] p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-[220px]"><AdminDropdown value={sm} options={[{ value: "", label: "Alle SMs" }, ...people]} onChange={value => { generation.current++; latestReport.current = null; setReport(null); setExporting(false); setSm(value); }} ariaLabel="SM für Monatsauswertung" placeholder="Alle SMs" /></div>
        <button type="button" disabled={!report || exporting} onClick={() => void exportReport()} className={button}>{exporting ? <LoaderCircle size={12} className="motion-safe:animate-spin" /> : <Download size={12} />}Excel Export</button>
      </header>
      <p className="mb-4 text-[11px] leading-5 text-gray-600">Antworten: letzte gültige Abgabe je erforderlichem Markt. Tatsächliche Besuche und Zeiten bleiben einzeln erhalten.</p>
      {error ? <p role="alert" className="text-[11px] text-red-700">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 underline">Erneut laden</button></p> : null}
      {!report && !error ? <div role="status" className="space-y-3 motion-safe:animate-pulse"><span className="sr-only">Monatsauswertung wird geladen</span><div className="h-10 rounded-lg bg-gray-50" /><div className="h-24 rounded-lg bg-gray-50" /></div> : null}
      {report ? <>
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">{[
          ["Abdeckung", `${report.summary.completed}/${report.summary.required} · ${percent(report.summary.coveragePercentage)}`],
          ["Tatsächliche Besuche", String(report.summary.physicalVisits)], ["Istzeit", `${report.summary.actualMinutes} Min`],
          ["Foto-Originale", String(report.summary.availablePhotoUploads)],
        ].map(([label, value]) => <div key={label}><p className="text-[10px] leading-4 text-gray-600">{label}</p><p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums text-gray-900">{value}</p></div>)}</div>
        <div className="divide-y divide-black/[.06]">{report.questionResults.map(question => <div key={`${question.questionVersionId}:${question.questionCode}`} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-[12px] font-semibold leading-5 text-gray-800">{question.text}</h4><p className="text-[10px] tabular-nums text-gray-600">{question.answered}/{question.applicable} beantwortet</p></div>
          {question.distribution.length ? <div className="mt-3 space-y-2">{question.distribution.map(option => <div key={option.code} className="grid grid-cols-[minmax(60px,1fr)_minmax(60px,2fr)_75px] items-center gap-3 text-[10px]"><span className="break-words text-gray-600">{option.label}</span><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${option.percentage ?? 0}%` }} /></div><span className="text-right tabular-nums text-gray-600">{option.count} · {percent(option.percentage)}</span></div>)}</div>
            : question.average !== null ? <p className="mt-2 text-[11px] text-gray-600">Durchschnitt: {question.average.toLocaleString("de-AT", { maximumFractionDigits: 2 })}</p>
              : <p className="mt-2 text-[11px] text-gray-600">Einzelantworten im Excel Export und FB Management.</p>}
          {question.type === "multiple" ? <p className="mt-2 text-[10px] leading-4 text-gray-600">Mehrfachauswahl · Summe kann über 100 % liegen.</p> : null}
        </div>)}</div>
        {!report.questionResults.length ? <p className="text-[11px] text-gray-600">Noch keine gültigen Monatsantworten für diese Auswahl.</p> : null}
        <p className="mt-4 text-[10px] leading-4 text-gray-600">{report.summary.waived} Märkte ausgenommen · {report.summary.travelMinutes} Min Fahrtzeit · {report.summary.validQuestionnaireVisits} Besuche mit gültigen Antworten</p>
      </> : null}
    </div> : null}
  </details>;
}
