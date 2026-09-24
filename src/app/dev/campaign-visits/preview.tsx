"use client";

import { useState } from "react";
import { CampaignVisitAssignmentsDialog, type CampaignVisitMarket } from "@/components/admin/campaigns/CampaignVisitAssignmentsDialog";
import type { Campaign } from "@/types/campaign";
import type { GMRecord } from "@/types/gebietsmanager";

const gm = (id: string, firstName: string, lastName: string): GMRecord => ({
  id, firstName, lastName, email: `${firstName.toLowerCase()}@example.test`, phone: "", address: "", city: "", postalCode: "", region: "", ipp: 0, createdAt: "2026-01-01T00:00:00.000Z", isActive: true,
});
const people = [gm("gm-alex", "Alex", "Felsberger"), gm("gm-pascal", "Pascal", "Wunder"), gm("gm-maria", "Maria", "Muster")];
const markets: CampaignVisitMarket[] = [
  { id: "market-1", name: "Billa Plus St. Pölten", chain: "Billa", address: "Anton Scheiblin-Gasse 8", postalCode: "3100", city: "St. Pölten", region: "Ost", flexNumber: "S2040", cokeMasterNumber: "1210089370" },
  { id: "market-2", name: "Eurospar Krems", chain: "Eurospar", address: "Ringstraße 4", postalCode: "3500", city: "Krems", region: "Ost", flexNumber: "S6347", cokeMasterNumber: "1210116970" },
  { id: "market-3", name: "Sparmarkt Linz", chain: "Sparmarkt", address: "Hauptstraße 12", postalCode: "4020", city: "Linz", region: "West", flexNumber: "S1542", cokeMasterNumber: "1210009203" },
];
const initial: Campaign = {
  id: "local-campaign", name: "Coke Shelf Merchandising 2026", section: "standard", status: "active", scheduleType: "scheduled", startDate: "2026-09-01", endDate: "2026-09-30", currentFragebogenId: null, currentFragebogenName: null,
  marketIds: markets.map((market) => market.id), history: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  assignments: [
    { id: "assignment-1", marketId: "market-1", gmUserId: "gm-alex", gmName: "Alex Felsberger", assignmentSlot: 1, visitTargetCount: 2, currentVisitsCount: 0 },
    { id: "assignment-2", marketId: "market-2", gmUserId: "gm-pascal", gmName: "Pascal Wunder", assignmentSlot: 1, visitTargetCount: 1, currentVisitsCount: 0 },
    { id: "assignment-3", marketId: "market-3", gmUserId: "gm-alex", gmName: "Alex Felsberger", assignmentSlot: 2, visitTargetCount: 2, currentVisitsCount: 1 },
  ],
};
export default function Preview() {
  const [campaign, setCampaign] = useState(initial);
  const [open, setOpen] = useState(true);
  const [lastAction, setLastAction] = useState("Keine Änderungen");
  return <main className="min-h-dvh bg-[#f5f5f7] p-6 text-[#1a1a1a]">
    <h1 className="text-base font-semibold">GM-Besuchsplanung · lokale Vorschau</h1>
    <p className="mt-1 text-xs text-black/45">Nur Beispieldaten. Änderungen bleiben in diesem Browser und berühren keine Datenbank.</p>
    <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white">Besuche &amp; GM öffnen</button>
    <div className="mt-3 flex gap-2">{(["standard", "kuehler", "flex"] as const).map((section) => <button key={section} type="button"
      onClick={() => { setCampaign({ ...initial, section }); setOpen(true); }}
      className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs">{section}</button>)}</div>
    <p className="mt-3 text-xs text-black/50">{lastAction}</p>
    {open ? <CampaignVisitAssignmentsDialog
      campaign={campaign}
      markets={markets}
      marketsLoading={false}
      marketsError={null}
      onRetryMarkets={() => undefined}
      gmUsers={people}
      gmUsersLoading={false}
      gmUsersError={null}
      loadVisitProgress={async () => ({
        completedByAssignmentId: { "assignment-3": 1 },
        startedByAssignmentId: { "assignment-1": 1 },
      })}
      onClose={() => setOpen(false)}
      onSaveVisit={async (assignmentId, input) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const source = campaign.assignments.find((entry) => entry.id === assignmentId);
        if (!source || source.gmUserId !== input.expectedGmUserId || source.visitTargetCount !== input.expectedVisitTargetCount) throw new Error("Die Besuchsplanung wurde inzwischen geändert.");
        const targetGm = people.find((entry) => entry.id === input.toGmUserId)!;
        const otherAssignments = campaign.assignments.filter((entry) => entry.id !== assignmentId).map((entry) => ({ ...entry }));
        const next = campaign.section === "kuehler" ? otherAssignments : source.visitTargetCount > 1
          ? [...otherAssignments, { ...source, visitTargetCount: source.visitTargetCount - 1 }] : otherAssignments;
        const existingTarget = campaign.section === "kuehler" ? null : next.find((entry) => entry.marketId === source.marketId && entry.assignmentSlot === source.assignmentSlot && entry.gmUserId === input.toGmUserId);
        if (existingTarget) existingTarget.visitTargetCount += 1;
        else next.push({ ...source, id: crypto.randomUUID(), gmUserId: input.toGmUserId, gmName: `${targetGm.firstName} ${targetGm.lastName}`,
          assignmentSlot: campaign.section === "kuehler" ? Math.max(0, ...next.filter((entry) => entry.marketId === source.marketId && entry.gmUserId === input.toGmUserId).map((entry) => entry.assignmentSlot)) + 1 : source.assignmentSlot,
          visitTargetCount: campaign.section === "kuehler" ? source.visitTargetCount : 1, currentVisitsCount: 0 });
        const updated = { ...campaign, assignments: next };
        setLastAction(`Ein Besuch von ${source.gmName} zu ${targetGm.firstName} ${targetGm.lastName} umgeplant.`);
        setCampaign(updated);
        return updated;
      }}
      onReassigned={setCampaign}
    /> : null}
  </main>;
}
