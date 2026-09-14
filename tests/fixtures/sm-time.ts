import type { SmPlanningAssignment, SmTimeChangeRequest } from "../../src/types/smPlanning";

export function timeFixture(id: string, day: string, minutes: number | null, travel = 0, person = "ada"): SmPlanningAssignment {
  const name = person === "ada" ? "Ada Beispiel" : "Ben Beispiel";
  const original = { workDate: day, smUserId: person, smName: name, smMarketId: `market-${id}`, marketInternalId: `SM-${id}`, marketName: `Testmarkt ${id}`, plannedMinutes: 60 };
  return {
    id, sourceType: "single", seriesId: null, seriesVersionId: null, seriesOccurrenceKey: null,
    status: minutes === null ? "planned" : "completed", original,
    effective: { ...original, address: "Musterstraße 1 · Wien", region: "Ost" },
    replacement: { workDate: null, smUserId: null, smName: null, smMarketId: null, marketInternalId: null, plannedMinutes: null },
    series: null, actualMinutes: minutes,
    timeEntry: minutes === null ? null : { id: `time-${id}`, revisionNumber: 1, actualMinutes: minutes, submittedByUserId: person, submittedAt: `${day}T12:00:00Z`, correctionReason: null },
    visit: minutes === null ? null : { id: `visit-${id}`, status: "submitted", questionnaireName: "Lokale Testfragen", visitTimeMode: "timer", travelMinutes: travel, visitStartedAt: `${day}T07:00:00Z`, visitCompletedAt: new Date(new Date(`${day}T07:00:00Z`).getTime() + minutes * 60000).toISOString(), submittedAt: `${day}T12:00:00Z` },
    pendingTimeChangeRequest: null, flatRateCents: null, questionnaireComplete: minutes !== null, cancellation: null,
    createdAt: "2026-08-01T12:00:00Z", updatedAt: "2026-09-14T12:00:00Z",
  };
}

export function smTimeFixtures() {
  const rows = [timeFixture("aug", "2026-08-31", 60, 10), timeFixture("first", "2026-09-01", 60, 15), timeFixture("middle", "2026-09-14", 90), timeFixture("ben", "2026-09-14", 45, 10, "ben"), timeFixture("planned", "2026-09-14", null), timeFixture("last", "2026-09-30", 30, 5), timeFixture("oct", "2026-10-01", 120, 10)];
  const request: SmTimeChangeRequest = { id: "local-request", assignmentId: "ben", smUserId: "ben", sourceTimeSubmissionId: "time-ben", kind: "time_change", originalMinutes: 45, requestedMinutes: 60, timestampCorrectionVersion: 1, originalStartedAt: "2026-09-14T07:00:00Z", originalCompletedAt: "2026-09-14T07:45:00Z", requestedStartedAt: "2026-09-14T07:00:00Z", requestedCompletedAt: "2026-09-14T08:00:00Z", reason: "Lokale Korrekturprüfung", status: "pending", reviewedByUserId: null, reviewedAt: null, adminNote: null, appliedTimeSubmissionId: null, appliedAt: null, createdAt: "2026-09-14T12:00:00Z", updatedAt: "2026-09-14T12:00:00Z" };
  rows[3].pendingTimeChangeRequest = request;
  const cancelled = timeFixture("cancelled", "2026-09-14", 99, 99); cancelled.status = "cancelled"; rows.push(cancelled);
  const draft = timeFixture("draft", "2026-09-14", null); draft.status = "in_progress";
  draft.visit = { ...rows[1].visit!, id: "draft-visit", status: "draft", visitStartedAt: "2026-09-14T10:00:00Z", visitCompletedAt: null, submittedAt: null, travelMinutes: 25 };
  rows.push(draft);
  return rows;
}
