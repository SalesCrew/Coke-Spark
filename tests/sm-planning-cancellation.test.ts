import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_SM_PLANNING_STATUS, matchesSmPlanningStatus, smPlanningMinutes } from "../src/lib/sm/planningCancellation";
import type { SmPlanningAssignment, SmPlanningStatus } from "../src/types/smPlanning";

const row = (status: SmPlanningStatus, minutes = 60) => ({ status, effective: { plannedMinutes: minutes }, replacement: { workDate: "2026-09-18", smUserId: "other-sm" } }) as SmPlanningAssignment;

test("removed terms disappear from the default plan but remain explicitly accessible", () => {
  for (const status of ["planned", "confirmed", "open", "in_progress", "completed", "missed"] as const) assert.equal(matchesSmPlanningStatus(row(status), DEFAULT_SM_PLANNING_STATUS), true);
  const cancelled = row("cancelled");
  assert.equal(matchesSmPlanningStatus(cancelled, DEFAULT_SM_PLANNING_STATUS), false);
  assert.equal(matchesSmPlanningStatus(cancelled, "all"), true);
  assert.equal(matchesSmPlanningStatus(cancelled, "cancelled"), true);
  assert.equal(matchesSmPlanningStatus(cancelled, "rescheduled"), false);
  assert.equal(matchesSmPlanningStatus(cancelled, "replaced"), false);
  assert.equal(matchesSmPlanningStatus(row("planned"), "rescheduled"), true);
});

test("weekly/daily capacity excludes cancelled original minutes without mutating history", () => {
  const rows = [row("planned", 90), row("completed", 45), row("cancelled", 120)];
  assert.equal(smPlanningMinutes(rows), 135);
  assert.equal(rows[2].effective.plannedMinutes, 120);
  assert.equal(smPlanningMinutes([rows[2]]), 0);
  assert.equal(smPlanningMinutes([]), 0);
});

test("removal has an isolated submit contract and preserves existing API/auth/phone safeguards", async () => {
  const ui = await readFile(new URL("../src/components/admin/sm/SmVerplanungWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /onSubmit\(\{ kind: cancellationAction, assignment, reason: reason.trim\(\) \}\)/);
  assert.match(ui, /submitting.current = true/);
  assert.match(ui, /row.status === "cancelled" \? meta : rescheduled/);
  assert.match(ui, /Entfernen bestätigen/);
  assert.match(ui, /smPlanningMinutes\(daySmRows.map/);
  assert.doesNotMatch(ui, /request.cancellationAction/);
  const routes = await readFile(new URL("../backend/src/routes/sm-planning.ts", import.meta.url), "utf8");
  assert.match(routes, /requireAuth\(\["admin", "sm_admin"\]\)/);
  assert.match(routes, /db.transaction\(\(tx\) => cancelSmPlanningOccurrence/);
  const visits = await readFile(new URL("../backend/src/routes/sm-visits.ts", import.meta.url), "utf8");
  assert.match(visits, /\["cancelled", "missed", "completed"\].includes\(assignment.status\)/);
});
