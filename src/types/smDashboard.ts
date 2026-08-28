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

export type SmDashboardPayload = {
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
  };
};

export type SmDashboardQuery = {
  from: string;
  to: string;
  region?: string;
  chain?: string;
  smUserId?: string;
  marketId?: string;
};
