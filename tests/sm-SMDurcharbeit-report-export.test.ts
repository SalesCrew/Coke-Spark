import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";
import { buildSMDurcharbeitReportWorkbook } from "../src/lib/exports/smSMDurcharbeitReportExport";
import type { SMDurcharbeitReport, SMDurcharbeitTarget } from "../src/types/smSMDurcharbeitCampaign";

test("serialized monthly workbook reconciles market coverage, latest answers and physical time without formula injection", () => {
  const target = (index: number): SMDurcharbeitTarget => ({ id: `target-${index}`, revision: 1, campaignId: "campaign", campaignName: "Synthetic", campaignStatus: "published", startDate: "2026-10-01", endDate: "2026-12-31", month: "2026-10-01", market: { id: `market-${index}`, internalId: String(index), name: index ? "Synthetic" : '=HYPERLINK("unsafe")', chain: "Spar", address: "Synthetic", postalCode: "1010", city: "Wien", region: "Ost" }, smUserId: "sm", smName: "Synthetic SM", eligibility: "required", waiverReason: null, completed: index < 2, available: true, draftVisitId: null, latestVisitId: index < 2 ? `visit-${index}` : null, latestSubmissionId: index < 2 ? `submission-${index}` : null, latestVisitSmUserId: index < 2 ? "sm" : null, completedAt: index < 2 ? "2026-10-09T12:00:00Z" : null, visitCount: index === 0 ? 2 : index === 1 ? 1 : 0 });
  const report: SMDurcharbeitReport = { month: "2026-10-01", targets: [target(0), target(1), target(2)],
    summary: { required: 3, completed: 2, waived: 0, coveragePercentage: 200 / 3, latestSubmissions: 2, physicalVisits: 3, validQuestionnaireVisits: 3, actualMinutes: 30, travelMinutes: 5, availablePhotoUploads: 1 },
    questionResults: [{ questionVersionId: "version", questionCode: "code", text: "Synthetic yes/no", type: "yesno", applicable: 2, answered: 2, unanswered: 0, average: null, distribution: [{ code: "yes", label: "Ja", count: 1, percentage: 50 }, { code: "no", label: "Nein", count: 1, percentage: 50 }] }],
    answers: [0, 1].map(index => ({ targetId: `target-${index}`, smName: "Synthetic SM", sourceSubmissionId: index ? null : "original-submission", sourceAnswerId: index ? null : "original-answer",
      question: { id: `question-${index}`, submissionId: `submission-${index}`, questionVersionId: "version", questionCodeSnapshot: "code", questionTypeSnapshot: "yesno", questionTextSnapshot: "Synthetic yes/no", answerOptionsSnapshot: [{ code: "yes", label: "Ja" }, { code: "no", label: "Nein" }] },
      answer: { id: `answer-${index}`, answerState: "answered", answerVersion: 1, valueJson: { kind: "choice", optionCode: index ? "yes" : "no" }, answeredAt: "2026-10-09T12:00:00Z" } })),
    physicalVisits: [0, 1, 2].map(index => ({ id: `visit-${index}`, targetId: `target-${index === 2 ? 0 : index}`, submissionId: `submission-${index}`, smUserId: "sm", smName: "Synthetic SM", marketName: "Synthetic",
      questionnaireValid: true, submittedAt: "2026-10-09T12:00:00Z", originalStartedAt: "2026-10-09T08:00:00Z", originalCompletedAt: "2026-10-09T08:10:00Z", startedAt: "2026-10-09T08:00:00Z", completedAt: "2026-10-09T08:10:00Z", actualMinutes: 10, travelMinutes: index ? 0 : 5, timeRevision: 1 })),
  };
  const before = JSON.stringify(report), wb = XLSX.utils.book_new();
  buildSMDurcharbeitReportWorkbook(XLSX, wb, report, "Synthetic campaign");
  const saved = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true }), { type: "buffer", cellFormula: true });
  assert.deepEqual(saved.SheetNames, ["Meta", "Monatsmärkte", "Fragen", "Antwortverteilung", "Letzte Antworten", "Tatsächliche Besuche"]);
  const table = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(saved.Sheets[name]!, { header: 1, range: 4 });
  const meta = XLSX.utils.sheet_to_json<unknown[]>(saved.Sheets.Meta!, { header: 1 });
  const metaValue = (label: string) => meta.find(row => row[0] === label)?.[1];
  assert.equal(metaValue("Erforderliche Märkte"), 3); assert.equal(metaValue("Erledigte Märkte"), 2);
  assert.equal(metaValue("Abdeckung (%)"), 200 / 3); assert.equal(metaValue("Tatsächliche Besuche"), 3);
  assert.deepEqual(table("Antwortverteilung").map(row => row.slice(3, 7)), [["Ja", 1, 2, 50], ["Nein", 1, 2, 50]]);
  assert.equal(table("Letzte Antworten").length, 2); assert.equal(table("Tatsächliche Besuche").length, 3);
  assert.equal(table("Tatsächliche Besuche").reduce((sum, row) => sum + Number(row[11]), 0), metaValue("Istzeit (Minuten)"));
  assert.equal(table("Tatsächliche Besuche").reduce((sum, row) => sum + Number(row[12]), 0), metaValue("Fahrtzeit (Minuten)"));
  assert.equal(saved.Sheets.Monatsmärkte!.C5!.t, "s"); assert.equal(saved.Sheets.Monatsmärkte!.C5!.f, undefined);
  assert.equal(saved.Sheets.Monatsmärkte!.C5!.v, '=HYPERLINK("unsafe")');
  assert.equal(saved.Sheets["Letzte Antworten"]!.K5!.v, "original-submission");
  assert.equal(saved.Sheets["Antwortverteilung"]!["!autofilter"]?.ref, "A4:G6");
  assert.equal(JSON.stringify(report), before, "Export never mutates server data or provenance");
});
