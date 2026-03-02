"use client";

interface Assignment {
  market: string;
  time: string;
}

interface SchedulePreviewProps {
  today?: Assignment[];
  tomorrow?: Assignment[];
}

const defaultToday: Assignment[] = [
  { market: "SPAR Zentrum", time: "09:30" },
  { market: "REWE Nord", time: "11:00" },
];

const defaultTomorrow: Assignment[] = [
  { market: "Hofer Süd", time: "13:00" },
  { market: "Lidl West", time: "14:30" },
];

export function SchedulePreview({
  today = defaultToday,
  tomorrow = defaultTomorrow,
}: SchedulePreviewProps) {
  return (
    <div className="flex w-fit items-stretch gap-5">
      <ScheduleColumn label="HEUTE" items={today} />
      <div className="w-px bg-black/[0.07]" />
      <ScheduleColumn label="MORGEN" items={tomorrow} />
    </div>
  );
}

function ScheduleColumn({
  label,
  items,
}: {
  label: string;
  items: Assignment[];
}) {
  return (
    <div className="min-w-0">
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "#DC2626" }}
      >
        {label}
      </span>
      <div className="mt-2.5 space-y-3">
        {items.map((a, i) => (
          <div key={i}>
            <div className="text-[12px] font-medium text-gray-800">
              {a.market}
            </div>
            <div className="text-[11px] text-gray-400">{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
