import assert from "node:assert/strict";
import test from "node:test";
import { fromViennaDateTimeInput, toViennaDateTimeInput } from "../src/lib/sm/visitTimeCorrection";

test("SM admin visit editor uses Vienna wall time regardless of browser timezone", () => {
  assert.equal(toViennaDateTimeInput("2026-09-17T04:05:00Z"), "2026-09-17T06:05");
  assert.equal(fromViennaDateTimeInput("2026-09-17T08:07"), "2026-09-17T06:07:00.000Z");
  assert.equal(toViennaDateTimeInput("2026-01-17T05:05:00Z"), "2026-01-17T06:05");
  assert.equal(fromViennaDateTimeInput("2026-01-17T08:07"), "2026-01-17T07:07:00.000Z");
});

test("SM admin visit editor rejects DST gaps and preserves the selected repeated hour", () => {
  assert.equal(fromViennaDateTimeInput("2026-03-29T02:30"), null);
  assert.equal(fromViennaDateTimeInput("2026-10-25T02:30", "2026-10-25T01:30:00Z"), "2026-10-25T01:30:00.000Z");
  assert.equal(fromViennaDateTimeInput("2026-10-25T02:30", "2026-10-25T00:30:00Z"), "2026-10-25T00:30:00.000Z");
  assert.equal(fromViennaDateTimeInput("2026-02-30T12:00"), null);
});
