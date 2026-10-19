import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";
import { buildSMDurcharbeitReportWorkbook } from "../src/lib/exports/smSMDurcharbeitReportExport";
import { smExportAnswerValue } from "../src/lib/exports/smAnswerValue";
import type { SMDurcharbeitReport, SMDurcharbeitReportAnswer, SMDurcharbeitTarget } from "../src/types/smSMDurcharbeitCampaign";
import type { SmVisitAnswer } from "../src/types/smVisit";

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
  report.visitAnswers = [...report.answers, { ...report.answers[0]!, question: { ...report.answers[0]!.question, id: "historical-question", submissionId: "submission-2" },
    answer: { ...report.answers[0]!.answer!, id: "historical-answer", valueJson: { kind: "choice", optionCode: "yes" } } }];
  const before = JSON.stringify(report), wb = XLSX.utils.book_new();
  buildSMDurcharbeitReportWorkbook(XLSX, wb, report, "Synthetic campaign");
  const saved = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true }), { type: "buffer", cellFormula: true, cellStyles: true });
  assert.equal(wb.Sheets["Einsätze"]!.A5!.s.font.color.rgb, "111827");
  assert.equal(saved.Sheets["Einsätze"]!.A5!.s.fgColor.rgb, "FFFFFF", "Body background is explicitly white, including in dark viewers");
  assert.equal(saved.Sheets["Einsätze"]!.A3!.s.fgColor.rgb, "FFFFFF", "Blank cells within the exported table also have a white background");
  assert.equal(saved.Sheets["Einsätze"]!.A4!.s.fgColor.rgb, "111827", "Only the intentional header remains dark");
  assert.equal(saved.Sheets.Meta!.B3!.s.fgColor.rgb, "FFFFFF");
  assert.equal(saved.Sheets["Letzte Antworten"]!.A5!.s.fgColor.rgb, "FFFFFF");
  assert.deepEqual(saved.SheetNames, ["Einsätze", "Meta", "Monatsmärkte", "Fragen", "Antwortverteilung", "Letzte Antworten", "Tatsächliche Besuche"]);
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
  const visits = table("Einsätze");
  assert.equal(visits.length, 3, "Follow-up and earlier physical visits are separate rows");
  assert.deepEqual(visits.map(row => row[19]), ["Nein", "Ja", "Ja"]);
  assert.equal(visits.reduce((sum, row) => sum + Number(row[13]), 0), 30);
  assert.equal(visits.filter(row => row[18] === "Aktuell").length, 2);
  assert.equal(table("Letzte Antworten")[0]![13], "Nein", "Readable answer is also present next to the retained raw audit JSON");
});

function answerRow(type: string, value: SmVisitAnswer, config = {}): SMDurcharbeitReportAnswer {
  return { targetId: "target", smName: "Original SM", sourceSubmissionId: null, sourceAnswerId: null,
    question: { id: type, submissionId: "submission", questionVersionId: `version-${type}`, questionCodeSnapshot: type,
      questionTypeSnapshot: type, questionTextSnapshot: `Frage ${type}`, configSnapshot: config, isApplicable: true,
      answerOptionsSnapshot: [{ code: "option_1", label: "Historisches Ja" }, { code: "option_2", label: "Historisches Nein" }] },
    answer: { id: `answer-${type}`, answerState: "answered", answerVersion: 1, valueJson: value, answeredAt: "2026-10-01T12:00:00Z" } };
}

test("all ten SM question types export readable snapshot answers, preserving zero, comments and original matrix indexes", () => {
  const cases = [
    ["single", { kind: "choice", optionCode: "option_1" }, "Historisches Ja"],
    ["yesno", { kind: "choice", optionCode: "option_2" }, "Historisches Nein"],
    ["yesnomulti", { kind: "yesnomulti", optionCode: "option_1", subOptions: ["Schütte", "Display"] }, "Historisches Ja · Schütte · Display"],
    ["multiple", { kind: "multi", optionCodes: ["option_2", "option_1"] }, "Historisches Nein, Historisches Ja"],
    ["likert", { kind: "choice", optionCode: "option_1" }, "Historisches Ja"],
    ["text", { kind: "text", value: '=HYPERLINK("not-a-formula")' }, '=HYPERLINK("not-a-formula")'],
    ["numeric", { kind: "number", value: 0 }, 0],
    ["slider", { kind: "number", value: 2.5 }, 2.5],
    ["photo", { kind: "photo", fileIds: ["photo-1", "photo-2"] }, "2 Fotos"],
    ["matrix", { kind: "matrix", cells: [{ rowCode: "row_2", columnCode: "column_2", selected: true }] }, "Regal: Voll"],
  ] as const;
  for (const [type, value, expected] of cases) assert.equal(smExportAnswerValue(answerRow(type, structuredClone(value) as SmVisitAnswer, { rows: ["", "Regal"], columns: ["", "Voll"] })), expected);
  const hidden = answerRow("text", { kind: "text", value: "Old hidden text", comment: "Old hidden comment" });
  hidden.question.isApplicable = false;
  assert.equal(smExportAnswerValue(hidden), "Nicht anwendbar");
  const missing = answerRow("single", { kind: "empty" }); missing.answer = null;
  assert.equal(smExportAnswerValue(missing), "Nicht beantwortet");
  assert.equal(smExportAnswerValue(answerRow("single", { kind: "choice", optionCode: "missing_code" })), "Unbekannte Auswahl (missing_code)");
  assert.equal(smExportAnswerValue(answerRow("photo", { kind: "photo", fileIds: [] })), "Keine verfügbaren Fotos");
});

