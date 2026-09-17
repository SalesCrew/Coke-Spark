"use client";

import { useMemo, useRef, useState } from "react";
import { SmZeiterfassungWorkspace, type SmTimeApi } from "@/components/admin/sm/SmZeiterfassungWorkspace";
import { smMonthPeriod } from "@/lib/sm/planningPeriod";
import { smTimeFixtures, timeFixture } from "../../../../tests/fixtures/sm-time";

export default function Preview() {
  const rows = useRef(smTimeFixtures());
  const mode = useRef("normal");
  const [scenario, setScenario] = useState("normal");
  const [calls, setCalls] = useState<string[]>([]);
  const [instance, setInstance] = useState(0);
  const api = useMemo<SmTimeApi>(() => ({
    async load(from, to) {
      const behavior = mode.current;
      setCalls((current) => [...current, `GET ${from} → ${to}`]);
      await new Promise((resolve) => setTimeout(resolve, behavior === "slow" && from === "2026-08-01" ? 6000 : behavior === "slow" ? 600 : 150));
      if (behavior === "error") throw new Error("Lokaler Test: Laden fehlgeschlagen.");
      if (behavior === "empty") return [];
      // Deliberately return boundary rows too: the real view must filter defensively.
      return structuredClone(rows.current);
    },
    async save(id, input) {
      setCalls((current) => [...current, `SAVE ${id} ${JSON.stringify(input)}`]);
      if (mode.current === "save-error") throw new Error("Lokaler Test: Änderung abgelehnt.");
      const row = rows.current.find((entry) => entry.id === id)!;
      const revision = (row.timeEntry?.revisionNumber ?? 0) + 1;
      row.actualMinutes = input.actualMinutes;
      row.timeEntry = { id: `local-time-${revision}`, revisionNumber: revision, actualMinutes: input.actualMinutes, submittedByUserId: "local-admin", submittedAt: new Date().toISOString(), correctionReason: input.correctionReason ?? null };
      if (mode.current === "reload-error") mode.current = "error";
      return { submissionId: row.timeEntry.id, actualMinutes: input.actualMinutes, revisionNumber: revision, replayed: false };
    },
    async correctVisit(id, input) {
      setCalls((current) => [...current, `CORRECT VISIT ${id} ${JSON.stringify(input)}`]);
      if (mode.current === "save-error") throw new Error("Lokaler Test: Änderung abgelehnt.");
      const row = rows.current.find((entry) => entry.id === id)!;
      const revision = (row.timeEntry?.revisionNumber ?? 0) + 1;
      const actualMinutes = Math.round((new Date(input.visitCompletedAt).getTime() - new Date(input.visitStartedAt).getTime()) / 60_000);
      row.visit!.visitStartedAt = input.visitStartedAt; row.visit!.visitCompletedAt = input.visitCompletedAt;
      row.actualMinutes = actualMinutes;
      row.timeEntry = { id: `local-time-${revision}`, revisionNumber: revision, actualMinutes, submittedByUserId: "local-admin", submittedAt: new Date().toISOString(), correctionReason: input.reason };
      return { replayed: false, actualMinutes, revisionNumber: revision };
    },
    async approve(id) {
      setCalls((current) => [...current, `APPROVE ${id}`]);
      const row = rows.current.find((entry) => entry.pendingTimeChangeRequest?.id === id)!;
      const request = row.pendingTimeChangeRequest!;
      row.actualMinutes = request.requestedMinutes;
      row.visit!.visitStartedAt = request.requestedStartedAt; row.visit!.visitCompletedAt = request.requestedCompletedAt;
      row.pendingTimeChangeRequest = null;
      return { request: { ...request, status: "approved" }, replayed: false };
    },
    async reject(id) {
      setCalls((current) => [...current, `REJECT ${id}`]);
      const row = rows.current.find((entry) => entry.pendingTimeChangeRequest?.id === id)!;
      const request = row.pendingTimeChangeRequest!; row.pendingTimeChangeRequest = null;
      return { request: { ...request, status: "rejected" }, replayed: false };
    },
  }), []);
  return <main className="min-h-dvh bg-[#f5f5f7] p-6 text-[#1a1a1a]">
    <h1 className="text-base font-semibold">SM-Zeiterfassung · lokale Prüfung</h1>
    <p className="mb-4 mt-1 text-xs text-black/45">Echte Workspace-Komponente mit lokalem API-Ersatz. Keine Produktionsdaten, keine GM-Aufrufe.</p>
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
      <label>Szenario <select aria-label="Testszenario" value={scenario} onChange={(event) => { mode.current = event.target.value; setScenario(event.target.value); }} className="rounded border p-1">
        <option value="normal">Normal</option><option value="slow">Langsam / überholte Antwort</option><option value="error">Ladefehler</option><option value="empty">Leer</option><option value="save-error">Speicherfehler</option><option value="reload-error">Ladefehler nach Speichern</option>
      </select></label>
      <button onClick={() => setInstance((current) => current + 1)}>Ansicht neu laden</button>
      <button onClick={() => { rows.current = [...rows.current, ...Array.from({ length: 20 }, (_, i) => timeFixture(`extra-${i}`, "2026-09-14", 10))]; setInstance((current) => current + 1); }}>20 Besuche ergänzen</button>
    </div>
    <SmZeiterfassungWorkspace key={instance} api={api} initialPeriod={smMonthPeriod("2026-09-14")}/>
    <details className="mt-6 text-xs"><summary>Lokales API-Protokoll</summary><pre data-testid="api-calls" className="mt-2 whitespace-pre-wrap text-[10px]">{calls.join("\n")}</pre></details>
  </main>;
}
