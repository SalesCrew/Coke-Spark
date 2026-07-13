import type { AdminKurtiTimelineVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import styles from "./visualizations.module.css";

const STATUS = {
  completed: "#059669",
  active: "#2563eb",
  pending: "#64748b",
  warning: "#d97706",
  critical: "#dc2626",
};

export function TimelineVisualization({ visualization }: { visualization: AdminKurtiTimelineVisualization }) {
  return (
    <VisualizationFrame {...visualization}>
      <div className={styles.scroll} style={{ maxHeight: 390, overflowY: "auto", padding: "2px 5px 2px 0" }}>
        {visualization.items.map((item, index) => (
          <div key={`${item.date}-${item.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "72px 14px minmax(0,1fr)", gap: 7, minHeight: 48 }}>
            <div style={{ paddingTop: 1, color: "rgba(51,65,85,0.55)", fontSize: 8.8, textAlign: "right" }}>{item.date}</div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              {index < visualization.items.length - 1 ? <span style={{ position: "absolute", top: 9, bottom: -5, width: 1, background: "rgba(100,116,139,0.18)" }} /> : null}
              <span style={{ position: "relative", width: 8, height: 8, marginTop: 4, borderRadius: 999, border: `1px solid ${STATUS[item.status]}`, background: `${STATUS[item.status]}28`, boxShadow: `0 0 0 3px rgba(255,255,255,0.52), 0 3px 7px ${STATUS[item.status]}24` }} />
            </div>
            <div className={styles.interactiveSurface} style={{ minWidth: 0, marginBottom: 8, padding: "1px 6px 7px", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 9, color: "rgba(15,23,42,0.78)", fontSize: 10, fontWeight: 680 }}><span>{item.label}</span>{item.value ? <span style={{ flex: "0 0 auto", color: STATUS[item.status], fontSize: 9 }}>{item.value}</span> : null}</div>
              {item.description ? <div style={{ marginTop: 2, color: "rgba(51,65,85,0.58)", fontSize: 9, lineHeight: 1.4 }}>{item.description}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </VisualizationFrame>
  );
}
