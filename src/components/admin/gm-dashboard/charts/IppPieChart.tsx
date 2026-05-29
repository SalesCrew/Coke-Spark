"use client";

import type { IppPieSlice } from "@/lib/ipp-dashboard/mock-data";

type IppPieChartProps = {
  slices: IppPieSlice[];
  total: number;
};

type SliceVisual = {
  stroke: string;
  fill: string;
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

export function IppPieChart({ slices, total }: IppPieChartProps) {
  const width = 340;
  const height = 280;
  const centerX = 170;
  const centerY = 140;
  const outerRadius = 96;
  const innerRadius = 72;
  const ringGapDeg = 3.2;
  const trackRadius = (outerRadius + innerRadius) / 2;
  const trackWidth = outerRadius - innerRadius;
  const visibleSlices = slices.slice(0, 2);
  const visuals: SliceVisual[] = [
    { stroke: "#0B0B0B", fill: "rgba(11,11,11,0.14)" },
    { stroke: "#6B7280", fill: "rgba(107,114,128,0.16)" },
  ];
  const donutRingPath = [
    `M ${centerX} ${centerY}`,
    `m -${outerRadius},0`,
    `a ${outerRadius},${outerRadius} 0 1,0 ${outerRadius * 2},0`,
    `a ${outerRadius},${outerRadius} 0 1,0 -${outerRadius * 2},0`,
    `M ${centerX} ${centerY}`,
    `m -${innerRadius},0`,
    `a ${innerRadius},${innerRadius} 0 1,1 ${innerRadius * 2},0`,
    `a ${innerRadius},${innerRadius} 0 1,1 -${innerRadius * 2},0`,
  ].join(" ");
  let angleCursor = 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 42%) minmax(340px, 1fr)", gap: 20, alignItems: "center", minHeight: 280 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="ipp-pie-inner-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="14%" stopColor="#000000" stopOpacity="0.01" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="ipp-pie-text-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B0B0B" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
          <filter id="ipp-pie-inner-depth-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="11.5" />
          </filter>
        </defs>
        <path d={donutRingPath} fill="url(#ipp-pie-inner-depth)" fillRule="evenodd" filter="url(#ipp-pie-inner-depth-blur)" />
        <circle cx={centerX} cy={centerY} r={trackRadius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={trackWidth} />
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
        <text x={centerX} y={136} textAnchor="middle" fontFamily="inherit" fontSize={12} fontWeight={700} fill="url(#ipp-pie-text-grad)">
          Gesamt
        </text>
        <text x={centerX} y={160} textAnchor="middle" fontFamily="inherit" fontSize={30} fontWeight={800} fill="url(#ipp-pie-text-grad)">
          {total}
        </text>
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleSlices.map((slice, index) => (
          <div
            key={slice.id}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.94)",
              padding: "12px 14px",
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
                  borderRadius: "50%",
                  display: "inline-block",
                  background: visuals[index]?.stroke ?? slice.color,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.14), 0 1px 1.5px rgba(0,0,0,0.1), inset 0 1px 0.35px rgba(255,255,255,0.25)",
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{slice.label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#111111", lineHeight: 1 }}>{slice.percent.toFixed(1)}%</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>{slice.count} Fälle</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
