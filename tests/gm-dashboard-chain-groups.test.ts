import test from "node:test";
import assert from "node:assert/strict";
import { marketChainGroup, chainGroupLabel, OTHER_CHAINS_SHORTCUT, REWE_CHAINS_SHORTCUT, SPAR_CHAINS_SHORTCUT, chainSelectionValues, updateChainSelection } from "../src/lib/gm-dashboard/chain-groups";

test("market dropdown uses the requested groups, including case/spacing and unclassified markets", () => {
  for (const chain of ["Billa", " BILLA + ", "Billa Plus", "Billa Corso", " bIlLa  cOrSo "]) assert.equal(marketChainGroup(chain), "rewe");
  for (const chain of ["Spar", " SPAR ", "isp", " ESP "]) assert.equal(marketChainGroup(chain), "spar");
  for (const chain of [null, "", "Hofer", "REWE Zentrallager", "Spar Zentrallager"]) assert.equal(marketChainGroup(chain), "other");
});

test("availability REWE/SPAR shortcuts select individual rows, combine and remain individually editable", () => {
  const availableChains = ["Billa", "Billa+", "Billa Corso", "Spar", "ISP", "ESP", "Hofer"];
  const extra = [
    { value: REWE_CHAINS_SHORTCUT, label: "REWE", chains: availableChains.filter((chain) => marketChainGroup(chain) === "rewe") },
    { value: SPAR_CHAINS_SHORTCUT, label: "SPAR", chains: availableChains.filter((chain) => marketChainGroup(chain) === "spar") },
  ];
  const rewe = updateChainSelection([], [REWE_CHAINS_SHORTCUT], ["Hofer"], extra);
  assert.deepEqual(rewe, ["Billa", "Billa+", "Billa Corso"]);
  assert.deepEqual(updateChainSelection([], [SPAR_CHAINS_SHORTCUT], ["Hofer"], extra), ["Spar", "ISP", "ESP"]);
  const both = updateChainSelection(rewe, [...chainSelectionValues(rewe, ["Hofer"], extra), SPAR_CHAINS_SHORTCUT], ["Hofer"], extra);
  assert.deepEqual(both, ["Billa", "Billa+", "Billa Corso", "Spar", "ISP", "ESP"]);
  const edited = updateChainSelection(both, chainSelectionValues(both, ["Hofer"], extra).filter((value) => value !== "ISP"), ["Hofer"], extra);
  assert.deepEqual(edited, ["Billa", "Billa+", "Billa Corso", "Spar", "ESP"]);
  assert.equal(chainSelectionValues(edited, ["Hofer"], extra).includes(REWE_CHAINS_SHORTCUT), true);
  assert.equal(chainSelectionValues(edited, ["Hofer"], extra).includes(SPAR_CHAINS_SHORTCUT), false);
  assert.deepEqual(updateChainSelection(both, [], ["Hofer"], extra), []);
});
test("export labels preserve all selected groups and empty selection means all markets", () => {
  assert.equal(chainGroupLabel(["spar", "rewe"]), "REWE, SPAR");
  assert.equal(chainGroupLabel(["other"]), "Sonstige Märkte");
  assert.equal(chainGroupLabel(["rewe", "spar", "other"]), "REWE, SPAR, Sonstige Märkte");
  assert.equal(chainGroupLabel([]), "Alle Marktketten");
});

test("Sonstige shortcut selects editable individual chain rows and preserves other selections", () => {
  const others = ["Hofer", "Lidl", ""];
  const selected = updateChainSelection(["Billa"], ["Billa", OTHER_CHAINS_SHORTCUT], others);
  assert.deepEqual(selected, ["Billa", ...others]);
  assert.deepEqual(chainSelectionValues(selected, others), [...selected, OTHER_CHAINS_SHORTCUT]);
  const removeOne = updateChainSelection(selected, ["Billa", "Lidl", "", OTHER_CHAINS_SHORTCUT], others);
  assert.deepEqual(removeOne, ["Billa", "Lidl", ""]);
  assert.equal(chainSelectionValues(removeOne, others).includes(OTHER_CHAINS_SHORTCUT), false);
  assert.deepEqual(updateChainSelection(selected, selected, others), ["Billa"]);
  assert.deepEqual(updateChainSelection(selected, [], others), []);
  assert.deepEqual(chainSelectionValues(["Billa", "Spar"], []), ["Billa", "Spar"]);
});
