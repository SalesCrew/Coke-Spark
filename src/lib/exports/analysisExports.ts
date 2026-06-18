import type { AdminPhotoArchiveFilters, AdminPhotoArchiveItem } from "@/lib/api/backend";
import {
  appendMetaSheet,
  appendTableSheet,
  buildAndDownloadWorkbook,
  countBy,
  fileSafeName,
  formatExportDateTime,
  yesNo,
  type ExportColumn,
  type ExportMetaRow,
} from "@/lib/exports/workbook";
import type { PraemienQuarter, PraemienSourceRef } from "@/types/praemien";

type ExportBaseMeta = {
  exportedBy?: string;
  note?: string;
};

type PraemienSourceCatalogRow = {
  key?: string;
  sectionType: string;
  fragebogenName: string;
  moduleName: string;
  questionText: string;
  scoringKey: string;
  boniValue: number;
  isFactorMode: boolean;
  displayLabel: string;
};

type IppExportRow = {
  id: string;
  marketId: string;
  marketName: string;
  chain: string;
  postalCode: string;
  city: string;
  region: string;
  gmName: string;
  redMonatLabel: string;
  redPeriodStart: string;
  redPeriodEnd: string;
  redPeriodYear: number;
  marketIpp: number;
  includedInAverage: boolean;
  isFinalized: boolean;
  sourceSubmissionCount?: number;
  contributingQuestionCount?: number;
};

function baseMeta(page: string, rows: number, extra?: ExportBaseMeta): ExportMetaRow[] {
  return [
    { label: "Export", value: page },
    { label: "Erstellt am", value: formatExportDateTime() },
    { label: "Zeilen", value: rows },
    { label: "Benutzer", value: extra?.exportedBy ?? "" },
    { label: "Hinweis", value: extra?.note ?? "" },
  ];
}

function joinList(values: Array<string | null | undefined>): string {
  return values.map((value) => value?.trim()).filter(Boolean).join(", ");
}

function formatTags(photo: AdminPhotoArchiveItem): string {
  return joinList(photo.tags.map((tag) => tag.label));
}

function campaignTypeLabel(value: string): string {
  if (value === "standard") return "Standard";
  if (value === "flex") return "Flex";
  if (value === "billa") return "Billa";
  if (value === "kuehler") return "Kuehler";
  if (value === "mhd") return "MHD";
  return value;
}

function filterSummary(filters?: AdminPhotoArchiveFilters): string {
  if (!filters) return "Alle Filter";
  const parts = Object.entries(filters)
    .filter(([key, value]) => value != null && value !== "" && key !== "page" && key !== "pageSize")
    .map(([key, value]) => `${key}=${value}`);
  return parts.length ? parts.join("; ") : "Keine aktiven Filter";
}

function ippSummary(rows: IppExportRow[]) {
  const included = rows.filter((row) => row.includedInAverage);
  const numerator = included.reduce((sum, row) => sum + row.marketIpp, 0);
  const average = included.length ? numerator / included.length : 0;
  return {
    totalRows: rows.length,
    includedRows: included.length,
    excludedRows: rows.length - included.length,
    average,
    numerator,
    contributingQuestions: rows.reduce((sum, row) => sum + (row.contributingQuestionCount ?? 0), 0),
  };
}

function thresholdLabel(quarter: PraemienQuarter, totalPoints: number): string {
  const sorted = quarter.thresholds.slice().sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find((threshold) => totalPoints >= threshold.minPoints)?.label ?? "";
}

function thresholdReward(quarter: PraemienQuarter, totalPoints: number): number {
  const sorted = quarter.thresholds.slice().sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find((threshold) => totalPoints >= threshold.minPoints)?.rewardEur ?? 0;
}

function sourceRowPoints(source: PraemienSourceRef): number {
  return Number(source.boniValue ?? 0);
}

