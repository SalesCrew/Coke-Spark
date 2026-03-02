"use client";

import { useState, useMemo, useCallback, useRef } from "react";

const DAY_LABELS = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const VISIBLE = 5;
const BUFFER = 3;
const TOTAL = VISIBLE + BUFFER * 2;
const CENTER = Math.floor(TOTAL / 2);
const SLOT_WIDTH = 62;

interface MarketEntry {
  name: string;
  time: string;
}

const MOCK_MARKETS: Record<string, MarketEntry[]> = {
  "1": [{ name: "SPAR Zentrum", time: "09:30" }],
  "2": [
    { name: "BILLA Hauptstr.", time: "08:00" },
    { name: "ADEG Plus", time: "14:00" },
  ],
  "3": [
    { name: "MPREIS", time: "10:00" },
    { name: "HOFER Süd", time: "13:00" },
    { name: "REWE Nord", time: "16:00" },
  ],
  "4": [{ name: "LIDL West", time: "11:00" }],
  "5": [
    { name: "PENNY Ost", time: "09:00" },
    { name: "SPAR Express", time: "15:30" },
  ],
};

function getSeededMarkets(date: Date): MarketEntry[] {
  const seed = date.getDate() % 5;
  return MOCK_MARKETS[String(seed + 1)] || [];
}

function getDateOffset(center: Date, offset: number): Date {
  const d = new Date(center);
  d.setDate(d.getDate() + offset);
  return d;
}

function isPast(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

interface WeekStripProps {
  onDateChange?: (date: Date, markets: MarketEntry[]) => void;
}

export function WeekStrip({ onDateChange }: WeekStripProps) {
  const [centerDate, setCenterDate] = useState(() => new Date());
  const [slideOffset, setSlideOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => {
      const date = getDateOffset(centerDate, i - CENTER);
      const markets = getSeededMarkets(date);
      return {
        date,
        label: DAY_LABELS[date.getDay()],
        count: markets.length,
        markets,
        isPast: isPast(date),
      };
    });
  }, [centerDate]);

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

    const markets = getSeededMarkets(newCenter);
    onDateChange?.(newCenter, markets);
  }, [slideOffset, centerDate, onDateChange]);

  const centerDay = days[CENTER];
  const firstMarket = centerDay.markets[0];
  const visibleStart = BUFFER;
  const trackOffset = -BUFFER * SLOT_WIDTH;

  return (
    <div>
      <div
        className="overflow-hidden"
        style={{ width: VISIBLE * SLOT_WIDTH, margin: "0 auto" }}
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
                key={`${day.date.toISOString()}`}
                className="flex flex-col items-center cursor-pointer shrink-0"
                style={{
                  width: SLOT_WIDTH,
                  opacity: isVisible || animating ? 1 : 0,
                }}
                onClick={() => handleSelect(i)}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.02em] mb-1.5"
                  style={{
                    color: isHighlighted ? "#DC2626" : "rgba(0,0,0,0.25)",
                    transition: "color 350ms",
                  }}
                >
                  {day.label}
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
                      ? "0 2px 8px rgba(220,38,38,0.3)"
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
        {!animating && firstMarket && (
          <span
            className="text-[9px] font-medium whitespace-nowrap"
            style={{ color: "rgba(0,0,0,0.35)" }}
          >
            {firstMarket.name} · {firstMarket.time}
          </span>
        )}
      </div>
    </div>
  );
}
