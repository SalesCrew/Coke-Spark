export type ZeiterfassungRange = { from: string; to: string };

/** Match the backend's default: 30 calendar days before today, through today in Vienna. */
export function defaultZeiterfassungRange(now = new Date()): ZeiterfassungRange {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((value) => value.type === name)!.value;
  const to = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${to}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30);
  return { from: start.toISOString().slice(0, 10), to };
}

/** Publish only the latest pair of day/GM responses, including errors and loading completion. */
export class ZeiterfassungRangeRequests {
  private generation = 0;
  constructor(private range: ZeiterfassungRange) {}

  invalidate() { this.generation += 1; }

  select(range: ZeiterfassungRange) {
    this.range = range;
    this.invalidate();
  }

  isSelected(range: ZeiterfassungRange) {
    return range.from === this.range.from && range.to === this.range.to;
  }

  async run<T>(range: ZeiterfassungRange, fetchData: () => Promise<T>, callbacks: {
    success: (data: T) => void;
    error: (error: unknown) => void;
    settled: () => void;
  }) {
    // An edit started in the previous view may request a refresh after that view unmounts.
    if (!this.isSelected(range)) return;
    const generation = ++this.generation;
    try {
      const data = await fetchData();
      if (generation === this.generation) callbacks.success(data);
    } catch (error) {
      if (generation === this.generation) callbacks.error(error);
    } finally {
      if (generation === this.generation) callbacks.settled();
    }
  }
}
