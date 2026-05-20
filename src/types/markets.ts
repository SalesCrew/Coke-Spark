export type SectionType = "standard" | "flex" | "kuehler" | "mhd" | "billa";
export type MarketType = "universum" | "kuehler" | "both";

export interface MarketRecord {
  id: string;
  // Visible columns
  name: string;
  dbName: string;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  emEh: string;
  currentGmName: string;
  plannedByActiveStandardGmName?: string | null;
  visitFrequencyPerYear: number;
  infoFlag: boolean;
  // Detail-only
  flexNumber: string;
  cokeMasterNumber: string;
  standardMarketNumber: string;
  employee: string;
  universeMarket: boolean;
  marketType: MarketType;
  kuehlerStammnr: string;
  kuehlerBd: string;
  kuehlerAnzahlKsAmStandort: number | null;
  kuehlerInternalId: string;
  kuehlerSerialNumber: string;
  kuehlerModel: string;
  isActive: boolean;
  infoNote: string;
  ipp: number | null;
  importSourceFileName: string;
  importedAt: string;
  plannedToId?: string | null;
  isDeleted?: boolean;
}

export interface MarketVisitLog {
  id: string;
  marketId: string;
  marketName?: string;
  sectionType: SectionType;
  fragebogenName: string;
  gmName: string;
  visitedAt: string;
  durationMin: number;
  redMonatLabel: string;
}

export interface MarketFilters {
  region: string | null;
  city: string | null;
  postalCode: string | null;
  emEh: string | null;
  employee: string | null;
  universeMarket: "Ja" | "Nein" | null;
  kuehlerMarket: "Ja" | "Nein" | null;
  infoFlag: "Ja" | "Nein" | null;
  currentGmName: string | null;
  redMonatVisited: "Alle" | "Besucht" | "Nicht besucht" | null;
  frequencyBucket: "4" | "6" | "12" | "Sonstige" | null;
}
