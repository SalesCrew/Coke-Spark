"use client";

import type { IppCompareResult, IppLinePoint, IppPieSlice } from "@/lib/ipp-dashboard/mock-data";
import type { IntervalMode, IppInterval } from "@/lib/ipp-dashboard/intervals";
import { IppLineChart } from "@/components/admin/gm-dashboard/charts/IppLineChart";
import { IppPieChart } from "@/components/admin/gm-dashboard/charts/IppPieChart";
import { IppMiniDropdown } from "@/components/admin/gm-dashboard/IppMiniDropdown";
import type { ComparePreset } from "@/components/admin/gm-dashboard/IppOverlapControls";

type IppChartPanelProps = {
  mode: IntervalMode;
  linePoints: IppLinePoint[];
  selectedIntervalId: string | null;
  onSelectInterval: (intervalId: string) => void;
  compareEnabled: boolean;
  onCompareEnabledChange: (enabled: boolean) => void;
  comparePreset: ComparePreset;
  onComparePresetChange: (preset: ComparePreset) => void;
  customCompareIntervalId: string | null;
  onCustomCompareIntervalIdChange: (intervalId: string | null) => void;
  availableCustomIntervals: IppInterval[];
  resolvedCompareLabel: string;
  compareResult: IppCompareResult | null;
  pieSlices: IppPieSlice[];
  pieTotal: number;
};

export function IppChartPanel({
  mode,
  linePoints,
  selectedIntervalId,
  onSelectInterval,
  compareEnabled,
  onCompareEnabledChange,
  comparePreset,
  onComparePresetChange,
  customCompareIntervalId,
  onCustomCompareIntervalIdChange,
  availableCustomIntervals,
  resolvedCompareLabel,
  compareResult,
  pieSlices,
  pieTotal,
}: IppChartPanelProps) {
  const presetButtonStyle = (active: boolean) => ({
    borderRadius: 7,
    border: "none",
    background: active ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "linear-gradient(to bottom,#fff,#f8f8f8)",
    color: active ? "#1f2937" : "rgba(0,0,0,0.6)",
    fontSize: 10,
    fontWeight: 700,
    padding: "5px 8px",
    cursor: "pointer",
    boxShadow: active
      ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07)"
      : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
    transition: "all 0.14s ease",
  });

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
              onClick={() => onCompareEnabledChange(!compareEnabled)}
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
          </div>

          {compareEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => onComparePresetChange("previous")} style={presetButtonStyle(comparePreset === "previous")}>
                1 davor
              </button>
              <button type="button" onClick={() => onComparePresetChange("previous_year")} style={presetButtonStyle(comparePreset === "previous_year")}>
                Vorjahr
              </button>
              {mode === "quarter" && (
                <button type="button" onClick={() => onComparePresetChange("q4_vs_q2")} style={presetButtonStyle(comparePreset === "q4_vs_q2")}>
                  Q4/Q2
                </button>
              )}
              <button type="button" onClick={() => onComparePresetChange("custom")} style={presetButtonStyle(comparePreset === "custom")}>
                Custom
              </button>
              {comparePreset === "custom" && (
                <IppMiniDropdown
                  value={customCompareIntervalId}
                  placeholder="Intervall wählen…"
                  options={availableCustomIntervals.map((interval) => ({
                    value: interval.id,
                    label: interval.label,
                  }))}
                  minWidth={200}
                  onChange={onCustomCompareIntervalIdChange}
                />
              )}
            </div>
          )}
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
          <IppPieChart slices={pieSlices} total={pieTotal} />
        </div>
      </div>
    </section>
  );
}
