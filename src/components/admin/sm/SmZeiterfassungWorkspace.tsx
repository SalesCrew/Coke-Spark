"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, CircleAlert, Clock, LoaderCircle, Pencil, Search, Store, X, XCircle } from "lucide-react";

import { approveAdminSmPlanningTimeChangeRequest, fetchSmPlanningAssignments, rejectAdminSmPlanningTimeChangeRequest, submitSmPlanningActualTime } from "@/lib/api/backend";
import type { SmPlanningAssignment, SmTimeChangeRequest } from "@/types/smPlanning";

const RED = "#DC2626";
const ROW_GRID = "minmax(260px, 1.5fr) repeat(4, minmax(90px, .62fr)) minmax(125px, .82fr) 28px";
const ROW_GAP = 14;

type SmAssignmentStatus = "completed" | "open" | "missed";

type SmTimeAssignment = {
  id: string;
  date: string;
  smId: string;
  smName: string;
  region: string;
  marketName: string;
  marketAddress: string;
  internalMarketId: string;
  plannedMinutes: number;
  actualMinutes: number | null;
  travelMinutes: number;
  totalMinutes: number | null;
  visitStartedAt: string | null;
  visitCompletedAt: string | null;
  submittedAt: string | null;
  timeRevisionNumber: number | null;
  pendingTimeChangeRequest: SmTimeChangeRequest | null;
  questionnaireComplete: boolean;
  flatRateCents: number;
  status: SmAssignmentStatus;
};

