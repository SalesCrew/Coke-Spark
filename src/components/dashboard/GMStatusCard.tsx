"use client";

interface KpiBar {
  label: string;
  value: string;
  percent: number;
  color: string;
}

interface GMStatusCardProps {
  name?: string;
  bars?: KpiBar[];
  ipp?: number;
  praemie?: number;
}

const defaultBars: KpiBar[] = [
  { label: "Persönliche Boni Ziele", value: "79%", percent: 79, color: "#F4B4B4" },
  { label: "Kühlerinventur", value: "62/120", percent: 51.7, color: "#E86B5A" },
  { label: "MHD", value: "67%", percent: 67, color: "#DC2626" },
];

export function GMStatusCard({
  name = "Max Mustermann",
  bars = defaultBars,
  ipp = 5.4,
  praemie = 903,
}: GMStatusCardProps) {
  return (
    <div
      className="mx-auto w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.025)",
        padding: "20px 22px 20px",
      }}
    >
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-medium text-gray-900">{name}</span>

          <div className="mt-5 space-y-3.5">
            {bars.map((bar) => (
              <div key={bar.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-gray-500">
                    {bar.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-400">
                    {bar.value}
                  </span>
                </div>
                <div
                  className="w-full overflow-hidden"
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "rgba(0,0,0,0.035)",
                  }}
                >
                  <div
                    style={{
                      width: `${bar.percent}%`,
                      height: "100%",
                      borderRadius: 3,
                      backgroundColor: bar.color,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mx-5 self-stretch"
          style={{
            width: 1,
            background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.07) 50%, transparent)",
          }}
        />

        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{ width: 100 }}
        >
          <span
            className="text-[28px] font-extrabold leading-none"
            style={{ color: "#DC2626", letterSpacing: "-0.02em" }}
          >
            {ipp}
          </span>
          <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            IPP
          </span>

          <div
            className="my-3"
            style={{
              width: 24,
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)",
            }}
          />

          <span
            className="text-[24px] font-extrabold leading-none"
            style={{
              color: "#16a34a",
              letterSpacing: "-0.02em",
              textShadow: "0 0 20px rgba(34,197,94,0.2)",
            }}
          >
            {praemie}€
          </span>
          <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            Prämie QTD
          </span>
        </div>
      </div>
    </div>
  );
}
