"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FilePenLine,
  Home,
  Inbox,
  LogOut,
  MapPin,
  Search,
  Send,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import { CollapsibleMenu, type MenuItem } from "@/components/ui/CollapsibleMenu";
import { logoutCurrentUser } from "@/lib/api/backend";

const RED = "#dc2626";
const GREEN = "#059669";
const AMBER = "#d97706";

type SmAnswerKind = "yesno" | "single" | "text" | "number";

type SmActivityQuestion = {
  id: string;
  module: string;
  label: string;
  kind: SmAnswerKind;
  answer: string;
  options?: string[];
  comment?: string;
};

type SmActivity = {
  id: string;
  market: string;
  address: string;
  date: string;
  submittedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  questionnaire: string;
  questions: SmActivityQuestion[];
};

type SmAnswerRequest = {
  id: string;
  activityId: string;
  questionId: string;
  currentAnswer: string;
  requestedAnswer: string;
  reason: string;
  status: "pending";
  createdAt: string;
};

type SmDeleteRequest = {
  id: string;
  activityId: string;
  reason: string;
  status: "pending";
  createdAt: string;
};

const ACTIVITIES: SmActivity[] = [
  {
    id: "sm-activity-billa-plus",
    market: "Billa Plus",
    address: "Technologiepark 1 · 8380 Jennersdorf",
    date: "13.08.2026",
    submittedAt: "13:34",
    plannedMinutes: 90,
    actualMinutes: 90,
    questionnaire: "Coke Regalservice 2026",
    questions: [
      { id: "bp-oos", module: "OOS & Verfügbarkeit", label: "War bei Einsatzbeginn mindestens ein Coke Produkt OOS?", kind: "yesno", answer: "Ja", options: ["Ja", "Nein"] },
      { id: "bp-fixed", module: "OOS & Verfügbarkeit", label: "Konnte der OOS während des Einsatzes behoben werden?", kind: "yesno", answer: "Ja", options: ["Ja", "Nein"], comment: "Ware aus dem Lager nachgefüllt." },
      { id: "bp-quality", module: "Ausführungsqualität", label: "Regalplatzierung nach Planogramm", kind: "single", answer: "Vollständig", options: ["Vollständig", "Teilweise", "Nicht umgesetzt"] },
      { id: "bp-facing", module: "Ausführungsqualität", label: "Anzahl korrigierter Facings", kind: "number", answer: "8" },
    ],
  },
  {
    id: "sm-activity-eurospar",
    market: "EUROSPAR Urfahr",
    address: "Blütenstraße 13–23 · 4040 Linz",
    date: "12.08.2026",
    submittedAt: "16:18",
    plannedMinutes: 120,
    actualMinutes: 118,
    questionnaire: "Coke Regalservice 2026",
    questions: [
      { id: "eu-oos", module: "OOS & Verfügbarkeit", label: "War bei Einsatzbeginn mindestens ein Coke Produkt OOS?", kind: "yesno", answer: "Nein", options: ["Ja", "Nein"] },
      { id: "eu-quality", module: "Ausführungsqualität", label: "Regalplatzierung nach Planogramm", kind: "single", answer: "Vollständig", options: ["Vollständig", "Teilweise", "Nicht umgesetzt"] },
      { id: "eu-note", module: "Information", label: "Besondere Vorkommnisse im Markt", kind: "text", answer: "Keine besonderen Vorkommnisse." },
    ],
  },
  {
    id: "sm-activity-interspar",
    market: "INTERSPAR Industriezeile",
    address: "Industriezeile 76 · 4020 Linz",
    date: "11.08.2026",
    submittedAt: "14:52",
    plannedMinutes: 150,
    actualMinutes: 150,
    questionnaire: "Coke Regalservice 2026",
    questions: [
      { id: "is-oos", module: "OOS & Verfügbarkeit", label: "War bei Einsatzbeginn mindestens ein Coke Produkt OOS?", kind: "yesno", answer: "Ja", options: ["Ja", "Nein"] },
      { id: "is-fixed", module: "OOS & Verfügbarkeit", label: "Konnte der OOS während des Einsatzes behoben werden?", kind: "yesno", answer: "Nein", options: ["Ja", "Nein"], comment: "Kein Lagerbestand vorhanden." },
      { id: "is-quality", module: "Ausführungsqualität", label: "Regalplatzierung nach Planogramm", kind: "single", answer: "Teilweise", options: ["Vollständig", "Teilweise", "Nicht umgesetzt"] },
    ],
  },
];

const MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/sm", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Aktivitäten", href: "/sm/aktivitaet", icon: <Activity size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", href: "/sm/zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Profil", href: "/sm/profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout", tone: "danger" },
];

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} Min`;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${hours} h`;
}

function requestKey(activityId: string, questionId: string) {
  return `${activityId}:${questionId}`;
}

function AnswerValue({ question }: { question: SmActivityQuestion }) {
  if (question.options?.length) {
    return (
      <div className="sm-act-answer-options">
        {question.options.map((option) => <span key={option} className={option === question.answer ? "selected" : ""}>{option === question.answer ? <Check size={9} /> : null}{option}</span>)}
      </div>
    );
  }
  return <div className="sm-act-answer-text">{question.answer}</div>;
}

function ChangeRequestSheet({
  activity,
  question,
  existing,
  onClose,
  onSubmit,
}: {
  activity: SmActivity;
  question: SmActivityQuestion;
  existing: SmAnswerRequest | null;
  onClose: () => void;
  onSubmit: (requestedAnswer: string, reason: string) => void;
}) {
  const [answer, setAnswer] = useState(existing?.requestedAnswer ?? question.answer);
  const [reason, setReason] = useState(existing?.reason ?? "");
  const valid = answer.trim().length > 0 && answer.trim() !== question.answer.trim() && reason.trim().length >= 3;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <div className="sm-act-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sm-act-sheet" role="dialog" aria-modal="true" aria-labelledby="sm-act-request-title">
        <header><div><span>Fragebogen</span><h3 id="sm-act-request-title">{existing ? "Anfrage ansehen" : "Änderung anfragen"}</h3></div><button type="button" onClick={onClose} aria-label="Schließen"><X size={14} /></button></header>
        <div className="sm-act-sheet-market"><Store size={13} /><div><strong>{activity.market}</strong><span>{activity.date} · {activity.questionnaire}</span></div></div>
        <div className="sm-act-sheet-question"><span>Frage</span><strong>{question.label}</strong><small>Aktuell: {question.answer}</small></div>
        {existing ? (
          <div className="sm-act-existing-request">
            <span><Clock size={10} /> Prüfung offen</span>
            <div><small>Gewünschte Antwort</small><strong>{existing.requestedAnswer}</strong></div>
            <div><small>Begründung</small><p>{existing.reason}</p></div>
          </div>
        ) : (
          <>
            <label className="sm-act-field"><span>Gewünschte Antwort *</span>
              {question.options?.length ? (
                <div className="sm-act-choice-list">{question.options.map((option) => <button type="button" key={option} className={answer === option ? "selected" : ""} onClick={() => setAnswer(option)}>{answer === option ? <Check size={10} /> : null}{option}</button>)}</div>
              ) : <textarea rows={2} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Korrekte Antwort eintragen …" />}
            </label>
            <label className="sm-act-field"><span>Begründung *</span><textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Kurz erklären, warum die Antwort geändert werden soll …" /><small>{reason.trim().length < 3 ? "Eine kurze Begründung ist erforderlich." : `${reason.length}/500`}</small></label>
          </>
        )}
        <footer><button type="button" className="secondary" onClick={onClose}>Schließen</button>{!existing ? <button type="button" className="primary" disabled={!valid} onClick={() => onSubmit(answer.trim(), reason.trim())}><Send size={10} /> Anfrage senden</button> : null}</footer>
      </section>
    </div>
  );
}

function DeleteRequestSheet({ activity, existing, onClose, onSubmit }: { activity: SmActivity; existing: SmDeleteRequest | null; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(existing?.reason ?? "");
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return (
    <div className="sm-act-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sm-act-sheet" role="dialog" aria-modal="true" aria-labelledby="sm-act-delete-title">
        <header><div><span>Fragebogen</span><h3 id="sm-act-delete-title">Löschung anfragen</h3></div><button type="button" onClick={onClose} aria-label="Schließen"><X size={14} /></button></header>
        <div className="sm-act-delete-warning"><Trash2 size={14} /><div><strong>{existing ? "Löschanfrage ist offen" : "Einreichung löschen lassen"}</strong><p>Nur dieser abgeschlossene Fragebogen wird nach Admin-Freigabe entfernt. Einsatz, Planung, Soll-/Ist-Zeit und Pauschale bleiben unverändert.</p></div></div>
        <label className="sm-act-field"><span>Begründung *</span><textarea disabled={Boolean(existing)} rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Warum soll die Einreichung gelöscht werden?" /><small>{existing ? "Die Anfrage wird geprüft." : reason.trim().length < 3 ? "Eine kurze Begründung ist erforderlich." : `${reason.length}/500`}</small></label>
        <footer><button type="button" className="secondary" onClick={onClose}>Schließen</button>{!existing ? <button type="button" className="primary danger" disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}><Trash2 size={10} /> Löschung anfragen</button> : null}</footer>
      </section>
    </div>
  );
}

