export const AVAILABILITY_DISPLAY_LABELS: Record<string, string> = {
  Voll: "Top",
  voll: "Top",
  "Sehr voll": "Top",
  Mittel: "Mediocre",
  mittel: "Mediocre",
  "Halb voll": "Mediocre",
  Leer: "Bad",
  leer: "Bad",
  "Nicht voll": "Bad",
};

export function formatAvailabilityLabel(value: string): string {
  return AVAILABILITY_DISPLAY_LABELS[value] ?? value;
}
