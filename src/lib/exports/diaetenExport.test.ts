import assert from "node:assert/strict";
import test from "node:test";

import { getDiaetenExportDates } from "./diaetenExport";

test("creates every day of a selected calendar week", () => {
  assert.deepEqual(getDiaetenExportDates("2026-07-13", "2026-07-19"), [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ]);
});

test("supports the complete RED-month range", () => {
  const dates = getDiaetenExportDates("2026-07-06", "2026-07-31");
  assert.equal(dates.length, 26);
  assert.equal(dates[0], "2026-07-06");
  assert.equal(dates.at(-1), "2026-07-31");
});

test("rejects an inverted range", () => {
  assert.throws(
    () => getDiaetenExportDates("2026-07-31", "2026-07-06"),
    /ungültig/,
  );
});
