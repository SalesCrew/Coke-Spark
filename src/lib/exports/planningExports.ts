import type { Campaign } from "@/types/campaign";
import type { Fragebogen, Module, Question } from "@/types/fragebogen";
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
import { buildIntervals, type IntervalMode, type IppInterval } from "@/lib/ipp-dashboard/intervals";
import {
  buildCompareResult,
  buildMockLineSeries,
  buildMockPieCumulativeData,
  buildMockPieData,
  type IppFilterScope,
} from "@/lib/ipp-dashboard/mock-data";
import {
  buildDoneProgress,
  buildFuellstandSeries,
  type FuellstandFilterScope,
  type FuellstandTypeKey,
} from "@/lib/fuellstand-dashboard/mock-data";
import {
  buildPlatzierungenSeries,
  type PlatzierungenFilterScope,
} from "@/lib/platzierungen-dashboard/mock-data";

type ExportBaseMeta = {
  exportedBy?: string;
  note?: string;
};

type CampaignExportMarket = {
  id: string;
  name: string;
  chain: string;
  city: string;
  region: string;
  address: string;
  stammnr?: string;
  gm: string;
};

type CampaignExportStatus = {
  marketId: string;
  targetVisitCount: number;
  submittedVisitCount: number;
  isComplete: boolean;
  hasSubmittedVisit: boolean;
  sessionId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number | null;
  gmName: string | null;
};

type GmDashboardExportScope = IppFilterScope & FuellstandFilterScope & PlatzierungenFilterScope;

function baseMeta(page: string, rows: number, extra?: ExportBaseMeta): ExportMetaRow[] {
  return [
    { label: "Export", value: page },
    { label: "Erstellt am", value: formatExportDateTime() },
    { label: "Zeilen", value: rows },
    { label: "Benutzer", value: extra?.exportedBy ?? "" },
    { label: "Hinweis", value: extra?.note ?? "" },
  ];
}

function sectionLabel(value: string | null | undefined): string {
  if (value === "standard") return "Standard";
  if (value === "flex") return "Flex";
  if (value === "billa") return "Billa";
  if (value === "kuehler") return "Kühler";
  if (value === "mhd") return "MHD";
  return value ?? "";
}

function questionTypeLabel(value: string): string {
  const map: Record<string, string> = {
    single: "Single Choice",
    yesno: "Ja/Nein",
    yesnomulti: "Ja/Nein Multi",
    multiple: "Multiple Choice",
    likert: "Likert",
    text: "Text",
    numeric: "Numeric",
    slider: "Slider",
    photo: "Foto",
    matrix: "Matrix",
  };
  return map[value] ?? value;
}

function scoringSummary(question: Question): string {
  return Object.entries(question.scoring ?? {})
    .flatMap(([key, weights]) =>
      Object.entries(weights)
        .filter(([, value]) => value != null)
        .map(([scoreKey, value]) => `${key}:${scoreKey}=${value}`),
    )
    .join("; ");
}

function ruleSummary(question: Question): string {
  return (question.rules ?? [])
    .map((rule) => `${rule.action} ${rule.targetQuestionIds.length} bei ${rule.triggerQuestionId} ${rule.operator} ${rule.triggerValue}${rule.triggerValueMax ? `-${rule.triggerValueMax}` : ""}`)
    .join("; ");
}

function optionSummary(question: Question): string {
  const options = (question.config?.options as unknown) ?? [];
  if (Array.isArray(options)) return options.map(String).join(", ");
  return "";
}

function moduleMap(modules: Module[]): Map<string, Module> {
  return new Map(modules.map((module) => [module.id, module]));
}

