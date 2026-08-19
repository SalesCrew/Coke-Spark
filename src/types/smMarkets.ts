export type SmMarketWeekdayKey = "mo" | "di" | "mi" | "do" | "fr";

export type SmMarketRecord = {
  id: string;
  internalId: string;
  flexNumber?: string;
  masterNumber?: string;
  name: string;
  dbName: string;
  chain?: string;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  infoFlag: boolean;
  infoNote: string;
  isActive: boolean;
  serviceDaysPerWeek?: number;
  weekdayHours?: Partial<Record<SmMarketWeekdayKey, number>>;
  weeklyHours?: number;
  shelfMerchandiserName?: string;
  assignedSmUserId: string | null;
  fieldServiceManagerName?: string;
  sourceInfo?: string;
  importSourceFileName?: string;
  importedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SmMarketImportFieldKey =
  | "flexNumber"
  | "internalMarketId"
  | "name"
  | "address"
  | "postalCode"
  | "city"
  | "region"
  | "serviceDaysPerWeek"
  | "mondayHours"
  | "tuesdayHours"
  | "wednesdayHours"
  | "thursdayHours"
  | "fridayHours"
  | "weeklyHours"
  | "shelfMerchandiserName"
  | "fieldServiceManagerName"
  | "sourceInfo"
  | "isActive";

export type SmMarketColumnMapping = Partial<Record<SmMarketImportFieldKey, string>>;

export type SmMarketImportSummary = {
  fileName: string;
  sheetName: string;
  totalParsedRows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  matchedBy: {
    internalMarketId: number;
    flexNumber: number;
    namePostalAddress: number;
  };
  skippedReasons: Array<{
    row: number;
    reason: string;
    sample: string;
  }>;
};

export type ImportSmMarketsInput = {
  fileName: string;
  sheetName: string;
  rows: string[][];
  mapping: SmMarketColumnMapping;
};

export type CreateSmMarketInput = {
  internalMarketId: string;
  flexNumber?: string | null;
  name: string;
  dbName?: string;
  chain: string;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  adminInfoNote?: string;
  assignedSmUserId?: string | null;
  isActive?: boolean;
};

export type UpdateSmMarketInput = Partial<CreateSmMarketInput>;
