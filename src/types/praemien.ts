export type SectionType = "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";

export interface PraemienThreshold {
  id: string;
  label: string;
  minPoints: number;
  rewardEur: number;
}

export interface PraemienSourceRef {
  id: string;
  catalogKey: string;
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
  distributionFreqRule?: "lt8" | "gt8"; // only set when assigned to Distributionsziel
}

export type PraemienRewardModel = "global_thresholds" | "pillar_targets" | "pillar_tiers";
export type PraemienPayoutMode = "highest_tier" | "sum_earned_tiers";
export type PraemienMetricUnit = "points" | "percent" | "count" | "currency";
export type PraemienMetricValueSource =
  | "contribution_points"
  | "contribution_percent"
  | "quality_zeiterfassung"
  | "quality_reporting"
  | "quality_accuracy"
  | "quality_average"
  | "flex_total_points"
  | "flex_component";

export interface PraemienPillarMetric {
  id: string;
  key: string;
  label: string;
  unit: PraemienMetricUnit;
  valueSource: PraemienMetricValueSource;
  sourceKey?: string | null;
  orderIndex: number;
}

export interface PraemienPillarTierCondition {
  id: string;
  metricKey: string;
  operator: "gte" | "lte" | "eq";
  thresholdValue: number;
  orderIndex: number;
}

export interface PraemienPillarTier {
  id: string;
  label: string;
  orderIndex: number;
  rewardEur: number;
  conditions: PraemienPillarTierCondition[];
}

export interface PraemienPillar {
  id: string;
  name: string;
  description: string;
  color: string;
  isManual?: boolean;
  payoutMode: PraemienPayoutMode;
  maxRewardEur: number;
  metrics: PraemienPillarMetric[];
  tiers: PraemienPillarTier[];
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

export interface PraemienFlexSubmission {
  gmId: string;
  gmName: string;
  totalPoints: number; // 0-100, filled later by admin like quality
  componentValues: Record<string, number>;
  note?: string;
  updatedAt: string;
}

export interface PraemienPillarOverride {
  id: string;
  pillarId: string;
  gmId: string;
  gmName: string;
  points: number;
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
  rewardModel: PraemienRewardModel;
  pillars: PraemienPillar[];
  thresholds: PraemienThreshold[];
  qualitySubmissions: PraemienQualitySubmission[];
  flexSubmissions: PraemienFlexSubmission[];
  pillarOverrides: PraemienPillarOverride[];
  createdAt: string;
  updatedAt?: string;
  timezone?: string;
}

export interface PraemienGmGoalProgress {
  pillarId: string;
  name: string;
  color: string;
  points: number;
  maxPoints: number;
  percent: number;
  isManual?: boolean;
  isPending?: boolean;
  earnedRewardEur?: number;
  maxRewardEur?: number;
  metricValues?: Record<string, number>;
  achievedTierLabels?: string[];
  nextTierLabel?: string | null;
}

export interface PraemienGmBonusSummary {
  hasActiveWave: boolean;
  waveId: string | null;
  waveName: string | null;
  year: number | null;
  quarter: number | null;
  startDate: string | null;
  endDate: string | null;
  rewardModel?: PraemienRewardModel | null;
  totalPoints: number;
  totalMaxPoints: number;
  currentRewardEur: number;
  fullRewardEur: number;
  goals: PraemienGmGoalProgress[];
  thresholds: Array<{
    label: string;
    minPoints: number;
    rewardEur: number;
  }>;
}
