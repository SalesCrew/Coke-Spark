import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reconcileCommentOptions } from "../src/components/admin/sm/SmCommentTriggerEditor";
import type { SmQuestion } from "../src/types/smQuestionnaire";

const question: SmQuestion = { id: "q", type: "single", text: "Test", required: true, rules: [], options: ["Ja", "Nein", "Nein"], config: { options: ["Ja", "Nein", "Nein"], commentTrigger: { mode: "options", optionCodes: ["option_3"] } } };
test("browser and server trigger evaluation stay identical", () => {
  assert.equal(readFileSync("src/lib/sm/answerComments.ts", "utf8"), readFileSync("backend/src/sm-comment.shared.ts", "utf8"));
});
test("renaming, removing duplicate labels and empty authoring rows preserve exact option identity", () => {
  assert.deepEqual(reconcileCommentOptions(question, { ...question.config, options: ["Ja", "Nein", "Niemals"] }).commentTrigger, { mode: "options", optionCodes: ["option_3"] });
  assert.deepEqual(reconcileCommentOptions(question, { ...question.config, options: ["Ja", "Nein"] }, 1).commentTrigger, { mode: "options", optionCodes: ["option_2"] });
  assert.deepEqual(reconcileCommentOptions(question, { ...question.config, options: ["Ja", "Nein"] }, 2).commentTrigger, { mode: "options", optionCodes: [] });
  assert.deepEqual(reconcileCommentOptions(question, { ...question.config, options: ["", "Nein", "Nein"] }).commentTrigger, { mode: "options", optionCodes: ["option_2"] });
});
test("likert changes keep the selected value, not its old ordinal position", () => {
  const q: SmQuestion = { ...question, type: "likert", config: { min: 1, max: 5, commentTrigger: { mode: "options", optionCodes: ["option_3"] } } };
  assert.deepEqual(reconcileCommentOptions(q, { ...q.config, min: 2 }).commentTrigger, { mode: "options", optionCodes: ["option_2"] });
});
test("UI uses the GM-sized modal and server enforces optional-question comments at submit", () => {
  const dialog = readFileSync("src/components/sm/SmAnswerCommentDialog.tsx", "utf8");
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /max-w-\[360px\]/);
  assert.match(dialog, /backdrop:backdrop-blur-\[6px\]/);
  const server = readFileSync("backend/src/routes/sm-visits.ts", "utf8");
  assert.match(server, /if \(!question.requiredSnapshot\) return smCommentMissing/);
  assert.match(server, /files.length !== normalized.fileIds.length/);
  assert.match(server, /changeKind: "comment", before: current.valueJson, after: normalized/);
});
