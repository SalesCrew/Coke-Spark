import type { DashboardChainGroup } from "@/types/gm-dashboard";

export const chainGroupOptions: { value: DashboardChainGroup; label: string }[] = [
  { value: "rewe", label: "REWE" },
  { value: "spar", label: "SPAR" },
  { value: "other", label: "Sonstige Märkte" },
];

export function marketChainGroup(chain: string | null): DashboardChainGroup {
  const normalized = (chain ?? "").replace(/\s+/g, "").toUpperCase();
  if (["BILLA", "BILLA+", "BILLAPLUS", "BILLACORSO"].includes(normalized)) return "rewe";
  if (["SPAR", "ISP", "ESP"].includes(normalized)) return "spar";
  return "other";
}

export function chainGroupLabel(groups: DashboardChainGroup[] = []): string {
  return chainGroupOptions.filter((option) => groups.includes(option.value)).map((option) => option.label).join(", ") || "Alle Marktketten";
}

// The shortcut selects the individual rows rather than becoming a chain group filter.
export const OTHER_CHAINS_SHORTCUT = "__gm_dashboard_other_chains__";
export type ChainSelectionShortcut = { value: string; label: string; chains: string[] };
export const REWE_CHAINS_SHORTCUT = "__gm_dashboard_rewe_chains__";
export const SPAR_CHAINS_SHORTCUT = "__gm_dashboard_spar_chains__";

export function chainSelectionValues(chains: string[], otherChains: string[], extra: ChainSelectionShortcut[] = []): string[] {
  const shortcuts = [...extra, { value: OTHER_CHAINS_SHORTCUT, label: "Sonstige Märkte", chains: otherChains }];
  return [...chains, ...shortcuts.filter((shortcut) => shortcut.chains.length && shortcut.chains.every((chain) => chains.includes(chain))).map((shortcut) => shortcut.value)];
}
export function updateChainSelection(current: string[], values: string[], otherChains: string[], extra: ChainSelectionShortcut[] = []): string[] {
  if (!values.length) return [];
  const shortcuts = [...extra, { value: OTHER_CHAINS_SHORTCUT, label: "Sonstige Märkte", chains: otherChains }];
  const shortcutValues = new Set(shortcuts.map((shortcut) => shortcut.value));
  const before = chainSelectionValues(current, otherChains, extra);
  const rows = values.filter((value) => !shortcutValues.has(value));
  const changed = shortcuts.find((shortcut) => before.includes(shortcut.value) !== values.includes(shortcut.value));
  if (!changed) return rows;
  return values.includes(changed.value) ? [...new Set([...rows, ...changed.chains])]
    : rows.filter((chain) => !changed.chains.includes(chain));
}
