"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, TrendingUp, ChevronDown, ChevronRight, Info } from "lucide-react";
import type {
  IppMarketAuditRecord,
  IppQuestionAuditRow, IppAverageSummary, SectionType,
} from "@/types/ipp";
import { fetchAdminIppDetail, fetchAdminIppRows, type AdminIppListRow } from "@/lib/api/backend";

// ── Constants ─────────────────────────────────────────────────
const R = "#DC2626";
const GREEN = "#16a34a";

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.08)"  },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.08)" },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.08)" },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.08)"  },
};

// ── Helpers ───────────────────────────────────────────────────
function fmtIpp(v: number): string {
  return v.toFixed(2);
}
function chainInitials(name: string): { bg: string; text: string } {
  const k = name.toUpperCase();
  if (k.includes("BILLA"))  return { bg: "rgba(234,179,8,0.10)",  text: "#a16207" };
  if (k.includes("SPAR"))   return { bg: "rgba(220,38,38,0.08)",  text: "#DC2626" };
  if (k.includes("MERKUR")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  if (k.includes("PENNY"))  return { bg: "rgba(194,65,12,0.08)",  text: "#c2410c" };
  if (k.includes("HOFER"))  return { bg: "rgba(16,185,129,0.08)", text: "#065f46" };
  if (k.includes("ADEG"))   return { bg: "rgba(34,197,94,0.08)",  text: "#15803d" };
  return { bg: "rgba(0,0,0,0.05)", text: "#6b7280" };
}

function collectSections(record: IppMarketAuditRecord & { submissionRefs?: Array<{ sectionType?: string }> }): SectionType[] {
  const fromSubmissionRefs = Array.isArray(record.submissionRefs)
    ? record.submissionRefs.map((entry) => entry.sectionType).filter((value): value is string => typeof value === "string")
    : [];
  const fromQuestionRows = (record.questionRows ?? []).flatMap((row) => row.sourceSections ?? []);
  return Array.from(new Set([...fromSubmissionRefs, ...fromQuestionRows]))
    .filter((value): value is SectionType => value in SECTION_META);
}

function collectFragebogenNames(record: IppMarketAuditRecord & { submissionRefs?: Array<{ fragebogenName?: string }> }): string[] {
  const fromSubmissionRefs = Array.isArray(record.submissionRefs)
    ? record.submissionRefs
        .map((entry) => entry.fragebogenName)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const fromQuestionRows = (record.questionRows ?? []).flatMap((row) => row.sourceFrageboegen ?? []);
  return Array.from(new Set([...fromSubmissionRefs, ...fromQuestionRows].map((value) => value.trim()).filter((value) => value.length > 0)));
}

// ── Market YTD series ─────────────────────────────────────────

interface IppMarketSeries {
  marketId: string;
  marketName: string;
  chain: string;
  region: string;
  postalCode: string;
  city: string;
  gmName: string;
  /** All month records for this market, newest-first */
  records: IppMarketAuditRecord[];
  /** Mean of all included (IPP > 0) month IPPs */
  averageIppYtd: number;
  includedMonthCount: number;
  excludedMonthCount: number;
}

/** Group audit records by market and derive per-market YTD averages */
function buildMarketSeries(records: IppMarketAuditRecord[]): Map<string, IppMarketSeries> {
  const byMarket = new Map<string, IppMarketAuditRecord[]>();
  for (const r of records) {
    if (!byMarket.has(r.marketId)) byMarket.set(r.marketId, []);
    byMarket.get(r.marketId)!.push(r);
  }
  const result = new Map<string, IppMarketSeries>();
  byMarket.forEach((recs, marketId) => {
    const sorted = [...recs].sort((a, b) => b.redMonatLabel.localeCompare(a.redMonatLabel));
    const included = sorted.filter(r => r.includedInAverage);
    const avgYtd = included.length > 0
      ? Math.round(included.reduce((s, r) => s + r.marketIpp, 0) / included.length * 100) / 100
      : 0;
    const base = sorted[0];
    result.set(marketId, {
      marketId,
      marketName: base.marketName,
      chain: base.chain,
      region: base.region,
      postalCode: base.postalCode,
      city: base.city,
      gmName: base.gmName,
      records: sorted,
      averageIppYtd: avgYtd,
      includedMonthCount: included.length,
      excludedMonthCount: sorted.length - included.length,
    });
  });
  return result;
}

/** Austria-level average: average of market YTD averages across unique markets */
function buildYtdSummary(series: Map<string, IppMarketSeries>): IppAverageSummary {
  const markets = Array.from(series.values());
  const included = markets.filter(m => m.averageIppYtd > 0);
  const numeratorTotal = included.reduce((s, m) => s + m.averageIppYtd, 0);
  const denominatorIncludedMarkets = included.length;
  const averageIpp = denominatorIncludedMarkets > 0
    ? Math.round((numeratorTotal / denominatorIncludedMarkets) * 100) / 100
    : 0;
  const contributingQuestionCount = markets.reduce((sum, market) => {
    return (
      sum +
      market.records.reduce((rowSum, record) => {
        if (typeof record.contributingQuestionCount === "number") {
          return rowSum + record.contributingQuestionCount;
        }
        return rowSum + record.questionRows.filter((question) => question.counted).length;
      }, 0)
    );
  }, 0);
  return {
    averageIpp,
    numeratorTotal: Math.round(numeratorTotal * 100) / 100,
    denominatorIncludedMarkets,
    excludedZeroMarkets: markets.length - included.length,
    contributingQuestionCount,
    totalMarkets: markets.length,
  };
}
// ── Small UI helpers ──────────────────────────────────────────
function SectionPill({ type }: { type: SectionType }) {
  const m = SECTION_META[type];
  return (
    <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: m.bg, color: m.color, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>
      {m.label}
    </span>
  );
}

function StatTile({ label, value, color = "#1a1a1a", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.055)", padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontVariantNumeric: "tabular-nums" }}>{sub}</span>}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, background: "rgba(220,38,38,0.07)", color: R, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
      {label}<X size={7} strokeWidth={2.5} />
    </button>
  );
}

