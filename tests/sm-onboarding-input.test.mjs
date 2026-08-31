import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function loadTs(path, mocks = {}) {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: url.pathname,
  });
  const module = { exports: {} };
  const require = createRequire(url);
  runInNewContext(outputText, { module, exports: module.exports, require: (name) => mocks[name] ?? require(name) });
  return module.exports;
}
const { formatSmTravelTimeEdit: edit } = await loadTs("../src/lib/sm/travelTimeInput.ts");
const { SmTravelTimeInput } = await loadTs("../src/components/sm/SmTravelTimeInput.tsx", { "@/lib/sm/travelTimeInput": { formatSmTravelTimeEdit: edit } });
const { SmEmployeeAgreement } = await loadTs("../src/components/sm/SmEmployeeAgreement.tsx");
const props = {
  payload: { agreement: { key: "spark_sm_employee_agreement", version: "2026-08-31-sm-v1", title: "SM-Vereinbarung", sections: [{ title: "Deine Einsätze", body: ["Besuchszeit und optionale Fahrtzeit."] }] }, accepted: false, acceptance: null },
  fullName: "SM Testperson", loading: false, submitting: false, checked: false, error: null,
  onChecked() {}, onAccept() {}, onLogout() {}, onRetry() {},
};
const render = (overrides = {}) => renderToStaticMarkup(createElement(SmEmployeeAgreement, { ...props, ...overrides }));

test("four numeric keystrokes insert the colon immediately after the second digit", () => {
  let value = "";
  const values = [];
  for (const character of "0130") { value = edit(value + character, value).value; values.push(value); }
  assert.deepEqual(values, ["0", "01:", "01:3", "01:30"]);
});

test("backspace can clear every character without getting trapped on the separator", () => {
  let value = "01:30";
  const values = [];
  while (value) { value = edit(value.slice(0, -1), value).value; values.push(value); assert.ok(values.length <= 5); }
  assert.deepEqual(values, ["01:3", "01:", "01", "0", ""]);
});

test("paste accepts compact/formatted durations, pads explicit short hours, strips noise and limits digits", () => {
  for (const [raw, expected] of [["0030", "00:30"], ["02:45", "02:45"], ["1:30", "01:30"], ["abc01:30xyz", "01:30"], ["12345678", "12:34"], ["24:00", "24:00"], ["99:99", "99:99"], ["", ""]]) {
    assert.equal(edit(raw, "").value, expected);
  }
  // Invalid minutes remain visibly invalid for the existing duration validation, not silently clamped.
  assert.equal(edit("0169", "").value, "01:69");
});

test("caret follows the inserted colon and stays near a mid-string edit", () => {
  assert.equal(edit("01", "0", 2).cursor, 3);
  assert.equal(edit("01:30", "01:3", 5).cursor, 5);
  assert.equal(edit("02:30", "01:30", 2).cursor, 3);
  assert.equal(edit("11:30", "01:30", 1).cursor, 1);
});

test("travel input uses one accessible numeric field and the same component on start and review", async () => {
  const markup = renderToStaticMarkup(createElement(SmTravelTimeInput, { value: "01:30", onValueChange() {} }));
  assert.match(markup, /inputMode="numeric"/);
  assert.match(markup, /maxLength="5"/);
  assert.match(markup, /placeholder="HH:MM"/);
  assert.match(markup, /Fahrtzeit in Stunden und Minuten/);
  const source = await readFile(new URL("../src/components/sm/SmVisitWorkspace.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/<SmTravelTimeInput /g) ?? []).length, 2);
  assert.match(source, /payload\.profile\.travelTimeEnabled \? <label/);
});

test("SM agreement is phone-width, single-column, readable and safe-area aware", () => {
  const markup = render();
  assert.match(markup, /max-w-\[460px\]/);
  assert.match(markup, /100dvh/);
  assert.match(markup, /safe-area-inset-bottom/);
  assert.match(markup, /safe-area-inset-top/);
  assert.match(markup, /overflow-wrap:anywhere/);
  assert.match(markup, /leading-\[1\.75\]/);
  assert.match(markup, /href="\/datenschutz\/sm"/);
  assert.doesNotMatch(markup, /58vh|overflow-y-auto|min-width:210|grid-template-columns:1fr auto/);
});

test("SM acceptance still requires the checkbox, disables duplicate submits and supports existing acceptance", () => {
  assert.match(render(), /<button[^>]*disabled=""[^>]*>.*?Akzeptieren und fortfahren/s);
  const checked = render({ checked: true });
  assert.doesNotMatch(checked, /<button[^>]*disabled=/);
  assert.match(render({ checked: true, submitting: true }), /Wird gespeichert/);
  assert.match(render({ payload: { ...props.payload, accepted: true }, checked: true }), /Zurück zur App/);
});

test("loading and fetch errors stay separate from the legal agreement and acceptance", () => {
  const loading = render({ payload: null, loading: true });
  assert.match(loading, /SM-Vereinbarung wird geladen/);
  assert.match(loading, /motion-safe:animate-pulse/);
  assert.doesNotMatch(loading, /type="checkbox"/);
  const error = render({ payload: null, error: "Nicht erreichbar" });
  assert.match(error, /role="alert"/);
  assert.match(error, /Erneut laden/);
  assert.doesNotMatch(error, /type="checkbox"/);
});

test("only the exact SM role receives the new layout; GM keeps its existing document UI", async () => {
  const page = await readFile(new URL("../src/app/vereinbarung/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(session\?\.user\.role === "sm"\) \{\s*return <SmEmployeeAgreement/);
  assert.match(page, /maxHeight: "58vh"/);
  assert.match(page, /gridTemplateColumns: "1fr auto"/);
  assert.match(page, /acceptCurrentEmployeeAgreement\(payload\.agreement\.version\)/);
});
