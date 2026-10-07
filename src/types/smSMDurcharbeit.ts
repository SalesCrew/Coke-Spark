export type SMDurcharbeitCatalogScope = "standard" | "SMDurcharbeit";
export type SMDurcharbeitQuestionnaireSelection = {
  questionnaireTemplateId: string | null;
  questionnaireVersionId: string | null;
  name: string | null;
  versionNumber: number | null;
  catalogScope: SMDurcharbeitCatalogScope | null;
  source: "submission" | "override" | "central" | "legacy";
  available: boolean;
  blockReason: string | null;
  revision: string;
};
