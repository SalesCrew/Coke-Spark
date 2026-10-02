import test from "node:test";
import assert from "node:assert/strict";
import { marketChainGroup, chainGroupLabel, OTHER_CHAINS_SHORTCUT, REWE_CHAINS_SHORTCUT, SPAR_CHAINS_SHORTCUT, chainSelectionValues, updateChainSelection } from "../src/lib/gm-dashboard/chain-groups";

test("market dropdown uses the requested groups, including case/spacing and unclassified markets", () => {
  for (const chain of ["Billa", " BILLA + ", "Billa Plus", "isp", "ESP"]) assert.equal(marketChainGroup(chain), "rewe");
  for (const chain of ["Spar", " SPAR "]) assert.equal(marketChainGroup(chain), "spar");
  for (const chain of [null, "", "Hofer", "Billa Corso", "REWE Zentrallager", "Spar Zentrallager"]) assert.equal(marketChainGroup(chain), "other");
});

test("availability REWE/SPAR shortcuts select individual rows, combine and remain individually editable", () => {
  const extra = [
    { value: REWE_CHAINS_SHORTCUT, label: "REWE", chains: ["Billa", "Billa+", "ISP", "ESP"] },
    { value: SPAR_CHAINS_SHORTCUT, label: "SPAR", chains: ["Spar"] },
  ];
  const rewe = updateChainSelection([], [REWE_CHAINS_SHORTCUT], ["Hofer"], extra);
  assert.deepEqual(rewe, extra[0].chains);
  const both = updateChainSelection(rewe, [...chainSelectionValues(rewe, ["Hofer"], extra), SPAR_CHAINS_SHORTCUT], ["Hofer"], extra);
  assert.deepEqual(both, ["Billa", "Billa+", "ISP", "ESP", "Spar"]);
  const edited = updateChainSelection(both, chainSelectionValues(both, ["Hofer"], extra).filter((value) => value !== "ISP"), ["Hofer"], extra);
  assert.deepEqual(edited, ["Billa", "Billa+", "ESP", "Spar"]);
  assert.equal(chainSelectionValues(edited, ["Hofer"], extra).includes(REWE_CHAINS_SHORTCUT), false);
  assert.equal(chainSelectionValues(edited, ["Hofer"], extra).includes(SPAR_CHAINS_SHORTCUT), true);
  assert.deepEqual(updateChainSelection(both, [], ["Hofer"], extra), []);
});
test("export labels preserve all selected groups and empty selection means all markets", () => {
  assert.equal(chainGroupLabel(["spar", "rewe"]), "REWE, SPAR");
  assert.equal(chainGroupLabel(["other"]), "Sonstige Märkte");
  assert.equal(chainGroupLabel(["rewe", "spar", "other"]), "REWE, SPAR, Sonstige Märkte");
  assert.equal(chainGroupLabel([]), "Alle Marktketten");
});

test("Sonstige shortcut selects editable individual chain rows and preserves other selections", () => {
  const others = ["Hofer", "Billa Corso", ""];
  const selected = updateChainSelection(["Billa"], ["Billa", OTHER_CHAINS_SHORTCUT], others);
  assert.deepEqual(selected, ["Billa", ...others]);
  assert.deepEqual(chainSelectionValues(selected, others), [...selected, OTHER_CHAINS_SHORTCUT]);
  const removeOne = updateChainSelection(selected, ["Billa", "Billa Corso", "", OTHER_CHAINS_SHORTCUT], others);
  assert.deepEqual(removeOne, ["Billa", "Billa Corso", ""]);
  assert.equal(chainSelectionValues(removeOne, others).includes(OTHER_CHAINS_SHORTCUT), false);
  assert.deepEqual(updateChainSelection(selected, selected, others), ["Billa"]);
  assert.deepEqual(updateChainSelection(selected, [], others), []);
  assert.deepEqual(chainSelectionValues(["Billa", "Spar"], []), ["Billa", "Spar"]);
});
