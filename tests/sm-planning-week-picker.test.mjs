import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function load(path, mocks = {}) {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  const module = { exports: {} }, require = createRequire(url);
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(compiled.outputText, { module, exports: module.exports, require: (name) => mocks[name] ?? require(name) });
  return module.exports;
}
const dates = await load("../src/lib/sm/calendarWeeks.ts");
const { SmWeekCalendar, SmPlanningWeekPicker } = await load("../src/components/admin/sm/SmPlanningWeekPicker.tsx", { "@/lib/sm/calendarWeeks": dates });
const plain = (value) => JSON.parse(JSON.stringify(value));
const props = { month: "2026-09-01", start: "2026-08-31", end: "2026-08-31", pendingStart: null, today: "2026-08-31", error: null, onChoose() {}, onChooseCurrent() {}, onMonthChange() {} };

test("every day selects the containing ISO week, never a rolling seven-day range", () => {
  for (const day of ["2026-08-31", "2026-09-01", "2026-09-04", "2026-09-06"]) {
    assert.deepEqual(plain(dates.calendarWeek(day)), { start: "2026-08-31", end: "2026-09-06", number: 36, year: 2026 });
  }
  assert.equal(dates.calendarWeek("2026-09-07").number, 37);
});

test("week year, KW 53, leap day and month boundaries follow ISO 8601", () => {
  for (const [date, number, year, start] of [["2027-01-01", 53, 2026, "2026-12-28"], ["2027-01-04", 1, 2027, "2027-01-04"], ["2025-12-31", 1, 2026, "2025-12-29"], ["2024-02-29", 9, 2024, "2024-02-26"]]) {
    const week = dates.calendarWeek(date);
    assert.equal(week.number, number); assert.equal(week.year, year); assert.equal(week.start, start);
  }
  assert.equal(dates.shiftCalendarMonth("2026-12-28", 1), "2027-01-01");
  assert.equal(dates.shiftCalendarMonth("2027-01-04", -1), "2026-12-01");
});

test("month grid contains complete Monday–Sunday weeks including adjacent-month dates", () => {
  const weeks = dates.monthCalendarWeeks("2026-09-01");
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0].start, "2026-08-31"); assert.equal(weeks.at(-1).end, "2026-10-04");
  for (const week of weeks) {
    assert.equal(week.days.length, 7);
    assert.equal(new Date(`${week.start}T12:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${week.end}T12:00:00Z`).getUTCDay(), 0);
  }
  assert.equal(dates.monthCalendarWeeks("2026-02-01").length, 5);
  assert.equal(dates.monthCalendarWeeks("2021-02-01").length, 4);
  assert.equal(dates.monthCalendarWeeks("2026-08-01").length, 6);
});

test("planner offsets remain integral across Austrian DST changes, in either direction", () => {
  for (const [base, value, expected] of [["2026-03-23", "2026-03-30", 1], ["2026-10-19", "2026-10-26", 1], ["2026-10-26", "2026-10-19", -1], ["2026-08-31", "2026-12-08", 14], ["2026-12-28", "2027-01-04", 1]]) {
    assert.equal(dates.calendarWeekOffset(base, value), expected);
  }
});

test("KW ranges normalize reverse selection and count inclusive weeks", () => {
  assert.deepEqual(plain(dates.calendarWeekRange("2026-09-21", "2026-08-31")), { start: "2026-08-31", end: "2026-09-21", weekCount: 4 });
  assert.deepEqual(plain(dates.calendarWeekRange("2026-08-31", "2026-08-31")), { start: "2026-08-31", end: "2026-08-31", weekCount: 1 });
});

test("calendar renders a KW range with full endpoints and a subdued middle", () => {
  const rangeProps = { ...props, end: "2026-09-14" };
  const html = renderToStaticMarkup(createElement(SmWeekCalendar, rangeProps));
  assert.match(html, />KW<\/span>/);
  assert.match(html, /September 2026/);
  assert.equal((html.match(/data-week-start=/g) ?? []).length, 5);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3);
  assert.equal((html.match(/<button/g) ?? []).length, 8); // 5 weeks, 2 month arrows, current KW.
  assert.match(html, /is-range-start/); assert.match(html, /is-in-range/); assert.match(html, /is-range-end/);
  assert.match(html, /is-outside/);
});

function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

test("clicking anywhere in a week row selects its Monday; browsing months and current-week shortcut remain distinct", () => {
  const chosen = [], months = [], current = [];
  const nodes = elements(SmWeekCalendar({ ...props, onChoose: (value) => chosen.push(value), onChooseCurrent: () => current.push(true), onMonthChange: (value) => months.push(value) }));
  nodes.find((node) => node.props?.["aria-label"] === "Nächster Monat").props.onClick();
  assert.deepEqual(months, [1]); assert.deepEqual(chosen, []);
  nodes.find((node) => node.props?.["data-week-start"] === "2026-09-07").props.onClick();
  assert.deepEqual(chosen, ["2026-09-07"]);
  nodes.find((node) => node.type === "button" && node.props.children === "Aktuelle KW").props.onClick();
  assert.deepEqual(chosen, ["2026-09-07"]); assert.deepEqual(current, [true]);
});

test("keyboard week navigation previews focus without selecting or fetching another week", () => {
  const chosen = [], focused = [];
  const rows = elements(SmWeekCalendar({ ...props, onChoose: (value) => chosen.push(value) })).filter((node) => node.props?.["data-week-start"]);
  const buttons = rows.map((_, index) => ({ focus: () => focused.push(index) }));
  const currentTarget = buttons[1];
  currentTarget.parentElement = { querySelectorAll: () => buttons };
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    let prevented = false;
    rows[1].props.onKeyDown({ key, currentTarget, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.deepEqual(focused, [2, 0, 0, 4]); assert.deepEqual(chosen, []);
});

test("trigger announces a KW range and planner integration stores both endpoints", async () => {
  const html = renderToStaticMarkup(createElement(SmPlanningWeekPicker, { start: "2026-08-31", end: "2026-09-14", onChange() {} }));
  assert.match(html, /aria-haspopup="dialog"/); assert.match(html, /aria-expanded="false"/);
  assert.match(html, /KW 36–38/);
  assert.match(html, /sm-plan-week-row:hover/);
  const source = await readFile(new URL("../src/components/admin/sm/SmPlanningWeekPicker.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /onMouseEnter|onPointerEnter|onMouseMove/);
  assert.match(source, /if \(!pendingStart\)/); assert.match(source, /onChange\(range\.start, range\.end\)/);
  assert.match(source, /MAX_RANGE_WEEKS = 13/); assert.match(source, /is-in-range/);
  assert.match(source, /rect.bottom \+ 6/); assert.match(source, /createPortal/);
  assert.match(source, /event.key !== "Escape"/); assert.match(source, /handleOutside/);
  const planner = await readFile(new URL("../src/components/admin/sm/SmVerplanungWorkspace.tsx", import.meta.url), "utf8");
  assert.match(planner, /<SmPlanningWeekPicker start=\{selectedWeekStartKey\} end=\{selectedWeekEndKey\}/);
  assert.match(planner, /setSelectedWeekStartKey\(start\)/); assert.match(planner, /setSelectedWeekEndKey\(end\)/);
});
