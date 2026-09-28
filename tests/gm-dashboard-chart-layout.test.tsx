import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  populatedChartRange,
  chartContentWidth,
  chartViewportRange,
  percentageChartScale,
  compactBarLayout,
} from "../src/lib/gm-dashboard/chart-layout";
import { aggregateDashboard } from "../backend/src/lib/gm-dashboard";
import {
  availabilitySeries,
  availabilityDistribution,
  placementSeries,
} from "../src/lib/gm-dashboard/chart-adapters";
import { IppLineChart } from "../src/components/admin/gm-dashboard/charts/IppLineChart";
import { FuellstandLineChart } from "../src/components/admin/gm-dashboard/charts/FuellstandLineChart";
import { FuellstandDistributionChart } from "../src/components/admin/gm-dashboard/charts/FuellstandDistributionChart";
import { PlatzierungenBarChart } from "../src/components/admin/gm-dashboard/charts/PlatzierungenBarChart";

const noop = () => {};
const scope = {
  region: null,
  gmId: null,
  chain: null,
  marketId: null,
  stc: null,
};

test("percentage axis follows observed min/max with 20% range padding, safe boundaries and flat/empty data", () => {
  assert.deepEqual(percentageChartScale([85, 90, 95, NaN]), {
    min: 83,
    max: 97,
    ticks: [97, 90, 83],
  });
  assert.deepEqual(percentageChartScale([90, 90]), {
    min: 89,
    max: 91,
    ticks: [91, 90, 89],
  });
  assert.deepEqual(percentageChartScale([0]), {
    min: 0,
    max: 1,
    ticks: [1, 0.5, 0],
  });
  assert.deepEqual(percentageChartScale([100]), {
    min: 99,
    max: 100,
    ticks: [100, 99.5, 99],
  });
  assert.deepEqual(percentageChartScale([0, 100]), {
    min: 0,
    max: 100,
    ticks: [100, 50, 0],
  });
  assert.deepEqual(percentageChartScale([NaN, Infinity]), {
    min: 0,
    max: 100,
    ticks: [100, 50, 0],
  });
});

test("axis uses the horizontal viewport and its boundary points, not distant historical extremes", () => {
  const values = [0, 90, 91, 92, 93, 94, 95, 96, 97, 100];
  // 56 px interval gap, viewport starts after the old zero-valued period.
  assert.deepEqual(
    chartViewportRange(values, 554, 34, 16, 146, 168),
    [91, 92, 93, 94],
  );
  const scale = percentageChartScale(
    chartViewportRange(values, 554, 34, 16, 146, 168),
  );
  assert.equal(scale.min, 90.4);
  assert.equal(scale.max, 94.6);
  assert.deepEqual(chartViewportRange(values, 554, 34, 16, 0, 554), values);
  assert.deepEqual(chartViewportRange([90], 554, 34, 16, 0, 200), [90]);
});

test("availability renders zoomed percentage labels and expands close values vertically without changing them", () => {
  const data = aggregateDashboard(intervals, [], scope).points;
  data[6]!.availability.Cooler = {
    top: 0,
    mediocre: 0,
    bad: 0,
    total: 1,
    average: 85,
  };
  data[7]!.availability.Cooler = {
    top: 0,
    mediocre: 0,
    bad: 0,
    total: 1,
    average: 90,
  };
  data[8]!.availability.Cooler = {
    top: 0,
    mediocre: 0,
    bad: 0,
    total: 1,
    average: 95,
  };
  const series = availabilitySeries(data);
  const html = renderToStaticMarkup(
    <FuellstandLineChart
      points={series}
      highlightedTypeKey={null}
      selectedIntervalId="09"
      onSelectInterval={noop}
    />,
  );
  assert.match(html, />97%</);
  assert.match(html, />90%</);
  assert.match(html, />83%</);
  assert.doesNotMatch(html, />100%<|>50%<|>0%<|NaN|Infinity/);
  const ys = [
    ...html.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"[^>]*fill-opacity/g),
  ].map((m) => Number(m[1]));
  assert.equal(ys.length, 3);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 160); // Former fixed scale spread: only 23.2 px.
  assert.deepEqual(
    series.slice(6, 9).map((p) => p.typeScores.cooler),
    [85, 90, 95],
  );
});
const intervals = Array.from({ length: 10 }, (_, i) => {
  const month = String(i + 1).padStart(2, "0");
  return {
    id: month,
    label: `RED ${month}`,
    shortLabel: `RED ${month}`,
    start: `2026-${month}-01`,
    end: `2026-${month}-28`,
  };
});
function makePoints() {
  const points = aggregateDashboard(intervals, [], scope).points;
  for (const index of [6, 7, 8]) {
    points[index]!.ipp = index - 6; // A genuine zero must remain on the axis.
    points[index]!.placements = index - 6;
    points[index]!.competitor = 3;
    points[index]!.availability.Cooler = {
      top: 1,
      mediocre: 0,
      bad: 0,
      total: 1,
      average: 100,
    };
  }
  return points;
}
function axisLabels(html: string) {
  return [...html.matchAll(/<text x="([\d.]+)"[^>]*>(RED \d+)<\/text>/g)].map(
    (match) => ({ x: Number(match[1]), label: match[2] }),
  );
}

test("only empty outer intervals are trimmed; internal gaps, zeros and original input survive", () => {
  const points = [NaN, NaN, 0, NaN, 5, NaN];
  assert.deepEqual(populatedChartRange(points, Number.isFinite), [0, NaN, 5]);
  assert.deepEqual(points, [NaN, NaN, 0, NaN, 5, NaN]);
  assert.deepEqual(populatedChartRange([NaN, NaN], Number.isFinite), []);
  assert.deepEqual(populatedChartRange([], Number.isFinite), []);
  assert.deepEqual(populatedChartRange([NaN, 0, NaN], Number.isFinite), [0]);
});

