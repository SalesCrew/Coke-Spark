"use client";

import { useState, useRef, useEffect } from "react";
import {
  HelpCircle, Layers, FileText, Pencil, ChevronDown,
  Zap, MapPin, Clock, CalendarRange, Infinity, Trophy,
  Search, X, Check, Copy, Trash2,
} from "lucide-react";
import { typeLabel, typeBadgeColor, QUESTION_TYPES } from "@/utils/fragebogen";
import type { QuestionType, Module, Fragebogen } from "@/types/fragebogen";
import { useFlexModules, useBillaModules } from "@/app/admin/adminContexts";
import { useModules } from "@/context/ModuleContext";

// ── Color theme ──────────────────────────────────────────────
const L   = "#84CC16";
const LD  = "#65a30d";
const L_BG = "rgba(132,204,22,0.07)";

// ── Local types (fully isolated) ────────────────────────────

type Tab = "fragen" | "module" | "fragebogen";

const TABS: { key: Tab; label: string }[] = [
  { key: "fragen",     label: "Fragen"     },
  { key: "module",     label: "Module"     },
  { key: "fragebogen", label: "Fragebogen" },
];

// Use shared Module/Fragebogen types from context; keep local aliases for clarity
type FlexModule = Module;
type FlexFragebogen = Fragebogen;

// ── Helpers ──────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Context menu (shared) ────────────────────────────────────

