import assert from "node:assert/strict";
import test from "node:test";
import { campaignExtensionMinimum, campaignExtensionToday } from "../src/lib/campaign-extension";
test("calendar minimum follows Vienna today and handles leap/year rollover without timezone shifts", () => {
  assert.equal(campaignExtensionMinimum({ startDate: "2026-09-21", endDate: "2026-10-02" }, "2026-10-05"), "2026-10-05");
  assert.equal(campaignExtensionMinimum({ startDate: "2026-09-21", endDate: "2026-12-31" }, "2026-10-05"), "2027-01-01");
  assert.equal(campaignExtensionMinimum({ startDate: "2028-02-01", endDate: "2028-02-28" }, "2028-02-01"), "2028-02-29");
  assert.equal(campaignExtensionToday(new Date("2026-10-04T22:30:00Z")), "2026-10-05");
});
