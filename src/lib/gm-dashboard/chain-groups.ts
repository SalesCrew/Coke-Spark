import type { DashboardChainGroup } from "@/types/gm-dashboard";

export const chainGroupOptions: { value: DashboardChainGroup; label: string }[] = [
  { value: "rewe", label: "REWE" },
  { value: "spar", label: "SPAR" },
  { value: "other", label: "Sonstige Märkte" },
];

export function marketChainGroup(chain: string | null): DashboardChainGroup {
  const normalized = (chain ?? "").replace(/\s+/g, "").toUpperCase();
  if (["BILLA", "BILLA+", "BILLAPLUS", "ISP", "ESP"].includes(normalized)) return "rewe";
  if (normalized === "SPAR") return "spar";
  return "other";
}

export function chainGroupLabel(groups: DashboardChainGroup[] = []): string {
  return chainGroupOptions.filter((option) => groups.includes(option.value)).map((option) => option.label).join(", ") || "Alle Marktketten";
}

// The shortcut selects the individual rows rather than becoming a chain group filter.
export const OTHER_CHAINS_SHORTCUT = "__gm_dashboard_other_chains__";
export function chainSelectionValues(chains: string[], otherChains: string[]): string[] {
  return otherChains.length && otherChains.every((chain) => chains.includes(chain))
    ? [...chains, OTHER_CHAINS_SHORTCUT]
    : chains;
}
export function updateChainSelection(current: string[], values: string[], otherChains: string[]): string[] {
  const hadShortcut = chainSelectionValues(current, otherChains).includes(OTHER_CHAINS_SHORTCUT);
  const hasShortcut = values.includes(OTHER_CHAINS_SHORTCUT);
  const rows = values.filter((value) => value !== OTHER_CHAINS_SHORTCUT);
  if (hadShortcut === hasShortcut) return rows;
  return hasShortcut ? [...new Set([...rows, ...otherChains])]
    : rows.filter((chain) => !otherChains.includes(chain));
}