function FlexContextMenu({ x, y, onDuplicate, onDelete, onClose }: {
  x: number; y: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function key(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: 4, minWidth: 160 }}>
      <button onClick={(e) => { e.stopPropagation(); onDuplicate(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Copy size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
        Duplizieren
      </button>
      <div style={{ height: 1, margin: "3px 6px", backgroundColor: "rgba(0,0,0,0.05)" }} />
      <button onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        Löschen
      </button>
    </div>
  );
}

// ── Fragebogen context menu (with cross-dup flyout) ──────────

function FlexFbContextMenu({ x, y, onDuplicate, onDuplicateToStd, onDuplicateToBilla, onDelete, onClose }: {
  x: number; y: number;
  onDuplicate: () => void;
  onDuplicateToStd: () => void;
  onDuplicateToBilla: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dupOpen, setDupOpen] = useState(false);
  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function key(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: 4, minWidth: 175 }}>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setDupOpen(true)}
        onMouseLeave={() => setDupOpen(false)}
      >
        <button
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: dupOpen ? "rgba(0,0,0,0.03)" : "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
        >
          <Copy size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          Duplizieren
          <span style={{ marginLeft: "auto", opacity: 0.4, fontSize: 10 }}>▶</span>
        </button>
        {dupOpen && (
          <div style={{ position: "absolute", left: "100%", top: 0, zIndex: 10000, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", padding: 4, minWidth: 185, marginLeft: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = L_BG)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: L, flexShrink: 0 }} />
              Hier (Flexbesuche)
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicateToStd(); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#DC2626", flexShrink: 0 }} />
              Zu Standartbesuch kopieren
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicateToBilla(); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(8,145,178,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#0891B2", flexShrink: 0 }} />
              Zu Billa kopieren
            </button>
          </div>
        )}
      </div>
      <div style={{ height: 1, margin: "3px 6px", backgroundColor: "rgba(0,0,0,0.05)" }} />
      <button onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        Löschen
      </button>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────

function ConfirmDialog({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void; }) {
  useEffect(() => {
    function key(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
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
          <button onClick={onCancel} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            Abbrechen
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module delete dialog ──────────────────────────────────────

function FlexModuleDeleteDialog({ module, usedInCount, usedInNames, onDeleteModule, onClose }: {
  module: FlexModule; usedInCount: number; usedInNames: string[];
  onDeleteModule: () => void; onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => void } | null>(null);
  useEffect(() => {
    function key(e: KeyboardEvent) { if (e.key === "Escape") { if (pending) setPending(null); else onClose(); } }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose, pending]);

  return (
    <>
      {pending && <ConfirmDialog label={pending.label} onConfirm={() => { pending.action(); setPending(null); onClose(); }} onCancel={() => setPending(null)} />}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)", padding: "20px 20px 16px", width: 360, maxWidth: "90vw" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, backgroundColor: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Modul löschen</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{module.name || "Unbenanntes Modul"}</span>{" "}wird entfernt. Die Fragen bleiben erhalten.
              </div>
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />
          {usedInCount > 0 ? (
            <div style={{ padding: "8px 12px", borderRadius: 7, marginBottom: 14, backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.12)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626" }}>Wird in {usedInNames.join(", ")} verwendet</span>
            </div>
          ) : (
            <div style={{ padding: "8px 12px", borderRadius: 7, marginBottom: 14, backgroundColor: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.12)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#047857" }}>Wird in keinem Fragebogen verwendet</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Abbrechen
            </button>
            <button onClick={() => setPending({ label: `"${module.name || "Unbenanntes Modul"}" wird gelöscht. Fragen bleiben erhalten.`, action: onDeleteModule })}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Löschen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Fragebogen delete dialog ──────────────────────────────────

function FlexFragebogenDeleteDialog({ fragebogen, onDeleteOnly, onClose }: {
  fragebogen: FlexFragebogen; onDeleteOnly: () => void; onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => void } | null>(null);
  useEffect(() => {
    function key(e: KeyboardEvent) { if (e.key === "Escape") { if (pending) setPending(null); else onClose(); } }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose, pending]);

  return (
    <>
      {pending && <ConfirmDialog label={pending.label} onConfirm={() => { pending.action(); setPending(null); onClose(); }} onCancel={() => setPending(null)} />}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)", padding: "20px 20px 16px", width: 360, maxWidth: "90vw" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, backgroundColor: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Fragebogen löschen</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{fragebogen.name || "Unbenannt"}</span>{" "}wird entfernt. Module und Fragen bleiben erhalten.
              </div>
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Abbrechen
            </button>
            <button onClick={() => setPending({ label: `"${fragebogen.name || "Unbenannt"}" wird gelöscht. Module und Fragen bleiben erhalten.`, action: onDeleteOnly })}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Löschen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Module Card ───────────────────────────────────────────────

function FlexModuleCard({ module, onEdit, onDuplicate, onDelete, usedInFragebogen }: {
  module: FlexModule;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  usedInFragebogen: { count: number; names: string[] };
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const typeFingerprint = Array.from(new Set(module.questions.map((q) => q.type)));

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      style={{ backgroundColor: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", position: "relative" }}
    >
      {ctxMenu && (
        <FlexContextMenu x={ctxMenu.x} y={ctxMenu.y}
          onDuplicate={onDuplicate}
          onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {deleteDialog && (
        <FlexModuleDeleteDialog
          module={module}
          usedInCount={usedInFragebogen.count}
          usedInNames={usedInFragebogen.names}
          onDeleteModule={onDelete}
          onClose={() => setDeleteDialog(false)}
        />
      )}

      {/* Header row */}
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{module.name}</span>
          </div>
          {module.description && (
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {module.description}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.45)" }}>
            {module.questions.length} {module.questions.length === 1 ? "Frage" : "Fragen"}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, backgroundColor: usedInFragebogen.count > 0 ? `${L_BG}` : "rgba(0,0,0,0.03)", color: usedInFragebogen.count > 0 ? L : "rgba(0,0,0,0.3)" }}>
            {usedInFragebogen.count > 0 ? `In ${usedInFragebogen.count} Fragebogen` : "Nicht verwendet"}
          </span>
        </div>

        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.03)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background-color 0.12s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        >
          <Pencil size={12} strokeWidth={1.8} color="rgba(0,0,0,0.35)" />
        </button>

        <ChevronDown size={14} strokeWidth={1.8} color="rgba(0,0,0,0.25)"
          style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </div>

      {/* Type fingerprint strip */}
      {typeFingerprint.length > 0 && !expanded && (
        <div style={{ display: "flex", gap: 4, padding: "0 18px 12px" }}>
          {typeFingerprint.map((t) => {
            const badge = typeBadgeColor(t);
            return (
              <span key={t} style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em" }}>
                {typeLabel(t)}
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded detail */}
      <div style={{ maxHeight: expanded ? 2000 : 0, opacity: expanded ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)", padding: "12px 18px 16px" }}>
          {module.questions.length === 0 ? (
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontStyle: "italic", padding: "8px 0" }}>Keine Fragen in diesem Modul.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {module.questions.map((q, qi) => {
                const badge = typeBadgeColor(q.type);
                return (
                  <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(to bottom, ${L}, ${LD})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>{qi + 1}</span>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em", flexShrink: 0 }}>
                      {typeLabel(q.type)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: q.text ? "#374151" : "rgba(0,0,0,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.text || "Unbenannt"}
                    </span>
                    {q.rules.length > 0 && <Zap size={10} strokeWidth={2} color={L} style={{ flexShrink: 0 }} />}
                    {Object.keys(q.scoring || {}).some(k => { const sw = (q.scoring || {})[k]; return sw?.ipp != null || sw?.boni != null; }) && (
                      <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
                    )}
                    {q.required && <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.25)", flexShrink: 0 }}>Pflicht</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 10, fontWeight: 600, color: "#ffffff", background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)", border: "none", borderRadius: 7, cursor: "pointer", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)" }}>
              <Pencil size={10} strokeWidth={2} />
              Bearbeiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fragen list item ──────────────────────────────────────────

function FlexFragenListItem({ question, moduleName, onDelete }: {
  question: import("@/types/fragebogen").Question; moduleName: string; onDelete?: () => void;
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
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.03)", position: "relative" }}
      onContextMenu={(e) => { if (!onDelete) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {ctxMenu && onDelete && (
        <div ref={ctxRef} style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: 4, minWidth: 140 }}>
          <button onClick={(e) => { e.stopPropagation(); setCtxMenu(null); onDelete(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
            Löschen
          </button>
        </div>
      )}

      <div onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", cursor: "pointer", userSelect: "none" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.01)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em", flexShrink: 0 }}>
          {typeLabel(question.type)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: question.text ? "#374151" : "rgba(0,0,0,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {question.text || "Unbenannt"}
        </span>
        {question.rules.length > 0 && <Zap size={10} strokeWidth={2} color={L} style={{ flexShrink: 0 }} />}
        {Object.keys(question.scoring || {}).some(k => { const sw = (question.scoring || {})[k]; return sw?.ipp != null || sw?.boni != null; }) && (
          <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
        )}
        {question.required && <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.25)", flexShrink: 0 }}>Pflicht</span>}

        {/* Module origin pill */}
        {moduleName === "Nicht zugewiesen" ? (
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)", flexShrink: 0 }}>Nicht zugewiesen</span>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: L_BG, color: L, flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {moduleName}
          </span>
        )}

        <ChevronDown size={12} strokeWidth={1.8} color="rgba(0,0,0,0.2)"
          style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </div>

      <div style={{ maxHeight: expanded ? 300 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 18px 12px", fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
          {question.text || "Kein Fragetext"}
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Card ───────────────────────────────────────────

function FlexFragebogenCard({ fragebogen, moduleList, onEdit, onDuplicate, onDuplicateToStd, onDuplicateToBilla, onDelete }: {
  fragebogen: FlexFragebogen;
  moduleList: FlexModule[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDuplicateToStd: () => void;
  onDuplicateToBilla: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const statusConfig = {
    active:    { label: "Aktiv",     dot: L,        bg: L_BG,                      text: L },
    scheduled: { label: "Geplant",   dot: "#f59e0b", bg: "rgba(245,158,11,0.08)",  text: "#d97706" },
    inactive:  { label: "Inaktiv",   dot: "rgba(0,0,0,0.2)", bg: "rgba(0,0,0,0.04)", text: "rgba(0,0,0,0.3)" },
  };
  const sc = statusConfig[fragebogen.status];
  const days = daysUntil(fragebogen.startDate);
  const assignedModules = moduleList.filter((m) => fragebogen.moduleIds.includes(m.id));

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", position: "relative", borderLeft: `3px solid ${fragebogen.status === "active" ? L : fragebogen.status === "scheduled" ? "#d97706" : "transparent"}`, opacity: fragebogen.status === "inactive" ? 0.55 : 1, marginBottom: 0 }}
    >
      {ctxMenu && (
        <FlexFbContextMenu x={ctxMenu.x} y={ctxMenu.y}
          onDuplicate={onDuplicate}
          onDuplicateToStd={onDuplicateToStd}
          onDuplicateToBilla={onDuplicateToBilla}
          onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {deleteDialog && (
        <FlexFragebogenDeleteDialog fragebogen={fragebogen} onDeleteOnly={onDelete} onClose={() => setDeleteDialog(false)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "16px 18px 10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{fragebogen.name || "Unbenannt"}</span>
            <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20, backgroundColor: sc.bg, color: sc.text, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: sc.dot, display: "inline-block" }} />
              {sc.label}
            </span>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(0,0,0,0.25)", flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = L)}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}
        >
          <Pencil size={13} strokeWidth={1.6} />
        </button>
        <button onClick={() => setExpanded(!expanded)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
          <ChevronDown size={14} strokeWidth={1.8} color="rgba(0,0,0,0.25)"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }} />
        </button>
      </div>

      {/* Module pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 18px 10px" }}>
        {assignedModules.length === 0 ? (
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontStyle: "italic" }}>Keine Module</span>
        ) : assignedModules.map((m) => (
          <span key={m.id} style={{ fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.4)" }}>
            {m.name}
          </span>
        ))}
      </div>

      {/* Footer row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 14px", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{fragebogen.markets.length} Märkte</span>
        </div>
        <div style={{ width: 1, height: 10, backgroundColor: "rgba(0,0,0,0.08)", flexShrink: 0 }} />
        {fragebogen.status === "scheduled" && fragebogen.startDate && fragebogen.endDate ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <CalendarRange size={10} strokeWidth={1.8} color="#d97706" />
            <span style={{ fontSize: 10, color: "#d97706", fontWeight: 500 }}>{formatDate(fragebogen.startDate)} – {formatDate(fragebogen.endDate)}</span>
            {days !== null && days > 0 && (
              <span style={{ fontSize: 9, color: "#d97706", fontWeight: 600, marginLeft: 4 }}>Startet in {days} {days === 1 ? "Tag" : "Tagen"}</span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Infinity size={10} strokeWidth={1.8} color="#059669" />
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 500 }}>Immer aktiv</span>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      <div style={{ maxHeight: expanded ? 1000 : 0, opacity: expanded ? 1 : 0, overflow: "hidden", transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease" }}>
        <div style={{ backgroundColor: "rgba(0,0,0,0.01)", borderTop: "1px solid rgba(0,0,0,0.04)", padding: "14px 18px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.25)", marginBottom: 8 }}>Module</div>
          {assignedModules.length === 0 ? (
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontStyle: "italic" }}>Keine Module zugewiesen</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              {assignedModules.map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", minWidth: 14, textAlign: "right" }}>{i + 1}.</span>
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{m.name}</span>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{m.questions.length} {m.questions.length === 1 ? "Frage" : "Fragen"}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={9} strokeWidth={1.8} color="rgba(0,0,0,0.2)" />
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.25)" }}>Erstellt {formatDate(fragebogen.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

function FlexEmptyState({ tab }: { tab: Tab }) {
  const cfg = {
    fragen:     { icon: HelpCircle, message: "Keine Fragen vorhanden",     sub: "Fragen werden automatisch angezeigt, sobald ein Modul mit Fragen erstellt wird." },
    module:     { icon: Layers,     message: "Keine Module vorhanden",     sub: "Erstelle ein Modul um Fragen thematisch zu gruppieren." },
    fragebogen: { icon: FileText,   message: "Keine Fragebogen vorhanden", sub: "Erstelle einen Fragebogen um Module zusammenzufassen und zu verteilen." },
  }[tab];
  const Icon = cfg.icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} strokeWidth={1.4} color="rgba(0,0,0,0.18)" />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.3)", letterSpacing: "-0.01em" }}>{cfg.message}</span>
      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)", maxWidth: 260, textAlign: "center", lineHeight: 1.5 }}>{cfg.sub}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function FlexbesuchePage() {
  const { modules, fragebogenList, onEdit, onUpdate, onDelete, onDuplicate, onEditFb, onDeleteFb, onDuplicateFb, duplicateFbToStd } = useFlexModules();
  // Merge Standartbesuch and Billa questions into the shared question view
  const { modules: stdModules } = useModules();
  const { modules: billaModules, duplicateFbToBilla } = useBillaModules();
  const [activeTab, setActiveTab] = useState<Tab>("module");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeDropOpen) return;
    function handle(e: MouseEvent) {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node)) setTypeDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [typeDropOpen]);

  // Merge all modules from all contexts, sort oldest-first globally, then dedup by question ID
  const allQuestions: { question: import("@/types/fragebogen").Question; moduleName: string }[] = [];
  [...modules, ...stdModules, ...billaModules]
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .forEach((m) => {
      m.questions.forEach((q) => {
        if (!allQuestions.some(({ question }) => question.id === q.id)) {
          allQuestions.push({ question: q, moduleName: m.name });
        }
      });
    });

  const q = search.trim().toLowerCase();

  const filteredQuestions = allQuestions.filter(({ question, moduleName }) => {
    if (filterType && question.type !== filterType) return false;
    if (!q) return true;
    return question.text.toLowerCase().includes(q) || moduleName.toLowerCase().includes(q) || typeLabel(question.type).toLowerCase().includes(q);
  });

  const filteredModules = (q
    ? modules.filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.questions.some((qst) => qst.text.toLowerCase().includes(q)))
    : modules).filter((m) => m.id !== "__flex_unassigned__");

  const filteredFragebogen = q
    ? fragebogenList.filter((fb) => fb.name.toLowerCase().includes(q) || fb.description.toLowerCase().includes(q))
    : fragebogenList;

  return (
    <div>
      {/* Tab bar */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
          <div style={{ display: "flex", gap: 24, flex: 1 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tab.key === "module" ? filteredModules.length : tab.key === "fragen" ? allQuestions.length : fragebogenList.length;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 0", fontSize: 12, fontWeight: isActive ? 650 : 500,
                    color: isActive ? L : "rgba(0,0,0,0.4)",
                    backgroundColor: "transparent", border: "none",
                    borderBottom: "2px solid transparent",
                    backgroundImage: isActive ? `linear-gradient(#f5f5f7, #f5f5f7), linear-gradient(to right, ${L}, ${LD})` : "none",
                    backgroundOrigin: "padding-box, border-box",
                    backgroundClip: "padding-box, border-box",
                    cursor: "pointer", transition: "all 0.2s ease", letterSpacing: "-0.01em",
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", backgroundColor: isActive ? L_BG : "rgba(0,0,0,0.05)", color: isActive ? L : "rgba(0,0,0,0.35)" }}>
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
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen"
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
              <button onClick={() => setTypeDropOpen((o) => !o)}
                style={{ display: "flex", alignItems: "center", gap: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 6, background: "transparent", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: filterType ? L : "rgba(0,0,0,0.35)", fontWeight: filterType ? 600 : 400 }}
              >
                {filterType ? typeLabel(filterType as QuestionType) : "Typ"}
                <ChevronDown size={9} strokeWidth={2.5} style={{ transition: "transform 0.15s", transform: typeDropOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {typeDropOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 300, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)", padding: "6px 0", minWidth: 160 }}>
                  <button onClick={() => { setFilterType(null); setTypeDropOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: !filterType ? L : "rgba(0,0,0,0.55)", fontWeight: !filterType ? 600 : 400 }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Alle Typen
                    {!filterType && <Check size={10} strokeWidth={2.5} color={L} />}
                  </button>
                  <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", margin: "4px 0" }} />
                  {QUESTION_TYPES.map((qt) => {
                    const badge = typeBadgeColor(qt.key);
                    const isSelected = filterType === qt.key;
                    return (
                      <button key={qt.key} onClick={() => { setFilterType(qt.key); setTypeDropOpen(false); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: isSelected ? badge.text : "rgba(0,0,0,0.55)", fontWeight: isSelected ? 600 : 400 }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
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

        {/* Module tab */}
        {activeTab === "module" && (
          filteredModules.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FlexEmptyState tab="module" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredModules.map((m) => {
                const usedIn = fragebogenList.filter((fb) => fb.moduleIds.includes(m.id));
                return (
                  <FlexModuleCard key={m.id} module={m}
                    onEdit={() => onEdit(m)}
                    usedInFragebogen={{ count: usedIn.length, names: usedIn.map((fb) => fb.name) }}
                    onDuplicate={() => onDuplicate(m)}
                    onDelete={() => onDelete(m.id)}
                  />
                );
              })}
            </div>
          )
        )}

        {/* Fragen tab */}
        {activeTab === "fragen" && (
          filteredQuestions.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FlexEmptyState tab="fragen" />
            </div>
          ) : (
            <div style={{ backgroundColor: "#fff", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              {filteredQuestions.map(({ question, moduleName }, i) => (
                <FlexFragenListItem key={`${question.id}-${i}`} question={question} moduleName={moduleName}
                  onDelete={() => {
                    const owner = modules.find((m) => m.questions.some((qq) => qq.id === question.id));
                    if (owner) onUpdate({ ...owner, questions: owner.questions.filter((qq) => qq.id !== question.id) });
                  }}
                />
              ))}
            </div>
          )
        )}

        {/* Fragebogen tab */}
        {activeTab === "fragebogen" && (
          filteredFragebogen.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, minHeight: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FlexEmptyState tab="fragebogen" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                ...filteredFragebogen.filter((fb) => fb.status === "active"),
                ...[...filteredFragebogen.filter((fb) => fb.status === "scheduled")].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")),
                ...filteredFragebogen.filter((fb) => fb.status === "inactive"),
              ].map((fb) => (
                <FlexFragebogenCard key={fb.id} fragebogen={fb} moduleList={modules}
                  onEdit={() => onEditFb(fb)}
                  onDuplicate={() => onDuplicateFb(fb)}
                  onDuplicateToStd={() => duplicateFbToStd(fb)}
                  onDuplicateToBilla={() => duplicateFbToBilla(fb)}
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
