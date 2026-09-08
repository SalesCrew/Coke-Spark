"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calendarWeek, calendarWeekLabel, calendarWeekRange, monthCalendarWeeks, shiftCalendarMonth } from "@/lib/sm/calendarWeeks";

const WEEKDAYS = ["KW", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MAX_RANGE_WEEKS = 13;
const todayInVienna = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function rangeLabel(start: string, end: string): string {
  if (start === end) return calendarWeekLabel(start);
  const first = calendarWeek(start);
  const last = calendarWeek(end);
  return first.year === last.year ? `KW ${first.number}–${last.number}` : `KW ${first.number}/${first.year}–${last.number}/${last.year}`;
}

export function SmWeekCalendar({ month, start, end, pendingStart, today, error, onChoose, onChooseCurrent, onMonthChange }: {
  month: string;
  start: string;
  end: string;
  pendingStart: string | null;
  today: string;
  error: string | null;
  onChoose: (monday: string) => void;
  onChooseCurrent: () => void;
  onMonthChange: (direction: -1 | 1) => void;
}) {
  const selectedStart = calendarWeek(start).start;
  const selectedEnd = calendarWeek(end).start;
  return <>
    <div className="sm-plan-calendar-header">
      <button type="button" aria-label="Vorheriger Monat" onClick={() => onMonthChange(-1)} className="sm-plan-calendar-nav"><ChevronLeft size={13} /></button>
      <span aria-live="polite">{new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}T12:00:00Z`))}</span>
      <button type="button" aria-label="Nächster Monat" onClick={() => onMonthChange(1)} className="sm-plan-calendar-nav"><ChevronRight size={13} /></button>
    </div>
    <div className="sm-plan-week-columns sm-plan-week-headings" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="sm-plan-week-rows" aria-label="Kalenderwochen">
      {monthCalendarWeeks(month).map((week) => {
        const isPending = week.start === pendingStart;
        const isStart = !pendingStart && week.start === selectedStart;
        const isEnd = !pendingStart && week.start === selectedEnd;
        const isBetween = !pendingStart && week.start > selectedStart && week.start < selectedEnd;
        const pressed = isPending || isStart || isEnd || isBetween;
        return <button
          key={week.start}
          type="button"
          data-week-start={week.start}
          aria-label={pendingStart ? `${calendarWeekLabel(week.start, true)} als Ende wählen` : calendarWeekLabel(week.start, true)}
          aria-pressed={pressed}
          className={`sm-plan-week-columns sm-plan-week-row${isPending ? " is-pending" : ""}${isStart ? " is-range-start" : ""}${isEnd ? " is-range-end" : ""}${isBetween ? " is-in-range" : ""}`}
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
        </button>;
      })}
    </div>
    <div className="sm-plan-calendar-selection" aria-live="polite">
      <span>{pendingStart ? `${calendarWeekLabel(pendingStart)} gewählt · jetzt End-KW wählen` : "Start-KW wählen, danach End-KW"}</span>
      {error ? <strong role="alert">{error}</strong> : null}
    </div>
    <div className="sm-plan-calendar-footer sm-plan-week-footer">
      <span>Maximal {MAX_RANGE_WEEKS} Kalenderwochen</span>
      <button type="button" onClick={onChooseCurrent}>Aktuelle KW</button>
    </div>
  </>;
}

export function SmPlanningWeekPicker({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(`${start.slice(0, 7)}-01`);
  const [today, setToday] = useState(todayInVienna);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
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
    setPendingStart(null);
    setRangeError(null);
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
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close, updatePosition]);

  const chooseWeek = (monday: string) => {
    const normalized = calendarWeek(monday).start;
    if (!pendingStart) {
      setPendingStart(normalized);
      setRangeError(null);
      return;
    }
    const range = calendarWeekRange(pendingStart, normalized);
    if (range.weekCount > MAX_RANGE_WEEKS) {
      setRangeError(`Bitte höchstens ${MAX_RANGE_WEEKS} KWs auswählen.`);
      return;
    }
    onChange(range.start, range.end);
    close(true);
  };

  return <>
    <style>{`
      .sm-plan-week-trigger{height:30px!important;padding:0 12px!important;white-space:nowrap;gap:7px!important}
      .sm-plan-week-trigger[aria-expanded=true]{border-color:rgba(220,38,38,.25);box-shadow:0 0 0 2px rgba(220,38,38,.04)}
      .sm-plan-week-trigger svg{color:rgba(0,0,0,.35);transition:transform .15s}.sm-plan-week-trigger[aria-expanded=true] svg{transform:rotate(180deg)}
      .sm-plan-week-columns{display:grid;grid-template-columns:34px repeat(7,minmax(0,1fr));align-items:center;text-align:center}
      .sm-plan-week-headings{height:26px;color:#9ca3af;font-size:9px;font-weight:650}
      .sm-plan-week-row{width:100%;height:32px;margin-bottom:3px;padding:0;border:0;border-radius:7px;background:transparent;color:#374151;font-family:inherit;font-size:10.5px;cursor:pointer;transition:background .12s,color .12s,box-shadow .12s;outline-offset:2px}
      .sm-plan-week-row:hover,.sm-plan-week-row:focus-visible{background:#fef2f2;color:#b91c1c}.sm-plan-week-row.is-in-range{background:rgba(220,38,38,.075);color:rgba(153,27,27,.72)}
      .sm-plan-week-row.is-range-start,.sm-plan-week-row.is-range-end,.sm-plan-week-row.is-pending{background:linear-gradient(to bottom,#DC2626,#b91c1c);color:#fff;box-shadow:inset 0 1px .6px rgba(255,255,255,.3),0 1px 3px rgba(180,20,20,.14)}
      .sm-plan-week-number{font-size:10px;font-weight:700;border-right:1px solid rgba(0,0,0,.07)}
      .sm-plan-week-row.is-range-start .sm-plan-week-number,.sm-plan-week-row.is-range-end .sm-plan-week-number,.sm-plan-week-row.is-pending .sm-plan-week-number{border-color:rgba(255,255,255,.22)}
      .sm-plan-week-date{position:relative;line-height:32px;font-variant-numeric:tabular-nums}.sm-plan-week-date.is-outside{opacity:.38}.sm-plan-week-date.is-today{font-weight:750}
      .sm-plan-week-date.is-today:after{content:"";position:absolute;bottom:3px;left:calc(50% - 1.5px);width:3px;height:3px;border-radius:50%;background:currentColor}
      .sm-plan-week-row.is-range-start .is-outside,.sm-plan-week-row.is-range-end .is-outside,.sm-plan-week-row.is-pending .is-outside{opacity:.65}
      .sm-plan-calendar-selection{min-height:35px;margin:5px 0 1px;padding:7px 9px;display:grid;gap:2px;border-radius:7px;background:rgba(0,0,0,.025);color:rgba(0,0,0,.48);font-size:9px;line-height:1.35}.sm-plan-calendar-selection strong{color:#b91c1c;font-weight:650}
      .sm-plan-week-footer{justify-content:space-between;align-items:center;gap:8px}.sm-plan-week-footer>span{color:#9ca3af;font-size:9px}
      .sm-plan-week-trigger:focus-visible,.sm-plan-week-row:focus-visible,.sm-plan-week-footer button:focus-visible{outline:2px solid rgba(220,38,38,.4)}
      @media(prefers-reduced-motion:reduce){.sm-plan-week-row,.sm-plan-week-trigger svg{transition:none}}
    `}</style>
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={`Kalenderwochen auswählen, ${calendarWeekLabel(start, true)} bis ${calendarWeekLabel(end, true)}`}
      className="sm-plan-secondary-button sm-plan-week-trigger"
      onClick={() => {
        if (open) { close(false); return; }
        setMonth(`${start.slice(0, 7)}-01`);
        setToday(todayInVienna());
        setPendingStart(null);
        setRangeError(null);
        updatePosition();
        setOpen(true);
      }}
    >{rangeLabel(start, end)}<ChevronDown size={10} /></button>
    {open && position ? createPortal(
      <div id={panelId} ref={panelRef} role="dialog" aria-label="Kalenderwochen auswählen" className="sm-plan-calendar-panel" style={{ position: "fixed", zIndex: 12000, ...position, overflowY: "auto" }}>
        <SmWeekCalendar month={month} start={start} end={end} pendingStart={pendingStart} today={today} error={rangeError} onChoose={chooseWeek} onChooseCurrent={() => { const current = calendarWeek(today).start; onChange(current, current); close(true); }} onMonthChange={(direction) => setMonth((current) => shiftCalendarMonth(current, direction))} />
      </div>, document.body,
    ) : null}
  </>;
}
