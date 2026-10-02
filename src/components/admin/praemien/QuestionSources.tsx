"use client";
import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, ListChecks, Plus, Search, Trash2 } from "lucide-react";
import { answerOptions, eligibleQuestion, questionKind, sourceForQuestion, type BonusQuestion } from "@/lib/praemien-question-selection";
import type { ModelMetric, ModelSource } from "@/types/praemien-workspace";
import { BoniSelect } from "./BoniSelect";
import { DecimalField } from "./DecimalField";
import styles from "./praemien.module.css";

const sections = { standard: "Standardbesuch", flex: "Flexbesuch", billa: "BILLA-Besuch", kuehler: "Kühlerinventur", mhd: "MHD", durcharbeit: "Durcharbeit" };
const kinds = { numeric: "Zahlenwert", yesno: "Ja / Nein", choice: "Antwortauswahl" };

export function QuestionSources({ metric, questions, onChange, loading = false, occupied = [] }: { metric: ModelMetric; questions: BonusQuestion[]; loading?: boolean; occupied?: ModelSource[]; onChange: (m: ModelMetric) => void }) {
  const id = useId();
  const [search, setSearch] = useState(""), [kind, setKind] = useState("all"), [scope, setScope] = useState("all"), [section, setSection] = useState("standard");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const assigned = useMemo(() => new Set(metric.sources.map((s) => s.questionId)), [metric.sources]);
  const catalog = useMemo(() => {
    const rows = new Map(questions.filter((q) => eligibleQuestion(q) || assigned.has(q.id)).map((q) => [q.id, q]));
    for (const s of metric.sources) if (!rows.has(s.questionId)) rows.set(s.questionId, { id: s.questionId, text: s.label || "Nicht mehr verfügbare Frage", type: "unavailable", config: {}, scores: [], updatedAt: "" });
    return [...rows.values()];
  }, [questions, assigned, metric.sources]);
  const canAssign = (q: BonusQuestion) => { const next = sourceForQuestion(q, section); return eligibleQuestion(q) && !occupied.some((s) => s.questionId === next.questionId && s.section === next.section && s.scoreKey === next.scoreKey); };
  const visible = catalog.filter((q) => (assigned.has(q.id) || canAssign(q)) && q.text.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de")) && (kind === "all" || questionKind(q) === kind) && (scope !== "selected" || assigned.has(q.id)));
  const limit = metric.method === "availability" ? 1 : 100;
  const remaining = Math.max(0, limit - metric.sources.length);
  const unassigned = visible.filter((q) => !assigned.has(q.id) && canAssign(q));
  function update(index: number, next: ModelSource) { onChange({ ...metric, sources: metric.sources.map((s, i) => i === index ? next : s) }); }
  function toggle(q: BonusQuestion) {
    onChange({ ...metric, sources: assigned.has(q.id) ? metric.sources.filter((s) => s.questionId !== q.id) : [...metric.sources, sourceForQuestion(q, section)] });
  }
  return <fieldset className={styles.questionPicker}>
    <legend><ListChecks size={14} /> Fragen zuordnen</legend>
    <div className={styles.pickerHeading}><div><h3>Fragen für diese Messgröße</h3><p>Klicke auf eine Frage, um sie zuzuordnen. Der Pfeil öffnet ihre Einstellungen.</p></div><span className={styles.selectedCount}>{assigned.size} zugeordnet</span></div>
    <div className={styles.questionToolbar}>
      <div className={styles.searchField}><Search size={15} /><input aria-label="Fragen suchen" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Frage oder Produkt suchen …" /></div>
      <BoniSelect aria-label="Fragentyp filtern" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Alle geeigneten Fragen</option><option value="yesno">Ja / Nein</option><option value="numeric">Zahlenwerte</option><option value="choice">Antwortauswahl</option></BoniSelect>
    </div>
    <div className={styles.pickerControls}>
      <div className={styles.segment}><button type="button" className={scope === "all" ? styles.activeTab : undefined} onClick={() => setScope("all")}>Alle Fragen</button><button type="button" className={scope === "selected" ? styles.activeTab : undefined} onClick={() => setScope("selected")}>Zugeordnet ({assigned.size})</button></div>
      <label>Neue Zuordnung für<BoniSelect aria-label="Besuchsbereich für neue Fragen" value={section} onChange={(e) => setSection(e.target.value)}>{Object.entries(sections).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</BoniSelect></label>
    </div>
    <div className={styles.questionList} role="region" aria-label="Geeignete Fragen" tabIndex={0}>
      {visible.map((q) => {
        const selected = assigned.has(q.id), open = expanded.has(q.id), panelId = `${id}-${q.id || "missing"}`;
        const extraSection = Object.keys(sections).find((area) => ![...metric.sources, ...occupied].some((s) => s.questionId === q.id && s.section === area && s.scoreKey === sourceForQuestion(q, area).scoreKey));
        const sources = metric.sources.map((s, index) => ({ s, index })).filter(({ s }) => s.questionId === q.id);
        return <div key={q.id} className={`${styles.questionItem} ${selected ? styles.questionSelected : ""}`}>
          <div className={styles.questionRow}>
            <button type="button" role="checkbox" aria-checked={selected} aria-label={q.text} className={styles.questionToggle} disabled={!selected && (!canAssign(q) || !remaining)} onClick={() => toggle(q)}><span className={styles.questionCheckbox}>{selected && <Check size={12} />}</span><span><strong>{q.text}</strong><small>{q.type === "unavailable" ? "Quelle prüfen · Frage nicht mehr im Katalog" : kinds[questionKind(q)]}{selected && ` · ${sources.length > 1 ? `${sources.length} Zuordnungen` : sections[sources[0].s.section as keyof typeof sections] ?? sources[0].s.section}`}</small></span></button>
            <button type="button" className={styles.questionChevron} aria-label={`Einstellungen: ${q.text}`} aria-expanded={open} aria-controls={panelId} disabled={!selected} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); return next; })}><ChevronDown size={16} className={open ? styles.rotated : undefined} /></button>
          </div>
          {open && selected && <div id={panelId} className={styles.questionSettings}>
            {sources.map(({ s, index }) => <div key={index} className={styles.sourceSettings}>
              {sources.length > 1 && <h3>Zuordnung {sources.findIndex((x) => x.index === index) + 1}</h3>}
              <div className={styles.twoColumns}>
                <label>Besuchsbereich<BoniSelect value={s.section} onChange={(e) => update(index, { ...s, section: e.target.value })}>{Object.entries(sections).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</BoniSelect></label>
                <label>Zählweise<BoniSelect value={s.counting} onChange={(e) => update(index, { ...s, counting: e.target.value as ModelSource["counting"] })}><option value="latest">Letzter Stand pro Markt / Quartal</option><option value="once">Einmal pro Markt / Quartal · höchster Wert</option></BoniSelect></label>
                <label>{s.factor ? "Zählgrundlage" : "Gewertete Antwort"}{s.factor ? <div className={styles.readonlyValue}>Antwortwert × Faktor</div> : answerOptions(q).length ? <BoniSelect value={s.scoreKey} onChange={(e) => update(index, { ...s, scoreKey: e.target.value })}>{Array.from(new Set([s.scoreKey, ...answerOptions(q)])).map((key) => <option key={key} value={key}>{key}</option>)}</BoniSelect> : <input value={s.scoreKey} onChange={(e) => update(index, { ...s, scoreKey: e.target.value })} />}</label>
                <label>{metric.method === "availability" ? "Gewicht · positiv = vorhanden" : s.factor ? "Punkte pro Einheit" : "Punkte für diese Antwort"}<DecimalField value={s.weight} onChange={(value) => update(index, { ...s, weight: value ?? 0 })} /></label>
                <label>Besuche pro Jahr · mindestens<DecimalField value={s.minFrequency} onChange={(value) => update(index, { ...s, minFrequency: value ?? 0 })} /></label>
                <label>Handelsketten · leer = alle<input placeholder="z. B. Billa, Sparmarkt" value={s.chains.join(", ")} onChange={(e) => update(index, { ...s, chains: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>
              </div>
              <div className={styles.sourceFootnote}><small>{s.factor ? "Antwortwert × Faktor" : "Nur die gewählte Antwort zählt"} · {s.counting === "latest" ? "letzter gültiger Stand" : "höchster gültiger Wert"}</small><button type="button" aria-label={`Zuordnung ${sources.findIndex((x) => x.index === index) + 1} entfernen: ${q.text}`} onClick={() => onChange({ ...metric, sources: metric.sources.filter((_, i) => i !== index) })}><Trash2 size={13} /> Entfernen</button></div>
            </div>)}
            <button type="button" disabled={!remaining || !extraSection} onClick={() => { if (extraSection) onChange({ ...metric, sources: [...metric.sources, sourceForQuestion(q, extraSection)] }); }}><Plus size={13} /> Weiteren Besuchsbereich / Antwort zuordnen</button>
          </div>}
        </div>;
      })}
      {loading && <p className={styles.listEmpty} role="status">Fragen werden geladen …</p>}
      {!loading && !visible.length && <div className={styles.listEmpty}><Search size={20} /><strong>Keine passenden Fragen</strong><p>{scope === "selected" ? "Noch keine Zuordnung für diese Auswahl." : "Suche oder Fragentyp anpassen. Text- und Fotofragen liefern keinen zählbaren Wert."}</p><button type="button" onClick={() => { setSearch(""); setKind("all"); setScope("all"); }}>Filter zurücksetzen</button></div>}
    </div>
    {metric.method === "availability" ? <p>Eine Produktquote pro Messgröße. Für mehrere Produkte einzelne Quoten anlegen und anschließend mitteln.</p> : !remaining && <p role="status">100 Zuordnungen erreicht. Für weitere Fragen eine zusätzliche Messgröße anlegen.</p>}
    <div className={styles.pickerFooter}><small>{visible.length} passende Fragen · {metric.sources.length} Zuordnungen<br />Gewichtung und Zählweise gelten für diese Quartalsregel.</small><button type="button" disabled={!unassigned.length || !remaining} onClick={() => onChange({ ...metric, sources: [...metric.sources, ...unassigned.slice(0, remaining).map((q) => sourceForQuestion(q, section))] })}><Plus size={13} /> {unassigned.length > remaining ? `Nächste ${remaining} zuordnen` : "Alle Treffer zuordnen"}</button></div>
  </fieldset>;
}
