"use client";
import { useState } from "react";
import { SmPlanningPeriodPicker } from "@/components/admin/sm/SmPlanningPeriodPicker";
import { AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { currentSmPeriod, shiftSmPeriod, smPeriodExportSlug, smPeriodHeading, smPeriodLabel, smWeekPeriod } from "@/lib/sm/planningPeriod";

const dates = ["2026-08-31", "2026-09-01", "2026-09-14", "2026-09-30", "2026-10-01"];
export default function Preview({ styles }: { styles: string }) {
  const [period, setPeriod] = useState(() => smWeekPeriod("2026-09-14"));
  const [applied, setApplied] = useState(0);
  const rows = dates.filter((date) => date >= period.from && date <= period.to);
  return <main className="min-h-dvh bg-[#f5f5f7] p-8 text-[#1a1a1a]">
    <style>{styles}</style><AdminFilterControlStyles/>
    <h1 className="text-base font-semibold">SM · Verplanung-Tage</h1>
    <p className="mt-1 text-xs text-black/45">Lokale Kalenderprüfung mit Grenzdatums-Beispielen. Kein Zugriff auf Produktionsdaten.</p>
    <section className="mt-6 max-w-3xl rounded-xl border border-black/[.07] bg-white p-5">
      <h2 className="mb-3 text-xs font-semibold">{smPeriodHeading(period)}</h2>
      <div className="flex items-center gap-2">
        <button className="sm-plan-icon-button" aria-label="Vorheriger Planungszeitraum" onClick={() => setPeriod((current) => shiftSmPeriod(current, -1))}>‹</button>
        <SmPlanningPeriodPicker value={period} onChange={(next) => { setPeriod(next); setApplied((count) => count + 1); }}/>
        <button className="sm-plan-icon-button" aria-label="Nächster Planungszeitraum" onClick={() => setPeriod((current) => shiftSmPeriod(current, 1))}>›</button>
        <button className="sm-plan-secondary-button" onClick={() => setPeriod((current) => currentSmPeriod(current.mode))}>Heute</button>
      </div>
      <p role="status" className="mt-4 text-xs">{smPeriodLabel(period, true)}</p>
      <pre data-testid="range" className="my-3 text-[11px]">{JSON.stringify(period)} · {applied} Auswahlen</pre>
      <p className="text-xs text-black/45">{rows.length} Beispiel-Einsätze · Export: {smPeriodExportSlug(period)}</p>
      <ul className="mt-3 text-xs">{rows.map((day) => <li key={day} className="border-t border-black/[.05] py-2">{day} · Testmarkt</li>)}</ul>
    </section>
  </main>;
}
