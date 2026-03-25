"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  GripVertical,
  ChevronDown,
  Plus,
  Trash2,
  Import,
  Zap,
  Minus,
  Check,
  Trophy,
} from "lucide-react";

import type { QuestionType, Question, ConditionalRule, Module, ScoringWeight } from "@/types/fragebogen";
import { QUESTION_TYPES, typeLabel, typeBadgeColor, defaultConfig } from "@/utils/fragebogen";

// Teal accent colours
const G = "#0891B2";
const GD = "#0e7490";
const GR = "#155e75";
const G_BG = "rgba(8,145,178,0.06)";
const G_BG_HVR = "rgba(8,145,178,0.12)";
const G_BORDER = "rgba(8,145,178,0.25)";
const G_BORDER_HVR = "rgba(8,145,178,0.4)";

let _bqid = 0;
function nextId(): string {
  _bqid += 1;
  return `bq-${_bqid}-${Date.now()}`;
}

const TRIGGER_ELIGIBLE: QuestionType[] = [
  "single", "yesno", "yesnomulti", "multiple", "likert", "numeric", "slider", "matrix",
];

function operatorsForType(t: QuestionType): { value: string; label: string }[] {
  const base = [
    { value: "equals", label: "ist gleich" },
    { value: "not_equals", label: "ist nicht gleich" },
  ];
  if (t === "numeric" || t === "slider" || t === "likert") {
    return [
      ...base,
      { value: "greater_than", label: "größer als" },
      { value: "less_than", label: "kleiner als" },
      { value: "between", label: "zwischen" },
    ];
  }
  return base;
}

function triggerValueOptions(q: Question): string[] | null {
  switch (q.type) {
    case "yesno": return ["Ja", "Nein"];
    case "yesnomulti": return ((q.config.answers as string[]) || ["Ja", "Nein"]).filter((o) => o.length > 0);
    case "single":
    case "multiple": return ((q.config.options as string[]) || []).filter((o) => o.length > 0);
    case "likert": {
      const min = Number(q.config.min ?? 1);
      const max = Number(q.config.max ?? 5);
      const vals: string[] = [];
      for (let i = min; i <= max; i++) vals.push(String(i));
      return vals;
    }
    case "matrix": {
      const rows = (q.config.rows as string[]) || [];
      const cols = (q.config.columns as string[]) || [];
      const combos: string[] = [];
      rows.forEach((r) => { if (!r) return; cols.forEach((c) => { if (c) combos.push(`${r}: ${c}`); }); });
      return combos.length > 0 ? combos : null;
    }
    default: return null;
  }
}

function newRule(): ConditionalRule {
  return {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    triggerQuestionId: "",
    operator: "equals",
    triggerValue: "",
    triggerValueMax: "",
    action: "hide",
    targetQuestionIds: [],
  };
}

const clFieldLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)",
  width: 80, flexShrink: 0, paddingTop: 1,
};

const clInputBase: React.CSSProperties = {
  width: "100%", fontSize: 11, fontWeight: 500,
  padding: "7px 10px", border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 7, outline: "none", backgroundColor: "#fff",
  transition: "border-color 0.15s ease",
};

