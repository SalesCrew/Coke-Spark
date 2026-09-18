const VIENNA_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Vienna",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_INDEX = new Map([
  ["Mon", 0],
  ["Tue", 1],
  ["Wed", 2],
  ["Thu", 3],
  ["Fri", 4],
  ["Sat", 5],
  ["Sun", 6],
]);

export function smWorkweekProgress(now = new Date()): { currentDayIndex: number; dates: string[]; progress: number } {
  const parts = Object.fromEntries(VIENNA_CLOCK.formatToParts(now).map(({ type, value }) => [type, value]));
  const weekdayIndex = WEEKDAY_INDEX.get(parts.weekday) ?? 0;
  const currentDayIndex = Math.min(4, weekdayIndex);
  const dayProgress = Math.min(1, Math.max(0, (Number(parts.hour) * 60 + Number(parts.minute)) / (24 * 60)));
  const timeBasedWeekIndex = Math.min(4, currentDayIndex + dayProgress);
  const monday = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - weekdayIndex);
  return {
    currentDayIndex,
    dates: Array.from({ length: 5 }, (_, index) => new Date(monday + index * 86_400_000).toISOString().slice(0, 10)),
    progress: Math.round((timeBasedWeekIndex / 4) * 1000) / 10,
  };
}
