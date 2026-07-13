import type { AdminKurtiCompositionVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue, TONE_COLORS } from "./visualizationUtils";
import styles from "./visualizations.module.css";

function polarPoint(angle: number, radius: number): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [75 + radius * Math.cos(radians), 75 + radius * Math.sin(radians)];
}

function pieSlicePath(startAngle: number, endAngle: number, radius: number): string {
  const [startX, startY] = polarPoint(startAngle, radius);
  const [endX, endY] = polarPoint(endAngle, radius);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 75 75 L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export function CompositionVisualization({ visualization }: { visualization: AdminKurtiCompositionVisualization }) {
  const total = visualization.items.reduce((sum, item) => sum + item.value, 0);
  if (visualization.variant === "funnel") {
    const maximum = Math.max(...visualization.items.map((item) => item.value), 1);
    return (
      <VisualizationFrame {...visualization}>
        <div style={{ display: "grid", gap: 5, padding: "3px 0" }}>
          {visualization.items.map((item, index) => (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(80px, 0.48fr) minmax(100px, 1fr) auto", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgba(51,65,85,0.66)", fontSize: 9.5 }}>{item.label}</span>
              <span style={{ display: "flex", justifyContent: "center" }}>
                <span className={`${styles.surface} ${styles.interactiveSurface}`} style={{ display: "block", width: `${Math.max(8, (item.value / maximum) * 100)}%`, height: 16, borderRadius: index === 0 ? "6px 6px 3px 3px" : "3px", background: `linear-gradient(90deg, ${TONE_COLORS[item.tone]}5c, ${TONE_COLORS[item.tone]}a3)`, borderColor: `${TONE_COLORS[item.tone]}28`, boxShadow: `0 4px 10px ${TONE_COLORS[item.tone]}12, inset 0 1px 0 rgba(255,255,255,0.32)` }} />
              </span>
              <span style={{ color: "rgba(15,23,42,0.74)", fontSize: 9.5, fontVariantNumeric: "tabular-nums" }}>{formatVisualizationValue(item.value, visualization.valueFormat)}</span>
            </div>
          ))}
        </div>
      </VisualizationFrame>
    );
  }

  let offset = 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 18;
  let pieAngle = 0;
  return (
    <VisualizationFrame {...visualization}>
      <div className={styles.compositionLayout}>
        <svg className={styles.compositionChart} role="img" aria-label={`${visualization.variant}: ${visualization.title}`} viewBox="0 0 150 150">
          <defs>
            <filter id="composition-soft-shadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.1" />
            </filter>
          </defs>
          {visualization.variant === "donut" ? (
            <g filter="url(#composition-soft-shadow)">
              <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={strokeWidth} />
              {visualization.items.map((item) => {
                const length = total > 0 ? (item.value / total) * circumference : 0;
                const currentOffset = offset;
                offset += length;
                return (
                  <circle key={item.label} cx="75" cy="75" r={radius} fill="none" stroke={TONE_COLORS[item.tone]} strokeOpacity="0.76" strokeWidth={strokeWidth} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} transform="rotate(-90 75 75)">
                    <title>{`${item.label}: ${formatVisualizationValue(item.value, visualization.valueFormat)} (${total ? ((item.value / total) * 100).toFixed(1) : 0} %)`}</title>
                  </circle>
                );
              })}
            </g>
          ) : (
            <g filter="url(#composition-soft-shadow)">
              {visualization.items.map((item) => {
                const sweep = total > 0 ? (item.value / total) * 360 : 0;
                const startAngle = pieAngle;
                const endAngle = pieAngle + sweep;
                pieAngle = endAngle;
                const title = `${item.label}: ${formatVisualizationValue(item.value, visualization.valueFormat)} (${total ? ((item.value / total) * 100).toFixed(1) : 0} %)`;
                return sweep >= 359.999 ? (
                  <circle key={item.label} cx="75" cy="75" r="56" fill={TONE_COLORS[item.tone]} fillOpacity="0.76"><title>{title}</title></circle>
                ) : (
                  <path key={item.label} d={pieSlicePath(startAngle, endAngle, 56)} fill={TONE_COLORS[item.tone]} fillOpacity="0.76" stroke="rgba(255,255,255,0.64)" strokeWidth="0.7"><title>{title}</title></path>
                );
              })}
            </g>
          )}
          {visualization.variant === "donut" ? (
            <g>
              <text x="75" y="71" textAnchor="middle" fill="rgba(15,23,42,0.83)" fontSize="13" fontWeight="700">{formatVisualizationValue(total, visualization.valueFormat)}</text>
              {visualization.centerLabel ? <text x="75" y="87" textAnchor="middle" fill="rgba(51,65,85,0.58)" fontSize="8.5">{visualization.centerLabel}</text> : null}
            </g>
          ) : null}
        </svg>
        <div className={styles.compositionLegend}>
          {visualization.items.map((item) => (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "8px minmax(0,1fr) auto", alignItems: "center", gap: 6, padding: "2px 0", fontSize: 9.5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: TONE_COLORS[item.tone], opacity: 0.78 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", color: "rgba(51,65,85,0.66)", whiteSpace: "nowrap" }}>{item.label}</span>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: "rgba(15,23,42,0.74)", fontVariantNumeric: "tabular-nums" }}>
                {formatVisualizationValue(item.value, visualization.valueFormat)}
                {visualization.valueFormat !== "percent" ? <small style={{ color: "rgba(51,65,85,0.46)", fontSize: 7.8 }}>{total ? `${((item.value / total) * 100).toFixed(1)} %` : "0 %"}</small> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </VisualizationFrame>
  );
}
