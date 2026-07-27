"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { Check, Minus, Pencil, Plus, Sparkles, X } from "lucide-react";
import type { Fragebogen, Question } from "@/types/fragebogen";
import { SpezialfrageEditor } from "@/components/admin/SpezialfrageEditor";
import { typeBadgeColor, typeLabel } from "@/utils/fragebogen";
import type { FragebogenScope } from "@/lib/api/backend";

type SpezialfragenFragebogenActionProps = {
  fragebogen: Fragebogen;
  onSave: (questions: Question[]) => Promise<void> | void;
  scope?: FragebogenScope;
};

type SpezialfragenCountPillProps = {
  fragebogen: Fragebogen;
};

const GREEN = "#059669";
const GREEN_DARK = "#047857";
const GREEN_BORDER = "#036647";

const greenButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  fontSize: 9,
  fontWeight: 600,
  color: "#fff",
  border: "none",
  borderRadius: 7,
  cursor: "pointer",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap" as const,
  background: `linear-gradient(to bottom, ${GREEN}, ${GREEN_DARK})`,
  boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${GREEN_BORDER}, 0 1px 6px rgba(5,150,105,0.28)`,
  transition: "opacity 0.15s ease",
};

const darkButtonStyle: CSSProperties = {
  ...greenButtonStyle,
  background: "linear-gradient(to bottom, #2a2a2a, #1a1a1a)",
  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 0 1px #111111, 0 1px 6px rgba(0,0,0,0.18)",
};

export function SpezialfragenFragebogenCountPill({ fragebogen }: SpezialfragenCountPillProps) {
  const count = fragebogen.spezialfragen?.length ?? 0;
  if (count === 0) return null;

  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        backgroundColor: "rgba(5,150,105,0.07)",
        color: GREEN,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {count} {count === 1 ? "Spezialfrage" : "Spezialfragen"}
    </span>
  );
}

function SpezialfragenAbwaehlenModal({
  fragebogen,
  onClose,
  onSave,
}: {
  fragebogen: Fragebogen;
  onClose: () => void;
  onSave: (questions: Question[]) => Promise<void> | void;
}) {
  const questions = fragebogen.spezialfragen ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(questions.map((question) => question.id)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const removedCount = questions.length - selectedIds.size;

  const toggleQuestion = (questionId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const saveSelection = async () => {
    if (isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(questions.filter((question) => selectedIds.has(question.id)));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Spezialfragen konnten nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 280,
        backgroundColor: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Spezialfragen für ${fragebogen.name || "diesen Fragebogen"} abwählen`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "70vh",
          backgroundColor: "#fff",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "moduleEditorIn 0.3s cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        <div style={{ height: 52, flexShrink: 0, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: `linear-gradient(to bottom, ${GREEN}, ${GREEN_DARK})`, boxShadow: "0 1px 4px rgba(5,150,105,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={12} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Spezialfragen abwählen</span>
          <div style={{ width: 1, height: 14, backgroundColor: "rgba(0,0,0,0.07)", flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "rgba(0,0,0,0.35)" }}>{fragebogen.name}</span>
          <button type="button" onClick={onClose} aria-label="Schließen" style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ padding: "14px 20px 0" }}>
            <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{selectedIds.size} von {questions.length} ausgewählt</span>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)", margin: "12px 0 0" }} />
          </div>
          <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
            {questions.map((question) => {
              const selected = selectedIds.has(question.id);
              const badge = typeBadgeColor(question.type);
              return (
                <button
                  type="button"
                  key={question.id}
                  onClick={() => toggleQuestion(question.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: selected ? "1px solid rgba(220,38,38,0.18)" : "1px solid rgba(0,0,0,0.06)",
                    backgroundColor: selected ? "rgba(220,38,38,0.02)" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "inline-flex", marginBottom: 3, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.04em", textTransform: "uppercase", backgroundColor: badge.bg, color: badge.text }}>{typeLabel(question.type)}</span>
                    <div style={{ fontSize: 11, fontWeight: 500, color: question.text ? "#1a1a1a" : "rgba(0,0,0,0.25)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{question.text || "Kein Fragetext"}</div>
                  </div>
                  <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, backgroundColor: selected ? "#DC2626" : "transparent", border: selected ? "none" : "1.5px solid rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selected && <Check size={9} strokeWidth={3} color="#fff" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ minHeight: 52, flexShrink: 0, padding: "8px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span role={saveError ? "alert" : undefined} style={{ maxWidth: 240, fontSize: 10, color: saveError ? "#b91c1c" : "rgba(0,0,0,0.35)" }}>
            {saveError ?? (removedCount > 0 ? `${removedCount} ${removedCount === 1 ? "Frage wird" : "Fragen werden"} entfernt` : "Alle Fragen ausgewählt")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={isSaving} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "linear-gradient(to bottom, #fff, #f5f5f5)", borderRadius: 7, border: "none", cursor: isSaving ? "not-allowed" : "pointer", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)" }}>Abbrechen</button>
            <button type="button" onClick={() => { void saveSelection(); }} disabled={isSaving} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 600, color: "#fff", border: "none", borderRadius: 7, cursor: isSaving ? "not-allowed" : "pointer", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)" }}>{isSaving ? "Speichern..." : "Speichern"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpezialfragenFragebogenAction({ fragebogen, onSave, scope = "main" }: SpezialfragenFragebogenActionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const activeCount = fragebogen.spezialfragen?.length ?? 0;

  const hoverOn = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.opacity = "0.88";
  };
  const hoverOff = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.opacity = "1";
  };

  return (
    <>
      <div style={{ marginLeft: "auto" }}>
        {activeCount > 0 ? (
          expanded ? (
            <div style={{ display: "flex", gap: 5 }}>
              <button type="button" onClick={(event) => { event.stopPropagation(); setDeactivateOpen(true); setExpanded(false); }} style={darkButtonStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <Minus size={8} strokeWidth={2.5} />
                Frage abwählen
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); setEditorOpen(true); setExpanded(false); }} style={greenButtonStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <Pencil size={8} strokeWidth={2.5} />
                Frage bearbeiten
              </button>
            </div>
          ) : (
            <button type="button" onClick={(event) => { event.stopPropagation(); setExpanded(true); }} style={greenButtonStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <Sparkles size={8} strokeWidth={2.5} />
              Spezialfragen bearbeiten
            </button>
          )
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); setEditorOpen(true); }} style={{ ...greenButtonStyle, gap: 5, padding: "5px 12px", fontSize: 10 }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
            <Plus size={10} strokeWidth={2.5} />
            Spezialfrage hinzufügen
          </button>
        )}
      </div>

      {editorOpen && (
        <SpezialfrageEditor
          scope={scope}
          fragebogenName={fragebogen.name || "Unbenannter Fragebogen"}
          existingQuestions={fragebogen.spezialfragen ?? []}
          onClose={() => setEditorOpen(false)}
          onSave={async (questions) => {
            await onSave(questions);
            setEditorOpen(false);
          }}
        />
      )}
      {deactivateOpen && (
        <SpezialfragenAbwaehlenModal
          fragebogen={fragebogen}
          onClose={() => setDeactivateOpen(false)}
          onSave={async (questions) => {
            await onSave(questions);
            setDeactivateOpen(false);
          }}
        />
      )}
    </>
  );
}
