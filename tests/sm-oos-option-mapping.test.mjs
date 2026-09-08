import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editor = await readFile(new URL("../src/components/admin/sm/SmModuleEditor.tsx", import.meta.url), "utf8");

test("SM OOS authoring is available for single and multiple choice questions", () => {
  assert.match(editor, /const supportsOos = [^\n]*question\.type === "single"[^\n]*question\.type === "multiple"/);
  assert.match(editor, /OOS aufgefunden/);
  assert.match(editor, /OOS behoben/);
});

test("the option UI explicitly permits repeated OOS mappings", () => {
  assert.match(editor, /Mehrfachzuordnung erlaubt/);
  assert.match(editor, /Mehrere Optionen dürfen dasselbe OOS-Ergebnis auslösen/);
  assert.match(editor, /answerOutcomes\[answer\]/);
});

test("renaming or removing choice options keeps OOS mappings aligned", () => {
  assert.match(editor, /previousOptions\.length === options\.length/);
  assert.match(editor, /currentOutcomes\[previousOption\]/);
  assert.match(editor, /oos = \{ \.\.\.oos, answerOutcomes: nextOutcomes \}/);
});

test("an OOS detection dropdown never collapses into an empty strip", () => {
  assert.match(editor, /Math\.max\(54, options\.length \* 34 \+ 8\)/);
  assert.match(editor, /Keine passende Erkennungsfrage/);
  assert.match(editor, /Erkennungs- und Behebungsfrage müssen im selben Modul/);
});
