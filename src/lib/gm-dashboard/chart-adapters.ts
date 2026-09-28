import type { DashboardPoint } from "@/types/gm-dashboard";
import type {
  FuellstandLinePoint,
  FuellstandTypeKey,
} from "@/lib/fuellstand-dashboard/mock-data";
import type { IppPieSlice } from "@/lib/ipp-dashboard/mock-data";

export const availabilityKeys = {
  cooler: "Cooler",
  singleServe: "SingleServe",
  multiServe: "MultiServe",
  promos: "Promos",
  warehouse: "Warehouse",
} as const;

// The original chart contracts use numbers. NaN is an internal missing-point
// marker, never a zero observation or an API/export value; renderers skip it.
export function availabilitySeries(
  points: DashboardPoint[],
): FuellstandLinePoint[] {
  return [...points]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((point) => ({
      intervalId: point.id,
      label: point.label,
      shortLabel: point.shortLabel,
      typeScores: Object.fromEntries(
        Object.entries(availabilityKeys).map(([key, type]) => [
          key,
          point.availability[type].average ?? NaN,
        ]),
      ) as FuellstandLinePoint["typeScores"],
      typeCounts: Object.fromEntries(
        Object.entries(availabilityKeys).map(([key, type]) => {
          const c = point.availability[type];
          return [
            key,
            { voll: c.top, mittel: c.mediocre, leer: c.bad, total: c.total },
          ];
        }),
      ) as FuellstandLinePoint["typeCounts"],
    }));
}
export function availabilityDistribution(
  series: FuellstandLinePoint[],
  type: FuellstandTypeKey | null,
) {
  return series.map((point) => {
    const counts = type
      ? [point.typeCounts[type]]
      : Object.values(point.typeCounts);
    const vollCount = counts.reduce((s, c) => s + c.voll, 0),
      mittelCount = counts.reduce((s, c) => s + c.mittel, 0),
      leerCount = counts.reduce((s, c) => s + c.leer, 0);
    const totalCount = vollCount + mittelCount + leerCount;
    return {
      intervalId: point.intervalId,
      label: point.label,
      shortLabel: point.shortLabel,
      vollCount,
      mittelCount,
      leerCount,
      totalCount,
      vollPct: totalCount ? (100 * vollCount) / totalCount : NaN,
      mittelPct: totalCount ? (100 * mittelCount) / totalCount : NaN,
      leerPct: totalCount ? (100 * leerCount) / totalCount : NaN,
    };
  });
}
export function inventoryProgress(point?: DashboardPoint) {
  const doneCount = point?.availabilityAnswered ?? 0,
    totalCount = point?.availabilityExpected ?? 0;
  return {
    doneCount,
    totalCount,
    openCount: totalCount - doneCount,
    donePercent: totalCount ? Math.round((100 * doneCount) / totalCount) : 0,
  };
}
export function placementSeries(points: DashboardPoint[]) {
  return [...points]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((p) => ({
      intervalId: p.id,
      label: p.label,
      shortLabel: p.shortLabel,
      coke: p.placements ?? NaN,
      competitor: p.competitor ?? NaN,
    }));
}
export function placementPie(points: DashboardPoint[]) {
  const placement = points.reduce((sum, p) => sum + (p.ippPlacement ?? 0), 0),
    secondPlacement = points.reduce((sum, p) => sum + (p.placements ?? 0), 0);
  const total = placement + secondPlacement;
  const slices: IppPieSlice[] = [
    {
      id: "placement",
      label: "Platzierung",
      count: placement,
      percent: total ? (100 * placement) / total : 0,
      color: "#DC2626",
    },
    {
      id: "secondPlacement",
      label: "Zweitplatzierung",
      count: secondPlacement,
      percent: total ? (100 * secondPlacement) / total : 0,
      color: "#D98A7E",
    },
  ];
  return { slices, total };
}
