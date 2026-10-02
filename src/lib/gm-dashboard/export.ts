import type { DashboardExport } from "@/types/gm-dashboard";
import type { Workspace } from "@/types/praemien-workspace";
import { availabilitySummary } from "./data";
import { chainGroupLabel } from "./chain-groups";
import {
  appendMetaSheet,
  appendTableSheet,
  buildAndDownloadWorkbook,
} from "@/lib/exports/workbook";

export async function exportRealGmDashboard(input: {
  datasets: DashboardExport[];
  bonus?: Workspace | null;
  exportedBy?: string;
}) {
  if (
    !["IPP", "Fuellstand", "Platzierungen", "Aktivitaet"].every((title) =>
      input.datasets.some((dataset) => dataset.title === title),
    )
  )
    throw new Error("Bitte warten, bis alle Dashboardkarten geladen sind.");
  await buildAndDownloadWorkbook({
    filename: `CokeSpark_GM_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        { label: "Export", value: "GM Dashboard – Echtdaten" },
        { label: "Erstellt von", value: input.exportedBy },
        { label: "Zeitzone", value: "Europe/Vienna" },
        {
          label: "Regeln",
          value:
            "Top 100 / Mediocre 50 / Bad 0; STC = geplante Besuche/Jahr: Gold 12–24, Silver 8–10, Bronze 6–7; Platzierungen = konfigurierte Punkte",
        },
      ]);
      for (const entry of input.datasets) {
        const selected = entry.data.points.find(
          (p) => p.id === entry.selectedIntervalId,
        );
        const comparison = entry.data.points.find(
          (p) => p.id === entry.comparisonIntervalId,
        );
        if (entry.title === "Platzierungen") {
          appendTableSheet(XLSX, wb, {
            name: "Mitbewerb Details",
            title: "Abfrage Mitbewerb – Ergebnisse je Frage und Intervall",
            rows: entry.data.points.flatMap((point) => (point.competitorQuestions ?? []).map((question) => ({ point, question }))),
            columns: [
              { header: "Intervall", width: 25, value: (row) => row.point.label },
              { header: "Modul", width: 30, value: (row) => row.question.moduleName },
              { header: "Frage", width: 70, value: (row) => row.question.questionText },
              { header: "Ja", value: (row) => row.question.yesCount },
              { header: "Nein", value: (row) => row.question.noCount },
              { header: "Märkte", value: (row) => row.question.marketCount },
              { header: "Mitbewerber Punkte", value: (row) => row.question.points },
            ],
          });
        }
        appendTableSheet(XLSX, wb, {
          name: `${entry.title} Filter`,
          title: `${entry.title} – Filter und Auswahl`,
          rows: Object.entries({
            ...entry.data.scope,
            stcApplied: entry.data.stcApplied,
            marketIds: entry.data.scope.marketIds?.length ? entry.data.scope.marketIds.join(", ") : "Alle Märkte",
            chainGroups: entry.data.scope.chainGroups?.length ? chainGroupLabel(entry.data.scope.chainGroups) : "",
            chains: entry.data.scope.chains?.length ? entry.data.scope.chains.map((chain) => chain || "Ohne Handelskette").join(", ") : "Alle Chains",
            selectedIntervalId: entry.selectedIntervalId,
            highlightedType: entry.highlightedType ?? "",
            comparisonPreset: entry.comparisonPreset ?? "",
            comparisonIntervalId: entry.comparisonIntervalId ?? "",
            ...(entry.title === "IPP"
              ? {
                  selectedIpp: selected?.ipp ?? null,
                  comparisonIpp: comparison?.ipp ?? null,
                  comparisonDelta:
                    selected?.ipp != null && comparison?.ipp != null
                      ? selected.ipp - comparison.ipp
                      : null,
                }
              : {}),
            calculatedAt: entry.data.calculatedAt,
          }),
          columns: [
            { header: "Filter", value: (r) => r[0] },
            { header: "Wert", width: 45, value: (r) => r[1] },
          ],
        });
        if (entry.title === "Fuellstand") {
          const rows = entry.data.points.flatMap((p) =>
            Object.entries(p.availability).map(([type, c]) => ({
              p,
              type,
              c,
              split: availabilitySummary(p, entry.highlightedType ?? null),
            })),
          );
          appendTableSheet(XLSX, wb, {
            name: entry.title,
            title: "Füllstand – alle Beobachtungen je Intervall",
            rows,
            columns: [
              { header: "Intervall", value: (r) => r.p.label },
              { header: "Von", value: (r) => r.p.start },
              { header: "Bis", value: (r) => r.p.end },
              { header: "Kategorie", value: (r) => r.type },
              { header: "Durchschnitt %", value: (r) => r.c.average },
              { header: "Top Anzahl", value: (r) => r.c.top },
              { header: "Mediocre Anzahl", value: (r) => r.c.mediocre },
              { header: "Bad Anzahl", value: (r) => r.c.bad },
              { header: "Beobachtungen", value: (r) => r.c.total },
              { header: "Score Top % (Auswahl)", value: (r) => r.split.topPct },
              {
                header: "Score Mediocre % (Auswahl)",
                value: (r) => r.split.mediocrePct,
              },
              { header: "Score Bad % (Auswahl)", value: (r) => r.split.badPct },
              {
                header: "Abfragen beantwortet",
                value: (r) => r.p.availabilityAnswered,
              },
              {
                header: "Abfragen gesamt",
                value: (r) => r.p.availabilityExpected,
              },
            ],
          });
        } else {
          appendTableSheet(XLSX, wb, {
            name: entry.title,
            title: entry.title,
            rows: entry.data.points,
            columns: [
              { header: "Intervall", width: 25, value: (r) => r.label },
              { header: "Von", value: (r) => r.start },
              { header: "Bis", value: (r) => r.end },
              { header: "IPP", value: (r) => r.ipp },
              { header: "IPP Quelle", value: (r) => r.ippSource },
              { header: "IPP Märkte", value: (r) => r.ippMarketCount },
              { header: "Coke Punkte", value: (r) => r.placements },
              { header: "Mitbewerber Punkte", value: (r) => r.competitor },
              { header: "Besuche", value: (r) => r.visits },
              { header: "RED Besuche", value: (r) => r.redSurveys },
              { header: "Ø Minuten", value: (r) => r.averageMinutes },
              { header: "Nur Standard", value: (r) => r.standardOnly },
              { header: "Nur Flex", value: (r) => r.flexOnly },
              { header: "Beide", value: (r) => r.mixed },
              { header: "Andere", value: (r) => r.other },
            ],
          });
        }
      }
      if (input.bonus) {
        const bonus = input.bonus;
        appendTableSheet(XLSX, wb, {
          name: "Boni",
          title: `${bonus.wave.name} – ${bonus.closedAt ? "Abgeschlossen" : bonus.wave.status === "draft" ? "Entwurf / Vorschau" : "Laufende Berechnung"}`,
          rows: bonus.results.flatMap((gm) =>
            gm.pillars.map((p) => ({ gm, p })),
          ),
          columns: [
            { header: "Welle ID", value: () => bonus.wave.id },
            { header: "GM ID", width: 38, value: (r) => r.gm.gmId },
            { header: "GM", width: 26, value: (r) => r.gm.name },
            { header: "Aktiv", value: (r) => r.gm.active },
            { header: "Säule", value: (r) => r.p.name },
            {
              header: "Bonus EUR",
              numberFormat: "#,##0.00",
              value: (r) => r.p.earned,
            },
            {
              header: "Maximum EUR",
              numberFormat: "#,##0.00",
              value: (r) => r.p.maximum,
            },
            { header: "Bewertung offen", value: (r) => r.p.pending },
            { header: "Stand", width: 28, value: () => bonus.calculatedAt },
          ],
        });
      }
    },
  });
}
