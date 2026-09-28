import assert from "node:assert/strict";
import test from "node:test";
import { createSmWeeklyPlanDraft, readSmWeeklyPlanDraft } from "../src/lib/sm-market-weekly-planning";

test("market weekly planning draft preserves imported hours and accepts German decimals", () => {
  const draft = createSmWeeklyPlanDraft({ do: 2 });
  assert.deepEqual({ ...draft }, { mo: null, di: null, mi: null, do: "2", fr: null });
  draft.do = null;
  draft.di = "2,5";
  draft.fr = "0.25";
  assert.deepEqual(readSmWeeklyPlanDraft(draft), {
    weekdayHours: { mo: null, di: 2.5, mi: null, do: null, fr: 0.25 },
    serviceDaysPerWeek: 2, weeklyHours: 2.75, error: null,
  });
});

test("clearing every weekday produces an explicit empty plan", () => {
  const parsed = readSmWeeklyPlanDraft(createSmWeeklyPlanDraft());
  assert.equal(parsed.error, null);
  assert.equal(parsed.serviceDaysPerWeek, 0);
  assert.equal(parsed.weeklyHours, 0);
  assert.deepEqual(parsed.weekdayHours, { mo: null, di: null, mi: null, do: null, fr: null });
});

test("totals use exact hundredths instead of floating point sums", () => {
  const draft = createSmWeeklyPlanDraft({ mo: 0.1, di: 0.2, fr: 24 });
  assert.equal(readSmWeeklyPlanDraft(draft).weeklyHours, 24.3);
});

test("empty, zero, negative, excessive, malformed and overprecise active hours cannot be saved", () => {
  for (const invalid of ["", " ", "0", "-2", "24,01", "NaN", "2,5,0", "1e1", "1.001"]) {
    const draft = createSmWeeklyPlanDraft();
    draft.mo = invalid;
    const result = readSmWeeklyPlanDraft(draft);
    assert.match(result.error ?? "", /Montag/);
    assert.equal(result.weeklyHours, undefined);
    assert.equal(result.serviceDaysPerWeek, 1);
  }
});

test("draft edits never mutate the loaded market and cancel can restore its exact values", () => {
  const hours = { do: 2.75 };
  const draft = createSmWeeklyPlanDraft(hours);
  draft.do = null;
  draft.di = "3";
  assert.deepEqual(hours, { do: 2.75 });
  assert.deepEqual(createSmWeeklyPlanDraft(hours), { mo: null, di: null, mi: null, do: "2,75", fr: null });
});
