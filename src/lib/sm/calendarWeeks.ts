const DAY_MS = 86_400_000;
const readDate = (value: string) => new Date(`${value}T12:00:00Z`);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export function shiftCalendarDate(value: string, days: number): string {
  return dateKey(new Date(readDate(value).getTime() + days * DAY_MS));
}

/** ISO calendar weeks always run Monday–Sunday, including across month/year boundaries. */
export function calendarWeek(value: string) {
  const day = readDate(value).getUTCDay() || 7;
  const start = shiftCalendarDate(value, 1 - day);
  const thursday = readDate(shiftCalendarDate(start, 3));
  const year = thursday.getUTCFullYear();
  const number = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1, 12)) / DAY_MS + 1) / 7);
  return { start, end: shiftCalendarDate(start, 6), number, year };
}

export function calendarWeekOffset(base: string, value: string): number {
  // Compare calendar dates in UTC; local DST weeks are not necessarily 168 hours long.
  return (readDate(calendarWeek(value).start).getTime() - readDate(calendarWeek(base).start).getTime()) / (7 * DAY_MS);
}

export function shiftCalendarMonth(value: string, months: number): string {
  const date = readDate(value);
  return dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12)));
}

export function monthCalendarWeeks(value: string) {
  const first = `${value.slice(0, 7)}-01`;
  const last = shiftCalendarDate(shiftCalendarMonth(first, 1), -1);
  const weeks = [];
  for (let start = calendarWeek(first).start; start <= last; start = shiftCalendarDate(start, 7)) {
    weeks.push({ ...calendarWeek(start), days: Array.from({ length: 7 }, (_, day) => shiftCalendarDate(start, day)) });
  }
  return weeks;
}

export function calendarWeekLabel(value: string, fullDate = false): string {
  const week = calendarWeek(value);
  const format = new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit", ...(fullDate ? { year: "numeric" } as const : {}) });
  return `KW ${week.number} · ${format.format(readDate(week.start))} – ${format.format(readDate(week.end))}`;
}
