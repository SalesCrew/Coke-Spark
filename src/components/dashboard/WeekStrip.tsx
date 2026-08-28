"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const DAY_LABELS = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const VISIBLE = 5;
const BUFFER = 3;
const TOTAL = VISIBLE + BUFFER * 2;
const CENTER = Math.floor(TOTAL / 2);
const SLOT_WIDTH = 62;

export interface CalendarVisitPreview {
  id: string;
  name: string;
  detail: string;
}

function getDateOffset(center: Date, offset: number): Date {
  const d = new Date(center);
  d.setDate(d.getDate() + offset);
  return d;
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
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

interface WeekStripProps {
  selectedDate: string;
  visitsByDate: Record<string, CalendarVisitPreview[]>;
  onDateChange: (date: string) => void;
}

export function WeekStrip({ selectedDate, visitsByDate, onDateChange }: WeekStripProps) {
  const [centerDate, setCenterDate] = useState(() => parseIsoDate(selectedDate));
  const [slideOffset, setSlideOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => {
      const date = getDateOffset(centerDate, i - CENTER);
      const isoDate = toIsoDate(date);
      const visits = visitsByDate[isoDate] ?? [];
      return {
        date,
        isoDate,
        label: DAY_LABELS[date.getDay()],
        dateLabel: formatDayMonth(date),
        count: visits.length,
        visits,
        isPast: isPast(date),
      };
    });
  }, [centerDate, visitsByDate]);

  const handleSelect = useCallback(
    (i: number) => {
      if (animating) return;
      const offset = i - CENTER;
      if (offset === 0) return;

      setAnimating(true);
      setSlideOffset(-offset * SLOT_WIDTH);
    },
    [animating]
  );

  const handleTransitionEnd = useCallback(() => {
    const slotsShifted = Math.round(-slideOffset / SLOT_WIDTH);
    const newCenter = getDateOffset(centerDate, slotsShifted);

    setSlideOffset(0);
    setAnimating(false);
    setCenterDate(newCenter);
    onDateChange(toIsoDate(newCenter));
  }, [slideOffset, centerDate, onDateChange]);

  const centerDay = days[CENTER];
  const firstVisit = centerDay.visits[0];
  const visibleStart = BUFFER;
  const trackOffset = -BUFFER * SLOT_WIDTH;

  return (
    <div>
      <div
        className="overflow-hidden"
        style={{
          width: VISIBLE * SLOT_WIDTH,
          margin: "-9px auto -11px",
          padding: "9px 0 11px",
        }}
      >
        <div
          ref={trackRef}
          className="flex"
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: `translateX(${trackOffset + slideOffset}px)`,
            transition: animating
              ? "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)"
              : "none",
          }}
        >
          {days.map((day, i) => {
            const distFromCenter = i - CENTER;
            const isActiveCenter =
              slideOffset === 0
                ? distFromCenter === 0
                : false;
            const willBeCenter = animating
              ? i === CENTER + Math.round(-slideOffset / SLOT_WIDTH)
              : false;
            const isHighlighted = isActiveCenter || willBeCenter;

            const isVisible =
              i >= visibleStart && i < visibleStart + VISIBLE;

            return (
              <div
                key={day.isoDate}
                className="flex flex-col items-center cursor-pointer shrink-0"
                style={{
                  width: SLOT_WIDTH,
                  opacity: isVisible || animating ? 1 : 0,
                }}
                onClick={() => handleSelect(i)}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.02em]"
                  style={{
                    color: isHighlighted ? "#DC2626" : "rgba(0,0,0,0.25)",
                    transition: "color 350ms",
                  }}
                >
                  {day.label}
                </span>

                <span
                  className="mb-1.5 mt-0.5 text-[8px] font-medium tabular-nums"
                  style={{
                    color: isHighlighted ? "rgba(220,38,38,0.55)" : "rgba(0,0,0,0.22)",
                    transition: "color 350ms",
                  }}
                >
                  {day.dateLabel}
                </span>

                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isHighlighted
                      ? "#DC2626"
                      : day.isPast
                        ? "rgba(220,38,38,0.07)"
                        : "rgba(0,0,0,0.04)",
                    boxShadow: isHighlighted
                      ? "0 0 0 1px rgba(185,28,28,0.10), 0 0 12px rgba(220,38,38,0.24), 0 4px 8px rgba(185,28,28,0.16)"
                      : "none",
                    transform: isHighlighted ? "scale(1)" : "scale(0.92)",
                    transition: "all 350ms cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{
                      color: isHighlighted
                        ? "#ffffff"
                        : day.isPast
                          ? "rgba(220,38,38,0.45)"
                          : "rgba(0,0,0,0.22)",
                      transition: "color 350ms",
                    }}
                  >
                    {day.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center mt-1.5" style={{ minHeight: 16 }}>
        {!animating && firstVisit && (
          <span
            className="text-[9px] font-medium whitespace-nowrap"
            style={{ color: "rgba(0,0,0,0.35)" }}
          >
            {firstVisit.name} · {firstVisit.detail}
          </span>
        )}
      </div>
    </div>
  );
}
