export type SectionType = "standard" | "flex" | "mhd" | "kuehler" | "billa";

export interface IppQuestionAnswer {
  questionId: string;
  questionText: string;
  questionType: "single" | "multiple" | "numeric" | "yesno";
  options?: string[];
  scoringMap: Record<string, number>;
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

export interface IppQuestionAuditRow {
  questionFingerprint: string;
  questionId: string;
  questionText: string;
  questionType: string;
  selectedAnswer: string | string[];
  appliedIppValue: number;
  counted: boolean;
  countedReason: string;
  sourceSections: string[];
  sourceFrageboegen: string[];
  deduped: boolean;
  section: SectionType | null;
  fragebogenName: string | null;
  submittedAt: string | null;
}

export interface IppMarketAuditRecord {
  id: string;
  marketId: string;
  marketName: string;
  chain: string;
  region: string;
  postalCode: string;
  city: string;
  gmName: string;
  redMonatLabel: string;
  redPeriodStart: string;
  redPeriodEnd: string;
  redPeriodYear: number;
  marketIpp: number;
  includedInAverage: boolean;
  isFinalized: boolean;
  questionRows: IppQuestionAuditRow[];
  sourceSubmissionCount?: number;
  contributingQuestionCount?: number;
}

export interface IppAverageSummary {
  averageIpp: number;
  numeratorTotal: number;
  denominatorIncludedMarkets: number;
  excludedZeroMarkets: number;
  contributingQuestionCount: number;
  totalMarkets: number;
}
