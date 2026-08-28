"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FilePenLine,
  Home,
  LogOut,
  LoaderCircle,
  MoreHorizontal,
  Send,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import { CollapsibleMenu, type MenuItem } from "@/components/ui/CollapsibleMenu";
import { fetchMySmPlanningAssignments, logoutCurrentUser, requestMySmPlanningTimeChange } from "@/lib/api/backend";
import type { SmPlanningAssignment, SmPlanningStatus, SmTimeChangeRequest } from "@/types/smPlanning";

const RED = "#DC2626";
const GREEN = "#059669";

type Assignment = {
  id: string;
  market: string;
  address: string;
  planned: number;
  actual: number | null;
  travel: number;
  total: number | null;
  questionnaireComplete: boolean;
  status: SmPlanningStatus;
  visitStartedAt: string | null;
  visitCompletedAt: string | null;
  submittedAt: string | null;
};

type WorkDay = {
  id: string;
  weekday: string;
  date: string;
  today?: boolean;
  assignments: Assignment[];
};

type SmTimeRequest = SmTimeChangeRequest;

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangeForPeriod(period: "week" | "month" | "all"): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  if (period === "week") {
    const weekday = (today.getDay() + 6) % 7;
    from.setDate(today.getDate() - weekday);
  } else if (period === "month") {
    from.setDate(1);
  } else {
    from.setDate(today.getDate() - 92);
  }
  return { from: toDateInputValue(from), to: toDateInputValue(today) };
}

function calendarWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function mapAssignment(row: SmPlanningAssignment): Assignment {
  const travel = row.visit?.travelMinutes ?? 0;
  return {
    id: row.id,
    market: row.effective.marketName,
    address: row.effective.address,
    planned: row.effective.plannedMinutes,
    actual: row.actualMinutes,
    travel,
    total: row.actualMinutes === null ? null : row.actualMinutes + travel,
    questionnaireComplete: row.questionnaireComplete,
    status: row.status,
    visitStartedAt: row.visit?.visitStartedAt ?? null,
    visitCompletedAt: row.visit?.visitCompletedAt ?? null,
    submittedAt: row.visit?.submittedAt ?? null,
  };
}

function buildDays(rows: SmPlanningAssignment[]): WorkDay[] {
  const groups = new Map<string, Assignment[]>();
  for (const row of rows.filter((entry) => entry.status !== "cancelled")) {
    const date = row.effective.workDate;
    groups.set(date, [...(groups.get(date) ?? []), mapAssignment(row)]);
  }
  const today = toDateInputValue(new Date());
  return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, assignments]) => {
    const parsed = new Date(`${date}T12:00:00`);
    return {
      id: date,
      weekday: parsed.toLocaleDateString("de-AT", { weekday: "long" }),
      date: parsed.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
      today: date === today,
      assignments,
    };
  });
}

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
  if (!rest) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, "0")} min`;
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timestampRange(startedAt: string | null, completedAt: string | null, fallbackMinutes: number | null): string {
  if (!startedAt || !completedAt) return fallbackMinutes === null ? "—" : duration(fallbackMinutes);
  const format = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${format.format(new Date(startedAt))} – ${format.format(new Date(completedAt))}`;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="sm-zeit-metric">
      <span>{label}</span>
      <strong style={{ color: accent }}>{value}</strong>
    </div>
  );
}

