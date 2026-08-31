"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { AdminDropdown } from "@/components/admin/AdminFilterControls";
import { austrianHolidays } from "@/lib/sm/austrianHolidays";

export function SmHolidayCalendarCard() {
  const [baseYear] = useState(() => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric" }).format(new Date())));
  const [year, setYear] = useState(String(baseYear));
  const options = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ value: String(baseYear + i), label: String(baseYear + i) })), [baseYear]);
  return <details className="group rounded-xl border border-amber-200/60 bg-white shadow-[0_2px_8px_rgba(0,0,0,.025)]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><CalendarDays size={15} /></span><span><span className="block text-[12px] font-semibold text-gray-900">Österreichische Feiertage</span><span className="mt-0.5 block text-[10px] text-gray-500">Automatisch berücksichtigt · Vorschau {baseYear}–{baseYear + 10}</span></span></span><ChevronDown size={14} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-black/[.05] p-4">
      <p className="mb-3 text-[11px] leading-relaxed text-gray-600">Nur der betroffene Einsatz wird auf einen benachbarten Werktag verschoben. Weniger Sollzeit gewinnt; bei Gleichstand später. Montag nach vorne, Freitag zurück. Manuelle Datumsänderungen bleiben erhalten.</p>
      <div className="mb-3 max-w-[140px]"><AdminDropdown value={year} onChange={setYear} options={options} ariaLabel="Feiertagsjahr" placeholder="Jahr auswählen" /></div>
      <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">{austrianHolidays(Number(year)).map((holiday) => <li key={holiday.date} className="flex items-start justify-between gap-3 border-b border-black/[.04] py-2 text-[11px]"><span className="font-medium text-gray-700">{holiday.name}</span><time dateTime={holiday.date} className="shrink-0 tabular-nums text-amber-700">{new Intl.DateTimeFormat("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${holiday.date}T12:00:00Z`))}</time></li>)}</ul>
    </div>
  </details>;
}
