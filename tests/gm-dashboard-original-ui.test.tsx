import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { aggregateDashboard } from "../backend/src/lib/gm-dashboard";
import {
  availabilitySeries,
  availabilityDistribution,
  placementSeries,
  placementPie,
} from "../src/lib/gm-dashboard/chart-adapters";
import { IppLineChart } from "../src/components/admin/gm-dashboard/charts/IppLineChart";
import { FuellstandLineChart } from "../src/components/admin/gm-dashboard/charts/FuellstandLineChart";
import { FuellstandDistributionChart } from "../src/components/admin/gm-dashboard/charts/FuellstandDistributionChart";
import { PlatzierungenBarChart } from "../src/components/admin/gm-dashboard/charts/PlatzierungenBarChart";

const scope = {
  region: null,
  gmId: null,
  marketId: null,
  chain: null,
  stc: null,
};
function points() {
  return aggregateDashboard(
    [1, 2, 3].map((i) => ({
      id: String(i),
      label: `Besuch ${i}`,
      shortLabel: `B${i}`,
      start: `2026-09-0${i}`,
      end: `2026-09-0${i}`,
    })),
    [],
    scope,
  ).points;
}
const noop = () => {};
test("dashboard mounts the original four cards and original asymmetric bottom columns", () => {
  const page = readFileSync(
    new URL("../src/app/admin/gm-dashboard/page.tsx", import.meta.url),
    "utf8",
  );
  for (const component of [
    "IppAuswertungCard",
    "FuellstandCard",
    "PlatzierungenCard",
    "PlaceholderCardNine",
  ])
    assert.match(page, new RegExp(`<${component} />`));
  assert.match(page, /minmax\(520px, 1\.35fr\) minmax\(260px, 0\.65fr\)/);
  assert.doesNotMatch(page, /<RealDashboardCard/);
  const activity = readFileSync(
    new URL(
      "../src/components/admin/gm-dashboard/PlaceholderCardNine.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(activity, /describeDonutSegment/);
  assert.match(activity, /gridTemplateColumns: "1fr 1px 1fr"/);
  assert.match(activity, /height: 152/);
  assert.match(activity, /DateRangeDropdown/);
});
test("original availability charts receive observation means and true distribution; no NaN SVG on missing values", () => {
  const data = points();
  data[0].availability.Cooler = {
    top: 2,
    mediocre: 1,
    bad: 1,
    total: 4,
    average: 62.5,
  };
  data[2].availability.Cooler = {
    top: 0,
    mediocre: 0,
    bad: 1,
    total: 1,
    average: 0,
  };
  const series = availabilitySeries(data),
    distribution = availabilityDistribution(series, "cooler");
  assert.equal(series[0].typeScores.cooler, 62.5);
  assert.equal(distribution[0].vollPct, 50);
  assert.equal(distribution[0].mittelPct, 25);
  assert.equal(distribution[0].leerPct, 25);
  assert.ok(Number.isNaN(series[1].typeScores.cooler));
  assert.ok(Number.isNaN(series[0].typeScores.warehouse));
  assert.equal(series[2].typeScores.cooler, 0);
  for (const html of [
    renderToStaticMarkup(
      <FuellstandLineChart
        points={series}
        highlightedTypeKey="cooler"
        selectedIntervalId="1"
        onSelectInterval={noop}
      />,
    ),
    renderToStaticMarkup(
      <FuellstandDistributionChart
        points={distribution}
        highlightedTypeKey="cooler"
        selectedIntervalId="1"
        onSelectInterval={noop}
      />,
    ),
  ]) {
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(html, /stroke-dasharray|pattern/);
  }
});
test("original IPP chart preserves gaps instead of fake zero observations", () => {
  const data = points();
  data[0].ipp = 2;
  data[2].ipp = 0;
  const html = renderToStaticMarkup(
    <IppLineChart
      points={data.map((p) => ({
        intervalId: p.id,
        label: p.label,
        shortLabel: p.shortLabel,
        value: p.ipp ?? NaN,
        compareValue: null,
      }))}
      ytdAverage={1}
      selectedIntervalId="1"
      compareEnabled={false}
      delta={null}
      onSelectInterval={noop}
    />,
  );
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /YTD Ø 1\.0/);
});
test("original placement chart displays configured signed points, not invented percentages", () => {
  const data = points();
  data[0].placements = -2;
  data[0].competitor = 3;
  data[0].ippPlacement = 2;
  const series = placementSeries(data);
  assert.equal(series[0].coke, -2);
  assert.ok(Number.isNaN(series[1].coke));
  const html = renderToStaticMarkup(
    <PlatzierungenBarChart
      points={series}
      selectedIntervalId="1"
      onSelectInterval={noop}
    />,
  );
  assert.doesNotMatch(html, /NaN|Infinity|>25%<|>50%<|>100%</);
  const pie = placementPie(data);
  assert.equal(pie.slices[0].count, 2);
  assert.equal(pie.slices[1].count, -2);
});
