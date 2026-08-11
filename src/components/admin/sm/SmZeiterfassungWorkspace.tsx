"use client";

import { memo, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, Clock, Search, Store } from "lucide-react";

const RED = "#DC2626";
const ROW_GRID = "minmax(260px, 1.35fr) repeat(5, minmax(112px, 1fr)) 28px";
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

const TEMP_ASSIGNMENTS: SmTimeAssignment[] = [
  { id: "sm-time-001", date: "2026-08-11", smId: "sm-adriana", smName: "Adriana Maier", region: "Ost", marketName: "Billa Plus Donauzentrum", marketAddress: "Wagramer Straße 94 · 1220 Wien", internalMarketId: "120014184", plannedMinutes: 90, actualMinutes: 88, questionnaireComplete: true, flatRateCents: 2850, status: "completed" },
  { id: "sm-time-002", date: "2026-08-11", smId: "sm-adriana", smName: "Adriana Maier", region: "Ost", marketName: "Billa Praterstern", marketAddress: "Praterstern 1 · 1020 Wien", internalMarketId: "120006312", plannedMinutes: 60, actualMinutes: null, questionnaireComplete: false, flatRateCents: 2100, status: "open" },
  { id: "sm-time-003", date: "2026-08-11", smId: "sm-selina", smName: "Selina Huber", region: "Nord", marketName: "Eurospar Linz", marketAddress: "Landstraße 17–25 · 4020 Linz", internalMarketId: "120009774", plannedMinutes: 120, actualMinutes: 126, questionnaireComplete: true, flatRateCents: 3600, status: "completed" },
  { id: "sm-time-004", date: "2026-08-11", smId: "sm-melanie", smName: "Melanie Gruber", region: "Süd", marketName: "Billa Plus Graz", marketAddress: "Wiener Straße 351 · 8051 Graz", internalMarketId: "120018602", plannedMinutes: 90, actualMinutes: null, questionnaireComplete: false, flatRateCents: 2850, status: "open" },
  { id: "sm-time-005", date: "2026-08-10", smId: "sm-adriana", smName: "Adriana Maier", region: "Ost", marketName: "Billa Simmering", marketAddress: "Simmeringer Hauptstraße 96A · 1110 Wien", internalMarketId: "120011640", plannedMinutes: 75, actualMinutes: 77, questionnaireComplete: true, flatRateCents: 2450, status: "completed" },
  { id: "sm-time-006", date: "2026-08-10", smId: "sm-selina", smName: "Selina Huber", region: "Nord", marketName: "Interspar Pasching", marketAddress: "Plus-Kauf-Straße 7 · 4061 Pasching", internalMarketId: "120020815", plannedMinutes: 105, actualMinutes: 98, questionnaireComplete: true, flatRateCents: 3200, status: "completed" },
  { id: "sm-time-007", date: "2026-08-10", smId: "sm-melanie", smName: "Melanie Gruber", region: "Süd", marketName: "Spar Grazbachgasse", marketAddress: "Grazbachgasse 50 · 8010 Graz", internalMarketId: "120005182", plannedMinutes: 60, actualMinutes: null, questionnaireComplete: false, flatRateCents: 2100, status: "missed" },
  { id: "sm-time-008", date: "2026-08-07", smId: "sm-adriana", smName: "Adriana Maier", region: "Ost", marketName: "Billa Plus Millennium City", marketAddress: "Handelskai 94–96 · 1200 Wien", internalMarketId: "120012032", plannedMinutes: 90, actualMinutes: 90, questionnaireComplete: true, flatRateCents: 2850, status: "completed" },
  { id: "sm-time-009", date: "2026-08-07", smId: "sm-selina", smName: "Selina Huber", region: "Nord", marketName: "Billa Wels", marketAddress: "Salzburger Straße 223 · 4600 Wels", internalMarketId: "120016331", plannedMinutes: 75, actualMinutes: 74, questionnaireComplete: true, flatRateCents: 2450, status: "completed" },
];

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
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

function assignmentDeviation(row: SmTimeAssignment): number | null {
  return row.actualMinutes === null ? null : row.actualMinutes - row.plannedMinutes;
}

function totalMinutes(rows: SmTimeAssignment[], field: "plannedMinutes" | "actualMinutes"): number {
  return rows.reduce((sum, row) => sum + (row[field] ?? 0), 0);
}

function deviationLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes === 0) return "±0 Min";
  return `${minutes > 0 ? "+" : "−"}${Math.abs(minutes)} Min`;
}