type SmDay = {
  date: string;
  smId: string;
  smName: string;
  region: string;
  assignments: SmTimeAssignment[];
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapPlanningAssignment(row: SmPlanningAssignment): SmTimeAssignment {
  return {
    id: row.id,
    date: row.effective.workDate,
    smId: row.effective.smUserId,
    smName: row.effective.smName,
    region: row.effective.region,
    marketName: row.effective.marketName,
    marketAddress: row.effective.address,
    internalMarketId: row.effective.marketInternalId,
    plannedMinutes: row.effective.plannedMinutes,
    actualMinutes: row.actualMinutes,
    travelMinutes: row.visit?.travelMinutes ?? 0,
    totalMinutes: row.actualMinutes === null ? null : row.actualMinutes + (row.visit?.travelMinutes ?? 0),
    visitStartedAt: row.visit?.visitStartedAt ?? null,
    visitCompletedAt: row.visit?.visitCompletedAt ?? null,
    submittedAt: row.visit?.submittedAt ?? null,
    timeRevisionNumber: row.timeEntry?.revisionNumber ?? null,
    pendingTimeChangeRequest: row.pendingTimeChangeRequest,
    questionnaireComplete: row.questionnaireComplete,
    flatRateCents: row.flatRateCents ?? 0,
    status: row.status === "completed" ? "completed" : row.status === "missed" ? "missed" : "open",
  };
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function formatDateLabel(dateIso: string): { weekday: string; date: string } {
  const date = new Date(`${dateIso}T12:00:00`);
  return {
    weekday: date.toLocaleDateString("de-AT", { weekday: "long" }),
    date: date.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
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

function totalMinutes(rows: SmTimeAssignment[], field: "plannedMinutes" | "actualMinutes"): number {
  return rows.reduce((sum, row) => sum + (row[field] ?? 0), 0);
}

function formatTimestampRange(startedAt: string | null, completedAt: string | null, fallbackMinutes: number | null): string {
  if (!startedAt || !completedAt) return formatDuration(fallbackMinutes);
  const format = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${format.format(new Date(startedAt))} – ${format.format(new Date(completedAt))}`;
}

function statusMeta(status: SmAssignmentStatus): { label: string; color: string; background: string } {
  if (status === "completed") return { label: "Abgeschlossen", color: "#15803d", background: "rgba(22,163,74,0.07)" };
  if (status === "missed") return { label: "Versäumt", color: RED, background: "rgba(220,38,38,0.07)" };
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

const AssignmentRow = memo(function AssignmentRow({ assignment, onSave, onReviewRequest }: { assignment: SmTimeAssignment; onSave: (assignment: SmTimeAssignment, actualMinutes: number, correctionReason?: string) => Promise<void>; onReviewRequest: (assignment: SmTimeAssignment, decision: "approve" | "reject") => Promise<void> }) {
  const meta = statusMeta(assignment.status);
  const dateLabel = formatDateLabel(assignment.date).date;
  const [editing, setEditing] = useState(false);
  const [actualValue, setActualValue] = useState(assignment.actualMinutes === null ? "" : String(assignment.actualMinutes));
  const [correctionReason, setCorrectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<"approve" | "reject" | null>(null);
  const parsedActual = Number(actualValue);
  const correctionRequired = assignment.actualMinutes !== null && parsedActual !== assignment.actualMinutes;
  const invalid = !Number.isInteger(parsedActual) || parsedActual < 1 || parsedActual > 1440 || (correctionRequired && correctionReason.trim().length < 3);

  const closeEditor = () => {
    setEditing(false);
    setActualValue(assignment.actualMinutes === null ? "" : String(assignment.actualMinutes));
    setCorrectionReason("");
    setError(null);
  };

  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(assignment, parsedActual, correctionRequired ? correctionReason.trim() : undefined);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Die Ist-Zeit konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };
  const reviewRequest = async (decision: "approve" | "reject") => {
    if (reviewing) return;
    setReviewing(decision);
    setError(null);
    try {
      await onReviewRequest(assignment, decision);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Die Korrekturanfrage konnte nicht bearbeitet werden.");
    } finally {
      setReviewing(null);
    }
  };
  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="sm-time-action" style={{ minHeight: 54, padding: "8px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(220,38,38,0.055)", color: RED }}><Store size={12} strokeWidth={1.8} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 11, fontWeight: 650 }}>{assignment.marketName}</div>
            <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,0.35)", fontSize: 9 }}>{dateLabel} · {assignment.marketAddress} · Stammnr. {assignment.internalMarketId}</div>
          </div>
        </div>
        <MetricCell label="Soll-Zeit" value={formatDuration(assignment.plannedMinutes)} />
        <MetricCell label="Besuchszeit" value={formatDuration(assignment.actualMinutes)} color={assignment.actualMinutes === null ? "rgba(0,0,0,0.2)" : "#374151"} />
        <MetricCell label="Fahrtzeit" value={assignment.travelMinutes ? formatDuration(assignment.travelMinutes) : "—"} color={assignment.travelMinutes ? "#2563eb" : "rgba(0,0,0,0.2)"} />
        <MetricCell label="Gesamt" value={formatDuration(assignment.totalMinutes)} color={assignment.totalMinutes === null ? "rgba(0,0,0,0.2)" : "#374151"} />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifySelf: "end", alignItems: "flex-end", gap: 4, textAlign: "right" }}>
          <span style={{ padding: "2px 7px", borderRadius: 999, background: meta.background, color: meta.color, fontSize: 8, fontWeight: 750 }}>{meta.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: assignment.questionnaireComplete ? "#15803d" : "rgba(0,0,0,0.34)", fontSize: 8.5, fontWeight: 600 }}>
            {assignment.questionnaireComplete ? <CheckCircle2 size={9} strokeWidth={2.2} /> : <CircleAlert size={9} strokeWidth={2} />}
            Fragebogen {assignment.questionnaireComplete ? "fertig" : "offen"}
          </span>
        </div>
        <button type="button" aria-label="Ist-Zeit bearbeiten" onClick={() => setEditing((current) => !current)} className="sm-time-edit-button"><Pencil size={11}/></button>
      </div>
      {editing ? <div style={{ padding: "10px 18px 12px 54px", display: "flex", alignItems: "flex-end", gap: 10, borderTop: "1px solid rgba(0,0,0,.04)", background: "rgba(0,0,0,.015)" }}>
        <label style={{ width: 118 }}><span className="sm-time-edit-label">Ist-Zeit in Minuten</span><input type="number" min={1} max={1440} step={1} value={actualValue} onChange={(event) => setActualValue(event.target.value)} className="sm-time-edit-input" placeholder="z. B. 90"/></label>
        {correctionRequired ? (
          <label style={{ minWidth: 180, flex: 1 }}>
            <span className="sm-time-edit-label">Korrekturgrund *</span>
            <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="sm-time-edit-input" placeholder="Warum wird die Ist-Zeit korrigiert?"/>
          </label>
        ) : (
          <div style={{ flex: 1 }}/>
        )}
        <button type="button" aria-label="Abbrechen" disabled={saving} onClick={closeEditor} className="sm-time-edit-button"><X size={11}/></button>
        <button type="button" aria-label="Ist-Zeit speichern" disabled={invalid || saving} onClick={() => { void save(); }} className="sm-time-save-button">{saving ? <LoaderCircle className="sm-time-spinner" size={11}/> : <Check size={11}/>}Speichern</button>
        {error ? <span role="alert" style={{ position: "absolute", marginTop: 38, color: RED, fontSize: 8.5 }}>{error}</span> : null}
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

const SmDayRow = memo(function SmDayRow({ day, onSave, onReviewRequest }: { day: SmDay; onSave: (assignment: SmTimeAssignment, actualMinutes: number, correctionReason?: string) => Promise<void>; onReviewRequest: (assignment: SmTimeAssignment, decision: "approve" | "reject") => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const planned = totalMinutes(day.assignments, "plannedMinutes");
  const actual = totalMinutes(day.assignments, "actualMinutes");
  const travel = day.assignments.reduce((sum, row) => sum + row.travelMinutes, 0);
  const total = actual + travel;
  const hasOpen = day.assignments.some((row) => row.actualMinutes === null);
  const completedCount = day.assignments.filter((row) => row.status === "completed").length;
  const allCompleted = completedCount === day.assignments.length;
  const avatar = avatarColors(day.smName);

  return (
    <div className="sm-time-session" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <button type="button" onClick={() => setExpanded((current) => !current)} className="sm-time-row-button" style={{ width: "100%", padding: "10px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center", border: 0, background: expanded ? "rgba(0,0,0,0.012)" : "transparent", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: avatar.background, color: avatar.color, fontSize: 10, fontWeight: 800 }}>{initials(day.smName)}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 12, fontWeight: 650, letterSpacing: "-0.015em" }}>{day.smName}</span>
            <span style={{ display: "block", marginTop: 1, color: "rgba(0,0,0,0.35)", fontSize: 9 }}>{day.region}</span>
          </span>
        </div>
        <MetricCell label="Soll-Zeit" value={formatDuration(planned)} />
        <MetricCell label="Besuchszeit" value={hasOpen && actual === 0 ? "—" : formatDuration(actual)} />
        <MetricCell label="Fahrtzeit" value={travel ? formatDuration(travel) : "—"} color={travel ? "#2563eb" : "rgba(0,0,0,.2)"} />
        <MetricCell label="Gesamt" value={hasOpen && total === 0 ? "—" : formatDuration(total)} />
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ marginBottom: 2, color: "rgba(0,0,0,0.28)", fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Einsätze erledigt</div>
          <div style={{ color: allCompleted ? "#16a34a" : RED, fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{completedCount}/{day.assignments.length}</div>
        </div>
        <span style={{ display: "flex", justifyContent: "center" }}><ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .26s cubic-bezier(.4,0,.2,1)" }} /></span>
      </button>
      <div style={{ maxHeight: expanded ? 700 : 0, overflow: "hidden", transition: "max-height .34s cubic-bezier(.4,0,.2,1)" }}>
        {day.assignments.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} onSave={onSave} onReviewRequest={onReviewRequest} />)}
      </div>
    </div>
  );
});

const DateGroup = memo(function DateGroup({ date, days, onSave, onReviewRequest }: { date: string; days: SmDay[]; onSave: (assignment: SmTimeAssignment, actualMinutes: number, correctionReason?: string) => Promise<void>; onReviewRequest: (assignment: SmTimeAssignment, decision: "approve" | "reject") => Promise<void> }) {
  const label = formatDateLabel(date);
  const assignmentCount = days.reduce((sum, day) => sum + day.assignments.length, 0);
  const today = date === toDateInputValue(new Date());
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
          {days.map((day) => <SmDayRow key={`${day.date}-${day.smId}`} day={day} onSave={onSave} onReviewRequest={onReviewRequest} />)}
        </div>
      </div>
    </section>
  );
});

function buildDays(rows: SmTimeAssignment[]): SmDay[] {
  const days = new Map<string, SmDay>();
  for (const row of rows) {
    const key = `${row.date}:${row.smId}`;
    const existing = days.get(key);
    if (existing) existing.assignments.push(row);
    else days.set(key, { date: row.date, smId: row.smId, smName: row.smName, region: row.region, assignments: [row] });
  }
  return [...days.values()];
}

export function SmZeiterfassungWorkspace() {
  const [view, setView] = useState<"days" | "sm">("days");
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState<SmTimeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 92);
    return { from: toDateInputValue(from), to: toDateInputValue(to) };
  }, []);

  const loadAssignments = useCallback(async () => {
    const rows = await fetchSmPlanningAssignments(dateRange.from, dateRange.to);
    setAssignments(rows.filter((row) => row.status !== "cancelled").map(mapPlanningAssignment));
    setLoadError(null);
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSmPlanningAssignments(dateRange.from, dateRange.to)
      .then((rows) => {
        if (!active) return;
        setAssignments(rows.filter((row) => row.status !== "cancelled").map(mapPlanningAssignment));
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Die Zeiterfassung konnte nicht geladen werden.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const saveActualTime = useCallback(async (assignment: SmTimeAssignment, actualMinutes: number, correctionReason?: string) => {
    await submitSmPlanningActualTime(assignment.id, {
      actualMinutes,
      ...(correctionReason ? { correctionReason } : {}),
    });
    await loadAssignments();
    setNotice(assignment.actualMinutes === null ? "Ist-Zeit wurde gespeichert" : "Ist-Zeit wurde versioniert korrigiert");
  }, [loadAssignments]);

  const reviewTimeRequest = useCallback(async (assignment: SmTimeAssignment, decision: "approve" | "reject") => {
    const request = assignment.pendingTimeChangeRequest;
    if (!request) return;
    if (decision === "approve") await approveAdminSmPlanningTimeChangeRequest(request.id);
    else await rejectAdminSmPlanningTimeChangeRequest(request.id);
    await loadAssignments();
    setNotice(decision === "approve" ? "Korrekturanfrage wurde freigegeben" : "Korrekturanfrage wurde abgelehnt");
  }, [loadAssignments]);

  const normalizedSearch = search.trim().toLocaleLowerCase("de-AT");

  const filteredAssignments = useMemo(() => {
    if (!normalizedSearch) return assignments;
    return assignments.filter((row) => [row.smName, row.marketName, row.marketAddress, row.internalMarketId].some((value) => value.toLocaleLowerCase("de-AT").includes(normalizedSearch)));
  }, [assignments, normalizedSearch]);
  const allDays = useMemo(() => buildDays(filteredAssignments), [filteredAssignments]);
  const dateGroups = useMemo(() => {
    const groups = new Map<string, SmDay[]>();
    for (const day of allDays) {
      const bucket = groups.get(day.date) ?? [];
      bucket.push(day);
      groups.set(day.date, bucket);
    }
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, days]) => ({ date, days: days.sort((left, right) => left.smName.localeCompare(right.smName, "de-AT")) }));
  }, [allDays]);
  const smGroups = useMemo(() => {
    const groups = new Map<string, SmTimeAssignment[]>();
    for (const row of filteredAssignments) {
      const bucket = groups.get(row.smId) ?? [];
      bucket.push(row);
      groups.set(row.smId, bucket);
    }
    return [...groups.entries()].map(([smId, rows]) => ({ smId, rows: rows.sort((left, right) => right.date.localeCompare(left.date)) })).sort((left, right) => left.rows[0].smName.localeCompare(right.rows[0].smName, "de-AT"));
  }, [filteredAssignments]);

  const assignmentCount = filteredAssignments.length;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes smTimeFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes smTimeBodyFade { from { opacity:0 } to { opacity:1 } }
        .sm-time-main { animation: smTimeFadeIn .25s ease both; }
        .sm-time-body { animation: smTimeBodyFade .2s ease both; }
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
      {loadError ? <div role="alert" style={{ marginBottom: 10, padding: "9px 12px", border: "1px solid rgba(220,38,38,.16)", borderRadius: 9, background: "rgba(220,38,38,.045)", color: RED, fontSize: 10, fontWeight: 600 }}>{loadError}</div> : null}

      <div className="sm-time-main" style={{ overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, background: "rgba(0,0,0,0.025)" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Zeiterfassung</span>
          <span style={{ color: "rgba(0,0,0,0.35)", fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{view === "days" ? `${dateGroups.length} ${dateGroups.length === 1 ? "Tag" : "Tage"} · ${assignmentCount} Einsätze` : `${smGroups.length} ${smGroups.length === 1 ? "SM" : "SMs"}`}</span>
        </div>
        <div style={{ margin: "0 10px 10px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ padding: 3, display: "flex", gap: 2, borderRadius: 8, background: "rgba(0,0,0,0.04)" }}>
              {([{ key: "days", label: "Tage" }, { key: "sm", label: "SM Ansicht" }] as const).map((item) => <button key={item.key} type="button" onClick={() => { setView(item.key); setSearch(""); }} style={{ padding: "4px 12px", border: 0, borderRadius: 6, background: view === item.key ? "#fff" : "transparent", boxShadow: view === item.key ? "0 1px 4px rgba(0,0,0,0.08),inset 0 1px .5px rgba(255,255,255,.9)" : "none", color: view === item.key ? "#1a1a1a" : "rgba(0,0,0,0.38)", fontFamily: "inherit", fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>{item.label}</button>)}
            </div>
            <label style={{ flex: "0 0 220px", padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, border: "1px solid transparent", borderRadius: 7, background: "rgba(0,0,0,0.03)" }}>
              <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === "days" ? "SM / Markt suchen…" : "SM suchen…"} style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", color: "#1a1a1a", fontFamily: "inherit", fontSize: 11 }} />
            </label>
          </div>
          <div key={view} className="sm-time-body">
            {loading ? (
              <div style={{ minHeight: 260, display: "grid", placeItems: "center", color: "rgba(0,0,0,.38)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 600 }}><LoaderCircle className="sm-time-spinner" size={18}/>Zeiterfassung wird geladen…</span></div>
            ) : assignmentCount === 0 ? (
              <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.07)", color: RED }}><Clock size={22} strokeWidth={1.5} /></span>
                <div><div style={{ marginBottom: 6, color: "#1a1a1a", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>Keine Einsätze gefunden.</div><div style={{ color: "rgba(0,0,0,0.4)", fontSize: 11 }}>Versuche einen anderen Suchbegriff.</div></div>
              </div>
            ) : view === "days" ? (
              <div style={{ paddingTop: 4 }}>{dateGroups.map((group) => <DateGroup key={group.date} date={group.date} days={group.days} onSave={saveActualTime} onReviewRequest={reviewTimeRequest} />)}</div>
            ) : (
              <div>
                <div style={{ padding: "6px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.018)" }}>
                  <span />{["Soll-Zeit", "Besuchszeit", "Fahrtzeit", "Gesamt", "Einsätze erledigt"].map((label, index) => <span key={label} style={{ color: "rgba(0,0,0,0.28)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.07em", textAlign: index === 4 ? "right" : "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>)}<span />
                </div>
                {smGroups.map((group) => {
                  const first = group.rows[0];
                  return <SmDayRow key={group.smId} day={{ date: first.date, smId: group.smId, smName: first.smName, region: first.region, assignments: group.rows }} onSave={saveActualTime} onReviewRequest={reviewTimeRequest} />;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
