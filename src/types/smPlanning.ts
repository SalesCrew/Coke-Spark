export type SmPlanningStatus =
  | "planned"
  | "confirmed"
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "missed";

export type SmPlanningFrequency = "weekly" | "biweekly";
export type SmPlanningReassignmentScope = "occurrence" | "series_future";

export type SmGlobalQuestionnaireOption = {
  questionnaireTemplateId: string;
  latestPublishedVersionId: string;
  versionNumber: number;
  name: string;
  description: string;
};

export type SmGlobalQuestionnaireAssignment = {
  id: string;
  questionnaireTemplateId: string;
  assignedByUserId: string;
  assignedAt: string;
  questionnaire: SmGlobalQuestionnaireOption | null;
};

export type SmGlobalQuestionnaireConfiguration = {
  assignment: SmGlobalQuestionnaireAssignment | null;
  options: SmGlobalQuestionnaireOption[];
};

export type SmTimeChangeRequest = {
  id: string;
  assignmentId: string;
  smUserId: string;
  sourceTimeSubmissionId: string;
  kind: "time_change" | "deletion";
  originalMinutes: number;
  requestedMinutes: number | null;
  timestampCorrectionVersion: 0 | 1;
  originalStartedAt: string | null;
  originalCompletedAt: string | null;
  requestedStartedAt: string | null;
  requestedCompletedAt: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  appliedTimeSubmissionId: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmPlanningAssignment = {
  holidayAdjustment?: import("@/lib/sm/austrianHolidays").SmHolidayAdjustment | null;
  id: string;
  sourceType: "single" | "series";
  seriesId: string | null;
  seriesVersionId: string | null;
  seriesOccurrenceKey: string | null;
  status: SmPlanningStatus;
  original: {
    workDate: string;
    smUserId: string;
    smName: string;
    smMarketId: string;
    marketInternalId: string;
    marketName: string;
    plannedMinutes: number;
  };
  replacement: {
    workDate: string | null;
    smUserId: string | null;
    smName: string | null;
    smMarketId: string | null;
    marketInternalId: string | null;
    plannedMinutes: number | null;
  };
  effective: {
    workDate: string;
    smUserId: string;
    smName: string;
    smMarketId: string;
    marketInternalId: string;
    marketName: string;
    plannedMinutes: number;
    address: string;
    region: string;
  };
  series: {
    frequency: SmPlanningFrequency;
    weekdays: number[];
    validFrom: string;
    validTo: string;
    versionNumber: number;
  } | null;
  actualMinutes: number | null;
  timeEntry: {
    id: string;
    revisionNumber: number;
    actualMinutes: number;
    submittedByUserId: string;
    submittedAt: string;
    correctionReason: string | null;
  } | null;
  visit: {
    id: string;
    status: "draft" | "submitted" | "cancelled" | "invalidated";
    questionnaireName: string;
    visitTimeMode: "timer" | "manual" | null;
    travelMinutes: number | null;
    visitStartedAt: string | null;
    visitCompletedAt: string | null;
    submittedAt: string | null;
  } | null;
  pendingTimeChangeRequest: SmTimeChangeRequest | null;
  flatRateCents: number | null;
  questionnaireComplete: boolean;
  cancellation: {
    reason: string | null;
    cancelledAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSmPlanningAssignmentInput = {
  smMarketId: string;
  smUserId: string;
  workDate: string;
  plannedMinutes: number;
  flatRateCents?: number | null;
  idempotencyKey: string;
};

export type CreateSmPlanningSeriesInput = {
  smMarketId: string;
  smUserId: string;
  plannedMinutes: number;
  flatRateCents?: number | null;
  frequency: SmPlanningFrequency;
  weekdays: number[];
  validFrom: string;
  validTo: string;
  idempotencyKey: string;
};

export type UpdateSmPlanningAssignmentInput = {
  smMarketId?: string;
  plannedMinutes?: number;
  expectedUpdatedAt: string;
  reason?: string;
};

export type SmPlanningMutationResult = {
  assignmentId: string;
  updatedAt: string;
};
