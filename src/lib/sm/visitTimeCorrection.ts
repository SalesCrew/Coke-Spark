const viennaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function toViennaDateTimeInput(iso: string): string {
  const parts = Object.fromEntries(viennaFormatter.formatToParts(new Date(iso)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromViennaDateTimeInput(value: string, preferredIso?: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [year, month, day, hour, minute] = value.match(/\d+/g)!.map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [120, 60].map(offset => new Date(wallClock - offset * 60_000).toISOString())
    .filter(candidate => toViennaDateTimeInput(candidate) === value);
  if (preferredIso && candidates.some(candidate => new Date(candidate).getTime() === new Date(preferredIso).getTime())) return new Date(preferredIso).toISOString();
  return candidates[0] ?? null;
}
