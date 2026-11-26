export type SMDurcharbeitExportTime = { mode: "all" | "week" | "month" | "range"; week: string; month: string; from: string; to: string };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const day = (value: string) => new Date(`${value}T12:00:00Z`);
const labelDate = (value: string) => day(value).toLocaleDateString("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

export function SMDurcharbeitExportPeriods(from: string | null, to: string | null) {
  const weeks: Array<{ value: string; label: string }> = [], months: typeof weeks = [];
  if (!from || !to) return { weeks, months };
  const monday = day(from); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  while (iso(monday) <= to && weeks.length < 600) {
    const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
    const thursday = new Date(monday); thursday.setUTCDate(thursday.getUTCDate() + 3);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12));
    const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    weeks.push({ value: iso(monday), label: `KW ${week} · ${labelDate(iso(monday))} – ${labelDate(iso(sunday))}` });
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
  const month = day(`${from.slice(0, 7)}-01`);
  while (iso(month) <= to && months.length < 120) {
    months.push({ value: iso(month), label: month.toLocaleDateString("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }) });
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return { weeks: weeks.reverse(), months: months.reverse() };
}

export function SMDurcharbeitExportDateRange(time: SMDurcharbeitExportTime): { from?: string; to?: string } | null {
  if (time.mode === "all") return {};
  if (time.mode === "week" && time.week) {
    const end = day(time.week); end.setUTCDate(end.getUTCDate() + 6); return { from: time.week, to: iso(end) };
  }
  if (time.mode === "month" && time.month) {
    const end = day(time.month); end.setUTCMonth(end.getUTCMonth() + 1, 0); return { from: time.month, to: iso(end) };
  }
  if (time.mode === "range" && time.from && time.to && time.from <= time.to) return { from: time.from, to: time.to };
  return null;
}
