import { buildIntervals } from "@/lib/ipp-dashboard/intervals";

// The API supplies a Vienna calendar date. Calendar-day arithmetic in UTC keeps
// the one-day buffer exact across daylight-saving and month/year boundaries.
export function dashboardStartDate(
  firstEntryDate: string | null | undefined,
): string | null {
  if (!firstEntryDate || !/^\d{4}-\d{2}-\d{2}$/.test(firstEntryDate))
    return null;
  const date = new Date(`${firstEntryDate}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== firstEntryDate
  )
    return null;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function limitDashboardIntervals<T extends { start: string; end: string }>(
  intervals: T[],
  minStartDate: string | null,
): T[] {
  if (!minStartDate) return [];
  return intervals
    .filter((interval) => interval.end >= minStartDate)
    .map((interval) =>
      interval.start < minStartDate
        ? { ...interval, start: minStartDate }
        : interval,
    );
}

export function buildDashboardIntervals(
  input: Parameters<typeof buildIntervals>[0] & { minStartDate: string | null },
) {
  if (
    !input.minStartDate ||
    (input.mode === "redmonth" && !input.redMonthCalendar?.length)
  )
    return [];
  return limitDashboardIntervals(buildIntervals(input), input.minStartDate);
}
