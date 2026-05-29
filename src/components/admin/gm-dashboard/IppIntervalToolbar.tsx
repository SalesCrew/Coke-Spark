"use client";

import { useRef } from "react";
import type { IntervalMode, IppInterval } from "@/lib/ipp-dashboard/intervals";

type IppIntervalToolbarProps = {
  mode: IntervalMode;
  onModeChange: (mode: IntervalMode) => void;
  intervals: IppInterval[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
};

const MODES: Array<{ id: IntervalMode; label: string }> = [
  { id: "redmonth", label: "RedMonth" },
  { id: "week", label: "Woche (Mo-Fr)" },
  { id: "month", label: "Monat" },
  { id: "quarter", label: "Quartal" },
];

export function IppIntervalToolbar({
  mode,
  onModeChange,
  intervals,
  selectedIntervalId,
  onSelectInterval,
}: IppIntervalToolbarProps) {
  const railRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (delta: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <style>{`
        .ipp-interval-rail::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.04)", padding: 3, flexWrap: "wrap", gap: 2 }}>
          {MODES.map((entry) => {
            const active = entry.id === mode;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onModeChange(entry.id)}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: active ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "transparent",
                  color: active ? "#1f2937" : "rgba(0,0,0,0.58)",
                  padding: "7px 9px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: active
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)"
                    : "none",
                  transition: "all 0.18s ease",
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => scrollByAmount(-260)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              color: "rgba(0,0,0,0.62)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(260)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              color: "rgba(0,0,0,0.62)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="ipp-interval-rail"
        ref={railRef}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          const rail = railRef.current;
          if (!rail) return;
          rail.scrollBy({ left: event.deltaY, behavior: "auto" });
        }}
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingBottom: 2,
        }}
      >
        {intervals.map((interval) => {
          const active = interval.id === selectedIntervalId;
          return (
            <button
              key={interval.id}
              type="button"
              onClick={() => onSelectInterval(interval.id)}
              style={{
                flexShrink: 0,
                borderRadius: 10,
                border: active ? "1px solid rgba(0,0,0,0.16)" : "1px solid rgba(0,0,0,0.1)",
                background: active ? "rgba(0,0,0,0.06)" : "#fff",
                color: active ? "#111827" : "rgba(0,0,0,0.62)",
                padding: "8px 10px",
                minWidth: 132,
                textAlign: "left",
                cursor: "pointer",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.07)" : "none",
                transition: "all 0.18s ease",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.02em" }}>{interval.shortLabel}</div>
              <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.82, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                {interval.start} - {interval.end}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
