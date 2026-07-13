import type { AdminKurtiHeatmapVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue } from "./visualizationUtils";
import styles from "./visualizations.module.css";

export function HeatmapVisualization({ visualization }: { visualization: AdminKurtiHeatmapVisualization }) {
  const values = visualization.rows.flatMap((row) => row.values).filter((value): value is number => value !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  return (
    <VisualizationFrame {...visualization}>
      <div className={styles.scroll} style={{ overflowX: "auto", paddingBottom: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: `minmax(92px, max-content) repeat(${visualization.xLabels.length}, minmax(34px, 1fr))`, gap: 3, minWidth: Math.max(430, 105 + visualization.xLabels.length * 40) }}>
          <span />
          {visualization.xLabels.map((label, index) => <span key={`${label}-${index}`} title={label} style={{ overflow: "hidden", textOverflow: "ellipsis", color: "rgba(51,65,85,0.57)", fontSize: 8.5, textAlign: "center", whiteSpace: "nowrap" }}>{label}</span>)}
          {visualization.rows.flatMap((row, rowIndex) => [
            <span key={`label-${rowIndex}`} title={row.label} style={{ overflow: "hidden", textOverflow: "ellipsis", alignSelf: "center", color: "rgba(51,65,85,0.68)", fontSize: 9, fontWeight: 620, whiteSpace: "nowrap" }}>{row.label}</span>,
            ...row.values.map((value, columnIndex) => {
              const intensity = value === null ? 0 : 0.1 + ((value - min) / range) * 0.58;
              return (
                <span className={styles.interactiveSurface} key={`${rowIndex}-${columnIndex}`} title={value === null ? `${row.label} · ${visualization.xLabels[columnIndex]}: keine Daten` : `${row.label} · ${visualization.xLabels[columnIndex]}: ${formatVisualizationValue(value, visualization.valueFormat)}`} style={{ height: 25, borderRadius: 6, border: "1px solid rgba(255,255,255,0.32)", background: value === null ? "rgba(148,163,184,0.075)" : `linear-gradient(145deg, rgba(239,68,68,${Math.min(0.74, intensity + 0.05)}), rgba(185,28,28,${intensity}))`, boxShadow: value === null ? "inset 0 1px 0 rgba(255,255,255,0.45)" : `0 3px 8px rgba(127,29,29,${Math.min(0.1, intensity * 0.13)}), inset 0 1px 0 rgba(255,255,255,0.22)`, display: "grid", placeItems: "center", color: intensity > 0.43 ? "rgba(255,255,255,0.96)" : "rgba(15,23,42,0.67)", fontSize: 7.8, fontVariantNumeric: "tabular-nums" }}>
                  {value === null ? "·" : visualization.xLabels.length <= 12 ? formatVisualizationValue(value, visualization.valueFormat) : ""}
                </span>
              );
            }),
          ])}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 6, color: "rgba(51,65,85,0.52)", fontSize: 8.5 }}>
          <span>{formatVisualizationValue(min, visualization.valueFormat)}</span>
          <span style={{ width: 64, height: 4, borderRadius: 999, background: "linear-gradient(90deg, rgba(248,113,113,0.12), rgba(185,28,28,0.72))", boxShadow: "0 2px 5px rgba(127,29,29,0.09)" }} />
          <span>{formatVisualizationValue(max, visualization.valueFormat)}</span>
        </div>
      </div>
    </VisualizationFrame>
  );
}
