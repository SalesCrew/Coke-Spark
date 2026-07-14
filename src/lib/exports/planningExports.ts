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
    .map((option) => option.optionValue);
  const sub = options
    .filter((option) => option.optionRole === "sub")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((option) => option.optionValue);
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
  if (answer.valueText != null && answer.valueText !== "") return answer.valueText;
  if (answer.valueJson != null) return stringifyUnknown(answer.valueJson);
  return "";
}

const SARA_EINSAETZE_COLUMN_SPEC = `
Zielobjekt		14.09765625
Kundennummer		15.3984375
Besuchsdatum		12.09765625
Besuchsstartzeit		8.796875
Einsatz	Verplanung	16.5
	Interne ID	9.8984375
	Externe ID	14.296875
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

type SaraAnswerColumnKind = "value" | "comment" | "number" | "availability";
type SaraAvailabilityBucket = "top" | "middle" | "bad";
type SaraQuestionColumn = {
  index: number;
  question: string;
  kind: SaraAnswerColumnKind;
  availabilityBucket?: SaraAvailabilityBucket;
};

type SaraCellValue = string | number | boolean;

export type FbManagementExportVisitRow = {
  sessionId: string;
  startedAt: string;
  gmUserId: string | null;
  cells: SaraCellValue[];
};

const SARA_BASE_COLUMN_COUNT = 22;

function getSaraEinsaetzeColumns(): SaraEinsaetzeColumn[] {
  return SARA_EINSAETZE_COLUMN_SPEC.split("\n").map((line) => {
    const [h1 = "", h2 = "", width = "18"] = line.split("\t");
    return { h1, h2, width: Number(width) || 18 };
  });
}

function normalizeSaraQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSaraQuestionColumns(columns: SaraEinsaetzeColumn[]): Map<string, SaraQuestionColumn[]> {
  const map = new Map<string, SaraQuestionColumn[]>();
  let currentQuestion = "";
  columns.forEach((column, index) => {
    if (index < SARA_BASE_COLUMN_COUNT) return;
    if (column.h1.trim()) currentQuestion = column.h1;
    if (!currentQuestion) return;

    let kind: SaraAnswerColumnKind | null = null;
    let availabilityBucket: SaraAvailabilityBucket | undefined;
    if (column.h2 === "Kommentar") kind = "comment";
    if (column.h2 === "Wert") kind = "value";
    if (column.h2 === "Zahl") kind = "number";
    if (column.h2.startsWith("(1)")) {
      kind = "availability";
      availabilityBucket = "top";
    }
    if (column.h2.startsWith("(3)")) {
      kind = "availability";
      availabilityBucket = "middle";
    }
    if (column.h2.startsWith("(5)")) {
      kind = "availability";
      availabilityBucket = "bad";
    }
    if (!kind) return;

    const key = normalizeSaraQuestion(currentQuestion);
    const bucket = map.get(key) ?? [];
    bucket.push({ index, question: currentQuestion, kind, availabilityBucket });
    map.set(key, bucket);
  });
  return map;
}

function getSaraAliasQuestionNeedle(questionText: string): string | null {
  const key = normalizeSaraQuestion(questionText);
  const aliasByNeedle: Array<{ match: (value: string) => boolean; targetNeedle: string }> = [
    {
      match: (value) => value.includes("red survey ausgefullt"),
      targetNeedle: "red survey ausgefullt",
    },
    {
      match: (value) => value.includes("markeneigener kuhler vorhanden"),
      targetNeedle: "markeneigener kuhler vorhanden",
    },
    {
      match: (value) => value.includes("grossplatzierung") && value.includes("mitbewerb"),
      targetNeedle: "grossplatzierung bzw aufbauten vom mitbewerb",
    },
    {
      match: (value) => value.includes("cr cz 200ml can"),
      targetNeedle: "cr cz 200ml can im markt",
    },
    {
      match: (value) => value.includes("cr cz f") && value.includes("pack") && value.includes("can"),
      targetNeedle: "cr cz f 4 pack 0 33l can",
    },
    {
      match: (value) => value.includes("coke zero zero") && value.includes("can"),
      targetNeedle: "coke zero zero 0 33l can",
    },
    {
      match: (value) => value.includes("jack") && value.includes("coke") && value.includes("can"),
      targetNeedle: "jack und coke 330ml can",
    },
    {
      match: (value) => value.includes("bacardi") && value.includes("coca cola") && value.includes("can"),
      targetNeedle: "bacardi coca cola 0 25l can",
    },
    {
      match: (value) => value.includes("monster schutte") && value.includes("crowner") && value.includes("richtiger zone"),
      targetNeedle: "monster schutte 0 5l mit crowner in richtiger zone",
    },
    {
      match: (value) => value.includes("monster schutte") && value.includes("crowner") && value.includes("sonstiger zone"),
      targetNeedle: "monster schutte 0 5l mit crowner in sonstiger zone",
    },
    {
      match: (value) => value.includes("monster display") && value.includes("header") && value.includes("richtiger zone"),
      targetNeedle: "monster display 0 5l mit header in richtiger zone",
    },
    {
      match: (value) => value.includes("monster display") && value.includes("header") && value.includes("sonstiger zone"),
      targetNeedle: "monster display 0 5l mit header in sonstiger zone",
    },
    {
      match: (value) => value.includes("konnte eine grossplatzierung platziert werden"),
      targetNeedle: "konnte eine grossplatzierung platziert werden",
    },
    {
      match: (value) => value.startsWith("anzahl flexziel"),
      targetNeedle: "anzahl flexziel",
    },
  ];
  return aliasByNeedle.find((entry) => entry.match(key))?.targetNeedle ?? null;
}

function resolveSaraQuestionColumns(
  question: VisitDetailQuestion,
  questionColumns: Map<string, SaraQuestionColumn[]>,
): SaraQuestionColumn[] {
  const key = normalizeSaraQuestion(question.text);
  const exact = questionColumns.get(key);
  if (exact) return exact;

  const aliasNeedle = getSaraAliasQuestionNeedle(question.text);
  if (aliasNeedle) {
    const aliasColumns = Array.from(questionColumns.entries()).find(([entryKey]) => entryKey.includes(aliasNeedle))?.[1];
    if (aliasColumns) return aliasColumns;
  }

  if (question.singleChoiceAvailability && question.singleChoiceAvailabilityType) {
    const availabilityNeedle: Record<string, string> = {
      Cooler: "verfugbarkeit im kuhler",
      SingleServe: "verfugbarkeit bei den singleserve",
      MultiServe: "verfugbarkeit bei den multiserve",
      Promos: "verfugbarkeit bei den promos",
      Warehouse: "verfugbarkeit im lager",
    };
    const needle = availabilityNeedle[question.singleChoiceAvailabilityType];
    if (needle) {
      const match = Array.from(questionColumns.entries()).find(([entryKey]) => entryKey.includes(needle));
      if (match) return match[1];
    }
  }

  if (key.length < 18) return [];
  const fuzzy = Array.from(questionColumns.entries()).find(([entryKey]) =>
    entryKey.includes(key) || key.includes(entryKey),
  );
  return fuzzy?.[1] ?? [];
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
  if (answer.valueText != null && answer.valueText !== "") return answer.valueText;
  const raw = (answer.valueJson as { raw?: unknown } | null | undefined)?.raw;
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "string") return raw;
  if (raw != null) return stringifyUnknown(raw);
  if (answer.valueJson != null) return stringifyUnknown(answer.valueJson);
  if (answer.photos.length > 0) return `${answer.photos.length} Foto${answer.photos.length === 1 ? "" : "s"}`;
  return "";
}

function saraAnswerValue(question: VisitDetailQuestion): string {
  const raw = saraAnswerRawValue(question);
  return raw || "Keine Antwort";
}

function saraAvailabilityBucket(question: VisitDetailQuestion): SaraAvailabilityBucket | null {
  const raw = normalizeSaraQuestion(saraAnswerRawValue(question));
  if (!raw) return null;
  if (/\b(top|voll|1)\b/.test(raw)) return "top";
  if (raw.includes("mittel") || raw.includes("mediocre") || raw.includes("mitte") || /\b3\b/.test(raw)) return "middle";
  if (raw.includes("bad") || raw.includes("schlecht") || raw.includes("leer") || raw.includes("oos") || /\b5\b/.test(raw)) return "bad";
  return null;
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

function saraInternalId(market: CampaignExportMarket | null | undefined): string {
  return market?.stammnr ?? "";
}

function saraExternalId(market: CampaignExportMarket | null | undefined): string {
  return market?.stammnr ?? "";
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

let saraExportLayoutCache: {
  columns: SaraEinsaetzeColumn[];
  questionColumns: Map<string, SaraQuestionColumn[]>;
} | null = null;

function getSaraExportLayout() {
  if (saraExportLayoutCache) return saraExportLayoutCache;
  const columns = getSaraEinsaetzeColumns();
  saraExportLayoutCache = {
    columns,
    questionColumns: getSaraQuestionColumns(columns),
  };
  return saraExportLayoutCache;
}

export function prepareFbManagementExportVisitRow(input: {
  visit: CampaignMarketVisitSummary;
  market: CampaignExportMarket | null;
  campaignName?: string | null;
}): FbManagementExportVisitRow | null {
  const { visit } = input;
  if (!visit.hasSubmittedVisit || !visit.sessionId || !visit.startedAt) return null;

  const primarySection = visit.sections[0] ?? null;
  const { columns, questionColumns } = getSaraExportLayout();
  const row: SaraCellValue[] = Array.from({ length: columns.length }, () => "");
  const photoCount = visit.sections.reduce(
    (total, section) =>
      total + section.questions.reduce((sectionTotal, question) => sectionTotal + (question.answer?.photos.length ?? 0), 0),
    0,
  );

  row[0] = saraTargetObject(input.market);
  row[1] = saraExternalId(input.market);
  row[2] = formatSaraDateTime(visit.startedAt, "date");
  row[3] = formatSaraDateTime(visit.startedAt, "time");
  row[4] = input.campaignName ?? primarySection?.fragebogenName ?? "";
  row[5] = saraInternalId(input.market);
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
      const mappedColumns = resolveSaraQuestionColumns(question, questionColumns);
      if (mappedColumns.length === 0) continue;
      const value = saraAnswerValue(question);
      const numericValue = saraNumberFromString(question.answer?.valueNumber ?? saraAnswerRawValue(question));
      const availabilityBucket = saraAvailabilityBucket(question);
      for (const column of mappedColumns) {
        if (column.kind === "value") appendSaraCellValue(row, column.index, value);
        if (column.kind === "comment") appendSaraCellValue(row, column.index, question.comment ?? "");
        if (column.kind === "number") appendSaraCellValue(row, column.index, numericValue);
        if (column.kind === "availability") {
          if (!availabilityBucket && column.availabilityBucket === "top") {
            appendSaraCellValue(row, column.index, "Keine Antwort");
          } else {
            appendSaraCellValue(row, column.index, availabilityBucket === column.availabilityBucket ? "X" : "");
          }
        }
      }
    }
  }

  return {
    sessionId: visit.sessionId,
    startedAt: visit.startedAt,
    gmUserId: visit.gmUserId,
    cells: row,
  };
}

function appendSaraEinsaetzeSheet(
  XLSX: typeof import("xlsx-js-style"),
  wb: ReturnType<(typeof import("xlsx-js-style"))["utils"]["book_new"]>,
  rows: SaraCellValue[][],
) {
  const columns = getSaraEinsaetzeColumns();
  const sheetRows: SaraCellValue[][] = [
    columns.map((column) => column.h1),
    columns.map((column) => column.h2),
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = columns.map((column) => ({ wch: column.width }));
  XLSX.utils.book_append_sheet(wb, ws, "Einsätze");
}

export async function exportFbManagementExcel(input: {
  campaigns: Campaign[];
  markets: CampaignExportMarket[];
  visitStatusByCampaignId: Record<string, Record<string, CampaignExportStatus>>;
  visitDetails?: CampaignMarketVisitSummary[];
  preparedVisitRows?: FbManagementExportVisitRow[];
  visitDetailErrors?: CampaignVisitDetailExportError[];
  fragebogenByScope?: Record<string, Fragebogen[]>;
  modulesByScope?: Record<string, Module[]>;
  travelByVisitSessionId?: Record<string, { start: string; end: string; durationMin: number }>;
  exportedBy?: string;
}) {
  const filename = `CokeSpark_FB_Management_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`;
  if (input.preparedVisitRows) {
    const saraRows = input.preparedVisitRows
      .slice()
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((prepared) => {
        const row = prepared.cells.slice();
        const travel = input.travelByVisitSessionId?.[prepared.sessionId];
        row[9] = travel?.start ?? "";
        row[10] = travel?.end ?? "";
        row[11] = travel?.durationMin ?? "";
        return row;
      });
    await buildAndDownloadWorkbook({
      filename,
      build: ({ XLSX, wb }) => {
        appendSaraEinsaetzeSheet(XLSX, wb, saraRows);
      },
    });
    return;
  }

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
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
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
  const saraColumns = getSaraEinsaetzeColumns();
  const saraQuestionColumns = getSaraQuestionColumns(saraColumns);
  const saraRows: SaraCellValue[][] = (input.visitDetails ?? [])
    .filter((visit) => visit.hasSubmittedVisit && visit.sessionId)
    .slice()
    .sort((a, b) => String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? "")))
    .map((visit) => {
      const primarySection = visit.sections[0] ?? null;
      const campaign = primarySection ? campaignById.get(primarySection.campaignId) ?? null : null;
      const market = marketById.get(visit.marketId) ?? null;
      const row: SaraCellValue[] = Array.from({ length: saraColumns.length }, () => "");
      const photoCount = visit.sections.reduce(
        (total, section) =>
          total + section.questions.reduce((sectionTotal, question) => sectionTotal + (question.answer?.photos.length ?? 0), 0),
        0,
      );

      row[0] = saraTargetObject(market);
      row[1] = saraExternalId(market);
      row[2] = formatSaraDateTime(visit.startedAt, "date");
      row[3] = formatSaraDateTime(visit.startedAt, "time");
      row[4] = campaign?.name ?? primarySection?.fragebogenName ?? "";
      row[5] = saraInternalId(market);
      row[6] = saraExternalId(market);
      row[7] = visit.gmName ?? "";
      row[8] = photoCount;
      const travel = visit.sessionId ? input.travelByVisitSessionId?.[visit.sessionId] : null;
      row[9] = travel?.start ?? "";
      row[10] = travel?.end ?? "";
      row[11] = travel?.durationMin ?? "";
      row[13] = formatSaraDateTime(visit.startedAt, "time");
      row[14] = formatSaraDateTime(visit.submittedAt, "time");
      row[15] = visit.durationMinutes ?? "";
      row[17] = primarySection ? sectionLabel(primarySection.section) : "";
      row[18] = 0;
      row[20] = false;

      for (const section of visit.sections) {
        for (const question of section.questions) {
          const columns = resolveSaraQuestionColumns(question, saraQuestionColumns);
          if (columns.length === 0) continue;
          const value = saraAnswerValue(question);
          const numericValue = saraNumberFromString(question.answer?.valueNumber ?? saraAnswerRawValue(question));
          const availabilityBucket = saraAvailabilityBucket(question);
          for (const column of columns) {
            if (column.kind === "value") appendSaraCellValue(row, column.index, value);
            if (column.kind === "comment") appendSaraCellValue(row, column.index, question.comment ?? "");
            if (column.kind === "number") appendSaraCellValue(row, column.index, numericValue);
            if (column.kind === "availability") {
              if (!availabilityBucket && column.availabilityBucket === "top") {
                appendSaraCellValue(row, column.index, "Keine Antwort");
              } else {
                appendSaraCellValue(row, column.index, availabilityBucket === column.availabilityBucket ? "X" : "");
              }
            }
          }
        }
      }

      return row;
    });

  await buildAndDownloadWorkbook({
    filename,
    build: ({ XLSX, wb }) => {
      appendSaraEinsaetzeSheet(XLSX, wb, saraRows);
    },
  });
  return;

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
