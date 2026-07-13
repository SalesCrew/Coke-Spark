import type { AdminKurtiRadarVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, TONE_COLORS } from "./visualizationUtils";

const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 102;

function coordinate(index: number, count: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
}

function polygon(values: number[], maximum: number): string {
  return values.map((value, index) => coordinate(index, values.length, (value / maximum) * RADIUS).join(",")).join(" ");
}

export function RadarVisualization({ visualization }: { visualization: AdminKurtiRadarVisualization }) {
  const observedMaximum = Math.max(...visualization.series.flatMap((series) => series.values), 1);
  const maximum = visualization.maximum ?? observedMaximum;
  const legend = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 11px" }}>
      {visualization.series.map((series) => <span key={series.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "rgba(51,65,85,0.66)", fontSize: 9.5 }}><span style={{ width: 11, height: 1.5, background: TONE_COLORS[series.tone], opacity: 0.8 }} />{series.label}</span>)}
    </div>
  );
  return (
    <VisualizationFrame {...visualization} legend={legend}>
      <svg role="img" aria-label={`Radar-Diagramm: ${visualization.title}`} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: "block", width: "100%", maxWidth: 390, margin: "0 auto" }}>
        <defs>
          <filter id="radar-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => <polygon key={ratio} points={visualization.axes.map((_, index) => coordinate(index, visualization.axes.length, RADIUS * ratio).join(",")).join(" ")} fill="none" stroke="rgba(71,85,105,0.13)" strokeWidth="0.65" />)}
        {visualization.axes.map((axis, index) => {
          const [x, y] = coordinate(index, visualization.axes.length, RADIUS);
          const [labelX, labelY] = coordinate(index, visualization.axes.length, RADIUS + 29);
          return <g key={axis}><line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(71,85,105,0.12)" strokeWidth="0.6" /><text x={labelX} y={labelY + 3} textAnchor="middle" fill="rgba(51,65,85,0.64)" fontSize="8.8">{axis.length > 20 ? `${axis.slice(0, 19)}…` : axis}</text></g>;
        })}
        {visualization.series.map((series) => (
          <polygon key={series.label} points={polygon(series.values, maximum)} fill={TONE_COLORS[series.tone]} fillOpacity="0.07" stroke={TONE_COLORS[series.tone]} strokeOpacity="0.8" strokeWidth="1.05" filter="url(#radar-soft-shadow)">
            <title>{`${series.label}: ${series.values.map((value, index) => `${visualization.axes[index]} ${formatVisualizationValue(value, visualization.valueFormat)}`).join(" · ")}`}</title>
          </polygon>
        ))}
      </svg>
    </VisualizationFrame>
  );
}
