import type { AdminKurtiDistributionVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, paddedDomain, TONE_COLORS } from "./visualizationUtils";
import styles from "./visualizations.module.css";

const WIDTH = 600;
const HISTOGRAM_HEIGHT = 255;
const HISTOGRAM_PLOT = { left: 48, right: 28, top: 15, bottom: 42 };

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function DistributionLegend({ visualization }: { visualization: AdminKurtiDistributionVisualization }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 11px" }}>
      {visualization.series.map((series) => (
        <span key={series.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(51,65,85,0.66)", fontSize: 9.5 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: TONE_COLORS[series.tone], opacity: 0.72 }} />
          {series.label}
          <small style={{ color: "rgba(71,85,105,0.45)", fontSize: 8 }}>n={series.values.length}</small>
        </span>
      ))}
    </div>
  );
}

function Histogram({ visualization }: { visualization: AdminKurtiDistributionVisualization }) {
  const allValues = visualization.series.flatMap((series) => series.values);
  const domain = paddedDomain(allValues, false);
  if (!domain) return null;
  const observedMin = Math.min(...allValues);
  const observedMax = Math.max(...allValues);
  const observationCount = allValues.length;
  const binCount = visualization.binCount ?? Math.min(14, Math.max(6, Math.ceil(Math.sqrt(observationCount))));
  const binWidth = observedMax === observedMin ? 1 : (observedMax - observedMin) / binCount;
  const counts = visualization.series.map((series) => Array.from({ length: binCount }, (_, binIndex) => {
    const lower = observedMin + binIndex * binWidth;
    const upper = binIndex === binCount - 1 ? observedMax : lower + binWidth;
    return series.values.filter((value) => value >= lower && (binIndex === binCount - 1 ? value <= upper : value < upper)).length;
  }));
  const maximumCount = Math.max(1, ...counts.flat());
  const plotWidth = WIDTH - HISTOGRAM_PLOT.left - HISTOGRAM_PLOT.right;
  const plotHeight = HISTOGRAM_HEIGHT - HISTOGRAM_PLOT.top - HISTOGRAM_PLOT.bottom;
  const binSlot = plotWidth / binCount;
  const barWidth = Math.max(1.5, (binSlot * 0.82) / visualization.series.length);
  const x = (index: number) => HISTOGRAM_PLOT.left + index * binSlot;
  const y = (count: number) => HISTOGRAM_PLOT.top + (1 - count / maximumCount) * plotHeight;
  const xTicks = Array.from({ length: 5 }, (_, index) => observedMin + (index / 4) * (observedMax - observedMin || 1));
  const yTicks = Array.from({ length: 4 }, (_, index) => Math.round(maximumCount - (index / 3) * maximumCount));

  return (
    <div className={`${styles.scroll} ${styles.surface}`} style={{ overflowX: "auto", borderRadius: 10 }}>
      <svg role="img" aria-label={`Histogramm: ${visualization.title}`} viewBox={`0 0 ${WIDTH} ${HISTOGRAM_HEIGHT}`} style={{ display: "block", minWidth: 520, width: "100%", height: "auto" }}>
        <defs>
          <filter id="histogram-soft-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
        </defs>
        {yTicks.map((tick) => {
          const tickY = y(tick);
          return <g key={tick}><line x1={HISTOGRAM_PLOT.left} x2={WIDTH - HISTOGRAM_PLOT.right} y1={tickY} y2={tickY} stroke="rgba(71,85,105,0.11)" strokeWidth="0.6" /><text x={HISTOGRAM_PLOT.left - 7} y={tickY + 3} textAnchor="end" fill="rgba(51,65,85,0.55)" fontSize="8.5">{tick}</text></g>;
        })}
        {counts.flatMap((seriesCounts, seriesIndex) => seriesCounts.map((count, binIndex) => {
          const barX = x(binIndex) + binSlot * 0.09 + seriesIndex * barWidth;
          const barY = y(count);
          const lower = observedMin + binIndex * binWidth;
          const upper = binIndex === binCount - 1 ? observedMax : lower + binWidth;
          const series = visualization.series[seriesIndex]!;
          return (
            <rect key={`${series.label}-${binIndex}`} x={barX} y={barY} width={Math.max(1, barWidth - 0.8)} height={Math.max(0.8, HISTOGRAM_PLOT.top + plotHeight - barY)} rx="1.6" fill={TONE_COLORS[series.tone]} fillOpacity="0.58" filter="url(#histogram-soft-shadow)">
              <title>{`${series.label}: ${formatVisualizationValue(lower, visualization.valueFormat)}–${formatVisualizationValue(upper, visualization.valueFormat)} · ${count}`}</title>
            </rect>
          );
        }))}
        {xTicks.map((tick, index) => {
          const tickX = HISTOGRAM_PLOT.left + (index / 4) * plotWidth;
          return <text key={index} x={tickX} y={HISTOGRAM_HEIGHT - 21} textAnchor="middle" fill="rgba(51,65,85,0.56)" fontSize="8.5">{formatVisualizationValue(tick, visualization.valueFormat)}</text>;
        })}
        <text x={HISTOGRAM_PLOT.left + plotWidth / 2} y={HISTOGRAM_HEIGHT - 4} textAnchor="middle" fill="rgba(51,65,85,0.48)" fontSize="8.5">{visualization.xLabel}</text>
        <text x="9" y={HISTOGRAM_PLOT.top + plotHeight / 2} textAnchor="middle" fill="rgba(51,65,85,0.48)" fontSize="8.5" transform={`rotate(-90 9 ${HISTOGRAM_PLOT.top + plotHeight / 2})`}>Häufigkeit</text>
      </svg>
    </div>
  );
}

