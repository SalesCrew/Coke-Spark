"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Clock3,
  FileText,
  Grid3x3,
  Hash,
  HelpCircle,
  Layers3,
  ListChecks,
  Pencil,
  Search,
  SlidersHorizontal,
  Star,
  ToggleLeft,
  Trash2,
  X,
} from "lucide-react";
import { SmFragebogenEditor } from "@/components/admin/sm/SmFragebogenEditor";
import { SmModuleEditor } from "@/components/admin/sm/SmModuleEditor";

export type SmQuestionType =
  | "single"
  | "yesno"
  | "yesnomulti"
  | "multiple"
  | "likert"
  | "text"
  | "numeric"
  | "slider"
  | "photo"
  | "matrix";

export type SmConditionalRule = {
  id: string;
  triggerQuestionId: string;
  operator: string;
  triggerValue: string;
  triggerValueMax: string;
  action: "hide" | "show";
  targetQuestionIds: string[];
};

export type SmOosRole = "detection" | "remediation";

export type SmOosCategory =
  | "action_placements"
  | "softdrinks_energy"
  | "water_near_water"
  | "juice_iced_tea";

export type SmOosAnswerOutcome =
  | "oos_present"
  | "oos_absent"
  | "resolved"
  | "partially_resolved"
  | "not_resolved"
  | "not_applicable";

export type SmOosConfig = {
  enabled?: boolean;
  role?: SmOosRole;
  category?: SmOosCategory;
  detectionQuestionId?: string;
  answerOutcomes?: Record<string, SmOosAnswerOutcome>;
  partialCountsAsResolved?: boolean;
  /** Legacy preview fields retained while the SM backend is still being built. */
  behobenAnswer?: string;
  nichtBehobenAnswer?: string;
};

export type SmQuestion = {
  id: string;
  text: string;
  type: SmQuestionType;
  required: boolean;
  options: string[];
  config: Record<string, unknown>;
  rules: SmConditionalRule[];
  oos?: SmOosConfig;
};

export type SmModule = {
  id: string;
  name: string;
  description: string;
  questions: SmQuestion[];
  createdAt: string;
};

export type SmQuestionnaire = {
  id: string;
  name: string;
  description: string;
  moduleIds: string[];
  status: "active" | "inactive";
  version: number;
  createdAt: string;
  nurEinmalAusfuellbar?: boolean;
};

type WorkspaceTab = "fragen" | "module" | "fragebogen";

