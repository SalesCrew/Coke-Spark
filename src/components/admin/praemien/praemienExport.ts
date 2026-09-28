import type { Workspace } from "@/types/praemien-workspace";
import {
  appendMetaSheet,
  appendTableSheet,
  buildAndDownloadWorkbook,
  fileSafeName,
} from "@/lib/exports/workbook";

export async function exportPraemien(workspace: Workspace) {
  await buildAndDownloadWorkbook({
    filename: `Praemien_${fileSafeName(workspace.wave.name)}_V${workspace.revision}.xlsx`,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        { label: "Welle", value: workspace.wave.name },
        {
          label: "Zeitraum",
          value: `${workspace.wave.startDate} bis ${workspace.wave.endDate}`,
        },
        { label: "Version", value: workspace.revision },
        { label: "Status", value: workspace.wave.status },
        { label: "Berechnungsstand", value: workspace.calculatedAt },
        { label: "Eingefroren", value: workspace.closedAt },
        { label: "Regelgrundlage", value: workspace.model?.provenance },
      ]);
      appendTableSheet(XLSX, wb, {
        name: "Prämien",
        title: workspace.wave.name,
        description:
          "Offene Bewertungen sind vorläufig; Export ist keine ausgeführte Auszahlung.",
        rows: workspace.results,
        columns: [
          { header: "GM-ID", value: (r) => r.gmId, width: 38 },
          { header: "GM", value: (r) => r.name, width: 26 },
          { header: "Aktiv", value: (r) => r.active },
          { header: "Rang", value: (r) => r.rank },
          {
            header: "Bewertung",
            value: (r) => (r.pending ? "Offen" : "Bewertet"),
          },
          {
            header: "Prämie (€)",
            value: (r) => r.earned,
            numberFormat: "#,##0.00",
          },
          {
            header: "Maximum (€)",
            value: (r) => r.maximum,
            numberFormat: "#,##0.00",
          },
          ...(workspace.model?.pillars ?? []).map((p) => ({
            header: `${p.name} (€)`,
            value: (r: Workspace["results"][number]) =>
              r.pillars.find((x) => x.key === p.key)?.earned,
            numberFormat: "#,##0.00",
            width: 23,
          })),
        ],
      });
      const metrics = workspace.results.flatMap((g) =>
        g.pillars.flatMap((p) =>
          p.metrics.map((m) => ({
            gm: g.name,
            gmId: g.gmId,
            pillar: p.name,
            ...m,
          })),
        ),
      );
      appendTableSheet(XLSX, wb, {
        name: "Messwerte",
        title: "Werte und Herkunft",
        rows: metrics,
        columns: [
          { header: "GM", value: (r) => r.gm, width: 26 },
          { header: "GM-ID", value: (r) => r.gmId, width: 38 },
          { header: "Säule", value: (r) => r.pillar, width: 25 },
          { header: "Messgröße", value: (r) => r.label, width: 32 },
          { header: "Wert", value: (r) => r.value },
          { header: "Einheit", value: (r) => r.unit },
          { header: "Soll", value: (r) => r.target },
          { header: "Automatisch", value: (r) => r.automatic },
          { header: "Herkunft", value: (r) => r.origin },
          { header: "Begründung", value: (r) => r.note, width: 44 },
          { header: "Bearbeiter", value: (r) => r.actorName, width: 25 },
          { header: "Geändert am", value: (r) => r.updatedAt, width: 30 },
        ],
      });
    },
  });
}