test("sparse series fill narrow and wide viewports; dense series retain minimum spacing and scroll", () => {
  for (const viewport of [320, 920, 1440, 1800]) {
    assert.equal(chartContentWidth(viewport, 3, 34, 16), viewport);
    const plotWidth = chartContentWidth(viewport, 3, 34, 16) - 34 - 16;
    assert.equal(34 + 2 * (plotWidth / 2), viewport - 16);
    assert.equal(chartContentWidth(viewport, 1, 34, 16), viewport);
    assert.equal(chartContentWidth(viewport, 0, 34, 16), viewport);
  }
  assert.equal(chartContentWidth(320, 30, 34, 16), 50 + 29 * 56);
  assert.equal(chartContentWidth(1800, 30, 34, 16), 1800);
});

test("line chart renderers spread RED 07–09 across the whole plotted range", () => {
  const points = makePoints();
  const series = availabilitySeries(points);
  const cases = [
    {
      element: (
        <IppLineChart
          points={points.map((p) => ({
            intervalId: p.id,
            label: p.label,
            shortLabel: p.shortLabel,
            value: p.ipp ?? NaN,
            compareValue: null,
          }))}
          ytdAverage={1}
          selectedIntervalId="09"
          compareEnabled={false}
          delta={null}
          onSelectInterval={noop}
        />
      ),
      left: 10,
      right: 10,
    },
    {
      element: (
        <FuellstandLineChart
          points={series}
          highlightedTypeKey={null}
          selectedIntervalId="09"
          onSelectInterval={noop}
        />
      ),
      left: 34,
      right: 16,
    },
    {
      element: (
        <FuellstandDistributionChart
          points={availabilityDistribution(series, null)}
          highlightedTypeKey={null}
          selectedIntervalId="09"
          onSelectInterval={noop}
        />
      ),
      left: 30,
      right: 12,
    },
  ];
  for (const { element, left, right } of cases) {
    const html = renderToStaticMarkup(element);
    assert.doesNotMatch(html, /NaN|Infinity/);
    const labels = axisLabels(html);
    assert.deepEqual(
      labels.map((p) => p.label),
      ["RED 07", "RED 08", "RED 09"],
    );
    assert.equal(labels[0]!.x, left);
    assert.equal(labels[1]!.x, left + (920 - left - right) / 2);
    assert.equal(labels[2]!.x, 920 - right);
  }
  assert.equal(points.length, 10); // Presentation only: no calendar/export truncation.
});

test("Coke bars use compact fixed gaps, not the line-chart auto-spreading rule", () => {
  for (const viewport of [320, 920, 1440, 1800]) {
    const layout = compactBarLayout(viewport, 3, 34, 14);
    assert.equal(layout.width, viewport);
    assert.equal(layout.step, 56);
    assert.equal(
      layout.firstCenter + layout.step,
      34 + (viewport - 34 - 14) / 2,
    );
  }
  assert.ok(compactBarLayout(320, 30, 34, 14).width > 320);
  const points = makePoints();
  const html = renderToStaticMarkup(
    <PlatzierungenBarChart
      points={placementSeries(points)}
      selectedIntervalId="09"
      onSelectInterval={noop}
    />,
  );
  assert.deepEqual(axisLabels(html), [
    { label: "RED 07", x: 414 },
    { label: "RED 08", x: 470 },
    { label: "RED 09", x: 526 },
  ]);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.equal(points[6]!.placements, 0);
});

test("internal missing intervals stay on the IPP axis and split the line, never interpolated", () => {
  const points = makePoints();
  points[7]!.ipp = null;
  const html = renderToStaticMarkup(
    <IppLineChart
      points={points.map((p) => ({
        intervalId: p.id,
        label: p.label,
        shortLabel: p.shortLabel,
        value: p.ipp ?? NaN,
        compareValue: null,
      }))}
      ytdAverage={1}
      selectedIntervalId="09"
      compareEnabled={false}
      delta={null}
      onSelectInterval={noop}
    />,
  );
  assert.deepEqual(
    axisLabels(html).map((p) => p.label),
    ["RED 07", "RED 08", "RED 09"],
  );
  const path = html.match(
    /<path d="([^"]*)" fill="none" stroke="#16A34A"/,
  )![1]!;
  assert.equal((path.match(/M /g) ?? []).length, 2);
  assert.doesNotMatch(path, / C /);
});

test("active comparison extends the plotted range and retains comparison-only dots", () => {
  const points = intervals.map((p, i) => ({
    intervalId: p.id,
    label: p.label,
    shortLabel: p.shortLabel,
    value: i === 8 ? 2 : NaN,
    compareValue: i === 6 ? 1 : null,
  }));
  const render = (enabled: boolean) =>
    renderToStaticMarkup(
      <IppLineChart
        points={points}
        ytdAverage={2}
        selectedIntervalId="09"
        compareEnabled={enabled}
        delta={null}
        onSelectInterval={noop}
      />,
    );
  const enabled = render(true);
  assert.doesNotMatch(enabled, /NaN|Infinity/);
  assert.deepEqual(
    axisLabels(enabled).map((p) => p.label),
    ["RED 07", "RED 08", "RED 09"],
  );
  assert.match(enabled, /<circle cx="10"[^>]+fill="#9CA3AF"/);
  const disabled = render(false);
  assert.deepEqual(axisLabels(disabled), [{ x: 460, label: "RED 09" }]);
});
