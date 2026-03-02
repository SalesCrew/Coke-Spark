"use client";

interface Goal {
  name: string;
  percent: number;
}

interface BonusCirclesProps {
  bonus?: number;
  goals?: Goal[];
}

const defaultGoals: Goal[] = [
  { name: "Schütten/Displays", percent: 95 },
  { name: "Distributionsziel", percent: 82 },
  { name: "Flexziel", percent: 84 },
  { name: "Qualitätsziele", percent: 83 },
];

function ringColor(percent: number): string {
  if (percent >= 85) return "#22c55e";
  if (percent >= 75) return "#f97316";
  return "#DC2626";
}

const CIRCLE_SIZE = 42;
const STROKE_WIDTH = 2;

export function BonusCircles({
  bonus = 903,
  goals = defaultGoals,
}: BonusCirclesProps) {
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
          const color = ringColor(goal.percent);
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
                    backgroundColor: "#ffffff",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color }}
                  >
                    {goal.percent}%
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

      <div className="mt-3 text-center">
        <span className="text-[12px] font-bold" style={{ color: "#16a34a" }}>
          Dein Bonus: {bonus}€
        </span>
      </div>
    </div>
  );
}
