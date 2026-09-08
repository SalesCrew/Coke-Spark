import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminEditor = await readFile(new URL("../src/components/admin/sm/SmModuleEditor.tsx", import.meta.url), "utf8");
const phoneQuestionnaire = await readFile(new URL("../src/components/sm/SmVisitWorkspace.tsx", import.meta.url), "utf8");
const backendAuthoring = await readFile(new URL("../backend/src/routes/sm-questionnaires.ts", import.meta.url), "utf8");

test("SM admin authors a thin question subheading and answer subheadings", () => {
  assert.match(adminEditor, /aria-label="Unterzeile zur Frage"/);
  assert.match(adminEditor, /Kleine Unterzeile \(optional\)/);
  assert.match(adminEditor, /answerSubheadings/);
  assert.match(adminEditor, /Antwort-Unterzeilen \(optional\)/);
  assert.match(adminEditor, /label="Spalten"[\s\S]*answerSubheadings=/);
});

test("SM phone questionnaire renders question and answer copy without changing GM", () => {
  assert.match(phoneQuestionnaire, /function AnswerOptionCopy/);
  assert.match(phoneQuestionnaire, /text-\[7px\][^\n]*opacity-55/);
  assert.match(phoneQuestionnaire, /text-\[9px\][^\n]*text-black\/35/);
  assert.match(phoneQuestionnaire, /branchSubheadings/);
  assert.match(phoneQuestionnaire, /configuredColumnSubheadings/);
});

test("SM backend bounds all authored subheading values", () => {
  assert.match(backendAuthoring, /SM_SUBHEADING_MAX_LENGTH = 500/);
  assert.match(backendAuthoring, /question\.config\.subheading\.length > SM_SUBHEADING_MAX_LENGTH/);
  assert.match(backendAuthoring, /branch\.answerSubheadings\.some/);
});
