import type { IppInterval } from "@/lib/ipp-dashboard/intervals";

export type FuellstandFilterScope = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
  stc: "gold" | "silver" | "bronze" | null;
};

export type FuellstandLinePoint = {
  intervalId: string;
  label: string;
  shortLabel: string;
  voll: number;
  mittel: number;
  leer: number;
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

function normalizeTripleToHundred(vollRaw: number, mittelRaw: number, leerRaw: number): { voll: number; mittel: number; leer: number } {
  const sum = vollRaw + mittelRaw + leerRaw;
  if (sum <= 0) return { voll: 33.4, mittel: 33.3, leer: 33.3 };
  let voll = roundOne((vollRaw / sum) * 100);
  let mittel = roundOne((mittelRaw / sum) * 100);
  let leer = roundOne((leerRaw / sum) * 100);
  const drift = roundOne(100 - (voll + mittel + leer));
  leer = roundOne(leer + drift);
  if (leer < 0) {
    const missing = Math.abs(leer);
    leer = 0;
    const half = roundOne(missing / 2);
    voll = roundOne(clamp(voll - half, 0, 100));
    mittel = roundOne(clamp(mittel - (missing - half), 0, 100));
  }
  const fix = roundOne(100 - (voll + mittel + leer));
  if (fix !== 0) {
    leer = roundOne(clamp(leer + fix, 0, 100));
  }
  return { voll, mittel, leer };
}

function scopeKey(scope: FuellstandFilterScope): string {
  return `r:${scope.region ?? "_"}|g:${scope.gmId ?? "_"}|c:${scope.chain ?? "_"}|s:${scope.stc ?? "_"}`;
}

export function buildFuellstandSeries(input: BuildSeriesInput): FuellstandLinePoint[] {
  const sorted = [...input.intervals].sort((left, right) => left.startMs - right.startMs);
  if (sorted.length === 0) return [];
  const seedBase = hashString(`${scopeKey(input.filters)}|${sorted.map((interval) => interval.id).join("|")}`);
  const trendRng = createSeededRandom(seedBase);
  const volatility = 0.08 + trendRng() * 0.1;

  return sorted.map((interval, index) => {
    const localRng = createSeededRandom(hashString(`${seedBase}|${interval.id}`));
    const wave = Math.sin(index / 2.4) * 0.18;
    const tilt = (index / Math.max(sorted.length - 1, 1)) * 0.12;
    const noiseA = (localRng() - 0.5) * volatility;
    const noiseB = (localRng() - 0.5) * volatility;
    const noiseC = (localRng() - 0.5) * volatility;

    const vollRaw = 0.42 + wave + tilt + noiseA;
    const mittelRaw = 0.34 - wave * 0.45 + noiseB;
    const leerRaw = 0.24 - tilt * 0.65 + noiseC;
    const normalized = normalizeTripleToHundred(vollRaw, mittelRaw, leerRaw);

    return {
      intervalId: interval.id,
      label: interval.label,
      shortLabel: interval.shortLabel,
      voll: normalized.voll,
      mittel: normalized.mittel,
      leer: normalized.leer,
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
