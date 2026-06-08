"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  ListPlus,
  Refrigerator,
  ShoppingBag,
  Upload,
  Users,
  X,
} from "lucide-react";
import { buildPreviewGrid, excelColToIndex, getColHeader, getColSample, isValidColLetter, readWorkbook } from "@/utils/marketImport";
import { assignCampaignMarketAssignments, fetchCampaigns, fetchGmUsers, fetchMarkets, getCampaignOverlapConflicts } from "@/lib/api/backend";
import type { Campaign, CampaignMarketAssignmentInput, CampaignMarketOverlapConflict, CampaignSection } from "@/types/campaign";
import type { GMRecord } from "@/types/gebietsmanager";
import type { MarketRecord } from "@/types/markets";

const R = "#DC2626";

type ExtendableSection = Exclude<CampaignSection, "flex">;
type CampaignMatchMode = "flex" | "kuehler_stammnr";
type ExtendMode = "dedupe" | "populate";
type ExtendStep = "import" | "summary";

type ExtendMarketItem = {
  id: string;
  rowNumber: number;
  name: string;
  gm: string;
};

type ExtendMarketCandidate = ExtendMarketItem & {
  region?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  standardMarketNumber?: string;
  cokeMasterNumber?: string;
  kuehlerStammnr?: string;
  flexNumber?: string;
  marketType?: MarketRecord["marketType"];
  isActive?: boolean;
};

type MarketMatchStatus = "matched" | "unmatched" | "ambiguous";
type MarketMatchResult = {
  row: ExtendMarketItem;
  status: MarketMatchStatus;
  marketId: string | null;
  candidateIds: string[];
  reason: string;
};

type GmMatchIssueKind = "missing" | "unmatched" | "ambiguous";
type GmMatchIssue = {
  rowId: string;
  marketId: string;
  gmName: string;
  gmOverrideKey: string;
  gmOverrideLabel: string;
  kind: GmMatchIssueKind;
  candidateUserIds: string[];
};

type ImportCounts = {
  parsedRows: number;
  importedRows: number;
  blankRows: number;
  missingIdentityRows: number;
};

type ImportMeta = {
  fileName: string;
  sheetName: string;
};

type ResolvedVisitRow = {
  rowId: string;
  rowNumber: number;
  marketId: string;
  marketName: string;
  region: string;
  gmUserId: string;
  gmDisplayName: string;
  gmNameRaw: string;
};

type AddedVisitBreakdown = {
  key: string;
  marketId: string;
  marketName: string;
  region: string;
  gmUserId: string;
  gmDisplayName: string;
  gmNameRaw: string;
  importedCount: number;
  existingCount: number;
  dedupedCount: number;
  addedCount: number;
};

type WhiteSelectOption = {
  value: string;
  label: string;
};

type CampaignTypeMeta = {
  label: string;
  color: string;
  dark: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
};

const TYPE_META: Record<ExtendableSection, CampaignTypeMeta> = {
  standard: {
    label: "Standardbesuch",
    color: R,
    dark: "#b91c1c",
    bg: "rgba(220,38,38,0.06)",
    border: "rgba(220,38,38,0.18)",
    Icon: ClipboardList,
  },
  billa: {
    label: "Billa",
    color: "#0891B2",
    dark: "#0e7490",
    bg: "rgba(8,145,178,0.06)",
    border: "rgba(8,145,178,0.20)",
    Icon: ShoppingBag,
  },
  kuehler: {
    label: "Kühlerinventur",
    color: "#D97706",
    dark: "#b45309",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.22)",
    Icon: Refrigerator,
  },
  mhd: {
    label: "MHD",
    color: "#7C3AED",
    dark: "#6d28d9",
    bg: "rgba(124,58,237,0.06)",
    border: "rgba(124,58,237,0.20)",
    Icon: FlaskConical,
  },
};

const STEPS = [
  { id: 1, label: "Import", sub: "Datei & Mapping" },
  { id: 2, label: "Auswertung", sub: "Dedupe & Split" },
  { id: 3, label: "Übernehmen", sub: "Visits hinzufügen" },
];

const EMPTY_IMPORT_COUNTS: ImportCounts = {
  parsedRows: 0,
  importedRows: 0,
  blankRows: 0,
  missingIdentityRows: 0,
};

function isExtendableSection(section: CampaignSection): section is ExtendableSection {
  return section === "standard" || section === "billa" || section === "kuehler" || section === "mhd";
}

function normalizeMatcherValue(value: string | undefined | null) {
  return String(value ?? "").trim().toLowerCase();
}

function buildFlexMatcherKeys(value: string | undefined | null): string[] {
  const raw = String(value ?? "").trim().toLowerCase().replace(/^'+/, "");
  if (!raw) return [];

  const keys = new Set<string>([raw]);
  const compact = raw.replace(/[^a-z0-9]/g, "");
  if (compact) keys.add(compact);

  const decimalNormalized = raw.replace(",", ".");
  if (/^\d+\.0+$/.test(decimalNormalized)) {
    keys.add(decimalNormalized.replace(/\.0+$/, ""));
  }

  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly) {
    keys.add(digitsOnly);
    keys.add(digitsOnly.replace(/^0+/, "") || "0");
  }

  return Array.from(keys).filter(Boolean);
}

function normalizeStammnrForCampaignMatch(value: string | undefined | null): string {
  const raw = String(value ?? "").trim().toLowerCase().replace(/^'+/, "");
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
}

function getMarketStammnrCandidates(market: ExtendMarketCandidate): string[] {
  const values = [
    normalizeStammnrForCampaignMatch(market.kuehlerStammnr),
    normalizeStammnrForCampaignMatch(market.cokeMasterNumber),
  ].filter((value) => value.length > 0);
  return Array.from(new Set(values));
}

function toCompactFlexKey(value: string | undefined | null): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePersonName(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeEmailValue(value: string | undefined | null) {
  return String(value ?? "").trim().toLowerCase();
}

function extractEmailCandidates(value: string | undefined | null): string[] {
  const text = String(value ?? "");
  const matches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((entry) => normalizeEmailValue(entry)).filter(Boolean)));
}

function stripEmailsFromText(value: string | undefined | null) {
  return String(value ?? "").replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, " ").trim();
}

function buildGmOverrideKey(value: string | undefined | null) {
  const emails = extractEmailCandidates(value).sort();
  if (emails.length > 0) return `email:${emails.join("|")}`;
  const normalizedName = normalizePersonName(stripEmailsFromText(value));
  if (normalizedName) return `name:${normalizedName}`;
  return "missing";
}

function buildGmOverrideLabel(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "Leerer Mitarbeiter-Wert";
}

function isTemporaryGmName(value: string | undefined | null) {
  const normalized = normalizePersonName(value);
  if (!normalized) return false;
  return /\b(?:prez[ia]?|perz[ia]?|temp(?:orary)?|test)\b/.test(normalized);
}

function resolveMarketGmLabel(currentGmName: string | undefined | null, employee: string | undefined | null) {
  const current = String(currentGmName ?? "").trim();
  if (current.length > 0 && !isTemporaryGmName(current)) return current;
  const fallback = String(employee ?? "").trim();
  if (fallback.length > 0 && !isTemporaryGmName(fallback)) return fallback;
  return "Unbekannt";
}

function normalizeRegionLabel(region: string | undefined | null) {
  const value = String(region ?? "").trim();
  return value || "Unbekannt";
}

