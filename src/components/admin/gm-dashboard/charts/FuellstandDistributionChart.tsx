"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FuellstandTypeKey } from "@/lib/fuellstand-dashboard/mock-data";

type FuellstandDistributionPoint = {
  intervalId: string;
  label: string;
  shortLabel: string;
  vollPct: number;
  mittelPct: number;
  leerPct: number;
  vollCount: number;
  mittelCount: number;
  leerCount: number;
  totalCount: number;
};

type FuellstandDistributionChartProps = {
  points: FuellstandDistributionPoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
  highlightedTypeKey: FuellstandTypeKey | null;
};

type PlotPoint = {
  x: number;
  vollY: number;
  mittelY: number;
  leerY: number;
  raw: FuellstandDistributionPoint;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function linePaletteForType(highlightedTypeKey: FuellstandTypeKey | null): { voll: string; mittel: string; leer: string } {
  if (!highlightedTypeKey) {
    return { voll: "#0B0B0B", mittel: "#4B5563", leer: "#9CA3AF" };
  }
  return {
    voll: "#16A34A",
    mittel: "#F59E0B",
    leer: "#DC2626",
  };
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

export function FuellstandDistributionChart({ points, selectedIntervalId, onSelectInterval, highlightedTypeKey }: FuellstandDistributionChartProps) {
  const [hoveredIntervalId, setHoveredIntervalId] = useState<string | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  const hoverSurfaceRef = useRef<SVGRectElement | null>(null);
  const lastPointerClientXRef = useRef<number | null>(null);
  const lastAutoCenteredIntervalIdRef = useRef<string | null>(null);
  const idBase = useId().replaceAll(":", "");
  const dotPatternId = `${idBase}-dotPattern`;
  const baseWidth = 920;
  const height = 298;
  const paddingLeft = 30;
  const paddingRight = 12;
  const paddingTop = 14;
  const paddingBottom = 46;
  const minPointGap = 56;
  const width = Math.max(baseWidth, paddingLeft + paddingRight + Math.max(0, points.length - 1) * minPointGap);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const activeIntervalId = hoveredIntervalId ?? selectedIntervalId;

  const plotted = useMemo(() => {
    if (points.length === 0) return [] as PlotPoint[];
    const yFor = (value: number) => paddingTop + (1 - value / 100) * chartHeight;
    return points.map((entry, index) => {
      const x = paddingLeft + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
      return {
        x,
        vollY: yFor(entry.vollPct),
        mittelY: yFor(entry.mittelPct),
        leerY: yFor(entry.leerPct),
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

  const hoveredPoint = hoveredIntervalId ? (plotted.find((entry) => entry.raw.intervalId === hoveredIntervalId) ?? null) : null;
  const tooltipWidth = 184;
  const tooltipHeight = 86;
  const tooltipX = hoveredPoint ? hoveredPoint.x : 0;
  const highestY = hoveredPoint ? Math.min(hoveredPoint.vollY, hoveredPoint.mittelY, hoveredPoint.leerY) : 0;
  const railOffsetLeft = scrollWrapRef.current?.offsetLeft ?? 0;
  const railClientWidth = scrollWrapRef.current?.clientWidth ?? width;
  const tooltipRawLeft = railOffsetLeft + tooltipX - tooltipWidth / 2 - scrollLeft;
  const tooltipMaxLeft = Math.max(4, railOffsetLeft + railClientWidth - tooltipWidth - 4);
  const tooltipOverlayLeft = clamp(tooltipRawLeft, 4, tooltipMaxLeft);
  const tooltipOverlayTop = Math.max(-92, highestY - tooltipHeight - 14);

  const vollPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.vollY })));
  const mittelPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.mittelY })));
  const leerPath = buildSmoothPath(plotted.map((entry) => ({ x: entry.x, y: entry.leerY })));
  const linePalette = useMemo(() => linePaletteForType(highlightedTypeKey), [highlightedTypeKey]);

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
    <div style={{ position: "relative", width: "100%", height: 298, overflow: "visible" }}>
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
        <div style={{ position: "relative", width, minWidth: "100%", height: 298, overflow: "visible" }}>
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height="100%" style={{ display: "block", overflow: "visible" }}>
            <defs>
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
            {[100, 50, 0].map((tick) => {
              const y = paddingTop + (1 - tick / 100) * chartHeight;
              return (
                <g key={tick}>
                  <text x={4} y={y + 3} fontFamily="inherit" fontSize={10} fontWeight={700} fill="rgba(0,0,0,0.34)">
                    {tick}%
                  </text>
                </g>
              );
            })}

            <path d={vollPath} fill="none" stroke={linePalette.voll} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <path d={mittelPath} fill="none" stroke={linePalette.mittel} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
            <path d={leerPath} fill="none" stroke={linePalette.leer} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />

            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
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
                  <circle cx={entry.x} cy={entry.vollY} r={active ? 3.1 : 2.2} fill={linePalette.voll} />
                  <circle cx={entry.x} cy={entry.mittelY} r={active ? 3.1 : 2.2} fill={linePalette.mittel} />
                  <circle cx={entry.x} cy={entry.leerY} r={active ? 3.1 : 2.2} fill={linePalette.leer} />
                </g>
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
      </div>
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            left: tooltipOverlayLeft,
            top: tooltipOverlayTop,
            width: tooltipWidth,
            height: tooltipHeight,
            borderRadius: 9,
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
            {hoveredPoint.raw.label}
          </div>
          <div style={{ height: tooltipHeight - 19, padding: "7px 10px 6px", display: "grid", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 9.2, fontWeight: 700, color: "rgba(15,23,42,0.7)" }}>Voll</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: linePalette.voll }}>{hoveredPoint.raw.vollPct.toFixed(1)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 9.2, fontWeight: 700, color: "rgba(15,23,42,0.7)" }}>Mittel</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: linePalette.mittel }}>{hoveredPoint.raw.mittelPct.toFixed(1)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 9.2, fontWeight: 700, color: "rgba(15,23,42,0.7)" }}>Leer</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: linePalette.leer }}>{hoveredPoint.raw.leerPct.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: 1, fontSize: 8.3, fontWeight: 700, color: "rgba(15,23,42,0.42)", textAlign: "right" }}>
              n{hoveredPoint.raw.totalCount}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
