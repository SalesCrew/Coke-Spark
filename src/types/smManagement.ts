import type { SmVisitAnswer, SmVisitQuestion } from "./smVisit";

export type SmManagedVisit = {
  SMDurcharbeitContext?: { visitId: string; targetId: string; campaignId: string; campaignName: string; month: string; timeRevision?: number | null } | null;
  SMDurcharbeitCatalogScope?: import("./smSMDurcharbeit").SMDurcharbeitCatalogScope | null;
  id: string; assignmentId: string | null; workDate: string; smUserId: string; smName: string;
  marketId: string; marketName: string; address: string; questionnaireId: string; questionnaireName: string;
  questionnaireVersion: number; startedAt: string | null; completedAt: string | null; submittedAt: string | null; answeredCount: number;
};
export type SmManagementFacet = Pick<SmManagedVisit, "smUserId" | "smName" | "marketId" | "marketName" | "questionnaireId" | "questionnaireName"> & { SMDurcharbeitCampaignId?: string | null; SMDurcharbeitCampaignName?: string | null; SMDurcharbeitMonth?: string | null };
export type SmManagementList = { visits: SmManagedVisit[]; nextCursor: { date: string; id: string } | null; facets: SmManagementFacet[]; facetsTruncated: boolean };
export type SmManagementQuery = { SMDurcharbeitCatalogScope?: import("./smSMDurcharbeit").SMDurcharbeitCatalogScope; SMDurcharbeitCampaignId?: string; SMDurcharbeitMonth?: string; from: string; to: string; smUserId?: string; marketId?: string; questionnaireId?: string; search?: string; cursorDate?: string; cursorId?: string; limit?: number };
export type SmManagementPhoto = { id: string; fileName: string | null; mimeType?: string | null; byteSize?: number | null; signedUrl: string | null; SMDurcharbeitInherited?: boolean; uploadedAt?: string };
export type SmManagedQuestion = SmVisitQuestion & { answer: SmVisitAnswer; answerId: string | null; answerState: string; photos: SmManagementPhoto[] };
export type SmManagementDetail = {
  version: string;
  visit: Omit<SmManagedVisit, "workDate" | "answeredCount"> & { travelMinutes: number | null; updatedAt: string };
  sections: Array<{ id: string; title: string; description: string; questions: SmManagedQuestion[] }>;
};
export type SmAdminPhotoReceipt = {
  id: string; questionId: string; storagePath: string; originalFileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number; expiresAt: number; proof: string;
};
export type SmAdminCorrection = { expectedVersion: string; clientMutationToken: string; reason: string;
  changes: Array<{ questionId: string; answer: SmVisitAnswer }>; uploads: SmAdminPhotoReceipt[] };
export type SmManagementHistory = { entries: Array<{ id: string; version: number; current: boolean; state: string;
  value: SmVisitAnswer; at: string; actor: string; reason: string | null; photos: SmManagementPhoto[] }>; nextCursor: number | null };
export type SmManagementApi = {
  list: (query: SmManagementQuery) => Promise<SmManagementList>;
  detail: (id: string) => Promise<SmManagementDetail>;
  history: (id: string, questionId: string, cursor?: number) => Promise<SmManagementHistory>;
  correct: (id: string, input: SmAdminCorrection) => Promise<{ replayed: boolean; result: { submissionId: string; answerIds: string[] } }>;
  upload: (id: string, questionId: string, file: File) => Promise<SmAdminPhotoReceipt>;
};
