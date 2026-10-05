import type { RedMonthCurrentPayload, RedMonthPeriod } from "../../types/red-month";
import { smHomeDate, smHomeDayRolloverDelay } from "../sm/homeDashboard";

// Reuse the app's Vienna clock, including its 23/25-hour DST days.
export const redMonthToday = smHomeDate;
export const redMonthRolloverDelay = smHomeDayRolloverDelay;

export function redMonthContainsDate(period: RedMonthPeriod | null, today = redMonthToday()): boolean {
  return Boolean(period && period.start <= today && today <= (period.lookupEnd || period.end));
}

export function redMonthDaysLeft(end: string, today = redMonthToday()): number {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));
}

export function redMonthKey(period: RedMonthPeriod | null): string | null {
  return period ? `${period.id}:${period.start}:${period.end}` : null;
}

export type RedMonthRefreshState = {
  current: RedMonthPeriod | null;
  config: RedMonthCurrentPayload["config"] | null;
  loading: boolean;
  error: string | null;
  revision: number;
};

/** One request at a time; a wake-up during a request supersedes it and queues a fresh read. */
export function createRedMonthLoader(options: {
  fetch: () => Promise<RedMonthCurrentPayload>;
  onChange: (state: RedMonthRefreshState) => void;
  getDate?: () => string;
  isCurrent?: () => boolean;
}) {
  let state: RedMonthRefreshState = { current: null, config: null, loading: true, error: null, revision: 0 };
  let disposed = false, sequence = 0, queued = false;
  let pending: Promise<void> | null = null;
  const getDate = options.getDate ?? redMonthToday;
  const alive = () => !disposed && (options.isCurrent?.() ?? true);
  const usable = () => redMonthContainsDate(state.current, getDate())
    ? { ...state.current!, daysUntilEnd: redMonthDaysLeft(state.current!.end, getDate()) } : null;
  const publish = (next: RedMonthRefreshState) => { state = next; if (alive()) options.onChange(state); };
  const refresh = (supersede = false): Promise<void> => {
    if (!alive()) return Promise.resolve();
    if (pending) {
      if (supersede) { sequence += 1; queued = true; publish({ ...state, current: usable(), loading: true, error: null }); }
      return pending;
    }
    const request = ++sequence, date = getDate();
    publish({ ...state, current: usable(), loading: true, error: null });
    pending = Promise.resolve().then(options.fetch).then((data) => {
      if (!alive() || request !== sequence) return;
      if (date !== getDate()) { queued = true; publish({ ...state, current: usable(), loading: true }); return; }
      if (!redMonthContainsDate(data.current, date)) throw new Error("Der aktuelle RED-Monat konnte nicht bestätigt werden. Bitte erneut laden.");
      publish({ current: { ...data.current, daysUntilEnd: redMonthDaysLeft(data.current.end, date) }, config: data.config, loading: false, error: null, revision: state.revision + 1 });
    }).catch((error) => {
      if (!alive() || request !== sequence) return;
      publish({ ...state, current: usable(), loading: false, error: error instanceof Error ? error.message : "RED-Monat konnte nicht geladen werden." });
    }).finally(() => {
      pending = null;
      if (alive() && queued) { queued = false; void refresh(); }
    });
    return pending;
  };
  return { refresh, dispose: () => { disposed = true; sequence += 1; } };
}
