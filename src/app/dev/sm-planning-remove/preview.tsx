"use client";

import { useState } from "react";
import { PlanningDrawer, type PlanningSubmitRequest } from "@/components/admin/sm/SmVerplanungWorkspace";
import { AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import type { SmPlanningAssignment, SmPlanningStatus } from "@/types/smPlanning";
import type { SmMarketRecord } from "@/types/smMarkets";
import type { SMRecord } from "@/types/shelfmerchandiser";

const market: SmMarketRecord = { id: "local-market", name: "Billa · Testmarkt", dbName: "Billa", internalId: "SM-PREVIEW", address: "Musterstraße 1", postalCode: "1010", city: "Wien", region: "Ost", isActive: true, infoFlag: false, infoNote: "", assignedSmUserId: "local-sm", fieldServiceManagerUserId: null };
const user: SMRecord = { id: "local-sm", firstName: "Test", lastName: "SM", email: "preview@example.test", isActive: true, travelTimeEnabled: false, createdAt: "2026-09-14" };
const original = { workDate: "2026-09-18", smUserId: user.id, smName: "Test SM", smMarketId: market.id, marketInternalId: market.internalId, marketName: market.name, plannedMinutes: 60 };
const assignment: SmPlanningAssignment = { id: "local-assignment", sourceType: "single", seriesId: null, seriesVersionId: null, seriesOccurrenceKey: null, status: "planned", original, effective: { ...original, address: market.address, region: market.region }, replacement: { workDate: null, smUserId: null, smName: null, smMarketId: null, marketInternalId: null, plannedMinutes: null }, series: null, actualMinutes: null, timeEntry: null, visit: null, pendingTimeChangeRequest: null, flatRateCents: null, questionnaireComplete: false, cancellation: null, createdAt: "2026-09-14T12:00:00Z", updatedAt: "2026-09-14T12:00:00Z" };

export default function Preview({ styles }: { styles: string }) {
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<SmPlanningStatus>("planned");
  const [fail, setFail] = useState(false);
  const [lastRequest, setLastRequest] = useState("");
  const submit = async (request: PlanningSubmitRequest) => {
    if (fail) throw new Error("Der Einsatz wurde zwischenzeitlich geändert. Bitte neu laden.");
    setLastRequest(JSON.stringify(request));
    if (request.kind === "cancel") setStatus("cancelled");
    if (request.kind === "restore") setStatus("planned");
  };
  return <main className="min-h-dvh bg-[#f5f5f7] p-6 text-[#1a1a1a]">
    <style>{styles}</style><AdminFilterControlStyles/>
    <h1 className="text-base font-semibold">SM · Einsatz entfernen</h1>
    <p className="mt-1 text-xs text-black/40">Lokale UI-Prüfung · Speicherung nur im Browser, keine Produktionsdaten.</p>
    <div className="mt-4 flex gap-2">{(["planned", "completed", "cancelled"] as const).map((value) => <button className="sm-plan-secondary-button" key={value} onClick={() => { setStatus(value); setOpen(true); }}>{value}</button>)}<button className="sm-plan-secondary-button" onClick={() => setOpen(true)}>Öffnen</button></div>
    <label className="mt-3 block text-xs"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)}/> Konflikt simulieren</label>
    <p role="status" className="mt-3 text-xs">Status: {status}</p>
    <pre data-testid="last-request" className="mt-4 max-w-lg whitespace-pre-wrap text-[10px]">{lastRequest}</pre>
    {open ? <PlanningDrawer key={status} mode="single" assignment={{ ...assignment, status, cancellation: status === "cancelled" ? { reason: "Markt versehentlich verplant", cancelledAt: assignment.updatedAt } : null }} defaultDate="2026-09-18" markets={[market]} users={[user]} onClose={() => setOpen(false)} onSubmit={submit} onSeriesSaved={async () => undefined}/> : null}
  </main>;
}
