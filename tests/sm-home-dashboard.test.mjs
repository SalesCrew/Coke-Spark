import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function loadTs(path, mocks = {}) {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: url.pathname,
  });
  const module = { exports: {} };
  const require = createRequire(url);
  runInNewContext(outputText, { module, exports: module.exports, require: (name) => mocks[name] ?? require(name), Intl, Date });
  return module.exports;
}

const logic = await loadTs("../src/lib/sm/homeDashboard.ts");
const { SmDashboardHeroCard, SmDashboardHeroSkeleton } = await loadTs("../src/components/dashboard/SmDashboardHero.tsx", {
  "@/lib/sm/homeDashboard": logic,
  "@/lib/api/backend": {},
});
const fixture = (overrides = {}) => ({
  userId: "sm-one", name: "Alina Test", assignmentsToday: 2, date: "2026-08-31",
  timezone: "Europe/Vienna", generatedAt: "2026-08-31T12:00:00Z",
  visits: { completed: 0, classified: 0, withoutOos: 0, fixedOos: 0, openOos: 0, unclassified: 0 },
  ...overrides,
});
const renderCard = (data, error = false, loading = false) => renderToStaticMarkup(createElement(SmDashboardHeroCard, { data, error, loading, onRetry() {} }));
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("hero skeleton represents header, three legend items, bar and caption without fake data", () => {
  const markup = renderToStaticMarkup(createElement(SmDashboardHeroSkeleton));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /motion-safe:animate-pulse/);
  assert.match(markup, /grid-cols-3/);
  assert.match(markup, /h-2\.5/);
  assert.doesNotMatch(markup, /Max Mustermann|60%|28%|12%|<button/);
});

test("initial loading never displays a zero-count or default identity", () => {
  assert.equal(renderCard(null, false, true), renderToStaticMarkup(createElement(SmDashboardHeroSkeleton)));
});

test("empty days and unfinished questionnaires have distinct truthful states", () => {
  assert.match(renderCard(fixture({ assignmentsToday: 0 })), /Heute sind keine Einsätze geplant/);
  assert.match(renderCard(fixture()), /nach dem ersten Abschluss/);
  assert.match(renderCard(fixture()), /Alina Test/);
  assert.doesNotMatch(renderCard(fixture()), /flex-grow/);
});

test("completed but unclassified visits do not claim no OOS", () => {
  const markup = renderCard(fixture({ visits: { completed: 1, classified: 0, withoutOos: 0, fixedOos: 0, openOos: 0, unclassified: 1 } }));
  assert.match(markup, /noch keine auswertbaren OOS-Antworten/);
  assert.doesNotMatch(markup, /flex-grow/);
});

test("live segments preserve relative counts and zero segments create no gaps", () => {
  const markup = renderCard(fixture({ visits: { completed: 3, classified: 3, withoutOos: 1, fixedOos: 2, openOos: 0, unclassified: 0 } }));
  assert.match(markup, /flex-grow:1/);
  assert.match(markup, /flex-grow:2/);
  assert.equal((markup.match(/flex-grow:/g) ?? []).length, 2);
  assert.match(markup, /3 Besuche heute abgeschlossen/);
  assert.match(markup, /role="img"/);
});

test("initial errors are not empty success and refresh failures preserve loaded values", () => {
  assert.match(renderCard(null, true), /gerade nicht erreichbar/);
  assert.match(renderCard(null, true), /Tagesübersicht erneut laden/);
  assert.doesNotMatch(renderCard(null, true), /keine Einsätze geplant/);
  assert.match(renderCard(fixture(), true), /Letzter geladener Stand/);
  assert.match(renderCard(fixture(), true), /Alina Test/);
});

