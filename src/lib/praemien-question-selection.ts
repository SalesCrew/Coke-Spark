import type { ModelSource } from "@/types/praemien-workspace";

export type BonusQuestion = { id: string; text: string; type: string; config: Record<string, unknown>; scores: { scoreKey: string; weight: number | null }[]; updatedAt: string };
export const questionKind = (q: BonusQuestion) => ["numeric", "slider"].includes(q.type) ? "numeric" : ["yesno", "yesnomulti"].includes(q.type) ? "yesno" : "choice";
export function answerOptions(q: BonusQuestion): string[] {
  const options = Array.isArray(q.config.options) ? q.config.options.flatMap((o) => {
    if (typeof o === "string") return [o];
    if (o && typeof o === "object") { const value = (o as Record<string, unknown>).value ?? (o as Record<string, unknown>).label; return typeof value === "string" ? [value] : []; }
    return [];
  }) : [];
  return Array.from(new Set([...q.scores.map((s) => s.scoreKey).filter((s) => s !== "__value__"), ...(questionKind(q) === "yesno" ? ["Ja", "Nein"] : options)]));
}
export function eligibleQuestion(q: BonusQuestion): boolean {
  return ["numeric", "slider", "yesno", "yesnomulti"].includes(q.type) || ["single", "multiple", "likert"].includes(q.type) && answerOptions(q).length > 0;
}
export function sourceForQuestion(q: BonusQuestion, section: string): ModelSource {
  const factor = questionKind(q) === "numeric";
  const score = q.scores.find((s) => s.scoreKey === (factor ? "__value__" : "Ja")) ?? q.scores.find((s) => s.scoreKey !== "__value__" && Number(s.weight) > 0);
  return { questionId: q.id, label: q.text, section, factor, scoreKey: factor ? "__value__" : score?.scoreKey ?? answerOptions(q)[0] ?? "Ja", weight: score?.weight ?? 1, minFrequency: 0, chains: [], counting: "latest" };
}
