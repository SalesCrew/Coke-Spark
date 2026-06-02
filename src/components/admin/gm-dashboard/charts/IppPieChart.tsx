"use client";

import { useState } from "react";
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
  boxGradient: string;
  boxBorder: string;
};

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? "1" : "0";
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export function IppPieChart({ slices, total, cumulativeSlices, cumulativeTotal }: IppPieChartProps) {
  const [mode, setMode] = useState<"int" | "cum">("int");
  const width = 300;
  const height = 230;
  const centerX = 150;
  const centerY = 108;
  const outerRadius = 74;
  const innerRadius = 56;
  const ringGapDeg = 3.2;
  const activeSlices = mode === "int" ? slices : cumulativeSlices;
  const activeTotal = mode === "int" ? total : cumulativeTotal;
  const visibleSlices = activeSlices.slice(0, 2);
  const visuals: SliceVisual[] = [
    {
      stroke: "#DC2626",
      fill: "rgba(220,38,38,0.18)",
      boxGradient: "linear-gradient(90deg, rgba(220,38,38,0.12) 0%, rgba(255,255,255,0.98) 74%)",
      boxBorder: "rgba(220,38,38,0.24)",
    },
    {
      stroke: "#F87171",
      fill: "rgba(248,113,113,0.19)",
      boxGradient: "linear-gradient(90deg, rgba(248,113,113,0.11) 0%, rgba(255,255,255,0.98) 74%)",
      boxBorder: "rgba(248,113,113,0.24)",
    },
  ];
  let angleCursor = 0;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", minHeight: 230, width: "100%" }}>
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

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ display: "block" }}>
        <defs>
          <linearGradient id="ipp-pie-text-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#F87171" />
          </linearGradient>
          <pattern id="ipp-pie-dot-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="0.72" fill="rgba(0,0,0,0.22)" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="url(#ipp-pie-dot-pattern)" opacity={0.28} />
        {visibleSlices.map((slice, index) => {
          const angle = (slice.percent / 100) * 360;
          const rawStart = angleCursor;
          const rawEnd = angleCursor + angle;
          angleCursor = rawEnd;
          const gap = Math.min(ringGapDeg, Math.max(0, angle - 0.8));
          const startAngle = rawStart + gap / 2;
          const endAngle = rawEnd - gap / 2;
          if (endAngle <= startAngle) return null;
          const visual = visuals[index] ?? visuals[visuals.length - 1]!;
          return (
            <path
              key={slice.id}
              d={describeDonutSlice(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle)}
              fill={visual.fill}
              stroke={visual.stroke}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          );
        })}
        <text x={centerX} y={112} textAnchor="middle" fontFamily="inherit" fontSize={26} fontWeight={800} fill="url(#ipp-pie-text-grad)">
          {activeTotal}
        </text>
        <text x={centerX} y={131} textAnchor="middle" fontFamily="inherit" fontSize={11} fontWeight={700} fill="url(#ipp-pie-text-grad)">
          Gesamt
        </text>
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleSlices.map((slice, index) => (
          <div
            key={slice.id}
            style={{
              borderRadius: 9,
              border: `1px solid ${visuals[index]?.boxBorder ?? "rgba(0,0,0,0.08)"}`,
              background: visuals[index]?.boxGradient ?? "rgba(255,255,255,0.94)",
              padding: "9px 11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  display: "inline-block",
                  background: visuals[index]?.stroke ?? slice.color,
                  boxShadow: "none",
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1f2937" }}>{slice.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{slice.percent.toFixed(1)}%</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>{slice.count} Fälle</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
