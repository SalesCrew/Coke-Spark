import type { CSSProperties } from "react";
import type { AdminKurtiMetricsVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import { formatVisualizationValue } from "./visualizationUtils";
import styles from "./visualizations.module.css";

const STATUS_COLOR = {
  neutral: "rgba(71,85,105,0.72)",
  positive: "rgba(5,150,105,0.8)",
  warning: "rgba(217,119,6,0.82)",
  critical: "rgba(220,38,38,0.82)",
};

export function MetricsVisualization({ visualization }: { visualization: AdminKurtiMetricsVisualization }) {
  return (
    <VisualizationFrame {...visualization}>
      <div
        className={`${styles.metricsGrid} ${Number(visualization.columns) > 2 ? styles.metricsGridCompactable : ""}`}
        style={{ "--metric-columns": visualization.columns } as CSSProperties}
      >
        {visualization.items.map((item, index) => (
          <div className={`${styles.surface} ${styles.interactiveSurface}`} key={`${item.label}-${index}`} style={{ position: "relative", minWidth: 0, padding: "10px 10px 9px", overflow: "hidden", borderRadius: 11 }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: "0 auto 0 0", width: 2, background: STATUS_COLOR[item.status], opacity: item.status === "neutral" ? 0.18 : 0.42 }} />
            <div style={{ color: "rgba(51,65,85,0.62)", fontSize: 9.5, lineHeight: 1.3 }}>{item.label}</div>
            <div style={{ marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", color: "rgba(15,23,42,0.86)", fontSize: 15, fontWeight: 760, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {item.displayValue ?? (item.value !== null ? formatVisualizationValue(item.value, item.valueFormat) : "–")}
            </div>
            {(item.delta !== null || item.deltaLabel) ? (
              <div style={{ marginTop: 3, color: STATUS_COLOR[item.status], fontSize: 8.8, fontWeight: 650 }}>
                {item.delta !== null ? `${item.delta > 0 ? "+" : ""}${formatVisualizationValue(item.delta, item.valueFormat)}` : ""}{item.deltaLabel ? ` ${item.deltaLabel}` : ""}
              </div>
            ) : null}
            {item.progress !== null ? (
              <div style={{ marginTop: 7, height: 3, borderRadius: 999, overflow: "hidden", background: "rgba(148,163,184,0.16)", boxShadow: "inset 0 1px 1px rgba(15,23,42,0.04)" }}>
                <div style={{ width: `${item.progress}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${STATUS_COLOR[item.status]}, ${STATUS_COLOR[item.status]})`, boxShadow: `0 1px 4px ${STATUS_COLOR[item.status]}`, opacity: 0.75 }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </VisualizationFrame>
  );
}
