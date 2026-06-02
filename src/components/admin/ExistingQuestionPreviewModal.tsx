"use client";

import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { Question } from "@/types/fragebogen";
import { typeBadgeColor, typeLabel } from "@/utils/fragebogen";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "start" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.38)" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#1f2937", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function renderTypeDetails(question: Question): string[] {
  const config = question.config ?? {};
  switch (question.type) {
    case "single":
    case "multiple":
      return [`Optionen: ${((config.options as string[]) ?? []).join(", ") || "—"}`];
    case "yesno":
      return ["Antworten: Ja, Nein"];
    case "yesnomulti": {
      const answers = ((config.answers as string[]) ?? []).join(", ");
      const branches = config.branches ? JSON.stringify(config.branches) : "—";
      return [`Antworten: ${answers || "—"}`, `Branches: ${branches}`];
    }
    case "likert":
      return [
        `Skala: ${String(config.min ?? "—")} bis ${String(config.max ?? "—")}`,
        `Labels: ${String(config.minLabel ?? "")} → ${String(config.maxLabel ?? "")}`,
      ];
    case "text":
      return [
        `Min Länge: ${String(config.minLength ?? "—")}`,
        `Max Länge: ${String(config.maxLength ?? "—")}`,
        `Platzhalter: ${String(config.placeholder ?? "—")}`,
      ];
    case "numeric":
      return [
        `Min: ${String(config.min ?? "—")}`,
        `Max: ${String(config.max ?? "—")}`,
        `Dezimal: ${String(Boolean(config.decimals))}`,
      ];
    case "slider":
      return [
        `Min: ${String(config.min ?? "—")}`,
        `Max: ${String(config.max ?? "—")}`,
        `Schritt: ${String(config.step ?? "—")}`,
        `Einheit: ${String(config.unit ?? "—")}`,
      ];
    case "photo":
      return [
        `Anweisung: ${String(config.instruction ?? "—")}`,
        `Tags aktiv: ${String(Boolean(config.tagsEnabled))}`,
        `Tag IDs: ${((config.tagIds as string[]) ?? []).join(", ") || "—"}`,
        `Bilder: ${((config.images as string[]) ?? []).length}`,
      ];
    case "matrix":
      return [
        `Zeilen: ${((config.rows as string[]) ?? []).join(", ") || "—"}`,
        `Spalten: ${((config.columns as string[]) ?? []).join(", ") || "—"}`,
        `Subtype: ${String(config.matrixSubtype ?? "toggle")}`,
      ];
    default:
      return [JSON.stringify(config)];
  }
}

export function ExistingQuestionPreviewModal({
  question,
  allQuestions,
  onClose,
}: {
  question: Question | null;
  allQuestions: Question[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!question) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [question, onClose]);

  const idToLabel = useMemo(() => {
    return new Map(allQuestions.map((item) => [item.id, item.text || `${typeLabel(item.type)} (${item.id})`]));
  }, [allQuestions]);

  if (!question) return null;

  const badge = typeBadgeColor(question.type);
  const details = renderTypeDetails(question);
  const scoringLines = Object.entries(question.scoring ?? {}).map(([key, value]) => {
    return `${key}: IPP=${value.ipp ?? "—"} | Boni=${value.boni ?? "—"} | Zweitplatzierung=${value.zweitplatzierung ?? "—"} | Mitbewerber=${value.mitbewerberabfrage ?? "—"}`;
  });

  return (
    <div
      onMouseDown={(event) => {
        if (!cardRef.current) return;
        if (!cardRef.current.contains(event.target as Node)) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.16)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 6,
                color: badge.text,
                background: badge.bg,
              }}
            >
              {typeLabel(question.type)}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)" }}>{question.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "rgba(0,0,0,0.05)",
              width: 26,
              height: 26,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(0,0,0,0.42)",
            }}
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Fragetext" value={question.text || "—"} />
          <Field label="Pflichtfrage" value={question.required ? "Ja" : "Nein"} />
          <Field label="Handelsketten" value={question.chains?.join(", ") || "Alle"} />
          <Field label="Typ-Infos" value={details.join("\n")} />
          <Field label="Scoring" value={scoringLines.join("\n") || "—"} />
          <Field
            label="Regeln"
            value={
              (question.rules ?? [])
                .map((rule, index) => {
                  const targets = rule.targetQuestionIds.map((id) => idToLabel.get(id) ?? id).join(", ") || "—";
                  const trigger = rule.triggerQuestionId ? idToLabel.get(rule.triggerQuestionId) ?? rule.triggerQuestionId : "—";
                  return `#${index + 1} ${rule.action.toUpperCase()} | Trigger: ${trigger} | Operator: ${rule.operator} | Wert: ${rule.triggerValue || "—"} | Wert max: ${rule.triggerValueMax || "—"} | Ziele: ${targets}`;
                })
                .join("\n") || "—"
            }
          />
        </div>
      </div>
    </div>
  );
}
