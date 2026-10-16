import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/sm/dashboardFilters.ts", import.meta.url), "utf8");
const module = { exports: {} };
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports });
const { smDashboardFilterOptions, reconcileSmDashboardFilters } = module.exports;
const contexts = [
  { value: "a", label: "Markt A", region: "Nord", chain: "Billa", sms: [{ value: "anna", label: "Anna" }, { value: "berta", label: "Berta" }] },
  { value: "b", label: "Markt B", region: "Nord", chain: "Spar", sms: [{ value: "anna", label: "Anna" }] },
  { value: "c", label: "Markt C", region: "Süd", chain: "Billa", sms: [{ value: "berta", label: "Berta" }] },
  { value: "d", label: "Ohne Besuch", region: "Süd", chain: "Spar", sms: [] },
];
const empty = { from: "2026-10-01", to: "2026-10-15", region: "", chain: "", marketId: "", smUserId: "" };
const plain = value => JSON.parse(JSON.stringify(value));
const values = options => Array.from(options, option => option.value);

test("facets combine every other dimension and ignore only their own value", () => {
  const options = smDashboardFilterOptions(contexts, { ...empty, region: "Nord", chain: "Billa" });
  assert.deepEqual(values(options.markets), ["a"]);
  assert.deepEqual(values(options.sms), ["anna", "berta"]);
  assert.deepEqual(values(options.chains), ["Billa", "Spar"]);
  assert.deepEqual(values(options.regions), ["Nord", "Süd"]);
  const restricted = smDashboardFilterOptions(contexts, { ...empty, region: "Nord", chain: "Spar", smUserId: "anna" });
  assert.deepEqual(values(restricted.markets), ["b"]);
  assert.deepEqual(values(restricted.sms), ["anna"]);
});

test("market-to-SM and SM-to-market both work, including historical visitors", () => {
  assert.deepEqual(values(smDashboardFilterOptions(contexts, { ...empty, marketId: "a" }).sms), ["anna", "berta"]);
  assert.deepEqual(values(smDashboardFilterOptions(contexts, { ...empty, smUserId: "anna" }).markets), ["a", "b"]);
  assert.deepEqual(values(smDashboardFilterOptions(contexts, { ...empty, marketId: "d" }).sms), []);
});

test("the most recent choice wins; compatible choices and date bounds survive", () => {
  const before = { ...empty, region: "Nord", chain: "Billa", marketId: "a", smUserId: "anna" };
  assert.deepEqual(plain(reconcileSmDashboardFilters({ ...before, region: "Süd" }, contexts, "region")), { ...empty, region: "Süd", chain: "Billa" });
  assert.deepEqual(plain(reconcileSmDashboardFilters({ ...before, smUserId: "berta" }, contexts, "smUserId")), { ...before, smUserId: "berta" });
  assert.deepEqual(before, { ...empty, region: "Nord", chain: "Billa", marketId: "a", smUserId: "anna" });
});

test("clearing a parent keeps valid children, and a changed directory clears stale selections", () => {
  const chosen = { ...empty, region: "Nord", chain: "Spar", marketId: "b", smUserId: "anna" };
  assert.deepEqual(plain(reconcileSmDashboardFilters({ ...chosen, region: "" }, contexts, "region")), { ...chosen, region: "" });
  assert.deepEqual(plain(reconcileSmDashboardFilters(chosen, [])), empty);
});

test("deduplication uses IDs, so equal names never merge different SMs", () => {
  const duplicate = { ...contexts[0], sms: [{ value: "one", label: "Same Name" }, { value: "two", label: "Same Name" }, { value: "one", label: "Same Name" }] };
  assert.deepEqual(values(smDashboardFilterOptions([duplicate], empty).sms), ["one", "two"]);
});
