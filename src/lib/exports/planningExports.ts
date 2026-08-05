import type { Campaign } from "@/types/campaign";
import type { Fragebogen, Module, Question } from "@/types/fragebogen";
import type { CampaignMarketVisitSummary } from "@/lib/api/backend";
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
import { formatAvailabilityLabel } from "@/lib/availabilityLabels";
import {
  buildPlatzierungenSeries,
  type PlatzierungenFilterScope,
} from "@/lib/platzierungen-dashboard/mock-data";

type ExportBaseMeta = {
  exportedBy?: string;
  note?: string;
};

export type CampaignExportMarket = {
  id: string;
  name: string;
  chain: string;
  city: string;
  region: string;
  address: string;
  stammnr?: string;
  standardMarketNumber?: string;
  cokeMasterNumber?: string;
  flexNumber?: string;
  kuehlerStammnr?: string;
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

type CampaignVisitDetailExportError = {
  campaignId: string;
  campaignName: string;
  marketId: string;
  marketName: string;
  reason: string;
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

type VisitDetailSection = CampaignMarketVisitSummary["sections"][number];
type VisitDetailQuestion = VisitDetailSection["questions"][number];
type VisitAnswerRow = {
  visit: CampaignMarketVisitSummary;
  section: VisitDetailSection;
  question: VisitDetailQuestion;
  questionIndex: number;
  campaign: Campaign | null;
  market: CampaignExportMarket | null;
};

function formatVisitAnswerValue(question: VisitDetailQuestion, value: string): string {
  return question.singleChoiceAvailability ? formatAvailabilityLabel(value) : value;
}

function stringifyUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function visitAnswerOptionsSummary(question: VisitDetailQuestion): string {
  const options = question.answer?.options ?? [];
  if (options.length === 0) return "";
  const top = options
    .filter((option) => option.optionRole === "top")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((option) => formatVisitAnswerValue(question, option.optionValue));
  const sub = options
    .filter((option) => option.optionRole === "sub")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((option) => formatVisitAnswerValue(question, option.optionValue));
  if (top.length > 0 && sub.length > 0) return `${top.join(", ")} | ${sub.join(", ")}`;
  return [...top, ...sub].join(", ");
}

function visitAnswerMatrixSummary(question: VisitDetailQuestion): string {
  const cells = question.answer?.matrixCells ?? [];
  if (cells.length === 0) return "";
  return cells
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((cell) => {
      const key = [cell.rowKey, cell.columnKey].filter(Boolean).join(" / ");
      if (cell.cellSelected != null) return `${key}: ${yesNo(cell.cellSelected)}`;
      if (cell.cellValueDate) return `${key}: ${cell.cellValueDate}`;
      return `${key}: ${cell.cellValueText ?? ""}`;
    })
    .join("; ");
}

function visitAnswerPhotoTagSummary(question: VisitDetailQuestion): string {
  return (question.answer?.photos ?? [])
    .map((photo, index) => {
      const labels = (photo.tags ?? [])
        .map((tag) => tag.photoTagLabelSnapshot)
        .filter((label) => label.trim().length > 0);
      return labels.length > 0 ? `Foto ${index + 1}: ${labels.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function visitAnswerPhotoPathSummary(question: VisitDetailQuestion): string {
  return (question.answer?.photos ?? [])
    .map((photo) => photo.storagePath)
    .filter((path) => path.trim().length > 0)
    .join("; ");
}

function visitAnswerSummary(question: VisitDetailQuestion): string {
  const answer = question.answer;
  if (!answer) return "";
  if (question.type === "photo") {
    const count = answer.photos.length;
    return count > 0 ? `${count} Foto${count === 1 ? "" : "s"}` : "";
  }
  if (question.type === "matrix") return visitAnswerMatrixSummary(question);
  const options = visitAnswerOptionsSummary(question);
  if (options) return options;
  if (answer.valueNumber != null && answer.valueNumber !== "") return answer.valueNumber;
  if (answer.valueText != null && answer.valueText !== "") {
    return formatVisitAnswerValue(question, answer.valueText);
  }
  if (answer.valueJson != null) {
    const raw = (answer.valueJson as { raw?: unknown }).raw;
    if (question.singleChoiceAvailability && Array.isArray(raw)) {
      return raw.map((value) => formatAvailabilityLabel(String(value))).join(", ");
    }
    if (question.singleChoiceAvailability && typeof raw === "string") {
      return formatAvailabilityLabel(raw);
    }
    return stringifyUnknown(answer.valueJson);
  }
  return "";
}

const SARA_EINSAETZE_COLUMN_SPEC = `
Zielobjekt		14.09765625
Stammnr.		15.3984375
Besuchsdatum		12.09765625
Besuchsstartzeit		8.796875
Einsatz	Verplanung	16.5
	Standardmarkt Nr.	9.8984375
	Flexnummer	14.296875
Person		15.3984375
Bilder		6.59765625
Fahrtbeginn		9.8984375
Fahrtende		8.796875
Fahrtdauer		7.69921875
Distanz		5.5
Besuchsbeginn		13.19921875
Besuchsende		12.09765625
Besuchsdauer		11
Ausfülldauer		9.8984375
Fragebogenkategorie		15.3984375
Ausfülldauer (berechnet)		17.59765625
Kommentar		122.09765625
Nicht Auswertbar		12.09765625
Begründung		100.09765625
Wurde die RED Survey ausgefüllt? (nur in RED-Märkten)	Wert	42.8984375
	Kommentar	70.3984375
ZUSATZTASK Mitbewerber - Ist ein markeneigener Kühler vorhanden? (+ Kommentar wie viele, wenn mehr als 1) + FOTO!!	Wert	94.59765625
	Kommentar	100.09765625
ZUSATZTASK Mitbewerber - Sind Großplatzierung bzw. Aufbauten vom Mitbewerb vorhanden? (+ Kommentar wie viele, wenn mehr als 1) + FOTO!!	Wert	112.19921875
	Kommentar	81.3984375
Ist die CR, CZ 200ml CAN im Markt verfügbar? +FOTO!!	Wert	44
	Kommentar	51.69921875
Ist die CR, CZ, F - 4 Pack 0,33L CAN im Markt verfügbar? +FOTO!!	Wert	13
	Kommentar	52.796875
Ist die Coke Zero Zero 0,33l CAN im Markt verfügbar? +FOTO!!	Wert	49.5
	Kommentar	39.59765625
Ist die Jack & Coke 330ml CAN im Markt verfügbar? +FOTO!!	Wert	44
	Kommentar	14.296875
Ist die BACARDI Coca-Cola 0,25L CAN im Markt verfügbar? +FOTO!!	Wert	49.5
	Kommentar	15.3984375
Monster Schütte 0,5L MIT CROWNER in richtiger Zone platziert (richtige Zone = Incidence Zone, Kassa, Brot/Gebäck, Milch/Käse, Pasta, Fertiggerichte, Tiefkühlprodukte)	Wert	115.5
	Kommentar	48.3984375
Monster Schütte 0,5L MIT CROWNER in sonstiger Zone platziert	Wert	46.19921875
	Kommentar	47.296875
Monster Display 0,5L MIT HEADER in richtiger Zone platziert (richtige Zone = Incidence, Kassa, Brot/Gebäck, Milch/Käse, Pasta, Fertiggerichte, Tiefkühlprodukte)	Wert	107.796875
	Kommentar	28.59765625
Monster Display 0,5L MIT HEADER in sonstiger Zone platziert	Wert	44
	Kommentar	24.19921875
Powerade Schütte in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	78.09765625
Powerade Schütte in sonstiger Zone platziert	Zahl	31.8984375
Powerade Display in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	77
Powerade Display in sonstiger Zone platziert	Zahl	30.796875
Coke Schütte (SSD 0,5L) in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	83.59765625
Coke Schütte (SSD 0,5L) in sonstiger Zone platziert	Zahl	37.3984375
Coke Display (0,5L) in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	78.09765625
Coke Display (0,5L) in sonstiger Zone platziert	Zahl	31.8984375
Coke Schütte (0,33L) in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	80.296875
Coke Schütte (0,33L) in sonstiger Zone platziert	Zahl	34.09765625
Coke Display (0,33L) in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	79.19921875
Coke Display (0,33L) in sonstiger Zone platziert	Zahl	33
Fanta Schütte (SSD 0,5L) in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	81.3984375
Fanta Schütte (SSD 0,5L) in sonstiger Zone platziert	Zahl	35.19921875
Fanta Display in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	71.5
Fanta Display in sonstiger Zone platziert?	Zahl	26.3984375
Fuzetea Schütte (0,5L) - in richtiger Zone platziert (richtige Zone = Frequency, Feinkost/Sandwiches/frisches Fleisch, Obst/Gemüse, Healthy Snacks (z.B. Nüsse,…))	Zahl	102.296875
Fuzetea Schütte (0,5L) - in sonstiger Zone platziert	Zahl	34.09765625
Fuzetea Display (0,5L) - in richtiger Zone platziert (richtige Zone = Frequency, Feinkost/Sandwiches/frisches Fleisch, Obst/Gemüse, Healthy Snacks (z.B. Nüsse,…))	Zahl	101.19921875
Fuzetea Display (0,5L) - in sonstiger Zone platziert	Zahl	33
Sprite 0,5L PET Schütte -in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	83.59765625
Sprite 0,5L PET Schütte - in sonstiger Zone platziert	Zahl	38.5
Mezzo Mix Schütte in richtiger Zone platziert (richtige Zone = Frequency, Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	77
Mezzo Mix Schütte in sonstiger Zone platziert	Zahl	30.796875
RQ Schütte 0,5L - in richtiger Zone platziert (richtige Zone = Frequency, Feinkost/Sandwiches/frisches Fleisch, Obst/Gemüse)	Zahl	82.5
RQ Schütte 0,5L - in sonstiger Zone platziert	Zahl	33
RQ Display - in richtiger Zone platziert (richtige Zone = Frequency, Feinkost/Sandwiches/frisches Fleisch, Obst/Gemüse)	Zahl	77
RQ Display - in sonstiger Zone platziert?	Zahl	28.59765625
RQ Emotion Schütte 0,5 L - in richtiger Zone platziert (richtige Zone = Frequency, Feinkost/Sandwiches/frisches Fleisch, Obst/Gemüse)	Zahl	90.19921875
RQ Emotion Schütte 0,5 L - in sonstiger Zone platziert	Zahl	40.69921875
Kinley Schütte - in richtiger Zone platziert (richtige Zone = Chips/Salziges, Feinkost/Sandwiches/Frischfleisch)	Zahl	68.19921875
Kinley Schütte - in sonstiger Zone platziert	Zahl	30.796875
Kinley Display in richtiger Zone platziert (richtige Zone = Frequency, Spirituosen)	Zahl	56.09765625
Kinley Display in sonstiger Zone platziert?	Zahl	29.69921875
Coke Platzierung OHNE Material (+ KOMMENTAR WAS WURDE PLATZIERT)	Wert	55
	Kommentar	94.59765625
Coke Platzierung MIT Material (+ KOMMENTAR WAS WURDE PLATZIERT)	Wert	52.796875
	Kommentar	16.5
Konnte eine Großplatzierung platziert werden? (Monster, Fanta Schloss usw.)	Wert	50.59765625
	Kommentar	24.19921875
Anzahl permanente Coke-Racks - bereits im Markt vorhandene (nicht nötigerweise beim aktuellen Besuch platzierte) permanente Coke Racks (Nur 1x im Quartal zu erheben)	Zahl	108.8984375
Anzahl permanente Coke Racks- (beim aktuellen Besuch NEU PLATZIERTE) permanent Racks (sustainability Rack)	Zahl	69.296875
Anzahl permanente Monster-Racks - bereits im Markt vorhanden (nicht nötigerweise beim aktuellen Besuch platzierte)	Zahl	72.59765625
Anzahl permanente Monster-Racks - (beim aktuellen Besuch NEU PLATZIERTE) permanent Racks (sustainability Rack)	Zahl	70.3984375
Anzahl FLEXZIEL - (beim aktuellen Besuch NEU PLATZIERTE) Displayplatzierung ZZ/Holzrack + Kühlerinventur Aktivierung: Dosenschütte ZZ, Schütte ZZ, Holzdisplay, Scanningrate Kühler)	Wert	125.3984375
	Kommentar	29.69921875
Wie viele Zweitplatzierungen sind zusätzlich zu den prämien-relevanten Aufbauten und E3-Aufbauten sonst noch platziert? (z.B. Shelf Adapter, Körberl bei Feinkost, Paletten-Zweitplatzierungen, markteigene Schütten, ...)	Zahl	145.19921875
Wie viele E3-Aufbauten sind im Outlet platziert?	Zahl	34.09765625
Wie ist die aktuelle Verfügbarkeit im Kühler? + FOTO der Verfügbarkeit (Optional)	(1) = TOP Verfügbarkeit, laufender Verkauf gesichert	53.8984375
	(3) = mittelmäßig, Verfügbarkeit gewährleistet, könnte knapp werden	49.5
	(5) = Verfügbarkeit schlecht, OOS vorhanden bzw. droht	40.69921875
Wie ist die aktuelle Verfügbarkeit bei den SingleServe? + FOTO der Verfügbarkeit (Optional)	(1) = TOP Verfügbarkeit, laufender Verkauf gesichert	63.796875
	(3) = mittelmäßig, Verfügbarkeit gewährleistet, könnte knapp werden	49.5
	(5) = Verfügbarkeit schlecht, OOS vorhanden bzw. droht	40.69921875
Wie ist die aktuelle Verfügbarkeit bei den MultiServe? + FOTO der Verfügbarkeit (Optional)	(1) = TOP Verfügbarkeit, laufender Verkauf gesichert	61.59765625
	(3) = mittelmäßig, Verfügbarkeit gewährleistet, könnte knapp werden	49.5
	(5) = Verfügbarkeit schlecht, OOS vorhanden bzw. droht	40.69921875
Wie ist die aktuelle Verfügbarkeit bei den Promos? + FOTO der Verfügbarkeit (Optional)	(1) = TOP Verfügbarkeit, laufender Verkauf gesichert	59.3984375
	(3) = mittelmäßig, Verfügbarkeit gewährleistet, könnte knapp werden	49.5
	(5) = Verfügbarkeit schlecht, OOS vorhanden bzw. droht	40.69921875
Wie ist die aktuelle Verfügbarkeit im Lager? + FOTO der Verfügbarkeit (Optional)	(1) = TOP Verfügbarkeit, laufender Verkauf gesichert	51.69921875
	(3) = mittelmäßig, Verfügbarkeit gewährleistet, könnte knapp werden	49.5
	(5) = Verfügbarkeit schlecht, OOS vorhanden bzw. droht	40.69921875
`.trim();

type SaraEinsaetzeColumn = {
  h1: string;
  h2: string;
  width: number;
};

type SaraCellValue = string | number | boolean;

export type FbManagementExportVisitRow = {
  campaignId: string;
  sessionId: string;
  startedAt: string;
  gmUserId: string | null;
  kuehlerTechnicalIdentNo?: string | null;
  sectionTypes: VisitDetailSection["section"][];
  cells: SaraCellValue[];
  dynamicAnswers: Array<{
    key: string;
    question: string;
    kind: FbManagementExportQuestion["kind"];
    availability?: boolean;
    value: SaraCellValue;
    comment: string;
  }>;
};

const SARA_BASE_COLUMN_COUNT = 22;

export type FbManagementExportQuestion = {
  key: string;
  question: string;
  kind: "value" | "number";
  availability?: boolean;
};

export type FbManagementExportQuestionCatalog = {
  questions: FbManagementExportQuestion[];
  questionsByCampaignId: Record<string, FbManagementExportQuestion[]>;
  questionIdsByCampaignId: Record<string, string[]>;
};

function fbManagementQuestionKind(question: Question): FbManagementExportQuestion["kind"] {
  return question.type === "numeric" || question.type === "slider" ? "number" : "value";
}

function campaignFragebogenScope(section: Campaign["section"]): "main" | "kuehler" | "mhd" | "durcharbeit" {
  if (section === "kuehler") return "kuehler";
  if (section === "mhd") return "mhd";
  if (section === "durcharbeit") return "durcharbeit";
  return "main";
}

export function buildFbManagementQuestionCatalog(input: {
  campaigns: Campaign[];
  fragebogenByScope: Record<string, Fragebogen[]>;
  modulesByScope: Record<string, Module[]>;
}): FbManagementExportQuestionCatalog {
  const questionsById = new Map<string, FbManagementExportQuestion>();
  const questionsByCampaignId: Record<string, FbManagementExportQuestion[]> = {};
  const questionIdsByCampaignId: Record<string, string[]> = {};

  for (const campaign of input.campaigns) {
    const campaignQuestions: FbManagementExportQuestion[] = [];
    const questionIds: string[] = [];
    questionsByCampaignId[campaign.id] = campaignQuestions;
    questionIdsByCampaignId[campaign.id] = questionIds;
    if (!campaign.currentFragebogenId) continue;

    const scope = campaignFragebogenScope(campaign.section);
    const fragebogen = (input.fragebogenByScope[scope] ?? []).find(
      (entry) => entry.id === campaign.currentFragebogenId,
    );
    if (!fragebogen) {
      throw new Error(`Der Fragebogen der Kampagne „${campaign.name}“ konnte für den Export nicht geladen werden.`);
    }

    const moduleById = new Map((input.modulesByScope[scope] ?? []).map((module) => [module.id, module]));
    const campaignQuestionIds = new Set<string>();
    const addQuestion = (question: Question) => {
      if (!question.id || campaignQuestionIds.has(question.id)) return;
      campaignQuestionIds.add(question.id);
      questionIds.push(question.id);
      const exportQuestion = questionsById.get(question.id) ?? {
        key: question.id,
        question: question.text,
        kind: fbManagementQuestionKind(question),
        availability: Boolean(question.singleChoiceAvailability),
      };
      if (!questionsById.has(question.id)) questionsById.set(question.id, exportQuestion);
      campaignQuestions.push(exportQuestion);
    };

    for (const moduleId of fragebogen.moduleIds) {
      const module = moduleById.get(moduleId);
      if (!module) {
        throw new Error(`Ein Modul des Fragebogens „${fragebogen.name}“ konnte für den Export nicht geladen werden.`);
      }
      for (const question of module.questions) addQuestion(question);
    }
    for (const question of fragebogen.spezialfragen ?? []) addQuestion(question);
  }

  return {
    questions: Array.from(questionsById.values()),
    questionsByCampaignId,
    questionIdsByCampaignId,
  };
}

function getSaraEinsaetzeColumns(): SaraEinsaetzeColumn[] {
  return SARA_EINSAETZE_COLUMN_SPEC.split("\n").slice(0, SARA_BASE_COLUMN_COUNT).map((line) => {
    const [h1 = "", h2 = "", width = "18"] = line.split("\t");
    return { h1, h2, width: Number(width) || 18 };
  });
}

function formatSaraDateTime(value: string | null | undefined, mode: "date" | "time"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    ...(mode === "date"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : { hour: "2-digit", minute: "2-digit", hour12: false }),
  });
}

function saraNumberFromString(value: string | number | null | undefined): number | string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function saraAnswerRawValue(question: VisitDetailQuestion): string {
  const answer = question.answer;
  if (!answer) return "";
  const optionSummary = visitAnswerOptionsSummary(question);
  if (optionSummary) return optionSummary;
  if (answer.valueNumber != null && answer.valueNumber !== "") return String(answer.valueNumber);
  if (answer.valueText != null && answer.valueText !== "") {
    return formatVisitAnswerValue(question, answer.valueText);
  }
  const raw = (answer.valueJson as { raw?: unknown } | null | undefined)?.raw;
  if (Array.isArray(raw)) {
    return raw.map((value) => formatVisitAnswerValue(question, String(value))).join(", ");
  }
  if (typeof raw === "string") return formatVisitAnswerValue(question, raw);
  if (raw != null) return stringifyUnknown(raw);
  if (answer.valueJson != null) return stringifyUnknown(answer.valueJson);
  if (answer.photos.length > 0) return `${answer.photos.length} Foto${answer.photos.length === 1 ? "" : "s"}`;
  return "";
}

function saraTargetObject(market: CampaignExportMarket | null | undefined): string {
  if (!market) return "";
  const parts = [
    market.chain,
    [market.name, market.address, market.city].filter(Boolean).join(", "),
    market.region ? `Re. ${market.region}` : "",
  ].filter((part) => part.trim().length > 0);
  return parts.join("; ");
}

function firstMarketIdentifier(...values: Array<string | null | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function saraCustomerNumber(market: CampaignExportMarket | null | undefined): string {
  return firstMarketIdentifier(market?.cokeMasterNumber, market?.kuehlerStammnr, market?.stammnr);
}

function saraInternalId(
  visit: CampaignMarketVisitSummary,
  market: CampaignExportMarket | null | undefined,
): string {
  const isKuehlerVisit = visit.sections.some((section) => section.section === "kuehler");
  return firstMarketIdentifier(
    isKuehlerVisit ? visit.kuehlerInternalId : market?.standardMarketNumber,
  );
}

function saraExternalId(market: CampaignExportMarket | null | undefined): string {
  return firstMarketIdentifier(market?.flexNumber);
}

function appendSaraCellValue(row: SaraCellValue[], index: number, value: SaraCellValue) {
  if (value === "") return;
  const current = row[index];
  if (current === "") {
    row[index] = value;
    return;
  }
  if (current === value) return;
  const parts = String(current)
    .split(" | ")
    .map((part) => part.trim())
    .filter(Boolean);
  const next = String(value);
  if (!parts.includes(next)) {
    row[index] = [...parts, next].join(" | ");
  }
}

export function prepareFbManagementExportVisitRow(input: {
  visit: CampaignMarketVisitSummary;
  market: CampaignExportMarket | null;
  campaignId?: string | null;
  campaignName?: string | null;
  allowedQuestionIds?: ReadonlySet<string>;
}): FbManagementExportVisitRow | null {
  const { visit } = input;
  if (!visit.hasSubmittedVisit || !visit.sessionId || !visit.startedAt) return null;

  const primarySection = visit.sections[0] ?? null;
  const columns = getSaraEinsaetzeColumns();
  const row: SaraCellValue[] = Array.from({ length: columns.length }, () => "");
  const dynamicAnswers: FbManagementExportVisitRow["dynamicAnswers"] = [];
  const photoCount = visit.sections.reduce(
    (total, section) =>
      total + section.questions.reduce(
        (sectionTotal, question) =>
          sectionTotal + (
            !input.allowedQuestionIds || input.allowedQuestionIds.has(question.questionId)
              ? question.answer?.photos.length ?? 0
              : 0
          ),
        0,
      ),
    0,
  );

  row[0] = saraTargetObject(input.market);
  row[1] = saraCustomerNumber(input.market);
  row[2] = formatSaraDateTime(visit.startedAt, "date");
  row[3] = formatSaraDateTime(visit.startedAt, "time");
  row[4] = input.campaignName ?? primarySection?.fragebogenName ?? "";
  row[5] = saraInternalId(visit, input.market);
  row[6] = saraExternalId(input.market);
  row[7] = visit.gmName ?? "";
  row[8] = photoCount;
  row[13] = formatSaraDateTime(visit.startedAt, "time");
  row[14] = formatSaraDateTime(visit.submittedAt, "time");
  row[15] = visit.durationMinutes ?? "";
  row[17] = primarySection ? sectionLabel(primarySection.section) : "";
  row[18] = 0;
  row[20] = false;

  for (const section of visit.sections) {
    for (const question of section.questions) {
      if (input.allowedQuestionIds && !input.allowedQuestionIds.has(question.questionId)) continue;
      const rawValue = visitAnswerSummary(question) || saraAnswerRawValue(question) || "Keine Antwort";
      const kind = question.type === "numeric" || question.type === "slider" ? "number" : "value";
      dynamicAnswers.push({
        key: question.questionId,
        question: question.text,
        kind,
        availability: Boolean(question.singleChoiceAvailability),
        value: kind === "number" ? saraNumberFromString(rawValue) : rawValue,
        comment: question.comment ?? "",
      });
    }
  }

  return {
    campaignId: input.campaignId ?? primarySection?.campaignId ?? "",
    sessionId: visit.sessionId,
    startedAt: visit.startedAt,
    gmUserId: visit.gmUserId,
    kuehlerTechnicalIdentNo: visit.kuehlerTechnicalIdentNo ?? null,
    sectionTypes: Array.from(new Set(visit.sections.map((section) => section.section))),
    cells: row,
    dynamicAnswers,
  };
}

function dynamicSaraColumnWidth(question: string): number {
  return Math.min(80, Math.max(24, Math.ceil(question.length * 0.72)));
}

type FbManagementAvailabilityBucket = "top" | "mediocre" | "bad";

function fbManagementAvailabilityBucket(value: SaraCellValue): FbManagementAvailabilityBucket | null {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "keine antwort") return null;
  if (/^(top|voll|1)$/.test(normalized)) return "top";
  if (/^(mediocre|mittel|mittelmassig|3)$/.test(normalized)) return "mediocre";
  if (/^(bad|leer|schlecht|oos|5)$/.test(normalized)) return "bad";
  if (/\btop\b|\bvoll\b|\(1\)|^1\b/.test(normalized)) return "top";
  if (/\bmediocre\b|\bmittel|\(3\)|^3\b/.test(normalized)) return "mediocre";
  if (/\bbad\b|\bleer\b|\bschlecht\b|\boos\b|\(5\)|^5\b/.test(normalized)) return "bad";
  return null;
}

export function buildPreparedFbManagementExportRows(
  preparedRows: FbManagementExportVisitRow[],
  travelByVisitSessionId?: Record<string, { start: string; end: string; durationMin: number }>,
  questionCatalog?: readonly FbManagementExportQuestion[],
  questionIdsByCampaignId?: Readonly<Record<string, readonly string[]>>,
  options?: { includeKuehlerTechnicalIdentNoColumn?: boolean },
) {
  const sortedRows = preparedRows.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const staticColumns = getSaraEinsaetzeColumns();
  const includesKuehler = options?.includeKuehlerTechnicalIdentNoColumn
    ?? sortedRows.some((row) => row.sectionTypes.includes("kuehler"));
  if (includesKuehler) {
    staticColumns.splice(6, 0, { h1: "Tech. Ident. No.", h2: "", width: 18 });
  }
  const columns = staticColumns.slice();
  const dynamicQuestionByKey = new Map<
    string,
    FbManagementExportQuestion
  >();

  if (questionCatalog) {
    for (const question of questionCatalog) {
      if (!dynamicQuestionByKey.has(question.key)) dynamicQuestionByKey.set(question.key, question);
    }
  } else {
    for (const row of sortedRows) {
      for (const answer of row.dynamicAnswers) {
        if (!dynamicQuestionByKey.has(answer.key)) {
          dynamicQuestionByKey.set(answer.key, {
            key: answer.key,
            question: answer.question,
            kind: answer.kind,
            availability: Boolean(answer.availability),
          });
        }
      }
    }
  }

  const dynamicQuestions = Array.from(dynamicQuestionByKey.values());
  for (const question of dynamicQuestions) {
    if (question.availability) {
      columns.push(
        { h1: question.question, h2: "Top", width: dynamicSaraColumnWidth(question.question) },
        { h1: "", h2: "Mediocre", width: 14 },
        { h1: "", h2: "Bad", width: 14 },
      );
      continue;
    }
    columns.push(
      { h1: question.question, h2: question.kind === "number" ? "Zahl" : "Wert", width: dynamicSaraColumnWidth(question.question) },
      { h1: "", h2: "Kommentar", width: 32 },
    );
  }

  const applicableQuestionIdsByCampaignId = questionIdsByCampaignId
    ? new Map(
      Object.entries(questionIdsByCampaignId).map(([campaignId, questionIds]) => [
        campaignId,
        new Set(questionIds),
      ]),
    )
    : null;
  const rows = sortedRows.map((prepared) => {
    const row = prepared.cells.slice(0, SARA_BASE_COLUMN_COUNT);
    const applicableQuestionIds = applicableQuestionIdsByCampaignId?.get(prepared.campaignId) ?? null;
    const travel = travelByVisitSessionId?.[prepared.sessionId];
    row[9] = travel?.start ?? "";
    row[10] = travel?.end ?? "";
    row[11] = travel?.durationMin ?? "";
    if (includesKuehler) {
      row.splice(6, 0, prepared.kuehlerTechnicalIdentNo ?? "");
    }
    const answerByKey = new Map<string, { value: SaraCellValue; comment: string }>();
    for (const answer of prepared.dynamicAnswers) {
      const current = answerByKey.get(answer.key);
      if (!current) {
        answerByKey.set(answer.key, { value: answer.value, comment: answer.comment });
        continue;
      }
      const valueCell: SaraCellValue[] = [current.value];
      appendSaraCellValue(valueCell, 0, answer.value);
      const commentCell: SaraCellValue[] = [current.comment];
      appendSaraCellValue(commentCell, 0, answer.comment);
      answerByKey.set(answer.key, { value: valueCell[0], comment: String(commentCell[0]) });
    }
    for (const question of dynamicQuestions) {
      const answer = answerByKey.get(question.key);
      if (question.availability) {
        if (applicableQuestionIds && !applicableQuestionIds.has(question.key)) {
          row.push("", "", "");
          continue;
        }
        const bucket = answer ? fbManagementAvailabilityBucket(answer.value) : null;
        row.push(
          bucket === "top" ? "X" : bucket ? "" : "Keine Antwort",
          bucket === "mediocre" ? "X" : "",
          bucket === "bad" ? "X" : "",
        );
        continue;
      }
      row.push(answer?.value ?? "", answer?.comment ?? "");
    }
    return row;
  });

  return { columns, rows };
}

function appendSaraEinsaetzeSheet(
  XLSX: typeof import("xlsx-js-style"),
  wb: ReturnType<(typeof import("xlsx-js-style"))["utils"]["book_new"]>,
  rows: SaraCellValue[][],
  columns: SaraEinsaetzeColumn[] = getSaraEinsaetzeColumns(),
  sheetName = "Einsätze",
) {
  const sheetRows: SaraCellValue[][] = [
    columns.map((column) => column.h1),
    columns.map((column) => column.h2),
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = columns.map((column) => ({ wch: column.width }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

export function buildFbManagementCampaignSheets(input: {
  campaigns: Campaign[];
  preparedRows: FbManagementExportVisitRow[];
  questionCatalog: FbManagementExportQuestionCatalog;
  travelByVisitSessionId?: Record<string, { start: string; end: string; durationMin: number }>;
}) {
  const campaignById = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]));
  const unscopedRows = input.preparedRows.filter((row) => !campaignById.has(row.campaignId));
  if (unscopedRows.length > 0) {
    throw new Error(`${unscopedRows.length} Besuche konnten keiner exportierten Kampagne zugeordnet werden.`);
  }

  const preparedRows = input.preparedRows.map((row) => {
    const allowedQuestionIds = new Set(
      input.questionCatalog.questionIdsByCampaignId[row.campaignId] ?? [],
    );
    return {
      ...row,
      dynamicAnswers: row.dynamicAnswers.filter((answer) => allowedQuestionIds.has(answer.key)),
    };
  });
  const campaignSections = new Set(input.campaigns.map((campaign) => campaign.section));
  const includesKuehler = campaignSections.has("kuehler");
  const onlyKuehler = includesKuehler && campaignSections.size === 1;
  const preparedExport = buildPreparedFbManagementExportRows(
    preparedRows,
    input.travelByVisitSessionId,
    input.questionCatalog.questions,
    input.questionCatalog.questionIdsByCampaignId,
    { includeKuehlerTechnicalIdentNoColumn: includesKuehler },
  );
  const columns = preparedExport.columns.map((column, index) => {
    if (!includesKuehler) return column;
    if (index === 5) {
      return { ...column, h1: onlyKuehler ? "Interne ID" : "Interne ID / Standardmarkt Nr.", h2: "" };
    }
    if (index === 6) {
      return { ...column, h1: "Tech. Ident. No.", h2: "" };
    }
    if (index === 7) {
      return { ...column, h1: onlyKuehler ? "Externe ID" : "Externe ID / Flexnummer", h2: "" };
    }
    return column;
  });

  return [{
    campaignId: input.campaigns.length === 1 ? input.campaigns[0].id : "combined",
    sheetName: "Einsätze",
    ...preparedExport,
    columns,
  }];
}

function appendFbManagementCampaignSheets(input: {
  XLSX: typeof import("xlsx-js-style");
  wb: ReturnType<(typeof import("xlsx-js-style"))["utils"]["book_new"]>;
  campaigns: Campaign[];
  preparedRows: FbManagementExportVisitRow[];
  questionCatalog: FbManagementExportQuestionCatalog;
  travelByVisitSessionId?: Record<string, { start: string; end: string; durationMin: number }>;
}) {
  const sheets = buildFbManagementCampaignSheets(input);
  for (const sheet of sheets) {
    appendSaraEinsaetzeSheet(input.XLSX, input.wb, sheet.rows, sheet.columns, sheet.sheetName);
  }
}

export async function exportFbManagementExcel(input: {
  campaigns: Campaign[];
  markets: CampaignExportMarket[];
  visitStatusByCampaignId: Record<string, Record<string, CampaignExportStatus>>;
  visitDetails?: CampaignMarketVisitSummary[];
  preparedVisitRows?: FbManagementExportVisitRow[];
  questionCatalog?: FbManagementExportQuestionCatalog;
  expectedPreparedVisitCount?: number;
  visitDetailErrors?: CampaignVisitDetailExportError[];
  fragebogenByScope?: Record<string, Fragebogen[]>;
  modulesByScope?: Record<string, Module[]>;
  travelByVisitSessionId?: Record<string, { start: string; end: string; durationMin: number }>;
  exportedBy?: string;
}) {
  const filename = `CokeSpark_FB_Management_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;
  if (input.preparedVisitRows) {
    if (
      input.expectedPreparedVisitCount != null &&
      input.preparedVisitRows.length !== input.expectedPreparedVisitCount
    ) {
      throw new Error(
        `Der Export ist unvollst\u00e4ndig (${input.preparedVisitRows.length}/${input.expectedPreparedVisitCount} Besuche).`,
      );
    }
    const questionCatalog = input.questionCatalog ?? buildFbManagementQuestionCatalog({
      campaigns: input.campaigns,
      fragebogenByScope: input.fragebogenByScope ?? {},
      modulesByScope: input.modulesByScope ?? {},
    });
    await buildAndDownloadWorkbook({
      filename,
      build: ({ XLSX, wb }) => {
        appendFbManagementCampaignSheets({
          XLSX,
          wb,
          campaigns: input.campaigns,
          preparedRows: input.preparedVisitRows!,
          questionCatalog,
          travelByVisitSessionId: input.travelByVisitSessionId,
        });
      },
    });
    return;
  }

  const campaigns = input.campaigns.slice().sort((a, b) =>
    a.section.localeCompare(b.section, "de") ||
    a.name.localeCompare(b.name, "de"),
  );
  const marketById = new Map(input.markets.map((market) => [market.id, market]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const exportQuestionCatalog = buildFbManagementQuestionCatalog({
    campaigns,
    fragebogenByScope: input.fragebogenByScope ?? {},
    modulesByScope: input.modulesByScope ?? {},
  });
  const questionIdsByCampaignId = new Map(
    Object.entries(exportQuestionCatalog.questionIdsByCampaignId).map(([campaignId, questionIds]) => [
      campaignId,
      new Set(questionIds),
    ]),
  );
  const fallbackPreparedRows = (input.visitDetails ?? [])
    .map((visit) => {
      const primarySection = visit.sections[0] ?? null;
      const campaign = primarySection ? campaignById.get(primarySection.campaignId) ?? null : null;
      return prepareFbManagementExportVisitRow({
        visit,
        market: marketById.get(visit.marketId) ?? null,
        campaignId: campaign?.id,
        campaignName: campaign?.name ?? primarySection?.fragebogenName ?? "",
        allowedQuestionIds: campaign ? questionIdsByCampaignId.get(campaign.id) : new Set<string>(),
      });
    })
    .filter((row): row is FbManagementExportVisitRow => Boolean(row));

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendFbManagementCampaignSheets({
        XLSX,
        wb,
        campaigns,
        preparedRows: fallbackPreparedRows,
        questionCatalog: exportQuestionCatalog,
        travelByVisitSessionId: input.travelByVisitSessionId,
      });
    },
  });
  return;

  const assignmentRows = campaigns.flatMap((campaign) => {
    const statuses = input.visitStatusByCampaignId[campaign.id] ?? {};
    return campaign.assignments.map((assignment) => ({
      campaign,
      assignment,
      market: marketById.get(assignment.marketId),
      status: statuses[assignment.marketId] ?? null,
    }));
  });
  const historyRows = campaigns.flatMap((campaign) =>
    campaign.history.map((history) => ({ campaign, history })),
  );
  const scopeFragebogenRows = Object.entries(input.fragebogenByScope ?? {}).flatMap(([scope, rows]) =>
    rows.map((fragebogen) => ({ scope, fragebogen })),
  );
  const scopeModuleRows = Object.entries(input.modulesByScope ?? {}).flatMap(([scope, rows]) =>
    rows.map((module) => ({ scope, module })),
  );
  const answerRows: VisitAnswerRow[] = (input.visitDetails ?? []).flatMap((visit) =>
    visit.sections.flatMap((section) => {
      const campaign = campaignById.get(section.campaignId) ?? null;
      const market = marketById.get(visit.marketId) ?? null;
      return section.questions.map((question, questionIndex) => ({
        visit,
        section,
        question,
        questionIndex,
        campaign,
        market,
      }));
    }),
  );

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendMetaSheet(XLSX, wb, [
        ...baseMeta("FB Management", campaigns.length, {
          exportedBy: input.exportedBy,
          note: "Kampagnen, Zielmärkte, Besuchsstatus und Katalog-Bezug.",
        }),
        { label: "Assignments", value: assignmentRows.length },
        { label: "Antwortzeilen", value: answerRows.length },
        { label: "Antwortdetails Fehler", value: input.visitDetailErrors?.length ?? 0 },
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

      appendTableSheet(XLSX, wb, {
        name: "Antworten",
        title: "Fragebogen-Antworten",
        description: "Eine Zeile je Frage aus geladenen, eingereichten Marktbesuchen. Sichtbar=false bedeutet: Frage war beim Submit durch Chain/Regel ausgeblendet.",
        rows: answerRows,
        columns: [
          { header: "Campaign ID", width: 38, value: (row) => row.section.campaignId },
          { header: "Kampagne", width: 34, value: (row) => row.campaign?.name ?? "" },
          { header: "Sektion", width: 12, value: (row) => sectionLabel(row.section.section) },
          { header: "Market ID", width: 38, value: (row) => row.visit.marketId },
          { header: "Markt", width: 30, value: (row) => row.market?.name ?? "" },
          { header: "Adresse", width: 28, value: (row) => row.market?.address ?? "" },
          { header: "Stammnr", width: 16, value: (row) => row.market?.stammnr ?? "" },
          { header: "Ort", width: 22, value: (row) => row.market?.city ?? "" },
          { header: "Region", width: 12, value: (row) => row.market?.region ?? "" },
          { header: "GM", width: 24, value: (row) => row.visit.gmName ?? "" },
          { header: "Session ID", width: 38, value: (row) => row.visit.sessionId ?? "" },
          { header: "Started", width: 24, value: (row) => row.visit.startedAt ?? "" },
          { header: "Submitted At", width: 24, value: (row) => row.visit.submittedAt ?? "" },
          { header: "Dauer Min", width: 11, value: (row) => row.visit.durationMinutes ?? "", align: "right" },
          { header: "Fragebogen", width: 34, value: (row) => row.section.fragebogenName },
          { header: "Modul", width: 30, value: (row) => row.question.moduleName },
          { header: "Reihenfolge", width: 10, value: (row) => row.questionIndex + 1, align: "right" },
          { header: "Frage ID", width: 38, value: (row) => row.question.questionId },
          { header: "Typ", width: 16, value: (row) => questionTypeLabel(row.question.type) },
          { header: "Pflicht", width: 9, value: (row) => yesNo(row.question.required), align: "center" },
          { header: "Sichtbar", width: 9, value: (row) => yesNo(row.question.visibility.isVisibleAtSubmit), align: "center" },
          { header: "Status", width: 14, value: (row) => row.question.answer?.answerStatus ?? "unanswered" },
          { header: "Gültig", width: 9, value: (row) => yesNo(row.question.answer?.isValid), align: "center" },
          { header: "Antwort", width: 58, value: (row) => visitAnswerSummary(row.question) },
          { header: "Optionen", width: 44, value: (row) => visitAnswerOptionsSummary(row.question) },
          { header: "Matrix", width: 54, value: (row) => visitAnswerMatrixSummary(row.question) },
          { header: "Kommentar", width: 42, value: (row) => row.question.comment ?? "" },
          { header: "Fotos", width: 8, value: (row) => row.question.answer?.photos.length ?? 0, align: "right" },
          { header: "Foto Tags", width: 48, value: (row) => visitAnswerPhotoTagSummary(row.question) },
          { header: "Foto Pfade", width: 64, value: (row) => visitAnswerPhotoPathSummary(row.question) },
          { header: "Validation Error", width: 42, value: (row) => row.question.answer?.validationError ?? "" },
        ],
      });

      if ((input.visitDetailErrors ?? []).length > 0) {
        appendTableSheet(XLSX, wb, {
          name: "Export Hinweise",
          title: "Nicht geladene Antwortdetails",
          description: "Diese Marktbesuche konnten beim Export nicht vollständig geladen werden.",
          rows: input.visitDetailErrors ?? [],
          columns: [
            { header: "Campaign ID", width: 38, value: (row) => row.campaignId },
            { header: "Kampagne", width: 34, value: (row) => row.campaignName },
            { header: "Market ID", width: 38, value: (row) => row.marketId },
            { header: "Markt", width: 30, value: (row) => row.marketName },
            { header: "Grund", width: 58, value: (row) => row.reason },
          ],
        });
      }

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
  primaryScope?: "main" | "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
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
          { header: formatAvailabilityLabel("Voll"), width: 10, value: (row) => row.counts.voll, align: "right" },
          { header: formatAvailabilityLabel("Mittel"), width: 12, value: (row) => row.counts.mittel, align: "right" },
          { header: formatAvailabilityLabel("Leer"), width: 10, value: (row) => row.counts.leer, align: "right" },
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
