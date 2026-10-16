import type { SmDashboardFilterOption, SmDashboardMarketContext } from "@/types/smDashboard";

export const SM_DASHBOARD_DIMENSIONS = ["region", "chain", "smUserId", "marketId"] as const;
export type SmDashboardDimension = typeof SM_DASHBOARD_DIMENSIONS[number];
export type SmDashboardDimensions = Record<SmDashboardDimension, string>;

function matches(market: SmDashboardMarketContext, filters: SmDashboardDimensions, except?: SmDashboardDimension) {
  return (except === "region" || !filters.region || market.region === filters.region)
    && (except === "chain" || !filters.chain || market.chain === filters.chain)
    && (except === "marketId" || !filters.marketId || market.value === filters.marketId)
    && (except === "smUserId" || !filters.smUserId || market.sms.some(person => person.value === filters.smUserId));
}

function unique(options: SmDashboardFilterOption[]) {
  return [...new Map(options.map(option => [option.value, option])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, "de-AT") || a.value.localeCompare(b.value));
}

/** Each dropdown ignores its own value, while respecting the other selected dimensions. */
export function smDashboardFilterOptions(contexts: SmDashboardMarketContext[], filters: SmDashboardDimensions) {
  const forDimension = (dimension: SmDashboardDimension) => contexts.filter(market => matches(market, filters, dimension));
  return {
    regions: unique(forDimension("region").filter(market => market.region).map(market => ({ value: market.region, label: market.region }))),
    chains: unique(forDimension("chain").filter(market => market.chain).map(market => ({ value: market.chain, label: market.chain }))),
    markets: unique(forDimension("marketId").map(({ value, label }) => ({ value, label }))),
    sms: unique(forDimension("smUserId").flatMap(market => market.sms)),
  };
}

/** The latest explicit choice wins; retain every other choice that still matches it. */
export function reconcileSmDashboardFilters<T extends SmDashboardDimensions>(filters: T, contexts: SmDashboardMarketContext[], changed?: SmDashboardDimension): T {
  const result = { ...filters, region: "", chain: "", smUserId: "", marketId: "" };
  const order = changed ? [changed, ...SM_DASHBOARD_DIMENSIONS.filter(key => key !== changed)] : SM_DASHBOARD_DIMENSIONS;
  for (const key of order) {
    if (!filters[key]) continue;
    const candidate = { ...result, [key]: filters[key] };
    if (contexts.some(market => matches(market, candidate))) result[key] = filters[key];
  }
  return result;
}
