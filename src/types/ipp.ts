export type SectionType = "standard" | "flex" | "mhd" | "kuehler" | "billa";

export interface IppQuestionAnswer {
  questionId: string;
  questionText: string;
  questionType: "single" | "multiple" | "numeric" | "yesno";
  options?: string[];
  scoringMap: Record<string, number>; // option → IPP value; "__value__" for numeric with factor
  selectedAnswer: string | string[];
}

export interface IppSubmission {
  id: string;
  marketId: string;
  marketName: string;
  chain: string;
  postalCode: string;
  city: string;
  region: string;
  gmId: string;
  gmName: string;
  redMonatLabel: string;
  sectionType: SectionType;
  fragebogenName: string;
  submittedAt: string;
  questionAnswers: IppQuestionAnswer[];
}

// ── Normalized audit layer ─────────────────────────────────────

export interface IppQuestionAuditRow {
  questionFingerprint: string;
  questionText: string;
  questionType: IppQuestionAnswer["questionType"];
  selectedAnswer: string | string[];
  appliedIppValue: number;
  counted: boolean;
  countedReason: string; // why it was or was not counted
  sourceSections: SectionType[];
  sourceFrageboegen: string[];
  deduped: boolean; // true if identical question appeared in multiple sections
}

export interface IppMarketAuditRecord {
  id: string; // marketId + "_" + redMonatLabel
  marketId: string;
  marketName: string;
  chain: string;
  region: string;
  postalCode: string;
  city: string;
  gmName: string;
  redMonatLabel: string;
  marketIpp: number;
  includedInAverage: boolean;
  questionRows: IppQuestionAuditRow[];
  submissionRefs: Array<{ sectionType: SectionType; fragebogenName: string; submittedAt: string }>;
}

export interface IppAverageSummary {
  averageIpp: number;
  numeratorTotal: number;
  denominatorIncludedMarkets: number;
  excludedZeroMarkets: number;
  contributingQuestionCount: number;
  totalMarkets: number;
}
