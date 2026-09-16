import { computeHiddenQuestionIds } from "@/lib/conditional-visibility";
import { smCommentMissing, smCommentTriggerKey } from "@/lib/sm/answerComments";
import type { SmManagedQuestion } from "@/types/smManagement";
import type { SmVisitAnswer } from "@/types/smVisit";

/** Preserve source indexes: blank historical rows must not renumber answer codes. */
export function smManagementMatrixLabels(value: unknown, prefix: "row" | "column") {
  return Array.isArray(value) ? value.flatMap((item, index) => typeof item === "string" && item.trim()
    ? [{ code: `${prefix}_${index + 1}`, label: item.trim(), index }] : []) : [];
}

export function smManagementSelectMatrix(answer: SmVisitAnswer, rowCode: string, columnCode: string): SmVisitAnswer {
  const cells = answer.kind === "matrix" ? answer.cells : [];
  return { kind: "matrix", cells: [...cells.filter(cell => cell.rowCode !== rowCode), { rowCode, columnCode, selected: true }] };
}

export function smManagementOptionSubheadings(question: SmManagedQuestion): string[] {
  const values = Array.isArray(question.config.answerSubheadings) ? question.config.answerSubheadings : [];
  const labels = question.type === "yesno" ? ["Ja", "Nein"]
    : question.type === "yesnomulti" ? question.config.answers
    : question.type === "single" || question.type === "multiple" ? question.config.options : [];
  const indexes = new Map((Array.isArray(labels) ? labels : []).map((label, index) => [String(label).trim(), index]));
  return question.options.map((option, index) => {
    const value = values[indexes.get(option.label.trim()) ?? index];
    return typeof value === "string" ? value.trim() : "";
  });
}

export function smManagementConfigNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function smManagementAnswerLabel(question: SmManagedQuestion, answer: SmVisitAnswer): string {
  const label = (code: string) => question.options.find(option => option.code === code)?.label ?? code;
  if (answer.kind === "empty") return "Nicht beantwortet";
  if (answer.kind === "choice") return label(answer.optionCode);
  if (answer.kind === "multi") return answer.optionCodes.map(label).join(", ") || "Nicht beantwortet";
  if (answer.kind === "yesnomulti") return [label(answer.optionCode), ...answer.subOptions].join(" · ");
  if (answer.kind === "text") return answer.value || "Nicht beantwortet";
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "photo") return `${answer.fileIds.length} Foto${answer.fileIds.length === 1 ? "" : "s"}`;
  const rows = Array.isArray(question.config.rows) ? question.config.rows : [];
  const columns = Array.isArray(question.config.columns) ? question.config.columns : [];
  return answer.cells.filter(cell => cell.selected).map(cell => `${rows[Number(cell.rowCode.split("_")[1]) - 1] ?? cell.rowCode}: ${columns[Number(cell.columnCode.split("_")[1]) - 1] ?? cell.columnCode}`).join(" · ") || "Nicht beantwortet";
}
export function smManagementRuleValue(question: SmManagedQuestion, answer: SmVisitAnswer): string | string[] | undefined {
  const label = (code: string) => question.options.find(option => option.code === code)?.label ?? code;
  if (answer.kind === "empty") return undefined;
  if (answer.kind === "choice") return label(answer.optionCode);
  if (answer.kind === "multi") return answer.optionCodes.map(label);
  if (answer.kind === "yesnomulti") return JSON.stringify({ sel: label(answer.optionCode), subs: answer.subOptions });
  if (answer.kind === "text") return answer.value;
  if (answer.kind === "number") return String(answer.value);
  if (answer.kind === "photo") return answer.fileIds.length ? "uploaded" : undefined;
  return answer.cells.filter(cell => cell.selected).map(cell => `${cell.rowCode}:${cell.columnCode}`);
}
export function smManagementHidden(questions: SmManagedQuestion[], draft: Record<string, SmVisitAnswer>) {
  const hidden = computeHiddenQuestionIds(questions.map(question => ({ id: question.id, questionId: question.questionCode, rules: question.rules })),
    new Map(questions.map(question => [question.id, smManagementRuleValue(question, draft[question.id] ?? question.answer)])));
  for (const question of questions) if (!question.applicable && question.applicabilityReason && !question.applicabilityReason.startsWith("hidden_by_rule")) hidden.add(question.id);
  return hidden;
}
export function smManagementAnswerComplete(question: SmManagedQuestion, answer: SmVisitAnswer): boolean {
  if (smCommentMissing(question, answer)) return false;
  if (!question.required) return true;
  if (answer.kind === "empty") return false;
  if (answer.kind === "text") return Boolean(answer.value.trim());
  if (answer.kind === "multi") return answer.optionCodes.length > 0;
  if (answer.kind === "photo") return answer.fileIds.length > 0;
  if (answer.kind === "matrix") {
    const rows = smManagementMatrixLabels(question.config.rows, "row");
    return rows.length > 0 && rows.every(row => answer.cells.some(cell => cell.rowCode === row.code && cell.selected));
  }
  return true;
}
export function smManagementNextAnswer(question: SmManagedQuestion, old: SmVisitAnswer, next: SmVisitAnswer): SmVisitAnswer {
  if (next.kind === "empty") return next;
  const key = smCommentTriggerKey(question, next);
  return key && key === smCommentTriggerKey(question, old) && old.comment ? { ...next, comment: old.comment } : next;
}
export function smManagementTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
}
