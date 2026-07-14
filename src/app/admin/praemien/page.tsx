"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  Plus, ChevronDown, ChevronRight, Search, X, Check, Trophy,
  Gift, AlertTriangle, Zap, ShoppingBag, Refrigerator, FlaskConical,
  ClipboardList, Pencil, Trash2, TrendingUp, Award, Copy, Eye,
  BarChart3, CheckCircle2, Circle, Minus, Upload,
} from "lucide-react";
import {
  BackendApiError,
  createAdminPraemienWave,
  deleteAdminPraemienWave,
  fetchGmUsers,
  fetchAdminPraemienSources,
  fetchAdminPraemienWave,
  fetchAdminPraemienWaves,
  patchAdminPraemienWave,
  readAuthSession,
  replaceAdminPraemienFlexScores,
  replaceAdminPraemienPillars,
  replaceAdminPraemienQualityScores,
  replaceAdminPraemienSources,
  replaceAdminPraemienThresholds,
} from "@/lib/api/backend";
import type {
  PraemienQuarter, PraemienPillar, PraemienThreshold, PraemienSourceRef, SectionType,
  PraemienFlexSubmission, PraemienQualitySubmission, PraemienQualityCriteria,
} from "@/types/praemien";
import { exportPraemienExcel } from "@/lib/exports/analysisExports";

// ── Constants ─────────────────────────────────────────────────

const R = "#DC2626";
const RD = "#b91c1c";
const WAVE_AUTOSAVE_DEBOUNCE_MS = 700;
type AutosaveSection = "metadata" | "thresholds" | "pillars" | "sources" | "quality" | "flex";
type AutosaveSectionState = "clean" | "dirty" | "saving" | "blocked" | "conflict";
const AUTOSAVE_SECTION_ORDER: AutosaveSection[] = ["metadata", "thresholds", "pillars", "sources", "quality", "flex"];
const AUTOSAVE_SECTION_LABELS: Record<AutosaveSection, string> = {
  metadata: "Metadaten",
  thresholds: "Schwellen",
  pillars: "Säulen",
  sources: "Quellen",
  quality: "Qualität",
  flex: "Flex",
};
const INITIAL_SECTION_STATES: Record<AutosaveSection, AutosaveSectionState> = {
  metadata: "clean",
  thresholds: "clean",
  pillars: "clean",
  sources: "clean",
  quality: "clean",
  flex: "clean",
};

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.08)",  Icon: ClipboardList },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.08)", Icon: Zap },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.08)",  Icon: ShoppingBag },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.08)", Icon: Refrigerator },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)", Icon: FlaskConical },
};

type PillarDefaultDefinition = Pick<PraemienPillar, "name" | "description" | "color"> & {
  kind: "execution" | "distribution" | "flex" | "quality";
};

const PILLAR_DEFAULTS: PillarDefaultDefinition[] = [
  { kind: "execution",    name: "Schütten / Displays", description: "Korrekte Aufstellung und Befüllung von Schüttenregalen und Displays.", color: "#DC2626" },
  { kind: "distribution", name: "Distributionsziel",   description: "Zielerreichung bei der Listung und Verfügbarkeit der Kernprodukte.",   color: "#2563eb" },
  { kind: "flex",         name: "Flexziel",            description: "Ergebnisse aus Flexbesuchen und saisonalen Aktionszielen.",            color: "#16a34a" },
  { kind: "quality",      name: "Qualitätsziele",      description: "Qualität der Marktbesuche anhand von Bewertungsfragen.",               color: "#D97706" },
];


// ── Utility ───────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 10); }
function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function buildDefaultPillars(): PraemienPillar[] {
  return PILLAR_DEFAULTS.map((definition) => {
    const { kind, ...pillarDefinition } = definition;
    const base = { id: uid(), ...pillarDefinition, sourceRefs: [] };
    if (kind === "execution") {
      return {
        ...base,
        payoutMode: "highest_tier" as const,
        maxRewardEur: 550,
        metrics: [{ id: uid(), key: "achievement_percent", label: "Zielerreichung", unit: "percent" as const, valueSource: "contribution_percent" as const, orderIndex: 0 }],
        tiers: [
          { id: uid(), label: "50 % der Säule", orderIndex: 0, rewardEur: 275, conditions: [{ id: uid(), metricKey: "achievement_percent", operator: "gte" as const, thresholdValue: 70, orderIndex: 0 }] },
          { id: uid(), label: "80 % der Säule", orderIndex: 1, rewardEur: 440, conditions: [{ id: uid(), metricKey: "achievement_percent", operator: "gte" as const, thresholdValue: 80, orderIndex: 0 }] },
          { id: uid(), label: "100 % der Säule", orderIndex: 2, rewardEur: 550, conditions: [{ id: uid(), metricKey: "achievement_percent", operator: "gte" as const, thresholdValue: 95, orderIndex: 0 }] },
        ],
      };
    }
    if (kind === "distribution") {
      return {
        ...base,
        payoutMode: "highest_tier" as const,
        maxRewardEur: 165,
        metrics: [{ id: uid(), key: "availability_percent", label: "Verfügbarkeit", unit: "percent" as const, valueSource: "contribution_percent" as const, orderIndex: 0 }],
        tiers: [
          { id: uid(), label: "50 % der Säule", orderIndex: 0, rewardEur: 82.5, conditions: [{ id: uid(), metricKey: "availability_percent", operator: "gte" as const, thresholdValue: 80, orderIndex: 0 }] },
          { id: uid(), label: "100 % der Säule", orderIndex: 1, rewardEur: 165, conditions: [{ id: uid(), metricKey: "availability_percent", operator: "gte" as const, thresholdValue: 90, orderIndex: 0 }] },
        ],
      };
    }
    if (kind === "flex") {
      return {
        ...base,
        payoutMode: "highest_tier" as const,
        maxRewardEur: 165,
        metrics: [
          { id: uid(), key: "cooler_points", label: "Kühler", unit: "points" as const, valueSource: "flex_component" as const, sourceKey: "cooler_points", orderIndex: 0 },
          { id: uid(), key: "red_points", label: "RED / IR", unit: "points" as const, valueSource: "flex_component" as const, sourceKey: "red_points", orderIndex: 1 },
          { id: uid(), key: "total_points", label: "Gesamt", unit: "points" as const, valueSource: "flex_total_points" as const, orderIndex: 2 },
        ],
        tiers: [
          { id: uid(), label: "50 % der Säule", orderIndex: 0, rewardEur: 82.5, conditions: [
            { id: uid(), metricKey: "cooler_points", operator: "gte" as const, thresholdValue: 5, orderIndex: 0 },
            { id: uid(), metricKey: "red_points", operator: "gte" as const, thresholdValue: 5, orderIndex: 1 },
            { id: uid(), metricKey: "total_points", operator: "gte" as const, thresholdValue: 10, orderIndex: 2 },
          ] },
          { id: uid(), label: "100 % der Säule", orderIndex: 1, rewardEur: 165, conditions: [
            { id: uid(), metricKey: "cooler_points", operator: "gte" as const, thresholdValue: 5, orderIndex: 0 },
            { id: uid(), metricKey: "red_points", operator: "gte" as const, thresholdValue: 5, orderIndex: 1 },
            { id: uid(), metricKey: "total_points", operator: "gte" as const, thresholdValue: 15, orderIndex: 2 },
          ] },
        ],
      };
    }
    return {
      ...base,
      payoutMode: "sum_earned_tiers" as const,
      maxRewardEur: 220,
      metrics: [
        { id: uid(), key: "reporting_percent", label: "Reporting", unit: "percent" as const, valueSource: "quality_reporting" as const, orderIndex: 0 },
        { id: uid(), key: "survey_percent", label: "Survey / Bilder", unit: "percent" as const, valueSource: "quality_accuracy" as const, orderIndex: 1 },
        { id: uid(), key: "time_percent", label: "Zeitmanagement", unit: "percent" as const, valueSource: "quality_zeiterfassung" as const, orderIndex: 2 },
      ],
      tiers: [
        { id: uid(), label: "Reporting", orderIndex: 0, rewardEur: 55, conditions: [{ id: uid(), metricKey: "reporting_percent", operator: "gte" as const, thresholdValue: 25, orderIndex: 0 }] },
        { id: uid(), label: "Survey / Bilder", orderIndex: 1, rewardEur: 55, conditions: [{ id: uid(), metricKey: "survey_percent", operator: "gte" as const, thresholdValue: 25, orderIndex: 0 }] },
        { id: uid(), label: "Zeitmanagement", orderIndex: 2, rewardEur: 110, conditions: [{ id: uid(), metricKey: "time_percent", operator: "gte" as const, thresholdValue: 25, orderIndex: 0 }] },
      ],
    };
  });
}

function isDistributionPillar(pillars: PraemienPillar[], pillarId: string): boolean {
  const p = pillars.find(x => x.id === pillarId);
  return p?.name === "Distributionsziel";
}

function normalizePillarName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isFlexPillar(pillar: Pick<PraemienPillar, "name">): boolean {
  return normalizePillarName(pillar.name).includes("flexziel");
}

function isQualityPillar(pillar: Pick<PraemienPillar, "name">): boolean {
  const normalized = normalizePillarName(pillar.name);
  return normalized.includes("qualitatsziele") || normalized.includes("qualitaetsziele") || normalized.includes("qualitat");
}

function isManualPillar(pillar: Pick<PraemienPillar, "name">): boolean {
  return isFlexPillar(pillar) || isQualityPillar(pillar);
}

function buildDefaultThresholds(totalPoints = 0): PraemienThreshold[] {
  const vollerBonus = Math.round(totalPoints * 0.95);
  const total = vollerBonus > 0 ? vollerBonus / 0.95 : 0;
  const raw: PraemienThreshold[] = [
    { id: uid(), label: "Kein Bonus",   minPoints: 0,                          rewardEur: 0    },
    { id: uid(), label: "Teilbonus",    minPoints: Math.round(total * 0.70),   rewardEur: 550  },
    { id: uid(), label: "Zielbonus",    minPoints: Math.round(total * 0.80),   rewardEur: 880  },
    { id: uid(), label: "Voller Bonus", minPoints: vollerBonus,                rewardEur: 1100 },
  ];
  const normalized: PraemienThreshold[] = [];
  let previous = -1;
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (!entry) continue;
    const next = index === 0 ? 0 : (entry.minPoints <= previous ? previous + 1 : entry.minPoints);
    normalized.push({ ...entry, minPoints: next });
    previous = next;
  }
  return normalized;
}

function recalcThresholdsFromVollerBonus(thresholds: PraemienThreshold[], newVollerPoints: number): PraemienThreshold[] {
  const total = newVollerPoints > 0 ? newVollerPoints / 0.95 : 0;
  const raw = thresholds.map(t => {
    if (t.label === "Kein Bonus")   return { ...t, minPoints: 0 };
    if (t.label === "Teilbonus")    return { ...t, minPoints: Math.round(total * 0.70) };
    if (t.label === "Zielbonus")    return { ...t, minPoints: Math.round(total * 0.80) };
    if (t.label === "Voller Bonus") return { ...t, minPoints: newVollerPoints };
    return t;
  });
  const normalized: PraemienThreshold[] = [];
  let previous = -1;
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (!entry) continue;
    const next = index === 0 ? 0 : (entry.minPoints <= previous ? previous + 1 : entry.minPoints);
    normalized.push({ ...entry, minPoints: next });
    previous = next;
  }
  return normalized;
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

function toUiQuarter(serverWave: PraemienQuarter): PraemienQuarter {
  return {
    ...serverWave,
    qualitySubmissions: serverWave.qualitySubmissions ?? [],
    flexSubmissions: serverWave.flexSubmissions ?? [],
  };
}

function toCreatePayload(input: {
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: string;
  endDate: string;
  description: string;
  status?: "draft" | "active" | "archived";
  timezone?: string;
  thresholds: PraemienThreshold[];
  pillars: PraemienPillar[];
}) {
  return {
    name: input.name,
    year: input.year,
    quarter: input.quarter,
    status: input.status ?? "draft",
    startDate: input.startDate,
    endDate: input.endDate,
    description: input.description,
    timezone: input.timezone ?? "Europe/Vienna",
    rewardModel: "pillar_tiers" as const,
    thresholds: input.thresholds.map((entry, index) => ({
      label: entry.label,
      orderIndex: index,
      minPoints: entry.minPoints,
      rewardEur: entry.rewardEur,
    })),
    pillars: input.pillars.map((entry, index) => ({
      name: entry.name,
      description: entry.description,
      color: entry.color,
      orderIndex: index,
      isManual: isManualPillar(entry),
      payoutMode: entry.payoutMode,
      maxRewardEur: entry.maxRewardEur,
      metrics: entry.metrics.map((metric, metricIndex) => ({
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        valueSource: metric.valueSource,
        sourceKey: metric.sourceKey ?? null,
        orderIndex: metricIndex,
      })),
      tiers: entry.tiers.map((tier, tierIndex) => ({
        label: tier.label,
        orderIndex: tierIndex,
        rewardEur: tier.rewardEur,
        conditions: tier.conditions.map((condition, conditionIndex) => ({
          metricKey: condition.metricKey,
          operator: condition.operator,
          thresholdValue: condition.thresholdValue,
          orderIndex: conditionIndex,
        })),
      })),
    })),
  };
}

function toPatchPayload(quarter: PraemienQuarter): {
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: "draft" | "active" | "archived";
  startDate: string;
  endDate: string;
  description: string;
  timezone: string;
  rewardModel: PraemienQuarter["rewardModel"];
  expectedUpdatedAt?: string;
} {
  return {
    name: quarter.name,
    year: quarter.year,
    quarter: quarter.quarter,
    status: quarter.status,
    startDate: quarter.startDate,
    endDate: quarter.endDate,
    description: quarter.description,
    timezone: quarter.timezone ?? "Europe/Vienna",
    rewardModel: quarter.rewardModel,
    expectedUpdatedAt: quarter.updatedAt,
  };
}

