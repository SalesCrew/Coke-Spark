// Frontend API contract: deliberately independent of the backend Git checkout.
// Keep in sync with backend model/workspace contracts (see contract regression test).
export type MetricUnit = "percent" | "points" | "count" | "eur";
export type MetricMethod =
  | "manual"
  | "answer_sum"
  | "availability"
  | "weighted_sum"
  | "sum"
  | "difference"
  | "average"
  | "ratio"
  | "steps";
export type ModelSource = {
  questionId: string;
  section: string;
  scoreKey: string;
  factor: boolean;
  weight: number;
  label: string;
  minFrequency: number;
  chains: string[];
  counting: "latest" | "once";
};
export type ModelMetric = {
  key: string;
  label: string;
  unit: MetricUnit;
  method: MetricMethod;
  inputs: string[];
  target: number | null;
  sources: ModelSource[];
  steps: { at: number; value: number }[];
  goal?: { halfAt: number; fullAt: number } | undefined;
  weights?: Record<string, number> | undefined;
  hint?: string | undefined;
  readOnly?: boolean | undefined;
  minValue?: number | undefined;
  maxValue?: number | undefined;
  integerOnly?: boolean | undefined;
  confirmation?: boolean | undefined;
  manualRewardCap?: number | undefined;
};
export type ModelTier = {
  key: string;
  label: string;
  group: string;
  rewardEur: number;
  conditions: {
    metricKey: string;
    operator: "gte" | "lte" | "eq";
    value: number;
  }[];
};
export type ModelPillar = {
  key: string;
  name: string;
  kind: "displays" | "distribution" | "flex" | "quality" | "custom";
  color: string;
  maxRewardEur: number;
  payoutMode: "highest" | "groups" | "manual";
  metrics: ModelMetric[];
  tiers: ModelTier[];
};
export type WaveModel = {
  version: 1;
  provenance: string;
  pillars: ModelPillar[];
};
export type MetricEntry = {
  gmId: string;
  pillarKey: string;
  metricKey: string;
  value: number | null;
  target: number | null;
  note: string;
  actorName?: string;
  updatedAt?: string;
};
export type MetricResult = {
  key: string;
  label: string;
  unit: MetricUnit;
  value: number | null;
  automatic: number | null;
  target: number | null;
  origin: "manual" | "automatic" | "pending";
  note: string;
  counted: number;
  excluded: number;
  actorName?: string | undefined;
  updatedAt?: string | undefined;
};
export type PillarResult = {
  key: string;
  name: string;
  color: string;
  earned: number;
  maximum: number;
  pending: boolean;
  metrics: MetricResult[];
  achieved: string[];
  next: string | null;
};
export type GmResult = {
  gmId: string;
  name: string;
  active: boolean;
  earned: number;
  maximum: number;
  pending: boolean;
  rank: number;
  pillars: PillarResult[];
};
export type Observation = {
  gmId: string;
  marketId: string;
  questionId: string;
  section: string;
  date: string;
  id: string;
  numeric: number | null;
  options: string[];
  frequency: number;
  chain: string;
};

export type WaveInfo = {
  id: string;
  name: string;
  year: number;
  quarter: number;
  status: "draft" | "active" | "archived";
  startDate: string;
  endDate: string;
  updatedAt: string;
};
export type Workspace = {
  legacyTotals?: {
    gmId: string;
    name: string;
    earned: number;
    totalPoints: number;
  }[];
  wave: WaveInfo;
  model: WaveModel | null;
  revision: number;
  entries: MetricEntry[];
  results: GmResult[];
  calculatedAt: string;
  closedAt: string | null;
  history: {
    id: string;
    revision: number;
    type: string;
    actor: string;
    at: string;
    payload: unknown;
  }[];
};
