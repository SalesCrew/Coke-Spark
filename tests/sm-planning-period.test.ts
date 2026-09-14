import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SmDayCalendar, SmMonthCalendar } from "../src/components/admin/sm/SmPlanningPeriodPicker";
import { currentSmPeriod, periodDayCount, shiftSmPeriod, smDayPeriod, smMonthPeriod, smPeriodExportSlug, smPeriodHeading, smPeriodLabel, smWeekPeriod } from "../src/lib/sm/planningPeriod";

test("a day or custom range stays exact rather than expanding to Monday–Sunday", () => {
  assert.deepEqual(smDayPeriod("2026-09-16"), { mode: "days", from: "2026-09-16", to: "2026-09-16" });
  assert.deepEqual(smDayPeriod("2026-09-30", "2026-09-01"), { mode: "days", from: "2026-09-01", to: "2026-09-30" });
  assert.equal(periodDayCount("2026-09-01", "2026-09-30"), 30);
  assert.throws(() => smDayPeriod("2026-02-30"));
  assert.throws(() => smDayPeriod("bad-date"));
});

test("full months use real final days, including leap years and December", () => {
  for (const [day, last] of [["2026-09-14", "2026-09-30"], ["2026-02-20", "2026-02-28"], ["2028-02-12", "2028-02-29"], ["2026-12-31", "2026-12-31"], ["2026-04-01", "2026-04-30"]]) {
    assert.deepEqual(smMonthPeriod(day), { mode: "month", from: `${day.slice(0,7)}-01`, to: last });
  }
  assert.deepEqual(shiftSmPeriod(smMonthPeriod("2026-12-01"), 1), smMonthPeriod("2027-01-01"));
  assert.deepEqual(shiftSmPeriod(smMonthPeriod("2026-03-31"), -1), smMonthPeriod("2026-02-01"));
});

test("navigation and counts do not drift at Vienna DST boundaries", () => {
  for (const first of ["2026-03-28", "2026-10-24"]) {
    const range = smDayPeriod(first, first.slice(0,8) + String(Number(first.slice(8)) + 2));
    assert.equal(periodDayCount(range.from, range.to), 3);
    assert.deepEqual(shiftSmPeriod(shiftSmPeriod(range, 1), -1), range);
  }
  assert.equal(shiftSmPeriod(smDayPeriod("2026-03-29"), 1).from, "2026-03-30");
  assert.equal(shiftSmPeriod(smDayPeriod("2026-10-25"), 1).from, "2026-10-26");
});

test("KW mode retains ISO boundaries, 13-week limit and one-week navigation", () => {
  const period = smWeekPeriod("2026-09-01", "2026-09-15");
  assert.deepEqual(period, { mode: "week", from: "2026-08-31", to: "2026-09-20" });
  assert.equal(shiftSmPeriod(period, 1).from, "2026-09-07");
  assert.equal(smWeekPeriod("2027-01-01").from, "2026-12-28");
  assert.throws(() => smWeekPeriod("2026-01-05", "2026-04-06"), /13 KWs/);
  assert.equal(periodDayCount(smWeekPeriod("2026-01-05", "2026-03-30").from, smWeekPeriod("2026-01-05", "2026-03-30").to), 91);
});

test("custom ranges match the backend's inclusive 93-day limit", () => {
  assert.equal(periodDayCount(smDayPeriod("2026-01-01", "2026-04-03").from, "2026-04-03"), 93);
  assert.throws(() => smDayPeriod("2026-01-01", "2026-04-04"), /93 Tage/);
});

