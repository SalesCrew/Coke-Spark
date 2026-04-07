"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus, ChevronDown, ChevronRight, Search, X, Check, Trophy,
  Gift, AlertTriangle, Zap, ShoppingBag, Refrigerator, FlaskConical,
  ClipboardList, Pencil, Trash2, TrendingUp, Award, Copy, Eye,
  BarChart3, CheckCircle2, Circle, Minus,
} from "lucide-react";
import { useModules } from "@/context/ModuleContext";
import { useFragebogen } from "@/context/FragebogenContext";
import { useFlexModules, useBillaModules, useKuehlerModules, useMhdModules } from "@/app/admin/adminContexts";
import type { Module } from "@/types/fragebogen";
import type {
  PraemienQuarter, PraemienPillar, PraemienThreshold, PraemienSourceRef, SectionType,
  PraemienQualitySubmission, PraemienQualityCriteria,
} from "@/types/praemien";

// ── Constants ─────────────────────────────────────────────────

const R = "#DC2626";
const RD = "#b91c1c";
const LS_KEY = "admin_praemien_quarters";

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.08)",  Icon: ClipboardList },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.08)", Icon: Zap },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.08)",  Icon: ShoppingBag },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.08)", Icon: Refrigerator },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)", Icon: FlaskConical },
};

const PILLAR_DEFAULTS: Pick<PraemienPillar, "name" | "description" | "color">[] = [
  { name: "Schütten / Displays",  description: "Korrekte Aufstellung und Befüllung von Schüttenregalen und Displays.",  color: "#DC2626" },
  { name: "Distributionsziel",    description: "Zielerreichung bei der Listung und Verfügbarkeit der Kernprodukte.",    color: "#2563eb" },
  { name: "Flexziel",             description: "Ergebnisse aus Flexbesuchen und saisonalen Aktionszielen.",             color: "#16a34a" },
  { name: "Qualitätsziele",       description: "Qualität der Marktbesuche anhand von Bewertungsfragen.",                color: "#D97706" },
];


// ── Utility ───────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 10); }

function buildDefaultPillars(): PraemienPillar[] {
  return PILLAR_DEFAULTS.map(d => ({ id: uid(), ...d, sourceRefs: [] }));
}

function buildDefaultThresholds(totalPoints = 0): PraemienThreshold[] {
  const vollerBonus = Math.round(totalPoints * 0.95);
  const total = vollerBonus > 0 ? vollerBonus / 0.95 : 0;
  return [
    { id: uid(), label: "Kein Bonus",   minPoints: 0,                          rewardEur: 0    },
    { id: uid(), label: "Teilbonus",    minPoints: Math.round(total * 0.70),   rewardEur: 550  },
    { id: uid(), label: "Zielbonus",    minPoints: Math.round(total * 0.80),   rewardEur: 880  },
    { id: uid(), label: "Voller Bonus", minPoints: vollerBonus,                rewardEur: 1100 },
  ];
}

function recalcThresholdsFromVollerBonus(thresholds: PraemienThreshold[], newVollerPoints: number): PraemienThreshold[] {
  const total = newVollerPoints > 0 ? newVollerPoints / 0.95 : 0;
  return thresholds.map(t => {
    if (t.label === "Kein Bonus")   return { ...t, minPoints: 0 };
    if (t.label === "Teilbonus")    return { ...t, minPoints: Math.round(total * 0.70) };
    if (t.label === "Zielbonus")    return { ...t, minPoints: Math.round(total * 0.80) };
    if (t.label === "Voller Bonus") return { ...t, minPoints: newVollerPoints };
    return t;
  });
}

