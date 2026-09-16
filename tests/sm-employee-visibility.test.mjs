import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function load(path, extra = "", mocks = {}) {
  const url = new URL(path, import.meta.url);
  const code = await readFile(url, "utf8");
  const { outputText } = ts.transpileModule(code + extra, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} }, require = createRequire(url);
  runInNewContext(outputText, { module, exports: module.exports, Date, Intl, require: name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return new Proxy({}, { get: () => () => null });
    return require(name);
  } });
  return module.exports;
}

const { visibleSmAssignments } = await load("../src/lib/sm/assignmentVisibility.ts");
const { ReviewScreen } = await load("../src/components/sm/SmVisitWorkspace.tsx", "\nexport { ReviewScreen };", {
  "@/components/sm/SmTravelTimeInput": { SmTravelTimeInput: ({ label, value }) => createElement("input", { "aria-label": label, value, readOnly: true }) },
});

test("employee visibility excludes only cancelled; original records remain unchanged for admin/history", () => {
  const statuses = ["planned", "confirmed", "open", "in_progress", "completed", "cancelled", "missed"];
  const records = statuses.map((status, id) => Object.freeze({ id, status }));
  Object.freeze(records);
  assert.equal(visibleSmAssignments(records).length, 6);
  assert.deepEqual(Array.from(visibleSmAssignments(records), row => row.status), statuses.filter(s => s !== "cancelled"));
  assert.equal(records.length, 7);
  assert.equal(visibleSmAssignments([{ id: 5, status: "planned" }])[0].id, 5, "restored IDs are not permanently hidden");
});

const props = enabled => ({
  payload: { profile: { travelTimeEnabled: enabled }, answers: {}, submission: { visitTimeMode: "timer", visitStartedAt: new Date(Date.now() - 30 * 60000).toISOString(), travelMinutes: 45 } },
  flat: [], error: null, busy: false, onBack() {}, onSubmit() {},
});

test("disabled review renders no travel section, badge, input, or disabled-account explanation", () => {
  const input = props(false);
  const markup = renderToStaticMarkup(createElement(ReviewScreen, input));
  assert.doesNotMatch(markup, /Fahrtzeit|Fahrtzeiterfassung|An- und Abfahrt|Optional|sm-review-travel-time/);
  assert.match(markup, /Gesamtzeit/);
  assert.equal(input.payload.submission.travelMinutes, 45, "historical value is not cleared");
});

test("enabled review retains travel input and saved HH:MM value", () => {
  const markup = renderToStaticMarkup(createElement(ReviewScreen, props(true)));
  assert.match(markup, /data-testid="sm-review-travel-time"/);
  assert.match(markup, /aria-label="Fahrtzeit"/);
  assert.match(markup, /00:45/);
});
