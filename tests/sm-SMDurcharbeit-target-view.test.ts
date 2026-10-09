import assert from "node:assert/strict";
import test from "node:test";
import { SMDurcharbeitTargetAction, SMDurcharbeitTargetProgress } from "../src/lib/sm/SMDurcharbeitTargetView";
import type { SMDurcharbeitTarget } from "../src/types/smSMDurcharbeitCampaign";

const visitId = "00000000-0000-4000-8000-000000000001";
const target = (overrides: Partial<SMDurcharbeitTarget> = {}): SMDurcharbeitTarget => ({
  id: "synthetic-target", revision: 1, campaignId: "synthetic-campaign", campaignName: "Synthetic",
  campaignStatus: "published", startDate: "2026-10-01", endDate: "2026-12-31", month: "2026-10-01",
  market: { id: "synthetic-market", internalId: "SM-1", name: "Synthetic", chain: "Test", address: "Testgasse", postalCode: "1010", city: "Wien", region: "Ost" },
  smUserId: "synthetic-A", smName: "A", eligibility: "required", waiverReason: null,
  completed: false, available: true, draftVisitId: null, latestVisitId: null, latestSubmissionId: null,
  latestVisitSmUserId: null, completedAt: null, visitCount: 0, ...overrides,
});
const action = (value: SMDurcharbeitTarget) => SMDurcharbeitTargetAction(value, "2026-10-01");

test("progress excludes waived markets and never treats a draft as completed", () => {
  assert.deepEqual(SMDurcharbeitTargetProgress([target(), target({ completed: true }), target({ eligibility: "waived", completed: true }), target({ draftVisitId: visitId })]), { required: 3, completed: 1 });
  assert.deepEqual(SMDurcharbeitTargetProgress([]), { required: 0, completed: 0 });
});
test("available targets retain start and same-month follow-up routes", () => {
  assert.deepEqual(action(target()), { label: "Starten", href: "/sm/durcharbeit-besuch?targetId=synthetic-target" });
  assert.deepEqual(action(target({ completed: true, latestVisitId: visitId, latestVisitSmUserId: "synthetic-A" })), { label: "Folgebesuch", href: "/sm/durcharbeit-besuch?targetId=synthetic-target" });
});
test("existing drafts resume even when the month is closed", () => {
  assert.deepEqual(action(target({ draftVisitId: visitId })), { label: "Fortsetzen", href: `/sm/durcharbeit-besuch?visitId=${visitId}` });
  assert.deepEqual(action(target({ draftVisitId: visitId, available: false })), { label: "Entwurf ansehen", href: `/sm/durcharbeit-besuch?visitId=${visitId}` });
});
test("closed-month receipt links belong to the current target owner", () => {
  assert.deepEqual(action(target({ available: false, completed: true, latestVisitId: visitId, latestVisitSmUserId: "synthetic-A" })), { label: "Ansehen", href: `/sm/durcharbeit-besuch?visitId=${visitId}` });
  assert.equal(action(target({ available: false, latestVisitId: visitId, latestVisitSmUserId: "synthetic-B" })).href, null);
});
test("future, waived, paused and historical targets cannot expose a start link", () => {
  for (const [values, label] of [
    [{ month: "2026-11-01" }, "Geplant"], [{ month: "2026-09-01" }, "Nicht erledigt"],
    [{ month: "2026-09-01", completed: true }, "Erledigt"], [{ eligibility: "waived" }, "Ausgenommen"],
    [{ campaignStatus: "paused" }, "Pausiert"], [{}, "Geschlossen"],
  ] as Array<[Partial<SMDurcharbeitTarget>, string]>) {
    assert.deepEqual(action(target({ ...values, available: false })), { label, href: null });
  }
});
