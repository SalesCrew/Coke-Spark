"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Check, ClipboardList, Zap, Refrigerator, FlaskConical, ShoppingBag,
  Upload, Calendar, ChevronRight, Users, FileSpreadsheet,
  X, ChevronDown, AlertTriangle, CheckCircle2, Search,
} from "lucide-react";
import { readWorkbook, buildPreviewGrid, getColHeader, getColSample, isValidColLetter, excelColToIndex } from "@/utils/marketImport";
import { createCampaign, fetchCampaigns, fetchGmUsers, fetchMarkets, getCampaignOverlapConflicts, migrateCampaignMarkets } from "@/lib/api/backend";
import type { Campaign, CampaignMarketAssignmentInput, CampaignMarketOverlapConflict, CampaignSection } from "@/types/campaign";
import type { GMRecord } from "@/types/gebietsmanager";
import type { RedMonthPeriod } from "@/types/red-month";
import { useRedMonth } from "@/context/RedMonthContext";

// ── Colors ────────────────────────────────────────────────────
const R = "#DC2626";
const RD = "#b91c1c";
const R_BG = "rgba(220,38,38,0.06)";
const R_BORDER = "rgba(220,38,38,0.18)";

// ── Local flow types ──────────────────────────────────────────
type NeuMarketItem = {
  id: string;
  name: string;
  region: string;
  gm: string;
};

type NeuMarketCandidate = NeuMarketItem & {
  address?: string;
  postalCode?: string;
  city?: string;
  standardMarketNumber?: string;
  cokeMasterNumber?: string;
  kuehlerStammnr?: string;
  flexNumber?: string;
  marketType?: "universum" | "kuehler" | "both";
  isActive?: boolean;
};

type CampaignMatchMode = "flex" | "kuehler_stammnr";

type MarketMatchStatus = "matched" | "unmatched" | "ambiguous";
type MarketMatchResult = {
  row: NeuMarketItem;
  status: MarketMatchStatus;
  marketId: string | null;
  candidateIds: string[];
  reason: string;
};

type GmMatchIssueKind = "missing" | "unmatched" | "ambiguous" | "conflict";
type GmMatchIssue = {
  rowId: string;
  marketId: string;
  gmName: string;
  gmOverrideKey: string;
  gmOverrideLabel: string;
  kind: GmMatchIssueKind;
  candidateUserIds: string[];
};

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
    const digitsWithoutLeadingZeros = digitsOnly.replace(/^0+/, "") || "0";
    keys.add(digitsWithoutLeadingZeros);
  }

  return Array.from(keys).filter(Boolean);
}

