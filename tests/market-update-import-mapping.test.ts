import assert from "node:assert/strict";
import test from "node:test";
import { getFieldSpecsForImportType, validateMapping } from "../src/utils/marketImport";

test("ordinary Universum import accepts Flex-only mapping for partial updates", () => {
  const specs = getFieldSpecsForImportType("universum");
  assert.equal(validateMapping({ flexNumber: "A" }, specs).canImport, true);
  assert.equal(validateMapping({ cokeMasterNumber: "B" }, specs).canImport, false);
});

test("Kühler snapshot can map Flex without Stammnr or unrelated market columns", () => {
  const specs = getFieldSpecsForImportType("kuehler_snapshot");
  assert.equal(validateMapping({ flexNumber: "A", kuehlerInternalId: "B" }, specs).canImport, true);
  assert.equal(validateMapping({ kuehlerStammnr: "A", kuehlerInternalId: "B" }, specs).canImport, true);
  assert.equal(validateMapping({ kuehlerInternalId: "B" }, specs).canImport, false);
});

test("normal Kühler import still requires the fields needed to create a market", () => {
  const specs = getFieldSpecsForImportType("kuehler");
  assert.equal(validateMapping({ flexNumber: "A", kuehlerInternalId: "B" }, specs).canImport, false);
});
