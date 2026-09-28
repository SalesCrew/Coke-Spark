import type { DashboardPoint, AvailabilityType } from "@/types/gm-dashboard";
export function availabilitySummary(
  point: DashboardPoint | undefined,
  type: AvailabilityType | null,
) {
  const counts = type
    ? point
      ? [point.availability[type]]
      : []
    : Object.values(point?.availability ?? {});
  const top = counts.reduce((sum, c) => sum + c.top, 0),
    mediocre = counts.reduce((sum, c) => sum + c.mediocre, 0),
    bad = counts.reduce((sum, c) => sum + c.bad, 0);
  const total = top + mediocre + bad;
  return {
    top,
    mediocre,
    bad,
    total,
    average: total ? (top * 100 + mediocre * 50) / total : null,
    topPct: total ? (top / total) * 100 : null,
    mediocrePct: total ? (mediocre / total) * 100 : null,
    badPct: total ? (bad / total) * 100 : null,
  };
}
export function averageIppYtd(points: DashboardPoint[], today: string) {
  // Average of populated intervals in the current calendar year, not the entire
  // multi-year chart. RED intervals are attributed to their start calendar year.
  const rows = points.filter(
    (p) =>
      p.start.slice(0, 4) === today.slice(0, 4) &&
      p.start <= today &&
      p.ipp != null,
  );
  return rows.length
    ? rows.reduce((sum, p) => sum + p.ipp!, 0) / rows.length
    : null;
}
export function calendarToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
