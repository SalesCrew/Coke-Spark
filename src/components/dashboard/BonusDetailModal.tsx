"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, Award } from "lucide-react";

interface Goal {
  name: string;
  percent: number;
  color: string;
}

interface Cluster {
  label: string;
  minPct: number;
  maxPct: number | null;
  bonus: number;
}

const CLUSTERS: Cluster[] = [
  { label: "Kein Bonus",    minPct: 0,    maxPct: 69.9,  bonus: 0    },
  { label: "50% Bonus",     minPct: 70,   maxPct: 79.9,  bonus: 550  },
  { label: "80% Bonus",     minPct: 80,   maxPct: 94.9,  bonus: 880  },
  { label: "Voller Bonus",  minPct: 95,   maxPct: null,  bonus: 1100 },
];

const FULL_BONUS = 1100;

function getCluster(avg: number): Cluster {
  return (
    [...CLUSTERS].reverse().find((c) => avg >= c.minPct) ?? CLUSTERS[0]
  );
}

function getNextCluster(avg: number): Cluster | null {
  const idx = CLUSTERS.findIndex((c) => avg >= c.minPct && (c.maxPct === null || avg <= c.maxPct));
  if (idx === -1 || idx === CLUSTERS.length - 1) return null;
  return CLUSTERS[idx + 1] ?? null;
}

function clusterColor(bonus: number): string {
  if (bonus === 0) return "#ef4444";
  if (bonus === 550) return "#f97316";
  if (bonus === 880) return "#eab308";
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
  onClose: () => void;
}

export function BonusDetailModal({ goals, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const avg = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.percent, 0) / goals.length)
    : 0;

  const current = getCluster(avg);
  const next = getNextCluster(avg);
  const pctToNext = next ? next.minPct - avg : 0;
  const earnedBonus = current.bonus;

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
                const now = new Date();
                const q = Math.floor(now.getMonth() / 3);
                const year = now.getFullYear();
                const starts = [
                  new Date(year, 0, 1), new Date(year, 3, 1),
                  new Date(year, 6, 1), new Date(year, 9, 1),
                ];
                const ends = [
                  new Date(year, 2, 31), new Date(year, 5, 30),
                  new Date(year, 8, 30), new Date(year, 11, 31),
                ];
                const fmt = (d: Date) => d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
                return `Q${q + 1} ${year} · ${fmt(starts[q])} – ${fmt(ends[q])}`;
              })()}
            </div>
          </div>
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

        {/* Cluster track */}
        <div style={{ padding: "20px 20px 0" }}>
          <ClusterTrack avg={avg} />
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
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "inline-block",
                }}>
                  {earnedBonus}€
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.28)" }}>
                  von {FULL_BONUS}€
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
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.28)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
              Ø {avg}%
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map((g) => (
              <CategoryRow key={g.name} goal={g} avg={avg} />
            ))}
          </div>
        </div>

        {/* Improvement hint */}
        <div style={{ padding: "14px 20px 20px" }}>
          {next ? (
            <div style={{
              backgroundColor: "rgba(0,0,0,0.025)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: `${clusterColor(next.bonus)}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <TrendingUp size={14} color={clusterColor(next.bonus)} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#111", marginBottom: 2 }}>
                  Noch {pctToNext}% bis zur nächsten Stufe
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
                  Erreichst du <span style={{ fontWeight: 700, color: clusterColor(next.bonus) }}>{next.minPct}%</span> Durchschnitt, steigt dein Bonus auf{" "}
                  <span style={{ fontWeight: 700, color: clusterColor(next.bonus) }}>{next.bonus}€</span>{" "}
                  (+{next.bonus - earnedBonus}€).
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: "#22c55e0f",
              border: "1px solid #22c55e22",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
                Maximaler Bonus erreicht — ausgezeichnete Arbeit!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

/* ── Cluster track ── */
function ClusterTrack({ avg }: { avg: number }) {
  const nodes = [
    { minPct: 0,  bonus: 0,    label: "0€",    threshold: "ab 0%" },
    { minPct: 70, bonus: 550,  label: "550€",  threshold: "ab 70%" },
    { minPct: 80, bonus: 880,  label: "880€",  threshold: "ab 80%" },
    { minPct: 95, bonus: 1100, label: "1100€", threshold: "ab 95%" },
  ];

  const GREEN = "#059669";
  const INACTIVE = "rgba(0,0,0,0.10)";
  const INACTIVE_BG = "#f5f5f7";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {nodes.map((n, i) => {
        const reached = avg >= n.minPct;
        const isActive = avg >= n.minPct && (
          i === nodes.length - 1 ? true : avg < nodes[i + 1].minPct
        );
        const lineReached = i < nodes.length - 1 && avg >= nodes[i + 1].minPct;

        return (
          <div key={n.minPct} style={{ display: "flex", alignItems: "center", flex: i < nodes.length - 1 ? "1 1 0" : "0 0 auto" }}>
            {/* Node */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {/* Circle */}
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                backgroundColor: reached ? `${GREEN}28` : INACTIVE_BG,
                border: `2.5px solid ${reached ? GREEN : INACTIVE}`,
                boxShadow: isActive ? `0 0 0 3px ${GREEN}28, 0 0 10px 2px ${GREEN}28` : reached ? `0 2px 6px ${GREEN}22` : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s ease",
                position: "relative",
              }}>
                <span style={{
                  fontSize: n.label.length > 4 ? 10 : 11,
                  fontWeight: 800,
                  color: reached ? GREEN : "rgba(0,0,0,0.22)",
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}>
                  {n.label}
                </span>
              </div>

              {/* Threshold label below */}
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: reached ? GREEN : "rgba(0,0,0,0.28)",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}>
                {n.threshold}
              </div>
            </div>

            {/* Connector line to next node */}
            {i < nodes.length - 1 && (
              <div style={{
                flex: 1, height: 3, marginTop: 0, marginBottom: 22, marginLeft: 4, marginRight: 4,
                borderRadius: 2,
                backgroundColor: lineReached ? GREEN : INACTIVE,
                transition: "background-color 0.3s ease",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* partial fill if avg is between this and next node */}
                {reached && !lineReached && (() => {
                  const segStart = n.minPct;
                  const segEnd = nodes[i + 1].minPct;
                  const fill = Math.min(1, Math.max(0, (avg - segStart) / (segEnd - segStart)));
                  return (
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${fill * 100}%`,
                      backgroundColor: GREEN,
                      borderRadius: 2,
                      transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
                    }} />
                  );
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
function CategoryRow({ goal }: { goal: Goal; avg: number }) {
  const color = categoryColor(goal.percent);
  const barPct = goal.percent;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* Name */}
      <div style={{ width: 112, fontSize: 11, fontWeight: 600, color: "#222", flexShrink: 0, letterSpacing: "-0.01em" }}>
        {goal.name}
      </div>

      {/* Bar */}
      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{
          width: `${barPct}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>

      {/* Percent */}
      <div style={{
        width: 36, textAlign: "right",
        fontSize: 12, fontWeight: 700,
        color, flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}>
        {goal.percent}%
      </div>
    </div>
  );
}
