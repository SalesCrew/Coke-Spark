export type SectionType = "standard" | "flex" | "billa" | "kuehler" | "mhd";

export interface PraemienThreshold {
  id: string;
  label: string;
  minPoints: number;
  rewardEur: number;
}

export interface PraemienSourceRef {
  id: string;
  sectionType: SectionType;
  fragebogenId: string;
  fragebogenName: string;
  moduleId: string;
  moduleName: string;
  questionId: string;
  questionText: string;
  scoringKey: string;
  boniValue: number;
  isFactorMode: boolean;
  displayLabel: string;
}

export interface PraemienPillar {
  id: string;
  name: string;
  description: string;
  color: string;
  sourceRefs: PraemienSourceRef[];
}

export interface PraemienQualityCriteria {
  zeiterfassung: number; // 0–100
  reporting: number;     // 0–100
  accuracy: number;      // 0–100
}

export interface PraemienQualitySubmission {
  gmId: string;
  gmName: string;
  scores: PraemienQualityCriteria;
  totalPoints: number; // rounded average of the three criteria (0–100)
  note?: string;
  updatedAt: string;
}

export interface PraemienQuarter {
  id: string;
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: "draft" | "active" | "archived";
  startDate: string;
  endDate: string;
  description: string;
  pillars: PraemienPillar[];
  thresholds: PraemienThreshold[];
  qualitySubmissions: PraemienQualitySubmission[];
  createdAt: string;
}
