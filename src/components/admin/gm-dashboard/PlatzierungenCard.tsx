"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardData, useDashboardFacets } from "./RealGmDashboard";
import { calendarToday } from "@/lib/gm-dashboard/data";
import { useRedMonth } from "@/context/RedMonthContext";
import {
  findIntervalById,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
import { buildDashboardIntervals } from "@/lib/gm-dashboard/date-range";
import {
  IppFilterBar,
  type IppFilterState,
  type IppGmOption,
  type IppMarketOption,
} from "@/components/admin/gm-dashboard/IppFilterBar";
import { IppIntervalToolbar } from "@/components/admin/gm-dashboard/IppIntervalToolbar";
import { placementSeries } from "@/lib/gm-dashboard/chart-adapters";
import { PlatzierungenBarChart } from "@/components/admin/gm-dashboard/charts/PlatzierungenBarChart";
import { type PlatzierungenFilterScope } from "@/lib/platzierungen-dashboard/mock-data";

export function PlatzierungenCard() {
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

  const selectedInterval = findIntervalById(intervals, selectedIntervalId);
  const regionOptions = useMemo(() => {
    const unique = new Set(
      markets.map((market) => market.region).filter(Boolean),
    );
    return Array.from(unique).sort((left, right) =>
      left.localeCompare(right, "de"),
    );
  }, [markets]);

  const filterScope: PlatzierungenFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
    chains: filters.chains,
    chainGroups: filters.chainGroups,
    marketId: filters.marketId,
    marketIds: filters.marketIds,
    stc: filters.stc,
  };

  const result = useDashboardData(
    "Platzierungen",
    intervals,
    filterScope,
    selectedIntervalId,
  );
  const loading = facets.loading || result.loading;
  const loadError =
    facets.error ??
    result.error ??
    (intervalMode === "redmonth" ? calendarError : null);
  const series = useMemo(
    () => placementSeries(result.data?.points ?? []),
    [result.data],
  );

  const selectedPoint = useMemo(
    () =>
      series.find((point) => point.intervalId === selectedIntervalId) ??
      series[series.length - 1] ??
      null,
    [selectedIntervalId, series],
  );

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
        minHeight: 360,
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
            Platzierungen
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
            }}
          >
            Coke Platzierungen vs Mitbewerber Platzierungen
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(0,0,0,0.42)",
              marginTop: 2,
            }}
          >
            Kompakter Vergleich pro Intervall
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(0,0,0,0.34)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Fokus Intervall
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
            {selectedInterval?.label ?? "—"}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(0,0,0,0.46)",
              marginTop: 1,
            }}
          >
            {selectedPoint
              ? `Coke ${Number.isFinite(selectedPoint.coke) ? selectedPoint.coke.toFixed(1) : "—"} · Mitbewerber ${Number.isFinite(selectedPoint.competitor) ? selectedPoint.competitor.toFixed(1) : "—"}`
              : "—"}
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
          compact
        />

        <IppIntervalToolbar
          mode={intervalMode}
          onModeChange={setIntervalMode}
          intervals={intervals}
          selectedIntervalId={selectedIntervalId}
          onSelectInterval={setSelectedIntervalId}
        />

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
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "rgba(0,0,0,0.35)",
                  textTransform: "uppercase",
                }}
              >
                Chart
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
                Platzierungen Vergleich
              </div>
            </div>
            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background:
                    "linear-gradient(to bottom,#ef4444,#dc2626,#b91c1c)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.55)",
                }}
              >
                Coke
              </span>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: "#9CA3AF",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.55)",
                }}
              >
                Mitbewerber
              </span>
            </div>
          </div>
          <div style={{ padding: "10px 10px 8px" }}>
            <PlatzierungenBarChart
              points={series}
              selectedIntervalId={selectedIntervalId}
              onSelectInterval={setSelectedIntervalId}
            />
          </div>
        </section>

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
    </section>
  );
}
