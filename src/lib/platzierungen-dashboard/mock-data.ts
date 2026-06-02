import type { IppInterval } from "@/lib/ipp-dashboard/intervals";

export type PlatzierungenFilterScope = {
  region: string | null;
  gmId: string | null;
  chain: string | null;
  stc: "gold" | "silver" | "bronze" | null;
};

export type PlatzierungenBarPoint = {
  intervalId: string;
  label: string;
  shortLabel: string;
  coke: number;
  competitor: number;
};

type BuildSeriesInput = {
  intervals: IppInterval[];
  filters: PlatzierungenFilterScope;
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

function scopeKey(scope: PlatzierungenFilterScope): string {
  return `r:${scope.region ?? "_"}|g:${scope.gmId ?? "_"}|c:${scope.chain ?? "_"}|s:${scope.stc ?? "_"}`;
}

export function buildPlatzierungenSeries(input: BuildSeriesInput): PlatzierungenBarPoint[] {
  const sorted = [...input.intervals].sort((left, right) => left.startMs - right.startMs);
  if (sorted.length === 0) return [];

  const seedBase = hashString(`${scopeKey(input.filters)}|${sorted.map((interval) => interval.id).join("|")}|platz`);
  const trendRng = createSeededRandom(seedBase);
  const baseShare = 52 + trendRng() * 10;
  const volatility = 3.6 + trendRng() * 2.2;

  return sorted.map((interval, index) => {
    const localRng = createSeededRandom(hashString(`${seedBase}|${interval.id}`));
    const trend = (index / Math.max(sorted.length - 1, 1)) * 8;
    const wave = Math.sin(index / 2.15) * 4.4;
    const noise = (localRng() - 0.5) * volatility;
    const coke = roundOne(clamp(baseShare + trend + wave + noise, 34, 86));
    const competitor = roundOne(100 - coke);
    return {
      intervalId: interval.id,
      label: interval.label,
      shortLabel: interval.shortLabel,
      coke,
      competitor,
    };
  });
}
