"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import type { Question } from "@/types/fragebogen";
import { SpezialfrageEditor } from "@/components/admin/SpezialfrageEditor";

type SpezialfragenFragebogenFieldProps = {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  fragebogenName: string;
  accentColor?: string;
};

export function SpezialfragenFragebogenField({
  questions,
  onChange,
  fragebogenName,
  accentColor = "#DC2626",
}: SpezialfragenFragebogenFieldProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!editorOpen) return;
    const closeOnlySpezialfragen = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setEditorOpen(false);
    };
    window.addEventListener("keydown", closeOnlySpezialfragen, true);
    return () => window.removeEventListener("keydown", closeOnlySpezialfragen, true);
  }, [editorOpen]);

  return (
    <>
      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.035)",
          padding: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accentColor,
              backgroundColor: `${accentColor}0D`,
              border: `1px solid ${accentColor}20`,
              flexShrink: 0,
            }}
          >
            <Sparkles size={15} strokeWidth={1.8} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>Spezialfragen</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: accentColor }}>
                {questions.length} aktiv
              </span>
            </div>
            <div style={{ marginTop: 3, fontSize: 10, lineHeight: 1.45, color: "rgba(0,0,0,0.42)" }}>
              Fragen aus dem gemeinsamen Pool aktivieren oder deaktivieren. Historische Antworten bleiben erhalten.
            </div>
            {questions.length > 0 && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 9,
                  color: "rgba(0,0,0,0.34)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {questions.map((question) => question.text || "Unbenannte Spezialfrage").join(" · ")}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            style={{
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 11px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "linear-gradient(to bottom, #fff, #f8f8f8)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              color: "#374151",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 650,
              flexShrink: 0,
            }}
          >
            Verwalten
            <ChevronRight size={12} strokeWidth={1.8} color={accentColor} />
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: "rgba(0,0,0,0.28)" }}>
          Änderungen werden gemeinsam mit dem Fragebogen gespeichert.
        </div>
      </section>

      {editorOpen && (
        <SpezialfrageEditor
          fragebogenName={fragebogenName || "Unbenannter Fragebogen"}
          existingQuestions={questions}
          onClose={() => setEditorOpen(false)}
          onSave={(nextQuestions) => {
            onChange(nextQuestions);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}
