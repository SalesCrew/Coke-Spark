export type SpezialfragePeriod = { startDate: string; endDate: string };

export function isSpezialfrageDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function spezialfragePeriodError(config: Record<string, unknown>): string | null {
  if (config.spezialfragePeriod === undefined) return null;
  const period = config.spezialfragePeriod as Partial<SpezialfragePeriod> | null;
  if (!period || typeof period !== "object" || Array.isArray(period)
    || !isSpezialfrageDate(period.startDate) || !isSpezialfrageDate(period.endDate)) {
    return "Bitte wähle einen gültigen Beginn und ein gültiges Ende für den Spezialfragen-Zeitraum.";
  }
  if (period.startDate > period.endDate) return "Das Ende des Spezialfragen-Zeitraums darf nicht vor dem Beginn liegen.";
  return null;
}

export function updateSpezialfragePeriod(config: Record<string, unknown>, key: keyof SpezialfragePeriod, value: string): Record<string, unknown> {
  const previous = config.spezialfragePeriod as Partial<SpezialfragePeriod> | undefined;
  return { ...config, spezialfragePeriod: { startDate: previous?.startDate ?? "", endDate: previous?.endDate ?? "", [key]: value } };
}

export function clearSpezialfragePeriod(config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config };
  delete next.spezialfragePeriod;
  return next;
}
