"use client";

interface KuehlerInventurCardProps {
  current?: number;
  total?: number;
  startDate?: string;
  endDate?: string;
}

export function KuehlerInventurCard({
  current = 62,
  total = 120,
  startDate = "01.01.2026",
  endDate = "31.03.2026",
}: KuehlerInventurCardProps) {
  const percent = Math.round((current / total) * 100);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.03)",
          borderRadius: 7,
          padding: "10px 12px",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-700">
            Aktuelle Kühlerinventur
          </span>
          <span className="text-[10px] tabular-nums text-gray-400">
            {startDate} – {endDate}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div
            className="flex-1 overflow-hidden"
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: "rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: "#DC2626",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-gray-600 shrink-0">
            {current}/{total}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-gray-400">
          {percent}% abgeschlossen
        </span>
        <button
          style={{
            padding: 0,
            fontSize: 10,
            fontWeight: 600,
            color: "#DC2626",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
            letterSpacing: "0.01em",
          }}
        >
          Märkte anzeigen
        </button>
      </div>
    </div>
  );
}