test("Vienna dates and a single midnight wake-up work across summer/winter DST", () => {
  assert.equal(logic.smHomeDate(new Date("2026-08-31T22:30:00Z")), "2026-09-01");
  assert.equal(logic.smHomeDate(new Date("2026-01-31T22:30:00Z")), "2026-01-31");
  for (const [now, nextMidnight] of [
    ["2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"],
    ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"],
    ["2026-08-31T12:00:00Z", "2026-08-31T22:00:00Z"],
  ]) assert.equal(logic.smHomeDayRolloverDelay(new Date(now)), Date.parse(nextMidnight) - Date.parse(now) + 50);
});

function makeLoader(fetcher, extra = {}) {
  const changes = [];
  const loader = logic.createSmHomeLoader({ owner: "sm-one", getOwner: () => "sm-one", fetch: fetcher, getDate: () => "2026-08-31", onChange: (state) => changes.push(state), ...extra });
  return { ...loader, changes };
}

test("focus/visibility events deduplicate; a submission during a pending read queues one fresh read", async () => {
  let resolve;
  let calls = 0;
  const loader = makeLoader(() => { calls++; return new Promise((r) => { resolve = r; }); });
  const first = loader.refresh();
  loader.refresh();
  await flush();
  assert.equal(calls, 1);
  loader.refresh(true);
  loader.refresh(true);
  resolve(fixture());
  await first;
  await flush();
  assert.equal(calls, 2);
  resolve(fixture({ assignmentsToday: 3 }));
  await flush();
  assert.equal(loader.changes.at(-1).data.assignmentsToday, 3);
});

test("old account responses, including an A-B-A switch, are discarded after cleanup", async () => {
  let resolve;
  let owner = "sm-one";
  const loader = makeLoader(() => new Promise((r) => { resolve = r; }), { getOwner: () => owner });
  const first = loader.refresh();
  await flush();
  owner = "sm-two";
  loader.dispose();
  owner = "sm-one";
  resolve(fixture());
  await first;
  assert.equal(loader.changes.length, 1);
  assert.equal(loader.changes[0].data, null);
});

test("offline refresh preserves today's known values and retry recovers", async () => {
  let fail = false;
  const loader = makeLoader(async () => { if (fail) throw new Error("offline"); return fixture(); });
  await loader.refresh();
  fail = true;
  await loader.refresh();
  assert.equal(loader.changes.at(-1).error, true);
  assert.equal(loader.changes.at(-1).data.assignmentsToday, 2);
  fail = false;
  await loader.refresh();
  assert.equal(loader.changes.at(-1).error, false);
});

test("midnight clears yesterday's numbers, even if the next request fails", async () => {
  let date = "2026-08-31";
  const loader = makeLoader(async () => fixture(), { getDate: () => date });
  await loader.refresh();
  date = "2026-09-01";
  await loader.refresh();
  assert.equal(loader.changes.at(-1).data, null);
  assert.equal(loader.changes.at(-1).error, true);
});

test("incorrect identity/date responses produce an error instead of leaking or retrying forever", async () => {
  let calls = 0;
  const loader = makeLoader(async () => { calls++; return fixture({ userId: "sm-other" }); });
  await loader.refresh();
  assert.equal(calls, 1);
  assert.equal(loader.changes.at(-1).data, null);
  assert.equal(loader.changes.at(-1).error, true);
});

test("SM page uses the live hero and refreshes after successful submission without polling", async () => {
  const [page, component, api] = await Promise.all([
    readFile(new URL("../src/app/(dashboard)/sm/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard/SmDashboardHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/backend.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<SmDashboardHero \/>/);
  assert.doesNotMatch(page, /<StatusCard/);
  assert.match(api.slice(api.indexOf("export async function submitSmVisit"), api.indexOf("export async function discardSmVisit")), /dispatchEvent\(new Event\(SM_HOME_DASHBOARD_CHANGED_EVENT\)\)/);
  assert.match(component, /state\.data\?\.userId === owner/);
  assert.match(component, /loader\.dispose\(\)/);
  assert.doesNotMatch(component, /setInterval/);
});
