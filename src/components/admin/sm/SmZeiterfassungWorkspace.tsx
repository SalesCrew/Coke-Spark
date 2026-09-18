"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock, LoaderCircle, Pencil, Search, Store, XCircle } from "lucide-react";

import { approveAdminSmPlanningTimeChangeRequest, correctAdminSmVisitTime, fetchSmPlanningAssignments, rejectAdminSmPlanningTimeChangeRequest } from "@/lib/api/backend";
import type { SmPlanningStatus } from "@/types/smPlanning";
import { SmPlanningPeriodPicker } from "./SmPlanningPeriodPicker";
import { currentSmPeriod, shiftSmPeriod, smPeriodLabel, viennaToday, type SmPlanningPeriod } from "@/lib/sm/planningPeriod";
import { buildSmTimeDays, groupSmTimeEmployees, selectSmTimeAssignments, smVisitTimeLabel, summarizeSmTime, type SmTimeAssignment, type SmTimeDay as SmDay } from "@/lib/sm/timeView";
import { SmVisitTimeEditor } from "./SmVisitTimeEditor";

const RED = "#DC2626";
const ROW_GRID = "minmax(260px, 1.5fr) repeat(4, minmax(90px, .62fr)) minmax(125px, .82fr) 28px";
const ROW_GAP = 14;

