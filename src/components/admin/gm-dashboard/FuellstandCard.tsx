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
import {
  buildDoneProgress,
  buildFuellstandSeries,
  type FuellstandFilterScope,
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

export function FuellstandCard() {
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

  const filterScope: FuellstandFilterScope = {
    region: filters.region,
    gmId: filters.gmId,
    chain: filters.chain,
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
              Zweite Key Card
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              Füllstand Auswertung
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.42)", marginTop: 2 }}>
              Voll · Mittel · Leer zwischen 0% und 100% pro Intervall
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
                Füllstand Trends
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0B0B0B", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>Voll</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4B5563", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>Mittel</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9CA3AF", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>Leer</span>
            </div>
          </div>
          <div style={{ padding: "10px 10px 8px" }}>
            <FuellstandLineChart
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
