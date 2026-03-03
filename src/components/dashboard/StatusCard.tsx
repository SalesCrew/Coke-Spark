"use client";

interface OosSegment {
  label: string;
  value: number;
  color: string;
}

interface StatusCardProps {
  name?: string;
  deploymentsToday?: number;
  segments?: OosSegment[];
}

const defaultSegments: OosSegment[] = [
  { label: "Ohne OOS", value: 60, color: "#F4B4B4" },
  { label: "mit behobener OOS", value: 28, color: "#E86B5A" },
  { label: "nicht behobene OOS", value: 12, color: "#DC2626" },
];

export function StatusCard({
  name = "Max Mustermann",
  deploymentsToday = 2,
  segments = defaultSegments,
}: StatusCardProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      className="mx-auto w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-gray-800">{name}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-gray-400">Einsätze Heute:</span>
          <span className="text-[22px] font-bold leading-none text-gray-800">
            {deploymentsToday}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[10px] text-gray-500">{seg.label}</span>
          </div>
        ))}
      </div>

      <div
        className="mt-2.5 flex overflow-hidden"
        style={{ borderRadius: 6, height: 10 }}
      >
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={seg.label}
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                marginLeft: i > 0 ? 2 : 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