function BillaCLDropdown({ value, displayText, options, onChange, placeholder }: {
  value: string; displayText?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = displayText ?? options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ ...clInputBase, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: value ? "#1f2937" : "rgba(0,0,0,0.3)", textAlign: "left" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {label || placeholder || "Auswählen..."}
        </span>
        <ChevronDown size={12} strokeWidth={1.8} color="rgba(0,0,0,0.25)" style={{ flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, backgroundColor: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", padding: "4px", maxHeight: 180, overflowY: "auto" }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: value === opt.value ? 600 : 400, color: value === opt.value ? GD : "#374151", padding: "6px 8px", borderRadius: 5, border: "none", cursor: "pointer", backgroundColor: value === opt.value ? G_BG : "transparent", textAlign: "left", transition: "background-color 0.1s ease" }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = value === opt.value ? G_BG : "transparent"; }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{opt.label}</span>
              {value === opt.value && <Check size={12} strokeWidth={2.5} color={GD} style={{ flexShrink: 0, marginLeft: 6 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BillaConditionalLogicEditor({ rules, onChange, allQuestions, currentIndex }: {
  rules: ConditionalRule[]; onChange: (rules: ConditionalRule[]) => void;
  allQuestions: Question[]; currentIndex: number;
}) {
  const triggerCandidates = allQuestions.slice(0, currentIndex + 1).filter((q) => TRIGGER_ELIGIBLE.includes(q.type));
  const targetCandidates = allQuestions.slice(currentIndex + 1);

  const updateRule = (id: string, patch: Partial<ConditionalRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id));
  const toggleTarget = (ruleId: string, qId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const has = rule.targetQuestionIds.includes(qId);
    updateRule(ruleId, { targetQuestionIds: has ? rule.targetQuestionIds.filter((id) => id !== qId) : [...rule.targetQuestionIds, qId] });
  };

  if (triggerCandidates.length === 0) {
    return (
      <div style={{ padding: "10px 12px", fontSize: 10, color: "rgba(0,0,0,0.3)", fontStyle: "italic", backgroundColor: "rgba(0,0,0,0.015)", borderRadius: 8 }}>
        Diese Frage hat keinen kompatiblen Typ für bedingte Logik.
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.3)", marginBottom: 10, lineHeight: 1.5 }}>
        Definiere Regeln, um Folgefragen basierend auf Antworten anzuzeigen oder zu verstecken.
      </div>
      {rules.map((rule, ri) => {
        const triggerQ = allQuestions.find((q) => q.id === rule.triggerQuestionId);
        const ops = triggerQ ? operatorsForType(triggerQ.type) : operatorsForType("single");
        const valueOpts = triggerQ ? triggerValueOptions(triggerQ) : null;
        const isBetween = rule.operator === "between";
        const triggerOptions = triggerCandidates.map((q) => ({ value: q.id, label: `Frage ${allQuestions.indexOf(q) + 1}: ${q.text || typeLabel(q.type)}` }));
        const operatorOptions = ops.map((op) => ({ value: op.value, label: op.label }));
        const answerOptions = valueOpts ? valueOpts.map((v) => ({ value: v, label: v })) : null;
        const actionOptions = [{ value: "hide", label: "Verstecke Fragen" }, { value: "show", label: "Zeige Fragen" }];
        return (
          <div key={rule.id} style={{ border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, padding: "12px 14px 14px", marginBottom: 8, backgroundColor: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.3)" }}>Regel {ri + 1}</span>
              <button onClick={() => removeRule(rule.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.2)", transition: "color 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = GD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.2)")}>
                <Trash2 size={12} strokeWidth={1.6} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={clFieldLabel}>Wenn Frage</span>
              <BillaCLDropdown value={rule.triggerQuestionId} options={triggerOptions} onChange={(v) => updateRule(rule.id, { triggerQuestionId: v, triggerValue: "", triggerValueMax: "" })} placeholder="Frage wählen..." />
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={clFieldLabel}>Operator</span>
              <BillaCLDropdown value={rule.operator} options={operatorOptions} onChange={(v) => updateRule(rule.id, { operator: v, triggerValue: v === "between" ? "" : rule.triggerValue, triggerValueMax: "" })} />
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={clFieldLabel}>{isBetween ? "Bereich" : "Antwort"}</span>
              {isBetween ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input type="number" value={rule.triggerValue} onChange={(e) => updateRule(rule.id, { triggerValue: e.target.value })} placeholder="Min" onClick={(e) => e.stopPropagation()} style={{ ...clInputBase, color: rule.triggerValue ? "#1f2937" : "rgba(0,0,0,0.3)", flex: 1 }} />
                  <Minus size={12} color="rgba(0,0,0,0.2)" style={{ flexShrink: 0 }} />
                  <input type="number" value={rule.triggerValueMax} onChange={(e) => updateRule(rule.id, { triggerValueMax: e.target.value })} placeholder="Max" onClick={(e) => e.stopPropagation()} style={{ ...clInputBase, color: rule.triggerValueMax ? "#1f2937" : "rgba(0,0,0,0.3)", flex: 1 }} />
                </div>
              ) : answerOptions ? (
                <BillaCLDropdown value={rule.triggerValue} options={answerOptions} onChange={(v) => updateRule(rule.id, { triggerValue: v })} placeholder="Antwort wählen..." />
              ) : (
                <div style={{ flex: 1 }}>
                  <input type="number" value={rule.triggerValue} onChange={(e) => updateRule(rule.id, { triggerValue: e.target.value })} placeholder="Wert eingeben..." onClick={(e) => e.stopPropagation()} style={{ ...clInputBase, color: rule.triggerValue ? "#1f2937" : "rgba(0,0,0,0.3)" }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <span style={clFieldLabel}>Dann</span>
              <BillaCLDropdown value={rule.action} options={actionOptions} onChange={(v) => updateRule(rule.id, { action: v as "hide" | "show" })} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)", display: "block", marginBottom: 6 }}>Betroffene Fragen:</span>
              {targetCandidates.length === 0 ? (
                <div style={{ padding: "8px 10px", fontSize: 10, color: "rgba(0,0,0,0.25)", fontStyle: "italic", backgroundColor: "rgba(0,0,0,0.015)", borderRadius: 7, border: "1px dashed rgba(0,0,0,0.06)" }}>
                  Keine Fragen verfügbar (Fragen müssen nach dieser Frage kommen)
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {targetCandidates.map((tq) => {
                    const tIdx = allQuestions.indexOf(tq);
                    const isSelected = rule.targetQuestionIds.includes(tq.id);
                    return (
                      <button key={tq.id} onClick={() => toggleTarget(rule.id, tq.id)}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 400, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", transition: "background-color 0.12s ease", backgroundColor: isSelected ? G_BG : "transparent", color: "#374151", textAlign: "left", width: "100%" }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? G_BG : "transparent"; }}
                      >
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: isSelected ? "none" : "1.5px solid rgba(0,0,0,0.12)", backgroundColor: isSelected ? GD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s ease" }}>
                          {isSelected && <Check size={10} strokeWidth={3} color="#fff" />}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", flexShrink: 0 }}>F{tIdx + 1}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: isSelected ? "#374151" : "rgba(0,0,0,0.45)" }}>{tq.text || typeLabel(tq.type)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button
        onClick={() => onChange([...rules, newRule()])}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", fontSize: 10, fontWeight: 600, color: GD, backgroundColor: G_BG, border: `1px dashed ${G_BORDER}`, borderRadius: 8, cursor: "pointer", padding: "8px 0", transition: "all 0.15s ease" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = G_BG_HVR; e.currentTarget.style.borderColor = G_BORDER_HVR; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = G_BG; e.currentTarget.style.borderColor = G_BORDER; }}
      >
        <Plus size={11} strokeWidth={2} />
        Regel hinzufügen
      </button>
    </div>
  );
}

function BillaToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ width: 32, height: 18, borderRadius: 9, backgroundColor: value ? GD : "rgba(0,0,0,0.12)", border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s ease", flexShrink: 0 }}
    >
      <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#fff", position: "absolute", top: 2, left: value ? 16 : 2, transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

function BillaChoiceConfig({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" }}>Optionen</span>
      <div style={{ marginTop: 6 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <input
              type="text" value={opt}
              onChange={(e) => { const next = [...options]; next[i] = e.target.value; onChange(next); }}
              placeholder={`Option ${i + 1}`}
              style={{ flex: 1, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" }}
            />
            {options.length > 1 && (
              <button onClick={() => onChange(options.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.25)", transition: "color 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = GD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}>
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => onChange([...options, ""])} style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: GD, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Plus size={10} strokeWidth={2} />
          Option hinzufügen
        </button>
      </div>
    </div>
  );
}

function BillaLikertConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const iStyle = { display: "block", width: "100%", marginTop: 4, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" };
  const lStyle = { fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" };
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Min</span><input type="number" value={String(config.min ?? "")} placeholder="1" onChange={(e) => onChange({ ...config, min: e.target.value === "" ? "" : Number(e.target.value) })} style={iStyle} /></div>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Max</span><input type="number" value={String(config.max ?? "")} placeholder="5" onChange={(e) => onChange({ ...config, max: e.target.value === "" ? "" : Number(e.target.value) })} style={iStyle} /></div>
      <div style={{ flex: "1 1 120px" }}><span style={lStyle}>Min Label</span><input type="text" value={String(config.minLabel ?? "")} onChange={(e) => onChange({ ...config, minLabel: e.target.value })} placeholder="z.B. Sehr schlecht" style={iStyle} /></div>
      <div style={{ flex: "1 1 120px" }}><span style={lStyle}>Max Label</span><input type="text" value={String(config.maxLabel ?? "")} onChange={(e) => onChange({ ...config, maxLabel: e.target.value })} placeholder="z.B. Sehr gut" style={iStyle} /></div>
    </div>
  );
}

function BillaNumericConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const iStyle = { display: "block", width: "100%", marginTop: 4, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" };
  const lStyle = { fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" };
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Min</span><input type="number" value={String(config.min ?? "")} onChange={(e) => onChange({ ...config, min: e.target.value })} placeholder="—" style={iStyle} /></div>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Max</span><input type="number" value={String(config.max ?? "")} onChange={(e) => onChange({ ...config, max: e.target.value })} placeholder="—" style={iStyle} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 4 }}>
        <BillaToggle value={!!config.decimals} onChange={(v) => onChange({ ...config, decimals: v })} />
        <span style={{ fontSize: 10, color: "#6b7280" }}>Dezimal</span>
      </div>
    </div>
  );
}

function BillaSliderConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const iStyle = { display: "block", width: "100%", marginTop: 4, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" };
  const lStyle = { fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" };
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Min</span><input type="number" value={String(config.min ?? "")} placeholder="0" onChange={(e) => onChange({ ...config, min: e.target.value === "" ? "" : Number(e.target.value) })} style={iStyle} /></div>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Max</span><input type="number" value={String(config.max ?? "")} placeholder="100" onChange={(e) => onChange({ ...config, max: e.target.value === "" ? "" : Number(e.target.value) })} style={iStyle} /></div>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Schritt</span><input type="number" value={String(config.step ?? "")} placeholder="1" onChange={(e) => onChange({ ...config, step: e.target.value === "" ? "" : Number(e.target.value) })} style={iStyle} /></div>
      <div style={{ flex: "1 1 60px" }}><span style={lStyle}>Einheit</span><input type="text" value={String(config.unit ?? "")} onChange={(e) => onChange({ ...config, unit: e.target.value })} placeholder="%" style={iStyle} /></div>
    </div>
  );
}

function BillaPhotoConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" }}>Anweisung</span>
      <input type="text" value={String(config.instruction ?? "")} onChange={(e) => onChange({ ...config, instruction: e.target.value })} placeholder="z.B. Foto vom Display aufnehmen" style={{ display: "block", width: "100%", marginTop: 4, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" }} />
    </div>
  );
}

function BillaListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" }}>{label}</span>
      <div style={{ marginTop: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <input type="text" value={item} onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }} placeholder={`${label.slice(0, -1)} ${i + 1}`} style={{ flex: 1, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" }} />
            {items.length > 1 && (
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.25)" }} onMouseEnter={(e) => (e.currentTarget.style.color = GD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}>
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => onChange([...items, ""])} style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: GD, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Plus size={10} strokeWidth={2} />
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

const MATRIX_SUBTYPES = [
  { value: "toggle", label: "Auswahl" },
  { value: "datum", label: "Datum" },
  { value: "freitext", label: "Freitext" },
] as const;

function BillaMatrixConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const rows = (config.rows as string[]) || [""];
  const columns = (config.columns as string[]) || ["", ""];
  const subtype = (config.matrixSubtype as string) || "toggle";
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" }}>Matrix-Typ</span>
        <div style={{ display: "flex", gap: 0, marginTop: 5, background: "rgba(0,0,0,0.04)", borderRadius: 7, padding: 2, width: "fit-content" }}>
          {MATRIX_SUBTYPES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...config, matrixSubtype: opt.value })}
              style={{
                fontSize: 10, fontWeight: 600, padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer",
                background: subtype === opt.value ? "white" : "transparent",
                color: subtype === opt.value ? GD : "rgba(0,0,0,0.35)",
                boxShadow: subtype === opt.value ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        <BillaListEditor label="Zeilen" items={rows} onChange={(r) => onChange({ ...config, rows: r })} />
        <BillaListEditor label="Spalten" items={columns} onChange={(c) => onChange({ ...config, columns: c })} />
      </div>
    </div>
  );
}

function BillaYesNoMultiConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const answers = (config.answers as string[]) || ["Ja", "Nein"];
  type Branch = { answer: string; options: string[] };
  const branches = (config.branches as Branch[]) || [];
  const checkedAnswers = new Set(branches.map((b) => b.answer));

  function toggleBranch(ans: string) {
    if (!ans.trim()) return;
    if (checkedAnswers.has(ans)) {
      onChange({ ...config, branches: branches.filter((b) => b.answer !== ans) });
    } else {
      onChange({ ...config, branches: [...branches, { answer: ans, options: ["", ""] }] });
    }
  }
  function updateBranchOptions(ans: string, opts: string[]) {
    onChange({ ...config, branches: branches.map((b) => b.answer === ans ? { ...b, options: opts } : b) });
  }
  const orderedBranches = answers.map((ans, i) => ({ ans, branchIndex: branches.findIndex((b) => b.answer === ans), ansIndex: i })).filter(({ branchIndex }) => branchIndex !== -1).map(({ ans, branchIndex }) => ({ ans, branch: branches[branchIndex] }));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)", display: "block", marginBottom: 8 }}>Antwortmöglichkeiten</span>
        <div>
          {answers.map((ans, i) => {
            const isChecked = checkedAnswers.has(ans) && ans.length > 0;
            const branchNumber = orderedBranches.findIndex((b) => b.ans === ans) + 1;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <button
                  title={isChecked ? "Entfernt Multi-Auswahl Tray" : "Fügt Multi-Auswahl Tray hinzu"}
                  onClick={() => toggleBranch(ans)}
                  style={{ width: 18, height: 18, borderRadius: 5, border: "none", cursor: ans.length > 0 ? "pointer" : "default", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", ...(isChecked ? { background: `linear-gradient(180deg, ${G}, ${GD})`, boxShadow: `0 1px 3px ${G_BG_HVR}` } : { backgroundColor: "rgba(0,0,0,0.04)" }) }}
                >
                  {isChecked && (branchNumber > 0 ? <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{branchNumber}</span> : <Check size={10} strokeWidth={2.5} color="#fff" />)}
                </button>
                <input
                  type="text" value={ans}
                  onChange={(e) => {
                    const next = [...answers]; const old = next[i]; next[i] = e.target.value;
                    const updatedBranches = branches.map((b) => b.answer === old ? { ...b, answer: e.target.value } : b);
                    onChange({ ...config, answers: next, branches: updatedBranches });
                  }}
                  placeholder={`Antwort ${i + 1}`}
                  style={{ flex: 1, fontSize: 11, padding: "4px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#374151", backgroundColor: "transparent" }}
                />
                {answers.length > 2 && (
                  <button onClick={() => { const next = answers.filter((_, j) => j !== i); const updatedBranches = branches.filter((b) => b.answer !== ans); onChange({ ...config, answers: next, branches: updatedBranches }); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.25)", transition: "color 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = GD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}>
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => onChange({ ...config, answers: [...answers, ""] })} style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: GD, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Plus size={10} strokeWidth={2} />
            Antwort hinzufügen
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 9, color: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: `linear-gradient(180deg, ${G}, ${GD})`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Check size={6} strokeWidth={3} color="#fff" />
          </div>
          = öffnet Multi-Auswahl Tray (mehrere möglich)
        </div>
      </div>
      {orderedBranches.map(({ ans, branch }, idx) => (
        <div key={ans} style={{ marginBottom: 12 }}>
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)", marginBottom: 10 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: `linear-gradient(180deg, ${G}, ${GD})`, boxShadow: `0 1px 3px ${G_BG_HVR}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{idx + 1}</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "rgba(0,0,0,0.35)" }}>
              Optionen wenn „{ans}"
            </span>
          </div>
          <BillaChoiceConfig options={branch.options} onChange={(opts) => updateBranchOptions(ans, opts)} />
        </div>
      ))}
    </div>
  );
}

function BillaTypeConfig({ question, onUpdate }: { question: Question; onUpdate: (q: Question) => void }) {
  const setConfig = (c: Record<string, unknown>) => onUpdate({ ...question, config: c });
  switch (question.type) {
    case "single":
    case "multiple": return <BillaChoiceConfig options={(question.config.options as string[]) || [""]} onChange={(o) => setConfig({ ...question.config, options: o })} />;
    case "yesnomulti": return <BillaYesNoMultiConfig config={question.config} onChange={setConfig} />;
    case "likert": return <BillaLikertConfig config={question.config} onChange={setConfig} />;
    case "numeric": return <BillaNumericConfig config={question.config} onChange={setConfig} />;
    case "slider": return <BillaSliderConfig config={question.config} onChange={setConfig} />;
    case "photo": return <BillaPhotoConfig config={question.config} onChange={setConfig} />;
    case "matrix": return <BillaMatrixConfig config={question.config} onChange={setConfig} />;
    default: return null;
  }
}

// ── Scoring Editor (IPP / Boni) ────────────────────────────────

const BILLA_SCORING_TYPES = new Set(["single", "multiple", "numeric"]);

function BillaScoringEditor({ question, onUpdate }: { question: Question; onUpdate: (q: Question) => void }) {
  const [open, setOpen] = useState(false);
  const scoring = question.scoring ?? {};

  if (!BILLA_SCORING_TYPES.has(question.type)) return null;

  const isChoice = question.type === "single" || question.type === "multiple";
  const options = isChoice ? ((question.config.options as string[]) ?? []) : [];

  const hasIPP = Object.values(scoring).some((w) => w.ipp !== undefined && w.ipp !== null && String(w.ipp) !== "");
  const hasBoni = Object.values(scoring).some((w) => w.boni !== undefined && w.boni !== null && String(w.boni) !== "");

  function setWeight(key: string, field: "ipp" | "boni", raw: string) {
    const num = raw === "" ? undefined : parseFloat(raw);
    const existing: ScoringWeight = scoring[key] ?? {};
    const next: ScoringWeight = { ...existing, [field]: num };
    onUpdate({ ...question, scoring: { ...scoring, [key]: next } });
  }

  const inputStyle: React.CSSProperties = {
    width: 56, fontSize: 11, padding: "3px 6px", border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.09)", outline: "none",
    color: "#374151", backgroundColor: "transparent", fontFamily: "inherit",
    textAlign: "right" as const, MozAppearance: "textfield" as never,
  };

  const labelColStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", width: 60, textAlign: "right" as const,
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 0 6px", fontSize: 11, fontWeight: 600, color: (hasIPP || hasBoni) ? GD : "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.04)" }}
      >
        <Trophy size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>Bewertung</span>
        {hasIPP && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, backgroundColor: G_BG, color: GD }}>IPP</span>}
        {hasBoni && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, backgroundColor: "rgba(234,179,8,0.10)", color: "#a16207" }}>Boni</span>}
        <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
      </button>
      <div style={{ maxHeight: open ? 1200 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
        <div style={{ paddingTop: 8, paddingBottom: 4 }}>
          {isChoice && (
            <>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6, paddingRight: 2 }}>
                <span style={{ flex: 1 }} />
                <span style={labelColStyle}>IPP</span>
                <span style={{ width: 8 }} />
                <span style={labelColStyle}>Boni</span>
              </div>
              {options.map((opt, i) => {
                const key = opt || `__opt_${i}__`;
                const w = scoring[key] ?? {};
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 11, color: opt ? "#374151" : "rgba(0,0,0,0.28)", fontStyle: opt ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt || `Option ${i + 1}`}</span>
                    <input type="number" step="0.1" value={w.ipp !== undefined ? String(w.ipp) : ""} onChange={(e) => setWeight(key, "ipp", e.target.value)} placeholder="–" style={{ ...inputStyle }} onClick={(e) => e.stopPropagation()} />
                    <span style={{ width: 8 }} />
                    <input type="number" step="0.1" value={w.boni !== undefined ? String(w.boni) : ""} onChange={(e) => setWeight(key, "boni", e.target.value)} placeholder="–" style={{ ...inputStyle }} onClick={(e) => e.stopPropagation()} />
                  </div>
                );
              })}
              {options.length === 0 && <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontStyle: "italic" }}>Zuerst Optionen hinzufügen.</span>}
            </>
          )}
          {question.type === "numeric" && (
            <>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginBottom: 10, lineHeight: 1.5 }}>Der eingegebene Zahlenwert wird mit dem Faktor multipliziert.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>IPP Faktor</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Wert ×</span>
                    <input type="number" step="0.1" value={(scoring["__value__"]?.ipp) !== undefined ? String(scoring["__value__"]?.ipp) : ""} onChange={(e) => setWeight("__value__", "ipp", e.target.value)} placeholder="–" style={{ ...inputStyle, width: 70 }} onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>Boni Faktor</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Wert ×</span>
                    <input type="number" step="0.1" value={(scoring["__value__"]?.boni) !== undefined ? String(scoring["__value__"]?.boni) : ""} onChange={(e) => setWeight("__value__", "boni", e.target.value)} placeholder="–" style={{ ...inputStyle, width: 70 }} onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BillaImagePill({ src, index, onRemove }: { src: string; index: number; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const label = `Bild ${index + 1}`;

  return (
    <>
      <div ref={pillRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }} onMouseEnter={() => { if (pillRef.current) setAnchorRect(pillRef.current.getBoundingClientRect()); setHovered(true); }} onMouseLeave={() => setHovered(false)}>
        <div onClick={(e) => { e.stopPropagation(); setLightbox(true); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 6px", borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", cursor: "pointer" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.5)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.25)", lineHeight: 1, transition: "color 0.12s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = GD)} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.25)")}>
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
        {hovered && anchorRect && (
          <div style={{ position: "fixed", left: anchorRect.left, top: anchorRect.top - 8, transform: "translateY(-100%)", zIndex: 9999, pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)", padding: 6, maxWidth: 220 }}>
              <img src={src} alt="preview" style={{ display: "block", maxWidth: 208, maxHeight: 160, borderRadius: 5, objectFit: "contain" }} />
            </div>
          </div>
        )}
      </div>
      {lightbox && (
        <div onClick={(e) => { e.stopPropagation(); setLightbox(false); }} style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", cursor: "default" }}>
            <img src={src} alt="full" style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }} />
            <button onClick={(e) => { e.stopPropagation(); setLightbox(false); }} style={{ position: "absolute", top: -10, right: -10, width: 26, height: 26, borderRadius: "50%", backgroundColor: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
              <X size={13} strokeWidth={2.5} color="#374151" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BillaImageAttachment({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange([...value, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} onClick={(e) => e.stopPropagation()} />
      {value.map((src, i) => <BillaImagePill key={i} src={src} index={i} onRemove={() => onChange(value.filter((_, j) => j !== i))} />)}
      {value.length === 0 ? (
        <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.12s ease" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.6)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          Bild anhängen
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", cursor: "pointer", color: "rgba(0,0,0,0.3)", transition: "background-color 0.12s ease, color 0.12s ease" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.color = "rgba(0,0,0,0.5)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "rgba(0,0,0,0.3)"; }}>
          <Plus size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function BillaQuestionCard({ question, index, isExpanded, onToggle, onUpdate, onDelete, onDragStart, onDragOver, onDrop, dropTarget, allQuestions }: {
  question: Question; index: number; isExpanded: boolean; onToggle: () => void;
  onUpdate: (q: Question) => void; onDelete: () => void;
  onDragStart: (i: number) => void; onDragOver: (i: number) => void;
  onDrop: () => void; dropTarget: boolean; allQuestions: Question[];
}) {
  const badge = typeBadgeColor(question.type);
  const [logicOpen, setLogicOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {dropTarget && <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "#3b82f6", opacity: 0.6, transition: "opacity 0.15s ease" }} />}
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(index); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(); }}
        data-billa-question-card
        style={{ backgroundColor: "#ffffff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 10, overflow: "hidden" }}
      >
        <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 44, cursor: "pointer", userSelect: "none" }}>
          <div draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; const card = e.currentTarget.closest("[data-billa-question-card]") as HTMLElement; if (card) { const clone = card.cloneNode(true) as HTMLElement; clone.style.width = `${card.offsetWidth}px`; clone.style.position = "absolute"; clone.style.top = "-9999px"; clone.style.left = "-9999px"; document.body.appendChild(clone); e.dataTransfer.setDragImage(clone, 20, 22); requestAnimationFrame(() => document.body.removeChild(clone)); } onDragStart(index); }} style={{ cursor: "grab", color: "rgba(0,0,0,0.15)", flexShrink: 0, display: "flex" }} onMouseDown={(e) => e.stopPropagation()}>
            <GripVertical size={14} strokeWidth={1.5} />
          </div>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(to bottom, ${G}, ${GD})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>{index + 1}</span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.02em", flexShrink: 0 }}>{typeLabel(question.type)}</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: question.text ? "#374151" : "rgba(0,0,0,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{question.text || "Frage eingeben..."}</span>
          {question.rules.length > 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: GD, flexShrink: 0 }} />}
          {Object.values(question.scoring || {}).some(w => w.ipp != null || w.boni != null) && (
            <Trophy size={11} strokeWidth={2} color="#a16207" style={{ flexShrink: 0 }} />
          )}
          <ChevronDown size={13} strokeWidth={1.8} color="rgba(0,0,0,0.25)" style={{ flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>

        <div style={{ maxHeight: isExpanded ? 2000 : 0, opacity: isExpanded ? 1 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
          <div style={{ padding: "0 14px 14px" }}>
            <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginBottom: 12 }} />
            <input type="text" value={question.text} onChange={(e) => onUpdate({ ...question, text: e.target.value })} placeholder="Frage eingeben..." onClick={(e) => e.stopPropagation()} style={{ width: "100%", fontSize: 12, fontWeight: 500, padding: "6px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#1a1a1a", backgroundColor: "transparent" }} />
            <BillaImageAttachment value={(question.config.images as string[]) ?? []} onChange={(v) => onUpdate({ ...question, config: { ...question.config, images: v } })} />
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <BillaToggle value={question.required} onChange={(v) => onUpdate({ ...question, required: v })} />
              <span style={{ fontSize: 10, fontWeight: 500, color: "#6b7280" }}>Pflichtfrage</span>
            </div>
            <BillaTypeConfig question={question} onUpdate={onUpdate} />

            <BillaScoringEditor question={question} onUpdate={onUpdate} />

            <div style={{ marginTop: 14 }}>
              <button onClick={(e) => { e.stopPropagation(); setLogicOpen(!logicOpen); }} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 0 6px", fontSize: 11, fontWeight: 600, color: question.rules.length > 0 ? GD : "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                <Zap size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: "left" }}>Bedingte Logik</span>
                {question.rules.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, backgroundColor: G_BG, color: GD }}>{question.rules.length} {question.rules.length === 1 ? "Regel" : "Regeln"}</span>}
                <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, transform: logicOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
              </button>
              <div style={{ maxHeight: logicOpen ? 2000 : 0, opacity: logicOpen ? 1 : 0, overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
                <BillaConditionalLogicEditor rules={question.rules} onChange={(newRules) => onUpdate({ ...question, rules: newRules })} allQuestions={allQuestions} currentIndex={index} />
              </div>
            </div>

            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: GD, background: "none", border: "none", cursor: "pointer", padding: "4px 0", opacity: 0.7, transition: "opacity 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}>
                <Trash2 size={11} strokeWidth={1.8} />
                Frage entfernen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BillaModuleEditorProps {
  onClose: () => void;
  onSave: (m: Module) => void;
  existingModule?: Module;
}

export function BillaModuleEditor({ onClose, onSave, existingModule }: BillaModuleEditorProps) {
  const [moduleName, setModuleName] = useState(existingModule?.name ?? "");
  const [description, setDescription] = useState(existingModule?.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(
    (existingModule?.questions ?? []).map((q) => ({ ...q, scoring: q.scoring ?? {} }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const addQuestion = useCallback((type: QuestionType) => {
    const id = nextId();
    const q: Question = { id, type, text: "", required: true, config: defaultConfig(type), rules: [], scoring: {} };
    setQuestions((prev) => [...prev, q]);
    setExpandedId(id);
    setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, 50);
  }, []);

  const updateQuestion = useCallback((updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setExpandedId((prev) => (prev === id ? null : prev));
  }, []);

  const handleDrop = useCallback(() => {
    if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDropIdx(null); return; }
    setQuestions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      const insertAt = dropIdx > dragIdx ? dropIdx - 1 : dropIdx;
      next.splice(insertAt, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, dropIdx]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "#ffffff", display: "flex", flexDirection: "column", animation: "billaModuleEditorIn 0.3s cubic-bezier(0.4,0,0.2,1) both" }}>
      <style>{`
        @keyframes billaModuleEditorIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      <div style={{ height: 56, borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.08)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)")}>
            <X size={12} strokeWidth={2} color="rgba(0,0,0,0.4)" />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{existingModule ? "Modul bearbeiten" : "Neues Modul"}</span>
        </div>
        <button
          onClick={() => {
            const mod: Module = {
              id: existingModule?.id ?? `bmod-${Date.now()}`,
              name: moduleName || "Unbenanntes Modul",
              description, questions,
              createdAt: existingModule?.createdAt ?? new Date().toISOString(),
              usedInCount: existingModule?.usedInCount ?? 0,
            };
            onSave(mod);
          }}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 18px", fontSize: 11, fontWeight: 600, color: "#ffffff", background: `linear-gradient(to bottom, ${G}, ${GD})`, border: "none", borderRadius: 7, cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${GR}, 0 1px 6px rgba(8,145,178,0.25)` }}
        >
          Speichern
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 220, backgroundColor: "rgba(0,0,0,0.02)", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "20px 12px", flexShrink: 0, overflowY: "auto" }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.35)", padding: "0 6px" }}>Fragentypen</span>
          <div style={{ marginTop: 10 }}>
            {QUESTION_TYPES.map((qt) => {
              const Icon = qt.icon;
              return (
                <button key={qt.key} onClick={() => addQuestion(qt.key)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 36, padding: "0 8px", borderRadius: 7, border: "none", backgroundColor: "transparent", cursor: "pointer", transition: "background-color 0.15s ease", marginBottom: 1 }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <Icon size={14} strokeWidth={1.5} color="rgba(0,0,0,0.35)" />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>{qt.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", margin: "12px 6px" }} />
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", fontSize: 11, fontWeight: 500, color: GD, background: "none", border: "none", cursor: "pointer" }}>
            <Import size={13} strokeWidth={1.5} />
            Frage importieren
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
            <input type="text" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Modulname eingeben..." style={{ width: "100%", fontSize: 14, fontWeight: 600, padding: "6px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", color: "#1a1a1a", backgroundColor: "transparent", letterSpacing: "-0.01em" }} />
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionale Beschreibung..." style={{ width: "100%", fontSize: 12, fontWeight: 400, padding: "6px 0", marginTop: 4, border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", outline: "none", color: "#6b7280", backgroundColor: "transparent" }} />
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)", marginTop: 16 }} />
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "16px 28px 28px", scrollbarWidth: "none", msOverflowStyle: "none" }} onDragOver={(e) => e.preventDefault()}>
            {questions.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: G_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={20} strokeWidth={1.4} color={G} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.25)" }}>Fragentyp links auswählen um zu starten</span>
              </div>
            )}
            {questions.map((q, i) => (
              <BillaQuestionCard
                key={q.id} question={q} index={i}
                isExpanded={expandedId === q.id}
                onToggle={() => setExpandedId((prev) => (prev === q.id ? null : q.id))}
                onUpdate={updateQuestion}
                onDelete={() => deleteQuestion(q.id)}
                onDragStart={setDragIdx}
                onDragOver={setDropIdx}
                onDrop={handleDrop}
                dropTarget={dropIdx === i && dragIdx !== null && dragIdx !== i}
                allQuestions={questions}
              />
            ))}
            {questions.length > 0 && dragIdx !== null && (
              <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIdx(questions.length); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(); }} style={{ minHeight: 40, position: "relative" }}>
                {dropIdx === questions.length && dragIdx !== questions.length - 1 && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "#3b82f6", opacity: 0.6 }} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
