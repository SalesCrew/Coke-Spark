"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calendarWeek, monthCalendarWeeks, shiftCalendarMonth } from "@/lib/sm/calendarWeeks";
import { MAX_SM_PERIOD_DAYS, smDayPeriod, smMonthPeriod, smPeriodLabel, smWeekPeriod, viennaToday, type SmPlanningPeriod } from "@/lib/sm/planningPeriod";
import { SmWeekCalendar, SmWeekCalendarStyles } from "./SmPlanningWeekPicker";

const MODES = [{ mode: "week", label: "KW" }, { mode: "days", label: "Tage" }, { mode: "month", label: "Monat" }] as const;
const dateLabel = (value: string) => new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));

export function SmDayCalendar({ month, from, to, today, onChoose, onMonthChange }: { month: string; from: string; to: string; today: string; onChoose: (day: string) => void; onMonthChange: (direction: -1 | 1) => void }) {
  return <>
    <div className="sm-plan-calendar-header">
      <button type="button" aria-label="Vorheriger Monat" className="sm-plan-calendar-nav" onClick={() => onMonthChange(-1)}><ChevronLeft size={13}/></button>
      <span aria-live="polite">{new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}T12:00:00Z`))}</span>
      <button type="button" aria-label="Nächster Monat" className="sm-plan-calendar-nav" onClick={() => onMonthChange(1)}><ChevronRight size={13}/></button>
    </div>
    <div className="sm-period-days sm-plan-week-headings" aria-hidden="true">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="sm-period-days" aria-label="Kalendertage">
      {monthCalendarWeeks(month).flatMap((week) => week.days).map((day) => <button type="button" key={day} data-day={day} aria-label={dateLabel(day)} aria-pressed={day >= from && day <= to} aria-current={day === today ? "date" : undefined} className={`sm-period-day${day === from || day === to ? " is-endpoint" : day > from && day < to ? " is-in-range" : ""}${day.slice(0, 7) !== month.slice(0, 7) ? " is-outside" : ""}`} onClick={() => onChoose(day)} onKeyDown={(event) => {
        const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
        if (!delta && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("[data-day]"));
        const index = buttons.indexOf(event.currentTarget);
        const target = event.key === "Home" ? index - index % 7 : event.key === "End" ? index + 6 - index % 7 : index + delta;
        buttons[Math.max(0, Math.min(buttons.length - 1, target))]?.focus();
      }}>{Number(day.slice(8))}</button>)}
    </div>
  </>;
}

export function SmMonthCalendar({ month, value, onChoose, onYearChange }: { month: string; value: SmPlanningPeriod; onChoose: (first: string) => void; onYearChange: (direction: -1 | 1) => void }) {
  const year = month.slice(0, 4);
  return <>
    <div className="sm-plan-calendar-header"><button type="button" aria-label="Vorheriges Jahr" onClick={() => onYearChange(-1)} className="sm-plan-calendar-nav"><ChevronLeft size={13}/></button><span aria-live="polite">{year}</span><button type="button" aria-label="Nächstes Jahr" onClick={() => onYearChange(1)} className="sm-plan-calendar-nav"><ChevronRight size={13}/></button></div>
    <div className="sm-period-months" aria-label="Kalendermonate">{Array.from({ length: 12 }, (_, index) => {
      const first = `${year}-${String(index + 1).padStart(2, "0")}-01`;
      const label = new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long" }).format(new Date(`${first}T12:00:00Z`));
      return <button type="button" key={first} aria-label={`${label} ${year}`} aria-pressed={value.mode === "month" && value.from === first} onClick={() => onChoose(first)}>{label}</button>;
    })}</div>
    <p className="sm-plan-calendar-selection">Immer vom 1. bis zum letzten Tag des Monats.</p>
  </>;
}

export function SmPlanningPeriodPicker({ value, onChange }: { value: SmPlanningPeriod; onChange: (period: SmPlanningPeriod) => void }) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null), panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(value.mode);
  const [month, setMonth] = useState(`${value.from.slice(0, 7)}-01`);
  const [today, setToday] = useState(viennaToday);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(308, window.innerWidth - 16), top = rect.bottom + 6;
    setPosition({ top, width, left: Math.max(8, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 8)), maxHeight: Math.max(0, window.innerHeight - top - 8) });
  }, []);
  const close = useCallback((focus: boolean) => { setOpen(false); setPendingStart(null); setError(null); if (focus) triggerRef.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) close(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    window.addEventListener("resize", updatePosition); window.addEventListener("scroll", updatePosition, true);
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open, close, updatePosition]);
  const apply = (period: SmPlanningPeriod) => { onChange(period); close(true); };
  const choose = (day: string) => {
    if (!pendingStart) { setPendingStart(day); setError(null); return; }
    try { apply(mode === "week" ? smWeekPeriod(pendingStart, day) : smDayPeriod(pendingStart, day)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Ungültiger Zeitraum"); }
  };
  return <>
    <SmWeekCalendarStyles/>
    <style>{`
      .sm-period-tabs{display:flex;gap:3px;padding:3px;margin-bottom:8px;border-radius:8px;background:#f3f4f6}
      .sm-period-tabs button{flex:1;height:28px;border:0;border-radius:6px;background:transparent;font-weight:600;font-size:10px;font-family:inherit;color:#6b7280;cursor:pointer}
      .sm-period-tabs button[aria-pressed=true]{background:#fff;color:#b91c1c;box-shadow:0 1px 3px #00000012}
      .sm-period-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;text-align:center}
      .sm-period-day{height:32px;border:0;border-radius:6px;background:transparent;color:#374151;font-size:10.5px;font-family:inherit;cursor:pointer;font-variant-numeric:tabular-nums}
      .sm-period-day:hover,.sm-period-day:focus-visible{background:#fef2f2;color:#b91c1c}.sm-period-day.is-outside{color:#9ca3af}
      .sm-period-day.is-in-range{background:rgba(220,38,38,.075);color:#991b1b}.sm-period-day.is-endpoint{background:linear-gradient(#dc2626,#b91c1c);color:white}.sm-period-day[aria-current=date]{text-decoration:underline;text-underline-offset:4px;font-weight:750}
      .sm-period-months{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0 10px}.sm-period-months button{height:36px;border:1px solid #0000000a;border-radius:7px;background:white;color:#4b5563;font:inherit;font-size:10px;cursor:pointer}.sm-period-months button:hover,.sm-period-months button[aria-pressed=true]{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
      .sm-period-tabs button:focus-visible,.sm-period-day:focus-visible,.sm-period-months button:focus-visible{outline:2px solid #dc262666;outline-offset:1px}
    `}</style>
    <button ref={triggerRef} type="button" aria-label={`Planungszeitraum auswählen, ${smPeriodLabel(value, true)}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} className="sm-plan-secondary-button sm-plan-week-trigger" onClick={() => {
      if (open) { close(false); return; }
      setMode(value.mode); setMonth(`${value.from.slice(0, 7)}-01`); setToday(viennaToday()); setPendingStart(null); setError(null); updatePosition(); setOpen(true);
    }}>{smPeriodLabel(value)}<ChevronDown size={10}/></button>
    {open && position ? createPortal(<div id={panelId} ref={panelRef} role="dialog" aria-label="Planungszeitraum auswählen" className="sm-plan-calendar-panel" style={{ position: "fixed", zIndex: 12000, ...position, overflowY: "auto" }}>
      <div className="sm-period-tabs" role="group" aria-label="Zeitraumtyp">{MODES.map((item) => <button type="button" key={item.mode} aria-pressed={mode === item.mode} onClick={() => { setMode(item.mode); setPendingStart(null); setError(null); }}>{item.label}</button>)}</div>
      {mode === "week" ? <SmWeekCalendar month={month} start={calendarWeek(value.from).start} end={calendarWeek(value.to).start} pendingStart={pendingStart} today={today} error={error} onChoose={choose} onChooseCurrent={() => apply(smWeekPeriod(today))} onMonthChange={(direction) => setMonth((current) => shiftCalendarMonth(current, direction))}/>
        : mode === "month" ? <><SmMonthCalendar month={month} value={value} onChoose={(first) => apply(smMonthPeriod(first))} onYearChange={(direction) => setMonth((current) => shiftCalendarMonth(current, direction * 12))}/><div className="sm-plan-calendar-footer"><button type="button" onClick={() => apply(smMonthPeriod(today))}>Aktueller Monat</button></div></>
        : <><SmDayCalendar month={month} from={pendingStart ?? value.from} to={pendingStart ?? value.to} today={today} onChoose={choose} onMonthChange={(direction) => setMonth((current) => shiftCalendarMonth(current, direction))}/>
          <div className="sm-plan-calendar-selection" aria-live="polite"><span>{pendingStart ? `${dateLabel(pendingStart)} · Tag anzeigen oder Enddatum wählen.` : `Einzelnen Tag oder Start- und Enddatum wählen · max. ${MAX_SM_PERIOD_DAYS} Tage.`}</span>{error ? <strong role="alert">{error}</strong> : null}</div>
          <div className="sm-plan-calendar-footer sm-plan-week-footer"><button type="button" onClick={() => apply(smDayPeriod(today))}>Heute</button><button type="button" disabled={!pendingStart} onClick={() => { if (pendingStart) apply(smDayPeriod(pendingStart)); }}>Tag anzeigen</button></div>
        </>}
    </div>, document.body) : null}
  </>;
}