export async function exportFbManagementExcel(input: {
  campaigns: Campaign[];
  markets: CampaignExportMarket[];
  visitStatusByCampaignId: Record<string, Record<string, CampaignExportStatus>>;
  fragebogenByScope?: Record<string, Fragebogen[]>;
  modulesByScope?: Record<string, Module[]>;
  exportedBy?: string;
}) {
  const campaigns = input.campaigns.slice().sort((a, b) =>
    a.section.localeCompare(b.section, "de") ||
    a.name.localeCompare(b.name, "de"),
  );
  const marketById = new Map(input.markets.map((market) => [market.id, market]));
  const assignmentRows = campaigns.flatMap((campaign) => {
    const statuses = input.visitStatusByCampaignId[campaign.id] ?? {};
    return campaign.assignments.map((assignment) => {
      const market = marketById.get(assignment.marketId);
      const status = statuses[assignment.marketId] ?? null;
      return {
        campaign,
        assignment,
        market,
        status,
      };
    });
  });
  const historyRows = campaigns.flatMap((campaign) => campaign.history.map((history) => ({ campaign, history })));
  const scopeFragebogenRows = Object.entries(input.fragebogenByScope ?? {}).flatMap(([scope, rows]) => rows.map((fragebogen) => ({ scope, fragebogen })));
  const scopeModuleRows = Object.entries(input.modulesByScope ?? {}).flatMap(([scope, rows]) => rows.map((module) => ({ scope, module })));
  const filename = `CokeSpark_FB_Management_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("FB Management", campaigns.length, {
          exportedBy: input.exportedBy,
          note: "Kampagnen, Zielmärkte, Besuchsstatus und Katalog-Bezug.",
        }),
        { label: "Assignments", value: assignmentRows.length },
        { label: "Fragebogen im Katalog", value: scopeFragebogenRows.length },
        { label: "Module im Katalog", value: scopeModuleRows.length },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Kampagnen",
        title: "Kampagnen",
        description: "Kampagnen-Konfiguration inklusive Ziel- und Fortschrittszahlen.",
        rows: campaigns,
        columns: [
          { header: "Campaign ID", width: 38, value: (c) => c.id },
          { header: "Name", width: 34, value: (c) => c.name },
          { header: "Sektion", width: 12, value: (c) => sectionLabel(c.section) },
          { header: "Status", width: 12, value: (c) => c.status },
          { header: "Schedule", width: 12, value: (c) => c.scheduleType },
          { header: "Start", width: 14, value: (c) => c.startDate ?? "" },
          { header: "Ende", width: 14, value: (c) => c.endDate ?? "" },
          { header: "Fragebogen ID", width: 38, value: (c) => c.currentFragebogenId ?? "" },
          { header: "Fragebogen", width: 34, value: (c) => c.currentFragebogenName ?? "" },
          { header: "Unique Märkte", width: 13, value: (c) => c.marketIds.length, align: "right" },
          { header: "Visit Targets", width: 13, value: (c) => c.assignments.reduce((sum, row) => sum + (row.visitTargetCount ?? 0), 0), align: "right" },
          { header: "Submitted Visits", width: 15, value: (c) => Object.values(input.visitStatusByCampaignId[c.id] ?? {}).reduce((sum, row) => sum + (row.submittedVisitCount ?? 0), 0), align: "right" },
          { header: "Komplett Märkte", width: 15, value: (c) => Object.values(input.visitStatusByCampaignId[c.id] ?? {}).filter((row) => row.isComplete).length, align: "right" },
          { header: "Erstellt", width: 24, value: (c) => c.createdAt },
          { header: "Aktualisiert", width: 24, value: (c) => c.updatedAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Zielmärkte",
        title: "Kampagnen-Zielmärkte",
        description: "Eine Zeile je Kampagnenassignment mit GM, Markt, Visit-Ziel und aktuellem Besuchsstatus.",
        rows: assignmentRows,
        columns: [
          { header: "Campaign ID", width: 38, value: (row) => row.campaign.id },
          { header: "Kampagne", width: 34, value: (row) => row.campaign.name },
          { header: "Sektion", width: 12, value: (row) => sectionLabel(row.campaign.section) },
          { header: "Market ID", width: 38, value: (row) => row.assignment.marketId },
          { header: "Markt", width: 30, value: (row) => row.market?.name ?? "" },
          { header: "Adresse", width: 28, value: (row) => row.market?.address ?? "" },
          { header: "Stammnr", width: 16, value: (row) => row.market?.stammnr ?? "" },
          { header: "Kette", width: 18, value: (row) => row.market?.chain ?? "" },
          { header: "Ort", width: 22, value: (row) => row.market?.city ?? "" },
          { header: "Region", width: 12, value: (row) => row.market?.region ?? "" },
          { header: "GM Assignment", width: 24, value: (row) => row.assignment.gmName ?? "" },
          { header: "GM Status", width: 24, value: (row) => row.status?.gmName ?? "" },
          { header: "Slot", width: 8, value: (row) => row.assignment.assignmentSlot, align: "right" },
          { header: "Ziel Visits", width: 11, value: (row) => row.assignment.visitTargetCount, align: "right" },
          { header: "Submitted", width: 11, value: (row) => row.status?.submittedVisitCount ?? 0, align: "right" },
          { header: "Complete", width: 10, value: (row) => yesNo(row.status?.isComplete), align: "center" },
          { header: "Session ID", width: 38, value: (row) => row.status?.sessionId ?? "" },
          { header: "Started", width: 24, value: (row) => row.status?.startedAt ?? "" },
          { header: "Submitted At", width: 24, value: (row) => row.status?.submittedAt ?? "" },
          { header: "Dauer Min", width: 11, value: (row) => row.status?.durationMinutes ?? "", align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Fragebogen Katalog",
        title: "Fragebogen Katalog",
        description: "Geladene Fragebogen pro Scope, damit Kampagnenzuordnung auditierbar bleibt.",
        rows: scopeFragebogenRows,
        columns: [
          { header: "Scope", width: 12, value: (row) => row.scope },
          { header: "Fragebogen ID", width: 38, value: (row) => row.fragebogen.id },
          { header: "Name", width: 34, value: (row) => row.fragebogen.name },
          { header: "Beschreibung", width: 42, value: (row) => row.fragebogen.description },
          { header: "Status", width: 12, value: (row) => row.fragebogen.status },
          { header: "Schedule", width: 12, value: (row) => row.fragebogen.scheduleType },
          { header: "Module", width: 10, value: (row) => row.fragebogen.moduleIds.length, align: "right" },
          { header: "Spezialfragen", width: 13, value: (row) => row.fragebogen.spezialfragen?.length ?? 0, align: "right" },
          { header: "Nur einmal", width: 10, value: (row) => yesNo(row.fragebogen.nurEinmalAusfuellbar), align: "center" },
          { header: "Erstellt", width: 24, value: (row) => row.fragebogen.createdAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Module Katalog",
        title: "Module Katalog",
        description: "Geladene Module pro Scope.",
        rows: scopeModuleRows,
        columns: [
          { header: "Scope", width: 12, value: (row) => row.scope },
          { header: "Modul ID", width: 38, value: (row) => row.module.id },
          { header: "Name", width: 30, value: (row) => row.module.name },
          { header: "Beschreibung", width: 42, value: (row) => row.module.description },
          { header: "Fragen", width: 10, value: (row) => row.module.questions.length, align: "right" },
          { header: "In Fragebogen", width: 12, value: (row) => row.module.usedInCount, align: "right" },
          { header: "Erstellt", width: 24, value: (row) => row.module.createdAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Historie",
        title: "Fragebogen-Wechsel",
        description: "Historie der Fragebogenwechsel je Kampagne.",
        rows: historyRows,
        columns: [
          { header: "Kampagne", width: 34, value: (row) => row.campaign.name },
          { header: "History ID", width: 38, value: (row) => row.history.id },
          { header: "Von Fragebogen", width: 38, value: (row) => row.history.fromFragebogenId ?? "" },
          { header: "Zu Fragebogen", width: 38, value: (row) => row.history.toFragebogenId },
          { header: "Geaendert am", width: 24, value: (row) => row.history.changedAt },
        ],
      });

      const summaryRows = [
        ...countBy(campaigns, (c) => sectionLabel(c.section)).map((row) => ({ gruppe: "Sektion", merkmal: row.key, anzahl: row.count })),
        ...countBy(campaigns, (c) => c.status).map((row) => ({ gruppe: "Status", merkmal: row.key, anzahl: row.count })),
        ...countBy(assignmentRows, (row) => row.market?.region).map((row) => ({ gruppe: "Region", merkmal: row.key, anzahl: row.count })),
        ...countBy(assignmentRows, (row) => row.assignment.gmName).map((row) => ({ gruppe: "GM Assignment", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "Summen",
        description: "Schnelle Kontrollsummen für Kampagnen und Zielmärkte.",
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

export async function exportFragebogenExcel(input: {
  modules: Module[];
  flexModules?: Module[];
  billaModules?: Module[];
  fragebogen: Fragebogen[];
  campaignUsageByFragebogenId?: Record<string, string[]>;
  primaryScope?: "main" | "standard" | "flex" | "billa" | "kuehler" | "mhd";
  title?: string;
  exportedBy?: string;
}) {
  const mainModules = input.modules.filter((module) => !module.id.includes("unassigned"));
  const primaryScope = input.primaryScope ?? "main";
  const title = input.title ?? "Fragebogen";
  const allModules = [
    ...mainModules.map((module) => ({ scope: primaryScope, module })),
    ...(input.flexModules ?? []).map((module) => ({ scope: "flex", module })),
    ...(input.billaModules ?? []).map((module) => ({ scope: "billa", module })),
  ];
  const moduleById = moduleMap(mainModules);
  const questionRows = allModules.flatMap(({ scope, module }) =>
    module.questions.map((question, index) => ({ scope, module, question, index })),
  );
  const fragebogenModuleRows = input.fragebogen.flatMap((fragebogen) =>
    fragebogen.moduleIds.map((moduleId, index) => ({
      fragebogen,
      module: moduleById.get(moduleId) ?? null,
      moduleId,
      index,
    })),
  );
  const spezialQuestionRows = input.fragebogen.flatMap((fragebogen) =>
    (fragebogen.spezialfragen ?? []).map((question, index) => ({ fragebogen, question, index })),
  );
  const filename = `CokeSpark_${fileSafeName(title)}_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta(title, input.fragebogen.length, {
          exportedBy: input.exportedBy,
          note: "Fragen, Module, Fragebogen-Bouquets und Kampagnennutzung.",
        }),
        { label: "Module", value: allModules.length },
        { label: "Fragen", value: questionRows.length },
        { label: "Spezialfragen", value: spezialQuestionRows.length },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Fragen",
        title: "Fragen",
        description: "Atomare Fragen aus dem Fragebogen-Katalog mit Regeln, Scoring und Foto-Tag-Hinweisen.",
        rows: questionRows,
        columns: [
          { header: "Scope", width: 10, value: (row) => row.scope },
          { header: "Modul ID", width: 38, value: (row) => row.module.id },
          { header: "Modul", width: 30, value: (row) => row.module.name },
          { header: "Reihenfolge", width: 10, value: (row) => row.index + 1, align: "right" },
          { header: "Frage ID", width: 38, value: (row) => row.question.id },
          { header: "Typ", width: 16, value: (row) => questionTypeLabel(row.question.type) },
          { header: "Pflicht", width: 9, value: (row) => yesNo(row.question.required), align: "center" },
          { header: "RED Survey", width: 11, value: (row) => yesNo(row.question.redSurvey), align: "center" },
          { header: "Single Choice Availability", width: 22, value: (row) => yesNo(row.question.singleChoiceAvailability), align: "center" },
          { header: "Availability Typ", width: 18, value: (row) => row.question.singleChoiceAvailabilityType ?? "" },
          { header: "Frage", width: 58, value: (row) => row.question.text },
          { header: "Optionen", width: 46, value: (row) => optionSummary(row.question) },
          { header: "Regeln", width: 46, value: (row) => ruleSummary(row.question) },
          { header: "Scoring", width: 52, value: (row) => scoringSummary(row.question) },
          { header: "Chains", width: 28, value: (row) => (row.question.chains ?? []).join(", ") },
          { header: "Foto Tags aktiv", width: 14, value: (row) => yesNo(Boolean(row.question.config?.tagsEnabled)), align: "center" },
          { header: "Config JSON", width: 54, value: (row) => JSON.stringify(row.question.config ?? {}) },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Module",
        title: "Module",
        description: "Module als wiederverwendbare Fragegruppen.",
        rows: allModules,
        columns: [
          { header: "Scope", width: 10, value: (row) => row.scope },
          { header: "Modul ID", width: 38, value: (row) => row.module.id },
          { header: "Name", width: 30, value: (row) => row.module.name },
          { header: "Beschreibung", width: 46, value: (row) => row.module.description },
          { header: "Fragen", width: 10, value: (row) => row.module.questions.length, align: "right" },
          { header: "In Fragebogen", width: 12, value: (row) => row.module.usedInCount, align: "right" },
          { header: "Erstellt", width: 24, value: (row) => row.module.createdAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Fragebogen",
        title: "Fragebogen",
        description: "Bouquets mit Modulen, Schedule und Kampagnennutzung.",
        rows: input.fragebogen,
        columns: [
          { header: "Fragebogen ID", width: 38, value: (fb) => fb.id },
          { header: "Name", width: 34, value: (fb) => fb.name },
          { header: "Beschreibung", width: 46, value: (fb) => fb.description },
          { header: "Status", width: 12, value: (fb) => fb.status },
          { header: "Schedule", width: 12, value: (fb) => fb.scheduleType },
          { header: "Start", width: 14, value: (fb) => fb.startDate ?? "" },
          { header: "Ende", width: 14, value: (fb) => fb.endDate ?? "" },
          { header: "Keywords", width: 24, value: (fb) => (fb.sectionKeywords ?? []).join(", ") },
          { header: "Module", width: 10, value: (fb) => fb.moduleIds.length, align: "right" },
          { header: "Spezialfragen", width: 13, value: (fb) => fb.spezialfragen?.length ?? 0, align: "right" },
          { header: "Kampagnen", width: 38, value: (fb) => (input.campaignUsageByFragebogenId?.[fb.id] ?? []).join(", ") },
          { header: "Nur einmal", width: 10, value: (fb) => yesNo(fb.nurEinmalAusfuellbar), align: "center" },
          { header: "Erstellt", width: 24, value: (fb) => fb.createdAt },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Bouquet Module",
        title: "Fragebogen Module",
        description: "Reihenfolge der Module je Fragebogen.",
        rows: fragebogenModuleRows,
        columns: [
          { header: "Fragebogen", width: 34, value: (row) => row.fragebogen.name },
          { header: "Reihenfolge", width: 10, value: (row) => row.index + 1, align: "right" },
          { header: "Modul ID", width: 38, value: (row) => row.moduleId },
          { header: "Modul", width: 30, value: (row) => row.module?.name ?? "" },
          { header: "Fragen", width: 10, value: (row) => row.module?.questions.length ?? "", align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Spezialfragen",
        title: "Spezialfragen",
        description: "Fragebogen-spezifische Zusatzfragen ausserhalb der wiederverwendbaren Module.",
        rows: spezialQuestionRows,
        columns: [
          { header: "Fragebogen", width: 34, value: (row) => row.fragebogen.name },
          { header: "Reihenfolge", width: 10, value: (row) => row.index + 1, align: "right" },
          { header: "Frage ID", width: 38, value: (row) => row.question.id },
          { header: "Typ", width: 16, value: (row) => questionTypeLabel(row.question.type) },
          { header: "Pflicht", width: 9, value: (row) => yesNo(row.question.required), align: "center" },
          { header: "Frage", width: 58, value: (row) => row.question.text },
          { header: "Scoring", width: 52, value: (row) => scoringSummary(row.question) },
        ],
      });

      const summaryRows = [
        ...countBy(questionRows, (row) => questionTypeLabel(row.question.type)).map((row) => ({ gruppe: "Fragetyp", merkmal: row.key, anzahl: row.count })),
        ...countBy(questionRows, (row) => row.scope).map((row) => ({ gruppe: "Scope", merkmal: row.key, anzahl: row.count })),
        ...countBy(input.fragebogen, (fb) => fb.status).map((row) => ({ gruppe: "Fragebogen Status", merkmal: row.key, anzahl: row.count })),
        ...countBy(input.fragebogen, (fb) => (fb.sectionKeywords ?? []).join(", ") || "ohne Keyword").map((row) => ({ gruppe: "Keyword", merkmal: row.key, anzahl: row.count })),
      ];
      appendTableSheet(XLSX, wb, {
        name: "Summen",
        title: "Summen",
        description: "Kontrollsummen für den Fragebogen-Katalog.",
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

export async function exportGmDashboardExcel(input?: { exportedBy?: string }) {
  const modes: IntervalMode[] = ["redmonth", "week", "month", "quarter"];
  const scope: GmDashboardExportScope = {
    region: null,
    gmId: null,
    chain: null,
    marketId: null,
    stc: null,
  };
  const intervalsByMode = modes.flatMap((mode) => buildIntervals({ mode }).map((interval) => ({ mode, interval })));
  const redmonthIntervals = buildIntervals({ mode: "redmonth" });
  const redmonthIds = redmonthIntervals.map((interval) => interval.id);
  const ippLineRows = modes.flatMap((mode) => {
    const intervals = buildIntervals({ mode });
    const compareIntervalId = intervals[1]?.id ?? null;
    return buildMockLineSeries({ intervals, filters: scope, compareIntervalId }).map((point) => ({ mode, point }));
  });
  const selectedRedmonthId = redmonthIntervals[0]?.id ?? null;
  const ippPie = buildMockPieData({ selectedIntervalId: selectedRedmonthId, filters: scope });
  const ippPieCum = buildMockPieCumulativeData({ intervalIds: redmonthIds.slice(0, 12), filters: scope });
  const fuellstandRows = modes.flatMap((mode) => {
    const intervals = buildIntervals({ mode });
    return buildFuellstandSeries({ intervals, filters: scope }).flatMap((point) =>
      (Object.keys(point.typeScores) as FuellstandTypeKey[]).map((typeKey) => ({
        mode,
        point,
        typeKey,
        score: point.typeScores[typeKey],
        counts: point.typeCounts[typeKey],
      })),
    );
  });
  const fuellstandProgress = modes.map((mode) => {
    const intervals = buildIntervals({ mode });
    return { mode, progress: buildDoneProgress({ selectedIntervalId: intervals[0]?.id ?? null, filters: scope }) };
  });
  const platzierungenRows = modes.flatMap((mode) => {
    const intervals = buildIntervals({ mode });
    return buildPlatzierungenSeries({ intervals, filters: scope }).map((point) => ({ mode, point }));
  });
  const filename = `CokeSpark_GM_Dashboard_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("GM Dashboard", intervalsByMode.length, {
          exportedBy: input?.exportedBy,
          note: "Dashboard-Datenexport der aktuell hybriden/mockbasierten Visualisierung.",
        }),
        { label: "IPP Punkte", value: ippLineRows.length },
        { label: "Fuellstand Reihen", value: fuellstandRows.length },
        { label: "Platzierungen Reihen", value: platzierungenRows.length },
      ]);

      appendTableSheet(XLSX, wb, {
        name: "Intervalle",
        title: "Dashboard Intervalle",
        description: "Zeitintervalle, die für die Dashboard-Charts verwendet werden.",
        rows: intervalsByMode,
        columns: [
          { header: "Modus", width: 12, value: (row) => row.mode },
          { header: "Interval ID", width: 26, value: (row) => row.interval.id },
          { header: "Label", width: 34, value: (row) => row.interval.label },
          { header: "Kurzlabel", width: 16, value: (row) => row.interval.shortLabel },
          { header: "Start", width: 14, value: (row) => row.interval.start },
          { header: "Ende", width: 14, value: (row) => row.interval.end },
          { header: "Jahr", width: 10, value: (row) => row.interval.meta.year, align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "IPP Verlauf",
        title: "IPP Verlauf",
        description: "Linienchart-Daten mit Vergleichswert.",
        rows: ippLineRows,
        columns: [
          { header: "Modus", width: 12, value: (row) => row.mode },
          { header: "Interval ID", width: 26, value: (row) => row.point.intervalId },
          { header: "Label", width: 34, value: (row) => row.point.label },
          { header: "IPP", width: 10, value: (row) => row.point.value, align: "right", numberFormat: "0.0" },
          { header: "Vergleich", width: 10, value: (row) => row.point.compareValue ?? "", align: "right", numberFormat: "0.0" },
          { header: "Delta", width: 10, value: (row) => row.point.compareValue == null ? "" : Number((row.point.value - row.point.compareValue).toFixed(1)), align: "right", numberFormat: "0.0" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "IPP Verteilung",
        title: "IPP Verteilung",
        description: "Intervall- und kumulative Verteilung für Platzierung/Zweitplatzierung.",
        rows: [
          ...ippPie.slices.map((slice) => ({ scope: "Intervall", total: ippPie.total, slice })),
          ...ippPieCum.slices.map((slice) => ({ scope: "Kumuliert", total: ippPieCum.total, slice })),
        ],
        columns: [
          { header: "Scope", width: 14, value: (row) => row.scope },
          { header: "Kategorie", width: 24, value: (row) => row.slice.label },
          { header: "Faelle", width: 12, value: (row) => row.slice.count, align: "right" },
          { header: "Prozent", width: 12, value: (row) => row.slice.percent, align: "right", numberFormat: "0.0" },
          { header: "Gesamt", width: 12, value: (row) => row.total, align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Fuellstand",
        title: "Fuellstand Auswertung",
        description: "Fuellstand-Score und Zaehlwerte je Typ und Intervall.",
        rows: fuellstandRows,
        columns: [
          { header: "Modus", width: 12, value: (row) => row.mode },
          { header: "Interval ID", width: 26, value: (row) => row.point.intervalId },
          { header: "Label", width: 34, value: (row) => row.point.label },
          { header: "Typ", width: 16, value: (row) => row.typeKey },
          { header: "Score", width: 10, value: (row) => row.score, align: "right", numberFormat: "0.0" },
          { header: "Voll", width: 10, value: (row) => row.counts.voll, align: "right" },
          { header: "Mittel", width: 10, value: (row) => row.counts.mittel, align: "right" },
          { header: "Leer", width: 10, value: (row) => row.counts.leer, align: "right" },
          { header: "Gesamt", width: 10, value: (row) => row.counts.total, align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Fuellstand Fortschritt",
        title: "Fuellstand Fortschritt",
        description: "Erledigt/offen pro Intervallmodus.",
        rows: fuellstandProgress,
        columns: [
          { header: "Modus", width: 12, value: (row) => row.mode },
          { header: "Erledigt %", width: 12, value: (row) => row.progress.donePercent, align: "right", numberFormat: "0" },
          { header: "Erledigt", width: 12, value: (row) => row.progress.doneCount, align: "right" },
          { header: "Offen", width: 12, value: (row) => row.progress.openCount, align: "right" },
          { header: "Gesamt", width: 12, value: (row) => row.progress.totalCount, align: "right" },
        ],
      });

      appendTableSheet(XLSX, wb, {
        name: "Platzierungen",
        title: "IPP und Platzierungs Auswertung",
        description: "Coke vs Mitbewerber pro Intervall.",
        rows: platzierungenRows,
        columns: [
          { header: "Modus", width: 12, value: (row) => row.mode },
          { header: "Interval ID", width: 26, value: (row) => row.point.intervalId },
          { header: "Label", width: 34, value: (row) => row.point.label },
          { header: "Coke", width: 10, value: (row) => row.point.coke, align: "right", numberFormat: "0.0" },
          { header: "Mitbewerber", width: 12, value: (row) => row.point.competitor, align: "right", numberFormat: "0.0" },
        ],
      });

      const compare = buildCompareResult(ippLineRows.filter((row) => row.mode === "redmonth").map((row) => row.point), redmonthIntervals[0]?.id ?? null);
      appendTableSheet(XLSX, wb, {
        name: "Dashboard Summen",
        title: "Dashboard Summen",
        description: "Schnelle Kennzahlen aus dem Export.",
        rows: [
          { kennzahl: "RED IPP Delta", wert: compare?.deltaAbs ?? "", zusatz: compare?.deltaPct == null ? "" : `${compare.deltaPct}%` },
          { kennzahl: "IPP Intervall Total", wert: ippPie.total, zusatz: "" },
          { kennzahl: "IPP Kumuliert Total", wert: ippPieCum.total, zusatz: "" },
          { kennzahl: "Platzierung Reihen", wert: platzierungenRows.length, zusatz: "" },
        ],
        columns: [
          { header: "Kennzahl", width: 28, value: (row) => row.kennzahl },
          { header: "Wert", width: 14, value: (row) => row.wert, align: "right" },
          { header: "Zusatz", width: 18, value: (row) => row.zusatz },
        ],
      });
    },
  });
}
