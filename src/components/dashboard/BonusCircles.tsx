"use client";

import { GmSkeletonBlock } from "./GmDashboardSkeleton";

interface Goal {
  name: string;
  percent: number;
  color?: string;
  isManual?: boolean;
  isPending?: boolean;
}

interface BonusCirclesProps {
  bonus?: number;
  goals?: Goal[];
  hasActiveWave?: boolean;
  isLoading?: boolean;
  onOpenDetail?: () => void;
}

const defaultGoals: Goal[] = [
  { name: "Schütten/Displays", percent: 95 },
  { name: "Distributionsziel", percent: 82 },
  { name: "Flexziel", percent: 84 },
  { name: "Qualitätsziele", percent: 83 },
];

function calcBonus(goals: Goal[]): number {
  const activeGoals = goals.filter((goal) => !goal.isPending);
  if (activeGoals.length === 0) return 0;
  const avg = activeGoals.reduce((s, g) => s + g.percent, 0) / activeGoals.length;
  if (avg >= 95) return 1100;
  if (avg >= 80) return 880;
  if (avg >= 70) return 550;
  return 0;
}

function ringColor(percent: number): string {
  if (percent >= 85) return "#22c55e";
  if (percent >= 75) return "#f97316";
  return "#DC2626";
}

const CIRCLE_SIZE = 42;
const STROKE_WIDTH = 2;

export function BonusCircles({
  bonus,
  goals = defaultGoals,
  hasActiveWave = true,
  isLoading = false,
  onOpenDetail,
}: BonusCirclesProps) {
  const resolvedBonus = bonus ?? calcBonus(goals);
  if (isLoading) {
    return (
      <div className="w-full" style={{ minHeight: 132, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="flex justify-center" style={{ gap: 20 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`bonus-skeleton-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 62 }}>
              <GmSkeletonBlock style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: 999 }} />
              <GmSkeletonBlock style={{ width: 46, height: 8, borderRadius: 99, marginTop: 8 }} />
              <GmSkeletonBlock style={{ width: 34, height: 7, borderRadius: 99, marginTop: 5, opacity: 0.72 }} />
            </div>
          ))}
        </div>
        <GmSkeletonBlock style={{ height: 23, width: "100%", borderRadius: 7, marginTop: 14 }} />
      </div>
    );
  }

  if (!hasActiveWave) {
    return (
      <div className="w-full" style={{ minHeight: 132, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span className="text-[12px] font-semibold text-gray-500">Kein aktiver Bonus</span>
        <span className="text-[11px] text-gray-400">Sobald eine Prämien-Welle aktiv ist, siehst du hier deinen Fortschritt.</span>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="w-full" style={{ minHeight: 132, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span className="text-[12px] font-semibold text-gray-500">Noch keine Bonus-Daten</span>
        <span className="text-[11px] text-gray-400">Beantworte Fragen mit Boni-Punkten, um deinen Stand zu sehen.</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-center" style={{ position: "relative" }}>
        {/* Connecting lines layer */}
        <div
          className="flex justify-center"
          style={{
            position: "absolute",
            top: CIRCLE_SIZE / 2,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {goals.map((_, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && (
                <div
                  style={{
                    width: 20,
                    height: 2,
                    backgroundColor: "rgba(0,0,0,0.10)",
                    borderRadius: 1,
                  }}
                />
              )}
              <div style={{ width: 62 }} />
            </div>
          ))}
        </div>

        {/* Circles + labels */}
        {goals.map((goal, i) => {
          const pending = Boolean(goal.isPending);
          const color = pending ? "rgba(0,0,0,0.22)" : ringColor(goal.percent);
          return (
            <div key={i} className="flex items-center">
              {i > 0 && <div style={{ width: 20 }} />}
              <div className="flex flex-col items-center" style={{ width: 62 }}>
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: CIRCLE_SIZE,
                    height: CIRCLE_SIZE,
                    border: `${STROKE_WIDTH}px solid ${color}`,
                    backgroundColor: pending ? "rgba(0,0,0,0.025)" : "#ffffff",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color }}
                  >
                    {pending ? "Offen" : `${goal.percent}%`}
                  </span>
                </div>
                <span
                  className="mt-1.5 text-[9px] font-medium text-gray-400 text-center leading-tight"
                  style={{ maxWidth: 62, height: 22 }}
                >
                  {goal.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3 text-center"
        onClick={onOpenDetail}
        style={{
          backgroundColor: "rgba(0,0,0,0.03)",
          borderRadius: 7,
          padding: "3px 12px",
          cursor: onOpenDetail ? "pointer" : "default",
          transition: "background-color 0.15s ease",
        }}
        onMouseEnter={(e) => { if (onOpenDetail) (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(0,0,0,0.07)"; }}
        onMouseLeave={(e) => { if (onOpenDetail) (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(0,0,0,0.03)"; }}
      >
        <span className="text-[12px] font-bold" style={{ color: "#059669" }}>
          Dein Bonus: {resolvedBonus}€
        </span>
      </div>
    </div>
  );
}
