"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, ChevronDown, Check, FileSpreadsheet, Upload, Plus,
  MapPin, Edit2, Save, RotateCcw, Info, Calendar, Clock, User,
  Building2, Tag, ArrowRight, AlertTriangle, CheckCircle2,
} from "lucide-react";
import type { MarketRecord, MarketVisitLog, MarketFilters, SectionType } from "@/types/markets";
import {
  readWorkbook, buildPreviewGrid, getColHeader, getColSample,
  FIELD_SPECS, validateMapping, draftToMarketRecord,
  type ColumnMapping, type WorkbookResult, type ImportSummary,
} from "@/utils/marketImport";
import { createMarket, fetchMarkets, importMarkets, updateMarket } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";

// ── Constants ─────────────────────────────────────────────────

const R  = "#DC2626";
const RD = "#b91c1c";
const LS_VISITS  = "admin_market_visits_v1";

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

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.07)"   },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.07)"  },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.07)"  },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.07)"  },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.07)"   },
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

const MarketRow = React.memo(function MarketRow({
  market,
  active,
  visited,
  visitCount,
  onSelect,
}: {
  market: MarketRecord;
  active: boolean;
  visited: boolean;
  visitCount: number;
  onSelect: (id: string | null) => void;
}) {
  const ci = chainInitials(market.name);
  return (
    <div
      onClick={() => onSelect(active ? null : market.id)}
      style={{ display: "grid", gridTemplateColumns: "1fr 50px 160px 120px 70px 130px 40px 40px", gap: "0 12px", padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: active ? `3px solid ${R}` : "3px solid transparent", transition: "background 0.1s ease, border-left-color 0.1s ease", alignItems: "center", height: MARKET_ROW_H, boxSizing: "border-box" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Markt */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ci.bg, color: ci.text, letterSpacing: "0.02em", flexShrink: 0, textTransform: "uppercase" }}>
          {market.name.split(" ")[0].slice(0, 4)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.name}</div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{market.dbName}</div>
        </div>
      </div>
      {/* Info dot */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {market.infoFlag && <span style={{ width: 6, height: 6, borderRadius: "50%", background: R, flexShrink: 0 }} title="Info vorhanden" />}
      </div>
      {/* Adresse */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.address}</div>
      </div>
      {/* Region / Ort */}
      <div>
        <div style={{ fontSize: 11, color: "#374151" }}>{market.region}</div>
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{market.postalCode} {market.city}</div>
      </div>
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
  visitedSet,
  visitCounts,
}: {
  items: MarketRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
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
          />
        ))}
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────

type ImportStep = "upload" | "review" | "summary";

function ImportModal({
  onImport,
  onSaveFixedRow,
  onClose,
}: {
  onImport: (payload: { fileName: string; sheetName: string; rows: string[][]; mapping: ColumnMapping }) => Promise<{ markets: MarketRecord[]; summary: ImportSummary }>;
  onSaveFixedRow: (market: MarketRecord) => Promise<MarketRecord>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("upload");
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

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
    if (!wb || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onImport({
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
  }, [wb, mapping, fileName, onImport, isSubmitting]);

  // Called from summary when user manually fills a skipped row and presses save
  const handleSaveFixedRow = useCallback(async (market: MarketRecord) => {
    return onSaveFixedRow(market);
    // We don't close the modal — the summary view manages the local display state
  }, [onSaveFixedRow]);

  const validation = useMemo(() => validateMapping(mapping), [mapping]);
  const preview = useMemo(() => wb ? buildPreviewGrid(wb.rows) : null, [wb]);

  if (!mounted || typeof document === "undefined") return null;

  // ── Shared modal shell ─────────────────────────────────────
  const widths: Record<ImportStep, number> = { upload: 520, review: 860, summary: 580 };
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
              {step === "upload"  && "Märkte importieren"}
              {step === "review"  && "Spalten zuweisen"}
              {step === "summary" && "Import abgeschlossen"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500, marginTop: 1 }}>
              {step === "upload"  && "Excel-Datei ziehen oder auswählen"}
              {step === "review"  && `${fileName} · ${wb?.sheetName ?? ""} · ${(wb?.rows.length ?? 1) - 1} Datenzeilen`}
              {step === "summary" && `${fileName} · ${wb?.sheetName ?? ""}`}
            </div>
          </div>
          {/* Step indicator dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 8 }}>
            {(["upload", "review", "summary"] as ImportStep[]).map((s, i) => {
              const done = step === "summary" || (step === "review" && i === 0);
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
              {parseError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)" }}>
                  <AlertTriangle size={13} strokeWidth={2} color={R} />
                  <span style={{ fontSize: 11, color: R, fontWeight: 500 }}>Fehler beim Lesen: {parseError}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)" }}>Abbrechen</button>
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
                    {FIELD_SPECS.filter(s => s.required || s.isIdentity).map(spec => (
                      <MappingRow key={spec.key} spec={spec} value={mapping[spec.key] ?? ""} rows={wb.rows} validation={validation} onChange={v => setMapping(m => ({ ...m, [spec.key]: v.toUpperCase() }))} />
                    ))}
                  </div>
                </div>

                {/* Optional section */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.22)", marginBottom: 8 }}>Optionale Felder</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px 10px" }}>
                    {FIELD_SPECS.filter(s => !s.required && !s.isIdentity).map(spec => (
                      <MappingRow key={spec.key} spec={spec} value={mapping[spec.key] ?? ""} rows={wb.rows} validation={validation} onChange={v => setMapping(m => ({ ...m, [spec.key]: v.toUpperCase() }))} />
                    ))}
                  </div>
                </div>

                {/* Helper note */}
                <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginTop: 8 }}>
                  Spaltenangabe als Excel-Buchstaben · <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>A = 1. Spalte · Z = 26. · AA = 27.</span>
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
            <ImportSummaryView summary={summary} fileName={fileName} onClose={onClose} onSaveFixedRow={handleSaveFixedRow} onRestart={() => { setStep("upload"); setWb(null); setMapping({}); setSummary(null); setFileName(""); }} />
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
  spec: (typeof FIELD_SPECS)[0];
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
    setSavingRows((prev) => new Set(prev).add(rowIdx));
    try {
      const rowFills = fills[rowIdx] ?? {};
      // Merge fills into draft
      const completeDraft = { ...(r.draft ?? {}), ...rowFills };
      const market = draftToMarketRecord(completeDraft, fileName);
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

  const statItems = [
    { label: "Gesamt",       value: summary.totalParsedRows,                    color: "rgba(0,0,0,0.5)",  bg: "#fff",                        border: "rgba(0,0,0,0.08)" },
    { label: "Erstellt",     value: localCreated,                               color: "#16a34a",           bg: "rgba(22,163,74,0.06)",        border: "rgba(22,163,74,0.16)" },
    { label: "Aktualisiert", value: summary.updated,                            color: "#0891b2",           bg: "rgba(8,145,178,0.06)",        border: "rgba(8,145,178,0.16)" },
    { label: "Übersprungen", value: localSkipped.length,                        color: localSkipped.length > 0 ? "#d97706" : "rgba(0,0,0,0.35)", bg: localSkipped.length > 0 ? "rgba(217,119,6,0.06)" : "#fff", border: localSkipped.length > 0 ? "rgba(217,119,6,0.2)" : "rgba(0,0,0,0.08)" },
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
                          {missingKeys.length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d97706", marginBottom: 7 }}>Fehlend — bitte ergänzen</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px" }}>
                                {missingKeys.map(key => {
                                  const spec = FIELD_SPECS.find(s => s.key === key);
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
                          {missingKeys.length > 0 && (
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

function MarketDetailDrawer({ market, visits, currentRedPeriod, onClose, onSave }: {
  market: MarketRecord; visits: MarketVisitLog[];
  currentRedPeriod: { start: string; end: string } | null;
  onClose: () => void; onSave: (updated: MarketRecord) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"info" | "besuche">("info");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MarketRecord>(market);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(market); setEditing(false); }, [market.id]);

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

  const set = (patch: Partial<MarketRecord>) => setDraft(prev => ({ ...prev, ...patch }));

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
          {[market.region, market.emEh, market.universeMarket ? "Universum" : null].filter(Boolean).map(b => (
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

            <InfoSection label="Identität">
              <InfoRow label="Name" value={market.name} edit={editing} editValue={draft.name} onEdit={v => set({ name: v })} />
              <InfoRow label="Name f. DB" value={market.dbName} edit={editing} editValue={draft.dbName} onEdit={v => set({ dbName: v })} />
              <InfoRow label="Flex-Nummer" value={market.flexNumber} edit={editing} editValue={draft.flexNumber} onEdit={v => set({ flexNumber: v })} />
              <InfoRow label="Stammnr. Coke" value={market.cokeMasterNumber} edit={editing} editValue={draft.cokeMasterNumber} onEdit={v => set({ cokeMasterNumber: v })} />
              <InfoRow label="Standardmarkt Nr" value={market.standardMarketNumber} edit={editing} editValue={draft.standardMarketNumber} onEdit={v => set({ standardMarketNumber: v })} />
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
              <InfoRow label="Universums-markt" value={market.universeMarket ? "Ja" : "Nein"} />
              <InfoRow label="Besuchsfrequenz / Jahr" value={String(market.visitFrequencyPerYear)} edit={editing} editValue={String(draft.visitFrequencyPerYear)} onEdit={v => set({ visitFrequencyPerYear: parseInt(v) || market.visitFrequencyPerYear })} />
            </InfoSection>

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
    region: null, city: null, postalCode: null, emEh: null, employee: null,
    universeMarket: null, infoFlag: null, currentGmName: null,
    redMonatVisited: null, frequencyBucket: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    void reloadMarkets();
    try {
      const storedV = localStorage.getItem(LS_VISITS);
      setVisits(storedV ? JSON.parse(storedV) : []);
    } catch { /* start empty */ }
    // Listen for import trigger from header button
    const handler = () => setShowImport(true);
    window.addEventListener("maerkte:openImport", handler);
    return () => window.removeEventListener("maerkte:openImport", handler);
  }, [reloadMarkets]);

  const handleImport = useCallback(async (payload: { fileName: string; sheetName: string; rows: string[][]; mapping: ColumnMapping }) => {
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
    }
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

  // ── Derived filter options ─────────────────────────────────
  const opts = useMemo(() => ({
    region:   [...new Set(markets.map(m => m.region))].sort(),
    city:     [...new Set(markets.map(m => m.city))].sort(),
    postalCode:[...new Set(markets.map(m => m.postalCode))].sort(),
    emEh:     [...new Set(markets.map(m => m.emEh))].sort(),
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
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return markets.filter(m => {
      if (q) {
        const hay = `${m.name} ${m.dbName} ${m.address} ${m.postalCode} ${m.city} ${m.flexNumber} ${m.cokeMasterNumber} ${m.standardMarketNumber} ${m.currentGmName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.region && m.region !== filters.region) return false;
      if (filters.city && m.city !== filters.city) return false;
      if (filters.postalCode && m.postalCode !== filters.postalCode) return false;
      if (filters.emEh && m.emEh !== filters.emEh) return false;
      if (filters.employee && m.employee !== filters.employee) return false;
      if (filters.currentGmName && m.currentGmName !== filters.currentGmName) return false;
      if (filters.universeMarket) {
        if (filters.universeMarket === "Ja" && !m.universeMarket) return false;
        if (filters.universeMarket === "Nein" && m.universeMarket) return false;
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
  }, [markets, debouncedSearch, filters, visitedInRedMonatSet]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedMarket = useMemo(() => markets.find(m => m.id === selectedId) ?? null, [markets, selectedId]);

  // Stable select handler — passed into memoized rows so they don't re-render on unrelated state changes
  const handleSelectMarket = useCallback((id: string | null) => setSelectedId(id), []);

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

  if (!mounted) return null;

  const hasFilters = !!search.trim() || activeFilterCount > 0;

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
                onClick={() => { setSearch(""); setFilters({ region: null, city: null, postalCode: null, emEh: null, employee: null, universeMarket: null, infoFlag: null, currentGmName: null, redMonatVisited: null, frequencyBucket: null }); }}
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

        {(loadError || saveError || importError) && (
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
            {importError && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
                Import fehlgeschlagen: {importError}
              </div>
            )}
          </div>
        )}

        {isLoadingMarkets ? (
          <div style={{ padding: "60px 40px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontWeight: 600 }}>Märkte werden geladen…</span>
          </div>
        ) : markets.length === 0 ? (
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
                  <FilterBtn label="Mitarbeiter" filterKey="employee" opts={opts.employee} />
                  <FilterBtn label="GM" filterKey="currentGmName" opts={opts.gmName} />
                  <FilterBtn label="Universum" filterKey="universeMarket" opts={["Ja", "Nein"]} />
                  <FilterBtn label="Info" filterKey="infoFlag" opts={["Ja", "Nein"]} />
                  <FilterBtn label="RED Monat" inactiveLabel="Nicht aktiv" filterKey="redMonatVisited" opts={["Alle", "Besucht", "Nicht besucht"]} nullLabel="Nicht aktiv" />
                  <FilterBtn label="Frequenz" filterKey="frequencyBucket" opts={["4", "6", "12", "Sonstige"]} />

                </div>
              </div>

              {/* Active filter strip */}
              {activeFilterCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500, flexShrink: 0 }}>{filtered.length} / {markets.length} Märkte</span>
                  {(Object.entries(filters) as [keyof MarketFilters, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                    <button key={k} onClick={() => setFilters(prev => ({ ...prev, [k]: null }))}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, background: "rgba(220,38,38,0.07)", color: R, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      {v}<X size={7} strokeWidth={2.5} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 160px 120px 70px 130px 40px 40px", gap: "0 12px", padding: "7px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {["Markt", "Info", "Adresse", "Region / Ort", "EM/EH", "Verplant an", "IPP", "Freq."].map((h, i) => (
                <span key={i} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>{h}</span>
              ))}
            </div>

            {/* Rows — virtualized for large datasets */}
            <VirtualMarketList
              items={filtered}
              selectedId={selectedId}
              onSelect={handleSelectMarket}
              visitedSet={visitedInRedMonatSet}
              visitCounts={visitCountByMarket}
            />
          </>
        )}
        </div>{/* end white inner card */}
      </div>{/* end grey outer card */}

      {/* Detail drawer */}
      {selectedMarket && (
        <MarketDetailDrawer
          market={selectedMarket}
          visits={visits}
          currentRedPeriod={currentRedMonth ? { start: currentRedMonth.start, end: currentRedMonth.end } : null}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
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
    </div>
  );
}
