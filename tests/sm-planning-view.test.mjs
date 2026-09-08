import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const url = new URL("../src/lib/sm/planningView.ts", import.meta.url);
const source = await readFile(url, "utf8");
const module = { exports: {} }, require = createRequire(url);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
runInNewContext(compiled.outputText, { module, exports: module.exports, require });
const { filterAdminGmPlanningVisits, recommendedUserFirst } = module.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

const visit = (id, gmId, gmName, region, section) => ({
  id, workDate: "2026-09-08", startedAt: "2026-09-08T06:00:00Z", submittedAt: "2026-09-08T07:00:00Z", durationMinutes: 60,
  gm: { id: gmId, name: gmName, region },
  market: { id: `m-${id}`, internalId: `S-${id}`, name: `Markt ${id}`, address: `Straße ${id}`, postalCode: "1010", city: "Wien", region },
  sections: [{ id: `s-${id}`, section, campaignName: section, fragebogenName: section, questionCount: 1, answeredCount: 1, photoCount: 0 }],
  totals: { questionCount: 1, answeredCount: 1, photoCount: 0 },
});

test("GM filters are applied only to the GM visit collection", () => {
  const visits = [visit("1", "gm-a", "Anna Nord", "Nord", "flex"), visit("2", "gm-b", "Berta Süd", "Süd", "kuehler")];
  const smRows = [{ id: "sm-1" }, { id: "sm-2" }];
  const filtered = filterAdminGmPlanningVisits(visits, { search: "", gmUserId: "gm-a", region: "all", section: "flex" });
  assert.deepEqual(filtered.map((entry) => entry.id), ["1"]);
  assert.deepEqual(smRows.map((entry) => entry.id), ["sm-1", "sm-2"]);
  assert.deepEqual(filterAdminGmPlanningVisits(visits, { search: "süd", gmUserId: "all", region: "Süd", section: "all" }).map((entry) => entry.id), ["2"]);
});

test("the synchronized SM is first without removing or auto-selecting alternatives", () => {
  const users = [
    { id: "b", firstName: "Berta", lastName: "Beta" },
    { id: "a", firstName: "Anna", lastName: "Alpha" },
    { id: "c", firstName: "Clara", lastName: "Gamma" },
  ];
  assert.deepEqual(plain(recommendedUserFirst(users, "c").map((user) => user.id)), ["c", "a", "b"]);
  assert.deepEqual(users.map((user) => user.id), ["b", "a", "c"]);
  assert.deepEqual(plain(recommendedUserFirst(users, null).map((user) => user.id)), ["a", "b", "c"]);
});

test("the GM overlay is explicitly read-only and conditionally fetched", async () => {
  const workspace = await readFile(new URL("../src/components/admin/sm/SmVerplanungWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /if \(!showGmVisits\) return/);
  assert.match(workspace, /Abgeschlossen · Nur lesen/);
  assert.match(workspace, /setDrawerMode\(null\); setSelectedAssignment\(null\); setSelectedGmVisit\(visit\)/);
  assert.doesNotMatch(workspace, /updateGmPlanning|deleteGmPlanning|restoreGmPlanning/);
});
