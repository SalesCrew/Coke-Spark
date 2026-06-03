"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  const hoverSurfaceRef = useRef<SVGRectElement | null>(null);
  const lastPointerClientXRef = useRef<number | null>(null);
  const lastAutoCenteredIntervalIdRef = useRef<string | null>(null);
  const dotPatternId = "platzierungen-dot-pattern";
  const baseWidth = 920;
  const height = 222;
  const paddingLeft = 34;
  const paddingRight = 14;
  const paddingTop = 14;
  const paddingBottom = 38;
  const minPointGap = 56;
  const width = Math.max(baseWidth, paddingLeft + paddingRight + Math.max(0, points.length - 1) * minPointGap);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const plotted = useMemo(() => {
    if (points.length === 0) return [];
    const pointStep = points.length <= 1 ? chartWidth : chartWidth / (points.length - 1);
    const groupWidth = clamp(pointStep * 0.52, 14, 22);
    const barGap = 3;
    const barWidth = Math.max(4, (groupWidth - barGap) / 2);
    return points.map((point, index) => {
      const centerX = points.length <= 1 ? paddingLeft + chartWidth / 2 : paddingLeft + index * pointStep;
      const groupX = centerX - groupWidth / 2;
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
        centerX,
      };
    });
  }, [chartHeight, chartWidth, points]);

  const findNearestIntervalId = (x: number): string | null => {
    if (!plotted.length) return null;
    let nearest = plotted[0]!;
    let nearestDistance = Math.abs(nearest.centerX - x);
    for (let i = 1; i < plotted.length; i += 1) {
      const candidate = plotted[i]!;
      const distance = Math.abs(candidate.centerX - x);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest.intervalId;
  };

  const updateHoveredFromClientX = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const x = paddingLeft + ratio * chartWidth;
    const nearestId = findNearestIntervalId(x);
    if (nearestId !== hoveredIntervalId) setHoveredIntervalId(nearestId);
  };

  const activeIntervalId = hoveredIntervalId;
  const hoveredPoint = hoveredIntervalId ? plotted.find((entry) => entry.intervalId === hoveredIntervalId) ?? null : null;
  const tooltipX = hoveredPoint ? hoveredPoint.centerX : 0;
  const tooltipY = hoveredPoint ? Math.max(14, Math.min(hoveredPoint.cokeY, hoveredPoint.competitorY) - 58) : 0;
  const tooltipWidth = 206;
  const tooltipHeight = 50;
  const railOffsetLeft = scrollWrapRef.current?.offsetLeft ?? 0;
  const tooltipOverlayLeft = railOffsetLeft + tooltipX - tooltipWidth / 2 - scrollLeft;
  const tooltipOverlayTop = tooltipY;

  useEffect(() => {
    const rail = scrollWrapRef.current;
    if (!rail || plotted.length === 0) return;
    const selectedPoint = plotted.find((point) => point.intervalId === selectedIntervalId) ?? plotted[plotted.length - 1];
    if (!selectedPoint) return;
    const targetIntervalId = selectedPoint.intervalId;
    if (lastAutoCenteredIntervalIdRef.current === targetIntervalId) return;
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxLeft <= 0) return;
    const targetLeft = clamp(selectedPoint.centerX - rail.clientWidth * 0.58, 0, maxLeft);
    rail.scrollTo({ left: targetLeft, behavior: "auto" });
    setScrollLeft(targetLeft);
    lastAutoCenteredIntervalIdRef.current = targetIntervalId;
  }, [plotted, selectedIntervalId]);

  useEffect(() => {
    const rail = scrollWrapRef.current;
    if (!rail) return;

    const syncHoverToPointer = () => {
      if (lastPointerClientXRef.current == null) return;
      const hoverSurface = hoverSurfaceRef.current;
      if (!hoverSurface) return;
      updateHoveredFromClientX(lastPointerClientXRef.current, hoverSurface.getBoundingClientRect());
    };

    const handleWheel = (event: WheelEvent) => {
      const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      if (maxLeft <= 0) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      rail.scrollLeft = clamp(rail.scrollLeft + delta, 0, maxLeft);
      requestAnimationFrame(syncHoverToPointer);
    };

    rail.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      rail.removeEventListener("wheel", handleWheel);
    };
  }, [chartWidth, hoveredIntervalId, plotted]);

  return (
    <div style={{ position: "relative", width: "100%", height: 227, overflow: "visible" }}>
      <style>{`
        .ipp-line-scroll-wrap::-webkit-scrollbar {
          height: 7px;
        }
        .ipp-line-scroll-wrap::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.06);
          border-radius: 999px;
        }
        .ipp-line-scroll-wrap::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(17,24,39,0.32);
          border: 1px solid transparent;
          background-clip: content-box;
        }
        .ipp-line-scroll-wrap::-webkit-scrollbar-thumb:hover {
          background: rgba(17,24,39,0.45);
          background-clip: content-box;
        }
      `}</style>
      <div
        ref={scrollWrapRef}
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
          if (lastPointerClientXRef.current == null) return;
          const hoverSurface = hoverSurfaceRef.current;
          if (!hoverSurface) return;
          updateHoveredFromClientX(lastPointerClientXRef.current, hoverSurface.getBoundingClientRect());
        }}
        className="ipp-line-scroll-wrap"
        style={{ width: "calc(100% - 18px)", margin: "0 9px", overflowX: "scroll", overflowY: "hidden", overscrollBehavior: "contain", scrollbarGutter: "stable", paddingBottom: 1 }}
      >
      <div style={{ position: "relative", width, minWidth: "100%", height: 227, overflow: "visible" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="coke-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="45%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <pattern id={dotPatternId} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="0.72" fill="rgba(0,0,0,0.22)" />
          </pattern>
        </defs>
        <rect
          x={paddingLeft}
          y={paddingTop}
          width={chartWidth}
          height={chartHeight}
          fill={`url(#${dotPatternId})`}
          opacity={0.46}
        />

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = paddingTop + (1 - tick / 100) * chartHeight;
          return (
            <g key={tick}>
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
                fillOpacity={active ? 0.42 : 0.34}
                stroke="#DC2626"
                strokeWidth={1}
                opacity={1}
              />
              <rect
                x={entry.competitorX}
                y={entry.competitorY}
                width={entry.barWidth}
                height={entry.competitorHeight}
                rx={Math.min(4, entry.barWidth / 2)}
                fill="#9CA3AF"
                fillOpacity={active ? 0.40 : 0.32}
                stroke={active ? "#6B7280" : "#9CA3AF"}
                strokeWidth={1}
                opacity={1}
              />
              <rect
                x={entry.groupX - 2}
                y={paddingTop}
                width={entry.groupWidth + 4}
                height={chartHeight}
                fill="transparent"
                onClick={() => onSelectInterval(entry.intervalId)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

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
        <rect
          ref={hoverSurfaceRef}
          x={paddingLeft}
          y={paddingTop}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onMouseMove={(event) => {
            lastPointerClientXRef.current = event.clientX;
            updateHoveredFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
          }}
          onMouseLeave={() => {
            lastPointerClientXRef.current = null;
            setHoveredIntervalId(null);
          }}
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
      </svg>
      </div>
      </div>
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            left: tooltipOverlayLeft,
            top: tooltipOverlayTop,
            width: tooltipWidth,
            height: tooltipHeight,
            borderRadius: 8,
            background: "rgba(255,255,255,0.99)",
            border: "1px solid rgba(15,23,42,0.10)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 12,
          }}
        >
          <div
            style={{
              height: 19,
              background: "rgba(15,23,42,0.045)",
              borderBottom: "1px solid rgba(15,23,42,0.08)",
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              fontSize: 8.5,
              fontWeight: 800,
              color: "rgba(15,23,42,0.56)",
              letterSpacing: "0.03em",
            }}
          >
            {hoveredPoint.label}
          </div>
          <div style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.42)" }}>Platzierung:</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{hoveredPoint.coke.toFixed(1)}%</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.32)" }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(15,23,42,0.62)", lineHeight: 1 }}>{hoveredPoint.competitor.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
