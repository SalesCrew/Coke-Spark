import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const modules = new Map();
function load(path) {
  const url = new URL(path, import.meta.url), key = url.href;
  if (modules.has(key)) return modules.get(key);
  const module = { exports: {} }, require = createRequire(url);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(outputText, { module, exports: module.exports, Date, Intl, Number, require: name => {
    if (name.endsWith(".css")) return { default: new Proxy({}, { get: (_target, prop) => String(prop) }) };
    if (name.startsWith("@/")) return load(`../src/${name.slice(2)}.ts`);
    return require(name);
  } });
  modules.set(key, module.exports); return module.exports;
}
const logic = load("../src/lib/sm/management.ts");
const { SmManagementAnswer } = load("../src/components/admin/sm/SmManagementAnswer.tsx");
const question = (overrides = {}) => ({ id: "question", questionCode: "stable", text: "Frage", type: "yesno", required: true, applicable: true,
  options: [{ code: "yes", label: "Ja" }, { code: "no", label: "Nein" }], rules: [], config: {}, answer: { kind: "empty" }, answerState: "unanswered", photos: [], ...overrides });
const render = (q, value) => renderToStaticMarkup(createElement(SmManagementAnswer, { question: q, value, photos: [], editable: true, disabled: false, onChange() {}, onUpload() {} }));

test("matrix editing follows one choice per row and retains other rows", () => {
  const original = { kind: "matrix", cells: [{ rowCode: "row_1", columnCode: "column_1", selected: true }, { rowCode: "row_2", columnCode: "column_1", selected: true }] };
  const next = logic.smManagementSelectMatrix(original, "row_1", "column_2");
  assert.equal(next.cells.filter(cell => cell.rowCode === "row_1").length, 1);
  assert.equal(next.cells.find(cell => cell.rowCode === "row_1").columnCode, "column_2");
  assert.equal(next.cells.find(cell => cell.rowCode === "row_2").columnCode, "column_1");
  assert.equal(original.cells[0].columnCode, "column_1");
  const markup = render(question({ type: "matrix", config: { rows: ["A", "B"], columns: ["Ja", "Nein"] } }), next);
  assert.equal((markup.match(/type="radio"/g) ?? []).length, 4);
  assert.doesNotMatch(markup, /type="checkbox"/);
});

test("blank historical matrix labels don't renumber or create unanswerable required rows", () => {
  const q = question({ type: "matrix", config: { rows: ["", "Echte Zeile"], columns: ["", "Gut"] } });
  const answer = { kind: "matrix", cells: [{ rowCode: "row_2", columnCode: "column_2", selected: true }] };
  assert.equal(logic.smManagementAnswerComplete(q, answer), true);
  assert.equal(logic.smManagementAnswerComplete(q, { kind: "matrix", cells: [] }), false);
  assert.match(render(q, answer), /Echte Zeile: Gut/);
  assert.equal((render(q, answer).match(/type="radio"/g) ?? []).length, 1);
});

test("answer captions follow original labels even when snapshot options are reordered", () => {
  const q = question({ options: [{ code: "no", label: "Nein" }, { code: "yes", label: "Ja" }], config: { answerSubheadings: ["Ja-Hilfe", "Nein-Hilfe"] } });
  assert.deepEqual(Array.from(logic.smManagementOptionSubheadings(q)), ["Nein-Hilfe", "Ja-Hilfe"]);
  assert.match(render(q, { kind: "choice", optionCode: "no" }), /Nein<small>Nein-Hilfe/);
});

test("comment requirement applies even when the answer itself is optional", () => {
  const q = question({ required: false, config: { commentTrigger: { mode: "options", optionCodes: ["no"] } } });
  assert.equal(logic.smManagementAnswerComplete(q, { kind: "choice", optionCode: "no" }), false);
  assert.equal(logic.smManagementAnswerComplete(q, { kind: "choice", optionCode: "no", comment: "Grund" }), true);
  assert.equal(logic.smManagementAnswerComplete(q, { kind: "choice", optionCode: "yes" }), true);
  assert.match(render(q, { kind: "choice", optionCode: "no" }), /aria-label="Pflichtkommentar"/);
  assert.doesNotMatch(render(q, { kind: "choice", optionCode: "yes" }), /aria-label="Pflichtkommentar"/);
});

test("unchanged comment trigger retains text; different answer trigger follows SM policy", () => {
  const q = question({ config: { commentTrigger: { mode: "options", optionCodes: ["no"] } } });
  const old = { kind: "choice", optionCode: "no", comment: "Historischer Kommentar" };
  assert.equal(logic.smManagementNextAnswer(q, old, { kind: "choice", optionCode: "no" }).comment, old.comment);
  assert.equal(logic.smManagementNextAnswer(q, old, { kind: "choice", optionCode: "yes" }).comment, undefined);
  assert.equal(old.comment, "Historischer Kommentar");
});

test("numeric editor respects string-valued limits and integer/decimal modes", () => {
  const q = question({ type: "numeric", config: { min: "2", max: "10", decimals: false } });
  const markup = render(q, { kind: "number", value: 4 });
  assert.match(markup, /step="1"/); assert.match(markup, /min="2"/); assert.match(markup, /max="10"/);
  assert.match(render({ ...q, config: { ...q.config, decimals: true } }, { kind: "empty" }), /step="any"/);
  assert.equal(logic.smManagementConfigNumber(""), undefined);
});

test("conditional draft uses the stored rule and not unrelated current templates", () => {
  const trigger = question({ rules: [{ triggerQuestionId: "stable", operator: "equals", triggerValue: "Nein", action: "show", targetQuestionIds: ["target"] }] });
  const target = question({ id: "target-id", questionCode: "target", type: "text", applicable: false, applicabilityReason: "hidden_by_rule" });
  assert.equal(logic.smManagementHidden([trigger, target], { question: { kind: "choice", optionCode: "yes" } }).has("target-id"), true);
  assert.equal(logic.smManagementHidden([trigger, target], { question: { kind: "choice", optionCode: "no" } }).has("target-id"), false);
});