function getQuarterDates(year: number, q: 1 | 2 | 3 | 4): { startDate: string; endDate: string } {
  const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
  const ends   = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
  return { startDate: starts[q - 1], endDate: ends[q - 1] };
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── GM seed list ──────────────────────────────────────────────

const ALL_GMS: { id: string; name: string; region: string }[] = [
  { id: "gm1",  name: "Thomas Huber",  region: "Nord" },
  { id: "gm2",  name: "Anna Gruber",   region: "Süd"  },
  { id: "gm3",  name: "Sandra Mayer",  region: "Ost"  },
  { id: "gm4",  name: "Klaus Berger",  region: "Nord" },
  { id: "gm5",  name: "Michael Huber", region: "West" },
  { id: "gm6",  name: "Anna Fuchs",    region: "Ost"  },
  { id: "gm7",  name: "Stefan Weiß",   region: "West" },
  { id: "gm8",  name: "Julia Schmid",  region: "Süd"  },
  { id: "gm9",  name: "René Hofer",    region: "Nord" },
  { id: "gm10", name: "Lena Fischer",  region: "Ost"  },
];

const REGIONS = ["Nord", "Ost", "Süd", "West"] as const;
type RegionFilter = "Alle" | typeof REGIONS[number];

function calcQualityTotal(scores: PraemienQualityCriteria): number {
  return Math.round((scores.zeiterfassung + scores.reporting + scores.accuracy) / 3);
}

function qualityAvgForQuarter(quarter: PraemienQuarter): number {
  const subs = quarter.qualitySubmissions ?? [];
  if (subs.length === 0) return 0;
  return Math.round(subs.reduce((n, s) => n + s.totalPoints, 0) / subs.length);
}

function qualityIsComplete(quarter: PraemienQuarter): boolean {
  const subs = quarter.qualitySubmissions ?? [];
  return ALL_GMS.every(gm => subs.some(s => s.gmId === gm.id));
}

// ── Seeded GM pillar progress ─────────────────────────────────
// Replace with real data later; shape is stable so the UI doesn't need to change.

interface GmSeedRow {
  schuettenPoints: number;
  distributionPoints: number;
  flexPoints: number;
  schuettenMax: number;
  distributionMax: number;
  flexMax: number;
}

const MOCK_GM_PROGRESS: Record<string, GmSeedRow> = {
  gm1:  { schuettenPoints: 12.5, distributionPoints: 9,   flexPoints: 5.5, schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm2:  { schuettenPoints: 11,   distributionPoints: 8.5, flexPoints: 5,   schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm3:  { schuettenPoints: 12,   distributionPoints: 9.5, flexPoints: 5.5, schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm4:  { schuettenPoints: 10,   distributionPoints: 8,   flexPoints: 6,   schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm5:  { schuettenPoints: 11.5, distributionPoints: 10,  flexPoints: 5,   schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm6:  { schuettenPoints: 13,   distributionPoints: 7.5, flexPoints: 4.5, schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm7:  { schuettenPoints: 9.5,  distributionPoints: 9,   flexPoints: 5.5, schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm8:  { schuettenPoints: 12,   distributionPoints: 9.5, flexPoints: 6,   schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm9:  { schuettenPoints: 8,    distributionPoints: 7,   flexPoints: 4,   schuettenMax: 13, distributionMax: 10, flexMax: 6 },
  gm10: { schuettenPoints: 12.5, distributionPoints: 8.5, flexPoints: 5.5, schuettenMax: 13, distributionMax: 10, flexMax: 6 },
};

const PILLAR_COLORS_LIST = [R, "#2563eb", "#16a34a", "#D97706"] as const;
const QUALITY_MAX = 100;

interface GmProgressRow {
  gmId: string;
  gmName: string;
  pillar0: number; // Schütten / Displays
  pillar1: number; // Distributionsziel
  pillar2: number; // Flexziel
  pillar3: number | null; // Qualitätsziele — null = not yet entered
  pillar0Max: number;
  pillar1Max: number;
  pillar2Max: number;
  currentPoints: number;   // sum of available pillars only
  currentMaxPoints: number; // sum of maxima for available pillars only
  progressPercent: number;
  currentRewardEur: number;
  currentRewardLabel: string;
  isQualityDone: boolean;
  isFinished: boolean; // true only when quality is also done
}

function buildGmProgressRows(
  quarter: PraemienQuarter | null,
): GmProgressRow[] {
  if (!quarter) return [];
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const findTier = (pts: number) => {
    const t = [...sorted].reverse().find(t => pts >= t.minPoints);
    return t ?? sorted[0];
  };

  return ALL_GMS.map(gm => {
    const seed = MOCK_GM_PROGRESS[gm.id] ?? { schuettenPoints: 0, distributionPoints: 0, flexPoints: 0, schuettenMax: 13, distributionMax: 10, flexMax: 6 };
    const qualitySub = (quarter.qualitySubmissions ?? []).find(s => s.gmId === gm.id);
    const p0 = seed.schuettenPoints;
    const p1 = seed.distributionPoints;
    const p2 = seed.flexPoints;
    const p3 = qualitySub ? qualitySub.totalPoints : null;

    const currentPoints     = p0 + p1 + p2 + (p3 ?? 0);
    const currentMaxPoints  = seed.schuettenMax + seed.distributionMax + seed.flexMax + (p3 !== null ? QUALITY_MAX : 0);
    const progressPercent   = currentMaxPoints > 0 ? Math.round((currentPoints / currentMaxPoints) * 100) : 0;
    const tier              = findTier(currentPoints);
    return {
      gmId: gm.id,
      gmName: gm.name,
      pillar0: p0, pillar1: p1, pillar2: p2, pillar3: p3,
      pillar0Max: seed.schuettenMax,
      pillar1Max: seed.distributionMax,
      pillar2Max: seed.flexMax,
      currentPoints, currentMaxPoints, progressPercent,
      currentRewardEur:   tier?.rewardEur ?? 0,
      currentRewardLabel: tier?.label ?? "—",
      isQualityDone: p3 !== null,
      isFinished:    p3 !== null,
    };
  });
}

function buildGmProgressSummary(
  quarter: PraemienQuarter | null,
  regionFilter: RegionFilter = "Alle",
) {
  if (!quarter) return null;
  const allRows = buildGmProgressRows(quarter);
  const rows = regionFilter === "Alle"
    ? allRows
    : allRows.filter(r => ALL_GMS.find(g => g.id === r.gmId)?.region === regionFilter);
  if (rows.length === 0) return null;

  const finishedCount      = rows.filter(r => r.isFinished).length;
  const avgProgressPercent = Math.round(rows.reduce((n, r) => n + r.progressPercent, 0) / rows.length);
  const avgRewardEur       = Math.round(rows.reduce((n, r) => n + r.currentRewardEur, 0) / rows.length);
  const totalRows          = rows.length;

  // Pillar averages (index 0-3)
  const p0avg = rows.reduce((n, r) => n + r.pillar0, 0) / rows.length;
  const p1avg = rows.reduce((n, r) => n + r.pillar1, 0) / rows.length;
  const p2avg = rows.reduce((n, r) => n + r.pillar2, 0) / rows.length;
  // Quality: average only from rows that have it
  const qualityRows = rows.filter(r => r.pillar3 !== null);
  const p3avg = qualityRows.length > 0
    ? qualityRows.reduce((n, r) => n + (r.pillar3 as number), 0) / qualityRows.length
    : null;

  const totalAvgPts = p0avg + p1avg + p2avg + (p3avg ?? 0);
  const share = (v: number) => totalAvgPts > 0 ? Math.round((v / totalAvgPts) * 100) : 0;

  return {
    totalRows,
    finishedCount,
    openCount: totalRows - finishedCount,
    avgProgressPercent,
    avgRewardEur,
    qualityFilledCount: qualityRows.length,
    pillarAverages: [
      { points: p0avg, share: share(p0avg) },
      { points: p1avg, share: share(p1avg) },
      { points: p2avg, share: share(p2avg) },
      { points: p3avg ?? 0, share: share(p3avg ?? 0), missingCount: totalRows - qualityRows.length },
    ],
  };
}

// ── Leaderboard wave history ──────────────────────────────────

interface GmWave {
  waveId: string;
  label: string;        // e.g. "Q1 2026"
  year: number;
  quarter: number;
  status: "finished" | "in_progress";
  rewardEur: number;
  periodLabel: string;  // e.g. "01.01.2026 – 31.03.2026"
}

const MOCK_GM_WAVE_HISTORY: Record<string, GmWave[]> = {
  gm1:  [
    { waveId: "w1-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 550,  periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w1-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w1-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 880,  periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w1-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 1100, periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w1-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w1-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 1100, periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w1-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm2:  [
    { waveId: "w2-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 0,    periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w2-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 550,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w2-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 550,  periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w2-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 880,  periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w2-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w2-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 1100, periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w2-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 880,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm3:  [
    { waveId: "w3-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w3-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w3-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 1100, periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w3-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 1100, periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w3-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 1100, periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w3-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w3-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 880,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm4:  [
    { waveId: "w4-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 550,  periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w4-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 550,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w4-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 880,  periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w4-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 880,  periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w4-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 550,  periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w4-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm5:  [
    { waveId: "w5-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w5-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 1100, periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w5-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 1100, periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w5-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w5-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 1100, periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w5-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm6:  [
    { waveId: "w6-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 550,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w6-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 550,  periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w6-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 880,  periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w6-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 550,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w6-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 880,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm7:  [
    { waveId: "w7-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 550,  periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w7-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 880,  periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w7-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 550,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w7-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w7-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm8:  [
    { waveId: "w8-q1-24", label: "Q1 2024", year: 2024, quarter: 1, status: "finished",     rewardEur: 1100, periodLabel: "01.01.2024 – 31.03.2024" },
    { waveId: "w8-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w8-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 1100, periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w8-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 1100, periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w8-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",     rewardEur: 880,  periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w8-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 880,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm9:  [
    { waveId: "w9-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",     rewardEur: 550,  periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w9-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",     rewardEur: 550,  periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w9-q1-25", label: "Q1 2025", year: 2025, quarter: 1, status: "finished",     rewardEur: 880,  periodLabel: "01.01.2025 – 31.03.2025" },
    { waveId: "w9-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
  gm10: [
    { waveId: "w10-q2-24", label: "Q2 2024", year: 2024, quarter: 2, status: "finished",    rewardEur: 880,  periodLabel: "01.04.2024 – 30.06.2024" },
    { waveId: "w10-q3-24", label: "Q3 2024", year: 2024, quarter: 3, status: "finished",    rewardEur: 1100, periodLabel: "01.07.2024 – 30.09.2024" },
    { waveId: "w10-q4-24", label: "Q4 2024", year: 2024, quarter: 4, status: "finished",    rewardEur: 1100, periodLabel: "01.10.2024 – 31.12.2024" },
    { waveId: "w10-q2-25", label: "Q2 2025", year: 2025, quarter: 2, status: "finished",    rewardEur: 880,  periodLabel: "01.04.2025 – 30.06.2025" },
    { waveId: "w10-q2-26", label: "Q2 2026", year: 2026, quarter: 2, status: "in_progress", rewardEur: 550,  periodLabel: "01.04.2026 – 30.06.2026" },
  ],
};

interface LeaderboardEntry {
  gmId: string;
  gmName: string;
  region: string;
  cumulative: number;
  waveCount: number;
  bestWave: number;
  latestReward: number;
  waves: GmWave[]; // newest first
}

function buildLeaderboard(): LeaderboardEntry[] {
  return ALL_GMS.map(gm => {
    const waves = (MOCK_GM_WAVE_HISTORY[gm.id] ?? [])
      .slice()
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.quarter - a.quarter);
    const cumulative = waves.reduce((n, w) => n + w.rewardEur, 0);
    const bestWave   = waves.reduce((n, w) => Math.max(n, w.rewardEur), 0);
    const latestReward = waves[0]?.rewardEur ?? 0;
    return { gmId: gm.id, gmName: gm.name, region: gm.region, cumulative, waveCount: waves.length, bestWave, latestReward, waves };
  }).sort((a, b) => b.cumulative - a.cumulative);
}

function calcWaveDelta(waves: GmWave[], index: number): number | null {
  const current  = waves[index];
  const previous = waves[index + 1];
  if (!previous || previous.rewardEur === 0) return null;
  return Math.round(((current.rewardEur - previous.rewardEur) / previous.rewardEur) * 100);
}

// ── Source normalizer ─────────────────────────────────────────

interface BonusSource {
  key: string; // unique across all sources
  sectionType: SectionType;
  fragebogenId: string;
  fragebogenName: string;
  moduleId: string;
  moduleName: string;
  questionId: string;
  questionText: string;
  scoringKey: string;
  boniValue: number;
  isFactorMode: boolean;
  displayLabel: string;
}

function normalizeSources(
  modules: Module[],
  fragebogenNames: Record<string, string>,
  sectionType: SectionType,
): BonusSource[] {
  const out: BonusSource[] = [];
  for (const mod of modules) {
    for (const q of mod.questions) {
      if (!q.scoring) continue;
      for (const [key, sw] of Object.entries(q.scoring)) {
        if (sw.boni == null) continue;
        const bv = Number(sw.boni);
        if (isNaN(bv) || bv === 0) continue;
        const isFactorMode = key === "__value__";
        const displayLabel = isFactorMode ? `Wert × ${bv}` : `Antwort: ${key}`;
        out.push({
          key: `${sectionType}__${mod.id}__${q.id}__${key}`,
          sectionType,
          fragebogenId: mod.id,
          fragebogenName: fragebogenNames[mod.id] ?? mod.name,
          moduleId: mod.id,
          moduleName: mod.name,
          questionId: q.id,
          questionText: q.text || "(Kein Fragetext)",
          scoringKey: key,
          boniValue: bv,
          isFactorMode,
          displayLabel,
        });
      }
    }
  }
  return out;
}

// Mock sources (shown when contexts have no real modules yet)
const MOCK_SOURCES: BonusSource[] = [
  { key: "std__m1__q1__Ja",      sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m1", moduleName: "Regalprüfung",      questionId: "q1", questionText: "Sind alle Coke-Produkte frontal platziert?",            scoringKey: "Ja",            boniValue: 2,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "std__m1__q2__Sehr gut", sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m1", moduleName: "Regalprüfung",      questionId: "q2", questionText: "Wie ist der Zustand der Regalfläche?",                    scoringKey: "Sehr gut",      boniValue: 3,   isFactorMode: false, displayLabel: "Antwort: Sehr gut" },
  { key: "std__m1__q2__Gut",      sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m1", moduleName: "Regalprüfung",      questionId: "q2", questionText: "Wie ist der Zustand der Regalfläche?",                    scoringKey: "Gut",           boniValue: 1.5, isFactorMode: false, displayLabel: "Antwort: Gut" },
  { key: "std__m2__q3__num",      sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m2", moduleName: "Aktionsmaterial",   questionId: "q3", questionText: "Anzahl korrekt platzierter Aktionsmaterialien",            scoringKey: "__value__",     boniValue: 1.5, isFactorMode: true,  displayLabel: "Wert × 1.5" },
  { key: "std__m3__q4__Ja",       sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m3", moduleName: "Display-Check",     questionId: "q4", questionText: "Sind alle Schütten korrekt befüllt?",                    scoringKey: "Ja",            boniValue: 3,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "std__m3__q5__Ja",       sectionType: "standard", fragebogenId: "sf1", fragebogenName: "Standardbesuch KW12", moduleId: "m3", moduleName: "Display-Check",     questionId: "q5", questionText: "Ist die Display-Aufstellung der Planograms entsprechend?", scoringKey: "Ja",            boniValue: 2,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "flex__mf1__qf1__Ja",    sectionType: "flex",     fragebogenId: "ff1", fragebogenName: "Flexbesuch April",    moduleId: "mf1", moduleName: "Flexziele",        questionId: "qf1", questionText: "Wurde das saisonale Ziel im Hauptregal erreicht?",       scoringKey: "Ja",            boniValue: 2.5, isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "flex__mf1__qf2__num",   sectionType: "flex",     fragebogenId: "ff1", fragebogenName: "Flexbesuch April",    moduleId: "mf1", moduleName: "Flexziele",        questionId: "qf2", questionText: "Anzahl korrekt befüllter Flexflächen",                  scoringKey: "__value__",     boniValue: 2,   isFactorMode: true,  displayLabel: "Wert × 2" },
  { key: "flex__mf2__qf3__Ja",    sectionType: "flex",     fragebogenId: "ff1", fragebogenName: "Flexbesuch April",    moduleId: "mf2", moduleName: "Aktionen",         questionId: "qf3", questionText: "Ist Aktionsmaterial für Frühjahr vorhanden?",            scoringKey: "Ja",            boniValue: 1.5, isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "billa__mb1__qb1__Ja",   sectionType: "billa",    fragebogenId: "bf1", fragebogenName: "Billa Frühjahr 2026", moduleId: "mb1", moduleName: "Distribution",     questionId: "qb1", questionText: "Sind alle Kernliner korrekt gelistet?",                  scoringKey: "Ja",            boniValue: 3,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "billa__mb1__qb2__num",  sectionType: "billa",    fragebogenId: "bf1", fragebogenName: "Billa Frühjahr 2026", moduleId: "mb1", moduleName: "Distribution",     questionId: "qb2", questionText: "Anzahl korrekt gelisteter Produkte",                    scoringKey: "__value__",     boniValue: 1,   isFactorMode: true,  displayLabel: "Wert × 1" },
  { key: "billa__mb2__qb3__Ja",   sectionType: "billa",    fragebogenId: "bf1", fragebogenName: "Billa Frühjahr 2026", moduleId: "mb2", moduleName: "Facings",          questionId: "qb3", questionText: "Sind die Facings-Ziele erreicht?",                       scoringKey: "Ja",            boniValue: 2,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "kuehler__mk1__qk1__Sehr voll", sectionType: "kuehler", fragebogenId: "kf1", fragebogenName: "Kühlerinventur Standard", moduleId: "mk1", moduleName: "Befüllung", questionId: "qk1", questionText: "Wie ist der Kühler aktuell befüllt?",               scoringKey: "Sehr voll",     boniValue: 3,   isFactorMode: false, displayLabel: "Antwort: Sehr voll" },
  { key: "kuehler__mk1__qk1__Halb voll", sectionType: "kuehler", fragebogenId: "kf1", fragebogenName: "Kühlerinventur Standard", moduleId: "mk1", moduleName: "Befüllung", questionId: "qk1", questionText: "Wie ist der Kühler aktuell befüllt?",               scoringKey: "Halb voll",     boniValue: 1.5, isFactorMode: false, displayLabel: "Antwort: Halb voll" },
  { key: "kuehler__mk2__qk2__Ja", sectionType: "kuehler",  fragebogenId: "kf1", fragebogenName: "Kühlerinventur Standard", moduleId: "mk2", moduleName: "Sauberkeit",   questionId: "qk2", questionText: "Ist der Kühler sauber und gepflegt?",                   scoringKey: "Ja",            boniValue: 1,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "mhd__mm1__qm1__Ja",     sectionType: "mhd",      fragebogenId: "mf1", fragebogenName: "MHD Kontrolle Standard", moduleId: "mm1", moduleName: "MHD-Prüfung",  questionId: "qm1", questionText: "Sind alle MHD-Etiketten korrekt und lesbar?",            scoringKey: "Ja",            boniValue: 2,   isFactorMode: false, displayLabel: "Antwort: Ja" },
  { key: "mhd__mm1__qm2__Sehr gut", sectionType: "mhd",    fragebogenId: "mf1", fragebogenName: "MHD Kontrolle Standard", moduleId: "mm1", moduleName: "MHD-Prüfung",  questionId: "qm2", questionText: "Wie wird der MHD-Prozess im Markt bewertet?",           scoringKey: "Sehr gut",      boniValue: 2.5, isFactorMode: false, displayLabel: "Antwort: Sehr gut" },
];

// ── Sub-components ─────────────────────────────────────────────

function SectionBadge({ type }: { type: SectionType }) {
  const m = SECTION_META[type];
  const Icon = m.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 20, background: m.bg, color: m.color }}>
      <Icon size={9} strokeWidth={2} />
      {m.label}
    </span>
  );
}

function StatusPill({ status }: { status: PraemienQuarter["status"] }) {
  const map = {
    draft:    { label: "Entwurf",  bg: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)" },
    active:   { label: "Aktiv",    bg: "rgba(22,163,74,0.08)", color: "#15803d" },
    archived: { label: "Archiviert", bg: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)" },
  };
  const s = map[status];
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>;
}

function PrimaryBtn({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
        fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        background: `linear-gradient(to bottom, ${R}, ${RD})`,
        color: "#fff", letterSpacing: "-0.01em",
        boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)`,
        transition: "opacity 0.15s ease",
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, danger }: { onClick?: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
        fontSize: 11, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer",
        background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: danger ? R : "rgba(0,0,0,0.45)",
        boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
        transition: "opacity 0.15s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >
      {children}
    </button>
  );
}

// ── Card shell ────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>{label}</span>
      {right}
    </div>
  );
}

// ── Quarter switcher ──────────────────────────────────────────

function QuarterSwitcher({
  quarters, activeId, onSelect, onNew,
}: {
  quarters: PraemienQuarter[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

      {/* Scrollable quarter buttons — capped at ~5 visible, scrolls the rest */}
      <div
        ref={scrollRef}
        className="map-scroll"
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden", maxWidth: 720, padding: "4px 2px 4px 4px" }}
      >
        {quarters.map(q => {
          const active = q.id === activeId;
          return (
            <button
              key={q.id}
              onClick={() => onSelect(q.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                flexShrink: 0, whiteSpace: "nowrap",
                background: active ? `linear-gradient(to bottom, ${R}, ${RD})` : "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                color: active ? "#fff" : "rgba(0,0,0,0.55)",
                boxShadow: active
                  ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.14)`
                  : `inset 0 1px 0.6px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)`,
                transition: "all 0.15s ease",
              }}
            >
              <Trophy size={10} strokeWidth={2} />
              Q{q.quarter} {q.year}
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                padding: "2px 6px", borderRadius: 20,
                background: active ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.055)",
                color: active ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.38)",
                transition: "all 0.15s ease",
              }}>
                {q.status === "active" ? "Aktiv" : q.status === "archived" ? "Archiviert" : "Entwurf"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Neues Quartal — always visible, outside the scroll container */}
      <button
        onClick={onNew}
        style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
          borderRadius: 8, border: "1px dashed rgba(0,0,0,0.15)", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "transparent",
          flexShrink: 0, whiteSpace: "nowrap",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = R; (e.currentTarget as HTMLButtonElement).style.color = R; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.4)"; }}
      >
        <Plus size={10} strokeWidth={2.5} />
        Neues Quartal
      </button>

    </div>
  );
}

// ── Quarter header card ───────────────────────────────────────

// ── GM progress overview (compact, right side of header card) ──

const PILLAR_COLORS_OVERVIEW = [R, "#2563eb", "#16a34a", "#D97706"] as const;
const PILLAR_LABELS_SHORT = ["Schütten", "Distrib.", "Flex", "Qualität"] as const;
const PILLAR_FULL = ["Schütten / Displays", "Distributionsziel", "Flexziel", "Qualitätsziele"] as const;

const REGION_CYCLE: RegionFilter[] = ["Alle", "Nord", "Ost", "Süd", "West"];
const REGION_DISPLAY: Record<RegionFilter, string> = { Alle: "Alle Regionen", Nord: "Region Nord", Ost: "Region Ost", Süd: "Region Süd", West: "Region West" };

function GMProgressOverviewPanel({
  quarter,
  regionFilter,
  onRegionChange,
  onOpenDetail,
}: {
  quarter: PraemienQuarter;
  regionFilter: RegionFilter;
  onRegionChange: (r: RegionFilter) => void;
  onOpenDetail: () => void;
}) {
  const summary = buildGmProgressSummary(quarter, regionFilter);
  const tierColor = (eur: number) => eur === 0 ? "rgba(0,0,0,0.22)" : eur <= 550 ? "#f97316" : eur <= 880 ? "#eab308" : "#16a34a";

  const cycleRegion = () => {
    const idx = REGION_CYCLE.indexOf(regionFilter);
    onRegionChange(REGION_CYCLE[(idx + 1) % REGION_CYCLE.length]);
  };

  if (!summary) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.22)" }}>Keine GMs</span>
      </div>
    );
  }

  const pct = summary.avgProgressPercent;
  const reward = summary.avgRewardEur;
  const rc = tierColor(reward);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 20px", overflow: "hidden", justifyContent: "space-between" }}>

      {/* ── Top: region anchor + details trigger ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={cycleRegion}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, transition: "opacity 0.15s ease" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{REGION_DISPLAY[regionFilter]}</span>
          <ChevronDown size={10} strokeWidth={2.5} color="rgba(0,0,0,0.3)" />
        </button>
        <button onClick={onOpenDetail}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(0,0,0,0.035)", transition: "all 0.15s ease", letterSpacing: "0.01em" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = R; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.035)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.4)"; }}
        >
          <Eye size={10} strokeWidth={2} />
          Details
        </button>
      </div>

      {/* ── Middle: hero reward + pillar bars + side stats ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, marginBottom: 10 }}>
        {/* Hero reward */}
          <div style={{ minWidth: 0, marginRight: 14 }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.25)", marginBottom: 4 }}>Ø Prämie</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums", lineHeight: 1, transition: "all 0.3s ease", ...(reward > 0 ? tierGradStyle(reward) : { color: "rgba(0,0,0,0.22)" }) }}>
            {reward > 0 ? `${reward}€` : "—"}
          </div>
        </div>

        {/* Vertical pillar bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, flex: 1, height: 38, marginRight: 14 }}>
          {summary.pillarAverages.map((p, i) => {
            const pc = PILLAR_COLORS_OVERVIEW[i];
            const lightMap: Record<string, string> = { [R]: "#f87171", "#2563eb": "#93b5f8", "#16a34a": "#6ee7a0", "#D97706": "#fbbf4e" };
            const pcLight = lightMap[pc] ?? pc;
            const fillPct = Math.max(4, p.share);
            return (
              <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{
                  width: "100%", borderRadius: 3,
                  height: `${fillPct}%`,
                  minHeight: 3,
                  backgroundImage: `repeating-linear-gradient(-45deg, ${pc} 0px, ${pc} 3px, ${pcLight} 3px, ${pcLight} 6px)`,
                  opacity: 0.8,
                  transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
            );
          })}
        </div>

        {/* Side stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.22)", marginBottom: 1 }}>Fortschritt</div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1, transition: "all 0.3s ease", ...(reward > 0 ? tierGradStyle(reward) : { color: R }) }}>{pct}%</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.22)", marginBottom: 1 }}>Fertig</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: summary.finishedCount === summary.totalRows ? "#16a34a" : "#1a1a1a", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1, transition: "color 0.3s ease" }}>
              {summary.finishedCount}<span style={{ fontWeight: 500, fontSize: 10, color: "rgba(0,0,0,0.25)" }}> / {summary.totalRows}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: pillar fingerprint row ── */}
      <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 8 }}>
        {summary.pillarAverages.map((p, i) => {
          const pc = PILLAR_COLORS_OVERVIEW[i];
          const isQual = i === 3;
          const missing = isQual ? (p as { missingCount?: number }).missingCount : 0;
          const isLast = i === 3;
          return (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, paddingRight: isLast ? 0 : 8, borderRight: isLast ? "none" : "1px solid rgba(0,0,0,0.05)", marginRight: isLast ? 0 : 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: pc, flexShrink: 0 }} />
              <span style={{ fontSize: 8, fontWeight: 500, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{PILLAR_LABELS_SHORT[i]}</span>
              {isQual && missing ? (
                <span style={{ fontSize: 8, fontWeight: 700, color: "#D97706", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{summary.qualityFilledCount}/{summary.totalRows}</span>
              ) : (
                <span style={{ fontSize: 8, fontWeight: 700, color: pc, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p.share}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuarterHeaderCard({
  quarter, onChange, regionFilter, onRegionChange, onOpenGmDetail,
}: {
  quarter: PraemienQuarter;
  onChange: (q: PraemienQuarter) => void;
  regionFilter: RegionFilter;
  onRegionChange: (r: RegionFilter) => void;
  onOpenGmDetail: () => void;
}) {
  const set = (patch: Partial<PraemienQuarter>) => onChange({ ...quarter, ...patch });

  return (
    <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: 10 }}>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "stretch", gap: 0 }}>
        {/* Left content column */}
        <div style={{ width: "39%", flexShrink: 0, paddingRight: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={quarter.name}
                onChange={e => set({ name: e.target.value })}
                placeholder="Name des Prämienquartals"
                style={{ width: "100%", fontSize: 17, fontWeight: 700, letterSpacing: "-0.025em", color: "#1a1a1a", border: "none", outline: "none", background: "transparent", padding: 0, fontFamily: "inherit" }}
              />
              <textarea
                value={quarter.description}
                onChange={e => set({ description: e.target.value })}
                placeholder="Kurzbeschreibung (optional)…"
                rows={2}
                style={{ width: "100%", fontSize: 11, color: "rgba(0,0,0,0.45)", border: "none", outline: "none", background: "transparent", padding: 0, fontFamily: "inherit", resize: "none", marginTop: 5, lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <StatusSelect value={quarter.status} onChange={v => set({ status: v })} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "nowrap", alignItems: "flex-start" }}>
            {/* Quarter + Year */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>Quartal</span>
              <div style={{ display: "flex", gap: 4 }}>
                {([1, 2, 3, 4] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => set({ quarter: q, ...getQuarterDates(quarter.year, q) })}
                    style={{
                      width: 34, height: 30, borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: quarter.quarter === q ? `linear-gradient(to bottom, ${R}, ${RD})` : "rgba(0,0,0,0.04)",
                      color: quarter.quarter === q ? "#fff" : "rgba(0,0,0,0.45)",
                      boxShadow: quarter.quarter === q ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px #a91b1b` : "none",
                      transition: "all 0.15s ease",
                    }}
                  >Q{q}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>Jahr</span>
              <input
                type="number"
                value={quarter.year}
                onChange={e => {
                  const y = parseInt(e.target.value) || new Date().getFullYear();
                  set({ year: y, ...getQuarterDates(y, quarter.quarter) });
                }}
                style={{ width: 74, height: 30, fontSize: 11, fontWeight: 600, padding: "0 10px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)", outline: "none", color: "#1a1a1a", background: "#fff", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>Zeitraum</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 30 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.55)", whiteSpace: "nowrap" }}>
                  {fmtDate(quarter.startDate)} – {fmtDate(quarter.endDate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, background: "rgba(0,0,0,0.07)", flexShrink: 0, alignSelf: "stretch" }} />

        {/* Right area — GM progress overview */}
        <GMProgressOverviewPanel
          quarter={quarter}
          regionFilter={regionFilter}
          onRegionChange={onRegionChange}
          onOpenDetail={onOpenGmDetail}
        />
      </div>
      </div>
    </div>
  );
}

// ── Overview strip ────────────────────────────────────────────

function OverviewStrip({
  quarter, totalSources, totalPoints, issues,
}: {
  quarter: PraemienQuarter;
  totalSources: number;
  totalPoints: number;
  issues: number;
}) {
  const linkedSources = quarter.pillars.reduce((n, p) => n + p.sourceRefs.length, 0);
  const sectionTypes = new Set(quarter.pillars.flatMap(p => p.sourceRefs.map(s => s.sectionType)));
  const qualityDone = (quarter.qualitySubmissions ?? []).length;
  const qualityComplete = qualityIsComplete(quarter);

  const stats = [
    { label: "Säulen",         value: `${quarter.pillars.length}`,                      color: "#1a1a1a" },
    { label: "Sektionen",      value: `${sectionTypes.size} / 5`,                       color: "#1a1a1a" },
    { label: "Quellen",        value: `${linkedSources} / ${totalSources}`,              color: linkedSources > 0 ? "#16a34a" : "rgba(0,0,0,0.4)" },
    { label: "Max. Punkte",    value: `${totalPoints} P`,                                color: totalPoints > 0 ? R : "rgba(0,0,0,0.4)" },
    { label: "Qualitätsziele", value: `${qualityDone} / ${ALL_GMS.length}`,              color: qualityComplete ? "#16a34a" : qualityDone > 0 ? "#D97706" : "rgba(0,0,0,0.4)" },
    { label: "Probleme",       value: issues === 0 ? "Keine" : `${issues}`,              color: issues === 0 ? "#16a34a" : "#D97706" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: 7 }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          flex: 1, minWidth: 0,
          background: "#fff", borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.055)",
          padding: "10px 12px",
          display: "flex", flexDirection: "column", gap: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>{s.label}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Threshold designer ────────────────────────────────────────

const TIER_ORDER = ["Kein Bonus", "Teilbonus", "Zielbonus", "Voller Bonus"] as const;
const TIER_PCT: Record<string, number> = { "Kein Bonus": 0, "Teilbonus": 0.70, "Zielbonus": 0.80, "Voller Bonus": 0.95 };

function ThresholdDesignerCard({
  quarter, onChange,
}: {
  quarter: PraemienQuarter;
  onChange: (q: PraemienQuarter) => void;
}) {
  const thresholds = quarter.thresholds;
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const sorted = TIER_ORDER.map(label => thresholds.find(t => t.label === label)).filter(Boolean) as PraemienThreshold[];
  const vollerBonus = sorted.find(t => t.label === "Voller Bonus");
  const vollerPts = vollerBonus?.minPoints ?? 0;
  const totalAchievable = vollerPts > 0 ? Math.round(vollerPts / 0.95) : 0;

  const updateVollerBonus = (newPts: number) => {
    const clamped = Math.max(0, newPts);
    onChange({ ...quarter, thresholds: recalcThresholdsFromVollerBonus(thresholds, clamped) });
  };

  const updateReward = (id: string, eur: number) => {
    onChange({ ...quarter, thresholds: thresholds.map(t => t.id === id ? { ...t, rewardEur: eur } : t) });
  };

  const numFld: React.CSSProperties = {
    height: 28, fontSize: 12, fontWeight: 700, borderRadius: 7,
    border: "1px solid rgba(0,0,0,0.1)", outline: "none",
    textAlign: "right", background: "#fff", fontFamily: "inherit",
    padding: "0 8px", transition: "border 0.15s, box-shadow 0.15s",
  };

  return (
    <Card style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      {/* Grey header area */}
      <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Schwellwerte & Prämien</span>
        {totalAchievable > 0 && (
          <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.35)" }}>
            Gesamtziel: {totalAchievable} P
          </span>
        )}
      </div>

      {/* White inner card with side/bottom margins */}
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

      {/* ── Visual threshold track ── */}
      {sorted.length >= 2 && (
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {sorted.map((t, i) => {
              const isFirst = i === 0;
              const isLast = i === sorted.length - 1;
              const isVoller = t.label === "Voller Bonus";
              const isHov = hoveredRowId === t.id;
              const hasReward = t.rewardEur > 0;

              // Per-tier color palette for circle elements
              const CIRC: Record<string, { base: string; bg: string; bgHov: string; text: string; glow: string; label: string }> = {
                bronze: { base: "#BD965D", bg: "rgba(189,150,93,0.10)", bgHov: "rgba(189,150,93,0.20)", text: "#7C5A2A", glow: "0 0 0 3px rgba(189,150,93,0.22), 0 0 20px 8px rgba(189,150,93,0.18)", label: "#99774A" },
                silver: { base: "#9CA3AF", bg: "rgba(156,163,175,0.10)", bgHov: "rgba(156,163,175,0.20)", text: "#6B7280", glow: "0 0 0 3px rgba(156,163,175,0.28), 0 0 20px 8px rgba(156,163,175,0.20)", label: "#6B7280" },
                gold:   { base: "#EFB54E", bg: "rgba(239,181,78,0.12)",  bgHov: "rgba(239,181,78,0.22)", text: "#92400E", glow: "0 0 0 3px rgba(239,181,78,0.28), 0 0 20px 8px rgba(239,181,78,0.22)", label: "#D97706" },
              };
              const palKey = t.rewardEur >= 1100 ? "gold" : t.rewardEur >= 880 ? "silver" : "bronze";
              const pal = isFirst ? null : CIRC[palKey];

              const nodeBg     = isFirst ? "rgba(0,0,0,0.035)" : pal ? (isHov || isVoller ? pal.bgHov : pal.bg) : "rgba(0,0,0,0.035)";
              const nodeBorder = isFirst ? "rgba(0,0,0,0.2)"   : pal?.base ?? R;
              const nodeText   = isFirst ? "rgba(0,0,0,0.3)"   : pal?.text ?? R;
              const nodeGlow   = !isFirst && (isHov || (isVoller && hoveredRowId === null))
                ? (pal?.glow ?? `0 0 0 3px rgba(220,38,38,0.18), 0 0 20px 8px rgba(220,38,38,0.22)`)
                : "none";
              const labelColor = isFirst ? "rgba(0,0,0,0.3)" : isVoller ? (pal?.label ?? R) : "rgba(0,0,0,0.45)";

              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1, minWidth: 0 }}>
                  <div
                    onMouseEnter={() => !isFirst && setHoveredRowId(t.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flexShrink: 0, width: 52 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", minHeight: 16, transition: "all 0.15s ease", ...(hasReward ? tierGradStyle(t.rewardEur) : { color: "rgba(0,0,0,0.18)" }) }}>
                      {hasReward ? `${t.rewardEur}€` : "–"}
                    </span>
                    <div style={{ width: isVoller ? 34 : 30, height: isVoller ? 34 : 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: nodeBg, border: `${isVoller ? 2.5 : 2}px solid ${nodeBorder}`, boxShadow: nodeGlow, transition: "all 0.18s ease", flexShrink: 0 }}>
                      <span style={{ fontSize: t.minPoints > 999 ? 7 : t.minPoints > 99 ? 8 : 9, fontWeight: 800, color: nodeText, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                        {t.minPoints}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: isVoller ? 700 : 600, color: labelColor, textAlign: "center", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                      {t.label}
                    </span>
                  </div>
                  {!isLast && (() => {
                    const connBase = (rewardEur: number, firstNode: boolean) =>
                      firstNode ? "rgba(0,0,0,0.18)"
                        : rewardEur >= 1100 ? "rgba(239,181,78,0.65)"
                        : rewardEur >= 880  ? "rgba(156,163,175,0.65)"
                        :                     "rgba(189,150,93,0.65)";
                    const from = connBase(t.rewardEur, isFirst);
                    const to   = connBase(sorted[i + 1].rewardEur, false);
                    return (
                      <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${from}, ${to})`, borderRadius: 1, marginTop: 2, marginLeft: 3, marginRight: 3 }} />
                    );
                  })()}
                </div>
              );
            })}
          </div>
          <div style={{ height: 1, marginTop: 16, background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.055), transparent)" }} />
        </div>
      )}

      {/* ── Threshold rows ── */}
      <div style={{ padding: "10px 18px 16px" }}>

        {sorted.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 140px 118px", gap: "0 10px", padding: "0 10px 7px", alignItems: "center" }}>
            <div />
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.2)" }}>Stufe</span>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.2)", textAlign: "right" }}>Mindestpunkte</span>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.2)", textAlign: "right" }}>Prämie</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sorted.map((t, i) => {
            const isFirst = i === 0;
            const isVoller = t.label === "Voller Bonus";
            const isHov = hoveredRowId === t.id;
            const isAuto = !isVoller;
            const badgeColor = isFirst ? "rgba(0,0,0,0.055)" : isVoller ? "rgba(220,38,38,0.15)" : `rgba(220,38,38,${isHov ? 0.12 : 0.07})`;
            const badgeBorder = isFirst ? "rgba(0,0,0,0.14)" : isVoller ? R : `rgba(220,38,38,${isHov ? 0.5 : 0.25})`;
            const badgeText  = isFirst ? "rgba(0,0,0,0.28)" : R;

            return (
              <div
                key={t.id}
                onMouseEnter={() => !isFirst && setHoveredRowId(t.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 1fr 140px 118px",
                  gap: "0 10px",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 9,
                  background: isVoller ? "rgba(220,38,38,0.025)" : "rgba(0,0,0,0.018)",
                  border: `1px solid ${isVoller ? "rgba(220,38,38,0.15)" : "rgba(0,0,0,0.055)"}`,
                  transition: "all 0.15s ease",
                }}
              >
                {/* Step badge */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: badgeColor, border: `1.5px solid ${badgeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: badgeText, lineHeight: 1 }}>{i + 1}</span>
                </div>

                {/* Name (fixed, not editable) */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: isVoller ? 700 : 600, color: isVoller ? "#1a1a1a" : "rgba(0,0,0,0.55)", fontFamily: "inherit", letterSpacing: "-0.01em" }}>
                    {t.label}
                  </span>
                  {isAuto && !isFirst && (
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.22)", background: "rgba(0,0,0,0.04)", padding: "1px 5px", borderRadius: 4 }}>
                      {Math.round(TIER_PCT[t.label] * 100)}%
                    </span>
                  )}
                </div>

                {/* Min-points */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.28)", flexShrink: 0 }}>ab</span>
                  {isVoller ? (
                    <input
                      type="number"
                      value={t.minPoints}
                      onChange={e => updateVollerBonus(parseInt(e.target.value) || 0)}
                      style={{ ...numFld, width: 56, color: R, fontWeight: 800, border: `1px solid rgba(220,38,38,0.3)` }}
                      onFocus={e => { e.currentTarget.style.border = `1px solid rgba(220,38,38,0.6)`; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.08)"; }}
                      onBlur={e => { e.currentTarget.style.border = `1px solid rgba(220,38,38,0.3)`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  ) : (
                    <span style={{ ...numFld, width: 56, display: "flex", alignItems: "center", justifyContent: "flex-end", color: "rgba(0,0,0,0.35)", background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)", cursor: "default", transition: "all 0.25s ease" }}>
                      {t.minPoints}
                    </span>
                  )}
                  <span style={{ fontSize: 9, fontWeight: 600, color: isVoller ? R : "rgba(0,0,0,0.25)", flexShrink: 0 }}>P</span>
                </div>

                {/* Euro reward (always editable) */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.28)", flexShrink: 0 }}>=</span>
                  <input
                    type="number"
                    value={t.rewardEur}
                    onChange={e => updateReward(t.id, parseInt(e.target.value) || 0)}
                    style={{ ...numFld, width: 62, color: t.rewardEur > 0 ? "#15803d" : "rgba(0,0,0,0.28)", background: t.rewardEur > 0 ? "rgba(22,163,74,0.04)" : "#fff", border: `1px solid ${t.rewardEur > 0 ? "rgba(22,163,74,0.3)" : "rgba(0,0,0,0.08)"}` }}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(22,163,74,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(22,163,74,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = `1px solid ${t.rewardEur > 0 ? "rgba(22,163,74,0.3)" : "rgba(0,0,0,0.08)"}`; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <span style={{ fontSize: 9, fontWeight: 600, color: t.rewardEur > 0 ? "#16a34a" : "rgba(0,0,0,0.28)", flexShrink: 0, transition: "color 0.15s ease" }}>€</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* end white inner card */}
      </div>
    </Card>
  );
}

// ── Quality goals modal & pillar ──────────────────────────────

const QUALITY_CRITERIA: { key: keyof PraemienQualityCriteria; label: string; hint: string }[] = [
  { key: "zeiterfassung", label: "Zeiterfassung",  hint: "Pünktlichkeit und Vollständigkeit der Zeiterfassung" },
  { key: "reporting",     label: "Reporting",       hint: "Qualität und Rechtzeitigkeit der Berichte" },
  { key: "accuracy",      label: "Accuracy",        hint: "Genauigkeit bei Daten und Marktangaben" },
];

const EMPTY_CRITERIA: PraemienQualityCriteria = { zeiterfassung: 0, reporting: 0, accuracy: 0 };

function QualityCompletionPill({ done }: { done: boolean }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20,
      background: done ? "rgba(22,163,74,0.09)" : "rgba(217,119,6,0.09)",
      color: done ? "#15803d" : "#92400e",
    }}>
      {done ? "Fertig" : "Offen"}
    </span>
  );
}

function QualityScoreSlider({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
}) {
  const pct = value;
  const barRef = useRef<HTMLDivElement>(null);

  const valueFromEvent = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const { left, width } = bar.getBoundingClientRect();
    const raw = Math.round(((clientX - left) / width) * 100);
    onChange(Math.min(100, Math.max(0, raw)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    valueFromEvent(e.clientX);
    const onMove = (ev: MouseEvent) => valueFromEvent(ev.clientX);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{ padding: "13px 16px", borderRadius: 10, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.055)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{label}</span>
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginLeft: 7 }}>{hint}</span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 900, color: R, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>{value}</span>
      </div>
      {/* Interactive fill bar with dot */}
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        style={{ height: 8, borderRadius: 99, background: "rgba(0,0,0,0.06)", position: "relative", cursor: "pointer", userSelect: "none" }}
      >
        {/* Striped fill */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`, borderRadius: 99,
          backgroundImage: `repeating-linear-gradient(-45deg,#DC2626 0px,#DC2626 4px,#f87171 4px,#f87171 8px)`,
          transition: "width 0.06s ease",
        }} />
        {/* Thumb dot */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          width: 18, height: 18, borderRadius: "50%",
          background: "#fff",
          border: `2.5px solid ${R}`,
          boxShadow: `0 1px 5px rgba(220,38,38,0.35)`,
          transition: "left 0.06s ease",
          pointerEvents: "none",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)", fontWeight: 600 }}>0</span>
        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)", fontWeight: 600 }}>100</span>
      </div>
    </div>
  );
}

function QualityGoalsModal({
  quarter, onSave, onClose,
}: {
  quarter: PraemienQuarter;
  onSave: (submissions: PraemienQualitySubmission[]) => void;
  onClose: () => void;
}) {
  const subs = quarter.qualitySubmissions ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [selectedGmId, setSelectedGmId] = useState<string>(ALL_GMS[0]?.id ?? "");
  const [draft, setDraft] = useState<PraemienQualityCriteria>(EMPTY_CRITERIA);
  const [draftNote, setDraftNote] = useState("");
  const [localSubs, setLocalSubs] = useState<PraemienQualitySubmission[]>(subs);
  const [unsaved, setUnsaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Load existing score when GM selection changes
  useEffect(() => {
    const existing = localSubs.find(s => s.gmId === selectedGmId);
    if (existing) {
      setDraft({ ...existing.scores });
      setDraftNote(existing.note ?? "");
    } else {
      setDraft({ ...EMPTY_CRITERIA });
      setDraftNote("");
    }
    setUnsaved(false);
  }, [selectedGmId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = calcQualityTotal(draft);

  const handleCriterionChange = (key: keyof PraemienQualityCriteria, v: number) => {
    setDraft(p => ({ ...p, [key]: v }));
    setUnsaved(true);
  };

  const handleSaveGm = () => {
    const newSub: PraemienQualitySubmission = {
      gmId: selectedGmId,
      gmName: ALL_GMS.find(g => g.id === selectedGmId)?.name ?? selectedGmId,
      scores: { ...draft },
      totalPoints: total,
      note: draftNote || undefined,
      updatedAt: new Date().toISOString(),
    };
    const next = [...localSubs.filter(s => s.gmId !== selectedGmId), newSub];
    setLocalSubs(next);
    setUnsaved(false);
    // Auto-advance to next unscored GM
    const nextOpen = ALL_GMS.find(g => !next.some(s => s.gmId === g.id) && g.id !== selectedGmId);
    if (nextOpen) setSelectedGmId(nextOpen.id);
  };

  const handleReset = () => {
    setDraft({ ...EMPTY_CRITERIA });
    setDraftNote("");
    setUnsaved(true);
  };

  const handleClose = () => {
    onSave(localSubs);
    onClose();
  };

  const filteredGms = ALL_GMS.filter(gm => {
    const q = search.toLowerCase().trim();
    if (q && !gm.name.toLowerCase().includes(q)) return false;
    const done = localSubs.some(s => s.gmId === gm.id);
    if (filter === "done" && !done) return false;
    if (filter === "open" && done) return false;
    return true;
  });

  const doneCount = localSubs.length;
  const totalColor = total >= 80 ? "#16a34a" : total >= 50 ? "#D97706" : "#DC2626";
  const selectedGm = ALL_GMS.find(g => g.id === selectedGmId);
  const selectedSub = localSubs.find(s => s.gmId === selectedGmId);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={handleClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
    >
      <style>{`
        @keyframes qgModalIn { from { opacity:0; transform:scale(0.97) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .qg-scroll::-webkit-scrollbar { width: 3px; }
        .qg-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
        input[type=range].qg-range { -webkit-appearance: none; appearance: none; background: transparent; height: 4px; }
        input[type=range].qg-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid currentColor; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 820, height: "min(580px, 90vh)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "qgModalIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        {/* Modal header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Award size={15} strokeWidth={1.8} color="#D97706" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Qualitätsziele erfassen</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>{quarter.name} · {doneCount} / {ALL_GMS.length} GMs bewertet</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <QualityCompletionPill done={doneCount === ALL_GMS.length} />
            <button
              onClick={handleClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)", transition: "background 0.12s ease", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* Left — GM list */}
          <div style={{ width: 240, borderRight: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 9px", height: 30, borderRadius: 7, background: "rgba(0,0,0,0.04)", border: "1px solid transparent", transition: "border 0.15s" }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
              >
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="GM suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }} />
              </div>
            </div>
            {/* Status filter */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,0.03)", borderRadius: 7, padding: 3 }}>
                {(["all", "open", "done"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ flex: 1, padding: "3px 0", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600, background: filter === f ? "#fff" : "transparent", color: filter === f ? "#1a1a1a" : "rgba(0,0,0,0.4)", boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>
                    {f === "all" ? "Alle" : f === "open" ? "Offen" : "Bewertet"}
                  </button>
                ))}
              </div>
            </div>
            {/* GM rows */}
            <div className="qg-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {filteredGms.map(gm => {
                const sub = localSubs.find(s => s.gmId === gm.id);
                const active = gm.id === selectedGmId;
                return (
                  <div key={gm.id} onClick={() => setSelectedGmId(gm.id)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(217,119,6,0.06)" : "transparent", borderLeft: `3px solid ${active ? "#D97706" : "transparent"}`, transition: "all 0.12s ease" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: sub ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: sub ? "#15803d" : "rgba(0,0,0,0.35)" }}>
                      {gm.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? "#D97706" : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gm.name}</div>
                      {sub
                        ? <div style={{ fontSize: 9, fontWeight: 600, color: "#16a34a" }}>{sub.totalPoints} / 100 P</div>
                        : <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>Nicht bewertet</div>
                      }
                    </div>
                    {sub && <CheckCircle2 size={12} strokeWidth={2} color="#16a34a" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
              {filteredGms.length === 0 && (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Keine GMs gefunden</span>
                </div>
              )}
            </div>
          </div>

          {/* Right — scoring editor */}
          <div className="qg-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {/* GM header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#D97706", flexShrink: 0 }}>
                  {selectedGm?.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{selectedGm?.name}</div>
                  {selectedSub
                    ? <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>Zuletzt bearbeitet: {new Date(selectedSub.updatedAt).toLocaleDateString("de-AT")}</div>
                    : <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)" }}>Noch nicht bewertet</div>
                  }
                </div>
                {/* Total points display */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: totalColor, fontVariantNumeric: "tabular-nums", transition: "color 0.2s ease" }}>{total}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>/ 100 Punkte</div>
                </div>
              </div>
              {unsaved && (
                <div style={{ marginTop: 8, fontSize: 9, fontWeight: 600, color: "#D97706", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={10} strokeWidth={2} />
                  Nicht gespeichert
                </div>
              )}
            </div>

            {/* Criteria sliders */}
            <div style={{ padding: "14px 20px 8px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {QUALITY_CRITERIA.map(c => (
                <QualityScoreSlider
                  key={c.key}
                  label={c.label}
                  hint={c.hint}
                  value={draft[c.key]}
                  onChange={v => handleCriterionChange(c.key, v)}
                />
              ))}

              {/* Note field */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)", marginBottom: 5 }}>Notiz (optional)</div>
                <textarea
                  value={draftNote}
                  onChange={e => { setDraftNote(e.target.value); setUnsaved(true); }}
                  placeholder="Anmerkungen zur Bewertung…"
                  rows={2}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", outline: "none", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit", resize: "none", lineHeight: 1.5, background: "rgba(0,0,0,0.018)", boxSizing: "border-box" }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(217,119,6,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,6,0.07)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(0,0,0,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <GhostBtn onClick={handleReset}>
                <BarChart3 size={11} strokeWidth={2} />
                Zurücksetzen
              </GhostBtn>
              <div style={{ flex: 1 }} />
              <PrimaryBtn onClick={handleSaveGm}>
                <Check size={12} strokeWidth={2.5} />
                Speichern
              </PrimaryBtn>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Quality pillar card (manual, no boni sources) ─────────────

function QualityPillarCard({
  pillar, pillarIndex, quarter, onUpdateQuarter,
}: {
  pillar: PraemienPillar;
  pillarIndex: number;
  quarter: PraemienQuarter;
  onUpdateQuarter: (q: PraemienQuarter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const PC = "#D97706";
  const subs = quarter.qualitySubmissions ?? [];
  const doneCount = subs.length;
  const avgPts = qualityAvgForQuarter(quarter);
  const complete = qualityIsComplete(quarter);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, border: `1px solid rgba(0,0,0,0.07)`, boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflow: "hidden" }}>
      {/* Header — same structure as PillarCard */}
      <div
        onClick={() => setExpanded(o => !o)}
        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: 12, userSelect: "none", transition: "background 0.12s ease" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.015)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ width: 4, height: 36, borderRadius: 2, background: PC, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 3 }}>{pillar.name}</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.38)", letterSpacing: "0.02em" }}>Manuell · Admin-only</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: PC, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{avgPts}</div>
            <div style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>Ø Punkte</div>
          </div>
          <QualityCompletionPill done={complete} />
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{doneCount} / {ALL_GMS.length} GMs</span>
          <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
        </div>
      </div>

      {/* Expanded body */}
      <div style={{ maxHeight: expanded ? 600 : 0, overflow: "hidden", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 16px 14px" }}>
          {/* Status strip + CTA */}
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(217,119,6,0.04)", border: "1px solid rgba(217,119,6,0.14)", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <Award size={18} strokeWidth={1.5} color="#D97706" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                {complete ? "Qualitätsziele vollständig erfasst" : "Qualitätsziele noch nicht fertig"}
              </div>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                {doneCount} von {ALL_GMS.length} GMs bewertet · Ø {avgPts} / 100 Punkte
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setModalOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                fontSize: 10, fontWeight: 700, borderRadius: 7, border: "none", cursor: "pointer",
                background: `linear-gradient(to bottom, ${R}, ${RD})`,
                color: "#fff", letterSpacing: "-0.01em",
                boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.12)`,
                flexShrink: 0, transition: "opacity 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              <Pencil size={10} strokeWidth={2.5} />
              {doneCount > 0 ? "Bearbeiten" : "Qualitätsziele erfassen"}
            </button>
          </div>

          {/* Submitted GMs list */}
          {subs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map(sub => {
                const scoreColor = sub.totalPoints >= 80 ? "#16a34a" : sub.totalPoints >= 50 ? "#D97706" : R;
                return (
                  <div key={sub.gmId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.045)" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(217,119,6,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#D97706", flexShrink: 0 }}>
                      {sub.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{sub.gmName}</span>
                    <div style={{ display: "flex", gap: 6, fontSize: 9, color: "rgba(0,0,0,0.38)" }}>
                      <span>ZE: {sub.scores.zeiterfassung}</span>
                      <span>RE: {sub.scores.reporting}</span>
                      <span>AC: {sub.scores.accuracy}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor, minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sub.totalPoints}</span>
                  </div>
                );
              })}
            </div>
          )}
          {subs.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", borderRadius: 9, background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Noch keine Bewertungen — öffne das Formular oben.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <QualityGoalsModal
          quarter={quarter}
          onSave={submissions => {
            onUpdateQuarter({ ...quarter, qualitySubmissions: submissions });
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Pillar card ────────────────────────────────────────────────

function PillarCard({
  pillar, pillarIndex, quarter, sources, onChange,
}: {
  pillar: PraemienPillar;
  pillarIndex: number;
  quarter: PraemienQuarter;
  sources: BonusSource[];
  onChange: (updated: PraemienPillar) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalPoints = pillar.sourceRefs.reduce((n, r) => n + r.boniValue, 0);
  const sectionTypes = Array.from(new Set(pillar.sourceRefs.map(r => r.sectionType)));
  const completeness = pillar.sourceRefs.length === 0 ? "leer"
    : pillar.sourceRefs.length < 3 ? "teilweise"
    : "vollständig";

  const completenessStyle = {
    leer:        { color: R, bg: "rgba(220,38,38,0.08)" },
    teilweise:   { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
    vollständig: { color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
  }[completeness];

  const removeSource = (srcId: string) => {
    onChange({ ...pillar, sourceRefs: pillar.sourceRefs.filter(r => r.id !== srcId) });
  };

  const PILLAR_COLORS = [R, "#2563eb", "#16a34a", "#D97706"];
  const pc = PILLAR_COLORS[pillarIndex] ?? R;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, border: `1px solid rgba(0,0,0,0.07)`, boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(o => !o)}
        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: 12, userSelect: "none", transition: "background 0.12s ease" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.015)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Color bar */}
        <div style={{ width: 4, height: 36, borderRadius: 2, background: pc, flexShrink: 0 }} />

        {/* Pillar name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 3 }}>{pillar.name}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {sectionTypes.map(st => <SectionBadge key={st} type={st} />)}
            {sectionTypes.length === 0 && <span style={{ fontSize: 9, color: "rgba(0,0,0,0.28)" }}>Keine Quellen</span>}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: pc, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{totalPoints.toFixed(1)}</div>
            <div style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>P / Antwort</div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: completenessStyle.bg, color: completenessStyle.color }}>
            {completeness}
          </span>
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{pillar.sourceRefs.length} Quellen</span>
          <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
        </div>
      </div>

      {/* Expanded content */}
      <div style={{ maxHeight: expanded ? 600 : 0, overflow: "hidden", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 16px 14px" }}>
          {pillar.description && (
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", margin: "0 0 12px 16px", lineHeight: 1.5 }}>{pillar.description}</p>
          )}
          {pillar.sourceRefs.length === 0 ? (
            <div style={{ padding: "16px 16px", textAlign: "center", borderRadius: 9, background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Keine Quellen — weise Quellen über den Explorer zu.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {pillar.sourceRefs.map(ref => {
                const sm = SECTION_META[ref.sectionType];
                return (
                  <div key={ref.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.045)" }}>
                    <SectionBadge type={ref.sectionType} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ref.questionText}</div>
                      <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{ref.moduleName} · {ref.displayLabel}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: pc, fontVariantNumeric: "tabular-nums" }}>{ref.boniValue}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeSource(ref.id); }}
                      style={{ width: 20, height: 20, borderRadius: 5, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "rgba(0,0,0,0.25)", flexShrink: 0, transition: "all 0.12s ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = R; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.25)"; }}
                    >
                      <Minus size={9} strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom status select ──────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "draft",    label: "Entwurf",     color: "rgba(0,0,0,0.45)", bg: "rgba(0,0,0,0.04)"  },
  { value: "active",   label: "Aktiv",        color: "#15803d",           bg: "rgba(22,163,74,0.07)" },
  { value: "archived", label: "Archiviert",   color: "rgba(0,0,0,0.35)", bg: "rgba(0,0,0,0.03)"  },
] as const;

function StatusSelect({
  value, onChange,
}: {
  value: PraemienQuarter["status"];
  onChange: (v: PraemienQuarter["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const current = STATUS_OPTIONS.find(o => o.value === value) ?? STATUS_OPTIONS[0];

  const toggleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom + 5 });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 10, fontWeight: 600,
          background: current.bg, color: current.color,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.09)",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        {current.label}
        <ChevronDown size={9} strokeWidth={2.5} style={{ opacity: 0.5 }} />
      </button>
      {mounted && open && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: 148, background: "#fff", borderRadius: 10, padding: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mfcIn 0.14s ease both" }}
        >
          {STATUS_OPTIONS.map(opt => {
            const sel = opt.value === value;
            return (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "left", background: sel ? opt.bg : "transparent", color: sel ? opt.color : "#374151", transition: "background 0.1s ease" }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                {sel && <Check size={10} strokeWidth={3} color={opt.color} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Custom pillar select ──────────────────────────────────────

function PillarSelect({
  value, pillars, onChange,
}: {
  value: string;
  pillars: PraemienPillar[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const current = pillars.find(p => p.id === value) ?? null;

  const toggleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const PANEL_W = 180;
      const left = Math.min(r.left, window.innerWidth - PANEL_W - 8);
      setPos({ x: left, y: r.bottom + 5 });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 6, minWidth: 138, justifyContent: "space-between",
          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
          background: current ? `${current.color}0e` : "rgba(0,0,0,0.035)",
          color: current ? current.color : "rgba(0,0,0,0.45)",
          boxShadow: current ? `0 0 0 1px ${current.color}30` : "0 0 0 1px rgba(0,0,0,0.09)",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: current ? current.color : "rgba(0,0,0,0.18)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? current.name : "– Nicht zugewiesen"}
          </span>
        </span>
        <ChevronDown size={9} strokeWidth={2.5} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>
      {mounted && open && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: 180, background: "#fff", borderRadius: 10, padding: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mfcIn 0.14s ease both" }}
        >
          {/* Unassigned */}
          <button onClick={() => { onChange(""); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 10, fontWeight: !current ? 700 : 400, background: !current ? "rgba(0,0,0,0.04)" : "transparent", color: !current ? "#1a1a1a" : "rgba(0,0,0,0.5)", transition: "background 0.1s ease" }}
            onMouseEnter={e => { if (current) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            onMouseLeave={e => { if (current) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(0,0,0,0.15)", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>– Nicht zugewiesen</span>
            {!current && <Check size={10} strokeWidth={3} color="rgba(0,0,0,0.4)" />}
          </button>
          {pillars.map(p => {
            const sel = p.id === value;
            return (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, background: sel ? `${p.color}0e` : "transparent", color: sel ? p.color : "#374151", transition: "background 0.1s ease" }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = `${p.color}08`; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                {sel && <Check size={10} strokeWidth={3} color={p.color} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Source explorer ───────────────────────────────────────────

function BonusSourceExplorer({
  sources, quarter, onChange,
}: {
  sources: BonusSource[];
  quarter: PraemienQuarter;
  onChange: (q: PraemienQuarter) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState<SectionType | null>(null);
  const [filterAssigned, setFilterAssigned] = useState<"all" | "assigned" | "unassigned">("all");

  // Map source.key → pillarId
  const assignmentMap: Record<string, string> = {};
  for (const p of quarter.pillars) {
    for (const r of p.sourceRefs) {
      assignmentMap[r.id] = p.id;
    }
  }

  const filtered = sources.filter(s => {
    const q = search.toLowerCase().trim();
    if (q && !s.questionText.toLowerCase().includes(q) && !s.fragebogenName.toLowerCase().includes(q) && !s.moduleName.toLowerCase().includes(q) && !s.displayLabel.toLowerCase().includes(q)) return false;
    if (filterSection && s.sectionType !== filterSection) return false;
    const assigned = !!assignmentMap[s.key];
    if (filterAssigned === "assigned" && !assigned) return false;
    if (filterAssigned === "unassigned" && assigned) return false;
    return true;
  });

  const assignToPillar = (src: BonusSource, pillarId: string) => {
    const ref: PraemienSourceRef = {
      id: src.key,
      sectionType: src.sectionType,
      fragebogenId: src.fragebogenId,
      fragebogenName: src.fragebogenName,
      moduleId: src.moduleId,
      moduleName: src.moduleName,
      questionId: src.questionId,
      questionText: src.questionText,
      scoringKey: src.scoringKey,
      boniValue: src.boniValue,
      isFactorMode: src.isFactorMode,
      displayLabel: src.displayLabel,
    };
    // Remove from any existing pillar first
    const cleanedPillars = quarter.pillars.map(p => ({
      ...p,
      sourceRefs: p.sourceRefs.filter(r => r.id !== src.key),
    }));
    if (!pillarId) {
      onChange({ ...quarter, pillars: cleanedPillars });
      return;
    }
    const newPillars = cleanedPillars.map(p =>
      p.id === pillarId ? { ...p, sourceRefs: [...p.sourceRefs, ref] } : p
    );
    onChange({ ...quarter, pillars: newPillars });
  };

  // Group by fragebogenName
  const grouped: Record<string, BonusSource[]> = {};
  for (const s of filtered) {
    if (!grouped[s.fragebogenName]) grouped[s.fragebogenName] = [];
    grouped[s.fragebogenName].push(s);
  }

  return (
    <Card style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      {/* Grey header area */}
      <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>Bonus-Quellen ({filtered.length} / {sources.length})</span>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Aus Fragebögen · Boni-Werte</span>
      </div>

      {/* White inner card */}
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

      {/* Filters */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "1 1 160px", padding: "0 10px", height: 30, borderRadius: 8, background: "rgba(0,0,0,0.035)", border: "1px solid transparent", transition: "border 0.15s" }}
          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = `1px solid ${R}50`; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
          onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.035)"; }}
        >
          <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
          <input type="text" placeholder="Frage, Modul oder Fragebogen…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }} />
          {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center" }}><X size={10} strokeWidth={2} /></button>}
        </div>

        {/* Section filters */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.03)", borderRadius: 7, padding: 3 }}>
          <button onClick={() => setFilterSection(null)} style={{ padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: !filterSection ? "#fff" : "transparent", color: !filterSection ? "#1a1a1a" : "rgba(0,0,0,0.4)", boxShadow: !filterSection ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none", transition: "all 0.15s ease" }}>Alle</button>
          {(Object.keys(SECTION_META) as SectionType[]).map(st => {
            const m = SECTION_META[st];
            const active = filterSection === st;
            return (
              <button key={st} onClick={() => setFilterSection(active ? null : st)}
                style={{ padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: active ? m.bg : "transparent", color: active ? m.color : "rgba(0,0,0,0.4)", transition: "all 0.15s ease" }}>
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Assigned filter */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.03)", borderRadius: 7, padding: 3 }}>
          {(["all", "unassigned", "assigned"] as const).map(v => (
            <button key={v} onClick={() => setFilterAssigned(v)}
              style={{ padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: filterAssigned === v ? "#fff" : "transparent", color: filterAssigned === v ? "#1a1a1a" : "rgba(0,0,0,0.4)", boxShadow: filterAssigned === v ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none", transition: "all 0.15s ease" }}>
              {v === "all" ? "Alle" : v === "unassigned" ? "Nicht zugewiesen" : "Zugewiesen"}
            </button>
          ))}
        </div>
      </div>

      {/* Source list */}
      <div className="map-scroll" style={{ maxHeight: 480, overflowY: "auto" } as React.CSSProperties}>
        {Object.keys(grouped).length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Keine Quellen gefunden.</span>
          </div>
        ) : Object.entries(grouped).map(([fbName, fbSources]) => (
          <div key={fbName}>
            {/* Fragebogen group header */}
            <div style={{ padding: "9px 18px 5px", background: "rgba(0,0,0,0.015)", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SectionBadge type={fbSources[0].sectionType} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{fbName}</span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{fbSources.length} Quellen</span>
              </div>
            </div>

            {fbSources.map(src => {
              const currentPillarId = assignmentMap[src.key];
              const currentPillar = quarter.pillars.find(p => p.id === currentPillarId);

              return (
                <div key={src.key}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.035)", transition: "background 0.1s ease" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.015)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{src.questionText}</div>
                    <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)" }}>{src.moduleName} · <span style={{ color: "rgba(0,0,0,0.55)", fontWeight: 500 }}>{src.displayLabel}</span></div>
                  </div>

                  {/* Boni value */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: R, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{src.boniValue}</div>
                    <div style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>Punkte</div>
                  </div>

                  {/* Pillar assignment */}
                  <div style={{ flexShrink: 0 }}>
                    <PillarSelect
                      value={currentPillarId ?? ""}
                      pillars={quarter.pillars}
                      onChange={id => assignToPillar(src, id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* end white inner card */}
      </div>
    </Card>
  );
}

// ── GM Progress Modal ─────────────────────────────────────────

function GMCompletionPill({ done }: { done: boolean }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20,
      background: done ? "rgba(22,163,74,0.09)" : "rgba(0,0,0,0.05)",
      color: done ? "#15803d" : "rgba(0,0,0,0.4)",
    }}>
      {done ? "Fertig" : "Offen"}
    </span>
  );
}

function GMProgressModal({
  quarter, onClose, initialRegion = "Alle",
}: {
  quarter: PraemienQuarter;
  onClose: () => void;
  initialRegion?: RegionFilter;
}) {
  const rows = buildGmProgressRows(quarter);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "done" | "open">("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>(initialRegion);
  const [selectedId, setSelectedId] = useState<string>(rows[0]?.gmId ?? "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase().trim();
    if (q && !r.gmName.toLowerCase().includes(q)) return false;
    if (filter === "done" && !r.isFinished) return false;
    if (filter === "open" && r.isFinished) return false;
    if (regionFilter !== "Alle" && ALL_GMS.find(g => g.id === r.gmId)?.region !== regionFilter) return false;
    return true;
  });

  const selected = rows.find(r => r.gmId === selectedId) ?? rows[0];
  const doneCount = rows.filter(r => r.isFinished).length;
  const avgReward = rows.length > 0
    ? Math.round(rows.reduce((n, r) => n + r.currentRewardEur, 0) / rows.length)
    : 0;

  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const tierColor = (eur: number) => eur === 0 ? R : eur <= 550 ? "#f97316" : eur <= 880 ? "#eab308" : "#16a34a";

  const PILLAR_NAMES = quarter.pillars.map(p => p.name);
  const PILLAR_MAXES = selected
    ? [selected.pillar0Max, selected.pillar1Max, selected.pillar2Max, QUALITY_MAX]
    : [13, 10, 6, QUALITY_MAX];
  const PILLAR_VALS = selected
    ? [selected.pillar0, selected.pillar1, selected.pillar2, selected.pillar3]
    : [0, 0, 0, null];

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
    >
      <style>{`
        @keyframes gmProgressIn { from { opacity:0; transform:scale(0.97) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .gmp-scroll::-webkit-scrollbar { width: 3px; }
        .gmp-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 900, height: "min(640px, 90vh)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "gmProgressIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        {/* Modal header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BarChart3 size={15} strokeWidth={1.8} color={R} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>GM Fortschritt</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
              {quarter.name} · {doneCount} / {ALL_GMS.length} fertig · Ø Prämie: {avgReward}€
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)", transition: "background 0.12s ease", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body: left GM list + right detail */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* ── Left: GM list ── */}
          <div style={{ width: 260, borderRight: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 9px", height: 30, borderRadius: 7, background: "rgba(0,0,0,0.04)", border: "1px solid transparent", transition: "border 0.15s" }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
              >
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="GM suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }} />
              </div>
            </div>
            {/* Filter tabs */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,0.03)", borderRadius: 7, padding: 3 }}>
                {(["all", "done", "open"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ flex: 1, padding: "3px 0", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600, background: filter === f ? "#fff" : "transparent", color: filter === f ? "#1a1a1a" : "rgba(0,0,0,0.4)", boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s ease" }}>
                    {f === "all" ? "Alle" : f === "done" ? "Fertig" : "Offen"}
                  </button>
                ))}
              </div>
            </div>
            {/* GM rows */}
            <div className="gmp-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {filtered.map(row => {
                const active = row.gmId === selectedId;
                const rewardCol = tierColor(row.currentRewardEur);
                return (
                  <div key={row.gmId} onClick={() => setSelectedId(row.gmId)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: `3px solid ${active ? R : "transparent"}`, transition: "all 0.12s ease" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: row.isFinished ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: row.isFinished ? "#15803d" : "rgba(0,0,0,0.4)" }}>
                      {row.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    {/* Name + mini bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{row.gmName}</div>
                      <div style={{ height: 3, borderRadius: 99, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${row.progressPercent}%`, background: row.progressPercent >= 80 ? "#16a34a" : row.progressPercent >= 50 ? "#D97706" : R, borderRadius: 99, transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                    {/* Right meta */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", ...(row.currentRewardEur > 0 ? tierGradStyle(row.currentRewardEur) : { color: "rgba(0,0,0,0.3)" }) }}>{row.currentRewardEur > 0 ? `${row.currentRewardEur}€` : "—"}</div>
                      <div style={{ fontSize: 8, color: "rgba(0,0,0,0.3)", fontWeight: 500, marginTop: 1 }}>{row.progressPercent}%</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: "28px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Keine GMs gefunden</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: GM detail ── */}
          {selected && (
            <div className="gmp-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {/* GM hero */}
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: selected.isFinished ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: selected.isFinished ? "#15803d" : "rgba(0,0,0,0.4)", border: `2px solid ${selected.isFinished ? "#16a34a" : "rgba(0,0,0,0.1)"}` }}>
                    {selected.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{selected.gmName}</span>
                      <GMCompletionPill done={selected.isFinished} />
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                      {selected.currentPoints.toFixed(1)} / {selected.currentMaxPoints.toFixed(1)} Punkte · {selected.progressPercent}% erreicht
                    </div>
                  </div>
                  {/* Reward hero */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", ...(selected.currentRewardEur > 0 ? tierGradStyle(selected.currentRewardEur) : { color: "rgba(0,0,0,0.28)" }) }}>
                      {selected.currentRewardEur > 0 ? `${selected.currentRewardEur}€` : "—"}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 1, ...(selected.currentRewardEur > 0 ? tierGradStyle(selected.currentRewardEur) : { color: "rgba(0,0,0,0.28)" }) }}>
                      {selected.currentRewardLabel}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Threshold track (read-only) */}
                {sorted.length >= 2 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>Prämienstufe</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {sorted.map((t, i) => {
                        const isActive = selected.currentRewardEur === t.rewardEur;
                        const reached  = selected.currentPoints >= t.minPoints;
                        const isLast   = i === sorted.length - 1;

                        // Tier circle palette (same as ThresholdDesignerCard)
                        const CIRC: Record<string, { base: string; bgActive: string; text: string; glow: string }> = {
                          bronze: { base: "#BD965D", bgActive: "rgba(189,150,93,0.15)", text: "#7C5A2A", glow: "0 0 0 3px rgba(189,150,93,0.22), 0 0 16px 6px rgba(189,150,93,0.18)" },
                          silver: { base: "#9CA3AF", bgActive: "rgba(156,163,175,0.15)", text: "#6B7280", glow: "0 0 0 3px rgba(156,163,175,0.28), 0 0 16px 6px rgba(156,163,175,0.20)" },
                          gold:   { base: "#EFB54E", bgActive: "rgba(239,181,78,0.18)",  text: "#92400E", glow: "0 0 0 3px rgba(239,181,78,0.28), 0 0 16px 6px rgba(239,181,78,0.22)" },
                        };
                        const palKey = t.rewardEur >= 1100 ? "gold" : t.rewardEur >= 880 ? "silver" : t.rewardEur >= 550 ? "bronze" : null;
                        const pal = palKey ? CIRC[palKey] : null;

                        const nc = t.rewardEur === 0
                          ? { bg: "rgba(0,0,0,0.035)", border: "rgba(0,0,0,0.2)", text: "rgba(0,0,0,0.3)" }
                          : reached
                            ? (isActive
                              ? { bg: pal?.bgActive ?? "rgba(0,0,0,0.05)", border: pal?.base ?? "rgba(0,0,0,0.2)", text: pal?.text ?? "rgba(0,0,0,0.4)" }
                              : { bg: "rgba(0,0,0,0.04)", border: pal?.base ?? "rgba(0,0,0,0.18)", text: pal?.text ?? "rgba(0,0,0,0.4)" })
                            : { bg: "rgba(0,0,0,0.03)", border: "rgba(0,0,0,0.12)", text: "rgba(0,0,0,0.25)" };

                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, width: 52 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, fontVariantNumeric: "tabular-nums", ...(reached && t.rewardEur > 0 ? tierGradStyle(t.rewardEur) : { color: "rgba(0,0,0,0.2)" }) }}>
                                {t.rewardEur > 0 ? `${t.rewardEur}€` : "—"}
                              </span>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: nc.bg, border: `2px solid ${nc.border}`, boxShadow: isActive && pal ? pal.glow : "none", transition: "all 0.2s ease" }}>
                                <span style={{ fontSize: t.minPoints > 99 ? 7 : 8, fontWeight: 800, color: nc.text, fontVariantNumeric: "tabular-nums" }}>{t.minPoints}</span>
                              </div>
                              <span style={{ fontSize: 8, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", textAlign: "center", ...(reached && t.rewardEur > 0 ? tierGradStyle(t.rewardEur) : { color: "rgba(0,0,0,0.28)" }) }}>{t.label}</span>
                            </div>
                            {!isLast && (() => {
                              const from = t.minPoints;
                              const to   = sorted[i + 1]?.minPoints ?? from;
                              const pts  = selected.currentPoints;
                              const fillPct = pts <= from ? 0 : pts >= to ? 100 : Math.round(((pts - from) / (to - from)) * 100);
                              const nextPalKey = (sorted[i+1]?.rewardEur ?? 0) >= 1100 ? "gold" : (sorted[i+1]?.rewardEur ?? 0) >= 880 ? "silver" : (sorted[i+1]?.rewardEur ?? 0) >= 550 ? "bronze" : null;
                              const lineColor = nextPalKey ? CIRC[nextPalKey].base : "rgba(0,0,0,0.18)";
                              return (
                                <div style={{ flex: 1, height: 2, borderRadius: 1, background: "rgba(0,0,0,0.06)", marginTop: 1, marginLeft: 2, marginRight: 2, position: "relative", overflow: "hidden" }}>
                                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct}%`, background: lineColor, borderRadius: 1, transition: "width 0.35s ease" }} />
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                    {/* Progress toward next tier */}
                    {(() => {
                      const next = sorted.find(t => t.minPoints > selected.currentPoints);
                      if (!next) return null;
                      const missing = next.minPoints - selected.currentPoints;
                      return (
                        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.055)", display: "flex", alignItems: "center", gap: 8 }}>
                          <TrendingUp size={12} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
                            Noch <strong style={{ color: "#1a1a1a" }}>{missing.toFixed(1)} P</strong> bis zur nächsten Stufe
                            {next.rewardEur > 0 && <> (<strong style={{ fontVariantNumeric: "tabular-nums", ...tierGradStyle(next.rewardEur) }}>{next.rewardEur}€</strong>)</>}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Pillar contribution breakdown */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>Säulen-Beitrag</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {PILLAR_VALS.map((val, i) => {
                      const name    = PILLAR_NAMES[i] ?? `Säule ${i + 1}`;
                      const max     = PILLAR_MAXES[i] ?? 10;
                      const pc      = PILLAR_COLORS_LIST[i] ?? R;
                      const isQual  = i === 3;
                      const missing = val === null;
                      const pctFill = missing ? 0 : max > 0 ? Math.round(((val as number) / max) * 100) : 0;
                      const shareOfTotal = !missing && selected.currentPoints > 0 ? Math.round(((val as number) / selected.currentPoints) * 100) : null;

                      return (
                        <div key={i} style={{ padding: "11px 13px", borderRadius: 9, background: missing ? "rgba(0,0,0,0.015)" : "rgba(0,0,0,0.02)", border: `1px solid ${missing ? "rgba(0,0,0,0.045)" : "rgba(0,0,0,0.055)"}`, opacity: missing ? 0.6 : 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: missing ? "rgba(0,0,0,0.2)" : pc, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{name}</span>
                            {missing ? (
                              <span style={{ fontSize: 9, fontWeight: 600, color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "2px 7px", borderRadius: 20 }}>
                                Noch nicht erfasst
                              </span>
                            ) : (
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: pc, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                                  {typeof val === "number" ? val.toFixed(val % 1 === 0 ? 0 : 1) : "—"}
                                </span>
                                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginLeft: 2 }}>/ {max}{isQual ? " P" : " P"}</span>
                                {shareOfTotal !== null && <div style={{ fontSize: 8, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{shareOfTotal}% des Gesamt</div>}
                              </div>
                            )}
                          </div>
                          {/* Fill bar */}
                          <div style={{ height: 4, borderRadius: 99, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                            {(() => { const lcl: Record<string, string> = { [R]: "#f87171", "#2563eb": "#93b5f8", "#16a34a": "#6ee7a0", "#D97706": "#fbbf4e" }; return <div style={{ height: "100%", width: `${pctFill}%`, borderRadius: 99, backgroundImage: `repeating-linear-gradient(-45deg, ${pc} 0px, ${pc} 3px, ${lcl[pc] ?? pc} 3px, ${lcl[pc] ?? pc} 6px)`, transition: "width 0.35s ease" }} />; })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quality blocking message */}
                {!selected.isQualityDone && (
                  <div style={{ padding: "10px 13px", borderRadius: 9, background: "rgba(217,119,6,0.04)", border: "1px solid rgba(217,119,6,0.18)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <AlertTriangle size={13} strokeWidth={2} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 10, color: "#92400e", lineHeight: 1.5, fontWeight: 500 }}>
                      Prämie noch nicht final — Qualitätsziele wurden für diesen GM noch nicht erfasst. Die aktuelle Prämie ist vorläufig.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Leaderboard modal ─────────────────────────────────────────

// ── Tier gradient styles ──────────────────────────────────────

const GOLD_GRAD: React.CSSProperties = {
  background: "linear-gradient(135deg, #EFB54E 0%, #FFED96 22%, #FCD94C 54%, #F9F793 80%, #EFB94D 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const SILVER_GRAD: React.CSSProperties = {
  background: "linear-gradient(135deg, #DEDFE1 0%, #BCBDC1 26%, #ECEEED 64%, #B6BCBC 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const BRONZE_GRAD: React.CSSProperties = {
  background: "linear-gradient(135deg, #BD965D 0%, #99774A 26%, #DEBF93 64%, #AC9071 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const CUMULATIVE_GREEN = "#15803d";

function tierGradStyle(eur: number): React.CSSProperties {
  if (eur >= 1100) return GOLD_GRAD;
  if (eur >= 880)  return SILVER_GRAD;
  if (eur >= 550)  return BRONZE_GRAD;
  return { color: "rgba(0,0,0,0.28)" };
}

// ── Leaderboard mini wave chart ───────────────────────────────

function LeaderboardMiniWaveChart({ waves }: { waves: GmWave[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const sorted = [...waves].sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);

  if (sorted.length === 0) {
    return (
      <div style={{ marginTop: 12, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.28)" }}>Keine Daten verfügbar</span>
      </div>
    );
  }

  const VW = 600, VH = 64;
  const PAD_L = 10, PAD_R = 54, PAD_T = 12, PAD_B = 16;
  const chartW = VW - PAD_L - PAD_R;
  const chartH = VH - PAD_T - PAD_B;
  const values = sorted.map(w => w.rewardEur);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const avgVal = values.reduce((s, v) => s + v, 0) / values.length;
  const cx = (i: number) => PAD_L + (sorted.length === 1 ? chartW / 2 : i * (chartW / (sorted.length - 1)));
  const cy = (v: number) => PAD_T + (1 - v / maxVal) * chartH;
  const avgY = cy(avgVal);
  const maxIdx = values.indexOf(maxVal);
  const minIdx = values.lastIndexOf(minVal);
  const isMultiPoint = sorted.length > 1;

  // Always green for peak, always red for low
  const peakColor = "#16a34a";
  const lowColor  = "#DC2626";

  // Closed area path used twice with clip paths (above avg = green, below avg = red)
  const linePts = sorted.map((_, i) => `${cx(i)},${cy(values[i])}`).join(" L ");
  const areaPath = `M ${cx(0)},${avgY} L ${linePts} L ${cx(sorted.length - 1)},${avgY} Z`;

  return (
    <div style={{ marginTop: 12 }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={56} style={{ overflow: "visible", display: "block" }}>
        <defs>
          {/* Clip above avgY → green zone */}
          <clipPath id="lbchart-above">
            <rect x={PAD_L - 2} y={0} width={chartW + 4} height={avgY} />
          </clipPath>
          {/* Clip below avgY → red zone */}
          <clipPath id="lbchart-below">
            <rect x={PAD_L - 2} y={avgY} width={chartW + 4} height={VH - avgY} />
          </clipPath>
        </defs>

        {/* Green fill: line above avg */}
        <path d={areaPath} fill="rgba(22,163,74,0.10)" clipPath="url(#lbchart-above)" />
        {/* Red fill: line below avg */}
        <path d={areaPath} fill="rgba(220,38,38,0.08)" clipPath="url(#lbchart-below)" />

        {/* Average dotted guide */}
        <line x1={PAD_L} y1={avgY} x2={VW - PAD_R} y2={avgY}
          stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeDasharray="2.5 3.5" />
        {/* Avg label */}
        <text x={VW - PAD_R + 6} y={avgY + 4}
          fontSize="9.5" fontWeight="700" fill="rgba(0,0,0,0.48)" fontFamily="inherit">
          Ø {Math.round(avgVal)}€
        </text>

        {/* Main line */}
        <polyline points={sorted.map((_, i) => `${cx(i)},${cy(values[i])}`).join(" ")}
          stroke="rgba(0,0,0,0.3)" strokeWidth="1.8" fill="none"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {sorted.map((w, i) => {
          const isPeak = i === maxIdx;
          const isLow  = isMultiPoint && i === minIdx;
          const isHov  = hoveredIdx === i;
          const x = cx(i), y = cy(values[i]);
          const dotColor = isPeak ? peakColor : isLow ? lowColor : "rgba(0,0,0,0.28)";
          const dotFill  = isPeak ? peakColor : isLow ? lowColor : "#fff";
          const dotR     = isPeak || isLow ? 4.2 : 2.6;
          return (
            <g key={w.waveId}>
              {/* Soft outer glow for peak / low */}
              {(isPeak || isLow) && <circle cx={x} cy={y} r={8} fill={dotColor} fillOpacity={0.12} />}

              {/* Main dot */}
              <circle cx={x} cy={y}
                r={dotR}
                fill={dotFill}
                stroke={dotColor}
                strokeWidth={(isPeak || isLow) ? 0 : 1.4} />

              {/* Static peak label — hidden while this dot is hovered */}
              {isPeak && !isHov && (
                <text x={x} y={y - 9}
                  fontSize="7.5" fontWeight="800" fill={peakColor} textAnchor="middle" fontFamily="inherit">
                  {w.rewardEur.toLocaleString("de-AT")}€
                </text>
              )}

              {/* Hover tooltip: quarter label on top, value below it, both above the dot */}
              {isHov && (
                <>
                  <text x={x} y={y - 20}
                    fontSize="7" fontWeight="600" fill="rgba(0,0,0,0.4)" textAnchor="middle" fontFamily="inherit">
                    {w.label}
                  </text>
                  <text x={x} y={y - 10}
                    fontSize="8.5" fontWeight="800" fill="#1a1a1a" textAnchor="middle" fontFamily="inherit">
                    {w.rewardEur.toLocaleString("de-AT")}€
                  </text>
                </>
              )}

              {/* Transparent hit area */}
              <circle cx={x} cy={y} r={12}
                fill="transparent"
                style={{ cursor: "default" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)} />
            </g>
          );
        })}

        {/* X-axis labels: first + last only */}
        {sorted.length > 0 && (
          <>
            <text x={cx(0)} y={VH}
              fontSize="7" fontWeight="600" fill="rgba(0,0,0,0.28)" textAnchor="middle" fontFamily="inherit">
              {sorted[0].label}
            </text>
            {sorted.length > 1 && (
              <text x={cx(sorted.length - 1)} y={VH}
                fontSize="7" fontWeight="600" fill="rgba(0,0,0,0.28)" textAnchor="middle" fontFamily="inherit">
                {sorted[sorted.length - 1].label}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

function DeltaText({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontWeight: 500 }}>—</span>;
  const pos = pct >= 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: pos ? "#16a34a" : R, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
      {pos ? "+" : ""}{pct}%
    </span>
  );
}

function PraemienLeaderboardModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(ALL_GMS[0].id);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const leaderboard = buildLeaderboard();
  const filtered = leaderboard.filter(e => {
    const q = search.toLowerCase().trim();
    return !q || e.gmName.toLowerCase().includes(q);
  });
  const selected = leaderboard.find(e => e.gmId === selectedId) ?? leaderboard[0];

  const totalAllGms = leaderboard.reduce((n, e) => n + e.cumulative, 0);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
    >
      <style>{`
        @keyframes lbIn { from { opacity:0; transform:scale(0.97) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .lb-scroll::-webkit-scrollbar { width: 3px; }
        .lb-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 860, height: "min(680px, 92vh)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "lbIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        {/* Modal header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Trophy size={15} strokeWidth={1.8} color={R} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Leaderboard</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
              Kumulierte Prämien · alle Wellen · {leaderboard.length} GMs · Gesamt: {totalAllGms.toLocaleString("de-AT")}€
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)", transition: "background 0.12s ease", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* ── Left: ranking list ── */}
          <div style={{ width: 270, borderRight: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 9px", height: 30, borderRadius: 7, background: "rgba(0,0,0,0.04)", border: "1px solid transparent", transition: "border 0.15s" }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
              >
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="GM suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }} />
                {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center" }}><X size={10} strokeWidth={2} /></button>}
              </div>
            </div>
            {/* Ranking rows */}
            <div className="lb-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {filtered.map((entry, idx) => {
                const rank = leaderboard.indexOf(entry) + 1;
                const active = entry.gmId === selectedId;
                const rankColor = rank === 1 ? "#D97706" : rank === 2 ? "rgba(0,0,0,0.45)" : rank === 3 ? "#92400e" : "rgba(0,0,0,0.28)";
                return (
                  <div key={entry.gmId} onClick={() => setSelectedId(entry.gmId)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: `3px solid ${active ? R : "transparent"}`, transition: "all 0.12s ease" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* Rank */}
                    <div style={{ width: 20, flexShrink: 0, textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: rankColor, fontVariantNumeric: "tabular-nums" }}>{rank}</span>
                    </div>
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.4)" }}>
                      {entry.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    {/* Name + region */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.gmName}</div>
                      <div style={{ fontSize: 8, color: "rgba(0,0,0,0.35)", fontWeight: 500, marginTop: 1 }}>{entry.region} · {entry.waveCount} Wellen</div>
                    </div>
                    {/* Cumulative */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: CUMULATIVE_GREEN, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{entry.cumulative.toLocaleString("de-AT")}€</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: "28px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Keine GMs gefunden</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: GM detail ── */}
          {selected && (
            <div className="lb-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {/* Hero */}
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "rgba(0,0,0,0.4)", border: "2px solid rgba(0,0,0,0.1)" }}>
                    {selected.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{selected.gmName}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.35)", background: "rgba(0,0,0,0.05)", padding: "2px 7px", borderRadius: 20 }}>{selected.region}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                      {selected.waveCount} Prämien-Wellen · Bestes Quartal: {selected.bestWave.toLocaleString("de-AT")}€
                    </div>
                  </div>
                  {/* Cumulative hero */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.04em", color: CUMULATIVE_GREEN, fontVariantNumeric: "tabular-nums" }}>{selected.cumulative.toLocaleString("de-AT")}€</div>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginTop: 1 }}>Gesamt kumuliert</div>
                  </div>
                </div>

                {/* Quarter progression mini chart */}
                <LeaderboardMiniWaveChart waves={selected.waves} />
              </div>

              {/* Wave timeline */}
              <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 4 }}>Prämienverlauf</div>
                {selected.waves.map((wave, i) => {
                  const isActive = wave.status === "in_progress";
                  const delta = calcWaveDelta(selected.waves, i);
                  const rewardGradStyle = tierGradStyle(wave.rewardEur);
                  return (
                    <div key={wave.waveId}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11, background: isActive ? "rgba(220,38,38,0.025)" : "rgba(0,0,0,0.018)", border: `1px solid ${isActive ? "rgba(220,38,38,0.12)" : "rgba(0,0,0,0.055)"}`, transition: "border 0.15s" }}
                    >
                      {/* Timeline dot */}
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: isActive ? R : "rgba(0,0,0,0.15)", boxShadow: isActive ? `0 0 0 3px rgba(220,38,38,0.12)` : "none" }} />

                      {/* Wave label + period */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? R : "#1a1a1a", letterSpacing: "-0.01em" }}>{wave.label}</span>
                          {isActive && (
                            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: R, background: "rgba(220,38,38,0.09)", padding: "2px 7px", borderRadius: 20 }}>
                              In Bearbeitung
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500, marginTop: 1 }}>{wave.periodLabel}</div>
                      </div>

                      {/* Delta vs previous */}
                      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 44 }}>
                        {i < selected.waves.length - 1 && (
                          <div style={{ marginBottom: 2 }}>
                            <DeltaText pct={delta} />
                          </div>
                        )}
                        {i < selected.waves.length - 1 && delta !== null && (
                          <div style={{ fontSize: 8, color: "rgba(0,0,0,0.28)", fontWeight: 500, whiteSpace: "nowrap" }}>vs {selected.waves[i + 1].label}</div>
                        )}
                      </div>

                      {/* Payout */}
                      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 58 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", ...rewardGradStyle }}>
                          {wave.rewardEur > 0 ? `${wave.rewardEur.toLocaleString("de-AT")}€` : "—"}
                        </div>
                        {wave.rewardEur === 0 && <div style={{ fontSize: 8, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>Kein Bonus</div>}
                      </div>
                    </div>
                  );
                })}
                {selected.waves.length === 0 && (
                  <div style={{ padding: "24px 0", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)" }}>Keine Wellen-Daten verfügbar</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Validation rail ───────────────────────────────────────────

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
}

function computeIssues(quarter: PraemienQuarter, sources: BonusSource[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (quarter.thresholds.length < 2) issues.push({ severity: "error", message: "Weniger als 2 Schwellwerte konfiguriert." });
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPoints <= sorted[i - 1].minPoints) issues.push({ severity: "error", message: `Schwellwerte überschneiden sich: "${sorted[i - 1].label}" & "${sorted[i].label}".` });
  }
  for (const p of quarter.pillars) {
    if (p.name === "Qualitätsziele") continue; // manual pillar — no boni sources expected
    if (p.sourceRefs.length === 0) issues.push({ severity: "warning", message: `Säule "${p.name}" hat keine Quellen.` });
  }
  const usedKeys = new Set<string>();
  const dupes = new Set<string>();
  for (const p of quarter.pillars) {
    for (const r of p.sourceRefs) {
      if (usedKeys.has(r.id)) dupes.add(r.id);
      usedKeys.add(r.id);
    }
  }
  if (dupes.size > 0) issues.push({ severity: "error", message: `${dupes.size} Quelle(n) mehrfach zugewiesen.` });
  const totalAssigned = quarter.pillars.reduce((n, p) => n + p.sourceRefs.length, 0);
  if (sources.length > 0 && totalAssigned === 0) issues.push({ severity: "info", message: "Noch keine Quellen zugewiesen." });
  // Quality goals completion
  if (!qualityIsComplete(quarter)) {
    const doneCount = (quarter.qualitySubmissions ?? []).length;
    issues.push({ severity: "warning", message: `Qualitätsziele: ${doneCount} / ${ALL_GMS.length} GMs bewertet.` });
  }
  return issues;
}

function ValidationRail({ quarter, sources }: { quarter: PraemienQuarter | null; sources: BonusSource[] }) {
  if (!quarter) return null;
  const issues = computeIssues(quarter, sources);
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");

  return (
    <div style={{ marginBottom: 16, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
      {/* Grey header */}
      <div style={{ padding: "13px 18px", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>
          {`Validierung${issues.length > 0 ? ` (${issues.length})` : ""}`}
        </span>
      </div>
      {/* White inner card */}
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {issues.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <CheckCircle2 size={14} strokeWidth={2} color="#16a34a" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>Alles in Ordnung</span>
          </div>
        ) : [...errors, ...warnings, ...infos].map((issue, i) => {
          const cfg = {
            error:   { color: R, bg: "rgba(220,38,38,0.06)",   Icon: AlertTriangle },
            warning: { color: "#D97706", bg: "rgba(217,119,6,0.06)", Icon: AlertTriangle },
            info:    { color: "#2563eb", bg: "rgba(37,99,235,0.05)", Icon: Circle },
          }[issue.severity];
          return (
            <div key={i} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: cfg.bg }}>
              <cfg.Icon size={12} strokeWidth={2.5} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: "#1a1a1a", lineHeight: 1.5 }}>{issue.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GM preview card ───────────────────────────────────────────

function GMPreviewCard({ quarter }: { quarter: PraemienQuarter | null }) {
  if (!quarter) return null;

  const MOCK_GM_PCT = [87, 73, 91, 65]; // simulated GM progress per pillar
  const totalMaxPts = quarter.pillars.reduce((n, p) => n + p.sourceRefs.reduce((s, r) => s + r.boniValue, 0), 0);
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const simulatedPts = Math.round(totalMaxPts * 0.78);
  const currentTier = [...sorted].reverse().find(t => simulatedPts >= t.minPoints) ?? sorted[0];
  const nextTier = currentTier ? sorted.find(t => t.minPoints > (currentTier?.minPoints ?? 0)) : null;

  const tierColor = (eur: number) => eur === 0 ? R : eur <= 550 ? "#f97316" : eur <= 880 ? "#eab308" : "#16a34a";

  return (
    <Card style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      {/* Grey header area */}
      <div style={{ padding: "13px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>GM-Ansicht Vorschau</span>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Simuliert · 78% Erreichung</span>
      </div>

      {/* White inner card with margins on sides and bottom */}
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: "14px" }}>
        {/* Quarter label */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em", marginBottom: 12 }}>
          Q{quarter.quarter} {quarter.year} · {fmtDate(quarter.startDate)} – {fmtDate(quarter.endDate)}
        </div>

        {/* Pillar rings */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          {quarter.pillars.map((p, i) => {
            const pct = MOCK_GM_PCT[i] ?? 70;
            const color = pct >= 85 ? "#22c55e" : pct >= 70 ? "#f97316" : R;
            return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", border: `2.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}10` }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color }}>{pct}%</span>
                </div>
                <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.4)", textAlign: "center", maxWidth: 52, lineHeight: 1.3 }}>{p.name.slice(0, 14)}</span>
              </div>
            );
          })}
        </div>

        {/* Current tier */}
        {currentTier && (
          <div style={{ borderRadius: 10, padding: "12px 14px", marginBottom: 12, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>Aktueller Bonus</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", ...tierGradStyle(currentTier.rewardEur) }}>{currentTier.rewardEur}€</span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.3)" }}>von {sorted[sorted.length - 1]?.rewardEur ?? 0}€</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>Stufe: {currentTier.label}</div>
            </div>
            <Award size={18} strokeWidth={1.5} color="rgba(0,0,0,0.15)" />
          </div>
        )}

        {/* Points bar */}
        {totalMaxPts > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>{simulatedPts} / {totalMaxPts} Punkte</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: R }}>{Math.round((simulatedPts / totalMaxPts) * 100)}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (simulatedPts / totalMaxPts) * 100)}%`, borderRadius: 3, background: `linear-gradient(to right, ${R}80, ${R})`, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        {/* Next tier hint */}
        {nextTier && (
          <div style={{ padding: "9px 12px", borderRadius: 9, background: `rgba(220,38,38,0.04)`, border: "1px solid rgba(220,38,38,0.1)", display: "flex", gap: 8 }}>
            <TrendingUp size={13} strokeWidth={2} color={tierColor(nextTier.rewardEur)} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", lineHeight: 1.5 }}>
              Noch <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{nextTier.minPoints - simulatedPts} Punkte</span> bis <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", ...tierGradStyle(nextTier.rewardEur) }}>{nextTier.rewardEur}€</span> ({nextTier.label})
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <Card>
      <div style={{ padding: "60px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Gift size={24} strokeWidth={1.5} color={R} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>Noch kein Quartal erstellt</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", maxWidth: 340, lineHeight: 1.6 }}>
            Erstelle dein erstes Prämienquartal und verknüpfe Bonus-Quellen aus den Fragebögen mit den 4 Säulen.
          </div>
        </div>
        <PrimaryBtn onClick={onNew}>
          <Plus size={12} strokeWidth={2.5} />
          Neues Quartal erstellen
        </PrimaryBtn>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function PraemienPage() {
  const { modules } = useModules();
  const { fragebogenList } = useFragebogen();
  const { modules: flexModules } = useFlexModules();
  const { modules: billaModules } = useBillaModules();
  const { modules: kuehlerModules } = useKuehlerModules();
  const { modules: mhdModules } = useMhdModules();

  const [quarters, setQuarters] = useState<PraemienQuarter[]>([]);
  const [activeQuarterId, setActiveQuarterId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showGmProgress, setShowGmProgress] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gmRegionFilter, setGmRegionFilter] = useState<RegionFilter>("Alle");

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]") as PraemienQuarter[];
      if (stored.length > 0) {
        setQuarters(stored);
        setActiveQuarterId(stored[0].id);
      }
    } catch {}
  }, []);

  // Save to localStorage on quarters change
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(quarters)); } catch {}
  }, [quarters, mounted]);

  // Normalize sources from all contexts
  const fbNameMap: Record<string, string> = {};
  for (const fb of fragebogenList) {
    for (const mid of fb.moduleIds) fbNameMap[mid] = fb.name;
  }

  const realSources: BonusSource[] = [
    ...normalizeSources(modules, fbNameMap, "standard"),
    ...normalizeSources(flexModules, {}, "flex"),
    ...normalizeSources(billaModules, {}, "billa"),
    ...normalizeSources(kuehlerModules, {}, "kuehler"),
    ...normalizeSources(mhdModules, {}, "mhd"),
  ];

  // Use real sources if available, otherwise mock
  const bonusSources = realSources.length > 0 ? realSources : MOCK_SOURCES;

  const totalPoints = bonusSources.reduce((n, s) => n + s.boniValue, 0);

  const activeQuarter = quarters.find(q => q.id === activeQuarterId) ?? null;

  const updateQuarter = useCallback((updated: PraemienQuarter) => {
    setQuarters(prev => prev.map(q => q.id === updated.id ? updated : q));
  }, []);

  const createNewQuarter = () => {
    const now = new Date();
    const year = now.getFullYear();
    const q = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    const { startDate, endDate } = getQuarterDates(year, q);
    const newQ: PraemienQuarter = {
      id: uid(),
      name: `Prämien Q${q} ${year}`,
      year,
      quarter: q,
      status: "draft",
      startDate,
      endDate,
      description: "",
      pillars: buildDefaultPillars(),
      thresholds: buildDefaultThresholds(bonusSources.reduce((n, s) => n + s.boniValue, 0)),
      qualitySubmissions: [],
      createdAt: new Date().toISOString(),
    };
    setQuarters(prev => [newQ, ...prev]);
    setActiveQuarterId(newQ.id);
  };

  const issues = activeQuarter ? computeIssues(activeQuarter, bonusSources) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
        @keyframes praemienFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .praemien-main { animation: praemienFadeIn 0.25s ease both; }
      `}</style>

      {/* Quarter switcher bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <QuarterSwitcher
          quarters={quarters}
          activeId={activeQuarterId}
          onSelect={setActiveQuarterId}
          onNew={createNewQuarter}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GhostBtn onClick={() => setShowLeaderboard(true)}>
            <Trophy size={11} strokeWidth={2} />
            Leaderboard
          </GhostBtn>
          {activeQuarter && (
            <>
              <GhostBtn onClick={() => {
                const copy: PraemienQuarter = { ...activeQuarter, id: uid(), name: `Kopie von ${activeQuarter.name}`, status: "draft", createdAt: new Date().toISOString() };
                setQuarters(prev => [copy, ...prev]);
                setActiveQuarterId(copy.id);
              }}>
                <Copy size={11} strokeWidth={2} />
                Duplizieren
              </GhostBtn>
              <GhostBtn danger onClick={() => {
                const filtered = quarters.filter(q => q.id !== activeQuarterId);
                setQuarters(filtered);
                setActiveQuarterId(filtered[0]?.id ?? null);
              }}>
                <Trash2 size={11} strokeWidth={2} />
                Löschen
              </GhostBtn>
            </>
          )}
        </div>
      </div>

      {!activeQuarter ? (
        <EmptyState onNew={createNewQuarter} />
      ) : (
        <div className="praemien-main" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* ── Left main column ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>

            <QuarterHeaderCard
              quarter={activeQuarter}
              onChange={updateQuarter}
              regionFilter={gmRegionFilter}
              onRegionChange={setGmRegionFilter}
              onOpenGmDetail={() => setShowGmProgress(true)}
            />

            <OverviewStrip
              quarter={activeQuarter}
              totalSources={bonusSources.length}
              totalPoints={Math.round(activeQuarter.pillars.reduce((n, p) => n + p.sourceRefs.reduce((s, r) => s + r.boniValue, 0), 0) * 10) / 10}
              issues={issues.length}
            />

            <ThresholdDesignerCard quarter={activeQuarter} onChange={updateQuarter} />

            {/* Pillars grid */}
            <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
              {/* Grey header */}
              <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>4 Säulen · Boni-Gewichtung</span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>
                  Punkte pro Antwort — Ziel: {activeQuarter.thresholds.find(t => t.label === "Voller Bonus")?.minPoints ?? 0} P
                </span>
              </div>
              {/* White inner card */}
              <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {activeQuarter.pillars.map((p, i) => (
                  i === 3 ? (
                    <QualityPillarCard
                      key={p.id}
                      pillar={p}
                      pillarIndex={i}
                      quarter={activeQuarter}
                      onUpdateQuarter={updateQuarter}
                    />
                  ) : (
                    <PillarCard
                      key={p.id}
                      pillar={p}
                      pillarIndex={i}
                      quarter={activeQuarter}
                      sources={bonusSources}
                      onChange={updatedPillar => {
                        updateQuarter({
                          ...activeQuarter,
                          pillars: activeQuarter.pillars.map(pp => pp.id === updatedPillar.id ? updatedPillar : pp),
                        });
                      }}
                    />
                  )
                ))}
              </div>
              {/* end white inner card */}
            </div>

            <BonusSourceExplorer
              sources={bonusSources}
              quarter={activeQuarter}
              onChange={updateQuarter}
            />
          </div>

          {/* ── Right sticky rail ── */}
          <div style={{ width: 288, flexShrink: 0, position: "sticky", top: 20 }}>
            <ValidationRail quarter={activeQuarter} sources={bonusSources} />
            <GMPreviewCard quarter={activeQuarter} />
          </div>
        </div>
      )}

      {/* GM Progress Modal */}
      {showGmProgress && activeQuarter && (
        <GMProgressModal
          quarter={activeQuarter}
          initialRegion={gmRegionFilter}
          onClose={() => setShowGmProgress(false)}
        />
      )}
      {showLeaderboard && (
        <PraemienLeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
