import type { SmQuestionnaireCatalogScope } from "./smQuestionnaire";

export interface SmPhotoArchiveFilters {
  from?: string;
  to?: string;
  SMDurcharbeitCatalogScope?: SmQuestionnaireCatalogScope;
  smUserId?: string;
  marketId?: string;
  questionnaireId?: string;
  search?: string;
  SMDurcharbeitCampaignId?: string;
  SMDurcharbeitMonth?: string;
}
export interface SmArchivePhoto {
  id: string; submissionId: string; assignmentId: string | null; questionId: string;
  questionText: string; moduleName: string; fileName: string | null; mimeType: string | null;
  byteSize: number | null; widthPx: number | null; heightPx: number | null; uploadedAt: string;
  workDate: string; smUserId: string; smName: string; marketId: string; marketName: string;
  address: string; postalCode: string; city: string; questionnaireId: string; questionnaireName: string;
  questionnaireVersion: number; SMDurcharbeitCatalogScope: SmQuestionnaireCatalogScope;
  SMDurcharbeitVisitId?: string | null; SMDurcharbeitTargetId?: string | null;
  SMDurcharbeitCampaignId?: string | null; SMDurcharbeitCampaignName?: string | null; SMDurcharbeitMonth?: string | null;
}
export interface SmArchivePhotoList {
  photos: SmArchivePhoto[]; total: number; page: number; pageSize: number;
  stats: { markets: number; questionnaires: number };
}
export interface SmArchivePhotoFacets {
  facets: Array<{ smUserId: string; smName: string; marketId: string; marketName: string; questionnaireId: string; questionnaireName: string;
    SMDurcharbeitCampaignId?: string | null; SMDurcharbeitCampaignName?: string | null; SMDurcharbeitMonth?: string | null }>;
  truncated: boolean;
}
export interface SmArchivePhotoUrl { id: string; signedUrl: string | null; expiresAt: string }
export interface SmPhotoArchiveApi {
  list: (filters: SmPhotoArchiveFilters & { page?: number; pageSize?: number }) => Promise<SmArchivePhotoList>;
  facets: (filters: SmPhotoArchiveFilters) => Promise<SmArchivePhotoFacets>;
  urls: (ids: string[]) => Promise<{ photos: SmArchivePhotoUrl[] }>;
  export: (filters: SmPhotoArchiveFilters) => Promise<{ photos: SmArchivePhoto[] }>;
}
