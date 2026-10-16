export type SmDashboardOosCategory =
  | "action_placements"
  | "softdrinks_energy"
  | "water_near_water"
  | "juice_iced_tea";

export type SmDashboardMetricSummary = {
  completedVisits: number;
  submittedMarkets: number;
  classifiedChecks: number;
  foundCases: number;
  foundRate: number | null;
  fixedCases: number;
  fixedRate: number | null;
  documentedRemediations: number;
  openRemediationDocumentation: number;
  observedMarkets: number;
  marketsWithOos: number;
  affectedMarketRate: number | null;
};

export type SmDashboardCategoryRow = SmDashboardMetricSummary & {
  category: SmDashboardOosCategory;
  label: string;
};

export type SmDashboardDimensionRow = SmDashboardMetricSummary & {
  id: string;
  label: string;
};

export type SmDashboardFilterOption = {
  value: string;
  label: string;
};

export type SmDashboardMarketContext = SmDashboardFilterOption & {
  region: string;
  chain: string;
  sms: SmDashboardFilterOption[];
};

export type SmDashboardOverviewMetrics = {
  activity: {
    visitedMarkets: number; visits: number; merchandisers: number;
    visitsPerMarket: number | null; marketMinutes: number; timedVisits: number;
    missingTimeVisits: number; marketHours: number | null; hoursPerVisit: number | null;
  };
  performance: {
    basicActivityRate: number | null; basicActivityAnswers: number; basicActivityPoints: number;
    basicActivityYes: number; basicActivityPartial: number; basicActivityNo: number;
    affectedMarketRate: number | null; affectedMarkets: number; observedMarkets: number;
    foundCategoryCases: number; fixedCategoryCases: number; categoryChecks: number;
    remediationRate: number | null; availabilityBefore: number | null;
    availabilityGain: number | null; availabilityAfter: number | null;
    missingRemediationCases: number;
  };
};

export type SmDashboardPayload = {
  overview?: SmDashboardOverviewMetrics;
  SMDurcharbeitBreakdown?: Record<import("./smSMDurcharbeit").SMDurcharbeitCatalogScope, { completedVisits: number; answeredQuestions: number }>;
  meta: {
    from: string;
    to: string;
    timezone: "Europe/Vienna";
    generatedAt: string;
    filters: {
      region: string | null;
      chain: string | null;
      smUserId: string | null;
      marketId: string | null;
      SMDurcharbeitCatalogScope?: import("./smSMDurcharbeit").SMDurcharbeitCatalogScope | null;
    };
  };
  summary: SmDashboardMetricSummary;
  categories: SmDashboardCategoryRow[];
  chains: SmDashboardDimensionRow[];
  regions: SmDashboardDimensionRow[];
  filterOptions: {
    regions: SmDashboardFilterOption[];
    chains: SmDashboardFilterOption[];
    markets: SmDashboardFilterOption[];
    sms: SmDashboardFilterOption[];
    marketContexts?: SmDashboardMarketContext[];
  };
};

export type SmDashboardQuery = {
  SMDurcharbeitCatalogScope?: import("./smSMDurcharbeit").SMDurcharbeitCatalogScope;
  from: string;
  to: string;
  region?: string;
  chain?: string;
  smUserId?: string;
  marketId?: string;
};

export type SmHomeDashboardPayload = {
  userId: string;
  name: string;
  assignmentsToday: number;
  date: string;
  timezone: "Europe/Vienna";
  generatedAt: string;
  visits: {
    completed: number;
    classified: number;
    withoutOos: number;
    fixedOos: number;
    openOos: number;
    unclassified: number;
  };
};
