import type { SMDurcharbeitQuestionnaireSelection } from "@/types/smSMDurcharbeit";
/** Frozen questionnaire identity wins. Market membership never relabels a saved standard visit. */
export function isSMDurcharbeitAssignment(row: { SMDurcharbeitQuestionnaireSelection?: SMDurcharbeitQuestionnaireSelection; SMDurcharbeitMarket?: boolean }) {
  const scope = row.SMDurcharbeitQuestionnaireSelection?.catalogScope;
  return scope ? scope === "SMDurcharbeit" : row.SMDurcharbeitMarket === true;
}
