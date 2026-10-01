import test from "node:test";
import assert from "node:assert/strict";
import { marketChainGroup, chainGroupLabel } from "../src/lib/gm-dashboard/chain-groups";

test("market dropdown uses the requested groups, including case/spacing and unclassified markets", () => {
  for (const chain of ["Billa", " BILLA + ", "Billa Plus", "isp", "ESP"]) assert.equal(marketChainGroup(chain), "rewe");
  for (const chain of ["Spar", " SPAR "]) assert.equal(marketChainGroup(chain), "spar");
  for (const chain of [null, "", "Hofer", "Billa Corso", "REWE Zentrallager", "Spar Zentrallager"]) assert.equal(marketChainGroup(chain), "other");
});
test("export labels preserve all selected groups and empty selection means all markets", () => {
  assert.equal(chainGroupLabel(["spar", "rewe"]), "REWE, SPAR");
  assert.equal(chainGroupLabel(["other"]), "Sonstige Märkte");
  assert.equal(chainGroupLabel(["rewe", "spar", "other"]), "REWE, SPAR, Sonstige Märkte");
  assert.equal(chainGroupLabel([]), "Alle Marktketten");
});
