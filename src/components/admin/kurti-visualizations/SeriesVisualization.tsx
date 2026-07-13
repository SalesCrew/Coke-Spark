import type { AdminKurtiSeriesVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, paddedDomain, TONE_COLORS } from "./visualizationUtils";
import styles from "./visualizations.module.css";

const HEIGHT = 245;
const PLOT = { left: 54, right: 34, top: 15, bottom: 42 };

function seriesPath(
  visualization: AdminKurtiSeriesVisualization,
  seriesIndex: number,
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let path = "";
  let open = false;
  visualization.points.forEach((point, index) => {
    const value = point.values[seriesIndex];
    if (value === null || value === undefined) {
      open = false;
      return;
    }
    path += `${open ? " L" : "M"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    open = true;
  });
  return path;
}

function HorizontalBars({ visualization }: { visualization: AdminKurtiSeriesVisualization }) {
  const values = visualization.points.flatMap((point) => point.values).filter((value): value is number => value !== null);
  const maximum = Math.max(...values.map((value) => Math.abs(value)), 1);
  const singleSeries = visualization.series.length === 1;
  return (
    <div className={styles.scroll} style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 3 }}>
      {visualization.points.map((point) => (
        <div key={point.label} style={{ display: "grid", gridTemplateColumns: singleSeries ? "minmax(74px, 0.42fr) minmax(90px, 1fr) auto" : undefined, alignItems: singleSeries ? "center" : undefined, gap: singleSeries ? 7 : 4 }}>
          <div style={{ color: "rgba(15,23,42,0.72)", fontSize: 10, fontWeight: 680 }}>{point.label}</div>
          {visualization.series.map((series, seriesIndex) => {
            const value = point.values[seriesIndex];
            if (value === null || value === undefined) return null;
            return (
              <div key={series.key} style={{ display: "grid", gridTemplateColumns: singleSeries ? "minmax(90px, 1fr) auto" : "minmax(74px, 0.4fr) minmax(90px, 1fr) auto", gridColumn: singleSeries ? "2 / -1" : undefined, alignItems: "center", gap: 7 }}>
                {!singleSeries ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", color: "rgba(51,65,85,0.62)", fontSize: 9.5, whiteSpace: "nowrap" }}>{series.label}</span> : null}
                <span style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.14)", boxShadow: "inset 0 1px 1px rgba(15,23,42,0.035)", overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${Math.max(1.5, (Math.abs(value) / maximum) * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${TONE_COLORS[series.tone]}94, ${TONE_COLORS[series.tone]}d1)`, boxShadow: `0 0 8px ${TONE_COLORS[series.tone]}28` }} />
                </span>
                <span style={{ color: "rgba(15,23,42,0.74)", fontSize: 9.5, fontVariantNumeric: "tabular-nums" }}>{formatVisualizationValue(value, visualization.valueFormat)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SeriesVisualization({ visualization }: { visualization: AdminKurtiSeriesVisualization }) {
  const legend = visualization.showLegend ? (
    <div style={{ display: "flex", gap: "5px 11px", minWidth: "max-content", flexWrap: visualization.series.length <= 8 ? "wrap" : "nowrap" }}>
      {visualization.series.map((series, seriesIndex) => (
        <span key={series.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(51,65,85,0.68)", fontSize: 9.5, whiteSpace: "nowrap" }}>
          <span style={series.display === "bar"
            ? { width: 12, height: 5, borderRadius: 2, background: TONE_COLORS[series.tone], opacity: 0.72 }
            : { width: 12, height: 0, borderTop: `${Math.floor(seriesIndex / 8) > 0 ? "1.5px dashed" : "1.5px solid"} ${TONE_COLORS[series.tone]}`, opacity: 0.84 }} />
          {series.label}
        </span>
      ))}
    </div>
  ) : undefined;

  if (visualization.variant === "horizontal_bar") {
    return (
      <VisualizationFrame {...visualization} legend={legend}>
        <HorizontalBars visualization={visualization} />
      </VisualizationFrame>
    );
  }

  const rawValues = visualization.points.flatMap((point) => point.values).filter((value): value is number => value !== null);
  const domainValues = visualization.variant === "stacked_bar"
    ? visualization.points.flatMap((point) => [
      point.values.reduce<number>((sum, value) => sum + Math.max(0, value ?? 0), 0),
      point.values.reduce<number>((sum, value) => sum + Math.min(0, value ?? 0), 0),
    ])
    : rawValues;
  const includeZero = visualization.variant.includes("bar") || visualization.series.some((series) => series.display === "bar");
  const domain = paddedDomain([...domainValues, ...visualization.referenceLines.map((line) => line.value)], includeZero);
  if (!domain) return null;
  const width = Math.max(520, PLOT.left + PLOT.right + visualization.points.length * (visualization.variant.includes("bar") ? 38 : 24));
  const plotWidth = width - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const hasBars = visualization.variant.includes("bar") || visualization.series.some((series) => series.display === "bar");
  const x = (index: number) => hasBars
    ? PLOT.left + ((index + 0.5) / Math.max(1, visualization.points.length)) * plotWidth
    : PLOT.left + (visualization.points.length === 1 ? plotWidth / 2 : (index / Math.max(1, visualization.points.length - 1)) * plotWidth);
  const y = (value: number) => PLOT.top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => domain.max - (index / 4) * (domain.max - domain.min));
  const labelStep = Math.max(1, Math.ceil(visualization.points.length / Math.max(6, Math.floor(width / 95))));
  const visibleLabels = new Set(visualization.points.flatMap((_, index) => (index % labelStep === 0 || index === visualization.points.length - 1) ? [index] : []));
  const barSeries = visualization.series.map((series, index) => ({ series, index })).filter(({ series }) => visualization.variant.includes("bar") || series.display === "bar");
  const barSlotWidth = plotWidth / Math.max(1, visualization.points.length);
  const barWidth = Math.max(2, (barSlotWidth * 0.64) / Math.max(1, visualization.variant === "stacked_bar" ? 1 : barSeries.length));
  const zeroY = y(0);
  const areaBaselineY = y(domain.min > 0 ? domain.min : domain.max < 0 ? domain.max : 0);

  return (
    <VisualizationFrame {...visualization} legend={legend}>
      <div className={styles.scroll} style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 2 }}>
        <svg role="img" aria-label={`${visualization.title}: ${visualization.variant}`} viewBox={`0 0 ${width} ${HEIGHT}`} style={{ display: "block", minWidth: width, width: "100%", height: "auto" }}>
          {ticks.map((tick, index) => {
            const tickY = y(tick);
            return (
              <g key={index}>
                <line x1={PLOT.left} x2={width - PLOT.right} y1={tickY} y2={tickY} stroke="rgba(71,85,105,0.14)" strokeWidth="0.65" />
                <text x={PLOT.left - 7} y={tickY + 3} textAnchor="end" fill="rgba(51,65,85,0.57)" fontSize="8.6">{formatVisualizationValue(tick, visualization.valueFormat)}</text>
              </g>
            );
          })}

          {visualization.referenceLines.map((line) => (
            <g key={`${line.label}-${line.value}`}>
              <line x1={PLOT.left} x2={width - PLOT.right} y1={y(line.value)} y2={y(line.value)} stroke="rgba(185,28,28,0.45)" strokeWidth="0.8" strokeDasharray="3 3" />
              <text x={width - PLOT.right} y={y(line.value) - 3} textAnchor="end" fill="rgba(153,27,27,0.68)" fontSize="8.4">{line.label}</text>
            </g>
          ))}

          {visualization.variant === "stacked_bar" ? visualization.points.flatMap((point, pointIndex) => {
            let positive = 0;
            let negative = 0;
            return barSeries.map(({ series, index }) => {
              const value = point.values[index];
              if (value === null || value === undefined) return null;
              const start = value >= 0 ? positive : negative;
              const end = start + value;
              if (value >= 0) positive = end; else negative = end;
              const startY = y(start);
              const endY = y(end);
              return (
                <rect key={`${pointIndex}-${series.key}`} x={x(pointIndex) - barWidth / 2} y={Math.min(startY, endY)} width={barWidth} height={Math.max(1, Math.abs(startY - endY))} rx="1.5" fill={TONE_COLORS[series.tone]} fillOpacity="0.63">
                  <title>{`${point.label} · ${series.label}: ${formatVisualizationValue(value, visualization.valueFormat)}`}</title>
                </rect>
              );
            });
          }) : visualization.points.flatMap((point, pointIndex) => barSeries.map(({ series, index }, barIndex) => {
            const value = point.values[index];
            if (value === null || value === undefined) return null;
            const valueY = y(value);
            return (
              <rect key={`${pointIndex}-${series.key}`} x={x(pointIndex) - (barSeries.length * barWidth) / 2 + barIndex * barWidth + 0.5} y={Math.min(valueY, zeroY)} width={Math.max(1, barWidth - 1)} height={Math.max(1, Math.abs(zeroY - valueY))} rx="1.5" fill={TONE_COLORS[series.tone]} fillOpacity="0.62">
                <title>{`${point.label} · ${series.label}: ${formatVisualizationValue(value, visualization.valueFormat)}`}</title>
              </rect>
            );
          }))}

          {visualization.series.map((series, seriesIndex) => {
            const isArea = visualization.variant === "area" || visualization.variant === "combo" && series.display === "area";
            const isLine = visualization.variant === "line" || visualization.variant === "area" || visualization.variant === "combo" && series.display !== "bar";
            if (!isLine) return null;
            const path = seriesPath(visualization, seriesIndex, x, y);
            const isContinuous = visualization.points.every((point) => point.values[seriesIndex] !== null && point.values[seriesIndex] !== undefined);
            return (
              <g key={series.key}>
                {isArea && isContinuous && path ? <path d={`${path} L ${x(visualization.points.length - 1)} ${areaBaselineY} L ${x(0)} ${areaBaselineY} Z`} fill={TONE_COLORS[series.tone]} fillOpacity="0.075" /> : null}
                <path d={path} fill="none" stroke={TONE_COLORS[series.tone]} strokeOpacity="0.86" strokeWidth="1.15" strokeDasharray={Math.floor(seriesIndex / 8) === 1 ? "4 2.4" : Math.floor(seriesIndex / 8) >= 2 ? "1.2 2.2" : undefined} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 1px 1px rgba(15,23,42,0.08))" }} />
                {visualization.points.length <= 35 ? visualization.points.map((point, pointIndex) => {
                  const value = point.values[seriesIndex];
                  if (value === null || value === undefined) return null;
                  return <circle key={pointIndex} cx={x(pointIndex)} cy={y(value)} r="1.75" fill={TONE_COLORS[series.tone]} fillOpacity="0.92" stroke="rgba(255,255,255,0.94)" strokeWidth="0.7"><title>{`${point.label} · ${series.label}: ${formatVisualizationValue(value, visualization.valueFormat)}`}</title></circle>;
                }) : null}
              </g>
            );
          })}

          {visualization.points.map((point, index) => visibleLabels.has(index) ? (
            <text key={`${point.label}-${index}`} x={x(index)} y={HEIGHT - 21} textAnchor="middle" fill="rgba(51,65,85,0.58)" fontSize="8.6">{point.label.length > 17 ? `${point.label.slice(0, 16)}…` : point.label}</text>
          ) : null)}
          {visualization.xLabel ? <text x={PLOT.left + plotWidth / 2} y={HEIGHT - 4} textAnchor="middle" fill="rgba(51,65,85,0.48)" fontSize="8.5">{visualization.xLabel}</text> : null}
          {visualization.yLabel ? <text x="9" y={PLOT.top + plotHeight / 2} textAnchor="middle" fill="rgba(51,65,85,0.48)" fontSize="8.5" transform={`rotate(-90 9 ${PLOT.top + plotHeight / 2})`}>{visualization.yLabel}</text> : null}
        </svg>
      </div>
    </VisualizationFrame>
  );
}
