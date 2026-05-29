import type { RedMonthPeriod } from "@/types/red-month";

export type IntervalMode = "redmonth" | "week" | "month" | "quarter";

export type IppInterval = {
  id: string;
  mode: IntervalMode;
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  startMs: number;
  meta: {
    year: number;
    month?: number;
    quarter?: number;
    isoWeek?: number;
    redPeriodIndex?: number;
  };
};

type BuildIntervalsInput = {
  mode: IntervalMode;
  count?: number;
  now?: Date;
  redMonthCalendar?: RedMonthPeriod[];
};

const DEFAULT_COUNT: Record<IntervalMode, number> = {
  redmonth: 16,
  week: 18,
  month: 16,
  quarter: 12,
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function startOfUtcQuarter(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

function endOfUtcQuarter(date: Date): Date {
  const start = startOfUtcQuarter(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
}

function startOfUtcWeekMonday(date: Date): Date {
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - distance));
}

function addUtcDays(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
}

function getIsoWeek(input: Date): number {
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function compareByNewest(left: IppInterval, right: IppInterval): number {
  return right.startMs - left.startMs;
}

function buildRedMonthIntervals(input: BuildIntervalsInput): IppInterval[] {
  const calendar = (input.redMonthCalendar ?? [])
    .filter((period) => typeof period.start === "string" && typeof period.end === "string")
    .map((period) => {
      const start = parseYmd(period.start);
      const end = parseYmd(period.end);
      return {
        id: period.id,
        mode: "redmonth" as const,
        label: period.label,
        shortLabel: period.label,
        start: period.start,
        end: period.end,
        startMs: start.getTime(),
        meta: {
          year: period.year,
          redPeriodIndex: period.periodIndexFromAnchor,
        },
      };
    })
    .sort(compareByNewest);
  if (calendar.length > 0) {
    return calendar.slice(0, input.count ?? DEFAULT_COUNT.redmonth);
  }

  // Fallback if red calendar is not loaded yet.
  const count = input.count ?? DEFAULT_COUNT.redmonth;
  const now = input.now ?? new Date();
  const intervals: IppInterval[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1 - idx * 28));
    const start = startOfUtcWeekMonday(anchor);
    const end = addUtcDays(start, 27);
    const year = start.getUTCFullYear();
    intervals.push({
      id: `red-fallback-${toYmd(start)}`,
      mode: "redmonth",
      label: `RED ${pad2(start.getUTCDate())}.${pad2(start.getUTCMonth() + 1)} - ${pad2(end.getUTCDate())}.${pad2(end.getUTCMonth() + 1)}`,
      shortLabel: `RED ${pad2(start.getUTCDate())}.${pad2(start.getUTCMonth() + 1)}`,
      start: toYmd(start),
      end: toYmd(end),
      startMs: start.getTime(),
      meta: { year },
    });
  }
  return intervals.sort(compareByNewest);
}

function buildWeekIntervals(input: BuildIntervalsInput): IppInterval[] {
  const count = input.count ?? DEFAULT_COUNT.week;
  const now = input.now ?? new Date();
  const currentWeekStart = startOfUtcWeekMonday(now);
  const intervals: IppInterval[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    const start = addUtcDays(currentWeekStart, -7 * idx);
    const end = addUtcDays(start, 4); // Mo-Fr
    const isoWeek = getIsoWeek(start);
    const year = start.getUTCFullYear();
    intervals.push({
      id: `week-${year}-${pad2(isoWeek)}`,
      mode: "week",
      label: `KW ${pad2(isoWeek)} · ${pad2(start.getUTCDate())}.${pad2(start.getUTCMonth() + 1)} - ${pad2(end.getUTCDate())}.${pad2(end.getUTCMonth() + 1)}`,
      shortLabel: `KW ${pad2(isoWeek)}`,
      start: toYmd(start),
      end: toYmd(end),
      startMs: start.getTime(),
      meta: { year, isoWeek },
    });
  }
  return intervals.sort(compareByNewest);
}

