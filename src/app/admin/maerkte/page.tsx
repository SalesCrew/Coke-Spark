"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, ChevronDown, Check, FileSpreadsheet, Upload, Plus,
  MapPin, Edit2, Save, RotateCcw, Info, Calendar, Clock, User,
  Building2, Tag, ArrowRight, AlertTriangle, CheckCircle2, Trash2, Loader2,
} from "lucide-react";
import type { KuehlerUnitRecord, MarketRecord, MarketVisitLog, MarketFilters, SectionType } from "@/types/markets";
import {
  readWorkbook, buildPreviewGrid, getColHeader, getColSample,
  getFieldSpecsForImportType, validateMapping, draftToMarketRecord,
  type ColumnMapping, type WorkbookResult, type ImportSummary, type FieldSpec, type ImportDatasetType,
} from "@/utils/marketImport";
import {
  createMarket,
  createMarketKuehlerUnit,
  fetchMarkets,
  fetchMarketKuehlerUnits,
  hardDeleteMarket,
  importMarkets,
  normalizeAllMarketRegions,
  readAuthSession,
  softDeleteMarket,
  updateMarket,
  updateMarketUniverseMarket,
  updateMarketKuehlerUnit,
  type NormalizeMarketRegionsResult,
} from "@/lib/api/backend";
import { exportMarketsExcel } from "@/lib/exports/masterDataExports";
import { useRedMonth } from "@/context/RedMonthContext";

// ── Constants ─────────────────────────────────────────────────

const R  = "#DC2626";
const RD = "#b91c1c";
const LS_VISITS_PREFIX = "admin_market_visits_v2:";
const LS_VISITS_LEGACY = "admin_market_visits_v1";

function getVisitsStorageKey(): string {
  const userId = readAuthSession()?.user.id ?? "anonymous";
  return `${LS_VISITS_PREFIX}${userId}`;
}

// ── Utility helpers ────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}
function chainInitials(name: string): { bg: string; text: string } {
  const n = name.toUpperCase();
  if (n.includes("BILLA")) return { bg: "rgba(234,179,8,0.12)", text: "#a16207" };
  if (n.includes("SPAR"))  return { bg: "rgba(220,38,38,0.08)", text: "#DC2626" };
  if (n.includes("MERKUR"))return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  if (n.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (n.includes("HOFER")) return { bg: "rgba(16,185,129,0.08)", text: "#065f46" };
  if (n.includes("ADEG"))  return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  return { bg: "rgba(0,0,0,0.05)", text: "#6b7280" };
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildMarketSearchBlob(market: MarketRecord): string {
  const tokens: string[] = [];
  for (const [key, value] of Object.entries(market)) {
    tokens.push(key);
    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) tokens.push(trimmed);
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) tokens.push(String(value));
      continue;
    }
    if (typeof value === "boolean") {
      tokens.push(value ? "true ja yes 1" : "false nein no 0");
      continue;
    }
    tokens.push(String(value));
  }
  return normalizeSearchText(tokens.join(" "));
}

function isMarketFilterValueActive(value: MarketFilters[keyof MarketFilters]): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function formatMarketFilterValue(value: MarketFilters[keyof MarketFilters]): string {
  if (Array.isArray(value)) {
    if (value.length <= 2) return value.join(", ");
    return `${value.length} Handelsketten`;
  }
  return value ?? "";
}

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.07)"   },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.07)"  },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.07)"  },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.07)"  },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.07)"   },
};

type MarketContextMenuState = {
  marketId: string;
  x: number;
  y: number;
};

type ManualMarketType = "universum" | "kuehler" | "both";

type ManualMarketCreateInput = {
  market: MarketRecord;
  kuehlerUnit?: {
    name?: string;
    employee?: string;
    kuehlerInternalId?: string | null;
    kuehlerBd?: string | null;
    kuehlerAnzahlKsAmStandort?: number | null;
    kuehlerSerialNumber?: string | null;
    kuehlerModel?: string | null;
    importSourceFileName?: string;
    importedAt?: string;
  };
};

// ── Frequency circle ──────────────────────────────────────────

const FrequencyCircle = React.memo(function FrequencyCircle({ visited, frequency, visitedThisMonth, size = 36 }: {
  visited: number; frequency: number; visitedThisMonth: boolean; size?: number;
}) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = frequency > 0 ? Math.min(1, visited / frequency) : 0;
  const strokeColor = visitedThisMonth ? "#16a34a" : R;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 36 36" width={size} height={size} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={2.5} />
        <circle cx={18} cy={18} r={r} fill="none" stroke={strokeColor} strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={`${pct * circ} ${circ}`} />
      </svg>
      <span style={{ fontSize: 7.5, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums", position: "relative", zIndex: 1, letterSpacing: "-0.02em" }}>
        {visited}/{frequency}
      </span>
    </div>
  );
});

// ── Market row (memoized for virtual list) ─────────────────────

const MARKET_ROW_H = 54; // px — must match the actual rendered row height
const MARKET_LIST_GRID = "minmax(240px,1.55fr) minmax(82px,0.5fr) 34px minmax(140px,0.9fr) minmax(70px,0.45fr) 54px minmax(110px,0.75fr) 56px minmax(110px,0.75fr) 38px 40px";
const MARKET_LIST_GAP = "0 10px";

