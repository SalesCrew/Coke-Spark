export function actionPeriodLabel(from?: string | null, until?: string | null): string {
  if (!from || !until) return "Aktionszeitraum noch nicht hinterlegt";
  const format = (value: string) => new Date(value + "T12:00:00Z").toLocaleDateString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna",
  });
  return from === until ? format(from) : `${format(from)} – ${format(until)}`;
}
