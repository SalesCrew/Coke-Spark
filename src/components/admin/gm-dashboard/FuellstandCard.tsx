"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGmUsers, fetchMarkets } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import {
  buildIntervals,
  findIntervalById,
  getIntervalDisplayRange,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
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
import { formatAvailabilityLabel } from "@/lib/availabilityLabels";
import {
  buildDoneProgress,
  buildFuellstandSeries,
  type FuellstandFilterScope,
  type FuellstandTypeKey,
} from "@/lib/fuellstand-dashboard/mock-data";

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

function formatMarketLabel(name: string, address?: string | null, postalCode?: string | null, city?: string | null): string {
  const displayName = address?.trim() || name.trim();
  const plzOrt = [postalCode?.trim(), city?.trim()].filter((part): part is string => Boolean(part && part.length > 0)).join(" ");
  if (displayName && plzOrt) return `${displayName} · ${plzOrt}`;
  return displayName || plzOrt || "Unbekannter Markt";
}

function buildMarketSearchText(market: {
  name?: string | null;
  dbName?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  emEh?: string | null;
  currentGmName?: string | null;
}): string {
  return [
    market.name,
    market.dbName,
    market.address,
    market.postalCode,
    market.city,
    market.region,
    market.emEh,
    market.currentGmName,
  ]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(" ");
}

export function FuellstandCard() {
  const { calendar, loadCalendar } = useRedMonth();
  const [markets, setMarkets] = useState<IppMarketOption[]>([]);
  const [gms, setGms] = useState<IppGmOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [intervalMode, setIntervalMode] = useState<IntervalMode>("redmonth");
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(null);
  const [highlightedTypeKey, setHighlightedTypeKey] = useState<FuellstandTypeKey | null>(null);
  const [filters, setFilters] = useState<IppFilterState>({
    region: null,
    gmId: null,
    chain: null,
    marketId: null,
    stc: null,
  });

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
              label: formatMarketLabel(market.name, market.address, market.postalCode, market.city),
              region: market.region || "Unbekannt",
              gmName: market.currentGmName || "",
              chain: deriveChainFromMarketName(market.name),
              searchText: buildMarketSearchText(market),
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

  const selectedInterval = findIntervalById(intervals, selectedIntervalId);
  const regionOptions = useMemo(() => {
    const unique = new Set(markets.map((market) => market.region).filter(Boolean));
    return Array.from(unique).sort((left, right) => left.localeCompare(right, "de"));
  }, [markets]);

  const filterScope: FuellstandFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
    marketId: filters.marketId,
    stc: filters.stc,
  };

  const series = useMemo(
    () =>
      buildFuellstandSeries({
        intervals,
        filters: filterScope,
      }),
    [filterScope, intervals],
  );

  const doneProgress = useMemo(
    () =>
      buildDoneProgress({
        selectedIntervalId,
        filters: filterScope,
      }),
    [filterScope, selectedIntervalId],
  );
  const distributionSeries = useMemo(
    () =>
      series.map((entry) => {
        let vollCount: number;
        let mittelCount: number;
        let leerCount: number;
        if (highlightedTypeKey) {
          const counts = entry.typeCounts[highlightedTypeKey];
          vollCount = counts.voll;
          mittelCount = counts.mittel;
          leerCount = counts.leer;
        } else {
          vollCount = 0;
          mittelCount = 0;
          leerCount = 0;
          FUELLSTAND_TYPE_CONFIG.forEach((typeOption) => {
            const counts = entry.typeCounts[typeOption.key];
            vollCount += counts.voll;
            mittelCount += counts.mittel;
            leerCount += counts.leer;
          });
        }
        const totalCount = Math.max(1, vollCount + mittelCount + leerCount);
        return {
          intervalId: entry.intervalId,
          label: entry.label,
          shortLabel: entry.shortLabel,
          vollPct: Math.round((vollCount / totalCount) * 1000) / 10,
          mittelPct: Math.round((mittelCount / totalCount) * 1000) / 10,
          leerPct: Math.round((leerCount / totalCount) * 1000) / 10,
          vollCount,
          mittelCount,
          leerCount,
          totalCount,
        };
      }),
    [highlightedTypeKey, series],
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
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Kühler- und Füllstand auswerten.
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              Füllstand Auswertung
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.42)", marginTop: 2 }}>
              {formatAvailabilityLabel("Voll")} · {formatAvailabilityLabel("Mittel")} · {formatAvailabilityLabel("Leer")} zwischen 0% und 100% pro Intervall
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Fokus Intervall
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{selectedInterval?.label ?? "—"}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>{getIntervalDisplayRange(selectedInterval)}</div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.58)" }}>Kühlerstand</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.48)" }}>
              {doneProgress.doneCount}/{doneProgress.totalCount} erledigt
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "rgba(0,0,0,0.045)", overflow: "hidden" }}>
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
          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.45)" }}>
            {doneProgress.donePercent}% done · {doneProgress.openCount} offen
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
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingRight: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
                  Chart
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
                  Füllstand Trends
                </div>
              </div>
              <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                {FUELLSTAND_TYPE_CONFIG.map((typeOption) => (
                  <button
                    key={typeOption.key}
                    type="button"
                    onClick={() => {
                      setHighlightedTypeKey((current) => (current === typeOption.key ? null : typeOption.key));
                    }}
                    aria-pressed={highlightedTypeKey === typeOption.key}
                    style={{
                      height: 20,
                      padding: "0 8px",
                      borderRadius: 999,
                      border: `1px solid ${typeOption.pillBorder}`,
                      background: typeOption.pillBackground,
                      opacity: highlightedTypeKey === typeOption.key ? 1 : 0.48,
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
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(0,0,0,0.58)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                  Score
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.52)" }}>
                  {formatAvailabilityLabel("Voll")} 100 · {formatAvailabilityLabel("Mittel")} 50 · {formatAvailabilityLabel("Leer")} 0
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textAlign: "center", paddingBottom: 4 }}>
            Filterquellen werden geladen...
          </div>
        )}
      </div>
    </section>
  );
}