export type SmTimeApi = {
  load: typeof fetchSmPlanningAssignments;
  correctVisit: typeof correctAdminSmVisitTime;
  approve: typeof approveAdminSmPlanningTimeChangeRequest;
  reject: typeof rejectAdminSmPlanningTimeChangeRequest;
};
const TIME_API: SmTimeApi = { load: fetchSmPlanningAssignments, correctVisit: correctAdminSmVisitTime, approve: approveAdminSmPlanningTimeChangeRequest, reject: rejectAdminSmPlanningTimeChangeRequest };
type TimeActions = {
  correctVisit: typeof correctAdminSmVisitTime;
  onVisitSaved: () => Promise<void>;
  onReviewRequest: (assignment: SmTimeAssignment, decision: "approve" | "reject") => Promise<void>;
};

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function formatDateLabel(dateIso: string): { weekday: string; date: string } {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return {
    weekday: date.toLocaleDateString("de-AT", { timeZone: "UTC", weekday: "long" }),
    date: date.toLocaleDateString("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }),
  };
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

function avatarColors(name: string): { background: string; color: string } {
  const palettes = [
    { background: "#FEF3C7", color: "#B45309" },
    { background: "#DBEAFE", color: "#1D4ED8" },
    { background: "#DCFCE7", color: "#15803D" },
    { background: "#FCE7F3", color: "#BE185D" },
  ];
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function formatTimestampRange(startedAt: string | null, completedAt: string | null, fallbackMinutes: number | null): string {
  if (!startedAt || !completedAt) return formatDuration(fallbackMinutes);
  const format = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${format.format(new Date(startedAt))} – ${format.format(new Date(completedAt))}`;
}

function statusMeta(status: SmPlanningStatus): { label: string; color: string; background: string } {
  if (status === "completed") return { label: "Abgeschlossen", color: "#15803d", background: "rgba(22,163,74,0.07)" };
  if (status === "missed") return { label: "Versäumt", color: RED, background: "rgba(220,38,38,0.07)" };
  if (status === "in_progress") return { label: "In Arbeit", color: "#2563eb", background: "rgba(37,99,235,.07)" };
  return { label: "Ausstehend", color: "#B45309", background: "rgba(217,119,6,0.07)" };
}

const MetricCell = memo(function MetricCell({ label, value, color = "#374151" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 2, color: "rgba(0,0,0,0.28)", fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ color, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.3, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
});

const AssignmentRow = memo(function AssignmentRow({ assignment, correctVisit, onVisitSaved, onReviewRequest }: { assignment: SmTimeAssignment } & TimeActions) {
  const meta = statusMeta(assignment.status);
  const dateLabel = formatDateLabel(assignment.date).date;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<"approve" | "reject" | null>(null);
  const busy = useRef(false);
  const hasEditableVisit = Boolean(assignment.visitId && assignment.status === "completed" && assignment.questionnaireComplete);

  const closeEditor = () => {
    setEditing(false);
    setError(null);
  };
  const reviewRequest = async (decision: "approve" | "reject") => {
    if (busy.current) return;
    busy.current = true;
    setReviewing(decision);
    setError(null);
    try {
      await onReviewRequest(assignment, decision);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Die Korrekturanfrage konnte nicht bearbeitet werden.");
    } finally {
      busy.current = false;
      setReviewing(null);
    }
  };
  return (
    <div data-assignment={assignment.id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="sm-time-action" style={{ minHeight: 54, padding: "8px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(220,38,38,0.055)", color: RED }}><Store size={12} strokeWidth={1.8} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 11, fontWeight: 650 }}>{assignment.marketName}</div>
            <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,0.35)", fontSize: 9 }}>{dateLabel} · {assignment.marketAddress} · Stammnr. {assignment.internalMarketId}</div>
            <div className="sm-time-visit-clock"><Clock size={10}/>{smVisitTimeLabel(assignment.visitStartedAt, assignment.visitCompletedAt)}</div>
            {assignment.timeRevisionNumber !== null && assignment.timeRevisionNumber > 1 ? <div style={{ marginTop: 3, fontSize: 8, color: "#9ca3af" }}>Ist-Zeit korrigiert · Version {assignment.timeRevisionNumber}</div> : null}
          </div>
        </div>
        <MetricCell label="Soll-Zeit" value={formatDuration(assignment.plannedMinutes)} />
        <MetricCell label="Besuchszeit" value={formatDuration(assignment.actualMinutes)} color={assignment.actualMinutes === null ? "rgba(0,0,0,0.2)" : "#374151"} />
        <MetricCell label="Fahrtzeit" value={assignment.actualMinutes === null ? "—" : formatDuration(assignment.travelMinutes)} color={assignment.travelMinutes && assignment.actualMinutes !== null ? "#2563eb" : "rgba(0,0,0,0.35)"} />
        <MetricCell label="Gesamt" value={formatDuration(assignment.totalMinutes)} color={assignment.totalMinutes === null ? "rgba(0,0,0,0.2)" : "#374151"} />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifySelf: "end", alignItems: "flex-end", gap: 4, textAlign: "right" }}>
          <span style={{ padding: "2px 7px", borderRadius: 999, background: meta.background, color: meta.color, fontSize: 8, fontWeight: 750 }}>{meta.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: assignment.questionnaireComplete ? "#15803d" : "rgba(0,0,0,0.34)", fontSize: 8.5, fontWeight: 600 }}>
            {assignment.questionnaireComplete ? <CheckCircle2 size={9} strokeWidth={2.2} /> : <CircleAlert size={9} strokeWidth={2} />}
            Fragebogen {assignment.questionnaireComplete ? "fertig" : "offen"}
          </span>
        </div>
        {hasEditableVisit ? <button type="button" aria-label="Start und Endzeit bearbeiten" title="Start und Endzeit bearbeiten" disabled={Boolean(reviewing) || Boolean(assignment.pendingTimeChangeRequest)} onClick={() => {
          if (!editing) setError(null);
          setEditing((current) => !current);
        }} className="sm-time-edit-button"><Pencil size={11}/></button> : <span />}
      </div>
      {editing && hasEditableVisit ? <div style={{ padding: "10px 18px 12px 54px", borderTop: "1px solid rgba(0,0,0,.04)" }}>
        <SmVisitTimeEditor assignmentId={assignment.id} visitId={assignment.visitId!} startedAt={assignment.visitStartedAt} completedAt={assignment.visitCompletedAt}
          save={correctVisit} onCancel={closeEditor} onSaved={async () => { setEditing(false); await onVisitSaved(); }} />
      </div> : null}
      {assignment.pendingTimeChangeRequest ? <div className="sm-time-request-review">
        <div className="sm-time-request-copy">
          <span>Korrekturanfrage</span>
          <strong>{assignment.pendingTimeChangeRequest.kind === "deletion" ? "Ist-Zeit löschen" : `${formatTimestampRange(assignment.pendingTimeChangeRequest.originalStartedAt, assignment.pendingTimeChangeRequest.originalCompletedAt, assignment.pendingTimeChangeRequest.originalMinutes)} → ${formatTimestampRange(assignment.pendingTimeChangeRequest.requestedStartedAt, assignment.pendingTimeChangeRequest.requestedCompletedAt, assignment.pendingTimeChangeRequest.requestedMinutes)}`}</strong>
          <small>{assignment.pendingTimeChangeRequest.reason}</small>
        </div>
        <button type="button" className="reject" disabled={Boolean(reviewing)} onClick={() => { void reviewRequest("reject"); }}>{reviewing === "reject" ? <LoaderCircle className="sm-time-spinner" size={11} /> : <XCircle size={11} />}Ablehnen</button>
        <button type="button" className="approve" disabled={Boolean(reviewing)} onClick={() => { void reviewRequest("approve"); }}>{reviewing === "approve" ? <LoaderCircle className="sm-time-spinner" size={11} /> : <CheckCircle2 size={11} />}Freigeben</button>
        {error ? <span className="sm-time-request-error" role="alert">{error}</span> : null}
      </div> : null}
    </div>
  );
});

const SmDayRow = memo(function SmDayRow({ day, history = false, correctVisit, onVisitSaved, onReviewRequest }: { day: SmDay; history?: boolean } & TimeActions) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const { planned, actual, travel, total, completed: completedCount } = summarizeSmTime(day.assignments);
  const allCompleted = completedCount === day.assignments.length;
  const avatar = avatarColors(day.smName);

  return (
    <div className="sm-time-session" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <button type="button" aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} aria-label={history ? `${formatDateLabel(day.date).date} · ${day.smName}` : `${day.smName} · ${formatDateLabel(day.date).date}`} onClick={() => setExpanded((current) => !current)} className="sm-time-row-button" style={{ width: "100%", padding: "10px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center", border: 0, background: expanded ? "rgba(0,0,0,0.012)" : "transparent", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: history ? "#f3f4f6" : avatar.background, color: history ? "#6b7280" : avatar.color, fontSize: 10, fontWeight: 800 }}>{history ? <Calendar size={14}/> : initials(day.smName)}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 12, fontWeight: 650, letterSpacing: "-0.015em" }}>{history ? formatDateLabel(day.date).date : day.smName}</span>
            <span style={{ display: "block", marginTop: 1, color: "rgba(0,0,0,0.35)", fontSize: 9 }}>{history ? formatDateLabel(day.date).weekday : day.region}</span>
          </span>
        </div>
        <MetricCell label="Soll-Zeit" value={formatDuration(planned)} />
        <MetricCell label="Besuchszeit" value={formatDuration(actual)} />
        <MetricCell label="Fahrtzeit" value={formatDuration(travel)} color={travel ? "#2563eb" : "rgba(0,0,0,.35)"} />
        <MetricCell label="Gesamt" value={formatDuration(total)} />
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ marginBottom: 2, color: "rgba(0,0,0,0.28)", fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Einsätze erledigt</div>
          <div style={{ color: allCompleted ? "#16a34a" : RED, fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{completedCount}/{day.assignments.length}</div>
        </div>
        <span style={{ display: "flex", justifyContent: "center" }}><ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .26s cubic-bezier(.4,0,.2,1)" }} /></span>
      </button>
      {expanded ? <div id={panelId} className="sm-time-body">
        {day.assignments.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} correctVisit={correctVisit} onVisitSaved={onVisitSaved} onReviewRequest={onReviewRequest} />)}
      </div> : null}
    </div>
  );
});

const DateGroup = memo(function DateGroup({ date, days, correctVisit, onVisitSaved, onReviewRequest }: { date: string; days: SmDay[] } & TimeActions) {
  const label = formatDateLabel(date);
  const assignmentCount = days.reduce((sum, day) => sum + day.assignments.length, 0);
  const today = date === viennaToday();
  return (
    <section className="sm-time-day-group">
      <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#1a1a1a", fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em" }}>{label.weekday},</span>
          <span style={{ color: "#374151", fontSize: 13, fontWeight: 500 }}>{label.date}</span>
          {today ? <span style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(220,38,38,0.09)", color: RED, fontSize: 8, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Heute</span> : null}
        </div>
        <span style={{ color: "rgba(0,0,0,0.35)", fontSize: 10, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{days.length} {days.length === 1 ? "SM" : "SMs"} · {assignmentCount} {assignmentCount === 1 ? "Einsatz" : "Einsätze"}</span>
      </div>
      <div style={{ margin: "0 10px 16px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(0,0,0,0.022)" }}>
        <div style={{ margin: 8, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 9, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {days.map((day) => <SmDayRow key={`${day.date}-${day.smId}`} day={day} correctVisit={correctVisit} onVisitSaved={onVisitSaved} onReviewRequest={onReviewRequest} />)}
        </div>
      </div>
    </section>
  );
});

export const SmEmployeeTimeRow = memo(function SmEmployeeTimeRow({ employee, correctVisit, onVisitSaved, onReviewRequest }: { employee: ReturnType<typeof groupSmTimeEmployees>[number] } & TimeActions) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const avatar = avatarColors(employee.name), stats = employee.summary;
  return <section className="sm-time-employee" data-employee={employee.id}>
    <button type="button" className="sm-time-employee-trigger sm-time-row-button" aria-label={`Zeiten von ${employee.name}`} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} onClick={() => setExpanded((current) => !current)}>
      <span className="sm-time-employee-identity"><span className="sm-time-avatar" style={{ background: avatar.background, color: avatar.color }}>{initials(employee.name)}</span><span><strong>{employee.name}</strong><small>{employee.region}</small></span></span>
      <MetricCell label="Soll-Zeit" value={formatDuration(stats.planned)}/>
      <MetricCell label="Besuchszeit" value={formatDuration(stats.actual)}/>
      <MetricCell label="Fahrtzeit" value={formatDuration(stats.travel)} color="#2563eb"/>
      <MetricCell label="Gesamt" value={formatDuration(stats.total)}/>
      <MetricCell label="Einsätze erledigt" value={`${stats.completed}/${stats.count}`} color={stats.completed === stats.count ? "#16a34a" : RED}/>
      <ChevronDown size={14} className={expanded ? "is-expanded" : ""}/>
    </button>
    {expanded ? <div id={panelId} className="sm-time-body">
      <div className="sm-time-summary-strip" aria-label={`Zusammenfassung ${employee.name}`}>
        <MetricCell label="Besuchszeit" value={formatDuration(stats.actual)}/><MetricCell label="Fahrtzeit" value={formatDuration(stats.travel)} color="#2563eb"/><MetricCell label="Gesamt" value={formatDuration(stats.total)} color="#16a34a"/>
        <MetricCell label="Ø erfasster Tag" value={formatDuration(stats.averageDay)}/><MetricCell label="Tage erfasst" value={String(stats.recordedDays)}/><MetricCell label="Einsätze erledigt" value={`${stats.completed}/${stats.count}`}/>
      </div>
      <div className="sm-time-history-caption">Tagesverlauf · ausgewählter Zeitraum</div>
      {employee.days.map((day) => <SmDayRow key={day.date} day={day} history correctVisit={correctVisit} onVisitSaved={onVisitSaved} onReviewRequest={onReviewRequest}/>)}
    </div> : null}
  </section>;
});

export function SmZeiterfassungWorkspace({ api = TIME_API, initialPeriod }: { api?: SmTimeApi; initialPeriod?: SmPlanningPeriod }) {
  const [view, setView] = useState<"days" | "sm">("days");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<SmPlanningPeriod>(() => initialPeriod ?? currentSmPeriod("month"));
  const rangeKey = `${period.from}:${period.to}`;
  const activeRange = useRef(rangeKey);
  activeRange.current = rangeKey;
  const generation = useRef(0);
  const mounted = useRef(false);
  const [result, setResult] = useState<{ range: string; rows: SmTimeAssignment[]; loading: boolean; error: string | null }>({ range: "", rows: [], loading: true, error: null });
  const assignments = result.range === rangeKey ? result.rows : [];
  const loading = result.range !== rangeKey || result.loading;
  const loadError = result.range === rangeKey ? result.error : null;
  const [notice, setNotice] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    const requestedRange = `${period.from}:${period.to}`;
    if (!mounted.current || activeRange.current !== requestedRange) return;
    const request = ++generation.current;
    setResult((current) => ({ range: requestedRange, rows: current.range === requestedRange ? current.rows : [], loading: true, error: null }));
    try {
      const rows = await api.load(period.from, period.to);
      if (generation.current !== request || activeRange.current !== requestedRange) return;
      setResult({ range: requestedRange, rows: selectSmTimeAssignments(rows, period.from, period.to), loading: false, error: null });
    } catch (error) {
      if (generation.current !== request || activeRange.current !== requestedRange) return;
      setResult({ range: requestedRange, rows: [], loading: false, error: error instanceof Error ? error.message : "Die Zeiterfassung konnte nicht geladen werden." });
    }
  }, [api, period.from, period.to]);
  const reloadCurrentRange = useRef(loadAssignments);
  reloadCurrentRange.current = loadAssignments;

  useEffect(() => {
    mounted.current = true;
    void loadAssignments();
    return () => { mounted.current = false; generation.current += 1; };
  }, [loadAssignments]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visitSaved = useCallback(async () => {
    await reloadCurrentRange.current();
    setNotice("Start und Ende wurden versioniert korrigiert");
  }, []);

  const reviewTimeRequest = useCallback(async (assignment: SmTimeAssignment, decision: "approve" | "reject") => {
    const request = assignment.pendingTimeChangeRequest;
    if (!request) return;
    if (decision === "approve") await api.approve(request.id);
    else await api.reject(request.id);
    await reloadCurrentRange.current();
    setNotice(decision === "approve" ? "Korrekturanfrage wurde freigegeben" : "Korrekturanfrage wurde abgelehnt");
  }, [api]);

  const normalizedSearch = search.trim().toLocaleLowerCase("de-AT");

  const filteredAssignments = useMemo(() => {
    if (!normalizedSearch) return assignments;
    return assignments.filter((row) => [row.smName, row.marketName, row.marketAddress, row.internalMarketId].some((value) => value.toLocaleLowerCase("de-AT").includes(normalizedSearch)));
  }, [assignments, normalizedSearch]);
  const allDays = useMemo(() => buildSmTimeDays(filteredAssignments), [filteredAssignments]);
  const dateGroups = useMemo(() => {
    const groups = new Map<string, SmDay[]>();
    for (const day of allDays) {
      const bucket = groups.get(day.date) ?? [];
      bucket.push(day);
      groups.set(day.date, bucket);
    }
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, days]) => ({ date, days: days.sort((left, right) => left.smName.localeCompare(right.smName, "de-AT")) }));
  }, [allDays]);
  const smGroups = useMemo(() => groupSmTimeEmployees(allDays), [allDays]);

  const assignmentCount = filteredAssignments.length;

  return (
    <div className="sm-time-workspace" style={{ display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes smTimeFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes smTimeBodyFade { from { opacity:0 } to { opacity:1 } }
        .sm-time-main { animation: smTimeFadeIn .25s ease both; }
        .sm-time-body { animation: smTimeBodyFade .2s ease both; }
        .sm-time-toolbar{padding:10px 14px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:1px solid #0000000d}
        .sm-time-period{margin-left:auto;display:flex;align-items:center;gap:6px}
        .sm-time-workspace .sm-plan-secondary-button,.sm-time-period>button{height:30px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid #00000014;border-radius:8px;background:#fff;font:inherit;font-size:10px;font-weight:600;color:#52525b;cursor:pointer;white-space:nowrap}
        .sm-time-period>button.sm-time-arrow{width:30px;padding:0;background:#f5f5f6;border-color:transparent}
        .sm-time-workspace .sm-plan-secondary-button:hover,.sm-time-period>button:hover{background:#fafafa;color:${RED}}
        .sm-time-workspace button:focus-visible{outline:2px solid #dc262655;outline-offset:2px}
        .sm-time-workspace button:disabled{opacity:.45;cursor:not-allowed}
        .sm-time-period-caption{padding:9px 18px;color:#6b7280;font-size:10px;border-bottom:1px solid #00000009;display:flex;gap:8px;align-items:center;justify-content:space-between}
        .sm-time-employee{border-bottom:1px solid #0000000a}
        .sm-time-employee-trigger{width:100%;padding:13px 18px;display:grid;grid-template-columns:${ROW_GRID};gap:${ROW_GAP}px;align-items:center;border:0;background:white;text-align:left;font-family:inherit;cursor:pointer}
        .sm-time-employee-trigger>svg{color:#9ca3af;transition:transform .2s}.sm-time-employee-trigger>svg.is-expanded{transform:rotate(180deg)}
        .sm-time-employee-identity{display:flex;align-items:center;gap:9px;min-width:0}.sm-time-employee-identity>span:last-child{min-width:0}.sm-time-employee-identity strong{display:block;font-size:12px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sm-time-employee-identity small{display:block;margin-top:2px;font-size:9px;color:#9ca3af}
        .sm-time-avatar{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;font-size:10px;font-weight:800}
        .sm-time-summary-strip{margin:0 18px 10px;padding:12px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;border:1px solid #0000000d;border-radius:10px;background:#f8f8f9}
        .sm-time-history-caption{padding:8px 18px;color:#9ca3af;font-size:9px;font-weight:600;border-top:1px solid #00000008}
        .sm-time-visit-clock{margin-top:5px;display:flex;align-items:center;gap:4px;color:#6b7280;font-size:9px;font-variant-numeric:tabular-nums}
        .sm-time-table-scroll{overflow-x:auto}.sm-time-table-content{min-width:980px}
        .sm-time-request-error{position:static!important;grid-column:1/-1;font-size:9px!important}
        @keyframes smTimePulse{50%{opacity:.4}}.sm-time-skeleton{padding:16px 18px;display:grid;gap:12px}.sm-time-skeleton-row{display:grid;grid-template-columns:2fr repeat(5,1fr);gap:18px;padding:14px 0;border-bottom:1px solid #00000008}.sm-time-skeleton-row span{display:block;height:13px;background:#f0f1f3;border-radius:5px;animation:smTimePulse 1.4s ease-in-out infinite}.sm-time-skeleton-row span:first-child{height:30px;width:75%}
        @media(max-width:1100px){.sm-time-period{margin-left:0}.sm-time-toolbar{gap:8px}}
        @media(prefers-reduced-motion:reduce){.sm-time-main,.sm-time-body,.sm-time-skeleton-row span{animation:none}.sm-time-employee-trigger>svg{transition:none}}
        .sm-time-day-group { content-visibility:auto; contain:layout paint style; contain-intrinsic-size:auto 320px; }
        .sm-time-session { contain:layout paint style; }
        .sm-time-row-button,.sm-time-action { transition:background-color .1s ease; }
        .sm-time-row-button:hover,.sm-time-action:hover { background:rgba(0,0,0,.018) !important; }
        .sm-time-row-button:focus-visible { outline:2px solid rgba(220,38,38,.24); outline-offset:-2px; }
        .sm-time-edit-button{width:27px;height:27px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.08);border-radius:7px;background:#fff;color:rgba(0,0,0,.42);cursor:pointer}.sm-time-edit-button:hover{color:${RED};border-color:rgba(220,38,38,.18)}
        .sm-time-edit-label{display:block;margin-bottom:4px;color:rgba(0,0,0,.35);font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.sm-time-edit-input{width:100%;height:29px;padding:0 8px;border:1px solid rgba(0,0,0,.10);border-radius:6px;outline:0;background:#fff;color:#1a1a1a;font-family:inherit;font-size:10px}.sm-time-edit-input:focus{border-color:rgba(220,38,38,.25);box-shadow:0 0 0 2px rgba(220,38,38,.04)}
        .sm-time-save-button{height:29px;padding:0 10px;display:inline-flex;align-items:center;gap:5px;border:0;border-radius:6px;background:${RED};color:#fff;font-family:inherit;font-size:9.5px;font-weight:650;cursor:pointer}.sm-time-save-button:disabled{cursor:not-allowed;opacity:.42}.sm-time-spinner{animation:smTimeSpin .8s linear infinite}@keyframes smTimeSpin{to{transform:rotate(360deg)}}
        .sm-time-request-review{position:relative;padding:9px 18px 10px 54px;display:grid;grid-template-columns:minmax(220px,1fr) auto auto;align-items:center;gap:7px;border-top:1px solid rgba(245,158,11,.10);background:rgba(245,158,11,.035)}.sm-time-request-copy{min-width:0}.sm-time-request-copy>span{display:block;margin-bottom:2px;color:#b45309;font-size:7.5px;font-weight:750;letter-spacing:.07em;text-transform:uppercase}.sm-time-request-copy>strong{display:block;color:#1f2937;font-size:10px;font-weight:720}.sm-time-request-copy>small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(0,0,0,.42);font-size:8.5px}.sm-time-request-review button{height:27px;padding:0 9px;display:inline-flex;align-items:center;gap:4px;border-radius:7px;font-family:inherit;font-size:8.5px;font-weight:700;cursor:pointer}.sm-time-request-review button:disabled{opacity:.45;cursor:not-allowed}.sm-time-request-review .reject{border:1px solid rgba(220,38,38,.12);background:#fff;color:${RED}}.sm-time-request-review .approve{border:1px solid rgba(22,163,74,.12);background:#16a34a;color:#fff}.sm-time-request-error{position:absolute;left:54px;right:18px;bottom:-13px;color:${RED};font-size:8px}
      `}</style>

      {notice ? <div role="status" style={{ position: "fixed", top: 92, left: "50%", zIndex: 13000, transform: "translateX(-50%)", padding: "7px 13px", border: "1px solid rgba(22,163,74,.16)", borderRadius: 999, background: "rgba(247,255,249,.98)", color: "#15803D", boxShadow: "0 5px 18px rgba(0,0,0,.08)", fontSize: 10, fontWeight: 650 }}>{notice}</div> : null}

      <div className="sm-time-main" style={{ overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, background: "rgba(0,0,0,0.025)" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Zeiterfassung</span>
          <span style={{ color: "rgba(0,0,0,0.35)", fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{loading ? "Wird geladen…" : loadError ? "Nicht geladen" : view === "days" ? `${dateGroups.length} ${dateGroups.length === 1 ? "Tag" : "Tage"} · ${assignmentCount} Einsätze` : `${smGroups.length} ${smGroups.length === 1 ? "SM" : "SMs"} · ${assignmentCount} Einsätze`}</span>
        </div>
        <div style={{ margin: "0 10px 10px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <div className="sm-time-toolbar">
            <div style={{ padding: 3, display: "flex", gap: 2, borderRadius: 8, background: "rgba(0,0,0,0.04)" }}>
              {([{ key: "days", label: "Tage" }, { key: "sm", label: "SM Ansicht" }] as const).map((item) => <button key={item.key} type="button" aria-pressed={view === item.key} onClick={() => setView(item.key)} style={{ padding: "4px 12px", border: 0, borderRadius: 6, background: view === item.key ? "#fff" : "transparent", boxShadow: view === item.key ? "0 1px 4px rgba(0,0,0,0.08),inset 0 1px .5px rgba(255,255,255,.9)" : "none", color: view === item.key ? "#1a1a1a" : "rgba(0,0,0,0.38)", fontFamily: "inherit", fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>{item.label}</button>)}
            </div>
            <label style={{ flex: "0 0 220px", padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, border: "1px solid transparent", borderRadius: 7, background: "rgba(0,0,0,0.03)" }}>
              <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
              <input aria-label="SM oder Markt suchen" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SM / Markt suchen…" style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", color: "#1a1a1a", fontFamily: "inherit", fontSize: 11 }} />
            </label>
            <div className="sm-time-period">
              <button type="button" className="sm-time-arrow" aria-label="Vorheriger Zeitraum" onClick={() => setPeriod((current) => shiftSmPeriod(current, -1))}><ChevronLeft size={12}/></button>
              <SmPlanningPeriodPicker value={period} onChange={setPeriod}/>
              <button type="button" className="sm-time-arrow" aria-label="Nächster Zeitraum" onClick={() => setPeriod((current) => shiftSmPeriod(current, 1))}><ChevronRight size={12}/></button>
              <button type="button" onClick={() => setPeriod((current) => currentSmPeriod(current.mode))}>Heute</button>
            </div>
          </div>
          <div className="sm-time-period-caption"><span data-testid="time-period">{smPeriodLabel(period, true)}</span><span>{loading ? "Zeiten werden aktualisiert…" : "Summen im ausgewählten Zeitraum"}</span></div>
          <div key={`${view}:${rangeKey}`} className="sm-time-body" aria-busy={loading}>
            {loading && assignments.length === 0 ? (
              <div role="status" aria-label="Zeiterfassung wird geladen" className="sm-time-skeleton"><span className="sr-only">Zeiterfassung wird geladen…</span>{Array.from({ length: 4 }, (_, index) => <div key={index} className="sm-time-skeleton-row" aria-hidden="true">{Array.from({ length: 6 }, (_, cell) => <span key={cell}/>)}</div>)}</div>
            ) : loadError ? (
              <div role="alert" style={{ padding: "48px 24px", textAlign: "center", fontSize: 11, color: RED }}><p>{loadError}</p><button type="button" className="sm-plan-secondary-button" style={{ marginTop: 14 }} onClick={() => { void loadAssignments(); }}>Erneut versuchen</button></div>
            ) : assignmentCount === 0 ? (
              <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.07)", color: RED }}><Clock size={22} strokeWidth={1.5} /></span>
                <div><div style={{ marginBottom: 6, color: "#1a1a1a", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>{normalizedSearch ? "Keine passenden Einsätze." : "Keine Einsätze in diesem Zeitraum."}</div><div style={{ color: "rgba(0,0,0,0.4)", fontSize: 11 }}>{normalizedSearch ? "Ändere den Suchbegriff oder setze die Suche zurück." : "Wähle einen anderen Tag, eine KW oder einen Monat."}</div></div>
                {normalizedSearch ? <button type="button" className="sm-plan-secondary-button" onClick={() => setSearch("")}>Suche zurücksetzen</button> : null}
              </div>
            ) : view === "days" ? (
              <div className="sm-time-table-scroll"><div className="sm-time-table-content" style={{ paddingTop: 4 }}>{dateGroups.map((group) => <DateGroup key={group.date} date={group.date} days={group.days} correctVisit={api.correctVisit} onVisitSaved={visitSaved} onReviewRequest={reviewTimeRequest} />)}</div></div>
            ) : (
              <div className="sm-time-table-scroll"><div className="sm-time-table-content">{smGroups.map((employee) => <SmEmployeeTimeRow key={employee.id} employee={employee} correctVisit={api.correctVisit} onVisitSaved={visitSaved} onReviewRequest={reviewTimeRequest}/>)}</div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
