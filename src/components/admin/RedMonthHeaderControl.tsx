"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Pencil } from "lucide-react";
import { useRedMonth } from "@/context/RedMonthContext";

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function RedMonthDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  const select = (day: number) => {
    const nextMonth = String(viewMonth + 1).padStart(2, "0");
    const nextDay = String(day).padStart(2, "0");
    onChange(`${viewYear}-${nextMonth}-${nextDay}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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
        <span>{value ? formatDate(value) : "Datum waehlen"}</span>
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
                  setViewYear((value) => value - 1);
                } else {
                  setViewMonth((value) => value - 1);
                }
              }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "rgba(0,0,0,0.45)", fontSize: 14 }}
            >
              ‹
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((value) => value + 1);
                } else {
                  setViewMonth((value) => value + 1);
                }
              }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: "rgba(0,0,0,0.45)", fontSize: 14 }}
            >
              ›
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
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSelected = Boolean(parsed && day === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear());
              return (
                <button
                  key={`${viewYear}-${viewMonth}-${day}-${index}`}
                  type="button"
                  onClick={() => select(day)}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: 6,
                    border: "none",
                    background: isSelected ? "linear-gradient(to bottom, #DC2626, #b91c1c)" : isToday ? "rgba(220,38,38,0.07)" : "transparent",
                    color: isSelected ? "#fff" : isToday ? "#DC2626" : "#111827",
                    fontSize: 11,
                    fontWeight: isSelected || isToday ? 700 : 500,
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

export function RedMonthHeaderControl() {
  const { current, config, calendar, loadCalendar, saveConfig, saving, error } = useRedMonth();
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [anchorStart, setAnchorStart] = useState("");
  const [cycleDraft, setCycleDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadCalendar();
  }, [loadCalendar, open]);

  useEffect(() => {
    if (!config) return;
    setAnchorStart(config.anchorStart);
    setCycleDraft(config.cycleWeeks.join("/"));
  }, [config]);

  const summaryLabel = useMemo(() => {
    if (!current) return "RED-Monat wird geladen";
    return `${current.label} · ${formatDate(current.start)} - ${formatDate(current.end)}`;
  }, [current]);

  const handleSave = async () => {
    const parsedCycle = cycleDraft
      .split(/[\/,\s]+/)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
      .map((entry) => Math.floor(entry));
    if (!anchorStart || parsedCycle.length === 0) {
      setFormError("Bitte gueltiges Startdatum und Wochenrhythmus angeben.");
      return;
    }
    try {
      setFormError(null);
      await saveConfig({ anchorStart, cycleWeeks: parsedCycle, timezone: config?.timezone ?? "Europe/Vienna" });
      await loadCalendar();
      setEditMode(false);
    } catch {
      setFormError("RED-Konfiguration konnte nicht gespeichert werden.");
    }
  };

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
            setEditMode(false);
            setFormError(null);
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 620,
              maxWidth: "92vw",
              maxHeight: "82vh",
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                  RED-Monat Kalender
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>
                  Globale Zeitraeume fuer alle RED-Daten
                </div>
              </div>
              <button
                onClick={() => setEditMode((value) => !value)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  opacity: 0.5,
                  color: "#1f2937",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                <Pencil size={11} strokeWidth={2} />
                Edit
              </button>
            </div>

            {editMode && (
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.01)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.45)", letterSpacing: "0.03em" }}>Anchor Start</span>
                    <RedMonthDatePicker
                      value={anchorStart}
                      onChange={setAnchorStart}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.45)", letterSpacing: "0.03em" }}>Rhythmus (Wochen)</span>
                    <input
                      value={cycleDraft}
                      onChange={(event) => setCycleDraft(event.target.value)}
                      placeholder="4/4/5"
                      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "6px 8px", fontSize: 11, fontFamily: "inherit", outline: "none", boxShadow: "none" }}
                    />
                  </label>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      background: "linear-gradient(to bottom,#DC2626,#b91c1c)",
                      cursor: saving ? "default" : "pointer",
                      opacity: saving ? 0.8 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {saving ? "Speichern..." : "Speichern"}
                  </button>
                </div>
                {(formError || error) && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#b91c1c", fontWeight: 600 }}>
                    {formError ?? error}
                  </div>
                )}
              </div>
            )}

            <style>{`.redmonth-modal-scroll{scrollbar-width:none;-ms-overflow-style:none}.redmonth-modal-scroll::-webkit-scrollbar{display:none}`}</style>
            <div className="redmonth-modal-scroll" style={{ overflowY: "auto", padding: 14, display: "grid", gap: 8 }}>
              {calendar.map((period) => (
                <div
                  key={period.id}
                  style={{
                    border: period.isCurrent ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: "9px 10px",
                    background: period.isCurrent ? "rgba(220,38,38,0.04)" : "#fff",
                    display: "grid",
                    gridTemplateColumns: "120px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: period.isCurrent ? "#b91c1c" : "#374151" }}>{period.label}</span>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.58)" }}>
                    {formatDate(period.start)} - {formatDate(period.end)}
                  </span>
                  {period.isCurrent && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#b91c1c", letterSpacing: "0.03em" }}>
                      AKTUELL
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

