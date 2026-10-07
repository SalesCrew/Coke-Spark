import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function load(path, mocks = {}, append = "", extra = {}) {
  const url = new URL(path, import.meta.url), module = { exports: {} }, nativeRequire = createRequire(url);
  const source = await readFile(url, "utf8");
  const output = ts.transpileModule(source + append, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  runInNewContext(output.outputText, { module, exports: module.exports, Intl, Date, ...extra, require: name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return new Proxy({}, { get: () => () => null });
    return nativeRequire(name);
  } });
  return module.exports;
}
const view = await load("../src/lib/sm/SMDurcharbeitView.ts");
const { AssignmentList } = await load("../src/components/dashboard/AssignmentList.tsx", { "@/lib/sm/SMDurcharbeitView": view });
const render = (props = {}) => renderToStaticMarkup(createElement(AssignmentList, { assignments: [], ...props }));
const assignment = { id: "synthetic", duration: "45 min", market: "Testmarkt", address: "Testgasse 1", workDate: "2026-10-07", status: "planned", marketInternalId: "TEST-1", sourceType: "single", region: "Ost", SMDurcharbeitQuestionnaireSelection: { name: "Durcharbeit Oktober", catalogScope: "SMDurcharbeit" } };

test("questionnaire identity wins over market membership, including frozen standard history", () => {
  const historical = Object.freeze({ SMDurcharbeitMarket: true, SMDurcharbeitQuestionnaireSelection: Object.freeze({ source: "submission", catalogScope: "standard" }) });
  assert.equal(view.isSMDurcharbeitAssignment(historical), false);
  assert.equal(view.isSMDurcharbeitAssignment({ ...historical, SMDurcharbeitQuestionnaireSelection: { source: "submission", catalogScope: "SMDurcharbeit" }, SMDurcharbeitMarket: false }), true);
  assert.equal(view.isSMDurcharbeitAssignment({ SMDurcharbeitMarket: true }), true);
  assert.equal(view.isSMDurcharbeitAssignment({}), false);
});
test("one compact employee list keeps mixed visits in order with blue accents only on Durcharbeit rows", () => {
  const standard = { ...assignment, id: "standard", market: "Standardmarkt", SMDurcharbeitQuestionnaireSelection: { name: "Standard Oktober", catalogScope: "standard" } };
  const html = render({ assignments: [standard, assignment] });
  assert.equal((html.match(/<section/g) ?? []).length, 1);
  assert.match(html, /aria-label="Besuche"/);
  assert.match(html, /2 Einsätze/);
  assert.ok(html.indexOf("Standardmarkt") < html.indexOf("Testmarkt"));
  assert.equal((html.match(/h-\[44px\]/g) ?? []).length, 2);
  assert.match(html, /Durcharbeit · Testgasse 1/);
  assert.match(html, /linear-gradient\(#2563EB,#1D4ED8\)/);
  assert.match(html, /#DC2626/);
  assert.match(html, /aria-label="Testmarkt: Starten"/);
  assert.doesNotMatch(html, /rounded-full|SMDurcharbeitQuestionnaireBadge|min-h-\[64px\]|Durcharbeit Einsätze|Standardbesuche|bg-gradient-to-br/);
});
test("the unified list keeps truthful loading, failures and empty days", () => {
  const loading = render({ loading: true });
  assert.match(loading, /Einsätze werden geladen/); assert.doesNotMatch(loading, /0 Einsätze|Keine Besuche/);
  const failure = render({ error: "Synthetischer Fehler", onRetry() {} });
  assert.match(failure, /role="alert"/); assert.match(failure, /Erneut laden/); assert.doesNotMatch(failure, /0 Einsätze|Keine Besuche/);
  assert.match(render(), /Keine Besuche für diesen Tag/);
});
test("dedicated market details expose no edit/delete actions while ordinary market controls stay available", async () => {
  const weekly = await load("../src/lib/sm-market-weekly-planning.ts");
  const { MarketDetailDrawer } = await load("../src/components/admin/sm/SmMarketsWorkspace.tsx", { "@/lib/sm-market-weekly-planning": weekly, "react-dom": { createPortal: children => children } }, "\nexport { MarketDetailDrawer };", { document: { body: {} } });
  const props = { market: { id: "test", name: "Testmarkt", dbName: "Testmarkt", chain: "Spar", internalId: "TEST", address: "Testgasse", postalCode: "1010", city: "Wien", region: "Ost", infoNote: "", isActive: true, weekdayHours: {} }, users: [], gmUsers: [], onSave() {}, onPlanningSave() {}, onDelete() {}, onDeactivated() {}, onClose() {} };
  const readOnly = renderToStaticMarkup(createElement(MarketDetailDrawer, { ...props, SMDurcharbeitReadOnly: true }));
  assert.match(readOnly, /Durcharbeit Markt/); assert.match(readOnly, /Testmarkt/);
  assert.doesNotMatch(readOnly, /Markt bearbeiten|Markt löschen|Wochenplanung bearbeiten/);
  const normal = renderToStaticMarkup(createElement(MarketDetailDrawer, props));
  assert.match(normal, /Markt bearbeiten/); assert.match(normal, /Markt löschen/);
});
test("new routes are confined to the SM workspace and keep existing route identities", async () => {
  const nav = await load("../src/components/ui/adminNavigation.ts");
  for (const path of ["/admin/sm/durcharbeit", "/admin/sm/durcharbeit-maerkte", "/admin/sm/durcharbeit-verplanung"]) {
    assert.equal(nav.getAdminWorkspaceForPath(path), "sm"); assert.equal(nav.getAdminPageKeyForPath(path), "shelfmerchandiser");
  }
  assert.equal(nav.getAdminWorkspaceForPath("/admin/durcharbeit"), "gm");
});
test("client creation payload preserves the explicit override and omits it for ordinary creation", async () => {
  const url = new URL("../src/lib/api/backend.ts", import.meta.url), source = await readFile(url, "utf8");
  const start = source.indexOf("export async function createSmPlanningAssignment("), end = source.indexOf("export async function createSmPlanningSeries(", start);
  const module = { exports: {} }, calls = [];
  const output = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  runInNewContext(output.outputText, { module, exports: module.exports, JSON, authedFetch: async (path, options) => { calls.push({ path, payload: JSON.parse(options.body) }); return { assignmentId: "test" }; } });
  const input = { smMarketId: "market", smUserId: "user", workDate: "2026-10-07", plannedMinutes: 45, idempotencyKey: "synthetic" };
  await module.exports.createSmPlanningAssignment({ ...input, SMDurcharbeitQuestionnaireOverrideVersionId: "version" });
  assert.equal(calls[0].payload.SMDurcharbeitQuestionnaireOverrideVersionId, "version");
  await module.exports.createSmPlanningAssignment(input);
  assert.equal(Object.hasOwn(calls[1].payload, "SMDurcharbeitQuestionnaireOverrideVersionId"), false);
});
