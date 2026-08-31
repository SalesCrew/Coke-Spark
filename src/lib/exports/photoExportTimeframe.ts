export type PhotoExportTimeframeMode = "all" | "date" | "range" | "week" | "redMonth";

export type PhotoExportTimeframe = {
  timeframeMode: PhotoExportTimeframeMode;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  week?: string;
  redMonthId?: string;
};

export type PhotoExportDateRange = { dateFrom?: string; dateTo?: string };

export function selectPhotoExportRangeDay(current: PhotoExportDateRange, day: string): PhotoExportDateRange {
  if (!current.dateFrom || current.dateTo) return { dateFrom: day, dateTo: undefined };
  return day < current.dateFrom
    ? { dateFrom: day, dateTo: current.dateFrom }
    : { dateFrom: current.dateFrom, dateTo: day };
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** null means incomplete/invalid: never fall back to an unbounded export. */
export function resolvePhotoExportTimeframe(
  selection: PhotoExportTimeframe,
  redMonths: ReadonlyArray<{ id: string; start: string; end: string }>,
): { dateFrom?: string; dateTo?: string; week?: string } | null {
  switch (selection.timeframeMode) {
    case "all": return {};
    case "date": return validDate(selection.date) ? { dateFrom: selection.date, dateTo: selection.date } : null;
    case "range": return validDate(selection.dateFrom) && validDate(selection.dateTo) && selection.dateFrom <= selection.dateTo
      ? { dateFrom: selection.dateFrom, dateTo: selection.dateTo } : null;
    case "week": return selection.week && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(selection.week) ? { week: selection.week } : null;
    case "redMonth": {
      const period = redMonths.find((entry) => entry.id === selection.redMonthId);
      return period && validDate(period.start) && validDate(period.end) && period.start <= period.end
        ? { dateFrom: period.start, dateTo: period.end } : null;
    }
  }
}
