import type { MarketRecord, MarketType } from "@/types/markets";

export const marketClassificationLabels = {
  universum: "Universum",
  kuehler: "Kühler",
  both: "Universum · Kühler",
};
export const universeRequiredFields = {
  flexNumber: "Flex-Nummer",
  name: "Name",
  address: "Adresse",
  postalCode: "Postleitzahl",
  city: "Ort",
  region: "Region",
} as const;
export type UniverseRequiredField = keyof typeof universeRequiredFields;

export function toggleMarketClassification(value: MarketType, dataset: "universum" | "kuehler"): MarketType {
  if (value === dataset) return value;
  if (value === "both") return dataset === "universum" ? "kuehler" : "universum";
  return "both";
}

export function missingMarketClassificationFields(previous: MarketRecord, draft: MarketRecord): string[] {
  const missing: string[] = [];
  if (draft.marketType !== "kuehler" && previous.marketType === "kuehler") {
    for (const key of Object.keys(universeRequiredFields) as UniverseRequiredField[]) {
      if (!draft[key].trim()) missing.push(key);
    }
    if (!["Nord", "West", "Ost", "Süd"].includes(draft.region) && !missing.includes("region")) missing.push("region");
  } else if (draft.marketType !== "kuehler" && previous.flexNumber.trim() && !draft.flexNumber.trim()) {
    missing.push("flexNumber");
  }
  if (draft.marketType !== "universum" && !(draft.kuehlerStammnr || draft.cokeMasterNumber).trim()) missing.push("kuehlerStammnr");
  return missing;
}
