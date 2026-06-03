import type { IppInterval } from "@/lib/ipp-dashboard/intervals";

export type IppFilterScope = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
  marketId: string | null;
  stc: "gold" | "silver" | "bronze" | null;
};

export type IppLinePoint = {
  intervalId: string;
  label: string;
  shortLabel: string;
  value: number;
  compareValue: number | null;
};

export type IppPieSlice = {
  id: "placement" | "secondPlacement";
  label: string;
  count: number;
  percent: number;
  color: string;
};

export type IppCompareResult = {
  deltaAbs: number;
  deltaPct: number | null;
};

type BuildLineSeriesInput = {
  intervals: IppInterval[];
  filters: IppFilterScope;
  compareIntervalId: string | null;
};

type BuildPieInput = {
  selectedIntervalId: string | null;
  filters: IppFilterScope;
};

type BuildPieCumulativeInput = {
  intervalIds: string[];
  filters: IppFilterScope;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scopeKey(scope: IppFilterScope): string {
  return `r:${scope.region ?? "_"}|g:${scope.gmId ?? "_"}|c:${scope.chain ?? "_"}|m:${scope.marketId ?? "_"}|s:${scope.stc ?? "_"}`;
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildMockLineSeries(input: BuildLineSeriesInput): IppLinePoint[] {
  const sorted = [...input.intervals].sort((left, right) => left.startMs - right.startMs);
  if (sorted.length === 0) return [];

  const seedBase = hashString(`${scopeKey(input.filters)}|${sorted.map((interval) => interval.id).join("|")}`);
  const seedRng = createSeededRandom(seedBase);
  const base = 5.0 + seedRng() * 0.35;
  const slope = 0.95 / Math.max(sorted.length - 1, 1) + seedRng() * 0.12;
  const filterBias = (seedRng() - 0.5) * 0.18;
  const compareBias = input.compareIntervalId ? ((hashString(input.compareIntervalId) % 100) / 1000) : 0;

  return sorted.map((interval, index) => {
    const noiseRng = createSeededRandom(hashString(`${seedBase}|${interval.id}`));
    const drift = Math.sin((index + 1) / 2.5) * 0.05;
    const noise = (noiseRng() - 0.5) * 0.18;
    const value = toOneDecimal(clamp(base + filterBias + slope * index + drift + noise, 5.0, 7.0));
    let compareValue: number | null = null;
    if (input.compareIntervalId) {
      const compareNoise = (noiseRng() - 0.5) * 0.12;
      compareValue = toOneDecimal(clamp(value - 0.18 - compareBias + compareNoise, 5.0, 7.0));
    }
    return {
      intervalId: interval.id,
      label: interval.label,
      shortLabel: interval.shortLabel,
      value,
      compareValue,
    };
  });
}

export function buildCompareResult(points: IppLinePoint[], selectedIntervalId: string | null): IppCompareResult | null {
  const selected = points.find((point) => point.intervalId === selectedIntervalId) ?? points[points.length - 1];
  if (!selected || selected.compareValue == null) return null;
  const deltaAbs = toOneDecimal(selected.value - selected.compareValue);
  const deltaPct = selected.compareValue === 0
    ? null
    : Math.round(((selected.value - selected.compareValue) / selected.compareValue) * 1000) / 10;
  return { deltaAbs, deltaPct };
}

export function buildMockPieData(input: BuildPieInput): { slices: IppPieSlice[]; total: number } {
  const seed = hashString(`${scopeKey(input.filters)}|${input.selectedIntervalId ?? "none"}|pie`);
  const rng = createSeededRandom(seed);
  const total = 120 + Math.round(rng() * 220);
  const placementShare = clamp(0.56 + (rng() - 0.5) * 0.22, 0.45, 0.78);
  const placementCount = Math.round(total * placementShare);
  const secondCount = total - placementCount;
  const placementPercent = Math.round((placementCount / total) * 1000) / 10;
  const secondPercent = Math.round((secondCount / total) * 1000) / 10;

  return {
    total,
    slices: [
      {
        id: "placement",
        label: "Platzierung",
        count: placementCount,
        percent: placementPercent,
        color: "#111827",
      },
      {
        id: "secondPlacement",
        label: "Zweitplatzierung",
        count: secondCount,
        percent: secondPercent,
        color: "#9CA3AF",
      },
    ],
  };
}

export function buildMockPieCumulativeData(input: BuildPieCumulativeInput): { slices: IppPieSlice[]; total: number } {
  const ids = input.intervalIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) {
    return buildMockPieData({ selectedIntervalId: null, filters: input.filters });
  }

  let placementCount = 0;
  let secondCount = 0;
  for (const intervalId of ids) {
    const pie = buildMockPieData({ selectedIntervalId: intervalId, filters: input.filters });
    placementCount += pie.slices.find((slice) => slice.id === "placement")?.count ?? 0;
    secondCount += pie.slices.find((slice) => slice.id === "secondPlacement")?.count ?? 0;
  }

  const total = placementCount + secondCount;
  const placementPercent = total > 0 ? Math.round((placementCount / total) * 1000) / 10 : 0;
  const secondPercent = total > 0 ? Math.round((secondCount / total) * 1000) / 10 : 0;

  return {
    total,
    slices: [
      {
        id: "placement",
        label: "Platzierung",
        count: placementCount,
        percent: placementPercent,
        color: "#111827",
      },
      {
        id: "secondPlacement",
        label: "Zweitplatzierung",
        count: secondCount,
        percent: secondPercent,
        color: "#9CA3AF",
      },
    ],
  };
}
