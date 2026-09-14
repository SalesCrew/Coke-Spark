import { calendarWeek, calendarWeekLabel, calendarWeekRange, shiftCalendarDate, shiftCalendarMonth } from "./calendarWeeks";

export type SmPlanningPeriod = { mode: "week" | "days" | "month"; from: string; to: string };
export const MAX_SM_PERIOD_DAYS = 93;
const date = (key: string) => new Date(`${key}T12:00:00Z`);
const isDate = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(date(key).getTime()) && date(key).toISOString().slice(0, 10) === key;
export const viennaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function periodDayCount(from: string, to: string) {
  return Math.round((date(to).getTime() - date(from).getTime()) / 86_400_000) + 1;
}

export function smDayPeriod(first: string, last = first): SmPlanningPeriod {
  if (!isDate(first) || !isDate(last)) throw new Error("Bitte gültige Kalendertage auswählen.");
  const [from, to] = first <= last ? [first, last] : [last, first];
  const days = periodDayCount(from, to);
  if (!Number.isFinite(days) || days < 1 || days > MAX_SM_PERIOD_DAYS) throw new Error(`Bitte höchstens ${MAX_SM_PERIOD_DAYS} Tage auswählen.`);
  return { mode: "days", from, to };
}

export function smWeekPeriod(first: string, last = first): SmPlanningPeriod {
  if (!isDate(first) || !isDate(last)) throw new Error("Bitte gültige Kalenderwochen auswählen.");
  const range = calendarWeekRange(first, last);
  if (range.weekCount > 13) throw new Error("Bitte höchstens 13 KWs auswählen.");
  return { mode: "week", from: range.start, to: calendarWeek(range.end).end };
}

export function smMonthPeriod(value: string): SmPlanningPeriod {
  if (!isDate(value)) throw new Error("Bitte einen gültigen Monat auswählen.");
  const from = `${value.slice(0, 7)}-01`;
  return { mode: "month", from, to: shiftCalendarDate(shiftCalendarMonth(from, 1), -1) };
}

export function currentSmPeriod(mode: SmPlanningPeriod["mode"], today = viennaToday()) {
  return mode === "month" ? smMonthPeriod(today) : mode === "days" ? smDayPeriod(today) : smWeekPeriod(today);
}

export function shiftSmPeriod(period: SmPlanningPeriod, direction: -1 | 1): SmPlanningPeriod {
  if (period.mode === "month") return smMonthPeriod(shiftCalendarMonth(period.from, direction));
  const shift = direction * (period.mode === "week" ? 7 : periodDayCount(period.from, period.to));
  return { mode: period.mode, from: shiftCalendarDate(period.from, shift), to: shiftCalendarDate(period.to, shift) };
}

const formatDate = (value: string) => new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date(value));
export function smPeriodLabel(period: SmPlanningPeriod, full = false): string {
  const bounds = period.from === period.to ? formatDate(period.from) : `${formatDate(period.from)} – ${formatDate(period.to)}`;
  if (period.mode === "days") return bounds;
  if (period.mode === "month") {
    const month = new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }).format(date(period.from));
    return full ? `${month} · ${bounds}` : month;
  }
  const first = calendarWeek(period.from), last = calendarWeek(period.to);
  if (first.start === last.start) return calendarWeekLabel(period.from, full);
  const weeks = first.year === last.year ? `KW ${first.number}–${last.number}` : `KW ${first.number}/${first.year}–${last.number}/${last.year}`;
  return full ? `${weeks} · ${bounds}` : weeks;
}

export function smPeriodHeading(period: SmPlanningPeriod) {
  if (period.mode === "month") return "Monatsplanung";
  const days = periodDayCount(period.from, period.to);
  if (period.mode === "days") return days === 1 ? "Tagesplanung" : `${days}-Tage-Planung`;
  return days === 7 ? "Wochenplanung" : `${days / 7}-Wochen-Planung`;
}

export function smPeriodExportSlug(period: SmPlanningPeriod) {
  if (period.mode === "month") return period.from.slice(0, 7);
  return period.from === period.to ? period.from : `${period.from}_${period.to}`;
}
