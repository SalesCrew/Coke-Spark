import type { SmTimeChangeRequest } from "./smPlanning";

/** An actual physical campaign visit, never a dated planning assignment. */
export type SMDurcharbeitTimeEntry = {
  visitId: string; submissionId: string; targetId: string; smUserId: string; smName: string;
  marketId: string; marketName: string; marketAddress: string; marketInternalId: string;
  campaignId: string; campaignName: string; month: string; workDate: string;
  startedAt: string | null; completedAt: string | null; originalStartedAt: string | null; originalCompletedAt: string | null;
  actualMinutes: number | null; travelMinutes: number; revision: number | null; questionnaireComplete: boolean; submittedAt: string | null;
  pendingTimeChangeRequest: SmTimeChangeRequest | null;
};

export type SMDurcharbeitTimeHistory = {
  visitId: string; originalStartedAt: string | null; originalCompletedAt: string | null; timeRemoved: boolean;
  revisions: Array<{ revision: number; startedAt: string; completedAt: string; actualMinutes: number; travelMinutes: number;
    reason: string; recordedAt: string; isCurrent: boolean }>;
  nextRevision: number | null;
};
