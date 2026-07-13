import type { AdminKurtiScatterVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, paddedDomain, TONE_COLORS } from "./visualizationUtils";
import styles from "./visualizations.module.css";

const WIDTH = 560;
const HEIGHT = 250;
const PLOT = { left: 52, right: 34, top: 18, bottom: 43 };

export function ScatterVisualization({ visualization }: { visualization: AdminKurtiScatterVisualization }) {
  const xDomain = paddedDomain(visualization.points.map((point) => point.x));
  const yDomain = paddedDomain(visualization.points.map((point) => point.y));
  if (!xDomain || !yDomain) return null;
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const x = (value: number) => PLOT.left + ((value - xDomain.min) / (xDomain.max - xDomain.min)) * plotWidth;
  const y = (value: number) => PLOT.top + ((yDomain.max - value) / (yDomain.max - yDomain.min)) * plotHeight;
  const maximumSize = Math.max(...visualization.points.map((point) => point.size ?? 0), 1);
  const seriesByKey = new Map(visualization.series.map((series) => [series.key, series]));
  const legend = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 11px" }}>
      {visualization.series.map((series) => <span key={series.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(51,65,85,0.66)", fontSize: 9.5 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: TONE_COLORS[series.tone], opacity: 0.74 }} />{series.label}</span>)}
    </div>
  );
  return (
    <VisualizationFrame {...visualization} legend={legend}>
      <div className={`${styles.scroll} ${styles.surface}`} style={{ overflowX: "auto", borderRadius: 10 }}>
        <svg role="img" aria-label={`Streudiagramm: ${visualization.title}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block", minWidth: 520, width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="scatter-plot-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.36)" />
              <stop offset="1" stopColor="rgba(241,245,249,0.12)" />
            </linearGradient>
            <filter id="scatter-point-shadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>
          </defs>
          <rect x={PLOT.left} y={PLOT.top} width={plotWidth} height={plotHeight} rx="7" fill="url(#scatter-plot-wash)" />
          {Array.from({ length: 5 }, (_, index) => {
            const ratio = index / 4;
            const xValue = xDomain.min + ratio * (xDomain.max - xDomain.min);
            const yValue = yDomain.max - ratio * (yDomain.max - yDomain.min);
            return (
              <g key={index}>
                <line x1={x(xValue)} x2={x(xValue)} y1={PLOT.top} y2={HEIGHT - PLOT.bottom} stroke="rgba(71,85,105,0.11)" strokeWidth="0.6" />
                <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(yValue)} y2={y(yValue)} stroke="rgba(71,85,105,0.11)" strokeWidth="0.6" />
                <text x={x(xValue)} y={HEIGHT - 23} textAnchor="middle" fill="rgba(51,65,85,0.56)" fontSize="8.5">{formatVisualizationValue(xValue, visualization.xFormat)}</text>
                <text x={PLOT.left - 7} y={y(yValue) + 3} textAnchor="end" fill="rgba(51,65,85,0.56)" fontSize="8.5">{formatVisualizationValue(yValue, visualization.yFormat)}</text>
              </g>
            );
          })}
          {visualization.points.map((point, index) => {
            const series = seriesByKey.get(point.seriesKey);
            if (!series) return null;
            const radius = point.size === null ? 3.2 : 3 + Math.sqrt(point.size / maximumSize) * 8;
            return (
              <circle key={`${point.label}-${index}`} cx={x(point.x)} cy={y(point.y)} r={radius} fill={TONE_COLORS[series.tone]} fillOpacity="0.42" stroke="rgba(255,255,255,0.78)" strokeWidth="0.8" filter="url(#scatter-point-shadow)">
                <title>{`${point.label} · ${visualization.xLabel}: ${formatVisualizationValue(point.x, visualization.xFormat)} · ${visualization.yLabel}: ${formatVisualizationValue(point.y, visualization.yFormat)}${point.size === null ? "" : ` · Größe: ${point.size}`}`}</title>
              </circle>
            );
          })}
          <text x={PLOT.left + plotWidth / 2} y={HEIGHT - 4} textAnchor="middle" fill="rgba(51,65,85,0.5)" fontSize="8.5">{visualization.xLabel}</text>
          <text x="9" y={PLOT.top + plotHeight / 2} textAnchor="middle" fill="rgba(51,65,85,0.5)" fontSize="8.5" transform={`rotate(-90 9 ${PLOT.top + plotHeight / 2})`}>{visualization.yLabel}</text>
        </svg>
      </div>
    </VisualizationFrame>
  );
}
