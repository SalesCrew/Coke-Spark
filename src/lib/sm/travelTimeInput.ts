/** Format a duration as it is typed, without guessing or clamping its numeric value. */
export function formatSmTravelTimeEdit(raw: string, previous: string, cursor = raw.length) {
  // Let Backspace remove an auto-inserted trailing separator, then the hour digits.
  if (/^\d{2}:$/.test(previous) && raw === previous.slice(0, 2)) {
    return { value: raw, cursor: Math.min(cursor, raw.length) };
  }
  const shortHour = /^\d:\d{0,2}$/.test(raw);
  const digits = `${shortHour ? "0" : ""}${raw.replace(/\D/g, "")}`.slice(0, 4);
  const value = digits.length < 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
  const digitsBeforeCursor = Math.min(4, raw.slice(0, cursor).replace(/\D/g, "").length + (shortHour ? 1 : 0));
  return { value, cursor: Math.min(value.length, digitsBeforeCursor + (digitsBeforeCursor >= 2 ? 1 : 0)) };
}
