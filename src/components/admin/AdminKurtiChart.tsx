import type { AdminKurtiChartSpec } from "@/lib/api/backend";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 220;
const PLOT = { left: 48, right: 14, top: 14, bottom: 40 };
const SERIES_COLORS = ["#dc2626", "#64748b", "#d97706", "#0891b2"];

function formatValue(value: number, format: AdminKurtiChartSpec["valueFormat"]): string {
  if (format === "currency") {
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(value)} %`;
  }
  return new Intl.NumberFormat("de-AT", {
    maximumFractionDigits: format === "number" ? 0 : 2,
  }).format(value);
}

function pointValue(
  point: AdminKurtiChartSpec["points"][number],
  seriesKey: string,
): number | null {
  return point.values.find((value) => value.seriesKey === seriesKey)?.value ?? null;
}

function getDomain(chart: AdminKurtiChartSpec): { minimum: number; maximum: number } | null {
  const values = chart.points.flatMap((point) => point.values)
    .map((value) => value.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;

  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (chart.type === "bar") {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.12, 1);
    minimum -= padding;
    maximum += padding;
  } else if (chart.type === "line") {
    const padding = (maximum - minimum) * 0.1;
    minimum -= padding;
    maximum += padding;
  }
  return { minimum, maximum };
}

function buildLinePath(
  chart: AdminKurtiChartSpec,
  seriesKey: string,
  xPosition: (index: number) => number,
  yPosition: (value: number) => number,
): string {
  let path = "";
  let segmentOpen = false;
  chart.points.forEach((point, index) => {
    const value = pointValue(point, seriesKey);
    if (value === null) {
      segmentOpen = false;
      return;
    }
    path += `${segmentOpen ? " L" : "M"} ${xPosition(index).toFixed(2)} ${yPosition(value).toFixed(2)}`;
    segmentOpen = true;
  });
  return path;
}

export function AdminKurtiChart({ chart }: { chart: AdminKurtiChartSpec }) {
  const domain = getDomain(chart);
  if (!domain) return null;

  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
  const xPosition = (index: number) => chart.type === "line"
    ? PLOT.left + (chart.points.length === 1 ? plotWidth / 2 : (index / (chart.points.length - 1)) * plotWidth)
    : PLOT.left + ((index + 0.5) / chart.points.length) * plotWidth;
  const yPosition = (value: number) => PLOT.top
    + ((domain.maximum - value) / (domain.maximum - domain.minimum)) * plotHeight;
  const tickValues = Array.from({ length: 4 }, (_, index) => (
    domain.maximum - (index / 3) * (domain.maximum - domain.minimum)
  ));
  const xLabelStep = Math.max(1, Math.ceil(chart.points.length / 6));
  const visibleXLabels = new Set(
    chart.points.flatMap((_, index) => (
      index % xLabelStep === 0 || index === chart.points.length - 1 ? [index] : []
    )),
  );
  const zeroY = yPosition(0);
  const barGroupWidth = (plotWidth / chart.points.length) * 0.66;
  const barWidth = Math.max(2, barGroupWidth / chart.series.length);

  return (
    <section
      aria-label={chart.title}
      style={{
        marginTop: 10,
        padding: "11px 11px 8px",
        borderRadius: 13,
        border: "1px solid rgba(15,23,42,0.075)",
        background: "rgba(226,232,240,0.38)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "rgba(15,23,42,0.86)", fontSize: 12.5, fontWeight: 720, lineHeight: 1.3 }}>
            {chart.title}
          </div>
          {chart.subtitle ? (
            <div style={{ marginTop: 2, color: "rgba(51,65,85,0.62)", fontSize: 10.5, fontWeight: 520, lineHeight: 1.35 }}>
              {chart.subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "4px 9px" }}>
          {chart.series.map((series, index) => (
            <span
              key={series.key}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(51,65,85,0.68)", fontSize: 9.5, whiteSpace: "nowrap" }}
            >
              <span style={{ width: 11, height: 1.5, borderRadius: 999, background: SERIES_COLORS[index] }} />
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        role="img"
        aria-label={`${chart.type === "line" ? "Liniendiagramm" : "Balkendiagramm"}: ${chart.title}`}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={{ display: "block", width: "100%", height: "auto", marginTop: 5, overflow: "visible" }}
      >
        {tickValues.map((tick, index) => {
          const y = yPosition(tick);
          return (
            <g key={`${tick}-${index}`}>
              <line
                x1={PLOT.left}
                x2={CHART_WIDTH - PLOT.right}
                y1={y}
                y2={y}
                stroke="rgba(71,85,105,0.14)"
                strokeWidth="0.6"
              />
              <text x={PLOT.left - 7} y={y + 3} textAnchor="end" fill="rgba(51,65,85,0.58)" fontSize="9">
                {formatValue(tick, chart.valueFormat)}
              </text>
            </g>
          );
        })}

        {chart.type === "line" ? chart.series.map((series, seriesIndex) => (
          <g key={series.key}>
            <path
              d={buildLinePath(chart, series.key, xPosition, yPosition)}
              fill="none"
              stroke={SERIES_COLORS[seriesIndex]}
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {chart.points.map((point, pointIndex) => {
              const value = pointValue(point, series.key);
              if (value === null) return null;
              return (
                <circle
                  key={`${series.key}-${pointIndex}`}
                  cx={xPosition(pointIndex)}
                  cy={yPosition(value)}
                  r="2.15"
                  fill={SERIES_COLORS[seriesIndex]}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="0.8"
                >
                  <title>{`${point.label} · ${series.label}: ${formatValue(value, chart.valueFormat)}`}</title>
                </circle>
              );
            })}
          </g>
        )) : chart.points.flatMap((point, pointIndex) => chart.series.map((series, seriesIndex) => {
          const value = pointValue(point, series.key);
          if (value === null) return null;
          const x = xPosition(pointIndex) - barGroupWidth / 2 + seriesIndex * barWidth;
          const valueY = yPosition(value);
          const y = Math.min(valueY, zeroY);
          const height = Math.max(1, Math.abs(zeroY - valueY));
          return (
            <rect
              key={`${series.key}-${pointIndex}`}
              x={x + 0.6}
              y={y}
              width={Math.max(1, barWidth - 1.2)}
              height={height}
              rx="1.5"
              fill={SERIES_COLORS[seriesIndex]}
              fillOpacity="0.58"
            >
              <title>{`${point.label} · ${series.label}: ${formatValue(value, chart.valueFormat)}`}</title>
            </rect>
          );
        }))}

        {chart.points.map((point, index) => visibleXLabels.has(index) ? (
          <text
            key={`${point.label}-${index}`}
            x={xPosition(index)}
            y={CHART_HEIGHT - 20}
            textAnchor="middle"
            fill="rgba(51,65,85,0.6)"
            fontSize="9"
          >
            {point.label.length > 16 ? `${point.label.slice(0, 15)}…` : point.label}
          </text>
        ) : null)}

        {chart.xLabel ? (
          <text x={PLOT.left + plotWidth / 2} y={CHART_HEIGHT - 4} textAnchor="middle" fill="rgba(51,65,85,0.5)" fontSize="8.5">
            {chart.xLabel}
          </text>
        ) : null}
        {chart.yLabel ? (
          <text
            x="9"
            y={PLOT.top + plotHeight / 2}
            textAnchor="middle"
            fill="rgba(51,65,85,0.5)"
            fontSize="8.5"
            transform={`rotate(-90 9 ${PLOT.top + plotHeight / 2})`}
          >
            {chart.yLabel}
          </text>
        ) : null}
      </svg>
    </section>
  );
}