function buildMonthIntervals(input: BuildIntervalsInput): IppInterval[] {
  const count = input.count ?? DEFAULT_COUNT.month;
  const now = input.now ?? new Date();
  const currentMonthStart = startOfUtcMonth(now);
  const intervals: IppInterval[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    const start = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - idx, 1));
    const end = endOfUtcMonth(start);
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;
    intervals.push({
      id: `month-${year}-${pad2(month)}`,
      mode: "month",
      label: `${start.toLocaleString("de-AT", { month: "long", year: "numeric", timeZone: "UTC" })}`,
      shortLabel: `${start.toLocaleString("de-AT", { month: "short", timeZone: "UTC" })} ${String(year).slice(-2)}`,
      start: toYmd(start),
      end: toYmd(end),
      startMs: start.getTime(),
      meta: { year, month },
    });
  }
  return intervals.sort(compareByNewest);
}

function buildQuarterIntervals(input: BuildIntervalsInput): IppInterval[] {
  const count = input.count ?? DEFAULT_COUNT.quarter;
  const now = input.now ?? new Date();
  const currentQuarterStart = startOfUtcQuarter(now);
  const intervals: IppInterval[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    const start = new Date(Date.UTC(currentQuarterStart.getUTCFullYear(), currentQuarterStart.getUTCMonth() - idx * 3, 1));
    const end = endOfUtcQuarter(start);
    const year = start.getUTCFullYear();
    const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
    intervals.push({
      id: `quarter-${year}-Q${quarter}`,
      mode: "quarter",
      label: `Q${quarter} ${year} (${pad2(start.getUTCDate())}.${pad2(start.getUTCMonth() + 1)} - ${pad2(end.getUTCDate())}.${pad2(end.getUTCMonth() + 1)})`,
      shortLabel: `Q${quarter} ${String(year).slice(-2)}`,
      start: toYmd(start),
      end: toYmd(end),
      startMs: start.getTime(),
      meta: { year, quarter },
    });
  }
  return intervals.sort(compareByNewest);
}

export function buildIntervals(input: BuildIntervalsInput): IppInterval[] {
  if (input.mode === "redmonth") return buildRedMonthIntervals(input);
  if (input.mode === "week") return buildWeekIntervals(input);
  if (input.mode === "month") return buildMonthIntervals(input);
  return buildQuarterIntervals(input);
}

export function findIntervalById(intervals: IppInterval[], intervalId: string | null): IppInterval | null {
  if (!intervalId) return null;
  return intervals.find((interval) => interval.id === intervalId) ?? null;
}

export function findPreviousIntervalId(intervals: IppInterval[], selectedIntervalId: string | null): string | null {
  if (!selectedIntervalId) return null;
  const idx = intervals.findIndex((interval) => interval.id === selectedIntervalId);
  if (idx < 0) return null;
  return intervals[idx + 1]?.id ?? null;
}

export function findPreviousYearIntervalId(intervals: IppInterval[], selectedIntervalId: string | null): string | null {
  const selected = findIntervalById(intervals, selectedIntervalId);
  if (!selected) return null;

  if (selected.mode === "month") {
    return (
      intervals.find((interval) => interval.mode === "month" && interval.meta.year === selected.meta.year - 1 && interval.meta.month === selected.meta.month)?.id
      ?? null
    );
  }
  if (selected.mode === "quarter") {
    return (
      intervals.find((interval) => interval.mode === "quarter" && interval.meta.year === selected.meta.year - 1 && interval.meta.quarter === selected.meta.quarter)?.id
      ?? null
    );
  }
  if (selected.mode === "week") {
    return (
      intervals.find((interval) => interval.mode === "week" && interval.meta.year === selected.meta.year - 1 && interval.meta.isoWeek === selected.meta.isoWeek)?.id
      ?? null
    );
  }
  const redIndex = selected.meta.redPeriodIndex;
  if (redIndex != null) {
    return (
      intervals.find((interval) => interval.mode === "redmonth" && interval.meta.redPeriodIndex === redIndex - 12)?.id
      ?? null
    );
  }
  return null;
}

export function findQuarterPairIntervalId(intervals: IppInterval[], selectedIntervalId: string | null): string | null {
  const selected = findIntervalById(intervals, selectedIntervalId);
  if (!selected || selected.mode !== "quarter") return null;
  const wantedQuarter = selected.meta.quarter === 4 ? 2 : 4;
  return (
    intervals.find(
      (interval) =>
        interval.mode === "quarter"
        && interval.meta.year === selected.meta.year
        && interval.meta.quarter === wantedQuarter,
    )?.id
    ?? null
  );
}

export function getIntervalDisplayRange(interval: IppInterval | null): string {
  if (!interval) return "—";
  return `${interval.start} bis ${interval.end}`;
}
