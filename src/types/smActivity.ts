import type { SmVisitAnswer } from "@/types/smVisit";
import type { SmQuestionType } from "@/types/smQuestionnaire";

export type SmRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SmCompletedActivitySummary = {
  submissionId: string;
  assignmentId: string;
  workDate: string;
  plannedMinutes: number;
  actualMinutes: number | null;
  questionnaireName: string;
  questionnaireVersion: number;
  market: { id: string; name: string; internalId: string | null; address: string; postalCode: string; city: string };
  visitStartedAt: string | null;
  visitCompletedAt: string | null;
  submittedAt: string | null;
  totals: { questionCount: number; answeredCount: number; photoCount: number };
};

export type SmActivityAnswerChangeRequest = {
  id: string;
  status: SmRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  appliedAnswerId: string | null;
  appliedAt: string | null;
  submissionId: string;
  submissionQuestionId: string;
  originalAnswerId: string | null;
  questionText: string;
  questionType: SmQuestionType;
  questionConfig: Record<string, unknown>;
  questionOptions: Array<{ code: string; label: string; marksNotApplicable?: boolean }>;
  required: boolean;
  originalAnswerSnapshot: Record<string, unknown>;
  requestedAnswerPayload: SmVisitAnswer;
  requestedAnswerSummary: string;
  requestReason: string;
  autoApplicable: boolean;
  autoApplicabilityError: string | null;
  sm: { id: string; name: string; email: string };
  market: { id: string; name: string; address: string; postalCode: string; city: string };
  submission: { assignmentId: string | null; questionnaireName: string; questionnaireVersion: number; submittedAt: string | null; moduleName: string };
};

export type SmActivitySubmissionDeleteRequest = {
  id: string;
  status: SmRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  appliedAt: string | null;
  submissionId: string;
  requestReason: string;
  questionnaireName: string;
  questionnaireVersion: number;
  market: { id: string; name: string };
  submittedAt: string | null;
  sm: { id: string; name: string; email: string };
};

export type SmAdminTimeChangeRequest = {
  id: string;
  status: SmRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  assignmentId: string;
  kind: "time_change" | "deletion";
  originalMinutes: number;
  requestedMinutes: number | null;
  timestampCorrectionVersion: 0 | 1;
  originalStartedAt: string | null;
  originalCompletedAt: string | null;
  requestedStartedAt: string | null;
  requestedCompletedAt: string | null;
  requestReason: string;
  workDate: string;
  sm: { id: string; name: string; email: string };
  market: { id: string; name: string };
};
