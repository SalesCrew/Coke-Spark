"use client";

import { useMemo, useState } from "react";
import type { IppPieSlice } from "@/lib/ipp-dashboard/mock-data";

type IppPieChartProps = {
  slices: IppPieSlice[];
  total: number;
  cumulativeSlices: IppPieSlice[];
  cumulativeTotal: number;
};

type SliceVisual = {
  stroke: string;
  fill: string;
  dot: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function bubbleRadius(count: number, maxCount: number): number {
  if (maxCount <= 0) return 0;
  return Math.round(66 * Math.sqrt(clamp(count, 0, maxCount) / maxCount));
}

export function IppPieChart({ slices, total, cumulativeSlices, cumulativeTotal }: IppPieChartProps) {
  const [mode, setMode] = useState<"int" | "cum">("int");
  const activeSlices = mode === "int" ? slices : cumulativeSlices;
  const activeTotal = mode === "int" ? total : cumulativeTotal;
  const visibleSlices = useMemo(() => activeSlices.slice(0, 2), [activeSlices]);
  const maxBubbleCount = useMemo(
    () => Math.max(...visibleSlices.map((slice) => Math.max(0, slice.count)), 1),
    [visibleSlices],
  );
  const visuals: SliceVisual[] = [
    {
      stroke: "#DC2626",
      fill: "rgba(220,38,38,0.05)",
      dot: "#DC2626",
    },
    {
      stroke: "#D98A7E",
      fill: "rgba(217,138,126,0.06)",
      dot: "#D98A7E",
    },
  ];

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", minHeight: 230, width: "100%" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.16,
          backgroundImage: "radial-gradient(rgba(0,0,0,0.22) 0.72px, transparent 0.72px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0",
        }}
      />
      <style>{`
        @keyframes ippBubblePop {
          from { opacity: 0; transform: scale(0.35); }
          to { opacity: 1; transform: scale(1); }
        }
        .ipp-bubble-pop {
          transform-origin: center bottom;
          animation-name: ippBubblePop;
          animation-duration: 550ms;
          animation-timing-function: cubic-bezier(0.34, 1.3, 0.5, 1);
          animation-fill-mode: both;
        }
        @media (prefers-reduced-motion: reduce) {
          .ipp-bubble-pop {
            animation: none !important;
          }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 3,
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(0,0,0,0.03)",
          padding: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setMode("int")}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 800,
            color: mode === "int" ? "#1f2937" : "rgba(0,0,0,0.56)",
            background: mode === "int" ? "linear-gradient(to bottom,#fff,#f4f4f5)" : "transparent",
            boxShadow: mode === "int" ? "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08)" : "none",
            cursor: "pointer",
          }}
        >
          Int
        </button>
        <button
          type="button"
          onClick={() => setMode("cum")}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 800,
            color: mode === "cum" ? "#1f2937" : "rgba(0,0,0,0.56)",
            background: mode === "cum" ? "linear-gradient(to bottom,#fff,#f4f4f5)" : "transparent",
            boxShadow: mode === "cum" ? "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08)" : "none",
            cursor: "pointer",
          }}
        >
          Cum
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, paddingTop: 4, paddingRight: 74 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 42,
              fontWeight: 800,
              lineHeight: 1,
              background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 62%, #EF4444 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            {activeTotal}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Gesamt
          </span>
        </div>
      </div>

      <div style={{ minHeight: 162, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 26, padding: "2px 8px 0" }}>
        {visibleSlices.map((slice, index) => {
          const radius = bubbleRadius(slice.count, maxBubbleCount);
          const diameter = radius * 2;
          const labelFontPx = Math.max(15, Math.round(radius * 0.42));
          return (
          <div
            key={`${mode}-${slice.id}`}
            className="ipp-bubble-pop"
            style={{
              width: diameter,
              height: diameter,
              borderRadius: "50%",
              border: `2px solid ${(visuals[index] ?? visuals[visuals.length - 1]!).stroke}`,
              background: (visuals[index] ?? visuals[visuals.length - 1]!).fill,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              animationDelay: `${index * 100}ms`,
            }}
          >
            <span
              style={{
                fontSize: labelFontPx,
                fontWeight: 800,
                color: (visuals[index] ?? visuals[visuals.length - 1]!).stroke,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {formatPercent(slice.percent)}
            </span>
          </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 2, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        {visibleSlices.map((slice, index) => (
          <div
            key={`row-${slice.id}`}
            style={{
              borderBottom: index < visibleSlices.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
              padding: "10px 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  display: "inline-block",
                  background: (visuals[index] ?? visuals[visuals.length - 1]!).dot,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{slice.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{formatPercent(slice.percent)}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.62)", marginTop: 2 }}>{slice.count} Fälle</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
