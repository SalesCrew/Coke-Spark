"use client";

import { useEffect, useRef, useState } from "react";
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function IppIntervalToolbar({
  mode,
  onModeChange,
  intervals,
  selectedIntervalId,
  onSelectInterval,
}: IppIntervalToolbarProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScrollMeta = () => {
    const rail = railRef.current;
    if (!rail) return;
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setCanScroll(maxLeft > 0);
    setScrollProgress(maxLeft > 0 ? rail.scrollLeft / maxLeft : 0);
  };

  const scrollByAmount = (delta: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const nextLeft = clamp(rail.scrollLeft + delta, 0, maxLeft);
    rail.scrollTo({ left: nextLeft, behavior: "smooth" });
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateScrollMeta();
    const onScroll = () => updateScrollMeta();
    const onResize = () => updateScrollMeta();
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [intervals.length, mode]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <style>{`
        .ipp-interval-rail {
          scrollbar-width: none;
          overscroll-behavior-x: contain;
        }
        .ipp-interval-rail::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .ipp-interval-scrollbar {
          width: 100%;
          appearance: none;
          background: transparent;
          height: 10px;
          margin: 0;
          opacity: 0.95;
        }
        .ipp-interval-scrollbar:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .ipp-interval-scrollbar::-webkit-slider-runnable-track {
          height: 6px;
          background: rgba(0,0,0,0.08);
          border-radius: 999px;
        }
        .ipp-interval-scrollbar::-webkit-slider-thumb {
          appearance: none;
          width: 36px;
          height: 10px;
          margin-top: -2px;
          border-radius: 999px;
          background: rgba(17,24,39,0.34);
          border: 1px solid rgba(0,0,0,0.14);
          cursor: pointer;
        }
        .ipp-interval-scrollbar::-webkit-slider-thumb:hover {
          background: rgba(17,24,39,0.46);
        }
        .ipp-interval-scrollbar::-moz-range-track {
          height: 6px;
          background: rgba(0,0,0,0.08);
          border-radius: 999px;
          border: none;
        }
        .ipp-interval-scrollbar::-moz-range-thumb {
          width: 36px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(17,24,39,0.34);
          cursor: pointer;
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.04)", padding: 2, flexWrap: "wrap", gap: 2 }}>
          {MODES.map((entry) => {
            const active = entry.id === mode;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onModeChange(entry.id)}
                style={{
                  borderRadius: 7,
                  border: "none",
                  background: active ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "transparent",
                  color: active ? "#1f2937" : "rgba(0,0,0,0.58)",
                  padding: "5px 8px",
                  fontSize: 10,
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
        <div style={{ display: "inline-flex", gap: 5 }}>
          <button
            type="button"
            onClick={() => scrollByAmount(-260)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              border: "none",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              color: "rgba(0,0,0,0.62)",
              fontSize: 13,
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
              width: 24,
              height: 24,
              borderRadius: 7,
              border: "none",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              color: "rgba(0,0,0,0.62)",
              fontSize: 13,
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
          const rail = railRef.current;
          if (!rail) return;
          const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
          if (maxLeft <= 0) return;
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (delta === 0) return;
          const nextLeft = clamp(rail.scrollLeft + delta, 0, maxLeft);
          event.preventDefault();
          rail.scrollTo({ left: nextLeft, behavior: "auto" });
        }}
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
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
                borderRadius: 8,
                border: active ? "1px solid rgba(0,0,0,0.16)" : "1px solid rgba(0,0,0,0.1)",
                background: active ? "rgba(0,0,0,0.06)" : "#fff",
                color: active ? "#111827" : "rgba(0,0,0,0.62)",
                padding: "6px 8px",
                minWidth: 118,
                textAlign: "left",
                cursor: "pointer",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.07)" : "none",
                transition: "all 0.18s ease",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.02em" }}>{interval.shortLabel}</div>
              <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.82, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
                {interval.start} - {interval.end}
              </div>
            </button>
          );
        })}
      </div>

      <input
        className="ipp-interval-scrollbar"
        type="range"
        min={0}
        max={1000}
        step={1}
        disabled={!canScroll}
        value={Math.round(scrollProgress * 1000)}
        onChange={(event) => {
          const rail = railRef.current;
          if (!rail) return;
          const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
          const ratio = Number(event.currentTarget.value) / 1000;
          rail.scrollTo({ left: ratio * maxLeft, behavior: "auto" });
        }}
        aria-label="Intervall Scrollbar"
      />
    </section>
  );
}
