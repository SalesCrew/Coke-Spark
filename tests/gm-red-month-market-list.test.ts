import assert from "node:assert/strict";
import { test } from "node:test";
import { isRedMonthMarketComplete, sortRedMonthMarkets } from "../src/lib/gm/redMonthMarketList";

test("one visit does not finish a two-visit RED-month market", () => {
  assert.equal(isRedMonthMarketComplete([{ targetVisitCount: 2, submittedVisitCount: 1 }]), false);
  assert.equal(isRedMonthMarketComplete([{ targetVisitCount: 2, submittedVisitCount: 2 }]), true);
});

test("every active campaign must be complete, even when aggregate counts meet the aggregate target", () => {
  assert.equal(isRedMonthMarketComplete([
    { targetVisitCount: 1, submittedVisitCount: 2 },
    { targetVisitCount: 1, submittedVisitCount: 0 },
  ]), false);
});

test("missing targets or no active campaign never count as complete", () => {
  assert.equal(isRedMonthMarketComplete([]), false);
  assert.equal(isRedMonthMarketComplete([{ targetVisitCount: null, submittedVisitCount: 1 }]), false);
  assert.equal(isRedMonthMarketComplete([{ targetVisitCount: 1, submittedVisitCount: null }]), false);
});

test("completed markets move below unfinished markets without being removed or reordered within each group", () => {
  const markets = [
    { id: "done-a", activeNowCampaigns: [{ targetVisitCount: 1, submittedVisitCount: 1 }] },
    { id: "open-a", activeNowCampaigns: [{ targetVisitCount: 2, submittedVisitCount: 1 }] },
    { id: "done-b", activeNowCampaigns: [{ targetVisitCount: 2, submittedVisitCount: 2 }] },
    { id: "open-b", activeNowCampaigns: [{ targetVisitCount: 1, submittedVisitCount: 0 }] },
  ];
  const sorted = sortRedMonthMarkets(markets);
  assert.deepEqual(sorted.map((market) => market.id), ["open-a", "open-b", "done-a", "done-b"]);
  assert.deepEqual(markets.map((market) => market.id), ["done-a", "open-a", "done-b", "open-b"]);
});

test("extra visits stay complete, not blocked", () => {
  assert.equal(isRedMonthMarketComplete([{ targetVisitCount: 1, submittedVisitCount: 2 }]), true);
});
