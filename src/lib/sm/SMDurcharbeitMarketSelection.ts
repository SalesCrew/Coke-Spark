export type SMDurcharbeitSelectableMarket = { id: string; name: string; chain: string; address: string; city: string; sourcePerson?: string | null };

export function filterSMDurcharbeitMarkets<T extends SMDurcharbeitSelectableMarket>(markets: T[], chain: string, query: string): T[] {
  const search = query.trim().toLocaleLowerCase("de-AT");
  return markets.filter(market => (!chain || market.chain === chain) &&
    `${market.name} ${market.chain} ${market.address} ${market.city} ${market.sourcePerson ?? ""}`.toLocaleLowerCase("de-AT").includes(search));
}

/** Always uses the entire filtered set, independent of the rendered page size. */
export function updateSMDurcharbeitMarketSelection(selected: Set<string>, filteredIds: string[], action: "include" | "exclude" | "only"): Set<string> {
  const next = action === "only" ? new Set<string>() : new Set(selected);
  for (const id of filteredIds) if (action === "exclude") next.delete(id); else next.add(id);
  return next;
}
