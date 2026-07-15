"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Fragebogen, Question } from "@/types/fragebogen";
import { SpezialfrageEditor } from "@/components/admin/SpezialfrageEditor";

type SpezialfragenFragebogenActionProps = {
  fragebogen: Fragebogen;
  onSave: (questions: Question[]) => Promise<void> | void;
  accentColor: string;
  accentBackground: string;
};

export function SpezialfragenFragebogenAction({
  fragebogen,
  onSave,
  accentColor,
  accentBackground,
}: SpezialfragenFragebogenActionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const activeCount = fragebogen.spezialfragen?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setEditorOpen(true);
        }}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 9px",
          borderRadius: 7,
          border: `1px solid ${accentColor}28`,
          backgroundColor: accentBackground,
          color: accentColor,
          cursor: "pointer",
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
        aria-label={`Spezialfragen für ${fragebogen.name || "diesen Fragebogen"} verwalten`}
      >
        {activeCount > 0 ? <Sparkles size={9} strokeWidth={2.3} /> : <Plus size={9} strokeWidth={2.3} />}
        {activeCount > 0 ? `Spezialfragen bearbeiten (${activeCount})` : "Spezialfrage hinzufügen"}
      </button>

      {editorOpen && (
        <SpezialfrageEditor
          fragebogenName={fragebogen.name || "Unbenannter Fragebogen"}
          existingQuestions={fragebogen.spezialfragen ?? []}
          onClose={() => setEditorOpen(false)}
          onSave={async (questions) => {
            await onSave(questions);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}
