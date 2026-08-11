"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Grid3x3,
  GripVertical,
  Hash,
  Import,
  ListChecks,
  Minus,
  Plus,
  SlidersHorizontal,
  Star,
  ToggleLeft,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import type {
  SmConditionalRule,
  SmModule,
  SmOosConfig,
  SmQuestion,
  SmQuestionType,
} from "@/components/admin/sm/SmFragebogenWorkspace";

const QUESTION_TYPES: Array<{
  key: SmQuestionType;
  label: string;
  icon: typeof CircleDot;
}> = [
  { key: "single", label: "Single Choice", icon: CircleDot },
  { key: "yesno", label: "Ja / Nein", icon: ToggleLeft },
  { key: "yesnomulti", label: "Ja / Nein Multi", icon: ListChecks },
  { key: "multiple", label: "Multiple Choice", icon: CheckSquare },
  { key: "likert", label: "Likert Skala", icon: Star },
  { key: "text", label: "Offener Text", icon: AlignLeft },
  { key: "numeric", label: "Offene Zahl", icon: Hash },
  { key: "slider", label: "Slider", icon: SlidersHorizontal },
  { key: "photo", label: "Foto Upload", icon: Camera },
  { key: "matrix", label: "Matrix", icon: Grid3x3 },
];

let questionId = 0;

function nextId(): string {
  questionId += 1;
  return `sm-q-${questionId}-${Date.now()}`;
}

function typeLabel(type: SmQuestionType): string {
  return QUESTION_TYPES.find((item) => item.key === type)?.label ?? type;
}

function typeBadgeColor(type: SmQuestionType): { bg: string; text: string } {
  switch (type) {
    case "single":
      return { bg: "rgba(220,38,38,0.07)", text: "#DC2626" };
    case "yesno":
      return { bg: "rgba(5,150,105,0.07)", text: "#059669" };
    case "yesnomulti":
      return { bg: "rgba(13,148,136,0.07)", text: "#0d9488" };
    case "multiple":
      return { bg: "rgba(59,130,246,0.07)", text: "#2563eb" };
    case "likert":
      return { bg: "rgba(234,179,8,0.08)", text: "#a16207" };
    case "text":
      return { bg: "rgba(107,114,128,0.07)", text: "#4b5563" };
    case "numeric":
      return { bg: "rgba(139,92,246,0.07)", text: "#7c3aed" };
    case "slider":
      return { bg: "rgba(236,72,153,0.07)", text: "#db2777" };
    case "photo":
      return { bg: "rgba(14,165,233,0.07)", text: "#0284c7" };
    case "matrix":
      return { bg: "rgba(194,65,12,0.07)", text: "#c2410c" };
  }
}

function defaultConfig(type: SmQuestionType): Record<string, unknown> {
  switch (type) {
    case "single":
    case "multiple":
      return { options: ["", ""] };
    case "yesnomulti":
      return { answers: ["Ja", "Nein"] };
    case "likert":
      return { min: "", max: "", minLabel: "", maxLabel: "" };
    case "numeric":
      return { min: "", max: "", decimals: false };
    case "slider":
      return { min: "", max: "", step: "", unit: "" };
    case "photo":
      return { instruction: "", images: [] };
    case "matrix":
      return { rows: [""], columns: ["", ""] };
    default:
      return {};
  }
}

function createQuestion(type: SmQuestionType): SmQuestion {
  const config = defaultConfig(type);
  const options = type === "yesno"
    ? ["Ja", "Nein"]
    : type === "yesnomulti"
      ? ["Ja", "Nein"]
      : ((config.options as string[] | undefined) ?? []);

  return {
    id: nextId(),
    type,
    text: "",
    required: true,
    options,
    config,
    rules: [],
  };
}

function cloneQuestion(source: SmQuestion): SmQuestion {
  return {
    ...structuredClone(source),
    id: nextId(),
    rules: source.rules ?? [],
  };
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        backgroundColor: value ? "var(--module-accent, #DC2626)" : "rgba(0,0,0,0.12)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background-color 0.2s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          backgroundColor: "#fff",
          position: "absolute",
          top: 2,
          left: value ? 16 : 2,
          transition: "left 0.2s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

const SM_TRIGGER_ELIGIBLE: SmQuestionType[] = [
  "single",
  "yesno",
  "yesnomulti",
  "multiple",
  "likert",
  "numeric",
  "slider",
  "matrix",
];

const smLogicFieldLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "rgba(0,0,0,0.4)",
  width: 80,
  flexShrink: 0,
  paddingTop: 1,
};

const smLogicInputBase: CSSProperties = {
  width: "100%",
  fontSize: 11,
  fontWeight: 500,
  padding: "7px 10px",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 7,
  outline: "none",
  backgroundColor: "#fff",
  transition: "border-color 0.15s ease",
};

function smOperatorsForType(type: SmQuestionType): Array<{ value: string; label: string }> {
  const base = [
    { value: "equals", label: "ist gleich" },
    { value: "not_equals", label: "ist nicht gleich" },
  ];
  if (type === "numeric" || type === "slider" || type === "likert") {
    return [
      ...base,
      { value: "greater_than", label: "größer als" },
      { value: "less_than", label: "kleiner als" },
      { value: "between", label: "zwischen" },
    ];
  }
  return base;
}