const RED = "#DC2626";
const QUESTION_TYPES: Array<{ key: SmQuestionType; label: string; icon: typeof ToggleLeft }> = [
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

const TYPE_STYLE: Record<SmQuestionType, { label: string; bg: string; text: string }> = {
  yesno: { label: "Ja / Nein", bg: "rgba(5,150,105,0.07)", text: "#059669" },
  single: { label: "Single Choice", bg: "rgba(220,38,38,0.07)", text: "#DC2626" },
  yesnomulti: { label: "Ja / Nein Multi", bg: "rgba(13,148,136,0.07)", text: "#0D9488" },
  multiple: { label: "Multiple Choice", bg: "rgba(59,130,246,0.07)", text: "#2563EB" },
  likert: { label: "Likert Skala", bg: "rgba(234,179,8,0.08)", text: "#A16207" },
  text: { label: "Offener Text", bg: "rgba(107,114,128,0.07)", text: "#4B5563" },
  numeric: { label: "Offene Zahl", bg: "rgba(139,92,246,0.07)", text: "#7C3AED" },
  slider: { label: "Slider", bg: "rgba(236,72,153,0.07)", text: "#DB2777" },
  photo: { label: "Foto Upload", bg: "rgba(14,165,233,0.07)", text: "#0284C7" },
  matrix: { label: "Matrix", bg: "rgba(194,65,12,0.07)", text: "#C2410C" },
};

function defaultQuestionConfig(type: SmQuestionType, options: string[]): Record<string, unknown> {
  switch (type) {
    case "single":
    case "multiple":
      return { options };
    case "yesnomulti":
      return { answers: options.length > 0 ? options : ["Ja", "Nein"] };
    case "likert":
      return { min: 1, max: 5, minLabel: "", maxLabel: "" };
    case "numeric":
      return { min: "", max: "", decimals: false };
    case "slider":
      return { min: 0, max: 100, step: 1, unit: "" };
    case "photo":
      return { instruction: "" };
    case "matrix":
      return { rows: [""], columns: ["", ""] };
    default:
      return {};
  }
}

const question = (
  id: string,
  text: string,
  type: SmQuestionType = "yesno",
  options: string[] = type === "yesno" ? ["Ja", "Nein"] : [],
): SmQuestion => ({
  id,
  text,
  type,
  required: true,
  options,
  config: defaultQuestionConfig(type, options),
  rules: [],
});

const TEMP_MODULES: SmModule[] = [
  {
    id: "sm-module-cooler",
    name: "Getränkekühler",
    description: "Bestand und durchgeführte Arbeiten an Getränkekühlern.",
    createdAt: "2026-08-10T08:00:00.000Z",
    questions: [
      question("sm-q-01", "Sind im Markt Kühler für Getränke vorhanden?"),
      question("sm-q-02", "Die Nachschlichtung der Getränkekühler wurde durchgeführt."),
      question("sm-q-03", "Eine MHD Kontrolle bei den Getränkekühlern wurde durchgeführt."),
      question("sm-q-04", "Eine Preiskontrolle bei den Getränkekühlern wurde durchgeführt."),
    ],
  },
  {
    id: "sm-module-action",
    name: "Aktionsplatzierungen",
    description: "Umsetzung, OOS-Situation und Nachschlichtung bei Aktionsplatzierungen.",
    createdAt: "2026-08-10T08:05:00.000Z",
    questions: [
      question("sm-q-05", "Sind im Markt Aktionsplatzierungen von Coca-Cola Produkten vorhanden?"),
      question("sm-q-06", "Die Nachschlichtung der Aktionsplatzierungen wurde durchgeführt.", "single", ["Ja", "nicht erforderlich – alle Produkte ausreichend vorhanden", "nur teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
      question("sm-q-07", "Gab es bei den Aktionsplatzierungen ausverkaufte Produkte? OOS"),
      question("sm-q-08", "Die OOS bei den Aktionsplatzierungen wurden behoben; Produkte wurden nachgeschlichtet.", "single", ["Ja", "teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
    ],
  },
  {
    id: "sm-module-softdrinks",
    name: "Regalplatzierungen Limonaden & Energy Drinks",
    description: "Regalservice, OOS und Behebung für Limonaden und Energy Drinks.",
    createdAt: "2026-08-10T08:10:00.000Z",
    questions: [
      question("sm-q-09", "Nachschlichtung, MHD- und Preiskontrolle wurden durchgeführt.", "single", ["Ja", "nicht erforderlich – alle Produkte ausreichend vorhanden", "nur teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
      question("sm-q-10", "Gab es eine OOS-Situation?"),
      question("sm-q-11", "Die OOS-Situation wurde durch Nachschlichtung behoben.", "single", ["Ja", "teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
    ],
  },
  {
    id: "sm-module-water",
    name: "Regalplatzierungen Wasser & Near Water",
    description: "Regalservice, OOS und Behebung für Wasser und Near Water.",
    createdAt: "2026-08-10T08:15:00.000Z",
    questions: [
      question("sm-q-12", "Nachschlichtung, MHD- und Preiskontrolle wurden durchgeführt.", "single", ["Ja", "nicht erforderlich – alle Produkte ausreichend vorhanden", "nur teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
      question("sm-q-13", "Gab es eine OOS-Situation?"),
      question("sm-q-14", "Die OOS-Situation wurde durch Nachschlichtung behoben.", "single", ["Ja", "teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
    ],
  },
  {
    id: "sm-module-juice",
    name: "Regalplatzierungen Säfte & Eistee",
    description: "Regalservice, OOS und Behebung für Säfte und Eistee.",
    createdAt: "2026-08-10T08:20:00.000Z",
    questions: [
      question("sm-q-15", "Nachschlichtung, MHD- und Preiskontrolle wurden durchgeführt.", "single", ["Ja", "nicht erforderlich – alle Produkte ausreichend vorhanden", "nur teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
      question("sm-q-16", "Gab es eine OOS-Situation?"),
      question("sm-q-17", "Die OOS-Situation wurde durch Nachschlichtung behoben.", "single", ["Ja", "teilweise möglich – zu wenig Ware vorhanden", "nicht möglich – zu wenig Ware vorhanden", "Nein"]),
    ],
  },
  {
    id: "sm-module-info",
    name: "Information",
    description: "Abschlussinformation an den Markt und freie Hinweise.",
    createdAt: "2026-08-10T08:25:00.000Z",
    questions: [
      question("sm-q-18", "Wenn OOS vorhanden war: Wurde das Marktpersonal informiert oder eine Bestellung ausgelöst?", "single", ["Ja", "Nein", "nicht erforderlich: es gab keine ausverkauften Produkte"]),
      question("sm-q-19", "Bitte informiere über OOS, große Mengen Ablaufware, Wünsche, Beschwerden oder sonstige wichtige Informationen.", "text", []),
    ],
  },
];

const TEMP_QUESTIONNAIRES: SmQuestionnaire[] = [
  {
    id: "sm-questionnaire-coke-2026",
    name: "Coke Regalservice 2026",
    description: "Shelf-Merchandising-Fragebogen für geplante Coke Einsätze.",
    moduleIds: TEMP_MODULES.map((moduleRow) => moduleRow.id),
    status: "active",
    version: 1,
    createdAt: "2026-08-10T08:30:00.000Z",
  },
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TypeBadge({ type, compact = false }: { type: SmQuestionType; compact?: boolean }) {
  const style = TYPE_STYLE[type];
  return <span className={`sm-type-badge${compact ? " is-compact" : ""}`} style={{ background: style.bg, color: style.text }}>{style.label}</span>;
}

function QuestionSummary({ row }: { row: SmQuestion }) {
  if (["yesno", "single", "multiple", "yesnomulti"].includes(row.type)) {
    const configuredOptions = row.type === "yesnomulti"
      ? (row.config.answers as string[] | undefined)
      : (row.config.options as string[] | undefined);
    const options = row.type === "yesno" ? ["Ja", "Nein"] : configuredOptions ?? row.options;
    return (
      <div className="sm-answer-preview">
        {options.filter(Boolean).map((option) => (
          <div className="sm-answer-row" key={option}>
            <span className={row.type === "single" || row.type === "yesno" ? "sm-radio" : "sm-square"} />
            <span>{option}</span>
          </div>
        ))}
      </div>
    );
  }
  if (row.type === "text") return <div className="sm-config-hint">Freie Texteingabe</div>;
  if (row.type === "numeric") return <div className="sm-config-hint">Offene Zahleneingabe</div>;
  if (row.type === "likert") return <div className="sm-config-hint">Skala {String(row.config.min ?? 1)}–{String(row.config.max ?? 5)}</div>;
  if (row.type === "slider") return <div className="sm-config-hint">Slider {String(row.config.min ?? 0)}–{String(row.config.max ?? 100)} {String(row.config.unit ?? "")}</div>;
  if (row.type === "photo") return <div className="sm-config-hint">Foto Upload</div>;
  return <div className="sm-config-hint">Matrixfrage</div>;
}

function SmQuestionRow({ row, moduleName }: { row: SmQuestion; moduleName: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="sm-question-row">
      <button type="button" className="sm-question-row-main" onClick={() => setExpanded((value) => !value)}>
        <TypeBadge type={row.type} />
        <span className="sm-question-text">{row.text || "Unbenannt"}</span>
        {row.required ? <span className="sm-required">Pflicht</span> : null}
        <span className="sm-origin-pill">{moduleName}</span>
        <ChevronDown className={expanded ? "is-open" : ""} size={12} strokeWidth={1.8} />
      </button>
      <div className={`sm-question-detail ${expanded ? "is-open" : ""}`}>
        <QuestionSummary row={row} />
      </div>
    </div>
  );
}

function SmModuleCard({
  row,
  questionnaireCount,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  row: SmModule;
  questionnaireCount: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fingerprints = Array.from(new Set(row.questions.map((item) => item.type)));

  useEffect(() => {
    if (!menuPosition) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuPosition(null);
    };
    const closeOnViewportChange = () => setMenuPosition(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("blur", closeOnViewportChange);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("blur", closeOnViewportChange);
    };
  }, [menuPosition]);

  const openContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 160;
    const menuHeight = 82;
    const edgeGap = 8;
    setMenuPosition({
      x: Math.max(edgeGap, Math.min(event.clientX, window.innerWidth - menuWidth - edgeGap)),
      y: Math.max(edgeGap, Math.min(event.clientY, window.innerHeight - menuHeight - edgeGap)),
    });
  };

  return (
    <div className="sm-module-card" onContextMenu={openContextMenu}>
      {menuPosition && typeof document !== "undefined" ? createPortal(
        <div ref={menuRef} className="sm-context-menu" style={{ left: menuPosition.x, top: menuPosition.y }}>
          <button type="button" onClick={() => { onDuplicate(); setMenuPosition(null); }}><FileText size={12} />Duplizieren</button>
          <div />
          <button type="button" className="danger" onClick={() => { onDelete(); setMenuPosition(null); }}><Trash2 size={12} />Löschen</button>
        </div>,
        document.body,
      ) : null}
      <div
        className="sm-module-head"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
      >
        <div className="sm-module-copy">
          <strong>{row.name}</strong>
          <span>{row.description}</span>
        </div>
        <div className="sm-module-stats">
          <span>{row.questions.length} {row.questions.length === 1 ? "Frage" : "Fragen"}</span>
          <span className={questionnaireCount > 0 ? "is-used" : ""}>{questionnaireCount > 0 ? `In ${questionnaireCount} Fragebogen` : "Nicht verwendet"}</span>
        </div>
        <button type="button" className="sm-edit-icon" aria-label={`${row.name} bearbeiten`} onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil size={12} strokeWidth={1.8} /></button>
        <ChevronDown className={expanded ? "is-open" : ""} size={14} strokeWidth={1.8} />
      </div>
      {!expanded && fingerprints.length > 0 ? (
        <div className="sm-fingerprint">{fingerprints.map((type) => <TypeBadge key={type} type={type} compact />)}</div>
      ) : null}
      <div className={`sm-module-detail ${expanded ? "is-open" : ""}`}>
        <div className="sm-module-detail-inner">
          {row.questions.map((item, index) => (
            <div className="sm-module-question" key={item.id}>
              <span className="sm-question-number">{index + 1}</span>
              <TypeBadge type={item.type} />
              <span className="sm-question-text">{item.text}</span>
              {item.required ? <span className="sm-required">Pflicht</span> : null}
            </div>
          ))}
          <div className="sm-card-footer"><button type="button" className="sm-dark-button" onClick={onEdit}><Pencil size={10} strokeWidth={2} />Bearbeiten</button></div>
        </div>
      </div>
    </div>
  );
}

function SmQuestionnaireCard({
  row,
  modules,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  row: SmQuestionnaire;
  modules: SmModule[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const assignedModules = row.moduleIds.map((id) => modules.find((moduleRow) => moduleRow.id === id)).filter((moduleRow): moduleRow is SmModule => Boolean(moduleRow));
  const count = assignedModules.reduce((sum, moduleRow) => sum + moduleRow.questions.length, 0);
  return (
    <div className="sm-questionnaire-card">
      <div className="sm-questionnaire-inner">
        <div className="sm-questionnaire-head">
          <strong>{row.name}</strong>
          <span className={`sm-status-pill ${row.status}`}>{row.status === "active" ? "Aktiv" : "Inaktiv"}</span>
          <span className="sm-version-pill">Version {row.version}</span>
          <button type="button" className="sm-plain-icon" aria-label={`${row.name} bearbeiten`} onClick={onEdit}><Pencil size={13} /></button>
          <button type="button" className="sm-plain-icon" aria-label={`${row.name} aufklappen`} onClick={() => setExpanded((value) => !value)}><ChevronDown className={expanded ? "is-open" : ""} size={14} /></button>
        </div>
        <div className="sm-module-pills">{assignedModules.map((moduleRow) => <span key={moduleRow.id}>{moduleRow.name}</span>)}</div>
        <div className="sm-questionnaire-footer">
          <span>{assignedModules.length} Module</span>
          <span>{count} Fragen</span>
          <span>SM Einsatzfragebogen</span>
          <div className="sm-questionnaire-actions">
            <button type="button" onClick={onDuplicate}>Duplizieren</button>
            <button type="button" className="danger" onClick={onDelete}>Löschen</button>
          </div>
        </div>
      </div>
      <div className={`sm-questionnaire-detail ${expanded ? "is-open" : ""}`}>
        <div className="sm-questionnaire-detail-inner">
          <span className="sm-section-label">Module ({assignedModules.length})</span>
          {assignedModules.map((moduleRow, index) => (
            <div className="sm-questionnaire-module" key={moduleRow.id}><span>{index + 1}.</span><strong>{moduleRow.name}</strong><small>{moduleRow.questions.length} Fragen</small></div>
          ))}
          <div className="sm-created"><Clock3 size={10} />Erstellt {new Date(row.createdAt).toLocaleDateString("de-AT")}</div>
        </div>
      </div>
    </div>
  );
}

export function SmFragebogenWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("module");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<SmQuestionType | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [modules, setModules] = useState<SmModule[]>(TEMP_MODULES);
  const [questionnaires, setQuestionnaires] = useState<SmQuestionnaire[]>(TEMP_QUESTIONNAIRES);
  const [editingModule, setEditingModule] = useState<SmModule | null | undefined>(undefined);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<SmQuestionnaire | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openModule = () => setEditingModule(null);
    const openQuestionnaire = () => setEditingQuestionnaire(null);
    const exportPreview = () => {
      setNotice("UI-Vorschau: Der SM-Export wird mit dem eigenen SM-Backend angebunden.");
      window.setTimeout(() => setNotice(null), 3500);
    };
    window.addEventListener("sm-fragebogen:openModuleCreate", openModule);
    window.addEventListener("sm-fragebogen:openQuestionnaireCreate", openQuestionnaire);
    window.addEventListener("admin:sm-fragebogen:export", exportPreview);
    return () => {
      window.removeEventListener("sm-fragebogen:openModuleCreate", openModule);
      window.removeEventListener("sm-fragebogen:openQuestionnaireCreate", openQuestionnaire);
      window.removeEventListener("admin:sm-fragebogen:export", exportPreview);
    };
  }, []);

  useEffect(() => {
    if (!typeMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) setTypeMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [typeMenuOpen]);

  const allQuestions = useMemo(() => modules.flatMap((moduleRow) => moduleRow.questions.map((row) => ({ row, moduleName: moduleRow.name }))), [modules]);
  const normalizedSearch = search.trim().toLocaleLowerCase("de-AT");
  const filteredModules = modules.filter((row) => !normalizedSearch || `${row.name} ${row.description} ${row.questions.map((item) => item.text).join(" ")}`.toLocaleLowerCase("de-AT").includes(normalizedSearch));
  const filteredQuestions = allQuestions.filter(({ row, moduleName }) => (!filterType || row.type === filterType) && (!normalizedSearch || `${row.text} ${moduleName}`.toLocaleLowerCase("de-AT").includes(normalizedSearch)));
  const filteredQuestionnaires = questionnaires.filter((row) => !normalizedSearch || `${row.name} ${row.description}`.toLocaleLowerCase("de-AT").includes(normalizedSearch));

  const saveModule = (row: SmModule) => {
    setModules((current) => current.some((item) => item.id === row.id) ? current.map((item) => item.id === row.id ? row : item) : [...current, row]);
    setEditingModule(undefined);
  };
  const saveQuestionnaire = (row: SmQuestionnaire) => {
    setQuestionnaires((current) => current.some((item) => item.id === row.id) ? current.map((item) => item.id === row.id ? row : item) : [...current, row]);
    setEditingQuestionnaire(undefined);
  };

  const tabCount = (tab: WorkspaceTab) => tab === "fragen" ? allQuestions.length : tab === "module" ? modules.length : questionnaires.length;

  return (
    <div className="sm-fb-page">
      {notice ? <div className="sm-preview-notice">{notice}</div> : null}
      <div className="sm-tab-shell">
        <div className="sm-tabs">
          {(["fragen", "module", "fragebogen"] as WorkspaceTab[]).map((tab) => (
            <button type="button" className={activeTab === tab ? "is-active" : ""} key={tab} onClick={() => setActiveTab(tab)}>
              {tab === "fragen" ? "Fragen" : tab === "module" ? "Module" : "Fragebogen"}
              <span>{tabCount(tab)}</span>
            </button>
          ))}
        </div>
        <div className="sm-tab-tools">
          <div className="sm-tool-divider" />
          <div className="sm-search"><Search size={11} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Suchen" />{search ? <button type="button" onClick={() => setSearch("")}><X size={10} /></button> : null}</div>
          {activeTab === "fragen" ? (
            <div ref={typeMenuRef} className="sm-type-filter">
              <button type="button" className={filterType ? "is-selected" : ""} onClick={() => setTypeMenuOpen((value) => !value)}>{filterType ? TYPE_STYLE[filterType].label : "Typ"}<ChevronDown size={9} /></button>
              {typeMenuOpen ? <div className="sm-type-menu">
                <button type="button" className={!filterType ? "is-selected" : ""} onClick={() => { setFilterType(null); setTypeMenuOpen(false); }}>Alle Typen{!filterType ? <Check size={10} /> : null}</button>
                <div />
                {QUESTION_TYPES.map((type) => <button type="button" key={type.key} className={filterType === type.key ? "is-selected" : ""} onClick={() => { setFilterType(type.key); setTypeMenuOpen(false); }}><TypeBadge type={type.key} />{filterType === type.key ? <Check size={10} /> : null}</button>)}
              </div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sm-tab-content">
        {activeTab === "module" ? (
          filteredModules.length > 0 ? <div className="sm-card-stack">{filteredModules.map((row) => (
            <SmModuleCard
              key={row.id}
              row={row}
              questionnaireCount={questionnaires.filter((item) => item.moduleIds.includes(row.id)).length}
              onEdit={() => setEditingModule(row)}
              onDuplicate={() => setModules((current) => [...current, { ...structuredClone(row), id: createId("sm-module"), name: `Kopie von ${row.name}`, createdAt: new Date().toISOString(), questions: row.questions.map((item) => ({ ...item, id: createId("sm-question") })) }])}
              onDelete={() => setModules((current) => current.filter((item) => item.id !== row.id))}
            />
          ))}</div> : <div className="sm-empty-card"><Layers3 size={22} /><strong>Keine Module vorhanden</strong><span>Erstelle ein Modul um Fragen thematisch zu gruppieren.</span></div>
        ) : null}

        {activeTab === "fragen" ? (
          filteredQuestions.length > 0 ? <div className="sm-question-list">{filteredQuestions.map(({ row, moduleName }) => <SmQuestionRow key={row.id} row={row} moduleName={moduleName} />)}</div> : <div className="sm-empty-card"><HelpCircle size={22} /><strong>Keine Fragen vorhanden</strong><span>Fragen werden angezeigt, sobald sie in einem SM-Modul liegen.</span></div>
        ) : null}

        {activeTab === "fragebogen" ? (
          filteredQuestionnaires.length > 0 ? <div>{filteredQuestionnaires.map((row) => <SmQuestionnaireCard
            key={row.id}
            row={row}
            modules={modules}
            onEdit={() => setEditingQuestionnaire(row)}
            onDuplicate={() => setQuestionnaires((current) => [...current, { ...row, id: createId("sm-questionnaire"), name: `Kopie von ${row.name}`, status: "inactive", version: 1, createdAt: new Date().toISOString() }])}
            onDelete={() => setQuestionnaires((current) => current.filter((item) => item.id !== row.id))}
          />)}</div> : <div className="sm-empty-card"><ClipboardList size={22} /><strong>Keine Fragebogen vorhanden</strong><span>Erstelle einen Fragebogen um SM-Module zusammenzufassen.</span></div>
        ) : null}
      </div>

      {editingModule !== undefined ? <SmModuleEditor existing={editingModule} existingQuestions={allQuestions.map(({ row }) => row)} onClose={() => setEditingModule(undefined)} onSave={saveModule} /> : null}
      {editingQuestionnaire !== undefined ? <SmFragebogenEditor existing={editingQuestionnaire} modules={modules} onClose={() => setEditingQuestionnaire(undefined)} onSave={saveQuestionnaire} /> : null}

      <style jsx global>{`
        .sm-fb-page{color:#1a1a1a}.sm-preview-notice{margin-bottom:10px;padding:9px 11px;border-radius:8px;border:1px solid rgba(37,99,235,.16);background:rgba(37,99,235,.05);color:#2563eb;font-size:11px;font-weight:600}.sm-tab-shell{border-bottom:1px solid rgba(0,0,0,.06);display:flex;align-items:flex-end}.sm-tabs{display:flex;gap:24px;flex:1}.sm-tabs button{display:flex;align-items:center;gap:6px;padding:8px 0;border:0;border-bottom:2px solid transparent;background:transparent;color:rgba(0,0,0,.4);font-family:inherit;font-size:12px;font-weight:500;line-height:normal;letter-spacing:-.01em;cursor:pointer}.sm-tabs button.is-active{font-weight:650;color:${RED};border-bottom-color:${RED}}.sm-tabs button span{min-width:16px;height:16px;border-radius:8px;padding:0 4px;display:grid;place-items:center;background:rgba(0,0,0,.05);color:rgba(0,0,0,.35);font-size:9px;font-weight:700}.sm-tabs button.is-active span{background:rgba(220,38,38,.08);color:${RED}}.sm-tab-tools{display:flex;align-items:center;gap:10px;margin-bottom:-4px}.sm-tool-divider{width:1px;height:14px;background:rgba(0,0,0,.06)}.sm-search{position:relative;display:flex;align-items:center;color:rgba(0,0,0,.22)}.sm-search input{width:140px;padding:4px 20px 4px 18px;border:0;outline:0;background:transparent;font-family:inherit;font-size:11px;line-height:normal}.sm-search>svg{position:absolute;left:0}.sm-search button{position:absolute;right:0;border:0;background:transparent;padding:0;color:rgba(0,0,0,.25);cursor:pointer}.sm-type-filter{position:relative}.sm-type-filter>button{display:flex;align-items:center;gap:5px;padding:4px 6px 4px 8px;border:0;background:transparent;color:rgba(0,0,0,.35);font-family:inherit;font-size:11px;font-weight:400;line-height:normal;cursor:pointer}.sm-type-filter>button.is-selected{color:${RED};font-weight:600}.sm-type-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:300;min-width:160px;padding:6px 0;border-radius:10px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.09),0 1px 4px rgba(0,0,0,.05)}.sm-type-menu button{width:100%;padding:6px 14px;border:0;background:none;display:flex;align-items:center;justify-content:space-between;font-family:inherit;font-size:11px;font-weight:500;line-height:normal;color:rgba(0,0,0,.55);cursor:pointer}.sm-type-menu button:hover{background:rgba(0,0,0,.03)}.sm-type-menu>div{height:1px;background:rgba(0,0,0,.05);margin:4px 0}.sm-tab-content{margin-top:16px}.sm-card-stack{display:flex;flex-direction:column;gap:8px}.sm-module-card{position:relative;overflow:hidden;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}.sm-module-head{padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}.sm-module-copy{flex:1;min-width:0}.sm-module-copy strong{display:block;font-size:13px;font-weight:600;letter-spacing:-.01em}.sm-module-copy span{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(0,0,0,.35);font-size:10px}.sm-module-stats{display:flex;gap:6px}.sm-module-stats span,.sm-version-pill{padding:3px 8px;border-radius:5px;background:rgba(0,0,0,.04);color:rgba(0,0,0,.45);font-size:9px;font-weight:600}.sm-module-stats span.is-used{background:rgba(220,38,38,.05);color:${RED}}.sm-edit-icon{width:28px;height:28px;border:0;border-radius:6px;background:rgba(0,0,0,.03);display:grid;place-items:center;color:rgba(0,0,0,.35);cursor:pointer}.sm-module-head>svg,.sm-question-row-main>svg,.sm-plain-icon svg{color:rgba(0,0,0,.23);transition:transform .2s}.sm-module-head>svg.is-open,.sm-question-row-main>svg.is-open,.sm-plain-icon svg.is-open{transform:rotate(180deg)}.sm-fingerprint{padding:0 18px 12px;display:flex;gap:4px}.sm-type-badge{display:inline-flex;padding:2px 7px;border-radius:4px;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap}.sm-module-detail{max-height:0;opacity:0;overflow:hidden;transition:max-height .35s cubic-bezier(.4,0,.2,1),opacity .25s}.sm-module-detail.is-open{max-height:1500px;opacity:1}.sm-module-detail-inner{padding:12px 18px 16px;border-top:1px solid rgba(0,0,0,.04)}.sm-module-question{display:flex;align-items:center;gap:8px;padding:6px 0}.sm-question-number{width:18px;height:18px;border-radius:50%;background:linear-gradient(to bottom,#dc2626,#e84040);display:grid;place-items:center;flex:none;color:#fff;font-size:8px;font-weight:700}.sm-question-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#374151;font-size:11px;font-weight:500}.sm-required{font-size:8px;font-weight:600;color:rgba(0,0,0,.25)}.sm-card-footer{display:flex;justify-content:flex-end;margin-top:12px}.sm-dark-button{display:flex;align-items:center;gap:5px;padding:6px 14px;border:0;border-radius:7px;background:linear-gradient(to bottom,#2a2a2a,#1a1a1a);box-shadow:inset 0 1px .6px rgba(255,255,255,.18),0 0 0 1px #111,0 1px 6px rgba(0,0,0,.18);color:#fff;font-family:inherit;font-size:10px;font-weight:600;line-height:normal;cursor:pointer}.sm-context-menu{position:fixed;z-index:20000;min-width:150px;padding:4px;border:1px solid rgba(0,0,0,.07);border-radius:9px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.1)}.sm-context-menu button{width:100%;padding:7px 10px;border:0;border-radius:6px;background:none;display:flex;align-items:center;gap:8px;color:#374151;font-family:inherit;font-size:11px;font-weight:500;line-height:normal;cursor:pointer}.sm-context-menu button:hover{background:rgba(0,0,0,.03)}.sm-context-menu button.danger{color:${RED}}.sm-context-menu>div{height:1px;margin:3px 6px;background:rgba(0,0,0,.05)}.sm-question-list{overflow:hidden;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}.sm-question-row{border-bottom:1px solid rgba(0,0,0,.03)}.sm-question-row-main{width:100%;padding:10px 18px;border:0;background:transparent;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer}.sm-question-row-main:hover{background:rgba(0,0,0,.01)}.sm-origin-pill{max-width:150px;padding:2px 8px;border-radius:4px;background:rgba(220,38,38,.04);color:rgba(220,38,38,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:500}.sm-question-detail{max-height:0;overflow:hidden;transition:max-height .25s}.sm-question-detail.is-open{max-height:320px}.sm-answer-preview,.sm-config-hint{padding:0 18px 12px 30px;color:rgba(0,0,0,.4);font-size:10px}.sm-answer-row{display:flex;align-items:center;gap:7px;padding:3px 0}.sm-radio{width:10px;height:10px;border:1.5px solid rgba(0,0,0,.12);border-radius:50%}.sm-square{width:8px;height:8px;border:1.5px solid rgba(0,0,0,.12);border-radius:2px}.sm-questionnaire-card{margin-bottom:8px;overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}.sm-questionnaire-inner{padding:16px 20px}.sm-questionnaire-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.sm-questionnaire-head>strong{flex:1;font-size:14px;letter-spacing:-.01em}.sm-status-pill{padding:3px 9px;border-radius:20px;font-size:9px;font-weight:650}.sm-status-pill.active{background:rgba(5,150,105,.08);color:#059669}.sm-status-pill.inactive{background:rgba(0,0,0,.05);color:rgba(0,0,0,.4)}.sm-plain-icon{padding:4px;border:0;background:none;color:rgba(0,0,0,.25);cursor:pointer}.sm-module-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}.sm-module-pills span{padding:2px 8px;border-radius:4px;background:rgba(0,0,0,.04);color:rgba(0,0,0,.4);font-size:9px;font-weight:600}.sm-questionnaire-footer{display:flex;align-items:center;gap:16px;color:#059669;font-size:10px;font-weight:600}.sm-questionnaire-actions{margin-left:auto;display:flex;gap:5px}.sm-questionnaire-actions button{padding:4px 9px;border:0;border-radius:6px;background:rgba(0,0,0,.04);color:rgba(0,0,0,.45);font-family:inherit;font-size:9px;font-weight:600;line-height:normal;cursor:pointer}.sm-questionnaire-actions button.danger{color:${RED};background:rgba(220,38,38,.05)}.sm-questionnaire-detail{max-height:0;overflow:hidden;transition:max-height .25s}.sm-questionnaire-detail.is-open{max-height:500px}.sm-questionnaire-detail-inner{padding:14px 20px 16px;border-top:1px solid rgba(0,0,0,.04);background:rgba(0,0,0,.01)}.sm-section-label,.sm-library-title{display:block;margin-bottom:8px;color:rgba(0,0,0,.3);font-size:9px;font-weight:650;text-transform:uppercase;letter-spacing:.05em}.sm-questionnaire-module{display:flex;align-items:center;gap:10px;padding:3px 0}.sm-questionnaire-module>span{width:16px;text-align:right;color:rgba(0,0,0,.2);font-size:9px}.sm-questionnaire-module strong{flex:1;color:#374151;font-size:11px;font-weight:500}.sm-questionnaire-module small{color:rgba(0,0,0,.3);font-size:9px}.sm-created{margin-top:14px;display:flex;align-items:center;gap:5px;color:rgba(0,0,0,.25);font-size:9px}.sm-empty-card{min-height:340px;padding:20px;border-radius:14px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(0,0,0,.18)}.sm-empty-card strong{margin-top:10px;color:rgba(0,0,0,.48);font-size:12px}.sm-empty-card span{margin-top:5px;color:rgba(0,0,0,.28);font-size:10px}.sm-editor-overlay{position:fixed;inset:0;z-index:12000;background:#f5f5f7}.sm-editor-shell{height:100vh;display:flex;flex-direction:column}.sm-editor-header{height:54px;padding:0 16px;border-bottom:1px solid rgba(0,0,0,.07);background:#fff;display:flex;align-items:center;gap:12px}.sm-editor-header>div{flex:1}.sm-editor-header strong{display:block;font-size:12px}.sm-editor-header span{display:block;margin-top:2px;color:rgba(0,0,0,.32);font-size:9px}.sm-editor-close{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:rgba(0,0,0,.4);display:grid;place-items:center;cursor:pointer}.sm-save-button{padding:7px 18px;border:0;border-radius:7px;background:linear-gradient(to bottom,#dc2626,#b91c1c);box-shadow:inset 0 1px .6px rgba(255,255,255,.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.14);color:#fff;font-family:inherit;font-size:10px;font-weight:600;line-height:normal;cursor:pointer}.sm-save-button:disabled{opacity:.4;cursor:not-allowed}.sm-editor-body{min-height:0;flex:1;display:flex}.sm-question-library,.sm-module-library{width:182px;padding:18px 10px;border-right:1px solid rgba(0,0,0,.06);background:#fff;overflow:auto}.sm-question-library>button,.sm-module-library>button{width:100%;padding:8px;border:0;border-radius:7px;background:transparent;display:flex;align-items:center;gap:8px;color:rgba(0,0,0,.55);font-family:inherit;font-size:10px;font-weight:500;line-height:normal;text-align:left;cursor:pointer}.sm-question-library>button:hover,.sm-module-library>button:hover,.sm-module-library>button.is-selected{background:rgba(220,38,38,.05);color:${RED}}.sm-question-library>button span,.sm-module-library>button span{flex:1}.sm-question-library>p{margin:18px 4px;color:rgba(0,0,0,.28);font-size:9px;line-height:1.55}.sm-library-search{margin-bottom:10px;padding:7px 8px;border:1px solid rgba(0,0,0,.08);border-radius:7px;display:flex;align-items:center;gap:6px;color:rgba(0,0,0,.3);font-size:9px}.sm-module-library>button span{display:flex;flex-direction:column;gap:2px}.sm-module-library>button small{color:rgba(0,0,0,.3);font-size:8px}.sm-module-editor-main,.sm-questionnaire-editor-main{flex:1;padding:18px 26px;overflow:auto}.sm-editor-card{margin-bottom:14px;padding:18px;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.03)}.sm-editor-card label{display:flex;flex-direction:column;gap:6px;margin-top:14px;color:rgba(0,0,0,.38);font-size:8px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}.sm-editor-card input:not([type=checkbox]),.sm-editor-card textarea{width:100%;padding:8px 0;border:0;border-bottom:1px solid rgba(0,0,0,.08);outline:0;resize:vertical;color:#1a1a1a;font-family:inherit;font-size:11px;font-weight:500;line-height:normal;text-transform:none;letter-spacing:0}.sm-editor-card textarea{min-height:44px}.sm-editor-card-title{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:650}.sm-editor-card-title b{padding:1px 5px;border-radius:4px;background:rgba(220,38,38,.07);color:${RED};font-size:8px}.sm-editor-empty{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(0,0,0,.2)}.sm-editor-empty strong{margin-top:8px;color:rgba(0,0,0,.43);font-size:11px}.sm-editor-empty span{margin-top:4px;font-size:9px}.sm-question-editor-card{margin-top:12px;padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:10px}.sm-question-editor-head{display:flex;align-items:center;gap:8px}.sm-question-editor-head button{margin-left:auto;border:0;background:none;color:rgba(220,38,38,.45);cursor:pointer}.sm-fixed-options{display:flex;gap:8px;margin-top:12px}.sm-fixed-options span{flex:1;padding:8px;border-radius:7px;background:rgba(0,0,0,.03);color:rgba(0,0,0,.4);font-size:10px}.sm-check-label{flex-direction:row!important;align-items:center;text-transform:none!important;letter-spacing:0!important;font-size:10px!important}.sm-check-label input{accent-color:${RED}}.sm-drop-empty{min-height:90px;border:1px dashed rgba(0,0,0,.1);border-radius:8px;display:grid;place-items:center;color:rgba(0,0,0,.24);font-size:9px}.sm-selected-modules{display:flex;flex-direction:column;gap:5px}.sm-selected-modules>div{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid rgba(0,0,0,.05);border-radius:8px}.sm-selected-modules span{width:18px;color:rgba(0,0,0,.22);font-size:9px}.sm-selected-modules strong{flex:1;font-size:10px}.sm-selected-modules small{color:rgba(0,0,0,.3);font-size:8px}.sm-selected-modules button{border:0;background:none;color:rgba(0,0,0,.25);cursor:pointer}
        /* Keep the SM workspace on the exact Standardbesuch typography contract. */
        .sm-fb-page{font-family:inherit}
        .sm-edit-icon{transition:background-color .12s ease}
        .sm-edit-icon:hover{background:rgba(0,0,0,.06)}
        .sm-type-menu button{font-family:inherit;font-size:11px;font-weight:400;line-height:normal}
        .sm-type-menu button.is-selected{font-weight:600;color:${RED}}
        .sm-type-badge.is-compact{padding:2px 6px;border-radius:3px}
        .sm-origin-pill{max-width:120px}
        .sm-dark-button{font-family:inherit;font-size:10px;font-weight:600;line-height:normal;box-shadow:inset 0 1px .6px rgba(255,255,255,.18),inset 0 -1px 0 rgba(255,255,255,.06),0 0 0 1px #111,0 1px 6px rgba(0,0,0,.18);transition:all .15s ease}
        .sm-context-menu button{font-family:inherit;font-size:11px;font-weight:500;line-height:normal}
        .sm-questionnaire-head>strong{font-weight:700}
        .sm-questionnaire-actions button{font-family:inherit;font-size:9px;font-weight:600;line-height:normal}
        .sm-save-button{font-family:inherit;font-size:10px;font-weight:600;line-height:normal}
        .sm-question-library>button,.sm-module-library>button{font-family:inherit;font-size:10px;font-weight:500;line-height:normal}
        .sm-editor-card input:not([type=checkbox]),.sm-editor-card textarea{font-family:inherit;font-size:11px;font-weight:500;line-height:normal}
      `}</style>
    </div>
  );
}
