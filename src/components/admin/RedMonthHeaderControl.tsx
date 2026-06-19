"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, CheckCircle2, Lock, Pencil, Plus, X } from "lucide-react";
import { useRedMonth } from "@/context/RedMonthContext";
import type { RedMonthPeriod, RedMonthYear } from "@/types/red-month";

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

function getYearRangeYmd(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function alignToMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const distanceToMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - distanceToMonday);
  return copy;
}

function defaultNextAnchor(currentAnchor: string | null | undefined, nextYear: number): string {
  if (currentAnchor && /^\d{4}-\d{2}-\d{2}$/.test(currentAnchor)) {
    const [, rawMonth, rawDay] = currentAnchor.split("-");
    const candidate = new Date(nextYear, Number(rawMonth ?? "1") - 1, Number(rawDay ?? "1"));
    return toYmd(alignToMonday(candidate));
  }
  return toYmd(alignToMonday(new Date(nextYear, 0, 1)));
}

function parseCycleDraft(value: string): number[] {
  return value
    .split(/[\/,\s]+/)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.floor(entry));
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function RedMonthDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!parsed) return;
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  }, [parsed?.getFullYear(), parsed?.getMonth()]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 8,
          padding: "6px 8px",
          fontSize: 11,
          fontFamily: "inherit",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
          color: value ? "#111827" : "rgba(0,0,0,0.35)",
          cursor: "pointer",
        }}
      >
        <span>{value ? formatDate(value) : "Datum wählen"}</span>
        <Calendar size={11} strokeWidth={2} color="rgba(0,0,0,0.35)" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1300,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            padding: "10px 10px 8px",
            width: 230,
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((entry) => entry - 1);
                } else {
                  setViewMonth((entry) => entry - 1);
                }
              }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "rgba(0,0,0,0.45)", fontSize: 14 }}
            >
              {"<"}
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((entry) => entry + 1);
                } else {
                  setViewMonth((entry) => entry + 1);
                }
              }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "rgba(0,0,0,0.45)", fontSize: 14 }}
            >
              {">"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)" }}>
                {weekday}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
            {cells.map((day, index) => {
              if (day === null) return <div key={index} />;
              const selected = Boolean(parsed && day === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear());
              const todayCell = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <button
                  key={`${viewYear}-${viewMonth}-${day}-${index}`}
                  type="button"
                  onClick={() => {
                    const month = String(viewMonth + 1).padStart(2, "0");
                    const dayValue = String(day).padStart(2, "0");
                    onChange(`${viewYear}-${month}-${dayValue}`);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: 6,
                    border: "none",
                    background: selected ? "linear-gradient(to bottom, #DC2626, #b91c1c)" : todayCell ? "rgba(220,38,38,0.07)" : "transparent",
                    color: selected ? "#fff" : todayCell ? "#DC2626" : "#111827",
                    fontSize: 11,
                    fontWeight: selected || todayCell ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: RedMonthYear["status"] }) {
  const isDraft = status === "draft";
  const isLocked = status === "locked";
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "3px 7px",
        fontSize: 9,
        fontWeight: 800,
        color: isDraft ? "#92400e" : isLocked ? "#64748b" : "#047857",
        background: isDraft ? "rgba(245,158,11,0.11)" : isLocked ? "rgba(100,116,139,0.10)" : "rgba(16,185,129,0.12)",
        letterSpacing: "0.02em",
      }}
    >
      {isDraft ? "ENTWURF" : isLocked ? "GESICHERT" : "AKTIV"}
    </span>
  );
}

