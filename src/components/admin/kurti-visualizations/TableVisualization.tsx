import type { AdminKurtiTableVisualization } from "@/lib/api/backend";
import { VisualizationFrame } from "./VisualizationFrame";
import styles from "./visualizations.module.css";

const STATUS_BACKGROUND = {
  neutral: "transparent",
  positive: "rgba(5,150,105,0.045)",
  warning: "rgba(217,119,6,0.055)",
  critical: "rgba(220,38,38,0.055)",
};

export function TableVisualization({ visualization }: { visualization: AdminKurtiTableVisualization }) {
  return (
    <VisualizationFrame {...visualization}>
      <div className={`${styles.scroll} ${styles.surface}`} style={{ overflowX: "auto", maxHeight: 390, overflowY: "auto", borderRadius: 10 }}>
        <table style={{ width: "100%", minWidth: Math.max(420, visualization.columns.length * 100), borderCollapse: "separate", borderSpacing: 0, color: "rgba(15,23,42,0.74)", fontSize: 9.5 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", top: 0, zIndex: 1, padding: "8px", background: "rgba(241,245,249,0.82)", backdropFilter: "blur(9px)", borderBottom: "1px solid rgba(71,85,105,0.09)", boxShadow: "0 4px 9px rgba(15,23,42,0.025)", textAlign: "left", fontWeight: 720 }}>Eintrag</th>
              {visualization.columns.map((column) => <th key={column.key} style={{ position: "sticky", top: 0, zIndex: 1, padding: "8px", background: "rgba(241,245,249,0.82)", backdropFilter: "blur(9px)", borderBottom: "1px solid rgba(71,85,105,0.09)", boxShadow: "0 4px 9px rgba(15,23,42,0.025)", textAlign: column.align, fontWeight: 720, whiteSpace: "nowrap" }}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visualization.rows.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`} style={{ background: row.status === "neutral" && rowIndex % 2 ? "rgba(248,250,252,0.2)" : STATUS_BACKGROUND[row.status] }}>
                <th scope="row" style={{ padding: "6px 8px", borderBottom: "1px solid rgba(71,85,105,0.05)", borderLeft: `2px solid ${row.status === "neutral" ? "transparent" : row.status === "positive" ? "rgba(5,150,105,0.42)" : row.status === "warning" ? "rgba(217,119,6,0.46)" : "rgba(220,38,38,0.46)"}`, color: "rgba(15,23,42,0.76)", fontWeight: 650, textAlign: "left", whiteSpace: "nowrap" }}>{row.label}</th>
                {visualization.columns.map((column, columnIndex) => <td key={column.key} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(71,85,105,0.055)", textAlign: column.align, verticalAlign: "top" }}>{row.values[columnIndex] ?? "–"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </VisualizationFrame>
  );
}
