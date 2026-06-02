"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGmUsers, fetchMarkets } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import {
  buildIntervals,
  findIntervalById,
  type IntervalMode,
} from "@/lib/ipp-dashboard/intervals";
import {
  IppFilterBar,
  type IppFilterState,
  type IppGmOption,
  type IppMarketOption,
} from "@/components/admin/gm-dashboard/IppFilterBar";
import { IppIntervalToolbar } from "@/components/admin/gm-dashboard/IppIntervalToolbar";
import { PlatzierungenBarChart } from "@/components/admin/gm-dashboard/charts/PlatzierungenBarChart";
import {
  buildPlatzierungenSeries,
  type PlatzierungenFilterScope,
} from "@/lib/platzierungen-dashboard/mock-data";

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

export function PlatzierungenCard() {
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

  const selectedInterval = findIntervalById(intervals, selectedIntervalId);
  const regionOptions = useMemo(() => {
    const unique = new Set(markets.map((market) => market.region).filter(Boolean));
    return Array.from(unique).sort((left, right) => left.localeCompare(right, "de"));
  }, [markets]);

  const filterScope: PlatzierungenFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
    stc: filters.stc,
  };

  const series = useMemo(
    () =>
      buildPlatzierungenSeries({
        intervals,
        filters: filterScope,
      }),
    [filterScope, intervals],
  );

  const selectedPoint = useMemo(
    () => series.find((point) => point.intervalId === selectedIntervalId) ?? series[series.length - 1] ?? null,
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
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Dritte Key Card
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
            Coke Platzierungen vs Mitbewerber Platzierungen
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.42)", marginTop: 2 }}>
            Kompakter Vergleich pro Intervall
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.34)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Fokus Intervall
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{selectedInterval?.label ?? "—"}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.46)", marginTop: 1 }}>
            {selectedPoint ? `Coke ${selectedPoint.coke.toFixed(1)}% · Mitbewerber ${selectedPoint.competitor.toFixed(1)}%` : "—"}
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
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
                Chart
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
                Platzierungen Vergleich
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(to bottom,#ef4444,#dc2626,#b91c1c)", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>Coke</span>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: "#9CA3AF", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>Mitbewerber</span>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.4)", textAlign: "center", paddingBottom: 4 }}>
            Filterquellen werden geladen...
          </div>
        )}
      </div>
    </section>
  );
}
