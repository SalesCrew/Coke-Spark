import type { ModelMetric, ModelPillar, ModelTier } from "@/types/praemien-workspace";
export const metricUnit = (unit: ModelMetric["unit"]) => ({ percent: "%", count: "Stück", points: "Punkte", eur: "€" })[unit];
export const goalFor = (m: ModelMetric) => m.goal ?? (m.unit === "percent" ? { halfAt: 50, fullAt: 100 } : null);
export function conditionText(p: ModelPillar, c: ModelTier["conditions"][number]): string {
  const m = p.metrics.find(m => m.key === c.metricKey);
  if (!m) return c.metricKey;
  if (m.confirmation) return `${m.label}: ${c.value === 1 ? "bestätigt" : "nicht erfüllt"}`;
  const goal = goalFor(m);
  const level = c.operator === "gte" && goal ? c.value === goal.halfAt ? 50 : c.value === goal.fullAt ? 100 : null : null;
  const raw = `${c.value.toLocaleString("de-AT")} ${metricUnit(m.unit)}`;
  return level !== null ? `${m.label} mindestens ${level} %${m.unit === "percent" ? "" : ` (≥ ${raw})`}` : `${m.label} ${c.operator === "gte" ? "≥" : c.operator === "lte" ? "≤" : "="} ${raw}`;
}
export function updateGoal(p: ModelPillar, key: string, goal: NonNullable<ModelMetric["goal"]>): ModelPillar {
  const before = goalFor(p.metrics.find(m => m.key === key)!);
  return { ...p, metrics: p.metrics.map(m => m.key === key ? { ...m, goal } : before && m.method === "steps" && m.inputs.length === 1 && m.inputs[0] === key ? { ...m, steps: m.steps.map(s => ({ ...s, at: s.at === before.halfAt ? goal.halfAt : s.at === before.fullAt ? goal.fullAt : s.at })) } : m), tiers: p.tiers.map(t => ({ ...t, conditions: t.conditions.map(c => c.metricKey !== key || c.operator !== "gte" || !before ? c : { ...c, value: c.value === before.halfAt ? goal.halfAt : c.value === before.fullAt ? goal.fullAt : c.value }) })) };
}
export function appendIndependentGoal(p: ModelPillar, tierIndex: number): ModelPillar {
  let i = 1; while (p.metrics.some(m => m.key === `teilziel_${i}`)) i++;
  const m: ModelMetric = { key: `teilziel_${i}`, label: `Neues Teilziel ${i}`, unit: "percent", method: "manual", inputs: [], target: null, steps: [], sources: [], goal: { halfAt: 50, fullAt: 100 } };
  return { ...p, metrics: [...p.metrics, m], tiers: p.tiers.map((t, j) => {
    if (j !== tierIndex) return t;
    // Repair the former button's redundant >= condition when creating a second goal.
    const duplicate = t.conditions.findIndex((c, k) => c.operator === "gte" && t.conditions.slice(0, k).some(other => other.operator === "gte" && other.metricKey === c.metricKey));
    return { ...t, conditions: duplicate >= 0 ? t.conditions.map((c, k) => k === duplicate ? { ...c, metricKey: m.key, value: 50 } : c) : [...t.conditions, { metricKey: m.key, operator: "gte", value: 50 }] };
  }) };
}
