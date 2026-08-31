"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calendarWeek, calendarWeekLabel, monthCalendarWeeks, shiftCalendarMonth } from "@/lib/sm/calendarWeeks";

const WEEKDAYS = ["KW", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const todayInVienna = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function SmWeekCalendar({ month, value, today, onChoose, onMonthChange }: {
  month: string;
  value: string;
  today: string;
  onChoose: (monday: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
}) {
  const selected = calendarWeek(value).start;
  return <>
    <div className="sm-plan-calendar-header">
      <button type="button" aria-label="Vorheriger Monat" onClick={() => onMonthChange(-1)} className="sm-plan-calendar-nav"><ChevronLeft size={13} /></button>
      <span aria-live="polite">{new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}T12:00:00Z`))}</span>
      <button type="button" aria-label="Nächster Monat" onClick={() => onMonthChange(1)} className="sm-plan-calendar-nav"><ChevronRight size={13} /></button>
    </div>
    <div className="sm-plan-week-columns sm-plan-week-headings" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="sm-plan-week-rows" aria-label="Kalenderwochen">
      {monthCalendarWeeks(month).map((week) => <button
        key={week.start}
        type="button"
        data-week-start={week.start}
        aria-label={calendarWeekLabel(week.start, true)}
        aria-pressed={week.start === selected}
        className={`sm-plan-week-columns sm-plan-week-row${week.start === selected ? " is-selected" : ""}`}
        onClick={() => onChoose(week.start)}
        onKeyDown={(event) => {
          const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
          if (!direction && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const rows = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("[data-week-start]"));
          const index = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, rows.indexOf(event.currentTarget) + direction));
          rows[index]?.focus();
        }}
      >
        <span className="sm-plan-week-number" aria-hidden="true">{week.number}</span>
        {week.days.map((date) => <span key={date} aria-hidden="true" className={`sm-plan-week-date${date.slice(0, 7) !== month.slice(0, 7) ? " is-outside" : ""}${date === today ? " is-today" : ""}`}>{Number(date.slice(8))}</span>)}
      </button>)}
    </div>
    <div className="sm-plan-calendar-footer sm-plan-week-footer">
      <span>Kalenderwoche wählen</span>
      <button type="button" onClick={() => onChoose(calendarWeek(today).start)}>Aktuelle KW</button>
    </div>
  </>;
}

export function SmPlanningWeekPicker({ value, onChange }: { value: string; onChange: (monday: string) => void }) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(`${value.slice(0, 7)}-01`);
  const [today, setToday] = useState(todayInVienna);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(308, window.innerWidth - 16);
    const top = rect.bottom + 6;
    setPosition({ top, width, left: Math.max(8, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 8)), maxHeight: Math.max(0, window.innerHeight - top - 8) });
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) close(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close, updatePosition]);

  const chooseWeek = (monday: string) => {
    onChange(monday);
    close(true);
  };

  return <>
    <style>{`
      .sm-plan-week-trigger{height:30px!important;padding:0 12px!important;white-space:nowrap;gap:7px!important}
      .sm-plan-week-trigger[aria-expanded=true]{border-color:rgba(220,38,38,.25);box-shadow:0 0 0 2px rgba(220,38,38,.04)}
      .sm-plan-week-trigger svg{color:rgba(0,0,0,.35);transition:transform .15s}
      .sm-plan-week-trigger[aria-expanded=true] svg{transform:rotate(180deg)}
      .sm-plan-week-columns{display:grid;grid-template-columns:34px repeat(7,minmax(0,1fr));align-items:center;text-align:center}
      .sm-plan-week-headings{height:26px;color:#9ca3af;font-size:9px;font-weight:650}
      .sm-plan-week-row{width:100%;height:32px;margin-bottom:3px;padding:0;border:0;border-radius:7px;background:transparent;color:#374151;font-family:inherit;font-size:10.5px;cursor:pointer;transition:background .12s,color .12s;outline-offset:2px}
      .sm-plan-week-row:hover:not(.is-selected),.sm-plan-week-row:focus-visible:not(.is-selected){background:#fef2f2;color:#b91c1c}
      .sm-plan-week-row.is-selected{background:linear-gradient(to bottom,#DC2626,#b91c1c);color:#fff;box-shadow:inset 0 1px .6px rgba(255,255,255,.3),0 1px 3px rgba(180,20,20,.14)}
      .sm-plan-week-number{font-size:10px;font-weight:700;border-right:1px solid rgba(0,0,0,.07)}
      .sm-plan-week-row.is-selected .sm-plan-week-number{border-color:rgba(255,255,255,.22)}
      .sm-plan-week-date{position:relative;line-height:32px;font-variant-numeric:tabular-nums}
      .sm-plan-week-date.is-outside{opacity:.38}
      .sm-plan-week-date.is-today{font-weight:750}
      .sm-plan-week-date.is-today:after{content:"";position:absolute;bottom:3px;left:calc(50% - 1.5px);width:3px;height:3px;border-radius:50%;background:currentColor}
      .sm-plan-week-row.is-selected .is-outside{opacity:.65}
      .sm-plan-week-footer{justify-content:space-between;align-items:center;gap:8px}
      .sm-plan-week-footer>span{color:#9ca3af;font-size:9px}
      .sm-plan-week-trigger:focus-visible,.sm-plan-week-row:focus-visible,.sm-plan-week-footer button:focus-visible{outline:2px solid rgba(220,38,38,.4)}
      @media(prefers-reduced-motion:reduce){.sm-plan-week-row,.sm-plan-week-trigger svg{transition:none}}
    `}</style>
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={`Kalenderwoche auswählen, ${calendarWeekLabel(value, true)}`}
      className="sm-plan-secondary-button sm-plan-week-trigger"
      onClick={() => {
        if (open) { close(false); return; }
        setMonth(`${value.slice(0, 7)}-01`);
        setToday(todayInVienna());
        updatePosition();
        setOpen(true);
      }}
    >{calendarWeekLabel(value)}<ChevronDown size={10} /></button>
    {open && position ? createPortal(
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label="Kalenderwoche auswählen"
        className="sm-plan-calendar-panel"
        style={{ position: "fixed", zIndex: 12000, ...position, overflowY: "auto" }}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !triggerRef.current?.contains(event.relatedTarget)) close(false);
        }}
      >
        <SmWeekCalendar month={month} value={value} today={today} onChoose={chooseWeek} onMonthChange={(direction) => setMonth((current) => shiftCalendarMonth(current, direction))} />
      </div>, document.body,
    ) : null}
  </>;
}
