import assert from "node:assert/strict";
import test from "node:test";
import { filterSMDurcharbeitMarkets, updateSMDurcharbeitMarketSelection } from "../src/lib/sm/SMDurcharbeitMarketSelection";

test("324 filtered SPAR rows are selected without including 100 other rows, regardless of pagination", () => {
  const markets = Array.from({ length: 424 }, (_, i) => ({ id: String(i), name: `Markt ${i}`, chain: i < 324 ? "Spar" : "Billa", address: "Testweg", city: "Wien" }));
  const filtered = filterSMDurcharbeitMarkets(markets, "Spar", "");
  assert.equal(filtered.length, 324);
  const ids = filtered.map(row => row.id);
  assert.equal(updateSMDurcharbeitMarketSelection(new Set(), ids, "include").size, 324);
  const full = new Set(markets.map(row => row.id));
  assert.equal(updateSMDurcharbeitMarketSelection(full, ids, "only").size, 324);
  assert.equal(updateSMDurcharbeitMarketSelection(full, ids, "exclude").size, 100);
  assert.equal(updateSMDurcharbeitMarketSelection(new Set(["423"]), ids, "include").size, 325, "Adding filtered rows preserves intentional selections outside the filter");
  assert.equal(filterSMDurcharbeitMarkets(markets, "", "  SPAR  ").length, 324, "Search also matches the chain when the market name does not contain it");
  assert.equal(filterSMDurcharbeitMarkets(markets, "Billa", "SPAR").length, 0);
  assert.deepEqual(updateSMDurcharbeitMarketSelection(full, [], "include"), full);
});
