"use client";

import type { IntervalMode, IppInterval } from "@/lib/ipp-dashboard/intervals";
import { IppMiniDropdown } from "@/components/admin/gm-dashboard/IppMiniDropdown";

export type ComparePreset = "previous" | "previous_year" | "q4_vs_q2" | "custom";

type IppOverlapControlsProps = {
  mode: IntervalMode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  preset: ComparePreset;
  onPresetChange: (preset: ComparePreset) => void;
  customIntervalId: string | null;
  onCustomIntervalIdChange: (intervalId: string | null) => void;
  availableCustomIntervals: IppInterval[];
  resolvedCompareLabel: string;
};

export function IppOverlapControls({
  mode,
  enabled,
  onEnabledChange,
  preset,
  onPresetChange,
  customIntervalId,
  onCustomIntervalIdChange,
  availableCustomIntervals,
  resolvedCompareLabel,
}: IppOverlapControlsProps) {
  return (
    <section
      style={{
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.94)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onEnabledChange(!enabled)}
            style={{
              borderRadius: 999,
              border: "none",
              width: 46,
              height: 24,
              background: enabled ? "#111111" : "rgba(0,0,0,0.16)",
              position: "relative",
              cursor: "pointer",
              transition: "all 0.16s ease",
            }}
            aria-label="Compare toggle"
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: enabled ? 25 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.16)",
                transition: "left 0.16s ease",
              }}
            />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.38)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Overlap
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
              {enabled ? `Aktiv · ${resolvedCompareLabel}` : "Inaktiv"}
            </div>
          </div>
        </div>
      </div>

      {enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onPresetChange("previous")}
            style={{
              borderRadius: 8,
              border: "none",
              background: preset === "previous" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "linear-gradient(to bottom,#fff,#f8f8f8)",
              color: preset === "previous" ? "#1f2937" : "rgba(0,0,0,0.6)",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              cursor: "pointer",
              boxShadow: preset === "previous"
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07)"
                : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            1 Intervall davor
          </button>

          <button
            type="button"
            onClick={() => onPresetChange("previous_year")}
            style={{
              borderRadius: 8,
              border: "none",
              background: preset === "previous_year" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "linear-gradient(to bottom,#fff,#f8f8f8)",
              color: preset === "previous_year" ? "#1f2937" : "rgba(0,0,0,0.6)",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              cursor: "pointer",
              boxShadow: preset === "previous_year"
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07)"
                : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            Gleiches Intervall Vorjahr
          </button>

          {mode === "quarter" && (
            <button
              type="button"
              onClick={() => onPresetChange("q4_vs_q2")}
              style={{
                borderRadius: 8,
                border: "none",
                background: preset === "q4_vs_q2" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "linear-gradient(to bottom,#fff,#f8f8f8)",
                color: preset === "q4_vs_q2" ? "#1f2937" : "rgba(0,0,0,0.6)",
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 10px",
                cursor: "pointer",
                boxShadow: preset === "q4_vs_q2"
                  ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07)"
                  : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              Q4 vs Q2
            </button>
          )}

          <button
            type="button"
            onClick={() => onPresetChange("custom")}
            style={{
              borderRadius: 8,
              border: "none",
              background: preset === "custom" ? "linear-gradient(to bottom,#fff,#f5f5f5)" : "linear-gradient(to bottom,#fff,#f8f8f8)",
              color: preset === "custom" ? "#1f2937" : "rgba(0,0,0,0.6)",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              cursor: "pointer",
              boxShadow: preset === "custom"
                ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07)"
                : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            Custom
          </button>

          {preset === "custom" && (
            <IppMiniDropdown
              value={customIntervalId}
              placeholder="Intervall wählen…"
              options={availableCustomIntervals.map((interval) => ({
                value: interval.id,
                label: interval.label,
              }))}
              minWidth={250}
              onChange={onCustomIntervalIdChange}
            />
          )}
        </div>
      )}
    </section>
  );
}