function BoxPlot({ visualization }: { visualization: AdminKurtiDistributionVisualization }) {
  const allValues = visualization.series.flatMap((series) => series.values);
  const domain = paddedDomain(allValues, false);
  if (!domain) return null;
  const height = Math.max(190, 58 + visualization.series.length * 40);
  const plot = { left: 112, right: 30, top: 17, bottom: 36 };
  const plotWidth = WIDTH - plot.left - plot.right;
  const x = (value: number) => plot.left + ((value - domain.min) / (domain.max - domain.min)) * plotWidth;
  const ticks = Array.from({ length: 5 }, (_, index) => domain.min + (index / 4) * (domain.max - domain.min));
  return (
    <div className={`${styles.scroll} ${styles.surface}`} style={{ overflowX: "auto", borderRadius: 10 }}>
      <svg role="img" aria-label={`Boxplot: ${visualization.title}`} viewBox={`0 0 ${WIDTH} ${height}`} style={{ display: "block", minWidth: 520, width: "100%", height: "auto" }}>
        {ticks.map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={plot.top} y2={height - plot.bottom} stroke="rgba(71,85,105,0.1)" strokeWidth="0.6" /><text x={x(tick)} y={height - 16} textAnchor="middle" fill="rgba(51,65,85,0.56)" fontSize="8.5">{formatVisualizationValue(tick, visualization.valueFormat)}</text></g>)}
        {visualization.series.map((series, index) => {
          const sorted = [...series.values].sort((a, b) => a - b);
          const q1 = quantile(sorted, 0.25);
          const median = quantile(sorted, 0.5);
          const q3 = quantile(sorted, 0.75);
          const iqr = q3 - q1;
          const lowerFence = q1 - iqr * 1.5;
          const upperFence = q3 + iqr * 1.5;
          const included = sorted.filter((value) => value >= lowerFence && value <= upperFence);
          const lowerWhisker = included[0] ?? sorted[0]!;
          const upperWhisker = included.at(-1) ?? sorted.at(-1)!;
          const outliers = visualization.showOutliers ? sorted.filter((value) => value < lowerWhisker || value > upperWhisker) : [];
          const rowY = plot.top + 24 + index * 40;
          const color = TONE_COLORS[series.tone];
          return (
            <g key={series.label}>
              <text x={plot.left - 9} y={rowY + 3} textAnchor="end" fill="rgba(15,23,42,0.7)" fontSize="9.2" fontWeight="650">{series.label.length > 18 ? `${series.label.slice(0, 17)}…` : series.label}</text>
              <line x1={x(lowerWhisker)} x2={x(upperWhisker)} y1={rowY} y2={rowY} stroke={color} strokeOpacity="0.62" strokeWidth="1" />
              <line x1={x(lowerWhisker)} x2={x(lowerWhisker)} y1={rowY - 5} y2={rowY + 5} stroke={color} strokeOpacity="0.68" strokeWidth="1" />
              <line x1={x(upperWhisker)} x2={x(upperWhisker)} y1={rowY - 5} y2={rowY + 5} stroke={color} strokeOpacity="0.68" strokeWidth="1" />
              <rect x={x(q1)} y={rowY - 9} width={Math.max(1, x(q3) - x(q1))} height="18" rx="4" fill={color} fillOpacity="0.16" stroke={color} strokeOpacity="0.72" strokeWidth="0.9">
                <title>{`${series.label} · Q1 ${formatVisualizationValue(q1, visualization.valueFormat)} · Median ${formatVisualizationValue(median, visualization.valueFormat)} · Q3 ${formatVisualizationValue(q3, visualization.valueFormat)} · n=${series.values.length}`}</title>
              </rect>
              <line x1={x(median)} x2={x(median)} y1={rowY - 9} y2={rowY + 9} stroke={color} strokeOpacity="0.92" strokeWidth="1.6" />
              {outliers.map((value, outlierIndex) => <circle key={`${value}-${outlierIndex}`} cx={x(value)} cy={rowY} r="2.3" fill={color} fillOpacity="0.5" stroke="rgba(255,255,255,0.9)" strokeWidth="0.6"><title>{`Möglicher Ausreißer: ${formatVisualizationValue(value, visualization.valueFormat)}`}</title></circle>)}
            </g>
          );
        })}
        <text x={plot.left + plotWidth / 2} y={height - 2} textAnchor="middle" fill="rgba(51,65,85,0.48)" fontSize="8.5">{visualization.xLabel}</text>
      </svg>
    </div>
  );
}

export function DistributionVisualization({ visualization }: { visualization: AdminKurtiDistributionVisualization }) {
  const legend = <DistributionLegend visualization={visualization} />;
  return (
    <VisualizationFrame {...visualization} legend={legend}>
      {visualization.variant === "histogram" ? <Histogram visualization={visualization} /> : <BoxPlot visualization={visualization} />}
    </VisualizationFrame>
  );
}
