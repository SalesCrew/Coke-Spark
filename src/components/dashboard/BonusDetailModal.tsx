"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, Award } from "lucide-react";
import type { PraemienGmBonusSummary } from "@/types/praemien";

interface Goal {
  name: string;
  percent: number;
  color: string;
  points?: number;
  maxPoints?: number;
}

// ── Point maxima per pillar (from admin Prämien seed data) ─────────────────
const CATEGORY_MAX_PTS: Record<string, number> = {
  "Schütten/Displays": 13,
  "Distributionsziel": 10,
  "Flexziel":          6,
  "Qualitätsziele":    100,
};
const TOTAL_MAX_PTS = 129; // 13 + 10 + 6 + 100

// Threshold points: 70/80/95% of TOTAL_MAX_PTS
const PT_THRESHOLDS = [
  { minPts: 0,                                         bonus: 0,    label: "ab 0 P",   threshold: "0 P"  },
  { minPts: Math.round(TOTAL_MAX_PTS * 0.70),          bonus: 550,  label: "ab 90 P",  threshold: "90 P" },
  { minPts: Math.round(TOTAL_MAX_PTS * 0.80),          bonus: 880,  label: "ab 103 P", threshold: "103 P"},
  { minPts: Math.round(TOTAL_MAX_PTS * 0.95),          bonus: 1100, label: "ab 123 P", threshold: "123 P"},
];
type PointThresholdNode = typeof PT_THRESHOLDS[number];

// ── % thresholds (legacy) ──────────────────────────────────────────────────
interface Cluster {
  label: string;
  minPct: number;
  maxPct: number | null;
  bonus: number;
}
const CLUSTERS: Cluster[] = [
  { label: "Kein Bonus",   minPct: 0,  maxPct: 69.9, bonus: 0    },
  { label: "50% Bonus",    minPct: 70, maxPct: 79.9, bonus: 550  },
  { label: "80% Bonus",    minPct: 80, maxPct: 94.9, bonus: 880  },
  { label: "Voller Bonus", minPct: 95, maxPct: null,  bonus: 1100 },
];
const FULL_BONUS = 1100;

function getClusterByPct(avg: number): Cluster {
  return [...CLUSTERS].reverse().find((c) => avg >= c.minPct) ?? CLUSTERS[0];
}
function getNextClusterByPct(avg: number): Cluster | null {
  const idx = CLUSTERS.findIndex((c) => avg >= c.minPct && (c.maxPct === null || avg <= c.maxPct));
  if (idx === -1 || idx === CLUSTERS.length - 1) return null;
  return CLUSTERS[idx + 1] ?? null;
}
function getClusterByPts(pts: number) {
  return [...PT_THRESHOLDS].reverse().find((t) => pts >= t.minPts) ?? PT_THRESHOLDS[0];
}
function getNextClusterByPts(pts: number) {
  const idx = PT_THRESHOLDS.findIndex((t) => pts >= t.minPts && (
    t === PT_THRESHOLDS[PT_THRESHOLDS.length - 1] ? true : pts < PT_THRESHOLDS[PT_THRESHOLDS.indexOf(t) + 1].minPts
  ));
  if (idx === -1 || idx === PT_THRESHOLDS.length - 1) return null;
  return PT_THRESHOLDS[idx + 1] ?? null;
}
function getClusterByPtsDynamic(pts: number, thresholds: PointThresholdNode[]) {
  return [...thresholds].reverse().find((t) => pts >= t.minPts) ?? thresholds[0] ?? PT_THRESHOLDS[0];
}
function getNextClusterByPtsDynamic(pts: number, thresholds: PointThresholdNode[]) {
  const idx = thresholds.findIndex((t, index) => pts >= t.minPts && (
    index === thresholds.length - 1 ? true : pts < thresholds[index + 1].minPts
  ));
  if (idx === -1 || idx === thresholds.length - 1) return null;
  return thresholds[idx + 1] ?? null;
}

function clusterColor(bonus: number): string {
  if (bonus === 0)    return "#ef4444";
  if (bonus === 550)  return "#f97316";
  if (bonus === 880)  return "#eab308";
  return "#059669";
}
function categoryColor(percent: number): string {
  if (percent >= 95) return "#22c55e";
  if (percent >= 80) return "#eab308";
  if (percent >= 70) return "#f97316";
  return "#ef4444";
}

interface Props {
  goals: Goal[];
  summary?: PraemienGmBonusSummary | null;
  onClose: () => void;
}

