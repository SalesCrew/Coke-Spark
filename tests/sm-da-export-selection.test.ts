import assert from "node:assert/strict";
import test from "node:test";
import { SMDurcharbeitExportDateRange, SMDurcharbeitExportPeriods, type SMDurcharbeitExportTime } from "../src/lib/sm/SMDurcharbeitExportSelection";
import { SMDurcharbeitExportQuery } from "../src/types/smSMDurcharbeitExport";
test("SM export uses calendar months and ISO weeks, inclusive ranges and lossless multi-selections", () => {
  const time: SMDurcharbeitExportTime = { mode: "all", week: "", month: "", from: "", to: "" };
  assert.deepEqual(SMDurcharbeitExportDateRange(time), {});
  assert.equal(SMDurcharbeitExportDateRange({ ...time, mode: "range", from: "2026-12-01", to: "2026-11-01" }), null);
  assert.deepEqual(SMDurcharbeitExportDateRange({ ...time, mode: "month", month: "2028-02-01" }), { from: "2028-02-01", to: "2028-02-29" });
  const periods = SMDurcharbeitExportPeriods("2026-12-31", "2027-01-04");
  assert.equal(periods.weeks[0]!.value, "2027-01-04"); assert.match(periods.weeks[0]!.label, /^KW 1 /);
  assert.match(periods.weeks[1]!.label, /^KW 53 /);
  assert.deepEqual(SMDurcharbeitExportDateRange({ ...time, mode: "week", week: "2026-12-28" }), { from: "2026-12-28", to: "2027-01-03" });
  assert.equal(periods.months.length, 2);
  const encoded = new URLSearchParams(SMDurcharbeitExportQuery({ campaignIds: ["one", "two"], smUserIds: ["old", "current"], regions: ["Ost, Süd"], chains: ["A & B"], status: "inactive" }));
  assert.deepEqual(JSON.parse(encoded.get("regions")!), ["Ost, Süd"]); assert.equal(encoded.get("status"), "inactive");
  assert.deepEqual(JSON.parse(encoded.get("smUserIds")!), ["old", "current"]);
});
