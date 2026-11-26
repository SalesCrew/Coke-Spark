import type { SMDurcharbeitPlanningReport } from "@/types/smSMDurcharbeitExport";
import { appendSaraEinsaetzeSheet, buildPreparedFbManagementExportRows, type FbManagementExportQuestion, type FbManagementExportVisitRow } from "./planningExports";
import { smReportAnswerCell, smReportLatestQuestion, smReportQuestionColumnKey } from "./smReportQuestionColumns";
import { buildAndDownloadWorkbook } from "./workbook";

type XLSX = typeof import("xlsx-js-style");
const datePart = (value: string | null, part: "date" | "time") => !value ? "" : new Intl.DateTimeFormat("de-AT", {
  timeZone: "Europe/Vienna", ...(part === "date" ? { day: "2-digit", month: "2-digit", year: "numeric" } : { hour: "2-digit", minute: "2-digit", hour12: false }),
}).format(new Date(value));

/** The exact GM Einsätze writer and two header rows, populated with frozen SM data. */
export function buildSMDurcharbeitPlanningWorkbook(XLSX: XLSX, wb: ReturnType<XLSX["utils"]["book_new"]>, report: SMDurcharbeitPlanningReport) {
  if (report.visits.length !== report.summary.visits) throw new Error("Der Export ist unvollständig. Bitte erneut laden.");
  const bySubmission = new Map<string, Map<string, typeof report.answers>>();
  const definitions = new Map<string, typeof report.answers[number]["question"]>();
  const visitIds = new Set(report.visits.map(visit => visit.id));
  const seen = new Set<string>();
  const photoCounts = new Map<string, number>();
  for (const row of report.answers) {
    if (!visitIds.has(row.question.submissionId) || seen.has(row.question.id)) throw new Error("Die Antwortzuordnung ist unvollständig. Bitte erneut laden.");
    seen.add(row.question.id);
    photoCounts.set(row.question.submissionId, (photoCounts.get(row.question.submissionId) ?? 0) + row.photos.length);
    const key = smReportQuestionColumnKey(row, true), group = bySubmission.get(row.question.submissionId) ?? new Map();
    group.set(key, [...(group.get(key) ?? []), row]); bySubmission.set(row.question.submissionId, group);
    definitions.set(key, smReportLatestQuestion(definitions.get(key), row.question));
  }
  const orderedVisits = [...report.visits].sort((a, b) => (a.startedAt ?? a.submittedAt ?? a.workDate).localeCompare(b.startedAt ?? b.submittedAt ?? b.workDate));
  const questionOrder = new Set(orderedVisits.flatMap(visit => [...bySubmission.get(visit.id)?.keys() ?? []]));
  const questions: FbManagementExportQuestion[] = [...questionOrder].map(key => ({ key, question: definitions.get(key)!.questionTextSnapshot,
    kind: ["numeric", "slider"].includes(definitions.get(key)!.questionTypeSnapshot) ? "number" : "value" }));
  if (22 + questions.length * 2 > 16384 || report.visits.length * (22 + questions.length * 2) > 2_000_000) throw new Error("Die Excel-Datei ist zu groß. Bitte grenze die Auswahl weiter ein.");
  const questionKinds = new Map(questions.map(question => [question.key, question.kind]));
  const metadata = new Map(report.visitMetadata.map(row => [row.submissionId, row.market]));
  const prepared: FbManagementExportVisitRow[] = orderedVisits.map(visit => {
    const market = metadata.get(visit.id);
    if (!market || !visit.SMDurcharbeitContext) throw new Error("Die Durcharbeit-Zuordnung fehlt. Bitte erneut laden.");
    const cells: FbManagementExportVisitRow["cells"] = Array.from({ length: 22 }, () => "");
    cells[0] = [market.chain, [visit.marketName, visit.address, visit.city].filter(Boolean).join(", "), market.region ? `Re. ${market.region}` : ""].filter(Boolean).join("; ");
    cells[1] = market.internalId ?? "";
    cells[2] = datePart(visit.startedAt ?? visit.submittedAt, "date"); cells[3] = datePart(visit.startedAt ?? visit.submittedAt, "time");
    cells[4] = visit.SMDurcharbeitContext.campaignName; cells[5] = market.internalId ?? ""; cells[7] = visit.smName;
    cells[8] = photoCounts.get(visit.id) ?? 0;
    cells[13] = datePart(visit.startedAt, "time"); cells[14] = datePart(visit.completedAt, "time");
    cells[15] = visit.actualMinutes ?? ""; cells[17] = "Durcharbeit"; cells[20] = false;
    return { campaignId: visit.SMDurcharbeitContext.campaignId, sessionId: visit.id, startedAt: visit.startedAt ?? visit.submittedAt ?? visit.workDate,
      gmUserId: visit.smUserId, sectionTypes: ["durcharbeit"], cells,
      dynamicAnswers: [...bySubmission.get(visit.id) ?? []].map(([key, rows]) => {
        const cell = smReportAnswerCell(rows), question = definitions.get(key)!;
        return { key, question: question.questionTextSnapshot, kind: questionKinds.get(key)!, value: cell.value, comment: cell.comment };
      }) };
  });
  const result = buildPreparedFbManagementExportRows(prepared, undefined, questions);
  // SM records have travel durations, but no recorded departure/arrival clock pair.
  for (const [index, visit] of orderedVisits.entries()) {
    result.rows[index]![11] = visit.travelMinutes ?? "";
  }
  if (result.columns.length > 16384 || result.rows.length * result.columns.length > 2_000_000) throw new Error("Die Excel-Datei ist zu groß. Bitte grenze die Auswahl weiter ein.");
  appendSaraEinsaetzeSheet(XLSX, wb, result.rows, result.columns);
}

export async function exportSMDurcharbeitPlanningReport(report: SMDurcharbeitPlanningReport, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  await buildAndDownloadWorkbook({ filename: `CokeSpark_SM_Durcharbeit_${new Date().toISOString().slice(0, 10)}.xlsx`,
    build: ({ XLSX, wb }) => { if (!isCurrent()) throw new Error("Die Exportauswahl wurde gewechselt."); buildSMDurcharbeitPlanningWorkbook(XLSX, wb, report); } });
}
