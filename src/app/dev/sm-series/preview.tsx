"use client";
import { useState } from "react";
import { SmSeriesDrawer } from "@/components/admin/sm/SmSeriesDrawer";
import { AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import type { SmSeriesDetails, SmSeriesPreview, SmSeriesChange } from "@/types/smPlanning";
import type { SmMarketRecord } from "@/types/smMarkets";
import type { SMRecord } from "@/types/shelfmerchandiser";

const details: SmSeriesDetails = { id: "local-series", status: "active", versionNumber: 1, effectiveFromDate: "2026-09-07", today: "2026-09-14", smMarketId: "local-market", smUserId: "local-sm", plannedMinutes: 90, frequency: "weekly", weekdays: [1,3], validFrom: "2026-09-07", validTo: "2026-12-31" };
const market: SmMarketRecord = { id: "local-market", name: "Billa · Testmarkt", dbName: "Billa", internalId: "SM-PREVIEW", address: "Musterstraße 1", postalCode: "1010", city: "Wien", region: "Ost", isActive: true, infoFlag: false, infoNote: "", assignedSmUserId: "local-sm", fieldServiceManagerUserId: null };
const user: SMRecord = { id: "local-sm", firstName: "Test", lastName: "SM", email: "preview@example.test", isActive: true, travelTimeEnabled: false, createdAt: "2026-09-14" };
const result = (change: SmSeriesChange): SmSeriesPreview => ({ previewToken: "a".repeat(64), effectiveFromDate: change.effectiveFromDate, updateCount: change.action === "edit" ? 12 : 0, createCount: change.action === "edit" ? 2 : 0, cancelCount: change.action === "stop" ? 14 : 3, restoreCount: 0, protectedCount: 2, preservedDateCount: 1, blockedDateCount: 0 });
const service = { load: async () => details, preview: async (_id: string, change: SmSeriesChange) => result(change), save: async (_id: string, input: { change: SmSeriesChange; previewToken: string; reason: string }) => result(input.change) };
export default function Preview({ styles }: { styles: string }) {
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState("");
  const [fail, setFail] = useState(false);
  const [stableService] = useState(() => service);
  const [staleService] = useState(() => ({ ...service, save: async () => { throw new Error("Die Planung hat sich geändert. Bitte die Vorschau erneut prüfen; es wurde nichts gespeichert."); } }));
  return <main className="min-h-dvh bg-[#f5f5f7] p-6 text-[#1a1a1a]"><style>{styles}</style><AdminFilterControlStyles/>
    <h1 className="text-base font-semibold">SM · Serienverwaltung</h1><p className="mt-1 text-xs text-black/40">Lokale UI-Prüfung. Kein Zugriff auf Produktionsdaten.</p>
    <button className="sm-plan-secondary-button mt-4" type="button" onClick={() => setOpen(true)}>Serie öffnen</button>
    <label className="ml-4 text-xs"><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)}/> Konflikt simulieren</label>
    <p role="status" className="mt-3 text-xs text-green-700">{notice}</p>
    {open ? <SmSeriesDrawer key={String(fail)} seriesId="local-series" selectedDate="2026-09-14" markets={[market]} users={[user]} onBack={() => setOpen(false)} onClose={() => setOpen(false)} onSaved={async (_result, action) => { setNotice(action === "stop" ? "Serie gestoppt (lokal)" : "Serie geändert (lokal)"); }} service={fail ? staleService : stableService}/> : null}
  </main>;
}