export function BonusDetailModal({ goals, summary, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [showPts, setShowPts] = useState(true); // points mode by default
  const hasActiveWave = summary?.hasActiveWave ?? true;
  const isEmpty = !hasActiveWave || goals.length === 0;
  const pointThresholds: PointThresholdNode[] = (summary?.thresholds?.length ?? 0) > 0
    ? summary!.thresholds
        .map((entry) => ({
          minPts: Math.round(entry.minPoints),
          bonus: Math.round(entry.rewardEur),
          label: `ab ${Math.round(entry.minPoints)} P`,
          threshold: `${Math.round(entry.minPoints)} P`,
        }))
        .sort((left, right) => left.minPts - right.minPts)
    : PT_THRESHOLDS;
  const totalMaxPoints = summary?.totalMaxPoints && summary.totalMaxPoints > 0
    ? Math.round(summary.totalMaxPoints * 10) / 10
    : TOTAL_MAX_PTS;
  const equalCategoryMaxPoints = goals.length > 0
    ? totalMaxPoints / goals.length
    : 0;

  // ── Derived values ─────────────────────────────────────────────────────
  const avg = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.percent, 0) / goals.length)
    : 0;

  // Total current pts across all categories
  const totalPts = summary?.totalPoints ?? goals.reduce((sum, g) => {
    const max = CATEGORY_MAX_PTS[g.name] ?? 10;
    return sum + (g.percent / 100) * max;
  }, 0);
  const totalPtsRounded = Math.round(totalPts * 10) / 10;

  // Current cluster / next cluster
  const currentCluster = showPts ? getClusterByPtsDynamic(totalPtsRounded, pointThresholds) : getClusterByPct(avg);
  const nextCluster = showPts ? getNextClusterByPtsDynamic(totalPtsRounded, pointThresholds) : getNextClusterByPct(avg);
  const earnedBonus = summary?.currentRewardEur ?? currentCluster.bonus;

  const pctToNext  = nextCluster && !showPts
    ? (nextCluster as Cluster).minPct - avg
    : 0;
  const ptsToNext  = nextCluster && showPts
    ? (nextCluster as PointThresholdNode).minPts - totalPtsRounded
    : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const modal = (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        backgroundColor: "rgba(0,0,0,0.18)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 460,
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)",
          overflow: "hidden",
          animation: "bonusModalIn 0.22s cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        <style>{`
          @keyframes bonusModalIn {
            from { opacity: 0; transform: scale(0.95) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "18px 20px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>
              Bonus-Übersicht
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 500, marginTop: 1 }}>
              {(() => {
                if (summary?.year && summary?.quarter && summary.startDate && summary.endDate) {
                  const fmt = (value: string) =>
                    new Date(`${value}T00:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
                  return `Q${summary.quarter} ${summary.year} · ${fmt(summary.startDate)} – ${fmt(summary.endDate)}`;
                }
                const now   = new Date();
                const q     = Math.floor(now.getMonth() / 3);
                const year  = now.getFullYear();
                const starts = [new Date(year,0,1), new Date(year,3,1), new Date(year,6,1), new Date(year,9,1)];
                const ends   = [new Date(year,2,31), new Date(year,5,30), new Date(year,8,30), new Date(year,11,31)];
                const fmt = (d: Date) => d.toLocaleDateString("de-AT", { day:"2-digit", month:"2-digit", year:"numeric" });
                return `Q${q+1} ${year} · ${fmt(starts[q])} – ${fmt(ends[q])}`;
              })()}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Toggle button */}
            <button
              onClick={() => setShowPts(p => !p)}
              style={{
                padding: "5px 11px",
                fontSize: 10, fontWeight: 700,
                borderRadius: 7, border: "none", cursor: "pointer",
                background: showPts ? "rgba(0,0,0,0.06)" : "rgba(5,150,105,0.1)",
                color:      showPts ? "rgba(0,0,0,0.45)" : "#059669",
                letterSpacing: "0.02em",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              {showPts ? "%" : "Punkte"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
                width: 30, height: 30, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={14} color="rgba(0,0,0,0.4)" />
            </button>
          </div>
        </div>

        {isEmpty ? (
          <div style={{ padding: "28px 20px 24px" }}>
            <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.02)", padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
                {hasActiveWave ? "Noch keine Boni-Punkte" : "Kein aktiver Bonus"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
                {hasActiveWave
                  ? "Sobald du Fragen mit Boni-Bewertung beantwortest, erscheint hier dein Fortschritt."
                  : "Sobald eine aktive Prämien-Welle läuft, siehst du hier deinen Bonus-Fortschritt."
                }
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Cluster track */}
            <div style={{ padding: "20px 20px 0" }}>
              <ClusterTrack avg={avg} totalPts={totalPtsRounded} showPts={showPts} pointThresholds={pointThresholds} />
            </div>

        {/* Current bonus pill */}
        <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            flex: 1,
            backgroundColor: "rgba(239,181,78,0.07)",
            border: "1px solid rgba(239,181,78,0.22)",
            borderRadius: 12,
            padding: "13px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.32)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                Dein aktueller Bonus
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{
                  fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em",
                  background: "linear-gradient(135deg, #EFB54E, #FFED96, #FCD94C, #F9F793, #EFB94D)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text", display: "inline-block",
                }}>
                  {earnedBonus}€
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.28)" }}>
                  von {summary?.fullRewardEur ?? FULL_BONUS}€
                </span>
              </div>
            </div>
            <Award size={20} strokeWidth={1.5} color="rgba(239,181,78,0.7)" />
          </div>
        </div>

        {/* Category breakdown */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Kategorien
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.28)", fontVariantNumeric: "tabular-nums" }}>
              {showPts
                ? `${totalPtsRounded.toLocaleString("de-AT")} / ${totalMaxPoints} P`
                : `Ø ${avg}%`
              }
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map((g) => (
              <CategoryRow
                key={g.name}
                goal={g}
                avg={avg}
                showPts={showPts}
                equalCategoryMaxPoints={equalCategoryMaxPoints}
              />
            ))}
          </div>
        </div>

        {/* Improvement hint */}
        <div style={{ padding: "14px 20px 20px" }}>
          {nextCluster ? (
            <div style={{
              backgroundColor: "rgba(0,0,0,0.025)", borderRadius: 12,
              padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: `${clusterColor(nextCluster.bonus)}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <TrendingUp size={14} color={clusterColor(nextCluster.bonus)} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#111", marginBottom: 2 }}>
                  {showPts
                    ? `Noch ${ptsToNext.toLocaleString("de-AT")} Punkte bis zur nächsten Stufe`
                    : `Noch ${pctToNext}% bis zur nächsten Stufe`
                  }
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
                  {showPts ? (
                    <>
                      Erreichst du{" "}
                      <span style={{ fontWeight: 700, color: clusterColor(nextCluster.bonus) }}>
                        {(nextCluster as PointThresholdNode).minPts} Punkte
                      </span>, steigt dein Bonus auf{" "}
                      <span style={{ fontWeight: 700, color: clusterColor(nextCluster.bonus) }}>
                        {nextCluster.bonus}€
                      </span>{" "}
                      (+{nextCluster.bonus - earnedBonus}€).
                    </>
                  ) : (
                    <>
                      Erreichst du{" "}
                      <span style={{ fontWeight: 700, color: clusterColor(nextCluster.bonus) }}>
                        {(nextCluster as Cluster).minPct}%
                      </span>{" "}Durchschnitt, steigt dein Bonus auf{" "}
                      <span style={{ fontWeight: 700, color: clusterColor(nextCluster.bonus) }}>
                        {nextCluster.bonus}€
                      </span>{" "}
                      (+{nextCluster.bonus - earnedBonus}€).
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: "#22c55e0f", border: "1px solid #22c55e22",
              borderRadius: 12, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
                Maximaler Bonus erreicht — ausgezeichnete Arbeit!
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

/* ── Cluster track ── */
function ClusterTrack({ avg, totalPts, showPts, pointThresholds = PT_THRESHOLDS }: { avg: number; totalPts: number; showPts: boolean; pointThresholds?: PointThresholdNode[] }) {
  const GREEN    = "#059669";
  const INACTIVE = "rgba(0,0,0,0.10)";
  const INACTIVE_BG = "#f5f5f7";

  if (showPts) {
    // Points-based track
    const nodes = pointThresholds.map(t => ({
      threshold: t.minPts,
      bonus:     t.bonus,
      label:     `${t.bonus === 0 ? "0€" : t.bonus + "€"}`,
      subLabel:  t.threshold,
    }));
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {nodes.map((n, i) => {
          const reached   = totalPts >= n.threshold;
          const isActive  = reached && (i === nodes.length - 1 ? true : totalPts < nodes[i + 1].threshold);
          const lineReached = i < nodes.length - 1 && totalPts >= nodes[i + 1].threshold;
          return (
            <div key={n.threshold} style={{ display: "flex", alignItems: "center", flex: i < nodes.length - 1 ? "1 1 0" : "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  backgroundColor: reached ? `${GREEN}28` : INACTIVE_BG,
                  border: `2.5px solid ${reached ? GREEN : INACTIVE}`,
                  boxShadow: isActive ? `0 0 0 3px ${GREEN}28, 0 0 10px 2px ${GREEN}28` : reached ? `0 2px 6px ${GREEN}22` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s ease",
                }}>
                  <span style={{ fontSize: n.label.length > 4 ? 10 : 11, fontWeight: 800, color: reached ? GREEN : "rgba(0,0,0,0.22)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {n.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: reached ? GREEN : "rgba(0,0,0,0.28)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                  {n.subLabel}
                </div>
              </div>
              {i < nodes.length - 1 && (
                <div style={{ flex: 1, height: 3, marginTop: 0, marginBottom: 22, marginLeft: 4, marginRight: 4, borderRadius: 2, backgroundColor: lineReached ? GREEN : INACTIVE, transition: "background-color 0.3s ease", position: "relative", overflow: "hidden" }}>
                  {reached && !lineReached && (() => {
                    const segStart = n.threshold;
                    const segEnd   = nodes[i + 1].threshold;
                    const fill     = Math.min(1, Math.max(0, (totalPts - segStart) / (segEnd - segStart)));
                    return <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, backgroundColor: GREEN, borderRadius: 2, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />;
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // % based track (original)
  const nodes = [
    { minPct: 0,  bonus: 0,    label: "0€",    threshold: "ab 0%"  },
    { minPct: 70, bonus: 550,  label: "550€",  threshold: "ab 70%" },
    { minPct: 80, bonus: 880,  label: "880€",  threshold: "ab 80%" },
    { minPct: 95, bonus: 1100, label: "1100€", threshold: "ab 95%" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {nodes.map((n, i) => {
        const reached     = avg >= n.minPct;
        const isActive    = avg >= n.minPct && (i === nodes.length - 1 ? true : avg < nodes[i + 1].minPct);
        const lineReached = i < nodes.length - 1 && avg >= nodes[i + 1].minPct;
        return (
          <div key={n.minPct} style={{ display: "flex", alignItems: "center", flex: i < nodes.length - 1 ? "1 1 0" : "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: reached ? `${GREEN}28` : INACTIVE_BG, border: `2.5px solid ${reached ? GREEN : INACTIVE}`, boxShadow: isActive ? `0 0 0 3px ${GREEN}28, 0 0 10px 2px ${GREEN}28` : reached ? `0 2px 6px ${GREEN}22` : "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease" }}>
                <span style={{ fontSize: n.label.length > 4 ? 10 : 11, fontWeight: 800, color: reached ? GREEN : "rgba(0,0,0,0.22)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{n.label}</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: reached ? GREEN : "rgba(0,0,0,0.28)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{n.threshold}</div>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ flex: 1, height: 3, marginTop: 0, marginBottom: 22, marginLeft: 4, marginRight: 4, borderRadius: 2, backgroundColor: lineReached ? GREEN : INACTIVE, transition: "background-color 0.3s ease", position: "relative", overflow: "hidden" }}>
                {reached && !lineReached && (() => {
                  const segStart = n.minPct;
                  const segEnd   = nodes[i + 1].minPct;
                  const fill     = Math.min(1, Math.max(0, (avg - segStart) / (segEnd - segStart)));
                  return <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, backgroundColor: GREEN, borderRadius: 2, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />;
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Category row ── */
function CategoryRow({
  goal,
  showPts,
  equalCategoryMaxPoints,
}: {
  goal: Goal;
  avg: number;
  showPts: boolean;
  equalCategoryMaxPoints: number;
}) {
  const color  = categoryColor(goal.percent);
  const maxPts = equalCategoryMaxPoints > 0 ? equalCategoryMaxPoints : (goal.maxPoints ?? CATEGORY_MAX_PTS[goal.name] ?? 10);
  const curPts = goal.points ?? (Math.round((goal.percent / 100) * maxPts * 10) / 10);
  const barPct = showPts ? Math.max(0, Math.min(100, (curPts / maxPts) * 100)) : goal.percent;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 112, fontSize: 11, fontWeight: 600, color: "#222", flexShrink: 0, letterSpacing: "-0.01em" }}>
        {goal.name}
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${color}99, ${color})`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      <div style={{ width: 52, textAlign: "right", fontSize: 12, fontWeight: 700, color, flexShrink: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
        {showPts ? `${curPts.toLocaleString("de-AT")} P` : `${goal.percent}%`}
      </div>
    </div>
  );
}
