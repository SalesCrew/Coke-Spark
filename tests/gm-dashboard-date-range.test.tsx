import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIntervals } from "../src/lib/ipp-dashboard/intervals";
import { buildDashboardIntervals, dashboardStartDate, limitDashboardIntervals } from "../src/lib/gm-dashboard/date-range";
import { IppIntervalToolbar } from "../src/components/admin/gm-dashboard/IppIntervalToolbar";

const now = new Date("2026-09-29T12:00:00Z");
const minStartDate = dashboardStartDate("2026-07-06")!;
test("one calendar day of buffer, including leap days, DST, and year boundaries", () => {
  assert.equal(minStartDate, "2026-07-05");
  assert.equal(dashboardStartDate("2026-01-01"), "2025-12-31");
  assert.equal(dashboardStartDate("2024-03-01"), "2024-02-29");
  assert.equal(dashboardStartDate("2026-03-30"), "2026-03-29");
  for (const date of [null, undefined, "", "2026-02-30", "2026-07-06T10:00:00Z"]) {
    assert.equal(dashboardStartDate(date), null);
  }
});

test("quarter/month/week filters hide older history and clip only the first overlapping period", () => {
  for (const mode of ["quarter", "month", "week"] as const) {
    const intervals = buildDashboardIntervals({ mode, now, count: 36, minStartDate });
    assert.ok(intervals.length);
    assert.ok(intervals.every((interval) => interval.start >= minStartDate && interval.end >= minStartDate));
    assert.equal(intervals.at(-1)!.start, minStartDate);
    assert.deepEqual(intervals.map((i) => i.id), buildIntervals({ mode, now, count: 36 }).filter((i) => i.end >= minStartDate).map((i) => i.id));
  }
  const quarters = buildDashboardIntervals({ mode: "quarter", now, minStartDate });
  assert.deepEqual(quarters.map((i) => i.shortLabel), ["Q3 26"]);
  const html = renderToStaticMarkup(<IppIntervalToolbar mode="quarter" onModeChange={() => {}} intervals={quarters} selectedIntervalId={quarters[0].id} onSelectInterval={() => {}} />);
  assert.match(html, /2026-07-05 - 2026-09-30/);
  assert.doesNotMatch(html, /Q2 26|Q1 26|Q4 25|2024-/);
});

test("RED uses real calendar periods, retains IDs and does not invent fallback periods", () => {
  const redMonthCalendar = [
    { id: "red-06", label: "RED 06", start: "2026-06-01", end: "2026-07-03", year: 2026, periodIndex: 6 },
    { id: "red-07", label: "RED 07", start: "2026-07-06", end: "2026-07-31", year: 2026, periodIndex: 7 },
    { id: "red-08", label: "RED 08", start: "2026-08-03", end: "2026-08-28", year: 2026, periodIndex: 8 },
  ] as Parameters<typeof buildIntervals>[0]["redMonthCalendar"];
  const intervals = buildDashboardIntervals({ mode: "redmonth", now, redMonthCalendar, minStartDate });
  assert.deepEqual(intervals.map((i) => i.id), ["red-08", "red-07"]);
  assert.equal(intervals.at(-1)!.start, "2026-07-06");
  assert.deepEqual(buildDashboardIntervals({ mode: "redmonth", now, minStartDate }), []);
});

test("no data/loading creates no selectable history; internal gaps and genuine zero periods are not removed", () => {
  assert.deepEqual(buildDashboardIntervals({ mode: "quarter", now, minStartDate: null }), []);
  const intervals = [
    { id: "old", start: "2026-01-01", end: "2026-01-31" },
    { id: "first", start: "2026-07-01", end: "2026-07-31" },
    { id: "gap-or-zero", start: "2026-08-01", end: "2026-08-31" },
    { id: "latest", start: "2026-09-01", end: "2026-09-30" },
  ];
  const original = structuredClone(intervals);
  assert.deepEqual(limitDashboardIntervals(intervals, minStartDate).map((i) => i.id), ["first", "gap-or-zero", "latest"]);
  assert.deepEqual(intervals, original);
  assert.deepEqual(limitDashboardIntervals([{ start: "2026-01-01", end: "2026-09-29" }], minStartDate), [{ start: minStartDate, end: "2026-09-29" }]);
});

test("all dashboard cards use the shared boundary and activity calendar cannot select earlier dates", () => {
  for (const name of ["IppAuswertungCard", "FuellstandCard", "PlatzierungenCard"]) {
    const source = readFileSync(new URL(`../src/components/admin/gm-dashboard/${name}.tsx`, import.meta.url), "utf8");
    assert.match(source, /buildDashboardIntervals\(/);
    assert.match(source, /minStartDate: facets.startDate/);
  }
  const activity = readFileSync(new URL("../src/components/admin/gm-dashboard/PlaceholderCardNine.tsx", import.meta.url), "utf8");
  assert.match(activity, /limitDashboardIntervals\(/);
  assert.match(activity, /day.key < minDate/);
  assert.match(activity, /disabled=\{disabled\}/);
  assert.match(activity, /minDate=\{facets.startDate\}/);
});
