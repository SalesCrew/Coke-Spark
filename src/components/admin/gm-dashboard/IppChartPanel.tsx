"use client";

import type { IppCompareResult, IppLinePoint, IppPieSlice } from "@/lib/ipp-dashboard/mock-data";
import { IppLineChart } from "@/components/admin/gm-dashboard/charts/IppLineChart";
import { IppPieChart } from "@/components/admin/gm-dashboard/charts/IppPieChart";

export type IppChartMode = "line" | "pie";

type IppChartPanelProps = {
  chartMode: IppChartMode;
  onChartModeChange: (mode: IppChartMode) => void;
  linePoints: IppLinePoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
  compareEnabled: boolean;
  compareResult: IppCompareResult | null;
  pieSlices: IppPieSlice[];
  pieTotal: number;
};

export function IppChartPanel({
  chartMode,
  onChartModeChange,
  linePoints,
  selectedIntervalId,
  onSelectInterval,
  compareEnabled,
  compareResult,
  pieSlices,
  pieTotal,
}: IppChartPanelProps) {
  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#ffffff",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(0,0,0,0.015)",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
            Chart
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
            {chartMode === "line" ? "IPP Trend" : "Platzierung vs Zweitplatzierung"}
          </div>
        </div>

        <div style={{ display: "inline-flex", padding: 3, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.04)" }}>
          <button
            type="button"
            onClick={() => onChartModeChange("line")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: chartMode === "line" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "transparent",
              color: chartMode === "line" ? "#1f2937" : "rgba(0,0,0,0.55)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: chartMode === "line"
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)"
                : "none",
              transition: "all 0.16s ease",
            }}
          >
            Linie
          </button>
          <button
            type="button"
            onClick={() => onChartModeChange("pie")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: chartMode === "pie" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "transparent",
              color: chartMode === "pie" ? "#1f2937" : "rgba(0,0,0,0.55)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: chartMode === "pie"
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)"
                : "none",
              transition: "all 0.16s ease",
            }}
          >
            Pie
          </button>
        </div>
      </div>

      <div style={{ padding: "10px 10px 8px", transition: "opacity 0.16s ease", opacity: 1 }}>
        {chartMode === "line" ? (
          <IppLineChart
            points={linePoints}
            selectedIntervalId={selectedIntervalId}
            onSelectInterval={onSelectInterval}
            compareEnabled={compareEnabled}
            delta={compareResult}
          />
        ) : (
          <IppPieChart slices={pieSlices} total={pieTotal} />
        )}
      </div>
    </section>
  );
}
