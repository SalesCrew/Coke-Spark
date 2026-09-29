import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { Module } from "../src/types/fragebogen";
import { sortCatalogModules } from "../src/lib/module-catalog";
import { ModuleCatalogStatusAction, ModuleCatalogStatusBadge } from "../src/components/admin/ModuleCatalogStatus";

const row = (id: string, inactive?: boolean): Module => ({ id, name: id, description: "", createdAt: "2026-09-29", usedInCount: 1, questions: [], catalogInactive: inactive });
test("inactive modules move to the bottom stably without losing content; restoring returns original order", () => {
  const modules = [row("A", true), row("B"), row("C", true), row("D", false)];
  assert.deepEqual(sortCatalogModules(modules).map((m) => m.id), ["B", "D", "A", "C"]);
  assert.deepEqual(modules.map((m) => m.id), ["A", "B", "C", "D"]);
  assert.deepEqual(sortCatalogModules(modules.map((m) => m.id === "A" ? { ...m, catalogInactive: false } : m)).map((m) => m.id), ["A", "B", "D", "C"]);
});
test("status menu and badge render accurate reversible state, not disabled modules", () => {
  for (const inactive of [false, true]) {
    const module = row("Test", inactive);
    const menu = renderToStaticMarkup(<ModuleCatalogStatusAction module={module} scope="main" onClose={() => {}} />);
    assert.match(menu, inactive ? /Reaktivieren/ : /Inaktiv setzen/);
    assert.doesNotMatch(menu, /disabled=/);
    const badge = renderToStaticMarkup(<ModuleCatalogStatusBadge module={module} />);
    assert.equal(badge.includes(">Inaktiv</span>"), inactive);
    assert.match(badge, /opacity: .55/);
  }
});
test("all GM catalog cards keep edit/duplicate/delete and add the persistent status action and styling", () => {
  for (const file of ["src/app/admin/fragebogen/page.tsx", "src/app/admin/flexbesuche/page.tsx", "src/app/admin/billa/page.tsx", "src/app/admin/kuehlerinventur/page.tsx", "src/components/admin/ScopedQuestionnaireCatalog.tsx"]) {
    const source = readFileSync(file, "utf8");
    for (const marker of ["useCatalogModules(", "catalogAction={<ModuleCatalogStatusAction", "<ModuleCatalogStatusBadge", 'className="module-catalog-card"', "onEdit", "onDuplicate", "onDelete", "data-module-overlay"]) assert.ok(source.includes(marker), `${file}: ${marker}`);
  }
  const route = readFileSync("backend/src/routes/fragebogen.ts", "utf8");
  assert.ok(route.indexOf('use(requireAuth(["admin", "kunde"]))') < route.indexOf("use(createModuleCatalogStateRouter"));
  assert.ok(route.indexOf("use(requireKundeAdminPermission)") < route.indexOf("use(createModuleCatalogStateRouter"));
});
