import assert from "node:assert/strict";
import test from "node:test";
import { smNextAnswerWithComment, smOptionalCommentsAllowed, smCommentMissing } from "../src/lib/sm/answerComments";
import { smExportAnswerComment, smExportAnswerValue } from "../src/lib/exports/smAnswerValue";
import { normalizeSmVisitAnswer, isAnsweredSmVisitPayload, isCompleteSmVisitAnswer, smVisitAnswerToRuleValue, type SmVisitQuestionSnapshot } from "../backend/src/sm-visit.shared";

const question = { optionalCommentEnabled: true, questionCode: "smdurcharbeit_question_synthetic", type: "yesno" as const, config: {}, options: [{ code: "option_1", label: "Ja" }, { code: "option_2", label: "Nein" }] };
test("optional comments survive normalization for all Durcharbeit answer types without changing rule values", () => {
  const examples: Array<[SmVisitQuestionSnapshot, unknown]> = [
    [question, { kind: "choice", optionCode: "option_2" }],
    [{ ...question, type: "single" }, { kind: "choice", optionCode: "option_1" }],
    [{ ...question, type: "multiple" }, { kind: "multi", optionCodes: ["option_1"] }],
    [{ ...question, type: "yesnomulti", config: { branches: [{ answer: "Nein", options: ["Nicht vorgesehen"] }] } }, { kind: "yesnomulti", optionCode: "option_2", subOptions: ["Nicht vorgesehen"] }],
    [{ ...question, type: "likert" }, { kind: "choice", optionCode: "option_1" }],
    [{ ...question, type: "text" }, { kind: "text", value: "Antwort" }],
    [{ ...question, type: "numeric" }, { kind: "number", value: 0 }],
    [{ ...question, type: "slider" }, { kind: "number", value: 25 }],
    [{ ...question, type: "matrix", config: { rows: ["Regal"], columns: ["Ja", "Nein"] } }, { kind: "matrix", cells: [{ rowCode: "row_1", columnCode: "column_2", selected: true }] }],
    [{ ...question, type: "photo" }, { kind: "photo", fileIds: ["00000000-0000-4000-8000-000000000001"] }],
  ];
  for (const [snapshot, raw] of examples) {
    const bare = normalizeSmVisitAnswer(snapshot, raw);
    const note = normalizeSmVisitAnswer(snapshot, { ...bare, comment: "  Freiwillige Notiz  " });
    assert.equal(note.comment, "Freiwillige Notiz", snapshot.type);
    assert.equal(isCompleteSmVisitAnswer(snapshot, note), isCompleteSmVisitAnswer(snapshot, bare), snapshot.type);
    assert.deepEqual(smVisitAnswerToRuleValue(note, snapshot.options), smVisitAnswerToRuleValue(bare, snapshot.options), snapshot.type);
  }
});
test("a comment before answering remains an unanswered question for every type", () => {
  for (const type of ["single", "yesno", "yesnomulti", "multiple", "likert", "text", "numeric", "slider", "photo", "matrix"] as const) {
    const snapshot = { ...question, type };
    const note = normalizeSmVisitAnswer(snapshot, { kind: "empty", comment: "Zur Vorbereitung" });
    assert.deepEqual(note, { kind: "empty", comment: "Zur Vorbereitung" });
    assert.equal(isAnsweredSmVisitPayload(note), false); assert.equal(isCompleteSmVisitAnswer(snapshot, note), false);
  }
});
test("existing mandatory rules keep requiring a comment and fresh explanations when their trigger changes", () => {
  const configured = { ...question, config: { commentTrigger: { mode: "options", optionCodes: ["option_2"] } } };
  assert.equal(smCommentMissing(configured, { kind: "choice", optionCode: "option_2" }), true);
  assert.equal(smCommentMissing(configured, { kind: "choice", optionCode: "option_1" }), false);
  const note = normalizeSmVisitAnswer(configured, { kind: "choice", optionCode: "option_1", comment: "Freiwillig bei Ja" });
  assert.equal(note.comment, "Freiwillig bei Ja");
  const next = smNextAnswerWithComment(configured, note, { kind: "choice", optionCode: "option_2" });
  assert.equal(next.comment, undefined); assert.equal(smCommentMissing(configured, next), true);
  assert.equal(smNextAnswerWithComment(question, { kind: "empty", comment: "Allgemeine Notiz" }, { kind: "choice", optionCode: "option_1" }).comment, "Allgemeine Notiz");
});
test("standard SM normalization and stale-comment behavior are preserved", () => {
  const standard = { ...question, optionalCommentEnabled: false, questionCode: "question_synthetic" };
  assert.equal(smOptionalCommentsAllowed(standard), false);
  assert.deepEqual(normalizeSmVisitAnswer(standard, { kind: "empty", comment: "Notiz" }), { kind: "empty" });
  assert.deepEqual(normalizeSmVisitAnswer(standard, { kind: "choice", optionCode: "option_1", comment: "Notiz" }), { kind: "choice", optionCode: "option_1" });
  assert.equal(smNextAnswerWithComment(standard, { kind: "choice", optionCode: "option_1", comment: "Alt" }, { kind: "choice", optionCode: "option_2" }).comment, undefined);
});
test("export keeps a note without claiming an answer; hidden notes stay hidden", () => {
  const row = { question: { questionCodeSnapshot: question.questionCode, optionalCommentEnabled: true, questionTypeSnapshot: "yesno", questionVersionId: "v", submissionId: "s", id: "q", questionTextSnapshot: "Frage", answerOptionsSnapshot: [] },
    answer: { id: "a", answerState: "unanswered", answerVersion: 1, answeredAt: null, valueJson: { kind: "empty" as const, comment: "Noch abzuklären" } } };
  assert.equal(smExportAnswerValue(row), "Nicht beantwortet"); assert.equal(smExportAnswerComment(row), "Noch abzuklären");
  assert.equal(smExportAnswerComment({ ...row, question: { ...row.question, isApplicable: false } }), "");
  assert.equal(smExportAnswerComment({ ...row, question: { ...row.question, questionCodeSnapshot: "question_standard", optionalCommentEnabled: false } }), "");
});
