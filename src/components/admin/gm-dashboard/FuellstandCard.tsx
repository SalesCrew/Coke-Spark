"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardData, useDashboardFacets } from "./RealGmDashboard";
import { calendarToday } from "@/lib/gm-dashboard/data";
import { useRedMonth } from "@/context/RedMonthContext";
import {
  findIntervalById,
  getIntervalDisplayRange,
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
import { FuellstandLineChart } from "@/components/admin/gm-dashboard/charts/FuellstandLineChart";
import { FuellstandDistributionChart } from "@/components/admin/gm-dashboard/charts/FuellstandDistributionChart";
import { FUELLSTAND_TYPE_CONFIG } from "@/components/admin/gm-dashboard/fuellstand-type-config";
import {
  availabilitySeries,
  availabilityDistribution,
  inventoryProgress,
  availabilityKeys,
} from "@/lib/gm-dashboard/chart-adapters";
import { formatAvailabilityLabel } from "@/lib/availabilityLabels";
import {
  type FuellstandFilterScope,
  type FuellstandTypeKey,
} from "@/lib/fuellstand-dashboard/mock-data";

export function FuellstandCard() {
  const { calendar, error: calendarError } = useRedMonth();
  const facets = useDashboardFacets();
  const { markets, gms } = facets;
  const [intervalMode, setIntervalMode] = useState<IntervalMode>("redmonth");
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(
    null,
  );
  const [highlightedTypeKey, setHighlightedTypeKey] =
    useState<FuellstandTypeKey | null>(null);
  const [inventoryFilters, setInventoryFilters] = useState<IppFilterState>({
    region: null,
    gmId: null,
    chain: null,
    marketId: null,
    stc: null,
  });
  const [chartFilters, setChartFilters] = useState<IppFilterState>({
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

  const inventoryFilterScope = useMemo<FuellstandFilterScope>(
    () => ({
      region: inventoryFilters.region,
      gmId: inventoryFilters.gmId,
      chain: inventoryFilters.chain,
      marketId: inventoryFilters.marketId,
      stc: inventoryFilters.stc,
    }),
    [
      inventoryFilters.chain,
      inventoryFilters.gmId,
      inventoryFilters.marketId,
      inventoryFilters.region,
      inventoryFilters.stc,
    ],
  );

  const chartFilterScope = useMemo<FuellstandFilterScope>(
    () => ({
      region: chartFilters.region,
      gmId: chartFilters.gmId,
      chain: chartFilters.chain,
      marketId: chartFilters.marketId,
      stc: chartFilters.stc,
    }),
    [
      chartFilters.chain,
      chartFilters.gmId,
      chartFilters.marketId,
      chartFilters.region,
      chartFilters.stc,
    ],
  );

  const chartResult = useDashboardData(
    "Fuellstand",
    intervals,
    chartFilterScope,
    selectedIntervalId,
    highlightedTypeKey ? availabilityKeys[highlightedTypeKey] : null,
  );
  const inventoryResult = useDashboardData(
    "Kühlerinventur",
    intervals,
    inventoryFilterScope,
    selectedIntervalId,
  );
  const loading =
    facets.loading || chartResult.loading || inventoryResult.loading;
  const loadError =
    facets.error ??
    chartResult.error ??
    inventoryResult.error ??
    (intervalMode === "redmonth" ? calendarError : null);
  const series = useMemo(
    () => availabilitySeries(chartResult.data?.points ?? []),
    [chartResult.data],
  );
  const doneProgress = inventoryProgress(
    inventoryResult.data?.points.find((p) => p.id === selectedIntervalId),
  );
  const distributionSeries = useMemo(
    () => availabilityDistribution(series, highlightedTypeKey),
    [series, highlightedTypeKey],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <section
        style={{
          background: "rgba(0,0,0,0.025)",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.07)",
          padding: 10,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px,0.48fr) minmax(0,2.35fr) minmax(130px,max-content)",
              alignItems: "start",
              justifyContent: "stretch",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.36)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Kühler- und Füllstand auswerten.
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: "-0.02em",
                }}
              >
                Kühlerinventur
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.42)",
                  marginTop: 2,
                }}
              >
                {formatAvailabilityLabel("Voll")} ·{" "}
                {formatAvailabilityLabel("Mittel")} ·{" "}
                {formatAvailabilityLabel("Leer")} zwischen 0% und 100% pro
                Intervall
              </div>
            </div>
            <div
              style={{
                minWidth: 0,
                width: "100%",
                alignSelf: "center",
                paddingTop: 2,
              }}
            >
              <IppFilterBar
                filters={inventoryFilters}
                regions={regionOptions}
                gms={gms}
                markets={markets}
                onChange={setInventoryFilters}
                compact
              />
            </div>
            <div style={{ textAlign: "right", minWidth: 120 }}>
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
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.4)",
                }}
              >
                {getIntervalDisplayRange(selectedInterval)}
              </div>
            </div>
          </div>

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

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.58)",
                }}
              >
                Kühlerstand
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.48)",
                }}
              >
                {doneProgress.doneCount}/{doneProgress.totalCount} erledigt
              </span>
            </div>
            <div
              style={{
                height: 7,
                borderRadius: 4,
                background: "rgba(0,0,0,0.045)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${doneProgress.donePercent}%`,
                  height: "100%",
                  borderRadius: 4,
                  background: "linear-gradient(to right,#FDE047,#F59E0B)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                  transition: "width 0.18s ease",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(0,0,0,0.45)",
              }}
            >
              {doneProgress.donePercent}% done · {doneProgress.openCount} offen
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "rgba(0,0,0,0.025)",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.07)",
          padding: "13px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0 2px 2px",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
            }}
          >
            Verfügbarkeitsabfrage
          </div>
        </div>

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
            filters={chartFilters}
            regions={regionOptions}
            gms={gms}
            markets={markets}
            onChange={setChartFilters}
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
              overflow: "visible",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(360px,440px)",
                alignItems: "stretch",
                gap: 0,
                padding: "10px 10px",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                background: "rgba(0,0,0,0.015)",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingRight: 10,
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
                  <div
                    style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}
                  >
                    Verfügbarkeit
                  </div>
                </div>
                <div
                  style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}
                >
                  {FUELLSTAND_TYPE_CONFIG.map((typeOption) => (
                    <button
                      key={typeOption.key}
                      type="button"
                      onClick={() => {
                        setHighlightedTypeKey((current) =>
                          current === typeOption.key ? null : typeOption.key,
                        );
                      }}
                      aria-pressed={highlightedTypeKey === typeOption.key}
                      style={{
                        height: 20,
                        padding: "0 8px",
                        borderRadius: 999,
                        border: `1px solid ${typeOption.pillBorder}`,
                        background: typeOption.pillBackground,
                        opacity:
                          highlightedTypeKey === typeOption.key ? 1 : 0.48,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: typeOption.pillText,
                        letterSpacing: "0.01em",
                        cursor: "pointer",
                        appearance: "none",
                        outline: "none",
                      }}
                    >
                      {typeOption.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  minWidth: 0,
                  borderLeft: "1px solid rgba(0,0,0,0.07)",
                  paddingLeft: 10,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "rgba(0,0,0,0.58)",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    Score
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "rgba(0,0,0,0.52)",
                    }}
                  >
                    {formatAvailabilityLabel("Voll")} 100 ·{" "}
                    {formatAvailabilityLabel("Mittel")} 50 ·{" "}
                    {formatAvailabilityLabel("Leer")} 0
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "10px 10px 8px",
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(360px,440px)",
                gap: 0,
                alignItems: "stretch",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <FuellstandLineChart
                  points={series}
                  selectedIntervalId={selectedIntervalId}
                  onSelectInterval={setSelectedIntervalId}
                  highlightedTypeKey={highlightedTypeKey}
                />
              </div>
              <div
                style={{
                  borderLeft: "1px solid rgba(0,0,0,0.07)",
                  paddingLeft: 10,
                  minWidth: 0,
                }}
              >
                <FuellstandDistributionChart
                  points={distributionSeries}
                  selectedIntervalId={selectedIntervalId}
                  onSelectInterval={setSelectedIntervalId}
                  highlightedTypeKey={highlightedTypeKey}
                />
              </div>
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
    </div>
  );
}
