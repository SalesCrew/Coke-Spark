import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real TSX in memory without a browser, API calls or an extra test runtime.
const componentUrl = new URL("../src/components/admin/sm/SmDashboardSkeleton.tsx", import.meta.url);
const source = await readFile(componentUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: fileURLToPath(componentUrl),
});
const componentModule = { exports: {} };
runInNewContext(outputText, {
  module: componentModule,
  exports: componentModule.exports,
  require: createRequire(componentUrl),
});
const { SmDashboardSkeleton } = componentModule.exports;
const markup = renderToStaticMarkup(createElement(SmDashboardSkeleton));
const classLists = [...markup.matchAll(/class="([^"]*)"/g)].map((match) => match[1].split(" "));
const countClass = (name) => classLists.filter((classes) => classes.includes(name)).length;

test("Loading mirrors all five metric cards, details and progress tracks", () => {
  for (const className of ["sm-live-metric", "sm-live-metric-icon", "sm-live-metric-label", "sm-live-metric-value", "sm-live-progress"]) {
    assert.equal(countClass(className), 5, className);
  }
  assert.equal([...markup.matchAll(/<small>/g)].length, 5);
});

test("Loading includes category and both comparison tables with their rate bars", () => {
  assert.equal(countClass("sm-live-card"), 3);
  assert.equal(countClass("sm-live-category-row"), 4);
  assert.equal(countClass("sm-live-dimension-row"), 6);
  assert.equal(countClass("sm-live-rate"), 20);
  assert.ok(markup.includes("Handelsketten im Vergleich"));
  assert.ok(markup.includes("Regionen im Vergleich"));
});

test("Loading uses the live responsive grids and accessible, non-interactive placeholders", () => {
  assert.equal(countClass("sm-live-metrics"), 1);
  assert.equal(countClass("sm-live-bottom"), 1);
  assert.ok(markup.includes('role="status"'));
  assert.ok(markup.includes('aria-hidden="true"'));
  assert.ok(markup.includes("SM-Dashboard wird geladen"));
  assert.doesNotMatch(markup, /<(button|input|a)\b/);
  assert.equal(renderToStaticMarkup(createElement(SmDashboardSkeleton)), markup);
});

test("The initial-load gate preserves loaded data during refresh and supports reduced motion", async () => {
  const workspace = await readFile(new URL("../src/components/admin/sm/SmDashboardWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /loading && !payload \? \(\s*<SmDashboardSkeleton \/>/);
  assert.match(workspace, /@media\(prefers-reduced-motion:reduce\)\{\.sm-live-skeleton\{animation:none\}\}/);
});
