import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real drawer against synthetic props; no API, environment or database imports.
async function load(path, mocks = {}) {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } });
  const module = { exports: {} }, nativeRequire = createRequire(url);
  runInNewContext(output.outputText, { module, exports: module.exports, Date, Intl, crypto: webcrypto,
    require: name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/") || name.startsWith("./")) return new Proxy({}, { get: () => () => null });
      return nativeRequire(name);
    },
  });
  return module.exports;
}

const badge = await load("../src/components/sm/SMDurcharbeitQuestionnaireBadge.tsx");
const { PlanningDrawer } = await load("../src/components/admin/sm/SmVerplanungWorkspace.tsx", {
  "@/components/sm/SMDurcharbeitQuestionnaireBadge": badge,
  "@/lib/sm/planningView": { recommendedUserFirst: users => users },
  "@/components/admin/AdminFilterControls": {
    AdminDropdown: ({ value, options, ariaLabel, disabled }) => createElement("button", {
      "aria-label": ariaLabel, disabled,
    }, options.find(option => option.value === value)?.label),
    AdminDatePicker: () => null,
  },
});

test("new Durcharbeit drawer requires an explicit questionnaire and offers no standard hint or recurring series", () => {
  const html = renderToStaticMarkup(createElement(PlanningDrawer, {
    SMDurcharbeit: true, mode: "single", assignment: null, defaultDate: "2026-10-07",
    markets: [{ id: "market", name: "Synthetischer Durcharbeit-Markt", internalId: "SYNTHETIC-DA" }],
    users: [{ id: "sm", firstName: "Vorschau", lastName: "SM", email: "sm@preview.test" }],
    onClose() {}, onSubmit() {}, onSeriesSaved() {},
  }));
  assert.match(html, /Wähle einen veröffentlichten Durcharbeit-Fragebogen/);
  assert.doesNotMatch(html, /Verwendet den für den Einsatztag gültigen zentralen Fragebogen|Standardfragebogen|Wiederkehrender Einsatz/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Einsatz planen<\/button>/);
});

for (const [scope, name, override] of [
  ["standard", "Historischer Standard", null],
  ["SMDurcharbeit", "Historische Durcharbeit", null],
  ["SMDurcharbeit", "Gepinnte historische Durcharbeit", "version-before-publication"],
]) test(`started ${scope} drawer shows frozen name and type (${override ?? "former central"})`, () => {
  const selection = Object.freeze({ source: "submission", name, catalogScope: scope,
    questionnaireVersionId: "frozen-version", versionNumber: 1, available: true });
  const assignment = Object.freeze({ id: "synthetic-assignment", status: "completed", sourceType: "single",
    SMDurcharbeitQuestionnaireOverrideVersionId: override, SMDurcharbeitQuestionnaireSelection: selection,
    effective: { workDate: "2026-10-07", smMarketId: "market", smUserId: "sm", plannedMinutes: 45 },
    replacement: {}, visit: { id: "frozen-submission" }, series: null,
  });
  const html = renderToStaticMarkup(createElement(PlanningDrawer, {
    mode: "single", assignment, defaultDate: "2026-10-07",
    markets: [{ id: "market", name: "Synthetischer Markt", internalId: "SYNTHETIC-1" }],
    users: [{ id: "sm", firstName: "Vorschau", lastName: "SM", email: "sm@preview.test" }],
    onClose() {}, onSubmit() {}, onSeriesSaved() {},
  }));
  assert.match(html, new RegExp(`aria-label="Fragebogen für diesen Einsatz" disabled="">${name}</button>`));
  assert.match(html, /Der gestartete Besuch behält seinen ursprünglichen Fragebogen/);
  assert.ok(html.includes(scope === "SMDurcharbeit" ? "Durcharbeit" : "Standardfragebogen"));
  assert.equal(assignment.SMDurcharbeitQuestionnaireSelection, selection);
  assert.equal(assignment.SMDurcharbeitQuestionnaireOverrideVersionId, override);
});
