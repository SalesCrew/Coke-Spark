"use client";

import { useMemo, useState } from "react";
import type { FuellstandLinePoint } from "@/lib/fuellstand-dashboard/mock-data";

type FuellstandLineChartProps = {
  points: FuellstandLinePoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
};

type PlotPoint = {
  x: number;
  vollY: number;
  mittelY: number;
  leerY: number;
  raw: FuellstandLinePoint;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export function FuellstandLineChart({ points, selectedIntervalId, onSelectInterval }: FuellstandLineChartProps) {
  const [hoveredIntervalId, setHoveredIntervalId] = useState<string | null>(null);
  const width = 920;
  const height = 292;
  const paddingLeft = 34;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 46;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const activeIntervalId = hoveredIntervalId;

  const plotted = useMemo(() => {
    const series = points;
    if (series.length === 0) return [] as PlotPoint[];
    const yFor = (value: number) => paddingTop + (1 - value / 100) * chartHeight;
    return series.map((entry, index) => {
      const x = paddingLeft + (series.length <= 1 ? chartWidth / 2 : (index / (series.length - 1)) * chartWidth);
      return {
        x,
        vollY: yFor(entry.voll),
        mittelY: yFor(entry.mittel),
        leerY: yFor(entry.leer),
        raw: entry,
      };
    });
  }, [chartHeight, chartWidth, points]);

  const findNearestIntervalId = (x: number): string | null => {
    if (plotted.length === 0) return null;
    let nearest = plotted[0]!;
    let nearestDistance = Math.abs(nearest.x - x);
    for (let i = 1; i < plotted.length; i += 1) {
      const candidate = plotted[i]!;
      const distance = Math.abs(candidate.x - x);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest.raw.intervalId;
  };

  const updateHoveredFromClientX = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const x = paddingLeft + ratio * chartWidth;
    const nearestId = findNearestIntervalId(x);
    if (nearestId !== hoveredIntervalId) {
      setHoveredIntervalId(nearestId);
    }
  };

  const activePoint = plotted.find((entry) => entry.raw.intervalId === activeIntervalId) ?? null;
  const tooltipX = activePoint ? clamp(activePoint.x, 106, width - 106) : 0;
  const tooltipY = activePoint ? Math.max(22, Math.min(activePoint.vollY, activePoint.mittelY, activePoint.leerY) - 78) : 0;

  const vollPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.vollY })));
  const mittelPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.mittelY })));
  const leerPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.leerY })));

  return (
    <div style={{ position: "relative", width: "100%", height: 298 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = paddingTop + (1 - tick / 100) * chartHeight;
          return (
            <g key={tick}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
              <text x={6} y={y + 3} fontFamily="inherit" fontSize={10} fontWeight={700} fill="rgba(0,0,0,0.34)">
                {tick}%
              </text>
            </g>
          );
        })}

        <path d={vollPath} fill="none" stroke="#0B0B0B" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
        <path d={mittelPath} fill="none" stroke="#4B5563" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        <path d={leerPath} fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {activePoint && (
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={height - paddingBottom}
            stroke="rgba(0,0,0,0.2)"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
        )}

        {plotted.map((entry) => {
          const active = entry.raw.intervalId === activeIntervalId;
          return (
            <g key={entry.raw.intervalId}>
              <circle cx={entry.x} cy={entry.vollY} r={active ? 4.4 : 3.2} fill="#0B0B0B" />
              <circle cx={entry.x} cy={entry.mittelY} r={active ? 4.2 : 3.1} fill="#4B5563" />
              <circle cx={entry.x} cy={entry.leerY} r={active ? 4.1 : 3} fill="#9CA3AF" />
            </g>
          );
        })}

        {activePoint && (
          <g transform={`translate(${tooltipX}, ${tooltipY})`}>
            <rect x={-104} y={-8} width={208} height={58} rx={10} fill="#0b0b0f" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
            <text x={-90} y={5} fontFamily="inherit" fontSize={9} fontWeight={800} fill="#A1A1AA" letterSpacing="0.03em">
              {activePoint.raw.label}
            </text>
            <text x={-90} y={22} fontFamily="inherit" fontSize={10} fontWeight={700} fill="#ffffff">
              Voll {activePoint.raw.voll.toFixed(1)}%
            </text>
            <text x={-10} y={22} fontFamily="inherit" fontSize={10} fontWeight={700} fill="#ffffff">
              Mittel {activePoint.raw.mittel.toFixed(1)}%
            </text>
            <text x={-90} y={38} fontFamily="inherit" fontSize={10} fontWeight={700} fill="#ffffff">
              Leer {activePoint.raw.leer.toFixed(1)}%
            </text>
            <text x={-10} y={38} fontFamily="inherit" fontSize={10} fontWeight={700} fill="#A1A1AA">
              Summe {(activePoint.raw.voll + activePoint.raw.mittel + activePoint.raw.leer).toFixed(1)}%
            </text>
            <path d="M -5 50 L 0 56 L 5 50 Z" fill="#0b0b0f" />
          </g>
        )}

        <rect
          x={paddingLeft}
          y={paddingTop}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onMouseMove={(event) => updateHoveredFromClientX(event.clientX, event.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHoveredIntervalId(null)}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            const x = paddingLeft + ratio * chartWidth;
            const nearestId = findNearestIntervalId(x);
            if (nearestId) onSelectInterval(nearestId);
          }}
          style={{ cursor: "pointer" }}
        />

        {plotted.map((entry, index) => {
          if (index % 2 !== 0 && plotted.length > 10) return null;
          return (
            <text
              key={`label-${entry.raw.intervalId}`}
              x={entry.x}
              y={height - 14}
              textAnchor="middle"
              fontFamily="inherit"
              fontSize={10}
              fontWeight={entry.raw.intervalId === activeIntervalId ? 700 : 500}
              fill={entry.raw.intervalId === activeIntervalId ? "#1f2937" : "rgba(0,0,0,0.38)"}
            >
              {entry.raw.shortLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
