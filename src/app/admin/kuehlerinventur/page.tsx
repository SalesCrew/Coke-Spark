"use client";

import { useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  Layers,
  FileText,
  Pencil,
  ChevronDown,
  Zap,
  Search,
  X,
  Check,
  Trophy,
  Copy,
  Trash2,
  MapPin,
  Clock,
  CalendarRange,
  Infinity,
} from "lucide-react";
import { typeLabel, typeBadgeColor, QUESTION_TYPES } from "@/utils/fragebogen";
import type { Question, Module, Fragebogen } from "@/types/fragebogen";
import type { QuestionType } from "@/types/fragebogen";
import { useKuehlerModules } from "@/app/admin/adminContexts";

// ── Yellow accent colours ──────────────────────────────────────
const Y = "#F59E0B";
const YD = "#D97706";
const YR = "#B45309";
const Y_BG = "rgba(245,158,11,0.07)";

type Tab = "fragen" | "module" | "fragebogen";

const TABS: { key: Tab; label: string }[] = [
  { key: "fragen", label: "Fragen" },
  { key: "module", label: "Module" },
  { key: "fragebogen", label: "Fragebogen" },
];

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Question Config Summary (read-only) ───────────────────────

function QuestionConfigSummary({ question }: { question: Question }) {
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
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>Skala {min}–{max}{minL || maxL ? ` (${minL || "…"} → ${maxL || "…"})` : ""}</div>;
    }
    case "matrix": {
      const rows = ((cfg.rows as string[]) || []).filter((r) => r);
      const cols = ((cfg.columns as string[]) || []).filter((c) => c);
      if (rows.length === 0 && cols.length === 0) return null;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>{rows.length} Zeilen × {cols.length} Spalten</div>;
    }
    case "slider": {
      const unit = cfg.unit as string;
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>{cfg.min as number}–{cfg.max as number}{unit ? ` ${unit}` : ""} (Schritt: {cfg.step as number})</div>;
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
      return <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instr}</div>;
    }
    case "yesnomulti": {
      const answers = ((cfg.answers as string[]) || ["Ja", "Nein"]).filter((a) => a.length > 0);
      if (answers.length === 0) return null;
      return (
        <div style={{ marginTop: 5, paddingLeft: 30 }}>
          {answers.map((o, ai) => (
            <div key={ai} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 400 }}>{o}</span>
            </div>
          ))}
        </div>
      );
    }
    case "yesno":
      return (
        <div style={{ marginTop: 5, paddingLeft: 30 }}>
          {["Ja", "Nein"].map((o) => (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 400 }}>{o}</span>
            </div>
          ))}
        </div>
      );
    default: return null;
  }
}

// ── Context Menu (shared) ──────────────────────────────────────

function KuehlerContextMenu({ x, y, onDuplicate, onDelete, onClose }: {
  x: number; y: number;
  onDuplicate: () => void; onDelete: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleDown); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: 4, minWidth: 160 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onDuplicate(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left", transition: "background-color 0.1s ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Copy size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
        Duplizieren
      </button>
      <div style={{ height: 1, margin: "3px 6px", backgroundColor: "rgba(0,0,0,0.05)" }} />
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left", transition: "background-color 0.1s ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        Löschen
      </button>
    </div>
  );
}

// ── Delete-only context menu (for questions) ───────────────────

function KuehlerDeleteMenu({ x, y, onDelete, onClose }: {
  x: number; y: number; onDelete: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleDown); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: 4, minWidth: 140 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left", transition: "background-color 0.1s ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        Löschen
      </button>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────

function ConfirmDialog({ label, onConfirm, onCancel }: {
  label: string; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 10100, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.06)", padding: "28px 28px 22px", width: 360, maxWidth: "90vw", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Trash2 size={18} strokeWidth={1.8} color="#DC2626" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 8 }}>Bist du sicher?</div>
        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.65, marginBottom: 24 }}>{label}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#fff", transition: "opacity 0.15s ease" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module Delete Dialog ───────────────────────────────────────