// ── Inspector ─────────────────────────────────────────────────
function QuestionAuditRow({ row }: { row: IppQuestionAuditRow }) {
  const answerStr = Array.isArray(row.selectedAnswer)
    ? row.selectedAnswer.join(", ")
    : row.selectedAnswer;
  const rowSections = row.sourceSections.filter((value): value is SectionType => value in SECTION_META);

  const isNumeric = row.questionType === "numeric";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "9px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
    }}>
      {/* Left: type badge */}
      <div style={{ width: 52, flexShrink: 0, paddingTop: 1 }}>
        <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 4, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)" }}>
          {isNumeric ? "Zahl" : row.questionType === "yesno" ? "Ja/N" : "Wahl"}
        </span>
      </div>

      {/* Center: question + answer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 3 }}>{row.questionText}</div>
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: row.deduped ? 4 : 0 }}>
          Antwort: <span style={{ fontWeight: 600, color: "#374151" }}>{answerStr}</span>
          {isNumeric && row.appliedIppValue > 0 && (
            <span style={{ color: "rgba(0,0,0,0.38)", marginLeft: 6 }}>
              ({answerStr} × {Object.values(row.questionFingerprint.match(/\d+(\.\d+)?/g) ?? []).slice(-1)[0] ?? "?"} Faktor)
            </span>
          )}
        </div>
        {row.deduped && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Info size={9} strokeWidth={2} color="rgba(0,0,0,0.3)" />
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontStyle: "italic" }}>
              {row.countedReason}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
          {rowSections.map(s => <SectionPill key={s} type={s} />)}
        </div>
      </div>

      {/* Right: IPP value */}
      <div style={{ flexShrink: 0, textAlign: "right" as const, minWidth: 52 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: row.counted && row.appliedIppValue > 0 ? GREEN : "rgba(0,0,0,0.22)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {row.counted && row.appliedIppValue > 0 ? `+${fmtIpp(row.appliedIppValue)}` : "—"}
        </div>
      </div>
    </div>
  );
}

