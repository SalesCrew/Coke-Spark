"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { IppMiniDropdown } from "@/components/admin/gm-dashboard/IppMiniDropdown";
import { requestPraemienWorkspace } from "@/lib/api/backend";
import type { Workspace, WaveInfo } from "@/types/praemien-workspace";
import { useDashboardFacets } from "./RealGmDashboard";
import { calendarToday } from "@/lib/gm-dashboard/data";
import { bonusEmptyState } from "@/lib/gm-dashboard/bonus-empty-state";
import { BonusEmptyState } from "./BonusEmptyState";

const euro = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ringSegmentPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(radians) * radius,
      y: cy + Math.sin(radians) * radius,
    };
  };
  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);
  const innerEnd = point(innerRadius, endAngle);
  const innerStart = point(innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
}

export function BonusOverviewCard({
  onSnapshot,
}: {
  onSnapshot?: (value: Workspace | null) => void;
}) {
  const [waves, setWaves] = useState<WaveInfo[]>([]),
    [waveId, setWaveId] = useState<string | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [error, setError] = useState<string | null>(null),
    [loadingWaves, setLoadingWaves] = useState(true),
    [loadingWorkspace, setLoadingWorkspace] = useState(false),
    [ready, setReady] = useState<boolean | null>(null),
    [reloadKey, setReloadKey] = useState(0);
  const loading = loadingWaves || loadingWorkspace;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const facets = useDashboardFacets();
  useEffect(() => {
    let cancelled = false;
    setLoadingWaves(true);
    setError(null);
    setReady(null);
    setWaves([]);
    setWaveId(null);
    setWorkspace(null);
    void requestPraemienWorkspace<{ ready: boolean }>("/status")
      .then((status) => {
        if (cancelled) return null;
        setReady(status.ready);
        if (!status.ready) return null;
        return requestPraemienWorkspace<{ waves: WaveInfo[] }>("/waves");
      })
      .then((data) => {
        if (cancelled || !data) return;
        setWaves(data.waves);
        const today = calendarToday();
        setWaveId(
          data.waves.find(
            (w) =>
              w.startDate <= today &&
              w.endDate >= today &&
              w.status === "active",
          )?.id ??
            data.waves[0]?.id ??
            null,
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Prämien konnten nicht geladen werden.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWaves(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  useEffect(() => {
    let cancelled = false;
    setWorkspace(null);
    onSnapshot?.(null);
    setLoadingWorkspace(Boolean(waveId));
    if (!waveId) return;
    setError(null);
    void requestPraemienWorkspace<Workspace>(
      `/waves/${encodeURIComponent(waveId)}`,
    )
      .then((data) => {
        if (!cancelled) setWorkspace(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Prämien konnten nicht geladen werden.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkspace(false);
      });
    return () => {
      cancelled = true;
    };
  }, [waveId, onSnapshot]);
  useEffect(() => {
    onSnapshot?.(workspace);
  }, [workspace, onSnapshot]);
  const waveDropdown = (
    <IppMiniDropdown
      label="Prämienwelle"
      value={waveId}
      placeholder="Welle wählen"
      options={waves.map((w) => ({
        value: w.id,
        label: `Q${w.quarter} ${w.year} · ${w.name}`,
      }))}
      minWidth={220}
      onChange={setWaveId}
    />
  );
  const gm =
    workspace?.results.find((row) => row.gmId === selectedId) ??
    workspace?.results.find((row) => row.active) ??
    workspace?.results[0];
  const selected = gm
    ? {
        id: gm.gmId,
        name: gm.name,
        earnedEur: gm.earned,
        maxEur: gm.maximum,
        goals: gm.pillars.map((p) => ({
          id: p.key,
          name: p.name,
          earnedEur: p.earned,
          maxEur: p.maximum,
          pending: p.pending,
        })),
      }
    : {
        id: selectedId,
        name: facets.gms.find((g) => g.id === selectedId)?.label ?? "GM wählen",
        earnedEur: 0,
        maxEur: 0,
        goals: [],
      };
  const gmOptions = workspace
    ? workspace.results.map((row) => ({
        value: row.gmId,
        label: row.name + (row.active ? "" : " (inaktiv)"),
      }))
    : facets.gms.map((g) => ({ value: g.id, label: g.label }));
  const emptyState = bonusEmptyState({
    loading,
    ready,
    error,
    waveCount: waves.length,
    waveSelected: Boolean(waveId),
    workspaceLoaded: Boolean(workspace),
    hasParticipant: Boolean(gm),
    goalCount: gm?.pillars.length ?? 0,
  });
  const retry = () => setReloadKey((key) => key + 1);
  const available = emptyState === null;
  const status =
    emptyState?.status ??
    (workspace?.closedAt
      ? "Abgeschlossen"
      : workspace?.wave.status === "draft"
        ? "Entwurf · Vorschau"
        : "Laufende Berechnung");
  const percent =
    selected.maxEur > 0
      ? Math.round((selected.earnedEur / selected.maxEur) * 100)
      : 0;
  const remainingEur = selected.maxEur - selected.earnedEur;
  const maxGoalEur = Math.max(1, ...selected.goals.map((goal) => goal.maxEur));
  const ringEndAngle = -90 + Math.min(percent * 3.6, 359.99);

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
      }}
    >
      <header
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 12,
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: "rgba(220,38,38,0.07)",
              color: "#c5262b",
            }}
          >
            <Award size={17} />
          </span>
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
              Boni Auswertung
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: "-0.02em",
                }}
              >
                Dashboard-Boni
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#6b7280",
                  background: "rgba(0,0,0,0.035)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 6,
                  padding: "2px 6px",
                }}
              >
                {status}
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {waveDropdown}
          <IppMiniDropdown
            label="GM"
            value={selected.id}
            placeholder="GM wählen"
            options={gmOptions}
            minWidth={180}
            onChange={setSelectedId}
          />
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
          gap: 10,
        }}
      >
        <section
          style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 12,
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "11px 14px",
              background: "rgba(0,0,0,0.015)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.35)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Chart
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                Bonus nach Kategorie
              </div>
            </div>
            {available && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 10,
                  color: "#6b7280",
                }}
              >
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      marginRight: 5,
                      borderRadius: 3,
                      background: "rgba(220,38,38,0.34)",
                      border: "1px solid rgba(220,38,38,0.82)",
                    }}
                  />
                  Erreicht
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      marginRight: 5,
                      borderRadius: 3,
                      background: "rgba(220,38,38,0.06)",
                      border: "1px solid rgba(220,38,38,0.32)",
                    }}
                  />
                  Ziel
                </span>
              </div>
            )}
          </div>
          {emptyState ? (
            <BonusEmptyState
              state={emptyState}
              kind="categories"
              onRetry={retry}
            />
          ) : (
            <>
              <div style={{ padding: "14px 18px 9px" }}>
                <svg
                  viewBox={`0 0 ${Math.max(680, selected.goals.length * 150 + 80)} 245`}
                  role="img"
                  aria-label={`Bonus nach Kategorie für ${selected.name}`}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    maxHeight: 260,
                    fontFamily: "inherit",
                  }}
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = 187 - step * 150;
                    return (
                      <g key={step}>
                        <line
                          x1="49"
                          x2="660"
                          y1={y}
                          y2={y}
                          stroke="#e9ebef"
                          strokeDasharray={step === 0 ? undefined : "3 5"}
                        />
                        <text
                          x="37"
                          y={y + 3}
                          textAnchor="end"
                          fontSize="10"
                          fill="#9ca3af"
                        >
                          {available ? Math.round(step * maxGoalEur) : "—"}
                        </text>
                      </g>
                    );
                  })}
                  {selected.goals.map((goal, index) => {
                    const x = 112 + index * 150;
                    const targetHeight = available
                      ? (goal.maxEur / maxGoalEur) * 150
                      : 150;
                    const earnedHeight =
                      goal.maxEur > 0
                        ? (goal.earnedEur / goal.maxEur) * (targetHeight - 6)
                        : 0;
                    return (
                      <g key={goal.id}>
                        <title>
                          {available
                            ? `${goal.name}: ${available ? euro.format(goal.earnedEur) : "—"} von ${available ? euro.format(goal.maxEur) : "—"}`
                            : `${goal.name}: noch keine Werte`}
                        </title>
                        <rect
                          x={x}
                          y={187 - targetHeight}
                          width="45"
                          height={targetHeight}
                          rx="5"
                          fill="rgba(220,38,38,0.06)"
                          stroke="rgba(220,38,38,0.32)"
                          strokeWidth={1.5}
                        />
                        {earnedHeight > 0 && (
                          <rect
                            x={x + 3}
                            y={184 - earnedHeight}
                            width="39"
                            height={earnedHeight}
                            rx="4"
                            fill="rgba(220,38,38,0.34)"
                            stroke="rgba(220,38,38,0.82)"
                            strokeWidth={1.5}
                          />
                        )}
                        <text
                          x={x + 22.5}
                          y={177 - targetHeight}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#374151"
                        >
                          {available ? euro.format(goal.earnedEur) : "—"}
                        </text>
                        <text
                          x={x + 22.5}
                          y="207"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="600"
                          fill="#374151"
                        >
                          {goal.name}
                        </text>
                        <text
                          x={x + 22.5}
                          y="224"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#9ca3af"
                        >
                          von {available ? euro.format(goal.maxEur) : "—"}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              {selected.goals.some((goal) => goal.pending) && (
                <div
                  style={{
                    padding: "0 18px 14px",
                    fontSize: 10,
                    color: "#9a6700",
                  }}
                >
                  {selected.goals
                    .filter((goal) => goal.pending)
                    .map((goal) => goal.name)
                    .join(", ")}
                  : Bewertung ausstehend
                </div>
              )}
            </>
          )}
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 12,
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "11px 14px",
              background: "rgba(0,0,0,0.015)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(0,0,0,0.35)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Verteilung
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              Bonusziel{available ? ` · ${selected.name}` : ""}
            </div>
          </div>
          {emptyState ? (
            <BonusEmptyState state={emptyState} kind="goal" onRetry={retry} />
          ) : (
            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 28,
                flexWrap: "wrap",
                minHeight: 236,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 174,
                  height: 174,
                  flex: "0 0 auto",
                }}
              >
                <svg
                  viewBox="0 0 174 174"
                  role="img"
                  aria-label={`${percent}% des Bonusziels erreicht`}
                  style={{
                    width: "100%",
                    height: "100%",
                    fontFamily: "inherit",
                  }}
                >
                  <path
                    d={ringSegmentPath(87, 87, 69, 54, -90, 269.99)}
                    fill="rgba(220,38,38,0.06)"
                    stroke="rgba(220,38,38,0.32)"
                    strokeWidth={1.5}
                  />
                  {percent > 0 && (
                    <path
                      d={ringSegmentPath(87, 87, 66, 57, -90, ringEndAngle)}
                      fill="rgba(220,38,38,0.34)"
                      stroke="rgba(220,38,38,0.82)"
                      strokeWidth={1.5}
                    />
                  )}
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: "#b91c1c",
                      lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {available ? percent + "%" : "—"}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#9ca3af",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Erreicht
                  </span>
                </div>
              </div>
              <div style={{ minWidth: 170, flex: "1 1 170px", maxWidth: 260 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(0,0,0,0.35)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Aktueller Bonus
                </div>
                <div
                  style={{
                    fontSize: 29,
                    fontWeight: 800,
                    color: "#111827",
                    letterSpacing: "-0.03em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {available ? euro.format(selected.earnedEur) : "—"}
                </div>
                <div
                  style={{ height: 1, background: "#eceef1", margin: "12px 0" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  <span>Bonusziel</span>
                  <strong style={{ color: "#374151" }}>
                    {available ? euro.format(selected.maxEur) : "—"}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11,
                    color: "#6b7280",
                    marginTop: 8,
                  }}
                >
                  <span>Noch offen</span>
                  <strong style={{ color: "#374151" }}>
                    {available ? euro.format(remainingEur) : "—"}
                  </strong>
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 14 }}>
                  {status}
                  {workspace
                    ? ` · ${workspace.wave.startDate} – ${workspace.wave.endDate}`
                    : ""}
                  {gm?.pending ? " · Bewertungen ausstehend" : ""}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
