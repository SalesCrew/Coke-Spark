import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSmTimeDays, groupSmTimeEmployees, selectSmTimeAssignments, smVisitTimeLabel, summarizeSmTime } from "../src/lib/sm/timeView";
import { SmEmployeeTimeRow, SmZeiterfassungWorkspace } from "../src/components/admin/sm/SmZeiterfassungWorkspace";
import { smDayPeriod, smMonthPeriod } from "../src/lib/sm/planningPeriod";
import { smTimeFixtures, timeFixture } from "./fixtures/sm-time";

test("exact month/day boundaries exclude adjacent months and cancelled occurrences", () => {
  const rows = selectSmTimeAssignments(smTimeFixtures(), "2026-09-01", "2026-09-30");
  assert.deepEqual(rows.map((row) => row.id), ["first", "middle", "ben", "planned", "last", "draft"]);
  assert.deepEqual(selectSmTimeAssignments(smTimeFixtures(), "2026-09-30", "2026-09-30").map((row) => row.id), ["last"]);
});

test("employee, day and range totals agree; unrecorded travel is not paid work", () => {
  const rows = selectSmTimeAssignments(smTimeFixtures(), "2026-09-01", "2026-09-30");
  const people = groupSmTimeEmployees(buildSmTimeDays(rows));
  assert.equal(people.length, 2);
  const ada = people[0];
  assert.equal(ada.name, "Ada Beispiel");
  assert.deepEqual(ada.days.map((day) => day.date), ["2026-09-30", "2026-09-14", "2026-09-01"]);
  assert.deepEqual(ada.days[1].assignments.map((row) => row.id), ["middle", "draft", "planned"]);
  assert.deepEqual(ada.summary, { planned: 300, actual: 180, travel: 20, total: 200, averageDay: 67, recordedDays: 3, plannedDays: 3, completed: 3, count: 5 });
  assert.equal(ada.days.reduce((sum, day) => sum + (summarizeSmTime(day.assignments).total ?? 0), 0), ada.summary.total);
  assert.equal(summarizeSmTime(rows).total, 255);
  const empty = summarizeSmTime(selectSmTimeAssignments([timeFixture("unrecorded", "2026-09-14", null)], "2026-09-14", "2026-09-14"));
  assert.equal(empty.total, null); assert.equal(empty.averageDay, null); assert.equal(empty.recordedDays, 0);
});

test("effective reassignment/date and latest time revision win without rewriting originals", () => {
  const row = timeFixture("moved", "2026-08-31", 60);
  row.effective.workDate = "2026-09-14"; row.effective.smUserId = "ben"; row.effective.smName = "Ben Beispiel";
  row.actualMinutes = 75; row.timeEntry!.actualMinutes = 75; row.timeEntry!.revisionNumber = 2;
  const mapped = selectSmTimeAssignments([row], "2026-09-14", "2026-09-14")[0];
  assert.equal(mapped.smId, "ben"); assert.equal(mapped.actualMinutes, 75); assert.equal(mapped.timeRevisionNumber, 2);
  assert.equal(row.original.workDate, "2026-08-31");
  assert.equal(selectSmTimeAssignments([row], "2026-08-31", "2026-08-31").length, 0);
});

test("Vienna visit timestamps handle DST, overnight and absent historical values", () => {
  assert.equal(smVisitTimeLabel("2026-09-14T07:00:00Z", "2026-09-14T08:00:00Z"), "09:00 – 10:00");
  assert.equal(smVisitTimeLabel("2026-01-14T07:00:00Z", null), "08:00 – offen");
  assert.match(smVisitTimeLabel("2026-09-14T21:30:00Z", "2026-09-14T23:00:00Z"), /14.09.*23:30.*15.09.*01:00/);
  assert.equal(smVisitTimeLabel(null, null), "Uhrzeiten nicht erfasst");
  assert.equal(smVisitTimeLabel("bad", "bad"), "Uhrzeiten nicht erfasst");
});

test("employee overview is accessible and does not mount concealed editors", () => {
  const employee = groupSmTimeEmployees(buildSmTimeDays(selectSmTimeAssignments(smTimeFixtures(), "2026-09-01", "2026-09-30")))[0];
  const html = renderToStaticMarkup(createElement(SmEmployeeTimeRow, { employee, onSave: async () => {}, onReviewRequest: async () => {} }));
  assert.match(html, /Zeiten von Ada Beispiel/); assert.match(html, /aria-expanded="false"/);
  assert.match(html, /3h 20min/); assert.doesNotMatch(html, /Ist-Zeit bearbeiten/);
  const loading = renderToStaticMarkup(createElement(SmZeiterfassungWorkspace, { initialPeriod: smMonthPeriod("2026-09-14") }));
  assert.match(loading, /Zeiterfassung wird geladen/); assert.match(loading, /sm-time-skeleton-row/);
  assert.match(loading, /01.09.2026.*30.09.2026/);
  assert.match(renderToStaticMarkup(createElement(SmZeiterfassungWorkspace, { initialPeriod: smDayPeriod("2026-09-14") })), /14.09.2026/);
});

test("existing authenticated API and corrections stay wired; stale responses are guarded", async () => {
  const ui = await readFile(new URL("../src/components/admin/sm/SmZeiterfassungWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /load: fetchSmPlanningAssignments/); assert.match(ui, /api.load\(period.from, period.to\)/);
  assert.match(ui, /generation.current !== request \|\| activeRange.current !== requestedRange/);
  assert.match(ui, /save: submitSmPlanningActualTime/); assert.match(ui, /approve: approveAdminSmPlanningTimeChangeRequest/);
  assert.match(ui, /reject: rejectAdminSmPlanningTimeChangeRequest/);
  assert.doesNotMatch(ui, /maxHeight: expanded \? 700/);
  const backend = await readFile(new URL("../backend/src/routes/sm-planning.ts", import.meta.url), "utf8");
  assert.match(backend, /adminSmPlanningRouter.use\(requireAuth\(\["admin", "sm_admin"\]\)\)/);
  assert.match(backend, /gte\(effectiveDate, from\)/); assert.match(backend, /lte\(effectiveDate, to\)/);
});
