"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { IppCompareResult, IppLinePoint } from "@/lib/ipp-dashboard/mock-data";

type IppLineChartProps = {
  points: IppLinePoint[];
  ytdAverage: number | null;
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

export function IppLineChart({ points, ytdAverage, selectedIntervalId, onSelectInterval, compareEnabled, delta }: IppLineChartProps) {
  const [hoveredIntervalId, setHoveredIntervalId] = useState<string | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  const hoverSurfaceRef = useRef<SVGRectElement | null>(null);
  const lastPointerClientXRef = useRef<number | null>(null);
  const lastAutoCenteredIntervalIdRef = useRef<string | null>(null);
  const idBase = useId().replaceAll(":", "");
  const tooltipShadowId = `${idBase}-tooltipShadow`;
  const dotPatternId = `${idBase}-dotPattern`;
  const baseWidth = 920;
  const height = 332;
  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 34;
  const minPointGap = 56;
  const width = Math.max(baseWidth, paddingLeft + paddingRight + Math.max(0, points.length - 1) * minPointGap);
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
    const span = Math.max(0.6, max - min);
    // Use balanced headroom so the curve occupies the full chart area.
    const bottomPad = Math.max(0.05, span * 0.06);
    const topPad = Math.max(0.14, span * 0.14);
    const minVal = min - bottomPad;
    const maxVal = max + topPad;
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
  const overlapGapSegments = useMemo(() => {
    if (!compareEnabled || plotted.length < 2) return [] as Array<{ d: string; fill: string }>;
    type GapPoint = { x: number; baseY: number; compareY: number };
    type GapRegion = { baseAbove: boolean; points: GapPoint[] };
    const regions: GapRegion[] = [];
    let currentRegion: GapRegion | null = null;
    const stripMoveTo = (path: string): string => {
      const trimmed = path.trim();
      if (!trimmed.startsWith("M")) return trimmed;
      return trimmed.replace(/^M\s*[-\d.]+\s+[-\d.]+\s*/, "");
    };
    const regionToPath = (region: GapRegion): string | null => {
      if (region.points.length < 2) return null;
      const basePoints = region.points.map((point) => ({ x: point.x, y: point.baseY }));
      const comparePoints = region.points.map((point) => ({ x: point.x, y: point.compareY }));
      const basePath = buildSmoothPath(basePoints);
      const compareReversed = [...comparePoints].reverse();
      const comparePathReversed = buildSmoothPath(compareReversed);
      const compareTail = comparePoints[comparePoints.length - 1]!;
      const compareContinuation = stripMoveTo(comparePathReversed);
      return `${basePath} L ${compareTail.x} ${compareTail.y}${compareContinuation ? ` ${compareContinuation}` : ""} Z`;
    };
    const pushPoint = (point: GapPoint, baseAbove: boolean) => {
      if (!currentRegion) {
        currentRegion = { baseAbove, points: [point] };
        return;
      }
      if (currentRegion.baseAbove !== baseAbove) {
        if (currentRegion.points.length >= 2) regions.push(currentRegion);
        currentRegion = { baseAbove, points: [point] };
        return;
      }
      const last = currentRegion.points[currentRegion.points.length - 1]!;
      if (Math.abs(last.x - point.x) < 1e-6 && Math.abs(last.baseY - point.baseY) < 1e-6 && Math.abs(last.compareY - point.compareY) < 1e-6) {
        return;
      }
      currentRegion.points.push(point);
    };

    for (let idx = 0; idx < plotted.length - 1; idx += 1) {
      const left = plotted[idx]!;
      const right = plotted[idx + 1]!;
      if (left.compareY == null || right.compareY == null) continue;
      const start: GapPoint = { x: left.x, baseY: left.y, compareY: left.compareY };
      const end: GapPoint = { x: right.x, baseY: right.y, compareY: right.compareY };
      const d0 = start.baseY - start.compareY;
      const d1 = end.baseY - end.compareY;
      const startAbove = d0 <= 0;
      const endAbove = d1 <= 0;

      if (idx === 0) pushPoint(start, startAbove);

      const crosses = d0 * d1 < 0;
      if (crosses) {
        const denom = d0 - d1;
        const t = Math.abs(denom) < 1e-9 ? 0.5 : clamp(d0 / denom, 0, 1);
        const cross: GapPoint = {
          x: start.x + (end.x - start.x) * t,
          baseY: start.baseY + (end.baseY - start.baseY) * t,
          compareY: start.compareY + (end.compareY - start.compareY) * t,
        };
        pushPoint(cross, startAbove);
        if (currentRegion && currentRegion.points.length >= 2) regions.push(currentRegion);
        currentRegion = { baseAbove: endAbove, points: [cross] };
      }

      pushPoint(end, endAbove);
    }

    if (currentRegion && currentRegion.points.length >= 2) regions.push(currentRegion);

    return regions
      .map((region) => {
        const d = regionToPath(region);
        if (!d) return null;
        return {
          d,
          fill: region.baseAbove ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.12)",
        };
      })
      .filter((segment): segment is { d: string; fill: string } => Boolean(segment));
  }, [compareEnabled, plotted]);

  const tooltipX = activePoint ? activePoint.x : 0;
  const tooltipY = activePoint ? activePoint.y - 68 : 0;
  const previousPoint = activePointIndex > 0 ? plotted[activePointIndex - 1] : null;
  const activeDelta = activePoint && previousPoint
    ? ((activePoint.raw.value - previousPoint.raw.value) / previousPoint.raw.value) * 100
    : null;
  const activeDeltaText = activeDelta == null ? null : `${activeDelta >= 0 ? "+" : "-"}${Math.abs(activeDelta).toFixed(1)}%`;
  const tooltipCompareValue = compareEnabled && activePoint?.raw.compareValue != null ? activePoint.raw.compareValue : null;
  const tooltipCompareDelta = tooltipCompareValue != null && tooltipCompareValue !== 0
    ? ((activePoint!.raw.value - tooltipCompareValue) / tooltipCompareValue) * 100
    : null;
  const tooltipDeltaText = tooltipCompareValue != null
    ? (tooltipCompareDelta == null ? "—" : `${tooltipCompareDelta >= 0 ? "+" : "-"}${Math.abs(tooltipCompareDelta).toFixed(1)}%`)
    : (activeDeltaText ?? "—");
  const tooltipDeltaPositive = tooltipCompareValue != null
    ? ((tooltipCompareDelta ?? 0) >= 0)
    : (activeDelta != null ? activeDelta >= 0 : true);
  const tooltipWidth = tooltipCompareValue != null ? 220 : 184;
  const railOffsetLeft = scrollWrapRef.current?.offsetLeft ?? 0;
  const tooltipOverlayLeft = railOffsetLeft + tooltipX - tooltipWidth / 2 - scrollLeft;
  const tooltipOverlayTop = tooltipY - 10;
  const deltaLabel = compareEnabled
    ? formatDelta(delta)
    : { text: ytdAverage == null ? "—" : `YTD Ø ${ytdAverage.toFixed(1)}`, positive: true };

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

  useEffect(() => {
    const rail = scrollWrapRef.current;
    if (!rail || plotted.length === 0) return;
    const selectedPoint = plotted.find((point) => point.raw.intervalId === selectedIntervalId) ?? plotted[plotted.length - 1];
    if (!selectedPoint) return;
    const targetIntervalId = selectedPoint.raw.intervalId;
    if (lastAutoCenteredIntervalIdRef.current === targetIntervalId) return;
    const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxLeft <= 0) return;
    const targetLeft = clamp(selectedPoint.x - rail.clientWidth * 0.58, 0, maxLeft);
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
  }, [chartWidth, hoveredIntervalId, paddingLeft, plotted]);

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
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
      <div style={{ position: "relative", width, minWidth: "100%", height: 338, overflow: "visible" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#16A34A" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <pattern id={dotPatternId} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="0.72" fill="rgba(0,0,0,0.22)" />
          </pattern>
          <filter id={tooltipShadowId} x="-90%" y="-90%" width="280%" height="280%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.07" />
          </filter>
        </defs>
        <rect
          x={paddingLeft}
          y={paddingTop}
          width={chartWidth}
          height={chartHeight}
          fill={`url(#${dotPatternId})`}
          opacity={0.46}
        />

        {compareEnabled && overlapGapSegments.map((segment, index) => (
          <path key={`gap-${index}`} d={segment.d} fill={segment.fill} />
        ))}

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

        {!compareEnabled && primaryAreaPath && <path d={primaryAreaPath} fill="url(#area-grad)" />}

        <path
          d={primaryPath}
          fill="none"
          stroke="#16A34A"
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
            stroke="rgba(22,163,74,0.32)"
            strokeDasharray="3 4"
            strokeWidth={1.2}
          />
        )}

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

        {plotted.map((point) => {
          const active = point.raw.intervalId === activeIntervalId;
          const selected = point.raw.intervalId === selectedIntervalId;
          return (
            <g key={point.raw.intervalId}>
              {compareEnabled && point.compareY != null && (
                <circle cx={point.x} cy={point.compareY} r={active ? 2.8 : 1.9} fill="#9CA3AF" />
              )}
              {active && <circle cx={point.x} cy={point.y} r={8.3} fill="rgba(255,255,255,0.92)" stroke="rgba(22,163,74,0.16)" strokeWidth={0.9} />}
              <circle cx={point.x} cy={point.y} r={active ? 3.8 : selected ? 3.2 : 2.5} fill={active ? "#ffffff" : "#15803D"} stroke="#15803D" strokeWidth={active ? 1.5 : selected ? 1.2 : 0.9} />
              <circle
                cx={point.x}
                cy={point.y}
                r={10}
                fill="transparent"
                onClick={() => onSelectInterval(point.raw.intervalId)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {plotted.map((point, idx) => {
          if (idx % 2 !== 0 && plotted.length > 10) return null;
          return (
            <text
              key={`lbl-${point.raw.intervalId}`}
              x={point.x}
              y={height - 10}
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
      </div>
      {activePoint && (
        <div
          style={{
            position: "absolute",
            left: tooltipOverlayLeft,
            top: tooltipOverlayTop,
            width: tooltipWidth,
            height: 50,
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
            {activePoint.raw.label}
          </div>
          <div style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.42)" }}>IPP-Wert:</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#16A34A", lineHeight: 1 }}>{activePoint.raw.value.toFixed(1)}</span>
              {tooltipCompareValue != null && (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.32)" }}>/</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(15,23,42,0.62)", lineHeight: 1 }}>{tooltipCompareValue.toFixed(1)}</span>
                </>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, color: tooltipDeltaPositive ? "#16A34A" : "#DC2626" }}>
                {tooltipDeltaText}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