test("wide workbook keeps question versions separate and distinguishes hidden, missing, unasked and withdrawn answers", () => {
  const old = answerRow("single", { kind: "choice", optionCode: "option_1", comment: '=SUM(1,2)' });
  const changed = answerRow("single", { kind: "choice", optionCode: "option_2" });
  changed.question = { ...changed.question, id: "changed", questionVersionId: "new-version", submissionId: "submission-2" };
  const hidden = answerRow("text", { kind: "text", value: "Invisible answer", comment: "Invisible comment" }); hidden.question.isApplicable = false;
  const missing = answerRow("numeric", { kind: "empty" }); missing.answer = null;
  const zero = answerRow("slider", { kind: "number", value: 0 });
  const matrix = answerRow("matrix", { kind: "matrix", cells: [{ rowCode: "row_2", columnCode: "column_2", selected: true }] }, { rows: ["", "Regal"], columns: ["", "Voll"] });
  const visits = [1, 2, 3].map(index => ({ id: `visit-${index}`, targetId: "target", submissionId: index === 1 ? "submission" : `submission-${index}`,
    smUserId: "original-sm", smName: "Original SM", marketName: '=HYPERLINK("market")', marketAddress: "Original address", marketPostalCode: "0010", marketCity: "Original city",
    questionnaireName: "Original questionnaire", questionnaireVersion: index, questionnaireValid: index !== 3,
    submittedAt: `2026-10-01T0${index}:20:00Z`, originalStartedAt: null, originalCompletedAt: null, startedAt: `2026-10-01T0${index}:00:00Z`, completedAt: `2026-10-01T0${index}:20:00Z`, actualMinutes: 20, travelMinutes: 0, timeRevision: 1 }));
  const report = { month: "2026-10-01", targets: [{ id: "target", market: { name: "Changed market", address: "Changed address", postalCode: "9999", city: "Changed city" }, smName: "New SM", eligibility: "required", latestSubmissionId: "submission-2" }],
    summary: { required: 1, completed: 1, waived: 0, latestSubmissions: 1, physicalVisits: 3, validQuestionnaireVisits: 2, actualMinutes: 60, travelMinutes: 0, availablePhotoUploads: 0 },
    answers: [changed], questionResults: [], physicalVisits: visits, visitAnswers: [old, hidden, missing, zero, matrix, changed] } as unknown as SMDurcharbeitReport;
  const wb = XLSX.utils.book_new(); buildSMDurcharbeitReportWorkbook(XLSX, wb, report, "Campaign");
  const saved = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellFormula: true });
  const all = XLSX.utils.sheet_to_json<unknown[]>(saved.Sheets["Einsätze"]!, { header: 1, range: 3 }), headers = all[0]!, rows = all.slice(1);
  const value = (row: number, header: string) => rows[row]![headers.indexOf(header)];
  assert.equal(value(0, "Adresse"), "Original address"); assert.equal(value(0, "Shelf Merchandiser"), "Original SM");
  assert.equal(value(0, "PLZ"), "0010"); assert.equal(value(0, "Besuchsbeginn"), "03:00");
  assert.equal(value(0, "Frage single"), "Historisches Ja"); assert.equal(value(1, "Frage single (2)"), "Historisches Nein");
  assert.equal(value(1, "Frage single"), "", "A question not in that version is not falsely called unanswered");
  assert.equal(value(0, "Frage text"), "Nicht anwendbar"); assert.equal(value(0, "Frage text · Kommentar"), "");
  assert.equal(value(0, "Frage numeric"), "Nicht beantwortet"); assert.equal(value(0, "Frage slider"), 0);
  assert.equal(value(0, "Frage matrix"), "Regal: Voll");
  assert.equal(value(2, "Antwortstatus"), "Ungültig / zurückgezogen"); assert.equal(value(2, "Frage single"), "");
  assert.equal(saved.Sheets["Einsätze"]!.C5!.f, undefined); assert.equal(saved.Sheets["Einsätze"]!.C5!.t, "s");
  const commentCell = XLSX.utils.encode_cell({ r: 4, c: headers.indexOf("Frage single · Kommentar") });
  assert.equal(saved.Sheets["Einsätze"]![commentCell]!.f, undefined); assert.equal(saved.Sheets["Einsätze"]![commentCell]!.v, '=SUM(1,2)');
  assert.equal(saved.Sheets["Einsätze"]!["!autofilter"]?.ref, `A4:${XLSX.utils.encode_col(headers.length - 1)}7`);
  const incomplete = { ...report, visitAnswers: undefined };
  assert.throws(() => buildSMDurcharbeitReportWorkbook(XLSX, XLSX.utils.book_new(), incomplete, "Campaign"), /Besuchsantworten fehlen/);
});
