import type { SmPlanningAssignment } from "@/types/smPlanning";
import type { SMDurcharbeitTimeEntry } from "@/types/smSMDurcharbeitTime";
import { SMDurcharbeitVisitReference } from "./SMDurcharbeitVisitReference";

export function mapSmTimeAssignment(row: SmPlanningAssignment): SmTimeAssignment {
  return {
    id: row.id, date: row.effective.workDate, smId: row.effective.smUserId,
    smName: row.effective.smName, region: row.effective.region,
    marketName: row.effective.marketName, marketAddress: row.effective.address,
    internalMarketId: row.effective.marketInternalId, plannedMinutes: row.effective.plannedMinutes,
    actualMinutes: row.actualMinutes, travelMinutes: row.visit?.travelMinutes ?? 0,
    totalMinutes: row.actualMinutes === null ? null : row.actualMinutes + (row.visit?.travelMinutes ?? 0),
    visitId: row.visit?.id ?? null, visitStartedAt: row.visit?.visitStartedAt ?? null, visitCompletedAt: row.visit?.visitCompletedAt ?? null,
    submittedAt: row.visit?.submittedAt ?? null, timeRevisionNumber: row.timeEntry?.revisionNumber ?? null,
    pendingTimeChangeRequest: row.pendingTimeChangeRequest, questionnaireComplete: row.questionnaireComplete,
    status: row.status,
  };
}

export type SmTimeAssignment = {
  id: string; date: string; smId: string; smName: string; region: string; marketName: string; marketAddress: string;
  internalMarketId: string; plannedMinutes: number | null; actualMinutes: number | null; travelMinutes: number; totalMinutes: number | null;
  visitId: string | null; visitStartedAt: string | null; visitCompletedAt: string | null; submittedAt: string | null;
  timeRevisionNumber: number | null; pendingTimeChangeRequest: SmPlanningAssignment["pendingTimeChangeRequest"];
  questionnaireComplete: boolean; status: SmPlanningAssignment["status"];
  SMDurcharbeitVisitId?: string; SMDurcharbeitCampaignName?: string; SMDurcharbeitMonth?: string;
};
export function mapSMDurcharbeitTime(row: SMDurcharbeitTimeEntry): SmTimeAssignment {
  return { id: SMDurcharbeitVisitReference(row.visitId), SMDurcharbeitVisitId: row.visitId, SMDurcharbeitCampaignName: row.campaignName, SMDurcharbeitMonth: row.month,
    date: row.workDate, smId: row.smUserId, smName: row.smName, region: "", marketName: row.marketName, marketAddress: row.marketAddress,
    internalMarketId: row.marketInternalId, plannedMinutes: null, actualMinutes: row.actualMinutes, travelMinutes: row.travelMinutes,
    totalMinutes: row.actualMinutes === null ? null : row.actualMinutes + row.travelMinutes, visitId: row.submissionId,
    visitStartedAt: row.startedAt, visitCompletedAt: row.completedAt, submittedAt: row.submittedAt, timeRevisionNumber: row.revision,
    pendingTimeChangeRequest: row.pendingTimeChangeRequest, questionnaireComplete: row.questionnaireComplete, status: "completed" };
}
export type SmTimeDay = { date: string; smId: string; smName: string; region: string; assignments: SmTimeAssignment[] };

export function selectSmTimeAssignments(rows: SmPlanningAssignment[], from: string, to: string) {
  return rows.filter((row) => row.status !== "cancelled" && row.effective.workDate >= from && row.effective.workDate <= to).map(mapSmTimeAssignment);
}

export function summarizeSmTime(rows: SmTimeAssignment[]) {
  const recorded = rows.filter((row) => row.actualMinutes !== null);
  const recordedDays = new Set(recorded.map((row) => row.date)).size;
  const actual = recorded.reduce((sum, row) => sum + row.actualMinutes!, 0);
  const travel = recorded.reduce((sum, row) => sum + row.travelMinutes, 0);
  return {
    planned: rows.length && rows.every(row => row.plannedMinutes === null) ? null : rows.reduce((sum, row) => sum + (row.plannedMinutes ?? 0), 0),
    actual: recorded.length ? actual : null,
    travel: recorded.length ? travel : null,
    total: recorded.length ? actual + travel : null,
    averageDay: recordedDays ? Math.round((actual + travel) / recordedDays) : null,
    recordedDays, plannedDays: new Set(rows.filter(row => row.plannedMinutes !== null).map((row) => row.date)).size,
    completed: rows.filter((row) => row.status === "completed").length,
    count: rows.length,
  };
}

export function buildSmTimeDays(rows: SmTimeAssignment[]): SmTimeDay[] {
  const days = new Map<string, SmTimeDay>();
  for (const row of rows) {
    const key = `${row.date}:${row.smId}`;
    const existing = days.get(key);
    if (existing) existing.assignments.push(row);
    else days.set(key, { date: row.date, smId: row.smId, smName: row.smName, region: row.region, assignments: [row] });
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date) || a.smName.localeCompare(b.smName, "de-AT")).map((day) => ({ ...day, assignments: day.assignments.sort((a, b) => Number(!a.visitStartedAt) - Number(!b.visitStartedAt) || (a.visitStartedAt ?? "").localeCompare(b.visitStartedAt ?? "") || a.id.localeCompare(b.id)) }));
}

export function groupSmTimeEmployees(days: SmTimeDay[]) {
  const groups = new Map<string, SmTimeDay[]>();
  for (const day of days) groups.set(day.smId, [...(groups.get(day.smId) ?? []), day]);
  return [...groups.entries()].map(([id, employeeDays]) => ({ id, name: employeeDays[0].smName, region: employeeDays[0].region, days: employeeDays, summary: summarizeSmTime(employeeDays.flatMap((day) => day.assignments)) })).sort((a, b) => a.name.localeCompare(b.name, "de-AT") || a.id.localeCompare(b.id));
}

export function smVisitTimeLabel(start: string | null, end: string | null) {
  const valid = (value: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value) : null;
  const from = valid(start), to = valid(end);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" });
  const crossDay = from && to && day.format(from) !== day.format(to);
  const format = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit", ...(crossDay ? { day: "2-digit", month: "2-digit" } as const : {}) });
  if (!from && !to) return "Uhrzeiten nicht erfasst";
  return `${from ? format.format(from) : "—"} – ${to ? format.format(to) : "offen"}`;
}
