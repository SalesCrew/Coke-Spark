import test from "node:test";
import assert from "node:assert/strict";
import { answerOptions, eligibleQuestion, sourceForQuestion, type BonusQuestion } from "../src/lib/praemien-question-selection";
const question = (patch: Partial<BonusQuestion>): BonusQuestion => ({ id: "synthetic", text: "Testfrage", type: "yesno", config: {}, scores: [], updatedAt: "", ...patch });

test("sources default to Ja even when Nein is first; unscored boolean and numeric questions qualify", () => {
  const q = question({ scores: [{ scoreKey: "Nein", weight: 0 }, { scoreKey: "Ja", weight: 2 }] });
  assert.equal(sourceForQuestion(q, "flex").scoreKey, "Ja");
  assert.equal(sourceForQuestion(q, "flex").weight, 2);
  assert.equal(sourceForQuestion(q, "flex").section, "flex");
  assert.equal(eligibleQuestion(question({})), true);
  const numeric = sourceForQuestion(question({ type: "numeric" }), "kuehler");
  assert.equal(numeric.factor, true); assert.equal(numeric.scoreKey, "__value__"); assert.equal(numeric.weight, 1);
});
test("choice eligibility uses score/config answers; text, photo and matrix never qualify", () => {
  assert.equal(eligibleQuestion(question({ type: "single", config: {} })), false);
  const q = question({ type: "single", config: { options: ["Ja", { value: "Kühler", label: "Kühler" }, { label: "Rack" }] }, scores: [{ scoreKey: "Kühler", weight: 5 }] });
  assert.deepEqual(answerOptions(q), ["Kühler", "Ja", "Rack"]);
  assert.equal(eligibleQuestion(q), true); assert.equal(sourceForQuestion(q, "standard").scoreKey, "Kühler");
  for (const type of ["text", "photo", "matrix"]) assert.equal(eligibleQuestion(question({ type, scores: [{ scoreKey: "Ja", weight: 1 }] })), false);
});
