import type { SmModule, SmQuestion, SmQuestionnaire, SmQuestionType } from "@/types/smQuestionnaire";
import {
  appendMetaSheet,
  appendTableSheet,
  buildAndDownloadWorkbook,
  countBy,
  fileSafeName,
  formatExportDateTime,
  yesNo,
} from "@/lib/exports/workbook";

type XlsxModule = typeof import("xlsx-js-style");
type SmQuestionRow = { module: SmModule; question: SmQuestion; questionIndex: number };

export type SmQuestionnaireExportInput = {
  modules: SmModule[];
  questionnaires: SmQuestionnaire[];
  exportedBy?: string;
};

const TYPE_LABELS: Record<SmQuestionType, string> = {
  single: "Single Choice",
  yesno: "Ja / Nein",
  yesnomulti: "Ja / Nein Multi",
  multiple: "Multiple Choice",
  likert: "Likert Skala",
  text: "Offener Text",
  numeric: "Offene Zahl",
  slider: "Slider",
  photo: "Foto Upload",
  matrix: "Matrix",
};

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
}

function configuredOptions(question: SmQuestion): string[] {
  if (question.type === "yesno") return ["Ja", "Nein"];
  if (question.type === "yesnomulti") {
    const answers = stringList(question.config.answers);
    return answers.length > 0 ? answers : question.options;
  }
  if (question.type === "single" || question.type === "multiple") {
    const options = stringList(question.config.options);
    return options.length > 0 ? options : question.options;
  }
  if (question.type === "likert") {
    const min = Number(question.config.min ?? 1);
    const max = Number(question.config.max ?? 5);
    return Number.isFinite(min) && Number.isFinite(max) ? [`${min}–${max}`] : [];
  }
  return question.options;
}

function branchSummary(question: SmQuestion): string {
  if (!Array.isArray(question.config.branches)) return "";
  return question.config.branches
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const branch = entry as Record<string, unknown>;
      const answer = typeof branch.answer === "string" ? branch.answer.trim() : "";
      const options = stringList(branch.options);
      return answer && options.length > 0 ? [`${answer}: ${options.join(" | ")}`] : [];
    })
    .join("; ");
}

function matrixSummary(question: SmQuestion): string {
  if (question.type !== "matrix") return "";
  const rows = stringList(question.config.rows);
  const columns = stringList(question.config.columns);
  return `Zeilen: ${rows.join(" | ")}; Spalten: ${columns.join(" | ")}`;
}

function oosOutcomeSummary(question: SmQuestion): string {
  return Object.entries(question.oos?.answerOutcomes ?? {})
    .map(([answer, outcome]) => `${answer}: ${outcome}`)
    .join("; ");
}

function ruleValue(rule: SmQuestion["rules"][number]): string {
  if (rule.operator === "between") return `${rule.triggerValue}–${rule.triggerValueMax}`;
  return rule.triggerValue;
}

