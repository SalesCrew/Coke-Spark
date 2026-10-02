import test from "node:test";
import assert from "node:assert/strict";
import { appendIndependentGoal, conditionText, updateGoal } from "../src/lib/praemien-goals";
import { modelTemplate } from "../backend/src/praemien-model.shared";
test("single-metric AND adds a separately named goal instead of duplicating Zielerreichung", () => {
 const p=modelTemplate("q3").pillars[0]!; const next=appendIndependentGoal(p,0);
 assert.equal(next.metrics.length,2); assert.equal(next.tiers[0]!.conditions.length,2);
 assert.notEqual(next.tiers[0]!.conditions[0]!.metricKey,next.tiers[0]!.conditions[1]!.metricKey);
 assert.equal(next.tiers[0]!.conditions[1]!.value,50);
});
test("goal descriptions express independent 50% minima; milestone edits preserve raw total thresholds", () => {
 const p=modelTemplate("xmas").pillars[2]!;
 assert.match(conditionText(p,p.tiers[0]!.conditions[1]!),/Kühler netto mindestens 50 %.*0 Stück/);
 assert.match(conditionText(p,p.tiers[0]!.conditions[2]!),/X-Mas-Aktivierungen mindestens 50 %.*20 Punkte/);
 const next=updateGoal(p,"xmas_points",{halfAt:22,fullAt:30});
 assert.equal(next.tiers[0]!.conditions[2]!.value,22); assert.equal(next.tiers[1]!.conditions[2]!.value,22);
 assert.equal(next.tiers[0]!.conditions[0]!.value,25); assert.equal(next.tiers[1]!.conditions[0]!.value,30);
});

test("changing cooler milestones keeps the 5/10 step thresholds in sync", () => {
 const p=modelTemplate("xmas").pillars[2]!;
 const changed=updateGoal(p,"net",{halfAt:2,fullAt:3});
 assert.deepEqual(changed.metrics.find(m=>m.key==="cooler_points")!.steps,[{at:2,value:5},{at:3,value:10}]);
 assert.equal(changed.tiers[0]!.conditions[1]!.value,2);
});

test("a previously duplicated >= target is replaced by the new independent goal", () => {
 const p=modelTemplate("q3").pillars[0]!;
 p.tiers[0]!.conditions.push({metricKey:"percent",operator:"gte",value:50});
 const changed=appendIndependentGoal(p,0);
 assert.equal(changed.tiers[0]!.conditions.length,2);
 assert.notEqual(changed.tiers[0]!.conditions[0]!.metricKey,changed.tiers[0]!.conditions[1]!.metricKey);
});