function toThresholdsPayload(quarter: PraemienQuarter): { thresholds: Array<{ id?: string; label: string; orderIndex: number; minPoints: number; rewardEur: number }>; expectedUpdatedAt?: string } {
  return {
    expectedUpdatedAt: quarter.updatedAt,
    thresholds: quarter.thresholds.map((entry, index) => ({
      id: isUuid(entry.id) ? entry.id : undefined,
      label: entry.label,
      orderIndex: index,
      minPoints: entry.minPoints,
      rewardEur: entry.rewardEur,
    })),
  };
}

function toPillarsPayload(quarter: PraemienQuarter) {
  return {
    expectedUpdatedAt: quarter.updatedAt,
    pillars: quarter.pillars.map((entry, index) => ({
      id: isUuid(entry.id) ? entry.id : undefined,
      name: entry.name,
      description: entry.description,
      color: entry.color,
      orderIndex: index,
      isManual: isManualPillar(entry),
      payoutMode: entry.payoutMode,
      maxRewardEur: entry.maxRewardEur,
      metrics: entry.metrics.map((metric, metricIndex) => ({
        id: isUuid(metric.id) ? metric.id : undefined,
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        valueSource: metric.valueSource,
        sourceKey: metric.sourceKey ?? null,
        orderIndex: metricIndex,
      })),
      tiers: entry.tiers.map((tier, tierIndex) => ({
        id: isUuid(tier.id) ? tier.id : undefined,
        label: tier.label,
        orderIndex: tierIndex,
        rewardEur: tier.rewardEur,
        conditions: tier.conditions.map((condition, conditionIndex) => ({
          id: isUuid(condition.id) ? condition.id : undefined,
          metricKey: condition.metricKey,
          operator: condition.operator,
          thresholdValue: condition.thresholdValue,
          orderIndex: conditionIndex,
        })),
      })),
    })),
  };
}

function toSourcesPayload(quarter: PraemienQuarter, serverPillarByName?: Map<string, string>): { sources: Array<{ id?: string; pillarId: string; sectionType: SectionType; fragebogenId: string | null; fragebogenName: string; moduleId: string | null; moduleName: string; questionId: string; questionText: string; scoringKey: string; displayLabel: string; isFactorMode: boolean; boniValue: number; distributionFreqRule: "lt8" | "gt8" | null }>; expectedUpdatedAt?: string } {
  return {
    expectedUpdatedAt: quarter.updatedAt,
    sources: quarter.pillars.flatMap((pillar) =>
      isManualPillar(pillar) ? [] : pillar.sourceRefs.map((source) => ({
        id: isUuid(source.id) ? source.id : undefined,
        pillarId: serverPillarByName?.get(pillar.name) ?? pillar.id,
        sectionType: source.sectionType,
        fragebogenId: source.fragebogenId || null,
        fragebogenName: source.fragebogenName,
        moduleId: source.moduleId || null,
        moduleName: source.moduleName,
        questionId: source.questionId,
        questionText: source.questionText,
        scoringKey: source.scoringKey,
        displayLabel: source.displayLabel,
        isFactorMode: source.isFactorMode,
        boniValue: source.boniValue,
        distributionFreqRule: source.distributionFreqRule ?? null,
      })),
    ),
  };
}

function toQualityPayload(quarter: PraemienQuarter): { qualityScores: Array<{ gmUserId: string; zeiterfassung: number; reporting: number; accuracy: number; note: string | null }>; expectedUpdatedAt?: string } {
  return {
    expectedUpdatedAt: quarter.updatedAt,
    qualityScores: (quarter.qualitySubmissions ?? [])
      .filter((entry) => isUuid(entry.gmId))
      .map((entry) => ({
        gmUserId: entry.gmId,
        zeiterfassung: entry.scores.zeiterfassung,
        reporting: entry.scores.reporting,
        accuracy: entry.scores.accuracy,
        note: entry.note ?? null,
      })),
  };
}

function toFlexPayload(quarter: PraemienQuarter): { flexScores: Array<{ gmUserId: string; totalPoints: number; componentValues: Record<string, number>; note: string | null }>; expectedUpdatedAt?: string } {
  return {
    expectedUpdatedAt: quarter.updatedAt,
    flexScores: (quarter.flexSubmissions ?? [])
      .filter((entry) => isUuid(entry.gmId))
      .map((entry) => ({
        gmUserId: entry.gmId,
        totalPoints: entry.totalPoints,
        componentValues: entry.componentValues ?? {},
        note: entry.note ?? null,
      })),
  };
}

function stableThresholdSignature(entries: PraemienThreshold[]): string {
  return JSON.stringify(entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    minPoints: entry.minPoints,
    rewardEur: entry.rewardEur,
  })));
}

function stablePillarStructureSignature(entries: PraemienPillar[]): string {
  return JSON.stringify(entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    color: entry.color,
    payoutMode: entry.payoutMode,
    maxRewardEur: entry.maxRewardEur,
    metrics: entry.metrics,
    tiers: entry.tiers,
  })));
}

function stableSourceSignature(entries: PraemienPillar[]): string {
  return JSON.stringify(entries.map((entry) => ({
    id: entry.id,
    sourceRefs: entry.sourceRefs.map((source) => ({
      id: source.id,
      catalogKey: source.catalogKey,
      sectionType: source.sectionType,
      fragebogenId: source.fragebogenId,
      moduleId: source.moduleId,
      questionId: source.questionId,
      scoringKey: source.scoringKey,
      boniValue: source.boniValue,
      distributionFreqRule: source.distributionFreqRule ?? null,
    })),
  })));
}

function stableQualitySignature(entries: PraemienQualitySubmission[]): string {
  return JSON.stringify(entries.map((entry) => ({
    gmId: entry.gmId,
    zeiterfassung: entry.scores.zeiterfassung,
    reporting: entry.scores.reporting,
    accuracy: entry.scores.accuracy,
    note: entry.note ?? null,
  })));
}

function stableFlexSignature(entries: PraemienFlexSubmission[]): string {
  return JSON.stringify(entries.map((entry) => ({
    gmId: entry.gmId,
    totalPoints: entry.totalPoints,
    componentValues: entry.componentValues,
    note: entry.note ?? null,
  })));
}

function detectDirtySections(previous: PraemienQuarter, next: PraemienQuarter): AutosaveSection[] {
  const dirty = new Set<AutosaveSection>();
  if (
    previous.name !== next.name ||
    previous.year !== next.year ||
    previous.quarter !== next.quarter ||
    previous.status !== next.status ||
    previous.startDate !== next.startDate ||
    previous.endDate !== next.endDate ||
    previous.description !== next.description ||
    previous.rewardModel !== next.rewardModel ||
    (previous.timezone ?? "Europe/Vienna") !== (next.timezone ?? "Europe/Vienna")
  ) {
    dirty.add("metadata");
  }
  if (stableThresholdSignature(previous.thresholds) !== stableThresholdSignature(next.thresholds)) {
    dirty.add("thresholds");
  }
  if (stablePillarStructureSignature(previous.pillars) !== stablePillarStructureSignature(next.pillars)) {
    dirty.add("pillars");
  }
  if (stableSourceSignature(previous.pillars) !== stableSourceSignature(next.pillars)) {
    dirty.add("sources");
  }
  if (stableQualitySignature(previous.qualitySubmissions ?? []) !== stableQualitySignature(next.qualitySubmissions ?? [])) {
    dirty.add("quality");
  }
  if (stableFlexSignature(previous.flexSubmissions ?? []) !== stableFlexSignature(next.flexSubmissions ?? [])) {
    dirty.add("flex");
  }
  return Array.from(dirty);
}

type MetadataSnapshot = Omit<ReturnType<typeof toPatchPayload>, "expectedUpdatedAt">;
type ThresholdsSnapshot = ReturnType<typeof toThresholdsPayload>["thresholds"];
type PillarsSnapshot = ReturnType<typeof toPillarsPayload>["pillars"];
type SourcesSnapshot = Array<{ pillarName: string; sourceRefs: PraemienSourceRef[] }>;
type QualitySnapshot = ReturnType<typeof toQualityPayload>["qualityScores"];
type FlexSnapshot = ReturnType<typeof toFlexPayload>["flexScores"];
type SectionPayloadSnapshot = {
  metadata: MetadataSnapshot;
  thresholds: ThresholdsSnapshot;
  pillars: PillarsSnapshot;
  sources: SourcesSnapshot;
  quality: QualitySnapshot;
  flex: FlexSnapshot;
};
type AnySectionSnapshot = SectionPayloadSnapshot[AutosaveSection];

function snapshotSectionPayload(quarter: PraemienQuarter, section: AutosaveSection): AnySectionSnapshot {
  if (section === "metadata") {
    const payload = toPatchPayload(quarter);
    const { expectedUpdatedAt, ...snapshot } = payload;
    void expectedUpdatedAt;
    return snapshot;
  }
  if (section === "thresholds") {
    return toThresholdsPayload(quarter).thresholds.map((entry) => ({ ...entry }));
  }
  if (section === "pillars") {
    return toPillarsPayload(quarter).pillars.map((entry) => ({ ...entry }));
  }
  if (section === "sources") {
    return quarter.pillars.map((pillar) => ({
      pillarName: pillar.name,
      sourceRefs: pillar.sourceRefs.map((entry) => ({ ...entry })),
    }));
  }
  if (section === "flex") {
    return toFlexPayload(quarter).flexScores.map((entry) => ({ ...entry }));
  }
  return toQualityPayload(quarter).qualityScores.map((entry) => ({ ...entry }));
}

function sectionPayloadFingerprint(snapshot: AnySectionSnapshot): string {
  return JSON.stringify(snapshot);
}

function applySectionPayloadSnapshot(
  server: PraemienQuarter,
  section: AutosaveSection,
  snapshot: AnySectionSnapshot,
): PraemienQuarter {
  if (section === "metadata") {
    const metadata = snapshot as MetadataSnapshot;
    return {
      ...server,
      name: metadata.name,
      year: metadata.year,
      quarter: metadata.quarter,
      status: metadata.status,
      startDate: metadata.startDate,
      endDate: metadata.endDate,
      description: metadata.description,
      timezone: metadata.timezone,
      rewardModel: metadata.rewardModel,
    };
  }
  if (section === "thresholds") {
    const thresholds = snapshot as ThresholdsSnapshot;
    return {
      ...server,
      thresholds: thresholds.map((entry) => ({
        id: entry.id ?? uid(),
        label: entry.label,
        minPoints: entry.minPoints,
        rewardEur: entry.rewardEur,
      })),
    };
  }
  if (section === "pillars") {
    const pillars = snapshot as PillarsSnapshot;
    const sourceRefsById = new Map(server.pillars.map((entry) => [entry.id, entry.sourceRefs]));
    const sourceRefsByName = new Map(server.pillars.map((entry) => [entry.name, entry.sourceRefs]));
    return {
      ...server,
      pillars: pillars.map((entry) => ({
        id: entry.id ?? uid(),
        name: entry.name,
        description: entry.description,
        color: entry.color,
        payoutMode: entry.payoutMode,
        maxRewardEur: entry.maxRewardEur,
        metrics: entry.metrics.map((metric) => ({ ...metric, id: metric.id ?? uid() })),
        tiers: entry.tiers.map((tier) => ({
          ...tier,
          id: tier.id ?? uid(),
          conditions: tier.conditions.map((condition) => ({ ...condition, id: condition.id ?? uid() })),
        })),
        sourceRefs: sourceRefsById.get(entry.id ?? "") ?? sourceRefsByName.get(entry.name) ?? [],
      })),
    };
  }
  if (section === "sources") {
    const sources = snapshot as SourcesSnapshot;
    const sourceRefsByPillarName = new Map(
      sources.map((entry) => [entry.pillarName, entry.sourceRefs.map((source) => ({ ...source }))]),
    );
    return {
      ...server,
      pillars: server.pillars.map((entry) => ({
        ...entry,
        sourceRefs: sourceRefsByPillarName.get(entry.name) ?? entry.sourceRefs,
      })),
    };
  }
  if (section === "flex") {
    const flexScores = snapshot as FlexSnapshot;
    const flexByGmId = new Map((server.flexSubmissions ?? []).map((entry) => [entry.gmId, entry]));
    return {
      ...server,
      flexSubmissions: flexScores.map((entry) => {
        const existing = flexByGmId.get(entry.gmUserId);
        return {
          gmId: entry.gmUserId,
          gmName: existing?.gmName ?? "",
          totalPoints: entry.totalPoints,
          componentValues: entry.componentValues ?? {},
          note: entry.note ?? undefined,
          updatedAt: existing?.updatedAt ?? new Date().toISOString(),
        };
      }),
    };
  }
  const qualityScores = snapshot as QualitySnapshot;
  const qualityByGmId = new Map((server.qualitySubmissions ?? []).map((entry) => [entry.gmId, entry]));
  return {
    ...server,
    qualitySubmissions: qualityScores.map((entry) => {
      const existing = qualityByGmId.get(entry.gmUserId);
      const scores = {
        zeiterfassung: entry.zeiterfassung,
        reporting: entry.reporting,
        accuracy: entry.accuracy,
      };
      return {
        gmId: entry.gmUserId,
        gmName: existing?.gmName ?? "",
        scores,
        totalPoints: calcQualityTotal(scores),
        note: entry.note ?? undefined,
        updatedAt: existing?.updatedAt ?? new Date().toISOString(),
      };
    }),
  };
}