function buildSheets(input: SmQuestionnaireExportInput, XLSX: XlsxModule, workbook: ReturnType<XlsxModule["utils"]["book_new"]>) {
  const questionRows: SmQuestionRow[] = input.modules.flatMap((module) =>
    module.questions.map((question, questionIndex) => ({ module, question, questionIndex })),
  );
  const questionnaireModuleRows = input.questionnaires.flatMap((questionnaire) =>
    questionnaire.moduleIds.map((moduleId, moduleIndex) => ({
      questionnaire,
      moduleId,
      moduleIndex,
      module: input.modules.find((candidate) => candidate.id === moduleId) ?? null,
    })),
  );
  const logicRows = questionRows.flatMap((row) =>
    row.question.rules.map((rule, ruleIndex) => ({ ...row, rule, ruleIndex })),
  );
  const oosRows = questionRows.filter((row) => row.question.oos?.enabled);

  appendMetaSheet(XLSX, workbook, [
    { label: "Export", value: "SM Fragebogen" },
    { label: "Erstellt am", value: formatExportDateTime() },
    { label: "Erstellt von", value: input.exportedBy ?? "" },
    { label: "Fragebogen", value: input.questionnaires.length },
    { label: "Module", value: input.modules.length },
    { label: "Fragen", value: questionRows.length },
    { label: "Logikregeln", value: logicRows.length },
    { label: "OOS-Zuordnungen", value: oosRows.length },
    { label: "Hinweis", value: "Aktueller SM-Autorenkatalog mit Fragebogen-Komposition, SM-Fragetypen, Logik und OOS-Metadaten." },
  ]);

  appendTableSheet(XLSX, workbook, {
    name: "Fragen",
    title: "SM Fragen",
    description: "Atomare Fragen des aktuellen SM-Modulkatalogs inklusive Konfiguration, Antwortoptionen und Auswertungsmetadaten.",
    rows: questionRows,
    columns: [
      { header: "Modul ID", width: 38, value: (row) => row.module.id },
      { header: "Modul", width: 30, value: (row) => row.module.name },
      { header: "Reihenfolge", width: 11, value: (row) => row.questionIndex + 1, align: "right" },
      { header: "Frage ID", width: 38, value: (row) => row.question.id },
      { header: "Typ", width: 20, value: (row) => TYPE_LABELS[row.question.type] },
      { header: "Pflicht", width: 10, value: (row) => yesNo(row.question.required), align: "center" },
      { header: "Frage", width: 60, value: (row) => row.question.text },
      { header: "Antwortoptionen", width: 48, value: (row) => configuredOptions(row.question).join(" | ") },
      { header: "Unterauswahl", width: 52, value: (row) => branchSummary(row.question) },
      { header: "Matrix", width: 52, value: (row) => matrixSummary(row.question) },
      { header: "Logikregeln", width: 12, value: (row) => row.question.rules.length, align: "right" },
      { header: "OOS aktiv", width: 11, value: (row) => yesNo(Boolean(row.question.oos?.enabled)), align: "center" },
      { header: "OOS Rolle", width: 18, value: (row) => row.question.oos?.role ?? "" },
      { header: "OOS Kategorie", width: 24, value: (row) => row.question.oos?.category ?? "" },
      { header: "OOS Erkennungsfrage", width: 38, value: (row) => row.question.oos?.detectionQuestionId ?? "" },
      { header: "OOS Antworten", width: 58, value: (row) => oosOutcomeSummary(row.question) },
      { header: "Config JSON", width: 58, value: (row) => JSON.stringify(row.question.config ?? {}) },
    ],
  });

  appendTableSheet(XLSX, workbook, {
    name: "Module",
    title: "SM Module",
    description: "Wiederverwendbare SM-Fragegruppen im aktuellen veröffentlichten Autorenstand.",
    rows: input.modules,
    columns: [
      { header: "Modul ID", width: 38, value: (row) => row.id },
      { header: "Name", width: 32, value: (row) => row.name },
      { header: "Beschreibung", width: 52, value: (row) => row.description },
      { header: "Fragen", width: 11, value: (row) => row.questions.length, align: "right" },
      { header: "In Fragebogen", width: 14, value: (row) => input.questionnaires.filter((questionnaire) => questionnaire.moduleIds.includes(row.id)).length, align: "right" },
      { header: "Erstellt", width: 25, value: (row) => row.createdAt },
    ],
  });

  appendTableSheet(XLSX, workbook, {
    name: "Fragebogen",
    title: "SM Fragebogen",
    description: "Aktuelle SM-Fragebogen mit Status, Version und Modulanzahl.",
    rows: input.questionnaires,
    columns: [
      { header: "Fragebogen ID", width: 38, value: (row) => row.id },
      { header: "Name", width: 34, value: (row) => row.name },
      { header: "Beschreibung", width: 52, value: (row) => row.description },
      { header: "Status", width: 12, value: (row) => row.status === "active" ? "Aktiv" : "Inaktiv" },
      { header: "Version", width: 11, value: (row) => row.version, align: "right" },
      { header: "Module", width: 11, value: (row) => row.moduleIds.length, align: "right" },
      { header: "Fragen", width: 11, value: (row) => row.moduleIds.reduce((sum, id) => sum + (input.modules.find((module) => module.id === id)?.questions.length ?? 0), 0), align: "right" },
      { header: "Nur einmal", width: 12, value: (row) => yesNo(row.nurEinmalAusfuellbar), align: "center" },
      { header: "Erstellt", width: 25, value: (row) => row.createdAt },
    ],
  });

  appendTableSheet(XLSX, workbook, {
    name: "Fragebogen Module",
    title: "SM Fragebogen Module",
    description: "Exakte Modulreihenfolge je SM-Fragebogen.",
    rows: questionnaireModuleRows,
    columns: [
      { header: "Fragebogen ID", width: 38, value: (row) => row.questionnaire.id },
      { header: "Fragebogen", width: 34, value: (row) => row.questionnaire.name },
      { header: "Fragebogen Version", width: 18, value: (row) => row.questionnaire.version, align: "right" },
      { header: "Reihenfolge", width: 11, value: (row) => row.moduleIndex + 1, align: "right" },
      { header: "Modul ID", width: 38, value: (row) => row.moduleId },
      { header: "Modul", width: 32, value: (row) => row.module?.name ?? "Fehlende Modulreferenz" },
      { header: "Fragen", width: 11, value: (row) => row.module?.questions.length ?? "", align: "right" },
    ],
  });

  appendTableSheet(XLSX, workbook, {
    name: "Logikregeln",
    title: "SM Bedingte Logik",
    description: "Show/Hide-Regeln und ihre Ziel-Fragen in der gespeicherten SM-Konfiguration.",
    rows: logicRows,
    columns: [
      { header: "Modul", width: 30, value: (row) => row.module.name },
      { header: "Regel ID", width: 38, value: (row) => row.rule.id },
      { header: "Reihenfolge", width: 11, value: (row) => row.ruleIndex + 1, align: "right" },
      { header: "Besitzer-Frage ID", width: 38, value: (row) => row.question.id },
      { header: "Auslöser-Frage ID", width: 38, value: (row) => row.rule.triggerQuestionId },
      { header: "Operator", width: 18, value: (row) => row.rule.operator },
      { header: "Wert", width: 30, value: (row) => ruleValue(row.rule) },
      { header: "Aktion", width: 12, value: (row) => row.rule.action },
      { header: "Ziel-Fragen", width: 64, value: (row) => row.rule.targetQuestionIds.join(", ") },
    ],
  });

  appendTableSheet(XLSX, workbook, {
    name: "OOS Zuordnung",
    title: "SM OOS-Zuordnung",
    description: "Erkennungs- und Behebungsfragen für die SM-Dashboard-Auswertung.",
    rows: oosRows,
    columns: [
      { header: "Modul", width: 30, value: (row) => row.module.name },
      { header: "Frage ID", width: 38, value: (row) => row.question.id },
      { header: "Frage", width: 58, value: (row) => row.question.text },
      { header: "Rolle", width: 18, value: (row) => row.question.oos?.role ?? "" },
      { header: "Kategorie", width: 24, value: (row) => row.question.oos?.category ?? "" },
      { header: "Erkennungsfrage ID", width: 38, value: (row) => row.question.oos?.detectionQuestionId ?? "" },
      { header: "Teilweise gilt als behoben", width: 22, value: (row) => yesNo(row.question.oos?.partialCountsAsResolved), align: "center" },
      { header: "Antwortauswertung", width: 62, value: (row) => oosOutcomeSummary(row.question) },
    ],
  });

  const summaryRows = [
    ...countBy(questionRows, (row) => TYPE_LABELS[row.question.type]).map((row) => ({ gruppe: "Fragetyp", merkmal: row.key, anzahl: row.count })),
    ...countBy(questionRows, (row) => row.question.required ? "Pflicht" : "Optional").map((row) => ({ gruppe: "Pflichtstatus", merkmal: row.key, anzahl: row.count })),
    ...countBy(input.questionnaires, (row) => row.status === "active" ? "Aktiv" : "Inaktiv").map((row) => ({ gruppe: "Fragebogen Status", merkmal: row.key, anzahl: row.count })),
    ...countBy(oosRows, (row) => row.question.oos?.category).map((row) => ({ gruppe: "OOS Kategorie", merkmal: row.key, anzahl: row.count })),
  ];
  appendTableSheet(XLSX, workbook, {
    name: "Summen",
    title: "SM Fragebogen Summen",
    description: "Kontrollsummen für den exportierten SM-Autorenkatalog.",
    rows: summaryRows,
    columns: [
      { header: "Gruppe", width: 20, value: (row) => row.gruppe },
      { header: "Merkmal", width: 34, value: (row) => row.merkmal },
      { header: "Anzahl", width: 12, value: (row) => row.anzahl, align: "right" },
    ],
  });
}

export function buildSmQuestionnaireWorkbook(input: SmQuestionnaireExportInput, XLSX: XlsxModule) {
  const workbook = XLSX.utils.book_new();
  buildSheets(input, XLSX, workbook);
  workbook.Workbook = { Views: [{ RTL: false }] };
  return workbook;
}

export async function exportSmQuestionnaireExcel(input: SmQuestionnaireExportInput): Promise<void> {
  await buildAndDownloadWorkbook({
    filename: `CokeSpark_SM_Fragebogen_${fileSafeName(new Date().toISOString().slice(0, 10))}.xlsx`,
    build: ({ XLSX, wb }) => buildSheets(input, XLSX, wb),
  });
}
