"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, GripVertical, Plus, Search, X } from "lucide-react";
import type { SmModule, SmQuestion, SmQuestionnaire, SmQuestionType } from "@/components/admin/sm/SmFragebogenWorkspace";

const RED = "#DC2626";

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "rgba(0,0,0,0.34)",
  fontSize: 9,
  fontWeight: 650,
  letterSpacing: "0.055em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  outline: "none",
  padding: "8px 0",
  background: "transparent",
  color: "#1A1A1A",
  fontFamily: "inherit",
  fontSize: 11,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "20px 22px",
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
};

const sectionHeadingStyle: React.CSSProperties = {
  marginBottom: 16,
  color: "#1A1A1A",
  fontSize: 11,
  fontWeight: 650,
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function typeLabel(type: SmQuestionType): string {
  const labels: Record<SmQuestionType, string> = {
    single: "Single Choice",
    yesno: "Ja / Nein",
    yesnomulti: "Ja / Nein Multi",
    multiple: "Multiple Choice",
    likert: "Likert Skala",
    text: "Offener Text",
    numeric: "Offene Zahl",
    slider: "Slider",
    photo: "Foto Upload",
    matrix: "Matrix",
  };
  return labels[type];
}

function typeBadgeColor(type: SmQuestionType): { bg: string; text: string } {
  switch (type) {
    case "single": return { bg: "rgba(220,38,38,0.07)", text: "#DC2626" };
    case "yesno": return { bg: "rgba(5,150,105,0.07)", text: "#059669" };
    case "yesnomulti": return { bg: "rgba(13,148,136,0.07)", text: "#0d9488" };
    case "multiple": return { bg: "rgba(59,130,246,0.07)", text: "#2563eb" };
    case "likert": return { bg: "rgba(234,179,8,0.08)", text: "#a16207" };
    case "text": return { bg: "rgba(107,114,128,0.07)", text: "#4b5563" };
    case "numeric": return { bg: "rgba(139,92,246,0.07)", text: "#7c3aed" };
    case "slider": return { bg: "rgba(236,72,153,0.07)", text: "#db2777" };
    case "photo": return { bg: "rgba(14,165,233,0.07)", text: "#0284c7" };
    case "matrix": return { bg: "rgba(194,65,12,0.07)", text: "#c2410c" };
  }
}

function QuestionConfigSummary({ question }: { question: SmQuestion }) {
  const config = question.config ?? {};
  const options = question.type === "yesnomulti"
    ? ((config.answers as string[] | undefined) ?? question.options)
    : ((config.options as string[] | undefined) ?? question.options);

  if (["single", "multiple", "yesno", "yesnomulti"].includes(question.type)) {
    return options.length ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map((option, index) => <span key={`${option}-${index}`} style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: "rgba(0,0,0,.035)", color: "rgba(0,0,0,.42)", fontSize: 9 }}>{option || `Option ${index + 1}`}</span>)}
      </div>
    ) : null;
  }
  if (question.type === "likert" || question.type === "slider" || question.type === "numeric") {
    const min = String(config.min ?? "");
    const max = String(config.max ?? "");
    const unit = String(config.unit ?? "");
    return min || max ? <div style={{ color: "rgba(0,0,0,.35)", fontSize: 9 }}>{min || "–"} bis {max || "–"}{unit ? ` ${unit}` : ""}</div> : null;
  }
  if (question.type === "matrix") {
    const rows = (config.rows as string[] | undefined)?.length ?? 0;
    const columns = (config.columns as string[] | undefined)?.length ?? 0;
    return <div style={{ color: "rgba(0,0,0,.35)", fontSize: 9 }}>{rows} Zeilen · {columns} Spalten</div>;
  }
  if (question.type === "photo" && config.instruction) return <div style={{ color: "rgba(0,0,0,.35)", fontSize: 9, fontStyle: "italic" }}>{String(config.instruction)}</div>;
  return <div style={{ color: "rgba(0,0,0,.3)", fontSize: 9 }}>{question.required ? "Pflichtfrage" : "Optional"}</div>;
}

