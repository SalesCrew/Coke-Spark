"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2, X } from "lucide-react";
import { requestPraemienWorkspace as api } from "@/lib/api/backend";
import type {
  Workspace,
  WaveModel,
  ModelMetric,
  ModelPillar,
  ModelTier,
} from "@/types/praemien-workspace";
import styles from "./praemien.module.css";
import { useDialog } from "./useDialog";
import { BoniSelect } from "./BoniSelect";
import { QuestionSources } from "./QuestionSources";
import { DecimalField } from "./DecimalField";
import { appendIndependentGoal, conditionText, goalFor, metricUnit, updateGoal } from "@/lib/praemien-goals";
import type { BonusQuestion } from "@/lib/praemien-question-selection";

const currency = (n: number) =>
  n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
const methods: Record<ModelMetric["method"], string> = {
  manual: "Manuelle Bewertung",
  answer_sum: "Besuchsantworten · Wert / Punkte",
  availability: "Verfügbarkeit · Marktquote",
  weighted_sum: "Stückzahlen × Punkte je Platzierung",
  sum: "Summe der Teilwerte",
  difference: "Differenz (neu − retour)",
  average: "Mittelwert der Produktquoten",
  ratio: "Ist / Soll in %",
  steps: "Rohwert in Schwellenpunkte umrechnen",
};
const units = { percent: "Prozent (%)", points: "Punkte", count: "Anzahl", eur: "Euro (€)" };
const newMetric = (key: string): ModelMetric => ({
  key,
  label: "Neue Messgröße",
  unit: "percent",
  method: "manual",
  inputs: [],
  target: null,
  sources: [],
  steps: [],
});
const uniqueKey = (prefix: string, keys: string[]) => {
  let i = 1;
  while (keys.includes(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
};


export function ModelEditor({
  initial,
  firstPillar,
  workspace,
  busy,
  onClose,
  onSave,
}: {
  initial: WaveModel;
  firstPillar?: string;
  workspace: Workspace;
  busy: boolean;
  onClose: () => void;
  onSave: (model: WaveModel) => Promise<void>;
}) {
  const [model, setModel] = useState(initial),
    [pillarIndex, setPillarIndex] = useState(
      Math.max(
        0,
        initial.pillars.findIndex((p) => p.key === firstPillar),
      ),
    ),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<Workspace | null>(null),
    [checking, setChecking] = useState(false);
  useDialog(() => {
    if (!busy) onClose();
  });
  const modelVersion = useRef(0);
  const editorRef = useRef<HTMLElement>(null);
  const [customConditions, setCustomConditions] = useState<string[]>([]);
  const [focusGoal, setFocusGoal] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!focusGoal) return;
    const input = editorRef.current?.querySelector<HTMLInputElement>(`input[data-goal-key="${focusGoal}"]`);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "center" });
    input?.select();
    setFocusGoal(null);
  }, [focusGoal, model]);
  function validFields() {
    const input = editorRef.current?.querySelector<HTMLInputElement>(
      'input:invalid, input[aria-invalid="true"]',
    );
    if (!input) return true;
    input.reportValidity();
    input.focus();
    setError("Bitte die markierte Zahl korrigieren.");
    return false;
  }
  const [questions, setQuestions] = useState<BonusQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState("");
  const [sourceReload, setSourceReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setQuestionsLoading(true);
    setQuestionsError("");
    api<{ questions: BonusQuestion[] }>("/sources")
      .then((d) => {
        if (alive) { setQuestions(d.questions); setQuestionsLoading(false); }
      })
      .catch(() => {
        if (alive) { setQuestionsError("Fragen konnten nicht geladen werden. Deine Zuordnungen bleiben erhalten."); setQuestionsLoading(false); }
      });
    return () => {
      alive = false;
    };
  }, [sourceReload]);
  const p = model.pillars[pillarIndex];
  function change(next: WaveModel) {
    modelVersion.current++;
    setModel(next);
    setPreview(null);
  }
  function pillar(next: ModelPillar) {
    change({
      ...model,
      pillars: model.pillars.map((p, i) => (i === pillarIndex ? next : p)),
    });
  }
  function metric(index: number, next: ModelMetric) {
    pillar({
      ...p,
      metrics: p.metrics.map((m, i) => (i === index ? next : m)),
    });
  }
  function addGoal(index: number) {
    const next = appendIndependentGoal(p, index);
    pillar(next);
    setFocusGoal(next.metrics.at(-1)!.key);
  }
  function tier(index: number, next: ModelTier) {
    const before = p.tiers[index];
    const generatedLabel = (t: ModelTier) =>
      `Ab ${t.conditions[0]?.value} → ${t.rewardEur.toLocaleString("de-AT")} €`;
    if (before.label === generatedLabel(before) && next.label === before.label)
      next = { ...next, label: generatedLabel(next) };
    pillar({ ...p, tiers: p.tiers.map((t, i) => (i === index ? next : t)) });
  }
  return (
    <div className={styles.backdrop}>
      <section
        ref={editorRef}
        role="dialog"
        aria-modal="true"
        aria-label="Prämienregeln bearbeiten"
        className={styles.editor}
      >
        <header>
          <div>
            <span className={styles.eyebrow}>
              REGELN & QUELLEN · QUARTAL {workspace.wave.quarter}
            </span>
            <h2>Prämienregeln bearbeiten</h2>
            <p>Änderungen werden erst durch Speichern übernommen.</p>
          </div>
          <button aria-label="Schließen" disabled={busy} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {questionsError && <div className={`${styles.error} ${styles.editorAlert}`} role="alert"><span>{questionsError}</span><button type="button" disabled={busy || questionsLoading} onClick={() => setSourceReload((value) => value + 1)}>Fragen neu laden</button></div>}
        {error && <div className={`${styles.error} ${styles.editorAlert}`} role="alert">{error}</div>}
        <div className={styles.editorLayout}>
          <aside className={styles.pillarNav}>
            {model.pillars.map((p, i) => (
              <button
                key={p.key}
                className={i === pillarIndex ? styles.activeTab : ""}
                onClick={() => setPillarIndex(i)}
              >
                <span className={styles.dot} style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
            <button
              onClick={() => {
                const key = uniqueKey(
                  "saeule",
                  model.pillars.map((p) => p.key),
                );
                change({
                  ...model,
                  pillars: [
                    ...model.pillars,
                    {
                      key,
                      name: "Neue Säule",
                      kind: "custom",
                      color: "#dc2626",
                      maxRewardEur: 0,
                      payoutMode: "highest",
                      metrics: [newMetric("percent")],
                      tiers: [],
                    },
                  ],
                });
                setPillarIndex(model.pillars.length);
              }}
            >
              <Plus size={14} />
              Säule hinzufügen
            </button>
          </aside>
          <div className={styles.dialogBody}>
            <section className={styles.formSection}>
              <h3>
                <Settings2 size={17} />
                Ziel & Erfassung
              </h3>
              <div className={styles.twoColumns}>
                <label>
                  Bezeichnung
                  <input
                    value={p.name}
                    onChange={(e) => pillar({ ...p, name: e.target.value })}
                  />
                </label>
                <label>
                  Maximalprämie in €
                  <DecimalField
                    value={p.maxRewardEur}
                    onChange={(v) => pillar({ ...p, maxRewardEur: v ?? 0 })}
                  />
                </label>
                <label>
                  Fachliche Art
                  <BoniSelect
                    value={p.kind}
                    onChange={(e) =>
                      pillar({
                        ...p,
                        kind: e.target.value as ModelPillar["kind"],
                      })
                    }
                  >
                    <option value="displays">Schütten / Displays</option>
                    <option value="distribution">Distribution</option>
                    <option value="flex">Flexziel</option>
                    <option value="quality">Qualität</option>
                    <option value="custom">Eigenes Ziel</option>
                  </BoniSelect>
                </label>
                <label>
                  Diagrammfarbe
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) => pillar({ ...p, color: e.target.value })}
                  />
                </label>
              </div>
              <p className={styles.notice}>
                Namen sind nur Anzeige. Messgrößenschlüssel und Einheiten
                bestimmen, was alte Werte bedeuten. Bestehende Bewertungen
                werden nicht umgedeutet.
              </p>
              {p.payoutMode !== "manual" && <section className={styles.goalPanel} aria-label="Teilziele festlegen">
                <h3>Teilziele festlegen</h3>
                <p>Jedes Teilziel hat einen eigenen Wert. Für eine gemeinsame Prämie müssen alle ausgewählten Teilziele ihre Mindestgrenze erreichen.</p>
                {p.metrics.filter(m => goalFor(m)).map(m => { const goal = goalFor(m)!; return <div key={m.key} className={styles.goalRow}>
                  <label>Teilzielname<input data-goal-key={m.key} value={m.label} onChange={e => metric(p.metrics.indexOf(m), { ...m, label: e.target.value })} /></label>
                  <label>50 % erreicht ab ({metricUnit(m.unit)})<DecimalField value={goal.halfAt} onChange={v => pillar(updateGoal(p, m.key, { ...goal, halfAt: v ?? 0 }))} /></label>
                  <label>100 % erreicht ab ({metricUnit(m.unit)})<DecimalField value={goal.fullAt} onChange={v => pillar(updateGoal(p, m.key, { ...goal, fullAt: v ?? 0 }))} /></label>
                </div>; })}
                {!p.metrics.some(m => goalFor(m)) && <p>Prozentwerte oder Messgrößen mit 50-/100-%-Grenzen werden hier als Teilziele angezeigt.</p>}
              </section>}
              <details className={styles.calculationDetails} open={p.metrics.length === 1}><summary>Erfassung & Berechnung · {p.metrics.length} Messgrößen</summary>
              {p.metrics.map((m, i) => (
                <details
                  key={m.key}
                  className={styles.metricEditor}
                  open={p.metrics.length === 1}
                >
                  <summary>
                    {m.label}
                    <small>
                      {units[m.unit]} · {methods[m.method]}
                    </small>
                  </summary>
                  <label>Hinweis / Erfassungsregel<textarea value={m.hint ?? ""} onChange={e => metric(i, { ...m, hint: e.target.value })} /></label>
                  <div className={styles.twoColumns}>
                    <label>
                      Name
                      <input
                        value={m.label}
                        onChange={(e) =>
                          metric(i, { ...m, label: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Stabiler Schlüssel
                      <input value={m.key} readOnly />
                    </label>
                    <label>
                      Einheit
                      <BoniSelect
                        value={m.unit}
                        onChange={(e) =>
                          metric(i, {
                            ...m,
                            unit: e.target.value as ModelMetric["unit"],
                          })
                        }
                      >
                        {Object.entries(units).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </BoniSelect>
                    </label>
                    <label>
                      Berechnung
                      <BoniSelect
                        value={m.method}
                        onChange={(e) =>
                          metric(i, {
                            ...m,
                            method: e.target.value as ModelMetric["method"],
                          })
                        }
                      >
                        {Object.entries(methods).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </BoniSelect>
                    </label>
                  </div>
                  {m.unit !== "eur" && m.unit !== "percent" && !m.confirmation && <label className={styles.check}><input type="checkbox" checked={!!m.goal} onChange={e => metric(i, { ...m, goal: e.target.checked ? { halfAt: 50, fullAt: 100 } : undefined })} />Als Teilziel mit eigener 50-/100-%-Grenze verwenden</label>}
                  {m.unit === "eur" && p.payoutMode === "manual" && <label>Maximale manuelle Teilprämie in €<DecimalField value={m.manualRewardCap ?? null} optional onChange={v => metric(i, { ...m, manualRewardCap: v ?? undefined, maxValue: v ?? undefined, minValue: 0 })} /></label>}
                  {["ratio", "availability"].includes(m.method) && (
                    <label>
                      Soll / berechtigte Märkte (persönlich überschreibbar)
                      <DecimalField
                        value={m.target}
                        onChange={(v) => metric(i, { ...m, target: v })}
                        optional
                      />
                      <small>
                        Ohne positiven Nenner bleibt die Quote nicht auswertbar.
                        Der Nenner ist kein Fragengewicht.
                      </small>
                    </label>
                  )}
                  {["sum", "weighted_sum", "difference", "average", "ratio", "steps"].includes(
                    m.method,
                  ) && (
                    <fieldset>
                      <legend>Eingaben (in dieser Reihenfolge)</legend>
                      {p.metrics.slice(0, i).map((other) => (
                        <div className={styles.check} key={other.key}><label className={styles.check}>
                          <input
                            type="checkbox"
                            checked={m.inputs.includes(other.key)}
                            onChange={(e) =>
                              metric(i, {
                                ...m,
                                inputs: e.target.checked
                                  ? [...m.inputs, other.key]
                                  : m.inputs.filter((k) => k !== other.key),
                                ...(m.method === "weighted_sum" ? { weights: e.target.checked ? { ...m.weights, [other.key]: m.weights?.[other.key] ?? 1 } : Object.fromEntries(Object.entries(m.weights ?? {}).filter(([k]) => k !== other.key)) } : {}),
                              })
                            }
                          />
                          {other.label} · {units[other.unit]}</label>
                          {m.method === "weighted_sum" && m.inputs.includes(other.key) && <label className={styles.weightField}>Punkte je Stück<DecimalField value={m.weights?.[other.key] ?? 1} onChange={v => metric(i, { ...m, weights: { ...m.weights, [other.key]: v ?? 0 } })} /></label>}
                        </div>
                      ))}
                      {!i && (
                        <p>
                          Bitte zuerst die Rohwert-Messgröße hinzufügen und nach
                          oben stellen.
                        </p>
                      )}
                      <small>
                        {m.method === "difference"
                          ? "Erster Wert minus zweiter Wert."
                          : "Es zählen ausschließlich diese ausgewählten Messgrößen."}
                      </small>
                    </fieldset>
                  )}
                  {m.method === "steps" && (
                    <fieldset>
                      <legend>Schwellenumrechnung</legend>
                      {m.steps.map((s, j) => (
                        <div key={j} className={styles.inline}>
                          <label>
                            Ab Rohwert
                            <DecimalField
                              value={s.at}
                              onChange={(v) =>
                                metric(i, {
                                  ...m,
                                  steps: m.steps.map((x, k) =>
                                    k === j ? { ...x, at: v ?? 0 } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            Ergibt {units[m.unit]}
                            <DecimalField
                              value={s.value}
                              onChange={(v) =>
                                metric(i, {
                                  ...m,
                                  steps: m.steps.map((x, k) =>
                                    k === j ? { ...x, value: v ?? 0 } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <button
                            aria-label="Schwelle entfernen"
                            onClick={() =>
                              metric(i, {
                                ...m,
                                steps: m.steps.filter((_, k) => k !== j),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          metric(i, {
                            ...m,
                            steps: [...m.steps, { at: 0, value: 0 }],
                          })
                        }
                      >
                        Schwelle hinzufügen
                      </button>
                    </fieldset>
                  )}
                  {["answer_sum", "availability"].includes(m.method) && (
                    <QuestionSources
                      metric={m}
                      questions={questions}
                      loading={questionsLoading}
                      occupied={model.pillars.flatMap((pillar) => pillar.metrics.filter((other) => pillar.key !== p.key || other.key !== m.key).flatMap((other) => other.sources))}
                      onChange={(next) => metric(i, next)}
                    />
                  )}
                  <div className={styles.actions}>
                    <button
                      aria-label={`${m.label} nach oben`}
                      disabled={i === 0}
                      onClick={() => {
                        const metrics = [...p.metrics];
                        [metrics[i - 1], metrics[i]] = [
                          metrics[i],
                          metrics[i - 1],
                        ];
                        pillar({ ...p, metrics });
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`${m.label} nach unten`}
                      disabled={i === p.metrics.length - 1}
                      onClick={() => {
                        const metrics = [...p.metrics];
                        [metrics[i], metrics[i + 1]] = [
                          metrics[i + 1],
                          metrics[i],
                        ];
                        pillar({ ...p, metrics });
                      }}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      disabled={p.metrics.length === 1}
                      onClick={() =>
                        pillar({
                          ...p,
                          metrics: p.metrics.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 size={14} />
                      Messgröße entfernen
                    </button>
                  </div>
                </details>
              ))}
              <button
                onClick={() =>
                  pillar({
                    ...p,
                    metrics: [
                      ...p.metrics,
                      newMetric(
                        uniqueKey(
                          "messwert",
                          p.metrics.map((m) => m.key),
                        ),
                      ),
                    ],
                  })
                }
              >
                <Plus size={14} />
                Messgröße hinzufügen
              </button>
              </details>
            </section>
            <section className={styles.formSection}>
              <h3>Auszahlung & Mindestziele</h3>
              <label>
                Auszahlungsmodus
                <BoniSelect
                  value={p.payoutMode}
                  onChange={(e) =>
                    pillar({
                      ...p,
                      payoutMode: e.target.value as ModelPillar["payoutMode"],
                      tiers: e.target.value === "manual" ? [] : p.tiers,
                      metrics: p.metrics.map(m => ({ ...m, manualRewardCap: e.target.value === "manual" && m.unit === "eur" && m.method === "manual" ? m.manualRewardCap ?? m.maxValue : undefined })),
                    })
                  }
                >
                  <option value="manual">Manuell festgelegte Eurobeträge</option>
                  <option value="highest">Höchste erreichte Euro-Stufe</option>
                  <option value="groups">
                    Teilziele addieren (je Gruppe nur die höchste Stufe)
                  </option>
                </BoniSelect>
              </label>
              {p.payoutMode === "manual" ? <div className={styles.notice}><strong>Manuelle Teilprämien · bis {currency(p.maxRewardEur)}</strong><p>Die verantwortliche Person legt die Auszahlung in Euro fest. Es gelten keine automatischen Prozentgrenzen. Leer bleibt offen; ausdrücklich 0 € ist eine abgeschlossene Bewertung.</p>{p.metrics.filter(m => m.manualRewardCap !== undefined).map(m => <p key={m.key}>{m.label}: bis {currency(m.manualRewardCap!)}</p>)}<button onClick={() => {
                const key = uniqueKey("teilpraemie", p.metrics.map(m => m.key));
                pillar({ ...p, metrics: [...p.metrics, { ...newMetric(key), label: "Neue manuelle Teilprämie", unit: "eur", minValue: 0 }] });
              }}><Plus size={14} /> Manuelle Teilprämie hinzufügen</button></div> : <>
              <p>
                Eine Stufe zahlt erst aus, wenn jede ihrer Bedingungen erfüllt ist.
                Wähle die Teilziele einzeln aus – z. B. beide mindestens 50 %.
              </p>
              {p.tiers.map((t, i) => (
                <div key={t.key} className={styles.tier}>
                  <div className={styles.twoColumns}>
                    <label>
                      Stufenname
                      <input
                        value={t.label}
                        onChange={(e) =>
                          tier(i, { ...t, label: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Prämie in €
                      <DecimalField
                        value={t.rewardEur}
                        onChange={(v) => tier(i, { ...t, rewardEur: v ?? 0 })}
                      />
                    </label>
                    {p.payoutMode === "groups" && (
                      <label>
                        Teilzielgruppe
                        <input
                          placeholder="z. B. Zeitmanagement"
                          value={t.group}
                          onChange={(e) =>
                            tier(i, { ...t, group: e.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <div className={styles.tierHeading}><span className={styles.andBadge}>ALLE {t.conditions.length} BEDINGUNGEN · UND</span><strong>{currency(t.rewardEur)}</strong></div>
                  {t.conditions.map((c, j) => { const selected = p.metrics.find(m => m.key === c.metricKey); const goal = selected && goalFor(selected); const conditionId = `${p.key}/${t.key}/${c.metricKey}`; const milestone = goal && !customConditions.includes(conditionId) && c.operator === "gte" && (c.value === goal.halfAt || c.value === goal.fullAt); return (
                    <div key={j} className={`${styles.condition} ${milestone || selected?.confirmation ? styles.minimumCondition : goal ? styles.customCondition : ""}`}>
                      <label>
                        Teilziel / Bedingung
                        <BoniSelect
                          value={c.metricKey}
                          onChange={(e) =>
                            tier(i, {
                              ...t,
                              conditions: t.conditions.map((x, k) =>
                                k === j
                                  ? { ...x, metricKey: e.target.value, operator: "gte", value: goalFor(p.metrics.find(m => m.key === e.target.value)!)?.halfAt ?? 0 }
                                  : x,
                              ),
                            })
                          }
                        >
                          {p.metrics.filter(m => m.key === c.metricKey || !t.conditions.some(other => other.metricKey === m.key)).map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label} · {units[m.unit]}
                            </option>
                          ))}
                        </BoniSelect>
                      </label>
                      {goal && <label>Mindestziel<BoniSelect value={milestone ? c.value === goal.halfAt ? "50" : "100" : "custom"} onChange={e => {
                        if (e.target.value === "custom") { setCustomConditions(keys => [...keys, conditionId]); return; }
                        setCustomConditions(keys => keys.filter(key => key !== conditionId));
                        tier(i, { ...t, conditions: t.conditions.map((x,k) => k !== j ? x : { ...x, operator: "gte", value: e.target.value === "50" ? goal.halfAt : goal.fullAt }) });
                      }}><option value="50">Mindestens 50 %</option><option value="100">Mindestens 100 %</option><option value="custom">Eigene Grenze</option></BoniSelect><small>{milestone ? `Ab ${c.value.toLocaleString("de-AT")} ${metricUnit(selected!.unit)}` : "Grenze unten festlegen"}</small></label>}
                      {selected?.confirmation && <p className={styles.notice}>Die Nachweise müssen bestätigt sein.</p>}
                      {!milestone && !selected?.confirmation && <><label>
                        Vergleich
                        <BoniSelect
                          value={c.operator}
                          onChange={(e) =>
                            tier(i, {
                              ...t,
                              conditions: t.conditions.map((x, k) =>
                                k === j
                                  ? {
                                      ...x,
                                      operator: e.target
                                        .value as typeof c.operator,
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="gte">Mindestens ≥</option>
                          <option value="lte">Höchstens ≤</option>
                          <option value="eq">Genau =</option>
                        </BoniSelect>
                      </label>
                      <label>
                        Grenze
                        <DecimalField
                          value={c.value}
                          onChange={(v) =>
                            tier(i, {
                              ...t,
                              conditions: t.conditions.map((x, k) =>
                                k === j ? { ...x, value: v ?? 0 } : x,
                              ),
                            })
                          }
                        />
                      </label>
                      </>}
                      <button
                        aria-label={`Bedingung ${j + 1} entfernen`}
                        disabled={t.conditions.length === 1}
                        onClick={() =>
                          tier(i, {
                            ...t,
                            conditions: t.conditions.filter((_, k) => k !== j),
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ); })}
                  <p className={styles.conditionSummary}>Auszahlung nur wenn {t.conditions.map(c => conditionText(p, c)).join(" UND ")}.</p>
                  <div className={styles.actions}>
                    <button onClick={() => {
                      const next = p.metrics.find(m => goalFor(m) && !t.conditions.some(c => c.metricKey === m.key));
                      if (next) tier(i, { ...t, conditions: [...t.conditions, { metricKey: next.key, operator: "gte", value: goalFor(next)!.halfAt }] });
                      else addGoal(i);
                    }}><Plus size={14} /> Weiteres Teilziel (UND)</button>
                    <button onClick={() => addGoal(i)}><Plus size={14} /> Neues unabhängiges Teilziel anlegen</button>
                    <button
                      onClick={() =>
                        pillar({
                          ...p,
                          tiers: p.tiers.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Stufe entfernen
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  pillar({
                    ...p,
                    tiers: [
                      ...p.tiers,
                      {
                        key: uniqueKey(
                          "stufe",
                          p.tiers.map((t) => t.key),
                        ),
                        label: "Neue Stufe",
                        group: p.payoutMode === "groups" ? "Teilziel" : "",
                        rewardEur: 0,
                        conditions: [
                          {
                            metricKey: p.metrics.find(m => goalFor(m))?.key ?? p.metrics[0].key,
                            operator: "gte",
                            value: goalFor(p.metrics.find(m => goalFor(m)) ?? p.metrics[0])?.halfAt ?? 0,
                          },
                        ],
                      },
                    ],
                  })
                }
              >
                <Plus size={14} />
                Stufe hinzufügen
              </button>
              </>}
            </section>
            <section className={styles.formSection}>
              <label>
                Herkunft / Regelstand
                <textarea
                  value={model.provenance}
                  onChange={(e) =>
                    change({ ...model, provenance: e.target.value })
                  }
                />
              </label>
              <button
                disabled={model.pillars.length === 1}
                onClick={() => {
                  change({
                    ...model,
                    pillars: model.pillars.filter((_, i) => i !== pillarIndex),
                  });
                  setPillarIndex(0);
                }}
              >
                Säule entfernen
              </button>
            </section>
            {preview && (
              <section className={styles.preview}>
                <h3>Änderungen geprüft</h3>
                <p>
                  {preview.results.length} GMs ·{" "}
                  {preview.results.filter((r) => r.pending).length} noch offene
                  Bewertungen. Diese Vorschau schreibt keine Daten.
                </p>
                {preview.results.map((r) => {
                  const before =
                    workspace.results.find((x) => x.gmId === r.gmId)?.earned ??
                    0;
                  return (
                    <div key={r.gmId}>
                      <strong>{r.name}</strong>
                      <span>
                        {currency(before)} → {currency(r.earned)}
                      </span>
                      <b>
                        {r.earned - before >= 0 ? "+" : ""}
                        {currency(r.earned - before)}
                      </b>
                      {r.pending && <small>Vorläufig</small>}
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        </div>
        <footer>
          <button onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            disabled={busy || checking}
            onClick={async () => {
              if (!validFields()) return;
              setError("");
              setChecking(true);
              const version = modelVersion.current;
              try {
                const result = await api<Workspace>(
                  `/waves/${workspace.wave.id}/preview`,
                  { model },
                  "POST",
                );
                if (version === modelVersion.current) setPreview(result);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setChecking(false);
              }
            }}
          >
            Änderungen prüfen
          </button>
          <button
            className={styles.primary}
            disabled={
              busy ||
              checking ||
              (workspace.wave.status === "active" && !preview)
            }
            onClick={async () => {
              if (!validFields()) return;
              setError("");
              try {
                await onSave(model);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Speichern & neu berechnen
          </button>
        </footer>
      </section>
    </div>
  );
}
