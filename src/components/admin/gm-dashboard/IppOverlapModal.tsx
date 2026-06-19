"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntervalMode, IppInterval } from "@/lib/ipp-dashboard/intervals";
import { IppMiniDropdown } from "@/components/admin/gm-dashboard/IppMiniDropdown";
import type { ComparePreset } from "@/components/admin/gm-dashboard/IppOverlapControls";
import { resolveCompareIntervalId } from "@/components/admin/gm-dashboard/overlap-utils";

type ApplyPayload = {
  baseIntervalId: string;
  preset: ComparePreset;
  customCompareIntervalId: string | null;
  compareIntervalId: string;
};

type IppOverlapModalProps = {
  open: boolean;
  mode: IntervalMode;
  intervals: IppInterval[];
  initialBaseIntervalId: string | null;
  initialPreset: ComparePreset;
  initialCustomCompareIntervalId: string | null;
  onClose: () => void;
  onApply: (payload: ApplyPayload) => void;
};

function formatIntervalOptionLabel(interval: IppInterval): string {
  return `${interval.shortLabel} · ${interval.start} - ${interval.end}`;
}

function presetButtonStyle(active: boolean) {
  return {
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
  } as const;
}

export function IppOverlapModal({
  open,
  mode,
  intervals,
  initialBaseIntervalId,
  initialPreset,
  initialCustomCompareIntervalId,
  onClose,
  onApply,
}: IppOverlapModalProps) {
  const [draftBaseIntervalId, setDraftBaseIntervalId] = useState<string | null>(null);
  const [draftPreset, setDraftPreset] = useState<ComparePreset>("previous");
  const [draftCompareIntervalId, setDraftCompareIntervalId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fallbackBase = initialBaseIntervalId ?? intervals[0]?.id ?? null;
    const initialPresetSafe = mode !== "quarter" && initialPreset === "q4_vs_q2" ? "previous" : initialPreset;
    const resolvedInitialCompare = resolveCompareIntervalId({
      intervals,
      baseIntervalId: fallbackBase,
      preset: initialPresetSafe,
      customCompareIntervalId: initialCustomCompareIntervalId,
    });
    setDraftBaseIntervalId(fallbackBase);
    setDraftPreset(initialPresetSafe);
    setDraftCompareIntervalId(resolvedInitialCompare);
  }, [initialBaseIntervalId, initialCustomCompareIntervalId, initialPreset, intervals, mode, open]);

  useEffect(() => {
    if (mode !== "quarter" && draftPreset === "q4_vs_q2") {
      setDraftPreset("previous");
    }
  }, [draftPreset, mode]);

  useEffect(() => {
    if (draftPreset === "custom") return;
    const autoCompareId = resolveCompareIntervalId({
      intervals,
      baseIntervalId: draftBaseIntervalId,
      preset: draftPreset,
      customCompareIntervalId: null,
    });
    setDraftCompareIntervalId(autoCompareId);
  }, [draftBaseIntervalId, draftPreset, intervals]);

  const compareOptions = useMemo(
    () =>
      intervals
        .filter((interval) => interval.id !== draftBaseIntervalId)
        .map((interval) => ({ value: interval.id, label: formatIntervalOptionLabel(interval) })),
    [draftBaseIntervalId, intervals],
  );

  useEffect(() => {
    if (!draftCompareIntervalId) return;
    if (!compareOptions.some((option) => option.value === draftCompareIntervalId)) {
      setDraftCompareIntervalId(compareOptions[0]?.value ?? null);
    }
  }, [compareOptions, draftCompareIntervalId]);

  const canApply = Boolean(draftBaseIntervalId && draftCompareIntervalId);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(15,23,42,0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          boxShadow: "0 18px 48px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Overlap Tool
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              Interval vs Interval
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 7,
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
            Schließen
          </button>
        </div>

        <div style={{ borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.02)", padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <IppMiniDropdown
            label="Basis Intervall"
            value={draftBaseIntervalId}
            placeholder="Intervall wählen..."
            options={intervals.map((interval) => ({ value: interval.id, label: formatIntervalOptionLabel(interval) }))}
            minWidth={228}
            onChange={setDraftBaseIntervalId}
          />

          <IppMiniDropdown
            label="Ziel Intervall"
            value={draftCompareIntervalId}
            placeholder="Intervall wählen..."
            options={compareOptions}
            minWidth={228}
            onChange={(value) => {
              setDraftPreset("custom");
              setDraftCompareIntervalId(value);
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={presetButtonStyle(draftPreset === "previous")} onClick={() => setDraftPreset("previous")}>
            Prev
          </button>
          <button type="button" style={presetButtonStyle(draftPreset === "previous_year")} onClick={() => setDraftPreset("previous_year")}>
            YoY
          </button>
          {mode === "quarter" && (
            <button type="button" style={presetButtonStyle(draftPreset === "q4_vs_q2")} onClick={() => setDraftPreset("q4_vs_q2")}>
              Q4/Q2
            </button>
          )}
          <button type="button" style={presetButtonStyle(draftPreset === "custom")} onClick={() => setDraftPreset("custom")}>
            Custom
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 7,
              border: "none",
              background: "linear-gradient(to bottom,#fff,#f5f5f5)",
              color: "rgba(0,0,0,0.62)",
              fontSize: 10,
              fontWeight: 700,
              padding: "7px 10px",
              cursor: "pointer",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (!draftBaseIntervalId || !draftCompareIntervalId) return;
              onApply({
                baseIntervalId: draftBaseIntervalId,
                preset: draftPreset,
                customCompareIntervalId: draftPreset === "custom" ? draftCompareIntervalId : null,
                compareIntervalId: draftCompareIntervalId,
              });
            }}
            style={{
              borderRadius: 7,
              border: "none",
              background: canApply ? "linear-gradient(to bottom,#111827,#0f172a)" : "rgba(17,24,39,0.24)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "7px 11px",
              cursor: canApply ? "pointer" : "not-allowed",
              opacity: canApply ? 1 : 0.6,
              boxShadow: canApply ? "inset 0 1px 0.6px rgba(255,255,255,0.25), 0 0 0 1px rgba(15,23,42,0.35)" : "none",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