function QuestionMiniList({ module }: { module: SmModule }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (module.questions.length === 0) return <div style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", padding: "8px 0 4px" }}>Keine Fragen in diesem Modul.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "6px 0 4px" }}>
      {module.questions.map((question, index) => {
        const badge = typeBadgeColor(question.type);
        const expanded = expandedIds.has(question.id);
        return (
          <div key={question.id} style={{ borderRadius: 7, backgroundColor: expanded ? "rgba(0,0,0,0.025)" : "rgba(0,0,0,0.018)", overflow: "hidden", transition: "background-color 0.15s ease" }}>
            <div
              onClick={() => setExpandedIds((current) => { const next = new Set(current); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", cursor: "pointer", userSelect: "none" }}
            >
              <span style={{ minWidth: 14, paddingTop: 1, color: "rgba(0,0,0,0.3)", fontSize: 9, flexShrink: 0 }}>{index + 1}</span>
              <span style={{ padding: "2px 6px", borderRadius: 4, backgroundColor: badge.bg, color: badge.text, fontSize: 9, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>{typeLabel(question.type)}</span>
              <span style={{ flex: 1, color: question.text ? "#374151" : "rgba(0,0,0,0.3)", fontSize: 11, fontStyle: question.text ? "normal" : "italic", lineHeight: 1.4 }}>{question.text || "Kein Fragetext"}</span>
              <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.2)" style={{ marginTop: 2, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
            </div>
            <div style={{ maxHeight: expanded ? 200 : 0, overflow: "hidden", transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ padding: "0 10px 8px" }}><QuestionConfigSummary question={question} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModuleRow({
  module,
  index,
  expanded,
  isDropTarget,
  onToggle,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  module: SmModule;
  index: number;
  expanded: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}) {
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      {isDropTarget ? <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "#3b82f6", opacity: .6 }} /> : null}
      <div
        onDragOver={(event) => { event.preventDefault(); onDragOver(index); }}
        onDrop={(event) => { event.preventDefault(); onDrop(); }}
        style={{ borderRadius: expanded ? "8px 8px 0 0" : 8, border: "1px solid rgba(0,0,0,.05)", borderBottom: expanded ? "1px solid rgba(0,0,0,.04)" : "1px solid rgba(0,0,0,.05)", backgroundColor: "#fafafa", overflow: "hidden" }}
      >
        <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; onDragStart(index); }} style={{ display: "flex", alignItems: "center", color: "rgba(0,0,0,.2)", cursor: "grab", flexShrink: 0 }}>
            <GripVertical size={14} strokeWidth={1.8} />
          </div>
          <span style={{ flex: 1, color: "#374151", fontSize: 12, fontWeight: 500 }}>{module.name || "Unbenanntes Modul"}</span>
          <span style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: "rgba(0,0,0,.04)", color: "rgba(0,0,0,.35)", fontSize: 9, fontWeight: 600 }}>{module.questions.length} F</span>
          <button type="button" onClick={onToggle} title="Fragen anzeigen" style={{ padding: 2, border: 0, background: "none", display: "flex", alignItems: "center", color: "rgba(0,0,0,.25)", cursor: "pointer", transition: "color .15s ease" }} onMouseEnter={(event) => { event.currentTarget.style.color = "#374151"; }} onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,.25)"; }}>
            <ChevronDown size={13} strokeWidth={2} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
          </button>
          <button type="button" aria-label="Modul entfernen" onClick={onRemove} style={{ padding: 2, border: 0, background: "none", display: "flex", alignItems: "center", color: "rgba(0,0,0,.2)", cursor: "pointer", transition: "color .15s ease" }} onMouseEnter={(event) => { event.currentTarget.style.color = "#DC2626"; }} onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,.2)"; }}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
        {expanded ? (
          <div style={{ padding: "0 12px 8px", borderTop: "1px solid rgba(0,0,0,.04)", backgroundColor: "#f8f8f8" }}>
            <QuestionMiniList module={module} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModulePreview({ module, onClose }: { module: SmModule; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 12200, backgroundColor: "rgba(0,0,0,.25)", backdropFilter: "blur(2px)" }} />
      <section style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 12210, width: 500, maxHeight: "70vh", overflow: "hidden", borderRadius: 14, backgroundColor: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.06)", display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#1a1a1a", fontSize: 14, fontWeight: 700, letterSpacing: "-.01em" }}>{module.name || "Unbenanntes Modul"}</div>
            {module.description ? <div style={{ marginTop: 4, color: "rgba(0,0,0,.45)", fontSize: 11, lineHeight: 1.5 }}>{module.description}</div> : null}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}><span style={{ padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(220,38,38,.06)", color: RED, fontSize: 9, fontWeight: 600 }}>{module.questions.length} {module.questions.length === 1 ? "Frage" : "Fragen"}</span></div>
          </div>
          <button type="button" onClick={onClose} style={{ padding: 4, border: 0, background: "none", display: "flex", alignItems: "center", color: "rgba(0,0,0,.35)", cursor: "pointer", transition: "color .15s ease", flexShrink: 0 }} onMouseEnter={(event) => { event.currentTarget.style.color = RED; }} onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,.35)"; }}><X size={16} strokeWidth={1.8} /></button>
        </header>
        <div style={{ minHeight: 0, flex: 1, overflowY: "auto", padding: "12px 20px 20px", scrollbarWidth: "none" }}>
          {module.questions.map((question, index) => (
            <div key={question.id} style={{ padding: "8px 0", borderBottom: index < module.questions.length - 1 ? "1px solid rgba(0,0,0,.04)" : "none", display: "flex", alignItems: "flex-start", gap: 9 }}>
              <span style={{ width: 18, height: 18, flex: "none", borderRadius: "50%", background: "linear-gradient(to bottom,#DC2626,#e84040)", display: "grid", placeItems: "center", color: "#fff", fontSize: 8, fontWeight: 700 }}>{index + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "#374151", fontSize: 11, fontWeight: 500, lineHeight: 1.45 }}>{question.text || "Ohne Fragetext"}</div><div style={{ marginTop: 3, color: "rgba(0,0,0,.3)", fontSize: 9 }}>{question.required ? "Pflichtfrage" : "Optional"}</div></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function SmFragebogenEditor({
  existing,
  modules,
  onClose,
  onSave,
}: {
  existing: SmQuestionnaire | null;
  modules: SmModule[];
  onClose: () => void;
  onSave: (row: SmQuestionnaire) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [nurEinmal, setNurEinmal] = useState(existing?.nurEinmalAusfuellbar ?? false);
  const [moduleSearch, setModuleSearch] = useState("");
  const [selectedModules, setSelectedModules] = useState<SmModule[]>(() => existing?.moduleIds.map((id) => modules.find((module) => module.id === id)).filter((module): module is SmModule => Boolean(module)) ?? []);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [previewModule, setPreviewModule] = useState<SmModule | null>(null);
  const [contextMenu, setContextMenu] = useState<{ module: SmModule; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const filteredModules = useMemo(() => {
    const query = moduleSearch.trim().toLocaleLowerCase("de-AT");
    return modules.filter((module) => !query || `${module.name} ${module.description}`.toLocaleLowerCase("de-AT").includes(query));
  }, [moduleSearch, modules]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (previewModule) setPreviewModule(null);
      else if (contextMenu) setContextMenu(null);
      else onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [contextMenu, onClose, previewModule]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [contextMenu]);

  const addModule = (module: SmModule) => {
    if (selectedModules.some((selected) => selected.id === module.id)) return;
    setSelectedModules((current) => [...current, module]);
  };

  const removeModule = (id: string) => {
    setSelectedModules((current) => current.filter((module) => module.id !== id));
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const handleDrop = useCallback(() => {
    const from = dragFrom.current;
    if (from === null || dropTarget === null || from === dropTarget) {
      dragFrom.current = null;
      setDropTarget(null);
      return;
    }
    setSelectedModules((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const target = from < dropTarget ? dropTarget - 1 : dropTarget;
      next.splice(Math.max(0, target), 0, moved);
      return next;
    });
    dragFrom.current = null;
    setDropTarget(null);
  }, [dropTarget]);

  const save = () => onSave({
    id: existing?.id ?? createId("sm-questionnaire"),
    name: name || "Unbenannter Fragebogen",
    description,
    moduleIds: selectedModules.map((module) => module.id),
    status: existing?.status ?? "active",
    version: existing?.version ?? 1,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    nurEinmalAusfuellbar: nurEinmal,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 12000, background: "#fff", display: "flex", flexDirection: "column" }}>
      <header style={{ height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,.07)", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.04)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button type="button" aria-label="Fragebogen-Editor schließen" onClick={onClose} style={{ padding: 4, border: 0, background: "transparent", color: "rgba(0,0,0,.4)", display: "flex", cursor: "pointer", transition: "color .15s ease" }} onMouseEnter={(event) => { event.currentTarget.style.color = RED; }} onMouseLeave={(event) => { event.currentTarget.style.color = "rgba(0,0,0,.4)"; }}><X size={18} strokeWidth={1.8} /></button>
        <div style={{ width: 1, height: 20, background: "rgba(0,0,0,.07)" }} />
        <span style={{ flex: 1, color: "#1A1A1A", fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{existing ? "Fragebogen bearbeiten" : "Neuer Fragebogen"}</span>
        <button type="button" onClick={save} style={{ padding: "7px 18px", border: 0, borderRadius: 6, background: "linear-gradient(to bottom,#DC2626,#B91C1C)", boxShadow: "inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px rgba(255,255,255,.15),0 0 0 1px #A91B1B,0 1px 6px rgba(220,38,38,.18)", color: "#fff", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Speichern</button>
      </header>

      <div style={{ minHeight: 0, flex: 1, display: "flex" }}>
        <aside style={{ width: 240, padding: "20px 14px", borderRight: "1px solid rgba(0,0,0,.06)", background: "rgba(0,0,0,.02)", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, overflowY: "auto" }}>
          <span style={labelStyle}>Modul Bibliothek</span>
          <div style={{ position: "relative" }}>
            <Search size={12} strokeWidth={1.8} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,.3)", pointerEvents: "none" }} />
            <input value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} placeholder="Suche..." style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", border: "1px solid rgba(0,0,0,.07)", borderRadius: 8, outline: 0, background: "rgba(0,0,0,.02)", color: "#374151", fontFamily: "inherit", fontSize: 11 }} />
          </div>
          {filteredModules.length === 0 ? <div style={{ padding: "16px 0", color: "rgba(0,0,0,.25)", fontSize: 10, lineHeight: 1.6, textAlign: "center" }}>Keine Module gefunden.<br />Erstelle zuerst Module.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {filteredModules.map((module) => {
                const selected = selectedModules.some((row) => row.id === module.id);
                return (
                  <div key={module.id} onClick={() => !selected && addModule(module)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ module, x: event.clientX, y: event.clientY }); }} style={{ padding: "8px 12px", border: selected ? "1px solid rgba(220,38,38,.15)" : "1px solid rgba(0,0,0,.06)", borderRadius: 8, background: selected ? "rgba(220,38,38,.03)" : "#fff", display: "flex", alignItems: "center", gap: 8, cursor: selected ? "default" : "pointer", userSelect: "none", transition: "all .15s ease" }} onMouseEnter={(event) => { if (!selected) event.currentTarget.style.borderColor = "rgba(220,38,38,.3)"; }} onMouseLeave={(event) => { if (!selected) event.currentTarget.style.borderColor = "rgba(0,0,0,.06)"; }}>
                    <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "rgba(0,0,0,.3)" : "#374151", fontSize: 11, fontWeight: 500 }}>{module.name || "Unbenannt"}</span>
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(0,0,0,.04)", color: "rgba(0,0,0,.3)", fontSize: 9, fontWeight: 600 }}>{module.questions.length}F</span>
                    {selected ? <Check size={10} strokeWidth={2.5} color={RED} /> : null}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: "auto", color: "rgba(0,0,0,.22)", fontSize: 9, lineHeight: 1.5, textAlign: "center" }}>Klicke zum Hinzufügen · Rechtsklick für Details</div>
        </aside>

        <main style={{ minWidth: 0, flex: 1, padding: "24px 32px", overflowY: "auto", background: "#F5F5F7" }}>
          <section style={sectionStyle}>
            <div style={sectionHeadingStyle}>Grundeinstellungen</div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Name</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="z.B. Wöchentlicher Marktcheck" style={inputStyle} /></div>
            <div><label style={labelStyle}>Beschreibung (optional)</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kurze Beschreibung des Fragebogens..." rows={2} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} /></div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ color: "#1A1A1A", fontSize: 11, fontWeight: 600 }}>Nur einmal ausfüllbar</div><div style={{ marginTop: 1, color: "rgba(0,0,0,.4)", fontSize: 10 }}>Dieser Fragebogen kann pro Markt jeweils nur einmal ausgefüllt werden</div></div>
              <button type="button" aria-pressed={nurEinmal} onClick={() => setNurEinmal((current) => !current)} style={{ position: "relative", width: 38, height: 22, border: 0, borderRadius: 99, background: nurEinmal ? RED : "rgba(0,0,0,.1)", cursor: "pointer", transition: "background .18s" }}><span style={{ position: "absolute", top: 3, left: nurEinmal ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .18s" }} /></button>
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeadingStyle}>Module <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 4, background: "rgba(220,38,38,.06)", color: RED, fontSize: 9, fontWeight: 600 }}>{selectedModules.length}</span></div>
            {selectedModules.length === 0 ? <div style={{ padding: "24px 16px", border: "1.5px dashed rgba(0,0,0,.1)", borderRadius: 10, color: "rgba(0,0,0,.25)", fontSize: 11, textAlign: "center" }}>Klicke links auf Module um sie hier hinzuzufügen</div> : (
              <div>
                {selectedModules.map((module, index) => <ModuleRow key={module.id} module={module} index={index} expanded={expandedIds.has(module.id)} isDropTarget={dropTarget === index && dragFrom.current !== index} onToggle={() => setExpandedIds((current) => { const next = new Set(current); if (next.has(module.id)) next.delete(module.id); else next.add(module.id); return next; })} onRemove={() => removeModule(module.id)} onDragStart={(value) => { dragFrom.current = value; }} onDragOver={setDropTarget} onDrop={handleDrop} />)}
                <div style={{ height: 10 }} onDragOver={(event) => { event.preventDefault(); setDropTarget(selectedModules.length); }} onDrop={(event) => { event.preventDefault(); handleDrop(); }} />
                <button type="button" style={{ padding: 0, border: 0, background: "transparent", display: "flex", alignItems: "center", gap: 5, color: RED, fontFamily: "inherit", fontSize: 10, fontWeight: 500, cursor: "pointer" }}><Plus size={11} />Modul aus Bibliothek hinzufügen</button>
                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,.02)", color: "rgba(0,0,0,.35)", fontSize: 10 }}>{selectedModules.reduce((sum, module) => sum + module.questions.length, 0)} Fragen gesamt</div>
              </div>
            )}
          </section>
        </main>
      </div>

      {contextMenu ? <div onMouseDown={(event) => event.stopPropagation()} style={{ position: "fixed", left: Math.min(contextMenu.x, window.innerWidth - 170), top: Math.min(contextMenu.y, window.innerHeight - 52), zIndex: 12100, width: 160, padding: 4, border: "1px solid rgba(0,0,0,.05)", borderRadius: 8, background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.06)" }}><button type="button" onClick={() => { setPreviewModule(contextMenu.module); setContextMenu(null); }} style={{ width: "100%", padding: "7px 10px", border: 0, borderRadius: 5, background: "transparent", display: "flex", alignItems: "center", gap: 8, color: "#374151", fontFamily: "inherit", fontSize: 12, fontWeight: 500, textAlign: "left", cursor: "pointer", transition: "background-color .1s ease" }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "rgba(0,0,0,.04)"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}><Search size={12} strokeWidth={1.8} color="rgba(0,0,0,.4)" />Details ansehen</button></div> : null}
      {previewModule ? <ModulePreview module={previewModule} onClose={() => setPreviewModule(null)} /> : null}
    </div>
  );
}
