import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const url = new URL("../src/components/dashboard/WeekStrip.tsx", import.meta.url);
const source = await readFile(url, "utf8");
const module = { exports: {} };
const require = createRequire(url);
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
runInNewContext(compiled.outputText, { module, exports: module.exports, require });
const { WeekStrip } = module.exports;

function renderWeek(selectedDate, visitsByDate = {}) {
  return renderToStaticMarkup(createElement(WeekStrip, { selectedDate, visitsByDate, onDateChange() {} }));
}

test("SM week strip displays every day of the Monday–Sunday calendar week", () => {
  const html = renderWeek("2026-09-17", { "2026-09-20": [{ id: "visit", name: "Billa", detail: "1 h" }] });
  const dates = [...html.matchAll(/data-iso-date="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(dates, ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  assert.match(html, /aria-label="Vorherige Woche"/);
  assert.match(html, /aria-label="Nächste Woche"/);
  assert.match(html, /data-iso-date="2026-09-17"[^>]*aria-pressed="true"/);
  assert.match(html, /data-iso-date="2026-09-20"[\s\S]*?>1<\/span>/);
});

test("SM week strip stays Monday–Sunday across a year boundary", () => {
  const html = renderWeek("2027-01-01");
  const dates = [...html.matchAll(/data-iso-date="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(dates, ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
});
