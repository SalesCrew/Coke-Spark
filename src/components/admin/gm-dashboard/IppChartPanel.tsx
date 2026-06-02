"use client";

import type { IppCompareResult, IppLinePoint, IppPieSlice } from "@/lib/ipp-dashboard/mock-data";
import { IppLineChart } from "@/components/admin/gm-dashboard/charts/IppLineChart";
import { IppPieChart } from "@/components/admin/gm-dashboard/charts/IppPieChart";

type IppChartPanelProps = {
  linePoints: IppLinePoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
  compareEnabled: boolean;
  onCompareEnabledChange: (enabled: boolean) => void;
  onOpenOverlapModal: () => void;
  resolvedCompareLabel: string;
  compareResult: IppCompareResult | null;
  pieSlices: IppPieSlice[];
  pieTotal: number;
  pieCumulativeSlices: IppPieSlice[];
  pieCumulativeTotal: number;
};

export function IppChartPanel({
  linePoints,
  selectedIntervalId,
  onSelectInterval,
  compareEnabled,
  onCompareEnabledChange,
  onOpenOverlapModal,
  resolvedCompareLabel,
  compareResult,
  pieSlices,
  pieTotal,
  pieCumulativeSlices,
  pieCumulativeTotal,
}: IppChartPanelProps) {
  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#ffffff",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 10px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(0,0,0,0.015)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
            Chart
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
            IPP Trend · Platzierung vs Zweitplatzierung
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (compareEnabled) {
                  onCompareEnabledChange(false);
                  return;
                }
                onCompareEnabledChange(true);
              }}
              style={{
                borderRadius: 999,
                border: "none",
                width: 38,
                height: 20,
                background: compareEnabled ? "#111111" : "rgba(0,0,0,0.16)",
                position: "relative",
                cursor: "pointer",
                transition: "all 0.16s ease",
              }}
              aria-label="Overlap toggle"
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: compareEnabled ? 20 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.16)",
                  transition: "left 0.16s ease",
                }}
              />
            </button>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Overlap
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#1f2937" }}>
                {compareEnabled ? `Aktiv · ${resolvedCompareLabel}` : "Inaktiv"}
              </div>
            </div>
            {compareEnabled && (
              <button
                type="button"
                onClick={onOpenOverlapModal}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom,#fff,#f5f5f5)",
                  color: "rgba(0,0,0,0.62)",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "6px 9px",
                  cursor: "pointer",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10)",
                }}
              >
                Tool
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "10px 10px 8px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(300px,350px)",
          gap: 0,
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <IppLineChart
            points={linePoints}
            selectedIntervalId={selectedIntervalId}
            onSelectInterval={onSelectInterval}
            compareEnabled={compareEnabled}
            delta={compareResult}
          />
        </div>
        <div
          style={{
            borderLeft: "1px solid rgba(0,0,0,0.07)",
            paddingLeft: 10,
            display: "flex",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <IppPieChart
            slices={pieSlices}
            total={pieTotal}
            cumulativeSlices={pieCumulativeSlices}
            cumulativeTotal={pieCumulativeTotal}
          />
        </div>
      </div>
    </section>
  );
}