// ── Month Switcher (market-scoped pill picker) ────────────────
function MonthSwitcher({
  records, selectedMonth, onChange,
}: {
  records: IppMarketAuditRecord[];
  selectedMonth: string;
  onChange: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function update() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const portal = document.getElementById("ipp-month-switcher-portal");
      if (btnRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const months = records.map(r => r.redMonatLabel);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
          background: open ? "rgba(220,38,38,0.14)" : "rgba(220,38,38,0.08)",
          color: R, letterSpacing: "0.04em",
          border: "none", cursor: months.length > 1 ? "pointer" : "default",
          fontFamily: "inherit", transition: "background 0.12s ease",
        }}
        onMouseEnter={e => { if (months.length > 1) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.14)"; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.08)"; }}
      >
        {selectedMonth}
        {months.length > 1 && (
          <ChevronDown size={9} strokeWidth={2.5} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        )}
      </button>
      {open && pos && months.length > 1 && typeof document !== "undefined" && createPortal(
        <div
          id="ipp-month-switcher-portal"
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, minWidth: 130,
            animation: "ippDropIn 0.14s ease both",
          }}
        >
          <style>{`@keyframes ippDropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {months.map(m => {
            const rec = records.find(r => r.redMonatLabel === m)!;
            const isSelected = m === selectedMonth;
            return (
              <button
                key={m}
                onMouseDown={e => { e.preventDefault(); onChange(m); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, padding: "6px 10px", fontSize: 10, borderRadius: 5, border: "none",
                  cursor: "pointer", background: isSelected ? "rgba(220,38,38,0.06)" : "transparent",
                  color: isSelected ? R : "#374151", fontWeight: isSelected ? 700 : 400, fontFamily: "inherit",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <span>{m}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: rec.includedInAverage ? GREEN : "rgba(0,0,0,0.3)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtIpp(rec.marketIpp)}
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Durchschnitt hover breakdown ──────────────────────────────
function DurchschnittTooltip({
  series, averageIppYtd, metricBlock, color,
}: {
  series: IppMarketSeries;
  averageIppYtd: number;
  color: string;
  metricBlock: (value: string, label: string, color: string) => React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const panelW = 220;
    const left = Math.min(r.right - panelW, window.innerWidth - panelW - 12);
    setPos({ top: r.bottom + 6, left: Math.max(8, left) });
    setShow(true);
  };
  const handleLeave = () => {
    timerRef.current = setTimeout(() => setShow(false), 120);
  };
  const handlePanelEnter = () => { if (timerRef.current) clearTimeout(timerRef.current); };
  const handlePanelLeave = () => { timerRef.current = setTimeout(() => setShow(false), 120); };

  const included = series.records.filter(r => r.includedInAverage);
  const sum = included.reduce((s, r) => s + r.marketIpp, 0);

  return (
    <>
      {/* Trigger — same MetricBlock as Dieser Monat, just adds hover behaviour */}
      <div
        ref={containerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ cursor: "default" }}
      >
        {metricBlock(fmtIpp(averageIppYtd), "Im Durchschnitt", color)}
      </div>
      {show && pos && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.11), 0 1px 4px rgba(0,0,0,0.05)",
            padding: "10px 0", width: 220,
            animation: "ippDropIn 0.14s ease both",
          }}
        >
          <div style={{ padding: "0 12px 7px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)" }}>
            YTD Berechnung
          </div>
          {series.records.map(r => (
            <div
              key={r.redMonatLabel}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "5px 12px",
                opacity: r.includedInAverage ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: R, letterSpacing: "0.02em" }}>{r.redMonatLabel}</span>
              <span style={{ fontSize: 10, fontWeight: r.includedInAverage ? 700 : 400, color: r.includedInAverage ? GREEN : "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
                {r.includedInAverage ? fmtIpp(r.marketIpp) : "0.00"}
              </span>
            </div>
          ))}
          <div style={{ margin: "7px 12px 0", paddingTop: 7, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontVariantNumeric: "tabular-nums" }}>
              {fmtIpp(sum)} ÷ {included.length}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: GREEN, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              = {fmtIpp(averageIppYtd)}
            </span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Inspector ─────────────────────────────────────────────────
function MarketInspector({
  record,
  marketSeries,
  averageIppYtd,
  inspectorMonthLabel,
  onMonthChange,
}: {
  record: IppMarketAuditRecord | null;
  marketSeries: IppMarketSeries | null;
  averageIppYtd: number;
  inspectorMonthLabel: string | null;
  onMonthChange: (label: string) => void;
}) {
  const [ignoredOpen, setIgnoredOpen] = useState(false);

  if (!record) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center" as const, maxWidth: 240 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <TrendingUp size={20} strokeWidth={1.5} color={R} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 5 }}>Markt auswählen</div>
          <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Klicke auf einen Markt in der Liste um die IPP-Berechnung zu prüfen.</div>
        </div>
      </div>
    );
  }

  const counted   = record.questionRows.filter(r => r.counted && r.appliedIppValue > 0);
  const ignored   = record.questionRows.filter(r => !r.counted || r.appliedIppValue === 0);
  const deduped   = record.questionRows.filter(r => r.deduped).length;
  const ci        = chainInitials(record.chain);
  const sections = collectSections(record);
  const frageOgen = collectFragebogenNames(record);
  const activeMonth = inspectorMonthLabel ?? record.redMonatLabel;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Inspector header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          {/* Left: identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: ci.bg, color: ci.text, letterSpacing: "0.04em", textTransform: "uppercase" as const, flexShrink: 0 }}>
              {record.chain}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{record.marketName}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 1 }}>{record.postalCode} {record.city} · {record.region} · {record.gmName}</div>
            </div>
          </div>

          {/* Right: dual IPP metrics — both use the same MetricBlock structure so numbers and labels align */}
          {(() => {
            const metricBlock = (
              value: string,
              label: string,
              color: string,
            ) => (
              <div style={{ textAlign: "right" as const, width: 60 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, marginTop: 3, color }}>
                  {label}
                </div>
              </div>
            );

            const dmColor = record.includedInAverage ? GREEN : "rgba(0,0,0,0.35)";
            const avgColor = averageIppYtd > 0 ? GREEN : "rgba(0,0,0,0.3)";

            return (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexShrink: 0 }}>
                {/* Dieser Monat */}
                {metricBlock(fmtIpp(record.marketIpp), "Dieser Monat", dmColor)}

                {/* Vertical divider */}
                <div style={{ width: 1, height: 36, background: "rgba(0,0,0,0.07)", flexShrink: 0, alignSelf: "center" }} />

                {/* Im Durchschnitt */}
                {marketSeries ? (
                  <DurchschnittTooltip
                    series={marketSeries}
                    averageIppYtd={averageIppYtd}
                    metricBlock={metricBlock}
                    color={avgColor}
                  />
                ) : (
                  metricBlock("—", "Im Durchschnitt", avgColor)
                )}
              </div>
            );
          })()}
        </div>

        {/* Month switcher + source summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          {marketSeries ? (
            <MonthSwitcher
              records={marketSeries.records}
              selectedMonth={activeMonth}
              onChange={onMonthChange}
            />
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(220,38,38,0.08)", color: R, letterSpacing: "0.04em" }}>
              {record.redMonatLabel}
            </span>
          )}
          {sections.map(s => <SectionPill key={s} type={s} />)}
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>
            {frageOgen.length} {frageOgen.length === 1 ? "Fragebogen" : "Fragebögen"} · {record.questionRows.length} IPP-relevante Fragen
          </span>
        </div>
      </div>

      {/* Summary stat strip */}
      <div style={{ padding: "10px 20px 8px", borderBottom: "1px solid rgba(0,0,0,0.04)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.055)", borderRadius: 9, padding: 5 }}>
          <StatTile label="Dieser Monat" value={fmtIpp(record.marketIpp)} color={record.includedInAverage ? GREEN : "rgba(0,0,0,0.35)"} sub={activeMonth} />
          <StatTile label="YTD Ø" value={fmtIpp(averageIppYtd)} color={averageIppYtd > 0 ? GREEN : "rgba(0,0,0,0.3)"} sub={marketSeries ? `${marketSeries.includedMonthCount} Monate` : "—"} />
          <StatTile label="Gezählt" value={String(counted.length)} color="#1a1a1a" sub={`${fmtIpp(counted.reduce((s, r) => s + r.appliedIppValue, 0))} Punkte`} />
          <StatTile label="Kein IPP / 0" value={String(ignored.length)} color="rgba(0,0,0,0.38)" />
          <StatTile label="Dedupl." value={String(deduped)} color={deduped > 0 ? "#D97706" : "rgba(0,0,0,0.35)"} sub={deduped > 0 ? "zusammengeführt" : "keine"} />
          <StatTile label="Sektionen" value={String(sections.length)} color="#374151" />
        </div>
      </div>

      {/* Question audit list */}
      <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>

        {/* Counted contributions */}
        {counted.length > 0 && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: GREEN, marginBottom: 4 }}>
              Gezählte Beiträge · {counted.length} Fragen
            </div>
            {counted.map((r, i) => <QuestionAuditRow key={i} row={r} />)}
          </div>
        )}

        {/* Ignored / not counted */}
        {ignored.length > 0 && (
          <div style={{ paddingTop: 10, paddingBottom: 16 }}>
            <button
              onClick={() => setIgnoredOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit" }}
            >
              {ignoredOpen ? <ChevronDown size={10} strokeWidth={2} /> : <ChevronRight size={10} strokeWidth={2} />}
              Nicht gezählt · {ignored.length} Fragen
            </button>
            <div style={{ maxHeight: ignoredOpen ? "1000px" : 0, overflow: "hidden", opacity: ignoredOpen ? 1 : 0, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
              {ignored.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.03)", opacity: 0.6 }}>
                  <div style={{ width: 52, flexShrink: 0, paddingTop: 1 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 4, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)" }}>
                      {r.questionType === "numeric" ? "Zahl" : r.questionType === "yesno" ? "Ja/N" : "Wahl"}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.5)", lineHeight: 1.4, marginBottom: 2 }}>{r.questionText}</div>
                    <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontStyle: "italic" }}>{r.countedReason}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.2)", flexShrink: 0 }}>—</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter Dropdown (portal-less, inline) ─────────────────────
function FilterDropdown({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function update() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(140, r.width) });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const portal = document.getElementById(`ipp-filter-portal-${label}`);
      if (btnRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, label]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid rgba(0,0,0,0.1)", background: value ? "rgba(220,38,38,0.06)" : "linear-gradient(to bottom,#fff,#f5f5f5)", color: value ? R : "rgba(0,0,0,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", whiteSpace: "nowrap" as const, boxShadow: "inset 0 1px 0.5px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.07)" }}>
        {value ?? label}
        <ChevronDown size={9} strokeWidth={2.5} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div id={`ipp-filter-portal-${label}`} className="map-scroll" style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, maxHeight: 280, overflowY: "auto" }}>
          <button onMouseDown={e => { e.preventDefault(); onChange(null); setOpen(false); }}
            style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: !value ? "rgba(220,38,38,0.06)" : "transparent", color: !value ? R : "#374151", fontWeight: !value ? 600 : 400, fontFamily: "inherit" }}>
            Alle
          </button>
          {options.map(o => (
            <button key={o} onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === o ? "rgba(220,38,38,0.06)" : "transparent", color: value === o ? R : "#374151", fontWeight: value === o ? 600 : 400, fontFamily: "inherit" }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}>
              {o}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function IppBerechnungPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Month shown in the inspector — can differ from the clicked row's month */
  const [inspectorMonthLabel, setInspectorMonthLabel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [filterGm,     setFilterGm]     = useState<string | null>(null);
  const [filterChain,  setFilterChain]  = useState<string | null>(null);
  const [filterMonat,  setFilterMonat]  = useState<string | null>(null);
  const [allAuditRecords, setAllAuditRecords] = useState<IppMarketAuditRecord[]>([]);
  const [detailCache, setDetailCache] = useState<Map<string, IppMarketAuditRecord>>(new Map());
  const [filterOptions, setFilterOptions] = useState<{
    regions: string[];
    gms: string[];
    chains: string[];
    redMonats: string[];
  }>({ regions: [], gms: [], chains: [], redMonats: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setLoadError(null);
    fetchAdminIppRows()
      .then((payload) => {
        if (!mounted) return;
        setFilterOptions(payload.filters);
        setAllAuditRecords(
          payload.rows.map((row: AdminIppListRow) => ({
            ...row,
            questionRows: [],
            sourceSubmissionCount: row.sourceSubmissionCount,
            contributingQuestionCount: row.contributingQuestionCount,
          })),
        );
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        const msg = error instanceof Error ? error.message : "IPP Daten konnten nicht geladen werden.";
        setLoadError(msg);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const hasFilters = !!(search || filterRegion || filterGm || filterChain || filterMonat);

  const allMarketSeries = useMemo(() => buildMarketSeries(allAuditRecords), [allAuditRecords]);

  const filtered = useMemo(() => {
    return allAuditRecords.filter(r => {
      if (filterRegion && r.region !== filterRegion) return false;
      if (filterGm     && r.gmName !== filterGm)     return false;
      if (filterChain  && r.chain !== filterChain)   return false;
      if (filterMonat  && r.redMonatLabel !== filterMonat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.marketName.toLowerCase().includes(q) &&
            !r.gmName.toLowerCase().includes(q) &&
            !r.city.toLowerCase().includes(q) &&
            !r.chain.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allAuditRecords, search, filterRegion, filterGm, filterChain, filterMonat]);

  const summary = useMemo(() => {
    const series = buildMarketSeries(filtered);
    return buildYtdSummary(series);
  }, [filtered]);

  // The list row that was clicked (identifies the market + default month)
  const selectedRecord = filtered.find(r => r.id === selectedId) ??
    allAuditRecords.find(r => r.id === selectedId) ?? null;

  // The market's full series from the global (unfiltered) records
  const selectedMarketSeries = selectedRecord
    ? allMarketSeries.get(selectedRecord.marketId) ?? null
    : null;

  // The record currently shown in the inspector (may be a different month than the clicked row)
  const inspectorRecordRaw = useMemo(() => {
    if (!selectedRecord) return null;
    if (!inspectorMonthLabel || inspectorMonthLabel === selectedRecord.redMonatLabel) {
      return selectedRecord;
    }
    // Look up the same market but a different month
    return allAuditRecords.find(
      r => r.marketId === selectedRecord.marketId && r.redMonatLabel === inspectorMonthLabel
    ) ?? selectedRecord;
  }, [selectedRecord, inspectorMonthLabel, allAuditRecords]);

  const inspectorRecord = inspectorRecordRaw
    ? detailCache.get(inspectorRecordRaw.id) ?? inspectorRecordRaw
    : null;

  const ensureDetailLoaded = useCallback(async (record: IppMarketAuditRecord) => {
    const cached = detailCache.get(record.id);
    if (cached && cached.questionRows.length > 0) return;
    const detail = await fetchAdminIppDetail(record.marketId, record.redPeriodStart);
    const hydrated: IppMarketAuditRecord = {
      ...detail,
      questionRows: detail.questionRows,
      sourceSubmissionCount: detail.sourceSubmissionCount,
      contributingQuestionCount: detail.contributingQuestionCount,
    };
    setDetailCache((prev) => new Map(prev).set(record.id, hydrated));
    setAllAuditRecords((prev) =>
      prev.map((row) => (row.id === record.id ? { ...row, ...hydrated } : row)),
    );
  }, [detailCache]);

  useEffect(() => {
    if (!inspectorRecordRaw) return;
    void ensureDetailLoaded(inspectorRecordRaw).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : "IPP Detail konnte nicht geladen werden.";
      setLoadError(msg);
    });
  }, [inspectorRecordRaw, ensureDetailLoaded]);

  const clearFilters = () => { setSearch(""); setFilterRegion(null); setFilterGm(null); setFilterChain(null); setFilterMonat(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes ippFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .ipp-main { animation: ippFadeIn 0.25s ease both; }
        @keyframes inspFade { from { opacity:0 } to { opacity:1 } }
        .ipp-insp { animation: inspFade 0.18s ease both; }
      `}</style>

      {isLoading && (
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>IPP Daten werden geladen…</div>
      )}
      {loadError && (
        <div style={{ fontSize: 12, color: "#DC2626" }}>{loadError}</div>
      )}

      {/* Summary strip */}
      <div className="ipp-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>IPP Österreich Übersicht</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
            {hasFilters ? `${filtered.length} / ${allAuditRecords.length} Märkte` : `${allAuditRecords.length} Märkte`}
          </span>
        </div>
        <div style={{ margin: "0 10px 10px" }}>
          <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.055)", borderRadius: 10, padding: 6 }}>
            <StatTile
              label="IPP Ø Österreich"
              value={fmtIpp(summary.averageIpp)}
              color={summary.averageIpp > 0 ? GREEN : "rgba(0,0,0,0.3)"}
              sub={`Ø der Markt-YTD-Durchschnitte`}
            />
            <StatTile label="Berechnungsformel" value="Ø Markt-YTD ÷ n" color="rgba(0,0,0,0.45)" sub={`${fmtIpp(summary.numeratorTotal)} ÷ ${summary.denominatorIncludedMarkets}`} />
            <StatTile label="Märkte im Ø" value={String(summary.denominatorIncludedMarkets)} color={GREEN} sub="YTD-Ø > 0" />
            <StatTile label="Nullwerte ausgeschl." value={String(summary.excludedZeroMarkets)} color={summary.excludedZeroMarkets > 0 ? "#D97706" : "rgba(0,0,0,0.25)"} sub="YTD-Ø = 0" />
            <StatTile label="Beitragsfragen" value={String(summary.contributingQuestionCount)} color="#2563eb" sub="gezählte Antworten" />
            <StatTile label="Gesamt Märkte" value={String(summary.totalMarkets)} color="rgba(0,0,0,0.45)" />
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="ipp-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>IPP Berechnung</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.28)", fontStyle: "italic" }}>
              Austria Ø = Σ Markt-IPP / Märkte mit IPP &gt; 0
            </span>
          </div>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 220px", transition: "border 0.15s, background 0.15s" }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="Markt / GM / Kette suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
                {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex" }}><X size={10} strokeWidth={2} /></button>}
              </div>

              {/* Filters */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <FilterDropdown label="RED Monat" options={filterOptions.redMonats} value={filterMonat} onChange={setFilterMonat} />
                <FilterDropdown label="Region"    options={filterOptions.regions}    value={filterRegion} onChange={setFilterRegion} />
                <FilterDropdown label="GM"        options={filterOptions.gms}        value={filterGm}    onChange={setFilterGm} />
                <FilterDropdown label="Kette"     options={filterOptions.chains}     value={filterChain} onChange={setFilterChain} />
                {hasFilters && (
                  <button onClick={clearFilters}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.035)", cursor: "pointer", color: "rgba(0,0,0,0.4)", fontSize: 9, fontWeight: 600, fontFamily: "inherit" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; e.currentTarget.style.color = R; e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.035)"; e.currentTarget.style.color = "rgba(0,0,0,0.4)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; }}>
                    <X size={9} strokeWidth={2.5} /> Filter
                  </button>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {hasFilters && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{filtered.length} Märkte</span>
                {filterMonat  && <FilterPill label={filterMonat}  onRemove={() => setFilterMonat(null)} />}
                {filterRegion && <FilterPill label={filterRegion} onRemove={() => setFilterRegion(null)} />}
                {filterGm     && <FilterPill label={filterGm}     onRemove={() => setFilterGm(null)} />}
                {filterChain  && <FilterPill label={filterChain}  onRemove={() => setFilterChain(null)} />}
                {search       && <FilterPill label={`"${search}"`} onRemove={() => setSearch("")} />}
              </div>
            )}
          </div>

          {/* Master / detail split */}
          <div style={{ display: "flex", height: "calc(100vh - 340px)", minHeight: 480 }}>

            {/* Left: master list */}
            <div className="map-scroll" style={{ width: 420, flexShrink: 0, overflowY: "auto", borderRight: "1px solid rgba(0,0,0,0.05)", boxShadow: "4px 0 16px rgba(0,0,0,0.06)" }}>

              {/* Column header */}
              <div style={{ padding: "5px 14px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "grid", gridTemplateColumns: "1fr 28px 60px", gap: "0 12px" }}>
                {["Markt", "Im Ø", "IPP"].map((h, i) => (
                  <span key={i} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: i === 1 ? GREEN : "rgba(0,0,0,0.28)", textAlign: i === 2 ? "right" as const : "left" as const }}>{h}</span>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" as const }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TrendingUp size={18} strokeWidth={1.5} color={R} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Keine Märkte gefunden</div>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Filter anpassen oder Suche zurücksetzen.</div>
                  </div>
                </div>
              ) : filtered.map(r => {
                const active = r.id === selectedId;
                const ci = chainInitials(r.chain);
                const sections = collectSections(r);
                return (
                  <div key={r.id} onClick={() => { const next = active ? null : r.id; setSelectedId(next); setInspectorMonthLabel(null); }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.04)", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: active ? `3px solid ${R}` : "3px solid transparent", transition: "all 0.1s ease", display: "grid", gridTemplateColumns: "1fr 28px 60px", gap: "0 12px", alignItems: "center" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

                    {/* Market identity */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: ci.bg, color: ci.text, letterSpacing: "0.03em", flexShrink: 0, textTransform: "uppercase" as const }}>
                          {r.chain.slice(0, 5)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.marketName}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>{r.postalCode} {r.city}</span>
                        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)" }}>·</span>
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>{r.gmName}</span>
                        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)" }}>·</span>
                        <span style={{ fontSize: 8.5, fontWeight: 600, color: R, letterSpacing: "0.02em" }}>{r.redMonatLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                        {sections.map(s => <SectionPill key={s} type={s} />)}
                      </div>
                    </div>

                    {/* Status dot */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" as const, width: 14, height: 14 }}>
                      {/* Glow layer */}
                      <div style={{
                        position: "absolute" as const, width: 7, height: 7, borderRadius: "50%",
                        background: r.includedInAverage ? GREEN : "rgba(0,0,0,0.12)",
                        opacity: r.includedInAverage ? 0.28 : 0.5,
                        filter: r.includedInAverage ? "blur(3px)" : "none",
                      }} />
                      {/* Sharp dot */}
                      <div style={{
                        position: "absolute" as const, width: 5, height: 5, borderRadius: "50%",
                        background: r.includedInAverage ? GREEN : "rgba(0,0,0,0.2)",
                      }} />
                    </div>

                    {/* IPP value — right-aligned */}
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: r.includedInAverage ? GREEN : "rgba(0,0,0,0.25)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                        {fmtIpp(r.marketIpp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: inspector */}
            <div key={selectedId ?? "empty"} className="ipp-insp" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <MarketInspector
                record={inspectorRecord}
                marketSeries={selectedMarketSeries}
                averageIppYtd={selectedMarketSeries?.averageIppYtd ?? 0}
                inspectorMonthLabel={inspectorMonthLabel ?? selectedRecord?.redMonatLabel ?? null}
                onMonthChange={(label) => setInspectorMonthLabel(label)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
