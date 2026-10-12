import test from "node:test";
import assert from "node:assert/strict";
import { answerOptions, eligibleQuestion, sourceForQuestion, type BonusQuestion } from "../src/lib/praemien-question-selection";
const question = (patch: Partial<BonusQuestion>): BonusQuestion => ({ id: "synthetic", text: "Testfrage", type: "yesno", config: {}, scores: [], updatedAt: "", ...patch });

test("sources use configured Boni points, prefer scored Ja, and exclude unscored questions", () => {
  const q = question({ scores: [{ scoreKey: "Nein", weight: 0 }, { scoreKey: "Ja", weight: 2 }] });
  assert.equal(sourceForQuestion(q, "flex").scoreKey, "Ja");
  assert.equal(sourceForQuestion(q, "flex").weight, 2);
  assert.equal(sourceForQuestion(q, "flex").section, "flex");
  assert.equal(eligibleQuestion(question({})), false);
  assert.equal(eligibleQuestion(question({ type:"numeric" })),false);
  const numericQuestion=question({ type:"numeric",scores:[{scoreKey:"__value__",weight:3.5}] });
  assert.equal(eligibleQuestion(numericQuestion),true);
  const numeric = sourceForQuestion(numericQuestion, "kuehler");
  assert.equal(numeric.factor, true); assert.equal(numeric.scoreKey, "__value__"); assert.equal(numeric.weight, 3.5);
  const scoredNein=question({scores:[{scoreKey:"Ja",weight:null},{scoreKey:"Nein",weight:2}]});
  assert.equal(sourceForQuestion(scoredNein,"billa").scoreKey,"Nein");
  assert.equal(sourceForQuestion(scoredNein,"billa").weight,2);
  const onlyFlex=question({activeSections:["flex"],scores:[{scoreKey:"Ja",weight:2}]});
  assert.equal(sourceForQuestion(onlyFlex,"standard").section,"flex");
  const shared=question({activeSections:["billa","flex","standard"],scores:[{scoreKey:"Ja",weight:2}]});
  assert.equal(sourceForQuestion(shared,"billa").section,"billa");
  for(const weight of [null,0,NaN]) assert.equal(eligibleQuestion(question({scores:[{scoreKey:"Ja",weight}]})),false);
});
test("choice eligibility uses score/config answers; text, photo and matrix never qualify", () => {
  assert.equal(eligibleQuestion(question({ type: "single", config: {} })), false);
  assert.equal(eligibleQuestion(question({type:"single",config:{options:["Ja","Nein"]}})),false);
  const q = question({ type: "single", config: { options: ["Ja", { value: "Kühler", label: "Kühler" }, { label: "Rack" }] }, scores: [{ scoreKey: "Kühler", weight: 5 }] });
  assert.deepEqual(answerOptions(q), ["Kühler", "Ja", "Rack"]);
  assert.equal(eligibleQuestion(q), true); assert.equal(sourceForQuestion(q, "standard").scoreKey, "Kühler");
  for (const type of ["text", "photo", "matrix"]) assert.equal(eligibleQuestion(question({ type, scores: [{ scoreKey: "Ja", weight: 1 }] })), false);
});
