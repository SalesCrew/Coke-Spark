import type { MetricEntry, ModelMetric, Workspace } from "../types/praemien-workspace";

export const valueFields = ["value", "target", "note", "rawPoints"] as const;
export type ValueField = typeof valueFields[number];
export type ValueDraft = Record<string, Record<ValueField, string>>;
export type ValueConflict = { id: string; field: ValueField; label: string; current: string; mine: string };
const text = (n: number | null | undefined) => n == null ? "" : String(n).replace(".", ",");
const number = (s: string) => s.trim() === "" ? null : Number(s.trim().replace(",", "."));
const entryKey = (e: MetricEntry) => `${e.pillarKey}/${e.metricKey}`;
const normalize = (field: ValueField, s: string) => field === "note" ? s : number(s);
const equal = (field: ValueField, a: string, b: string) => Object.is(normalize(field, a), normalize(field, b));
export const fieldLabels: Record<ValueField, string> = { value: "Wert / Prozentvorgabe", target: "Persönlicher Sollwert", note: "Begründung / Nachweis", rawPoints: "Ist-Punkte" };

export function valueDraft(workspace: Workspace, gmId: string): ValueDraft {
  const entries = new Map(workspace.entries.filter(e => e.gmId === gmId).map(e => [entryKey(e), e]));
  return Object.fromEntries((workspace.results.find(g => g.gmId === gmId)?.pillars ?? []).flatMap(p => p.metrics.map(m => {
    const e = entries.get(`${p.key}/${m.key}`);
    return [`${p.key}/${m.key}`, { value: text(e?.value), target: text(e?.target), note: e?.note ?? "", rawPoints: text(e?.rawPoints) }];
  })));
}
export function draftIsDirty(workspace: Workspace, gmId: string, draft: ValueDraft) {
  const before = valueDraft(workspace, gmId);
  return Object.entries(draft).some(([id, d]) => valueFields.some(f => !equal(f, d[f], before[id]?.[f] ?? "")));
}

export function valueChanges(workspace: Workspace, gmId: string, draft: ValueDraft): MetricEntry[] {
  const before = valueDraft(workspace, gmId);
  const changes: MetricEntry[] = [];
  for (const p of workspace.model?.pillars ?? []) for (const m of p.metrics) {
    const id = `${p.key}/${m.key}`, d = draft[id];
    if (!d || valueFields.every(f => equal(f, d[f], before[id]?.[f] ?? ""))) continue;
    const value = number(d.value), target = number(d.target), rawPoints = number(d.rawPoints);
    if ((value !== null && !Number.isFinite(value)) || (target !== null && (!Number.isFinite(target) || target <= 0)) || (rawPoints !== null && !Number.isFinite(rawPoints)))
      throw new Error("Bitte gültige Zahlen eingeben; Sollwerte müssen größer als 0 sein.");
    if (value !== null && ((m.minValue !== undefined && value < m.minValue) || (m.maxValue !== undefined && value > m.maxValue) || (m.integerOnly && !Number.isInteger(value))))
      throw new Error(`${m.label}: Bitte einen Wert im zulässigen Bereich eingeben.`);
    const pointsMetric = m.method === "answer_sum" && m.unit === "percent" && p.kind === "displays" && !m.readOnly;
    changes.push({ gmId, pillarKey: p.key, metricKey: m.key, value, target, note: d.note, ...(pointsMetric ? { rawPoints } : {}) });
  }
  return changes;
}

// Compare meaning, not display labels or exceptions belonging to another employee.
function semantics(metric: ModelMetric, gmId: string) {
  const { label: _label, hint: _hint, sourceSectionOverrides, sources, ...rest } = metric;
  return { ...rest, sources: sources.map(({ label: _sourceLabel, ...s }) => s), sections: sourceSectionOverrides?.find(o => o.gmId === gmId)?.sections ?? null };
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function metricMeaning(workspace: Workspace, pillarKey: string, metricKey: string, gmId: string, visited = new Set<string>()): unknown {
  const p = workspace.model?.pillars.find(p => p.key === pillarKey), m = p?.metrics.find(m => m.key === metricKey);
  if (!p || !m || visited.has(metricKey)) return null;
  visited.add(metricKey);
  return { kind: p.kind, metric: semantics(m, gmId), inputs: m.inputs.map(key => metricMeaning(workspace, pillarKey, key, gmId, visited)) };
}

export function reconcileValueDraft(before: Workspace, latest: Workspace, gmId: string, draft: ValueDraft): { draft: ValueDraft; conflicts: ValueConflict[]; blocked: string | null } {
  const blocked = (message: string) => ({ draft, conflicts: [], blocked: message });
  if (latest.wave.id !== before.wave.id || latest.wave.status === "archived" || latest.closedAt)
    return blocked("Diese Welle ist nicht mehr bearbeitbar. Deine Eingaben bleiben hier erhalten; es wurde nichts überschrieben.");
  if (latest.wave.startDate !== before.wave.startDate || latest.wave.endDate !== before.wave.endDate)
    return blocked("Der Zeitraum dieser Welle wurde geändert. Deine Eingaben bleiben erhalten. Bitte prüfe die aktuellen Regeln vor einer neuen Eingabe.");
  if (!latest.results.some(g => g.gmId === gmId)) return blocked("Diese Person ist nicht mehr Teil der Welle. Deine Eingaben bleiben hier erhalten.");
  const original = valueDraft(before, gmId), current = valueDraft(latest, gmId), merged = structuredClone(current), conflicts: ValueConflict[] = [];
  for (const [id, d] of Object.entries(draft)) {
    const changed = valueFields.filter(f => !equal(f, d[f], original[id]?.[f] ?? ""));
    if (!changed.length) continue;
    const [pillar, metric] = id.split("/");
    if (!current[id] || stable(metricMeaning(before, pillar, metric, gmId)) !== stable(metricMeaning(latest, pillar, metric, gmId)))
      return blocked("Die Berechnungsregeln für eine bearbeitete Messgröße wurden geändert. Deine Eingaben bleiben erhalten. Bitte notiere sie und öffne die aktuellen Regeln, bevor du diese Werte neu eingibst.");
    const label = latest.model?.pillars.find(p => p.key === pillar)?.metrics.find(m => m.key === metric)?.label ?? metric;
    for (const f of changed) {
      merged[id][f] = d[f];
      if (!equal(f, original[id]?.[f] ?? "", current[id][f]) && !equal(f, d[f], current[id][f]))
        conflicts.push({ id, field: f, label: `${label} · ${fieldLabels[f]}`, current: current[id][f], mine: d[f] });
    }
  }
  return { draft: merged, conflicts, blocked: null };
}
