// Trim only empty edges of the plotted range, not missing intervals between
// observations. The full calendar/data remains available to filters and exports.
export function populatedChartRange<T>(
  points: readonly T[],
  hasData: (point: T) => boolean,
): T[] {
  const first = points.findIndex(hasData);
  if (first < 0) return [];
  let last = points.length - 1;
  while (last > first && !hasData(points[last]!)) last--;
  return points.slice(first, last + 1);
}

// Fill the actual viewport when there are few intervals; keep a readable
// minimum spacing and horizontal scrolling when the series is long.
export function chartContentWidth(
  viewportWidth: number,
  pointCount: number,
  paddingLeft: number,
  paddingRight: number,
  minPointGap = 56,
): number {
  return Math.max(
    viewportWidth > 0 ? viewportWidth : 920,
    paddingLeft + paddingRight + Math.max(0, pointCount - 1) * minPointGap,
  );
}

// Unlike the line charts, bar groups keep compact, fixed spacing. A short
// series is centered instead of being stretched to opposite viewport edges.
export function compactBarLayout(
  viewportWidth: number,
  count: number,
  left: number,
  right: number,
  gap = 56,
) {
  const seriesWidth = count * gap;
  const width = Math.max(
    viewportWidth > 0 ? viewportWidth : 920,
    left + right + seriesWidth,
  );
  return {
    width,
    step: gap,
    firstCenter: left + (width - left - right - seriesWidth) / 2 + gap / 2,
  };
}

// Include the points bordering the viewport so a line entering from either
// edge stays in range, but distant off-screen history cannot flatten the scale.
export function chartViewportRange<T>(
  points: readonly T[],
  contentWidth: number,
  paddingLeft: number,
  paddingRight: number,
  scrollLeft: number,
  viewportWidth: number,
): readonly T[] {
  if (points.length < 2 || viewportWidth <= 0) return points;
  const step =
    (contentWidth - paddingLeft - paddingRight) / (points.length - 1);
  if (step <= 0) return points;
  const first = Math.max(
    0,
    Math.min(points.length - 1, Math.floor((scrollLeft - paddingLeft) / step)),
  );
  const last = Math.max(
    first,
    Math.min(
      points.length - 1,
      Math.ceil((scrollLeft + viewportWidth - paddingLeft) / step),
    ),
  );
  return points.slice(first, last + 1);
}

export function percentageChartScale(values: readonly number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 100, ticks: [100, 50, 0] };
  const low = Math.min(...finite),
    high = Math.max(...finite);
  // Flat/single-point series still need a nonzero domain and readable labels.
  const margin = (high - low || 5) * 0.2;
  const min = Math.max(0, low - margin),
    max = Math.min(100, high + margin);
  return { min, max, ticks: [max, (min + max) / 2, min] };
}
