import { CalendarClock } from "lucide-react";
import type { SmHolidayAdjustment } from "@/lib/sm/austrianHolidays";

const date = (value: string) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
const duration = (value: number) => `${(value / 60).toLocaleString("de-AT", { maximumFractionDigits: 2 })} h`;
export function SmHolidayNote({ adjustment, currentDate, compact = false }: { adjustment: SmHolidayAdjustment; currentDate: string; compact?: boolean }) {
  const text = `${adjustment.holidayName}: ${date(adjustment.holidayDate)} → ${date(currentDate)}`;
  if (compact) return <span title={`${text}${adjustment.manualOverride ? " · manuell angepasst" : " · automatisch verschoben"}`} className="inline-flex max-w-full items-center gap-1 text-[9px] font-semibold text-amber-700"><CalendarClock size={10} className="shrink-0" /><span className="truncate">{adjustment.holidayName}{adjustment.manualOverride ? " · manuell" : " · verschoben"}</span></span>;
  return <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
    <p className="flex items-center gap-1.5 font-semibold"><CalendarClock size={13} className="shrink-0" />{adjustment.manualOverride ? "Feiertag · manuell angepasst" : "Wegen Feiertag verschoben"}</p>
    <p className="mt-1 font-medium">{text}</p>
    {adjustment.previousDate && adjustment.nextDate ? <p className="mt-1 text-[10px] text-amber-800/80">Sollzeit bei der Planung: {date(adjustment.previousDate)} {duration(adjustment.previousMinutes ?? 0)} · {date(adjustment.nextDate)} {duration(adjustment.nextMinutes ?? 0)}.{adjustment.reason === "tie_forward" ? " Gleichstand: späterer Werktag." : " Der weniger verplante Werktag wurde gewählt."}</p> : <p className="mt-1 text-[10px] text-amber-800/80">Auf den zulässigen benachbarten Werktag verschoben; Wochenenden und Feiertage übersprungen.</p>}
    <p className="mt-1 text-[10px] text-amber-800/80">Nur dieser Einsatz – der Serienrhythmus bleibt unverändert.</p>
  </div>;
}
