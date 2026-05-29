"use client";

import { useId, useMemo, useState } from "react";
import type { IppCompareResult, IppLinePoint } from "@/lib/ipp-dashboard/mock-data";

type IppLineChartProps = {
  points: IppLinePoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
  compareEnabled: boolean;
  delta: IppCompareResult | null;
};

type PlotPoint = {
  x: number;
  y: number;
  compareY: number | null;
  raw: IppLinePoint;
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

function formatDelta(delta: IppCompareResult | null): { text: string; positive: boolean } {
  if (!delta || delta.deltaPct == null) return { text: "—", positive: true };
  const positive = delta.deltaPct >= 0;
  return {
    text: `${positive ? "▲" : "▼"} ${Math.abs(delta.deltaPct).toFixed(1)}% vs compare`,
    positive,
  };
}

export function IppLineChart({ points, selectedIntervalId, onSelectInterval, compareEnabled, delta }: IppLineChartProps) {
  const [hoveredIntervalId, setHoveredIntervalId] = useState<string | null>(null);
  const idBase = useId().replaceAll(":", "");
  const tooltipShadowId = `${idBase}-tooltipShadow`;
  const width = 920;
  const height = 280;
  const paddingLeft = 24;
  const paddingRight = 18;
  const paddingTop = 16;
  const paddingBottom = 44;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const activeIntervalId = hoveredIntervalId;

  const plotted = useMemo(() => {
    const series = points;
    if (series.length === 0) return [] as PlotPoint[];
    const values = series
      .flatMap((entry) => [entry.value, entry.compareValue ?? undefined])
      .filter((value): value is number => typeof value === "number");
    const min = Math.min(...values, 5);
    const max = Math.max(...values, 7);
    const pad = Math.max(0.2, (max - min) * 0.18);
    const minVal = min - pad;
    const maxVal = max + pad;
    const yFor = (value: number) => {
      if (maxVal === minVal) return paddingTop + chartHeight / 2;
      const ratio = (value - minVal) / (maxVal - minVal);
      return paddingTop + (1 - ratio) * chartHeight;
    };
    return series.map((entry, idx) => {
      const x = paddingLeft + (series.length <= 1 ? chartWidth / 2 : (idx / (series.length - 1)) * chartWidth);
      return {
        x,
        y: yFor(entry.value),
        compareY: entry.compareValue == null ? null : yFor(entry.compareValue),
        raw: entry,
      };
    });
  }, [chartHeight, chartWidth, paddingLeft, paddingTop, points]);

  const activePointIndex = plotted.findIndex((point) => point.raw.intervalId === activeIntervalId);
  const activePoint = activePointIndex >= 0 ? plotted[activePointIndex]! : null;

  const primaryPath = buildSmoothPath(plotted.map((point) => ({ x: point.x, y: point.y })));
  const primaryAreaPath =
    plotted.length > 1
      ? `${primaryPath} L ${plotted[plotted.length - 1]!.x} ${height - paddingBottom} L ${plotted[0]!.x} ${height - paddingBottom} Z`
      : "";
  const comparePath = compareEnabled
    ? buildSmoothPath(plotted.filter((point) => point.compareY != null).map((point) => ({ x: point.x, y: point.compareY as number })))
    : "";

  const tooltipX = activePoint ? clamp(activePoint.x, 88, width - 88) : 0;
  const tooltipY = activePoint ? Math.max(26, activePoint.y - 62) : 0;
  const previousPoint = activePointIndex > 0 ? plotted[activePointIndex - 1] : null;
  const activeDelta = activePoint && previousPoint
    ? ((activePoint.raw.value - previousPoint.raw.value) / previousPoint.raw.value) * 100
    : null;
  const activeDeltaText = activeDelta == null ? null : `${activeDelta >= 0 ? "+" : "-"}${Math.abs(activeDelta).toFixed(1)}%`;
  const deltaLabel = formatDelta(delta);

  const findNearestIntervalId = (x: number): string | null => {
    if (!plotted.length) return null;
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

  return (
    <div style={{ position: "relative", width: "100%", height: 286 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0B0B0B" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#0B0B0B" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#0B0B0B" stopOpacity="0" />
          </linearGradient>
          <filter id={tooltipShadowId} x="-70%" y="-70%" width="240%" height="240%">
            <feDropShadow dx="0" dy="4" stdDeviation="7" floodColor="#000000" floodOpacity="0.24" />
          </filter>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
          const y = paddingTop + chartHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={1}
            />
          );
        })}

        {compareEnabled && comparePath.length > 0 && (
          <path
            d={comparePath}
            fill="none"
            stroke="rgba(107,114,128,0.85)"
            strokeWidth={2.2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        )}

        {primaryAreaPath && <path d={primaryAreaPath} fill="url(#area-grad)" />}

        <path
          d={primaryPath}
          fill="none"
          stroke="#0B0B0B"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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

        {plotted.map((point) => {
          const active = point.raw.intervalId === activeIntervalId;
          const selected = point.raw.intervalId === selectedIntervalId;
          return (
            <g key={point.raw.intervalId}>
              {compareEnabled && point.compareY != null && (
                <circle cx={point.x} cy={point.compareY} r={active ? 3.4 : 2.4} fill="#9CA3AF" />
              )}
              {active && <circle cx={point.x} cy={point.y} r={9.5} fill="rgba(17,17,17,0.14)" />}
              <circle cx={point.x} cy={point.y} r={active ? 5.6 : selected ? 5 : 4.2} fill={active ? "#ffffff" : "#111111"} stroke="#111111" strokeWidth={active ? 2 : selected ? 1.7 : 1.2} />
              <circle
                cx={point.x}
                cy={point.y}
                r={13}
                fill="transparent"
                onClick={() => onSelectInterval(point.raw.intervalId)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {activePoint && (
          <g transform={`translate(${tooltipX}, ${tooltipY})`}>
            <rect x={-84} y={-9} width={168} height={40} rx={10} fill="#090b10" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} filter={`url(#${tooltipShadowId})`} />
            <text x={-69} y={5} fontFamily="inherit" fontSize={8.5} fontWeight={800} fill="#A1A1AA" letterSpacing="0.03em">
              {activePoint.raw.label}
            </text>
            <text x={-69} y={22} fontFamily="inherit" fontSize={15} fontWeight={800} fill="#ffffff">
              <tspan>{activePoint.raw.value.toFixed(1)} IPP</tspan>
              {activeDeltaText ? (
                <tspan
                  dx={8}
                  fontSize={9.5}
                  fontWeight={800}
                  fill={activeDelta != null && activeDelta >= 0 ? "#86EFAC" : "#FCA5A5"}
                >
                  {activeDeltaText}
                </tspan>
              ) : (
                <tspan dx={8} fontSize={9.5} fontWeight={800} fill="#A1A1AA">
                  —
                </tspan>
              )}
            </text>
            <path d="M -5 31 L 0 36 L 5 31 Z" fill="#090b10" />
          </g>
        )}

        {plotted.map((point, idx) => {
          if (idx % 2 !== 0 && plotted.length > 10) return null;
          return (
            <text
              key={`lbl-${point.raw.intervalId}`}
              x={point.x}
              y={height - 16}
              textAnchor="middle"
              fontFamily="inherit"
              fontSize={10}
              fontWeight={point.raw.intervalId === activeIntervalId ? 700 : 500}
              fill={point.raw.intervalId === activeIntervalId ? "#1f2937" : "rgba(0,0,0,0.38)"}
            >
              {point.raw.shortLabel}
            </text>
          );
        })}
      </svg>

      <div style={{ position: "absolute", right: 8, top: 6, fontSize: 11, fontWeight: 700, color: deltaLabel.positive ? "#15803d" : "#b91c1c" }}>
        {deltaLabel.text}
      </div>
    </div>
  );
}
