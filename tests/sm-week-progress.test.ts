import assert from "node:assert/strict";
import test from "node:test";
import { smWorkweekProgress } from "../src/lib/sm/weekProgress";

test("SM workweek progress reaches Friday on Friday in Vienna", () => {
  const progress = smWorkweekProgress(new Date("2026-09-18T10:00:00Z"));
  assert.equal(progress.currentDayIndex, 4);
  assert.equal(progress.progress, 100);
  assert.deepEqual(progress.dates, ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]);
});

test("SM workweek progress uses Vienna at the UTC date boundary", () => {
  const progress = smWorkweekProgress(new Date("2026-09-17T22:30:00Z"));
  assert.equal(progress.currentDayIndex, 4);
  assert.equal(progress.progress, 100);
});

test("SM workweek progress advances through the day like the GM strip and stays full on weekends", () => {
  const thursday = smWorkweekProgress(new Date("2026-09-17T10:00:00Z"));
  assert.equal(thursday.currentDayIndex, 3);
  assert.equal(thursday.progress, 87.5);
  const saturday = smWorkweekProgress(new Date("2026-09-19T10:00:00Z"));
  assert.equal(saturday.currentDayIndex, 4);
  assert.equal(saturday.progress, 100);
});
