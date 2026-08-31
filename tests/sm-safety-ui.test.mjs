import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const conflictUrl = new URL("../src/components/sm/SmVisitTimeConflict.tsx", import.meta.url);
const source = await readFile(conflictUrl, "utf8");
const module = { exports: {} };
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
runInNewContext(output.outputText, { module, exports: module.exports, require: createRequire(conflictUrl) });

test("overlap card displays both complete Vienna intervals, market and preserved answers", () => {
  const html = renderToStaticMarkup(createElement(module.exports.SmVisitTimeConflict, { details: {
    proposedStartedAt: "2034-06-01T13:10:00Z", proposedCompletedAt: "2034-06-01T13:50:00Z",
    conflicts: [{ submissionId: "test", marketName: "Billa Test", marketAddress: "Teststraße 1, Wien", startedAt: "2034-06-01T13:10:00Z", completedAt: "2034-06-01T13:30:00Z" }],
  } }));
  for (const value of ['role="alert"', "Abschluss blockiert", "Billa Test", "Teststraße 1, Wien", "01.06.2034", "15:10", "15:30", "15:50", "Deine Antworten bleiben erhalten", "Ändere oben Start und Ende"]) assert.ok(html.includes(value), value);
});

test("both time modes use editable timestamps and overlap failures retain review state", async () => {
  const workspace = await read("../src/components/sm/SmVisitWorkspace.tsx");
  assert.ok(workspace.includes('const startIso = localDateTimeInputIso(startValue)'));
  assert.ok(workspace.includes('const endIso = localDateTimeInputIso(endValue)'));
  assert.ok(workspace.includes('submitError.code === "sm_visit_time_overlap"'));
  assert.ok(workspace.includes('setTimeConflict(data.details)'));
  assert.ok(workspace.includes('<SmVisitTimeConflict details={timeConflict}'));
  assert.ok(workspace.includes('Bitte trage Start und Ende deines Marktbesuchs ein.'));
});

test("deactivation opens on Inaktiv, uses shared dropdowns and requires every decision", async () => {
  const page = await read("../src/app/admin/sm/maerkte/page.tsx");
  const modal = await read("../src/components/admin/sm/SmMarketDeactivationModal.tsx");
  assert.ok(page.includes('value === "inactive" && market.isActive) setShowDeactivation(true)'));
  for (const value of ['role="dialog"', 'aria-modal="true"', 'overflow-y-auto', '<AdminDropdown', 'previewToken: preview.previewToken', '!allChosen', 'Einzeltermine ansehen / individuell ersetzen', 'sm_market_deactivation_stale', 'Bestätigen & Markt deaktivieren', 'Abbrechen']) assert.ok(modal.includes(value), value);
});