function assignmentKey(marketId: string, gmUserId: string | null | undefined) {
  return `${marketId}:${gmUserId ?? "__unassigned__"}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("de-AT");
}

function formatPeriod(campaign: Campaign) {
  if (campaign.scheduleType === "always") return "Immer aktiv";
  if (!campaign.startDate || !campaign.endDate) return "Geplant";
  return `${campaign.startDate} - ${campaign.endDate}`;
}

function countCampaignVisits(campaign: Campaign | null) {
  if (!campaign) return 0;
  return (campaign.assignments ?? []).reduce((sum, assignment) => {
    const count = Number(assignment.visitTargetCount ?? 1);
    return sum + (Number.isFinite(count) && count > 0 ? Math.trunc(count) : 1);
  }, 0);
}

function matcherReasonLabel(reason: string) {
  if (reason === "uuid") return "UUID";
  if (reason === "flex_number") return "Flexnummer";
  if (reason === "flex_number_partial") return "Flexnummer (Teiltreffer)";
  if (reason === "kuehler_stammnr") return "Stammnr";
  return "Kein Match";
}

function buildMarketMatchReport(
  rows: ExtendMarketItem[],
  allMarkets: ExtendMarketCandidate[],
  matchMode: CampaignMatchMode,
): { results: MarketMatchResult[]; matchedIds: string[]; unmatched: number; ambiguous: number } {
  if (matchMode === "kuehler_stammnr") {
    const byCanonicalStammnr = new Map<string, ExtendMarketCandidate[]>();
    for (const market of allMarkets) {
      for (const key of getMarketStammnrCandidates(market)) {
        const bucket = byCanonicalStammnr.get(key) ?? [];
        bucket.push(market);
        byCanonicalStammnr.set(key, bucket);
      }
    }

    const results: MarketMatchResult[] = rows.map((row) => {
      const canonical = normalizeStammnrForCampaignMatch(row.name);
      if (!canonical) return { row, status: "unmatched", marketId: null, candidateIds: [], reason: "none" };
      const candidates = byCanonicalStammnr.get(canonical) ?? [];
      if (candidates.length === 1) {
        return {
          row,
          status: "matched",
          marketId: candidates[0]?.id ?? null,
          candidateIds: [candidates[0]?.id ?? ""],
          reason: "kuehler_stammnr",
        };
      }
      if (candidates.length > 1) {
        return {
          row,
          status: "ambiguous",
          marketId: null,
          candidateIds: candidates.map((market) => market.id),
          reason: "kuehler_stammnr",
        };
      }
      return { row, status: "unmatched", marketId: null, candidateIds: [], reason: "none" };
    });

    const matchedIds = Array.from(
      new Set(
        results
          .filter((result) => result.status === "matched" && result.marketId)
          .map((result) => result.marketId as string),
      ),
    );
    return {
      results,
      matchedIds,
      unmatched: results.filter((result) => result.status === "unmatched").length,
      ambiguous: results.filter((result) => result.status === "ambiguous").length,
    };
  }

  const byId = new Map(allMarkets.map((market) => [market.id, market]));
  const identityIndex = new Map<string, ExtendMarketCandidate[]>();
  const flexCompactKeyByMarketId = new Map<string, string>();
  for (const market of allMarkets) {
    const keys = buildFlexMatcherKeys(market.flexNumber);
    for (const key of keys) {
      const bucket = identityIndex.get(key) ?? [];
      bucket.push(market);
      identityIndex.set(key, bucket);
    }
    flexCompactKeyByMarketId.set(market.id, toCompactFlexKey(market.flexNumber));
  }

  const results: MarketMatchResult[] = rows.map((row) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) && byId.has(row.id)) {
      return { row, status: "matched", marketId: row.id, candidateIds: [row.id], reason: "uuid" };
    }

    const candidateMap = new Map<string, ExtendMarketCandidate>();
    for (const key of buildFlexMatcherKeys(row.name)) {
      const markets = identityIndex.get(key) ?? [];
      for (const market of markets) candidateMap.set(market.id, market);
    }
    const identityCandidates = Array.from(candidateMap.values());
    if (identityCandidates.length === 1) {
      return {
        row,
        status: "matched",
        marketId: identityCandidates[0]?.id ?? null,
        candidateIds: [identityCandidates[0]?.id ?? ""],
        reason: "flex_number",
      };
    }
    if (identityCandidates.length > 1) {
      return {
        row,
        status: "ambiguous",
        marketId: null,
        candidateIds: identityCandidates.map((market) => market.id),
        reason: "flex_number",
      };
    }

    const rowCompact = toCompactFlexKey(row.name);
    if (rowCompact) {
      const partialCandidates = allMarkets.filter((market) => {
        const candidateCompact = flexCompactKeyByMarketId.get(market.id) ?? "";
        if (!candidateCompact) return false;
        return candidateCompact.includes(rowCompact) || rowCompact.includes(candidateCompact);
      });
      if (partialCandidates.length === 1) {
        return {
          row,
          status: "matched",
          marketId: partialCandidates[0]?.id ?? null,
          candidateIds: [partialCandidates[0]?.id ?? ""],
          reason: "flex_number_partial",
        };
      }
      if (partialCandidates.length > 1) {
        return {
          row,
          status: "ambiguous",
          marketId: null,
          candidateIds: partialCandidates.map((market) => market.id),
          reason: "flex_number_partial",
        };
      }
    }

    return { row, status: "unmatched", marketId: null, candidateIds: [], reason: "none" };
  });

  const matchedIds = Array.from(
    new Set(
      results
        .filter((result) => result.status === "matched" && result.marketId)
        .map((result) => result.marketId as string),
    ),
  );
  return {
    results,
    matchedIds,
    unmatched: results.filter((result) => result.status === "unmatched").length,
    ambiguous: results.filter((result) => result.status === "ambiguous").length,
  };
}

function getExtendFields(matchMode: CampaignMatchMode) {
  return [
    { key: "name", label: matchMode === "kuehler_stammnr" ? "Stammnr" : "Flexnummer", required: true },
    { key: "gm", label: "Mitarbeiter", required: false },
  ] as const;
}

type ExtendColMapping = Partial<Record<"name" | "gm", string>>;

function WhiteSelect({
  value,
  onChange,
  options,
  placeholder = "GM manuell auswählen...",
}: {
  value: string;
  onChange: (next: string) => void;
  options: WhiteSelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const triggerLabel = selected?.label ?? placeholder;

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleWindowChange = () => updateMenuPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 7,
          padding: "6px 8px",
          fontSize: 11,
          background: "#fff",
          color: selected ? "#1a1a1a" : "rgba(0,0,0,0.45)",
          fontWeight: 500,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.03),0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <span style={{ textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{triggerLabel}</span>
        <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.5)" />
      </button>
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: Math.max(menuPos.width, 230),
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 8,
            boxShadow: "0 12px 28px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)",
            zIndex: 2200,
            maxHeight: 260,
            overflowY: "auto",
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: value ? "#fff" : "rgba(0,0,0,0.04)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              color: "rgba(0,0,0,0.6)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: value === option.value ? "rgba(0,0,0,0.05)" : "#fff",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 11,
                color: "#1a1a1a",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(event) => {
                if (value === option.value) return;
                event.currentTarget.style.background = "rgba(0,0,0,0.035)";
              }}
              onMouseLeave={(event) => {
                if (value === option.value) return;
                event.currentTarget.style.background = "#fff";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function ModeSelector({
  mode,
  setMode,
  accentColor,
}: {
  mode: ExtendMode;
  setMode: (mode: ExtendMode) => void;
  accentColor: string;
}) {
  const options: Array<{ id: ExtendMode; label: string; hint: string }> = [
    { id: "dedupe", label: "Dedupe", hint: "Bestehende Visits abziehen" },
    { id: "populate", label: "Populate", hint: "Alle Zeilen als Extra-Visits" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 9,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "linear-gradient(to bottom,#fff,#f6f6f6)",
        boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.95),0 1px 4px rgba(0,0,0,0.05)",
        flexShrink: 0,
      }}
    >
      {options.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setMode(option.id)}
            style={{
              border: "none",
              borderRadius: 7,
              padding: "6px 13px",
              cursor: "pointer",
              textAlign: "center",
              background: active ? "#fff" : "transparent",
              color: active ? "#1a1a1a" : "rgba(0,0,0,0.42)",
              boxShadow: active
                ? `inset 0 1px 0.6px rgba(255,255,255,0.95),0 0 0 1px ${accentColor}33,0 1px 3px rgba(0,0,0,0.07)`
                : "none",
              fontFamily: "inherit",
              transition: "all 0.16s ease",
              minWidth: 76,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, fontWeight: 700 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: active ? accentColor : "rgba(0,0,0,0.16)",
                }}
              />
              {option.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ImportWizard({
  section,
  accentColor,
  accentBg,
  accentDark,
  mode,
  setMode,
  onLoad,
}: {
  section: ExtendableSection;
  accentColor: string;
  accentBg: string;
  accentDark: string;
  mode: ExtendMode;
  setMode: (mode: ExtendMode) => void;
  onLoad: (rows: ExtendMarketItem[], counts: ImportCounts, meta: ImportMeta) => void;
}) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wb, setWb] = useState<Awaited<ReturnType<typeof readWorkbook>> | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ExtendColMapping>({});
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const matchMode: CampaignMatchMode = section === "kuehler" ? "kuehler_stammnr" : "flex";
  const fields = useMemo(() => getExtendFields(matchMode), [matchMode]);
  const preview = useMemo(() => (wb ? buildPreviewGrid(wb.rows) : null), [wb]);

  const handleFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setParseError("Bitte eine Excel-Datei (.xlsx oder .xls) auswählen.");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const result = await readWorkbook(file);
      setWb(result);
      setFileName(file.name);
      setMapping({});
      setStep("review");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
    } finally {
      setParsing(false);
    }
  }, []);

  const colError = useCallback((key: string, val: string): string | null => {
    if (!val) return null;
    if (!isValidColLetter(val)) return "Ungültige Spalte";
    const others = fields.filter((field) => field.key !== key);
    for (const other of others) {
      const otherValue = mapping[other.key as keyof ExtendColMapping] ?? "";
      if (otherValue && isValidColLetter(otherValue) && excelColToIndex(otherValue) === excelColToIndex(val)) {
        return `Selbe Spalte wie "${other.label}"`;
      }
    }
    return null;
  }, [fields, mapping]);

  const canImport = useMemo(() => {
    const requiredOk = fields.filter((field) => field.required).every((field) => {
      const val = mapping[field.key as keyof ExtendColMapping] ?? "";
      return val && isValidColLetter(val) && !colError(field.key, val);
    });
    const noOptionalErrors = !fields.some((field) => {
      const val = mapping[field.key as keyof ExtendColMapping] ?? "";
      return val && colError(field.key, val);
    });
    return requiredOk && noOptionalErrors;
  }, [colError, fields, mapping]);

  const handleImport = useCallback(() => {
    if (!wb || isImporting) return;
    setIsImporting(true);
    try {
      const dataRows = wb.rows.slice(1);
      let blankRows = 0;
      let missingIdentityRows = 0;
      const rows: ExtendMarketItem[] = [];
      dataRows.forEach((row, idx) => {
        if (row.every((cell) => !cell?.trim())) {
          blankRows += 1;
          return;
        }
        const get = (key: keyof ExtendColMapping) => {
          const col = mapping[key] ?? "";
          if (!col || !isValidColLetter(col)) return "";
          return row[excelColToIndex(col)]?.trim() ?? "";
        };
        const name = get("name");
        const gm = get("gm");
        if (!name) {
          missingIdentityRows += 1;
          return;
        }
        rows.push({
          id: `extend-${idx}-${Date.now()}`,
          rowNumber: idx + 2,
          name,
          gm: isTemporaryGmName(gm) ? "" : gm,
        });
      });
      onLoad(rows, {
        parsedRows: dataRows.length,
        importedRows: rows.length,
        blankRows,
        missingIdentityRows,
      }, {
        fileName,
        sheetName: wb.sheetName,
      });
    } finally {
      setIsImporting(false);
    }
  }, [fileName, isImporting, mapping, onLoad, wb]);

  const scrollbarStyle = `
    .extend-imp-scroll::-webkit-scrollbar{width:4px;height:4px}
    .extend-imp-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}
    .extend-imp-scroll::-webkit-scrollbar-track{background:transparent}
    .extend-imp-scroll{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.12) transparent}
    .extend-imp-input:focus{outline:none;border-bottom-color:${accentColor} !important}
    @keyframes extendSpin{to{transform:rotate(360deg)}}
  `;

  if (step === "upload") {
    return (
      <>
        <style>{scrollbarStyle}</style>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? accentColor : "rgba(0,0,0,0.10)"}`,
            borderRadius: 14,
            padding: "46px 24px",
            backgroundColor: dragging ? accentBg : "rgba(0,0,0,0.012)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: "pointer",
            transition: "all 0.18s ease",
            textAlign: "center",
            minHeight: 280,
            position: "relative",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            style={{ position: "absolute", top: 14, right: 14 }}
          >
            <ModeSelector mode={mode} setMode={setMode} accentColor={accentColor} />
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(event) => handleFile(event.target.files)} />
          <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: dragging ? accentBg : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {parsing ? (
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${accentColor}`, borderTopColor: "transparent", animation: "extendSpin 0.7s linear infinite" }} />
            ) : (
              <FileSpreadsheet size={23} strokeWidth={1.5} color={dragging ? accentColor : "rgba(0,0,0,0.28)"} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: dragging ? accentColor : "#1a1a1a", letterSpacing: "-0.012em", marginBottom: 4 }}>
              {parsing ? "Datei wird gelesen..." : "Excel-Datei hier ablegen"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.32)", fontWeight: 400 }}>
              Erste Tabelle, erste Zeile als Header, Daten ab Zeile 2
            </div>
          </div>
          <button
            type="button"
            style={{
              marginTop: 4,
              padding: "8px 20px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              cursor: "pointer",
              border: "none",
              color: "rgba(0,0,0,0.52)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),inset 0 -1px 0 rgba(0,0,0,0.04),0 0 0 1px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.07)",
              fontFamily: "inherit",
            }}
          >
            <Upload size={10} strokeWidth={2} style={{ marginRight: 6, display: "inline", verticalAlign: "middle" }} />
            Datei auswählen
          </button>
        </div>
        {parseError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", marginTop: 12 }}>
            <AlertTriangle size={12} strokeWidth={2} color={R} />
            <span style={{ fontSize: 11, color: R, fontWeight: 600 }}>Fehler: {parseError}</span>
          </div>
        )}
      </>
    );
  }

  if (!wb || !preview) return null;

  return (
    <>
      <style>{scrollbarStyle}</style>
      <div style={{ display: "flex", flexDirection: "column", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden", width: "100%", minWidth: 0 }}>
        <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <FileSpreadsheet size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
          <ModeSelector mode={mode} setMode={setMode} accentColor={accentColor} />
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 600 }}>{wb.sheetName} · {Math.max(0, wb.rows.length - 1)} Zeilen</span>
          <button type="button" onClick={() => { setStep("upload"); setWb(null); setMapping({}); }} style={{ display: "flex", border: "none", background: "rgba(0,0,0,0.05)", borderRadius: 5, cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.4)" }}>
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>

        <div className="extend-imp-scroll" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
            <div className="extend-imp-scroll" style={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "hidden" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed", minWidth: "max-content" }}>
                <colgroup>
                  <col style={{ width: 32 }} />
                  {preview.colLetters.map((_letter, index) => <col key={index} style={{ width: 104 }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", width: 32 }} />
                    {preview.colLetters.map((letter) => (
                      <th key={letter} style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8f8f8", borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "4px 7px", textAlign: "center", fontWeight: 800, color: "rgba(0,0,0,0.4)", fontSize: 8, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{letter}</th>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ position: "sticky", left: 0, zIndex: 2, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "3px 5px", textAlign: "right", fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.25)" }}>1</td>
                    {preview.headerRow.map((header, index) => (
                      <td key={index} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "3px 7px", fontWeight: 700, color: "#1a1a1a", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 104 }}>{header}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.slice(0, 24).map((row, rowIndex) => (
                    <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)" }}>
                      <td style={{ position: "sticky", left: 0, background: rowIndex % 2 === 0 ? "#f8f8f8" : "#f3f3f3", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "2px 5px", textAlign: "right", fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.22)" }}>{preview.rowNumbers[rowIndex]}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} style={{ borderRight: "1px solid rgba(0,0,0,0.03)", padding: "2px 7px", color: cell ? "#374151" : "rgba(0,0,0,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 104, fontSize: 10 }}>{cell || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)" }}>Spaltenzuweisung</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))`, gap: "8px 14px" }}>
              {fields.map((field) => {
                const val = mapping[field.key as keyof ExtendColMapping] ?? "";
                const err = colError(field.key, val);
                const header = val && !err ? getColHeader(wb.rows, val) : null;
                const sample = val && !err ? getColSample(wb.rows, val) : null;
                return (
                  <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: err ? R : "rgba(0,0,0,0.5)", flex: 1 }}>{field.label}</span>
                      {field.required && <span style={{ fontSize: 7, fontWeight: 800, color: R, background: "rgba(220,38,38,0.07)", padding: "1px 4px", borderRadius: 3 }}>P</span>}
                    </div>
                    <input
                      type="text"
                      value={val}
                      maxLength={3}
                      placeholder="—"
                      className="extend-imp-input"
                      onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() }))}
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        fontFamily: "inherit",
                        textTransform: "uppercase",
                        padding: "4px 0",
                        border: "none",
                        borderBottom: `1.5px solid ${err ? "rgba(220,38,38,0.4)" : val ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.1)"}`,
                        outline: "none",
                        background: "transparent",
                        color: err ? R : "#1a1a1a",
                        transition: "border-color 0.15s",
                        width: "100%",
                      }}
                    />
                    {!err && val && (header !== null || sample !== null) && (
                      <div style={{ fontSize: 8, color: "rgba(0,0,0,0.38)", lineHeight: 1.4 }}>
                        {header && <span style={{ fontWeight: 700, color: "rgba(0,0,0,0.5)" }}>{header.substring(0, 18)}</span>}
                        {sample && <span style={{ marginLeft: header ? 3 : 0 }}>{sample.substring(0, 18)}</span>}
                      </div>
                    )}
                    {err && <div style={{ fontSize: 8, color: R, fontWeight: 600 }}>{err}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>
              {section === "kuehler" ? "Stammnr ist Pflicht. Mitarbeiter ist optional, muss aber für gültige Visits einem GM zuordenbar sein." : "Flexnummer ist Pflicht. Mitarbeiter ist optional, muss aber für gültige Visits einem GM zuordenbar sein."}
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "flex-end", gap: 8, background: "rgba(0,0,0,0.01)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { setStep("upload"); setWb(null); setMapping({}); }}
            style={{
              padding: "7px 13px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              color: "rgba(0,0,0,0.45)",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)",
              fontFamily: "inherit",
            }}
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport || isImporting}
            style={{
              padding: "7px 16px",
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 7,
              border: "none",
              cursor: canImport && !isImporting ? "pointer" : "not-allowed",
              color: "#fff",
              background: canImport && !isImporting ? `linear-gradient(to bottom,${accentColor},${accentDark})` : "rgba(0,0,0,0.15)",
              boxShadow: canImport && !isImporting ? `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px ${accentDark},0 1px 4px ${accentColor}30` : "none",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
          >
            <Upload size={10} strokeWidth={2} />
            {isImporting ? "Prüfe..." : "Weiter zur Auswertung"}
          </button>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "green" | "red" | "amber" | "blue";
}) {
  const tones = {
    neutral: { bg: "rgba(0,0,0,0.02)", border: "rgba(0,0,0,0.06)", color: "#111827" },
    green: { bg: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.16)", color: "#16a34a" },
    red: { bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.16)", color: R },
    amber: { bg: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.17)", color: "#d97706" },
    blue: { bg: "rgba(37,99,235,0.06)", border: "rgba(37,99,235,0.16)", color: "#2563eb" },
  }[tone];
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 9,
        background: tones.bg,
        border: `1px solid ${tones.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.075em", color: "rgba(0,0,0,0.34)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tones.color, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ marginTop: 5, fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.36)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}

function VisitDeltaSummary({
  before,
  added,
  after,
  deduped,
  mode,
}: {
  before: number;
  added: number;
  after: number;
  deduped: number;
  mode: ExtendMode;
}) {
  const columns = [
    { label: "Vorher", value: formatNumber(before), sub: "Ziel-Visits", color: "#1a1a1a" },
    { label: "Neu", value: `+${formatNumber(added)}`, sub: mode === "dedupe" ? `${formatNumber(deduped)} dedupliziert` : "Duplikate zählen", color: added > 0 ? "#16a34a" : "rgba(0,0,0,0.34)" },
    { label: "Nachher", value: formatNumber(after), sub: "Ziel-Visits", color: "#1a1a1a" },
  ];

  return (
    <div
      style={{
        minWidth: 285,
        borderRadius: 0,
        border: "none",
        background: "transparent",
        boxShadow: "none",
        overflow: "visible",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
        {columns.map((column, index) => (
          <div
            key={column.label}
            style={{
              padding: "2px 14px",
              borderLeft: index > 0 ? "1px solid rgba(0,0,0,0.055)" : "none",
              position: "relative",
            }}
          >
            {index === 1 && (
              <div style={{ display: "none" }} />
            )}
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.075em", color: "rgba(0,0,0,0.32)", marginBottom: 5 }}>{column.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.028em", lineHeight: 1, color: column.color, fontVariantNumeric: "tabular-nums" }}>{column.value}</div>
            <div style={{ marginTop: 5, fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.34)", whiteSpace: "nowrap" }}>{column.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignSummaryHeader({
  campaign,
  meta,
  before,
  added,
  after,
  deduped,
  mode,
}: {
  campaign: Campaign;
  meta: CampaignTypeMeta;
  before: number;
  added: number;
  after: number;
  deduped: number;
  mode: ExtendMode;
}) {
  const Icon = meta.Icon;
  return (
    <div
      style={{
        background: "linear-gradient(to bottom,#fff,#fdfdfd)",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.075)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.045)",
        padding: "16px 18px",
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        <Icon size={17} strokeWidth={1.8} color={meta.color} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.012em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {campaign.name}
        </div>
        <div
          style={{
            marginTop: 5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 7,
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(0,0,0,0.42)",
          }}
        >
          <span>{meta.label}</span>
          <span style={{ color: "rgba(0,0,0,0.18)" }}>•</span>
          <span>{formatPeriod(campaign)}</span>
          <span style={{ color: "rgba(0,0,0,0.18)" }}>•</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.currentFragebogenName ?? "Kein Fragebogen"}</span>
        </div>
      </div>

      <VisitDeltaSummary
        before={before}
        added={added}
        after={after}
        deduped={deduped}
        mode={mode}
      />
    </div>
  );
}

function SimpleSplitList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ border: "1px solid rgba(0,0,0,0.06)", borderRadius: 11, overflow: "hidden", background: "#fff" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.34)" }}>{emptyText}</div>
        ) : rows.slice(0, 10).map((row, index) => {
          const pct = Math.max(5, Math.round((row.count / max) * 100));
          return (
            <div key={`${row.label}-${index}`} style={{ padding: "9px 12px", borderBottom: index < Math.min(rows.length, 10) - 1 ? "1px solid rgba(0,0,0,0.045)" : "none", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
                <div style={{ marginTop: 5, height: 3, borderRadius: 99, background: "rgba(0,0,0,0.055)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "rgba(0,0,0,0.24)" }} />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{formatNumber(row.count)}</div>
            </div>
          );
        })}
        {rows.length > 10 && (
          <div style={{ padding: "8px 12px", fontSize: 10, color: "rgba(0,0,0,0.42)", fontWeight: 700 }}>
            +{rows.length - 10} weitere
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignExtendPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = Array.isArray(params?.campaignId) ? params.campaignId[0] : params?.campaignId;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allMarkets, setAllMarkets] = useState<ExtendMarketCandidate[]>([]);
  const [gmUsers, setGmUsers] = useState<GMRecord[]>([]);
  const [mode, setMode] = useState<ExtendMode>("dedupe");
  const [step, setStep] = useState<ExtendStep>("import");
  const [importRows, setImportRows] = useState<ExtendMarketItem[]>([]);
  const [importCounts, setImportCounts] = useState<ImportCounts>(EMPTY_IMPORT_COUNTS);
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);
  const [gmOverridesByKey, setGmOverridesByKey] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [overlapConflicts, setOverlapConflicts] = useState<CampaignMarketOverlapConflict[] | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchCampaigns(), fetchMarkets(), fetchGmUsers()])
      .then(([campaignRows, marketRows, gmRows]) => {
        if (!alive) return;
        setCampaigns(campaignRows);
        setAllMarkets(marketRows.map((row) => ({
          id: row.id,
          rowNumber: 0,
          name: row.name,
          region: row.region,
          gm: resolveMarketGmLabel(row.currentGmName, row.employee),
          address: row.address,
          postalCode: row.postalCode,
          city: row.city,
          standardMarketNumber: row.standardMarketNumber,
          cokeMasterNumber: row.cokeMasterNumber,
          kuehlerStammnr: row.kuehlerStammnr,
          flexNumber: row.flexNumber,
          marketType: row.marketType,
          isActive: row.isActive,
        })));
        setGmUsers(gmRows.filter((gm) => !isTemporaryGmName(`${gm.firstName} ${gm.lastName}`)));
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : "Kampagnen-Erweiterung konnte nicht geladen werden.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const campaign = useMemo(
    () => campaigns.find((entry) => entry.id === campaignId) ?? null,
    [campaignId, campaigns],
  );
  const section = campaign && isExtendableSection(campaign.section) ? campaign.section : null;
  const meta = section ? TYPE_META[section] : TYPE_META.standard;
  const matchMode: CampaignMatchMode = section === "kuehler" ? "kuehler_stammnr" : "flex";

  const assignableMarkets = useMemo(
    () =>
      allMarkets.filter((market) => {
        if (market.isActive === false) return false;
        if (section !== "kuehler") return true;
        return getMarketStammnrCandidates(market).length > 0;
      }),
    [allMarkets, section],
  );

  const marketById = useMemo(() => new Map(assignableMarkets.map((market) => [market.id, market])), [assignableMarkets]);
  const matcherReport = useMemo(
    () => buildMarketMatchReport(importRows, assignableMarkets, matchMode),
    [assignableMarkets, importRows, matchMode],
  );

  const gmNameIndex = useMemo(() => {
    const index = new Map<string, GMRecord[]>();
    for (const user of gmUsers) {
      const fullName = normalizePersonName(`${user.firstName} ${user.lastName}`);
      const reverseName = normalizePersonName(`${user.lastName} ${user.firstName}`);
      for (const key of new Set([fullName, reverseName])) {
        if (!key) continue;
        const bucket = index.get(key) ?? [];
        bucket.push(user);
        index.set(key, bucket);
      }
    }
    return index;
  }, [gmUsers]);

  const gmEmailIndex = useMemo(() => {
    const index = new Map<string, GMRecord[]>();
    for (const user of gmUsers) {
      const key = normalizeEmailValue(user.email);
      if (!key) continue;
      const bucket = index.get(key) ?? [];
      bucket.push(user);
      index.set(key, bucket);
    }
    return index;
  }, [gmUsers]);

  const existingVisitCountByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const assignment of campaign?.assignments ?? []) {
      const key = assignmentKey(assignment.marketId, assignment.gmUserId);
      const count = Number(assignment.visitTargetCount ?? 1);
      map.set(key, (map.get(key) ?? 0) + (Number.isFinite(count) && count > 0 ? Math.trunc(count) : 1));
    }
    return map;
  }, [campaign?.assignments]);

  const existingMaxSlotByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const assignment of campaign?.assignments ?? []) {
      const key = assignmentKey(assignment.marketId, assignment.gmUserId);
      const slot = Number(assignment.assignmentSlot ?? 1);
      map.set(key, Math.max(map.get(key) ?? 0, Number.isFinite(slot) && slot > 0 ? Math.trunc(slot) : 1));
    }
    return map;
  }, [campaign?.assignments]);

  const existingMarketIds = useMemo(
    () => new Set((campaign?.assignments ?? []).map((assignment) => assignment.marketId)),
    [campaign?.assignments],
  );

  const assignmentBuild = useMemo(() => {
    const matchedRows = matcherReport.results.filter((result) => result.status === "matched" && result.marketId);
    const rowsByKey = new Map<string, ResolvedVisitRow[]>();
    const issues: GmMatchIssue[] = [];
    const resolvedByRowId = new Map<string, { gmUserId: string; gmDisplayName: string }>();

    for (const result of matchedRows) {
      const row = result.row;
      const marketId = result.marketId as string;
      const market = marketById.get(marketId);
      if (!market) continue;
      const gmName = row.gm ?? "";
      const gmOverrideKey = buildGmOverrideKey(gmName);
      const gmOverrideLabel = buildGmOverrideLabel(gmName);
      const overrideGmId = gmOverridesByKey[gmOverrideKey];

      let resolvedGmId: string | null = null;
      let resolvedGm: GMRecord | null = null;
      let candidates: GMRecord[] = [];

      if (overrideGmId) {
        const selected = gmUsers.find((gm) => gm.id === overrideGmId);
        if (selected) {
          resolvedGmId = selected.id;
          resolvedGm = selected;
          candidates = [selected];
        } else {
          issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "unmatched", candidateUserIds: [] });
          continue;
        }
      } else {
        const emailCandidates = extractEmailCandidates(gmName);
        const gmNameWithoutEmail = stripEmailsFromText(gmName);
        const normalizedGm = normalizePersonName(gmNameWithoutEmail);
        if (!normalizedGm && emailCandidates.length === 0) {
          issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "missing", candidateUserIds: [] });
          continue;
        }

        if (emailCandidates.length > 0) {
          const emailMatched = new Map<string, GMRecord>();
          for (const email of emailCandidates) {
            for (const user of gmEmailIndex.get(email) ?? []) emailMatched.set(user.id, user);
          }
          const emailMatches = Array.from(emailMatched.values());
          if (emailMatches.length === 1) {
            resolvedGm = emailMatches[0] ?? null;
            resolvedGmId = resolvedGm?.id ?? null;
            candidates = emailMatches;
          } else if (emailMatches.length > 1) {
            issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "ambiguous", candidateUserIds: emailMatches.map((candidate) => candidate.id) });
            continue;
          }
        }

        if (!resolvedGmId && normalizedGm) {
          candidates = gmNameIndex.get(normalizedGm) ?? [];
          if (candidates.length === 0) {
            issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "unmatched", candidateUserIds: [] });
            continue;
          }
          if (candidates.length > 1) {
            issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "ambiguous", candidateUserIds: candidates.map((candidate) => candidate.id) });
            continue;
          }
          resolvedGm = candidates[0] ?? null;
          resolvedGmId = resolvedGm?.id ?? null;
        }
      }

      if (!resolvedGmId) {
        issues.push({ rowId: row.id, marketId, gmName, gmOverrideKey, gmOverrideLabel, kind: "unmatched", candidateUserIds: candidates.map((candidate) => candidate.id) });
        continue;
      }
      if (!resolvedGm) resolvedGm = gmUsers.find((gm) => gm.id === resolvedGmId) ?? null;
      const gmDisplayName = resolvedGm ? (`${resolvedGm.firstName} ${resolvedGm.lastName}`.trim() || resolvedGm.email) : resolvedGmId;
      resolvedByRowId.set(row.id, { gmUserId: resolvedGmId, gmDisplayName });

      const key = assignmentKey(marketId, resolvedGmId);
      const bucket = rowsByKey.get(key) ?? [];
      bucket.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        marketId,
        marketName: market.name,
        region: normalizeRegionLabel(market.region),
        gmUserId: resolvedGmId,
        gmDisplayName,
        gmNameRaw: gmName,
      });
      rowsByKey.set(key, bucket);
    }

    const assignments: CampaignMarketAssignmentInput[] = [];
    const breakdown: AddedVisitBreakdown[] = [];
    let dedupedCount = 0;
    let addedVisitCount = 0;

    for (const [key, rows] of rowsByKey.entries()) {
      const sample = rows[0];
      if (!sample) continue;
      const importedCount = rows.length;
      const existingCount = existingVisitCountByKey.get(key) ?? 0;
      const addedCount = mode === "populate" ? importedCount : Math.max(0, importedCount - existingCount);
      const rowDedupedCount = mode === "dedupe" ? Math.min(importedCount, existingCount) : 0;
      dedupedCount += rowDedupedCount;
      if (addedCount <= 0) {
        breakdown.push({ ...sample, key, importedCount, existingCount, dedupedCount: rowDedupedCount, addedCount: 0 });
        continue;
      }

      addedVisitCount += addedCount;
      breakdown.push({ ...sample, key, importedCount, existingCount, dedupedCount: rowDedupedCount, addedCount });

      if (matchMode === "kuehler_stammnr") {
        const startSlot = existingMaxSlotByKey.get(key) ?? 0;
        for (let index = 0; index < addedCount; index += 1) {
          assignments.push({
            marketId: sample.marketId,
            gmUserId: sample.gmUserId,
            gmNameRaw: rows[index]?.gmNameRaw ?? sample.gmNameRaw,
            assignmentSlot: startSlot + index + 1,
            visitTargetCount: 1,
          });
        }
      } else {
        assignments.push({
          marketId: sample.marketId,
          gmUserId: sample.gmUserId,
          gmNameRaw: sample.gmNameRaw,
          assignmentSlot: 1,
          visitTargetCount: addedCount,
        });
      }
    }

    const newUniqueMarketIds = new Set(
      breakdown
        .filter((entry) => entry.addedCount > 0 && !existingMarketIds.has(entry.marketId))
        .map((entry) => entry.marketId),
    );

    return {
      assignments,
      issues,
      resolvedByRowId,
      breakdown,
      dedupedCount,
      addedVisitCount,
      newUniqueMarketCount: newUniqueMarketIds.size,
      validImportedVisitCount: Array.from(rowsByKey.values()).reduce((sum, rows) => sum + rows.length, 0),
    };
  }, [
    existingMarketIds,
    existingMaxSlotByKey,
    existingVisitCountByKey,
    gmEmailIndex,
    gmNameIndex,
    gmOverridesByKey,
    gmUsers,
    marketById,
    matchMode,
    matcherReport.results,
    mode,
  ]);

  const matcherIssueRows = useMemo(
    () => matcherReport.results.filter((result) => result.status !== "matched"),
    [matcherReport.results],
  );

  const gmIssueByRowId = useMemo(() => {
    const map = new Map<string, GmMatchIssue>();
    for (const issue of assignmentBuild.issues) {
      if (!map.has(issue.rowId)) map.set(issue.rowId, issue);
    }
    return map;
  }, [assignmentBuild.issues]);

  const gmIssueGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; kind: GmMatchIssueKind; count: number }>();
    for (const issue of assignmentBuild.issues) {
      const existing = groups.get(issue.gmOverrideKey);
      if (existing) {
        existing.count += 1;
        continue;
      }
      groups.set(issue.gmOverrideKey, {
        key: issue.gmOverrideKey,
        label: issue.gmOverrideLabel,
        kind: issue.kind,
        count: 1,
      });
    }
    return Array.from(groups.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }, [assignmentBuild.issues]);

  const matcherDisplayRows = useMemo(() => {
    const byId = new Map<string, MarketMatchResult>();
    for (const result of matcherIssueRows) byId.set(result.row.id, result);
    for (const result of matcherReport.results) {
      if (result.status !== "matched") continue;
      if (!gmIssueByRowId.has(result.row.id)) continue;
      byId.set(result.row.id, result);
    }
    return Array.from(byId.values());
  }, [gmIssueByRowId, matcherIssueRows, matcherReport.results]);

  const addedBreakdown = useMemo(
    () => assignmentBuild.breakdown.filter((entry) => entry.addedCount > 0),
    [assignmentBuild.breakdown],
  );

  const gmSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of addedBreakdown) map.set(entry.gmDisplayName, (map.get(entry.gmDisplayName) ?? 0) + entry.addedCount);
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }, [addedBreakdown]);

  const regionSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of addedBreakdown) map.set(entry.region, (map.get(entry.region) ?? 0) + entry.addedCount);
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }, [addedBreakdown]);

  const existingVisitTotal = useMemo(() => countCampaignVisits(campaign), [campaign]);
  const canSubmit = Boolean(campaign && section && assignmentBuild.assignments.length > 0 && !submitting);
  const conflictFreeAssignments = useMemo(() => {
    if (!overlapConflicts || overlapConflicts.length === 0) return assignmentBuild.assignments;
    const conflictedMarketIds = new Set(overlapConflicts.map((conflict) => conflict.marketId));
    return assignmentBuild.assignments.filter((assignment) => !conflictedMarketIds.has(assignment.marketId));
  }, [assignmentBuild.assignments, overlapConflicts]);

  const handleRowsLoad = useCallback((rows: ExtendMarketItem[], counts: ImportCounts, metaInfo: ImportMeta) => {
    setImportRows(rows);
    setImportCounts(counts);
    setImportMeta(metaInfo);
    setGmOverridesByKey({});
    setSubmitError(null);
    setOverlapConflicts(null);
    setStep("summary");
  }, []);

  const handleResetImport = useCallback(() => {
    setImportRows([]);
    setImportCounts(EMPTY_IMPORT_COUNTS);
    setImportMeta(null);
    setGmOverridesByKey({});
    setSubmitError(null);
    setOverlapConflicts(null);
    setStep("import");
  }, []);

  const updateMatcherRow = useCallback((rowId: string, field: "name" | "gm", value: string) => {
    setImportRows((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }, []);

  const setGmOverrideForKey = useCallback((overrideKey: string, gmUserId: string) => {
    setGmOverridesByKey((current) => {
      if (!gmUserId) {
        const next = { ...current };
        delete next[overrideKey];
        return next;
      }
      return { ...current, [overrideKey]: gmUserId };
    });
  }, []);

  const submitAssignments = useCallback(async (assignments: CampaignMarketAssignmentInput[]) => {
    if (!campaign || assignments.length === 0) return;
    const updatedCampaign = await assignCampaignMarketAssignments(campaign.id, assignments);
    setCampaigns((current) => current.map((entry) => (entry.id === updatedCampaign.id ? updatedCampaign : entry)));
  }, [campaign]);

  if (loading) {
    return (
      <div style={{ minHeight: "calc(100vh - 80px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", border: `3px solid ${R}`, borderTopColor: "transparent", animation: "extendSpin 0.8s linear infinite" }} />
        <style>{`@keyframes extendSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (loadError || !campaignId) {
    return (
      <div style={{ padding: 24 }}>
        <button type="button" onClick={() => router.push("/admin/fbmanagement")} style={{ border: "none", background: "transparent", color: "rgba(0,0,0,0.5)", fontWeight: 700, cursor: "pointer", marginBottom: 16, fontFamily: "inherit" }}>
          <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 6 }} /> Zurück
        </button>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(220,38,38,0.16)", padding: 20, color: R, fontWeight: 700 }}>
          {loadError ?? "Ungültige Kampagne."}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: 24 }}>
        <button type="button" onClick={() => router.push("/admin/fbmanagement")} style={{ border: "none", background: "transparent", color: "rgba(0,0,0,0.5)", fontWeight: 700, cursor: "pointer", marginBottom: 16, fontFamily: "inherit" }}>
          <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 6 }} /> Zurück
        </button>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 20, color: "#111827", fontWeight: 700 }}>
          Diese Kampagne wurde nicht gefunden.
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div style={{ padding: 24 }}>
        <button type="button" onClick={() => router.push("/admin/fbmanagement")} style={{ border: "none", background: "transparent", color: "rgba(0,0,0,0.5)", fontWeight: 700, cursor: "pointer", marginBottom: 16, fontFamily: "inherit" }}>
          <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 6 }} /> Zurück
        </button>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Flex-Kampagnen können in v1 nicht erweitert werden.</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.5)", fontWeight: 600 }}>Nutze diese Funktion für Standard, Billa, Kühler und MHD.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 80px)", overflowX: "hidden" }}>
      <style>{`
        .extend-soft-scroll::-webkit-scrollbar{width:4px;height:4px}
        .extend-soft-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}
        .extend-soft-scroll::-webkit-scrollbar-track{background:transparent}
        .extend-soft-scroll{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.12) transparent}
      `}</style>

      <div style={{ display: "flex", flex: 1, gap: 0, minWidth: 0, overflowX: "hidden" }}>
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignSelf: "flex-start",
            position: "sticky",
            top: 28,
          }}
        >
          <div
            style={{
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              padding: "28px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", padding: "0 8px", marginBottom: 10, display: "block" }}>Schritte</span>
          {STEPS.map((item) => {
            const currentStep = step === "import" ? 1 : assignmentBuild.assignments.length > 0 ? 3 : 2;
            const isDone = item.id < currentStep;
            const isCurrent = item.id === currentStep;
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.id === 1) handleResetImport();
                  if (item.id > 1 && importRows.length > 0) setStep("summary");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 10px",
                  borderRadius: 9,
                  cursor: item.id === 1 || importRows.length > 0 ? "pointer" : "default",
                  backgroundColor: isCurrent ? meta.bg : "transparent",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDone || isCurrent ? meta.color : "rgba(0,0,0,0.07)",
                    border: `1.5px solid ${isDone || isCurrent ? "transparent" : "rgba(0,0,0,0.1)"}`,
                    transition: "all 0.25s ease",
                  }}
                >
                  {isDone ? <Check size={11} strokeWidth={2.5} color="#fff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? "#fff" : "rgba(0,0,0,0.4)" }}>{item.id}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent || isDone ? "#1a1a1a" : "rgba(0,0,0,0.4)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 400, marginTop: 1 }}>{item.sub}</div>
                </div>
              </div>
            );
          })}
          <div style={{ margin: "16px 10px 0", height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, backgroundColor: meta.color, width: `${step === "import" ? 0 : assignmentBuild.assignments.length > 0 ? 100 : 50}%`, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 16, overflowX: "hidden" }}>
          <CampaignSummaryHeader
            campaign={campaign}
            meta={meta}
              before={existingVisitTotal}
              added={assignmentBuild.addedVisitCount}
              after={existingVisitTotal + assignmentBuild.addedVisitCount}
              deduped={assignmentBuild.dedupedCount}
              mode={mode}
          />

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              padding: "30px 36px",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {step === "import" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Weitere Marktbesuche importieren</h2>
                  <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0, fontWeight: 400 }}>
                    {section === "kuehler" ? "Mapping: Stammnr als Pflichtspalte, Mitarbeiter optional." : "Mapping: Flexnummer als Pflichtspalte, Mitarbeiter optional."}
                  </p>
                </div>
                <ImportWizard
                  section={section}
                  accentColor={meta.color}
                  accentBg={meta.bg}
                  accentDark={meta.dark}
                  mode={mode}
                  setMode={setMode}
                  onLoad={handleRowsLoad}
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Erweiterung prüfen</h2>
                    <p style={{ fontSize: 12, color: "rgba(0,0,0,0.42)", margin: 0, fontWeight: 500 }}>
                      {importMeta ? `${importMeta.fileName} · ${importMeta.sheetName}` : "Importierte Datei"} · {mode === "populate" ? "Duplikate werden als Extra-Visits gezählt." : `${formatNumber(assignmentBuild.dedupedCount)} dedupliziert, +${formatNumber(assignmentBuild.addedVisitCount)} neue Visits.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetImport}
                    style={{
                      padding: "7px 13px",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(0,0,0,0.48)",
                      background: "linear-gradient(to bottom,#fff,#f5f5f5)",
                      boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)",
                      fontFamily: "inherit",
                      flexShrink: 0,
                    }}
                  >
                    Neue Datei
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
                  <StatCard label="Zeilen" value={formatNumber(importCounts.parsedRows)} />
                  <StatCard label="Übersprungen" value={formatNumber(importCounts.blankRows + importCounts.missingIdentityRows)} sub={`${formatNumber(importCounts.blankRows)} leer`} tone={importCounts.blankRows + importCounts.missingIdentityRows > 0 ? "amber" : "neutral"} />
                  <StatCard label="Zugeordnet" value={formatNumber(matcherReport.results.filter((result) => result.status === "matched").length)} tone="green" />
                  <StatCard label="Nicht gefunden" value={formatNumber(matcherReport.unmatched)} tone={matcherReport.unmatched > 0 ? "amber" : "neutral"} />
                  <StatCard label="Unklar" value={formatNumber(matcherReport.ambiguous)} tone={matcherReport.ambiguous > 0 ? "amber" : "neutral"} />
                  <StatCard label="GM prüfen" value={formatNumber(assignmentBuild.issues.length)} tone={assignmentBuild.issues.length > 0 ? "red" : "neutral"} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <StatCard label="Neue Visits" value={`+${formatNumber(assignmentBuild.addedVisitCount)}`} sub={`${formatNumber(assignmentBuild.newUniqueMarketCount)} neue Märkte`} tone="green" />
                  <StatCard label="Gültig" value={formatNumber(assignmentBuild.validImportedVisitCount)} sub="Markt + GM gelöst" tone="blue" />
                  <StatCard label="Assignments" value={formatNumber(assignmentBuild.assignments.length)} sub={matchMode === "kuehler_stammnr" ? "neue Slots" : "Gruppen"} />
                </div>

                {assignmentBuild.addedVisitCount === 0 && (
                  <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(217,119,6,0.18)", background: "rgba(217,119,6,0.07)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <AlertTriangle size={15} strokeWidth={2} color="#d97706" style={{ marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Keine neuen Visits übrig</div>
                      <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: "rgba(124,45,18,0.85)" }}>
                        In Dedupe kann das korrekt sein, wenn die ausgewählte Kampagne diese Markt/GM-Kombinationen bereits in gleicher oder höherer Anzahl enthält.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <SimpleSplitList title="Split nach GM" rows={gmSplit} emptyText="Noch keine neuen Visits." />
                  <SimpleSplitList title="Split nach Region" rows={regionSplit} emptyText="Noch keine neuen Visits." />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Neue Visit-Gruppen</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)" }}>{formatNumber(addedBreakdown.length)} Gruppen</span>
                  </div>
                  <div className="extend-soft-scroll" style={{ border: "1px solid rgba(0,0,0,0.06)", borderRadius: 11, overflow: "auto", maxHeight: 250, background: "#fff" }}>
                    {addedBreakdown.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.34)" }}>Keine neuen Visit-Gruppen.</div>
                    ) : addedBreakdown.slice(0, 80).map((entry, index) => (
                      <div key={`${entry.key}-${index}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 90px 90px", gap: 10, alignItems: "center", padding: "9px 12px", borderBottom: index < Math.min(addedBreakdown.length, 80) - 1 ? "1px solid rgba(0,0,0,0.045)" : "none", background: index % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.marketName}</div>
                          <div style={{ marginTop: 2, fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.34)" }}>{entry.region}</div>
                        </div>
                        <div style={{ minWidth: 0, fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.58)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.gmDisplayName}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.4)", textAlign: "right" }}>{formatNumber(entry.importedCount)} importiert</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", textAlign: "right" }}>+{formatNumber(entry.addedCount)}</div>
                      </div>
                    ))}
                    {addedBreakdown.length > 80 && (
                      <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.42)" }}>+{formatNumber(addedBreakdown.length - 80)} weitere Gruppen</div>
                    )}
                  </div>
                </div>

                {matcherDisplayRows.length > 0 && (
                  <div style={{ padding: "12px 14px", borderRadius: 11, border: "1px solid rgba(180,83,9,0.20)", background: "rgba(180,83,9,0.06)", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Ausgeschlossene oder zu prüfende Zeilen</div>
                      <div style={{ marginTop: 3, fontSize: 10, fontWeight: 600, color: "rgba(124,45,18,0.85)" }}>Diese Zeilen werden nicht übernommen, bis Markt und GM eindeutig sind.</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {matcherDisplayRows.slice(0, 16).map((issue, index) => {
                        const gmIssue = gmIssueByRowId.get(issue.row.id);
                        return (
                          <div key={`${issue.row.id}-${index}`} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(180,83,9,0.18)", background: "rgba(255,255,255,0.72)", display: "grid", gridTemplateColumns: "80px 1fr 1fr 160px", gap: 8, alignItems: "center" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e" }}>Zeile {issue.row.rowNumber}</div>
                            <input
                              value={issue.row.name}
                              onChange={(event) => updateMatcherRow(issue.row.id, "name", event.target.value)}
                              style={{ minWidth: 0, border: "1px solid rgba(124,45,18,0.25)", borderRadius: 6, padding: "5px 7px", fontSize: 11, fontWeight: 700, color: "#7c2d12", background: "#fff", fontFamily: "inherit" }}
                            />
                            <input
                              value={issue.row.gm}
                              onChange={(event) => updateMatcherRow(issue.row.id, "gm", event.target.value)}
                              style={{ minWidth: 0, border: "1px solid rgba(124,45,18,0.25)", borderRadius: 6, padding: "5px 7px", fontSize: 11, fontWeight: 700, color: "#7c2d12", background: "#fff", fontFamily: "inherit" }}
                            />
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textAlign: "right" }}>
                              {issue.status === "ambiguous" ? "Markt unklar" : issue.status === "unmatched" ? "Markt fehlt" : gmIssue ? "GM prüfen" : matcherReasonLabel(issue.reason)}
                            </div>
                          </div>
                        );
                      })}
                      {matcherDisplayRows.length > 16 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e" }}>+{formatNumber(matcherDisplayRows.length - 16)} weitere Problemzeilen</div>
                      )}
                    </div>

                    {gmIssueGroups.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>GM manuell pro Importwert zuordnen</div>
                        {gmIssueGroups.slice(0, 12).map((group) => (
                          <div key={group.key} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, alignItems: "center", padding: "7px 8px", borderRadius: 8, border: "1px solid rgba(180,83,9,0.16)", background: "rgba(255,255,255,0.78)" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c2d12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</div>
                              <div style={{ marginTop: 2, fontSize: 9, fontWeight: 700, color: "rgba(124,45,18,0.74)" }}>{formatNumber(group.count)} Zeilen · {group.kind === "missing" ? "Name fehlt" : group.kind === "unmatched" ? "Kein GM gefunden" : "Mehrdeutig"}</div>
                            </div>
                            <WhiteSelect
                              value={gmOverridesByKey[group.key] ?? ""}
                              onChange={(next) => setGmOverrideForKey(group.key, next)}
                              options={gmUsers.map((gm) => ({
                                value: gm.id,
                                label: `${gm.firstName} ${gm.lastName} · ${gm.email}`,
                              }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {submitError && (
                  <div style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", fontSize: 11, color: R, fontWeight: 700 }}>
                    {submitError}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setStep("import")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 18px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                      color: "rgba(0,0,0,0.5)",
                      boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
                      fontFamily: "inherit",
                    }}
                  >
                    <ArrowLeft size={13} strokeWidth={2} />
                    Zurück
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!canSubmit || submitting) return;
                      setSubmitError(null);
                      setOverlapConflicts(null);
                      setSubmitting(true);
                      try {
                        await submitAssignments(assignmentBuild.assignments);
                        router.push("/admin/fbmanagement");
                      } catch (error) {
                        const conflicts = getCampaignOverlapConflicts(error);
                        if (conflicts.length > 0) {
                          setOverlapConflicts(conflicts);
                        } else {
                          setSubmitError(error instanceof Error ? error.message : "Kampagne konnte nicht erweitert werden.");
                        }
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={!canSubmit || submitting}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 24px",
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 9,
                      border: "none",
                      cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
                      background: canSubmit && !submitting ? `linear-gradient(to bottom, ${meta.color}, ${meta.dark})` : "rgba(0,0,0,0.08)",
                      color: canSubmit && !submitting ? "#fff" : "rgba(0,0,0,0.3)",
                      boxShadow: canSubmit && !submitting ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${meta.dark}, 0 2px 8px ${meta.color}55` : "none",
                      transition: "all 0.25s ease",
                      fontFamily: "inherit",
                    }}
                  >
                    <ListPlus size={14} strokeWidth={2.5} />
                    {submitting ? "Übernehme..." : "Visits hinzufügen"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {overlapConflicts && overlapConflicts.length > 0 && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(10,16,28,0.36)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(820px, 95vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Marktkonflikte in derselben Sektion</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 600 }}>
                  Diese Märkte sind bereits einer aktiven Kampagne in derselben Sektion zugeordnet. In v1 übernehmen wir nur konfliktfreie Zusätze.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOverlapConflicts(null)}
                disabled={resolvingConflict}
                style={{ border: "none", background: "rgba(0,0,0,0.05)", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: resolvingConflict ? "not-allowed" : "pointer", opacity: resolvingConflict ? 0.6 : 1 }}
              >
                <X size={14} strokeWidth={2} color="rgba(0,0,0,0.5)" />
              </button>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {overlapConflicts.map((conflict) => (
                <div key={`${conflict.marketId}:${conflict.existingCampaignId}:${conflict.existingGmUserId ?? "none"}`} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "10px 12px", background: "rgba(0,0,0,0.015)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{conflict.marketName}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,0,0,0.6)", fontWeight: 600 }}>
                    Aktuell in: <strong>{conflict.existingCampaignName}</strong> · Zeitraum: {conflict.existingPeriodLabel}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "rgba(0,0,0,0.6)", fontWeight: 600 }}>
                    Zugewiesener GM: {conflict.existingGmName ?? "Kein GM"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOverlapConflicts(null)}
                disabled={resolvingConflict}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom,#fff,#f5f5f5)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.6)",
                  cursor: resolvingConflict ? "not-allowed" : "pointer",
                  opacity: resolvingConflict ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (resolvingConflict || conflictFreeAssignments.length === 0) return;
                  setSubmitError(null);
                  setResolvingConflict(true);
                  try {
                    await submitAssignments(conflictFreeAssignments);
                    router.push("/admin/fbmanagement");
                  } catch (error) {
                    setSubmitError(error instanceof Error ? error.message : "Konfliktfreie Erweiterung konnte nicht übernommen werden.");
                    setOverlapConflicts(null);
                  } finally {
                    setResolvingConflict(false);
                  }
                }}
                disabled={resolvingConflict || conflictFreeAssignments.length === 0}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: conflictFreeAssignments.length > 0 ? "linear-gradient(to bottom, #111827, #020617)" : "rgba(0,0,0,0.10)",
                  boxShadow: conflictFreeAssignments.length > 0 ? "inset 0 1px 0.6px rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.08), 0 0 0 1px #020617, 0 2px 8px rgba(2,6,23,0.22)" : "none",
                  fontSize: 12,
                  fontWeight: 700,
                  color: conflictFreeAssignments.length > 0 ? "#fff" : "rgba(0,0,0,0.36)",
                  cursor: resolvingConflict || conflictFreeAssignments.length === 0 ? "not-allowed" : "pointer",
                  opacity: resolvingConflict ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                Nur konfliktfreie übernehmen ({formatNumber(conflictFreeAssignments.reduce((sum, assignment) => sum + (assignment.visitTargetCount ?? 1), 0))})
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
