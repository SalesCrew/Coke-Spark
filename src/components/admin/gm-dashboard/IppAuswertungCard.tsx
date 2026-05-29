"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGmUsers, fetchMarkets } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import { IppChartPanel, type IppChartMode } from "@/components/admin/gm-dashboard/IppChartPanel";
import {
  buildIntervals,
  findIntervalById,
  findPreviousIntervalId,
  findPreviousYearIntervalId,
  findQuarterPairIntervalId,
  getIntervalDisplayRange,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
import {
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
import { IppOverlapControls, type ComparePreset } from "@/components/admin/gm-dashboard/IppOverlapControls";

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

  const [chartMode, setChartMode] = useState<IppChartMode>("line");
  const [intervalMode, setIntervalMode] = useState<IntervalMode>("redmonth");
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(null);

  const [filters, setFilters] = useState<IppFilterState>({
    region: null,
    gmId: null,
    chain: null,
    stc: null,
  });

  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePreset, setComparePreset] = useState<ComparePreset>("previous");
  const [customCompareIntervalId, setCustomCompareIntervalId] = useState<string | null>(null);

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
        count: intervalMode === "week" ? 20 : 16,
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

  const selectedInterval = findIntervalById(intervals, selectedIntervalId);
  const customCandidateIntervals = intervals.filter((interval) => interval.id !== selectedIntervalId);

  const compareIntervalId = useMemo(() => {
    if (!compareEnabled) return null;
    if (comparePreset === "previous") {
      return findPreviousIntervalId(intervals, selectedIntervalId);
    }
    if (comparePreset === "previous_year") {
      return findPreviousYearIntervalId(intervals, selectedIntervalId) ?? findPreviousIntervalId(intervals, selectedIntervalId);
    }
    if (comparePreset === "q4_vs_q2") {
      return findQuarterPairIntervalId(intervals, selectedIntervalId) ?? findPreviousIntervalId(intervals, selectedIntervalId);
    }
    return customCompareIntervalId;
  }, [compareEnabled, comparePreset, customCompareIntervalId, intervals, selectedIntervalId]);

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
    () => (compareEnabled ? buildCompareResult(linePoints, selectedIntervalId) : null),
    [compareEnabled, linePoints, selectedIntervalId],
  );

  const pieData = useMemo(
    () => buildMockPieData({ selectedIntervalId, filters: filterScope }),
    [filterScope, selectedIntervalId],
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
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            IPP Auswertung
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.42)", marginTop: 2 }}>
            Stabiler Trend zwischen 5.0 und 7.0 · Filter + Intervall + Overlap
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Fokus Intervall
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{selectedInterval?.label ?? "—"}</div>
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
          onSelectInterval={setSelectedIntervalId}
        />

        <IppOverlapControls
          mode={intervalMode}
          enabled={compareEnabled}
          onEnabledChange={setCompareEnabled}
          preset={comparePreset}
          onPresetChange={setComparePreset}
          customIntervalId={customCompareIntervalId}
          onCustomIntervalIdChange={setCustomCompareIntervalId}
          availableCustomIntervals={customCandidateIntervals}
          resolvedCompareLabel={compareLabel}
        />

        <IppChartPanel
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          linePoints={linePoints}
          selectedIntervalId={selectedIntervalId}
          onSelectInterval={setSelectedIntervalId}
          compareEnabled={compareEnabled}
          compareResult={compareResult}
          pieSlices={pieData.slices}
          pieTotal={pieData.total}
        />

        {loading && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textAlign: "center", paddingBottom: 4 }}>
            Filterquellen werden geladen...
          </div>
        )}
      </div>
    </section>
  );
}
