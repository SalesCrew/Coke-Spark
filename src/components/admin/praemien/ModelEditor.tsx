"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2, X } from "lucide-react";
import { requestPraemienWorkspace as api } from "@/lib/api/backend";
import type {
  Workspace,
  WaveModel,
  ModelMetric,
  ModelPillar,
  ModelSource,
  ModelTier,
} from "@/types/praemien-workspace";
import styles from "./praemien.module.css";
import { useDialog } from "./useDialog";

const currency = (n: number) =>
  n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
const methods: Record<ModelMetric["method"], string> = {
  manual: "Manuelle Bewertung",
  answer_sum: "Besuchsantworten · Wert / Punkte",
  availability: "Verfügbarkeit · Marktquote",
  sum: "Summe der Teilwerte",
  difference: "Differenz (neu − retour)",
  average: "Mittelwert der Produktquoten",
  ratio: "Ist / Soll in %",
  steps: "Rohwert in Schwellenpunkte umrechnen",
};
const units = { percent: "Prozent (%)", points: "Punkte", count: "Anzahl" };
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
type Question = {
  id: string;
  text: string;
  type: string;
  config: Record<string, unknown>;
  scores: { scoreKey: string; weight: number | null }[];
  updatedAt: string;
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
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    let alive = true;
    api<{ questions: Question[] }>("/sources")
      .then((d) => {
        if (alive) setQuestions(d.questions);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
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
                  <select
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
                  </select>
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
                      <select
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
                      </select>
                    </label>
                    <label>
                      Berechnung
                      <select
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
                      </select>
                    </label>
                  </div>
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
                  {["sum", "difference", "average", "ratio", "steps"].includes(
                    m.method,
                  ) && (
                    <fieldset>
                      <legend>Eingaben (in dieser Reihenfolge)</legend>
                      {p.metrics.slice(0, i).map((other) => (
                        <label className={styles.check} key={other.key}>
                          <input
                            type="checkbox"
                            checked={m.inputs.includes(other.key)}
                            onChange={(e) =>
                              metric(i, {
                                ...m,
                                inputs: e.target.checked
                                  ? [...m.inputs, other.key]
                                  : m.inputs.filter((k) => k !== other.key),
                              })
                            }
                          />
                          {other.label} · {units[other.unit]}
                        </label>
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
                            Ergibt Punkte
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
                    <Sources
                      metric={m}
                      questions={questions}
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
            </section>
            <section className={styles.formSection}>
              <h3>Stufen & Bedingungen</h3>
              <label>
                Auszahlungsmodus
                <select
                  value={p.payoutMode}
                  onChange={(e) =>
                    pillar({
                      ...p,
                      payoutMode: e.target.value as ModelPillar["payoutMode"],
                    })
                  }
                >
                  <option value="highest">Höchste erreichte Euro-Stufe</option>
                  <option value="groups">
                    Teilziele addieren (je Gruppe nur die höchste Stufe)
                  </option>
                </select>
              </label>
              <p>
                Unter der ersten erfüllten Stufe: 0 €. Alle Bedingungen einer
                Stufe gelten als UND.
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
                  {t.conditions.map((c, j) => (
                    <div key={j} className={styles.condition}>
                      <label>
                        Messgröße
                        <select
                          value={c.metricKey}
                          onChange={(e) =>
                            tier(i, {
                              ...t,
                              conditions: t.conditions.map((x, k) =>
                                k === j
                                  ? { ...x, metricKey: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        >
                          {p.metrics.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label} · {units[m.unit]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Vergleich
                        <select
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
                        </select>
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
                      <button
                        aria-label="Bedingung entfernen"
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
                  ))}
                  <div className={styles.actions}>
                    <button
                      onClick={() =>
                        tier(i, {
                          ...t,
                          conditions: [
                            ...t.conditions,
                            {
                              metricKey: p.metrics[0].key,
                              operator: "gte",
                              value: 0,
                            },
                          ],
                        })
                      }
                    >
                      UND-Bedingung hinzufügen
                    </button>
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
                            metricKey: p.metrics[0].key,
                            operator: "gte",
                            value: 80,
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
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {preview && (
              <section className={styles.preview}>
                <h3>Änderungen geprüft</h3>
                <p>
                  {preview.results.length} echte GMs ·{" "}
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

function Sources({
  metric,
  questions,
  onChange,
}: {
  metric: ModelMetric;
  questions: Question[];
  onChange: (m: ModelMetric) => void;
}) {
  const [search, setSearch] = useState("");
  function source(index: number, next: ModelSource) {
    onChange({
      ...metric,
      sources: metric.sources.map((s, i) => (i === index ? next : s)),
    });
  }
  return (
    <fieldset>
      <legend>Fragebogenquellen</legend>
      <p>
        Die Zuordnung gilt für diese Quartalsregel. Frageänderungen ändern die
        Euro-Regel nicht automatisch; bitte bewusst prüfen und neu speichern.
      </p>
      {metric.sources.map((s, i) => (
        <div key={i} className={styles.source}>
          <label>
            Frage suchen
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Frage / Produkt …"
            />
          </label>
          <label>
            Technische Frage
            <select
              aria-label="Technische Frage"
              value={s.questionId}
              onChange={(e) => {
                const q = questions.find((q) => q.id === e.target.value);
                source(i, {
                  ...s,
                  questionId: e.target.value,
                  label: q?.text ?? "",
                  factor: ["numeric", "slider"].includes(q?.type ?? ""),
                  scoreKey: ["numeric", "slider"].includes(q?.type ?? "")
                    ? "__value__"
                    : (q?.scores[0]?.scoreKey ?? "Ja"),
                  weight: Number(q?.scores[0]?.weight ?? 1),
                });
              }}
            >
              <option value="">Frage auswählen</option>
              {questions
                .filter(
                  (q) =>
                    q.id === s.questionId ||
                    q.text
                      .toLocaleLowerCase("de")
                      .includes(search.toLocaleLowerCase("de")),
                )
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text} · {q.type}
                  </option>
                ))}
            </select>
          </label>
          <div className={styles.twoColumns}>
            <label>
              Besuchsbereich
              <select
                value={s.section}
                onChange={(e) => source(i, { ...s, section: e.target.value })}
              >
                {[
                  "standard",
                  "flex",
                  "billa",
                  "kuehler",
                  "mhd",
                  "durcharbeit",
                ].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zählweise
              <select
                value={s.counting}
                onChange={(e) =>
                  source(i, {
                    ...s,
                    counting: e.target.value as ModelSource["counting"],
                  })
                }
              >
                <option value="latest">
                  Letzter Stand pro Markt / Quartal
                </option>
                <option value="once">
                  Einmal pro Markt / Quartal (höchster gültiger Wert)
                </option>
              </select>
            </label>
            <label>
              {s.factor ? "Numerischer Faktor" : "Passende Antwort"}
              <input
                value={s.scoreKey}
                readOnly={s.factor}
                onChange={(e) => source(i, { ...s, scoreKey: e.target.value })}
              />
            </label>
            <label>
              {metric.method === "availability"
                ? "Gewicht (positiv = vorhanden)"
                : "Punkte / Faktor"}
              <DecimalField
                value={s.weight}
                onChange={(v) => source(i, { ...s, weight: v ?? 0 })}
              />
            </label>
            <label>
              Frequenz mindestens
              <DecimalField
                value={s.minFrequency}
                onChange={(v) => source(i, { ...s, minFrequency: v ?? 0 })}
              />
            </label>
            <label>
              Ketten (kommagetrennt, leer = alle)
              <input
                value={s.chains.join(", ")}
                onChange={(e) =>
                  source(i, {
                    ...s,
                    chains: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <small>
            {s.factor
              ? "Antwortwert × Faktor."
              : "Nur die passende Antwort ergibt einen Beitrag."}{" "}
            Technische ID: {s.questionId || "noch nicht gewählt"}
          </small>
          <button
            onClick={() =>
              onChange({
                ...metric,
                sources: metric.sources.filter((_, j) => j !== i),
              })
            }
          >
            Quelle entfernen
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange({
            ...metric,
            sources: [
              ...metric.sources,
              {
                questionId: "",
                section: "standard",
                label: "",
                scoreKey: "Ja",
                factor: false,
                weight: 1,
                minFrequency: 0,
                chains: [],
                counting: "latest",
              },
            ],
          })
        }
      >
        <Plus size={14} />
        Quelle zuordnen
      </button>
    </fieldset>
  );
}
export function DecimalField({
  value,
  onChange,
  optional = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  optional?: boolean;
}) {
  const [text, setText] = useState(
      value === null ? "" : String(value).replace(".", ","),
    ),
    [focused, setFocused] = useState(false),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!focused)
      setText(value === null ? "" : String(value).replace(".", ","));
  }, [value, focused]);
  return (
    <input
      type="text"
      required={!optional}
      pattern="-?(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+)"
      inputMode="decimal"
      aria-invalid={invalid}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        const next =
          text.trim() === "" && optional
            ? null
            : Number(text.trim().replace(",", "."));
        if (next !== null && !Number.isFinite(next)) {
          setInvalid(true);
          return;
        }
        onChange(next);
        setFocused(false);
      }}
    />
  );
}