function ActivityViewer({
  activity,
  answerRequests,
  deleteRequest,
  onClose,
  onQuestionRequest,
  onDeleteRequest,
}: {
  activity: SmActivity;
  answerRequests: Record<string, SmAnswerRequest>;
  deleteRequest: SmDeleteRequest | null;
  onClose: () => void;
  onQuestionRequest: (question: SmActivityQuestion) => void;
  onDeleteRequest: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return (
    <div className="sm-act-viewer-backdrop">
      <section className="sm-act-viewer">
        <header className="sm-act-viewer-head"><button type="button" onClick={onClose} aria-label="Zurück"><ArrowLeft size={15} /></button><div><span>Abgeschlossener Fragebogen</span><h2>{activity.market}</h2></div><button type="button" onClick={onClose} aria-label="Schließen"><X size={15} /></button></header>
        <div className="sm-act-viewer-meta"><div><MapPin size={11} /><span>{activity.address}</span></div><div><Clock size={11} /><span>{activity.date} · {activity.submittedAt}</span></div></div>
        <div className="sm-act-delete-bar"><div><Trash2 size={12} /><span>{deleteRequest ? "Löschanfrage offen" : "Falschen Fragebogen eingereicht?"}</span></div><button type="button" className={deleteRequest ? "pending" : ""} onClick={onDeleteRequest}>{deleteRequest ? "Ansehen" : "Löschung anfragen"}</button></div>
        <div className="sm-act-viewer-strip"><div><span>Fragebogen</span><strong>{activity.questionnaire}</strong></div><div><span>Zeit</span><strong>{duration(activity.actualMinutes)} / {duration(activity.plannedMinutes)}</strong></div><div><span>Fragen</span><strong>{activity.questions.length}/{activity.questions.length}</strong></div></div>
        <div className="sm-act-question-list">
          {activity.questions.map((question, index) => {
            const request = answerRequests[requestKey(activity.id, question.id)] ?? null;
            return (
              <article key={question.id} className="sm-act-question-card">
                <div className="sm-act-question-meta"><span>{String(index + 1).padStart(2, "0")}</span><small>{question.module}</small></div>
                <h3>{question.label}</h3>
                <AnswerValue question={question} />
                {question.comment ? <div className="sm-act-comment"><span>Kommentar</span>{question.comment}</div> : null}
                <div className="sm-act-question-action">{request ? <button type="button" className="pending" onClick={() => onQuestionRequest(question)}><Clock size={10} /> Anfrage offen</button> : <button type="button" onClick={() => onQuestionRequest(question)}><FilePenLine size={10} /> Änderung anfragen</button>}</div>
              </article>
            );
          })}
        </div>
        <footer className="sm-act-viewer-footer"><button type="button" onClick={onClose}>Schließen</button><span><CheckCircle2 size={11} /> Read-only</span></footer>
      </section>
    </div>
  );
}

export default function SmActivityPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "requests">("all");
  const [selectedActivity, setSelectedActivity] = useState<SmActivity | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<SmActivityQuestion | null>(null);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [answerRequests, setAnswerRequests] = useState<Record<string, SmAnswerRequest>>({});
  const [deleteRequests, setDeleteRequests] = useState<Record<string, SmDeleteRequest>>({});
  const requestCount = Object.keys(answerRequests).length + Object.keys(deleteRequests).length;
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de-AT");
    return ACTIVITIES.filter((activity) => {
      const hasRequest = Boolean(deleteRequests[activity.id]) || activity.questions.some((question) => Boolean(answerRequests[requestKey(activity.id, question.id)]));
      if (filter === "requests" && !hasRequest) return false;
      return !needle || `${activity.market} ${activity.address} ${activity.questionnaire}`.toLocaleLowerCase("de-AT").includes(needle);
    });
  }, [answerRequests, deleteRequests, filter, search]);

  return (
    <main className="sm-act-page">
      <style>{`
        .sm-act-page { min-height:100dvh; overflow-x:hidden; padding-bottom:108px; background:#f5f5f7; color:rgba(15,23,42,.92); font-family:var(--font-inter),Inter,system-ui,sans-serif; }
        .sm-act-page * { box-sizing:border-box; }
        .sm-act-shell { width:100%; max-width:440px; margin:0 auto; padding:24px 16px 30px; }
        .sm-act-header span { color:rgba(220,38,38,.62); font-size:8px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
        .sm-act-header h1 { margin:5px 0 0; font-size:26px; line-height:1.05; font-weight:780; letter-spacing:-.025em; }
        .sm-act-header p { margin:7px 0 0; color:rgba(15,23,42,.43); font-size:11px; font-weight:580; line-height:1.45; }
        .sm-act-stats { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:17px; }
        .sm-act-stat { min-height:79px; padding:12px; border:1px solid rgba(15,23,42,.06); border-radius:15px; background:rgba(255,255,255,.94); box-shadow:0 2px 8px rgba(15,23,42,.035),0 14px 32px rgba(15,23,42,.035); }
        .sm-act-stat div { display:flex; align-items:center; justify-content:space-between; color:rgba(15,23,42,.34); font-size:7px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .sm-act-stat i { width:24px; height:24px; display:grid; place-items:center; border-radius:8px; background:rgba(220,38,38,.055); color:${RED}; font-style:normal; }
        .sm-act-stat strong { display:block; margin-top:9px; font-size:20px; line-height:1; font-weight:800; }
        .sm-act-stat small { display:block; margin-top:5px; color:rgba(15,23,42,.36); font-size:8px; font-weight:620; }
        .sm-act-toolbar { margin-top:12px; padding:8px; border:1px solid rgba(15,23,42,.06); border-radius:14px; background:rgba(255,255,255,.9); box-shadow:0 2px 8px rgba(15,23,42,.03); }
        .sm-act-search { height:34px; display:flex; align-items:center; gap:7px; padding:0 10px; border-radius:9px; background:rgba(15,23,42,.035); color:rgba(15,23,42,.3); }
        .sm-act-search input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:rgba(15,23,42,.76); font:inherit; font-size:9px; font-weight:650; }
        .sm-act-filters { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:7px; padding:3px; border-radius:9px; background:rgba(15,23,42,.03); }
        .sm-act-filters button { height:27px; border:0; border-radius:7px; background:transparent; color:rgba(15,23,42,.38); font:inherit; font-size:8px; font-weight:750; }
        .sm-act-filters button.active { background:#fff; color:rgba(15,23,42,.8); box-shadow:0 1px 5px rgba(15,23,42,.06),inset 0 0 0 1px rgba(15,23,42,.055); }
        .sm-act-list { display:grid; gap:10px; margin-top:12px; }
        .sm-act-card { width:100%; padding:13px; border:1px solid rgba(15,23,42,.06); border-radius:16px; background:rgba(255,255,255,.95); box-shadow:0 2px 8px rgba(15,23,42,.035),0 15px 34px rgba(15,23,42,.038); text-align:left; font:inherit; }
        .sm-act-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .sm-act-card-pill { height:20px; display:inline-flex; align-items:center; padding:0 7px; border-radius:999px; background:rgba(5,150,105,.07); color:${GREEN}; font-size:7px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; box-shadow:inset 0 0 0 1px rgba(5,150,105,.1); }
        .sm-act-card-date { color:rgba(15,23,42,.34); font-size:8px; font-weight:700; }
        .sm-act-card h2 { margin:10px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; font-weight:790; letter-spacing:-.015em; }
        .sm-act-card-address { display:flex; align-items:center; gap:5px; margin-top:5px; color:rgba(15,23,42,.4); font-size:8px; font-weight:600; }
        .sm-act-card-address span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-act-card-grid { display:grid; grid-template-columns:repeat(3,1fr); margin-top:12px; padding:9px 0; border-top:1px solid rgba(15,23,42,.05); border-bottom:1px solid rgba(15,23,42,.05); }
        .sm-act-card-grid div { padding:0 8px; border-left:1px solid rgba(15,23,42,.05); }
        .sm-act-card-grid div:first-child { padding-left:0; border-left:0; }
        .sm-act-card-grid span,.sm-act-card-grid strong { display:block; }
        .sm-act-card-grid span { color:rgba(15,23,42,.3); font-size:6.5px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
        .sm-act-card-grid strong { margin-top:3px; font-size:9px; font-weight:780; }
        .sm-act-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:10px; color:${GREEN}; font-size:8px; font-weight:750; }
        .sm-act-card-footer .request { color:${AMBER}; }
        .sm-act-empty { min-height:180px; display:grid; place-items:center; align-content:center; gap:7px; margin-top:12px; border:1px dashed rgba(15,23,42,.09); border-radius:16px; color:rgba(15,23,42,.34); background:rgba(255,255,255,.55); text-align:center; }
        .sm-act-empty strong { color:rgba(15,23,42,.58); font-size:11px; }
        .sm-act-empty span { max-width:230px; font-size:8px; line-height:1.45; }
        .sm-act-viewer-backdrop,.sm-act-sheet-backdrop { position:fixed; inset:0; z-index:12000; display:grid; place-items:center; padding:12px; background:rgba(15,23,42,.32); backdrop-filter:blur(5px); }
        .sm-act-viewer { width:min(430px,100%); max-height:calc(100dvh - 24px); display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(255,255,255,.7); border-radius:19px; background:#f5f5f7; box-shadow:0 25px 70px rgba(15,23,42,.25); }
        .sm-act-viewer-head { min-height:60px; display:grid; grid-template-columns:30px minmax(0,1fr) 30px; align-items:center; gap:8px; padding:9px 12px; border-bottom:1px solid rgba(15,23,42,.06); background:rgba(255,255,255,.95); }
        .sm-act-viewer-head button,.sm-act-sheet header button { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:8px; background:rgba(15,23,42,.035); color:rgba(15,23,42,.45); }
        .sm-act-viewer-head div { min-width:0; }
        .sm-act-viewer-head span,.sm-act-sheet header span { display:block; color:rgba(220,38,38,.58); font-size:6.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .sm-act-viewer-head h2 { margin:3px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:790; }
        .sm-act-viewer-meta { display:grid; gap:5px; padding:10px 14px; border-bottom:1px solid rgba(15,23,42,.05); background:#fff; }
        .sm-act-viewer-meta div { display:flex; align-items:center; gap:6px; color:rgba(15,23,42,.42); font-size:8px; font-weight:620; }
        .sm-act-delete-bar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:10px 10px 0; padding:9px 10px; border:1px solid rgba(220,38,38,.08); border-radius:11px; background:rgba(220,38,38,.035); }
        .sm-act-delete-bar div { display:flex; align-items:center; gap:6px; color:rgba(120,20,20,.62); font-size:8px; font-weight:700; }
        .sm-act-delete-bar button { height:24px; padding:0 8px; border:1px solid rgba(220,38,38,.12); border-radius:7px; background:#fff; color:${RED}; font:inherit; font-size:7px; font-weight:800; }
        .sm-act-delete-bar button.pending { border-color:rgba(217,119,6,.1); color:${AMBER}; background:rgba(245,158,11,.06); }
        .sm-act-viewer-strip { display:grid; grid-template-columns:1.4fr 1fr .65fr; gap:0; margin:9px 10px 0; padding:9px 0; border:1px solid rgba(15,23,42,.055); border-radius:11px; background:rgba(255,255,255,.85); }
        .sm-act-viewer-strip div { min-width:0; padding:0 9px; border-left:1px solid rgba(15,23,42,.05); }
        .sm-act-viewer-strip div:first-child { border-left:0; }
        .sm-act-viewer-strip span,.sm-act-viewer-strip strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-act-viewer-strip span { color:rgba(15,23,42,.3); font-size:6px; font-weight:750; text-transform:uppercase; }
        .sm-act-viewer-strip strong { margin-top:3px; font-size:8px; font-weight:760; }
        .sm-act-question-list { min-height:0; overflow:auto; display:grid; gap:8px; padding:10px; scrollbar-width:none; }
        .sm-act-question-list::-webkit-scrollbar { display:none; }
        .sm-act-question-card { padding:12px; border:1px solid rgba(15,23,42,.06); border-radius:14px; background:rgba(255,255,255,.95); box-shadow:0 2px 8px rgba(15,23,42,.025); }
        .sm-act-question-meta { display:flex; align-items:center; gap:7px; }
        .sm-act-question-meta span { width:20px; height:20px; display:grid; place-items:center; border-radius:7px; background:rgba(220,38,38,.07); color:${RED}; font-size:7px; font-weight:800; }
        .sm-act-question-meta small { color:rgba(15,23,42,.34); font-size:6.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
        .sm-act-question-card h3 { margin:10px 0 0; font-size:10px; line-height:1.42; font-weight:730; }
        .sm-act-answer-options { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .sm-act-answer-options span { min-height:25px; display:inline-flex; align-items:center; gap:4px; padding:0 9px; border-radius:8px; background:rgba(15,23,42,.035); color:rgba(15,23,42,.38); font-size:8px; font-weight:700; }
        .sm-act-answer-options span.selected { background:rgba(5,150,105,.07); color:${GREEN}; box-shadow:inset 0 0 0 1px rgba(5,150,105,.12); }
        .sm-act-answer-text { margin-top:10px; padding:9px 10px; border-radius:9px; background:rgba(15,23,42,.03); color:rgba(15,23,42,.68); font-size:9px; font-weight:650; line-height:1.45; }
        .sm-act-comment { margin-top:8px; padding:8px 9px; border-radius:9px; background:rgba(220,38,38,.035); color:rgba(120,20,20,.58); font-size:8px; line-height:1.4; }
        .sm-act-comment span { display:block; margin-bottom:3px; color:rgba(220,38,38,.5); font-size:6px; font-weight:800; text-transform:uppercase; }
        .sm-act-question-action { display:flex; justify-content:flex-end; margin-top:10px; padding-top:9px; border-top:1px solid rgba(15,23,42,.05); }
        .sm-act-question-action button { height:25px; display:inline-flex; align-items:center; gap:5px; padding:0 8px; border:1px solid rgba(5,150,105,.13); border-radius:7px; background:#fff; color:${GREEN}; font:inherit; font-size:7px; font-weight:780; }
        .sm-act-question-action button.pending { border-color:rgba(217,119,6,.12); background:rgba(245,158,11,.055); color:${AMBER}; }
        .sm-act-viewer-footer { min-height:46px; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-top:1px solid rgba(15,23,42,.06); background:#fff; }
        .sm-act-viewer-footer button { height:28px; padding:0 10px; border:1px solid rgba(15,23,42,.07); border-radius:8px; background:#fff; color:rgba(15,23,42,.5); font:inherit; font-size:8px; font-weight:750; }
        .sm-act-viewer-footer span { display:flex; align-items:center; gap:4px; color:${GREEN}; font-size:7px; font-weight:750; }
        .sm-act-sheet { width:min(390px,100%); overflow:hidden; border:1px solid rgba(15,23,42,.06); border-radius:16px; background:#fff; box-shadow:0 24px 70px rgba(15,23,42,.25); }
        .sm-act-sheet header { min-height:58px; display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid rgba(15,23,42,.055); }
        .sm-act-sheet header h3 { margin:3px 0 0; font-size:13px; font-weight:780; }
        .sm-act-sheet-market { display:grid; grid-template-columns:25px minmax(0,1fr); align-items:center; gap:7px; margin:12px 13px 0; padding:9px; border-radius:10px; background:rgba(15,23,42,.025); color:${RED}; }
        .sm-act-sheet-market strong,.sm-act-sheet-market span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-act-sheet-market strong { color:rgba(15,23,42,.76); font-size:9px; }
        .sm-act-sheet-market span { margin-top:2px; color:rgba(15,23,42,.36); font-size:7px; }
        .sm-act-sheet-question { margin:11px 13px 0; }
        .sm-act-sheet-question span,.sm-act-field > span { display:block; margin-bottom:5px; color:rgba(15,23,42,.34); font-size:6.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
        .sm-act-sheet-question strong { display:block; font-size:9px; line-height:1.4; }
        .sm-act-sheet-question small { display:block; margin-top:5px; color:rgba(15,23,42,.4); font-size:8px; }
        .sm-act-field { display:block; margin:12px 13px 0; }
        .sm-act-field textarea { width:100%; padding:9px; border:1px solid rgba(15,23,42,.075); border-radius:9px; outline:0; resize:none; color:rgba(15,23,42,.76); background:#fff; font:inherit; font-size:9px; font-weight:620; line-height:1.45; }
        .sm-act-field textarea:disabled { background:rgba(15,23,42,.025); color:rgba(15,23,42,.48); }
        .sm-act-field > small { display:block; margin-top:4px; color:rgba(220,38,38,.58); font-size:6.5px; text-align:right; }
        .sm-act-choice-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
        .sm-act-choice-list button { min-height:31px; display:flex; align-items:center; justify-content:center; gap:4px; border:1px solid rgba(15,23,42,.07); border-radius:8px; background:#fff; color:rgba(15,23,42,.48); font:inherit; font-size:8px; font-weight:700; }
        .sm-act-choice-list button.selected { border-color:rgba(5,150,105,.13); background:rgba(5,150,105,.055); color:${GREEN}; }
        .sm-act-existing-request { display:grid; gap:10px; margin:12px 13px; padding:11px; border:1px solid rgba(217,119,6,.11); border-radius:10px; background:rgba(245,158,11,.045); }
        .sm-act-existing-request > span { width:max-content; display:flex; align-items:center; gap:4px; padding:5px 7px; border-radius:999px; background:rgba(245,158,11,.09); color:#b45309; font-size:7px; font-weight:780; }
        .sm-act-existing-request small,.sm-act-existing-request strong { display:block; }
        .sm-act-existing-request small { color:rgba(15,23,42,.34); font-size:6.5px; font-weight:750; text-transform:uppercase; }
        .sm-act-existing-request strong,.sm-act-existing-request p { margin:3px 0 0; color:rgba(15,23,42,.7); font-size:9px; line-height:1.4; }
        .sm-act-delete-warning { display:flex; gap:8px; margin:12px 13px 0; padding:10px; border:1px solid rgba(220,38,38,.1); border-radius:10px; background:rgba(220,38,38,.035); color:${RED}; }
        .sm-act-delete-warning strong { display:block; color:rgba(120,20,20,.72); font-size:9px; }
        .sm-act-delete-warning p { margin:4px 0 0; color:rgba(15,23,42,.46); font-size:7.5px; font-weight:600; line-height:1.45; }
        .sm-act-sheet footer { display:flex; justify-content:flex-end; gap:7px; margin-top:13px; padding:10px 13px; border-top:1px solid rgba(15,23,42,.055); background:rgba(15,23,42,.012); }
        .sm-act-sheet footer button { height:30px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:0 11px; border-radius:8px; font:inherit; font-size:8px; font-weight:780; }
        .sm-act-sheet footer .secondary { border:1px solid rgba(15,23,42,.07); background:#fff; color:rgba(15,23,42,.48); }
        .sm-act-sheet footer .primary { border:1px solid rgba(255,255,255,.3); background:linear-gradient(180deg,#10b981,#059669); color:#fff; box-shadow:0 4px 10px rgba(5,150,105,.16),inset 0 1px 0 rgba(255,255,255,.22); }
        .sm-act-sheet footer .primary.danger { background:linear-gradient(180deg,#f43f46,#d71920); box-shadow:0 4px 10px rgba(215,25,32,.16),inset 0 1px 0 rgba(255,255,255,.22); }
        .sm-act-sheet footer .primary:disabled { opacity:.38; box-shadow:none; }
        @media (max-width:520px) { .sm-act-viewer-backdrop { align-items:stretch; padding:0 0 78px; background:#f5f5f7; backdrop-filter:none; } .sm-act-viewer { width:100%; max-height:none; border:0; border-radius:0; box-shadow:none; } .sm-act-sheet-backdrop { align-items:end; padding:0; } .sm-act-sheet { width:100%; padding-bottom:env(safe-area-inset-bottom); border-radius:16px 16px 0 0; } }
      `}</style>

      <div className="sm-act-shell">
        <header className="sm-act-header"><span>Aktivitäten</span><h1>Meine Fragebögen</h1><p>Abgeschlossene Einsätze ansehen und Korrekturen anfragen.</p></header>
        <section className="sm-act-stats">
          <article className="sm-act-stat"><div>Abgeschlossen<i><ClipboardCheck size={12} /></i></div><strong>{ACTIVITIES.length}</strong><small>Fragebögen verfügbar</small></article>
          <article className="sm-act-stat"><div>Anfragen<i style={{ color: requestCount ? AMBER : GREEN, background: requestCount ? "rgba(245,158,11,.07)" : "rgba(5,150,105,.06)" }}><Inbox size={12} /></i></div><strong style={{ color: requestCount ? AMBER : GREEN }}>{requestCount}</strong><small>{requestCount ? "werden geprüft" : "keine offenen"}</small></article>
        </section>
        <section className="sm-act-toolbar"><label className="sm-act-search"><Search size={11} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Markt oder Fragebogen suchen …" /></label><div className="sm-act-filters"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Alle</button><button type="button" className={filter === "requests" ? "active" : ""} onClick={() => setFilter("requests")}>Mit Anfrage {requestCount ? `(${requestCount})` : ""}</button></div></section>
        {filtered.length ? <section className="sm-act-list">{filtered.map((activity) => {
          const activityRequestCount = activity.questions.filter((question) => Boolean(answerRequests[requestKey(activity.id, question.id)])).length + (deleteRequests[activity.id] ? 1 : 0);
          return <button key={activity.id} type="button" className="sm-act-card" onClick={() => setSelectedActivity(activity)}><div className="sm-act-card-top"><span className="sm-act-card-pill">Abgeschlossen</span><span className="sm-act-card-date">{activity.date} · {activity.submittedAt}</span></div><h2>{activity.market}</h2><div className="sm-act-card-address"><MapPin size={10} /><span>{activity.address}</span></div><div className="sm-act-card-grid"><div><span>Ist / Soll</span><strong>{duration(activity.actualMinutes)} / {duration(activity.plannedMinutes)}</strong></div><div><span>Fragen</span><strong>{activity.questions.length}/{activity.questions.length}</strong></div><div><span>Status</span><strong style={{ color: activityRequestCount ? AMBER : GREEN }}>{activityRequestCount ? "Prüfung" : "Fertig"}</strong></div></div><div className="sm-act-card-footer"><span className={activityRequestCount ? "request" : ""}>{activityRequestCount ? `${activityRequestCount} Anfrage${activityRequestCount === 1 ? "" : "n"} offen` : <><CheckCircle2 size={10} /> Read-only ansehen</>}</span><ChevronRight size={13} /></div></button>;
        })}</section> : <div className="sm-act-empty"><Inbox size={20} /><strong>Keine Fragebögen gefunden</strong><span>Für diese Suche oder Auswahl gibt es aktuell keine abgeschlossenen Einsätze.</span></div>}
      </div>

      {selectedActivity ? <ActivityViewer activity={selectedActivity} answerRequests={answerRequests} deleteRequest={deleteRequests[selectedActivity.id] ?? null} onClose={() => setSelectedActivity(null)} onQuestionRequest={setSelectedQuestion} onDeleteRequest={() => setDeleteSheetOpen(true)} /> : null}
      {selectedActivity && selectedQuestion ? <ChangeRequestSheet activity={selectedActivity} question={selectedQuestion} existing={answerRequests[requestKey(selectedActivity.id, selectedQuestion.id)] ?? null} onClose={() => setSelectedQuestion(null)} onSubmit={(requestedAnswer, reason) => { const key = requestKey(selectedActivity.id, selectedQuestion.id); setAnswerRequests((current) => ({ ...current, [key]: { id:`sm-answer-request-${Date.now()}`, activityId:selectedActivity.id, questionId:selectedQuestion.id, currentAnswer:selectedQuestion.answer, requestedAnswer, reason, status:"pending", createdAt:new Date().toISOString() } })); setSelectedQuestion(null); }} /> : null}
      {selectedActivity && deleteSheetOpen ? <DeleteRequestSheet activity={selectedActivity} existing={deleteRequests[selectedActivity.id] ?? null} onClose={() => setDeleteSheetOpen(false)} onSubmit={(reason) => { setDeleteRequests((current) => ({ ...current, [selectedActivity.id]: { id:`sm-delete-request-${Date.now()}`, activityId:selectedActivity.id, reason, status:"pending", createdAt:new Date().toISOString() } })); setDeleteSheetOpen(false); }} /> : null}

      <div className="fixed bottom-6 left-0 right-0 z-50"><CollapsibleMenu items={MENU_ITEMS} enableKurti featureKurti={false} kurtiMaxWidth={420} enableClickToggle defaultIndex={1} onSelect={(_index, item) => { if (item.action === "logout") { logoutCurrentUser(); if (typeof window !== "undefined") { window.location.assign("/"); return; } router.replace("/"); router.refresh(); return; } if (item.href) router.push(item.href); }} /></div>
    </main>
  );
}
