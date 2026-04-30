"use client";

import { useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  Layers,
  FileText,
  Plus,
  Pencil,
  Minus,
  ChevronDown,
  Zap,
  Clock,
  Search,
  X,
  Check,
  Trophy,
  Sparkles,
  Copy,
  Trash2,
  Tag,
} from "lucide-react";
import { useModules } from "@/context/ModuleContext";
import { useFragebogen } from "@/context/FragebogenContext";
import { useFlexModules, useBillaModules } from "@/app/admin/adminContexts";
import { typeLabel, typeBadgeColor, QUESTION_TYPES } from "@/utils/fragebogen";
import type { Question, Module, Fragebogen } from "@/types/fragebogen";
import { SpezialfrageEditor } from "@/components/admin/SpezialfrageEditor";
import { fetchCampaigns, fetchPhotoTags } from "@/lib/api/backend";

type Tab = "fragen" | "module" | "fragebogen";

const TABS: { key: Tab; label: string }[] = [
  { key: "fragen", label: "Fragen" },
  { key: "module", label: "Module" },
  { key: "fragebogen", label: "Fragebogen" },
];

// ── Question config summary (read-only) ─────────────────────

function PhotoTagPills({ tagIds }: { tagIds: string[] }) {
  const [labels, setLabels] = useState<{ id: string; label: string; deleted: boolean }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pool = await fetchPhotoTags();
        if (cancelled) return;
        setLabels(
          tagIds.map((id) => {
            const t = pool.find((p) => p.id === id);
            return t ? { id, label: t.label, deleted: Boolean(t.deletedAt) } : { id, label: id, deleted: false };
          }),
        );
      } catch {
        if (!cancelled) setLabels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tagIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (labels.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4, paddingLeft: 30 }}>
      {labels.map(t => (
        <span key={t.id} style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 8, fontWeight: 600,
          color: t.deleted ? "rgba(0,0,0,0.3)" : "#DC2626",
          background: t.deleted ? "rgba(0,0,0,0.04)" : "rgba(220,38,38,0.07)",
          padding: "2px 6px", borderRadius: 4,
          textDecoration: t.deleted ? "line-through" : "none",
        }}>
          <Tag size={7} strokeWidth={2.5} />
          {t.label}
        </span>
      ))}
    </div>
  );
}

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
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "3px 0",
                }}
              >
                <div style={{
                  width: question.type === "single" ? 10 : 8,
                  height: question.type === "single" ? 10 : 8,
                  borderRadius: question.type === "single" ? "50%" : 2,
                  border: "1.5px solid rgba(0,0,0,0.12)",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10,
                  color: "rgba(0,0,0,0.4)",
                  fontWeight: 400,
                  flex: 1,
                }}>
                  {o}
                </span>
                {sw?.ipp != null && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: "#DC2626",
                    background: "rgba(220,38,38,0.07)", borderRadius: 4,
                    padding: "1px 5px", letterSpacing: 0.2,
                  }}>
                    IPP {sw.ipp}
                  </span>
                )}
                {sw?.boni != null && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: "#b45309",
                    background: "rgba(217,119,6,0.08)", borderRadius: 4,
                    padding: "1px 5px", letterSpacing: 0.2,
                  }}>
                    Boni {sw.boni}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    case "likert": {
      const min = cfg.min as number;
      const max = cfg.max as number;
      const minL = cfg.minLabel as string;
      const maxL = cfg.maxLabel as string;
      return (
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>
          Skala {min}–{max}{minL || maxL ? ` (${minL || "…"} → ${maxL || "…"})` : ""}
        </div>
      );
    }
    case "matrix": {
      const rows = ((cfg.rows as string[]) || []).filter((r) => r);
      const cols = ((cfg.columns as string[]) || []).filter((c) => c);
      if (rows.length === 0 && cols.length === 0) return null;
      return (
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>
          {rows.length} Zeilen × {cols.length} Spalten
        </div>
      );
    }
    case "slider": {
      const unit = cfg.unit as string;
      return (
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 4, paddingLeft: 30 }}>
          {cfg.min as number}–{cfg.max as number}{unit ? ` ${unit}` : ""} (Schritt: {cfg.step as number})
        </div>
      );
    }
    case "numeric": {
      const min = cfg.min as string;
      const max = cfg.max as string;
      const scoring = question.scoring || {};
      const sw = scoring["__value__"];
      return (
        <div style={{ marginTop: 4, paddingLeft: 30 }}>
          {(min || max) && (
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginBottom: sw ? 4 : 0 }}>
              Bereich: {min || "–∞"} bis {max || "∞"}{cfg.decimals ? " (Dezimal)" : ""}
            </div>
          )}
          {(sw?.ipp != null || sw?.boni != null) && (
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {sw?.ipp != null && (
                <span style={{
                  fontSize: 8, fontWeight: 600, color: "#DC2626",
                  background: "rgba(220,38,38,0.07)", borderRadius: 4,
                  padding: "1px 5px", letterSpacing: 0.2,
                }}>
                  IPP ×{sw.ipp}
                </span>
              )}
              {sw?.boni != null && (
                <span style={{
                  fontSize: 8, fontWeight: 600, color: "#b45309",
                  background: "rgba(217,119,6,0.08)", borderRadius: 4,
                  padding: "1px 5px", letterSpacing: 0.2,
                }}>
                  Boni ×{sw.boni}
                </span>
              )}
            </div>
          )}
          {!min && !max && sw?.ipp == null && sw?.boni == null && null}
        </div>
      );
    }
    case "photo": {
      const instr = cfg.instruction as string;
      const tagsEnabled = Boolean(cfg.tagsEnabled);
      const tagIds = (cfg.tagIds as string[]) ?? [];
      const hasAny = instr || (tagsEnabled && tagIds.length > 0);
      if (!hasAny) return null;
      return (
        <div style={{ marginTop: 4 }}>
          {instr && (
            <div style={{
              fontSize: 9, color: "rgba(0,0,0,0.35)", fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              paddingLeft: 30, maxWidth: 320,
            }}>
              {instr}
            </div>
          )}
          {tagsEnabled && tagIds.length > 0 && <PhotoTagPills tagIds={tagIds} />}
          {tagsEnabled && tagIds.length === 0 && (
            <div style={{ paddingLeft: 30, marginTop: 3 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 8, fontWeight: 500,
                color: "rgba(0,0,0,0.28)", background: "rgba(0,0,0,0.04)",
                padding: "2px 6px", borderRadius: 4,
              }}>
                <Tag size={7} strokeWidth={2} />
                Tags aktiv – keine gewählt
              </span>
            </div>
          )}
        </div>
      );
    }
    case "yesnomulti": {
      const answers = ((cfg.answers as string[]) || ["Ja", "Nein"]).filter((a) => a.length > 0);
      const branches = (cfg.branches && typeof cfg.branches === "object"
        ? (cfg.branches as Record<string, { enabled?: boolean; options?: string[] }>)
        : {}) as Record<string, { enabled?: boolean; options?: string[] }>;
      const legacyTrigger = (cfg.triggerAnswer as string) || "";
      const legacyOptions = ((cfg.options as string[]) || []).filter((o) => o.length > 0);
      if (answers.length === 0) return null;
      return (
        <div style={{ marginTop: 5, paddingLeft: 30 }}>
          {answers.map((o, ai) => {
            const branch = branches[o];
            const hasBranch = branch?.enabled === true;
            const branchOptions = ((branch?.options as string[] | undefined) || []).filter((opt) => opt.length > 0);
            const isLegacyTrigger = !hasBranch && legacyTrigger.length > 0 && o === legacyTrigger;
            const visibleOptions = hasBranch ? branchOptions : isLegacyTrigger ? legacyOptions : [];
            const isTriggering = hasBranch || isLegacyTrigger;
            return (
              <div key={ai}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "1.5px solid rgba(0,0,0,0.12)",
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 400 }}>
                    {o}
                  </span>
                  {isTriggering && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: "#0d9488",
                      marginLeft: 2,
                    }}>
                      → Multi
                    </span>
                  )}
                </div>
                {isTriggering && visibleOptions.length > 0 && (
                  <div style={{ paddingLeft: 17, marginBottom: 2 }}>
                    {visibleOptions.map((opt, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                        <div style={{
                          width: 7,
                          height: 7,
                          borderRadius: 1.5,
                          border: "1.5px solid rgba(13,148,136,0.2)",
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>
                          {opt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    case "yesno":
      return (
        <div style={{ marginTop: 5, paddingLeft: 30 }}>
          {["Ja", "Nein"].map((o) => (
            <div
              key={o}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "3px 0",
              }}
            >
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: "1.5px solid rgba(0,0,0,0.12)",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10,
                color: "rgba(0,0,0,0.4)",
                fontWeight: 400,
              }}>
                {o}
              </span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// ── Module Card ─────────────────────────────────────────────

function ModuleContextMenu({
  x, y, onDuplicate, onDelete, onClose,
}: {
  x: number; y: number;
  onDuplicate: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleAction = async (action: () => Promise<void> | void) => {
    if (isActing) return;
    setIsActing(true);
    try {
      await action();
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        backgroundColor: "#fff",
        borderRadius: 9,
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
        padding: "4px",
        minWidth: 160,
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); void handleAction(onDuplicate); }}
        disabled={isActing}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "7px 10px", border: "none",
          borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer",
          opacity: isActing ? 0.7 : 1,
          fontSize: 11, fontWeight: 500, color: "#374151",
          textAlign: "left", transition: "background-color 0.1s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Copy size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
        {isActing ? "Dupliziere..." : "Duplizieren"}
      </button>

      <div style={{ height: 1, margin: "3px 6px", backgroundColor: "rgba(0,0,0,0.05)" }} />

      <button
        onClick={(e) => { e.stopPropagation(); void handleAction(onDelete); }}
        disabled={isActing}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "7px 10px", border: "none",
          borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer",
          opacity: isActing ? 0.7 : 1,
          fontSize: 11, fontWeight: 500, color: "#DC2626",
          textAlign: "left", transition: "background-color 0.1s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        {isActing ? "Lösche..." : "Löschen"}
      </button>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────

function ConfirmDialog({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isConfirming) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isConfirming, onCancel]);

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      onClick={() => { if (!isConfirming) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 10100,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.06)",
          padding: "28px 28px 22px",
          width: 360,
          maxWidth: "90vw",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: "rgba(220,38,38,0.07)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <Trash2 size={18} strokeWidth={1.8} color="#DC2626" />
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 8 }}>
          Bist du sicher?
        </div>

        {/* Body */}
        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.65, marginBottom: 24 }}>
          {label}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
              background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
              cursor: isConfirming ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600,
              color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease", opacity: isConfirming ? 0.7 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Abbrechen
          </button>
          <button
            onClick={() => { void handleConfirm(); }}
            disabled={isConfirming}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
              background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)",
              cursor: isConfirming ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600,
              color: "#fff", transition: "opacity 0.15s ease", opacity: isConfirming ? 0.85 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {isConfirming ? "Lösche..." : "Löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module Delete Dialog ──────────────────────────────────────

function ModuleDeleteDialog({
  module,
  usedInCount,
  usedInNames,
  onDeleteModule,
  onClose,
}: {
  module: Module;
  usedInCount: number;
  usedInNames: string[];
  onDeleteModule: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => Promise<void> | void } | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { if (pending) setPending(null); else onClose(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  return (
    <>
      {pending && (
        <ConfirmDialog
          label={pending.label}
          onConfirm={async () => { await pending.action(); setPending(null); onClose(); }}
          onCancel={() => setPending(null)}
        />
      )}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          backgroundColor: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(4px)",
          display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "20px 20px 16px",
            width: 360,
            maxWidth: "90vw",
          }}
        >
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              backgroundColor: "rgba(220,38,38,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                Modul löschen
              </div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{module.name || "Unbenanntes Modul"}</span>
                {" "}wird entfernt. Die Fragen bleiben erhalten.
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />

          {/* Usage notice */}
          {usedInCount > 0 ? (
            <div style={{
              padding: "8px 12px", borderRadius: 7, marginBottom: 14,
              backgroundColor: "rgba(220,38,38,0.05)",
              border: "1px solid rgba(220,38,38,0.12)",
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626" }}>
                Wird in {usedInNames.join(", ")} verwendet
              </span>
            </div>
          ) : (
            <div style={{
              padding: "8px 12px", borderRadius: 7, marginBottom: 14,
              backgroundColor: "rgba(5,150,105,0.05)",
              border: "1px solid rgba(5,150,105,0.12)",
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#047857" }}>
                Wird in keinem Fragebogen verwendet
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Abbrechen
            </button>
            <button
              onClick={() => setPending({
                label: `"${module.name || "Unbenanntes Modul"}" wird gelöscht. Fragen bleiben erhalten.`,
                action: onDeleteModule,
              })}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                cursor: "pointer", fontSize: 11, fontWeight: 700,
                color: "#fff", transition: "opacity 0.15s ease",
              }}
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

function ModuleCard({ module, onEdit, onDuplicate, onDelete, usedInFragebogen }: {
  module: Module;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  usedInFragebogen: { count: number; names: string[] };
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const typeFingerprint = Array.from(
    new Set(module.questions.map((q) => q.type))
  );

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        backgroundColor: "#fff",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease",
        position: "relative",
      }}
    >
      {ctxMenu && (
        <ModuleContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onDuplicate={onDuplicate}
          onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {deleteDialog && (
        <ModuleDeleteDialog
          module={module}
          usedInCount={usedInFragebogen.count}
          usedInNames={usedInFragebogen.names}
          onDeleteModule={onDelete}
          onClose={() => setDeleteDialog(false)}
        />
      )}
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: name + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}>
              {module.name}
            </span>
          </div>
          {module.description && (
            <div style={{
              fontSize: 10,
              color: "rgba(0,0,0,0.35)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {module.description}
            </div>
          )}
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 5,
            backgroundColor: "rgba(0,0,0,0.04)",
            color: "rgba(0,0,0,0.45)",
          }}>
            {module.questions.length} {module.questions.length === 1 ? "Frage" : "Fragen"}
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 5,
            backgroundColor: module.usedInCount > 0 ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.03)",
            color: module.usedInCount > 0 ? "#DC2626" : "rgba(0,0,0,0.3)",
          }}>
            {module.usedInCount > 0
              ? `In ${module.usedInCount} Fragebogen`
              : "Nicht verwendet"}
          </span>
        </div>

        {/* Edit + Expand */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: "rgba(0,0,0,0.03)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 0.12s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
        >
          <Pencil size={12} strokeWidth={1.8} color="rgba(0,0,0,0.35)" />
        </button>

        <ChevronDown
          size={14}
          strokeWidth={1.8}
          color="rgba(0,0,0,0.25)"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>

      {/* Type fingerprint strip */}
      {typeFingerprint.length > 0 && !expanded && (
        <div style={{
          display: "flex",
          gap: 4,
          padding: "0 18px 12px",
        }}>
          {typeFingerprint.map((t) => {
            const badge = typeBadgeColor(t);
            return (
              <span
                key={t}
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 3,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  letterSpacing: "0.02em",
                }}
              >
                {typeLabel(t)}
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded detail view */}
      <div style={{
        maxHeight: expanded ? 2000 : 0,
        opacity: expanded ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
      }}>
        <div style={{
          borderTop: "1px solid rgba(0,0,0,0.04)",
          padding: "12px 18px 16px",
        }}>
          {module.questions.length === 0 ? (
            <div style={{
              fontSize: 10,
              color: "rgba(0,0,0,0.25)",
              fontStyle: "italic",
              padding: "8px 0",
            }}>
              Keine Fragen in diesem Modul.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {module.questions.map((q, qi) => {
                const badge = typeBadgeColor(q.type);
                return (
                  <div key={q.id}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                    }}>
                      {/* Number */}
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "linear-gradient(to bottom, #DC2626, #e84040)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>{qi + 1}</span>
                      </div>

                      {/* Type badge */}
                      <span style={{
                        fontSize: 8,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 4,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                      }}>
                        {typeLabel(q.type)}
                      </span>

                      {/* Question text */}
                      <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: q.text ? "#374151" : "rgba(0,0,0,0.25)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {q.text || "Unbenannt"}
                      </span>

                      {/* Indicators */}
                      {q.rules.length > 0 && (
                        <Zap size={10} strokeWidth={2} color="#DC2626" style={{ flexShrink: 0 }} />
                      )}
                      {Object.keys(q.scoring || {}).some(k => {
                        const sw = (q.scoring || {})[k];
                        return sw?.ipp != null || sw?.boni != null;
                      }) && (
                        <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
                      )}
                      {q.required && (
                        <span style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: "rgba(0,0,0,0.25)",
                          flexShrink: 0,
                        }}>
                          Pflicht
                        </span>
                      )}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: 600,
                color: "#ffffff",
                background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow:
                  "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)",
              }}
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

// ── Fragen List Item ────────────────────────────────────────

function FragenListItem({
  question,
  moduleName,
  onDelete,
}: {
  question: Question;
  moduleName: string;
  onDelete?: () => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const ctxRef = useRef<HTMLDivElement>(null);
  const badge = typeBadgeColor(question.type);

  useEffect(() => {
    if (!ctxMenu) return;
    function handle(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    }
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
        <div
          ref={ctxRef}
          style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            backgroundColor: "#fff", borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
            padding: 4, minWidth: 140,
          }}
        >
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (deleting) return;
              setDeleting(true);
              try {
                await onDelete();
                setCtxMenu(null);
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 10px", border: "none",
              borderRadius: 6, background: "none", cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.7 : 1,
              fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
            {deleting ? "Lösche..." : "Löschen"}
          </button>
        </div>
      )}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          cursor: "pointer",
          userSelect: "none",
          transition: "background-color 0.12s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.01)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        {/* Type badge */}
        <span style={{
          fontSize: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          padding: "2px 7px",
          borderRadius: 4,
          backgroundColor: badge.bg,
          color: badge.text,
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}>
          {typeLabel(question.type)}
        </span>

        {/* Question text */}
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: question.text ? "#374151" : "rgba(0,0,0,0.25)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {question.text || "Unbenannt"}
        </span>

        {/* Indicators */}
        {question.rules.length > 0 && (
          <Zap size={10} strokeWidth={2} color="#DC2626" style={{ flexShrink: 0 }} />
        )}
        {Object.keys(question.scoring || {}).some(k => {
          const sw = (question.scoring || {})[k];
          return sw?.ipp != null || sw?.boni != null;
        }) && (
          <Trophy size={10} strokeWidth={2} color="#b45309" style={{ flexShrink: 0 }} />
        )}
        {question.type === "photo" && Boolean(question.config?.tagsEnabled) && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 8, fontWeight: 600,
            color: "#DC2626", background: "rgba(220,38,38,0.07)",
            padding: "2px 6px", borderRadius: 4, flexShrink: 0, letterSpacing: "0.02em",
          }}>
            <Tag size={8} strokeWidth={2.5} />
            {((question.config?.tagIds as string[]) ?? []).length || ""}
            {" "}Tags
          </span>
        )}
        {question.required && (
          <span style={{
            fontSize: 8,
            fontWeight: 600,
            color: "rgba(0,0,0,0.25)",
            flexShrink: 0,
          }}>
            Pflicht
          </span>
        )}

        {/* Module origin / Spezialfrage indicator */}
        {moduleName.startsWith("__spezialfrage__") ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
              backgroundColor: "rgba(5,150,105,0.08)", color: "#059669",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              Spezialfrage
            </span>
            <span style={{
              fontSize: 9, fontWeight: 400, padding: "2px 7px", borderRadius: 4,
              backgroundColor: "rgba(0,0,0,0.03)", color: "rgba(0,0,0,0.35)",
              maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {moduleName.replace("__spezialfrage__", "")}
            </span>
          </div>
        ) : moduleName === "Unzugewiesen" ? (
          <span style={{
            fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
            backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)",
            flexShrink: 0,
          }}>
            Nicht zugewiesen
          </span>
        ) : (
          <span style={{
            fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
            backgroundColor: "rgba(220,38,38,0.04)", color: "rgba(220,38,38,0.6)",
            flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {moduleName}
          </span>
        )}

        {/* Expand chevron */}
        <ChevronDown
          size={12}
          strokeWidth={1.8}
          color="rgba(0,0,0,0.2)"
          style={{
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </div>

      {/* Expanded detail */}
      <div style={{
        maxHeight: expanded ? 300 : 0,
        overflow: "hidden",
        transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ padding: "0 18px 12px" }}>
          <QuestionConfigSummary question={question} />
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Card ──────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── SpezialfrageAbwaehlenModal ───────────────────────────────

function SpezialfrageAbwaehlenModal({
  fragebogen,
  onClose,
  onSave,
}: {
  fragebogen: Fragebogen;
  onClose: () => void;
  onSave: (kept: Question[]) => Promise<void> | void;
}) {
  const questions = fragebogen.spezialfragen ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(questions.map((q) => q.id))
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (isSaving) return;
    const kept = questions.filter((q) => selectedIds.has(q.id));
    setIsSaving(true);
    try {
      await onSave(kept);
    } finally {
      setIsSaving(false);
    }
  }

  const total = questions.length;
  const removedCount = total - selectedIds.size;

  function answerHint(q: Question): string {
    const cfg = q.config as Record<string, unknown>;
    if (q.type === "single" || q.type === "multiple") {
      const opts = (cfg.options as string[] | undefined) ?? [];
      return `${opts.filter(Boolean).length} Antworten`;
    }
    if (q.type === "yesnomulti") {
      const answers = (cfg.answers as string[] | undefined) ?? [];
      return `${answers.filter(Boolean).length} Antworten`;
    }
    if (q.type === "yesno") return "Ja / Nein";
    if (q.type === "likert") return `Skala ${cfg.min ?? 1}–${cfg.max ?? 5}`;
    if (q.type === "slider") return `Slider ${cfg.min ?? 0}–${cfg.max ?? 100}`;
    if (q.type === "numeric") return "Zahleneingabe";
    if (q.type === "text") return "Freitext";
    if (q.type === "photo") return "Fotoaufnahme";
    if (q.type === "matrix") {
      const rows = (cfg.rows as string[] | undefined) ?? [];
      return `${rows.filter(Boolean).length} Zeilen`;
    }
    return "";
  }

  function hasSco(q: Question) {
    if (!q.scoring) return false;
    return Object.values(q.scoring).some(
      (w) => (w as { ipp?: number; boni?: number }).ipp !== undefined || (w as { ipp?: number; boni?: number }).boni !== undefined
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        zIndex: 120,
        backgroundColor: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 460, maxHeight: "70vh",
          backgroundColor: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          animation: "moduleEditorIn 0.3s cubic-bezier(0.4,0,0.2,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          height: 52, flexShrink: 0,
          padding: "0 20px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: "linear-gradient(to bottom, #059669, #047857)",
            boxShadow: "0 1px 4px rgba(5,150,105,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={12} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
            Spezialfragen abwählen
          </span>
          <div style={{ width: 1, height: 14, backgroundColor: "rgba(0,0,0,0.07)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>
            {fragebogen.name}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto", width: 22, height: 22, borderRadius: 7,
              backgroundColor: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(0,0,0,0.4)", transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)")}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Summary strip */}
          <div style={{ padding: "14px 20px 0" }}>
            <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
              {selectedIds.size} von {total} ausgewählt
            </span>
            <div style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)",
              margin: "12px 0 0",
            }} />
          </div>

          {/* Question list */}
          <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
            {questions.length === 0 ? (
              <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  backgroundColor: "rgba(5,150,105,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={16} color="rgba(5,150,105,0.4)" />
                </div>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Keine Spezialfragen vorhanden</span>
              </div>
            ) : questions.map((q) => {
              const selected = selectedIds.has(q.id);
              const badge = typeBadgeColor(q.type);
              const hint = answerHint(q);
              const scoring = hasSco(q);
              return (
                <div
                  key={q.id}
                  onClick={() => toggle(q.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: selected
                      ? "1px solid rgba(220,38,38,0.18)"
                      : "1px solid rgba(0,0,0,0.06)",
                    backgroundColor: selected ? "rgba(220,38,38,0.02)" : "#ffffff",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) {
                      e.currentTarget.style.borderColor = "rgba(0,0,0,0.10)";
                      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = selected ? "rgba(220,38,38,0.18)" : "rgba(0,0,0,0.06)";
                    e.currentTarget.style.backgroundColor = selected ? "rgba(220,38,38,0.02)" : "#ffffff";
                  }}
                >
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                        letterSpacing: "0.04em", textTransform: "uppercase" as const,
                        backgroundColor: badge.bg, color: badge.text,
                      }}>
                        {typeLabel(q.type)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 500,
                      color: q.text ? "#1a1a1a" : "rgba(0,0,0,0.25)",
                      fontStyle: q.text ? "normal" : "italic",
                      whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
                      letterSpacing: "-0.01em",
                    }}>
                      {q.text || "Kein Fragetext"}
                    </div>
                    {hint && (
                      <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 400, marginTop: 2 }}>
                        {hint}
                      </div>
                    )}
                  </div>

                  {/* Right side pills + checkbox */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {scoring && Object.values(q.scoring ?? {}).some((w) => (w as { ipp?: number }).ipp !== undefined) && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: "#DC2626",
                        background: "rgba(220,38,38,0.07)", borderRadius: 4,
                        padding: "2px 6px", letterSpacing: "0.03em",
                      }}>IPP</span>
                    )}
                    {scoring && Object.values(q.scoring ?? {}).some((w) => (w as { boni?: number }).boni !== undefined) && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: "#b45309",
                        background: "rgba(217,119,6,0.08)", borderRadius: 4,
                        padding: "2px 6px", letterSpacing: "0.03em",
                      }}>Boni</span>
                    )}
                    {/* Checkbox */}
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      backgroundColor: selected ? "#DC2626" : "transparent",
                      border: selected ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}>
                      {selected && <Check size={9} strokeWidth={3} color="#fff" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          height: 52, flexShrink: 0,
          padding: "0 20px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, color: removedCount > 0 ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.25)", fontWeight: 400 }}>
            {removedCount > 0
              ? `${removedCount} ${removedCount === 1 ? "Frage wird" : "Fragen werden"} entfernt`
              : "Alle Fragen ausgewählt"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: "6px 14px", fontSize: 10, fontWeight: 600,
                color: "rgba(0,0,0,0.4)",
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                borderRadius: 7, border: "none", cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.7 : 1,
                transition: "opacity 0.15s ease",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Abbrechen
            </button>
            <button
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              style={{
                padding: "6px 14px", fontSize: 10, fontWeight: 600,
                color: "#fff", border: "none", borderRadius: 7, cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.85 : 1,
                background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Context Menu ───────────────────────────────────

function FragebogenContextMenu({
  x, y, onDuplicate, onDuplicateToFlex, onDuplicateToBilla, onDelete, onClose,
}: {
  x: number; y: number;
  onDuplicate: () => Promise<void> | void;
  onDuplicateToFlex: () => Promise<void> | void;
  onDuplicateToBilla: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleAction = async (action: () => Promise<void> | void) => {
    if (isActing) return;
    setIsActing(true);
    try {
      await action();
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 9999, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: "4px", minWidth: 190 }}>
      {/* Duplizieren with submenu */}
      <div style={{ position: "relative" }}>
        <button
          onMouseEnter={() => { if (!isActing) setDupOpen(true); }}
          onMouseLeave={() => { if (!isActing) setDupOpen(false); }}
          disabled={isActing}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left", transition: "background-color 0.1s ease", backgroundColor: dupOpen ? "rgba(0,0,0,0.03)" : "transparent", opacity: isActing ? 0.7 : 1 }}
        >
          <Copy size={12} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          <span style={{ flex: 1 }}>{isActing ? "Dupliziere..." : "Duplizieren"}</span>
          <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ transform: "rotate(-90deg)" }} />
        </button>

        {/* Submenu */}
        {dupOpen && (
          <div
            onMouseEnter={() => setDupOpen(true)}
            onMouseLeave={() => setDupOpen(false)}
            style={{ position: "absolute", left: "100%", top: 0, marginLeft: 4, backgroundColor: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)", padding: "4px", minWidth: 200, zIndex: 10000 }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); void handleAction(onDuplicate); }}
              disabled={isActing}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left", transition: "background-color 0.1s ease", opacity: isActing ? 0.7 : 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#DC2626", flexShrink: 0 }} />
              Hier (Standardbesuch)
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void handleAction(onDuplicateToFlex); }}
              disabled={isActing}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left", transition: "background-color 0.1s ease", opacity: isActing ? 0.7 : 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(132,204,22,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#84CC16", flexShrink: 0 }} />
              Zu Flexbesuche kopieren
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void handleAction(onDuplicateToBilla); }}
              disabled={isActing}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, color: "#374151", textAlign: "left", transition: "background-color 0.1s ease", opacity: isActing ? 0.7 : 1 }}
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
      <button
        onClick={(e) => { e.stopPropagation(); void handleAction(onDelete); }}
        disabled={isActing}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: "none", cursor: isActing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", textAlign: "left", transition: "background-color 0.1s ease", opacity: isActing ? 0.7 : 1 }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
        {isActing ? "Lösche..." : "Löschen"}
      </button>
    </div>
  );
}

// ── Fragebogen Delete Dialog ──────────────────────────────────

function FragebogenDeleteDialog({
  fragebogen,
  onDeleteOnly,
  onClose,
}: {
  fragebogen: Fragebogen;
  onDeleteOnly: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<{ label: string; action: () => Promise<void> | void } | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { if (pending) setPending(null); else onClose(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, pending]);

  return (
    <>
      {pending && (
        <ConfirmDialog
          label={pending.label}
          onConfirm={async () => { await pending.action(); setPending(null); onClose(); }}
          onCancel={() => setPending(null)}
        />
      )}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          backgroundColor: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(4px)",
          display: pending ? "none" : "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "20px 20px 16px",
            width: 360,
            maxWidth: "90vw",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              backgroundColor: "rgba(220,38,38,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={13} strokeWidth={1.8} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                Fragebogen löschen
              </div>
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
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                color: "rgba(0,0,0,0.4)", transition: "opacity 0.15s ease",
              }}
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
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                cursor: "pointer", fontSize: 11, fontWeight: 700,
                color: "#fff", transition: "opacity 0.15s ease",
              }}
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
// ── FragebogenCard ────────────────────────────────────────────

function FragebogenCard({
  fragebogen,
  campaignNames,
  availableModules,
  onEdit,
  onUpdate,
  onDuplicate,
  onDuplicateToFlex,
  onDuplicateToBilla,
  onDelete,
}: {
  fragebogen: Fragebogen;
  campaignNames: string[];
  availableModules: Module[];
  onEdit: () => void;
  onUpdate: (f: Fragebogen) => void;
  onDuplicate: () => void;
  onDuplicateToFlex: () => void;
  onDuplicateToBilla: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [spezialEditorOpen, setSpezialEditorOpen] = useState(false);
  const [abwaehlenOpen, setAbwaehlenOpen] = useState(false);
  const [spezialExpanded, setSpezialExpanded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const modules = fragebogen.moduleIds
    .map((id) => availableModules.find((m) => m.id === id))
    .filter((m): m is Module => !!m);

  return (
    <>
    {ctxMenu && (
      <FragebogenContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        onDuplicate={onDuplicate}
        onDuplicateToFlex={onDuplicateToFlex}
        onDuplicateToBilla={onDuplicateToBilla}
        onDelete={() => { setDeleteDialog(true); setCtxMenu(null); }}
        onClose={() => setCtxMenu(null)}
      />
    )}
    {deleteDialog && (
      <FragebogenDeleteDialog
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
        marginBottom: 8,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", flex: 1, letterSpacing: "-0.01em" }}>
            {fragebogen.name}
          </span>

          {/* Spezialfrage count pill */}
          {fragebogen.spezialfragen && fragebogen.spezialfragen.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              padding: "3px 9px", borderRadius: 20,
              backgroundColor: "rgba(5,150,105,0.07)",
              color: "#059669",
              letterSpacing: "0.02em",
            }}>
              {fragebogen.spezialfragen.length} {fragebogen.spezialfragen.length === 1 ? "Spezialfrage" : "Spezialfragen"}
            </span>
          )}

          {/* Edit button */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, color: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center",
              transition: "color 0.15s ease", borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}
          >
            <Pencil size={13} strokeWidth={1.8} />
          </button>

          {/* Expand chevron */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, color: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center",
              transition: "all 0.2s ease",
            }}
          >
            <ChevronDown
              size={14} strokeWidth={1.8}
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
            />
          </button>
        </div>

        {/* Module pills row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {modules.length === 0 ? (
            <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}>Keine Module</span>
          ) : modules.map((m) => (
            <span key={m.id} style={{
              fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
              backgroundColor: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.4)",
            }}>
              {m.name || "Unbenannt"}
            </span>
          ))}
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>
              Verwendet in Kampagne:
            </span>
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 500 }}>
              {campaignNames.length > 0 ? campaignNames.join(", ") : "Keine"}
            </span>
          </div>

          {/* Spezialfrage button */}
          <div style={{ marginLeft: "auto" }}>
            {fragebogen.spezialfragen && fragebogen.spezialfragen.length > 0 ? (
              !spezialExpanded ? (
                /* Single collapsed button */
                <button
                  onClick={(e) => { e.stopPropagation(); setSpezialExpanded(true); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", fontSize: 9, fontWeight: 600,
                    color: "#fff", border: "none", borderRadius: 7, cursor: "pointer",
                    letterSpacing: "0.01em", whiteSpace: "nowrap",
                    background: "linear-gradient(to bottom, #059669, #047857)",
                    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #036647, 0 1px 6px rgba(5,150,105,0.28)",
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <Sparkles size={8} strokeWidth={2.5} />
                  Spezialfragen bearbeiten
                </button>
              ) : (
                /* Expanded: two action buttons */
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAbwaehlenOpen(true); setSpezialExpanded(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", fontSize: 9, fontWeight: 600,
                      color: "#fff", border: "none", borderRadius: 7, cursor: "pointer",
                      letterSpacing: "0.01em", whiteSpace: "nowrap",
                      background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)",
                      boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)",
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <Minus size={8} strokeWidth={2.5} />
                    Frage abwählen
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSpezialEditorOpen(true); setSpezialExpanded(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", fontSize: 9, fontWeight: 600,
                      color: "#fff", border: "none", borderRadius: 7, cursor: "pointer",
                      letterSpacing: "0.01em", whiteSpace: "nowrap",
                      background: "linear-gradient(to bottom, #059669, #047857)",
                      boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #036647, 0 1px 6px rgba(5,150,105,0.28)",
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <Pencil size={8} strokeWidth={2.5} />
                    Frage bearbeiten
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setSpezialEditorOpen(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", fontSize: 10, fontWeight: 600,
                  color: "#fff", border: "none", borderRadius: 7, cursor: "pointer",
                  letterSpacing: "0.01em",
                  background: "linear-gradient(to bottom, #059669, #047857)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #036647, 0 1px 6px rgba(5,150,105,0.28)",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <Plus size={10} strokeWidth={2.5} />
                Spezialfrage hinzufügen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <div style={{
        maxHeight: expanded ? 400 : 0,
        overflow: "hidden",
        transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{
          borderTop: "1px solid rgba(0,0,0,0.04)",
          padding: "14px 20px 16px",
          backgroundColor: "rgba(0,0,0,0.01)",
        }}>
          {/* Modules detail */}
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", display: "block", marginBottom: 8 }}>
              Module ({modules.length})
            </span>
            {modules.length === 0 ? (
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}>Keine Module zugewiesen</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {modules.map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.2)", width: 16, textAlign: "right" }}>{i + 1}.</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#374151", flex: 1 }}>{m.name || "Unbenannt"}</span>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{m.questions.length} Fragen</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Created date */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={10} strokeWidth={1.8} color="rgba(0,0,0,0.2)" />
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.25)" }}>
              Erstellt {formatDate(fragebogen.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>

      {/* Spezialfrage Editor */}
      {spezialEditorOpen && (
        <SpezialfrageEditor
          onClose={() => setSpezialEditorOpen(false)}
          onSave={(questions) => {
            onUpdate({ ...fragebogen, spezialfragen: questions });
            setSpezialEditorOpen(false);
          }}
          existingQuestions={fragebogen.spezialfragen}
          fragebogenName={fragebogen.name}
        />
      )}
      {abwaehlenOpen && (
        <SpezialfrageAbwaehlenModal
          fragebogen={fragebogen}
          onClose={() => setAbwaehlenOpen(false)}
          onSave={(kept) => {
            onUpdate({ ...fragebogen, spezialfragen: kept });
            setAbwaehlenOpen(false);
          }}
        />
      )}
    </>
  );
}

// ── Empty State ─────────────────────────────────────────────

const EMPTY_STATES: Record<Tab, { icon: typeof HelpCircle; message: string; button: string }> = {
  fragen: {
    icon: HelpCircle,
    message: "Keine Fragen vorhanden",
    button: "Modul erstellen",
  },
  module: {
    icon: Layers,
    message: "Keine Module vorhanden",
    button: "Modul erstellen",
  },
  fragebogen: {
    icon: FileText,
    message: "Keine Fragebogen vorhanden",
    button: "Fragebogen erstellen",
  },
};

function EmptyState({ tab }: { tab: Tab }) {
  const empty = EMPTY_STATES[tab];
  const EmptyIcon = empty.icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "60px 20px",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyIcon size={22} strokeWidth={1.4} color="rgba(0,0,0,0.18)" />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(0,0,0,0.3)",
          letterSpacing: "-0.01em",
        }}
      >
        {empty.message}
      </span>
      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.2)", maxWidth: 260, textAlign: "center", lineHeight: 1.5 }}>
        {tab === "fragen"
          ? "Fragen werden automatisch angezeigt, sobald ein Modul mit Fragen erstellt wird."
          : tab === "module"
          ? "Erstelle ein Modul um Fragen thematisch zu gruppieren."
          : "Erstelle einen Fragebogen um Module zusammenzufassen und zu verteilen."}
      </span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function FragebogenPage() {
  const [activeTab, setActiveTab] = useState<Tab>("module");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef = useRef<HTMLDivElement>(null);
  const { modules, editModule, addModule, updateModule, deleteModule, deleteModuleKeepQuestions } = useModules();
  const { fragebogenList, editFragebogen, updateFragebogen, addFragebogen, deleteFragebogen } = useFragebogen();
  const { modules: flexModules, duplicateFbToFlex } = useFlexModules();
  const { duplicateFbToBilla, modules: billaModules } = useBillaModules();
  const [campaignUsageByFragebogenId, setCampaignUsageByFragebogenId] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const campaigns = await fetchCampaigns();
        if (cancelled) return;

        const usage: Record<string, string[]> = {};
        for (const campaign of campaigns) {
          if (campaign.section !== "standard" || !campaign.currentFragebogenId) continue;
          if (!usage[campaign.currentFragebogenId]) usage[campaign.currentFragebogenId] = [];
          usage[campaign.currentFragebogenId].push(campaign.name);
        }

        for (const fbId of Object.keys(usage)) {
          usage[fbId] = Array.from(new Set(usage[fbId]));
        }

        setCampaignUsageByFragebogenId(usage);
      } catch {
        if (!cancelled) setCampaignUsageByFragebogenId({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!typeDropOpen) return;
    function handle(e: MouseEvent) {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node)) setTypeDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [typeDropOpen]);

  // Merge all modules from all contexts, sort oldest-first globally, then dedup by question ID
  const allQuestions: { question: Question; moduleName: string }[] = [];
  [...modules, ...flexModules, ...billaModules]
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .forEach((m) => {
      m.questions.forEach((q) => {
        if (!allQuestions.some(({ question }) => question.id === q.id)) {
          allQuestions.push({ question: q, moduleName: m.name });
        }
      });
    });
  // Include spezialfragen from all Fragebogen (not tied to modules)
  fragebogenList.forEach((fb) => {
    (fb.spezialfragen ?? []).forEach((q) => {
      allQuestions.push({ question: q, moduleName: `__spezialfrage__${fb.name || "Unbenannt"}` });
    });
  });

  const q = search.trim().toLowerCase();
  const filteredQuestions = allQuestions.filter(({ question, moduleName }) => {
    if (filterType && question.type !== filterType) return false;
    if (!q) return true;
    return (
      question.text.toLowerCase().includes(q) ||
      moduleName.toLowerCase().includes(q) ||
      typeLabel(question.type).toLowerCase().includes(q)
    );
  });
  const filteredModules = (q
    ? modules.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.questions.some((qst) => qst.text.toLowerCase().includes(q))
      )
    : modules).filter((m) => m.id !== "__unassigned__");
  const filteredFragebogen = q
    ? fragebogenList.filter(
        (fb) =>
          fb.name.toLowerCase().includes(q) ||
          fb.description.toLowerCase().includes(q)
      )
    : fragebogenList;

  return (
    <div>
      {/* Tab bar */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
          <div style={{ display: "flex", gap: 24, flex: 1 }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === "module"
                ? modules.filter((m) => m.id !== "__unassigned__").length
                : tab.key === "fragen"
                ? allQuestions.length
                : fragebogenList.length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 0",
                  fontSize: 12,
                  fontWeight: isActive ? 650 : 500,
                  color: isActive ? "#DC2626" : "rgba(0,0,0,0.4)",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid transparent" : "2px solid transparent",
                  backgroundImage: isActive
                    ? "linear-gradient(#f5f5f7, #f5f5f7), linear-gradient(to right, #DC2626, #e84040)"
                    : "none",
                  backgroundOrigin: "padding-box, border-box",
                  backgroundClip: "padding-box, border-box",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  letterSpacing: "-0.01em",
                  position: "relative",
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    backgroundColor: isActive ? "rgba(220,38,38,0.08)" : "rgba(0,0,0,0.05)",
                    color: isActive ? "#DC2626" : "rgba(0,0,0,0.35)",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          </div>

          {/* Searchbar — sits on the divider line */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 0, marginBottom: -4 }}>
            {/* Short vertical divider */}
            <div style={{ width: 1, height: 14, backgroundColor: "rgba(0,0,0,0.06)", flexShrink: 0 }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={11}
                strokeWidth={2}
                color="rgba(0,0,0,0.22)"
                style={{ position: "absolute", left: 0, pointerEvents: "none" }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen"
                style={{
                  paddingLeft: 18, paddingRight: search ? 20 : 0,
                  paddingTop: 4, paddingBottom: 4,
                  background: "transparent", border: "none",
                  fontSize: 11, fontFamily: "inherit", color: "#111",
                  outline: "none", width: 140,
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 0, background: "none", border: "none",
                    cursor: "pointer", padding: 0, display: "flex", alignItems: "center",
                    color: "rgba(0,0,0,0.25)",
                  }}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {/* Type filter — Fragen tab only */}
          {activeTab === "fragen" && (
            <div ref={typeDropRef} style={{ position: "relative", marginBottom: -4 }}>
              <button
                onClick={() => setTypeDropOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 6,
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: 11, fontFamily: "inherit", color: filterType ? "#DC2626" : "rgba(0,0,0,0.35)",
                  fontWeight: filterType ? 600 : 400,
                }}
              >
                {filterType ? typeLabel(filterType as import("@/types/fragebogen").QuestionType) : "Typ"}
                <ChevronDown size={9} strokeWidth={2.5} style={{ transition: "transform 0.15s", transform: typeDropOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {typeDropOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 300,
                  background: "#fff", borderRadius: 10,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)",
                  padding: "6px 0", minWidth: 160,
                }}>
                  <button
                    onClick={() => { setFilterType(null); setTypeDropOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "6px 14px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                      color: !filterType ? "#DC2626" : "rgba(0,0,0,0.55)", fontWeight: !filterType ? 600 : 400,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Alle Typen
                    {!filterType && <Check size={10} strokeWidth={2.5} color="#DC2626" />}
                  </button>
                  <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", margin: "4px 0" }} />
                  {QUESTION_TYPES.map((qt) => {
                    const badge = typeBadgeColor(qt.key);
                    const isSelected = filterType === qt.key;
                    return (
                      <button
                        key={qt.key}
                        onClick={() => { setFilterType(qt.key); setTypeDropOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "6px 14px", background: "none", border: "none",
                          cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                          color: isSelected ? badge.text : "rgba(0,0,0,0.55)",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text }}>
                            {qt.label}
                          </span>
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
        <div
          style={{
            height: 1,
            backgroundColor: "rgba(0,0,0,0.06)",
            marginTop: -1,
          }}
        />
      </div>

      {/* Tab content */}
      <div style={{ marginTop: 16 }}>
        {/* ── Module tab ── */}
        {activeTab === "module" && (
          filteredModules.length === 0 ? (
            <div style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              padding: 20,
              minHeight: 340,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <EmptyState tab="module" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredModules.map((m) => {
                const usedIn = fragebogenList.filter((fb) => fb.moduleIds.includes(m.id));
                return (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    onEdit={() => editModule(m)}
                    usedInFragebogen={{ count: usedIn.length, names: usedIn.map((fb) => fb.name) }}
                    onDuplicate={() => {
                      addModule({
                        ...m,
                        id: `mod-dup-${Date.now()}`,
                        name: `Kopie von ${m.name}`,
                        createdAt: new Date().toISOString(),
                        questions: m.questions,
                      });
                    }}
                    onDelete={() => deleteModuleKeepQuestions(m.id)}
                  />
                );
              })}
            </div>
          )
        )}

        {/* ── Fragen tab ── */}
        {activeTab === "fragen" && (
          filteredQuestions.length === 0 ? (
            <div style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              padding: 20,
              minHeight: 340,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <EmptyState tab="fragen" />
            </div>
          ) : (
            <div style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              {filteredQuestions.map(({ question, moduleName }, i) => (
                <FragenListItem
                  key={`${question.id}-${i}`}
                  question={question}
                  moduleName={moduleName}
                  onDelete={() => {
                    const ownerModule = modules.find((m) => m.questions.some((q) => q.id === question.id));
                    if (ownerModule) {
                      updateModule({ ...ownerModule, questions: ownerModule.questions.filter((q) => q.id !== question.id) });
                    }
                  }}
                />
              ))}
            </div>
          )
        )}

        {/* ── Fragebogen tab ── */}
        {activeTab === "fragebogen" && (
          filteredFragebogen.length === 0 ? (
            <div style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              padding: 20,
              minHeight: 340,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <EmptyState tab="fragebogen" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {filteredFragebogen.map((fb) => (
                <FragebogenCard
                  key={fb.id}
                  fragebogen={fb}
                  campaignNames={campaignUsageByFragebogenId[fb.id] ?? []}
                  availableModules={modules}
                  onEdit={() => editFragebogen(fb)}
                  onUpdate={updateFragebogen}
                  onDuplicate={() => {
                    addFragebogen({
                      ...fb,
                      id: `fb-dup-${Date.now()}`,
                      name: `Kopie von ${fb.name}`,
                      createdAt: new Date().toISOString(),
                      status: "inactive",
                    });
                  }}
                  onDuplicateToFlex={() => duplicateFbToFlex(fb)}
                  onDuplicateToBilla={() => duplicateFbToBilla(fb)}
                  onDelete={() => deleteFragebogen(fb.id)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