function smQuestionOptions(question: SmQuestion): string[] | null {
  switch (question.type) {
    case "yesno":
      return ["Ja", "Nein"];
    case "yesnomulti":
      return ((question.config.answers as string[]) ?? ["Ja", "Nein"]).filter((option) => option.length > 0);
    case "single":
    case "multiple":
      return ((question.config.options as string[]) ?? []).filter((option) => option.length > 0);
    case "likert": {
      const min = Number(question.config.min ?? 1);
      const max = Number(question.config.max ?? 5);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
      const values: string[] = [];
      for (let value = min; value <= max; value += 1) values.push(String(value));
      return values;
    }
    case "matrix": {
      const rows = (question.config.rows as string[]) ?? [];
      const columns = (question.config.columns as string[]) ?? [];
      const values: string[] = [];
      rows.forEach((row) => {
        if (!row) return;
        columns.forEach((column) => {
          if (column) values.push(`${row}: ${column}`);
        });
      });
      return values.length > 0 ? values : null;
    }
    default:
      return null;
  }
}

function newSmRule(): SmConditionalRule {
  return {
    id: `sm-rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    triggerQuestionId: "",
    operator: "equals",
    triggerValue: "",
    triggerValueMax: "",
    action: "hide",
    targetQuestionIds: [],
  };
}

function SmLogicDropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  const updateMenuPosition = useCallback(() => {
    const trigger = ref.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(180, options.length * 34 + 8);
    const roomBelow = window.innerHeight - rect.bottom;
    const openAbove = roomBelow < estimatedHeight + 8 && rect.top > estimatedHeight + 8;
    const width = rect.width;

    setMenuPosition({
      top: openAbove ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const reposition = () => updateMenuPosition();

    updateMenuPosition();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updateMenuPosition]);

  const label = options.find((option) => option.value === value)?.label;

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!open) updateMenuPosition();
          setOpen((current) => !current);
        }}
        style={{
          ...smLogicInputBase,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: value || label ? "#1f2937" : "rgba(0,0,0,0.3)",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label || placeholder || "Auswählen..."}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.8}
          color="rgba(0,0,0,0.25)"
          style={{ flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }}
        />
      </button>

      {open && menuPosition.width > 0 ? createPortal(
        <div
          ref={menuRef}
          className="sm-logic-dropdown"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 15050,
            maxHeight: 180,
            padding: 4,
            overflowY: "auto",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 8,
            backgroundColor: "#fff",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <button
                type="button"
                key={`${option.value}-${option.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  border: "none",
                  borderRadius: 5,
                  backgroundColor: selected ? "rgba(var(--module-accent-rgb,220,38,38),0.04)" : "transparent",
                  color: selected ? "var(--module-accent,#DC2626)" : "#374151",
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: selected ? 600 : 400,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(event) => {
                  if (!selected) event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.025)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = selected ? "rgba(var(--module-accent-rgb,220,38,38),0.04)" : "transparent";
                }}
              >
                <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{option.label}</span>
                {selected ? <Check size={12} strokeWidth={2.5} color="var(--module-accent,#DC2626)" style={{ flexShrink: 0, marginLeft: 6 }} /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function SmConditionalLogicEditor({
  rules,
  onChange,
  allQuestions,
  currentIndex,
}: {
  rules: SmConditionalRule[];
  onChange: (rules: SmConditionalRule[]) => void;
  allQuestions: SmQuestion[];
  currentIndex: number;
}) {
  const triggerCandidates = allQuestions
    .slice(0, currentIndex + 1)
    .filter((question) => SM_TRIGGER_ELIGIBLE.includes(question.type));
  const targetCandidates = allQuestions.slice(currentIndex + 1);

  const updateRule = (id: string, patch: Partial<SmConditionalRule>) => {
    onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const toggleTarget = (ruleId: string, questionId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    updateRule(ruleId, {
      targetQuestionIds: rule.targetQuestionIds.includes(questionId)
        ? rule.targetQuestionIds.filter((id) => id !== questionId)
        : [...rule.targetQuestionIds, questionId],
    });
  };

  if (triggerCandidates.length === 0) {
    return (
      <div style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.015)", color: "rgba(0,0,0,0.3)", fontSize: 10, fontStyle: "italic" }}>
        Diese Frage hat keinen kompatiblen Typ für bedingte Logik.
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ marginBottom: 10, color: "rgba(0,0,0,0.3)", fontSize: 10, lineHeight: 1.5 }}>
        Definiere Regeln, um Folgefragen basierend auf Antworten anzuzeigen oder zu verstecken.
      </div>

      {rules.map((rule, ruleIndex) => {
        const triggerQuestion = allQuestions.find((question) => question.id === rule.triggerQuestionId);
        const operators = smOperatorsForType(triggerQuestion?.type ?? "single");
        const answerValues = triggerQuestion ? smQuestionOptions(triggerQuestion) : null;
        const isBetween = rule.operator === "between";

        return (
          <div key={rule.id} style={{ marginBottom: 8, padding: "12px 14px 14px", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, backgroundColor: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Regel {ruleIndex + 1}</span>
              <button
                type="button"
                aria-label={`Regel ${ruleIndex + 1} entfernen`}
                onClick={() => onChange(rules.filter((candidate) => candidate.id !== rule.id))}
                style={{ padding: 2, border: "none", background: "none", color: "rgba(0,0,0,0.2)", cursor: "pointer", transition: "color 0.15s ease" }}
                onMouseEnter={(event) => { event.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,0.2)"; }}
              >
                <Trash2 size={12} strokeWidth={1.6} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={smLogicFieldLabel}>Wenn Frage</span>
              <SmLogicDropdown
                value={rule.triggerQuestionId}
                options={triggerCandidates.map((question) => ({
                  value: question.id,
                  label: `Frage ${allQuestions.indexOf(question) + 1}: ${question.text || typeLabel(question.type)}`,
                }))}
                onChange={(value) => updateRule(rule.id, { triggerQuestionId: value, triggerValue: "", triggerValueMax: "" })}
                placeholder="Frage wählen..."
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={smLogicFieldLabel}>Operator</span>
              <SmLogicDropdown
                value={rule.operator}
                options={operators}
                onChange={(value) => updateRule(rule.id, { operator: value, triggerValue: value === "between" ? "" : rule.triggerValue, triggerValueMax: "" })}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={smLogicFieldLabel}>{isBetween ? "Bereich" : "Antwort"}</span>
              {isBetween ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    value={rule.triggerValue}
                    onChange={(event) => updateRule(rule.id, { triggerValue: event.target.value })}
                    placeholder="Min"
                    onClick={(event) => event.stopPropagation()}
                    style={{ ...smLogicInputBase, flex: 1, color: rule.triggerValue ? "#1f2937" : "rgba(0,0,0,0.3)", fontFamily: "inherit" }}
                  />
                  <Minus size={12} color="rgba(0,0,0,0.2)" style={{ flexShrink: 0 }} />
                  <input
                    type="number"
                    value={rule.triggerValueMax}
                    onChange={(event) => updateRule(rule.id, { triggerValueMax: event.target.value })}
                    placeholder="Max"
                    onClick={(event) => event.stopPropagation()}
                    style={{ ...smLogicInputBase, flex: 1, color: rule.triggerValueMax ? "#1f2937" : "rgba(0,0,0,0.3)", fontFamily: "inherit" }}
                  />
                </div>
              ) : answerValues ? (
                <SmLogicDropdown
                  value={rule.triggerValue}
                  options={answerValues.map((answer) => ({ value: answer, label: answer }))}
                  onChange={(value) => updateRule(rule.id, { triggerValue: value })}
                  placeholder="Antwort wählen..."
                />
              ) : (
                <input
                  type="number"
                  value={rule.triggerValue}
                  onChange={(event) => updateRule(rule.id, { triggerValue: event.target.value })}
                  placeholder="Wert eingeben..."
                  onClick={(event) => event.stopPropagation()}
                  style={{ ...smLogicInputBase, flex: 1, color: rule.triggerValue ? "#1f2937" : "rgba(0,0,0,0.3)", fontFamily: "inherit" }}
                />
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <span style={smLogicFieldLabel}>Dann</span>
              <SmLogicDropdown
                value={rule.action}
                options={[{ value: "hide", label: "Verstecke Fragen" }, { value: "show", label: "Zeige Fragen" }]}
                onChange={(value) => updateRule(rule.id, { action: value as "hide" | "show" })}
              />
            </div>

            <div>
              <span style={{ display: "block", marginBottom: 6, color: "rgba(0,0,0,0.4)", fontSize: 10, fontWeight: 600 }}>Betroffene Fragen:</span>
              {targetCandidates.length === 0 ? (
                <div style={{ padding: "8px 10px", border: "1px dashed rgba(0,0,0,0.06)", borderRadius: 7, backgroundColor: "rgba(0,0,0,0.015)", color: "rgba(0,0,0,0.25)", fontSize: 10, fontStyle: "italic" }}>
                  Keine Fragen verfügbar (Fragen müssen nach dieser Frage kommen)
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {targetCandidates.map((target) => {
                    const selected = rule.targetQuestionIds.includes(target.id);
                    return (
                      <button
                        type="button"
                        key={target.id}
                        onClick={() => toggleTarget(rule.id, target.id)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "none", borderRadius: 6, backgroundColor: selected ? "rgba(var(--module-accent-rgb,220,38,38),0.03)" : "transparent", color: "#374151", fontFamily: "inherit", fontSize: 11, fontWeight: 400, textAlign: "left", cursor: "pointer", transition: "background-color 0.12s ease" }}
                        onMouseEnter={(event) => { if (!selected) event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"; }}
                        onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = selected ? "rgba(var(--module-accent-rgb,220,38,38),0.03)" : "transparent"; }}
                      >
                        <span style={{ width: 16, height: 16, borderRadius: 4, border: selected ? "none" : "1.5px solid rgba(0,0,0,0.12)", backgroundColor: selected ? "var(--module-accent,#DC2626)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s ease" }}>
                          {selected ? <Check size={10} strokeWidth={3} color="#fff" /> : null}
                        </span>
                        <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>F{allQuestions.indexOf(target) + 1}</span>
                        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#374151" : "rgba(0,0,0,0.45)" }}>{target.text || typeLabel(target.type)}</span>
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
        type="button"
        onClick={() => onChange([...rules, newSmRule()])}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", border: "1px dashed rgba(var(--module-accent-rgb,220,38,38),0.15)", borderRadius: 8, backgroundColor: "rgba(var(--module-accent-rgb,220,38,38),0.03)", color: "var(--module-accent,#DC2626)", fontFamily: "inherit", fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" }}
        onMouseEnter={(event) => {
          event.currentTarget.style.backgroundColor = "rgba(var(--module-accent-rgb,220,38,38),0.06)";
          event.currentTarget.style.borderColor = "rgba(var(--module-accent-rgb,220,38,38),0.25)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.backgroundColor = "rgba(var(--module-accent-rgb,220,38,38),0.03)";
          event.currentTarget.style.borderColor = "rgba(var(--module-accent-rgb,220,38,38),0.15)";
        }}
      >
        <Plus size={11} strokeWidth={2} />
        Regel hinzufügen
      </button>
    </div>
  );
}

function SmOosQuestionEditor({
  question,
  onUpdate,
}: {
  question: SmQuestion;
  onUpdate: (question: SmQuestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = smQuestionOptions(question) ?? [];
  const supportsOos = question.type === "yesno" || question.type === "yesnomulti" || question.type === "single";
  const config = question.oos ?? {};
  const configuredCount = Number(Boolean(config.behobenAnswer)) + Number(Boolean(config.nichtBehobenAnswer));

  if (!supportsOos) return null;

  const answerOptions = [
    { value: "", label: "Nicht zugeordnet" },
    ...options.map((option) => ({ value: option, label: option })),
  ];

  const setOutcome = (field: keyof SmOosConfig, answer: string) => {
    const otherField: keyof SmOosConfig = field === "behobenAnswer" ? "nichtBehobenAnswer" : "behobenAnswer";
    const next: SmOosConfig = {
      ...config,
      [field]: answer || undefined,
      ...(answer && config[otherField] === answer ? { [otherField]: undefined } : {}),
    };
    const hasValue = Boolean(next.behobenAnswer || next.nichtBehobenAnswer);
    onUpdate({ ...question, oos: hasValue ? next : undefined });
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "8px 0 6px", border: "none", borderTop: "1px solid rgba(0,0,0,0.04)", background: "none", color: configuredCount > 0 ? "var(--module-accent,#DC2626)" : "rgba(0,0,0,0.35)", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
      >
        <CircleAlert size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>OOS Frage</span>
        {configuredCount > 0 ? (
          <span style={{ padding: "1px 7px", borderRadius: 10, backgroundColor: "rgba(var(--module-accent-rgb,220,38,38),0.08)", color: "var(--module-accent,#DC2626)", fontSize: 9, fontWeight: 700 }}>{configuredCount}/2</span>
        ) : null}
        <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
      </button>

      <div style={{ maxHeight: open ? 240 : 0, opacity: open ? 1 : 0, overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
        <div style={{ paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ marginBottom: 10, color: "rgba(0,0,0,0.3)", fontSize: 10, lineHeight: 1.5 }}>
            Ordne den beiden OOS-Ergebnissen die passende Antwort dieser Frage zu.
          </div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <span style={smLogicFieldLabel}>OOS behoben</span>
            <SmLogicDropdown value={config.behobenAnswer ?? ""} options={answerOptions} onChange={(answer) => setOutcome("behobenAnswer", answer)} />
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={smLogicFieldLabel}>OOS nicht behoben</span>
            <SmLogicDropdown value={config.nichtBehobenAnswer ?? ""} options={answerOptions} onChange={(answer) => setOutcome("nichtBehobenAnswer", answer)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceConfig({
  options,
  label = "Optionen",
  onChange,
}: {
  options: string[];
  label?: string;
  onChange: (options: string[]) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "rgba(0,0,0,0.35)",
        }}
      >
        {label}
      </span>
      <div style={{ marginTop: 6 }}>
        {options.map((option, index) => (
          <div
            key={index}
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
          >
            <input
              type="text"
              value={option}
              onChange={(event) => {
                const next = [...options];
                next[index] = event.target.value;
                onChange(next);
              }}
              placeholder={`Option ${index + 1}`}
              style={{
                flex: 1,
                fontFamily: "inherit",
                fontSize: 11,
                padding: "4px 0",
                border: "none",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                outline: "none",
                color: "#374151",
                backgroundColor: "transparent",
              }}
            />
            {options.length > 1 ? (
              <button
                type="button"
                aria-label={`Option ${index + 1} entfernen`}
                onClick={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  color: "rgba(0,0,0,0.25)",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(event) => { event.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,0.25)"; }}
              >
                <X size={11} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...options, ""])}
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "inherit",
            fontSize: 10,
            fontWeight: 500,
            color: "var(--module-accent, #DC2626)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Plus size={10} strokeWidth={2} />
          Option hinzufügen
        </button>
      </div>
    </div>
  );
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "rgba(0,0,0,0.35)",
};

const fieldInputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "4px 0",
  border: "none",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  outline: "none",
  color: "#374151",
  backgroundColor: "transparent",
  fontFamily: "inherit",
  fontSize: 11,
};

function LikertConfig({ config, onChange }: ConfigProps) {
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 60px" }}>
        <span style={fieldLabelStyle}>Min</span>
        <input type="number" value={String(config.min ?? "")} placeholder="1" onChange={(event) => onChange({ ...config, min: event.target.value === "" ? "" : Number(event.target.value) })} style={fieldInputStyle} />
      </div>
      <div style={{ flex: "1 1 60px" }}>
        <span style={fieldLabelStyle}>Max</span>
        <input type="number" value={String(config.max ?? "")} placeholder="5" onChange={(event) => onChange({ ...config, max: event.target.value === "" ? "" : Number(event.target.value) })} style={fieldInputStyle} />
      </div>
      <div style={{ flex: "1 1 120px" }}>
        <span style={fieldLabelStyle}>Min Label</span>
        <input value={String(config.minLabel ?? "")} placeholder="z.B. Sehr schlecht" onChange={(event) => onChange({ ...config, minLabel: event.target.value })} style={fieldInputStyle} />
      </div>
      <div style={{ flex: "1 1 120px" }}>
        <span style={fieldLabelStyle}>Max Label</span>
        <input value={String(config.maxLabel ?? "")} placeholder="z.B. Sehr gut" onChange={(event) => onChange({ ...config, maxLabel: event.target.value })} style={fieldInputStyle} />
      </div>
    </div>
  );
}

type ConfigProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

function NumericConfig({ config, onChange }: ConfigProps) {
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 60px" }}>
        <span style={fieldLabelStyle}>Min</span>
        <input type="number" value={String(config.min ?? "")} placeholder="—" onChange={(event) => onChange({ ...config, min: event.target.value })} style={fieldInputStyle} />
      </div>
      <div style={{ flex: "1 1 60px" }}>
        <span style={fieldLabelStyle}>Max</span>
        <input type="number" value={String(config.max ?? "")} placeholder="—" onChange={(event) => onChange({ ...config, max: event.target.value })} style={fieldInputStyle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 4 }}>
        <Toggle value={Boolean(config.decimals)} onChange={(value) => onChange({ ...config, decimals: value })} />
        <span style={{ fontSize: 10, color: "#6b7280" }}>Dezimal</span>
      </div>
    </div>
  );
}

function SliderConfig({ config, onChange }: ConfigProps) {
  const fields: Array<{ key: "min" | "max" | "step" | "unit"; label: string; placeholder: string; type: "number" | "text" }> = [
    { key: "min", label: "Min", placeholder: "0", type: "number" },
    { key: "max", label: "Max", placeholder: "100", type: "number" },
    { key: "step", label: "Schritt", placeholder: "1", type: "number" },
    { key: "unit", label: "Einheit", placeholder: "%", type: "text" },
  ];
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
      {fields.map((field) => (
        <div key={field.key} style={{ flex: "1 1 60px" }}>
          <span style={fieldLabelStyle}>{field.label}</span>
          <input
            type={field.type}
            value={String(config[field.key] ?? "")}
            placeholder={field.placeholder}
            onChange={(event) => onChange({ ...config, [field.key]: event.target.value })}
            style={fieldInputStyle}
          />
        </div>
      ))}
    </div>
  );
}

function MatrixList({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={fieldLabelStyle}>{label}</span>
      <div style={{ marginTop: 6 }}>
        {values.map((value, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <input
              value={value}
              onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
              placeholder={`${label.slice(0, -1)} ${index + 1}`}
              style={{ ...fieldInputStyle, flex: 1, marginTop: 0 }}
            />
            {values.length > 1 ? (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(0,0,0,0.25)", transition: "color .15s ease" }}
                onMouseEnter={(event) => { event.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,0.25)"; }}
              >
                <X size={11} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={() => onChange([...values, ""])} style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "none", color: "var(--module-accent, #DC2626)", fontFamily: "inherit", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>
          <Plus size={10} strokeWidth={2} />
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

function MatrixConfig({ config, onChange }: ConfigProps) {
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
      <MatrixList label="Zeilen" values={(config.rows as string[]) ?? [""]} onChange={(rows) => onChange({ ...config, rows })} />
      <MatrixList label="Spalten" values={(config.columns as string[]) ?? ["", ""]} onChange={(columns) => onChange({ ...config, columns })} />
    </div>
  );
}

function PhotoConfig({ config, onChange }: ConfigProps) {
  return (
    <div style={{ marginTop: 10 }}>
      <span style={fieldLabelStyle}>Anweisung (optional)</span>
      <input
        value={String(config.instruction ?? "")}
        onChange={(event) => onChange({ ...config, instruction: event.target.value })}
        placeholder="Was soll fotografiert werden?"
        style={fieldInputStyle}
      />
    </div>
  );
}

function TypeConfig({ question, onUpdate }: { question: SmQuestion; onUpdate: (question: SmQuestion) => void }) {
  const setConfig = (config: Record<string, unknown>) => {
    const options = question.type === "single" || question.type === "multiple"
      ? ((config.options as string[]) ?? [])
      : question.type === "yesnomulti"
        ? ((config.answers as string[]) ?? [])
        : question.options;
    onUpdate({ ...question, config, options });
  };

  switch (question.type) {
    case "single":
    case "multiple":
      return <ChoiceConfig options={(question.config.options as string[]) ?? [""]} onChange={(options) => setConfig({ ...question.config, options })} />;
    case "yesnomulti":
      return <ChoiceConfig label="Antwortmöglichkeiten" options={(question.config.answers as string[]) ?? ["Ja", "Nein"]} onChange={(answers) => setConfig({ ...question.config, answers })} />;
    case "likert":
      return <LikertConfig config={question.config} onChange={setConfig} />;
    case "numeric":
      return <NumericConfig config={question.config} onChange={setConfig} />;
    case "slider":
      return <SliderConfig config={question.config} onChange={setConfig} />;
    case "photo":
      return <PhotoConfig config={question.config} onChange={setConfig} />;
    case "matrix":
      return <MatrixConfig config={question.config} onChange={setConfig} />;
    default:
      return null;
  }
}

function ImagePill({ src, index, onRemove }: { src: string; index: number; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (pillRef.current) setAnchorRect(pillRef.current.getBoundingClientRect());
    setHovered(true);
  }

  return (
    <>
      <div
        ref={pillRef}
        style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          onClick={(event) => { event.stopPropagation(); setLightbox(true); }}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 6px", borderRadius: 5, backgroundColor: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", cursor: "pointer" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.5)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bild {index + 1}</span>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRemove(); }}
            style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.25)", lineHeight: 1, transition: "color 0.12s ease" }}
            onMouseEnter={(event) => { event.currentTarget.style.color = "#DC2626"; }}
            onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,0.25)"; }}
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>

        {hovered && anchorRect ? (
          <div style={{ position: "fixed", left: anchorRect.left, top: anchorRect.top - 8, transform: "translateY(-100%)", zIndex: 9999, pointerEvents: "none" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)", padding: 6, maxWidth: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="preview" style={{ display: "block", maxWidth: 208, maxHeight: 160, borderRadius: 5, objectFit: "contain" }} />
            </div>
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <div onClick={(event) => { event.stopPropagation(); setLightbox(false); }} style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", cursor: "default" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="full" style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }} />
            <button type="button" onClick={(event) => { event.stopPropagation(); setLightbox(false); }} style={{ position: "absolute", top: -10, right: -10, width: 26, height: 26, borderRadius: "50%", backgroundColor: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
              <X size={13} strokeWidth={2.5} color="#374151" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ImageAttachment({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => onChange([...value, loadEvent.target?.result as string]);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} onClick={(event) => event.stopPropagation()} />
      {value.map((src, index) => <ImagePill key={index} src={src} index={index} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} />)}
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}
        style={value.length === 0 ? {
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          border: "none",
          background: "none",
          color: "rgba(0,0,0,0.35)",
          fontFamily: "inherit",
          fontSize: 10,
          fontWeight: 500,
          cursor: "pointer",
          transition: "color .12s ease",
        } : {
          width: 22,
          height: 22,
          borderRadius: 5,
          border: "1px solid rgba(0,0,0,0.07)",
          backgroundColor: "rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "background-color .12s ease,color .12s ease",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.color = "rgba(0,0,0,0.6)";
          if (value.length > 0) event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.07)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.color = value.length === 0 ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.3)";
          if (value.length > 0) event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)";
        }}
      >
        {value.length === 0 ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Bild anhängen
          </>
        ) : <Plus size={10} strokeWidth={2.5} />}
      </button>
    </div>
  );
}

function QuestionCard({
  question,
  allQuestions,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onContextTypeMenu,
  dropTarget,
}: {
  question: SmQuestion;
  allQuestions: SmQuestion[];
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (question: SmQuestion) => void;
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  onContextTypeMenu: (questionId: string, x: number, y: number) => void;
  dropTarget: boolean;
}) {
  const badge = typeBadgeColor(question.type);
  const [logicOpen, setLogicOpen] = useState(false);
  const rules = question.rules ?? [];

  return (
    <div style={{ position: "relative" }}>
      {dropTarget ? (
        <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "#3b82f6", opacity: 0.6, transition: "opacity .15s ease" }} />
      ) : null}
      <div
        data-sm-question-card
        onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); onDragOver(index); }}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); onDrop(); }}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContextTypeMenu(question.id, event.clientX, event.clientY); }}
        style={{
          backgroundColor: "#fff",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.06)",
          marginBottom: 10,
          overflow: "hidden",
          transition: "box-shadow .15s ease",
        }}
      >
        <div onClick={onToggle} style={{ height: 44, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <div
            draggable
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              onDragStart(index);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            style={{ display: "flex", color: "rgba(0,0,0,0.15)", cursor: "grab", flexShrink: 0 }}
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </div>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(to bottom,var(--module-accent,#DC2626),var(--module-accent-light,#e84040))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>{index + 1}</span>
          </div>
          <span style={{ padding: "2px 8px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", flexShrink: 0 }}>
            {typeLabel(question.type)}
          </span>
          <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: question.text ? "#374151" : "rgba(0,0,0,0.25)", fontSize: 11, fontWeight: 500 }}>
            {question.text || "Frage eingeben..."}
          </span>
          <ChevronDown size={13} strokeWidth={1.8} color="rgba(0,0,0,0.25)" style={{ flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s cubic-bezier(.4,0,.2,1)" }} />
        </div>

        <div style={{ maxHeight: isExpanded ? 2000 : 0, opacity: isExpanded ? 1 : 0, overflow: "hidden", transition: "max-height .25s cubic-bezier(.4,0,.2,1),opacity .2s ease" }}>
          <div style={{ padding: "0 14px 14px" }}>
            <div style={{ height: 1, marginBottom: 12, backgroundColor: "rgba(0,0,0,0.06)" }} />
            <input
              type="text"
              value={question.text}
              onChange={(event) => onUpdate({ ...question, text: event.target.value })}
              placeholder="Frage eingeben..."
              onClick={(event) => event.stopPropagation()}
              style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)", outline: "none", backgroundColor: "transparent", color: "#1a1a1a", fontFamily: "inherit", fontSize: 12, fontWeight: 500 }}
            />
            <ImageAttachment value={(question.config.images as string[]) ?? []} onChange={(images) => onUpdate({ ...question, config: { ...question.config, images } })} />
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle value={question.required} onChange={(required) => onUpdate({ ...question, required })} />
              <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 500 }}>Pflichtfrage</span>
            </div>
            <TypeConfig question={question} onUpdate={onUpdate} />
            <SmOosQuestionEditor question={question} onUpdate={onUpdate} />

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLogicOpen((current) => !current);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: "100%",
                  padding: "8px 0 6px",
                  border: "none",
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  background: "none",
                  color: rules.length > 0 ? "var(--module-accent,#DC2626)" : "rgba(0,0,0,0.35)",
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Zap size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: "left" }}>Bedingte Logik</span>
                {rules.length > 0 ? (
                  <span
                    style={{
                      padding: "1px 7px",
                      borderRadius: 10,
                      backgroundColor: "rgba(var(--module-accent-rgb,220,38,38),0.08)",
                      color: "var(--module-accent,#DC2626)",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {rules.length} {rules.length === 1 ? "Regel" : "Regeln"}
                  </span>
                ) : null}
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  style={{
                    flexShrink: 0,
                    transform: logicOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
              <div
                style={{
                  maxHeight: logicOpen ? 2000 : 0,
                  opacity: logicOpen ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
                }}
              >
                <SmConditionalLogicEditor
                  rules={rules}
                  onChange={(nextRules) => onUpdate({ ...question, rules: nextRules })}
                  allQuestions={allQuestions}
                  currentIndex={index}
                />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onDelete(); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", border: "none", background: "transparent", color: "var(--module-accent,#DC2626)", opacity: .7, fontFamily: "inherit", fontSize: 10, fontWeight: 500, cursor: "pointer", transition: "opacity .15s ease" }}
                onMouseEnter={(event) => { event.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(event) => { event.currentTarget.style.opacity = ".7"; }}
              >
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

function TypeContextMenu({
  x,
  y,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  onSelect: (type: SmQuestionType) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  return (
    <div
      onMouseDown={(event) => event.stopPropagation()}
      style={{ position: "fixed", left: Math.min(x, window.innerWidth - 190), top: Math.min(y, window.innerHeight - 350), zIndex: 13000, width: 180, padding: 5, border: "1px solid rgba(0,0,0,.07)", borderRadius: 9, background: "#fff", boxShadow: "0 8px 26px rgba(0,0,0,.13)" }}
    >
      {QUESTION_TYPES.map((type) => {
        const badge = typeBadgeColor(type.key);
        return (
          <button
            key={type.key}
            type="button"
            onClick={() => onSelect(type.key)}
            style={{ width: "100%", padding: "7px 9px", border: "none", borderRadius: 6, background: "transparent", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", fontSize: 10, cursor: "pointer", transition: "background-color .15s ease" }}
            onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.04)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <span style={{ padding: "2px 8px", borderRadius: 4, background: badge.bg, color: badge.text, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em" }}>{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SmModuleEditor({
  existing,
  existingQuestions,
  onClose,
  onSave,
}: {
  existing: SmModule | null;
  existingQuestions: SmQuestion[];
  onClose: () => void;
  onSave: (module: SmModule) => Promise<void> | void;
}) {
  const [moduleName, setModuleName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [questions, setQuestions] = useState<SmQuestion[]>(() => structuredClone(existing?.questions ?? []));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState<{ questionId: string; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const addQuestion = useCallback((type: SmQuestionType) => {
    const question = createQuestion(type);
    setQuestions((current) => [...current, question]);
    setExpandedId(question.id);
    window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const updateQuestion = useCallback((updated: SmQuestion) => {
    setQuestions((current) => current.map((question) => question.id === updated.id ? updated : question));
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
    setExpandedId((current) => current === id ? null : current);
  }, []);

  const handleDrop = useCallback(() => {
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    setQuestions((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      const insertAt = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
      next.splice(insertAt, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !typeMenu) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, typeMenu]);

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        id: existing?.id ?? `sm-module-${Date.now()}`,
        name: moduleName || "Unbenanntes Modul",
        description,
        questions,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Modul konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        "--module-accent": "#DC2626",
        "--module-accent-dark": "#b91c1c",
        "--module-accent-light": "#e84040",
        "--module-accent-border": "#a91b1b",
        "--module-accent-rgb": "220,38,38",
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        animation: "smModuleEditorIn .3s cubic-bezier(.4,0,.2,1) both",
      } as CSSProperties}
    >
      <style>{`
        @keyframes smModuleEditorIn {
          from { opacity: 0; transform: scale(.98); }
          to { opacity: 1; transform: scale(1); }
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        .sm-existing-question-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .sm-existing-question-scroll::-webkit-scrollbar { width: 0; height: 0; }
        .sm-logic-dropdown { scrollbar-width: none; -ms-overflow-style: none; }
        .sm-logic-dropdown::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      <div style={{ height: 56, padding: "0 24px", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            aria-label="Modul-Editor schließen"
            onClick={onClose}
            style={{ width: 22, height: 22, borderRadius: 7, border: "none", backgroundColor: "rgba(0,0,0,.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background-color .15s ease" }}
            onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.08)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.04)"; }}
          >
            <X size={12} strokeWidth={2} color="rgba(0,0,0,.4)" />
          </button>
          <span style={{ color: "#1a1a1a", fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{existing ? "Modul bearbeiten" : "Neues Modul"}</span>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => { void save(); }}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 18px", border: "none", borderRadius: 7, background: "linear-gradient(to bottom,var(--module-accent,#DC2626),var(--module-accent-dark,#b91c1c))", boxShadow: "inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px var(--module-accent-border,#a91b1b),0 1px 6px rgba(var(--module-accent-rgb,220,38,38),.14)", color: "#fff", opacity: isSaving ? .8 : 1, fontFamily: "inherit", fontSize: 11, fontWeight: 600, letterSpacing: ".01em", cursor: isSaving ? "not-allowed" : "pointer", transition: "all .15s ease" }}
        >
          {isSaving ? "Speichern..." : "Speichern"}
        </button>
      </div>

      {saveError ? <div style={{ padding: "8px 24px", borderBottom: "1px solid rgba(220,38,38,.12)", backgroundColor: "rgba(220,38,38,.04)", color: "#b91c1c", fontSize: 11, fontWeight: 500 }}>{saveError}</div> : null}

      <div style={{ minHeight: 0, flex: 1, display: "flex" }}>
        <aside style={{ width: 220, padding: "20px 12px", borderRight: "1px solid rgba(0,0,0,.06)", backgroundColor: "rgba(0,0,0,.02)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          <span style={{ padding: "0 6px", color: "rgba(0,0,0,.35)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Fragentypen</span>
          <div style={{ marginTop: 10 }}>
            {QUESTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  type="button"
                  key={type.key}
                  onClick={() => addQuestion(type.key)}
                  style={{ width: "100%", height: 36, padding: "0 8px", marginBottom: 1, border: "none", borderRadius: 7, backgroundColor: "transparent", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", cursor: "pointer", transition: "background-color .15s ease" }}
                  onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.04)"; }}
                  onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <Icon size={14} strokeWidth={1.5} color="rgba(0,0,0,.35)" />
                  <span style={{ color: "#374151", fontSize: 11, fontWeight: 500 }}>{type.label}</span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: "8px 6px 0", color: "rgba(0,0,0,.42)", fontSize: 10, lineHeight: 1.35 }}>Hinweis: Rechtsklick auf eine Frage zum Typwechsel. Antworten/Optionen werden zurückgesetzt, Fragetext und Foto bleiben.</p>
          <div style={{ height: 1, margin: "12px 6px", backgroundColor: "rgba(0,0,0,.06)" }} />
          <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 6, color: "var(--module-accent,#DC2626)", fontSize: 11, fontWeight: 500 }}><Import size={13} strokeWidth={1.5} />Frage importieren</div>
          <div className="sm-existing-question-scroll" style={{ minHeight: 0, flex: 1, marginTop: 6, paddingRight: 2, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {existingQuestions.length === 0 ? <span style={{ padding: "0 6px", color: "rgba(0,0,0,.35)", fontSize: 10 }}>Keine bestehenden Fragen</span> : existingQuestions.map((question) => {
              const badge = typeBadgeColor(question.type);
              return (
                <button
                  type="button"
                  key={`sm-existing-${question.id}`}
                  title={question.text || "Ohne Fragetext"}
                  onClick={() => {
                    const clone = cloneQuestion(question);
                    setQuestions((current) => [...current, clone]);
                    setExpandedId(clone.id);
                  }}
                  style={{ padding: "6px 7px", border: "none", borderRadius: 6, background: "rgba(0,0,0,.02)", display: "flex", alignItems: "center", gap: 6, textAlign: "left", cursor: "pointer", transition: "background-color .15s ease" }}
                  onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.05)"; }}
                  onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.02)"; }}
                >
                  <span style={{ padding: "1px 4px", borderRadius: 4, background: badge.bg, color: badge.text, fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{typeLabel(question.type)}</span>
                  <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,.64)", fontSize: 10 }}>{question.text || "Ohne Fragetext"}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
            <input type="text" value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="Modulname eingeben..." style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,.08)", outline: "none", backgroundColor: "transparent", color: "#1a1a1a", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }} />
            <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optionale Beschreibung..." style={{ width: "100%", marginTop: 4, padding: "6px 0", border: "none", borderBottom: "1px solid rgba(0,0,0,.06)", outline: "none", backgroundColor: "transparent", color: "#6b7280", fontFamily: "inherit", fontSize: 12, fontWeight: 400 }} />
            <div style={{ height: 1, marginTop: 16, background: "linear-gradient(90deg,transparent,rgba(0,0,0,.06) 50%,transparent)" }} />
          </div>
          <div ref={listRef} className="sm-existing-question-scroll" onDragOver={(event) => event.preventDefault()} style={{ minHeight: 0, flex: 1, overflowY: "auto", padding: "16px 28px 28px", scrollbarWidth: "none" }}>
            {questions.length === 0 ? (
              <div style={{ paddingTop: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: "rgba(0,0,0,.03)", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={20} strokeWidth={1.4} color="rgba(0,0,0,.15)" /></div>
                <span style={{ color: "rgba(0,0,0,.25)", fontSize: 12, fontWeight: 500 }}>Fragentyp links auswählen um zu starten</span>
              </div>
            ) : questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                allQuestions={questions}
                index={index}
                isExpanded={expandedId === question.id}
                onToggle={() => setExpandedId((current) => current === question.id ? null : question.id)}
                onUpdate={updateQuestion}
                onDelete={() => deleteQuestion(question.id)}
                onDragStart={setDragIndex}
                onDragOver={setDropIndex}
                onDrop={handleDrop}
                onContextTypeMenu={(currentQuestionId, x, y) => setTypeMenu({ questionId: currentQuestionId, x, y })}
                dropTarget={dropIndex === index && dragIndex !== null && dragIndex !== index}
              />
            ))}
            {questions.length > 0 && dragIndex !== null ? (
              <div onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropIndex(questions.length); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); handleDrop(); }} style={{ minHeight: 40, position: "relative" }}>
                {dropIndex === questions.length && dragIndex !== questions.length - 1 ? <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "#3b82f6", opacity: .6 }} /> : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {typeMenu ? (
        <TypeContextMenu
          x={typeMenu.x}
          y={typeMenu.y}
          onClose={() => setTypeMenu(null)}
          onSelect={(type) => {
            setQuestions((current) => current.map((question) => {
              if (question.id !== typeMenu.questionId) return question;
              const fresh = createQuestion(type);
              return {
                ...fresh,
                id: question.id,
                text: question.text,
                required: question.required,
                config: { ...fresh.config, images: question.config.images },
                rules: question.rules ?? [],
                oos: undefined,
              };
            }));
            setTypeMenu(null);
          }}
        />
      ) : null}
    </div>
  );
}