test("today, heading and export labels use the selected mode and exact boundaries", () => {
  assert.deepEqual(currentSmPeriod("days", "2026-09-14"), smDayPeriod("2026-09-14"));
  assert.deepEqual(currentSmPeriod("month", "2026-09-14"), smMonthPeriod("2026-09-14"));
  assert.equal(smPeriodHeading(smDayPeriod("2026-09-14")), "Tagesplanung");
  assert.equal(smPeriodHeading(smMonthPeriod("2026-09-14")), "Monatsplanung");
  assert.match(smPeriodLabel(smMonthPeriod("2026-09-14"), true), /01.09.2026.*30.09.2026/);
  assert.match(smPeriodLabel(smWeekPeriod("2026-12-28", "2027-01-04")), /53\/2026.*1\/2027/);
  assert.equal(smPeriodExportSlug(smDayPeriod("2026-09-14")), "2026-09-14");
  assert.equal(smPeriodExportSlug(smMonthPeriod("2026-09-14")), "2026-09");
  assert.equal(smPeriodExportSlug(smDayPeriod("2026-09-01", "2026-09-30")), "2026-09-01_2026-09-30");
});

test("the planner sends exact boundaries to existing APIs and exports only the loaded view", async () => {
  const source = await readFile(new URL("../src/components/admin/sm/SmVerplanungWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /const rangeStartKey = period.from/); assert.match(source, /const rangeEndKey = period.to/);
  assert.match(source, /fetchSmPlanningAssignments\(rangeStartKey, rangeEndKey\)/);
  assert.match(source, /fetchAdminGmPlanningVisits\(rangeStartKey, rangeEndKey\)/);
  assert.match(source, /if \(periodLoading \|\| loadError\)/);
  assert.match(source, /smPeriodExportSlug\(period\)/);
  assert.match(source, /row.effective.workDate < rangeStartKey \|\| row.effective.workDate > rangeEndKey/);
  assert.match(source, /visibleRangeRef.current !== requestedRange/);
  const backend = await readFile(new URL("../backend/src/routes/sm-planning.ts", import.meta.url), "utf8");
  assert.match(backend, /gte\(effectiveDate, from\)/); assert.match(backend, /lte\(effectiveDate, to\)/);
  assert.match(backend, /isoDateToEpochDay\(parsed.data.to\) - isoDateToEpochDay\(parsed.data.from\) > 92/);
});

test("day calendar renders individual accessible days and an exact day highlight", () => {
  const html = renderToStaticMarkup(createElement(SmDayCalendar, { month: "2026-09-01", from: "2026-09-14", to: "2026-09-14", today: "2026-09-14", onChoose() {}, onMonthChange() {} }));
  assert.equal((html.match(/data-day=/g) ?? []).length, 35);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /aria-label="14. September 2026"/);
  assert.doesNotMatch(html, /data-week-start=/);
  const months = renderToStaticMarkup(createElement(SmMonthCalendar, { month: "2028-02-01", value: smMonthPeriod("2028-02-01"), onChoose() {}, onYearChange() {} }));
  assert.match(months, /Februar 2028/);
  assert.equal((months.match(/aria-pressed=/g) ?? []).length, 12);
  assert.equal((months.match(/aria-pressed="true"/g) ?? []).length, 1);
});

function elements(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

test("clicking a day yields that date, while arrow keys only move keyboard focus", () => {
  const chosen: string[] = [], focused: number[] = [];
  const nodes = elements(SmDayCalendar({ month: "2026-09-01", from: "2026-09-14", to: "2026-09-14", today: "2026-09-14", onChoose: (day) => chosen.push(day), onMonthChange() {} }));
  const dayNodes = nodes.filter((node) => node.props?.["data-day"]);
  dayNodes.find((node) => node.props["data-day"] === "2026-09-16").props.onClick();
  assert.deepEqual(chosen, ["2026-09-16"]);
  const buttons: any[] = dayNodes.map((_, index) => ({ focus: () => focused.push(index) }));
  buttons[10].parentElement = { querySelectorAll: () => buttons };
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) dayNodes[10].props.onKeyDown({ key, currentTarget: buttons[10], preventDefault() {} });
  assert.deepEqual(focused, [9, 11, 3, 17, 7, 13]);
  assert.deepEqual(chosen, ["2026-09-16"]);
});