function deviationColor(minutes: number | null): string {
  if (minutes === null) return "rgba(0,0,0,0.2)";
  if (Math.abs(minutes) <= 5) return "#16a34a";
  return minutes > 0 ? "#D97706" : RED;
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

const AssignmentRow = memo(function AssignmentRow({ assignment }: { assignment: SmTimeAssignment }) {
  const deviation = assignmentDeviation(assignment);
  const meta = statusMeta(assignment.status);
  const dateLabel = formatDateLabel(assignment.date).date;
  return (
    <div className="sm-time-action" style={{ minHeight: 54, padding: "8px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(220,38,38,0.055)", color: RED }}><Store size={12} strokeWidth={1.8} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 11, fontWeight: 650 }}>{assignment.marketName}</div>
          <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,0.35)", fontSize: 9 }}>{dateLabel} · {assignment.marketAddress} · {assignment.internalMarketId}</div>
        </div>
      </div>
      <MetricCell label="Soll-Zeit" value={formatDuration(assignment.plannedMinutes)} />
      <MetricCell label="Ist-Zeit" value={formatDuration(assignment.actualMinutes)} color={assignment.actualMinutes === null ? "rgba(0,0,0,0.2)" : "#374151"} />
      <MetricCell label="Abweichung" value={deviationLabel(deviation)} color={deviationColor(deviation)} />
      <MetricCell label="Pauschale" value={formatMoney(assignment.flatRateCents)} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gridColumn: "6 / 8", justifySelf: "end", alignItems: "flex-end", gap: 4, textAlign: "right" }}>
        <span style={{ padding: "2px 7px", borderRadius: 999, background: meta.background, color: meta.color, fontSize: 8, fontWeight: 750 }}>{meta.label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: assignment.questionnaireComplete ? "#15803d" : "rgba(0,0,0,0.34)", fontSize: 8.5, fontWeight: 600 }}>
          {assignment.questionnaireComplete ? <CheckCircle2 size={9} strokeWidth={2.2} /> : <CircleAlert size={9} strokeWidth={2} />}
          Fragebogen {assignment.questionnaireComplete ? "fertig" : "offen"}
        </span>
      </div>
    </div>
  );
});

const SmDayRow = memo(function SmDayRow({ day }: { day: SmDay }) {
  const [expanded, setExpanded] = useState(false);
  const planned = totalMinutes(day.assignments, "plannedMinutes");
  const actual = totalMinutes(day.assignments, "actualMinutes");
  const hasOpen = day.assignments.some((row) => row.actualMinutes === null);
  const deviation = hasOpen ? null : actual - planned;
  const flatRate = day.assignments.reduce((sum, row) => sum + row.flatRateCents, 0);
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
        <MetricCell label="Ist-Zeit" value={hasOpen && actual === 0 ? "—" : formatDuration(actual)} />
        <MetricCell label="Abweichung" value={deviationLabel(deviation)} color={deviationColor(deviation)} />
        <MetricCell label="Pauschale" value={formatMoney(flatRate)} />
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ marginBottom: 2, color: "rgba(0,0,0,0.28)", fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Einsätze erledigt</div>
          <div style={{ color: allCompleted ? "#16a34a" : RED, fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{completedCount}/{day.assignments.length}</div>
        </div>
        <span style={{ display: "flex", justifyContent: "center" }}><ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .26s cubic-bezier(.4,0,.2,1)" }} /></span>
      </button>
      <div style={{ maxHeight: expanded ? 700 : 0, overflow: "hidden", transition: "max-height .34s cubic-bezier(.4,0,.2,1)" }}>
        {day.assignments.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} />)}
      </div>
    </div>
  );
});

const DateGroup = memo(function DateGroup({ date, days }: { date: string; days: SmDay[] }) {
  const label = formatDateLabel(date);
  const assignmentCount = days.reduce((sum, day) => sum + day.assignments.length, 0);
  const today = date === "2026-08-11";
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
          {days.map((day) => <SmDayRow key={`${day.date}-${day.smId}`} day={day} />)}
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
  const normalizedSearch = search.trim().toLocaleLowerCase("de-AT");

  const filteredAssignments = useMemo(() => {
    if (!normalizedSearch) return TEMP_ASSIGNMENTS;
    return TEMP_ASSIGNMENTS.filter((row) => [row.smName, row.marketName, row.marketAddress, row.internalMarketId].some((value) => value.toLocaleLowerCase("de-AT").includes(normalizedSearch)));
  }, [normalizedSearch]);
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
      `}</style>

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
            {assignmentCount === 0 ? (
              <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.07)", color: RED }}><Clock size={22} strokeWidth={1.5} /></span>
                <div><div style={{ marginBottom: 6, color: "#1a1a1a", fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>Keine Einsätze gefunden.</div><div style={{ color: "rgba(0,0,0,0.4)", fontSize: 11 }}>Versuche einen anderen Suchbegriff.</div></div>
              </div>
            ) : view === "days" ? (
              <div style={{ paddingTop: 4 }}>{dateGroups.map((group) => <DateGroup key={group.date} date={group.date} days={group.days} />)}</div>
            ) : (
              <div>
                <div style={{ padding: "6px 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: ROW_GAP, alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.018)" }}>
                  <span />{["Soll-Zeit", "Ist-Zeit", "Abweichung", "Pauschale", "Einsätze erledigt"].map((label, index) => <span key={label} style={{ color: "rgba(0,0,0,0.28)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.07em", textAlign: index === 4 ? "right" : "left", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>)}<span />
                </div>
                {smGroups.map((group) => {
                  const first = group.rows[0];
                  return <SmDayRow key={group.smId} day={{ date: first.date, smId: group.smId, smName: first.smName, region: first.region, assignments: group.rows }} />;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