function TimeRequestDialog({
  assignment,
  existingRequest,
  onClose,
  onSubmit,
}: {
  assignment: Assignment;
  existingRequest: SmTimeRequest | null;
  onClose: () => void;
  onSubmit: (request: { assignmentId: string; kind: "time_change" | "deletion"; requestedStartedAt: string | null; requestedCompletedAt: string | null; reason: string; clientRequestToken: string }) => Promise<void>;
}) {
  const currentMinutes = assignment.actual ?? 0;
  const [kind, setKind] = useState<SmTimeRequest["kind"]>(existingRequest?.kind ?? "time_change");
  const [startedAt, setStartedAt] = useState(() => toDateTimeLocalValue(existingRequest?.requestedStartedAt ?? assignment.visitStartedAt));
  const [completedAt, setCompletedAt] = useState(() => toDateTimeLocalValue(existingRequest?.requestedCompletedAt ?? assignment.visitCompletedAt));
  const [reason, setReason] = useState(existingRequest?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clientRequestToken] = useState(() => crypto.randomUUID());
  const requestedStartedAt = localDateTimeToIso(startedAt);
  const requestedCompletedAt = localDateTimeToIso(completedAt);
  const elapsedMs = requestedStartedAt && requestedCompletedAt ? new Date(requestedCompletedAt).getTime() - new Date(requestedStartedAt).getTime() : 0;
  const requestedMinutes = elapsedMs > 0 ? Math.max(1, Math.round(elapsedMs / 60_000)) : null;
  const timestampsUnchanged = startedAt === toDateTimeLocalValue(assignment.visitStartedAt) && completedAt === toDateTimeLocalValue(assignment.visitCompletedAt) && requestedMinutes === currentMinutes;
  const reasonValid = reason.trim().length >= 3;
  const timeError = !requestedStartedAt || !requestedCompletedAt
    ? "Bitte Start- und Endzeit vollständig eintragen."
    : elapsedMs <= 0
      ? "Die Endzeit muss nach der Startzeit liegen."
      : elapsedMs > 24 * 60 * 60 * 1_000
        ? "Der Einsatz darf höchstens 24 Stunden dauern."
        : timestampsUnchanged
          ? "Bitte mindestens einen Zeitstempel ändern."
          : null;
  const timeValid = timeError === null;
  const canSubmit = !existingRequest && reasonValid && (kind === "deletion" || timeValid);

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ assignmentId: assignment.id, kind, requestedStartedAt: kind === "time_change" ? requestedStartedAt : null, requestedCompletedAt: kind === "time_change" ? requestedCompletedAt : null, reason: reason.trim(), clientRequestToken });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Die Korrekturanfrage konnte nicht gesendet werden.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return (
    <div className="sm-request-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sm-request-dialog" role="dialog" aria-modal="true" aria-labelledby="sm-request-title">
        <header className="sm-request-header">
          <div>
            <span>Zeiterfassung</span>
            <h3 id="sm-request-title">{existingRequest ? "Anfrage ansehen" : "Korrektur anfragen"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Anfrage schließen"><X size={15} /></button>
        </header>

        <div className="sm-request-market">
          <span className="sm-request-market-icon"><Store size={12} /></span>
          <div><strong>{assignment.market}</strong><span>{assignment.address}</span></div>
          <div><span>Ist-Zeit</span><strong>{duration(currentMinutes)}</strong></div>
        </div>

        {existingRequest ? (
            <div className="sm-request-existing">
            <span className="sm-request-status"><Clock size={10} /> Prüfung offen</span>
            <h4>{existingRequest.kind === "time_change" ? "Zeitänderung" : "Löschung"}</h4>
            {existingRequest.kind === "time_change" ? (
              <div className="sm-request-comparison"><span>{timestampRange(existingRequest.originalStartedAt, existingRequest.originalCompletedAt, existingRequest.originalMinutes)}</span><b>→</b><strong>{timestampRange(existingRequest.requestedStartedAt, existingRequest.requestedCompletedAt, existingRequest.requestedMinutes)}</strong></div>
            ) : <p>Die erfasste Ist-Zeit soll gelöscht werden. Die Verplanung bleibt bestehen.</p>}
            <div className="sm-request-reason"><span>Begründung</span><p>{existingRequest.reason}</p></div>
          </div>
        ) : (
          <>
            <div className="sm-request-kind" aria-label="Anfragetyp">
              <button type="button" className={kind === "time_change" ? "active" : ""} onClick={() => setKind("time_change")}>
                <FilePenLine size={13} /><span><strong>Zeit ändern</strong><small>Start und Ende neu setzen</small></span>
              </button>
              <button type="button" className={kind === "deletion" ? "active danger" : ""} onClick={() => setKind("deletion")}>
                <Trash2 size={13} /><span><strong>Löschung</strong><small>Erfassung entfernen lassen</small></span>
              </button>
            </div>

            {kind === "time_change" ? (
              <div className="sm-request-time-block">
                <label>Neue Zeitstempel</label>
                <div className="sm-request-time-inputs">
                  <label><span>Start</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} aria-label="Neue Startzeit" /></label>
                  <label><span>Ende</span><input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} aria-label="Neue Endzeit" /></label>
                </div>
                {timeError ? <small>{timeError}</small> : <div className="sm-request-time-result"><Clock size={10} /><span>Neue Ist-Zeit</span><strong>{duration(requestedMinutes ?? 0)}</strong></div>}
              </div>
            ) : (
              <div className="sm-request-delete-note"><Trash2 size={13} /><p>Die erfasste Ist-Zeit wird nach Freigabe gelöscht. Einsatz, Soll-Zeit und Verplanung bleiben erhalten.</p></div>
            )}

            <label className="sm-request-note">
              <span>Begründung *</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Kurz beschreiben, was korrigiert werden soll …" />
              <small>{reason.trim().length < 3 ? "Eine kurze Begründung ist erforderlich." : `${reason.length}/500`}</small>
            </label>
          </>
        )}

        <footer className="sm-request-footer">
          <button type="button" className="secondary" onClick={onClose}>Schließen</button>
          {!existingRequest ? (
            <button type="button" className="primary" disabled={!canSubmit || saving} onClick={() => { void submit(); }}>
              {saving ? <LoaderCircle className="sm-request-spinner" size={11} /> : <Send size={11} />} Anfrage senden
            </button>
          ) : null}
        </footer>
        {submitError ? <p className="sm-request-error" role="alert">{submitError}</p> : null}
      </section>
    </div>
  );
}

function AssignmentRow({ assignment, first, last, request, onRequest, onOpen }: { assignment: Assignment; first: boolean; last: boolean; request: SmTimeRequest | null; onRequest: (assignment: Assignment) => void; onOpen: (assignment: Assignment) => void }) {
  const complete = assignment.actual !== null && assignment.questionnaireComplete;

  return (
    <div className="sm-zeit-assignment">
      <div className="sm-zeit-timeline">
        {!first ? <span className="line top" /> : null}
        {!last ? <span className="line bottom" /> : null}
        <span className={`icon${complete ? " complete" : ""}`}><Store size={10} strokeWidth={2} /></span>
      </div>

      <div className="sm-zeit-assignment-copy">
        <span className="sm-zeit-eyebrow">Einsatz</span>
        <strong className="sm-zeit-market">{assignment.market}</strong>
        <span className="sm-zeit-address">{assignment.address}</span>
        <div className="sm-zeit-badges">
          <span className={`sm-zeit-badge${complete ? " complete" : " open"}`}>
            {complete ? <CheckCircle2 size={9} /> : <Clock size={9} />}
            {complete ? "Abgeschlossen" : "Ausstehend"}
          </span>
          <span className={`sm-zeit-badge questionnaire${assignment.questionnaireComplete ? " complete" : ""}`}>
            <ClipboardCheck size={9} />
            {assignment.questionnaireComplete ? "Fragebogen fertig" : "Fragebogen offen"}
          </span>
          {assignment.travel > 0 ? <span className="sm-zeit-badge travel"><Clock size={9} />{duration(assignment.travel)} Fahrt</span> : null}
        </div>
      </div>

      <div className="sm-zeit-assignment-values">
        <div><span>Soll</span><strong>{duration(assignment.planned)}</strong></div>
        <div><span>Ist gesamt</span><strong className={assignment.total !== null ? "complete" : ""}>{assignment.total === null ? "–" : duration(assignment.total)}</strong></div>
        {!complete ? (
          <button type="button" className="sm-zeit-open-action" onClick={() => onOpen(assignment)}>Öffnen <span aria-hidden="true">→</span></button>
        ) : request ? (
          <button type="button" className="sm-zeit-request-pending" onClick={() => onRequest(assignment)}><Clock size={10} /> Anfrage offen</button>
        ) : (
          <div className="sm-zeit-done-actions"><span className="sm-zeit-done"><CheckCircle2 size={12} /> Erledigt</span><button type="button" className="sm-zeit-request-trigger" onClick={() => onRequest(assignment)} aria-label={`Korrektur für ${assignment.market} anfragen`}><MoreHorizontal size={13} /></button></div>
        )}
      </div>
    </div>
  );
}

