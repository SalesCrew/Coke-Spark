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
