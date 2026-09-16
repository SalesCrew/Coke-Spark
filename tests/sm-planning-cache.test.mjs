import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
}
const source = readFileSync(new URL("../src/lib/api/backend.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("backend.ts", source, ts.ScriptTarget.Latest, true);
const selected = new Set(["SM_VISIT_PRELOAD_CACHE_PREFIX", "SM_PLANNING_ASSIGNMENTS_CACHE_PREFIX", "smVisitPreloadMemoryCache",
  "getSmPlanningAssignmentsCacheKey", "setMySmPlanningAssignmentsCache", "readMySmPlanningAssignmentsCache", "clearMySmPlanningAssignmentsCache",
  "getSmVisitPreloadMemoryKey", "getSmVisitPreloadCacheKey", "isValidSmVisitPreloadPayload", "setSmVisitPreloadCache", "readSmVisitPreloadCache", "clearSmVisitPreloadCache",
  "fetchMySmPlanningAssignments", "fetchSmVisit", "createSmRequestOwnerGuard"]);
// Execute the real selected declarations; only storage, auth and network boundaries are injected.
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) ? selected.has(node.name?.text)
  : ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => selected.has(declaration.name.getText(ast))));
const compiled = ts.transpileModule(declarations.map(node => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness() {
  const window = { localStorage: storage(), sessionStorage: storage() }, listeners = new Set();
  let owner = "sm-a", fetcher = async () => ({ assignments: [] });
  class BackendApiError extends Error { constructor(code) { super(code); this.code = code; } }
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, window, Date, Error, BackendApiError,
    visibleSmAssignments: rows => rows.filter(row => row.status !== "cancelled"),
    getActiveAuthUserId: () => owner, readAuthSession: () => owner, getAuthPrincipalKey: session => session,
    subscribeAuthSession: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    authedFetch: (...args) => fetcher(...args), isSmOfflineCacheTimestampFresh: value => value > Date.now() - 86400000 && value <= Date.now() + 60000,
    sanitizeSmVisitPayloadForPersistentCache: payload => payload,
  });
  return { api: module.exports, window, listeners, BackendApiError,
    setOwner: value => { owner = value; listeners.forEach(callback => callback()); }, setFetch: value => { fetcher = value; } };
}
const from = "2026-09-01", to = "2026-09-30";
const assignment = (id, status = "planned") => ({ id, status, effective: { workDate: "2026-09-15" } });
const payload = id => ({ assignment: { id }, sections: [], answers: {}, answerVersions: {}, photoFiles: {} });

test("legacy cancelled cache entries never render; only their preload is retired", () => {
  const h = harness(), { api, window } = h;
  api.setSmVisitPreloadCache("cancelled", payload("cancelled"));
  const pendingKey = "sm_visit_pending_answers_v1:sm-a:cancelled";
  window.localStorage.setItem(pendingKey, "unsynchronized answers");
  window.localStorage.setItem(`sm_planning_assignments_v1:sm-a:${from}:${to}`, JSON.stringify({ ownerUserId: "sm-a", from, to, createdAtMs: Date.now(), assignments: [assignment("cancelled", "cancelled"), assignment("missed", "missed")] }));
  assert.deepEqual(Array.from(api.readMySmPlanningAssignmentsCache(from, to), row => row.id), ["missed"]);
  assert.equal(api.readSmVisitPreloadCache("cancelled"), null);
  assert.equal(window.localStorage.getItem(pendingKey), "unsynchronized answers");
});

test("authoritative cache replacement supports restore and isolates owner/range", () => {
  const h = harness(), { api } = h;
  api.setMySmPlanningAssignmentsCache(from, to, [assignment("one"), assignment("two", "cancelled")]);
  assert.equal(api.readMySmPlanningAssignmentsCache(from, to).length, 1);
  api.setMySmPlanningAssignmentsCache(from, to, [assignment("two")]);
  assert.deepEqual(Array.from(api.readMySmPlanningAssignmentsCache(from, to), row => row.id), ["two"]);
  assert.equal(api.readMySmPlanningAssignmentsCache("2026-10-01", "2026-10-31"), null);
  h.setOwner("sm-b"); assert.equal(api.readMySmPlanningAssignmentsCache(from, to), null);
  h.setOwner("sm-a"); assert.equal(api.readMySmPlanningAssignmentsCache(from, to)[0].id, "two");
});

test("delayed API results are rejected after A-B and A-B-A switches; listeners are cleaned", async () => {
  for (const backToA of [false, true]) {
    const h = harness(); let resolve;
    h.setFetch(() => new Promise(done => { resolve = done; }));
    const pending = h.api.fetchMySmPlanningAssignments(from, to);
    h.setOwner("sm-b"); if (backToA) h.setOwner("sm-a");
    resolve({ assignments: [assignment("old")] });
    await assert.rejects(pending, /Zugang hat sich geändert/);
    assert.equal(h.listeners.size, 0);
  }
});

test("cancelled direct-link error clears current owner's preload but never another owner's or pending answers", async () => {
  const h = harness();
  h.api.setSmVisitPreloadCache("one", payload("one"));
  h.window.localStorage.setItem("sm_visit_pending_answers_v1:sm-a:one", "pending");
  h.setFetch(async () => { throw new h.BackendApiError("sm_visit_assignment_cancelled"); });
  await assert.rejects(h.api.fetchSmVisit("one"));
  assert.equal(h.api.readSmVisitPreloadCache("one"), null);
  assert.equal(h.window.localStorage.getItem("sm_visit_pending_answers_v1:sm-a:one"), "pending");
  assert.equal(h.listeners.size, 0);
  let reject; h.setFetch(() => new Promise((_resolve, fail) => { reject = fail; }));
  const pending = h.api.fetchSmVisit("one"); h.setOwner("sm-b");
  h.api.setSmVisitPreloadCache("one", payload("one")); reject(new h.BackendApiError("sm_visit_assignment_cancelled"));
  await assert.rejects(pending); assert.ok(h.api.readSmVisitPreloadCache("one"));
});