export async function exportFotoarchivExcel(input: {
  photos: AdminPhotoArchiveItem[];
  total?: number;
  filters?: AdminPhotoArchiveFilters;
  exportedBy?: string;
}) {
  const photos = input.photos.slice().sort((a, b) =>
    (b.visit.submittedAt ?? b.uploadedAt ?? "").localeCompare(a.visit.submittedAt ?? a.uploadedAt ?? "") ||
    a.market.name.localeCompare(b.market.name, "de"),
  );
  const tagRows = photos.flatMap((photo) => photo.tags.map((tag) => ({
    photo,
    tag,
  })));
  const filename = `CokeSpark_Fotoarchiv_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("Fotoarchiv", photos.length, {
          exportedBy: input.exportedBy,
          note: filterSummary(input.filters),
        }),
        { label: "Gesamt im Filter", value: input.total ?? photos.length },
        { label: "Hinweis Bilder", value: "Export enthaelt Metadaten und Storage-Pfade, keine eingebetteten Bilddateien." },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Fotos",
        title: "Fotoarchiv",
        description: "Filterbare Foto-Metadaten aus Foto-Fragen inklusive Markt, Kampagne, GM, Frage und Tags.",
        rows: photos,
        columns: [
          { header: "Foto ID", width: 38, value: (p) => p.id },
          { header: "Visit Session ID", width: 38, value: (p) => p.visitSessionId },
          { header: "Kampagne", width: 34, value: (p) => p.campaign.name },
          { header: "Typ", width: 12, value: (p) => campaignTypeLabel(p.campaign.type) },
          { header: "Kampagne Start", width: 14, value: (p) => p.campaign.startDate ?? "" },
          { header: "Kampagne Ende", width: 14, value: (p) => p.campaign.endDate ?? "" },
          { header: "Markt", width: 30, value: (p) => p.market.name },
          { header: "Adresse", width: 28, value: (p) => p.market.address },
          { header: "PLZ", width: 9, value: (p) => p.market.postalCode },
          { header: "Ort", width: 22, value: (p) => p.market.city },
          { header: "Region", width: 12, value: (p) => p.market.region },
          { header: "Kette", width: 18, value: (p) => p.market.chain },
          { header: "GM", width: 24, value: (p) => p.gm.name },
          { header: "Fragebogen Sektion", width: 18, value: (p) => p.question.sectionName },
          { header: "Modul", width: 24, value: (p) => p.question.moduleName },
          { header: "Frage", width: 48, value: (p) => p.question.text },
          { header: "Tags", width: 42, value: formatTags },
          { header: "Kommentar", width: 36, value: (p) => p.comment },
          { header: "Besuch Start", width: 24, value: (p) => p.visit.startedAt ?? "" },
          { header: "Besuch Submit", width: 24, value: (p) => p.visit.submittedAt ?? "" },
          { header: "Dauer Min", width: 11, value: (p) => p.visit.durationMinutes ?? "", align: "right" },
          { header: "Upload", width: 24, value: (p) => p.uploadedAt ?? "" },
          { header: "MIME", width: 16, value: (p) => p.mimeType ?? "" },
          { header: "Groesse Bytes", width: 14, value: (p) => p.byteSize ?? "", align: "right" },
          { header: "Breite px", width: 11, value: (p) => p.widthPx ?? "", align: "right" },
          { header: "Hoehe px", width: 11, value: (p) => p.heightPx ?? "", align: "right" },
          { header: "Bucket", width: 18, value: (p) => p.storageBucket },
          { header: "Storage Path", width: 58, value: (p) => p.storagePath },
          { header: "SHA256", width: 46, value: (p) => p.sha256 ?? "" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Foto Tags",
        title: "Foto Tags",
        description: "Eine Zeile pro Foto-Tag, praktisch fuer Tag-Pivots und Kontrollen.",
        rows: tagRows,
        columns: [
          { header: "Foto ID", width: 38, value: (row) => row.photo.id },
          { header: "Tag", width: 28, value: (row) => row.tag.label },
          { header: "Markt", width: 30, value: (row) => row.photo.market.name },
          { header: "Kampagne", width: 34, value: (row) => row.photo.campaign.name },
          { header: "GM", width: 24, value: (row) => row.photo.gm.name },
          { header: "Besuch Submit", width: 24, value: (row) => row.photo.visit.submittedAt ?? "" },
        ],
      });

      const summaryRows = [
        ...countBy(photos, (p) => p.campaign.name).map((row) => ({ gruppe: "Kampagne", merkmal: row.key, anzahl: row.count })),
        ...countBy(photos, (p) => p.market.name).map((row) => ({ gruppe: "Markt", merkmal: row.key, anzahl: row.count })),
        ...countBy(photos, (p) => p.gm.name).map((row) => ({ gruppe: "GM", merkmal: row.key, anzahl: row.count })),
        ...countBy(tagRows, (row) => row.tag.label).map((row) => ({ gruppe: "Tag", merkmal: row.key, anzahl: row.count })),
        ...countBy(photos, (p) => p.question.moduleName).map((row) => ({ gruppe: "Modul", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "Summen",
        description: "Kontrollsummen fuer Fotoarchiv-Auswertungen.",
        rows: summaryRows,
        columns: [
          { header: "Gruppe", width: 18, value: (r) => r.gruppe },
          { header: "Merkmal", width: 34, value: (r) => r.merkmal },
          { header: "Anzahl Fotos", width: 14, value: (r) => r.anzahl, align: "right" },
        ],
      });
    },
  });
}

export async function exportIppExcel(input: {
  rows: IppExportRow[];
  filteredRows?: IppExportRow[];
  exportedBy?: string;
  note?: string;
}) {
  const rows = input.rows.slice().sort((a, b) =>
    b.redPeriodStart.localeCompare(a.redPeriodStart) ||
    a.region.localeCompare(b.region, "de") ||
    a.marketName.localeCompare(b.marketName, "de"),
  );
  const filteredRows = input.filteredRows ?? rows;
  const allSummary = ippSummary(rows);
  const filteredSummary = ippSummary(filteredRows);
  const filename = `CokeSpark_IPP_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  const rowColumns: ExportColumn<IppExportRow>[] = [
    { header: "Record ID", width: 38, value: (r) => r.id },
    { header: "Market ID", width: 38, value: (r) => r.marketId },
    { header: "RED Monat", width: 16, value: (r) => r.redMonatLabel },
    { header: "RED Jahr", width: 10, value: (r) => r.redPeriodYear, align: "right" },
    { header: "Periode Start", width: 14, value: (r) => r.redPeriodStart },
    { header: "Periode Ende", width: 14, value: (r) => r.redPeriodEnd },
    { header: "Markt", width: 30, value: (r) => r.marketName },
    { header: "Kette", width: 18, value: (r) => r.chain },
    { header: "PLZ", width: 9, value: (r) => r.postalCode },
    { header: "Ort", width: 22, value: (r) => r.city },
    { header: "Region", width: 12, value: (r) => r.region },
    { header: "GM", width: 24, value: (r) => r.gmName },
    { header: "IPP", width: 10, value: (r) => r.marketIpp, align: "right", numberFormat: "0.00" },
    { header: "Im Durchschnitt", width: 15, value: (r) => yesNo(r.includedInAverage), align: "center" },
    { header: "Finalisiert", width: 12, value: (r) => yesNo(r.isFinalized), align: "center" },
    { header: "Submissions", width: 12, value: (r) => r.sourceSubmissionCount ?? 0, align: "right" },
    { header: "Beitragsfragen", width: 14, value: (r) => r.contributingQuestionCount ?? 0, align: "right" },
  ];

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("IPP Berechnung", rows.length, {
          exportedBy: input.exportedBy,
          note: input.note ?? "Aktueller geladener IPP-Datenstand",
        }),
        { label: "Filterzeilen", value: filteredRows.length },
        { label: "IPP Oesterreich alle", value: Number(allSummary.average.toFixed(4)) },
        { label: "IPP Oesterreich gefiltert", value: Number(filteredSummary.average.toFixed(4)) },
        { label: "Maerkte im Schnitt alle", value: allSummary.includedRows },
        { label: "Maerkte im Schnitt gefiltert", value: filteredSummary.includedRows },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "IPP Maerkte",
        title: "IPP Maerkte",
        description: "Alle geladenen IPP-Marktzeilen mit RED-Monat, Markt, GM und Berechnungsstatus.",
        rows,
        columns: rowColumns,
      });

      appendTableSheet(XLSX, wb, {
        name: "Aktueller Filter",
        title: "Aktueller Filter",
        description: "Die aktuell im UI gefilterten IPP-Zeilen.",
        rows: filteredRows,
        columns: rowColumns,
      });

      const summaryRows = [
        ...countBy(rows, (r) => r.redMonatLabel).map((row) => ({ gruppe: "RED Monat", merkmal: row.key, anzahl: row.count })),
        ...countBy(rows, (r) => r.region).map((row) => ({ gruppe: "Region", merkmal: row.key, anzahl: row.count })),
        ...countBy(rows, (r) => r.gmName).map((row) => ({ gruppe: "GM", merkmal: row.key, anzahl: row.count })),
        ...countBy(rows, (r) => r.chain).map((row) => ({ gruppe: "Kette", merkmal: row.key, anzahl: row.count })),
        ...countBy(rows, (r) => (r.includedInAverage ? "Im Schnitt" : "Ausgeschlossen/0")).map((row) => ({ gruppe: "Berechnung", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "IPP Summen",
        description: "Kontrollsummen fuer Pivot und Filter.",
        rows: summaryRows,
        columns: [
          { header: "Gruppe", width: 18, value: (r) => r.gruppe },
          { header: "Merkmal", width: 34, value: (r) => r.merkmal },
          { header: "Anzahl", width: 12, value: (r) => r.anzahl, align: "right" },
        ],
      });
    },
  });
}