export function RedMonthHeaderControl() {
  const {
    current,
    config,
    calendar,
    years,
    loadCalendar,
    loadYears,
    previewYear,
    createYear,
    updateYear,
    activateYear,
    saving,
    error,
  } = useRedMonth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const nextYear = (config?.redYear ?? new Date().getFullYear()) + 1;
  const [redYearDraft, setRedYearDraft] = useState(String(nextYear));
  const [anchorStart, setAnchorStart] = useState(defaultNextAnchor(config?.anchorStart, nextYear));
  const [cycleDraft, setCycleDraft] = useState("4/4/5");
  const [periodCountDraft, setPeriodCountDraft] = useState("13");
  const [formError, setFormError] = useState<string | null>(null);
  const [previewPeriods, setPreviewPeriods] = useState<RedMonthPeriod[]>([]);
  const activeYear = years.find((year) => year.id === current?.redMonthYearId) ?? null;
  const currentYear = current?.year ?? new Date().getFullYear();
  const yearRange = useMemo(() => getYearRangeYmd(currentYear), [currentYear]);

  useEffect(() => {
    if (!open) return;
    void loadYears();
    void loadCalendar({ from: yearRange.from, to: yearRange.to });
  }, [loadCalendar, loadYears, open, yearRange.from, yearRange.to]);

  useEffect(() => {
    if (!config) return;
    const derivedNextYear = (config.redYear ?? new Date().getFullYear()) + 1;
    if (mode === "view") {
      setRedYearDraft(String(derivedNextYear));
      setAnchorStart(defaultNextAnchor(config.anchorStart, derivedNextYear));
      setCycleDraft((config.cycleWeeks.length > 0 ? config.cycleWeeks : [4, 4, 5]).join("/"));
      setPeriodCountDraft(String(config.periodCount || 13));
    }
  }, [config, mode]);

  useEffect(() => {
    if (mode === "view") return;
    const redYear = Number(redYearDraft);
    const cycleWeeks = parseCycleDraft(cycleDraft);
    const periodCount = Number(periodCountDraft);
    if (!Number.isFinite(redYear) || !anchorStart || cycleWeeks.length === 0 || !Number.isFinite(periodCount) || periodCount <= 0) {
      setPreviewPeriods([]);
      return;
    }
    let cancelled = false;
    void previewYear({
      redYear,
      anchorStart,
      cycleWeeks,
      periodCount: Math.floor(periodCount),
      timezone: config?.timezone ?? "Europe/Vienna",
    })
      .then((periods) => {
        if (!cancelled) setPreviewPeriods(periods);
      })
      .catch(() => {
        if (!cancelled) setPreviewPeriods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [anchorStart, config?.timezone, cycleDraft, mode, periodCountDraft, previewYear, redYearDraft]);

  const summaryLabel = useMemo(() => {
    if (!current) return "RED-Monat wird geladen";
    return `${current.label} - ${formatDate(current.start)} - ${formatDate(current.end)}`;
  }, [current]);

  const beginCreate = () => {
    const targetYear = nextYear;
    setMode("create");
    setEditingYearId(null);
    setRedYearDraft(String(targetYear));
    setAnchorStart(defaultNextAnchor(config?.anchorStart, targetYear));
    setCycleDraft((config?.cycleWeeks.length ? config.cycleWeeks : [4, 4, 5]).join("/"));
    setPeriodCountDraft(String(config?.periodCount || 13));
    setFormError(null);
  };

  const beginEdit = (year: RedMonthYear) => {
    setMode("edit");
    setEditingYearId(year.id);
    setRedYearDraft(String(year.redYear));
    setAnchorStart(year.anchorStart);
    setCycleDraft(year.cycleWeeks.join("/"));
    setPeriodCountDraft(String(year.periodCount));
    setFormError(null);
  };

  const handleSaveYear = async () => {
    const redYear = Number(redYearDraft);
    const cycleWeeks = parseCycleDraft(cycleDraft);
    const periodCount = Number(periodCountDraft);
    if (!Number.isFinite(redYear) || !anchorStart || cycleWeeks.length === 0 || !Number.isFinite(periodCount) || periodCount <= 0) {
      setFormError("Bitte gültiges Jahr, Startdatum, Rhythmus und Periodenanzahl angeben.");
      return;
    }
    try {
      setFormError(null);
      if (mode === "edit" && editingYearId) {
        await updateYear(editingYearId, {
          anchorStart,
          cycleWeeks,
          periodCount: Math.floor(periodCount),
          timezone: config?.timezone ?? "Europe/Vienna",
        });
      } else {
        await createYear({
          redYear: Math.floor(redYear),
          anchorStart,
          cycleWeeks,
          periodCount: Math.floor(periodCount),
          timezone: config?.timezone ?? "Europe/Vienna",
          status: "draft",
        });
      }
      await loadYears();
      await loadCalendar({ from: yearRange.from, to: yearRange.to });
      setMode("view");
    } catch {
      setFormError(mode === "edit" ? "RED-Jahr konnte nicht gespeichert werden." : "RED-Jahr konnte nicht erstellt werden.");
    }
  };

  const sortedYears = [...years].sort((left, right) => right.redYear - left.redYear);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.7)",
          opacity: 0.6,
          cursor: "pointer",
          fontSize: 10,
          color: "rgba(0,0,0,0.52)",
          fontWeight: 600,
          letterSpacing: "0.02em",
          fontFamily: "inherit",
        }}
      >
        <Calendar size={11} strokeWidth={2} />
        {summaryLabel}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => {
            setOpen(false);
            setMode("view");
            setFormError(null);
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 720,
              maxWidth: "92vw",
              maxHeight: "84vh",
              overflow: "hidden",
              borderRadius: 16,
              background: "#fff",
              boxShadow: "0 20px 46px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                  RED-Monat Kalender
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.42)", marginTop: 2 }}>
                  Historische Jahre bleiben gespeichert. Neue Jahre werden als Entwurf angelegt.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {mode !== "view" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("view");
                      setEditingYearId(null);
                      setFormError(null);
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={beginCreate}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: "1px solid rgba(220,38,38,0.16)",
                    background: "rgba(220,38,38,0.06)",
                    color: "#DC2626",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  title="Neues RED-Jahr erstellen"
                >
                  <Plus size={14} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            {(formError || error) && (
              <div style={{ padding: "9px 16px", borderBottom: "1px solid rgba(220,38,38,0.16)", background: "rgba(220,38,38,0.05)", color: "#b91c1c", fontSize: 10, fontWeight: 700 }}>
                {formError ?? error}
              </div>
            )}

            {mode !== "view" && (
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.012)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 110px auto", gap: 10, alignItems: "end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.42)", letterSpacing: "0.04em" }}>JAHR</span>
                    <input
                      value={redYearDraft}
                      onChange={(event) => setRedYearDraft(event.target.value)}
                      disabled={mode === "edit"}
                      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "7px 8px", fontSize: 11, fontFamily: "inherit", outline: "none", background: mode === "edit" ? "rgba(0,0,0,0.03)" : "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.42)", letterSpacing: "0.04em" }}>START</span>
                    <RedMonthDatePicker value={anchorStart} onChange={setAnchorStart} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.42)", letterSpacing: "0.04em" }}>RHYTHMUS</span>
                    <input
                      value={cycleDraft}
                      onChange={(event) => setCycleDraft(event.target.value)}
                      placeholder="4/4/5"
                      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "7px 8px", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.42)", letterSpacing: "0.04em" }}>PERIODEN</span>
                    <input
                      value={periodCountDraft}
                      onChange={(event) => setPeriodCountDraft(event.target.value)}
                      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "7px 8px", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                    />
                  </label>
                  <button
                    onClick={() => void handleSaveYear()}
                    disabled={saving}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#fff",
                      background: "linear-gradient(to bottom,#DC2626,#b91c1c)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 18px rgba(185,28,28,0.18)",
                      cursor: saving ? "default" : "pointer",
                      opacity: saving ? 0.8 : 1,
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {saving ? "Speichern..." : mode === "edit" ? "Speichern" : "Erstellen"}
                  </button>
                </div>
              </div>
            )}

            <style>{`.redmonth-modal-scroll{scrollbar-width:none;-ms-overflow-style:none}.redmonth-modal-scroll::-webkit-scrollbar{display:none}`}</style>
            <div className="redmonth-modal-scroll" style={{ overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {(sortedYears.length > 0 ? sortedYears : activeYear ? [activeYear] : []).map((year) => (
                  <div
                    key={year.id}
                    style={{
                      border: year.id === current?.redMonthYearId ? "1px solid rgba(220,38,38,0.28)" : "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 12,
                      padding: 10,
                      background: year.id === current?.redMonthYearId ? "rgba(220,38,38,0.035)" : "#fff",
                      display: "grid",
                      gap: 7,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", letterSpacing: "-0.02em" }}>{year.redYear}</div>
                      <StatusPill status={year.status} />
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.52)", lineHeight: 1.4 }}>
                      Start {formatDate(year.anchorStart)} - {year.cycleWeeks.join("/")} - {year.periodCount} Perioden
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {year.status === "draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(year)}
                            style={{
                              border: "1px solid rgba(0,0,0,0.08)",
                              borderRadius: 8,
                              width: 28,
                              height: 26,
                              background: "#fff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                            title="Entwurf bearbeiten"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void activateYear(year.id)}
                            style={{
                              border: "1px solid rgba(16,185,129,0.16)",
                              borderRadius: 8,
                              height: 26,
                              padding: "0 9px",
                              background: "rgba(16,185,129,0.08)",
                              color: "#047857",
                              fontSize: 10,
                              fontWeight: 800,
                              fontFamily: "inherit",
                              cursor: "pointer",
                            }}
                          >
                            Aktivieren
                          </button>
                        </>
                      )}
                      {year.status !== "draft" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.42)" }}>
                          {year.status === "locked" ? <Lock size={11} /> : <CheckCircle2 size={11} />}
                          schreibgeschuetzt
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {sortedYears.length === 0 && (
                  <div style={{ border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12, padding: 12, fontSize: 10, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
                    Noch keine gespeicherten RED-Jahre gefunden. Der aktuelle Kalender läuft über den Legacy-Fallback.
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {(mode === "view" ? calendar : previewPeriods).map((period) => {
                  const clampedStart = mode === "view" && period.start < yearRange.from ? yearRange.from : period.start;
                  const clampedEnd = mode === "view" && period.end > yearRange.to ? yearRange.to : period.end;
                  return (
                    <div
                      key={period.id}
                      style={{
                        border: period.isCurrent ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 10,
                        padding: "9px 10px",
                        background: period.isCurrent ? "rgba(220,38,38,0.04)" : "#fff",
                        display: "grid",
                        gridTemplateColumns: "100px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, color: period.isCurrent ? "#b91c1c" : "#374151" }}>{period.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.58)" }}>
                        {formatDate(clampedStart)} - {formatDate(clampedEnd)}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: period.isCurrent ? "#b91c1c" : "rgba(0,0,0,0.32)", letterSpacing: "0.03em" }}>
                        {period.isCurrent ? "AKTUELL" : period.status.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
                {(mode === "view" ? calendar : previewPeriods).length === 0 && (
                  <div style={{ border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12, padding: 14, fontSize: 10, color: "rgba(0,0,0,0.45)", textAlign: "center" }}>
                    Keine RED-Monate für diese Ansicht.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
