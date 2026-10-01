"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardData, useDashboardFacets } from "./RealGmDashboard";
import { useRedMonth } from "@/context/RedMonthContext";
import { IppChartPanel } from "@/components/admin/gm-dashboard/IppChartPanel";
import { IppOverlapModal } from "@/components/admin/gm-dashboard/IppOverlapModal";
import {
  findIntervalById,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
import { buildDashboardIntervals } from "@/lib/gm-dashboard/date-range";
import {
  type IppLinePoint,
  type IppFilterScope,
} from "@/lib/ipp-dashboard/mock-data";
import {
  IppFilterBar,
  type IppFilterState,
  type IppGmOption,
  type IppMarketOption,
} from "@/components/admin/gm-dashboard/IppFilterBar";
import { IppIntervalToolbar } from "@/components/admin/gm-dashboard/IppIntervalToolbar";
import type { ComparePreset } from "@/components/admin/gm-dashboard/IppOverlapControls";
import { averageIppYtd, calendarToday } from "@/lib/gm-dashboard/data";
import { placementPie } from "@/lib/gm-dashboard/chart-adapters";
import { resolveCompareIntervalId } from "@/components/admin/gm-dashboard/overlap-utils";

export function IppAuswertungCard() {
  const { calendar, error: calendarError } = useRedMonth();
  const facets = useDashboardFacets();
  const { markets, gms } = facets;
  const [intervalMode, setIntervalMode] = useState<IntervalMode>("redmonth");
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(
    null,
  );

  const [filters, setFilters] = useState<IppFilterState>({
    region: null,
    gmId: null,
    chain: null,
    marketId: null,
    stc: null,
  });

  const [compareEnabled, setCompareEnabled] = useState(false);
  const [baseIntervalId, setBaseIntervalId] = useState<string | null>(null);
  const [comparePreset, setComparePreset] = useState<ComparePreset>("previous");
  const [customCompareIntervalId, setCustomCompareIntervalId] = useState<
    string | null
  >(null);
  const [isOverlapModalOpen, setIsOverlapModalOpen] = useState(false);
  const [revertOverlapOnModalCancel, setRevertOverlapOnModalCancel] =
    useState(false);

  const intervals = useMemo(
    () =>
      intervalMode === "redmonth" && !calendar.length
        ? []
        : buildDashboardIntervals({
            mode: intervalMode,
            minStartDate: facets.startDate,
            count:
              intervalMode === "week"
                ? 36
                : intervalMode === "quarter"
                  ? 12
                  : 28,
            redMonthCalendar: calendar.filter(
              (period) => period.start <= calendarToday(),
            ),
            now: new Date(calendarToday() + "T12:00:00Z"),
          }),
    [calendar, intervalMode, facets.startDate],
  );

  useEffect(() => {
    if (intervals.length === 0) {
      if (facets.loading) return;
      setSelectedIntervalId(null);
      return;
    }
    if (
      !selectedIntervalId ||
      !intervals.some((interval) => interval.id === selectedIntervalId)
    ) {
      setSelectedIntervalId(intervals[0]!.id);
    }
  }, [intervals, selectedIntervalId, facets.loading]);

  useEffect(() => {
    if (intervals.length === 0) {
      if (facets.loading) return;
      setBaseIntervalId(null);
      return;
    }
    if (
      !baseIntervalId ||
      !intervals.some((interval) => interval.id === baseIntervalId)
    ) {
      setBaseIntervalId(selectedIntervalId ?? intervals[0]!.id);
    }
  }, [baseIntervalId, intervals, selectedIntervalId, facets.loading]);

  useEffect(() => {
    if (facets.loading) return;
    if (comparePreset !== "custom") return;
    if (!customCompareIntervalId) return;
    if (
      !intervals.some((interval) => interval.id === customCompareIntervalId)
    ) {
      setCustomCompareIntervalId(null);
    }
  }, [comparePreset, customCompareIntervalId, intervals, facets.loading]);

  const activeBaseIntervalId = baseIntervalId ?? selectedIntervalId;
  const customCandidateIntervals = intervals.filter(
    (interval) => interval.id !== activeBaseIntervalId,
  );

  const compareIntervalId = useMemo(() => {
    if (!compareEnabled) return null;
    return resolveCompareIntervalId({
      intervals,
      baseIntervalId: activeBaseIntervalId,
      preset: comparePreset,
      customCompareIntervalId,
    });
  }, [
    activeBaseIntervalId,
    compareEnabled,
    comparePreset,
    customCompareIntervalId,
    intervals,
  ]);

  const compareInterval = findIntervalById(intervals, compareIntervalId);
  const filterScope: IppFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
    chainGroups: filters.chainGroups,
    marketId: filters.marketId,
    stc: filters.stc,
  };

  const result = useDashboardData(
    "IPP",
    intervals,
    filterScope,
    selectedIntervalId,
    null,
    compareEnabled ? comparePreset : "off",
    compareIntervalId,
  );
  const loading = facets.loading || result.loading;
  const loadError =
    facets.error ??
    result.error ??
    (intervalMode === "redmonth" ? calendarError : null);
  const linePoints = useMemo<IppLinePoint[]>(
    () =>
      [...(result.data?.points ?? [])]
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((point) => {
          const target = compareEnabled
            ? resolveCompareIntervalId({
                intervals,
                baseIntervalId: point.id,
                preset: comparePreset,
                customCompareIntervalId,
              })
            : null;
          return {
            intervalId: point.id,
            label: point.label,
            shortLabel: point.shortLabel,
            value: point.ipp ?? NaN,
            compareValue:
              result.data?.points.find((p) => p.id === target)?.ipp ?? null,
          };
        }),
    [
      result.data,
      compareEnabled,
      comparePreset,
      customCompareIntervalId,
      intervals,
    ],
  );
  const current = linePoints.find((p) => p.intervalId === activeBaseIntervalId);
  const compareResult =
    compareEnabled &&
    current &&
    Number.isFinite(current.value) &&
    current.compareValue != null
      ? {
          deltaAbs: current.value - current.compareValue,
          deltaPct: current.compareValue
            ? (100 * (current.value - current.compareValue)) /
              current.compareValue
            : null,
        }
      : null;
  const ytdAverage = averageIppYtd(result.data?.points ?? [], calendarToday());
  const pieData = placementPie(
    (result.data?.points ?? []).filter((p) => p.id === selectedIntervalId),
  );
  const pieDataCumulative = placementPie(
    (result.data?.points ?? []).filter(
      (p) => p.start.slice(0, 4) === calendarToday().slice(0, 4),
    ),
  );

  const regionOptions = useMemo(() => {
    const unique = new Set(
      markets.map((market) => market.region).filter(Boolean),
    );
    return Array.from(unique).sort((left, right) =>
      left.localeCompare(right, "de"),
    );
  }, [markets]);

  const compareLabel = compareInterval
    ? compareInterval.shortLabel
    : compareEnabled
      ? "Kein passender Vergleich"
      : "Kein Vergleich";

  return (
    <section
      style={{
        background: "rgba(0,0,0,0.025)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 460,
      }}
    >
      <header
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(0,0,0,0.36)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            IPP und Platzierungs Auswertung
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
            }}
          >
            IPP Auswertung
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(0,0,0,0.38)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            YTD average IPP
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#059669",
              lineHeight: 1.05,
            }}
          >
            {ytdAverage != null ? ytdAverage.toFixed(1) : "—"}
          </div>
          <div
            style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}
          >
            Aktuelles Jahr
          </div>
        </div>
      </header>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        {loadError && (
          <div
            style={{
              borderRadius: 9,
              border: "1px solid rgba(185,28,28,0.26)",
              background: "rgba(185,28,28,0.08)",
              color: "#991b1b",
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {loadError}
          </div>
        )}

        <IppFilterBar
          filters={filters}
          regions={regionOptions}
          gms={gms}
          markets={markets}
          onChange={setFilters}
        />

        <IppIntervalToolbar
          mode={intervalMode}
          onModeChange={(mode) => {
            setIntervalMode(mode);
            if (mode !== "quarter" && comparePreset === "q4_vs_q2") {
              setComparePreset("previous");
            }
          }}
          intervals={intervals}
          selectedIntervalId={selectedIntervalId}
          onSelectInterval={(intervalId) => {
            setSelectedIntervalId(intervalId);
            if (!compareEnabled) setBaseIntervalId(intervalId);
          }}
        />

        <IppChartPanel
          linePoints={linePoints}
          ytdAverage={ytdAverage}
          selectedIntervalId={selectedIntervalId}
          onSelectInterval={setSelectedIntervalId}
          compareEnabled={compareEnabled}
          onCompareEnabledChange={(enabled) => {
            if (enabled) {
              setCompareEnabled(true);
              setRevertOverlapOnModalCancel(!compareEnabled);
              setIsOverlapModalOpen(true);
              return;
            }
            setCompareEnabled(false);
            setRevertOverlapOnModalCancel(false);
            setIsOverlapModalOpen(false);
          }}
          onOpenOverlapModal={() => {
            setRevertOverlapOnModalCancel(false);
            setIsOverlapModalOpen(true);
          }}
          resolvedCompareLabel={compareLabel}
          compareResult={compareResult}
          pieSlices={pieData.slices}
          pieTotal={pieData.total}
          pieCumulativeSlices={pieDataCumulative.slices}
          pieCumulativeTotal={pieDataCumulative.total}
        />

        {loading && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(0,0,0,0.4)",
              textAlign: "center",
              paddingBottom: 4,
            }}
          >
            Filterquellen werden geladen...
          </div>
        )}
      </div>

      <IppOverlapModal
        open={isOverlapModalOpen}
        mode={intervalMode}
        intervals={intervals}
        initialBaseIntervalId={activeBaseIntervalId}
        initialPreset={comparePreset}
        initialCustomCompareIntervalId={customCompareIntervalId}
        onClose={() => {
          setIsOverlapModalOpen(false);
          if (revertOverlapOnModalCancel) setCompareEnabled(false);
          setRevertOverlapOnModalCancel(false);
        }}
        onApply={(payload) => {
          setBaseIntervalId(payload.baseIntervalId);
          setSelectedIntervalId(payload.baseIntervalId);
          setComparePreset(payload.preset);
          setCustomCompareIntervalId(payload.customCompareIntervalId);
          setCompareEnabled(true);
          setRevertOverlapOnModalCancel(false);
          setIsOverlapModalOpen(false);
        }}
      />
    </section>
  );
}
