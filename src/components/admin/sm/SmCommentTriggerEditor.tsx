"use client";

import { Check, MessageSquare } from "lucide-react";
import { getSmCommentTrigger, type SmCommentTrigger } from "@/lib/sm/answerComments";
import type { SmQuestion } from "@/types/smQuestionnaire";

export function commentOptionLabels(question: SmQuestion): string[] {
  const config = question.config;
  if (question.type === "yesno") return ["Ja", "Nein"];
  if (question.type === "yesnomulti") return (Array.isArray(config.answers) ? config.answers : question.options).map(String);
  if (question.type === "single" || question.type === "multiple") return (Array.isArray(config.options) ? config.options : question.options).map(String);
  if (question.type === "matrix") return (Array.isArray(config.columns) ? config.columns : []).map(String);
  if (question.type === "likert") {
    const min = Number(config.min ?? 1), max = Number(config.max ?? 5);
    return Number.isInteger(min) && Number.isInteger(max) && max >= min && max - min <= 20 ? Array.from({ length: max - min + 1 }, (_, i) => String(min + i)) : [];
  }
  return [];
}

function optionEntries(question: SmQuestion) {
  let position = 0;
  return commentOptionLabels(question).flatMap((label, rawIndex) => label.trim()
    ? [{ label: label.trim(), rawIndex, code: `${question.type === "matrix" ? "column" : "option"}_${question.type === "matrix" ? rawIndex + 1 : ++position}` }] : []);
}

// Explicit removal indices preserve even duplicate labels; renames keep their position.
export function reconcileCommentOptions(previous: SmQuestion, config: Record<string, unknown>, removedIndex?: number): Record<string, unknown> {
  const trigger = getSmCommentTrigger(previous.config);
  if (trigger?.mode !== "options") return config;
  const before = optionEntries(previous);
  const after = optionEntries({ ...previous, config });
  const selected = before.filter((option) => trigger.optionCodes.includes(option.code));
  const codes = selected.flatMap((option) => {
    if (option.rawIndex === removedIndex) return [];
    const rawIndex = removedIndex !== undefined && option.rawIndex > removedIndex ? option.rawIndex - 1 : option.rawIndex;
    const next = previous.type === "likert" ? after.find((entry) => entry.label === option.label) : after.find((entry) => entry.rawIndex === rawIndex);
    return next ? [next.code] : [];
  });
  return { ...config, commentTrigger: { mode: "options", optionCodes: codes } };
}

export function SmCommentTriggerEditor({ question, onUpdate }: { question: SmQuestion; onUpdate: (question: SmQuestion) => void }) {
  const trigger = getSmCommentTrigger(question.config);
  const choices = optionEntries(question);
  const supportsChoices = ["single", "multiple", "yesno", "yesnomulti", "likert", "matrix"].includes(question.type);
  const update = (value: SmCommentTrigger | null) => {
    const config = { ...question.config };
    if (value) config.commentTrigger = value;
    else delete config.commentTrigger;
    onUpdate({ ...question, config });
  };
  const selectedCodes = trigger?.mode === "answered" ? choices.map((option) => option.code) : trigger?.optionCodes ?? [];

  return <div className="mt-3.5 border-t border-black/[0.04]">
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(trigger)}
      aria-label="Kommentar bei Antwort aktivieren"
      onClick={() => update(trigger ? null : supportsChoices ? { mode: "options", optionCodes: [] } : { mode: "answered" })}
      className="flex min-h-10 w-full items-center gap-[7px] rounded-md text-left text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red-200"
      style={{ color: trigger ? "var(--module-accent,#DC2626)" : "rgba(0,0,0,.35)" }}
    >
      <MessageSquare size={12} className="shrink-0" />
      <span className="flex-1">Kommentar bei Antwort</span>
      <span aria-hidden="true" className="relative h-[18px] w-8 shrink-0 rounded-full transition-colors" style={{ backgroundColor: trigger ? "var(--module-accent,#DC2626)" : "rgba(0,0,0,.12)" }}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-[left] ${trigger ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
    {trigger ? <div className="pb-1 pl-[19px]">
      {supportsChoices ? <>
        <div className="flex max-w-4xl flex-col items-start gap-1.5">
          <span className="text-[10px] text-black/35">{question.type === "matrix" ? "Pflichtkommentar bei Spalte" : "Pflichtkommentar bei"}</span>
          <div role="group" aria-label="Antworten mit Pflichtkommentar" className="grid max-h-40 min-w-0 max-w-full justify-items-start gap-1.5 overflow-y-auto p-px">
            {choices.map((option, index) => {
              const selected = selectedCodes.includes(option.code);
              return <button
                key={option.code}
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={`Kommentar bei ${index + 1}: ${option.label}`}
                title={`${index + 1}. ${option.label}`}
                onClick={() => update({ mode: "options", optionCodes: selected ? selectedCodes.filter((code) => code !== option.code) : [...selectedCodes, option.code] })}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-200 ${selected ? "border-red-200/80 bg-red-50/70 text-red-600" : "border-black/[0.07] bg-white text-black/45 hover:border-black/15 hover:bg-black/[0.02]"}`}
              >
                <span aria-hidden="true" className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${selected ? "bg-red-500 text-white" : "border border-black/15"}`}>{selected ? <Check size={8} strokeWidth={3} /> : null}</span>
                <span className="min-w-0 max-w-60 truncate">{option.label}</span>
              </button>;
            })}
          </div>
          <button type="button" aria-pressed={trigger.mode === "answered"} onClick={() => update(trigger.mode === "answered" ? { mode: "options", optionCodes: [] } : { mode: "answered" })} className={`shrink-0 rounded px-1 py-1.5 text-[9px] font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-200 ${trigger.mode === "answered" ? "text-red-600" : "text-black/35"}`}>{trigger.mode === "answered" ? "Auswahl aufheben" : "Alle Antworten"}</button>
        </div>
        {trigger.mode === "options" && !trigger.optionCodes.length ? <p role="status" className="mb-0 mt-1.5 text-[9px] text-amber-700">Wähle die Antworten aus, die einen Kommentar benötigen.</p> : null}
      </> : <p className="m-0 text-[10px] leading-relaxed text-black/35">Ein Kommentar ist bei jeder ausgefüllten Antwort erforderlich.</p>}
    </div> : null}
  </div>;
}
