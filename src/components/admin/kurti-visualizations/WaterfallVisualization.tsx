import type { AdminKurtiWaterfallVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, paddedDomain } from "./visualizationUtils";
import styles from "./visualizations.module.css";

const HEIGHT = 255;
const PLOT = { left: 54, right: 30, top: 18, bottom: 47 };

export function WaterfallVisualization({ visualization }: { visualization: AdminKurtiWaterfallVisualization }) {
  const runningValues = [visualization.startValue];
  for (const step of visualization.steps) runningValues.push(runningValues.at(-1)! + step.value);
  const endValue = runningValues.at(-1)!;
  const domain = paddedDomain([0, ...runningValues], true);
  if (!domain) return null;
  const bars = [
    { label: visualization.startLabel, start: 0, end: visualization.startValue, value: visualization.startValue, kind: "total" as const },
    ...visualization.steps.map((step, index) => ({ label: step.label, start: runningValues[index]!, end: runningValues[index + 1]!, value: step.value, kind: "delta" as const })),
    { label: visualization.endLabel, start: 0, end: endValue, value: endValue, kind: "total" as const },
  ];
  const width = Math.max(540, PLOT.left + PLOT.right + bars.length * 64);
  const plotWidth = width - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const slot = plotWidth / bars.length;
  const barWidth = Math.min(34, slot * 0.58);
  const x = (index: number) => PLOT.left + slot * (index + 0.5);
  const y = (value: number) => PLOT.top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => domain.max - (index / 4) * (domain.max - domain.min));
  const legend = (
    <div style={{ display: "flex", gap: 12, color: "rgba(51,65,85,0.62)", fontSize: 9.2 }}>
      <span>● Gesamt</span><span style={{ color: "rgba(5,150,105,0.78)" }}>● Positiv</span><span style={{ color: "rgba(220,38,38,0.78)" }}>● Negativ</span>
    </div>
  );
  return (
    <VisualizationFrame {...visualization} legend={legend}>
      <div className={styles.scroll} style={{ overflowX: "auto", paddingBottom: 2 }}>
        <svg role="img" aria-label={`Waterfall: ${visualization.title}`} viewBox={`0 0 ${width} ${HEIGHT}`} style={{ display: "block", minWidth: width, width: "100%", height: "auto" }}>
          <defs>
            <filter id="waterfall-soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#0f172a" floodOpacity="0.09" /></filter>
          </defs>
          {ticks.map((tick) => <g key={tick}><line x1={PLOT.left} x2={width - PLOT.right} y1={y(tick)} y2={y(tick)} stroke="rgba(71,85,105,0.11)" strokeWidth="0.6" /><text x={PLOT.left - 7} y={y(tick) + 3} textAnchor="end" fill="rgba(51,65,85,0.55)" fontSize="8.5">{formatVisualizationValue(tick, visualization.valueFormat)}</text></g>)}
          {bars.map((bar, index) => {
            const top = Math.min(y(bar.start), y(bar.end));
            const height = Math.max(1, Math.abs(y(bar.start) - y(bar.end)));
            const color = bar.kind === "total" ? "#64748b" : bar.value >= 0 ? "#059669" : "#dc2626";
            const connectorValue = bar.kind === "total" ? bar.end : bar.end;
            return (
              <g key={`${bar.label}-${index}`}>
                {visualization.showConnectors && index < bars.length - 1 ? <line x1={x(index) + barWidth / 2} x2={x(index + 1) - barWidth / 2} y1={y(connectorValue)} y2={y(connectorValue)} stroke="rgba(100,116,139,0.3)" strokeWidth="0.7" strokeDasharray="2 2" /> : null}
                <rect x={x(index) - barWidth / 2} y={top} width={barWidth} height={height} rx="3" fill={color} fillOpacity="0.64" stroke="rgba(255,255,255,0.62)" strokeWidth="0.6" filter="url(#waterfall-soft-shadow)">
                  <title>{`${bar.label}: ${bar.kind === "delta" && bar.value > 0 ? "+" : ""}${formatVisualizationValue(bar.value, visualization.valueFormat)}`}</title>
                </rect>
                <text x={x(index)} y={Math.max(PLOT.top + 8, top - 4)} textAnchor="middle" fill="rgba(15,23,42,0.68)" fontSize="8.2" fontWeight="650">{bar.kind === "delta" && bar.value > 0 ? "+" : ""}{formatVisualizationValue(bar.value, visualization.valueFormat)}</text>
                <text x={x(index)} y={HEIGHT - 22} textAnchor="middle" fill="rgba(51,65,85,0.6)" fontSize="8.4">{bar.label.length > 13 ? `${bar.label.slice(0, 12)}…` : bar.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </VisualizationFrame>
  );
}