function normalizeStammnrForCampaignMatch(value: string | undefined | null): string {
  const raw = String(value ?? "").trim().toLowerCase().replace(/^'+/, "");
  if (!raw) return "";
  const withoutWhitespace = raw.replace(/\s+/g, "");
  return withoutWhitespace;
}

function getMarketStammnrCandidates(market: NeuMarketCandidate): string[] {
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

function buildMarketMatchReport(
  rows: NeuMarketItem[],
  allMarkets: NeuMarketCandidate[],
  isAuto: boolean,
  matchMode: CampaignMatchMode,
): { results: MarketMatchResult[]; matchedIds: string[]; unmatched: number; ambiguous: number } {
  if (isAuto) {
    const matchedIds = Array.from(new Set(allMarkets.map((market) => market.id)));
    return {
      results: [],
      matchedIds,
      unmatched: 0,
      ambiguous: 0,
    };
  }

  if (matchMode === "kuehler_stammnr") {
    const byCanonicalStammnr = new Map<string, NeuMarketCandidate[]>();
    for (const market of allMarkets) {
      const keys = getMarketStammnrCandidates(market);
      for (const key of keys) {
        const bucket = byCanonicalStammnr.get(key) ?? [];
        bucket.push(market);
        byCanonicalStammnr.set(key, bucket);
      }
    }

    const results: MarketMatchResult[] = rows.map((row) => {
      const canonical = normalizeStammnrForCampaignMatch(row.name);
      if (!canonical) {
        return { row, status: "unmatched", marketId: null, candidateIds: [], reason: "none" };
      }
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
  const identityIndex = new Map<string, NeuMarketCandidate[]>();
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

    const candidateMap = new Map<string, NeuMarketCandidate>();
    for (const key of buildFlexMatcherKeys(row.name)) {
      const markets = identityIndex.get(key) ?? [];
      for (const market of markets) {
        candidateMap.set(market.id, market);
      }
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

  const matchedIds = Array.from(new Set(results.filter((result) => result.status === "matched" && result.marketId).map((result) => result.marketId as string)));
  return {
    results,
    matchedIds,
    unmatched: results.filter((result) => result.status === "unmatched").length,
    ambiguous: results.filter((result) => result.status === "ambiguous").length,
  };
}

function matcherReasonLabel(reason: string) {
  if (reason === "uuid") return "UUID";
  if (reason === "flex_number") return "Flexnummer";
  if (reason === "flex_number_partial") return "Flexnummer (Teiltreffer)";
  if (reason === "kuehler_stammnr") return "Stammnr";
  return "Kein Match";
}

function normalizeRegionLabel(region: string | undefined | null) {
  const value = String(region ?? "").trim();
  if (!value) return "Unbekannt";
  return value;
}

function getYearRangeYmd(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function clampPeriodToYearRange(
  period: { start: string; end: string },
  yearRange: { from: string; to: string },
): { start: string; end: string } {
  return {
    start: period.start < yearRange.from ? yearRange.from : period.start,
    end: period.end > yearRange.to ? yearRange.to : period.end,
  };
}

const CAMPAIGN_TYPES = [
  { id: "standard",    label: "Standardbesuch",  icon: ClipboardList, color: R,         bg: R_BG,                      border: R_BORDER,                      autoMarkets: false },
  { id: "flex",        label: "Flexbesuch",       icon: Zap,           color: "#84CC16", bg: "rgba(132,204,22,0.06)",   border: "rgba(132,204,22,0.2)",        autoMarkets: true  },
  { id: "kuehler",     label: "Kühlerinventur",   icon: Refrigerator,  color: "#D97706", bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.2)",        autoMarkets: false },
  { id: "mhd",         label: "MHD",              icon: FlaskConical,  color: "#7C3AED", bg: "rgba(124,58,237,0.06)",   border: "rgba(124,58,237,0.2)",        autoMarkets: false },
  { id: "billa",       label: "Billa",            icon: ShoppingBag,   color: "#0891B2", bg: "rgba(8,145,178,0.06)",    border: "rgba(8,145,178,0.2)",         autoMarkets: false },
];

const STEPS = [
  { id: 1, label: "Typ",       sub: "Kampagnentyp wählen"     },
  { id: 2, label: "Details",   sub: "Name & Zeitraum"          },
  { id: 3, label: "Märkte",    sub: "Märkte importieren"       },
  { id: 4, label: "Übersicht", sub: "Prüfen & erstellen"       },
];

// ── Date Picker ───────────────────────────────────────────────
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function DatePicker({ value, onChange, placeholder = "Datum wählen", disabled = false, accentColor = R, accentBg = R_BG }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; accentColor?: string; accentBg?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updateDirection = () => {
      const rootRect = ref.current?.getBoundingClientRect();
      if (!rootRect) return;
      const spaceBelow = window.innerHeight - rootRect.bottom;
      const estimatedPopupHeight = 300;
      setOpenUpward(spaceBelow < estimatedPopupHeight);
    };
    updateDirection();
    window.addEventListener("resize", updateDirection);
    window.addEventListener("scroll", updateDirection, true);
    return () => {
      window.removeEventListener("resize", updateDirection);
      window.removeEventListener("scroll", updateDirection, true);
    };
  }, [open]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function select(d: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }
  function prev() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function next() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }

  const display = parsed ? parsed.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
          background: disabled ? "rgba(0,0,0,0.015)" : "#fff",
          border: `1px solid ${open ? accentColor : "rgba(0,0,0,0.08)"}`,
          boxShadow: open ? `0 0 0 3px ${accentBg}` : "none",
          color: display ? "#111" : "rgba(0,0,0,0.25)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease", opacity: disabled ? 0.45 : 1,
        }}
      >
        <span style={{ fontWeight: display ? 500 : 400 }}>{display || placeholder}</span>
        <Calendar size={13} strokeWidth={1.6} color="rgba(0,0,0,0.3)" />
      </button>

      {open && !disabled && (
        <div style={{
          position: "absolute",
          ...(openUpward ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
          left: 0,
          zIndex: 300,
          background: "#fff", borderRadius: 12, userSelect: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          padding: "14px 14px 10px", width: 248,
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "rgba(0,0,0,0.4)", fontSize: 16, lineHeight: 1, transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={next} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "rgba(0,0,0,0.4)", fontSize: 16, lineHeight: 1, transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEKDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", paddingBottom: 6, letterSpacing: "0.04em" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isTdy = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSel = parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear();
              return (
                <button key={i} type="button" onClick={() => select(d)} style={{
                  width: "100%", aspectRatio: "1", borderRadius: 7, border: "none",
                  background: isSel ? `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))` : isTdy ? accentBg : "transparent",
                  color: isSel ? "#fff" : isTdy ? accentColor : "#1a1a1a",
                  fontSize: 11, fontWeight: isSel || isTdy ? 600 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: isSel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${accentColor}` : "none",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isTdy ? accentBg : "transparent"; }}
                >{d}</button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5 }} onMouseEnter={e => (e.currentTarget.style.color = accentColor)} onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>Löschen</button>
          </div>
        </div>
      )}
    </div>
  );
}

type WhiteSelectOption = {
  value: string;
  label: string;
};

function WhiteSelect({
  value,
  onChange,
  options,
  placeholder = "GM manuell auswählen…",
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
          border: "1px solid rgba(124,45,18,0.25)",
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

// ── Step 1: Type selection ────────────────────────────────────
function StepTyp({ selected, onSelect, onNext, onCancel, accentColor, accentBg }: {
  selected: string; onSelect: (id: string) => void;
  onNext: () => void; onCancel: () => void;
  accentColor: string; accentBg: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Kampagnentyp wählen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0, fontWeight: 400 }}>Wähle den Typ der Kampagne, die du erstellen möchtest.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {CAMPAIGN_TYPES.map((t) => {
          const Icon = t.icon;
          const isSel = selected === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: "20px 18px",
                borderRadius: 12,
                border: `1.5px solid ${isSel ? t.color : "rgba(0,0,0,0.07)"}`,
                backgroundColor: isSel ? t.bg : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: isSel ? `0 0 0 3px ${t.bg}, 0 2px 8px rgba(0,0,0,0.06)` : "0 1px 4px rgba(0,0,0,0.04)",
                position: "relative",
              }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.14)"; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.07)"; }}
            >
              {isSel && (
                <div style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderRadius: "50%", backgroundColor: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={10} strokeWidth={2.5} color="#fff" />
                </div>
              )}
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isSel ? t.color : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                <Icon size={18} strokeWidth={1.8} color={isSel ? "#fff" : "rgba(0,0,0,0.4)"} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.015em", marginBottom: 4 }}>{t.label}</div>
                {t.autoMarkets && (
                  <div style={{ fontSize: 10, color: t.color, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: t.color }} />
                    Alle Märkte automatisch
                  </div>
                )}
                {!t.autoMarkets && (
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>Märkte manuell importieren</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom buttons inside the card */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 20, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
            fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
            background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: "rgba(0,0,0,0.5)",
            boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          }}
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onNext}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 22px",
            fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
            background: `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`,
            color: "#fff",
            boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${accentColor}, 0 1px 6px ${accentColor}44`,
            transition: "all 0.25s ease",
          }}
        >
          Weiter
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Details ───────────────────────────────────────────
function StepDetails({
  name,
  setName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  startNow,
  setStartNow,
  timeframeMode,
  setTimeframeMode,
  redMonthPeriods,
  redMonthYearRange,
  selectedRedMonthId,
  onSelectRedMonth,
  redMonthLoading,
  redMonthError,
  accentColor = R,
  accentBg = R_BG,
}: {
  name: string; setName: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  startNow: boolean; setStartNow: (v: boolean) => void;
  timeframeMode: "dates" | "redmonth";
  setTimeframeMode: (v: "dates" | "redmonth") => void;
  redMonthPeriods: RedMonthPeriod[];
  redMonthYearRange: { from: string; to: string };
  selectedRedMonthId: string;
  onSelectRedMonth: (period: RedMonthPeriod) => void;
  redMonthLoading: boolean;
  redMonthError: string | null;
  accentColor?: string; accentBg?: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [nameFocused, setNameFocused] = useState(false);

  function fmt(iso: string) {
    if (!iso) return null;
    return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" });
  }

  // Red-Monat UI stays identical across campaign types.
  const redMonthAccentColor = R;
  const redMonthAccentBg = R_BG;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", letterSpacing: "-0.03em", margin: "0 0 5px" }}>Details festlegen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.36)", margin: 0, fontWeight: 400, letterSpacing: "-0.005em" }}>Name und Zeitraum der Kampagne</p>
      </div>

      {/* Name field */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 9 }}>Kampagnenname</div>
        <div style={{
          borderRadius: 9,
          border: `1px solid ${nameFocused ? accentColor : "rgba(0,0,0,0.08)"}`,
          boxShadow: nameFocused ? `0 0 0 3px ${accentBg}` : "none",
          background: "#fff",
          transition: "border-color 0.15s, box-shadow 0.15s",
          overflow: "hidden",
        }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="z. B. Standardbesuch KW14"
            style={{
              fontSize: 13, fontWeight: 500, color: "#111",
              padding: "10px 14px", width: "100%", boxSizing: "border-box",
              background: "transparent", border: "none", outline: "none",
              fontFamily: "inherit", letterSpacing: "-0.01em",
            }}
          />
        </div>
        {name && (
          <div style={{ marginTop: 7, fontSize: 11, color: "rgba(0,0,0,0.32)", fontWeight: 400, paddingLeft: 2, letterSpacing: "-0.005em" }}>
            Kampagne wird als <span style={{ fontWeight: 600, color: "rgba(0,0,0,0.55)" }}>&ldquo;{name}&rdquo;</span> gespeichert
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", margin: "28px 0" }} />

      {/* Zeitraum */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Zeitraum</div>

          {/* Jetzt starten toggle */}
          <button
            type="button"
            onClick={() => {
              const nextStartNow = !startNow;
              setStartNow(nextStartNow);
              if (nextStartNow) {
                setStartDate(today);
                setTimeframeMode("dates");
              }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 8px",
              borderRadius: 20, border: `1px solid ${startNow ? accentColor : "rgba(0,0,0,0.09)"}`,
              background: startNow ? accentBg : "#fff",
              cursor: "pointer", transition: "all 0.18s ease",
              boxShadow: startNow ? `0 0 0 2px ${accentBg}` : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: startNow ? `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))` : "rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s",
              boxShadow: startNow ? `0 1px 4px ${accentColor}55` : "none",
              flexShrink: 0,
            }}>
              {startNow && <Check size={9} strokeWidth={3} color="#fff" />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: startNow ? accentColor : "rgba(0,0,0,0.4)", transition: "color 0.15s", letterSpacing: "-0.005em" }}>Jetzt starten</span>
          </button>
        </div>

        <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", padding: 3, background: "rgba(0,0,0,0.02)", marginBottom: 12 }}>
          {([
            { id: "dates", label: "Datum" },
            { id: "redmonth", label: "Red-Monat" },
          ] as const).map((mode) => {
            const active = timeframeMode === mode.id;
            const modeAccentColor = mode.id === "redmonth" ? redMonthAccentColor : accentColor;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  if (mode.id === "redmonth" && startNow) {
                    setStartNow(false);
                  }
                  setTimeframeMode(mode.id);
                }}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  background: active ? "#fff" : "transparent",
                  color: active ? modeAccentColor : "rgba(0,0,0,0.45)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {timeframeMode === "redmonth" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {redMonthLoading ? (
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.42)" }}>Red-Monate werden geladen...</div>
            ) : redMonthPeriods.length === 0 ? (
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.42)" }}>
                Keine Red-Monat-Perioden verfügbar. Bitte Datumsauswahl verwenden.
              </div>
            ) : (
              <>
                <div
                  className="redMonthList"
                  style={{ maxHeight: "clamp(220px, 52vh, 560px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2, scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  <style>{`.redMonthList::-webkit-scrollbar{display:none}`}</style>
                  {redMonthPeriods.map((period) => {
                    const clamped = clampPeriodToYearRange(period, redMonthYearRange);
                    const selected = selectedRedMonthId === period.id;
                    return (
                      <button
                        key={period.id}
                        type="button"
                        onClick={() => onSelectRedMonth(period)}
                        style={{
                          border: `1px solid ${selected ? redMonthAccentColor : "rgba(0,0,0,0.08)"}`,
                          background: selected ? redMonthAccentBg : "#fff",
                          color: selected ? redMonthAccentColor : "rgba(0,0,0,0.68)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em" }}>{period.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 500, marginTop: 2 }}>
                          {fmt(clamped.start)} → {fmt(clamped.end)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedRedMonthId && (
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 600, letterSpacing: "-0.005em" }}>
                    Zeitraum gesetzt auf ausgewählten Red-Monat.
                  </div>
                )}
              </>
            )}
            {redMonthError && (
              <div style={{ fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>{redMonthError}</div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em" }}>Von</span>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Startdatum wählen" disabled={startNow} accentColor={accentColor} accentBg={accentBg} />
              {startNow && (
                <span style={{ fontSize: 10, color: accentColor, fontWeight: 600, letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: accentColor, flexShrink: 0 }} />
                  Startet heute
                </span>
              )}
            </div>

            {/* Arrow between */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "30px 16px 0" }}>
              <svg width="16" height="2" viewBox="0 0 16 2" fill="none"><line x1="0" y1="1" x2="16" y2="1" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em" }}>Bis</span>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="Enddatum wählen" accentColor={accentColor} accentBg={accentBg} />
            </div>
          </div>
        )}

        {/* Duration hint */}
        {startDate && endDate && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2"/><path d="M6.5 3.5v3l2 1.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontWeight: 500, letterSpacing: "-0.005em" }}>
              {fmt(startDate)} &nbsp;→&nbsp; {fmt(endDate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Neu-Kampagne: embedded Excel import wizard ─────────────────

function getNeuFields(matchMode: CampaignMatchMode) {
  return [
    { key: "name", label: matchMode === "kuehler_stammnr" ? "Stammnr" : "Flexnummer", required: true },
    { key: "gm", label: "Mitarbeiter", required: false },
  ] as const;
}

type NeuColMapping = Partial<Record<"name" | "gm", string>>;
type NeuStep = "upload" | "review" | "summary";

function NeuImportWizard({ typeId, onLoad }: { typeId: string; onLoad: (m: NeuMarketItem[]) => void }) {
  const [step, setStep] = useState<NeuStep>("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wb, setWb] = useState<Awaited<ReturnType<typeof readWorkbook>> | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<NeuColMapping>({});
  const [summaryCount, setSummaryCount] = useState({ created: 0, skipped: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const matchMode: CampaignMatchMode = typeId === "kuehler" ? "kuehler_stammnr" : "flex";
  const neuFields = useMemo(() => getNeuFields(matchMode), [matchMode]);

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
      setStep("review");
    } catch (err) {
      setParseError(String(err));
    } finally {
      setParsing(false);
    }
  }, []);

  const preview = useMemo(() => wb ? buildPreviewGrid(wb.rows) : null, [wb]);

  const colError = useCallback((key: string, val: string): string | null => {
    if (!val) return null;
    if (!isValidColLetter(val)) return "Ungültige Spalte";
    // Duplicate check
    const others = neuFields.filter(f => f.key !== key);
    for (const o of others) {
      const ov = mapping[o.key as keyof NeuColMapping] ?? "";
      if (ov && isValidColLetter(ov) && excelColToIndex(ov) === excelColToIndex(val)) {
        return `Selbe Spalte wie "${o.label}"`;
      }
    }
    return null;
  }, [mapping, neuFields]);

  const canImport = useMemo(() => {
    return neuFields.filter(f => f.required).every(f => {
      const val = mapping[f.key as keyof NeuColMapping] ?? "";
      return val && isValidColLetter(val) && !colError(f.key, val);
    }) && !neuFields.some(f => {
      const val = mapping[f.key as keyof NeuColMapping] ?? "";
      return val && colError(f.key, val);
    });
  }, [mapping, colError, neuFields]);

  const handleImport = useCallback(() => {
    if (!wb || isImporting) return;
    setIsImporting(true);
    try {
      const dataRows = wb.rows.slice(1);
      let created = 0;
      let skipped = 0;
      const result: NeuMarketItem[] = [];
      dataRows.forEach((row, idx) => {
        if (row.every(c => !c?.trim())) { skipped++; return; }
        const get = (key: keyof NeuColMapping) => {
          const col = mapping[key] ?? "";
          if (!col || !isValidColLetter(col)) return "";
          return row[excelColToIndex(col)]?.trim() ?? "";
        };
        const name = get("name");
        const gm = get("gm");
        const safeGm = isTemporaryGmName(gm) ? "" : gm;
        if (!name) { skipped++; return; }
        result.push({ id: `xi-${idx}-${Date.now()}`, name: name || "—", region: "", gm: safeGm || "" });
        created++;
      });
      setSummaryCount({ created, skipped });
      onLoad(result);
      setStep("summary");
    } finally {
      setIsImporting(false);
    }
  }, [wb, mapping, onLoad, isImporting]);

  // ── Shared scrollbar style injected once ───────────────────
  const scrollbarStyle = `
    .neu-imp-scroll::-webkit-scrollbar{width:4px;height:4px}
    .neu-imp-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}
    .neu-imp-scroll::-webkit-scrollbar-track{background:transparent}
    .neu-imp-scroll{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.12) transparent}
    .neu-imp-input:focus{outline:none;border-bottom-color:${R} !important}
  `;

  if (step === "upload") {
    return (
      <>
        <style>{scrollbarStyle}</style>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? R : "rgba(0,0,0,0.10)"}`, borderRadius: 14, padding: "40px 24px", backgroundColor: dragging ? R_BG : "rgba(0,0,0,0.012)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer", transition: "all 0.18s ease", textAlign: "center" }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files)} />
          <div style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: dragging ? R_BG : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {parsing
              ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${R}`, borderTopColor: "transparent", animation: "neuSpin 0.7s linear infinite" }} />
              : <FileSpreadsheet size={22} strokeWidth={1.5} color={dragging ? R : "rgba(0,0,0,0.28)"} />
            }
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? R : "#1a1a1a", letterSpacing: "-0.012em", marginBottom: 4 }}>
              {parsing ? "Datei wird gelesen…" : "Excel-Datei hier ablegen"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.32)", fontWeight: 400 }}>oder klicken zum Auswählen · .xlsx, .xls</div>
          </div>
          <button type="button" style={{ marginTop: 2, padding: "8px 20px", fontSize: 11, fontWeight: 600, borderRadius: 8, background: "linear-gradient(to bottom,#fff,#f5f5f5)", cursor: "pointer", border: "none", color: "rgba(0,0,0,0.48)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),inset 0 -1px 0 rgba(0,0,0,0.04),0 0 0 1px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.07)" }}>
            <Upload size={10} strokeWidth={2} style={{ marginRight: 6, display: "inline", verticalAlign: "middle" }} />
            Datei auswählen
          </button>
          <style>{`@keyframes neuSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
        {parseError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", marginTop: -8 }}>
            <AlertTriangle size={12} strokeWidth={2} color={R} />
            <span style={{ fontSize: 11, color: R, fontWeight: 500 }}>Fehler: {parseError}</span>
          </div>
        )}
      </>
    );
  }

  if (step === "review" && wb && preview) {
    return (
      <>
        <style>{scrollbarStyle}</style>
        <div style={{ display: "flex", flexDirection: "column", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden", width: "100%", minWidth: 0 }}>
          {/* Header — fixed */}
          <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <FileSpreadsheet size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{wb.sheetName} · {wb.rows.length - 1} Zeilen</span>
            <button type="button" onClick={() => { setStep("upload"); setWb(null); setMapping({}); }} style={{ display: "flex", border: "none", background: "rgba(0,0,0,0.05)", borderRadius: 5, cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.4)" }}>
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>

          {/* Scrollable body: table + mapping */}
          <div className="neu-imp-scroll" style={{ flex: 1, overflow: "auto" }}>

            {/* Preview table — horizontal scroll */}
            <div style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
              <div className="neu-imp-scroll" style={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "hidden" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed", minWidth: "max-content" }}>
                  <colgroup>
                    <col style={{ width: 32 }} />
                    {preview.colLetters.map((_l, i) => <col key={i} style={{ width: 100 }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", width: 32 }} />
                      {preview.colLetters.map(l => (
                        <th key={l} style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8f8f8", borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "4px 7px", textAlign: "center", fontWeight: 700, color: "rgba(0,0,0,0.4)", fontSize: 8, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{l}</th>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: "sticky", left: 0, zIndex: 2, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "3px 5px", textAlign: "right", fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.25)" }}>1</td>
                      {preview.headerRow.map((h, ci) => (
                        <td key={ci} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "3px 7px", fontWeight: 600, color: "#1a1a1a", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{h}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.slice(0, 20).map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)" }}>
                        <td style={{ position: "sticky", left: 0, background: ri % 2 === 0 ? "#f8f8f8" : "#f3f3f3", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "2px 5px", textAlign: "right", fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.22)" }}>{preview.rowNumbers[ri]}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ borderRight: "1px solid rgba(0,0,0,0.03)", padding: "2px 7px", color: cell ? "#374151" : "rgba(0,0,0,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100, fontSize: 10 }}>{cell || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column mapping */}
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>Spaltenzuweisung</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${neuFields.length}, 1fr)`, gap: "6px 12px" }}>
                {neuFields.map(spec => {
                  const val = mapping[spec.key as keyof NeuColMapping] ?? "";
                  const err = colError(spec.key, val);
                  const header = val && !err ? getColHeader(wb.rows, val) : null;
                  const sample = val && !err ? getColSample(wb.rows, val) : null;
                  return (
                    <div key={spec.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: err ? R : "rgba(0,0,0,0.5)", flex: 1 }}>{spec.label}</span>
                        {spec.required && <span style={{ fontSize: 7, fontWeight: 700, color: R, background: "rgba(220,38,38,0.07)", padding: "1px 4px", borderRadius: 3 }}>P</span>}
                      </div>
                      <input
                        type="text"
                        value={val}
                        maxLength={3}
                        placeholder="—"
                        className="neu-imp-input"
                        onChange={e => setMapping(m => ({ ...m, [spec.key]: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() }))}
                        style={{ fontSize: 12, fontWeight: 700, fontFamily: "inherit", textTransform: "uppercase", padding: "4px 0", border: "none", borderBottom: `1.5px solid ${err ? "rgba(220,38,38,0.4)" : val ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.1)"}`, outline: "none", background: "transparent", color: err ? R : "#1a1a1a", transition: "border-color 0.15s", width: "100%" }}
                      />
                      {!err && val && (header !== null || sample !== null) && (
                        <div style={{ fontSize: 8, color: "rgba(0,0,0,0.38)", lineHeight: 1.4 }}>
                          {header && <span style={{ fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{header.substring(0, 16)}</span>}
                          {sample && <span style={{ marginLeft: header ? 3 : 0 }}>{sample.substring(0, 16)}</span>}
                        </div>
                      )}
                      {err && <div style={{ fontSize: 8, color: R, fontWeight: 500 }}>{err}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.28)" }}>A = 1. Spalte · Z = 26. · AA = 27.</div>
            </div>
          </div>

          {/* Footer — fixed */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "flex-end", gap: 8, background: "rgba(0,0,0,0.01)", flexShrink: 0 }}>
            <button type="button" onClick={() => { setStep("upload"); setWb(null); setMapping({}); }} style={{ padding: "6px 13px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}>← Zurück</button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport || isImporting}
              style={{ padding: "6px 16px", fontSize: 11, fontWeight: 700, borderRadius: 7, border: "none", cursor: canImport && !isImporting ? "pointer" : "not-allowed", color: "#fff", background: canImport && !isImporting ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.15)", boxShadow: canImport && !isImporting ? `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 4px rgba(180,20,20,0.14)` : "none", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s", fontFamily: "inherit" }}
            >
              <Upload size={10} strokeWidth={2} /> {isImporting ? "Importiere..." : "Importieren"}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (step === "summary") {
    return (
      <>
        <style>{scrollbarStyle}</style>
        <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "12px 14px", background: "rgba(22,163,74,0.04)", borderBottom: "1px solid rgba(22,163,74,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={14} strokeWidth={2} color="#16a34a" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", flex: 1 }}>Import abgeschlossen</span>
          </div>
          {/* Stats */}
          <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.4)", marginBottom: 4 }}>Gesamt</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "rgba(0,0,0,0.55)", letterSpacing: "-0.04em" }}>{summaryCount.created + summaryCount.skipped}</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.14)" }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#16a34a", opacity: 0.8, marginBottom: 4 }}>Importiert</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.04em" }}>{summaryCount.created}</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: summaryCount.skipped > 0 ? "rgba(217,119,6,0.05)" : "rgba(0,0,0,0.02)", border: `1px solid ${summaryCount.skipped > 0 ? "rgba(217,119,6,0.14)" : "rgba(0,0,0,0.06)"}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: summaryCount.skipped > 0 ? "#d97706" : "rgba(0,0,0,0.35)", opacity: 0.8, marginBottom: 4 }}>Übersprungen</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: summaryCount.skipped > 0 ? "#d97706" : "rgba(0,0,0,0.35)", letterSpacing: "-0.04em" }}>{summaryCount.skipped}</div>
            </div>
          </div>
          <div style={{ padding: "0 14px 14px", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setStep("upload"); setWb(null); setMapping({}); }} style={{ padding: "5px 13px", fontSize: 10, fontWeight: 600, borderRadius: 7, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}>
              Neue Datei importieren
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ── Step 3: Markets ───────────────────────────────────────────
function StepMaerkte({
  typeId,
  markets,
  onLoad,
  matchSummary,
  matchIssues,
  strictIdentityMode,
  gmIssues,
  gmUsers,
  gmOverridesByKey,
  onSetGmOverrideForKey,
}: {
  typeId: string;
  markets: NeuMarketCandidate[];
  onLoad: (m: NeuMarketItem[]) => void;
  matchSummary?: {
    matched: number;
    unmatched: number;
    ambiguous: number;
    unresolved: number;
  };
  matchIssues?: MarketMatchResult[];
  strictIdentityMode?: boolean;
  gmIssues?: GmMatchIssue[];
  gmUsers?: GMRecord[];
  gmOverridesByKey?: Record<string, string>;
  onSetGmOverrideForKey?: (overrideKey: string, gmUserId: string) => void;
}) {
  const isAuto = CAMPAIGN_TYPES.find(t => t.id === typeId)?.autoMarkets ?? false;
  const isFlexCampaign = typeId === "flex";
  const hasMarkets = markets.length > 0;
  const isKuehlerCampaign = typeId === "kuehler";
  const unresolvedIssues = matchIssues ?? [];
  const hasUnresolvedIssues = unresolvedIssues.length > 0;
  const hasImportedState = hasMarkets || (Boolean(strictIdentityMode) && hasUnresolvedIssues);
  const unresolvedGmIssues = useMemo(
    () => (gmIssues ?? []).filter((issue) => issue.kind === "missing" || issue.kind === "unmatched" || issue.kind === "ambiguous" || issue.kind === "conflict"),
    [gmIssues],
  );
  const unresolvedGmIssueGroups = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; kind: GmMatchIssueKind; count: number }>();
    for (const issue of unresolvedGmIssues) {
      const existing = byKey.get(issue.gmOverrideKey);
      if (existing) {
        existing.count += 1;
        continue;
      }
      byKey.set(issue.gmOverrideKey, {
        key: issue.gmOverrideKey,
        label: issue.gmOverrideLabel,
        kind: issue.kind,
        count: 1,
      });
    }
    return Array.from(byKey.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }, [unresolvedGmIssues]);

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = isKuehlerCampaign
      ? {}
      : { Nord: 0, Ost: 0, Süd: 0, West: 0 };
    markets.forEach((market) => {
      const key = normalizeRegionLabel(market.region);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [isKuehlerCampaign, markets]);

  const regionCardOrder = useMemo(() => {
    if (!isKuehlerCampaign) return ["Nord", "Ost", "Süd", "West"];
    const preferred = ["Nord", "Ost", "Süd", "West", "Mitte", "Unbekannt"];
    const present = Object.keys(regionCounts).filter((region) => (regionCounts[region] ?? 0) > 0);
    const ordered = [
      ...preferred.filter((region) => present.includes(region)),
      ...present.filter((region) => !preferred.includes(region)).sort((left, right) => left.localeCompare(right, "de")),
    ];
    return ordered.length > 0 ? ordered : ["Unbekannt"];
  }, [isKuehlerCampaign, regionCounts]);

  const gmMap: Record<string, number> = {};
  markets.forEach(m => { gmMap[m.gm] = (gmMap[m.gm] || 0) + 1; });
  const gms = Object.entries(gmMap).sort((a, b) => b[1] - a[1]);

  const uniqueGms = Object.keys(gmMap).length;
  const uniqueRegions = regionCardOrder.filter((region) => (regionCounts[region] ?? 0) > 0).length;

  const regionColors: Record<string, string> = {
    Nord: "#0891B2",
    Ost: "#DC2626",
    Süd: "#16a34a",
    West: "#D97706",
    Mitte: "#7C3AED",
    Unbekannt: "#6B7280",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, overflow: "hidden", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>
            {isAuto ? "Märkte automatisch zuweisen" : "Märkte importieren"}
          </h3>
          <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0 }}>
            {isAuto
              ? `${markets.length} aktive ${isFlexCampaign ? "Universumsmärkte" : "Märkte"} automatisch enthalten · ${uniqueGms} GMs · ${uniqueRegions} Regionen`
              : hasImportedState
                ? `${markets.length} Märkte geladen · ${uniqueGms} GMs · ${uniqueRegions} Regionen`
                : "Importiere die Märkte per Excel."}
          </p>
          {!isAuto && matchSummary && (
            <p style={{ fontSize: 11, color: hasUnresolvedIssues ? "#b45309" : "rgba(0,0,0,0.35)", margin: "6px 0 0", fontWeight: 600 }}>
              Match: {matchSummary.matched} · Unklar: {matchSummary.ambiguous} · Nicht gefunden: {matchSummary.unmatched}
            </p>
          )}
        </div>
        {hasImportedState && !isAuto && (
          <button
            type="button"
            onClick={() => onLoad([])}
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: "none",
              cursor: "pointer", color: "rgba(0,0,0,0.4)",
              background: "rgba(0,0,0,0.04)", transition: "all 0.15s",
              flexShrink: 0, marginTop: 2,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = R; (e.currentTarget as HTMLButtonElement).style.background = R_BG; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}
          >
            Ändern
          </button>
        )}
      </div>

      {isAuto ? (
        <div style={{
          padding: "20px 22px", borderRadius: 12, border: "1.5px solid rgba(132,204,22,0.25)",
          backgroundColor: "rgba(132,204,22,0.05)", display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(132,204,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={18} strokeWidth={1.8} color="#65a30d" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.015em", marginBottom: 2 }}>
              {markets.length.toLocaleString("de-AT")} aktive {isFlexCampaign ? "Universumsmärkte" : "Märkte"} automatisch enthalten
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontWeight: 400 }}>
              {isFlexCampaign
                ? "Bei Flexbesuchen werden automatisch alle aktiven Universumsmärkte zugewiesen."
                : "Alle aktiven Märkte werden automatisch zugewiesen."}
            </div>
          </div>
        </div>
      ) : !hasImportedState ? (
        <NeuImportWizard typeId={typeId} onLoad={onLoad} />
      ) : (
        // ── Imported state ────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {strictIdentityMode && (
            <div style={{ borderRadius: 10, border: `1px solid ${hasUnresolvedIssues ? "rgba(180,83,9,0.26)" : "rgba(22,163,74,0.18)"}`, background: hasUnresolvedIssues ? "rgba(180,83,9,0.08)" : "rgba(22,163,74,0.06)", padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: hasUnresolvedIssues ? "#92400e" : "#166534", marginBottom: 4 }}>
                {hasUnresolvedIssues ? "Stammnr-Match unvollständig" : "Stammnr-Match vollständig"}
              </div>
              <div style={{ fontSize: 10, color: hasUnresolvedIssues ? "#92400e" : "rgba(0,0,0,0.5)", fontWeight: 500 }}>
                {hasUnresolvedIssues
                  ? "Nur eindeutig gematchte Märkte werden unten gezeigt. Korrigiere die offenen Stammnr-Werte, um weiterzugehen."
                  : "Alle importierten Stammnr-Werte wurden eindeutig Märkten zugeordnet."}
              </div>
              {hasUnresolvedIssues && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {unresolvedIssues.slice(0, 8).map((issue, index) => (
                    <div key={`${issue.row.id}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#7c2d12" }}>
                      <span style={{ fontWeight: 700 }}>{issue.row.name || "—"}</span>
                      <span>{issue.status === "ambiguous" ? "Mehrdeutig" : "Nicht gefunden"}</span>
                    </div>
                  ))}
                  {unresolvedIssues.length > 8 && (
                    <div style={{ fontSize: 10, color: "#7c2d12", fontWeight: 600 }}>
                      +{unresolvedIssues.length - 8} weitere offene Stammnr-Werte
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* Region breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Regionen</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, regionCardOrder.length))}, 1fr)`, gap: 8 }}>
              {regionCardOrder.map(name => {
                const count = regionCounts[name] || 0;
                const pct = markets.length > 0 ? Math.round((count / markets.length) * 100) : 0;
                const c = regionColors[name] ?? "#6B7280";
                return (
                  <div key={name} style={{
                    padding: "12px 14px", borderRadius: 10, border: `1px solid ${c}22`,
                    backgroundColor: `${c}08`, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c, letterSpacing: "0.01em" }}>{name}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, backgroundColor: `${c}20` }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: c, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{pct}% aller Märkte</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GMs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gebietsmanager</span>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.055)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
              {gms.map(([gm, count], i) => {
                const pct = Math.round((count / markets.length) * 100);
                return (
                  <div key={gm} style={{
                    display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
                    borderBottom: i < gms.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    backgroundColor: "#fff",
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.03))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Users size={13} strokeWidth={1.7} color="rgba(0,0,0,0.32)" />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{gm}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 64, height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.18)", transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 500, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count} {count === 1 ? "Markt" : "Märkte"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {unresolvedGmIssueGroups.length > 0 && gmUsers && onSetGmOverrideForKey && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", letterSpacing: "0.08em", textTransform: "uppercase" }}>GM-Zuordnung prüfen</span>
              <div style={{ borderRadius: 11, border: "1px solid rgba(180,83,9,0.22)", background: "rgba(180,83,9,0.07)", overflow: "hidden" }}>
                {unresolvedGmIssueGroups.slice(0, 20).map((group, idx) => {
                  return (
                    <div
                      key={`${group.key}-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1.5fr",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: idx < Math.min(unresolvedGmIssueGroups.length, 20) - 1 ? "1px solid rgba(180,83,9,0.16)" : "none",
                        background: "rgba(255,255,255,0.72)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7c2d12" }}>{group.label}</span>
                        <span style={{ fontSize: 10, color: "rgba(124,45,18,0.9)" }}>
                          Betroffene Zeilen: {group.count}
                        </span>
                        <span style={{ fontSize: 9, color: "rgba(124,45,18,0.85)", fontWeight: 600 }}>
                          {group.kind === "missing" ? "Kein GM im Importwert" : group.kind === "unmatched" ? "Kein GM gefunden" : group.kind === "ambiguous" ? "Mehrdeutiger GM" : "Konflikt bei GM-Zuordnung"}
                        </span>
                      </div>
                      <WhiteSelect
                        value={gmOverridesByKey?.[group.key] ?? ""}
                        onChange={(next) => onSetGmOverrideForKey(group.key, next)}
                        options={gmUsers.map((gm) => ({
                          value: gm.id,
                          label: `${gm.firstName} ${gm.lastName} · ${gm.email}`,
                        }))}
                        placeholder="GM manuell auswählen…"
                      />
                    </div>
                  );
                })}
                {unresolvedGmIssueGroups.length > 20 && (
                  <div style={{ padding: "8px 12px", fontSize: 10, color: "#92400e", fontWeight: 600, borderTop: "1px solid rgba(180,83,9,0.16)" }}>
                    +{unresolvedGmIssueGroups.length - 20} weitere Importwerte in Schritt 4
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Market table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Märkte</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>{markets.length} gesamt</span>
            </div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.055)", overflow: "hidden", maxHeight: 240, overflowY: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", scrollbarWidth: "none" } as React.CSSProperties}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 70px", padding: "7px 16px", backgroundColor: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.055)" }}>
                {["Markt", "Adresse", "Ort", "Region"].map(h => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>
              {markets.map((m, i) => (
                <div key={m.id} style={{
                  display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 70px",
                  alignItems: "center", padding: "9px 16px",
                  borderBottom: i < markets.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  backgroundColor: i % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", fontWeight: 400 }}>{m.address || "—"}</span>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", fontWeight: 400 }}>
                    {[m.postalCode, m.city].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ").trim() || "—"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: regionColors[m.region], letterSpacing: "0.01em" }}>{m.region}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────
function StepUebersicht({ typeId, name, startDate, endDate, startNow, markets }: {
  typeId: string; name: string; startDate: string; endDate: string; startNow: boolean;
  markets: NeuMarketCandidate[];
}) {
  const t = CAMPAIGN_TYPES.find(c => c.id === typeId);
  const isKuehlerCampaign = typeId === "kuehler";
  const count = markets.length;

  function fmt(iso: string) {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const durationDays = startDate && endDate
    ? Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000)
    : null;

  const gmMap: Record<string, number> = {};
  markets.forEach(m => { gmMap[m.gm] = (gmMap[m.gm] || 0) + 1; });
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = isKuehlerCampaign
      ? {}
      : { Nord: 0, Ost: 0, Süd: 0, West: 0 };
    markets.forEach((market) => {
      const key = normalizeRegionLabel(market.region);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [isKuehlerCampaign, markets]);
  const regionCardOrder = useMemo(() => {
    if (!isKuehlerCampaign) return ["Nord", "Ost", "Süd", "West"];
    const preferred = ["Nord", "Ost", "Süd", "West", "Mitte", "Unbekannt"];
    const present = Object.keys(regionCounts).filter((region) => (regionCounts[region] ?? 0) > 0);
    const ordered = [
      ...preferred.filter((region) => present.includes(region)),
      ...present.filter((region) => !preferred.includes(region)).sort((left, right) => left.localeCompare(right, "de")),
    ];
    return ordered.length > 0 ? ordered : ["Unbekannt"];
  }, [isKuehlerCampaign, regionCounts]);
  const regionColors: Record<string, string> = {
    Nord: "#0891B2",
    Ost: "#DC2626",
    Süd: "#16a34a",
    West: "#D97706",
    Mitte: "#7C3AED",
    Unbekannt: "#6B7280",
  };

  const rows = [
    { label: "Typ", custom: t ? (
      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: t.bg, color: t.color }}>{t.label}</span>
    ) : null },
    { label: "Name", value: name || "—" },
    { label: "Startdatum", value: startNow ? "Sofort" : fmt(startDate) },
    { label: "Enddatum", value: fmt(endDate) },
    ...(durationDays !== null && durationDays > 0 ? [{ label: "Laufzeit", value: `${durationDays} Tage` }] : []),
    { label: "Märkte", value: `${count.toLocaleString("de-AT")} Märkte` },
    ...(Object.keys(gmMap).length > 0 ? [{ label: "GMs", value: `${Object.keys(gmMap).length} Gebietsmanager` }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Kampagne prüfen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0 }}>Überprüfe alle Angaben bevor du die Kampagne erstellst.</p>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{
            display: "flex", alignItems: "center", padding: "13px 18px", gap: 16,
            borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
            backgroundColor: i % 2 === 0 ? "#fff" : "rgba(0,0,0,0.01)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.35)", width: 100, flexShrink: 0, letterSpacing: "0.01em" }}>{row.label}</span>
            {row.custom ?? <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{row.value}</span>}
          </div>
        ))}
      </div>

      {/* Region + GM breakdown */}
      {markets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Region cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Regionen</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, regionCardOrder.length))}, 1fr)`, gap: 8 }}>
              {regionCardOrder.map(rname => {
                const c = regionCounts[rname] || 0;
                const pct = Math.round(c / markets.length * 100);
                const col = regionColors[rname] ?? "#6B7280";
                return (
                  <div key={rname} style={{
                    padding: "12px 14px", borderRadius: 10, border: `1px solid ${col}20`,
                    backgroundColor: `${col}07`, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: col, letterSpacing: "0.03em" }}>{rname}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: c > 0 ? "#1a1a1a" : "rgba(0,0,0,0.18)", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{c}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, backgroundColor: `${col}18` }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: col }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{pct}% der Märkte</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GM list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gebietsmanager</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>{Object.keys(gmMap).length} gesamt</span>
            </div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {Object.entries(gmMap).sort((a, b) => b[1] - a[1]).map(([gm, cnt], i, arr) => {
                const pct = Math.round(cnt / markets.length * 100);
                return (
                  <div key={gm} style={{
                    display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    backgroundColor: "#fff",
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={12} strokeWidth={1.7} color="rgba(0,0,0,0.32)" />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{gm}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 56, height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.18)" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 500, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cnt} {cnt === 1 ? "Markt" : "Märkte"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Warnings */}
      {(!name || markets.length === 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!name && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#b45309", fontWeight: 500 }}>Kampagnenname fehlt</span>
            </div>
          )}
          {markets.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#b45309", fontWeight: 500 }}>
                {typeId === "flex" ? "Keine Universumsmärkte gefunden" : "Keine Märkte importiert"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function NeuKampagnePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [typeId, setTypeId] = useState("standard");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [timeframeMode, setTimeframeMode] = useState<"dates" | "redmonth">("dates");
  const [selectedRedMonthId, setSelectedRedMonthId] = useState("");
  const [redMonthLoading, setRedMonthLoading] = useState(false);
  const [redMonthLoadAttempted, setRedMonthLoadAttempted] = useState(false);
  const [markets, setMarkets] = useState<NeuMarketItem[]>([]);
  const [allMarkets, setAllMarkets] = useState<NeuMarketCandidate[]>([]);
  const [gmUsers, setGmUsers] = useState<GMRecord[]>([]);
  const [gmOverridesByKey, setGmOverridesByKey] = useState<Record<string, string>>({});
  const [existingCampaigns, setExistingCampaigns] = useState<Campaign[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [overlapConflicts, setOverlapConflicts] = useState<CampaignMarketOverlapConflict[] | null>(null);
  const [selectedMigrationKeys, setSelectedMigrationKeys] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { calendar: redMonthCalendar, loadCalendar, error: redMonthError } = useRedMonth();
  const currentYear = new Date().getFullYear();
  const redMonthYearRange = useMemo(() => getYearRangeYmd(currentYear), [currentYear]);

  const activetype = CAMPAIGN_TYPES.find(t => t.id === typeId) ?? CAMPAIGN_TYPES[0];
  const AC = activetype.color;                           // accent color
  const AC_BG = activetype.bg;                          // accent bg tint
  const AC_BORDER = activetype.border;                  // accent border
  const isAuto = activetype.autoMarkets;
  const matchMode: CampaignMatchMode = typeId === "kuehler" ? "kuehler_stammnr" : "flex";

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const rows = await fetchMarkets();
        setAllMarkets(
          rows.map((row) => ({
            id: row.id,
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
          })),
        );
      } catch {
        setAllMarkets([]);
      }
    };
    void loadMarkets();
  }, []);

  const assignableMarkets = useMemo(
    () =>
      allMarkets.filter((market) => {
        if (market.isActive === false) return false;
        if (typeId === "flex") return market.marketType === "universum";
        if (typeId !== "kuehler") return true;
        // Kühlerinventur campaign matching is identity-based via Stammnr.
        return getMarketStammnrCandidates(market).length > 0;
      }),
    [allMarkets, typeId],
  );

  useEffect(() => {
    const loadGmUsers = async () => {
      try {
        const rows = await fetchGmUsers();
        setGmUsers(
          rows.filter((gm) => !isTemporaryGmName(`${gm.firstName} ${gm.lastName}`)),
        );
      } catch {
        setGmUsers([]);
      }
    };
    void loadGmUsers();
  }, []);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const rows = await fetchCampaigns();
        setExistingCampaigns(rows);
      } catch {
        setExistingCampaigns([]);
      }
    };
    void loadCampaigns();
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    if (timeframeMode !== "redmonth") return;
    setRedMonthLoadAttempted(true);
    setRedMonthLoading(true);
    void loadCalendar({ from: redMonthYearRange.from, to: redMonthYearRange.to })
      .finally(() => setRedMonthLoading(false));
  }, [loadCalendar, redMonthYearRange.from, redMonthYearRange.to, step, timeframeMode]);

  const redMonthScopedError = redMonthLoadAttempted ? redMonthError : null;

  useEffect(() => {
    if (redMonthCalendar.length === 0) return;
    if (!startDate || !endDate) return;
    const matched = redMonthCalendar.find((period) => {
      const clamped = clampPeriodToYearRange(period, redMonthYearRange);
      return clamped.start === startDate && clamped.end === endDate;
    });
    if (matched) {
      setSelectedRedMonthId(matched.id);
    } else {
      setSelectedRedMonthId("");
    }
  }, [endDate, redMonthCalendar, redMonthYearRange, startDate]);

  const handleSelectRedMonth = useCallback((period: RedMonthPeriod) => {
    const clamped = clampPeriodToYearRange(period, redMonthYearRange);
    setSelectedRedMonthId(period.id);
    setStartDate(clamped.start);
    setEndDate(clamped.end);
  }, [redMonthYearRange]);

  const matcherReport = useMemo(
    () => buildMarketMatchReport(markets, assignableMarkets, isAuto, matchMode),
    [assignableMarkets, isAuto, markets, matchMode],
  );
  const matchedMarketRows = useMemo<NeuMarketCandidate[]>(() => {
    if (isAuto) return assignableMarkets;
    const allById = new Map(assignableMarkets.map((market) => [market.id, market]));
    if (matchMode === "kuehler_stammnr") {
      const resolved: NeuMarketCandidate[] = [];
      for (const result of matcherReport.results) {
        if (result.status === "matched" && result.marketId) {
          const matched = allById.get(result.marketId);
          if (matched) {
            resolved.push({
              ...matched,
              // keep imported row identity for stable row-level rendering
              id: result.row.id,
              // preserve imported GM assignment hint for campaign mapping UX
              gm: result.row.gm || matched.gm,
            });
          }
        }
      }
      return resolved;
    }
    const seenIds = new Set<string>();
    const resolved: NeuMarketCandidate[] = [];
    for (const result of matcherReport.results) {
      if (result.status !== "matched" || !result.marketId || seenIds.has(result.marketId)) continue;
      const matched = allById.get(result.marketId);
      if (!matched) continue;
      seenIds.add(result.marketId);
      resolved.push(matched);
    }
    return resolved.length > 0 ? resolved : markets;
  }, [assignableMarkets, isAuto, markets, matchMode, matcherReport.results]);
  const matcherIssueRows = useMemo(
    () => matcherReport.results.filter((result) => result.status !== "matched"),
    [matcherReport.results],
  );
  const step3MatchIssues = useMemo(
    () => (matchMode === "kuehler_stammnr" ? matcherIssueRows : []),
    [matchMode, matcherIssueRows],
  );
  const matchedRowCount = useMemo(
    () => matcherReport.results.filter((result) => result.status === "matched" && result.marketId).length,
    [matcherReport.results],
  );
  const matchedDisplayCount = matchMode === "kuehler_stammnr" ? matchedRowCount : matcherReport.matchedIds.length;
  const step3MatchSummary = useMemo(
    () => ({
      matched: matchedDisplayCount,
      unmatched: matcherReport.unmatched,
      ambiguous: matcherReport.ambiguous,
      unresolved: matcherIssueRows.length,
    }),
    [matchedDisplayCount, matcherIssueRows.length, matcherReport.ambiguous, matcherReport.unmatched],
  );
  const identityBlockingCount = useMemo(() => {
    if (isAuto) return 0;
    if (matchMode !== "kuehler_stammnr") return 0;
    return matcherIssueRows.length;
  }, [isAuto, matchMode, matcherIssueRows.length]);
  const canProceed = (() => {
    if (step === 1) return !!typeId;
    if (step === 2) return !!name;
    if (step === 3) {
      if (isAuto) return matcherReport.matchedIds.length > 0;
      if (matchMode === "kuehler_stammnr") return matchedMarketRows.length > 0 && identityBlockingCount === 0;
      return markets.length > 0;
    }
    return true;
  })();
  const gmNameIndex = useMemo(() => {
    const index = new Map<string, GMRecord[]>();
    for (const user of gmUsers) {
      const fullName = normalizePersonName(`${user.firstName} ${user.lastName}`);
      const reverseName = normalizePersonName(`${user.lastName} ${user.firstName}`);
      const keys = new Set([fullName, reverseName]);
      for (const key of keys) {
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

  const assignmentBuild = useMemo(() => {
    if (isAuto) {
      return {
        assignments: [] as CampaignMarketAssignmentInput[],
        issues: [] as GmMatchIssue[],
        resolvedByRowId: new Map<string, { gmUserId: string; gmDisplayName: string }>(),
      };
    }

    const matchedRows = matcherReport.results.filter((result) => result.status === "matched" && result.marketId);
    const assignmentByMarketAndGm = new Map<string, CampaignMarketAssignmentInput>();
    const assignments: CampaignMarketAssignmentInput[] = [];
    const assignmentSlotsByMarketAndGm = new Map<string, number>();
    const issues: GmMatchIssue[] = [];
    const resolvedByRowId = new Map<string, { gmUserId: string; gmDisplayName: string }>();

    for (const result of matchedRows) {
      const rowId = result.row.id;
      const marketId = result.marketId as string;
      const gmName = result.row.gm ?? "";
      const gmOverrideKey = buildGmOverrideKey(gmName);
      const gmOverrideLabel = buildGmOverrideLabel(gmName);
      const overrideGmId = gmOverridesByKey[gmOverrideKey];

      let resolvedGmId: string | null = null;
      let candidates: GMRecord[] = [];
      let resolvedGm: GMRecord | null = null;

      if (overrideGmId) {
        const selected = gmUsers.find((gm) => gm.id === overrideGmId);
        if (selected) {
          resolvedGmId = selected.id;
          resolvedGm = selected;
          candidates = [selected];
        } else {
          issues.push({
            rowId,
            marketId,
            gmName,
            gmOverrideKey,
            gmOverrideLabel,
            kind: "unmatched",
            candidateUserIds: [],
          });
          continue;
        }
      } else {
        const emailCandidates = extractEmailCandidates(gmName);
        const gmNameWithoutEmail = stripEmailsFromText(gmName);
        const normalizedGm = normalizePersonName(gmNameWithoutEmail);
        if (!normalizedGm && emailCandidates.length === 0) {
          issues.push({
            rowId,
            marketId,
            gmName,
            gmOverrideKey,
            gmOverrideLabel,
            kind: "missing",
            candidateUserIds: [],
          });
          continue;
        }

        if (emailCandidates.length > 0) {
          const emailMatched = new Map<string, GMRecord>();
          for (const email of emailCandidates) {
            for (const user of gmEmailIndex.get(email) ?? []) {
              emailMatched.set(user.id, user);
            }
          }
          const emailMatches = Array.from(emailMatched.values());
          if (emailMatches.length === 1) {
            resolvedGm = emailMatches[0] ?? null;
            resolvedGmId = resolvedGm?.id ?? null;
            candidates = emailMatches;
          } else if (emailMatches.length > 1) {
            issues.push({
              rowId,
              marketId,
              gmName,
              gmOverrideKey,
              gmOverrideLabel,
              kind: "ambiguous",
              candidateUserIds: emailMatches.map((candidate) => candidate.id),
            });
            continue;
          }
        }

        if (!resolvedGmId && normalizedGm) {
          candidates = gmNameIndex.get(normalizedGm) ?? [];
          if (candidates.length === 0) {
            issues.push({
              rowId,
              marketId,
              gmName,
              gmOverrideKey,
              gmOverrideLabel,
              kind: "unmatched",
              candidateUserIds: [],
            });
            continue;
          }
          if (candidates.length > 1) {
            issues.push({
              rowId,
              marketId,
              gmName,
              gmOverrideKey,
              gmOverrideLabel,
              kind: "ambiguous",
              candidateUserIds: candidates.map((candidate) => candidate.id),
            });
            continue;
          }
          resolvedGm = candidates[0] ?? null;
          resolvedGmId = resolvedGm?.id ?? null;
        }
      }

      if (!resolvedGmId) {
        issues.push({
          rowId,
          marketId,
          gmName,
          gmOverrideKey,
          gmOverrideLabel,
          kind: "unmatched",
          candidateUserIds: candidates.map((candidate) => candidate.id),
        });
        continue;
      }
      if (!resolvedGm) {
        resolvedGm = gmUsers.find((gm) => gm.id === resolvedGmId) ?? null;
      }
      if (resolvedGm) {
        const displayName = `${resolvedGm.firstName} ${resolvedGm.lastName}`.trim() || resolvedGm.email;
        resolvedByRowId.set(rowId, {
          gmUserId: resolvedGm.id,
          gmDisplayName: displayName,
        });
      }

      const assignmentKey = `${marketId}:${resolvedGmId}`;
      if (matchMode === "kuehler_stammnr") {
        const nextSlot = (assignmentSlotsByMarketAndGm.get(assignmentKey) ?? 0) + 1;
        assignmentSlotsByMarketAndGm.set(assignmentKey, nextSlot);
        assignments.push({
          marketId,
          gmUserId: resolvedGmId,
          gmNameRaw: gmName,
          assignmentSlot: nextSlot,
          visitTargetCount: 1,
        });
        continue;
      }

      const existing = assignmentByMarketAndGm.get(assignmentKey);
      if (existing) {
        existing.visitTargetCount = (existing.visitTargetCount ?? 1) + 1;
        continue;
      }

      assignmentByMarketAndGm.set(assignmentKey, {
        marketId,
        gmUserId: resolvedGmId,
        gmNameRaw: gmName,
        assignmentSlot: 1,
        visitTargetCount: 1,
      });
    }

    return {
      assignments: matchMode === "kuehler_stammnr" ? assignments : Array.from(assignmentByMarketAndGm.values()),
      issues,
      resolvedByRowId,
    };
  }, [gmEmailIndex, gmNameIndex, gmOverridesByKey, gmUsers, isAuto, matchMode, matcherReport.results]);

  const gmIssueByRowId = useMemo(() => {
    const map = new Map<string, GmMatchIssue>();
    for (const issue of assignmentBuild.issues) {
      if (!map.has(issue.rowId)) map.set(issue.rowId, issue);
    }
    return map;
  }, [assignmentBuild.issues]);
  const gmIssueGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; count: number; kind: GmMatchIssueKind }>();
    for (const issue of assignmentBuild.issues) {
      const existing = groups.get(issue.gmOverrideKey);
      if (existing) {
        existing.count += 1;
        continue;
      }
      groups.set(issue.gmOverrideKey, {
        key: issue.gmOverrideKey,
        label: issue.gmOverrideLabel,
        count: 1,
        kind: issue.kind,
      });
    }
    return Array.from(groups.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
  }, [assignmentBuild.issues]);
  const gmResolvedDisplayByRowId = useMemo(() => {
    const record: Record<string, string> = {};
    for (const [rowId, resolved] of assignmentBuild.resolvedByRowId.entries()) {
      record[rowId] = resolved.gmDisplayName;
    }
    return record;
  }, [assignmentBuild.resolvedByRowId]);
  const matchedMarketRowsWithResolvedGm = useMemo(() => {
    if (matchMode !== "kuehler_stammnr") return matchedMarketRows;
    return matchedMarketRows.map((market) => {
      const resolvedGm = gmResolvedDisplayByRowId[market.id];
      const issue = gmIssueByRowId.get(market.id);
      return {
        ...market,
        gm: resolvedGm ?? (issue ? "GM prüfen" : market.gm),
      };
    });
  }, [gmIssueByRowId, gmResolvedDisplayByRowId, matchMode, matchedMarketRows]);

  const matcherDisplayRows = useMemo(() => {
    const byId = new Map<string, MarketMatchResult>();
    for (const result of matcherIssueRows) {
      byId.set(result.row.id, result);
    }
    for (const result of matcherReport.results) {
      if (result.status !== "matched") continue;
      if (!gmIssueByRowId.has(result.row.id)) continue;
      byId.set(result.row.id, result);
    }
    return Array.from(byId.values());
  }, [gmIssueByRowId, matcherIssueRows, matcherReport.results]);

  const gmBlockingIssues = assignmentBuild.issues.length;
  const hasAssignmentsToCreate = assignmentBuild.assignments.length > 0;
  const canCreate = !!name && !isSubmitting && (isAuto ? matcherReport.matchedIds.length > 0 : (identityBlockingCount === 0 && hasAssignmentsToCreate));

  const updateMatcherRow = useCallback((rowId: string, field: "name" | "gm", value: string) => {
    setMarkets((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    );
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

  const localOverlapConflicts = useMemo(() => {
    if (isAuto) return [] as CampaignMarketOverlapConflict[];
    if (!name.trim()) return [] as CampaignMarketOverlapConflict[];
    const section = (typeId as CampaignSection) ?? "standard";
    if (section === "flex") return [] as CampaignMarketOverlapConflict[];
    const scheduleType = !startNow && startDate && endDate ? "scheduled" : "always";
    const status = startNow ? "active" : scheduleType === "scheduled" ? "scheduled" : "inactive";
    if (status !== "active") return [] as CampaignMarketOverlapConflict[];

    const targetStart = scheduleType === "scheduled" ? startDate : null;
    const targetEnd = scheduleType === "scheduled" ? endDate : null;
    const windowsOverlap = (
      left: { scheduleType: "always" | "scheduled"; startDate: string | null; endDate: string | null },
      right: { scheduleType: "always" | "scheduled"; startDate: string | null; endDate: string | null },
    ) => {
      if (left.scheduleType === "always" || right.scheduleType === "always") return true;
      if (!left.startDate || !left.endDate || !right.startDate || !right.endDate) return false;
      return !(left.endDate < right.startDate || right.endDate < left.startDate);
    };
    const toPeriodLabel = (campaign: Campaign) => {
      if (campaign.scheduleType === "always") return "Immer aktiv";
      if (!campaign.startDate || !campaign.endDate) return "Geplant";
      return `${campaign.startDate} - ${campaign.endDate}`;
    };
    const marketNameById = new Map(assignableMarkets.map((market) => [market.id, market.name]));
    const conflicts: CampaignMarketOverlapConflict[] = [];
    for (const assignment of assignmentBuild.assignments) {
      for (const campaign of existingCampaigns) {
        if (campaign.section !== section) continue;
        if (campaign.status !== "active") continue;
        const overlap = windowsOverlap(
          { scheduleType, startDate: targetStart, endDate: targetEnd },
          { scheduleType: campaign.scheduleType, startDate: campaign.startDate, endDate: campaign.endDate },
        );
        if (!overlap) continue;
        const existingAssignment = (campaign.assignments ?? []).find((item) => item.marketId === assignment.marketId);
        if (!existingAssignment) continue;
        conflicts.push({
          marketId: assignment.marketId,
          marketName: marketNameById.get(assignment.marketId) ?? assignment.marketId,
          section,
          existingCampaignId: campaign.id,
          existingCampaignName: campaign.name,
          existingScheduleType: campaign.scheduleType,
          existingStartDate: campaign.startDate,
          existingEndDate: campaign.endDate,
          existingPeriodLabel: toPeriodLabel(campaign),
          existingGmUserId: existingAssignment.gmUserId ?? null,
          existingGmName: existingAssignment.gmName ?? null,
        });
      }
    }
    const deduped = new Map<string, CampaignMarketOverlapConflict>();
    for (const conflict of conflicts) {
      const key = `${conflict.marketId}:${conflict.existingCampaignId}`;
      if (!deduped.has(key)) deduped.set(key, conflict);
    }
    return Array.from(deduped.values());
  }, [assignableMarkets, assignmentBuild.assignments, endDate, existingCampaigns, isAuto, name, startDate, startNow, typeId]);

  const submitCampaign = useCallback(
    async (
      mode: "normal" | "conflict_free" | "migrate",
      conflictsToExclude: CampaignMarketOverlapConflict[] = [],
      conflictsToMigrate: CampaignMarketOverlapConflict[] = [],
    ) => {
      const allMarketIds = matcherReport.matchedIds;
      const allAssignments = assignmentBuild.assignments;
      const conflictedMarketIds = new Set(conflictsToExclude.map((conflict) => conflict.marketId));
      const marketIds =
        mode === "normal" ? allMarketIds : allMarketIds.filter((marketId) => !conflictedMarketIds.has(marketId));
      const assignments =
        mode === "normal"
          ? allAssignments
          : allAssignments.filter((assignment) => !conflictedMarketIds.has(assignment.marketId));

      const scheduleType = !startNow && startDate && endDate ? "scheduled" : "always";
      const status = startNow ? "active" : scheduleType === "scheduled" ? "scheduled" : "inactive";
      const created = await createCampaign({
        name,
        section: (typeId as CampaignSection) ?? "standard",
        status,
        scheduleType,
        startDate: scheduleType === "scheduled" ? startDate : undefined,
        endDate: scheduleType === "scheduled" ? endDate : undefined,
        marketIds: isAuto ? marketIds : [],
        assignments: isAuto ? undefined : assignments,
      });

      if (mode === "migrate" && conflictsToMigrate.length > 0) {
        const assignmentByMarketId = new Map<string, CampaignMarketAssignmentInput>();
        for (const assignment of allAssignments) {
          // Keep first-seen assignment per market for deterministic migrate payloads.
          if (!assignmentByMarketId.has(assignment.marketId)) {
            assignmentByMarketId.set(assignment.marketId, assignment);
          }
        }
        await migrateCampaignMarkets(
          created.id,
          conflictsToMigrate.map((conflict) => ({
            marketId: conflict.marketId,
            fromCampaignId: conflict.existingCampaignId,
            gmUserId: assignmentByMarketId.get(conflict.marketId)?.gmUserId ?? null,
            reason: "campaign_overlap_resolution",
          })),
        );
      }
    },
    [assignmentBuild.assignments, endDate, isAuto, matcherReport.matchedIds, name, startDate, startNow, typeId],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "calc(100vh - 80px)", overflowX: "hidden" }}>

      {/* Inner layout */}
      <div style={{ display: "flex", flex: 1, gap: 0, minWidth: 0, overflowX: "hidden" }}>

        {/* Stepper sidebar */}
        <div style={{
          width: 220, flexShrink: 0,
          backgroundColor: "#ffffff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          padding: "28px 16px",
          display: "flex", flexDirection: "column", gap: 4,
          alignSelf: "flex-start",
          position: "sticky", top: 28,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", padding: "0 8px", marginBottom: 10, display: "block" }}>Schritte</span>
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            return (
              <div
                key={s.id}
                onClick={() => isDone && setStep(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 10px",
                  borderRadius: 9, cursor: isDone ? "pointer" : "default",
                  backgroundColor: isCurrent ? AC_BG : "transparent",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={e => { if (isDone && !isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: isDone || isCurrent ? AC : "rgba(0,0,0,0.07)",
                  border: `1.5px solid ${isDone || isCurrent ? "transparent" : "rgba(0,0,0,0.1)"}`,
                  transition: "all 0.25s ease",
                }}>
                  {isDone
                    ? <Check size={11} strokeWidth={2.5} color="#fff" />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? "#fff" : "rgba(0,0,0,0.4)" }}>{s.id}</span>
                  }
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? "#1a1a1a" : isDone ? "#1a1a1a" : "rgba(0,0,0,0.4)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 400, marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}

          {/* Progress line */}
          <div style={{ margin: "16px 10px 0", height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, backgroundColor: AC, width: `${((step - 1) / (STEPS.length - 1)) * 100}%`, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background-color 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500, padding: "4px 10px 0" }}>Schritt {step} von {STEPS.length}</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 16, overflowX: "hidden" }}>

          {/* Content card */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: 14,
            border: `1px solid ${step > 1 ? AC_BORDER : "rgba(0,0,0,0.06)"}`,
            boxShadow: step > 1 ? `0 2px 12px rgba(0,0,0,0.05), 0 0 0 3px ${AC_BG}` : "0 2px 12px rgba(0,0,0,0.05)",
            padding: "32px 36px",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          }}>
            {step === 1 && <StepTyp selected={typeId} onSelect={setTypeId} onNext={() => setStep(2)} onCancel={() => router.push("/admin/fbmanagement")} accentColor={AC} accentBg={AC_BG} />}
            {step === 2 && (
              <StepDetails
                name={name} setName={setName}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                startNow={startNow} setStartNow={setStartNow}
                timeframeMode={timeframeMode}
                setTimeframeMode={setTimeframeMode}
                redMonthPeriods={redMonthCalendar}
                redMonthYearRange={redMonthYearRange}
                selectedRedMonthId={selectedRedMonthId}
                onSelectRedMonth={handleSelectRedMonth}
                redMonthLoading={redMonthLoading}
                redMonthError={redMonthScopedError}
                accentColor={AC} accentBg={AC_BG}
              />
            )}
            {step === 3 && (
              <StepMaerkte
                typeId={typeId}
                markets={matchedMarketRowsWithResolvedGm}
                onLoad={setMarkets}
                matchSummary={step3MatchSummary}
                matchIssues={step3MatchIssues}
                strictIdentityMode={matchMode === "kuehler_stammnr"}
                gmIssues={assignmentBuild.issues}
                gmUsers={gmUsers}
                gmOverridesByKey={gmOverridesByKey}
                onSetGmOverrideForKey={setGmOverrideForKey}
              />
            )}
            {step === 4 && (
              <StepUebersicht
                typeId={typeId} name={name}
                startDate={startDate} endDate={endDate}
                startNow={startNow} markets={isAuto ? assignableMarkets : (matchMode === "kuehler_stammnr" ? matchedMarketRowsWithResolvedGm : markets)}
              />
            )}
          </div>

          {/* Navigation buttons — hidden on step 1 (buttons live inside the card) */}
          {step > 1 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/admin/fbmanagement")}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: "rgba(0,0,0,0.5)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
            >
              <ArrowLeft size={13} strokeWidth={2} />
              {step === 1 ? "Abbrechen" : "Zurück"}
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (!canProceed) return;
                  if (step === 3 && !isAuto && localOverlapConflicts.length > 0) {
                    setStep(4);
                    setOverlapConflicts(localOverlapConflicts);
                    setSelectedMigrationKeys(localOverlapConflicts.map((conflict) => `${conflict.marketId}:${conflict.existingCampaignId}`));
                    return;
                  }
                  setStep((s) => s + 1);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 22px",
                  fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none",
                  cursor: canProceed ? "pointer" : "not-allowed",
                  background: canProceed ? `linear-gradient(to bottom, ${AC}, color-mix(in srgb, ${AC} 80%, black))` : "rgba(0,0,0,0.08)",
                  color: canProceed ? "#fff" : "rgba(0,0,0,0.3)",
                  boxShadow: canProceed ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${AC}, 0 1px 6px ${AC}44` : "none",
                  transition: "all 0.25s ease", opacity: canProceed ? 1 : 0.6,
                }}
              >
                Weiter
                <ChevronRight size={13} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  if (!canCreate || isSubmitting) return;
                  setSubmitError(null);
                  setOverlapConflicts(null);
                  setSelectedMigrationKeys([]);
                  setIsSubmitting(true);
                  try {
                    await submitCampaign("normal");
                    router.push("/admin/fbmanagement");
                  } catch (error) {
                    const conflicts = getCampaignOverlapConflicts(error);
                    if (conflicts.length > 0) {
                      setOverlapConflicts(conflicts);
                      setSelectedMigrationKeys(conflicts.map((conflict) => `${conflict.marketId}:${conflict.existingCampaignId}`));
                    } else {
                      setSubmitError(error instanceof Error ? error.message : "Kampagne konnte nicht erstellt werden.");
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 28px",
                  fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none",
                  cursor: canCreate && !isSubmitting ? "pointer" : "not-allowed",
                  background: canCreate && !isSubmitting ? `linear-gradient(to bottom, ${AC}, color-mix(in srgb, ${AC} 80%, black))` : "rgba(0,0,0,0.08)",
                  color: canCreate && !isSubmitting ? "#fff" : "rgba(0,0,0,0.3)",
                  boxShadow: canCreate && !isSubmitting ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${AC}, 0 2px 8px ${AC}55` : "none",
                  transition: "all 0.25s ease", letterSpacing: "-0.01em", opacity: canCreate && !isSubmitting ? 1 : 0.65,
                }}
                disabled={!canCreate || isSubmitting}
              >
                <Check size={14} strokeWidth={2.5} />
                {isSubmitting ? "Erstelle..." : "Kampagne erstellen"}
              </button>
            )}
          </div>}
          {step === 4 && !isAuto && (
            <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)", fontSize: 11, color: "rgba(0,0,0,0.62)" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Matcher Ergebnis</div>
              <div>
                Zugeordnet: {matchedDisplayCount} · Unklar: {matcherReport.ambiguous} · Nicht gefunden: {matcherReport.unmatched} · GM-Probleme: {gmBlockingIssues}
              </div>
              {matchMode === "kuehler_stammnr" && (
                <div style={{ marginTop: 6 }}>
                  Mehrfach vorkommende Stammnr werden als separate Kuehler-Assignments gespeichert.
                </div>
              )}
              {(matcherReport.ambiguous > 0 || matcherReport.unmatched > 0 || gmBlockingIssues > 0) && (
                <div style={{ marginTop: 6, color: "#b45309", fontWeight: 600 }}>
                  {matcherReport.ambiguous > 0 || matcherReport.unmatched > 0
                    ? matchMode === "kuehler_stammnr"
                      ? "Nicht zuordenbare Maerkte muessen vor dem Erstellen korrigiert werden."
                      : "Zeilen ohne Markt-Match werden beim Erstellen automatisch uebersprungen."
                    : "Zeilen ohne zuordenbaren GM werden beim Erstellen automatisch uebersprungen."}
                </div>
              )}
              {matcherDisplayRows.length > 0 && (
                <div style={{ marginTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {matcherDisplayRows.slice(0, 10).map((issue, index) => {
                    const gmIssue = gmIssueByRowId.get(issue.row.id);
                    return (
                    <div
                      key={`${issue.row.id}-${index}`}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(180,83,9,0.22)",
                        background: "rgba(180,83,9,0.07)",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#7c2d12", display: "flex", gap: 6 }}>
                        <input
                          value={issue.row.name}
                          onChange={(event) => updateMatcherRow(issue.row.id, "name", event.target.value)}
                          style={{ minWidth: 120, border: "1px solid rgba(124,45,18,0.25)", borderRadius: 5, padding: "2px 6px", fontSize: 11, fontWeight: 600, color: "#7c2d12", background: "#fff" }}
                        />
                        <input
                          value={issue.row.gm}
                          onChange={(event) => updateMatcherRow(issue.row.id, "gm", event.target.value)}
                          style={{ minWidth: 120, border: "1px solid rgba(124,45,18,0.25)", borderRadius: 5, padding: "2px 6px", fontSize: 11, fontWeight: 600, color: "#7c2d12", background: "#fff" }}
                        />
                      </div>
                      <div style={{ color: "#92400e", fontWeight: 700 }}>
                        {issue.status === "ambiguous" ? "Markt unklar" : issue.status === "unmatched" ? "Markt nicht gefunden" : gmIssue ? "GM prüfen" : "OK"}
                      </div>
                      <div style={{ color: "rgba(124,45,18,0.9)" }}>
                        Regel: {matcherReasonLabel(issue.reason)}
                      </div>
                      <div style={{ color: "rgba(124,45,18,0.9)" }}>
                        Kandidaten: {issue.candidateIds.length}
                      </div>
                      {gmIssue && (
                        <>
                          <div style={{ color: "rgba(124,45,18,0.9)" }}>
                            GM-Status: {
                              gmIssue.kind === "missing"
                                ? "Name fehlt"
                                : gmIssue.kind === "unmatched"
                                  ? "Kein GM gefunden"
                                  : gmIssue.kind === "ambiguous"
                                    ? "Mehrdeutiger GM"
                                    : "Konflikt fuer selben Markt"
                            }
                          </div>
                          <div style={{ color: "rgba(124,45,18,0.9)" }}>
                            Importwert-Gruppe: {gmIssue.gmOverrideLabel}
                          </div>
                        </>
                      )}
                    </div>
                  )})}
                  {matcherDisplayRows.length > 10 && (
                    <div style={{ color: "rgba(124,45,18,0.85)", fontWeight: 600 }}>
                      +{matcherDisplayRows.length - 10} weitere Problemzeilen
                    </div>
                  )}
                  {gmIssueGroups.length > 0 && (
                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>
                        GM manuell pro Importwert zuordnen
                      </div>
                      {gmIssueGroups.slice(0, 12).map((group) => (
                        <div
                          key={group.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.1fr 1.4fr",
                            gap: 8,
                            alignItems: "center",
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid rgba(180,83,9,0.18)",
                            background: "rgba(255,255,255,0.75)",
                          }}
                        >
                          <div style={{ color: "rgba(124,45,18,0.9)", fontSize: 11, fontWeight: 600 }}>
                            {group.label} · {group.count} Zeilen
                          </div>
                          <WhiteSelect
                            value={gmOverridesByKey[group.key] ?? ""}
                            onChange={(next) => setGmOverrideForKey(group.key, next)}
                            options={gmUsers.map((gm) => ({
                              value: gm.id,
                              label: `${gm.firstName} ${gm.lastName}`,
                            }))}
                            placeholder="GM manuell auswählen…"
                          />
                        </div>
                      ))}
                      {gmIssueGroups.length > 12 && (
                        <div style={{ color: "rgba(124,45,18,0.85)", fontWeight: 600 }}>
                          +{gmIssueGroups.length - 12} weitere Importwert-Gruppen
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {submitError && (
            <div style={{ marginTop: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>
              {submitError}
            </div>
          )}
          {overlapConflicts && overlapConflicts.length > 0 && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1200,
                background: "rgba(10, 16, 28, 0.36)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <div
                style={{
                  width: "min(860px, 95vw)",
                  maxHeight: "85vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
                  padding: 18,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Marktkonflikte in derselben Sektion</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                  Diese Märkte sind bereits einer aktiven Kampagne in derselben Sektion zugeordnet.
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {overlapConflicts.map((conflict) => (
                    <div
                      key={`${conflict.marketId}:${conflict.existingCampaignId}`}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        background: "rgba(0,0,0,0.015)",
                      }}
                    >
                      {(() => {
                        const migrationKey = `${conflict.marketId}:${conflict.existingCampaignId}`;
                        const isSelected = selectedMigrationKeys.includes(migrationKey);
                        return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{conflict.marketName}</div>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            if (isResolvingConflict) return;
                            setSelectedMigrationKeys((current) =>
                              isSelected ? current.filter((entry) => entry !== migrationKey) : Array.from(new Set([...current, migrationKey])),
                            );
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: isResolvingConflict ? "not-allowed" : "pointer",
                            opacity: isResolvingConflict ? 0.65 : 1,
                            fontSize: 11,
                            color: "rgba(0,0,0,0.7)",
                            fontWeight: 700,
                          }}
                          disabled={isResolvingConflict}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 5,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `1px solid ${isSelected ? "#b91c1c" : "rgba(0,0,0,0.28)"}`,
                              background: isSelected ? "linear-gradient(to bottom, #ef4444, #b91c1c)" : "#fff",
                              boxShadow: isSelected ? "0 1px 2px rgba(185,28,28,0.35)" : "inset 0 1px 0 rgba(255,255,255,0.95)",
                              transition: "all 0.18s ease",
                            }}
                          >
                            {isSelected ? <Check size={11} strokeWidth={3} color="#fff" /> : null}
                          </span>
                          Migrieren
                        </button>
                      </div>
                        );
                      })()}
                      <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
                        Aktuell in: <strong>{conflict.existingCampaignName}</strong> · Zeitraum: {conflict.existingPeriodLabel}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
                        Zugewiesener GM: {conflict.existingGmName ?? "Kein GM"}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setOverlapConflicts(null)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(0,0,0,0.6)",
                      cursor: isResolvingConflict ? "not-allowed" : "pointer",
                      opacity: isResolvingConflict ? 0.7 : 1,
                    }}
                    disabled={isResolvingConflict}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isResolvingConflict) return;
                      setSubmitError(null);
                      setIsResolvingConflict(true);
                      try {
                        await submitCampaign("conflict_free", overlapConflicts);
                        router.push("/admin/fbmanagement");
                      } catch (error) {
                        setSubmitError(error instanceof Error ? error.message : "Kampagne konnte nicht erstellt werden.");
                      } finally {
                        setIsResolvingConflict(false);
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(0,0,0,0.08)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1f2937",
                      cursor: isResolvingConflict ? "not-allowed" : "pointer",
                      opacity: isResolvingConflict ? 0.7 : 1,
                    }}
                    disabled={isResolvingConflict}
                  >
                    Nur konfliktfreie übernehmen
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isResolvingConflict) return;
                      setSubmitError(null);
                      setIsResolvingConflict(true);
                      try {
                        const selected = overlapConflicts.filter((conflict) =>
                          selectedMigrationKeys.includes(`${conflict.marketId}:${conflict.existingCampaignId}`),
                        );
                        await submitCampaign(
                          "migrate",
                          overlapConflicts,
                          selected,
                        );
                        router.push("/admin/fbmanagement");
                      } catch (error) {
                        setSubmitError(error instanceof Error ? error.message : "Migration konnte nicht durchgeführt werden.");
                      } finally {
                        setIsResolvingConflict(false);
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      cursor: isResolvingConflict ? "not-allowed" : "pointer",
                      opacity: isResolvingConflict ? 0.7 : 1,
                    }}
                    disabled={isResolvingConflict || selectedMigrationKeys.length === 0}
                  >
                    Ausgewählte migrieren
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