function formatSectionError(error: unknown): string {
  if (!(error instanceof BackendApiError)) return "Ungültige Daten in diesem Abschnitt.";
  const code = error.code ?? "validation_error";
  const codeMap: Record<string, string> = {
    wave_stale_write: "Zwischenzeitliche Änderung erkannt.",
    source_not_in_live_catalog: "Quelle ist nicht mehr im aktuellen Boni-Katalog.",
    source_boni_mismatch: "Boni-Wert ist veraltet. Bitte Quelle neu auswählen.",
    distribution_rule_invalid_target: "Frequenzregel ist nur in Distributionsziel erlaubt.",
    quality_invalid_gm: "Mindestens ein GM ist nicht mehr gültig.",
    flex_invalid_gm: "Mindestens ein GM ist nicht mehr gültig.",
    invalid_payload: "Eingegebene Daten sind ungültig.",
  };
  return `${code}: ${codeMap[code] ?? error.message}`;
}

// ── GM seed list ──────────────────────────────────────────────

type GmRosterEntry = { id: string; name: string; region: string };

const ALL_GMS: GmRosterEntry[] = [
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

function qualityIsComplete(quarter: PraemienQuarter, gms: GmRosterEntry[]): boolean {
  const subs = quarter.qualitySubmissions ?? [];
  return gms.every(gm => subs.some(s => s.gmId === gm.id));
}

function flexAvgForQuarter(quarter: PraemienQuarter): number {
  const subs = quarter.flexSubmissions ?? [];
  if (subs.length === 0) return 0;
  return Math.round(subs.reduce((n, s) => n + s.totalPoints, 0) / subs.length);
}

function flexIsComplete(quarter: PraemienQuarter, gms: GmRosterEntry[]): boolean {
  const subs = quarter.flexSubmissions ?? [];
  return gms.every(gm => subs.some(s => s.gmId === gm.id));
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
const FLEX_MAX = 100;
const QUALITY_MAX = 100;

interface GmProgressRow {
  gmId: string;
  gmName: string;
  pillar0: number; // Schütten / Displays
  pillar1: number; // Distributionsziel
  pillar2: number | null; // Flexziel
  pillar3: number | null; // Qualitätsziele — null = not yet entered
  pillar0Max: number;
  pillar1Max: number;
  pillar2Max: number;
  currentPoints: number;   // sum of available pillars only
  currentMaxPoints: number; // sum of maxima for available pillars only
  progressPercent: number;
  currentRewardEur: number;
  currentRewardLabel: string;
  isFlexDone: boolean;
  isQualityDone: boolean;
  isFinished: boolean; // true only when flex and quality are also done
}

function buildGmProgressRows(
  quarter: PraemienQuarter | null,
  gms: GmRosterEntry[] = ALL_GMS,
): GmProgressRow[] {
  if (!quarter) return [];
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const findTier = (pts: number) => {
    const t = [...sorted].reverse().find(t => pts >= t.minPoints);
    return t ?? sorted[0];
  };

  return gms.map(gm => {
    const seed = MOCK_GM_PROGRESS[gm.id] ?? { schuettenPoints: 0, distributionPoints: 0, flexPoints: 0, schuettenMax: 13, distributionMax: 10, flexMax: 6 };
    const qualitySub = (quarter.qualitySubmissions ?? []).find(s => s.gmId === gm.id);
    const flexSub = (quarter.flexSubmissions ?? []).find(s => s.gmId === gm.id);
    const p0 = seed.schuettenPoints;
    const p1 = seed.distributionPoints;
    const p2 = flexSub ? flexSub.totalPoints : null;
    const p3 = qualitySub ? qualitySub.totalPoints : null;

    const currentPoints     = p0 + p1 + (p2 ?? 0) + (p3 ?? 0);
    const currentMaxPoints  = seed.schuettenMax + seed.distributionMax + (p2 !== null ? FLEX_MAX : 0) + (p3 !== null ? QUALITY_MAX : 0);
    const progressPercent   = currentMaxPoints > 0 ? Math.round((currentPoints / currentMaxPoints) * 100) : 0;
    const tier              = findTier(currentPoints);
    return {
      gmId: gm.id,
      gmName: gm.name,
      pillar0: p0, pillar1: p1, pillar2: p2, pillar3: p3,
      pillar0Max: seed.schuettenMax,
      pillar1Max: seed.distributionMax,
      pillar2Max: FLEX_MAX,
      currentPoints, currentMaxPoints, progressPercent,
      currentRewardEur:   tier?.rewardEur ?? 0,
      currentRewardLabel: tier?.label ?? "—",
      isFlexDone: p2 !== null,
      isQualityDone: p3 !== null,
      isFinished:    p2 !== null && p3 !== null,
    };
  });
}

function buildGmProgressSummary(
  quarter: PraemienQuarter | null,
  regionFilter: RegionFilter = "Alle",
  gms: GmRosterEntry[] = ALL_GMS,
) {
  if (!quarter) return null;
  const allRows = buildGmProgressRows(quarter, gms);
  const rows = regionFilter === "Alle"
    ? allRows
    : allRows.filter(r => gms.find(g => g.id === r.gmId)?.region === regionFilter);
  if (rows.length === 0) return null;

  const finishedCount      = rows.filter(r => r.isFinished).length;
  const avgProgressPercent = Math.round(rows.reduce((n, r) => n + r.progressPercent, 0) / rows.length);
  const avgRewardEur       = Math.round(rows.reduce((n, r) => n + r.currentRewardEur, 0) / rows.length);
  const totalRows          = rows.length;

  // Pillar averages (index 0-3)
  const p0avg = rows.reduce((n, r) => n + r.pillar0, 0) / rows.length;
  const p1avg = rows.reduce((n, r) => n + r.pillar1, 0) / rows.length;
  const flexRows = rows.filter(r => r.pillar2 !== null);
  const p2avg = flexRows.length > 0
    ? flexRows.reduce((n, r) => n + (r.pillar2 as number), 0) / flexRows.length
    : null;
  // Manual pillars: average only from rows that have it
  const qualityRows = rows.filter(r => r.pillar3 !== null);
  const p3avg = qualityRows.length > 0
    ? qualityRows.reduce((n, r) => n + (r.pillar3 as number), 0) / qualityRows.length
    : null;

  const totalAvgPts = p0avg + p1avg + (p2avg ?? 0) + (p3avg ?? 0);
  const share = (v: number) => totalAvgPts > 0 ? Math.round((v / totalAvgPts) * 100) : 0;

  return {
    totalRows,
    finishedCount,
    openCount: totalRows - finishedCount,
    avgProgressPercent,
    avgRewardEur,
    flexFilledCount: flexRows.length,
    qualityFilledCount: qualityRows.length,
    pillarAverages: [
      { points: p0avg, share: share(p0avg) },
      { points: p1avg, share: share(p1avg) },
      { points: p2avg ?? 0, share: share(p2avg ?? 0), missingCount: totalRows - flexRows.length },
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

function GhostBtn({ onClick, children, danger, disabled }: { onClick?: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
        fontSize: 11, fontWeight: 600, borderRadius: 7, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: danger ? R : "rgba(0,0,0,0.45)",
        boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
        transition: "opacity 0.15s ease", opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
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

function PraemienPageSkeleton() {
  const shimmer: React.CSSProperties = {
    backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)",
    backgroundSize: "400% 100%",
    animation: "praemienSkeletonShimmer 1.25s ease-in-out infinite",
    borderRadius: 8,
  };

  return (
    <Card>
      <style>{`
        @keyframes praemienSkeletonShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...shimmer, height: 14, width: "38%" }} />
        <div style={{ ...shimmer, height: 10, width: "62%" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...shimmer, height: 10, width: "45%" }} />
            <div style={{ ...shimmer, height: 28, width: "100%", borderRadius: 10 }} />
            <div style={{ ...shimmer, height: 10, width: "70%" }} />
          </div>
          <div style={{ border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...shimmer, height: 10, width: "50%" }} />
            <div style={{ ...shimmer, height: 28, width: "100%", borderRadius: 10 }} />
            <div style={{ ...shimmer, height: 10, width: "62%" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...shimmer, height: 10, width: "28%" }} />
          <div style={{ ...shimmer, height: 9, width: "100%" }} />
          <div style={{ ...shimmer, height: 9, width: "94%" }} />
          <div style={{ ...shimmer, height: 9, width: "88%" }} />
        </div>
      </div>
    </Card>
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
  gms,
  regionFilter,
  onRegionChange,
  onOpenDetail,
}: {
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  regionFilter: RegionFilter;
  onRegionChange: (r: RegionFilter) => void;
  onOpenDetail: () => void;
}) {
  const summary = buildGmProgressSummary(quarter, regionFilter, gms);
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
          const isFlex = i === 2;
          const isQual = i === 3;
          const missing = isFlex || isQual ? (p as { missingCount?: number }).missingCount : 0;
          const isLast = i === 3;
          return (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, paddingRight: isLast ? 0 : 8, borderRight: isLast ? "none" : "1px solid rgba(0,0,0,0.05)", marginRight: isLast ? 0 : 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: pc, flexShrink: 0 }} />
              <span style={{ fontSize: 8, fontWeight: 500, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{PILLAR_LABELS_SHORT[i]}</span>
              {missing ? (
                <span style={{ fontSize: 8, fontWeight: 700, color: "#D97706", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{isFlex ? summary.flexFilledCount : summary.qualityFilledCount}/{summary.totalRows}</span>
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
  quarter, onChange, gms, regionFilter, onRegionChange, onOpenGmDetail,
}: {
  quarter: PraemienQuarter;
  onChange: (q: PraemienQuarter) => void;
  gms: GmRosterEntry[];
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
          gms={gms}
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
  quarter, gms, totalSources, totalPoints, issues,
}: {
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  totalSources: number;
  totalPoints: number;
  issues: number;
}) {
  const linkedSources = quarter.pillars.reduce((n, p) => n + (isManualPillar(p) ? 0 : p.sourceRefs.length), 0);
  const sectionTypes = new Set(quarter.pillars.flatMap(p => isManualPillar(p) ? [] : p.sourceRefs.map(s => s.sectionType)));
  const flexDone = (quarter.flexSubmissions ?? []).length;
  const flexComplete = flexIsComplete(quarter, gms);
  const qualityDone = (quarter.qualitySubmissions ?? []).length;
  const qualityComplete = qualityIsComplete(quarter, gms);

  const stats = [
    { label: "Säulen",         value: `${quarter.pillars.length}`,                      color: "#1a1a1a" },
    { label: "Sektionen",      value: `${sectionTypes.size} / 5`,                       color: "#1a1a1a" },
    { label: "Quellen",        value: `${linkedSources} / ${totalSources}`,              color: linkedSources > 0 ? "#16a34a" : "rgba(0,0,0,0.4)" },
    { label: "Max. Punkte",    value: `${totalPoints} P`,                                color: totalPoints > 0 ? R : "rgba(0,0,0,0.4)" },
    { label: "Flexziel",       value: `${flexDone} / ${gms.length}`,                      color: flexComplete ? "#16a34a" : flexDone > 0 ? "#D97706" : "rgba(0,0,0,0.4)" },
    { label: "Qualitätsziele", value: `${qualityDone} / ${gms.length}`,                   color: qualityComplete ? "#16a34a" : qualityDone > 0 ? "#D97706" : "rgba(0,0,0,0.4)" },
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

  const canonicalSorted = TIER_ORDER.map((label) => thresholds.find((t) => t.label === label)).filter(Boolean) as PraemienThreshold[];
  const sorted = canonicalSorted.length > 0
    ? canonicalSorted
    : [...thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const vollerBonus = sorted.find((t) => t.label === "Voller Bonus") ?? sorted.at(-1);
  const vollerPts = vollerBonus?.minPoints ?? 0;
  const totalAchievable = vollerPts > 0 ? Math.round(vollerPts / 0.95) : 0;
  const [vollerPtsInput, setVollerPtsInput] = useState<string>(String(vollerPts));
  const [rewardInputs, setRewardInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setVollerPtsInput(String(vollerPts));
    setRewardInputs(
      Object.fromEntries(sorted.map((entry) => [entry.id, String(entry.rewardEur)])),
    );
  }, [thresholds, vollerPts]);

  const updateVollerBonus = (newPts: number) => {
    const clamped = Math.max(0, newPts);
    onChange({ ...quarter, thresholds: recalcThresholdsFromVollerBonus(thresholds, clamped) });
  };

  const updateReward = (id: string, eur: number) => {
    onChange({ ...quarter, thresholds: thresholds.map(t => t.id === id ? { ...t, rewardEur: eur } : t) });
  };
  const onVollerInputChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    setVollerPtsInput(value);
  };
  const commitVollerInput = () => {
    const parsed = vollerPtsInput.trim() === "" ? 0 : Number(vollerPtsInput);
    updateVollerBonus(Number.isFinite(parsed) ? parsed : 0);
  };
  const onRewardInputChange = (id: string, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setRewardInputs((prev) => ({ ...prev, [id]: value }));
  };
  const commitRewardInput = (id: string) => {
    const raw = rewardInputs[id] ?? "";
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    updateReward(id, Number.isFinite(parsed) ? parsed : 0);
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
                      {Math.round((TIER_PCT[t.label] ?? 0) * 100)}%
                    </span>
                  )}
                </div>

                {/* Min-points */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.28)", flexShrink: 0 }}>ab</span>
                  {isVoller ? (
                    <input
                      type="number"
                      value={vollerPtsInput}
                      onChange={e => onVollerInputChange(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          (event.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      style={{ ...numFld, width: 56, color: R, fontWeight: 800, border: `1px solid rgba(220,38,38,0.3)` }}
                      onFocus={e => { e.currentTarget.style.border = `1px solid rgba(220,38,38,0.6)`; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.08)"; }}
                      onBlur={e => {
                        commitVollerInput();
                        e.currentTarget.style.border = `1px solid rgba(220,38,38,0.3)`;
                        e.currentTarget.style.boxShadow = "none";
                      }}
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
                    value={rewardInputs[t.id] ?? String(t.rewardEur)}
                    onChange={e => onRewardInputChange(t.id, e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    style={{ ...numFld, width: 62, color: t.rewardEur > 0 ? "#15803d" : "rgba(0,0,0,0.28)", background: t.rewardEur > 0 ? "rgba(22,163,74,0.04)" : "#fff", border: `1px solid ${t.rewardEur > 0 ? "rgba(22,163,74,0.3)" : "rgba(0,0,0,0.08)"}` }}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(22,163,74,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(22,163,74,0.07)"; }}
                    onBlur={e => {
                      commitRewardInput(t.id);
                      e.currentTarget.style.border = `1px solid ${t.rewardEur > 0 ? "rgba(22,163,74,0.3)" : "rgba(0,0,0,0.08)"}`;
                      e.currentTarget.style.boxShadow = "none";
                    }}
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
  label, hint, value, onChange, max = 100, step = 1,
}: {
  label: string; hint: string; value: number; onChange: (v: number) => void; max?: number; step?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barRef = useRef<HTMLDivElement>(null);

  const valueFromEvent = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const { left, width } = bar.getBoundingClientRect();
    const raw = ((clientX - left) / width) * max;
    const stepped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(0, stepped)));
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
        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)", fontWeight: 600 }}>{max}</span>
      </div>
    </div>
  );
}

function QualityGoalsModal({
  quarter, gms, onSave, onClose,
}: {
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  onSave: (submissions: PraemienQualitySubmission[]) => void;
  onClose: () => void;
}) {
  const subs = quarter.qualitySubmissions ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [selectedGmId, setSelectedGmId] = useState<string>(gms[0]?.id ?? "");
  const [draft, setDraft] = useState<PraemienQualityCriteria>(EMPTY_CRITERIA);
  const [draftNote, setDraftNote] = useState("");
  const [localSubs, setLocalSubs] = useState<PraemienQualitySubmission[]>(subs);
  const [unsaved, setUnsaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [showImport, setShowImport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gms.length === 0) return;
    if (!gms.some((entry) => entry.id === selectedGmId)) {
      setSelectedGmId(gms[0]?.id ?? "");
    }
  }, [gms, selectedGmId]);

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
    if (!selectedGmId) return;
    const newSub: PraemienQualitySubmission = {
      gmId: selectedGmId,
      gmName: gms.find(g => g.id === selectedGmId)?.name ?? selectedGmId,
      scores: { ...draft },
      totalPoints: total,
      note: draftNote || undefined,
      updatedAt: new Date().toISOString(),
    };
    const next = [...localSubs.filter(s => s.gmId !== selectedGmId), newSub];
    setLocalSubs(next);
    setUnsaved(false);
    // Auto-advance to next unscored GM
    const nextOpen = gms.find(g => !next.some(s => s.gmId === g.id) && g.id !== selectedGmId);
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

  const filteredGms = gms.filter(gm => {
    const q = search.toLowerCase().trim();
    if (q && !gm.name.toLowerCase().includes(q)) return false;
    const done = localSubs.some(s => s.gmId === gm.id);
    if (filter === "done" && !done) return false;
    if (filter === "open" && done) return false;
    return true;
  });

  const doneCount = localSubs.length;
  const totalColor = total >= 80 ? "#16a34a" : total >= 50 ? "#D97706" : "#DC2626";
  const selectedGm = gms.find(g => g.id === selectedGmId);
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
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>{quarter.name} · {doneCount} / {gms.length} GMs bewertet</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowImport(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", fontSize: 10, fontWeight: 600, color: showImport ? "#D97706" : "rgba(0,0,0,0.45)", background: showImport ? "rgba(217,119,6,0.06)" : "linear-gradient(to bottom,#fff,#f5f5f5)", transition: "all 0.12s", boxShadow: "inset 0 1px 0.5px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.07)", fontFamily: "inherit" }}
              onMouseEnter={e => { if (!showImport) { e.currentTarget.style.color = "#1a1a1a"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)"; }}}
              onMouseLeave={e => { if (!showImport) { e.currentTarget.style.color = "rgba(0,0,0,0.45)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)"; }}}
            >
              <Upload size={11} strokeWidth={2} />
              Importieren
            </button>
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

        {/* Import area — collapses smoothly */}
        <div style={{ maxHeight: showImport ? 130 : 0, overflow: "hidden", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1)", opacity: showImport ? 1 : 0 }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: "none" }} onChange={() => setShowImport(false)} />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); setShowImport(false); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "18px 24px", borderRadius: 10, cursor: "pointer",
                border: `1.5px dashed ${dragOver ? "#D97706" : "rgba(0,0,0,0.12)"}`,
                background: dragOver ? "rgba(217,119,6,0.04)" : "rgba(0,0,0,0.015)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = "1.5px dashed rgba(217,119,6,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(217,119,6,0.03)"; }}
              onMouseLeave={e => { if (!dragOver) { (e.currentTarget as HTMLElement).style.border = "1.5px dashed rgba(0,0,0,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.015)"; }}}
            >
              <Upload size={16} strokeWidth={1.5} color={dragOver ? "#D97706" : "rgba(0,0,0,0.3)"} />
              <div style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: dragOver ? "#D97706" : "#1a1a1a", marginBottom: 2 }}>
                  Datei hierher ziehen oder klicken zum Auswählen
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>XLSX, CSV, XLS</div>
              </div>
            </div>
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

function FlexGoalsModal({
  quarter, gms, onSave, onClose,
}: {
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  onSave: (submissions: PraemienFlexSubmission[]) => void;
  onClose: () => void;
}) {
  const subs = quarter.flexSubmissions ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [selectedGmId, setSelectedGmId] = useState<string>(gms[0]?.id ?? "");
  const [draftCoolerPoints, setDraftCoolerPoints] = useState(0);
  const [draftRedPoints, setDraftRedPoints] = useState(0);
  const [draftNote, setDraftNote] = useState("");
  const [localSubs, setLocalSubs] = useState<PraemienFlexSubmission[]>(subs);
  const [unsaved, setUnsaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (gms.length === 0) return;
    if (!gms.some((entry) => entry.id === selectedGmId)) {
      setSelectedGmId(gms[0]?.id ?? "");
    }
  }, [gms, selectedGmId]);

  useEffect(() => {
    const existing = localSubs.find(s => s.gmId === selectedGmId);
    if (existing) {
      setDraftCoolerPoints(existing.componentValues?.cooler_points ?? 0);
      setDraftRedPoints(existing.componentValues?.red_points ?? 0);
      setDraftNote(existing.note ?? "");
    } else {
      setDraftCoolerPoints(0);
      setDraftRedPoints(0);
      setDraftNote("");
    }
    setUnsaved(false);
  }, [selectedGmId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveGm = () => {
    if (!selectedGmId) return;
    const newSub: PraemienFlexSubmission = {
      gmId: selectedGmId,
      gmName: gms.find(g => g.id === selectedGmId)?.name ?? selectedGmId,
      totalPoints: draftCoolerPoints + draftRedPoints,
      componentValues: { cooler_points: draftCoolerPoints, red_points: draftRedPoints },
      note: draftNote || undefined,
      updatedAt: new Date().toISOString(),
    };
    const next = [...localSubs.filter(s => s.gmId !== selectedGmId), newSub];
    setLocalSubs(next);
    setUnsaved(false);
    const nextOpen = gms.find(g => !next.some(s => s.gmId === g.id) && g.id !== selectedGmId);
    if (nextOpen) setSelectedGmId(nextOpen.id);
  };

  const handleReset = () => {
    setDraftCoolerPoints(0);
    setDraftRedPoints(0);
    setDraftNote("");
    setUnsaved(true);
  };

  const handleClose = () => {
    onSave(localSubs);
    onClose();
  };

  const filteredGms = gms.filter(gm => {
    const q = search.toLowerCase().trim();
    if (q && !gm.name.toLowerCase().includes(q)) return false;
    const done = localSubs.some(s => s.gmId === gm.id);
    if (filter === "done" && !done) return false;
    if (filter === "open" && done) return false;
    return true;
  });

  const doneCount = localSubs.length;
  const draftPoints = draftCoolerPoints + draftRedPoints;
  const scoreColor = draftPoints >= 15 ? "#16a34a" : draftPoints >= 10 ? "#D97706" : "#DC2626";
  const selectedGm = gms.find(g => g.id === selectedGmId);
  const selectedSub = localSubs.find(s => s.gmId === selectedGmId);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={handleClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 760, height: "min(520px, 88vh)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "qgModalIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={15} strokeWidth={1.8} color="#16a34a" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Flexziel erfassen</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>{quarter.name} · {doneCount} / {gms.length} GMs bewertet</div>
          </div>
          <button
            onClick={handleClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)", transition: "background 0.12s ease", flexShrink: 0 }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          <div style={{ width: 240, borderRight: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 9px", height: 30, borderRadius: 7, background: "rgba(0,0,0,0.04)", border: "1px solid transparent", transition: "border 0.15s" }}>
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="GM suchen..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }} />
              </div>
            </div>
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
            <div className="qg-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {filteredGms.map(gm => {
                const sub = localSubs.find(s => s.gmId === gm.id);
                const active = gm.id === selectedGmId;
                return (
                  <div key={gm.id} onClick={() => setSelectedGmId(gm.id)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: active ? "rgba(22,163,74,0.06)" : "transparent", borderLeft: `3px solid ${active ? "#16a34a" : "transparent"}`, transition: "all 0.12s ease" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: sub ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: sub ? "#15803d" : "rgba(0,0,0,0.35)" }}>
                      {gm.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? "#16a34a" : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gm.name}</div>
                      {sub
                        ? <div style={{ fontSize: 9, fontWeight: 600, color: "#16a34a" }}>{sub.totalPoints} / 20 P</div>
                        : <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>Nicht bewertet</div>
                      }
                    </div>
                    {sub && <CheckCircle2 size={12} strokeWidth={2} color="#16a34a" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="qg-scroll" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#16a34a", flexShrink: 0 }}>
                  {selectedGm?.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{selectedGm?.name}</div>
                  {selectedSub
                    ? <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>Zuletzt bearbeitet: {new Date(selectedSub.updatedAt).toLocaleDateString("de-AT")}</div>
                    : <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)" }}>Noch nicht bewertet</div>
                  }
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: scoreColor, fontVariantNumeric: "tabular-nums", transition: "color 0.2s ease" }}>{draftPoints}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>/ 20 Punkte</div>
                </div>
              </div>
              {unsaved && (
                <div style={{ marginTop: 8, fontSize: 9, fontWeight: 600, color: "#D97706", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={10} strokeWidth={2} />
                  Nicht gespeichert
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <QualityScoreSlider
                label="Kühler-Nettoaufbau"
                hint="0, 5 oder 10 Punkte"
                value={draftCoolerPoints}
                max={10}
                step={5}
                onChange={v => { setDraftCoolerPoints(v); setUnsaved(true); }}
              />
              <QualityScoreSlider
                label="RED / IR-Nutzung"
                hint="0, 5 oder 10 Punkte"
                value={draftRedPoints}
                max={10}
                step={5}
                onChange={v => { setDraftRedPoints(v); setUnsaved(true); }}
              />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)", marginBottom: 5 }}>Notiz (optional)</div>
                <textarea
                  value={draftNote}
                  onChange={e => { setDraftNote(e.target.value); setUnsaved(true); }}
                  placeholder="Anmerkungen zum Flexziel..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", outline: "none", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit", resize: "none", lineHeight: 1.5, background: "rgba(0,0,0,0.018)", boxSizing: "border-box" }}
                />
              </div>
            </div>

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

function PillarRewardEditor({ pillar, onChange }: { pillar: PraemienPillar; onChange: (pillar: PraemienPillar) => void }) {
  const metricByKey = new Map(pillar.metrics.map((metric) => [metric.key, metric]));
  const updateTier = (tierId: string, update: (tier: PraemienPillar["tiers"][number]) => PraemienPillar["tiers"][number]) => {
    onChange({ ...pillar, tiers: pillar.tiers.map((tier) => tier.id === tierId ? update(tier) : tier) });
  };
  const removeTier = (tierId: string) => {
    onChange({ ...pillar, tiers: pillar.tiers.filter((tier) => tier.id !== tierId).map((tier, index) => ({ ...tier, orderIndex: index })) });
  };
  const addTier = () => {
    const firstMetric = pillar.metrics[0];
    if (!firstMetric) return;
    onChange({
      ...pillar,
      tiers: [...pillar.tiers, {
        id: uid(),
        label: "Neue Stufe",
        orderIndex: pillar.tiers.length,
        rewardEur: 0,
        conditions: [{ id: uid(), metricKey: firstMetric.key, operator: "gte", thresholdValue: 0, orderIndex: 0 }],
      }],
    });
  };
  const fmtUnit = (key: string) => {
    const unit = metricByKey.get(key)?.unit;
    if (unit === "percent") return "%";
    if (unit === "currency") return "€";
    return unit === "count" ? "Anz." : "P";
  };

  return (
    <div style={{ margin: "0 0 12px 16px", borderRadius: 11, border: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.018)", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(0,0,0,0.055)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 750, color: "#202020" }}>Eigene Auszahlungslogik</div>
          <div style={{ fontSize: 8.5, color: "rgba(0,0,0,0.38)", marginTop: 2 }}>
            {pillar.payoutMode === "sum_earned_tiers" ? "Erreichte Teilziele werden addiert" : "Es gilt die höchste vollständig erreichte Stufe"}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "rgba(0,0,0,0.45)" }}>
          Maximum
          <input
            type="number"
            min={0}
            step={0.5}
            value={pillar.maxRewardEur}
            onChange={(event) => onChange({ ...pillar, maxRewardEur: Math.max(0, Number(event.target.value) || 0) })}
            style={{ width: 70, height: 26, borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", textAlign: "right", padding: "0 7px", fontSize: 10, fontWeight: 750, outline: "none" }}
          />
          €
        </label>
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {pillar.tiers.map((tier) => (
          <div key={tier.id} style={{ display: "grid", gridTemplateColumns: "minmax(112px,0.75fr) minmax(210px,1.8fr) 86px 22px", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, background: "rgba(255,255,255,0.82)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <input
              value={tier.label}
              onChange={(event) => updateTier(tier.id, (current) => ({ ...current, label: event.target.value }))}
              style={{ minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 9.5, fontWeight: 700, color: "#242424" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {tier.conditions.map((condition) => (
                <label key={condition.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 24, padding: "0 6px", borderRadius: 6, background: "rgba(0,0,0,0.035)", fontSize: 8.5, color: "rgba(0,0,0,0.55)" }}>
                  <span style={{ fontWeight: 650 }}>{metricByKey.get(condition.metricKey)?.label ?? condition.metricKey}</span>
                  <span style={{ color: "rgba(0,0,0,0.3)" }}>{condition.operator === "gte" ? "≥" : condition.operator === "lte" ? "≤" : "="}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={condition.thresholdValue}
                    onChange={(event) => updateTier(tier.id, (current) => ({
                      ...current,
                      conditions: current.conditions.map((entry) => entry.id === condition.id
                        ? { ...entry, thresholdValue: Math.max(0, Number(event.target.value) || 0) }
                        : entry),
                    }))}
                    style={{ width: 38, border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 9, fontWeight: 750 }}
                  />
                  <span>{fmtUnit(condition.metricKey)}</span>
                </label>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#15803d", fontSize: 9, fontWeight: 700 }}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={tier.rewardEur}
                onChange={(event) => updateTier(tier.id, (current) => ({ ...current, rewardEur: Math.max(0, Number(event.target.value) || 0) }))}
                style={{ width: 62, height: 24, borderRadius: 6, border: "1px solid rgba(22,163,74,0.18)", background: "rgba(22,163,74,0.035)", textAlign: "right", padding: "0 5px", outline: "none", color: "#15803d", fontSize: 9.5, fontWeight: 750 }}
              />€
            </label>
            <button type="button" onClick={() => removeTier(tier.id)} title="Stufe entfernen" style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={10} strokeWidth={2.2} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addTier} disabled={pillar.metrics.length === 0} style={{ alignSelf: "flex-start", border: "none", background: "transparent", color: pillar.color, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, cursor: pillar.metrics.length ? "pointer" : "default", opacity: pillar.metrics.length ? 0.8 : 0.35, padding: "3px 6px" }}>
          <Plus size={10} strokeWidth={2.4} /> Stufe hinzufügen
        </button>
      </div>
    </div>
  );
}

function FlexPillarCard({
  pillar, quarter, gms, flexPersistenceReady, onUpdateQuarter,
}: {
  pillar: PraemienPillar;
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  flexPersistenceReady: boolean;
  onUpdateQuarter: (q: PraemienQuarter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const PC = "#16a34a";
  const subs = quarter.flexSubmissions ?? [];
  const doneCount = subs.length;
  const avgPts = flexAvgForQuarter(quarter);
  const complete = flexIsComplete(quarter, gms);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, border: `1px solid rgba(0,0,0,0.07)`, boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(o => !o)}
        style={{ display: "flex", alignItems: "center", padding: "13px 16px", cursor: "pointer", gap: 12, userSelect: "none", transition: "background 0.12s ease" }}
      >
        <div style={{ width: 4, height: 36, borderRadius: 2, background: PC, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 3 }}>{pillar.name}</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.38)", letterSpacing: "0.02em" }}>Manuell · später erfassen</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: PC, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{avgPts}</div>
            <div style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>Ø Punkte</div>
          </div>
          <QualityCompletionPill done={complete} />
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{doneCount} / {gms.length} GMs</span>
          <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
        </div>
      </div>

      <div style={{ maxHeight: expanded ? 520 : 0, overflow: "hidden", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 16px 14px" }}>
          <PillarRewardEditor
            pillar={pillar}
            onChange={(updatedPillar) => onUpdateQuarter({
              ...quarter,
              pillars: quarter.pillars.map((entry) => entry.id === updatedPillar.id ? updatedPillar : entry),
            })}
          />
          <div style={{ padding: "12px 14px", borderRadius: 10, background: complete ? "rgba(22,163,74,0.05)" : "rgba(217,119,6,0.04)", border: `1px solid ${complete ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.14)"}`, display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all 0.3s ease" }}>
            <Zap size={18} strokeWidth={1.5} color={complete ? "#16a34a" : "#D97706"} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                {complete ? "Flexziel vollständig erfasst" : "Flexziel noch nicht fertig"}
              </div>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                {flexPersistenceReady
                  ? `${doneCount} von ${gms.length} GMs bewertet · Ø ${avgPts} / 20 Punkte`
                  : "GM-Daten werden geladen. Flexziel ist vorübergehend schreibgeschützt."}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); if (flexPersistenceReady) setModalOpen(true); }}
              disabled={!flexPersistenceReady}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                fontSize: 10, fontWeight: 700, borderRadius: 7, border: "none", cursor: flexPersistenceReady ? "pointer" : "not-allowed",
                background: `linear-gradient(to bottom, ${R}, ${RD})`,
                color: "#fff", letterSpacing: "-0.01em",
                boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.12)`,
                flexShrink: 0, transition: "opacity 0.15s ease", opacity: flexPersistenceReady ? 1 : 0.5,
              }}
            >
              <Pencil size={10} strokeWidth={2.5} />
              {doneCount > 0 ? "Bearbeiten" : "Flexziel erfassen"}
            </button>
          </div>

          {subs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {subs.map(sub => {
                const scoreColor = sub.totalPoints >= 15 ? "#16a34a" : sub.totalPoints >= 10 ? "#D97706" : R;
                return (
                  <div key={sub.gmId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.045)" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(22,163,74,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#16a34a", flexShrink: 0 }}>
                      {sub.gmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{sub.gmName}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor, minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sub.totalPoints}</span>
                  </div>
                );
              })}
            </div>
          )}
          {subs.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", borderRadius: 9, background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Noch keine Flexbewertungen — öffne das Formular oben.</span>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <FlexGoalsModal
          quarter={quarter}
          gms={gms}
          onSave={submissions => {
            onUpdateQuarter({ ...quarter, flexSubmissions: submissions });
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function QualityPillarCard({
  pillar, pillarIndex, quarter, gms, qualityPersistenceReady, onUpdateQuarter,
}: {
  pillar: PraemienPillar;
  pillarIndex: number;
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  qualityPersistenceReady: boolean;
  onUpdateQuarter: (q: PraemienQuarter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const PC = "#D97706";
  const subs = quarter.qualitySubmissions ?? [];
  const doneCount = subs.length;
  const avgPts = qualityAvgForQuarter(quarter);
  const complete = qualityIsComplete(quarter, gms);

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
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)" }}>{doneCount} / {gms.length} GMs</span>
          <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.3)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
        </div>
      </div>

      {/* Expanded body */}
      <div style={{ maxHeight: expanded ? 600 : 0, overflow: "hidden", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ padding: "0 16px 14px" }}>
          <PillarRewardEditor
            pillar={pillar}
            onChange={(updatedPillar) => onUpdateQuarter({
              ...quarter,
              pillars: quarter.pillars.map((entry) => entry.id === updatedPillar.id ? updatedPillar : entry),
            })}
          />
          {/* Status strip + CTA */}
          <div style={{ padding: "12px 14px", borderRadius: 10, background: complete ? "rgba(22,163,74,0.05)" : "rgba(217,119,6,0.04)", border: `1px solid ${complete ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.14)"}`, display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all 0.3s ease" }}>
            <Award size={18} strokeWidth={1.5} color={complete ? "#16a34a" : "#D97706"} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                {complete ? "Qualitätsziele vollständig erfasst" : "Qualitätsziele noch nicht fertig"}
              </div>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                {qualityPersistenceReady
                  ? `${doneCount} von ${gms.length} GMs bewertet · Ø ${avgPts} / 100 Punkte`
                  : "GM-Daten werden geladen. Qualitätsziele sind vorübergehend schreibgeschützt."}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); if (qualityPersistenceReady) setModalOpen(true); }}
              disabled={!qualityPersistenceReady}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                fontSize: 10, fontWeight: 700, borderRadius: 7, border: "none", cursor: "pointer",
                background: `linear-gradient(to bottom, ${R}, ${RD})`,
                color: "#fff", letterSpacing: "-0.01em",
                boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.12)`,
                flexShrink: 0, transition: "opacity 0.15s ease", opacity: qualityPersistenceReady ? 1 : 0.5,
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
          gms={gms}
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
          <PillarRewardEditor pillar={pillar} onChange={onChange} />
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
                      <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                        {ref.moduleName} · {ref.displayLabel}
                        {ref.distributionFreqRule && (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(37,99,235,0.09)", color: "#2563eb", letterSpacing: "0.03em", flexShrink: 0 }}>
                            {ref.distributionFreqRule === "lt8" ? "Freq. <8" : "Freq. >8"}
                          </span>
                        )}
                      </div>
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
const DIST_COLOR = "#2563eb";
const FREQ_LABELS: Record<"lt8" | "gt8", string> = { lt8: "Freq. <8", gt8: "Freq. >8" };

function PillarSelect({
  value, pillars, onChange, currentFreqRule, onContextMenu, disabled = false,
  placeholder = "– Nicht zugewiesen", unassignedLabel = "– Nicht zugewiesen",
}: {
  value: string;
  pillars: PraemienPillar[];
  onChange: (id: string, freqRule?: "lt8" | "gt8") => void;
  currentFreqRule?: "lt8" | "gt8";
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  unassignedLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [distExpanded, setDistExpanded] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const assignablePillars = pillars.filter((pillar) => !isManualPillar(pillar));

  // Identify the Distributionsziel pillar
  const distPillar = assignablePillars.find(p => p.name === "Distributionsziel") ?? null;
  const isCurrentlyDist = !!distPillar && value === distPillar.id;

  // Auto-expand distribution row when reopening if already assigned there
  useEffect(() => {
    if (open && isCurrentlyDist) setDistExpanded(true);
    if (!open) setDistExpanded(false);
  }, [open, isCurrentlyDist]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        const panel = document.getElementById("pillar-select-portal");
        if (panel && panel.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  // Keep dropdown anchored to button on scroll/resize
  useEffect(() => {
    if (!open) return;
    function updatePos() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const PANEL_W = 200;
      const left = Math.min(r.left, window.innerWidth - PANEL_W - 8);
      setPos({ x: left, y: r.bottom + 5 });
    }
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  const current = assignablePillars.find(p => p.id === value) ?? null;

  const toggleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const PANEL_W = 200;
      const left = Math.min(r.left, window.innerWidth - PANEL_W - 8);
      setPos({ x: left, y: r.bottom + 5 });
    }
    setOpen(o => !o);
  };

  // Build the trigger label
  let triggerLabel = current ? current.name : placeholder;
  if (isCurrentlyDist && currentFreqRule) {
    triggerLabel = `${current!.name} · ${FREQ_LABELS[currentFreqRule]}`;
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        onContextMenu={(event) => {
          if (!onContextMenu) return;
          setOpen(false);
          onContextMenu(event);
        }}
        style={{
          display: "flex", alignItems: "center", gap: 6, minWidth: 138, justifyContent: "space-between",
          padding: "5px 10px", borderRadius: 7, border: "none", cursor: disabled ? "default" : "pointer",
          fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
          background: current ? `${current.color}0e` : "rgba(0,0,0,0.035)",
          color: current ? current.color : "rgba(0,0,0,0.45)",
          boxShadow: current ? `0 0 0 1px ${current.color}30` : "0 0 0 1px rgba(0,0,0,0.09)",
          transition: "all 0.15s ease", opacity: disabled ? 0.62 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = disabled ? "0.62" : "1"; }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: current ? current.color : "rgba(0,0,0,0.18)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {triggerLabel}
          </span>
        </span>
        <ChevronDown size={9} strokeWidth={2.5} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>

      {mounted && open && typeof document !== "undefined" && createPortal(
        <div
          id="pillar-select-portal"
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: 200, background: "#fff", borderRadius: 10, padding: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mfcIn 0.14s ease both" }}
        >
          {/* Unassigned */}
          <button onClick={() => { onChange(""); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 10, fontWeight: !current ? 700 : 400, background: !current ? "rgba(0,0,0,0.04)" : "transparent", color: !current ? "#1a1a1a" : "rgba(0,0,0,0.5)", transition: "background 0.1s ease" }}
            onMouseEnter={e => { if (current) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            onMouseLeave={e => { if (current) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(0,0,0,0.15)", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{unassignedLabel}</span>
            {!current && <Check size={10} strokeWidth={3} color="rgba(0,0,0,0.4)" />}
          </button>

          {assignablePillars.map(p => {
            const sel = p.id === value;
            const isDist = p.name === "Distributionsziel";
            const expanded = isDist && distExpanded;

            return (
              <div key={p.id}>
                {/* Main pillar row */}
                <button
                  onClick={() => {
                    if (isDist) {
                      setDistExpanded(e => !e);
                    } else {
                      onChange(p.id);
                      setOpen(false);
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                    borderRadius: expanded ? "7px 7px 0 0" : 7, border: "none", cursor: "pointer",
                    fontSize: 10, fontWeight: sel ? 700 : 400,
                    background: expanded ? `${DIST_COLOR}0e` : sel ? `${p.color}0e` : "transparent",
                    color: sel ? p.color : expanded && isDist ? DIST_COLOR : "#374151",
                    transition: "background 0.12s ease, color 0.12s ease",
                  }}
                  onMouseEnter={e => { if (!sel && !expanded) e.currentTarget.style.background = `${p.color}08`; }}
                  onMouseLeave={e => { if (!sel && !expanded) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {sel && !isDist && <Check size={10} strokeWidth={3} color={p.color} style={{ flexShrink: 0 }} />}
                  {isDist && (
                    <ChevronDown
                      size={9} strokeWidth={2.5}
                      color={expanded ? DIST_COLOR : "rgba(0,0,0,0.3)"}
                      style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)" }}
                    />
                  )}
                </button>

                {/* Frequency rule tray — only for Distributionsziel */}
                {isDist && (
                  <div style={{
                    overflow: "hidden",
                    maxHeight: expanded ? 56 : 0,
                    opacity: expanded ? 1 : 0,
                    transition: "max-height 0.24s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease",
                  }}>
                    <div style={{
                      padding: "6px 10px 8px",
                      background: `${DIST_COLOR}07`,
                      borderRadius: "0 0 7px 7px",
                      display: "flex", flexDirection: "column", gap: 4,
                      transform: expanded ? "translateY(0)" : "translateY(4px)",
                      transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: `${DIST_COLOR}90`, marginBottom: 2 }}>
                        Frequenzregel wählen
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["lt8", "gt8"] as const).map(rule => {
                          const active = sel && currentFreqRule === rule;
                          return (
                            <button
                              key={rule}
                              onClick={() => { onChange(p.id, rule); setOpen(false); }}
                              style={{
                                flex: 1, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer",
                                fontSize: 10, fontWeight: 600, fontFamily: "inherit",
                                transition: "all 0.12s ease",
                                background: active ? DIST_COLOR : "rgba(255,255,255,0.9)",
                                color: active ? "#fff" : DIST_COLOR,
                                boxShadow: active
                                  ? `inset 0 1px 0.5px rgba(255,255,255,0.25), 0 0 0 1px ${DIST_COLOR}`
                                  : `0 0 0 1px ${DIST_COLOR}40`,
                              }}
                              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = `${DIST_COLOR}12`; }}
                              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.9)"; }}
                            >
                              {rule === "lt8" ? "nur Freq. <8" : "nur Freq. >8"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [selectedSourceKeys, setSelectedSourceKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setMultiSelectActive(false);
    setSelectedSourceKeys(new Set());
  }, [quarter.id]);

  // Map source.catalogKey → pillarId
  const assignmentMap: Record<string, string> = {};
  for (const p of quarter.pillars) {
    for (const r of p.sourceRefs) {
      assignmentMap[r.catalogKey] = p.id;
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

  const createSourceRef = (src: BonusSource, pillarId: string, freqRule?: "lt8" | "gt8"): PraemienSourceRef => ({
      id: src.key,
      catalogKey: src.key,
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
      // Only store rule when assigning to Distributionsziel
      ...(freqRule && isDistributionPillar(quarter.pillars, pillarId) ? { distributionFreqRule: freqRule } : {}),
  });

  const assignToPillar = (src: BonusSource, pillarId: string, freqRule?: "lt8" | "gt8") => {
    const ref = createSourceRef(src, pillarId, freqRule);
    // Remove from any existing pillar first
    const cleanedPillars = quarter.pillars.map(p => ({
      ...p,
      sourceRefs: p.sourceRefs.filter(r => r.catalogKey !== src.key),
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

  const cancelMultiSelect = () => {
    setMultiSelectActive(false);
    setSelectedSourceKeys(new Set());
  };

  const startMultiSelect = (event: ReactMouseEvent<HTMLButtonElement>, sourceKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    setMultiSelectActive(true);
    setSelectedSourceKeys((current) => {
      if (current.has(sourceKey)) return current;
      const next = new Set(current);
      next.add(sourceKey);
      return next;
    });
  };

  const toggleSourceSelection = (sourceKey: string) => {
    setSelectedSourceKeys((current) => {
      const next = new Set(current);
      if (next.has(sourceKey)) next.delete(sourceKey);
      else next.add(sourceKey);
      return next;
    });
  };

  const assignSelectedToPillar = (pillarId: string, freqRule?: "lt8" | "gt8") => {
    if (selectedSourceKeys.size === 0) return;
    const refs = sources
      .filter((source) => selectedSourceKeys.has(source.key))
      .map((source) => createSourceRef(source, pillarId, freqRule));
    const cleanedPillars = quarter.pillars.map((pillar) => ({
      ...pillar,
      sourceRefs: pillar.sourceRefs.filter((ref) => !selectedSourceKeys.has(ref.catalogKey)),
    }));
    const nextPillars = pillarId
      ? cleanedPillars.map((pillar) => (
          pillar.id === pillarId ? { ...pillar, sourceRefs: [...pillar.sourceRefs, ...refs] } : pillar
        ))
      : cleanedPillars;
    onChange({ ...quarter, pillars: nextPillars });
    cancelMultiSelect();
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
        <span style={{ fontSize: 9, color: multiSelectActive ? R : "rgba(0,0,0,0.3)", fontWeight: multiSelectActive ? 700 : 500 }}>
          {multiSelectActive ? "Fragen anklicken und gemeinsam zuordnen" : "Rechtsklick auf Zuordnung · Mehrfachauswahl"}
        </span>
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

      {multiSelectActive && (
        <div style={{
          minHeight: 48, padding: "8px 18px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(220,38,38,0.12)", background: "rgba(220,38,38,0.035)",
          boxShadow: "inset 3px 0 0 rgba(220,38,38,0.72)",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: selectedSourceKeys.size > 0 ? R : "rgba(0,0,0,0.08)", color: "#fff",
            fontSize: 10, fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0,
          }}>
            {selectedSourceKeys.size}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>Mehrfachauswahl aktiv</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.42)", marginTop: 1 }}>Jede gewünschte Frage anklicken, danach rechts die Säule wählen.</div>
          </div>
          <PillarSelect
            value=""
            pillars={quarter.pillars}
            disabled={selectedSourceKeys.size === 0}
            placeholder="Säule auswählen"
            unassignedLabel="Zuordnung entfernen"
            onChange={assignSelectedToPillar}
          />
          <button
            type="button"
            onClick={cancelMultiSelect}
            style={{
              height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.09)",
              background: "rgba(255,255,255,0.82)", color: "rgba(0,0,0,0.52)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 650,
            }}
          >
            <X size={10} strokeWidth={2.4} />
            Abbrechen
          </button>
        </div>
      )}

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
              const selected = selectedSourceKeys.has(src.key);

              return (
                <div key={src.key}
                  role={multiSelectActive ? "button" : undefined}
                  tabIndex={multiSelectActive ? 0 : undefined}
                  aria-pressed={multiSelectActive ? selected : undefined}
                  onClick={() => { if (multiSelectActive) toggleSourceSelection(src.key); }}
                  onKeyDown={(event) => {
                    if (!multiSelectActive || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    toggleSourceSelection(src.key);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
                    borderBottom: "1px solid rgba(0,0,0,0.035)", transition: "background 0.1s ease, box-shadow 0.1s ease",
                    cursor: multiSelectActive ? "pointer" : "default",
                    background: selected ? "rgba(220,38,38,0.045)" : "transparent",
                    boxShadow: selected ? "inset 3px 0 0 rgba(220,38,38,0.68)" : "inset 3px 0 0 transparent",
                    outline: "none",
                  }}
                  onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = multiSelectActive ? "rgba(220,38,38,0.022)" : "rgba(0,0,0,0.015)"; }}
                  onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {multiSelectActive && (
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: selected ? R : "#fff", color: "#fff",
                      boxShadow: selected ? `0 0 0 1px ${R}` : "0 0 0 1px rgba(0,0,0,0.18)",
                    }}>
                      {selected && <Check size={10} strokeWidth={3} />}
                    </div>
                  )}
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
                      disabled={multiSelectActive}
                      currentFreqRule={(quarter.pillars.find(p => p.id === currentPillarId)?.sourceRefs.find(r => r.catalogKey === src.key))?.distributionFreqRule}
                      onChange={(id, freqRule) => assignToPillar(src, id, freqRule)}
                      onContextMenu={(event) => startMultiSelect(event, src.key)}
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
  quarter, gms, onClose, initialRegion = "Alle",
}: {
  quarter: PraemienQuarter;
  gms: GmRosterEntry[];
  onClose: () => void;
  initialRegion?: RegionFilter;
}) {
  const rows = buildGmProgressRows(quarter, gms);
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
    if (regionFilter !== "Alle" && gms.find(g => g.id === r.gmId)?.region !== regionFilter) return false;
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
              {quarter.name} · {doneCount} / {gms.length} fertig · Ø Prämie: {avgReward}€
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

                {/* Manual blocking message */}
                {(() => {
                  const missingManualGoals = [
                    !selected.isFlexDone ? "Flexziel" : null,
                    !selected.isQualityDone ? "Qualitätsziele" : null,
                  ].filter((entry): entry is string => Boolean(entry));
                  if (missingManualGoals.length === 0) return null;
                  const verb = missingManualGoals.length === 1 ? "wurde" : "wurden";
                  return (
                    <div style={{ padding: "10px 13px", borderRadius: 9, background: "rgba(217,119,6,0.04)", border: "1px solid rgba(217,119,6,0.18)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <AlertTriangle size={13} strokeWidth={2} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 10, color: "#92400e", lineHeight: 1.5, fontWeight: 500 }}>
                        Prämie noch nicht final — {missingManualGoals.join(" und ")} {verb} für diesen GM noch nicht erfasst. Die aktuelle Prämie ist vorläufig.
                      </div>
                    </div>
                  );
                })()}
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
  backgroundImage: "linear-gradient(135deg, #EFB54E 0%, #FFED96 22%, #FCD94C 54%, #F9F793 80%, #EFB94D 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const SILVER_GRAD: React.CSSProperties = {
  backgroundImage: "linear-gradient(135deg, #6B7280 0%, #9CA3AF 30%, #4B5563 60%, #8B9CB0 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const BRONZE_GRAD: React.CSSProperties = {
  backgroundImage: "linear-gradient(135deg, #BD965D 0%, #99774A 26%, #DEBF93 64%, #AC9071 100%)",
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

  // Normalize region aliases so "nord", "norrd", "n" etc. all match "Nord"
  const REGION_ALIASES: Record<string, string> = {
    nord: "Nord", nrd: "Nord", nort: "Nord",
    ost: "Ost", east: "Ost", ots: "Ost",
    süd: "Süd", sued: "Süd", sud: "Süd", south: "Süd",
    west: "West", wst: "West", wets: "West",
  };
  function resolveRegion(q: string): string | null {
    const l = q.toLowerCase().trim();
    if (REGION_ALIASES[l]) return REGION_ALIASES[l];
    // partial match
    for (const [alias, region] of Object.entries(REGION_ALIASES)) {
      if (alias.startsWith(l) || l.startsWith(alias)) return region;
    }
    return null;
  }

  const filtered = leaderboard.filter(e => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const resolvedRegion = resolveRegion(q);
    const gmRegion = ALL_GMS.find(g => g.id === e.gmId)?.region ?? "";
    if (resolvedRegion) return gmRegion === resolvedRegion;
    return e.gmName.toLowerCase().includes(q) || gmRegion.toLowerCase().includes(q);
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
                <input type="text" placeholder="GM oder Region suchen…" value={search} onChange={e => setSearch(e.target.value)}
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

function computeIssues(quarter: PraemienQuarter, sources: BonusSource[], gms: GmRosterEntry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (quarter.thresholds.length < 2) issues.push({ severity: "error", message: "Weniger als 2 Schwellwerte konfiguriert." });
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPoints <= sorted[i - 1].minPoints) issues.push({ severity: "error", message: `Schwellwerte überschneiden sich: "${sorted[i - 1].label}" & "${sorted[i].label}".` });
  }
  for (const p of quarter.pillars) {
    if (isManualPillar(p)) continue; // manual pillar - no boni sources expected
    if (p.sourceRefs.length === 0) issues.push({ severity: "warning", message: `Säule "${p.name}" hat keine Quellen.` });
  }
  const usedKeys = new Set<string>();
  const dupes = new Set<string>();
  for (const p of quarter.pillars) {
    for (const r of p.sourceRefs) {
      if (usedKeys.has(r.catalogKey)) dupes.add(r.catalogKey);
      usedKeys.add(r.catalogKey);
    }
  }
  if (dupes.size > 0) issues.push({ severity: "error", message: `${dupes.size} Quelle(n) mehrfach zugewiesen.` });
  const totalAssigned = quarter.pillars.reduce((n, p) => n + (isManualPillar(p) ? 0 : p.sourceRefs.length), 0);
  if (sources.length > 0 && totalAssigned === 0) issues.push({ severity: "info", message: "Noch keine Quellen zugewiesen." });
  if (!flexIsComplete(quarter, gms)) {
    const doneCount = (quarter.flexSubmissions ?? []).length;
    issues.push({ severity: "warning", message: `Flexziel: ${doneCount} / ${gms.length} GMs bewertet.` });
  }
  // Quality goals completion
  if (!qualityIsComplete(quarter, gms)) {
    const doneCount = (quarter.qualitySubmissions ?? []).length;
    issues.push({ severity: "warning", message: `Qualitätsziele: ${doneCount} / ${gms.length} GMs bewertet.` });
  }
  return issues;
}

function ValidationRail({ quarter, sources, gms }: { quarter: PraemienQuarter | null; sources: BonusSource[]; gms: GmRosterEntry[] }) {
  if (!quarter) return null;
  const issues = computeIssues(quarter, sources, gms);
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
  const totalMaxPts = quarter.pillars.reduce((n, p) => n + (isManualPillar(p) ? 0 : p.sourceRefs.reduce((s, r) => s + r.boniValue, 0)), 0);
  const sorted = [...quarter.thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const vollerBonus = sorted.find(t => t.label === "Voller Bonus");
  const vollerPts = vollerBonus?.minPoints ?? totalMaxPts;
  // Simulated points = 78% of Voller Bonus threshold (the real target)
  const simulatedPts = vollerPts > 0 ? Math.round(vollerPts * 0.78) : Math.round(totalMaxPts * 0.78);
  const erreichungPct = vollerPts > 0 ? Math.round((simulatedPts / vollerPts) * 100) : 0;
  const currentTier = [...sorted].reverse().find(t => simulatedPts >= t.minPoints) ?? sorted[0];
  const nextTier = currentTier ? sorted.find(t => t.minPoints > (currentTier?.minPoints ?? 0)) : null;

  const tierColor = (eur: number) => eur === 0 ? R : eur <= 550 ? "#f97316" : eur <= 880 ? "#eab308" : "#16a34a";

  return (
    <Card style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      {/* Grey header area */}
      <div style={{ padding: "13px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>GM-Ansicht Vorschau</span>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>Simuliert · {erreichungPct}% Erreichung</span>
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
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>{simulatedPts} / {vollerPts} Punkte</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: R }}>{erreichungPct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, erreichungPct)}%`, borderRadius: 3, background: `linear-gradient(to right, ${R}80, ${R})`, transition: "width 0.4s ease" }} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showReloadAction, setShowReloadAction] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<AutosaveSection, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [conflictSection, setConflictSection] = useState<AutosaveSection | null>(null);
  const [quarters, setQuarters] = useState<PraemienQuarter[]>([]);
  const [activeQuarterId, setActiveQuarterId] = useState<string | null>(null);
  const [bonusSources, setBonusSources] = useState<BonusSource[]>([]);
  const [gmUsers, setGmUsers] = useState<GmRosterEntry[]>([]);
  const [showGmProgress, setShowGmProgress] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gmRegionFilter, setGmRegionFilter] = useState<RegionFilter>("Alle");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const queuedAfterSaveRef = useRef(false);
  const dirtySectionsRef = useRef<Set<AutosaveSection>>(new Set());
  const sectionStatesRef = useRef<Record<AutosaveSection, AutosaveSectionState>>({ ...INITIAL_SECTION_STATES });
  const queuedSectionSnapshotsRef = useRef<Partial<Record<AutosaveSection, AnySectionSnapshot>>>({});
  const pendingSectionSnapshotRef = useRef<Partial<Record<AutosaveSection, AnySectionSnapshot>>>({});
  const blockedFingerprintRef = useRef<Map<AutosaveSection, string>>(new Map());
  const staleRetryRef = useRef<Map<string, number>>(new Map());
  const deletedWaveIdsRef = useRef<Set<string>>(new Set());

  const transitionSectionState = useCallback((section: AutosaveSection, event: "dirty" | "saving" | "saved" | "blocked" | "conflict" | "clear") => {
    if (event === "dirty") {
      sectionStatesRef.current[section] = "dirty";
      dirtySectionsRef.current.add(section);
      return;
    }
    if (event === "saving") {
      sectionStatesRef.current[section] = "saving";
      dirtySectionsRef.current.delete(section);
      return;
    }
    if (event === "saved" || event === "clear") {
      sectionStatesRef.current[section] = "clean";
      dirtySectionsRef.current.delete(section);
      blockedFingerprintRef.current.delete(section);
      pendingSectionSnapshotRef.current[section] = undefined;
      queuedSectionSnapshotsRef.current[section] = undefined;
      staleRetryRef.current.delete(`${activeQuarterId ?? ""}:${section}`);
      return;
    }
    if (event === "blocked") {
      sectionStatesRef.current[section] = "blocked";
      dirtySectionsRef.current.delete(section);
      return;
    }
    sectionStatesRef.current[section] = "conflict";
    dirtySectionsRef.current.delete(section);
  }, [activeQuarterId]);

  const clearTransientAutosaveState = useCallback((targetWaveId?: string | null) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    dirtySectionsRef.current.clear();
    queuedAfterSaveRef.current = false;
    queuedSectionSnapshotsRef.current = {};
    pendingSectionSnapshotRef.current = {};
    blockedFingerprintRef.current.clear();
    setSectionErrors({});
    setConflictSection(null);
    setShowReloadAction(false);
    staleRetryRef.current = targetWaveId
      ? new Map(Array.from(staleRetryRef.current.entries()).filter(([key]) => !key.startsWith(`${targetWaveId}:`)))
      : new Map();
    sectionStatesRef.current = { ...INITIAL_SECTION_STATES };
  }, []);

  const loadFromBackend = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setShowReloadAction(false);
    clearTransientAutosaveState();
    deletedWaveIdsRef.current.clear();
    try {
      const [waveList, sourceRows, gmRows] = await Promise.all([
        fetchAdminPraemienWaves({ limit: 200, offset: 0 }),
        fetchAdminPraemienSources(),
        fetchGmUsers().catch(() => []),
      ]);
      const mappedSources: BonusSource[] = sourceRows.map((row) => ({
        key: row.key,
        sectionType: row.sectionType,
        fragebogenId: row.fragebogenId ?? "",
        fragebogenName: row.fragebogenName ?? "",
        moduleId: row.moduleId ?? "",
        moduleName: row.moduleName ?? "",
        questionId: row.questionId,
        questionText: row.questionText ?? "",
        scoringKey: row.scoringKey,
        boniValue: Number(row.boniValue ?? 0),
        isFactorMode: Boolean(row.isFactorMode),
        displayLabel: row.displayLabel ?? "",
      }));
      setBonusSources(mappedSources);
      const mappedGmUsers: GmRosterEntry[] = gmRows.map((gm) => ({
        id: gm.id,
        name: `${gm.firstName} ${gm.lastName}`.trim(),
        region: gm.region || "Unbekannt",
      }));
      setGmUsers(mappedGmUsers);

      const waveIds = (waveList.waves ?? []).map((entry) => entry.id);
      if (waveIds.length === 0) {
        setQuarters([]);
        setActiveQuarterId(null);
        clearTransientAutosaveState();
        return;
      }
      const loadedWavesRaw = await Promise.all(waveIds.map((waveId) => fetchAdminPraemienWave(waveId)));
      const loadedWaves = loadedWavesRaw.map(toUiQuarter);
      const activeWave = loadedWaves[0];
      if (!activeWave) return;
      isHydratingRef.current = true;
      setQuarters(loadedWaves);
      setActiveQuarterId(activeWave.id);
      isHydratingRef.current = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prämien-Daten konnten nicht geladen werden.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [clearTransientAutosaveState]);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  useEffect(() => {
    const activeId = activeQuarterId;
    if (!activeId) return;
    if (quarters.some((entry) => entry.id === activeId)) return;
    setActiveQuarterId(quarters[0]?.id ?? null);
  }, [quarters, activeQuarterId]);

  const activeQuarter = quarters.find(q => q.id === activeQuarterId) ?? null;
  const gmRoster = gmUsers.length > 0 ? gmUsers : ALL_GMS;
  const qualityPersistenceReady = gmUsers.length > 0;
  const flexPersistenceReady = gmUsers.length > 0;

  useEffect(() => {
    clearTransientAutosaveState();
  }, [activeQuarterId, clearTransientAutosaveState]);

  const updateQuarter = useCallback((updated: PraemienQuarter) => {
    setSaveError(null);
    setShowReloadAction(false);
    setConflictSection(null);
    setQuarters(prev => prev.map((q) => {
      if (q.id !== updated.id) return q;
      if (!isHydratingRef.current) {
        const dirtySections = detectDirtySections(q, updated);
        if (dirtySections.length > 0) {
          let queuedNewWork = false;
          for (const section of dirtySections) {
            const snapshot = snapshotSectionPayload(updated, section);
            const fingerprint = sectionPayloadFingerprint(snapshot);
            const blockedFingerprint = blockedFingerprintRef.current.get(section);
            if (blockedFingerprint && blockedFingerprint === fingerprint) {
              continue;
            }
            if (blockedFingerprint && blockedFingerprint !== fingerprint) {
              blockedFingerprintRef.current.delete(section);
              setSectionErrors((prevErrors) => ({ ...prevErrors, [section]: undefined }));
            }
            queuedSectionSnapshotsRef.current[section] = snapshot;
            transitionSectionState(section, "dirty");
            queuedNewWork = true;
          }
          if (queuedNewWork) {
            setDirtyVersion((version) => version + 1);
          }
        }
      }
      return updated;
    }));
  }, [transitionSectionState]);

  const createNewQuarter = async () => {
    setSaveError(null);
    setShowReloadAction(false);
    const now = new Date();
    const year = now.getFullYear();
    const q = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    const { startDate, endDate } = getQuarterDates(year, q);
    const defaultPillars = buildDefaultPillars();
    const totalSourcePoints = bonusSources.reduce((n, s) => n + s.boniValue, 0);
    const defaultThresholds = buildDefaultThresholds(totalSourcePoints);
    try {
      const createdRaw = await createAdminPraemienWave(toCreatePayload({
        name: `Prämien Q${q} ${year}`,
        year,
        quarter: q,
        startDate,
        endDate,
        description: "",
        status: "draft",
        thresholds: defaultThresholds,
        pillars: defaultPillars,
      }));
      const created = toUiQuarter(createdRaw);
      isHydratingRef.current = true;
      setQuarters(prev => [created, ...prev.filter((entry) => entry.id !== created.id)]);
      setActiveQuarterId(created.id);
      isHydratingRef.current = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quartal konnte nicht erstellt werden.";
      setSaveError(message);
    }
  };

  const handleExportPraemien = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPraemienExcel({
        quarters,
        activeQuarterId,
        sourceCatalog: bonusSources,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Prämien-Export konnte nicht erstellt werden.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handler = () => { void handleExportPraemien(); };
    window.addEventListener("admin:praemien:export", handler);
    return () => window.removeEventListener("admin:praemien:export", handler);
  });

  const saveSection = useCallback(async (quarter: PraemienQuarter, section: AutosaveSection) => {
    if (!quarter.id || !isUuid(quarter.id)) return quarter;
    try {
      if (section === "metadata") {
        return await patchAdminPraemienWave(quarter.id, toPatchPayload(quarter));
      }
      if (section === "thresholds") {
        return await replaceAdminPraemienThresholds(quarter.id, toThresholdsPayload(quarter));
      }
      if (section === "pillars") {
        return await replaceAdminPraemienPillars(quarter.id, toPillarsPayload(quarter));
      }
      if (section === "sources") {
        const serverPillarByName = new Map(quarter.pillars.map((entry) => [entry.name, entry.id]));
        return await replaceAdminPraemienSources(quarter.id, toSourcesPayload(quarter, serverPillarByName));
      }
      if (section === "flex") {
        return await replaceAdminPraemienFlexScores(quarter.id, toFlexPayload(quarter));
      }
      return await replaceAdminPraemienQualityScores(quarter.id, toQualityPayload(quarter));
    } catch (error) {
      (error as { __praemienSection?: AutosaveSection }).__praemienSection = section;
      throw error;
    }
  }, []);

  const flushAutosaveQueue = useCallback(async () => {
    if (saveInFlightRef.current) {
      queuedAfterSaveRef.current = true;
      return;
    }
    const currentQuarter = quarters.find((entry) => entry.id === activeQuarterId) ?? null;
    if (!currentQuarter) return;
    if (deletedWaveIdsRef.current.has(currentQuarter.id)) return;
    const hasQueuedSections = AUTOSAVE_SECTION_ORDER.some((section) => Boolean(queuedSectionSnapshotsRef.current[section]));
    if (!hasQueuedSections) return;

    saveInFlightRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setShowReloadAction(false);
    try {
      let latest = currentQuarter;
      const sections = AUTOSAVE_SECTION_ORDER.filter((entry) => Boolean(queuedSectionSnapshotsRef.current[entry]));
      for (const section of sections) {
        const snapshot = queuedSectionSnapshotsRef.current[section];
        if (!snapshot) continue;
        const inFlightFingerprint = sectionPayloadFingerprint(snapshot);
        queuedSectionSnapshotsRef.current[section] = undefined;
        pendingSectionSnapshotRef.current[section] = snapshot;
        transitionSectionState(section, "saving");
        try {
          const composedQuarter = applySectionPayloadSnapshot({ ...latest }, section, snapshot);
          latest = await saveSection(composedQuarter, section);
          setSectionErrors((prev) => ({ ...prev, [section]: undefined }));
          pendingSectionSnapshotRef.current[section] = undefined;
          if (latest.id) staleRetryRef.current.delete(`${latest.id}:${section}`);
          const queuedSnapshot = queuedSectionSnapshotsRef.current[section];
          if (!queuedSnapshot) {
            transitionSectionState(section, "saved");
          } else if (sectionPayloadFingerprint(queuedSnapshot) !== inFlightFingerprint) {
            transitionSectionState(section, "dirty");
          } else {
            queuedSectionSnapshotsRef.current[section] = undefined;
            transitionSectionState(section, "saved");
          }
        } catch (error) {
          if (error instanceof BackendApiError && error.code === "wave_stale_write") {
            transitionSectionState(section, "conflict");
            throw error;
          }
          const sectionName = (error as { __praemienSection?: AutosaveSection }).__praemienSection ?? section;
          const queuedSnapshot = queuedSectionSnapshotsRef.current[section];
          const queuedFingerprint = queuedSnapshot ? sectionPayloadFingerprint(queuedSnapshot) : null;
          if (!queuedFingerprint || queuedFingerprint === inFlightFingerprint) {
            blockedFingerprintRef.current.set(sectionName, inFlightFingerprint);
            transitionSectionState(sectionName, "blocked");
          } else {
            transitionSectionState(sectionName, "dirty");
          }
          setSectionErrors((prev) => ({
            ...prev,
            [sectionName]: formatSectionError(error),
          }));
          throw error;
        }
      }

      isHydratingRef.current = true;
      setQuarters((prev) => prev.map((entry) => (entry.id === latest.id ? latest : entry)));
      isHydratingRef.current = false;
    } finally {
      setIsSaving(false);
      saveInFlightRef.current = false;
      const hasMoreQueued = AUTOSAVE_SECTION_ORDER.some((section) => Boolean(queuedSectionSnapshotsRef.current[section]));
      if (queuedAfterSaveRef.current || hasMoreQueued) {
        queuedAfterSaveRef.current = false;
        setDirtyVersion((value) => value + 1);
      }
    }
  }, [activeQuarterId, quarters, saveSection, transitionSectionState]);

  useEffect(() => {
    if (isLoading) return;
    if (isHydratingRef.current) return;
    if (!activeQuarterId) return;
    if (deletedWaveIdsRef.current.has(activeQuarterId)) return;
    const hasQueuedSections = AUTOSAVE_SECTION_ORDER.some((section) => Boolean(queuedSectionSnapshotsRef.current[section]));
    if (!hasQueuedSections) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      (async () => {
        try {
          await flushAutosaveQueue();
        } catch (error) {
          if (error instanceof BackendApiError && error.code === "wave_stale_write" && activeQuarterId) {
            try {
              const refreshed = await fetchAdminPraemienWave(activeQuarterId);
              const section = (error as { __praemienSection?: AutosaveSection }).__praemienSection ?? "metadata";
              const retryKey = `${activeQuarterId}:${section}`;
              const retryCount = staleRetryRef.current.get(retryKey) ?? 0;
              const pendingSnapshot = pendingSectionSnapshotRef.current[section];
              if (pendingSnapshot && retryCount < 1) {
                const merged = applySectionPayloadSnapshot(refreshed, section, pendingSnapshot);
                staleRetryRef.current.set(retryKey, retryCount + 1);
                queuedSectionSnapshotsRef.current[section] = pendingSnapshot;
                transitionSectionState(section, "dirty");
                isHydratingRef.current = true;
                setQuarters((prev) => prev.map((entry) => (entry.id === merged.id ? merged : entry)));
                isHydratingRef.current = false;
                setConflictSection(section);
                setSaveError(`Konflikt in ${AUTOSAVE_SECTION_LABELS[section]} erkannt: Neueste Server-Version geladen und lokale Änderung erneut angewendet.`);
                setShowReloadAction(false);
                setDirtyVersion((value) => value + 1);
                return;
              }
              isHydratingRef.current = true;
              setQuarters((prev) => prev.map((entry) => (entry.id === refreshed.id ? refreshed : entry)));
              isHydratingRef.current = false;
              setConflictSection(section);
              transitionSectionState(section, "conflict");
              setSaveError(`Konflikt in ${AUTOSAVE_SECTION_LABELS[section]}: Bitte lokale Änderung erneut anwenden oder Server-Version laden.`);
              setShowReloadAction(true);
              return;
            } catch {
              // fall through to generic handling
            }
          }
          const section = (error as { __praemienSection?: AutosaveSection }).__praemienSection;
          if (section) {
            setSectionErrors((prev) => ({
              ...prev,
              [section]: formatSectionError(error),
            }));
          }
          const message = error instanceof Error ? error.message : "Autosave fehlgeschlagen.";
          setSaveError(message);
        }
      })();
    }, WAVE_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [activeQuarterId, dirtyVersion, flushAutosaveQueue, isLoading, transitionSectionState]);

  const issues = activeQuarter ? computeIssues(activeQuarter, bonusSources, gmRoster) : [];
  const unsavedSections = AUTOSAVE_SECTION_ORDER.filter((section) => {
    const state = sectionStatesRef.current[section];
    return state === "dirty" || state === "saving";
  });

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
          {isSaving && <span style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>Speichert…</span>}
          <GhostBtn onClick={() => setShowLeaderboard(true)}>
            <Trophy size={11} strokeWidth={2} />
            Leaderboard
          </GhostBtn>
          {activeQuarter && (
            <>
              <GhostBtn onClick={() => {
                void (async () => {
                  try {
                    const copy = await createAdminPraemienWave(toCreatePayload({
                      name: `Kopie von ${activeQuarter.name}`,
                      year: activeQuarter.year,
                      quarter: activeQuarter.quarter,
                      startDate: activeQuarter.startDate,
                      endDate: activeQuarter.endDate,
                      description: activeQuarter.description,
                      status: "draft",
                      thresholds: activeQuarter.thresholds,
                      pillars: activeQuarter.pillars,
                    }));
                    isHydratingRef.current = true;
                    setQuarters(prev => [copy, ...prev.filter((entry) => entry.id !== copy.id)]);
                    setActiveQuarterId(copy.id);
                    isHydratingRef.current = false;
                  } catch (error) {
                    setSaveError(error instanceof Error ? error.message : "Kopie konnte nicht erstellt werden.");
                  }
                })();
              }}>
                <Copy size={11} strokeWidth={2} />
                Duplizieren
              </GhostBtn>
              <GhostBtn
                danger
                disabled={isDeleting}
                onClick={() => {
                void (async () => {
                  if (!activeQuarterId) return;
                  const deletedWaveId = activeQuarterId;
                  setIsDeleting(true);
                  try {
                    deletedWaveIdsRef.current.add(deletedWaveId);
                    clearTransientAutosaveState(deletedWaveId);
                    await deleteAdminPraemienWave(deletedWaveId);
                    isHydratingRef.current = true;
                    setQuarters((prev) => {
                      const filtered = prev.filter((entry) => entry.id !== deletedWaveId);
                      setActiveQuarterId((prevActive) => (
                        prevActive === deletedWaveId ? (filtered[0]?.id ?? null) : prevActive
                      ));
                      return filtered;
                    });
                    isHydratingRef.current = false;
                    setSaveError(null);
                    setShowReloadAction(false);
                    setConflictSection(null);
                    staleRetryRef.current = new Map(
                      Array.from(staleRetryRef.current.entries()).filter(([key]) => !key.startsWith(`${deletedWaveId}:`)),
                    );
                  } catch (error) {
                    deletedWaveIdsRef.current.delete(deletedWaveId);
                    setSaveError(error instanceof Error ? error.message : "Welle konnte nicht gelöscht werden.");
                  } finally {
                    setIsDeleting(false);
                  }
                })();
              }}
              >
                <Trash2 size={11} strokeWidth={2} />
                {isDeleting ? "Löscht…" : "Löschen"}
              </GhostBtn>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#991b1b", fontSize: 12 }}>
          {loadError}
        </div>
      )}
      {saveError && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.08)", color: "#92400e", fontSize: 12 }}>
          <div>{saveError}</div>
          {showReloadAction && activeQuarterId && conflictSection && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  void (async () => {
                    const pendingSnapshot = pendingSectionSnapshotRef.current[conflictSection];
                    if (!pendingSnapshot) return;
                    try {
                      const refreshed = await fetchAdminPraemienWave(activeQuarterId);
                      const merged = applySectionPayloadSnapshot(refreshed, conflictSection, pendingSnapshot);
                      queuedSectionSnapshotsRef.current[conflictSection] = pendingSnapshot;
                      transitionSectionState(conflictSection, "dirty");
                      isHydratingRef.current = true;
                      setQuarters((prev) => prev.map((entry) => (entry.id === merged.id ? merged : entry)));
                      isHydratingRef.current = false;
                      setShowReloadAction(false);
                      setSaveError(`Lokale Änderung für ${AUTOSAVE_SECTION_LABELS[conflictSection]} erneut vorgemerkt.`);
                      setDirtyVersion((value) => value + 1);
                    } catch (error) {
                      setSaveError(error instanceof Error ? error.message : "Lokale Wiederholung fehlgeschlagen.");
                    }
                  })();
                }}
                style={{ border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#92400e", background: "rgba(146,64,14,0.14)" }}
              >
                Lokale Änderung erneut anwenden
              </button>
              <button
                onClick={() => {
                  void (async () => {
                    try {
                      const refreshed = await fetchAdminPraemienWave(activeQuarterId);
                      isHydratingRef.current = true;
                      setQuarters((prev) => prev.map((entry) => (entry.id === refreshed.id ? refreshed : entry)));
                      isHydratingRef.current = false;
                      transitionSectionState(conflictSection, "clear");
                      setSectionErrors((prev) => ({ ...prev, [conflictSection]: undefined }));
                      setShowReloadAction(false);
                      setConflictSection(null);
                      setSaveError(null);
                    } catch (error) {
                      setSaveError(error instanceof Error ? error.message : "Neu laden fehlgeschlagen.");
                    }
                  })();
                }}
                style={{ border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#92400e", background: "rgba(146,64,14,0.08)" }}
              >
                Neueste Version laden
              </button>
            </div>
          )}
        </div>
      )}
      {exportError && (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#991b1b", fontSize: 12 }}>
          {exportError}
        </div>
      )}
      {unsavedSections.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.06)", color: "#1d4ed8", fontSize: 11 }}>
          Ungespeichert: {unsavedSections.map((section) => AUTOSAVE_SECTION_LABELS[section]).join(", ")}
        </div>
      )}

      {isLoading ? (
        <PraemienPageSkeleton />
      ) : null}

      {!isLoading && !activeQuarter ? (
        <EmptyState onNew={createNewQuarter} />
      ) : !isLoading && activeQuarter ? (
        <div className="praemien-main" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* ── Left main column ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>

            <QuarterHeaderCard
              quarter={activeQuarter}
              onChange={updateQuarter}
              gms={gmRoster}
              regionFilter={gmRegionFilter}
              onRegionChange={setGmRegionFilter}
              onOpenGmDetail={() => setShowGmProgress(true)}
            />
            {sectionErrors.metadata && (
              <div style={{ marginTop: -8, fontSize: 11, color: "#92400e" }}>Metadaten: {sectionErrors.metadata}</div>
            )}

            <OverviewStrip
              quarter={activeQuarter}
              gms={gmRoster}
              totalSources={bonusSources.length}
              totalPoints={Math.round(activeQuarter.pillars.reduce((n, p) => n + (isManualPillar(p) ? 0 : p.sourceRefs.reduce((s, r) => s + r.boniValue, 0)), 0) * 10) / 10}
              issues={issues.length}
            />

            {activeQuarter.rewardModel === "pillar_tiers" ? (
              <Card style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(135deg,rgba(220,38,38,0.045),rgba(255,255,255,0.92))", border: "1px solid rgba(220,38,38,0.11)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(220,38,38,0.09)", display: "flex", alignItems: "center", justifyContent: "center", color: R, flexShrink: 0 }}>
                  <Award size={16} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 750, color: "#1f1f1f" }}>Unabhängige Säulen-Auszahlung</div>
                  <div style={{ fontSize: 9.5, color: "rgba(0,0,0,0.43)", marginTop: 3, lineHeight: 1.45 }}>Jede Säule hat ihre eigenen Ziele und Beträge. Mehrleistung in einer Säule kann keine andere Säule freischalten.</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 850, color: R, fontVariantNumeric: "tabular-nums" }}>{activeQuarter.pillars.reduce((sum, pillar) => sum + pillar.maxRewardEur, 0).toLocaleString("de-AT")} €</div>
                  <div style={{ fontSize: 8, color: "rgba(0,0,0,0.32)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Quartalsmaximum</div>
                </div>
              </Card>
            ) : (
              <>
                <ThresholdDesignerCard quarter={activeQuarter} onChange={updateQuarter} />
                {sectionErrors.thresholds && (
                  <div style={{ marginTop: -8, fontSize: 11, color: "#92400e" }}>Schwellen: {sectionErrors.thresholds}</div>
                )}
              </>
            )}

            {/* Pillars grid */}
            <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
              {/* Grey header */}
              <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>4 Säulen · Boni-Gewichtung</span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>
                  {activeQuarter.rewardModel === "pillar_tiers"
                    ? `${activeQuarter.pillars.reduce((sum, pillar) => sum + pillar.maxRewardEur, 0).toLocaleString("de-AT")} € maximal · jede Säule separat`
                    : `Punkte pro Antwort — Ziel: ${activeQuarter.thresholds.find((t) => t.label === "Voller Bonus")?.minPoints ?? [...activeQuarter.thresholds].sort((a, b) => a.minPoints - b.minPoints).at(-1)?.minPoints ?? 0} P`}
                </span>
              </div>
              {/* White inner card */}
              <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {activeQuarter.pillars.map((p, i) => (
                  isFlexPillar(p) ? (
                    <FlexPillarCard
                      key={p.id}
                      pillar={p}
                      quarter={activeQuarter}
                      gms={gmRoster}
                      flexPersistenceReady={flexPersistenceReady}
                      onUpdateQuarter={updateQuarter}
                    />
                  ) : isQualityPillar(p) ? (
                    <QualityPillarCard
                      key={p.id}
                      pillar={p}
                      pillarIndex={i}
                      quarter={activeQuarter}
                      gms={gmRoster}
                      qualityPersistenceReady={qualityPersistenceReady}
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
            {(sectionErrors.pillars || sectionErrors.sources) && (
              <div style={{ marginTop: -8, fontSize: 11, color: "#92400e" }}>
                {sectionErrors.pillars ? `Säulen: ${sectionErrors.pillars}` : `Quellen: ${sectionErrors.sources}`}
              </div>
            )}
            {sectionErrors.flex && (
              <div style={{ marginTop: -8, fontSize: 11, color: "#92400e" }}>Flex: {sectionErrors.flex}</div>
            )}

            <BonusSourceExplorer
              sources={bonusSources}
              quarter={activeQuarter}
              onChange={updateQuarter}
            />
            {sectionErrors.quality && (
              <div style={{ marginTop: -8, fontSize: 11, color: "#92400e" }}>Qualität: {sectionErrors.quality}</div>
            )}
          </div>

          {/* ── Right sticky rail ── */}
          <div style={{ width: 288, flexShrink: 0, position: "sticky", top: 20 }}>
            <ValidationRail quarter={activeQuarter} sources={bonusSources} gms={gmRoster} />
            <GMPreviewCard quarter={activeQuarter} />
          </div>
        </div>
      ) : null}

      {/* GM Progress Modal */}
      {showGmProgress && activeQuarter && (
        <GMProgressModal
          quarter={activeQuarter}
          gms={gmRoster}
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