function UniverseMarketDropdown({
  value,
  disabled,
  saving,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(96, rect.width);
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Universumsmarkt ändern"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          height: 28,
          border: "none",
          borderRadius: 7,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          background: open ? "rgba(220,38,38,0.055)" : "linear-gradient(to bottom,#fff,#f6f6f6)",
          boxShadow: open
            ? "inset 0 0 0 1px rgba(220,38,38,0.22), 0 1px 4px rgba(0,0,0,0.05)"
            : "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
          color: value ? "#166534" : "#6b7280",
          fontFamily: "inherit",
          fontSize: 10,
          fontWeight: 700,
          cursor: disabled ? "wait" : "pointer",
          opacity: disabled && !saving ? 0.55 : 1,
        }}
      >
        <span>{value ? "Ja" : "Nein"}</span>
        {saving ? <Loader2 size={11} className="animate-spin" /> : <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.34)" />}
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Universumsmarkt"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 9999,
            padding: 4,
            borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.11), 0 2px 6px rgba(0,0,0,0.04)",
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {([true, false] as const).map((option) => {
            const selected = option === value;
            return (
              <button
                key={String(option)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(option);
                }}
                style={{
                  width: "100%",
                  minHeight: 30,
                  padding: "0 9px",
                  border: "none",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: selected ? "rgba(220,38,38,0.06)" : "transparent",
                  color: selected ? R : "#374151",
                  fontFamily: "inherit",
                  fontSize: 10,
                  fontWeight: selected ? 700 : 500,
                  cursor: "pointer",
                }}
                onMouseEnter={(event) => { if (!selected) event.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
                onMouseLeave={(event) => { if (!selected) event.currentTarget.style.background = "transparent"; }}
              >
                {option ? "Ja" : "Nein"}
                {selected ? <Check size={11} strokeWidth={2.5} color={R} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

const MarketRow = React.memo(function MarketRow({
  market,
  active,
  visited,
  visitCount,
  onSelect,
  onOpenContextMenu,
}: {
  market: MarketRecord;
  active: boolean;
  visited: boolean;
  visitCount: number;
  onSelect: (id: string | null) => void;
  onOpenContextMenu?: (event: React.MouseEvent<HTMLDivElement>, marketId: string) => void;
}) {
  const chainLabel = market.dbName.trim() || market.name.split(" ")[0].slice(0, 4);
  const ci = chainInitials(chainLabel);
  const rowBaseBackground = market.isActive ? "transparent" : "rgba(220,38,38,0.02)";
  return (
    <div
      onClick={() => onSelect(active ? null : market.id)}
      onMouseDown={(event) => {
        if (event.button !== 2) return;
        if (!onOpenContextMenu) return;
        event.preventDefault();
        onOpenContextMenu(event, market.id);
      }}
      onContextMenu={(event) => {
        if (!onOpenContextMenu) return;
        event.preventDefault();
        onOpenContextMenu(event, market.id);
      }}
      style={{ display: "grid", gridTemplateColumns: MARKET_LIST_GRID, gap: MARKET_LIST_GAP, padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(220,38,38,0.04)" : rowBaseBackground, borderLeft: active ? `3px solid ${R}` : "3px solid transparent", transition: "background 0.1s ease, border-left-color 0.1s ease", alignItems: "center", height: MARKET_ROW_H, boxSizing: "border-box" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = rowBaseBackground; }}
    >
      {/* Markt */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ci.bg, color: ci.text, letterSpacing: "0.02em", flexShrink: 0, textTransform: "uppercase" }}>
          {chainLabel}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.name}</div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{market.dbName}</div>
        </div>
      </div>
      {/* Stammnr */}
      <div style={{ minWidth: 0, fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>{market.cokeMasterNumber || market.kuehlerStammnr || ""}</div>
      {/* Info dot */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {market.infoFlag && <span style={{ width: 6, height: 6, borderRadius: "50%", background: R, flexShrink: 0 }} title="Info vorhanden" />}
      </div>
      {/* Adresse */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.address}</div>
      </div>
      {/* Region */}
      <div style={{ minWidth: 0, fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.region}</div>
      {/* PLZ */}
      <div style={{ minWidth: 0, fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>{market.postalCode}</div>
      {/* Ort */}
      <div style={{ minWidth: 0, fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.city}</div>
      {/* EM/EH */}
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{market.emEh}</span>
      {/* Verplant an */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{market.plannedByActiveStandardGmName ?? "—"}</div>
      </div>
      {/* IPP */}
      <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{market.ipp != null ? market.ipp.toFixed(1) : "—"}</span>
      {/* Frequenz */}
      <FrequencyCircle visited={visitCount} frequency={market.visitFrequencyPerYear} visitedThisMonth={visited} size={34} />
    </div>
  );
});

// ── Virtual market list ────────────────────────────────────────

const OVERSCAN = 8;

function VirtualMarketList({
  items,
  selectedId,
  onSelect,
  onOpenContextMenu,
  visitedSet,
  visitCounts,
}: {
  items: MarketRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenContextMenu?: (event: React.MouseEvent<HTMLDivElement>, marketId: string) => void;
  visitedSet: Set<string>;
  visitCounts: Record<string, number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerH(el.clientHeight);
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);

  // When items change (e.g. new filter), reset scroll
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [items]);

  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.28)" }}>Keine Märkte gefunden.</span>
      </div>
    );
  }

  const totalH = items.length * MARKET_ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / MARKET_ROW_H) - OVERSCAN);
  const endIdx   = Math.min(items.length, Math.ceil((scrollTop + containerH) / MARKET_ROW_H) + OVERSCAN);
  const paddingTop    = startIdx * MARKET_ROW_H;
  const paddingBottom = Math.max(0, totalH - endIdx * MARKET_ROW_H);

  return (
    <div
      ref={containerRef}
      className="map-scroll"
      style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto", overflowX: "hidden" }}
    >
      <div style={{ paddingTop, paddingBottom }}>
        {items.slice(startIdx, endIdx).map(m => (
          <MarketRow
            key={m.id}
            market={m}
            active={m.id === selectedId}
            visited={visitedSet.has(m.id)}
            visitCount={visitCounts[m.id] ?? 0}
            onSelect={onSelect}
            onOpenContextMenu={onOpenContextMenu}
          />
        ))}
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────

type ImportStep = "type" | "upload" | "review" | "summary";

function getImportDatasetLabel(importType: ImportDatasetType | null | undefined): string {
  if (importType === "kuehler") return "Kühlermärkte";
  if (importType === "update") return "Bestehende Märkte";
  return "Universumsmärkte";
}

function getImportDatasetActionLabel(importType: ImportDatasetType | null | undefined): string {
  if (importType === "update") return "Bestehende Märkte aktualisieren";
  return `${getImportDatasetLabel(importType)} importieren`;
}

function ImportModal({
  onImport,
  onSaveFixedRow,
  onClose,
}: {
  onImport: (payload: {
    importType: ImportDatasetType;
    allowMissingCokeMasterNumber?: boolean;
    fileName: string;
    sheetName: string;
    rows: string[][];
    mapping: ColumnMapping;
  }) => Promise<{ markets: MarketRecord[]; summary: ImportSummary }>;
  onSaveFixedRow: (market: MarketRecord) => Promise<MarketRecord>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("type");
  const [selectedImportType, setSelectedImportType] = useState<ImportDatasetType | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wb, setWb] = useState<WorkbookResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowMissingCokeMasterNumber, setAllowMissingCokeMasterNumber] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (selectedImportType !== "universum") setAllowMissingCokeMasterNumber(false);
  }, [selectedImportType]);

  const handleFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) return;
    setParsing(true);
    setParseError(null);
    try {
      const result = await readWorkbook(f);
      setWb(result);
      setFileName(f.name);
      setMapping({});
      setSubmitError(null);
      setStep("review");
    } catch (err) {
      setParseError(String(err));
    } finally {
      setParsing(false);
    }
  }, []);

  const handleImportClick = useCallback(async () => {
    if (!wb || isSubmitting || !selectedImportType) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onImport({
        importType: selectedImportType,
        allowMissingCokeMasterNumber: selectedImportType === "universum" ? allowMissingCokeMasterNumber : false,
        fileName,
        sheetName: wb.sheetName,
        rows: wb.rows,
        mapping,
      });
      setSummary(result.summary);
      setStep("summary");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }, [wb, mapping, fileName, onImport, isSubmitting, selectedImportType, allowMissingCokeMasterNumber]);

  // Called from summary when user manually fills a skipped row and presses save
  const handleSaveFixedRow = useCallback(async (market: MarketRecord) => {
    return onSaveFixedRow(market);
    // We don't close the modal — the summary view manages the local display state
  }, [onSaveFixedRow]);

  const activeFieldSpecs = useMemo(
    () => getFieldSpecsForImportType(selectedImportType ?? "universum"),
    [selectedImportType],
  );
  const validation = useMemo(() => validateMapping(mapping, activeFieldSpecs), [mapping, activeFieldSpecs]);
  const preview = useMemo(() => wb ? buildPreviewGrid(wb.rows) : null, [wb]);

  if (!mounted || typeof document === "undefined") return null;

  // ── Shared modal shell ─────────────────────────────────────
  const widths: Record<ImportStep, number> = { type: 520, upload: 520, review: 860, summary: 580 };
  const modalW = widths[step];

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <style>{`
        @keyframes imIn { from{opacity:0;transform:scale(0.96)translateY(10px)} to{opacity:1;transform:scale(1)translateY(0)} }
        @keyframes impSpin { to { transform: rotate(360deg); } }
        .imp-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .imp-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        .imp-scroll::-webkit-scrollbar-track { background: transparent; }
        .imp-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.12) transparent; }
        .imp-col-input:focus { outline: none; border-color: rgba(220,38,38,0.4) !important; background: #fff !important; }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: modalW, maxHeight: "92vh", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "imIn 0.22s cubic-bezier(0.4,0,0.2,1) both", transition: "max-width 0.22s cubic-bezier(0.4,0,0.2,1)" }}
      >

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: step === "summary" ? "rgba(22,163,74,0.09)" : "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.18s ease" }}>
            {step === "summary"
              ? <CheckCircle2 size={16} strokeWidth={1.8} color="#16a34a" />
              : <FileSpreadsheet size={16} strokeWidth={1.8} color={R} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
              {step === "type"    && "Datensatz auswählen"}
              {step === "upload"  && getImportDatasetActionLabel(selectedImportType)}
              {step === "review"  && "Spalten zuweisen"}
              {step === "summary" && "Import abgeschlossen"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500, marginTop: 1 }}>
              {step === "type"    && "Importart für neue oder bestehende Märkte wählen"}
              {step === "upload"  && "Excel-Datei ziehen oder auswählen"}
              {step === "review"  && `${getImportDatasetLabel(selectedImportType)} · ${fileName} · ${wb?.sheetName ?? ""} · ${(wb?.rows.length ?? 1) - 1} Datenzeilen`}
              {step === "summary" && `${getImportDatasetLabel(selectedImportType)} · ${fileName} · ${wb?.sheetName ?? ""}`}
            </div>
          </div>
          {/* Step indicator dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 8 }}>
            {(["type", "upload", "review", "summary"] as ImportStep[]).map((s) => {
              const orderedSteps: ImportStep[] = ["type", "upload", "review", "summary"];
              const done = orderedSteps.indexOf(step) > orderedSteps.indexOf(s);
              const active = step === s;
              return (
                <div key={s} style={{ width: active ? 18 : 6, height: 6, borderRadius: 99, transition: "all 0.2s ease", background: done ? "#16a34a" : active ? R : "rgba(0,0,0,0.12)" }} />
              );
            })}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)", flexShrink: 0, transition: "background 0.12s ease" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* ── STEP 0: Dataset type selection ── */}
          {step === "type" && (
            <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.52)", lineHeight: 1.5 }}>
                Wähle zuerst den Datensatztyp. Danach startet der normale Excel-Upload mit passender Spaltenzuweisung.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <button
                  onClick={() => { setSelectedImportType("universum"); setStep("upload"); }}
                  style={{
                    padding: "14px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "linear-gradient(to bottom,#fff,#f8f8f8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Universumsmärkte</span>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.42)" }}>Standardimport mit vorhandener Feldstruktur</span>
                  </span>
                  <ArrowRight size={14} strokeWidth={2} color="rgba(0,0,0,0.32)" />
                </button>
                <button
                  onClick={() => { setSelectedImportType("kuehler"); setStep("upload"); }}
                  style={{
                    padding: "14px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "linear-gradient(to bottom,#fff,#f8f8f8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Kühlermärkte</span>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.42)" }}>Stammnr-Matching mit Kühler-Feldern</span>
                  </span>
                  <ArrowRight size={14} strokeWidth={2} color="rgba(0,0,0,0.32)" />
                </button>
                <button
                  onClick={() => { setSelectedImportType("update"); setStep("upload"); }}
                  style={{
                    padding: "14px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "linear-gradient(to bottom,#fff,#f8f8f8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(8,145,178,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <RotateCcw size={13} strokeWidth={2} color="#0891b2" />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Bestehende Märkte aktualisieren</span>
                      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.42)" }}>Matching nur per Flex-Nr. Nur gemappte Felder werden geändert.</span>
                    </span>
                  </span>
                  <ArrowRight size={14} strokeWidth={2} color="rgba(0,0,0,0.32)" />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)" }}>Abbrechen</button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? R : "rgba(0,0,0,0.10)"}`, borderRadius: 12, padding: "42px 20px", background: dragging ? "rgba(220,38,38,0.03)" : "rgba(0,0,0,0.012)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", transition: "all 0.18s ease", textAlign: "center" }}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files)} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: dragging ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                  {parsing
                    ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${R}`, borderTopColor: "transparent", animation: "impSpin 0.7s linear infinite" }} />
                    : <FileSpreadsheet size={22} strokeWidth={1.5} color={dragging ? R : "rgba(0,0,0,0.28)"} />
                  }
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? R : "#1a1a1a", marginBottom: 4 }}>
                    {parsing ? "Datei wird gelesen…" : "Excel-Datei hier ablegen"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>oder klicken zum Auswählen · .xlsx, .xls</div>
                </div>
              </div>
              {selectedImportType === "universum" && (
                <button
                  type="button"
                  onClick={() => setAllowMissingCokeMasterNumber((value) => !value)}
                  style={{ width: "100%", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 9, background: allowMissingCokeMasterNumber ? "rgba(8,145,178,0.06)" : "#fff", padding: "9px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#111827", letterSpacing: "0.01em" }}>ohne Stammnr</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.38)" }}>Nur Flex-Nummer als Pflicht-ID verwenden.</span>
                  </span>
                  <span style={{ width: 30, height: 16, borderRadius: 99, background: allowMissingCokeMasterNumber ? "#0891b2" : "rgba(0,0,0,0.14)", padding: 2, boxSizing: "border-box", transition: "background 0.14s ease", flexShrink: 0 }}>
                    <span style={{ display: "block", width: 12, height: 12, borderRadius: "50%", background: "#fff", transform: allowMissingCokeMasterNumber ? "translateX(14px)" : "translateX(0)", transition: "transform 0.14s ease" }} />
                  </span>
                </button>
              )}
              {parseError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)" }}>
                  <AlertTriangle size={13} strokeWidth={2} color={R} />
                  <span style={{ fontSize: 11, color: R, fontWeight: 500 }}>Fehler beim Lesen: {parseError}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setStep("type")} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)" }}>Zurück</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Review (preview + mapping) ── */}
          {step === "review" && wb && preview && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {/* Excel preview table */}
              <div style={{ flex: "0 0 220px", overflow: "auto", borderBottom: "1px solid rgba(0,0,0,0.06)" }} className="imp-scroll">
                <table style={{ borderCollapse: "collapse", fontSize: 10, fontVariantNumeric: "tabular-nums", tableLayout: "fixed", minWidth: "max-content" }}>
                  <colgroup>
                    <col style={{ width: 36 }} />
                    {preview.colLetters.map((_l, i) => <col key={i} style={{ width: 110 }} />)}
                  </colgroup>
                  {/* Column-letter header */}
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)", width: 36, minWidth: 36 }} />
                      {preview.colLetters.map((l) => (
                        <th key={l} style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8f8f8", borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "rgba(0,0,0,0.45)", fontSize: 9, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{l}</th>
                      ))}
                    </tr>
                    {/* Header row (row 1 of sheet) */}
                    <tr>
                      <td style={{ position: "sticky", left: 0, zIndex: 2, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "4px 6px", textAlign: "right", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" }}>1</td>
                      {preview.headerRow.map((h, ci) => (
                        <td key={ci} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "4px 8px", fontWeight: 600, color: "#1a1a1a", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{h}</td>
                      ))}
                    </tr>
                  </thead>
                  {/* Data rows */}
                  <tbody>
                    {preview.previewRows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)" }}>
                        <td style={{ position: "sticky", left: 0, zIndex: 1, background: ri % 2 === 0 ? "#f8f8f8" : "#f3f3f3", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "3px 6px", textAlign: "right", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>{preview.rowNumbers[ri]}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ borderRight: "1px solid rgba(0,0,0,0.03)", padding: "3px 8px", color: cell ? "#374151" : "rgba(0,0,0,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{cell || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Column mapping form */}
              <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }} className="imp-scroll">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 12 }}>Spaltenzuweisung</div>

                {/* Required section */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.22)", marginBottom: 8 }}>Pflichtfelder</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px 10px" }}>
                    {activeFieldSpecs.filter(s => s.required || s.isIdentity).map(spec => (
                      <MappingRow key={spec.key} spec={spec} value={mapping[spec.key] ?? ""} rows={wb.rows} validation={validation} onChange={v => setMapping(m => ({ ...m, [spec.key]: v.toUpperCase() }))} />
                    ))}
                  </div>
                </div>

                {/* Optional section */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.22)", marginBottom: 8 }}>Optionale Felder</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px 10px" }}>
                    {activeFieldSpecs.filter(s => !s.required && !s.isIdentity).map(spec => (
                      <MappingRow key={spec.key} spec={spec} value={mapping[spec.key] ?? ""} rows={wb.rows} validation={validation} onChange={v => setMapping(m => ({ ...m, [spec.key]: v.toUpperCase() }))} />
                    ))}
                  </div>
                </div>

                {/* Helper note */}
                <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginTop: 8 }}>
                  {selectedImportType === "update"
                    ? "Update-Modus: Flex-Nummer findet den Markt. Nur gemappte optionale Felder mit Werten werden aktualisiert."
                    : "Spaltenangabe als Excel-Buchstaben"} · <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>A = 1. Spalte · Z = 26. · AA = 27.</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
                {submitError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)" }}>
                    <AlertTriangle size={12} strokeWidth={2} color={R} />
                    <span style={{ fontSize: 10, color: R, fontWeight: 600 }}>{submitError}</span>
                  </div>
                )}
                <button onClick={() => setStep("upload")} style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)" }}>← Zurück</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!validation.canImport && (
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
                      {!Object.keys(validation.fieldErrors).length && !Object.keys(validation.duplicateErrors).length
                        ? "Mind. 1 Identitätsspalte + Pflichtfelder nötig"
                        : "Fehler in der Zuweisung prüfen"}
                    </span>
                  )}
                  <button
                    onClick={handleImportClick}
                    disabled={!validation.canImport || isSubmitting}
                    style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: validation.canImport && !isSubmitting ? "pointer" : "not-allowed", color: "#fff", background: validation.canImport && !isSubmitting ? `linear-gradient(to bottom, ${R}, ${RD})` : "rgba(0,0,0,0.15)", boxShadow: validation.canImport && !isSubmitting ? `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` : "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s ease", opacity: validation.canImport && !isSubmitting ? 1 : 0.7 }}
                  >
                    <Upload size={11} strokeWidth={2} />
                    {isSubmitting ? "Import läuft…" : "Importieren"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Summary ── */}
          {step === "summary" && summary && (
            <ImportSummaryView summary={summary} fileName={fileName} onClose={onClose} onSaveFixedRow={handleSaveFixedRow} onRestart={() => { setStep("type"); setSelectedImportType(null); setWb(null); setMapping({}); setSummary(null); setFileName(""); }} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Mapping Row ────────────────────────────────────────────────

function MappingRow({
  spec, value, rows, validation, onChange,
}: {
  spec: FieldSpec;
  value: string;
  rows: string[][];
  validation: ReturnType<typeof validateMapping>;
  onChange: (v: string) => void;
}) {
  const err = validation.fieldErrors[spec.key] || validation.duplicateErrors[spec.key];
  const header = value && !err ? getColHeader(rows, value) : null;
  const sample = value && !err ? getColSample(rows, value) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: err ? R : "rgba(0,0,0,0.5)", letterSpacing: "0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.label}</span>
        {spec.isIdentity && <span style={{ fontSize: 7, fontWeight: 700, color: "#0891b2", background: "rgba(8,145,178,0.08)", padding: "1px 5px", borderRadius: 3, letterSpacing: "0.03em", flexShrink: 0 }}>ID</span>}
        {spec.required && !spec.isIdentity && <span style={{ fontSize: 7, fontWeight: 700, color: R, background: "rgba(220,38,38,0.07)", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>P</span>}
      </div>
      {/* Input */}
      <input
        type="text"
        value={value}
        maxLength={3}
        placeholder="—"
        className="imp-col-input"
        onChange={e => onChange(e.target.value.replace(/[^A-Za-z]/g, ""))}
        style={{
          width: "100%", padding: "5px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
          fontFamily: "inherit", fontVariantNumeric: "tabular-nums", textTransform: "uppercase",
          border: `1px solid ${err ? "rgba(220,38,38,0.4)" : value ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.08)"}`,
          background: err ? "rgba(220,38,38,0.03)" : value ? "rgba(0,0,0,0.015)" : "#fff",
          color: err ? R : "#1a1a1a",
          transition: "all 0.12s ease",
          boxSizing: "border-box",
        }}
      />
      {/* Live preview */}
      {!err && value && (header !== null || sample !== null) && (
        <div style={{ fontSize: 8, color: "rgba(0,0,0,0.38)", lineHeight: 1.4, overflow: "hidden" }}>
          {header && <span style={{ fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{header.substring(0, 18)}</span>}
          {sample && <span style={{ marginLeft: header ? 4 : 0 }}>{sample.substring(0, 18)}</span>}
        </div>
      )}
      {err && <div style={{ fontSize: 8, color: R, fontWeight: 500 }}>{err}</div>}
    </div>
  );
}

// ── Import Summary View ────────────────────────────────────────

function ImportSummaryView({ summary, fileName, onClose, onRestart, onSaveFixedRow }: {
  summary: ImportSummary;
  fileName: string;
  onClose: () => void;
  onRestart: () => void;
  onSaveFixedRow: (market: MarketRecord) => Promise<MarketRecord> | MarketRecord;
}) {
  const matchKeys = Object.entries(summary.matchedBy).filter(([, v]) => v > 0);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  // Local copy of skipped reasons so we can remove rows as they're saved
  const [localSkipped, setLocalSkipped] = useState(() => summary.skippedReasons);
  const [localCreated, setLocalCreated] = useState(summary.created);
  // fills[rowIndex][fieldKey] = typed value
  const [fills, setFills] = useState<Record<number, Record<string, string>>>({});
  // which rows have been saved (shown as success)
  const [savedRows, setSavedRows] = useState<Set<number>>(new Set());
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set());
  const summaryFieldSpecs = useMemo(
    () => getFieldSpecsForImportType(summary.importType ?? "universum"),
    [summary.importType],
  );
  const isKuehlerImport = summary.importType === "kuehler";
  const isUpdateImport = summary.importType === "update";

  const toggleRow = (i: number) => setExpandedRows(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const setFill = (rowIdx: number, key: string, val: string) => {
    setFills(prev => ({ ...prev, [rowIdx]: { ...(prev[rowIdx] ?? {}), [key]: val } }));
  };

  const handleSaveRow = async (rowIdx: number, r: typeof localSkipped[0]) => {
    if (savingRows.has(rowIdx) || savedRows.has(rowIdx)) return;
    if (isUpdateImport) return;
    setSavingRows((prev) => new Set(prev).add(rowIdx));
    try {
      const rowFills = fills[rowIdx] ?? {};
      // Merge fills into draft
      const completeDraft = { ...(r.draft ?? {}), ...rowFills };
      const market = draftToMarketRecord(completeDraft, fileName, summary.importType ?? "universum");
      await onSaveFixedRow(market);
      setSavedRows(prev => new Set([...prev, rowIdx]));
      setLocalCreated(c => c + 1);
      // Remove from local skipped list after short delay for animation feel
      setTimeout(() => {
        setLocalSkipped(prev => prev.filter((_, i) => i !== rowIdx));
        // Remap savedRows/fills indices — simpler to just clear the saved row
        setSavedRows(prev => { const n = new Set(prev); n.delete(rowIdx); return n; });
      }, 600);
    } catch {
      // Keep summary row visible when save fails.
    } finally {
      setSavingRows((prev) => {
        const next = new Set(prev);
        next.delete(rowIdx);
        return next;
      });
    }
  };

  const canSaveRow = (rowIdx: number, missingKeys: (string)[] = []) => {
    const rowFills = fills[rowIdx] ?? {};
    return missingKeys.every(k => rowFills[k]?.trim());
  };

  const statItems = isKuehlerImport
    ? [
        { label: "Zeilen gesamt", value: summary.totalParsedRows, color: "rgba(0,0,0,0.5)", bg: "#fff", border: "rgba(0,0,0,0.08)" },
        { label: "Einheiten erstellt", value: summary.kuehlerUnitsCreated ?? 0, color: "#16a34a", bg: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.16)" },
        { label: "Einheiten aktualisiert", value: summary.kuehlerUnitsUpdated ?? 0, color: "#0891b2", bg: "rgba(8,145,178,0.06)", border: "rgba(8,145,178,0.16)" },
        { label: "Einheiten übersprungen", value: summary.kuehlerUnitsSkipped ?? 0, color: (summary.kuehlerUnitsSkipped ?? 0) > 0 ? "#d97706" : "rgba(0,0,0,0.35)", bg: (summary.kuehlerUnitsSkipped ?? 0) > 0 ? "rgba(217,119,6,0.06)" : "#fff", border: (summary.kuehlerUnitsSkipped ?? 0) > 0 ? "rgba(217,119,6,0.2)" : "rgba(0,0,0,0.08)" },
      ]
    : isUpdateImport
    ? [
        { label: "Gesamt", value: summary.totalParsedRows, color: "rgba(0,0,0,0.5)", bg: "#fff", border: "rgba(0,0,0,0.08)" },
        { label: "Aktualisiert", value: summary.updated, color: "#0891b2", bg: "rgba(8,145,178,0.06)", border: "rgba(8,145,178,0.16)" },
        { label: "Nicht geändert", value: summary.unchanged ?? 0, color: "rgba(0,0,0,0.35)", bg: "#fff", border: "rgba(0,0,0,0.08)" },
        { label: "Übersprungen", value: localSkipped.length, color: localSkipped.length > 0 ? "#d97706" : "rgba(0,0,0,0.35)", bg: localSkipped.length > 0 ? "rgba(217,119,6,0.06)" : "#fff", border: localSkipped.length > 0 ? "rgba(217,119,6,0.2)" : "rgba(0,0,0,0.08)" },
      ]
    : [
        { label: "Gesamt", value: summary.totalParsedRows, color: "rgba(0,0,0,0.5)", bg: "#fff", border: "rgba(0,0,0,0.08)" },
        { label: "Erstellt", value: localCreated, color: "#16a34a", bg: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.16)" },
        { label: "Aktualisiert", value: summary.updated, color: "#0891b2", bg: "rgba(8,145,178,0.06)", border: "rgba(8,145,178,0.16)" },
        { label: "Übersprungen", value: localSkipped.length, color: localSkipped.length > 0 ? "#d97706" : "rgba(0,0,0,0.35)", bg: localSkipped.length > 0 ? "rgba(217,119,6,0.06)" : "#fff", border: localSkipped.length > 0 ? "rgba(217,119,6,0.2)" : "rgba(0,0,0,0.08)" },
      ];

  const matchLabels: Record<string, string> = {
    standardMarketNumber: "Standardmarkt Nr",
    cokeMasterNumber: "Stammnr. von Coke",
    flexNumber: "Flex-Nummer",
    namePLZ: "Name + PLZ",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(0,0,0,0.025)" }}>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }} className="imp-scroll">

        {/* Stats row — white inner card */}
        <div style={{ background: "#fff", borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {statItems.map(s => (
              <div key={s.label} style={{ padding: "10px 12px", borderRadius: 9, background: s.bg, border: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: s.color, opacity: 0.8, marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1, transition: "color 0.2s ease" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Source info — white inner card */}
        <div style={{ background: "#fff", borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "12px 16px", marginBottom: 10, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FileSpreadsheet size={13} strokeWidth={1.8} color="rgba(0,0,0,0.35)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>{summary.fileName}</span>
          </div>
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Blatt: <strong style={{ color: "rgba(0,0,0,0.55)" }}>{summary.sheetName}</strong></span>
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Datensatz: <strong style={{ color: "rgba(0,0,0,0.55)" }}>{getImportDatasetLabel(summary.importType)}</strong></span>
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Zeilen: <strong style={{ color: "rgba(0,0,0,0.55)" }}>{summary.totalParsedRows}</strong></span>
          {matchKeys.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
              {matchKeys.map(([k, v]) => (
                <span key={k} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: "rgba(8,145,178,0.07)", color: "#0891b2", border: "1px solid rgba(8,145,178,0.14)" }}>
                  {matchLabels[k] ?? k} · {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Success state */}
        {localSkipped.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 11, border: "1px solid rgba(22,163,74,0.14)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={14} strokeWidth={2} color="#16a34a" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>Alle Zeilen erfolgreich verarbeitet — keine Probleme.</span>
          </div>
        )}

        {/* Skipped rows — white inner card, collapsible */}
        {localSkipped.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            {/* Collapse header */}
            <button
              onClick={() => setSkippedOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderBottom: skippedOpen ? "1px solid rgba(0,0,0,0.05)" : "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.015)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={10} strokeWidth={2.5} color="#d97706" />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", flex: 1 }}>
                {localSkipped.length} Zeile{localSkipped.length !== 1 ? "n" : ""} übersprungen
              </span>
              {summary.skipped > summary.skippedReasons.length && (
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>zeigt erste {summary.skippedReasons.length}</span>
              )}
              <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.35)" style={{ transform: skippedOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.18s ease", flexShrink: 0 }} />
            </button>

            {/* Expandable list */}
            <div style={{ maxHeight: skippedOpen ? 440 : 0, overflow: "hidden", transition: "max-height 0.24s cubic-bezier(0.4,0,0.2,1)" }}>
              <div className="imp-scroll" style={{ maxHeight: 440, overflowY: "auto" }}>
                {localSkipped.map((r, i) => {
                  const expanded = expandedRows.has(i);
                  const saved = savedRows.has(i);
                  const saving = savingRows.has(i);
                  const missingKeys = (r.missingFieldKeys ?? []) as string[];
                  const rowFills = fills[i] ?? {};
                  const canSave = canSaveRow(i, missingKeys);
                  return (
                    <div key={`${r.row}-${i}`} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", opacity: saved ? 0.5 : 1, transition: "opacity 0.3s ease" }}>
                      {/* Row summary line */}
                      <button
                        onClick={() => toggleRow(i)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "none", background: expanded ? "rgba(217,119,6,0.03)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.1s ease" }}
                        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
                        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 800, color: "#d97706", flexShrink: 0, minWidth: 28, fontVariantNumeric: "tabular-nums" }}>Z{r.row}</span>
                        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", flex: 1, fontWeight: 500 }}>{r.reason}</span>
                        {r.sample && (
                          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)", fontStyle: "italic", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{r.sample}</span>
                        )}
                        <ChevronDown size={10} strokeWidth={2} color="rgba(0,0,0,0.25)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s ease", flexShrink: 0, marginLeft: 4 }} />
                      </button>

                      {/* Expanded detail */}
                      {expanded && (
                        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

                          {/* Editable missing fields */}
                          {missingKeys.length > 0 && !isUpdateImport && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d97706", marginBottom: 7 }}>Fehlend — bitte ergänzen</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px" }}>
                                {missingKeys.map(key => {
                                  const spec = summaryFieldSpecs.find(s => s.key === key);
                                  return (
                                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.38)" }}>
                                        {spec?.label ?? key}
                                      </span>
                                      <input
                                        type="text"
                                        value={rowFills[key] ?? ""}
                                        placeholder="Wert eingeben…"
                                        onChange={e => setFill(i, key, e.target.value)}
                                        style={{
                                          fontSize: 11, fontWeight: 500, color: "#1a1a1a",
                                          background: "transparent", border: "none",
                                          borderBottom: `1.5px solid ${rowFills[key]?.trim() ? "#1a1a1a" : "rgba(0,0,0,0.18)"}`,
                                          outline: "none", padding: "3px 0", width: "100%",
                                          fontFamily: "inherit", transition: "border-color 0.15s ease",
                                        }}
                                        onFocus={e => { (e.target as HTMLInputElement).style.borderBottomColor = R; }}
                                        onBlur={e => { (e.target as HTMLInputElement).style.borderBottomColor = rowFills[key]?.trim() ? "#1a1a1a" : "rgba(0,0,0,0.18)"; }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Fetched fields */}
                          {r.fetchedFields && r.fetchedFields.length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.3)", marginBottom: 6 }}>Gefundene Daten</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 16px" }}>
                                {r.fetchedFields.map((f, fi) => (
                                  <div key={fi} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                                    <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.3)", flexShrink: 0, minWidth: 78 }}>{f.label}</span>
                                    <span style={{ fontSize: 10, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Save button */}
                          {missingKeys.length > 0 && !isUpdateImport && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                              <button
                                onClick={() => { void handleSaveRow(i, r); }}
                                disabled={!canSave || saved || saving}
                                style={{
                                  padding: "6px 16px", fontSize: 10, fontWeight: 700, borderRadius: 7, border: "none",
                                  cursor: canSave && !saved && !saving ? "pointer" : "not-allowed",
                                  color: "#fff",
                                  background: canSave && !saved && !saving ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.15)",
                                  boxShadow: canSave && !saved && !saving ? `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 4px rgba(180,20,20,0.14)` : "none",
                                  transition: "all 0.15s ease",
                                  display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
                                }}
                              >
                                {saving ? "Speichern..." : saved ? <><Check size={10} strokeWidth={2.5} /> Gespeichert</> : "Speichern & importieren"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fff", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
        <button onClick={onRestart} style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}>Import erneut</button>
        <button onClick={onClose} style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: "linear-gradient(to bottom,#16a34a,#15803d)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.25),0 0 0 1px #166534,0 1px 6px rgba(22,163,74,0.18)", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Check size={11} strokeWidth={2.5} />
          Schließen
        </button>
      </div>
    </div>
  );
}

// ── Filter dropdown ────────────────────────────────────────────

function FilterDropdown({ options, value, onChange, onClose, anchorRef, nullLabel = "Alle" }: {
  options: string[]; value: string | null;
  onChange: (v: string | null) => void; onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  nullLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="map-scroll" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, minWidth: 160, maxHeight: 480, overflowY: "auto" }}>
      <button onClick={() => { onChange(null); onClose(); }}
        style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: !value ? "rgba(220,38,38,0.06)" : "transparent", color: !value ? R : "#374151", fontWeight: !value ? 600 : 400, fontFamily: "inherit" }}
        onMouseEnter={e => { if (value) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
        onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}>
        {nullLabel}
      </button>
      {options.map(opt => (
        <button key={opt} onClick={() => { onChange(opt); onClose(); }}
          style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === opt ? "rgba(220,38,38,0.06)" : "transparent", color: value === opt ? R : "#374151", fontWeight: value === opt ? 600 : 400, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
          onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}>
          {opt}
          {value === opt && <Check size={11} strokeWidth={2.5} color={R} />}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ── Info section for detail drawer ────────────────────────────

function MultiFilterDropdown({ options, value, onChange, onClose, anchorRef, nullLabel = "Alle" }: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  nullLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="map-scroll" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, minWidth: 190, maxHeight: 480, overflowY: "auto" }}>
      <button onClick={() => onChange([])}
        style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value.length === 0 ? "rgba(220,38,38,0.06)" : "transparent", color: value.length === 0 ? R : "#374151", fontWeight: value.length === 0 ? 600 : 400, fontFamily: "inherit" }}
        onMouseEnter={e => { if (value.length > 0) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
        onMouseLeave={e => { if (value.length > 0) e.currentTarget.style.background = "transparent"; }}>
        {nullLabel}
      </button>
      {options.map(opt => {
        const selected = value.includes(opt);
        return (
          <button key={opt} onClick={() => onChange(selected ? value.filter(v => v !== opt) : [...value, opt])}
            style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: selected ? "rgba(220,38,38,0.06)" : "transparent", color: selected ? R : "#374151", fontWeight: selected ? 600 : 400, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
            {selected && <Check size={11} strokeWidth={2.5} color={R} />}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, edit, editValue, onEdit }: {
  label: string; value: string | React.ReactNode; edit?: boolean;
  editValue?: string; onEdit?: (v: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)", paddingTop: 1 }}>{label}</span>
      {edit && onEdit !== undefined ? (
        <input value={editValue ?? ""} onChange={e => onEdit(e.target.value)}
          style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: "4px 8px", outline: "none", background: "#fff", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <span style={{ fontSize: 11, fontWeight: 500, color: value ? "#1a1a1a" : "rgba(0,0,0,0.28)" }}>{value || "—"}</span>
      )}
    </div>
  );
}

// ── Visit session card ────────────────────────────────────────

function ManualMarketField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>
        {label}{required ? " *" : ""}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        style={{
          height: 36,
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 9,
          background: "#fff",
          padding: "0 11px",
          outline: "none",
          color: "#111827",
          fontSize: 11,
          fontWeight: 650,
          fontFamily: "inherit",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(15,23,42,0.035)",
        }}
      />
    </label>
  );
}

function ManualMarketCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: ManualMarketCreateInput) => Promise<MarketRecord>;
}) {
  const [marketType, setMarketType] = useState<ManualMarketType>("universum");
  const [name, setName] = useState("");
  const [dbName, setDbName] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("Ost");
  const [emEh, setEmEh] = useState("");
  const [employee, setEmployee] = useState("");
  const [currentGmName, setCurrentGmName] = useState("");
  const [flexNumber, setFlexNumber] = useState("");
  const [cokeMasterNumber, setCokeMasterNumber] = useState("");
  const [standardMarketNumber, setStandardMarketNumber] = useState("");
  const [visitFrequencyPerYear, setVisitFrequencyPerYear] = useState("");
  const [infoNote, setInfoNote] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [createKuehlerUnitNow, setCreateKuehlerUnitNow] = useState(false);
  const [kuehlerInternalId, setKuehlerInternalId] = useState("");
  const [kuehlerSerialNumber, setKuehlerSerialNumber] = useState("");
  const [kuehlerModel, setKuehlerModel] = useState("");
  const [kuehlerBd, setKuehlerBd] = useState("");
  const [kuehlerAnzahlKsAmStandort, setKuehlerAnzahlKsAmStandort] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKuehler = marketType !== "universum";
  const effectiveCreateUnit = hasKuehler && createKuehlerUnitNow;

  const setType = (nextType: ManualMarketType) => {
    setMarketType(nextType);
    setCreateKuehlerUnitNow(nextType !== "universum");
  };

  const submit = async () => {
    if (submitting) return;
    setError(null);
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const trimmedPostalCode = postalCode.trim();
    const trimmedCity = city.trim();
    const trimmedRegion = region.trim();
    const stammnr = cokeMasterNumber.trim();
    if (!trimmedName || !trimmedAddress || !trimmedPostalCode || !trimmedCity || !trimmedRegion) {
      setError("Bitte Name, Adresse, PLZ, Ort und Region ausfüllen.");
      return;
    }
    if (hasKuehler && !stammnr) {
      setError("Für Kühler oder Beides ist eine Stammnr. erforderlich.");
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const market: MarketRecord = {
        id: "manual-new",
        name: trimmedName,
        dbName: dbName.trim(),
        address: trimmedAddress,
        postalCode: trimmedPostalCode,
        city: trimmedCity,
        region: trimmedRegion,
        emEh: emEh.trim(),
        currentGmName: currentGmName.trim(),
        plannedByActiveStandardGmName: null,
        visitFrequencyPerYear: Math.max(0, parseInt(visitFrequencyPerYear, 10) || 0),
        infoFlag: infoNote.trim().length > 0,
        flexNumber: flexNumber.trim(),
        cokeMasterNumber: stammnr,
        standardMarketNumber: standardMarketNumber.trim(),
        employee: employee.trim(),
        universeMarket: marketType !== "kuehler",
        marketType,
        kuehlerStammnr: hasKuehler ? stammnr : "",
        isActive,
        infoNote: infoNote.trim(),
        ipp: null,
        importSourceFileName: "Manuell",
        importedAt: now,
        plannedToId: null,
        isDeleted: false,
      };
      await onCreate({
        market,
        kuehlerUnit: effectiveCreateUnit
          ? {
              name: trimmedName,
              employee: employee.trim(),
              kuehlerInternalId: kuehlerInternalId.trim() || null,
              kuehlerBd: kuehlerBd.trim() || null,
              kuehlerAnzahlKsAmStandort: kuehlerAnzahlKsAmStandort.trim()
                ? Math.max(0, parseInt(kuehlerAnzahlKsAmStandort, 10) || 0)
                : null,
              kuehlerSerialNumber: kuehlerSerialNumber.trim() || null,
              kuehlerModel: kuehlerModel.trim() || null,
              importSourceFileName: "Manuell",
              importedAt: now,
            }
          : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Markt konnte nicht angelegt werden.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      onClick={() => {
        if (!submitting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9900,
        background: "rgba(15,23,42,0.24)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 720,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "hidden",
          borderRadius: 16,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 18px 60px rgba(15,23,42,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,23,42,0.35)", marginBottom: 5 }}>
              Marktverwaltung
            </div>
            <div style={{ fontSize: 17, fontWeight: 850, letterSpacing: "-0.03em", color: "#111827" }}>Markt manuell anlegen</div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 550, color: "rgba(15,23,42,0.48)" }}>
              Normalen Markt anlegen oder direkt als Kühler/Beides mit erstem Gerät speichern.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ width: 30, height: 30, border: "none", borderRadius: 9, background: "rgba(15,23,42,0.045)", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15,23,42,0.48)" }}
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <div className="map-scroll" style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {([
              ["universum", "Normaler Markt", "Universum / Standard"],
              ["kuehler", "Kühler Markt", "nur Kühler"],
              ["both", "Beides", "Universum + Kühler"],
            ] as Array<[ManualMarketType, string, string]>).map(([type, label, sub]) => {
              const active = marketType === type;
              return (
                <button
                  key={type}
                  onClick={() => setType(type)}
                  style={{
                    border: active ? "1px solid rgba(220,38,38,0.32)" : "1px solid rgba(15,23,42,0.08)",
                    background: active ? "rgba(220,38,38,0.045)" : "#fff",
                    borderRadius: 11,
                    padding: "11px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: active ? "0 8px 18px rgba(220,38,38,0.07)" : "0 1px 4px rgba(15,23,42,0.035)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: active ? R : "#111827" }}>{label}</div>
                  <div style={{ marginTop: 2, fontSize: 9.5, fontWeight: 600, color: "rgba(15,23,42,0.42)" }}>{sub}</div>
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.16)", background: "rgba(220,38,38,0.055)", color: R, fontSize: 11, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
            <div style={{ border: "1px solid rgba(15,23,42,0.07)", borderRadius: 13, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <ManualMarketField label="Name" value={name} onChange={setName} placeholder="z.B. BILLA Plus" required />
              <ManualMarketField label="Name f. DB" value={dbName} onChange={setDbName} placeholder="Handelskette" />
              <ManualMarketField label="Adresse" value={address} onChange={setAddress} placeholder="Straße 001" required />
              <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1.3fr", gap: 10 }}>
                <ManualMarketField label="PLZ" value={postalCode} onChange={setPostalCode} placeholder="1010" required />
                <ManualMarketField label="Ort" value={city} onChange={setCity} placeholder="Wien" required />
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>Region *</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  style={{ height: 36, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 9, background: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, color: "#111827", fontFamily: "inherit" }}
                >
                  {["Nord", "Ost", "Süd", "West"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </label>
              <ManualMarketField label="EM/EH" value={emEh} onChange={setEmEh} placeholder="EM oder EH" />
              <ManualMarketField label="Mitarbeiter" value={employee} onChange={setEmployee} placeholder="optional" />
              <ManualMarketField label="GM" value={currentGmName} onChange={setCurrentGmName} placeholder="optional" />
            </div>

            <div style={{ border: "1px solid rgba(15,23,42,0.07)", borderRadius: 13, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <ManualMarketField label="Flex-Nr." value={flexNumber} onChange={setFlexNumber} placeholder="optional" />
              <ManualMarketField label="Stammnr. Coke" value={cokeMasterNumber} onChange={setCokeMasterNumber} placeholder={hasKuehler ? "für Kühler erforderlich" : "optional"} required={hasKuehler} />
              <ManualMarketField label="Standardmarkt Nr" value={standardMarketNumber} onChange={setStandardMarketNumber} placeholder="optional" />
              <ManualMarketField label="Besuchsfrequenz / Jahr" value={visitFrequencyPerYear} onChange={setVisitFrequencyPerYear} placeholder="0" type="number" />
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>Info-Notiz</span>
                <textarea
                  value={infoNote}
                  onChange={(event) => setInfoNote(event.target.value)}
                  placeholder="optional"
                  style={{ minHeight: 64, resize: "vertical", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 9, padding: "9px 11px", fontSize: 11, fontWeight: 600, color: "#111827", fontFamily: "inherit", outline: "none" }}
                />
              </label>
              <button
                onClick={() => setIsActive((value) => !value)}
                style={{ alignSelf: "flex-start", height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: isActive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.06)", color: isActive ? "#059669" : R, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
              >
                {isActive ? "Aktiv" : "Inaktiv"}
              </button>
            </div>
          </div>

          {hasKuehler && (
            <div style={{ border: "1px solid rgba(217,119,6,0.15)", background: "rgba(245,158,11,0.035)", borderRadius: 13, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 850, color: "#92400e" }}>Ersten Kühler direkt anlegen</div>
                  <div style={{ marginTop: 2, fontSize: 9.5, fontWeight: 600, color: "rgba(146,64,14,0.56)" }}>Optional, aber hilfreich für Inventur und spätere Auswahl.</div>
                </div>
                <button
                  onClick={() => setCreateKuehlerUnitNow((value) => !value)}
                  style={{ width: 40, height: 22, borderRadius: 999, border: "none", background: createKuehlerUnitNow ? "#DC2626" : "rgba(15,23,42,0.12)", cursor: "pointer", position: "relative" }}
                >
                  <span style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#fff", top: 2, left: createKuehlerUnitNow ? 20 : 2, transition: "left 0.16s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }} />
                </button>
              </div>
              {createKuehlerUnitNow && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  <ManualMarketField label="Kühlernummer" value={kuehlerInternalId} onChange={setKuehlerInternalId} placeholder="internal_id" />
                  <ManualMarketField label="Serial Number" value={kuehlerSerialNumber} onChange={setKuehlerSerialNumber} placeholder="optional" />
                  <ManualMarketField label="Model" value={kuehlerModel} onChange={setKuehlerModel} placeholder="optional" />
                  <ManualMarketField label="BD" value={kuehlerBd} onChange={setKuehlerBd} placeholder="optional" />
                  <ManualMarketField label="Anzahl KS" value={kuehlerAnzahlKsAmStandort} onChange={setKuehlerAnzahlKsAmStandort} placeholder="optional" type="number" />
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", gap: 10, background: "#fff" }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ height: 34, padding: "0 16px", borderRadius: 9, border: "none", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)", color: "rgba(15,23,42,0.48)", fontSize: 11, fontWeight: 750, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            style={{ height: 34, padding: "0 18px", borderRadius: 9, border: "none", background: `linear-gradient(to bottom,${R},${RD})`, boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 8px rgba(180,20,20,0.18)", color: "#fff", fontSize: 11, fontWeight: 850, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <Plus size={12} strokeWidth={2.4} />
            {submitting ? "Wird angelegt..." : "Markt anlegen"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VisitCard({ logs }: { logs: MarketVisitLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...logs].sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime());
  const primary = sorted[0];
  const isFlexVisit = sorted.some(l => l.sectionType === "flex");
  const visitType   = isFlexVisit ? "Flexbesuch" : "Standardbesuch";
  const vtColor     = isFlexVisit
    ? { color: "#65a30d", bg: "rgba(132,204,22,0.09)", border: "rgba(132,204,22,0.22)" }
    : { color: R,        bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)" };
  const totalDuration = sorted.reduce((n, l) => n + l.durationMin, 0);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", boxShadow: expanded ? "0 4px 18px rgba(0,0,0,0.07)" : "0 1px 5px rgba(0,0,0,0.04)", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.22s ease" }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 5px rgba(0,0,0,0.04)"; }}
    >
      {/* Collapsed header */}
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>

        {/* Visit type pill — border radius matches card (12 → 7) */}
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: vtColor.bg, color: vtColor.color, border: `1px solid ${vtColor.border}`, letterSpacing: "0.02em", flexShrink: 0, whiteSpace: "nowrap" }}>
          {visitType}
        </span>

        {/* Section dots — overlapping like avatar stack */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {sorted.map((l, i) => {
            const sm = SECTION_META[l.sectionType];
            return <span key={l.id} title={sm.label} style={{ width: 9, height: 9, borderRadius: "50%", background: sm.color, border: "1.5px solid #fff", display: "inline-block", marginLeft: i === 0 ? 0 : -4, flexShrink: 0 }} />;
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Meta: date · time · duration, then GM · RED Monat · chevron */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" }}>
            {fmtDate(primary.visitedAt)} · {fmtTime(primary.visitedAt)} Uhr · {totalDuration} Min
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, marginTop: 2 }}>
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{primary.gmName}</span>
            {primary.redMonatLabel && <span style={{ fontSize: 8, color: "rgba(0,0,0,0.26)", fontWeight: 500 }}>{primary.redMonatLabel}</span>}
            <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.28)"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
          </div>
        </div>
      </div>

      {/* Expandable body */}
      <div style={{ maxHeight: expanded ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.2s ease 0.06s, transform 0.2s ease 0.06s", borderTop: "1px solid rgba(0,0,0,0.05)", padding: "9px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {sorted.map(l => {
            const sm = SECTION_META[l.sectionType];
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8, background: "rgba(0,0,0,0.025)" }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: sm.bg, color: sm.color, border: `1px solid ${sm.color}28`, letterSpacing: "0.03em", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {sm.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.fragebogenName}
                </span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fmtTime(l.visitedAt)} · {l.durationMin} Min
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Market Detail Drawer ───────────────────────────────────────

function MarketDetailDrawer({
  market,
  visits,
  currentRedPeriod,
  onClose,
  onSave,
  onUniverseMarketChange,
  universeMarketSaving,
  loadKuehlerUnits,
  onCreateKuehlerUnit,
  onUpdateKuehlerUnit,
}: {
  market: MarketRecord; visits: MarketVisitLog[];
  currentRedPeriod: { start: string; end: string } | null;
  onClose: () => void; onSave: (updated: MarketRecord) => Promise<void> | void;
  onUniverseMarketChange: (marketId: string, value: boolean) => Promise<void> | void;
  universeMarketSaving: boolean;
  loadKuehlerUnits: (marketId: string) => Promise<KuehlerUnitRecord[]>;
  onCreateKuehlerUnit: (
    input: {
      marketId: string;
      name?: string;
      employee?: string;
      kuehlerInternalId?: string | null;
      kuehlerBd?: string | null;
      kuehlerAnzahlKsAmStandort?: number | null;
      kuehlerSerialNumber?: string | null;
      kuehlerModel?: string | null;
      importSourceFileName?: string;
      importedAt?: string;
    },
  ) => Promise<KuehlerUnitRecord>;
  onUpdateKuehlerUnit: (
    input: {
      marketId: string;
      unitId: string;
      name?: string;
      employee?: string;
      kuehlerInternalId?: string | null;
      kuehlerBd?: string | null;
      kuehlerAnzahlKsAmStandort?: number | null;
      kuehlerSerialNumber?: string | null;
      kuehlerModel?: string | null;
      importSourceFileName?: string;
      importedAt?: string;
      isDeleted?: boolean;
    },
  ) => Promise<KuehlerUnitRecord>;
}) {
  const [tab, setTab] = useState<"info" | "besuche">("info");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MarketRecord>(market);
  const [saving, setSaving] = useState(false);
  const [kuehlerUnits, setKuehlerUnits] = useState<KuehlerUnitRecord[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitEditorId, setUnitEditorId] = useState<string | "new" | null>(null);
  const [unitEditorDraft, setUnitEditorDraft] = useState<{
    name: string;
    employee: string;
    kuehlerInternalId: string;
    kuehlerBd: string;
    kuehlerAnzahlKsAmStandort: string;
    kuehlerSerialNumber: string;
    kuehlerModel: string;
  }>({
    name: "",
    employee: "",
    kuehlerInternalId: "",
    kuehlerBd: "",
    kuehlerAnzahlKsAmStandort: "",
    kuehlerSerialNumber: "",
    kuehlerModel: "",
  });
  const [unitSaving, setUnitSaving] = useState(false);

  useEffect(() => { setDraft(market); setEditing(false); }, [market.id]);
  useEffect(() => {
    setDraft((current) => ({ ...current, universeMarket: market.universeMarket }));
  }, [market.universeMarket]);

  const redPeriodStart = useMemo(() => {
    if (!currentRedPeriod) return null;
    return new Date(`${currentRedPeriod.start}T00:00:00`);
  }, [currentRedPeriod]);
  const redPeriodEnd = useMemo(() => {
    if (!currentRedPeriod) return null;
    return new Date(`${currentRedPeriod.end}T23:59:59`);
  }, [currentRedPeriod]);
  const marketVisits = [...visits].filter(v => v.marketId === market.id).sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
  const visitedInRedMonat =
    redPeriodStart && redPeriodEnd
      ? marketVisits.some((visit) => {
          const visitedAt = new Date(visit.visitedAt);
          return visitedAt >= redPeriodStart && visitedAt <= redPeriodEnd;
        })
      : false;
  const visitCount = marketVisits.length;
  const ci = chainInitials(market.name);
  const hasKuehlerDataset = market.marketType === "kuehler" || market.marketType === "both";
  const promotionStammnr = (market.kuehlerStammnr || market.cokeMasterNumber || "").trim();
  const showKuehlerUnitSection = hasKuehlerDataset || unitEditorId === "new" || unitsError !== null;
  const marketTypeMeta =
    market.marketType === "both"
      ? { label: "Beides", color: "#7c3aed", bg: "rgba(124,58,237,0.1)" }
      : market.marketType === "kuehler"
        ? { label: "Kühler", color: "#d97706", bg: "rgba(217,119,6,0.12)" }
        : { label: "Universum", color: "#0891b2", bg: "rgba(8,145,178,0.1)" };

  const set = (patch: Partial<MarketRecord>) => setDraft(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    let cancelled = false;
    if (!hasKuehlerDataset) {
      setKuehlerUnits([]);
      setUnitsError(null);
      setUnitsLoading(false);
      return;
    }
    setUnitsLoading(true);
    setUnitsError(null);
    void loadKuehlerUnits(market.id)
      .then((rows) => {
        if (cancelled) return;
        setKuehlerUnits(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setUnitsError(err instanceof Error ? err.message : "Kühlerdaten konnten nicht geladen werden.");
        setKuehlerUnits([]);
      })
      .finally(() => {
        if (!cancelled) setUnitsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasKuehlerDataset, loadKuehlerUnits, market.id]);

  const startUnitEdit = useCallback((unit?: KuehlerUnitRecord) => {
    if (!unit) {
      setUnitEditorId("new");
      setUnitEditorDraft({
        name: market.name,
        employee: market.employee,
        kuehlerInternalId: "",
        kuehlerBd: "",
        kuehlerAnzahlKsAmStandort: "",
        kuehlerSerialNumber: "",
        kuehlerModel: "",
      });
      return;
    }
    setUnitEditorId(unit.id);
    setUnitEditorDraft({
      name: unit.name ?? "",
      employee: unit.employee ?? "",
      kuehlerInternalId: unit.kuehlerInternalId ?? "",
      kuehlerBd: unit.kuehlerBd ?? "",
      kuehlerAnzahlKsAmStandort:
        unit.kuehlerAnzahlKsAmStandort == null ? "" : String(unit.kuehlerAnzahlKsAmStandort),
      kuehlerSerialNumber: unit.kuehlerSerialNumber ?? "",
      kuehlerModel: unit.kuehlerModel ?? "",
    });
  }, [market.employee, market.name]);

  const handleSaveUnit = useCallback(async () => {
    if (!unitEditorId || unitSaving) return;
    setUnitSaving(true);
    setUnitsError(null);
    try {
      if (unitEditorId === "new") {
        const created = await onCreateKuehlerUnit({
          marketId: market.id,
          name: unitEditorDraft.name.trim(),
          employee: unitEditorDraft.employee.trim(),
          kuehlerInternalId: unitEditorDraft.kuehlerInternalId.trim() || null,
          kuehlerBd: unitEditorDraft.kuehlerBd.trim() || null,
          kuehlerAnzahlKsAmStandort: unitEditorDraft.kuehlerAnzahlKsAmStandort.trim()
            ? (parseInt(unitEditorDraft.kuehlerAnzahlKsAmStandort, 10) || 0)
            : null,
          kuehlerSerialNumber: unitEditorDraft.kuehlerSerialNumber.trim() || null,
          kuehlerModel: unitEditorDraft.kuehlerModel.trim() || null,
          importSourceFileName: market.importSourceFileName || "",
          importedAt: new Date().toISOString(),
        });
        setKuehlerUnits((prev) => [created, ...prev]);
        if (!hasKuehlerDataset && promotionStammnr) {
          await onSave({
            ...market,
            marketType: "both",
            universeMarket: true,
            kuehlerStammnr: promotionStammnr,
            cokeMasterNumber: market.cokeMasterNumber || promotionStammnr,
          });
        }
      } else {
        const updated = await onUpdateKuehlerUnit({
          marketId: market.id,
          unitId: unitEditorId,
          name: unitEditorDraft.name.trim(),
          employee: unitEditorDraft.employee.trim(),
          kuehlerInternalId: unitEditorDraft.kuehlerInternalId.trim() || null,
          kuehlerBd: unitEditorDraft.kuehlerBd.trim() || null,
          kuehlerAnzahlKsAmStandort: unitEditorDraft.kuehlerAnzahlKsAmStandort.trim()
            ? (parseInt(unitEditorDraft.kuehlerAnzahlKsAmStandort, 10) || 0)
            : null,
          kuehlerSerialNumber: unitEditorDraft.kuehlerSerialNumber.trim() || null,
          kuehlerModel: unitEditorDraft.kuehlerModel.trim() || null,
        });
        setKuehlerUnits((prev) => prev.map((unit) => (unit.id === updated.id ? updated : unit)));
      }
      setUnitEditorId(null);
    } catch (err) {
      setUnitsError(err instanceof Error ? err.message : "Kühlerdaten konnten nicht gespeichert werden.");
    } finally {
      setUnitSaving(false);
    }
  }, [
    market.id,
    market.importSourceFileName,
    market,
    onCreateKuehlerUnit,
    onUpdateKuehlerUnit,
    onSave,
    promotionStammnr,
    hasKuehlerDataset,
    unitEditorDraft.employee,
    unitEditorDraft.kuehlerAnzahlKsAmStandort,
    unitEditorDraft.kuehlerBd,
    unitEditorDraft.kuehlerInternalId,
    unitEditorDraft.kuehlerModel,
    unitEditorDraft.kuehlerSerialNumber,
    unitEditorDraft.name,
    unitEditorId,
    unitSaving,
  ]);

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 440, zIndex: 800, display: "flex", flexDirection: "column", background: "#f5f5f7", boxShadow: "-6px 0 32px rgba(0,0,0,0.12), -1px 0 0 rgba(0,0,0,0.06)", animation: "drawerIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "16px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: ci.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: ci.text }}>
            {market.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 2 }}>{market.name}</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{market.address} · {market.postalCode} {market.city}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)", flexShrink: 0, transition: "background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: marketTypeMeta.bg, color: marketTypeMeta.color, letterSpacing: "0.01em" }}>
            {marketTypeMeta.label}
          </span>
          {[market.region, market.emEh].filter(Boolean).map(b => (
            <span key={b} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)", letterSpacing: "0.01em" }}>{b}</span>
          ))}
          {market.infoFlag && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(220,38,38,0.08)", color: R, letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: R, display: "inline-block" }} />Info</span>}
        </div>

        {/* Assignment + frequency row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
            Verplant an: <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{market.currentGmName}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 1 }}>IPP</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{market.ipp != null ? market.ipp.toFixed(1) : "—"}</span>
            </div>
            <FrequencyCircle visited={visitCount} frequency={market.visitFrequencyPerYear} visitedThisMonth={visitedInRedMonat} size={34} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 18px", display: "flex", gap: 0, flexShrink: 0 }}>
        {(["info", "besuche"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px 10px", fontSize: 11, fontWeight: tab === t ? 700 : 500, color: tab === t ? R : "rgba(0,0,0,0.45)", border: "none", background: "none", cursor: "pointer", borderBottom: tab === t ? `2px solid ${R}` : "2px solid transparent", transition: "all 0.12s", fontFamily: "inherit", letterSpacing: "-0.01em" }}>
            {t === "info" ? "Marktinfo" : "Marktbesuche"}
            {t === "besuche" && marketVisits.length > 0 && <span style={{ marginLeft: 5, fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: tab === "besuche" ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.07)", color: tab === "besuche" ? R : "rgba(0,0,0,0.38)" }}>{new Set(marketVisits.map(v => `${new Date(v.visitedAt).toDateString()}__${v.gmName}`)).size}</span>}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "info" && (
          <>
            {(market.infoNote || editing) && (
              <>
                <InfoSection label="Info">
                  {editing ? (
                    <textarea value={draft.infoNote} onChange={e => set({ infoNote: e.target.value })} placeholder="Notiz zum Markt..."
                      style={{ fontSize: 11, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", outline: "none", resize: "vertical", minHeight: 72, background: "#fff", fontFamily: "inherit", lineHeight: 1.5, width: "100%", boxSizing: "border-box" }} />
                  ) : (
                    <p style={{ fontSize: 11, color: "#1a1a1a", margin: 0, lineHeight: 1.6 }}>
                      {market.infoNote}
                    </p>
                  )}
                </InfoSection>
                <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
              </>
            )}

            <>
              <InfoSection label="Identität">
                <InfoRow label="Name" value={market.name} edit={editing} editValue={draft.name} onEdit={v => set({ name: v })} />
                <InfoRow label="Name f. DB" value={market.dbName} edit={editing} editValue={draft.dbName} onEdit={v => set({ dbName: v })} />
                <InfoRow label="Flex-Nummer" value={market.flexNumber} edit={editing} editValue={draft.flexNumber} onEdit={v => set({ flexNumber: v })} />
                {hasKuehlerDataset ? (
                  <InfoRow
                    label="Stammnr."
                    value={market.kuehlerStammnr || market.cokeMasterNumber}
                    edit={editing}
                    editValue={draft.kuehlerStammnr || draft.cokeMasterNumber}
                    onEdit={v => set({ kuehlerStammnr: v, cokeMasterNumber: v })}
                  />
                ) : (
                  <InfoRow label="Stammnr. Coke" value={market.cokeMasterNumber} edit={editing} editValue={draft.cokeMasterNumber} onEdit={v => set({ cokeMasterNumber: v })} />
                )}
                <InfoRow label="Standardmarkt Nr" value={market.standardMarketNumber} edit={editing} editValue={draft.standardMarketNumber} onEdit={v => set({ standardMarketNumber: v })} />
                {editing && (
                  <div style={{ marginTop: 4, fontSize: 9, lineHeight: 1.45, color: "rgba(0,0,0,0.42)" }}>
                    Identitätsnummern werden zentral geändert. Kampagnen, Besuche und Auswertungen bleiben über die Markt-ID verbunden.
                  </div>
                )}
              </InfoSection>

              <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

              <InfoSection label="Standort">
                <InfoRow label="Adresse" value={market.address} edit={editing} editValue={draft.address} onEdit={v => set({ address: v })} />
                <InfoRow label="Postleitzahl" value={market.postalCode} edit={editing} editValue={draft.postalCode} onEdit={v => set({ postalCode: v })} />
                <InfoRow label="Ort" value={market.city} edit={editing} editValue={draft.city} onEdit={v => set({ city: v })} />
                <InfoRow label="Region" value={market.region} edit={editing} editValue={draft.region} onEdit={v => set({ region: v })} />
              </InfoSection>

              <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

              <InfoSection label="Zuordnung & Klassifikation">
                <InfoRow label="EM/EH" value={market.emEh} edit={editing} editValue={draft.emEh} onEdit={v => set({ emEh: v })} />
                <InfoRow label="Mitarbeiter" value={market.employee} edit={editing} editValue={draft.employee} onEdit={v => set({ employee: v })} />
                <InfoRow label="Aktuell verplant an" value={market.currentGmName} edit={editing} editValue={draft.currentGmName} onEdit={v => set({ currentGmName: v })} />
                <InfoRow label="Markt-Typ" value={marketTypeMeta.label} />
                {!hasKuehlerDataset && (
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>Kühler</span>
                    <button
                      onClick={() => {
                        if (!promotionStammnr) {
                          setUnitsError("Bitte zuerst eine Stammnr. am Markt speichern, dann kann ein Kühler angelegt werden.");
                          return;
                        }
                        setUnitsError(null);
                        startUnitEdit();
                      }}
                      style={{ justifySelf: "start", fontSize: 10, fontWeight: 650, padding: "5px 9px", borderRadius: 7, border: "1px solid rgba(217,119,6,0.18)", background: "rgba(245,158,11,0.06)", color: "#92400e", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Kühler hinzufügen
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>Status</span>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => set({ isActive: !draft.isActive })}
                        style={{
                          width: 32,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: draft.isActive ? "#DC2626" : "rgba(0,0,0,0.12)",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "background-color 0.2s ease",
                          flexShrink: 0,
                        }}
                        aria-label="Marktstatus umschalten"
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            backgroundColor: "#fff",
                            position: "absolute",
                            top: 2,
                            left: draft.isActive ? 16 : 2,
                            transition: "left 0.2s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 11, fontWeight: 600, color: draft.isActive ? "#166534" : R }}>
                        {draft.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: market.isActive ? "#166534" : R }}>
                      {market.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>Universumsmarkt</span>
                  <div style={{ width: 104 }}>
                    <UniverseMarketDropdown
                      value={market.universeMarket}
                      disabled={universeMarketSaving}
                      saving={universeMarketSaving}
                      onChange={(value) => void onUniverseMarketChange(market.id, value)}
                    />
                  </div>
                </div>
                <InfoRow label="Besuchsfrequenz / Jahr" value={String(market.visitFrequencyPerYear)} edit={editing} editValue={String(draft.visitFrequencyPerYear)} onEdit={v => set({ visitFrequencyPerYear: parseInt(v, 10) || market.visitFrequencyPerYear })} />
              </InfoSection>

              {showKuehlerUnitSection && (
                <>
                  <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
                  <InfoSection label="Kühler Geräte">
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                      <button
                        onClick={() => startUnitEdit()}
                        style={{ fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", cursor: "pointer" }}
                      >
                        Kühler hinzufügen
                      </button>
                    </div>
                    {unitsLoading && <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Kühlerdaten werden geladen...</span>}
                    {!unitsLoading && unitsError && <span style={{ fontSize: 10, color: "#b91c1c" }}>{unitsError}</span>}
                    {!unitsLoading && !unitsError && kuehlerUnits.length === 0 && (
                      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Keine Kühler-Einträge vorhanden.</span>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(unitEditorId === "new" ? ([{ id: "new" }] as Array<{ id: string }>) : []).concat(kuehlerUnits).map((unitLike) => {
                        const isNew = unitLike.id === "new";
                        const unit = isNew ? null : (unitLike as KuehlerUnitRecord);
                        const isEditingUnit = unitEditorId === (isNew ? "new" : unit?.id);
                        return (
                          <div key={unitLike.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: 8 }}>
                            {isEditingUnit ? (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                <input value={unitEditorDraft.kuehlerInternalId} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, kuehlerInternalId: e.target.value }))} placeholder="internal_id" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <input value={unitEditorDraft.kuehlerSerialNumber} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, kuehlerSerialNumber: e.target.value }))} placeholder="Serial Number" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <input value={unitEditorDraft.kuehlerModel} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, kuehlerModel: e.target.value }))} placeholder="Model" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <input value={unitEditorDraft.kuehlerBd} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, kuehlerBd: e.target.value }))} placeholder="BD" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <input value={unitEditorDraft.kuehlerAnzahlKsAmStandort} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, kuehlerAnzahlKsAmStandort: e.target.value }))} placeholder="Anzahl KS" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <input value={unitEditorDraft.employee} onChange={(e) => setUnitEditorDraft((prev) => ({ ...prev, employee: e.target.value }))} placeholder="Mitarbeiter" style={{ fontSize: 10, padding: "5px 7px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6 }} />
                                <div style={{ gridColumn: "1 / span 2", display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                                  <button onClick={() => setUnitEditorId(null)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", cursor: "pointer" }}>Abbrechen</button>
                                  <button onClick={() => void handleSaveUnit()} disabled={unitSaving} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "none", background: `linear-gradient(to bottom,${R},${RD})`, color: "#fff", cursor: unitSaving ? "not-allowed" : "pointer" }}>{unitSaving ? "Speichern..." : "Speichern"}</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a" }}>{unit?.kuehlerInternalId || "ohne internal_id"}</div>
                                  <div style={{ fontSize: 9, color: "rgba(0,0,0,0.5)" }}>
                                    {unit?.kuehlerModel || "—"} · {unit?.kuehlerSerialNumber || "—"} · BD {unit?.kuehlerBd || "—"} · KS {unit?.kuehlerAnzahlKsAmStandort == null ? "—" : unit.kuehlerAnzahlKsAmStandort}
                                  </div>
                                </div>
                                <button onClick={() => unit && startUnitEdit(unit)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", cursor: "pointer" }}>Bearbeiten</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </InfoSection>
                </>
              )}
            </>

            {editing && (
              <>
                <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />
                <InfoSection label="Info">
                  <textarea value={draft.infoNote} onChange={e => set({ infoNote: e.target.value })} placeholder="Notiz zum Markt..."
                    style={{ fontSize: 11, color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", outline: "none", resize: "vertical", minHeight: 72, background: "#fff", fontFamily: "inherit", lineHeight: 1.5, width: "100%", boxSizing: "border-box" }} />
                </InfoSection>
              </>
            )}
          </>
        )}

        {tab === "besuche" && (() => {
          // Group by date + GM into visit sessions
          const groups = new Map<string, MarketVisitLog[]>();
          marketVisits.forEach(v => {
            const key = `${new Date(v.visitedAt).toDateString()}__${v.gmName}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(v);
          });
          const sessions = [...groups.values()].sort((a, b) =>
            new Date(b[0].visitedAt).getTime() - new Date(a[0].visitedAt).getTime()
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(0,0,0,0.28)", fontSize: 11 }}>Noch keine Besuche aufgezeichnet.</div>
              ) : sessions.map((logs, i) => (
                <VisitCard key={i} logs={logs} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Edit action footer */}
      {tab === "info" && (
        <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 18px", flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => { setDraft(market); setEditing(false); }}
                style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                <RotateCcw size={11} strokeWidth={2} /> Abbrechen
              </button>
              <button onClick={async () => {
                if (saving) return;
                setSaving(true);
                try {
                  await onSave(draft);
                  setEditing(false);
                } catch {
                  // The page-level save handler renders the backend error and keeps this editor open.
                } finally {
                  setSaving(false);
                }
              }}
                disabled={saving}
                style={{ padding: "7px 16px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                <Save size={11} strokeWidth={2} /> {saving ? "Speichern..." : "Speichern"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", transition: "opacity 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
              <Edit2 size={11} strokeWidth={2} /> Bearbeiten
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function MaerktePage() {
  const { current: currentRedMonth } = useRedMonth();
  const [markets, setMarkets] = useState<MarketRecord[]>([]);
  const [visits,  setVisits]  = useState<MarketVisitLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 120);
    return () => clearTimeout(t);
  }, [search]);
  const [filters, setFilters] = useState<MarketFilters>({
    region: null, city: null, postalCode: null, emEh: null, dbName: [], employee: null,
    universeMarket: null, kuehlerMarket: null, infoFlag: null, currentGmName: null,
    redMonatVisited: null, frequencyBucket: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingUniverseMarketId, setSavingUniverseMarketId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingMarkets, setIsExportingMarkets] = useState(false);
  const [isNormalizingRegions, setIsNormalizingRegions] = useState(false);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  const [normalizeSummary, setNormalizeSummary] = useState<NormalizeMarketRegionsResult | null>(null);
  const [marketContextMenu, setMarketContextMenu] = useState<MarketContextMenuState | null>(null);
  const [deleteTargetMarketId, setDeleteTargetMarketId] = useState<string | null>(null);
  const [isDeletingMarket, setIsDeletingMarket] = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const marketContextMenuRef = useRef<HTMLDivElement | null>(null);

  const reloadMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    setLoadError(null);
    try {
      const rows = await fetchMarkets();
      setMarkets(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Märkte konnten nicht geladen werden.";
      setLoadError(message);
      setMarkets([]);
    } finally {
      setIsLoadingMarkets(false);
    }
  }, []);

  const handleImport = useCallback(async (payload: {
    importType: ImportDatasetType;
    allowMissingCokeMasterNumber?: boolean;
    fileName: string;
    sheetName: string;
    rows: string[][];
    mapping: ColumnMapping;
  }) => {
    setImportError(null);
    try {
      const result = await importMarkets(payload);
      setMarkets(result.markets);
      window.dispatchEvent(new CustomEvent("maerkte:imported", { detail: { count: result.summary.created + result.summary.updated } }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import fehlgeschlagen.";
      setImportError(message);
      throw new Error(message);
    }
  }, []);

  const handleSave = useCallback(async (updated: MarketRecord) => {
    setSaveError(null);
    try {
      const saved = await updateMarket(updated);
      setMarkets((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Markt konnte nicht gespeichert werden.");
      throw err;
    }
  }, []);

  const handleUniverseMarketChange = useCallback(async (marketId: string, universeMarket: boolean) => {
    if (savingUniverseMarketId) return;
    setSaveError(null);
    setSavingUniverseMarketId(marketId);
    try {
      const saved = await updateMarketUniverseMarket(marketId, universeMarket);
      setMarkets((prev) => prev.map((market) => market.id === saved.id ? { ...market, universeMarket: saved.universeMarket } : market));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Universumsmarkt konnte nicht gespeichert werden.");
    } finally {
      setSavingUniverseMarketId(null);
    }
  }, [savingUniverseMarketId]);

  const handleLoadKuehlerUnits = useCallback(async (marketId: string) => {
    return fetchMarketKuehlerUnits(marketId);
  }, []);

  const handleCreateKuehlerUnit = useCallback(async (input: {
    marketId: string;
    name?: string;
    employee?: string;
    kuehlerInternalId?: string | null;
    kuehlerBd?: string | null;
    kuehlerAnzahlKsAmStandort?: number | null;
    kuehlerSerialNumber?: string | null;
    kuehlerModel?: string | null;
    importSourceFileName?: string;
    importedAt?: string;
  }) => {
    return createMarketKuehlerUnit(input);
  }, []);

  const handleUpdateKuehlerUnit = useCallback(async (input: {
    marketId: string;
    unitId: string;
    name?: string;
    employee?: string;
    kuehlerInternalId?: string | null;
    kuehlerBd?: string | null;
    kuehlerAnzahlKsAmStandort?: number | null;
    kuehlerSerialNumber?: string | null;
    kuehlerModel?: string | null;
    importSourceFileName?: string;
    importedAt?: string;
    isDeleted?: boolean;
  }) => {
    return updateMarketKuehlerUnit(input);
  }, []);

  const handleSaveFixedRow = useCallback(async (market: MarketRecord) => {
    setImportError(null);
    try {
      const created = await createMarket(market);
      setMarkets((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Markt konnte nicht angelegt werden.";
      setImportError(message);
      throw new Error(message);
    }
  }, []);

  const handleCreateManualMarket = useCallback(async (input: ManualMarketCreateInput) => {
    setSaveError(null);
    try {
      const created = await createMarket(input.market);
      let nextMarket = created;
      if (input.kuehlerUnit) {
        await createMarketKuehlerUnit({
          ...input.kuehlerUnit,
          marketId: created.id,
        });
        const stammnr = created.kuehlerStammnr || created.cokeMasterNumber;
        nextMarket = {
          ...created,
          marketType: created.marketType === "universum" ? "both" : created.marketType,
          universeMarket: created.marketType !== "kuehler",
          kuehlerStammnr: stammnr,
          cokeMasterNumber: created.cokeMasterNumber || stammnr,
        };
      }
      setMarkets((prev) => [nextMarket, ...prev.filter((market) => market.id !== nextMarket.id)]);
      setSelectedId(nextMarket.id);
      void reloadMarkets();
      return nextMarket;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Markt konnte nicht angelegt werden.";
      setSaveError(message);
      throw new Error(message);
    }
  }, [reloadMarkets]);

  const handleNormalizeRegions = useCallback(async () => {
    if (isNormalizingRegions) return;
    const confirmed = typeof window !== "undefined"
      ? window.confirm("Alle bestehenden Markt-Regionen jetzt normalisieren?")
      : false;
    if (!confirmed) return;
    setNormalizeError(null);
    setNormalizeSummary(null);
    setIsNormalizingRegions(true);
    try {
      const result = await normalizeAllMarketRegions({ batchSize: 500, reportLimit: 200 });
      setNormalizeSummary(result);
      await reloadMarkets();
    } catch (err) {
      setNormalizeError(err instanceof Error ? err.message : "Regionen konnten nicht normalisiert werden.");
    } finally {
      setIsNormalizingRegions(false);
    }
  }, [isNormalizingRegions, reloadMarkets]);

  const closeMarketContextMenu = useCallback(() => {
    setMarketContextMenu(null);
  }, []);

  const handleOpenMarketContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, marketId: string) => {
      const MENU_W = 190;
      const MENU_H = 54;
      const GAP = 8;
      const maxX = Math.max(GAP, window.innerWidth - MENU_W - GAP);
      const maxY = Math.max(GAP, window.innerHeight - MENU_H - GAP);
      setMarketContextMenu({
        marketId,
        x: Math.min(Math.max(event.clientX, GAP), maxX),
        y: Math.min(Math.max(event.clientY, GAP), maxY),
      });
    },
    [],
  );

  const handleOpenDeleteDialog = useCallback(
    (marketId: string) => {
      setDeleteError(null);
      setDeleteTargetMarketId(marketId);
      closeMarketContextMenu();
    },
    [closeMarketContextMenu],
  );

  const handleDeleteMarket = useCallback(
    async (mode: "soft" | "hard") => {
      if (!deleteTargetMarketId || isDeletingMarket) return;
      setDeleteError(null);
      setIsDeletingMarket(true);
      try {
        if (mode === "hard") {
          await hardDeleteMarket(deleteTargetMarketId);
        } else {
          await softDeleteMarket(deleteTargetMarketId);
        }
        setMarkets((prev) => prev.filter((market) => market.id !== deleteTargetMarketId));
        setSelectedId((prev) => (prev === deleteTargetMarketId ? null : prev));
        setDeleteTargetMarketId(null);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Markt konnte nicht gelöscht werden.");
      } finally {
        setIsDeletingMarket(false);
      }
    },
    [deleteTargetMarketId, isDeletingMarket],
  );

  useEffect(() => {
    if (!marketContextMenu) return;
    const close = () => setMarketContextMenu(null);
    const onPointerDown = (event: MouseEvent) => {
      if (marketContextMenuRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onEscape);
    };
  }, [marketContextMenu]);

  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    void reloadMarkets();
    try {
      const scopedKey = getVisitsStorageKey();
      const scoped = localStorage.getItem(scopedKey);
      const legacy = scoped ? null : localStorage.getItem(LS_VISITS_LEGACY);
      if (!scoped && legacy) {
        localStorage.setItem(scopedKey, legacy);
        localStorage.removeItem(LS_VISITS_LEGACY);
      }
      const storedV = scoped ?? legacy;
      setVisits(storedV ? JSON.parse(storedV) : []);
    } catch { /* start empty */ }
    // Listen for page header actions
    const handler = () => setShowImport(true);
    const manualCreateHandler = () => setShowManualCreate(true);
    const normalizeHandler = () => { void handleNormalizeRegions(); };
    window.addEventListener("maerkte:openImport", handler);
    window.addEventListener("maerkte:openManualCreate", manualCreateHandler);
    window.addEventListener("maerkte:normalizeRegions", normalizeHandler);
    return () => {
      window.removeEventListener("maerkte:openImport", handler);
      window.removeEventListener("maerkte:openManualCreate", manualCreateHandler);
      window.removeEventListener("maerkte:normalizeRegions", normalizeHandler);
    };
  }, [handleNormalizeRegions, reloadMarkets]);

  // ── Derived filter options ─────────────────────────────────
  const opts = useMemo(() => ({
    region:   [...new Set(markets.map(m => m.region))].sort(),
    city:     [...new Set(markets.map(m => m.city))].sort(),
    postalCode:[...new Set(markets.map(m => m.postalCode))].sort(),
    emEh:     [...new Set(markets.map(m => m.emEh))].sort(),
    dbName:   [...new Set(markets.map(m => m.dbName).filter(Boolean))].sort(),
    employee: [...new Set(markets.map(m => m.employee))].sort(),
    gmName:   [...new Set(markets.map(m => m.currentGmName))].sort(),
  }), [markets]);

  // ── RED Monat state ────────────────────────────────────────
  const visitedInRedMonatSet = useMemo(() => {
    if (!currentRedMonth) return new Set<string>();
    const start = new Date(`${currentRedMonth.start}T00:00:00`);
    const end = new Date(`${currentRedMonth.end}T23:59:59`);
    return new Set(
      visits
        .filter((visit) => {
          const visitedAt = new Date(visit.visitedAt);
          return visitedAt >= start && visitedAt <= end;
        })
        .map((visit) => visit.marketId),
    );
  }, [currentRedMonth, visits]);

  const visitCountByMarket = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach(v => { counts[v.marketId] = (counts[v.marketId] ?? 0) + 1; });
    return counts;
  }, [visits]);

  // ── Filtering ──────────────────────────────────────────────
  const marketSearchBlobById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const market of markets) {
      byId.set(market.id, buildMarketSearchBlob(market));
    }
    return byId;
  }, [markets]);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(debouncedSearch);
    const filteredMarkets = markets.filter(m => {
      if (q) {
        const hay = marketSearchBlobById.get(m.id) ?? "";
        if (!hay.includes(q)) return false;
      }
      if (filters.region && m.region !== filters.region) return false;
      if (filters.city && m.city !== filters.city) return false;
      if (filters.postalCode && m.postalCode !== filters.postalCode) return false;
      if (filters.emEh && m.emEh !== filters.emEh) return false;
      if (filters.dbName.length > 0 && !filters.dbName.includes(m.dbName)) return false;
      if (filters.employee && m.employee !== filters.employee) return false;
      if (filters.currentGmName && m.currentGmName !== filters.currentGmName) return false;
      if (filters.universeMarket) {
        if (filters.universeMarket === "Ja" && m.universeMarket !== true) return false;
        if (filters.universeMarket === "Nein" && m.universeMarket !== false) return false;
      }
      if (filters.kuehlerMarket) {
        if (filters.kuehlerMarket === "Ja" && m.marketType === "universum") return false;
        if (filters.kuehlerMarket === "Nein" && m.marketType !== "universum") return false;
      }
      if (filters.infoFlag) {
        if (filters.infoFlag === "Ja" && !m.infoFlag) return false;
        if (filters.infoFlag === "Nein" && m.infoFlag) return false;
      }
      if (filters.redMonatVisited) {
        const vis = visitedInRedMonatSet.has(m.id);
        if (filters.redMonatVisited === "Alle" && !m.universeMarket) return false;
        if (filters.redMonatVisited === "Besucht" && !vis) return false;
        if (filters.redMonatVisited === "Nicht besucht" && vis) return false;
      }
      if (filters.frequencyBucket) {
        const freq = m.visitFrequencyPerYear;
        if (filters.frequencyBucket === "4" && freq !== 4) return false;
        if (filters.frequencyBucket === "6" && freq !== 6) return false;
        if (filters.frequencyBucket === "12" && freq !== 12) return false;
        if (filters.frequencyBucket === "Sonstige" && [4, 6, 12].includes(freq)) return false;
      }
      return true;
    });
    const activeMarkets = filteredMarkets.filter((market) => market.isActive);
    const inactiveMarkets = filteredMarkets.filter((market) => !market.isActive);
    return [...activeMarkets, ...inactiveMarkets];
  }, [markets, debouncedSearch, filters, marketSearchBlobById, visitedInRedMonatSet]);

  const activeFilterCount = Object.values(filters).filter(isMarketFilterValueActive).length;
  const hasFilters = !!search.trim() || activeFilterCount > 0;
  const selectedMarket = useMemo(() => markets.find(m => m.id === selectedId) ?? null, [markets, selectedId]);
  const contextMenuMarket = useMemo(
    () => markets.find((market) => market.id === marketContextMenu?.marketId) ?? null,
    [marketContextMenu?.marketId, markets],
  );
  const deleteTargetMarket = useMemo(
    () => markets.find((market) => market.id === deleteTargetMarketId) ?? null,
    [deleteTargetMarketId, markets],
  );

  // Stable select handler — passed into memoized rows so they don't re-render on unrelated state changes
  const handleSelectMarket = useCallback((id: string | null) => setSelectedId(id), []);

  const handleExportMarkets = useCallback(async () => {
    if (isExportingMarkets) return;
    setExportError(null);
    setIsExportingMarkets(true);
    try {
      const marketIds = new Set(filtered.map((market) => market.id));
      await exportMarketsExcel({
        markets: filtered,
        visits: visits.filter((visit) => marketIds.has(visit.marketId)),
        allMarketCount: markets.length,
        filterLabel: hasFilters ? "Gefilterte Ansicht" : "Alle Märkte",
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExportingMarkets(false);
    }
  }, [filtered, hasFilters, isExportingMarkets, markets.length, visits]);

  useEffect(() => {
    const handler = () => { void handleExportMarkets(); };
    window.addEventListener("admin:maerkte:export", handler);
    return () => window.removeEventListener("admin:maerkte:export", handler);
  }, [handleExportMarkets]);

  // ── Filter chip helper ─────────────────────────────────────
  function FilterBtn({ label, filterKey, opts: options, inactiveLabel, nullLabel }: { label: string; filterKey: keyof MarketFilters; opts: string[]; inactiveLabel?: string; nullLabel?: string }) {
    const active = !!filters[filterKey];
    const val = filters[filterKey] as string | null;
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={btnRef} onClick={() => setOpenFilter(openFilter === filterKey ? null : filterKey)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: active ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(0,0,0,0.08)", background: active ? "rgba(220,38,38,0.04)" : "#fff", color: active ? R : "rgba(0,0,0,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", whiteSpace: "nowrap" }}>
          {label}
          <ChevronDown size={10} strokeWidth={2} style={{ transform: openFilter === filterKey ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </button>
        {openFilter === filterKey && (
          <FilterDropdown options={options} value={val} anchorRef={btnRef} nullLabel={nullLabel}
            onChange={v => setFilters(prev => ({ ...prev, [filterKey]: v }))}
            onClose={() => setOpenFilter(null)} />
        )}
      </>
    );
  }

  function HandelskettenFilterBtn({ options }: { options: string[] }) {
    const active = filters.dbName.length > 0;
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={btnRef} onClick={() => setOpenFilter(openFilter === "dbName" ? null : "dbName")}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: active ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(0,0,0,0.08)", background: active ? "rgba(220,38,38,0.04)" : "#fff", color: active ? R : "rgba(0,0,0,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", whiteSpace: "nowrap" }}>
          {active ? `Handelskette (${filters.dbName.length})` : "Handelskette"}
          <ChevronDown size={10} strokeWidth={2} style={{ transform: openFilter === "dbName" ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </button>
        {openFilter === "dbName" && (
          <MultiFilterDropdown options={options} value={filters.dbName} anchorRef={btnRef}
            onChange={v => setFilters(prev => ({ ...prev, dbName: v }))}
            onClose={() => setOpenFilter(null)} />
        )}
      </>
    );
  }

  if (!mounted) return null;

  if (isLoadingMarkets) {
    return <MaerktePageSkeleton />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      <style>{`
        @keyframes mktFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .mkt-main { animation: mktFadeIn 0.25s ease both; }
      `}</style>

      {/* Page action row — nothing shown */}
      <div />

      {/* Main list card — grey outer / white inner, same as Prämien */}
      <div className="mkt-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>

        {/* Grey header area */}
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Märkte</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
              {filtered.length !== markets.length ? `${filtered.length} / ` : ""}{markets.length} Märkte
            </span>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilters({ region: null, city: null, postalCode: null, emEh: null, dbName: [], employee: null, universeMarket: null, kuehlerMarket: null, infoFlag: null, currentGmName: null, redMonatVisited: null, frequencyBucket: null }); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.035)", cursor: "pointer", color: "rgba(0,0,0,0.4)", fontSize: 9, fontWeight: 600, fontFamily: "inherit", transition: "all 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; e.currentTarget.style.color = R; e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.035)"; e.currentTarget.style.color = "rgba(0,0,0,0.4)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; }}
              >
                <X size={9} strokeWidth={2.5} />
                Filter
              </button>
            )}
          </div>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

        {(loadError || saveError || deleteError || importError || exportError || normalizeError || normalizeSummary || isNormalizingRegions) && (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
            {loadError && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)" }}>
                <span style={{ fontSize: 10, color: R, fontWeight: 600 }}>Laden fehlgeschlagen: {loadError}</span>
                <button onClick={() => void reloadMarkets()} style={{ border: "none", cursor: "pointer", borderRadius: 6, padding: "5px 9px", fontSize: 10, fontWeight: 700, color: "#fff", background: `linear-gradient(to bottom,${R},${RD})` }}>
                  Erneut laden
                </button>
              </div>
            )}
            {saveError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Speichern fehlgeschlagen: {saveError}
              </div>
            )}
            {deleteError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Löschen fehlgeschlagen: {deleteError}
              </div>
            )}
            {importError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Import fehlgeschlagen: {importError}
              </div>
            )}
            {exportError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Export fehlgeschlagen: {exportError}
              </div>
            )}
            {isNormalizingRegions && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(8,145,178,0.06)", border: "1px solid rgba(8,145,178,0.14)", fontSize: 10, color: "#0e7490", fontWeight: 600 }}>
                Regionen werden normalisiert…
              </div>
            )}
            {normalizeError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Regionen-Normalisierung fehlgeschlagen: {normalizeError}
              </div>
            )}
            {normalizeSummary && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.14)", fontSize: 10, color: "#166534", fontWeight: 600, display: "flex", flexDirection: "column", gap: 4 }}>
                <span>
                  Regionen normalisiert: {normalizeSummary.updatedCount} aktualisiert, {normalizeSummary.unchangedCount} unverändert, {normalizeSummary.unmatchedCount} nicht zuordenbar.
                </span>
                {normalizeSummary.unmatched.length > 0 && (
                  <span style={{ color: "#92400e", fontWeight: 600 }}>
                    Nicht zuordenbar (erste {normalizeSummary.unmatched.length}):{" "}
                    {normalizeSummary.unmatched
                      .slice(0, 10)
                      .map((entry) => `${entry.marketName} [${entry.region || "leer"}]`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {markets.length === 0 ? (
          <div style={{ padding: "60px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={22} strokeWidth={1.5} color={R} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>Noch keine Märkte importiert</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 320, lineHeight: 1.6 }}>
                Klicke auf „Importieren" um Märkte aus einer Excel-Datei zu laden oder Testdaten zu verwenden.
              </div>
            </div>
            <button onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, border: "none", borderRadius: 8, cursor: "pointer", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` }}>
              <Upload size={11} strokeWidth={2} /> Importieren
            </button>
          </div>
        ) : (
          <>
            {/* Search left, filters right */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Search — left anchored */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 200px", transition: "border 0.15s" }}
                  onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
                  <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                  <input type="text" placeholder="Markt suchen…" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
                  {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex" }}><X size={10} strokeWidth={2} /></button>}
                </div>

                {/* Filters — pushed to right */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <FilterBtn label="Region" filterKey="region" opts={opts.region} />
                  <FilterBtn label="Ort" filterKey="city" opts={opts.city} />
                  <FilterBtn label="PLZ" filterKey="postalCode" opts={opts.postalCode} />
                  <FilterBtn label="EM/EH" filterKey="emEh" opts={["EM", "EH"]} />
                  <HandelskettenFilterBtn options={opts.dbName} />
                  <FilterBtn label="Mitarbeiter" filterKey="employee" opts={opts.employee} />
                  <FilterBtn label="GM" filterKey="currentGmName" opts={opts.gmName} />
                  <FilterBtn label="Universums-markt" filterKey="universeMarket" opts={["Ja", "Nein"]} />
                  <FilterBtn label="Kühler" filterKey="kuehlerMarket" opts={["Ja", "Nein"]} />
                  <FilterBtn label="Info" filterKey="infoFlag" opts={["Ja", "Nein"]} />
                  <FilterBtn label="RED Monat" inactiveLabel="Nicht aktiv" filterKey="redMonatVisited" opts={["Alle", "Besucht", "Nicht besucht"]} nullLabel="Nicht aktiv" />
                  <FilterBtn label="Frequenz" filterKey="frequencyBucket" opts={["4", "6", "12", "Sonstige"]} />

                </div>
              </div>

              {/* Active filter strip */}
              {activeFilterCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500, flexShrink: 0 }}>{filtered.length} / {markets.length} Märkte</span>
                  {(Object.entries(filters) as [keyof MarketFilters, MarketFilters[keyof MarketFilters]][]).filter(([, v]) => isMarketFilterValueActive(v)).map(([k, v]) => (
                    <button key={k} onClick={() => setFilters(prev => ({ ...prev, [k]: k === "dbName" ? [] : null }))}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, background: "rgba(220,38,38,0.07)", color: R, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      {formatMarketFilterValue(v)}<X size={7} strokeWidth={2.5} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column header */}
            <div style={{ display: "grid", gridTemplateColumns: MARKET_LIST_GRID, gap: MARKET_LIST_GAP, padding: "7px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {["Markt", "Stammnr", "Info", "Adresse", "Region", "PLZ", "Ort", "EM/EH", "Verplant an", "IPP", "Freq."].map((h, i) => (
                <span key={i} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span>
              ))}
            </div>

            {/* Rows — virtualized for large datasets */}
            <VirtualMarketList
              items={filtered}
              selectedId={selectedId}
              onSelect={handleSelectMarket}
              onOpenContextMenu={handleOpenMarketContextMenu}
              visitedSet={visitedInRedMonatSet}
              visitCounts={visitCountByMarket}
            />
          </>
        )}
        </div>{/* end white inner card */}
      </div>{/* end grey outer card */}

      {marketContextMenu && contextMenuMarket && createPortal(
        <div
          ref={marketContextMenuRef}
          style={{
            position: "fixed",
            top: marketContextMenu.y,
            left: marketContextMenu.x,
            zIndex: 9800,
            minWidth: 190,
            backgroundColor: "#fff",
            borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
            padding: 4,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => handleOpenDeleteDialog(contextMenuMarket.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              border: "none",
              borderRadius: 6,
              padding: "7px 10px",
              background: "none",
              textAlign: "left",
              fontSize: 11,
              fontWeight: 500,
              color: "#DC2626",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background-color 0.1s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
            Markt löschen…
          </button>
        </div>,
        document.body,
      )}

      {deleteTargetMarket && createPortal(
        <div
          onClick={() => {
            if (isDeletingMarket) return;
            setDeleteTargetMarketId(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9900,
            backgroundColor: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
              padding: "20px 20px 16px",
              width: 360,
              maxWidth: "90vw",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  backgroundColor: "rgba(220,38,38,0.07)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                  Markt löschen
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                  <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{deleteTargetMarket.name || "Unbenannter Markt"}</span>
                  {" "}wird entfernt.
                </div>
              </div>
            </div>
            <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                marginBottom: 14,
                backgroundColor: "rgba(220,38,38,0.05)",
                border: "1px solid rgba(220,38,38,0.12)",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626" }}>
                Soft Delete blendet aus. Hard Delete entfernt die DB-Zeile dauerhaft.
              </span>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button
                onClick={() => setDeleteTargetMarketId(null)}
                disabled={isDeletingMarket}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.4)",
                  cursor: isDeletingMarket ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s ease",
                  opacity: isDeletingMarket ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.opacity = "0.75";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.opacity = "1";
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => void handleDeleteMarket("soft")}
                disabled={isDeletingMarket}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom, #f97316, #ea580c)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c2410c, 0 1px 6px rgba(180,80,20,0.18)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: isDeletingMarket ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s ease",
                  opacity: isDeletingMarket ? 0.85 : 1,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.opacity = "0.88";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.opacity = "1";
                }}
              >
                {isDeletingMarket ? "Lösche…" : "Soft löschen"}
              </button>
              <button
                onClick={() => void handleDeleteMarket("hard")}
                disabled={isDeletingMarket}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: isDeletingMarket ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s ease",
                  opacity: isDeletingMarket ? 0.85 : 1,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.opacity = "0.88";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.opacity = "1";
                }}
              >
                {isDeletingMarket ? "Lösche…" : "Hard löschen"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Detail drawer */}
      {selectedMarket && (
        <MarketDetailDrawer
          market={selectedMarket}
          visits={visits}
          currentRedPeriod={currentRedMonth ? { start: currentRedMonth.start, end: currentRedMonth.end } : null}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          onUniverseMarketChange={handleUniverseMarketChange}
          universeMarketSaving={savingUniverseMarketId === selectedMarket.id}
          loadKuehlerUnits={handleLoadKuehlerUnits}
          onCreateKuehlerUnit={handleCreateKuehlerUnit}
          onUpdateKuehlerUnit={handleUpdateKuehlerUnit}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onImport={handleImport}
          onSaveFixedRow={handleSaveFixedRow}
          onClose={() => setShowImport(false)}
        />
      )}

      {showManualCreate && (
        <ManualMarketCreateModal
          onCreate={handleCreateManualMarket}
          onClose={() => setShowManualCreate(false)}
        />
      )}
    </div>
  );
}

function MaerktePageSkeleton() {
  const shimmer: React.CSSProperties = {
    backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)",
    backgroundSize: "400% 100%",
    animation: "maerkteSkeletonShimmer 1.25s ease-in-out infinite",
    borderRadius: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      <style>{`
        @keyframes maerkteSkeletonShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>

      <div />

      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...shimmer, height: 10, width: 90 }} />
          <div style={{ ...shimmer, height: 10, width: 120 }} />
        </div>

        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ ...shimmer, height: 28, width: 200, borderRadius: 7 }} />
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} style={{ ...shimmer, height: 24, width: `${58 + (index % 3) * 10}px`, borderRadius: 6 }} />
                ))}
              </div>
            </div>
            <div style={{ ...shimmer, height: 16, width: 170, borderRadius: 999 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: MARKET_LIST_GRID, gap: MARKET_LIST_GAP, padding: "7px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} style={{ ...shimmer, height: 9, width: `${72 + (index % 2) * 16}%` }} />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: MARKET_LIST_GRID,
                  gap: MARKET_LIST_GAP,
                  padding: "10px 18px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <div style={{ ...shimmer, height: 14, width: 44, borderRadius: 4 }} />
                  <div style={{ ...shimmer, height: 11, width: `${44 + (index % 4) * 10}%` }} />
                </div>
                <div style={{ ...shimmer, height: 10, width: 26 }} />
                <div style={{ ...shimmer, height: 10, width: `${56 + (index % 3) * 10}%` }} />
                <div style={{ ...shimmer, height: 10, width: `${54 + (index % 2) * 12}%` }} />
                <div style={{ ...shimmer, height: 10, width: 38 }} />
                <div style={{ ...shimmer, height: 10, width: `${62 + (index % 2) * 14}%` }} />
                <div style={{ ...shimmer, height: 10, width: 22 }} />
                <div style={{ ...shimmer, height: 10, width: 20 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
