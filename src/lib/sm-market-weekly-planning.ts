import type { SmMarketWeekdayHours, SmMarketWeekdayKey } from "../types/smMarkets";

export const SM_PLANNING_DAYS = [
  { key: "mo", label: "Montag" },
  { key: "di", label: "Dienstag" },
  { key: "mi", label: "Mittwoch" },
  { key: "do", label: "Donnerstag" },
  { key: "fr", label: "Freitag" },
] as const;

export type SmWeeklyPlanDraft = Record<SmMarketWeekdayKey, string | null>;

export function createSmWeeklyPlanDraft(hours: Partial<Record<SmMarketWeekdayKey, number>> = {}): SmWeeklyPlanDraft {
  return Object.fromEntries(SM_PLANNING_DAYS.map(({ key }) => [
    key, hours[key] === undefined ? null : String(hours[key]).replace(".", ","),
  ])) as SmWeeklyPlanDraft;
}

export function readSmWeeklyPlanDraft(draft: SmWeeklyPlanDraft): {
  weekdayHours: SmMarketWeekdayHours;
  serviceDaysPerWeek: number;
  weeklyHours: number | undefined;
  error: string | null;
} {
  const weekdayHours: SmMarketWeekdayHours = { mo: null, di: null, mi: null, do: null, fr: null };
  let serviceDaysPerWeek = 0;
  let totalHundredths = 0;
  let error: string | null = null;
  for (const { key, label } of SM_PLANNING_DAYS) {
    const raw = draft[key];
    if (raw === null) continue;
    serviceDaysPerWeek += 1;
    const text = raw.trim();
    const value = Number(text.replace(",", "."));
    if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(text) || !Number.isFinite(value) || value <= 0 || value > 24) {
      error ??= `${label}: Bitte Stunden zwischen 0,01 und 24 eingeben (max. 2 Nachkommastellen).`;
      continue;
    }
    weekdayHours[key] = value;
    totalHundredths += Math.round(value * 100);
  }
  return { weekdayHours, serviceDaysPerWeek, weeklyHours: error ? undefined : totalHundredths / 100, error };
}