export async function exportPraemienExcel(input: {
  quarters: PraemienQuarter[];
  activeQuarterId?: string | null;
  sourceCatalog?: PraemienSourceCatalogRow[];
  exportedBy?: string;
}) {
  const quarters = input.quarters.slice().sort((a, b) =>
    b.year - a.year || b.quarter - a.quarter || a.name.localeCompare(b.name, "de"),
  );
  const activeQuarter = quarters.find((quarter) => quarter.id === input.activeQuarterId) ?? quarters[0] ?? null;
  const thresholds = quarters.flatMap((quarter) => quarter.thresholds.map((threshold) => ({ quarter, threshold })));
  const pillars = quarters.flatMap((quarter) => quarter.pillars.map((pillar) => ({ quarter, pillar })));
  const sources = quarters.flatMap((quarter) =>
    quarter.pillars.flatMap((pillar) => pillar.sourceRefs.map((source) => ({ quarter, pillar, source }))),
  );
  const qualityRows = quarters.flatMap((quarter) => quarter.qualitySubmissions.map((submission) => ({ quarter, submission })));
  const flexRows = quarters.flatMap((quarter) => quarter.flexSubmissions.map((submission) => ({ quarter, submission })));
  const filename = `CokeSpark_Praemien_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("Praemien", quarters.length, {
          exportedBy: input.exportedBy,
          note: activeQuarter ? `Aktive Ansicht: ${activeQuarter.name}` : "Keine aktive Praemien-Welle",
        }),
        { label: "Wellen", value: quarters.length },
        { label: "Schwellen", value: thresholds.length },
        { label: "Quellen", value: sources.length },
        { label: "Qualitaet Scores", value: qualityRows.length },
        { label: "Flex Scores", value: flexRows.length },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Praemien Wellen",
        title: "Praemien Wellen",
        description: "Konfiguration und Umfang jeder geladenen Praemien-Welle.",
        rows: quarters,
        columns: [
          { header: "Wave ID", width: 38, value: (q) => q.id },
          { header: "Name", width: 34, value: (q) => q.name },
          { header: "Jahr", width: 10, value: (q) => q.year, align: "right" },
          { header: "Quartal", width: 10, value: (q) => q.quarter, align: "right" },
          { header: "Status", width: 12, value: (q) => q.status },
          { header: "Start", width: 14, value: (q) => q.startDate },
          { header: "Ende", width: 14, value: (q) => q.endDate },
          { header: "Beschreibung", width: 42, value: (q) => q.description },
          { header: "Saeulen", width: 10, value: (q) => q.pillars.length, align: "right" },
          { header: "Quellen", width: 10, value: (q) => q.pillars.reduce((sum, pillar) => sum + pillar.sourceRefs.length, 0), align: "right" },
          { header: "Quellen Punkte", width: 14, value: (q) => q.pillars.reduce((sum, pillar) => sum + pillar.sourceRefs.reduce((subtotal, source) => subtotal + sourceRowPoints(source), 0), 0), align: "right", numberFormat: "0.0" },
          { header: "Schwellen", width: 10, value: (q) => q.thresholds.length, align: "right" },
          { header: "Qualitaet Scores", width: 15, value: (q) => q.qualitySubmissions.length, align: "right" },
          { header: "Flex Scores", width: 12, value: (q) => q.flexSubmissions.length, align: "right" },
          { header: "Erstellt", width: 24, value: (q) => q.createdAt },
          { header: "Aktualisiert", width: 24, value: (q) => q.updatedAt ?? "" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Schwellen",
        title: "Schwellen & Praemien",
        description: "Praemienstufen je Welle.",
        rows: thresholds,
        columns: [
          { header: "Welle", width: 34, value: (row) => row.quarter.name },
          { header: "Status", width: 12, value: (row) => row.quarter.status },
          { header: "Stufe", width: 20, value: (row) => row.threshold.label },
          { header: "Min Punkte", width: 12, value: (row) => row.threshold.minPoints, align: "right", numberFormat: "0.0" },
          { header: "Praemie EUR", width: 13, value: (row) => row.threshold.rewardEur, align: "right", numberFormat: "#,##0.00" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Saeulen",
        title: "Saeulen",
        description: "Saeulen, Gewichtung und verknuepfte Quellen.",
        rows: pillars,
        columns: [
          { header: "Welle", width: 34, value: (row) => row.quarter.name },
          { header: "Saeule", width: 24, value: (row) => row.pillar.name },
          { header: "Beschreibung", width: 42, value: (row) => row.pillar.description },
          { header: "Farbe", width: 12, value: (row) => row.pillar.color },
          { header: "Quellen", width: 10, value: (row) => row.pillar.sourceRefs.length, align: "right" },
          { header: "Punkte", width: 12, value: (row) => row.pillar.sourceRefs.reduce((sum, source) => sum + sourceRowPoints(source), 0), align: "right", numberFormat: "0.0" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Quellen",
        title: "Boni-Quellen",
        description: "Alle Fragebogen-Quellen, die einer Praemien-Saeule zugewiesen sind.",
        rows: sources,
        columns: [
          { header: "Welle", width: 34, value: (row) => row.quarter.name },
          { header: "Saeule", width: 24, value: (row) => row.pillar.name },
          { header: "Sektion", width: 12, value: (row) => campaignTypeLabel(row.source.sectionType) },
          { header: "Fragebogen", width: 34, value: (row) => row.source.fragebogenName },
          { header: "Modul", width: 28, value: (row) => row.source.moduleName },
          { header: "Frage", width: 54, value: (row) => row.source.questionText },
          { header: "Scoring Key", width: 22, value: (row) => row.source.scoringKey },
          { header: "Anzeige", width: 34, value: (row) => row.source.displayLabel },
          { header: "Punkte", width: 10, value: (row) => row.source.boniValue, align: "right", numberFormat: "0.0" },
          { header: "Faktor-Modus", width: 12, value: (row) => yesNo(row.source.isFactorMode), align: "center" },
          { header: "Frequenzregel", width: 13, value: (row) => row.source.distributionFreqRule ?? "" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Qualitaet",
        title: "Qualitaet Scores",
        description: "Manuelle Qualitaetsbewertungen pro GM und Welle.",
        rows: qualityRows,
        columns: [
          { header: "Welle", width: 34, value: (row) => row.quarter.name },
          { header: "GM ID", width: 38, value: (row) => row.submission.gmId },
          { header: "GM", width: 24, value: (row) => row.submission.gmName },
          { header: "Zeiterfassung", width: 14, value: (row) => row.submission.scores.zeiterfassung, align: "right", numberFormat: "0" },
          { header: "Reporting", width: 12, value: (row) => row.submission.scores.reporting, align: "right", numberFormat: "0" },
          { header: "Accuracy", width: 12, value: (row) => row.submission.scores.accuracy, align: "right", numberFormat: "0" },
          { header: "Gesamtpunkte", width: 13, value: (row) => row.submission.totalPoints, align: "right", numberFormat: "0" },
          { header: "Stufe", width: 20, value: (row) => thresholdLabel(row.quarter, row.submission.totalPoints) },
          { header: "Praemie EUR", width: 13, value: (row) => thresholdReward(row.quarter, row.submission.totalPoints), align: "right", numberFormat: "#,##0.00" },
          { header: "Notiz", width: 36, value: (row) => row.submission.note ?? "" },
          { header: "Aktualisiert", width: 24, value: (row) => row.submission.updatedAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Flex Scores",
        title: "Flex Scores",
        description: "Manuelle Flex-Punkte pro GM und Welle.",
        rows: flexRows,
        columns: [
          { header: "Welle", width: 34, value: (row) => row.quarter.name },
          { header: "GM ID", width: 38, value: (row) => row.submission.gmId },
          { header: "GM", width: 24, value: (row) => row.submission.gmName },
          { header: "Gesamtpunkte", width: 13, value: (row) => row.submission.totalPoints, align: "right", numberFormat: "0" },
          { header: "Stufe", width: 20, value: (row) => thresholdLabel(row.quarter, row.submission.totalPoints) },
          { header: "Praemie EUR", width: 13, value: (row) => thresholdReward(row.quarter, row.submission.totalPoints), align: "right", numberFormat: "#,##0.00" },
          { header: "Notiz", width: 36, value: (row) => row.submission.note ?? "" },
          { header: "Aktualisiert", width: 24, value: (row) => row.submission.updatedAt },
        ],
      });

      if (input.sourceCatalog?.length) {
        appendTableSheet(XLSX, wb, {
          name: "Quellen Katalog",
          title: "Quellen Katalog",
          description: "Geladene moegliche Bonus-Quellen aus den Frageboegen.",
          rows: input.sourceCatalog,
          columns: [
            { header: "Key", width: 38, value: (row) => row.key ?? "" },
            { header: "Sektion", width: 12, value: (row) => campaignTypeLabel(row.sectionType) },
            { header: "Fragebogen", width: 34, value: (row) => row.fragebogenName },
            { header: "Modul", width: 28, value: (row) => row.moduleName },
            { header: "Frage", width: 54, value: (row) => row.questionText },
            { header: "Scoring Key", width: 22, value: (row) => row.scoringKey },
            { header: "Anzeige", width: 34, value: (row) => row.displayLabel },
            { header: "Punkte", width: 10, value: (row) => row.boniValue, align: "right", numberFormat: "0.0" },
            { header: "Faktor-Modus", width: 12, value: (row) => yesNo(row.isFactorMode), align: "center" },
          ],
        });
      }
    },
  });
}