function DayRow({ day, requests, onRequest, onOpen, expandedInitially = false }: { day: WorkDay; requests: Record<string, SmTimeRequest>; onRequest: (assignment: Assignment) => void; onOpen: (assignment: Assignment) => void; expandedInitially?: boolean }) {
  const [expanded, setExpanded] = useState(expandedInitially);
  const completed = day.assignments.filter((item) => item.actual !== null && item.questionnaireComplete).length;
  const planned = day.assignments.reduce((sum, item) => sum + item.planned, 0);
  const actual = day.assignments.reduce((sum, item) => sum + (item.total ?? 0), 0);
  const questionnaires = day.assignments.filter((item) => item.questionnaireComplete).length;
  const allComplete = completed === day.assignments.length;

  return (
    <div className="sm-zeit-day">
      <button type="button" className="sm-zeit-day-button" onClick={() => setExpanded((value) => !value)}>
        <div className="sm-zeit-day-title">
          <div><strong>{day.weekday}, {day.date}</strong>{day.today ? <span>Heute</span> : null}</div>
          <small>{day.assignments.length} {day.assignments.length === 1 ? "Einsatz" : "Einsätze"}</small>
        </div>
        <Metric label="Einsätze erledigt" value={`${completed}/${day.assignments.length}`} accent={allComplete ? GREEN : RED} />
        <Metric label="Soll-Zeit" value={duration(planned)} />
        <Metric label="Ist-Zeit" value={duration(actual)} accent={allComplete ? GREEN : undefined} />
        <Metric label="Fragebögen" value={`${questionnaires}/${day.assignments.length}`} accent={questionnaires === day.assignments.length ? GREEN : RED} />
        <ChevronDown size={14} strokeWidth={2.1} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>

      <div className="sm-zeit-mobile-summary">
        <Metric label="Einsätze" value={`${completed}/${day.assignments.length}`} accent={allComplete ? GREEN : RED} />
        <Metric label="Soll" value={duration(planned)} />
        <Metric label="Ist" value={duration(actual)} accent={allComplete ? GREEN : undefined} />
      </div>

      <div className="sm-zeit-day-content" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div>
          <div className="sm-zeit-assignment-list">
            {day.assignments.map((assignment, index) => (
              <AssignmentRow key={assignment.id} assignment={assignment} first={index === 0} last={index === day.assignments.length - 1} request={requests[assignment.id] ?? null} onRequest={onRequest} onOpen={onOpen} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodSwitch({ value, onChange }: { value: "week" | "month" | "all"; onChange: (value: "week" | "month" | "all") => void }) {
  return (
    <div className="sm-zeit-period">
      {([['week', 'Woche'], ['month', 'Monat'], ['all', 'Alle']] as const).map(([key, label]) => (
        <button key={key} type="button" className={value === key ? "active" : ""} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  );
}

export default function SmZeiterfassungPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [rows, setRows] = useState<SmPlanningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const range = useMemo(() => rangeForPeriod(period), [period]);
  const loadRows = useCallback(async () => {
    const result = await fetchMySmPlanningAssignments(range.from, range.to);
    setRows(result);
    setLoadError(null);
  }, [range.from, range.to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMySmPlanningAssignments(range.from, range.to)
      .then((result) => {
        if (!active) return;
        setRows(result);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Die Zeiterfassung konnte nicht geladen werden.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to]);

  const days = useMemo(() => buildDays(rows), [rows]);
  const requests = useMemo(() => Object.fromEntries(rows.flatMap((row) => row.pendingTimeChangeRequest ? [[row.id, row.pendingTimeChangeRequest] as const] : [])), [rows]);
  const allAssignments = days.flatMap((day) => day.assignments);
  const completed = allAssignments.filter((item) => item.actual !== null && item.questionnaireComplete).length;
  const planned = allAssignments.reduce((sum, item) => sum + item.planned, 0);
  const actual = allAssignments.reduce((sum, item) => sum + (item.total ?? 0), 0);
  const travel = allAssignments.reduce((sum, item) => sum + item.travel, 0);
  const completion = allAssignments.length ? Math.round((completed / allAssignments.length) * 100) : 0;
  const timeProgress = planned ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  const week = calendarWeek(new Date());

  const submitTimeRequest = useCallback(async (request: { assignmentId: string; kind: "time_change" | "deletion"; requestedStartedAt: string | null; requestedCompletedAt: string | null; reason: string; clientRequestToken: string }) => {
    await requestMySmPlanningTimeChange(request.assignmentId, {
      kind: request.kind,
      requestedStartedAt: request.requestedStartedAt,
      requestedCompletedAt: request.requestedCompletedAt,
      reason: request.reason,
      clientRequestToken: request.clientRequestToken,
    });
    await loadRows();
    setSelectedAssignment(null);
  }, [loadRows]);

  const openAssignment = useCallback((assignment: Assignment) => {
    router.push(`/sm/marktbesuch?assignmentId=${encodeURIComponent(assignment.id)}`);
  }, [router]);

  return (
    <main className="sm-zeit-page">
      <style>{`
        .sm-zeit-page {
          min-height: 100dvh;
          overflow-x: hidden;
          background: #f5f5f7;
          color: rgba(15,23,42,.92);
          font-family: var(--font-inter), Inter, system-ui, sans-serif;
          padding-bottom: 112px;
        }
        .sm-zeit-page *, .sm-zeit-page *::before, .sm-zeit-page *::after { box-sizing: border-box; }
        .sm-zeit-shell { width: 100%; max-width: 960px; margin: 0 auto; padding: 28px 40px 36px; }
        .sm-zeit-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
        .sm-zeit-header-label, .sm-zeit-eyebrow { font-size: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(15,23,42,.32); }
        .sm-zeit-header-label { margin-bottom: 5px; font-size: 9px; color: rgba(220,38,38,.62); }
        .sm-zeit-header h1 { margin: 0; font-size: 26px; line-height: 1.08; font-weight: 700; letter-spacing: -.02em; }
        .sm-zeit-header p { margin: 7px 0 0; max-width: 440px; font-size: 12px; line-height: 1.55; font-weight: 560; color: rgba(15,23,42,.48); }
        .sm-zeit-week-pill { height: 28px; display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 0 10px; border-radius: 999px; background: #fff; box-shadow: 0 1px 5px rgba(15,23,42,.06), inset 0 0 0 1px rgba(15,23,42,.06); font-size: 10px; font-weight: 750; color: rgba(15,23,42,.48); }
        .sm-zeit-card { background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
        .sm-zeit-stats { display: grid; grid-template-columns: minmax(250px,.95fr) minmax(340px,1.35fr); gap: 12px; padding: 12px; }
        .sm-zeit-primary { position: relative; padding: 16px; border-radius: 12px; border: 1px solid rgba(5,150,105,.12); background: radial-gradient(circle at 92% 4%,rgba(5,150,105,.14),transparent 34%),linear-gradient(180deg,rgba(5,150,105,.045),rgba(15,23,42,.012)); }
        .sm-zeit-primary-value { margin-top: 7px; font-size: 30px; line-height: 1; font-weight: 750; letter-spacing: -.02em; color: ${GREEN}; }
        .sm-zeit-caption { margin-top: 6px; font-size: 10px; font-weight: 650; color: rgba(15,23,42,.42); }
        .sm-zeit-progress-copy { display: flex; justify-content: space-between; margin-top: 15px; margin-bottom: 7px; font-size: 9px; font-weight: 700; color: rgba(15,23,42,.42); }
        .sm-zeit-progress { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(15,23,42,.055); }
        .sm-zeit-progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#059669,#12b981); }
        .sm-zeit-secondary { display: grid; grid-template-columns: minmax(0,1fr); gap: 10px; min-width: 0; }
        .sm-zeit-time-account { position: relative; border: 1px solid rgba(15,23,42,.055); border-radius: 12px; background: rgba(15,23,42,.018); }
        .sm-zeit-time-account { padding: 15px; }
        .sm-zeit-time-value { display: flex; align-items: baseline; gap: 8px; margin-top: 7px; }
        .sm-zeit-time-value strong { font-size: 28px; line-height: 1; font-weight: 750; letter-spacing: -.02em; white-space: nowrap; }
        .sm-zeit-time-value span { font-size: 10px; font-weight: 700; color: ${RED}; white-space: nowrap; }
        .sm-zeit-time-account .sm-zeit-progress > span { background: linear-gradient(90deg,#dc2626,#fb7185); }
        .sm-zeit-week { margin-top: 12px; padding: 14px 16px; }
        .sm-zeit-week-grid { display: grid; grid-template-columns: 180px minmax(180px,1fr) minmax(250px,380px); align-items: center; gap: 22px; }
        .sm-zeit-week-copy strong { display: block; margin-top: 3px; font-size: 11px; font-weight: 650; color: rgba(15,23,42,.48); }
        .sm-zeit-legend { display: flex; justify-content: center; gap: 10px; font-size: 9px; font-weight: 700; color: rgba(15,23,42,.32); }
        .sm-zeit-week-days { position: relative; display: grid; grid-template-columns: repeat(5,1fr); height: 28px; }
        .sm-zeit-week-days::before { content: ''; position: absolute; left: 10%; right: 10%; top: 12px; height: 2px; border-radius: 99px; background: rgba(15,23,42,.06); }
        .sm-zeit-week-days::after { content: ''; position: absolute; left: 10%; width: 60%; top: 12px; height: 2px; border-radius: 99px; background: rgba(220,38,38,.6); }
        .sm-zeit-week-day { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
        .sm-zeit-week-day i { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid rgba(220,38,38,.78); background: ${RED}; }
        .sm-zeit-week-day.future i { border-color: rgba(15,23,42,.1); background: #fff; }
        .sm-zeit-week-day span { font-size: 9px; font-style: normal; font-weight: 750; color: rgba(15,23,42,.7); }
        .sm-zeit-week-day.future span { color: rgba(15,23,42,.26); }
        .sm-zeit-main { margin-top: 16px; overflow: hidden; }
        .sm-zeit-main-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 16px 13px; border-bottom: 1px solid rgba(15,23,42,.055); }
        .sm-zeit-main-header h2 { margin: 4px 0 0; font-size: 15px; font-weight: 700; }
        .sm-zeit-period { display: inline-flex; gap: 2px; padding: 3px; border-radius: 9px; background: rgba(15,23,42,.045); }
        .sm-zeit-period button { height: 24px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: rgba(15,23,42,.42); font-family: inherit; font-size: 9px; font-weight: 700; }
        .sm-zeit-period button.active { background: #fff; color: rgba(15,23,42,.86); box-shadow: 0 1px 4px rgba(15,23,42,.08); }
        .sm-zeit-day + .sm-zeit-day { border-top: 1px solid rgba(15,23,42,.045); }
        .sm-zeit-day-button { width: 100%; display: grid; grid-template-columns: minmax(190px,1.3fr) repeat(4,minmax(72px,.72fr)) 18px; align-items: center; gap: 12px; padding: 13px 16px; border: 0; background: transparent; text-align: left; font-family: inherit; }
        .sm-zeit-day-title { min-width: 0; }
        .sm-zeit-day-title > div { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .sm-zeit-day-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; }
        .sm-zeit-day-title > div > span { height: 18px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 999px; background: rgba(220,38,38,.08); color: ${RED}; font-size: 8px; font-weight: 700; text-transform: uppercase; }
        .sm-zeit-day-title small { display: block; margin-top: 3px; font-size: 10px; font-weight: 600; color: rgba(15,23,42,.36); }
        .sm-zeit-metric { min-width: 0; }
        .sm-zeit-metric span { display: block; margin-bottom: 3px; font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(15,23,42,.32); }
        .sm-zeit-metric strong { display: block; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .sm-zeit-day-button > svg { color: rgba(15,23,42,.32); transition: transform .24s ease; }
        .sm-zeit-mobile-summary { display: none; }
        .sm-zeit-day-content { display: grid; transition: grid-template-rows .3s cubic-bezier(.4,0,.2,1); }
        .sm-zeit-day-content > div { min-height: 0; overflow: hidden; }
        .sm-zeit-assignment-list { margin: 0 14px 16px; padding: 4px 12px; border: 1px solid rgba(15,23,42,.055); border-radius: 13px; background: linear-gradient(180deg,rgba(15,23,42,.018),rgba(15,23,42,.006)); }
        .sm-zeit-assignment { min-height: 68px; display: flex; align-items: stretch; gap: 10px; border-bottom: 1px solid rgba(15,23,42,.04); }
        .sm-zeit-assignment:last-child { border-bottom: 0; }
        .sm-zeit-timeline { position: relative; width: 28px; flex: 0 0 28px; align-self: stretch; display: flex; justify-content: center; }
        .sm-zeit-timeline .line { position: absolute; width: 1px; background: rgba(15,23,42,.08); }
        .sm-zeit-timeline .line.top { top: 0; bottom: calc(50% + 9px); }
        .sm-zeit-timeline .line.bottom { top: calc(50% + 9px); bottom: 0; }
        .sm-zeit-timeline .icon { position: absolute; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; display: grid; place-items: center; border-radius: 7px; background: rgba(220,38,38,.055); color: ${RED}; box-shadow: inset 0 0 0 1px rgba(220,38,38,.14); }
        .sm-zeit-timeline .icon.complete { background: rgba(5,150,105,.07); color: ${GREEN}; box-shadow: inset 0 0 0 1px rgba(5,150,105,.16); }
        .sm-zeit-assignment-copy { min-width: 0; flex: 1; align-self: center; padding: 10px 0; }
        .sm-zeit-market, .sm-zeit-address { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sm-zeit-market { margin-top: 2px; font-size: 12px; font-weight: 780; }
        .sm-zeit-address { margin-top: 2px; font-size: 9px; font-weight: 600; color: rgba(15,23,42,.38); }
        .sm-zeit-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
        .sm-zeit-badge { height: 19px; display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; border-radius: 999px; font-size: 8px; font-weight: 750; white-space: nowrap; }
        .sm-zeit-badge.open { background: rgba(220,38,38,.065); color: ${RED}; }
        .sm-zeit-badge.complete { background: rgba(5,150,105,.07); color: #047857; }
        .sm-zeit-badge.questionnaire { background: rgba(15,23,42,.035); color: rgba(15,23,42,.38); }
        .sm-zeit-badge.travel { background: rgba(59,130,246,.07); color: #2563eb; }
        .sm-zeit-assignment-values { min-width: 245px; display: grid; grid-template-columns: 62px 62px minmax(92px,auto); align-items: center; gap: 9px; padding: 10px 0; text-align: right; }
        .sm-zeit-assignment-values > div { display: grid; gap: 3px; }
        .sm-zeit-assignment-values > div span { font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(15,23,42,.3); }
        .sm-zeit-assignment-values strong { font-size: 10px; font-weight: 750; white-space: nowrap; }
        .sm-zeit-assignment-values strong.complete, .sm-zeit-done { color: ${GREEN}; }
        .sm-zeit-open-action { justify-self: end; height: 27px; min-width: 78px; padding: 0 9px; border: 1px solid rgba(255,255,255,.34); border-radius: 8px; background: linear-gradient(180deg,#f43f46,#d71920); color: #fff; box-shadow: 0 5px 10px rgba(215,25,32,.19),inset 0 1px 0 rgba(255,255,255,.25); font-family: inherit; font-size: 8px; font-weight: 820; white-space: nowrap; }
        .sm-zeit-open-action span { margin-left: 3px; font-size: 10px; line-height: 1; }
        .sm-zeit-done { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 9px; font-weight: 700; }
        .sm-zeit-done-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
        .sm-zeit-request-trigger { width: 25px; height: 25px; display: grid; place-items: center; border: 1px solid rgba(15,23,42,.06); border-radius: 7px; background: #fff; color: rgba(15,23,42,.4); box-shadow: 0 1px 3px rgba(15,23,42,.04); }
        .sm-zeit-request-pending { justify-self: end; height: 25px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid rgba(217,119,6,.12); border-radius: 999px; background: rgba(245,158,11,.08); color: #b45309; font-family: inherit; font-size: 8px; font-weight: 750; white-space: nowrap; }
        .sm-request-backdrop { position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center; padding: 18px; background: rgba(15,23,42,.32); backdrop-filter: blur(4px); }
        .sm-request-dialog { width: min(390px,100%); overflow: hidden; border: 1px solid rgba(15,23,42,.07); border-radius: 16px; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,.24); }
        .sm-request-header { height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid rgba(15,23,42,.055); }
        .sm-request-header span { display: block; margin-bottom: 2px; color: rgba(220,38,38,.62); font-size: 7px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
        .sm-request-header h3 { margin: 0; font-size: 14px; font-weight: 750; }
        .sm-request-header button { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px; background: rgba(15,23,42,.035); color: rgba(15,23,42,.42); }
        .sm-request-market { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; margin: 14px 14px 0; padding: 11px; border: 1px solid rgba(15,23,42,.055); border-radius: 11px; background: rgba(15,23,42,.018); }
        .sm-request-market-icon { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: rgba(220,38,38,.06); color: ${RED}; }
        .sm-request-market > div:nth-child(2) { min-width: 0; }
        .sm-request-market > div:nth-child(2) strong,.sm-request-market > div:nth-child(2) span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sm-request-market > div:nth-child(2) strong { font-size: 10px; font-weight: 750; }
        .sm-request-market > div:nth-child(2) span { margin-top: 2px; color: rgba(15,23,42,.38); font-size: 7px; font-weight: 600; }
        .sm-request-market > div:last-child { text-align: right; }
        .sm-request-market > div:last-child span { display: block; color: rgba(15,23,42,.32); font-size: 7px; font-weight: 700; text-transform: uppercase; }
        .sm-request-market > div:last-child strong { display: block; margin-top: 3px; font-size: 10px; }
        .sm-request-kind { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; margin: 12px 14px 0; }
        .sm-request-kind button { min-width: 0; display: flex; align-items: center; gap: 8px; padding: 9px; border: 1px solid rgba(15,23,42,.07); border-radius: 10px; background: #fff; color: rgba(15,23,42,.4); font-family: inherit; text-align: left; }
        .sm-request-kind button.active { border-color: rgba(220,38,38,.18); background: rgba(220,38,38,.045); color: ${RED}; }
        .sm-request-kind button span { min-width: 0; }
        .sm-request-kind strong,.sm-request-kind small { display: block; }
        .sm-request-kind strong { font-size: 9px; font-weight: 750; color: rgba(15,23,42,.78); }
        .sm-request-kind small { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; color: rgba(15,23,42,.36); font-size: 7px; font-weight: 600; white-space: nowrap; }
        .sm-request-time-block { margin: 13px 14px 0; }
        .sm-request-time-block > label,.sm-request-note > span,.sm-request-reason > span { display: block; margin-bottom: 6px; color: rgba(15,23,42,.36); font-size: 7px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
        .sm-request-time-inputs { display: grid; gap: 7px; }
        .sm-request-time-inputs label { min-width: 0; height: 40px; display: grid; grid-template-columns: 44px minmax(0,1fr); align-items: center; border: 1px solid rgba(15,23,42,.075); border-radius: 9px; background: #fff; overflow: hidden; }
        .sm-request-time-inputs input { min-width: 0; width: 100%; height: 100%; padding: 0 9px; border: 0; border-left: 1px solid rgba(15,23,42,.055); outline: 0; background: transparent; color: rgba(15,23,42,.82); font-family: inherit; font-size: 9px; font-weight: 700; }
        .sm-request-time-inputs label span { padding-left: 10px; color: rgba(15,23,42,.38); font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .sm-request-time-block > small,.sm-request-note > small { display: block; margin-top: 5px; color: rgba(220,38,38,.6); font-size: 7px; font-weight: 600; }
        .sm-request-time-result { display: flex; align-items: center; gap: 5px; margin-top: 7px; padding: 0 2px; color: rgba(15,23,42,.36); font-size: 7px; }
        .sm-request-time-result strong { margin-left: auto; color: ${GREEN}; font-size: 8px; }
        .sm-request-delete-note { display: flex; gap: 8px; margin: 13px 14px 0; padding: 10px; border: 1px solid rgba(220,38,38,.1); border-radius: 9px; background: rgba(220,38,38,.035); color: ${RED}; }
        .sm-request-delete-note p { margin: 0; color: rgba(15,23,42,.5); font-size: 8px; font-weight: 600; line-height: 1.45; }
        .sm-request-note { display: block; margin: 13px 14px 15px; }
        .sm-request-note textarea { width: 100%; padding: 9px; border: 1px solid rgba(15,23,42,.075); border-radius: 9px; outline: 0; resize: none; color: rgba(15,23,42,.84); background: #fff; font-family: inherit; font-size: 9px; font-weight: 600; line-height: 1.45; }
        .sm-request-note > small { color: rgba(15,23,42,.3); text-align: right; }
        .sm-request-existing { margin: 13px 14px 15px; padding: 12px; border: 1px solid rgba(245,158,11,.13); border-radius: 11px; background: rgba(245,158,11,.045); }
        .sm-request-status { height: 20px; display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; border-radius: 999px; background: rgba(245,158,11,.1); color: #b45309; font-size: 7px; font-weight: 750; }
        .sm-request-existing h4 { margin: 10px 0 0; font-size: 11px; }
        .sm-request-existing > p { margin: 5px 0 0; color: rgba(15,23,42,.5); font-size: 8px; line-height: 1.5; }
        .sm-request-comparison { display: grid; grid-template-columns: minmax(0,1fr) 12px minmax(0,1fr); align-items: center; gap: 5px; margin-top: 7px; font-size: 8px; line-height: 1.45; }
        .sm-request-comparison span { color: rgba(15,23,42,.38); text-decoration: line-through; }
        .sm-request-comparison b { color: rgba(15,23,42,.25); }
        .sm-request-comparison strong { color: ${GREEN}; }
        .sm-request-reason { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(15,23,42,.055); }
        .sm-request-reason p { margin: 0; color: rgba(15,23,42,.6); font-size: 8px; font-weight: 600; line-height: 1.5; }
        .sm-request-footer { display: flex; justify-content: flex-end; gap: 7px; padding: 11px 14px; border-top: 1px solid rgba(15,23,42,.055); background: rgba(15,23,42,.012); }
        .sm-request-footer button { height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 12px; border-radius: 8px; font-family: inherit; font-size: 8px; font-weight: 750; }
        .sm-request-footer .secondary { border: 1px solid rgba(15,23,42,.07); background: #fff; color: rgba(15,23,42,.5); }
        .sm-request-footer .primary { border: 1px solid rgba(255,255,255,.3); background: linear-gradient(180deg,#f43f46,#d71920); color: #fff; box-shadow: 0 4px 9px rgba(215,25,32,.17),inset 0 1px 0 rgba(255,255,255,.25); }
        .sm-request-footer .primary:disabled { opacity: .38; box-shadow: none; }
        .sm-request-spinner { animation: smZeitSpin .8s linear infinite; }
        .sm-request-error { margin: 0; padding: 8px 14px; border-top: 1px solid rgba(220,38,38,.08); background: rgba(220,38,38,.035); color: ${RED}; font-size: 8px; font-weight: 650; line-height: 1.4; }
        .sm-zeit-loading,.sm-zeit-empty,.sm-zeit-error { min-height: 210px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 28px; color: rgba(15,23,42,.36); text-align: center; font-size: 10px; font-weight: 650; }
        .sm-zeit-empty svg { width: 38px; height: 38px; padding: 9px; border-radius: 12px; background: rgba(220,38,38,.06); color: ${RED}; }
        .sm-zeit-empty strong { color: rgba(15,23,42,.78); font-size: 12px; }
        .sm-zeit-empty span { font-size: 9px; font-weight: 550; }
        .sm-zeit-error { color: ${RED}; }
        .sm-zeit-error button { height: 27px; padding: 0 10px; border: 1px solid rgba(220,38,38,.14); border-radius: 8px; background: #fff; color: ${RED}; font-family: inherit; font-size: 8px; font-weight: 750; }
        @keyframes smZeitSpin { to { transform: rotate(360deg); } }
        @media (max-width: 780px) {
          .sm-zeit-shell { max-width: 420px; padding: 15px 12px 24px; }
          .sm-zeit-header { align-items: center; margin-bottom: 11px; }
          .sm-zeit-header-label { margin-bottom: 3px; font-size: 8px; }
          .sm-zeit-header h1 { font-size: 21px; }
          .sm-zeit-header p { max-width: 245px; margin-top: 4px; font-size: 9px; line-height: 1.4; }
          .sm-zeit-week-pill { height: 25px; padding: 0 8px; border-radius: 8px; font-size: 8px; }
          .sm-zeit-card { border-radius: 12px; }
          .sm-zeit-stats { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; padding: 8px; }
          .sm-zeit-primary { min-width: 0; padding: 11px; border-radius: 10px; }
          .sm-zeit-primary-value { margin-top: 5px; font-size: 23px; }
          .sm-zeit-primary-value, .sm-zeit-time-value { height: 33px; min-height: 33px; }
          .sm-zeit-caption { min-height: 15px; margin-top: 4px; font-size: 8px; }
          .sm-zeit-progress-copy { margin-top: 10px; margin-bottom: 5px; font-size: 7px; }
          .sm-zeit-progress { height: 5px; }
          .sm-zeit-secondary { display: contents; }
          .sm-zeit-time-account { min-width: 0; padding: 11px; border-radius: 10px; }
          .sm-zeit-time-value { display: block; margin-top: 5px; }
          .sm-zeit-time-value strong { display: block; overflow: hidden; text-overflow: ellipsis; font-size: 19px; white-space: nowrap; }
          .sm-zeit-time-value span { display: block; margin-top: 3px; font-size: 7px; }
          .sm-zeit-week { margin-top: 8px; padding: 10px 11px; }
          .sm-zeit-week-grid { grid-template-columns: 74px minmax(0,1fr); gap: 8px; }
          .sm-zeit-week-copy strong { margin-top: 2px; font-size: 9px; }
          .sm-zeit-legend { display: none; }
          .sm-zeit-week-days { width: 100%; min-width: 0; height: 24px; }
          .sm-zeit-week-days::before, .sm-zeit-week-days::after { top: 10px; }
          .sm-zeit-week-day { gap: 3px; }
          .sm-zeit-week-day i { width: 8px; height: 8px; }
          .sm-zeit-week-day span { font-size: 7px; }
          .sm-zeit-main { margin-top: 9px; }
          .sm-zeit-main-header { padding: 10px 11px 9px; }
          .sm-zeit-main-header h2 { margin-top: 2px; font-size: 13px; }
          .sm-zeit-period { padding: 2px; border-radius: 8px; }
          .sm-zeit-period button { height: 22px; padding: 0 8px; border-radius: 6px; font-size: 8px; }
          .sm-zeit-day-button { grid-template-columns: minmax(0,1fr) 14px; gap: 6px; padding: 9px 11px 5px; }
          .sm-zeit-day-title strong { font-size: 11px; }
          .sm-zeit-day-title > div > span { height: 16px; padding: 0 6px; font-size: 7px; }
          .sm-zeit-day-title small { margin-top: 2px; font-size: 8px; }
          .sm-zeit-day-button > .sm-zeit-metric { display: none; }
          .sm-zeit-day-button > svg { grid-column: 2; grid-row: 1; }
          .sm-zeit-mobile-summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 0 10px 7px; padding: 6px 0; border: 1px solid rgba(15,23,42,.05); border-radius: 8px; background: rgba(15,23,42,.012); }
          .sm-zeit-mobile-summary .sm-zeit-metric { padding: 0 6px; text-align: center; border-right: 1px solid rgba(15,23,42,.05); }
          .sm-zeit-mobile-summary .sm-zeit-metric:last-child { border-right: 0; }
          .sm-zeit-mobile-summary .sm-zeit-metric span { margin-bottom: 2px; font-size: 6px; }
          .sm-zeit-mobile-summary .sm-zeit-metric strong { font-size: 9px; }
          .sm-zeit-assignment-list { margin: 0 8px 9px; padding: 2px 8px; border-radius: 10px; }
          .sm-zeit-assignment { display: grid; grid-template-columns: 20px minmax(0,1fr); column-gap: 6px; min-height: 0; padding: 6px 0 7px; }
          .sm-zeit-timeline { width: 20px; grid-column: 1; grid-row: 1 / span 2; }
          .sm-zeit-timeline .icon { width: 16px; height: 16px; border-radius: 6px; }
          .sm-zeit-assignment-copy { grid-column: 2; min-width: 0; padding: 0; }
          .sm-zeit-market { margin-top: 1px; font-size: 10px; }
          .sm-zeit-address { margin-top: 1px; font-size: 7px; }
          .sm-zeit-badges { gap: 3px; margin-top: 4px; }
          .sm-zeit-badge { height: 16px; gap: 3px; padding: 0 5px; font-size: 6px; }
          .sm-zeit-assignment-values { grid-column: 2; min-width: 0; width: 100%; grid-template-columns: 42px 42px minmax(0,1fr); gap: 4px; padding: 5px 0 0; text-align: left; }
          .sm-zeit-assignment-values > div { gap: 1px; }
          .sm-zeit-assignment-values > div span { font-size: 6px; }
          .sm-zeit-assignment-values strong { font-size: 8px; }
          .sm-zeit-open-action { width: auto; min-width: 67px; height: 23px; padding: 0 7px; border-radius: 7px; font-size: 7px; }
          .sm-zeit-done { font-size: 7px; }
          .sm-zeit-done { justify-content: flex-end; }
          .sm-zeit-request-trigger { width: 23px; height: 23px; border-radius: 6px; }
          .sm-zeit-request-pending { height: 23px; padding: 0 6px; font-size: 7px; }
          .sm-request-backdrop { align-items: end; padding: 0; }
          .sm-request-dialog { width: 100%; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom); animation: smRequestUp .22s ease both; }
          @keyframes smRequestUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        }
        @media (max-width: 360px) {
          .sm-zeit-shell { padding-left: 9px; padding-right: 9px; }
          .sm-zeit-header p { max-width: 205px; }
          .sm-zeit-primary, .sm-zeit-time-account { padding: 9px; }
          .sm-zeit-time-value strong { font-size: 17px; }
          .sm-zeit-assignment-values { grid-template-columns: 38px 38px minmax(0,1fr); gap: 3px; }
        }
      `}</style>

      <div className="sm-zeit-shell">
        <header className="sm-zeit-header">
          <div>
            <div className="sm-zeit-header-label">Zeiterfassung</div>
            <h1>Meine Einsätze</h1>
            <p>Soll-Zeit, Ist-Zeit und Fragebogenstatus im Überblick.</p>
          </div>
          <span className="sm-zeit-week-pill"><CalendarDays size={11} strokeWidth={2} /> KW {week}</span>
        </header>

        <section className="sm-zeit-card sm-zeit-stats">
          <div className="sm-zeit-primary">
            <span className="sm-zeit-eyebrow">Woche bisher</span>
            <div className="sm-zeit-primary-value">{completed}/{allAssignments.length}</div>
            <div className="sm-zeit-caption">Einsätze erledigt</div>
            <div className="sm-zeit-progress-copy"><span>Wochenfortschritt</span><span>{completion}%</span></div>
            <div className="sm-zeit-progress"><span style={{ width: `${completion}%` }} /></div>
          </div>
          <div className="sm-zeit-secondary">
            <div className="sm-zeit-time-account">
              <span className="sm-zeit-eyebrow">Zeitkonto</span>
              <div className="sm-zeit-time-value"><strong>{duration(actual)}</strong><span>von {duration(planned)}</span></div>
              <div className="sm-zeit-caption">Besuche inkl. {duration(travel)} Fahrtzeit</div>
              <div className="sm-zeit-progress-copy"><span>Ist {planned ? Math.round((actual / planned) * 100) : 0}%</span><span>Soll 100%</span></div>
              <div className="sm-zeit-progress"><span style={{ width: `${timeProgress}%` }} /></div>
            </div>
          </div>
        </section>

        <section className="sm-zeit-card sm-zeit-week">
          <div className="sm-zeit-week-grid">
            <div className="sm-zeit-week-copy"><span className="sm-zeit-eyebrow">KW {week}</span><strong>Aktuelle Woche</strong></div>
            <div className="sm-zeit-legend"><span>● erledigt</span><span style={{ color: RED }}>○ offen</span></div>
            <div className="sm-zeit-week-days">
              {['Mo','Di','Mi','Do','Fr'].map((label, index) => <div key={label} className={`sm-zeit-week-day${index === 4 ? ' future' : ''}`}><i /><span>{label}</span></div>)}
            </div>
          </div>
        </section>

        <section className="sm-zeit-card sm-zeit-main">
          <div className="sm-zeit-main-header">
            <div><span className="sm-zeit-eyebrow">Verlauf</span><h2>Meine Einsätze</h2></div>
            <PeriodSwitch value={period} onChange={setPeriod} />
          </div>
          {loading ? <div className="sm-zeit-loading"><LoaderCircle className="sm-request-spinner" size={18} />Zeiterfassung wird geladen …</div> : loadError ? <div className="sm-zeit-error" role="alert">{loadError}<button type="button" onClick={() => { void loadRows().catch((retryError: unknown) => setLoadError(retryError instanceof Error ? retryError.message : "Die Zeiterfassung konnte nicht geladen werden.")); }}>Erneut versuchen</button></div> : days.length === 0 ? <div className="sm-zeit-empty"><Clock size={22} /><strong>Noch keine Einsätze in diesem Zeitraum</strong><span>Abgeschlossene Marktbesuche erscheinen hier automatisch.</span></div> : days.map((day, index) => <DayRow key={day.id} day={day} requests={requests} onRequest={setSelectedAssignment} onOpen={openAssignment} expandedInitially={index === 0} />)}
        </section>
      </div>

      {selectedAssignment ? (
        <TimeRequestDialog
          key={selectedAssignment.id}
          assignment={selectedAssignment}
          existingRequest={requests[selectedAssignment.id] ?? null}
          onClose={() => setSelectedAssignment(null)}
          onSubmit={submitTimeRequest}
        />
      ) : null}

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={MENU_ITEMS}
          enableKurti
          featureKurti={false}
          kurtiMaxWidth={420}
          enableClickToggle
          defaultIndex={2}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") window.location.assign("/");
              else router.replace("/");
              return;
            }
            if (item.href) router.push(item.href);
          }}
        />
      </div>
    </main>
  );
}
