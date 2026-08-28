import type { SmPlanningStatus } from "@/types/smPlanning";
import type { SmQuestionType } from "@/types/smQuestionnaire";

export type SmVisitAnswer =
  | { kind: "empty" }
  | { kind: "choice"; optionCode: string }
  | { kind: "multi"; optionCodes: string[] }
  | { kind: "yesnomulti"; optionCode: string; subOptions: string[] }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "matrix"; cells: Array<{ rowCode: string; columnCode: string; selected: boolean }> }
  | { kind: "photo"; fileIds: string[] };

export type SmVisitQuestion = {
  id: string;
  questionCode: string;
  type: SmQuestionType;
  text: string;
  required: boolean;
  config: Record<string, unknown>;
  options: Array<{ code: string; label: string; marksNotApplicable?: boolean }>;
  rules: Array<Record<string, unknown>>;
  applicable: boolean;
  applicabilityReason: string | null;
};

export type SmVisitSection = {
  id: string;
  code: string;
  name: string;
  description: string;
  questions: SmVisitQuestion[];
};

export type SmVisitPayload = {
  assignment: {
    id: string;
    status: SmPlanningStatus;
    workDate: string;
    plannedMinutes: number;
    market: {
      id: string;
      name: string;
      internalId: string;
      address: string;
      postalCode: string;
      city: string;
      region: string;
    };
  };
  profile: { name: string; travelTimeEnabled: boolean };
  questionnaireAvailability: { count: number; names: string[] };
  submission: null | {
    id: string;
    status: "draft" | "submitted" | "invalidated" | "cancelled";
    questionnaireName: string;
    questionnaireVersion: number;
    visitTimeMode: "timer" | "manual" | null;
    travelMinutes: number | null;
    manualVisitMinutes: number | null;
    actualMinutes: number | null;
    visitStartedAt: string | null;
    visitCompletedAt: string | null;
    submittedAt: string | null;
    lastSavedAt: string;
    answeredQuestionCount: number;
    resolvedQuestionCount: number;
  };
  sections: SmVisitSection[];
  answers: Record<string, SmVisitAnswer | null>;
  answerVersions: Record<string, number>;
  photoFiles: Record<string, Array<{
    id: string;
    fileName: string | null;
    mimeType: string | null;
    byteSize: number | null;
    signedUrl: string | null;
  }>>;
};

export type SmVisitReceipt = {
  submissionId: string;
  submittedAt: string;
  actualMinutes: number | null;
};
