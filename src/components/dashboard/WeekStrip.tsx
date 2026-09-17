"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

export interface CalendarVisitPreview {
  id: string;
  name: string;
  detail: string;
}

function getDateOffset(center: Date, offset: number): Date {
  const date = new Date(center);
  date.setDate(date.getDate() + offset);
  return date;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}

function isPast(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day < now;
}

interface WeekStripProps {
  holidayLabel?: (date: string) => string | undefined;
  selectedDate: string;
  visitsByDate: Record<string, CalendarVisitPreview[]>;
  onDateChange: (date: string) => void;
}

export function WeekStrip({ selectedDate, visitsByDate, onDateChange, holidayLabel }: WeekStripProps) {
  const { days, weekStart, weekEnd } = useMemo(() => {
    const selected = parseIsoDate(selectedDate);
    const monday = getDateOffset(selected, -((selected.getDay() + 6) % 7));
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = getDateOffset(monday, index);
      const isoDate = toIsoDate(date);
      return {
        date,
        isoDate,
        label: DAY_LABELS[date.getDay()],
        dateLabel: formatDayMonth(date),
        visits: visitsByDate[isoDate] ?? [],
        isPast: isPast(date),
        holiday: holidayLabel?.(isoDate),
      };
    });
    return { days: weekDays, weekStart: monday, weekEnd: weekDays[6].date };
  }, [selectedDate, visitsByDate, holidayLabel]);

  const selectedVisits = visitsByDate[selectedDate] ?? [];
  const selectedHoliday = holidayLabel?.(selectedDate);

  return (
    <div data-testid="sm-week-strip" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className="text-[10px] font-semibold tabular-nums text-black/40">
          {formatDayMonth(weekStart)} – {formatDayMonth(weekEnd)}{weekEnd.getFullYear()}
        </span>
        <div className="flex shrink-0 gap-1">
          <button type="button" aria-label="Vorherige Woche" onClick={() => onDateChange(toIsoDate(getDateOffset(parseIsoDate(selectedDate), -7)))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] text-black/45 active:bg-black/[0.08]">
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <button type="button" aria-label="Nächste Woche" onClick={() => onDateChange(toIsoDate(getDateOffset(parseIsoDate(selectedDate), 7)))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] text-black/45 active:bg-black/[0.08]">
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-7">
        {days.map((day) => {
          const selected = day.isoDate === selectedDate;
          return (
            <button
              key={day.isoDate}
              type="button"
              data-iso-date={day.isoDate}
              aria-label={`${day.label} ${day.dateLabel}${day.holiday ? `, ${day.holiday}` : ""}`}
              aria-pressed={selected}
              title={day.holiday}
              onClick={() => onDateChange(day.isoDate)}
              className="flex min-w-0 flex-col items-center rounded-lg py-1"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.02em]" style={{ color: selected ? "#DC2626" : "rgba(0,0,0,0.35)" }}>{day.label}</span>
              <span className="mb-1.5 mt-0.5 text-[8px] font-medium tabular-nums" style={{ color: selected ? "rgba(220,38,38,0.55)" : "rgba(0,0,0,0.3)" }}>{day.dateLabel}</span>
              <span
                className="flex aspect-square w-[min(36px,100%)] items-center justify-center rounded-full text-[13px] font-semibold"
                style={{
                  backgroundColor: selected ? "#DC2626" : day.holiday ? "#fef3c7" : day.isPast ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.04)",
                  boxShadow: selected ? "0 0 0 1px rgba(185,28,28,0.10), 0 0 12px rgba(220,38,38,0.24), 0 4px 8px rgba(185,28,28,0.16)" : "none",
                  color: selected ? "#fff" : day.holiday ? "#b45309" : day.isPast ? "rgba(220,38,38,0.45)" : "rgba(0,0,0,0.35)",
                }}
              >
                {day.visits.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex min-h-4 min-w-0 justify-center px-1 text-center">
        {selectedHoliday ? <span className="text-[9px] font-semibold text-amber-700">{selectedHoliday}</span> : selectedVisits[0] ? (
          <span className="truncate text-[9px] font-medium text-black/35">{selectedVisits[0].name} · {selectedVisits[0].detail}</span>
        ) : null}
      </div>
    </div>
  );
}
