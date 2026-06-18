import type { GMRecord } from "@/types/gebietsmanager";
import type { LagerRecord } from "@/types/lager";
import type { MarketRecord, MarketVisitLog } from "@/types/markets";
import {
  appendMetaSheet,
  appendTableSheet,
  buildAndDownloadWorkbook,
  countBy,
  fileSafeName,
  formatExportDateTime,
  yesNo,
  type ExportMetaRow,
} from "@/lib/exports/workbook";

type ExportBaseMeta = {
  exportedBy?: string;
  note?: string;
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

function marketTypeLabel(value: MarketRecord["marketType"]): string {
  if (value === "both") return "Universum + Kuehler";
  if (value === "kuehler") return "Kuehler";
  return "Universum";
}

function sectionLabel(value: MarketVisitLog["sectionType"]): string {
  if (value === "standard") return "Standard";
  if (value === "flex") return "Flex";
  if (value === "kuehler") return "Kuehler";
  if (value === "mhd") return "MHD";
  if (value === "billa") return "Billa";
  return value;
}

function gmFullName(gm: GMRecord): string {
  return `${gm.firstName} ${gm.lastName}`.trim();
}

export async function exportMarketsExcel(input: {
  markets: MarketRecord[];
  visits?: MarketVisitLog[];
  allMarketCount?: number;
  filterLabel?: string;
  exportedBy?: string;
}) {
  const markets = input.markets.slice().sort((a, b) =>
    a.region.localeCompare(b.region, "de") ||
    a.city.localeCompare(b.city, "de") ||
    a.name.localeCompare(b.name, "de") ||
    a.address.localeCompare(b.address, "de"),
  );
  const visits = input.visits ?? [];
  const filename = `CokeSpark_Maerkte_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("Maerkte", markets.length, {
          exportedBy: input.exportedBy,
          note: input.filterLabel ?? "Aktueller Seitenstand",
        }),
        { label: "Gesamt in App", value: input.allMarketCount ?? markets.length },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Maerkte",
        title: "Maerkte",
        description: "Filterbare Marktstammdaten inklusive Klassifikation, GM-Zuordnung und Importdaten.",
        rows: markets,
        columns: [
          { header: "Markt ID", width: 38, value: (m) => m.id },
          { header: "Aktiv", width: 9, value: (m) => yesNo(m.isActive), align: "center" },
          { header: "Markt", width: 30, value: (m) => m.name },
          { header: "Name f. DB", width: 22, value: (m) => m.dbName },
          { header: "Adresse", width: 30, value: (m) => m.address },
          { header: "PLZ", width: 9, value: (m) => m.postalCode },
          { header: "Ort", width: 22, value: (m) => m.city },
          { header: "Region", width: 12, value: (m) => m.region },
          { header: "EM/EH", width: 9, value: (m) => m.emEh },
          { header: "Flexnummer", width: 16, value: (m) => m.flexNumber },
          { header: "Stammnr. Coke", width: 18, value: (m) => m.cokeMasterNumber },
          { header: "Stammnr. Kuehler", width: 18, value: (m) => m.kuehlerStammnr },
          { header: "Standardmarkt Nr.", width: 18, value: (m) => m.standardMarketNumber },
          { header: "Mitarbeiter", width: 24, value: (m) => m.employee },
          { header: "Aktueller GM", width: 24, value: (m) => m.currentGmName },
          { header: "Verplant an", width: 24, value: (m) => m.plannedByActiveStandardGmName ?? "" },
          { header: "Besuchsfrequenz/Jahr", width: 18, value: (m) => m.visitFrequencyPerYear, align: "right" },
          { header: "Universums-Markt", width: 16, value: (m) => yesNo(m.universeMarket), align: "center" },
          { header: "Markt-Typ", width: 18, value: (m) => marketTypeLabel(m.marketType) },
          { header: "Kuehler-Markt", width: 14, value: (m) => yesNo(m.marketType === "kuehler" || m.marketType === "both"), align: "center" },
          { header: "Info", width: 9, value: (m) => yesNo(m.infoFlag), align: "center" },
          { header: "Info Notiz", width: 34, value: (m) => m.infoNote },
          { header: "IPP", width: 9, value: (m) => m.ipp ?? "", align: "right", numberFormat: "0.0" },
          { header: "Importdatei", width: 26, value: (m) => m.importSourceFileName },
          { header: "Importiert am", width: 22, value: (m) => m.importedAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Klassifikation",
        title: "Markt-Klassifikation",
        description: "Pruefansicht fuer Universum, Kuehler, Billa/Handelskette und Besuchsfrequenzen.",
        rows: markets,
        columns: [
          { header: "Markt", width: 30, value: (m) => m.name },
          { header: "Name f. DB", width: 20, value: (m) => m.dbName },
          { header: "Region", width: 12, value: (m) => m.region },
          { header: "PLZ", width: 9, value: (m) => m.postalCode },
          { header: "Ort", width: 22, value: (m) => m.city },
          { header: "Universums-Markt", width: 16, value: (m) => yesNo(m.universeMarket), align: "center" },
          { header: "Kuehler-Markt", width: 14, value: (m) => yesNo(m.marketType === "kuehler" || m.marketType === "both"), align: "center" },
          { header: "Beides", width: 10, value: (m) => yesNo(m.marketType === "both"), align: "center" },
          { header: "Frequenz", width: 10, value: (m) => m.visitFrequencyPerYear, align: "right" },
          { header: "Mitarbeiter", width: 24, value: (m) => m.employee },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Besuchslog",
        title: "Besuchslog",
        description: "Lokale Besuchsnotizen/Altbestand der Maerkte-Seite, falls vorhanden.",
        rows: visits,
        columns: [
          { header: "Visit ID", width: 30, value: (v) => v.id },
          { header: "Market ID", width: 30, value: (v) => v.marketId },
          { header: "Markt", width: 30, value: (v) => v.marketName ?? "" },
          { header: "Sektion", width: 12, value: (v) => sectionLabel(v.sectionType) },
          { header: "Fragebogen", width: 28, value: (v) => v.fragebogenName },
          { header: "GM", width: 24, value: (v) => v.gmName },
          { header: "Besucht am", width: 24, value: (v) => v.visitedAt },
          { header: "Dauer Min", width: 11, value: (v) => v.durationMin, align: "right" },
          { header: "RED Monat", width: 14, value: (v) => v.redMonatLabel },
        ],
      });

      const summaryRows = [
        ...countBy(markets, (m) => m.region).map((row) => ({ gruppe: "Region", merkmal: row.key, anzahl: row.count })),
        ...countBy(markets, (m) => m.dbName).map((row) => ({ gruppe: "Handelskette", merkmal: row.key, anzahl: row.count })),
        ...countBy(markets, (m) => marketTypeLabel(m.marketType)).map((row) => ({ gruppe: "Markt-Typ", merkmal: row.key, anzahl: row.count })),
        ...countBy(markets, (m) => (m.universeMarket ? "Ja" : "Nein")).map((row) => ({ gruppe: "Universums-Markt", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "Summen",
        description: "Schnelle Kontrollsummen fuer Pivot und Filter.",
        rows: summaryRows,
        columns: [
          { header: "Gruppe", width: 18, value: (r) => r.gruppe },
          { header: "Merkmal", width: 28, value: (r) => r.merkmal },
          { header: "Anzahl", width: 12, value: (r) => r.anzahl, align: "right" },
        ],
      });
    },
  });
}

export async function exportGebietsmanagerExcel(input: {
  gms: GMRecord[];
  visits?: MarketVisitLog[];
  exportedBy?: string;
}) {
  const gms = input.gms.slice().sort((a, b) => a.region.localeCompare(b.region, "de") || gmFullName(a).localeCompare(gmFullName(b), "de"));
  const visits = input.visits ?? [];
  const visitsByGm = new Map<string, MarketVisitLog[]>();
  visits.forEach((visit) => {
    const key = visit.gmName.trim();
    visitsByGm.set(key, [...(visitsByGm.get(key) ?? []), visit]);
  });
  const filename = `CokeSpark_Gebietsmanager_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, baseMeta("Gebietsmanager", gms.length, { exportedBy: input.exportedBy }));
      appendTableSheet(XLSX, wb, {
        name: "Gebietsmanager",
        title: "Gebietsmanager",
        description: "Stammdaten, Regionen, Billa-Filter und KPI-Snapshot.",
        rows: gms,
        columns: [
          { header: "GM ID", width: 38, value: (gm) => gm.id },
          { header: "Vorname", width: 18, value: (gm) => gm.firstName },
          { header: "Nachname", width: 18, value: (gm) => gm.lastName },
          { header: "Name", width: 26, value: (gm) => gmFullName(gm) },
          { header: "E-Mail", width: 30, value: (gm) => gm.email },
          { header: "Telefon", width: 18, value: (gm) => gm.phone },
          { header: "Adresse", width: 28, value: (gm) => gm.address },
          { header: "PLZ", width: 9, value: (gm) => gm.postalCode },
          { header: "Ort", width: 20, value: (gm) => gm.city },
          { header: "Region", width: 12, value: (gm) => gm.region },
          { header: "Billa GM", width: 10, value: (gm) => yesNo(gm.isBillaGm), align: "center" },
          { header: "IPP", width: 9, value: (gm) => gm.ipp, align: "right", numberFormat: "0.0" },
          { header: "IPP Samples", width: 12, value: (gm) => gm.ippSampleCount ?? 0, align: "right" },
          { header: "Erstellt am", width: 24, value: (gm) => gm.createdAt },
        ],
      });

      const gmSummary = gms.map((gm) => {
        const gmVisits = visitsByGm.get(gmFullName(gm)) ?? [];
        return {
          gm,
          total: gmVisits.length,
          standard: gmVisits.filter((visit) => visit.sectionType === "standard").length,
          flex: gmVisits.filter((visit) => visit.sectionType === "flex").length,
          kuehler: gmVisits.filter((visit) => visit.sectionType === "kuehler").length,
          mhd: gmVisits.filter((visit) => visit.sectionType === "mhd").length,
          billa: gmVisits.filter((visit) => visit.sectionType === "billa").length,
          avgDuration: gmVisits.length ? Math.round(gmVisits.reduce((sum, visit) => sum + visit.durationMin, 0) / gmVisits.length) : 0,
        };
      });
      appendTableSheet(XLSX, wb, {
        name: "GM Summen",
        title: "GM Summen",
        description: "Besuchs- und KPI-Summen pro GM.",
        rows: gmSummary,
        columns: [
          { header: "GM", width: 26, value: (row) => gmFullName(row.gm) },
          { header: "Region", width: 12, value: (row) => row.gm.region },
          { header: "Billa GM", width: 10, value: (row) => yesNo(row.gm.isBillaGm), align: "center" },
          { header: "IPP", width: 9, value: (row) => row.gm.ipp, align: "right", numberFormat: "0.0" },
          { header: "Besuche", width: 10, value: (row) => row.total, align: "right" },
          { header: "Standard", width: 10, value: (row) => row.standard, align: "right" },
          { header: "Flex", width: 10, value: (row) => row.flex, align: "right" },
          { header: "Kuehler", width: 10, value: (row) => row.kuehler, align: "right" },
          { header: "MHD", width: 10, value: (row) => row.mhd, align: "right" },
          { header: "Billa", width: 10, value: (row) => row.billa, align: "right" },
          { header: "Ø Dauer Min", width: 13, value: (row) => row.avgDuration, align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Besuchslog",
        title: "Besuchslog",
        description: "Besuchsnotizen/Altbestand der Gebietsmanager-Seite, falls vorhanden.",
        rows: visits,
        columns: [
          { header: "Visit ID", width: 30, value: (v) => v.id },
          { header: "GM", width: 24, value: (v) => v.gmName },
          { header: "Markt", width: 30, value: (v) => v.marketName ?? "" },
          { header: "Sektion", width: 12, value: (v) => sectionLabel(v.sectionType) },
          { header: "Fragebogen", width: 28, value: (v) => v.fragebogenName },
          { header: "Besucht am", width: 24, value: (v) => v.visitedAt },
          { header: "Dauer Min", width: 11, value: (v) => v.durationMin, align: "right" },
          { header: "RED Monat", width: 14, value: (v) => v.redMonatLabel },
        ],
      });

      const regionRows = countBy(gms, (gm) => gm.region).map((row) => ({ region: row.key, anzahl: row.count }));
      appendTableSheet(XLSX, wb, {
        name: "Regionen",
        title: "Regionen",
        description: "GM-Verteilung nach Region.",
        rows: regionRows,
        columns: [
          { header: "Region", width: 16, value: (row) => row.region },
          { header: "GMs", width: 10, value: (row) => row.anzahl, align: "right" },
        ],
      });
    },
  });
}

