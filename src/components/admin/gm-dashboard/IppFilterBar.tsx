"use client";

import { IppMiniDropdown, type IppMiniDropdownOption } from "@/components/admin/gm-dashboard/IppMiniDropdown";

export type IppFilterState = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
  marketId: string | null;
  stc: "gold" | "silver" | "bronze" | null;
};

export type IppGmOption = {
  id: string;
  label: string;
  region: string;
};

export type IppMarketOption = {
  id: string;
  label: string;
  region: string;
  gmName: string;
  chain: string;
  searchText?: string;
};

type IppFilterBarProps = {
  filters: IppFilterState;
  regions: string[];
  gms: IppGmOption[];
  markets: IppMarketOption[];
  onChange: (next: IppFilterState) => void;
  compact?: boolean;
  showReset?: boolean;
};

export function IppFilterBar({ filters, regions, gms, markets, onChange, compact = false, showReset = true }: IppFilterBarProps) {
  const selectedGm = gms.find((gm) => gm.id === filters.gmId) ?? null;
  const baseMarketOptions = markets.filter((market) => {
    if (filters.region && market.region !== filters.region) return false;
    if (selectedGm && market.gmName && selectedGm.label && market.gmName.trim().toLowerCase() !== selectedGm.label.trim().toLowerCase()) {
      return false;
    }
    return true;
  });
  const marketOptions = baseMarketOptions.filter((market) => !filters.chain || market.chain === filters.chain);

  const hasActiveFilters = Boolean(filters.region || filters.gmId || filters.chain || filters.marketId || filters.stc);
  const regionOptions: IppMiniDropdownOption[] = regions.map((region) => ({ value: region, label: region }));
  const gmOptions: IppMiniDropdownOption[] = gms
    .filter((gm) => !filters.region || gm.region === filters.region)
    .map((gm) => ({ value: gm.id, label: gm.label }));
  const chainOptionsMapped: IppMiniDropdownOption[] = Array.from(new Set(baseMarketOptions.map((market) => market.chain)))
    .filter((chain) => chain.length > 0)
    .sort((left, right) => left.localeCompare(right, "de"))
    .map((chain) => ({ value: chain, label: chain }));
  const marketOptionsMapped: IppMiniDropdownOption[] = marketOptions
    .map((market) => ({
      value: market.id,
      label: market.label,
      searchText: `${market.searchText ?? ""} ${market.region} ${market.gmName} ${market.chain}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "de"));
  const stcOptions: IppMiniDropdownOption[] = [
    { value: "gold", label: "Gold" },
    { value: "silver", label: "Silver" },
    { value: "bronze", label: "Bronze" },
  ];

  return (
    <section
      style={{
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(0,0,0,0.02)",
        padding: compact ? "6px 10px" : "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: compact ? 5 : 6,
      }}
    >
      <style>{`
        .ipp-reset-filters-btn:hover:not(:disabled) {
          background: linear-gradient(to bottom,#dc2626,#b91c1c) !important;
          box-shadow: 0 8px 20px rgba(220,38,38,0.22);
          transform: translateY(-1px);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: compact ? "space-between" : "space-between",
          gap: compact ? 6 : 8,
          flexWrap: compact ? "nowrap" : "wrap",
          overflow: "visible",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 6, flexWrap: compact ? "nowrap" : "wrap", minWidth: 0, flex: compact ? "1 1 auto" : "0 1 auto" }}>
          <IppMiniDropdown
            label="Region"
            value={filters.region}
            placeholder="Alle Regionen"
            options={regionOptions}
            minWidth={compact ? 106 : 134}
            onChange={(region) => onChange({ ...filters, region, marketId: null })}
          />
          <IppMiniDropdown
            label="GM"
            value={filters.gmId}
            placeholder="Alle GMs"
            options={gmOptions}
            minWidth={compact ? 132 : 182}
            onChange={(gmId) => onChange({ ...filters, gmId, marketId: null })}
          />
          <IppMiniDropdown
            label="Chain"
            value={filters.chain}
            placeholder="Alle Chains"
            options={chainOptionsMapped}
            minWidth={compact ? 152 : 250}
            onChange={(chain) => onChange({ ...filters, chain, marketId: null })}
          />
          <IppMiniDropdown
            label="Market"
            value={filters.marketId}
            placeholder="Alle Märkte"
            options={marketOptionsMapped}
            minWidth={compact ? 186 : 310}
            searchable
            searchPlaceholder="Markt, Region, GM, Chain suchen..."
            onChange={(marketId) => onChange({ ...filters, marketId })}
          />
          <IppMiniDropdown
            label="STC"
            value={filters.stc}
            placeholder="Alle STCs"
            options={stcOptions}
            minWidth={compact ? 102 : 142}
            onChange={(stc) =>
              onChange({
                ...filters,
                stc: stc === "gold" || stc === "silver" || stc === "bronze" ? stc : null,
              })
            }
          />
        </div>

        {showReset && (
        <button
          className="ipp-reset-filters-btn"
          type="button"
          onClick={() => onChange({ region: null, gmId: null, chain: null, marketId: null, stc: null })}
          disabled={!hasActiveFilters}
          style={{
            alignSelf: "center",
            marginLeft: compact ? 8 : 0,
            borderRadius: 7,
            border: "none",
            background: hasActiveFilters ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(220,38,38,0.28)",
            color: "#fff",
            fontSize: compact ? 9 : 10,
            fontWeight: 800,
            padding: compact ? "6px 9px" : "7px 10px",
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: hasActiveFilters ? "pointer" : "not-allowed",
            opacity: hasActiveFilters ? 1 : 0.55,
            boxShadow: hasActiveFilters
              ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)"
              : "none",
            transition: "all 0.16s ease",
          }}
        >
          Alle Filter zurücksetzen
        </button>
        )}
      </div>
    </section>
  );
}
