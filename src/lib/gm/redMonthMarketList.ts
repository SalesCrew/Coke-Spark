type CampaignVisitProgress = {
  targetVisitCount?: number | null;
  submittedVisitCount?: number | null;
};

/** A market is done only when every active standard/Billa campaign has met its RED-month target. */
export function isRedMonthMarketComplete(campaigns: readonly CampaignVisitProgress[]): boolean {
  return campaigns.length > 0 && campaigns.every((campaign) => {
    const target = Number(campaign.targetVisitCount);
    const submitted = Number(campaign.submittedVisitCount);
    return Number.isFinite(target) && target > 0 && Number.isFinite(submitted) && submitted >= target;
  });
}

/** Keep the existing order within each group, with unfinished markets first. */
export function sortRedMonthMarkets<T extends { activeNowCampaigns: readonly CampaignVisitProgress[] }>(markets: readonly T[]): T[] {
  return [...markets].sort((left, right) =>
    Number(isRedMonthMarketComplete(left.activeNowCampaigns)) - Number(isRedMonthMarketComplete(right.activeNowCampaigns)),
  );
}
