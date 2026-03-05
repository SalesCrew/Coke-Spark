export type QuestionType =
  | "single"
  | "yesno"
  | "yesnomulti"
  | "multiple"
  | "likert"
  | "text"
  | "numeric"
  | "slider"
  | "photo"
  | "matrix";

export interface ScoringWeight {
  ipp?: number;   // undefined = not scored for IPP
  boni?: number;  // undefined = not scored for Boni
}

export interface ConditionalRule {
  id: string;
  triggerQuestionId: string;
  operator: string;
  triggerValue: string;
  triggerValueMax: string;
  action: "hide" | "show";
  targetQuestionIds: string[];
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  config: Record<string, unknown>;
  rules: ConditionalRule[];
  scoring: Record<string, ScoringWeight>; // key = option text (choice) or "__value__" (numeric)
}

export interface Module {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  createdAt: string;
  usedInCount: number;
}

export interface MarketAssignment {
  marketId: string;
  name: string;
  chain: string;
}

export interface Fragebogen {
  id: string;
  name: string;
  description: string;
  moduleIds: string[];
  markets: MarketAssignment[];
  scheduleType: "always" | "scheduled";
  startDate?: string;
  endDate?: string;
  createdAt: string;
  status: "active" | "scheduled" | "inactive";
  spezialfragen?: Question[]; // module-free, fragebogen-specific dynamic questions
}
