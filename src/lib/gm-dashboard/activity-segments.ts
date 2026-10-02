// Trim only shared edges. Tiny categories retain their own non-overlapping tile.
export function activitySegments(total: number, standard: number, flex: number) {
  const values = total > 0
    ? [Math.min(total, Math.max(0, standard)), Math.min(Math.max(0, total - standard), Math.max(0, flex))]
    : [0, 0];
  const portions = total > 0 ? [...values, Math.max(0, total - values[0]! - values[1]!)] : [0, 0, 1];
  const sum = total > 0 ? total : 1;
  const present = portions.map((value, index) => ({ value, index })).filter((s) => s.value > 0);
  let angle = 180;
  return present.map(({ value, index }, position) => {
    const span = 180 * value / sum;
    const inset = Math.min(2, span / 4);
    const start = angle + (position > 0 ? inset : 0);
    angle += span;
    const end = position === present.length - 1 ? 360 : angle - inset;
    return { index, start, end };
  });
}
