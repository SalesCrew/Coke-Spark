import assert from "node:assert/strict";
import test from "node:test";
import { resolvePhotoExportTimeframe, selectPhotoExportRangeDay } from "./photoExportTimeframe";

const periods = [{ id: "red-8", start: "2026-08-03", end: "2026-08-30" }];

test("single-day export sends the same inclusive date for both bounds", () => {
  assert.deepEqual(resolvePhotoExportTimeframe({ timeframeMode: "date", date: "2026-08-31" }, periods), {
    dateFrom: "2026-08-31", dateTo: "2026-08-31",
  });
});

test("a custom range sends both exact bounds across month/year boundaries", () => {
  assert.deepEqual(resolvePhotoExportTimeframe({ timeframeMode: "range", dateFrom: "2026-12-28", dateTo: "2027-01-04" }, periods), {
    dateFrom: "2026-12-28", dateTo: "2027-01-04",
  });
});

test("an incomplete range cannot accidentally export all photos", () => {
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "range" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "range", dateFrom: "2026-08-31" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "range", dateTo: "2026-08-31" }, periods), null);
});

test("invalid and reversed bounds cannot be exported", () => {
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "range", dateFrom: "2026-09-01", dateTo: "2026-08-31" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "date", date: "2026-02-30" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "date", date: "31.08.2026" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "date", date: "2027-02-29" }, periods), null);
  assert.notEqual(resolvePhotoExportTimeframe({ timeframeMode: "date", date: "2028-02-29" }, periods), null);
});

test("two clicks select an inclusive range in either order", () => {
  const start = selectPhotoExportRangeDay({}, "2026-08-10");
  assert.deepEqual(start, { dateFrom: "2026-08-10", dateTo: undefined });
  assert.deepEqual(selectPhotoExportRangeDay(start, "2026-08-20"), { dateFrom: "2026-08-10", dateTo: "2026-08-20" });
  assert.deepEqual(selectPhotoExportRangeDay(start, "2026-07-30"), { dateFrom: "2026-07-30", dateTo: "2026-08-10" });
});

test("same-day ranges work and a third click starts a fresh range", () => {
  const sameDay = selectPhotoExportRangeDay({ dateFrom: "2026-08-10" }, "2026-08-10");
  assert.deepEqual(resolvePhotoExportTimeframe({ timeframeMode: "range", ...sameDay }, periods), sameDay);
  assert.deepEqual(selectPhotoExportRangeDay(sameDay, "2026-09-01"), { dateFrom: "2026-09-01", dateTo: undefined });
});

test("all/week/RED Month ignore dates retained from another mode", () => {
  const previous = { date: "2026-08-31", dateFrom: "2026-08-01", dateTo: "2026-08-31", week: "2026-W35", redMonthId: "red-8" };
  assert.deepEqual(resolvePhotoExportTimeframe({ ...previous, timeframeMode: "all" }, periods), {});
  assert.deepEqual(resolvePhotoExportTimeframe({ ...previous, timeframeMode: "week" }, periods), { week: "2026-W35" });
  assert.deepEqual(resolvePhotoExportTimeframe({ ...previous, timeframeMode: "redMonth" }, periods), { dateFrom: periods[0].start, dateTo: periods[0].end });
});

test("missing weeks and unresolved RED Months cannot become unbounded exports", () => {
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "week" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "week", week: "2026-W54" }, periods), null);
  assert.equal(resolvePhotoExportTimeframe({ timeframeMode: "redMonth", redMonthId: "missing" }, periods), null);
});
