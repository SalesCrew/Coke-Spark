"use client";

type AssignmentStatus = "starten" | "erledigt";

interface Assignment {
  duration: string;
  market: string;
  status: AssignmentStatus;
}

interface AssignmentListProps {
  assignments?: Assignment[];
}

const defaultAssignments: Assignment[] = [
  { duration: "1St", market: "ADEG Plus", status: "starten" },
  { duration: "2St", market: "BILLA Hauptstr.", status: "erledigt" },
  { duration: "1St", market: "SPAR Zentrum", status: "starten" },
];

export function AssignmentList({
  assignments = defaultAssignments,
}: AssignmentListProps) {
  return (
    <div>
      <div className="flex items-center px-1 pb-2">
        <span className="w-[44px] text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Dauer
        </span>
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Markt
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-300">
          Status
        </span>
      </div>

      <div
        className="w-full"
        style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }}
      />

      <div>
        {assignments.map((a, i) => (
          <div
            key={i}
            className="flex items-center px-1"
            style={{
              height: 42,
              borderBottom:
                i < assignments.length - 1
                  ? "1px solid rgba(0,0,0,0.04)"
                  : "none",
            }}
          >
            <span className="w-[44px] text-[11px] tabular-nums text-gray-400">
              {a.duration}
            </span>
            <span className="flex-1 text-[12px] font-medium text-gray-800">
              {a.market}
            </span>
            <StatusPill status={a.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AssignmentStatus }) {
  const isStart = status === "starten";

  return (
    <span
      className="inline-flex items-center justify-center text-[10px] font-medium"
      style={{
        padding: "4px 14px",
        borderRadius: 8,
        background: isStart
          ? "linear-gradient(to bottom, #DC2626, #e84040)"
          : "rgba(220,38,38,0.06)",
        color: isStart ? "#ffffff" : "rgba(180,60,60,0.6)",
        cursor: isStart ? "pointer" : "default",
        boxShadow: isStart
          ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)"
          : "0 0 0 0.5px rgba(0,0,0,0.06)",
        letterSpacing: "0.01em",
      }}
    >
      {isStart ? "Starten" : "Erledigt"}
    </span>
  );
}
