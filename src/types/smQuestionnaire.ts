export type SmQuestionType =
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

export type SmConditionalRule = {
  id: string;
  triggerQuestionId: string;
  operator: string;
  triggerValue: string;
  triggerValueMax: string;
  action: "hide" | "show";
  targetQuestionIds: string[];
};

export type SmOosRole = "detection" | "remediation";

export type SmOosCategory =
  | "action_placements"
  | "softdrinks_energy"
  | "water_near_water"
  | "juice_iced_tea";

export type SmOosAnswerOutcome =
  | "oos_present"
  | "oos_absent"
  | "resolved"
  | "partially_resolved"
  | "not_resolved"
  | "not_applicable";

export type SmOosConfig = {
  enabled?: boolean;
  role?: SmOosRole;
  category?: SmOosCategory;
  detectionQuestionId?: string;
  answerOutcomes?: Record<string, SmOosAnswerOutcome>;
  partialCountsAsResolved?: boolean;
  behobenAnswer?: string;
  nichtBehobenAnswer?: string;
};

export type SmQuestion = {
  id: string;
  text: string;
  type: SmQuestionType;
  required: boolean;
  options: string[];
  config: Record<string, unknown>;
  rules: SmConditionalRule[];
  oos?: SmOosConfig;
};

export type SmModule = {
  id: string;
  name: string;
  description: string;
  questions: SmQuestion[];
  createdAt: string;
};

export type SmQuestionnaire = {
  id: string;
  name: string;
  description: string;
  moduleIds: string[];
  status: "active" | "inactive";
  version: number;
  createdAt: string;
  nurEinmalAusfuellbar?: boolean;
};
