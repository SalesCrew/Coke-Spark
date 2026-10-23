import type { SMDurcharbeitReportAnswer } from "@/types/smSMDurcharbeitCampaign";
import { smExportAnswerComment, smExportAnswerValue } from "./smAnswerValue";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]),
  );
  return value;
}

/** Merge revisions of one question, never unrelated questions sharing a title. */
export function smReportQuestionColumnKey(row: SMDurcharbeitReportAnswer): string {
  const question = row.question;
  const code = question.questionCodeSnapshot.trim();
  const text = question.questionTextSnapshot.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!code || !text) return JSON.stringify(["version", question.questionVersionId]);
  const type = question.questionTypeSnapshot;
  const labels = question.answerOptionsSnapshot.map(option => option.label);
  if (labels.some(label => typeof label !== "string")) return JSON.stringify(["version", question.questionVersionId, code]);
  // These types derive answer meaning from their frozen labels. Photo/comment
  // requirements and scoring may change without changing a Ja/Nein answer.
  const simpleChoice = ["yesno", "single", "multiple"].includes(type);
  const meaning = simpleChoice ? [...labels].sort() : {
    labels,
    config: canonical(question.configSnapshot ?? {}),
  };
  return JSON.stringify([code, type, text, meaning]);
}

export type SmReportAnswerCell = { value: string | number; comment: string; conflict: boolean };

/** Keep missing/hidden states separate from real answers and preserve conflicts. */
export function smReportAnswerCell(rows: SMDurcharbeitReportAnswer[]): SmReportAnswerCell {
  if (!rows.length) return { value: "", comment: "", conflict: false };
  const applicable = rows.filter(row => row.question.isApplicable !== false && row.answer?.answerState !== "not_applicable");
  const answered = applicable.filter(row => row.answer?.answerState === "answered" && row.answer.valueJson && row.answer.valueJson.kind !== "empty");
  const candidates = answered.length ? answered : applicable.length ? applicable : rows;
  const values = [...new Map(candidates.map(row => {
    const value = smExportAnswerValue(row);
    return [JSON.stringify(value), value] as const;
  })).values()];
  const conflict = values.length > 1;
  const comments = [...new Set(candidates.map(row => {
    const comment = smExportAnswerComment(row);
    return conflict ? `${smExportAnswerValue(row)}${comment ? `: ${comment}` : ""}` : comment;
  }).filter(comment => comment !== ""))];
  return {
    value: conflict ? `Widersprüchlich: ${values.join(" | ")}` : values[0]!,
    comment: comments.join("\n"),
    conflict,
  };
}
