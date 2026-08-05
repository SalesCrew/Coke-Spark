export type SectionType = "standard" | "flex" | "kuehler" | "mhd" | "billa" | "durcharbeit";
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
  isActive: boolean;
  infoNote: string;
  ipp: number | null;
  importSourceFileName: string;
  importedAt: string;
  plannedToId?: string | null;
  isDeleted?: boolean;
}

export interface KuehlerUnitRecord {
  id: string;
  marketId: string;
  name: string;
  employee: string;
  kuehlerInternalId: string | null;
  kuehlerBd: string | null;
  kuehlerAnzahlKsAmStandort: number | null;
  kuehlerSerialNumber: string | null;
  kuehlerTechnicalIdentNo: string | null;
  kuehlerModel: string | null;
  importSourceFileName: string;
  importedAt: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  dbName: string[];
  employee: string | null;
  universeMarket: "Ja" | "Nein" | null;
  kuehlerMarket: "Ja" | "Nein" | null;
  infoFlag: "Ja" | "Nein" | null;
  currentGmName: string | null;
  redMonatVisited: "Alle" | "Besucht" | "Nicht besucht" | null;
  frequencyBucket: "4" | "6" | "12" | "Sonstige" | null;
}
