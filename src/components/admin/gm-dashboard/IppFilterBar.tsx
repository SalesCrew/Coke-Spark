"use client";

import { IppMiniDropdown, type IppMiniDropdownOption } from "@/components/admin/gm-dashboard/IppMiniDropdown";

export type IppFilterState = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
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
};

type IppFilterBarProps = {
  filters: IppFilterState;
  regions: string[];
  gms: IppGmOption[];
  markets: IppMarketOption[];
  onChange: (next: IppFilterState) => void;
};

export function IppFilterBar({ filters, regions, gms, markets, onChange }: IppFilterBarProps) {
  const selectedGm = gms.find((gm) => gm.id === filters.gmId) ?? null;
  const marketOptions = markets.filter((market) => {
    if (filters.region && market.region !== filters.region) return false;
    if (selectedGm && market.gmName && selectedGm.label && market.gmName.trim().toLowerCase() !== selectedGm.label.trim().toLowerCase()) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = Boolean(filters.region || filters.gmId || filters.chain || filters.stc);
  const regionOptions: IppMiniDropdownOption[] = regions.map((region) => ({ value: region, label: region }));
  const gmOptions: IppMiniDropdownOption[] = gms
    .filter((gm) => !filters.region || gm.region === filters.region)
    .map((gm) => ({ value: gm.id, label: gm.label }));
  const chainOptionsMapped: IppMiniDropdownOption[] = Array.from(new Set(marketOptions.map((market) => market.chain)))
    .filter((chain) => chain.length > 0)
    .sort((left, right) => left.localeCompare(right, "de"))
    .map((chain) => ({ value: chain, label: chain }));
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
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <style>{`
        .ipp-reset-filters-btn:hover:not(:disabled) {
          background: linear-gradient(to bottom,#dc2626,#b91c1c) !important;
          box-shadow: 0 8px 20px rgba(220,38,38,0.22);
          transform: translateY(-1px);
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <IppMiniDropdown
            label="Region"
            value={filters.region}
            placeholder="Alle Regionen"
            options={regionOptions}
            minWidth={134}
            onChange={(region) => onChange({ ...filters, region })}
          />
          <IppMiniDropdown
            label="GM"
            value={filters.gmId}
            placeholder="Alle GMs"
            options={gmOptions}
            minWidth={182}
            onChange={(gmId) => onChange({ ...filters, gmId })}
          />
          <IppMiniDropdown
            label="Chain"
            value={filters.chain}
            placeholder="Alle Chains"
            options={chainOptionsMapped}
            minWidth={250}
            onChange={(chain) => onChange({ ...filters, chain })}
          />
          <IppMiniDropdown
            label="STC"
            value={filters.stc}
            placeholder="Alle STCs"
            options={stcOptions}
            minWidth={142}
            onChange={(stc) =>
              onChange({
                ...filters,
                stc: stc === "gold" || stc === "silver" || stc === "bronze" ? stc : null,
              })
            }
          />
        </div>

        <button
          className="ipp-reset-filters-btn"
          type="button"
          onClick={() => onChange({ region: null, gmId: null, chain: null, stc: null })}
          disabled={!hasActiveFilters}
          style={{
            alignSelf: "center",
            borderRadius: 8,
            border: "none",
            background: hasActiveFilters ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(220,38,38,0.28)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "9px 12px",
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
      </div>
    </section>
  );
}
