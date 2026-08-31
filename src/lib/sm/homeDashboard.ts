import type { SmHomeDashboardPayload } from "../../types/smDashboard";

const viennaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit",
});

export function smHomeDate(now = new Date()): string {
  const parts = Object.fromEntries(viennaDayFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** One wake-up at the next Vienna midnight, including 23/25-hour DST days. */
export function smHomeDayRolloverDelay(now = new Date()): number {
  const nextDayUtc = new Date(`${smHomeDate(now)}T00:00:00Z`);
  nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1);
  const viennaHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23",
  }).format(nextDayUtc));
  return Math.max(1, nextDayUtc.getTime() - viennaHour * 3_600_000 - now.getTime() + 50);
}

export function smHomeEmptyMessage(data: SmHomeDashboardPayload): string | null {
  if (data.visits.completed === 0) {
    return data.assignmentsToday === 0 ? "Heute sind keine Einsätze geplant." : "Deine OOS-Auswertung erscheint nach dem ersten Abschluss.";
  }
  if (data.visits.classified === 0) return "Abgeschlossen · noch keine auswertbaren OOS-Antworten.";
  return null;
}

export function smHomeSegments(data: SmHomeDashboardPayload) {
  return [
    { label: "Ohne OOS", value: data.visits.withoutOos, color: "#F4B4B4" },
    { label: "OOS behoben", value: data.visits.fixedOos, color: "#E86B5A" },
    { label: "OOS offen", value: data.visits.openOos, color: "#DC2626" },
  ];
}

export type SmHomeLoadState = { data: SmHomeDashboardPayload | null; error: boolean; loading: boolean };

/** Drops late responses after account changes; refreshes never poll or run concurrently. */
export function createSmHomeLoader(options: {
  owner: string;
  getOwner: () => string | null;
  fetch: () => Promise<SmHomeDashboardPayload>;
  onChange: (state: SmHomeLoadState) => void;
  getDate?: () => string;
}) {
  let state: SmHomeLoadState = { data: null, error: false, loading: true };
  let disposed = false;
  let pending: Promise<void> | null = null;
  let refreshAfterPending = false;
  const getDate = options.getDate ?? smHomeDate;
  const isCurrent = () => !disposed && options.getOwner() === options.owner;
  const refresh = (afterPending = false): Promise<void> => {
    if (!isCurrent()) return Promise.resolve();
    if (pending) {
      refreshAfterPending ||= afterPending;
      return pending;
    }
    state = { data: state.data?.date === getDate() ? state.data : null, loading: true, error: false };
    options.onChange(state);
    pending = Promise.resolve().then(options.fetch).then((data) => {
      if (!isCurrent()) return;
      if (data.userId !== options.owner || data.date !== getDate()) throw new Error("Stale SM overview.");
      state = { data, loading: false, error: false };
      options.onChange(state);
    }).catch(() => {
      if (!isCurrent()) return;
      state = { data: state.data?.date === getDate() ? state.data : null, error: true, loading: false };
      options.onChange(state);
    }).finally(() => {
      pending = null;
      if (isCurrent() && refreshAfterPending) {
        refreshAfterPending = false;
        void refresh();
      }
    });
    return pending;
  };
  return { refresh, dispose: () => { disposed = true; } };
}