function ModuleDeleteDialog({ module, usedInCount, usedInNames, onDeleteModule, onClose }: {
  module: Module;
  usedInCount: number;
  usedInNames: string[];
  onDeleteModule: () => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => void } | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") { if (pending) setPending(null); else onClose(); } }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  return (
    <>
      {pending && (
        <ConfirmDialog
          label={pending.label}
          onConfirm={() => { pending.action(); setPending(null); onClose(); }}
          onCancel={() => setPending(null)}
        />
      )}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)", padding: "20px 20px 16px", width: 360, maxWidth: "90vw" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, backgroundColor: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Modul löschen</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{module.name || "Unbenanntes Modul"}</span>
                {" "}wird entfernt. Die Fragen bleiben erhalten.
              </div>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />

          {usedInCount > 0 ? (
            <div style={{ padding: "8px 12px", borderRadius: 7, marginBottom: 14, backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.12)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626" }}>
                Wird in {usedInNames.join(", ")} verwendet
              </span>
            </div>
          ) : (
            <div style={{ padding: "8px 12px", borderRadius: 7, marginBottom: 14, backgroundColor: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.12)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#047857" }}>Wird in keinem Fragebogen verwendet</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Abbrechen
            </button>
            <button
              onClick={() => setPending({ label: `"${module.name || "Unbenanntes Modul"}" wird gelöscht. Fragen bleiben erhalten.`, action: onDeleteModule })}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff", transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Fragen List Item (rich, expandable) ────────────────────────

function KuehlerFragenListItem({ question, moduleName, onDelete }: {
  question: Question;
  moduleName: string;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const badge = typeBadgeColor(question.type);

  useEffect(() => {
    if (!ctxMenu) return;
    function handle(e: MouseEvent) { if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setCtxMenu(null); }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handleKey); };
  }, [ctxMenu]);

  return (
    <div
      style={{ borderBottom: "1px solid rgba(0,0,0,0.03)", position: "relative" }}
      onContextMenu={(e) => { if (!onDelete) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {ctxMenu && onDelete && (
        <div ref={ctxRef}>
          <KuehlerDeleteMenu
            x={ctxMenu.x} y={ctxMenu.y}
            onDelete={() => { setCtxMenu(null); onDelete(); }}
            onClose={() => setCtxMenu(null)}
          />
        </div>
      )}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", cursor: "pointer", userSelect: "none", transition: "background-color 0.12s ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.01)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        {/* Type badge */}
        <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em", flexShrink: 0 }}>
          {typeLabel(question.type)}
        </span>

        {/* Question text */}
        <span style={{ fontSize: 11, fontWeight: 500, color: question.text ? "#374151" : "rgba(0,0,0,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {question.text || "Unbenannt"}
        </span>

        {/* Indicators */}
        {question.rules.length > 0 && <Zap size={10} strokeWidth={2} color={YD} style={{ flexShrink: 0 }} />}
        {Object.keys(question.scoring || {}).some(k => { const sw = (question.scoring || {})[k]; return sw?.ipp != null || sw?.boni != null; }) && (
          <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
        )}
        {question.required && (
          <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.25)", flexShrink: 0 }}>Pflicht</span>
        )}

        {/* Module origin pill */}
        {moduleName === "Unzugewiesen" ? (
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
            Nicht zugewiesen
          </span>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(245,158,11,0.06)", color: YD, flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {moduleName}
          </span>
        )}

        {/* Expand chevron */}
        <ChevronDown size={12} strokeWidth={1.8} color="rgba(0,0,0,0.2)" style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>

      {/* Expanded detail */}
      <div style={{ maxHeight: expanded ? 300 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 18px 12px" }}>
          <QuestionConfigSummary question={question} />
        </div>
      </div>
    </div>
  );
}

// ── Module Card ────────────────────────────────────────────────

function KuehlerModuleCard({ module, usedInCount, usedInNames, onEdit, onDuplicate, onDelete }: {
  module: Module;
  usedInCount: number;
  usedInNames: string[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const typeFingerprint = Array.from(new Set(module.questions.map((q) => q.type)));

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      style={{ backgroundColor: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", transition: "box-shadow 0.15s ease", position: "relative" }}
    >
      {ctxMenu && (
        <KuehlerContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onDuplicate={onDuplicate}
          onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {deleteDialog && (
        <ModuleDeleteDialog
          module={module}
          usedInCount={usedInCount}
          usedInNames={usedInNames}
          onDeleteModule={onDelete}
          onClose={() => setDeleteDialog(false)}
        />
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", userSelect: "none" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{module.name}</span>
          </div>
          {module.description && (
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{module.description}</div>
          )}
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.45)" }}>
            {module.questions.length} {module.questions.length === 1 ? "Frage" : "Fragen"}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, backgroundColor: usedInCount > 0 ? Y_BG : "rgba(0,0,0,0.03)", color: usedInCount > 0 ? YD : "rgba(0,0,0,0.3)" }}>
            {usedInCount > 0 ? `In ${usedInCount} Fragebogen` : "Nicht verwendet"}
          </span>
        </div>

        {/* Edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.03)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background-color 0.12s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        >
          <Pencil size={12} strokeWidth={1.8} color="rgba(0,0,0,0.35)" />
        </button>

        <ChevronDown size={14} strokeWidth={1.8} color="rgba(0,0,0,0.25)" style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>

      {/* Type fingerprint strip */}
      {typeFingerprint.length > 0 && !expanded && (
        <div style={{ display: "flex", gap: 4, padding: "0 18px 12px" }}>
          {typeFingerprint.map((t) => {
            const badge = typeBadgeColor(t);
            return (
              <span key={t} style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em" }}>{typeLabel(t)}</span>
            );
          })}
        </div>
      )}

      {/* Expanded detail view */}
      <div style={{ maxHeight: expanded ? 2000 : 0, opacity: expanded ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", padding: "12px 18px 16px" }}>
          {module.questions.length === 0 ? (
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontStyle: "italic", padding: "8px 0" }}>Keine Fragen in diesem Modul.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {module.questions.map((q, qi) => {
                const badge = typeBadgeColor(q.type);
                return (
                  <div key={q.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(to bottom, ${Y}, ${YD})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>{qi + 1}</span>
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em", flexShrink: 0 }}>{typeLabel(q.type)}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: q.text ? "#374151" : "rgba(0,0,0,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.text || "Unbenannt"}</span>
                      {q.rules.length > 0 && <Zap size={10} strokeWidth={2} color={YD} style={{ flexShrink: 0 }} />}
                      {Object.keys(q.scoring || {}).some((k) => { const sw = (q.scoring || {})[k]; return sw?.ipp != null || sw?.boni != null; }) && (
                        <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
                      )}
                      {q.required && <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.25)", flexShrink: 0 }}>Pflicht</span>}
                    </div>
                    <QuestionConfigSummary question={q} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 10, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}
            >
              <Pencil size={10} strokeWidth={2} />
              Bearbeiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Card ────────────────────────────────────────────

function KuehlerFragebogenDeleteDialog({
  fragebogen,
  onDeleteOnly,
  onClose,
}: {
  fragebogen: Fragebogen;
  onDeleteOnly: () => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => void } | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") { if (pending) setPending(null); else onClose(); } }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  return (
    <>
      {pending && (
        <ConfirmDialog
          label={pending.label}
          onConfirm={() => { pending.action(); setPending(null); onClose(); }}
          onCancel={() => setPending(null)}
        />
      )}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)", padding: "20px 20px 16px", width: 360, maxWidth: "90vw" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, backgroundColor: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Fragebogen löschen</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{fragebogen.name || "Unbenannter Fragebogen"}</span>
                {" "}wird entfernt. Module und Fragen bleiben erhalten.
              </div>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 16 }} />

          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Abbrechen
            </button>
            <button
              onClick={() => setPending({
                label: `"${fragebogen.name || "Unbenannter Fragebogen"}" wird gelöscht. Module und Fragen bleiben erhalten.`,
                action: onDeleteOnly,
              })}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff", transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function KuehlerFragebogenCard({ fragebogen, modules, onEdit, onDuplicate, onDelete }: {
  fragebogen: Fragebogen;
  modules: Module[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const assignedModules = (fragebogen.moduleIds || [])
    .map((id) => modules.find((m) => m.id === id))
    .filter((m): m is Module => !!m);

  const status = fragebogen.status;

  const accentColor =
    status === "active" ? YD :
    status === "scheduled" ? "#d97706" :
    "transparent";

  const statusConfig = {
    active: { label: "Aktiv", bg: Y_BG, text: YD, dot: YD },
    scheduled: { label: "Geplant", bg: "rgba(245,158,11,0.08)", text: "#d97706", dot: Y },
    inactive: { label: "Inaktiv", bg: "rgba(0,0,0,0.04)", text: "rgba(0,0,0,0.3)", dot: "rgba(0,0,0,0.2)" },
  }[status];

  const days = status === "scheduled" ? daysUntil(fragebogen.startDate) : null;

  return (
    <>
      {ctxMenu && (
        <KuehlerContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onDuplicate={() => { onDuplicate(); setCtxMenu(null); }}
          onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {deleteDialog && (
        <KuehlerFragebogenDeleteDialog
          fragebogen={fragebogen}
          onDeleteOnly={onDelete}
          onClose={() => setDeleteDialog(false)}
        />
      )}
      <div
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
          borderLeft: accentColor !== "transparent" ? `3px solid ${accentColor}` : undefined,
        }}
      >
        <div style={{ padding: "16px 20px", opacity: status === "inactive" ? 0.55 : 1 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", flex: 1, letterSpacing: "-0.01em" }}>
              {fragebogen.name || "Unbenannt"}
            </span>

            {fragebogen.nurEinmalAusfuellbar && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 9px", borderRadius: 20, backgroundColor: Y_BG, color: YD, letterSpacing: "0.02em" }}>1×</span>
            )}

            {/* Status pill with dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, backgroundColor: statusConfig.bg }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusConfig.dot }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: statusConfig.text, letterSpacing: "0.03em" }}>{statusConfig.label}</span>
            </div>

            {/* Edit button */}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", transition: "color 0.15s ease", borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = YD)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>

            {/* Expand chevron */}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", transition: "all 0.2s ease" }}
            >
              <ChevronDown size={14} strokeWidth={1.8} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
            </button>
          </div>

          {/* Module pills row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {assignedModules.length === 0 ? (
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}>Keine Module</span>
            ) : assignedModules.map((m) => (
              <span key={m.id} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.4)" }}>
                {m.name || "Unbenannt"}
              </span>
            ))}
          </div>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>
                {fragebogen.markets.length} {fragebogen.markets.length === 1 ? "Markt" : "Märkte"}
              </span>
            </div>

            <div style={{ width: 1, height: 12, backgroundColor: "rgba(0,0,0,0.06)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {fragebogen.scheduleType === "always" ? (
                <>
                  <Infinity size={11} strokeWidth={1.8} color="#059669" />
                  <span style={{ fontSize: 10, color: "#059669", fontWeight: 500 }}>Immer aktiv</span>
                </>
              ) : (
                <>
                  <CalendarRange size={11} strokeWidth={1.8} color={statusConfig.text} />
                  <span style={{ fontSize: 10, color: statusConfig.text, fontWeight: 500 }}>
                    {status === "inactive"
                      ? `Beendet ${formatDate(fragebogen.endDate)}`
                      : `${formatDate(fragebogen.startDate)} → ${formatDate(fragebogen.endDate)}`}
                  </span>
                </>
              )}
            </div>

            {status === "scheduled" && days !== null && (
              <>
                <div style={{ width: 1, height: 12, backgroundColor: "rgba(0,0,0,0.06)" }} />
                <span style={{ fontSize: 9, color: "#d97706", fontWeight: 600 }}>
                  Startet in {days} {days === 1 ? "Tag" : "Tagen"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expanded detail */}
        <div style={{ maxHeight: expanded ? 400 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", padding: "14px 20px 16px", backgroundColor: "rgba(0,0,0,0.01)" }}>
            {/* Modules detail */}
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 8 }}>
                Module ({assignedModules.length})
              </span>
              {assignedModules.length === 0 ? (
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}>Keine Module zugewiesen</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {assignedModules.map((m, i) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.2)", width: 16, textAlign: "right" }}>{i + 1}.</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#374151", flex: 1 }}>{m.name || "Unbenannt"}</span>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{m.questions.length} Fragen</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Markets detail */}
            {fragebogen.markets.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 8 }}>
                  Märkte ({fragebogen.markets.length})
                </span>
                <div style={{ maxHeight: 120, overflowY: "auto", scrollbarWidth: "none" as const }}>
                  {fragebogen.markets.map((m) => (
                    <div key={m.marketId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>{m.chain}</span>
                      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Created date */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={10} strokeWidth={1.8} color="rgba(0,0,0,0.2)" />
              <span style={{ fontSize: 9, color: "rgba(0,0,0,0.25)" }}>Erstellt {formatDate(fragebogen.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Empty State ────────────────────────────────────────────────

function EmptyState({ tab }: { tab: Tab }) {
  const map: Record<Tab, { icon: React.ReactNode; title: string; sub: string }> = {
    fragen: { icon: <HelpCircle size={18} strokeWidth={1.5} color={Y} />, title: "Keine Fragen vorhanden", sub: "Erstelle ein Modul und füge Fragen hinzu" },
    module: { icon: <Layers size={18} strokeWidth={1.5} color={Y} />, title: "Keine Module vorhanden", sub: "Erstelle ein Modul um Fragen thematisch zu gruppieren" },
    fragebogen: { icon: <FileText size={18} strokeWidth={1.5} color={Y} />, title: "Keine Fragebogen vorhanden", sub: "Erstelle einen Fragebogen für die Kühlerinventur" },
  };
  const { icon, title, sub } = map[tab];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: Y_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{title}</span>
      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", textAlign: "center" }}>{sub}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function KuehlerinventurPage() {
  const { modules = [], onEdit, onUpdate, onDelete, onDuplicate, fragebogenList = [], onEditFb, onDeleteFb, onDuplicateFb } = useKuehlerModules();
  const [activeTab, setActiveTab] = useState<Tab>("module");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeDropOpen) return;
    function handle(e: MouseEvent) { if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node)) setTypeDropOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [typeDropOpen]);

  // Gather all questions from all modules
  const allQuestions: { question: Question; moduleName: string }[] = [];
  modules.forEach((m) => { m.questions.forEach((q) => { allQuestions.push({ question: q, moduleName: m.name }); }); });

  const q = search.trim().toLowerCase();
  const filteredQuestions = allQuestions.filter(({ question, moduleName }) => {
    if (filterType && question.type !== filterType) return false;
    if (!q) return true;
    return question.text.toLowerCase().includes(q) || moduleName.toLowerCase().includes(q) || typeLabel(question.type).toLowerCase().includes(q);
  });

  const visibleModules = modules.filter((m) => m.id !== "__kuehler_unassigned__");
  const filteredModules = q
    ? visibleModules.filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.questions.some((qst) => qst.text.toLowerCase().includes(q)))
    : visibleModules;

  const filteredFragebogen = q
    ? fragebogenList.filter((fb) => fb.name.toLowerCase().includes(q) || fb.description.toLowerCase().includes(q))
    : fragebogenList;

  // Sort fragebogen: active → scheduled (by startDate) → inactive
  const sortedFragebogen = [
    ...filteredFragebogen.filter((fb) => fb.status === "active"),
    ...[...filteredFragebogen.filter((fb) => fb.status === "scheduled")].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")),
    ...filteredFragebogen.filter((fb) => fb.status === "inactive"),
  ];

  const counts: Record<Tab, number> = {
    fragen: allQuestions.length,
    module: visibleModules.length,
    fragebogen: fragebogenList.length,
  };

  return (
    <div>
      {/* Tab bar */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
          <div style={{ display: "flex", gap: 24, flex: 1 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = counts[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", fontSize: 12, fontWeight: isActive ? 650 : 500, color: isActive ? YD : "rgba(0,0,0,0.4)", backgroundColor: "transparent", border: "none", borderBottom: "2px solid transparent", backgroundImage: isActive ? `linear-gradient(#f5f5f7, #f5f5f7), linear-gradient(to right, ${Y}, ${YD})` : "none", backgroundOrigin: "padding-box, border-box", backgroundClip: "padding-box, border-box", cursor: "pointer", transition: "all 0.2s ease", letterSpacing: "-0.01em", position: "relative" }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", backgroundColor: isActive ? Y_BG : "rgba(0,0,0,0.05)", color: isActive ? YD : "rgba(0,0,0,0.35)" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 0, marginBottom: -4 }}>
            <div style={{ width: 1, height: 14, backgroundColor: "rgba(0,0,0,0.06)", flexShrink: 0 }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.22)" style={{ position: "absolute", left: 0, pointerEvents: "none" }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen"
                style={{ paddingLeft: 18, paddingRight: search ? 20 : 0, paddingTop: 4, paddingBottom: 4, background: "transparent", border: "none", fontSize: 11, fontFamily: "inherit", color: "#111", outline: "none", width: 140 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 0, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "rgba(0,0,0,0.25)" }}>
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {/* Type filter — Fragen tab only */}
          {activeTab === "fragen" && (
            <div ref={typeDropRef} style={{ position: "relative", marginBottom: -4 }}>
              <button
                onClick={() => setTypeDropOpen((o) => !o)}
                style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 6, background: "transparent", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: filterType ? YD : "rgba(0,0,0,0.35)", fontWeight: filterType ? 600 : 400 }}
              >
                {filterType ? typeLabel(filterType as QuestionType) : "Typ"}
                <ChevronDown size={9} strokeWidth={2.5} style={{ transition: "transform 0.15s", transform: typeDropOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {typeDropOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 300, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)", padding: "6px 0", minWidth: 160 }}>
                  <button onClick={() => { setFilterType(null); setTypeDropOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: !filterType ? YD : "rgba(0,0,0,0.55)", fontWeight: !filterType ? 600 : 400 }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    Alle Typen
                    {!filterType && <Check size={10} strokeWidth={2.5} color={YD} />}
                  </button>
                  <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", margin: "4px 0" }} />
                  {QUESTION_TYPES.map((qt) => {
                    const badge = typeBadgeColor(qt.key);
                    const isSelected = filterType === qt.key;
                    return (
                      <button key={qt.key} onClick={() => { setFilterType(qt.key); setTypeDropOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: isSelected ? badge.text : "rgba(0,0,0,0.55)", fontWeight: isSelected ? 600 : 400 }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text }}>{qt.label}</span>
                        </span>
                        {isSelected && <Check size={10} strokeWidth={2.5} color={badge.text} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginTop: -1 }} />
      </div>

      {/* Tab content */}
      <div style={{ marginTop: 16 }}>

        {/* ── Module tab ── */}
        {activeTab === "module" && (
          filteredModules.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState tab="module" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredModules.map((m) => {
                const usedIn = fragebogenList.filter((fb) => fb.moduleIds.includes(m.id));
                return (
                  <KuehlerModuleCard
                    key={m.id}
                    module={m}
                    usedInCount={usedIn.length}
                    usedInNames={usedIn.map((fb) => fb.name)}
                    onEdit={() => onEdit(m)}
                    onDuplicate={() => onDuplicate(m)}
                    onDelete={() => onDelete(m.id)}
                  />
                );
              })}
            </div>
          )
        )}

        {/* ── Fragen tab ── */}
        {activeTab === "fragen" && (
          filteredQuestions.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState tab="fragen" />
            </div>
          ) : (
            <div style={{ backgroundColor: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              {filteredQuestions.map(({ question, moduleName }, i) => (
                <KuehlerFragenListItem
                  key={`${question.id}-${i}`}
                  question={question}
                  moduleName={moduleName}
                  onDelete={() => {
                    const ownerModule = modules.find((m) => m.questions.some((qq) => qq.id === question.id));
                    if (ownerModule) {
                      onUpdate({ ...ownerModule, questions: ownerModule.questions.filter((qq) => qq.id !== question.id) });
                    }
                  }}
                />
              ))}
            </div>
          )
        )}

        {/* ── Fragebogen tab ── */}
        {activeTab === "fragebogen" && (
          sortedFragebogen.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState tab="fragebogen" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedFragebogen.map((fb) => (
                <KuehlerFragebogenCard
                  key={fb.id}
                  fragebogen={fb}
                  modules={modules}
                  onEdit={() => onEditFb(fb)}
                  onDuplicate={() => onDuplicateFb(fb)}
                  onDelete={() => onDeleteFb(fb.id)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
