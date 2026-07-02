// ── Märkte Excel Import Helpers ──────────────────────────────
// All parsing and merge logic lives here so the modal stays clean.

import type { MarketRecord } from "@/types/markets";

// ── Excel column-letter utilities ─────────────────────────────

/** Convert "A" → 0, "B" → 1, "Z" → 25, "AA" → 26 */
export function excelColToIndex(col: string): number {
  const s = col.trim().toUpperCase();
  let idx = 0;
  for (let i = 0; i < s.length; i++) {
    idx = idx * 26 + (s.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/** Convert 0 → "A", 25 → "Z", 26 → "AA" */
export function indexToExcelCol(n: number): string {
  let result = "";
  let num = n + 1;
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/** True when a column-letter string is syntactically valid */
export function isValidColLetter(s: string): boolean {
  return /^[A-Za-z]{1,3}$/.test(s.trim());
}

// ── Workbook parsing ──────────────────────────────────────────

export interface WorkbookResult {
  sheetName: string;
  /** All rows as string-matrix (row-major, index 0 = first row). */
  rows: string[][];
  /** Column count of the widest row. */
  colCount: number;
}

export async function readWorkbook(file: File): Promise<WorkbookResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const rows: string[][] = (rawData as unknown[][]).map((r) =>
    (r as unknown[]).map((c) => (c == null ? "" : String(c)))
  );
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return { sheetName, rows, colCount };
}

// ── Preview grid helpers ──────────────────────────────────────

export interface PreviewGrid {
  colLetters: string[];   // ["A","B","C",...]
  headerRow: string[];    // first row values
  previewRows: string[][]; // rows 1..N (excluding row 0 header)
  rowNumbers: number[];   // 1-based row numbers for preview rows
  colCount: number;
}

export const PREVIEW_MAX_ROWS = 50;

export function buildPreviewGrid(rows: string[][]): PreviewGrid {
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const colLetters = Array.from({ length: colCount }, (_, i) => indexToExcelCol(i));
  const headerRow = rows[0] ? rows[0].map((c) => c ?? "") : [];
  const dataRows = rows.slice(1, 1 + PREVIEW_MAX_ROWS);
  // Pad each row to colCount
  const previewRows = dataRows.map((r) =>
    Array.from({ length: colCount }, (_, i) => r[i] ?? "")
  );
  const rowNumbers = dataRows.map((_, i) => i + 2); // 2-based because row 1 is header
  return { colLetters, headerRow, previewRows, rowNumbers, colCount };
}

/** Get the header label for a given col letter from the parsed workbook. */
export function getColHeader(rows: string[][], colLetter: string): string {
  if (!isValidColLetter(colLetter) || !rows[0]) return "";
  const idx = excelColToIndex(colLetter);
  return rows[0][idx] ?? "";
}

/** Get the first non-empty value in a column (from row 1 onwards). */
export function getColSample(rows: string[][], colLetter: string): string {
  if (!isValidColLetter(colLetter)) return "";
  const idx = excelColToIndex(colLetter);
  for (let i = 1; i < rows.length; i++) {
    const v = rows[i]?.[idx];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

// ── Column mapping spec ───────────────────────────────────────

export interface FieldSpec {
  key: MarketImportFieldKey;
  label: string;       // German display label
  required: boolean;   // required to pass minimum validation
  isIdentity: boolean; // any one identity field satisfies the identity requirement
}

export type MarketImportFieldKey =
  | keyof MarketRecord
  | "kuehlerInternalId"
  | "kuehlerBd"
  | "kuehlerAnzahlKsAmStandort"
  | "kuehlerSerialNumber"
  | "kuehlerModel";

export type ImportDatasetType = "universum" | "kuehler" | "update";

export const UNIVERSUM_FIELD_SPECS: FieldSpec[] = [
  { key: "standardMarketNumber", label: "Standardmarkt Nr",    required: false, isIdentity: true  },
  { key: "cokeMasterNumber",     label: "Stammnr. von Coke",   required: false, isIdentity: true  },
  { key: "flexNumber",           label: "Flex-Nummer",         required: false, isIdentity: true  },
  { key: "name",                 label: "Name",                required: true,  isIdentity: false },
  { key: "address",              label: "Adresse",             required: true,  isIdentity: false },
  { key: "postalCode",           label: "Postleitzahl",        required: true,  isIdentity: false },
  { key: "city",                 label: "Ort",                 required: true,  isIdentity: false },
  { key: "dbName",               label: "Name f. DB",          required: false, isIdentity: false },
  { key: "emEh",                 label: "EM/EH",               required: false, isIdentity: false },
  { key: "region",               label: "Region",              required: true,  isIdentity: false },
  { key: "employee",             label: "Mitarbeiter",         required: false, isIdentity: false },
  { key: "universeMarket",       label: "Universums-Markt",    required: false, isIdentity: false },
  { key: "visitFrequencyPerYear",label: "Besuchsrhythmus",     required: false, isIdentity: false },
  { key: "infoFlag",             label: "Info",                required: false, isIdentity: false },
];

export const KUEHLER_FIELD_SPECS: FieldSpec[] = [
  { key: "kuehlerStammnr",            label: "Stammnr",               required: false, isIdentity: true  },
  { key: "flexNumber",                label: "Flex-Nummer",           required: false, isIdentity: true  },
  { key: "kuehlerInternalId",         label: "internal_id",           required: false, isIdentity: false },
  { key: "kuehlerBd",                 label: "BD",                    required: false, isIdentity: false },
  { key: "kuehlerAnzahlKsAmStandort", label: "Anzahl KS am Standort", required: false, isIdentity: false },
  { key: "kuehlerSerialNumber",       label: "Serial Number",         required: false, isIdentity: false },
  { key: "name",                      label: "Name",                  required: true,  isIdentity: false },
  { key: "address",                   label: "Street name",           required: true,  isIdentity: false },
  { key: "postalCode",                label: "PLZ",                   required: true,  isIdentity: false },
  { key: "city",                      label: "Ort",                   required: true,  isIdentity: false },
  { key: "region",                    label: "Region",                required: true,  isIdentity: false },
  { key: "kuehlerModel",              label: "Model",                 required: false, isIdentity: false },
  { key: "employee",                  label: "Mitarbeiter",           required: false, isIdentity: false },
];

export const UPDATE_FIELD_SPECS: FieldSpec[] = [
  { key: "flexNumber",            label: "Flex-Nummer",         required: true,  isIdentity: true  },
  { key: "standardMarketNumber",  label: "Standardmarkt Nr",    required: false, isIdentity: false },
  { key: "cokeMasterNumber",      label: "Stammnr. von Coke",   required: false, isIdentity: false },
  { key: "name",                  label: "Name",                required: false, isIdentity: false },
  { key: "dbName",                label: "Name f. DB",          required: false, isIdentity: false },
  { key: "address",               label: "Adresse",             required: false, isIdentity: false },
  { key: "postalCode",            label: "Postleitzahl",        required: false, isIdentity: false },
  { key: "city",                  label: "Ort",                 required: false, isIdentity: false },
  { key: "region",                label: "Region",              required: false, isIdentity: false },
  { key: "emEh",                  label: "EM/EH",               required: false, isIdentity: false },
  { key: "employee",              label: "Mitarbeiter",         required: false, isIdentity: false },
  { key: "currentGmName",         label: "GM",                  required: false, isIdentity: false },
  { key: "universeMarket",        label: "Universums-Markt",    required: false, isIdentity: false },
  { key: "visitFrequencyPerYear", label: "Besuchsrhythmus",     required: false, isIdentity: false },
  { key: "infoFlag",              label: "Info",                required: false, isIdentity: false },
  { key: "infoNote",              label: "Info-Notiz",          required: false, isIdentity: false },
  { key: "isActive",              label: "Status aktiv",        required: false, isIdentity: false },
];

export const FIELD_SPECS: FieldSpec[] = UNIVERSUM_FIELD_SPECS;

export function getFieldSpecsForImportType(importType: ImportDatasetType): FieldSpec[] {
  if (importType === "kuehler") return KUEHLER_FIELD_SPECS;
  if (importType === "update") return UPDATE_FIELD_SPECS;
  return UNIVERSUM_FIELD_SPECS;
}

// key → column letter  (empty string = not mapped)
export type ColumnMapping = Partial<Record<MarketImportFieldKey, string>>;

export interface MappingValidation {
  /** Fields with invalid/missing required letters */
  fieldErrors: Partial<Record<MarketImportFieldKey, string>>;
  /** Duplicate column letter assignments, field key → letter */
  duplicateErrors: Partial<Record<MarketImportFieldKey, string>>;
  /** Whether the minimum viable mapping is satisfied */
  canImport: boolean;
}

export function validateMapping(mapping: ColumnMapping, fieldSpecs: FieldSpec[] = FIELD_SPECS): MappingValidation {
  const fieldErrors: Partial<Record<MarketImportFieldKey, string>> = {};
  const duplicateErrors: Partial<Record<MarketImportFieldKey, string>> = {};

  // Check each required field has a valid letter
  for (const spec of fieldSpecs) {
    const val = mapping[spec.key] ?? "";
    if (spec.required && !val) {
      fieldErrors[spec.key] = "Pflichtfeld";
    } else if (val && !isValidColLetter(val)) {
      fieldErrors[spec.key] = "Ungültige Spalte";
    }
  }

  // Check duplicates across all mapped fields
  const seen: Map<number, MarketImportFieldKey> = new Map();
  for (const spec of fieldSpecs) {
    const val = mapping[spec.key] ?? "";
    if (!val || !isValidColLetter(val)) continue;
    const idx = excelColToIndex(val);
    if (seen.has(idx)) {
      const other = seen.get(idx)!;
      duplicateErrors[spec.key] = `Selbe Spalte wie "${other}"`;
      duplicateErrors[other] = `Selbe Spalte wie "${spec.key}"`;
    } else {
      seen.set(idx, spec.key);
    }
  }

  // Identity requirement: at least one identity field mapped
  const hasIdentity = fieldSpecs.filter((s) => s.isIdentity).some(
    (s) => mapping[s.key] && isValidColLetter(mapping[s.key]!)
  );
  const requiredOk = fieldSpecs.filter((s) => s.required).every(
    (s) => mapping[s.key] && isValidColLetter(mapping[s.key]!) && !fieldErrors[s.key]
  );
  const noDuplicates = Object.keys(duplicateErrors).length === 0;
  const noFieldErrors = Object.keys(fieldErrors).length === 0;

  return {
    fieldErrors,
    duplicateErrors,
    canImport: hasIdentity && requiredOk && noDuplicates && noFieldErrors,
  };
}

// ── Row normalization ──────────────────────────────────────────

function parseImportBoolean(value: string): boolean | null {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[\u00a0\s]+/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["ja", "j", "true", "wahr", "1", "yes", "y", "x"].includes(token)) return true;
  if (["nein", "n", "false", "falsch", "0", "no"].includes(token)) return false;
  return null;
}

function normBool(v: string): boolean {
  return parseImportBoolean(v) ?? false;
}

function normNum(v: string): number {
  const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** Raw "draft" produced from one spreadsheet row before merge */
export type MarketDraft = Partial<Record<MarketImportFieldKey, string | number | boolean>>;

export function mapRowToDraft(
  row: string[],
  mapping: ColumnMapping,
  fieldSpecs: FieldSpec[] = FIELD_SPECS,
): MarketDraft {
  const draft: MarketDraft = {};
  for (const spec of fieldSpecs) {
    const col = mapping[spec.key];
    if (!col || !isValidColLetter(col)) continue;
    const idx = excelColToIndex(col);
    const raw = row[idx]?.trim() ?? "";
    if (!raw) continue;
    if (spec.key === "universeMarket" || spec.key === "infoFlag" || spec.key === "isActive") {
      const parsed = parseImportBoolean(raw);
      if (parsed == null) continue;
      (draft as Record<string, unknown>)[spec.key] = parsed;
    } else if (spec.key === "kuehlerAnzahlKsAmStandort") {
      (draft as Record<string, unknown>)[spec.key] = normNum(raw);
    } else if (spec.key === "visitFrequencyPerYear") {
      (draft as Record<string, unknown>)[spec.key] = normNum(raw);
    } else {
      (draft as Record<string, unknown>)[spec.key] = raw;
    }
  }
  return draft;
}

// ── Import summary type ────────────────────────────────────────

export interface ImportSummary {
  fileName: string;
  sheetName: string;
  importType: ImportDatasetType;
  totalParsedRows: number;
  created: number;
  updated: number;
  skipped: number;
  unchanged?: number;
  kuehlerUnitsCreated?: number;
  kuehlerUnitsUpdated?: number;
  kuehlerUnitsSkipped?: number;
  matchedBy: Record<"standardMarketNumber" | "cokeMasterNumber" | "flexNumber" | "namePLZ", number>;
  skippedReasons: {
    row: number;
    reason: string;
    sample: string;
    draft?: MarketDraft;
    missingFields?: string[];       // display labels for amber pills
    missingFieldKeys?: MarketImportFieldKey[]; // machine keys for editable inputs
    fetchedFields?: { label: string; value: string }[];
  }[];
}

/** Build rich skip-reason metadata for a draft row */
function buildSkipMeta(
  draft: MarketDraft,
  mapping: ColumnMapping,
  fieldSpecs: FieldSpec[] = FIELD_SPECS,
): { missingFields: string[]; missingFieldKeys: MarketImportFieldKey[]; fetchedFields: { label: string; value: string }[] } {
  const missingFields: string[] = [];
  const missingFieldKeys: MarketImportFieldKey[] = [];
  const fetchedFields: { label: string; value: string }[] = [];

  for (const spec of fieldSpecs) {
    const col = mapping[spec.key] ?? "";
    const val = draft[spec.key];
    if (!col || !isValidColLetter(col)) {
      if (spec.required || spec.isIdentity) {
        missingFields.push(`${spec.label} (nicht gemappt)`);
        missingFieldKeys.push(spec.key);
      }
    } else if (val == null || String(val).trim() === "") {
      if (spec.required || spec.isIdentity) {
        missingFields.push(`${spec.label} (leer)`);
        missingFieldKeys.push(spec.key);
      }
    } else {
      fetchedFields.push({ label: spec.label, value: String(val) });
    }
  }

  return { missingFields, missingFieldKeys, fetchedFields };
}

/** Create a MarketRecord from a completed draft */
export function draftToMarketRecord(
  draft: MarketDraft,
  fileName: string,
  importType: ImportDatasetType = "universum",
): MarketRecord {
  const marketType = importType === "kuehler" ? "kuehler" : "universum";
  const kuehlerStammnr = String(draft.kuehlerStammnr ?? "");
  return {
    id: `m-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    name:                 String(draft.name ?? ""),
    address:              String(draft.address ?? ""),
    postalCode:           String(draft.postalCode ?? ""),
    city:                 String(draft.city ?? ""),
    region:               String(draft.region ?? ""),
    emEh:                 importType === "kuehler" ? "" : String(draft.emEh ?? ""),
    dbName:               importType === "kuehler" ? "" : String(draft.dbName ?? ""),
    flexNumber:           importType === "kuehler" ? "" : String(draft.flexNumber ?? ""),
    cokeMasterNumber:     importType === "kuehler" ? kuehlerStammnr : String(draft.cokeMasterNumber ?? ""),
    standardMarketNumber: importType === "kuehler" ? "" : String(draft.standardMarketNumber ?? ""),
    employee:             String(draft.employee ?? ""),
    universeMarket:       marketType !== "kuehler",
    marketType,
    kuehlerStammnr:       importType === "kuehler" ? kuehlerStammnr : "",
    isActive:             true,
    visitFrequencyPerYear:Number(draft.visitFrequencyPerYear ?? 0),
    infoFlag:             Boolean(draft.infoFlag ?? false),
    infoNote:             "",
    currentGmName:        "",
    ipp:                  null,
    importSourceFileName: fileName,
    importedAt:           new Date().toISOString(),
  };
}

function uid(): string {
  return `m-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function normStr(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function mergeImportedMarkets(
  existing: MarketRecord[],
  rows: string[][],
  mapping: ColumnMapping,
  fileName: string,
  sheetName: string,
  importType: ImportDatasetType = "universum",
): { nextMarkets: MarketRecord[]; summary: ImportSummary } {
  // Deprecated helper path: backend import is authoritative for production behavior.
  // Keep this aligned enough for fallback/local usage.

  // Build lookup maps for fast matching
  const byStandard = new Map<string, MarketRecord>();
  const byCoke     = new Map<string, MarketRecord>();
  const byFlex     = new Map<string, MarketRecord>();
  const byNamePlz  = new Map<string, MarketRecord>();

  for (const m of existing) {
    if (m.standardMarketNumber) byStandard.set(normStr(m.standardMarketNumber), m);
    if (m.cokeMasterNumber) {
      const cokeKey =
        importType === "kuehler"
          ? normStr(m.cokeMasterNumber.replace(/\s+/g, ""))
          : normStr(m.cokeMasterNumber);
      if (cokeKey) byCoke.set(cokeKey, m);
    }
    if (m.flexNumber)           byFlex.set(normStr(m.flexNumber), m);
    const namePlzKey = normStr(m.name) + "|" + normStr(m.postalCode);
    byNamePlz.set(namePlzKey, m);
  }

  const updatedIds = new Set<string>();
  const createdIds = new Set<string>();
  const nextMap = new Map<string, MarketRecord>(existing.map((m) => [m.id, { ...m }]));

  const summary: ImportSummary = {
    fileName, sheetName,
    importType,
    totalParsedRows: 0,
    created: 0, updated: 0, skipped: 0,
    matchedBy: { standardMarketNumber: 0, cokeMasterNumber: 0, flexNumber: 0, namePLZ: 0 },
    skippedReasons: [],
  };

  const importedAt = new Date().toISOString();
  const dataRows = rows.slice(1); // skip header
  summary.totalParsedRows = dataRows.length;
  const fieldSpecs = getFieldSpecsForImportType(importType);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // 2-based (row 1 = header)

    // Skip blank rows
    if (row.every((c) => !c || !c.trim())) {
      summary.skipped++;
      continue;
    }

    const draft = mapRowToDraft(row, mapping, fieldSpecs);
    const sampleText = String(draft.name ?? draft.city ?? row.find((c) => c?.trim()) ?? "");
    const normalizedKuehlerStammnr = normStr(String(draft.kuehlerStammnr ?? "").replace(/\s+/g, ""));

    // Check minimum identity
    const hasDraftIdentity =
      importType === "kuehler"
        ? normalizedKuehlerStammnr
        : draft.standardMarketNumber || draft.cokeMasterNumber || draft.flexNumber;
    const hasDraftVisibles =
      draft.name && (draft.postalCode || draft.city) && draft.region;

    if (!hasDraftIdentity && !hasDraftVisibles) {
      summary.skipped++;
      if (summary.skippedReasons.length < 50) {
        const { missingFields, missingFieldKeys, fetchedFields } = buildSkipMeta(draft, mapping, fieldSpecs);
        summary.skippedReasons.push({ row: rowNum, reason: "Keine Identität und fehlende Pflichtfelder", sample: sampleText, draft, missingFields, missingFieldKeys, fetchedFields });
      }
      continue;
    }

    // Find existing match
    let matched: MarketRecord | undefined;
    let matchKey: keyof typeof summary.matchedBy | null = null;

    const stdKey = normStr(String(draft.standardMarketNumber ?? ""));
    const cokeKey =
      importType === "kuehler"
        ? normalizedKuehlerStammnr
        : normStr(String(draft.cokeMasterNumber ?? ""));
    const flexKey = normStr(String(draft.flexNumber ?? ""));
    const namePlzKey = normStr(String(draft.name ?? "")) + "|" + normStr(String(draft.postalCode ?? ""));

    if (importType === "kuehler") {
      if (cokeKey && byCoke.has(cokeKey)) { matched = byCoke.get(cokeKey)!; matchKey = "cokeMasterNumber"; }
    } else if (stdKey  && byStandard.has(stdKey))  { matched = byStandard.get(stdKey)!;  matchKey = "standardMarketNumber"; }
    else if (cokeKey && byCoke.has(cokeKey)) { matched = byCoke.get(cokeKey)!;     matchKey = "cokeMasterNumber"; }
    else if (flexKey && byFlex.has(flexKey)) { matched = byFlex.get(flexKey)!;     matchKey = "flexNumber"; }
    else if (namePlzKey && byNamePlz.has(namePlzKey)) { matched = byNamePlz.get(namePlzKey)!; matchKey = "namePLZ"; }

    if (matched) {
      // Merge: spreadsheet fields win, preserve app-only fields
      const updated: MarketRecord = {
        ...nextMap.get(matched.id)!,
        ...(draft as Partial<MarketRecord>),
        // Preserve app-only fields
        id: matched.id,
        currentGmName: matched.currentGmName,
        infoNote: matched.infoNote,
        ipp: matched.ipp,
        importSourceFileName: fileName,
        importedAt,
      };
      nextMap.set(updated.id, updated);
      if (!updatedIds.has(updated.id)) {
        updatedIds.add(updated.id);
        summary.updated++;
        if (matchKey) summary.matchedBy[matchKey]++;
      }
    } else {
      // New market
      if (!hasDraftVisibles) {
        summary.skipped++;
        if (summary.skippedReasons.length < 50) {
          const { missingFields, missingFieldKeys, fetchedFields } = buildSkipMeta(draft, mapping, fieldSpecs);
          summary.skippedReasons.push({ row: rowNum, reason: "Neuer Markt ohne Pflichtfelder (Name, PLZ, Region)", sample: sampleText, draft, missingFields, missingFieldKeys, fetchedFields });
        }
        continue;
      }
      const newId = uid();
      const newMarket: MarketRecord = {
        ...draftToMarketRecord(draft, fileName, importType),
        id: newId,
        importedAt,
      };
      nextMap.set(newId, newMarket);
      createdIds.add(newId);
      summary.created++;
    }
  }

  return { nextMarkets: Array.from(nextMap.values()), summary };
}
