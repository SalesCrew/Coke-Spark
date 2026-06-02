"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGmUsers, fetchMarkets } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import { IppChartPanel } from "@/components/admin/gm-dashboard/IppChartPanel";
import { IppOverlapModal } from "@/components/admin/gm-dashboard/IppOverlapModal";
import {
  buildIntervals,
  findIntervalById,
  getIntervalDisplayRange,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
import {
  buildMockPieCumulativeData,
  buildCompareResult,
  buildMockLineSeries,
  buildMockPieData,
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
import { resolveCompareIntervalId } from "@/components/admin/gm-dashboard/overlap-utils";

function getRangeAroundToday(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth() + 2, 0));
  const ymd = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return { from: ymd(from), to: ymd(to) };
}

function deriveChainFromMarketName(name: string): string {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token.toUpperCase();
}

export function IppAuswertungCard() {
  const { calendar, loadCalendar } = useRedMonth();
  const [markets, setMarkets] = useState<IppMarketOption[]>([]);
  const [gms, setGms] = useState<IppGmOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [intervalMode, setIntervalMode] = useState<IntervalMode>("redmonth");
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(null);

  const [filters, setFilters] = useState<IppFilterState>({
    region: null,
    gmId: null,
    chain: null,
    stc: null,
  });

  const [compareEnabled, setCompareEnabled] = useState(false);
  const [baseIntervalId, setBaseIntervalId] = useState<string | null>(null);
  const [comparePreset, setComparePreset] = useState<ComparePreset>("previous");
  const [customCompareIntervalId, setCustomCompareIntervalId] = useState<string | null>(null);
  const [isOverlapModalOpen, setIsOverlapModalOpen] = useState(false);
  const [revertOverlapOnModalCancel, setRevertOverlapOnModalCancel] = useState(false);

  useEffect(() => {
    const { from, to } = getRangeAroundToday();
    void loadCalendar({ from, to });
  }, [loadCalendar]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([fetchMarkets(), fetchGmUsers()])
      .then(([marketRows, gmRows]) => {
        if (cancelled) return;
        setMarkets(
          marketRows
            .filter((market) => !market.isDeleted)
            .map((market) => ({
              id: market.id,
              label: market.name,
              region: market.region || "Unbekannt",
              gmName: market.currentGmName || "",
              chain: deriveChainFromMarketName(market.name),
            }))
            .sort((left, right) => left.label.localeCompare(right.label, "de")),
        );
        setGms(
          gmRows
            .map((gm) => ({
              id: gm.id,
              label: `${gm.firstName} ${gm.lastName}`.trim(),
              region: gm.region || "Unbekannt",
            }))
            .sort((left, right) => left.label.localeCompare(right.label, "de")),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Filterdaten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const intervals = useMemo(
    () =>
      buildIntervals({
        mode: intervalMode,
        count: intervalMode === "week" ? 36 : 28,
        redMonthCalendar: calendar,
      }),
    [calendar, intervalMode],
  );

  useEffect(() => {
    if (intervals.length === 0) {
      setSelectedIntervalId(null);
      return;
    }
    if (!selectedIntervalId || !intervals.some((interval) => interval.id === selectedIntervalId)) {
      setSelectedIntervalId(intervals[0]!.id);
    }
  }, [intervals, selectedIntervalId]);

  useEffect(() => {
    if (intervals.length === 0) {
      setBaseIntervalId(null);
      return;
    }
    if (!baseIntervalId || !intervals.some((interval) => interval.id === baseIntervalId)) {
      setBaseIntervalId(selectedIntervalId ?? intervals[0]!.id);
    }
  }, [baseIntervalId, intervals, selectedIntervalId]);

  useEffect(() => {
    if (comparePreset !== "custom") return;
    if (!customCompareIntervalId) return;
    if (!intervals.some((interval) => interval.id === customCompareIntervalId)) {
      setCustomCompareIntervalId(null);
    }
  }, [comparePreset, customCompareIntervalId, intervals]);

  const selectedInterval = findIntervalById(intervals, selectedIntervalId);
  const activeBaseIntervalId = baseIntervalId ?? selectedIntervalId;
  const customCandidateIntervals = intervals.filter((interval) => interval.id !== activeBaseIntervalId);

  const compareIntervalId = useMemo(() => {
    if (!compareEnabled) return null;
    return resolveCompareIntervalId({
      intervals,
      baseIntervalId: activeBaseIntervalId,
      preset: comparePreset,
      customCompareIntervalId,
    });
  }, [activeBaseIntervalId, compareEnabled, comparePreset, customCompareIntervalId, intervals]);

  const compareInterval = findIntervalById(intervals, compareIntervalId);
  const filterScope: IppFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
    stc: filters.stc,
  };

  const linePoints = useMemo(
    () =>
      buildMockLineSeries({
        intervals,
        filters: filterScope,
        compareIntervalId: compareEnabled ? compareIntervalId : null,
      }),
    [compareEnabled, compareIntervalId, filterScope, intervals],
  );

  const compareResult = useMemo(
    () => (compareEnabled ? buildCompareResult(linePoints, activeBaseIntervalId) : null),
    [activeBaseIntervalId, compareEnabled, linePoints],
  );
  const selectedLinePoint = useMemo(
    () => linePoints.find((point) => point.intervalId === selectedIntervalId) ?? linePoints[linePoints.length - 1] ?? null,
    [linePoints, selectedIntervalId],
  );

  const pieData = useMemo(
    () => buildMockPieData({ selectedIntervalId, filters: filterScope }),
    [filterScope, selectedIntervalId],
  );
  const pieDataCumulative = useMemo(
    () =>
      buildMockPieCumulativeData({
        intervalIds: intervals.map((interval) => interval.id),
        filters: filterScope,
      }),
    [filterScope, intervals],
  );

  const regionOptions = useMemo(() => {
    const unique = new Set(markets.map((market) => market.region).filter(Boolean));
    return Array.from(unique).sort((left, right) => left.localeCompare(right, "de"));
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
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Erste Key Card
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
            IPP Auswertung
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.38)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            This intervals IPP
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#059669", lineHeight: 1.05 }}>
            {selectedLinePoint ? selectedLinePoint.value.toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>{getIntervalDisplayRange(selectedInterval)}</div>
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
          <div style={{ borderRadius: 9, border: "1px solid rgba(185,28,28,0.26)", background: "rgba(185,28,28,0.08)", color: "#991b1b", padding: "8px 10px", fontSize: 11, fontWeight: 700 }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textAlign: "center", paddingBottom: 4 }}>
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
