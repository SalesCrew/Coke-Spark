"use client";

import { useMemo, useState } from "react";
import type { PlatzierungenBarPoint } from "@/lib/platzierungen-dashboard/mock-data";

type PlatzierungenBarChartProps = {
  points: PlatzierungenBarPoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PlatzierungenBarChart({ points, selectedIntervalId, onSelectInterval }: PlatzierungenBarChartProps) {
  const [hoveredIntervalId, setHoveredIntervalId] = useState<string | null>(null);
  const width = 920;
  const height = 222;
  const paddingLeft = 34;
  const paddingRight = 14;
  const paddingTop = 14;
  const paddingBottom = 38;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const plotted = useMemo(() => {
    if (points.length === 0) return [];
    const groupGap = points.length > 14 ? 7 : 10;
    const groupWidth = Math.max(14, (chartWidth - (points.length - 1) * groupGap) / points.length);
    const barGap = 3;
    const barWidth = Math.max(4, (groupWidth - barGap) / 2);
    return points.map((point, index) => {
      const groupX = paddingLeft + index * (groupWidth + groupGap);
      const cokeHeight = (point.coke / 100) * chartHeight;
      const competitorHeight = (point.competitor / 100) * chartHeight;
      return {
        ...point,
        groupX,
        groupWidth,
        barWidth,
        cokeX: groupX,
        competitorX: groupX + barWidth + barGap,
        cokeY: paddingTop + (chartHeight - cokeHeight),
        competitorY: paddingTop + (chartHeight - competitorHeight),
        cokeHeight,
        competitorHeight,
        centerX: groupX + groupWidth / 2,
      };
    });
  }, [chartHeight, chartWidth, points]);

  const activeIntervalId = hoveredIntervalId;
  const hoveredPoint = hoveredIntervalId ? plotted.find((entry) => entry.intervalId === hoveredIntervalId) ?? null : null;
  const tooltipX = hoveredPoint ? clamp(hoveredPoint.centerX, 106, width - 106) : 0;
  const tooltipY = hoveredPoint ? Math.max(18, Math.min(hoveredPoint.cokeY, hoveredPoint.competitorY) - 64) : 0;

  return (
    <div style={{ position: "relative", width: "100%", height: 227 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="coke-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="45%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
        </defs>

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

        {plotted.map((entry) => {
          const active = entry.intervalId === activeIntervalId;
          const selected = entry.intervalId === selectedIntervalId;
          return (
            <g key={entry.intervalId}>
              {selected && (
                <rect
                  x={entry.groupX - 3}
                  y={paddingTop - 3}
                  width={entry.groupWidth + 6}
                  height={chartHeight + 6}
                  rx={8}
                  fill="rgba(220,38,38,0.06)"
                  stroke="rgba(220,38,38,0.2)"
                  strokeWidth={1}
                />
              )}
              <rect
                x={entry.cokeX}
                y={entry.cokeY}
                width={entry.barWidth}
                height={entry.cokeHeight}
                rx={Math.min(4, entry.barWidth / 2)}
                fill="url(#coke-bar-grad)"
                opacity={active ? 1 : 0.92}
              />
              <rect
                x={entry.competitorX}
                y={entry.competitorY}
                width={entry.barWidth}
                height={entry.competitorHeight}
                rx={Math.min(4, entry.barWidth / 2)}
                fill={active ? "#6B7280" : "#9CA3AF"}
                opacity={active ? 0.98 : 0.92}
              />
              <rect
                x={entry.groupX - 2}
                y={paddingTop}
                width={entry.groupWidth + 4}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIntervalId(entry.intervalId)}
                onMouseLeave={() => setHoveredIntervalId((current) => (current === entry.intervalId ? null : current))}
                onClick={() => onSelectInterval(entry.intervalId)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {hoveredPoint && (
          <g transform={`translate(${tooltipX}, ${tooltipY})`}>
            <rect x={-102} y={-8} width={204} height={52} rx={10} fill="rgba(255,255,255,0.98)" stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} />
            <text x={-88} y={4} fontFamily="inherit" fontSize={8.5} fontWeight={800} fill="rgba(0,0,0,0.42)" letterSpacing="0.03em">
              {hoveredPoint.label}
            </text>
            <text x={-88} y={20} fontFamily="inherit" fontSize={10} fontWeight={800} fill="#DC2626">
              Coke {hoveredPoint.coke.toFixed(1)}%
            </text>
            <text x={-88} y={34} fontFamily="inherit" fontSize={10} fontWeight={700} fill="#374151">
              Mitbewerber {hoveredPoint.competitor.toFixed(1)}%
            </text>
            <path d="M -5 44 L 0 49 L 5 44 Z" fill="rgba(255,255,255,0.98)" />
          </g>
        )}

        {plotted.map((entry, index) => {
          if (index % 2 !== 0 && plotted.length > 10) return null;
          return (
            <text
              key={`label-${entry.intervalId}`}
              x={entry.centerX}
              y={height - 13}
              textAnchor="middle"
              fontFamily="inherit"
              fontSize={10}
              fontWeight={entry.intervalId === activeIntervalId ? 700 : 500}
              fill={entry.intervalId === activeIntervalId ? "#1f2937" : "rgba(0,0,0,0.38)"}
            >
              {entry.shortLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
