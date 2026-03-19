"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, GripVertical, Plus, Search, Calendar, Check, ChevronDown, Trophy, Zap } from "lucide-react";
import type { Fragebogen, MarketAssignment, Module } from "@/types/fragebogen";
import { typeBadgeColor, typeLabel } from "@/utils/fragebogen";

// ── Purple accent colours ──────────────────────────────────────
const P = "#8b5cf6";
const PD = "#7C3AED";
const PR = "#6d28d9";
const P_BG = "rgba(124,58,237,0.07)";
const P_BG_FAINT = "rgba(124,58,237,0.04)";

let _mfbid = 0;
function nextId(): string {
  _mfbid += 1;
  return `mfb-${_mfbid}-${Date.now()}`;
}

// ── Custom Date Picker ──────────────────────────────────────────
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function DatePicker({
  value,
  onChange,
  placeholder = "Datum wählen",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function clear() { onChange(""); setOpen(false); }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    select(today.getDate());
  }

  const displayValue = parsed
    ? parsed.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
          background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          color: displayValue ? "#111" : "rgba(0,0,0,0.28)",
          cursor: "pointer", transition: "border-color 0.15s",
        }}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar size={12} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
          padding: "14px 14px 10px", width: 242,
          userSelect: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, color: "rgba(0,0,0,0.45)", fontSize: 16, lineHeight: 1 }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#111", fontFamily: "inherit" }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, color: "rgba(0,0,0,0.45)", fontSize: 16, lineHeight: 1 }}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.28)", paddingBottom: 4 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSelected = parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(d)}
                  style={{
                    width: "100%", aspectRatio: "1", borderRadius: 7, border: "none",
                    background: isSelected
                      ? `linear-gradient(to bottom, ${P}, ${PD})`
                      : isToday ? P_BG : "transparent",
                    color: isSelected ? "#fff" : isToday ? PD : "#111",
                    fontSize: 11, fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: isSelected
                      ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${PR}, 0 1px 4px rgba(124,58,237,0.25)`
                      : "none",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isToday ? P_BG : "transparent"; }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <button type="button" onClick={clear} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "rgba(0,0,0,0.35)", fontFamily: "inherit", fontWeight: 500, padding: "2px 4px" }}>Löschen</button>
            <button type="button" onClick={goToday} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: PD, fontFamily: "inherit", fontWeight: 600, padding: "2px 4px" }}>Heute</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Static temp markets ────────────────────────────────────────
const TEMP_MARKETS = [
  { id: "m1", chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien" },
  { id: "m2", chain: "ADEG", address: "Landstraße 45, 1030 Wien" },
  { id: "m3", chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien" },
  { id: "m4", chain: "BILLA+", address: "Favoritenstr. 22, 1100 Wien" },
  { id: "m5", chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien" },
  { id: "m6", chain: "ADEG", address: "Brünner Str. 130, 1210 Wien" },
  { id: "m7", chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien" },
  { id: "m8", chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien" },
  { id: "m9", chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien" },
  { id: "m10", chain: "PENNY", address: "Ottakringer Str. 44, 1170 Wien" },
  { id: "m11", chain: "SPAR", address: "Hütteldorfer Str. 130, 1140 Wien" },
  { id: "m12", chain: "ADEG", address: "Hernalser Hauptstr. 77, 1170 Wien" },
  { id: "m13", chain: "BILLA+", address: "Wiedner Hauptstr. 56, 1040 Wien" },
  { id: "m14", chain: "HOFER", address: "Johnstraße 42, 1150 Wien" },
  { id: "m15", chain: "SPAR", address: "Döblinger Hauptstr. 2, 1190 Wien" },
];

function chainColor(key: string): { bg: string; text: string } {
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function buildRedMonats(): { label: string; start: Date; end: Date }[] {
  const anchor = new Date(new Date().getFullYear(), 0, 1);
  const pattern = [4, 4, 5];
  const result: { label: string; start: Date; end: Date }[] = [];
  let cursor = new Date(anchor);
  for (let i = 0; i < 13; i++) {
    const weeks = pattern[i % 3];
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + weeks * 7 - 1);
    result.push({ label: `RED Monat ${i + 1}`, start, end });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + weeks * 7);
  }
  return result;
}
const RED_MONATS = buildRedMonats();
const ALL_CHAINS = Array.from(new Set(TEMP_MARKETS.map((m) => m.chain))).sort();
const ALL_PLZS = Array.from(new Set(TEMP_MARKETS.map((m) => m.address.match(/\d{4}/)?.[0] ?? ""))).filter(Boolean).sort();

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Shared styles ──────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "6px 0",
  border: "none", borderBottom: "1px solid rgba(0,0,0,0.10)",
  outline: "none", color: "#1a1a1a", backgroundColor: "transparent", fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "rgba(0,0,0,0.35)",
  display: "block", marginBottom: 6,
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: "#ffffff", borderRadius: 12, padding: "18px 20px",
  marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#1a1a1a",
  letterSpacing: "-0.01em", marginBottom: 14,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%", fontSize: 11, padding: "7px 10px 7px 28px",
  border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, outline: "none",
  backgroundColor: "rgba(0,0,0,0.02)", color: "#374151",
  fontFamily: "inherit", boxSizing: "border-box",
};

// ── Filter Dropdown ────────────────────────────────────────────
type FilterDropdownProps =
  | { mode: "multi"; options: { value: string; label: string; badge?: { bg: string; text: string } }[]; selected: string[]; onToggle: (v: string) => void; onClear: () => void; onClose: () => void; }
  | { mode: "single"; options: { value: string; label: string; sub?: string }[]; selected: string | null; onSelect: (v: string | null) => void; onClose: () => void; };

function FilterDropdown(props: FilterDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) props.onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [props.onClose]);

  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: 500, backgroundColor: "#ffffff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.05)", minWidth: 180, maxHeight: 220, overflowY: "auto", scrollbarWidth: "none", padding: "6px 0" }}>
      {props.mode === "multi" ? (
        <>
          {props.options.map((opt) => {
            const checked = props.selected.includes(opt.value);
            return (
              <div key={opt.value} onClick={() => props.onToggle(opt.value)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 14px", cursor: "pointer", transition: "background-color 0.1s ease" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.025)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, border: checked ? "none" : "1.5px solid rgba(0,0,0,0.15)", backgroundColor: checked ? PD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                  {checked && <Check size={8} strokeWidth={3} color="#fff" />}
                </div>
                {opt.badge ? (
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, backgroundColor: opt.badge.bg, color: opt.badge.text }}>{opt.label}</span>
                ) : (
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{opt.label}</span>
                )}
              </div>
            );
          })}
          {props.selected.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", padding: "6px 14px 2px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={props.onClear} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500, padding: "2px 0", fontFamily: "inherit" }} onMouseEnter={(e) => (e.currentTarget.style.color = PD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>Zurücksetzen</button>
            </div>
          )}
        </>
      ) : (
        <>
          {props.options.map((opt) => {
            const active = props.selected === opt.value;
            return (
              <div key={opt.value} onClick={() => { props.onSelect(active ? null : opt.value); props.onClose(); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 14px", cursor: "pointer", transition: "background-color 0.1s ease", backgroundColor: active ? P_BG_FAINT : "transparent" }} onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.025)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? P_BG_FAINT : "transparent"; }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, border: active ? "none" : "1.5px solid rgba(0,0,0,0.15)", backgroundColor: active ? PD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                  {active && <Check size={7} strokeWidth={3} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: active ? PD : "#374151", fontWeight: active ? 600 : 500 }}>{opt.label}</div>
                  {opt.sub && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{opt.sub}</div>}
                </div>
              </div>
            );
          })}
          {props.selected && (
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", padding: "6px 14px 2px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { props.onSelect(null); props.onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500, padding: "2px 0", fontFamily: "inherit" }} onMouseEnter={(e) => (e.currentTarget.style.color = PD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>Zurücksetzen</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Question Config Summary ────────────────────────────────────
function QuestionConfigSummary({ question }: { question: import("@/types/fragebogen").Question }) {
  const cfg = question.config;
  switch (question.type) {
    case "single":
    case "multiple": {
      const opts = (cfg.options as string[]) || [];
      const filled = opts.filter((o) => o.length > 0);
      if (filled.length === 0) return null;
      const scoring = question.scoring || {};
      return (
        <div style={{ marginTop: 5, paddingLeft: 30 }}>
          {filled.map((o, i) => {
            const sw = scoring[o];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                <div style={{ width: question.type === "single" ? 10 : 8, height: question.type === "single" ? 10 : 8, borderRadius: question.type === "single" ? "50%" : 2, border: "1.5px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 400, flex: 1 }}>{o}</span>
                {sw?.ipp != null && <span style={{ fontSize: 8, fontWeight: 600, color: "#DC2626", background: "rgba(220,38,38,0.07)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.2 }}>IPP {sw.ipp}</span>}
                {sw?.boni != null && <span style={{ fontSize: 8, fontWeight: 600, color: "#b45309", background: "rgba(217,119,6,0.08)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.2 }}>Boni {sw.boni}</span>}
              </div>
            );
          })}
        </div>
      );
    }
    case "likert": {
      const min = cfg.min as number; const max = cfg.max as number;
      const minL = cfg.minLabel as string; const maxL = cfg.maxLabel as string;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>Skala {min || "1"}–{max || "5"}{minL || maxL ? ` (${minL || "…"} → ${maxL || "…"})` : ""}</div>;
    }
    case "matrix": {
      const rows = ((cfg.rows as string[]) || []).filter((r) => r);
      const cols = ((cfg.columns as string[]) || []).filter((c) => c);
      if (rows.length === 0 && cols.length === 0) return null;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>{rows.length} Zeilen × {cols.length} Spalten</div>;
    }
    case "slider": {
      const unit = cfg.unit as string;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>{String(cfg.min || 0)}–{String(cfg.max || 100)}{unit ? ` ${unit}` : ""} (Schritt: {String(cfg.step || 1)})</div>;
    }
    case "numeric": {
      const min = cfg.min as string; const max = cfg.max as string;
      const sw = (question.scoring || {})["__value__"];
      return (
        <div style={{ marginTop: 4, paddingLeft: 30 }}>
          {(min || max) && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginBottom: sw ? 4 : 0 }}>Bereich: {min || "–∞"} bis {max || "∞"}{cfg.decimals ? " (Dezimal)" : ""}</div>}
          {(sw?.ipp != null || sw?.boni != null) && (
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {sw?.ipp != null && <span style={{ fontSize: 8, fontWeight: 600, color: "#DC2626", background: "rgba(220,38,38,0.07)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.2 }}>IPP ×{sw.ipp}</span>}
              {sw?.boni != null && <span style={{ fontSize: 8, fontWeight: 600, color: "#b45309", background: "rgba(217,119,6,0.08)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.2 }}>Boni ×{sw.boni}</span>}
            </div>
          )}
        </div>
      );
    }
    case "photo": {
      const instr = cfg.instruction as string;
      if (!instr) return null;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30, fontStyle: "italic" }}>{instr}</div>;
    }
    default: return null;
  }
}

// ── Question Mini List ─────────────────────────────────────────
function QuestionMiniList({ module }: { module: Module }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  if (module.questions.length === 0) {
    return <div style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", padding: "8px 0 4px" }}>Keine Fragen in diesem Modul.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "6px 0 4px" }}>
      {module.questions.map((q, idx) => {
        const badge = typeBadgeColor(q.type);
        const isExpanded = expandedIds.has(q.id);
        return (
          <div key={q.id} style={{ borderRadius: 7, backgroundColor: isExpanded ? "rgba(0,0,0,0.025)" : "rgba(0,0,0,0.018)", overflow: "hidden", transition: "background-color 0.15s ease" }}>
            <div onClick={() => toggle(q.id)} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", paddingTop: 1, minWidth: 14, flexShrink: 0 }}>{idx + 1}</span>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, flexShrink: 0, whiteSpace: "nowrap" }}>{typeLabel(q.type)}</span>
              <span style={{ fontSize: 11, color: q.text ? "#374151" : "rgba(0,0,0,0.3)", fontStyle: q.text ? "normal" : "italic", lineHeight: 1.4, flex: 1 }}>{q.text || "Kein Fragetext"}</span>
              {q.rules.length > 0 && <Zap size={9} strokeWidth={2} color={PD} style={{ flexShrink: 0, marginTop: 2 }} />}
              {Object.keys(q.scoring || {}).some(k => { const sw = (q.scoring || {})[k]; return sw?.ipp != null || sw?.boni != null; }) && (
                <Trophy size={9} strokeWidth={2} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.2)" style={{ flexShrink: 0, marginTop: 2, transition: "transform 0.2s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
            </div>
            <div style={{ maxHeight: isExpanded ? 200 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ padding: "0 10px 8px" }}>
                <QuestionConfigSummary question={q} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Module Row (drag-reorder) ──────────────────────────────────
function ModuleRow({ module, index, onRemove, onDragStart, onDragOver, onDrop, isDropTarget, expanded, onToggle }: {
  module: Module; index: number; onRemove: () => void;
  onDragStart: (i: number) => void; onDragOver: (i: number) => void; onDrop: () => void;
  isDropTarget: boolean; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      {isDropTarget && <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: PD, opacity: 0.6 }} />}
      <div onDragOver={(e) => { e.preventDefault(); onDragOver(index); }} onDrop={(e) => { e.preventDefault(); onDrop(); }} style={{ borderRadius: expanded ? "8px 8px 0 0" : 8, border: "1px solid rgba(0,0,0,0.05)", borderBottom: expanded ? "1px solid rgba(0,0,0,0.04)" : "1px solid rgba(0,0,0,0.05)", backgroundColor: "#fafafa", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
          <div draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; onDragStart(index); }} style={{ cursor: "grab", color: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <GripVertical size={14} strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#374151", flex: 1 }}>{module.name || "Unbenanntes Modul"}</span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.35)" }}>{module.questions.length} F</span>
          <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.25)", transition: "color 0.15s ease", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#374151")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")} title="Fragen anzeigen">
            <ChevronDown size={13} strokeWidth={2} style={{ transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.2)", transition: "color 0.15s ease", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = PD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.2)")}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
        {expanded && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", padding: "0 12px 8px", backgroundColor: "#f8f8f8" }}>
            <QuestionMiniList module={module} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module Preview Modal ───────────────────────────────────────
function ModulePreviewModal({ module, onClose }: { module: Module; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 310, backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 320, width: 500, maxHeight: "70vh", backgroundColor: "#ffffff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{module.name || "Unbenanntes Modul"}</div>
            {module.description && <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 4, lineHeight: 1.5 }}>{module.description}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, backgroundColor: P_BG, color: PD }}>{module.questions.length} {module.questions.length === 1 ? "Frage" : "Fragen"}</span>
              {module.usedInCount > 0 && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.4)" }}>In {module.usedInCount} Fragebogen</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", transition: "color 0.15s ease", flexShrink: 0 }} onMouseEnter={(e) => (e.currentTarget.style.color = PD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px", scrollbarWidth: "none" }}>
          <QuestionMiniList module={module} />
        </div>
      </div>
    </>
  );
}

// ── Context Menu ───────────────────────────────────────────────
function ContextMenu({ x, y, onDetails, onClose }: { x: number; y: number; onDetails: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  const menuW = 160; const menuH = 40;
  const safeX = Math.min(x, window.innerWidth - menuW - 8);
  const safeY = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div ref={ref} style={{ position: "fixed", left: safeX, top: safeY, zIndex: 400, backgroundColor: "#ffffff", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)", padding: "4px", minWidth: menuW }}>
      <button onClick={() => { onDetails(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#374151", borderRadius: 5, transition: "background-color 0.1s ease", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
        <Search size={12} strokeWidth={1.8} style={{ color: "rgba(0,0,0,0.4)", flexShrink: 0 }} />
        Details anzeigen
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export function MhdFragebogenEditor({
  onClose,
  onSave,
  existingFragebogen,
  availableModules,
}: {
  onClose: () => void;
  onSave: (f: Fragebogen) => void;
  existingFragebogen?: Fragebogen;
  availableModules: Module[];
}) {
  const [name, setName] = useState(existingFragebogen?.name ?? "");
  const [description, setDescription] = useState(existingFragebogen?.description ?? "");
  const [nurEinmal, setNurEinmal] = useState(existingFragebogen?.nurEinmalAusfuellbar ?? false);
  const [selectedModules, setSelectedModules] = useState<Module[]>(() => {
    if (!existingFragebogen) return [];
    return existingFragebogen.moduleIds.map((id) => availableModules.find((m) => m.id === id)).filter((m): m is Module => !!m);
  });
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set(existingFragebogen?.markets.map((m) => m.marketId) ?? []));
  const [scheduleType, setScheduleType] = useState<"always" | "scheduled">(existingFragebogen?.scheduleType ?? "always");
  const [startDate, setStartDate] = useState(existingFragebogen?.startDate ?? "");
  const [endDate, setEndDate] = useState(existingFragebogen?.endDate ?? "");
  const [moduleSearch, setModuleSearch] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  const [filterChain, setFilterChain] = useState<string[]>([]);
  const [filterPlz, setFilterPlz] = useState<string[]>([]);
  const [filterRedMonat, setFilterRedMonat] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<"chain" | "plz" | "redmonat" | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ moduleId: string; x: number; y: number } | null>(null);
  const [previewModule, setPreviewModule] = useState<Module | null>(null);

  const dragFrom = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleDragStart = useCallback((i: number) => { dragFrom.current = i; }, []);
  const handleDragOver = useCallback((i: number) => { setDropTarget(i); }, []);
  const handleDrop = useCallback(() => {
    const from = dragFrom.current;
    if (from === null || dropTarget === null || from === dropTarget) { setDropTarget(null); dragFrom.current = null; return; }
    setSelectedModules((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      const insertAt = from < dropTarget ? dropTarget - 1 : dropTarget;
      next.splice(insertAt, 0, item);
      return next;
    });
    setDropTarget(null);
    dragFrom.current = null;
  }, [dropTarget]);

  const addModule = (mod: Module) => {
    if (selectedModules.find((m) => m.id === mod.id)) return;
    setSelectedModules((prev) => [...prev, mod]);
  };

  const removeModule = (id: string) => {
    setSelectedModules((prev) => prev.filter((m) => m.id !== id));
    setExpandedRowIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRowIds((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  const toggleMarket = (id: string) => {
    setSelectedMarketIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const computeStatus = (): "active" | "scheduled" | "inactive" => {
    if (scheduleType === "always") return "active";
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end && now > end) return "inactive";
    if (start && now < start) return "scheduled";
    return "active";
  };

  const handleSave = () => {
    const markets: MarketAssignment[] = TEMP_MARKETS
      .filter((m) => selectedMarketIds.has(m.id))
      .map((m) => ({ marketId: m.id, name: `${m.chain} ${m.address.split(",")[0]}`, chain: m.chain }));
    const fb: Fragebogen = {
      id: existingFragebogen?.id ?? nextId(),
      name: name || "Unbenannter Fragebogen",
      description,
      moduleIds: selectedModules.map((m) => m.id),
      markets,
      scheduleType,
      startDate: scheduleType === "scheduled" ? startDate : undefined,
      endDate: scheduleType === "scheduled" ? endDate : undefined,
      createdAt: existingFragebogen?.createdAt ?? new Date().toISOString(),
      status: computeStatus(),
      nurEinmalAusfuellbar: nurEinmal,
    };
    onSave(fb);
  };

  const filteredLibraryModules = availableModules.filter((m) => (m.name || "").toLowerCase().includes(moduleSearch.toLowerCase()));
  const filteredMarkets = TEMP_MARKETS.filter((m) => {
    const matchSearch = !marketSearch || m.chain.toLowerCase().includes(marketSearch.toLowerCase()) || m.address.toLowerCase().includes(marketSearch.toLowerCase());
    const matchChain = filterChain.length === 0 || filterChain.includes(m.chain);
    const matchPlz = filterPlz.length === 0 || filterPlz.some((p) => m.address.includes(p));
    return matchSearch && matchChain && matchPlz;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !previewModule && !contextMenu) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, previewModule, contextMenu]);

  const btnBase: React.CSSProperties = { padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.15s ease" };
  const btnActive: React.CSSProperties = { background: `linear-gradient(to bottom, ${P}, ${PD})`, color: "#fff", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${PR}, 0 1px 6px rgba(124,58,237,0.25)` };
  const btnInactive: React.CSSProperties = { backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.4)" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "#ffffff", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ height: 56, borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 12, padding: "0 20px", flexShrink: 0, backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", transition: "color 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = PD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.4)")}>
            <X size={18} strokeWidth={1.8} />
          </button>
          <div style={{ width: 1, height: 20, backgroundColor: "rgba(0,0,0,0.07)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", flex: 1 }}>
            {existingFragebogen ? "MHD-Fragebogen bearbeiten" : "Neuer MHD-Fragebogen"}
          </span>
          <button onClick={handleSave} style={{ ...btnBase, padding: "7px 18px", fontSize: 11, ...btnActive }}>Speichern</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left sidebar — module library */}
          <div style={{ width: 240, backgroundColor: "rgba(0,0,0,0.02)", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "20px 14px", flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={labelStyle}>Modul Bibliothek</span>
            <div style={{ position: "relative" }}>
              <Search size={12} strokeWidth={1.8} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.3)", pointerEvents: "none" }} />
              <input type="text" placeholder="Suche..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} style={searchInputStyle} />
            </div>

            {filteredLibraryModules.length === 0 ? (
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", textAlign: "center", padding: "16px 0", lineHeight: 1.6 }}>Keine Module gefunden.{"\n"}Erstelle zuerst Module.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {filteredLibraryModules.map((mod) => {
                  const alreadyAdded = selectedModules.some((m) => m.id === mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => !alreadyAdded && addModule(mod)}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ moduleId: mod.id, x: e.clientX, y: e.clientY }); }}
                      style={{ padding: "8px 12px", borderRadius: 8, border: alreadyAdded ? `1px solid ${P_BG}` : "1px solid rgba(0,0,0,0.06)", backgroundColor: alreadyAdded ? P_BG_FAINT : "#ffffff", cursor: alreadyAdded ? "default" : "pointer", transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}
                      onMouseEnter={(e) => { if (!alreadyAdded) (e.currentTarget as HTMLElement).style.borderColor = `rgba(124,58,237,0.3)`; }}
                      onMouseLeave={(e) => { if (!alreadyAdded) (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.06)"; }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 500, color: alreadyAdded ? "rgba(0,0,0,0.3)" : "#374151", flex: 1 }}>{mod.name || "Unbenannt"}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)" }}>{mod.questions.length}F</span>
                      {alreadyAdded && <Check size={10} strokeWidth={2.5} color={PD} />}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: "auto", fontSize: 9, color: "rgba(0,0,0,0.22)", lineHeight: 1.5, textAlign: "center" }}>Klicke zum Hinzufügen · Rechtsklick für Details</div>
          </div>

          {/* Right workspace */}
          <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#f5f5f7", padding: "24px 32px" }}>

            {/* Section 1: Grundeinstellungen */}
            <div style={sectionStyle}>
              <div style={sectionHeadingStyle}>Grundeinstellungen</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. MHD Wochenkontrolle" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Beschreibung (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kurze Beschreibung..." rows={2} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>Nur einmal ausfüllbar</div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 1 }}>Dieser Fragebogen kann pro Markt jeweils nur einmal ausgefüllt werden</div>
                </div>
                <button onClick={() => setNurEinmal((v) => !v)} style={{ width: 38, height: 22, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0, background: nurEinmal ? PD : "rgba(0,0,0,0.1)", transition: "all 0.18s ease", position: "relative" }}>
                  <div style={{ position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.18s ease", left: nurEinmal ? 19 : 3 }} />
                </button>
              </div>
            </div>

            {/* Section 2: Module */}
            <div style={sectionStyle}>
              <div style={sectionHeadingStyle}>
                Module
                <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, backgroundColor: P_BG, color: PD }}>{selectedModules.length}</span>
              </div>

              {selectedModules.length === 0 ? (
                <div style={{ border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 10, padding: "24px 16px", textAlign: "center", color: "rgba(0,0,0,0.25)", fontSize: 11 }}>
                  Klicke links auf Module um sie hier hinzuzufügen
                </div>
              ) : (
                <div>
                  {selectedModules.map((mod, i) => (
                    <ModuleRow
                      key={mod.id}
                      module={mod}
                      index={i}
                      onRemove={() => removeModule(mod.id)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDropTarget={dropTarget === i}
                      expanded={expandedRowIds.has(mod.id)}
                      onToggle={() => toggleRowExpand(mod.id)}
                    />
                  ))}
                  <div style={{ height: 10 }} onDragOver={(e) => { e.preventDefault(); setDropTarget(selectedModules.length); }} onDrop={(e) => { e.preventDefault(); handleDrop(); }} />
                </div>
              )}

              {selectedModules.length > 0 && (
                <button onClick={() => {}} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 500, color: PD, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Plus size={11} strokeWidth={2} />
                  Modul aus Bibliothek hinzufügen
                </button>
              )}

              {selectedModules.length > 0 && (
                <div style={{ marginTop: 14, padding: "10px 12px", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 8, fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
                  {selectedModules.reduce((s, m) => s + m.questions.length, 0)} Fragen gesamt
                </div>
              )}
            </div>

            {/* Section 3: Zuweisung & Zeitplan */}
            <div style={sectionStyle}>
              <div style={sectionHeadingStyle}>Zuweisung &amp; Zeitplan</div>
              <div style={{ display: "flex", gap: 24 }}>
                {/* Markets */}
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Märkte{selectedMarketIds.size > 0 ? ` · ${selectedMarketIds.size} ausgewählt` : ""}</label>

                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <Search size={11} strokeWidth={1.8} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.3)", pointerEvents: "none" }} />
                    <input type="text" placeholder="Märkte suchen..." value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)} style={searchInputStyle} />
                  </div>

                  {/* Filter bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {/* Handelskette */}
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setOpenFilter(openFilter === "chain" ? null : "chain")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: filterChain.length > 0 ? `1px solid rgba(124,58,237,0.25)` : "1px solid rgba(0,0,0,0.08)", backgroundColor: filterChain.length > 0 ? P_BG_FAINT : "#fff", color: filterChain.length > 0 ? PD : "rgba(0,0,0,0.55)", cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}>
                        Handelskette
                        {filterChain.length > 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, backgroundColor: PD, color: "#fff", lineHeight: 1.4 }}>{filterChain.length}</span>}
                        <ChevronDown size={10} strokeWidth={2} style={{ transition: "transform 0.2s ease", transform: openFilter === "chain" ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </button>
                      {openFilter === "chain" && (
                        <FilterDropdown mode="multi" options={ALL_CHAINS.map((c) => { const clr = chainColor(c); return { value: c, label: c, badge: { bg: clr.bg, text: clr.text } }; })} selected={filterChain} onToggle={(v) => setFilterChain((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])} onClear={() => setFilterChain([])} onClose={() => setOpenFilter(null)} />
                      )}
                    </div>

                    {/* PLZ */}
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setOpenFilter(openFilter === "plz" ? null : "plz")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: filterPlz.length > 0 ? `1px solid rgba(124,58,237,0.25)` : "1px solid rgba(0,0,0,0.08)", backgroundColor: filterPlz.length > 0 ? P_BG_FAINT : "#fff", color: filterPlz.length > 0 ? PD : "rgba(0,0,0,0.55)", cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}>
                        PLZ
                        {filterPlz.length > 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, backgroundColor: PD, color: "#fff", lineHeight: 1.4 }}>{filterPlz.length}</span>}
                        <ChevronDown size={10} strokeWidth={2} style={{ transition: "transform 0.2s ease", transform: openFilter === "plz" ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </button>
                      {openFilter === "plz" && (
                        <FilterDropdown mode="multi" options={ALL_PLZS.map((p) => ({ value: p, label: `${p} Wien` }))} selected={filterPlz} onToggle={(v) => setFilterPlz((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])} onClear={() => setFilterPlz([])} onClose={() => setOpenFilter(null)} />
                      )}
                    </div>

                    {/* RED Monat */}
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setOpenFilter(openFilter === "redmonat" ? null : "redmonat")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 500, border: filterRedMonat ? `1px solid rgba(124,58,237,0.25)` : "1px solid rgba(0,0,0,0.08)", backgroundColor: filterRedMonat ? P_BG_FAINT : "#fff", color: filterRedMonat ? PD : "rgba(0,0,0,0.55)", cursor: "pointer", transition: "all 0.15s ease", fontFamily: "inherit" }}>
                        {filterRedMonat ?? "RED Monat"}
                        <ChevronDown size={10} strokeWidth={2} style={{ transition: "transform 0.2s ease", transform: openFilter === "redmonat" ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </button>
                      {openFilter === "redmonat" && (
                        <FilterDropdown mode="single" options={RED_MONATS.map((rm) => ({ value: rm.label, label: rm.label, sub: `${fmtDate(rm.start)} – ${fmtDate(rm.end)}` }))} selected={filterRedMonat} onSelect={(v) => setFilterRedMonat(v)} onClose={() => setOpenFilter(null)} />
                      )}
                    </div>

                    {/* Alle auswählen + reset */}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "stretch", gap: 5 }}>
                      {(() => {
                        const allFilteredSelected = filteredMarkets.length > 0 && filteredMarkets.every((m) => selectedMarketIds.has(m.id));
                        return (
                          <button
                            onClick={() => {
                              if (allFilteredSelected) { setSelectedMarketIds((prev) => { const next = new Set(prev); filteredMarkets.forEach((m) => next.delete(m.id)); return next; }); }
                              else { setSelectedMarketIds((prev) => { const next = new Set(prev); filteredMarkets.forEach((m) => next.add(m.id)); return next; }); }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, fontSize: 10, fontWeight: 600, background: `linear-gradient(to bottom, ${P}, ${PD})`, color: "#fff", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${PR}, 0 1px 6px rgba(124,58,237,0.25)`, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s ease" }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                          >
                            {allFilteredSelected ? "Alle abwählen" : "Alle auswählen"}
                            {filteredMarkets.length < TEMP_MARKETS.length && <span style={{ opacity: 0.8, fontWeight: 400 }}>({filteredMarkets.length})</span>}
                          </button>
                        );
                      })()}
                      {(filterChain.length > 0 || filterPlz.length > 0 || filterRedMonat) && (
                        <button onClick={() => { setFilterChain([]); setFilterPlz([]); setFilterRedMonat(null); setOpenFilter(null); }} title="Filter zurücksetzen" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "stretch", padding: "0 10px", borderRadius: 7, flexShrink: 0, background: "linear-gradient(to bottom, #1a1a1a, #111111)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #000, 0 1px 6px rgba(0,0,0,0.22)", border: "none", cursor: "pointer", color: "#fff", transition: "opacity 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                          <X size={11} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active filter summary */}
                  {(filterChain.length > 0 || filterPlz.length > 0 || filterRedMonat) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, padding: "6px 10px", borderRadius: 8, backgroundColor: P_BG_FAINT }}>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500, flexShrink: 0 }}>{filteredMarkets.length} / {TEMP_MARKETS.length} Märkte</span>
                      {filterChain.length > 0 && <button onClick={() => setFilterChain([])} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, backgroundColor: P_BG, color: PD, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{filterChain.join(", ")}<X size={8} strokeWidth={2.5} /></button>}
                      {filterPlz.length > 0 && <button onClick={() => setFilterPlz([])} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, backgroundColor: P_BG, color: PD, border: "none", cursor: "pointer", fontFamily: "inherit" }}>PLZ: {filterPlz.join(", ")}<X size={8} strokeWidth={2.5} /></button>}
                      {filterRedMonat && <button onClick={() => setFilterRedMonat(null)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, backgroundColor: P_BG, color: PD, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{filterRedMonat}<X size={8} strokeWidth={2.5} /></button>}
                    </div>
                  )}

                  {/* Market list */}
                  <div style={{ maxHeight: 220, overflowY: "auto", scrollbarWidth: "none" as const }}>
                    {filteredMarkets.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px 0", fontSize: 10, color: "rgba(0,0,0,0.25)" }}>Keine Märkte gefunden</div>
                    ) : (
                      filteredMarkets.map((m) => {
                        const c = chainColor(m.chain);
                        const checked = selectedMarketIds.has(m.id);
                        return (
                          <div key={m.id} onClick={() => toggleMarket(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.03)", transition: "background-color 0.1s ease", borderRadius: 4 }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                            <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, border: checked ? "none" : "1.5px solid rgba(0,0,0,0.15)", backgroundColor: checked ? PD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                              {checked && <Check size={8} strokeWidth={3} color="#fff" />}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, backgroundColor: c.bg, color: c.text, flexShrink: 0 }}>{m.chain}</span>
                            <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.address}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Vertical divider */}
                <div style={{ width: 1, background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.06) 50%, transparent)", flexShrink: 0 }} />

                {/* Schedule */}
                <div style={{ width: 220, flexShrink: 0 }}>
                  <label style={labelStyle}>Zeitplan</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, width: "100%" }}>
                    <button onClick={() => setScheduleType("always")} style={{ ...btnBase, flex: 1, textAlign: "center", ...(scheduleType === "always" ? btnActive : btnInactive) }}>Immer aktiv</button>
                    <button onClick={() => setScheduleType("scheduled")} style={{ ...btnBase, flex: 1, textAlign: "center", ...(scheduleType === "scheduled" ? btnActive : btnInactive) }}>Zeitraum</button>
                  </div>

                  {scheduleType === "scheduled" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}><Calendar size={9} strokeWidth={2} />Von</label>
                        <DatePicker value={startDate} onChange={setStartDate} placeholder="Startdatum wählen" />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}><Calendar size={9} strokeWidth={2} />Bis</label>
                        <DatePicker value={endDate} onChange={setEndDate} placeholder="Enddatum wählen" />
                      </div>
                      {startDate && endDate && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: P_BG_FAINT, fontSize: 10, color: "rgba(0,0,0,0.4)", lineHeight: 1.5, textAlign: "center" }}>
                          {new Date(startDate).toLocaleDateString("de-AT")} → {new Date(endDate).toLocaleDateString("de-AT")}
                        </div>
                      )}
                    </div>
                  )}

                  {scheduleType === "always" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "rgba(5,150,105,0.05)", fontSize: 10, color: "#059669", fontWeight: 500, lineHeight: 1.5 }}>
                      Dieser Fragebogen ist dauerhaft aktiv und läuft bis er manuell deaktiviert wird.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}
          onDetails={() => { const mod = availableModules.find((m) => m.id === contextMenu.moduleId); if (mod) setPreviewModule(mod); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Preview modal */}
      {previewModule && <ModulePreviewModal module={previewModule} onClose={() => setPreviewModule(null)} />}
    </>
  );
}
