import type { IppInterval } from "@/lib/ipp-dashboard/intervals";

export type FuellstandFilterScope = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
  marketId: string | null;
  stc: "gold" | "silver" | "bronze" | null;
};

export type FuellstandTypeKey = "cooler" | "singleServe" | "multiServe" | "promos" | "warehouse";

export type FuellstandTypeCounts = {
  voll: number;
  mittel: number;
  leer: number;
  total: number;
};

export type FuellstandLinePoint = {
  intervalId: string;
  label: string;
  shortLabel: string;
  typeScores: Record<FuellstandTypeKey, number>;
  typeCounts: Record<FuellstandTypeKey, FuellstandTypeCounts>;
};

export type FuellstandDoneProgress = {
  donePercent: number;
  doneCount: number;
  openCount: number;
  totalCount: number;
};

type BuildSeriesInput = {
  intervals: IppInterval[];
  filters: FuellstandFilterScope;
};

type BuildProgressInput = {
  selectedIntervalId: string | null;
  filters: FuellstandFilterScope;
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

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

const TYPE_VARIANTS: Array<{
  key: FuellstandTypeKey;
  baseFull: number;
  baseMid: number;
  phase: number;
  totalBase: number;
  slope: number;
}> = [
  { key: "cooler", baseFull: 0.56, baseMid: 0.26, phase: 0.1, totalBase: 34, slope: 0.12 },
  { key: "singleServe", baseFull: 0.48, baseMid: 0.31, phase: 0.9, totalBase: 31, slope: -0.07 },
  { key: "multiServe", baseFull: 0.41, baseMid: 0.33, phase: 1.7, totalBase: 29, slope: 0.04 },
  { key: "promos", baseFull: 0.34, baseMid: 0.36, phase: 2.5, totalBase: 26, slope: -0.11 },
  { key: "warehouse", baseFull: 0.52, baseMid: 0.27, phase: 3.2, totalBase: 33, slope: 0.09 },
];

function computeCountsAndScore(
  type: (typeof TYPE_VARIANTS)[number],
  seedBase: number,
  intervalId: string,
  index: number,
  totalIntervals: number,
): { counts: FuellstandTypeCounts; score: number } {
  const rng = createSeededRandom(hashString(`${seedBase}|${intervalId}|${type.key}`));
  const progress = totalIntervals <= 1 ? 0 : index / (totalIntervals - 1);
  const macroWave = Math.sin(index / 1.6 + type.phase) * 0.17 + Math.cos(index / 3.2 + type.phase * 0.7) * 0.11;
  const microWave = Math.cos(index / 0.95 + type.phase * 1.4) * 0.05;
  const slopeShift = (progress - 0.5) * type.slope;
  const spike = (rng() > 0.78 ? (rng() - 0.5) * 0.32 : 0) + (rng() - 0.5) * 0.11;
  const fullShare = clamp(type.baseFull + macroWave + microWave + slopeShift + spike, 0.04, 0.93);
  const midShareRaw = clamp(
    type.baseMid - macroWave * 0.48 + Math.sin(index / 2.1 + type.phase * 0.9) * 0.09 + (rng() - 0.5) * 0.14,
    0.03,
    0.9,
  );
  const midShare = Math.min(midShareRaw, 0.96 - fullShare);
  const emptyShare = clamp(1 - fullShare - midShare, 0.01, 0.9);

  const total = Math.max(8, Math.round(type.totalBase + rng() * 22 + Math.sin(index * 0.62 + type.phase) * 8));
  let voll = Math.round(total * fullShare);
  let mittel = Math.round(total * midShare);
  let leer = Math.round(total * emptyShare);

  const drift = total - (voll + mittel + leer);
  leer += drift;
  if (leer < 0) {
    const missing = Math.abs(leer);
    leer = 0;
    const shiftFromMittel = Math.min(mittel, Math.ceil(missing / 2));
    mittel -= shiftFromMittel;
    voll = Math.max(0, voll - (missing - shiftFromMittel));
  }

  const fixedTotal = Math.max(1, voll + mittel + leer);
  const score = roundOne(((voll * 100) + (mittel * 50)) / fixedTotal);
  return {
    counts: { voll, mittel, leer, total: fixedTotal },
    score,
  };
}

function scopeKey(scope: FuellstandFilterScope): string {
  return `r:${scope.region ?? "_"}|g:${scope.gmId ?? "_"}|c:${scope.chain ?? "_"}|m:${scope.marketId ?? "_"}|s:${scope.stc ?? "_"}`;
}

export function buildFuellstandSeries(input: BuildSeriesInput): FuellstandLinePoint[] {
  const sorted = [...input.intervals].sort((left, right) => left.startMs - right.startMs);
  if (sorted.length === 0) return [];
  const seedBase = hashString(`${scopeKey(input.filters)}|availability-score|${sorted.map((interval) => interval.id).join("|")}`);

  return sorted.map((interval, index) => {
    const typeScores = {} as Record<FuellstandTypeKey, number>;
    const typeCounts = {} as Record<FuellstandTypeKey, FuellstandTypeCounts>;
    TYPE_VARIANTS.forEach((type) => {
      const result = computeCountsAndScore(type, seedBase, interval.id, index, sorted.length);
      typeScores[type.key] = result.score;
      typeCounts[type.key] = result.counts;
    });

    return {
      intervalId: interval.id,
      label: interval.label,
      shortLabel: interval.shortLabel,
      typeScores,
      typeCounts,
    };
  });
}

export function buildDoneProgress(input: BuildProgressInput): FuellstandDoneProgress {
  const seed = hashString(`${scopeKey(input.filters)}|${input.selectedIntervalId ?? "none"}|done-progress`);
  const rng = createSeededRandom(seed);
  const totalCount = 180 + Math.round(rng() * 260);
  const donePercent = Math.round(clamp(58 + rng() * 34, 0, 100));
  const doneCount = Math.round((totalCount * donePercent) / 100);
  const openCount = Math.max(0, totalCount - doneCount);
  return {
    donePercent,
    doneCount,
    openCount,
    totalCount,
  };
}