export async function exportLagerExcel(input: {
  lagers: LagerRecord[];
  gms: GMRecord[];
  exportedBy?: string;
}) {
  const lagers = input.lagers.slice().sort((a, b) => a.city.localeCompare(b.city, "de") || a.address.localeCompare(b.address, "de"));
  const gmById = new Map(input.gms.map((gm) => [gm.id, gm]));
  const assignmentRows = lagers.flatMap((lager) => {
    const ids = lager.gmUserIds.length ? lager.gmUserIds : lager.gmUserId ? [lager.gmUserId] : [];
    if (ids.length === 0) {
      return [{ lager, gm: null as GMRecord | null }];
    }
    return ids.map((gmId) => ({ lager, gm: gmById.get(gmId) ?? null }));
  });
  const filename = `CokeSpark_Lager_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, baseMeta("Lager", lagers.length, { exportedBy: input.exportedBy }));
      appendTableSheet(XLSX, wb, {
        name: "Lager",
        title: "Lager",
        description: "Lagerstammdaten inklusive zugeordneter Gebietsmanager.",
        rows: lagers,
        columns: [
          { header: "Lager ID", width: 38, value: (lager) => lager.id },
          { header: "Adresse", width: 30, value: (lager) => lager.address },
          { header: "PLZ", width: 9, value: (lager) => lager.postalCode },
          { header: "Ort", width: 22, value: (lager) => lager.city },
          { header: "GM IDs", width: 44, value: (lager) => lager.gmUserIds.join(", ") },
          { header: "GMs", width: 44, value: (lager) => lager.gmNames.join(", ") || (lager.gmName ?? "") },
          { header: "Erstellt am", width: 24, value: (lager) => lager.createdAt },
          { header: "Aktualisiert am", width: 24, value: (lager) => lager.updatedAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "GM Zuordnung",
        title: "GM Zuordnung",
        description: "Eine Zeile pro Lager-GM-Zuordnung.",
        rows: assignmentRows,
        columns: [
          { header: "Lager ID", width: 38, value: (row) => row.lager.id },
          { header: "Lager", width: 34, value: (row) => `${row.lager.address}, ${row.lager.postalCode} ${row.lager.city}` },
          { header: "GM ID", width: 38, value: (row) => row.gm?.id ?? "" },
          { header: "GM", width: 26, value: (row) => (row.gm ? gmFullName(row.gm) : "Nicht zugewiesen") },
          { header: "Region", width: 12, value: (row) => row.gm?.region ?? "" },
          { header: "E-Mail", width: 30, value: (row) => row.gm?.email ?? "" },
        ],
      });

      const summaryRows = [
        ...countBy(lagers, (lager) => lager.city).map((row) => ({ gruppe: "Ort", merkmal: row.key, anzahl: row.count })),
        ...countBy(assignmentRows, (row) => row.gm?.region ?? "Nicht zugewiesen").map((row) => ({ gruppe: "GM Region", merkmal: row.key, anzahl: row.count })),
        ...countBy(assignmentRows, (row) => (row.gm ? gmFullName(row.gm) : "Nicht zugewiesen")).map((row) => ({ gruppe: "GM", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "Summen",
        description: "Kontrollsummen fuer Lager und GM-Zuordnung.",
        rows: summaryRows,
        columns: [
          { header: "Gruppe", width: 18, value: (row) => row.gruppe },
          { header: "Merkmal", width: 30, value: (row) => row.merkmal },
          { header: "Anzahl", width: 12, value: (row) => row.anzahl, align: "right" },
        ],
      });
    },
  });
}
