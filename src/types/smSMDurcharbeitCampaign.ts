export type SMDurcharbeitCampaign = {
  id: string; name: string; status: "draft" | "published" | "paused" | "archived";
  startDate: string; endDate: string; questionnaireVersionId: string; revision: number;
  rosterDraft: Array<{ smMarketId: string; smUserId: string | null }>;
  createdAt: string; updatedAt: string;
};
export type SMDurcharbeitTarget = {
  id: string; revision: number; campaignId: string; campaignName: string; campaignStatus: SMDurcharbeitCampaign["status"];
  startDate: string; endDate: string; month: string;
  market: { id: string; internalId: string; name: string; chain: string; address: string; postalCode: string; city: string; region: string };
  smUserId: string; smName: string; eligibility: "required" | "waived"; waiverReason: string | null;
  completed: boolean; available: boolean; draftVisitId: string | null; latestVisitId: string | null; latestSubmissionId: string | null;
  latestVisitSmUserId: string | null;
  completedAt: string | null; visitCount: number;
};
export type SMDurcharbeitTargetList = { month: string; currentMonth: string; months: string[]; targets: SMDurcharbeitTarget[] };
export type SMDurcharbeitCampaignOptions = {
  markets: Array<{ id: string; name: string; address: string; postalCode: string; city: string; region: string; chain: string;
    assignedSmUserId: string | null; sourcePerson: string | null }>;
  people: Array<{ id: string; firstName: string; lastName: string }>;
  questionnaires: Array<{ id: string; templateId: string; name: string; versionNumber: number; effectiveFrom: string | null; effectiveTo: string | null }>;
};
export type SMDurcharbeitTargetPreview = { target: SMDurcharbeitTarget; questionnaire: { name: string; versionNumber: number };
  profile: { travelTimeEnabled: boolean } };
export type SMDurcharbeitMonthlySummary = { required: number; completed: number; waived: number; physicalVisits: number };
export type SMDurcharbeitCampaignDraft = Pick<SMDurcharbeitCampaign, "name" | "startDate" | "endDate" | "questionnaireVersionId" | "rosterDraft">;
export type SMDurcharbeitPublicationPreview = { campaign: SMDurcharbeitCampaign; months: string[]; marketCount: number; targetCount: number;
  unresolved: string[]; overlapping: Array<{ id: string; name: string; marketId: string }>; legacy: Array<{ id: string; marketId: string; workDate: string }>; previewToken: string };
export type SMDurcharbeitReport = {
  month: string; targets: SMDurcharbeitTarget[];
  summary: SMDurcharbeitMonthlySummary & { coveragePercentage: number | null; latestSubmissions: number;
    validQuestionnaireVisits: number; actualMinutes: number; travelMinutes: number; availablePhotoUploads: number };
  questionResults: Array<{ questionVersionId: string; questionCode: string; text: string; type: string;
    applicable: number; answered: number; unanswered: number; average: number | null;
    distribution: Array<{ code: string; label: string; count: number; percentage: number | null }> }>;
  answers: Array<{ targetId: string; smName: string; sourceSubmissionId: string | null; sourceAnswerId: string | null;
    question: { id: string; submissionId: string; questionVersionId: string; questionCodeSnapshot: string;
      questionTypeSnapshot: string; questionTextSnapshot: string; answerOptionsSnapshot: Array<Record<string, unknown>> };
    answer: { id: string; answerState: string; answerVersion: number; valueJson: import("./smVisit").SmVisitAnswer | null; answeredAt: string | null } | null }>;
  physicalVisits: Array<{ id: string; targetId: string; submissionId: string; smUserId: string; smName: string; marketName: string;
    questionnaireValid: boolean; submittedAt: string; originalStartedAt: string | null; originalCompletedAt: string | null;
    startedAt: string | null; completedAt: string | null; actualMinutes: number | null; travelMinutes: number | null; timeRevision: number | null }>;
};
