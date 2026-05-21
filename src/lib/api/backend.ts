"use client";

import type { GMRecord } from "@/types/gebietsmanager";
import type { KuehlerUnitRecord, MarketRecord } from "@/types/markets";
import type { Fragebogen, Module, Question } from "@/types/fragebogen";
import type {
  Campaign,
  CampaignMarketAssignmentInput,
  CampaignMarketOverlapConflict,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@/types/campaign";
import type { PraemienGmBonusSummary, PraemienQuarter, PraemienSourceRef } from "@/types/praemien";
import type { ColumnMapping, ImportSummary } from "@/utils/marketImport";
import type { IppQuestionAuditRow } from "@/types/ipp";
import type { CreateLagerInput, LagerRecord } from "@/types/lager";
import type { RedMonthConfig, RedMonthCurrentPayload, RedMonthPeriod } from "@/types/red-month";
import { emitClientTelemetry } from "@/lib/clientTelemetry";

export type LoginRole = "gm" | "sm" | "admin" | "coke";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const AUTH_STORAGE_KEY = "coke_spark_auth_v1";
type AuthStorageTarget = "local" | "session";

export class BackendApiError extends Error {
  status: number;
  code: string | null;
  data: unknown;

  constructor(message: string, status: number, code: string | null, data: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

type BackendUser = {
  id: string;
  role: "admin" | "gm" | "sm";
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  region?: string | null;
  ipp?: number | null;
  ippSampleCount?: number | null;
  createdAt?: string;
  isActive?: boolean;
};

type BackendMarket = {
  id: string;
  standardMarketNumber?: string | null;
  cokeMasterNumber?: string | null;
  flexNumber?: string | null;
  name: string;
  dbName?: string | null;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  emEh?: string | null;
  employee?: string | null;
  currentGmName?: string | null;
  visitFrequencyPerYear?: number | null;
  infoFlag?: boolean | null;
  infoNote?: string | null;
  universeMarket?: boolean | null;
  marketType?: "universum" | "kuehler" | "both" | null;
  kuehlerStammnr?: string | null;
  isActive?: boolean | null;
  importSourceFileName?: string | null;
  importedAt?: string | null;
  plannedToId?: string | null;
  plannedByActiveStandardGmName?: string | null;
  activeNowCampaigns?: Array<{
    campaignId: string;
    campaignName: string;
    section: "standard" | "flex" | "kuehler" | "mhd" | "billa";
  }>;
  isDeleted?: boolean | null;
};

type BackendKuehlerUnit = {
  id: string;
  marketId: string;
  name?: string | null;
  employee?: string | null;
  kuehlerInternalId?: string | null;
  kuehlerBd?: string | null;
  kuehlerAnzahlKsAmStandort?: number | null;
  kuehlerSerialNumber?: string | null;
  kuehlerModel?: string | null;
  importSourceFileName?: string | null;
  importedAt?: string | null;
  isDeleted?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BackendLager = {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  gmUserId: string | null;
  gmName: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackendPhotoTag = {
  id: string;
  label: string;
  deletedAt?: string | null;
};

type BackendCampaignHistory = {
  id: string;
  fromFragebogenId: string | null;
  toFragebogenId: string;
  changedAt: string;
};

type BackendCampaign = {
  id: string;
  name: string;
  section: Campaign["section"];
  currentFragebogenId: string | null;
  currentFragebogenName: string | null;
  status: Campaign["status"];
  scheduleType: Campaign["scheduleType"];
  startDate: string | null;
  endDate: string | null;
  marketIds: string[];
  assignments?: Array<{
    marketId: string;
    gmUserId: string | null;
    gmName: string | null;
    assignmentSlot?: number;
    visitTargetCount?: number;
    currentVisitsCount?: number;
  }>;
  history: BackendCampaignHistory[];
  createdAt: string;
  updatedAt: string;
};

type BackendRedMonthPeriod = {
  id: string;
  label: string;
  periodIndexFromAnchor: number;
  start: string;
  end: string;
  year: number;
  isCurrent: boolean;
  daysUntilEnd: number;
};

type BackendRedMonthConfig = {
  anchorStart: string;
  cycleWeeks: number[];
  timezone: string;
  updatedAt: string | null;
};

type BackendCampaignMarketVisitSummary = {
  marketId: string;
  hasSubmittedVisit: boolean;
  sessionId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number | null;
  gmUserId: string | null;
  gmName: string | null;
  sections: Array<{
    id: string;
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd";
    campaignId: string;
    fragebogenId: string | null;
    fragebogenName: string;
    orderIndex: number;
    questions: Array<{
      id: string;
      questionId: string;
      moduleId: string;
      moduleName: string;
      type: "single" | "yesno" | "yesnomulti" | "multiple" | "likert" | "text" | "numeric" | "slider" | "photo" | "matrix";
      text: string;
      required: boolean;
      config: Record<string, unknown>;
      rules: Array<Record<string, unknown>>;
      chains: string[];
      appliesToMarketChain: boolean;
      visibility: {
        isHiddenByChain: boolean;
        isHiddenByRule: boolean;
        isVisibleAtSubmit: boolean;
      };
      answer: {
        id: string;
        answerStatus: "unanswered" | "answered" | "invalid" | "hidden_by_rule" | "skipped";
        valueText: string | null;
        valueNumber: string | null;
        valueJson: Record<string, unknown> | null;
        isValid: boolean;
        validationError: string | null;
        version: number;
        options: Array<{ optionRole: "top" | "sub"; optionValue: string; orderIndex: number }>;
        matrixCells: Array<{
          rowKey: string;
          columnKey: string;
          cellValueText: string | null;
          cellValueDate: string | null;
          cellSelected: boolean | null;
          orderIndex: number;
        }>;
        photos: Array<{
          id: string;
          storageBucket: string;
          storagePath: string;
          mimeType: string | null;
          byteSize: number | null;
          widthPx: number | null;
          heightPx: number | null;
          sha256: string | null;
          tags: Array<{
            id: string;
            photoTagId: string | null;
            photoTagLabelSnapshot: string;
          }>;
        }>;
      } | null;
      comment: string;
    }>;
  }>;
};

type BackendIppListRow = {
  id: string;
  marketId: string;
  marketName: string;
  chain: string;
  postalCode: string;
  city: string;
  region: string;
  gmName: string;
  redMonatLabel: string;
  redPeriodStart: string;
  redPeriodEnd: string;
  redPeriodYear: number;
  marketIpp: number | string;
  includedInAverage: boolean;
  isFinalized: boolean;
  sourceSubmissionCount: number;
  contributingQuestionCount: number;
};

type BackendIppDetailRecord = BackendIppListRow & {
  sourceSubmissionCount: number;
  contributingQuestionCount: number;
  questionRows: IppQuestionAuditRow[];
};

export type AuthSessionPayload = {
  user: {
    id: string;
    role: "admin" | "gm" | "sm";
    email: string;
    firstName: string;
    lastName: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  };
};

function getAuthStorage(target: AuthStorageTarget): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return target === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readAuthSessionFromStorage(target: AuthStorageTarget): AuthSessionPayload | null {
  const storage = getAuthStorage(target);
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSessionPayload;
  } catch {
    return null;
  }
}

function readAuthSessionWithTarget(): { payload: AuthSessionPayload; target: AuthStorageTarget } | null {
  const sessionPayload = readAuthSessionFromStorage("session");
  if (sessionPayload) {
    return { payload: sessionPayload, target: "session" };
  }
  const localPayload = readAuthSessionFromStorage("local");
  if (localPayload) {
    return { payload: localPayload, target: "local" };
  }
  return null;
}

export function saveAuthSession(payload: AuthSessionPayload, options?: { remember?: boolean }) {
  const target: AuthStorageTarget = options?.remember === false ? "session" : "local";
  const targetStorage = getAuthStorage(target);
  const otherStorage = getAuthStorage(target === "local" ? "session" : "local");
  const serialized = JSON.stringify(payload);

  targetStorage?.setItem(AUTH_STORAGE_KEY, serialized);
  otherStorage?.removeItem(AUTH_STORAGE_KEY);
}

export function clearAuthSession() {
  getAuthStorage("local")?.removeItem(AUTH_STORAGE_KEY);
  getAuthStorage("session")?.removeItem(AUTH_STORAGE_KEY);
}

export function readAuthSession(): AuthSessionPayload | null {
  return readAuthSessionWithTarget()?.payload ?? null;
}

export function getAccessToken(): string | null {
  return readAuthSession()?.session.accessToken ?? null;
}

export async function loginWithBackend(input: {
  email: string;
  password: string;
  role: LoginRole;
}): Promise<AuthSessionPayload> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AuthSessionPayload>;
  if (!res.ok || !data.user || !data.session) {
    throw new Error(data.error ?? "Login fehlgeschlagen.");
  }
  return data as AuthSessionPayload;
}

function mapBackendUserToGmRecord(user: BackendUser, oneTimePassword?: string): GMRecord {
  const ippValue = Number(user.ipp ?? 0);
  const ippSampleCountValue = Number(user.ippSampleCount ?? 0);
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? "",
    address: user.address ?? "",
    city: user.city ?? "",
    postalCode: user.postalCode ?? "",
    region: user.region ?? "",
    ipp: Number.isFinite(ippValue) ? ippValue : 0,
    ippSampleCount: Number.isFinite(ippSampleCountValue) && ippSampleCountValue > 0 ? Math.trunc(ippSampleCountValue) : 0,
    createdAt: user.createdAt ?? new Date().toISOString(),
    password: oneTimePassword,
  };
}

function mapBackendMarketToMarketRecord(market: BackendMarket): MarketRecord {
  const marketType =
    market.marketType === "kuehler" || market.marketType === "both" || market.marketType === "universum"
      ? market.marketType
      : market.universeMarket
        ? "universum"
        : "kuehler";
  return {
    id: market.id,
    name: market.name,
    dbName: market.dbName ?? "",
    address: market.address,
    postalCode: market.postalCode,
    city: market.city,
    region: market.region,
    emEh: market.emEh ?? "",
    currentGmName: market.currentGmName ?? "",
    plannedByActiveStandardGmName: market.plannedByActiveStandardGmName ?? null,
    visitFrequencyPerYear: market.visitFrequencyPerYear ?? 0,
    infoFlag: Boolean(market.infoFlag ?? false),
    flexNumber: market.flexNumber ?? "",
    cokeMasterNumber: market.cokeMasterNumber ?? "",
    standardMarketNumber: market.standardMarketNumber ?? "",
    employee: market.employee ?? "",
    universeMarket: Boolean(market.universeMarket ?? false),
    marketType,
    kuehlerStammnr: market.kuehlerStammnr ?? "",
    isActive: Boolean(market.isActive ?? true),
    infoNote: market.infoNote ?? "",
    ipp: null,
    importSourceFileName: market.importSourceFileName ?? "",
    importedAt: market.importedAt ?? new Date().toISOString(),
    plannedToId: market.plannedToId ?? null,
    isDeleted: Boolean(market.isDeleted ?? false),
  };
}

function mapBackendKuehlerUnitToRecord(unit: BackendKuehlerUnit): KuehlerUnitRecord {
  return {
    id: unit.id,
    marketId: unit.marketId,
    name: unit.name ?? "",
    employee: unit.employee ?? "",
    kuehlerInternalId: unit.kuehlerInternalId ?? null,
    kuehlerBd: unit.kuehlerBd ?? null,
    kuehlerAnzahlKsAmStandort:
      unit.kuehlerAnzahlKsAmStandort == null ? null : Number(unit.kuehlerAnzahlKsAmStandort),
    kuehlerSerialNumber: unit.kuehlerSerialNumber ?? null,
    kuehlerModel: unit.kuehlerModel ?? null,
    importSourceFileName: unit.importSourceFileName ?? "",
    importedAt: unit.importedAt ?? new Date().toISOString(),
    isDeleted: Boolean(unit.isDeleted ?? false),
    createdAt: unit.createdAt ?? undefined,
    updatedAt: unit.updatedAt ?? undefined,
  };
}

function mapBackendLagerToLagerRecord(input: BackendLager): LagerRecord {
  return {
    id: input.id,
    address: input.address,
    postalCode: input.postalCode,
    city: input.city,
    gmUserId: input.gmUserId ?? null,
    gmName: input.gmName ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function mapBackendRedMonthPeriod(period: BackendRedMonthPeriod): RedMonthPeriod {
  return {
    id: period.id,
    label: period.label,
    periodIndexFromAnchor: Number(period.periodIndexFromAnchor ?? 0),
    start: period.start,
    end: period.end,
    year: Number(period.year ?? 0),
    isCurrent: Boolean(period.isCurrent),
    daysUntilEnd: Number(period.daysUntilEnd ?? 0),
  };
}

function mapBackendRedMonthConfig(config: BackendRedMonthConfig): RedMonthConfig {
  return {
    anchorStart: config.anchorStart,
    cycleWeeks: Array.isArray(config.cycleWeeks) ? config.cycleWeeks.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : [],
    timezone: config.timezone,
    updatedAt: config.updatedAt ?? null,
  };
}

function shouldTrackClientAction(path: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (path.startsWith("/telemetry/events")) return false;
  if (normalizedMethod !== "GET") return true;
  return path === "/markets/gm/visit-start" || path === "/gm/bonus-summary" || path === "/gm/kpi-summary";
}

function buildClientActionName(path: string, method: string): string {
  const methodPart = method.toLowerCase();
  const pathPart = path
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9/:-]+/g, "-")
    .replace(/\//g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return `ui_api_${methodPart}_${pathPart || "root"}`;
}

async function authedFetch(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Nicht eingeloggt. Bitte als Admin anmelden.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAtMs = Date.now();
  const method = String(init.method ?? "GET").toUpperCase();
  const shouldTrack = shouldTrackClientAction(path, method);

  const requestWithToken = (accessToken: string) =>
    fetch(`${BACKEND_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    });

  try {
    let telemetryToken = token;
    let res = await requestWithToken(token);
    let data = await res.json().catch(() => ({}));
    let refreshedAfter401 = false;

    if (res.status === 401) {
      const refreshed = await refreshAuthSession();
      if (refreshed) {
        telemetryToken = refreshed.session.accessToken;
        res = await requestWithToken(refreshed.session.accessToken);
        data = await res.json().catch(() => ({}));
        refreshedAfter401 = true;
      }
    }

    if (!res.ok) {
      if (shouldTrack) {
        emitClientTelemetry({
          backendUrl: BACKEND_URL,
          accessToken: telemetryToken,
          event: {
            event: `${buildClientActionName(path, method)}_failed`,
            action: `${method} ${path}`,
            result: "failure",
            statusCode: res.status,
            durationMs: Date.now() - startedAtMs,
            details: {
              path,
              method,
              retriedAfter401: refreshedAfter401,
              errorCode: typeof data?.code === "string" ? data.code : null,
            },
          },
        });
      }
      const msg = typeof data?.error === "string" ? data.error : "Backend request failed.";
      const code = typeof data?.code === "string" ? data.code : null;
      throw new BackendApiError(msg, res.status, code, data);
    }

    if (shouldTrack) {
      emitClientTelemetry({
        backendUrl: BACKEND_URL,
        accessToken: telemetryToken,
        event: {
          event: `${buildClientActionName(path, method)}_success`,
          action: `${method} ${path}`,
          result: "success",
          statusCode: res.status,
          durationMs: Date.now() - startedAtMs,
          details: {
            path,
            method,
            retriedAfter401: refreshedAfter401,
          },
        },
      });
    }

    return data;
  } catch (error) {
    if (shouldTrack && !(error instanceof BackendApiError)) {
      emitClientTelemetry({
        backendUrl: BACKEND_URL,
        accessToken: token,
        event: {
          event: `${buildClientActionName(path, method)}_failed`,
          action: `${method} ${path}`,
          result: "failure",
          durationMs: Date.now() - startedAtMs,
          details: {
            path,
            method,
            errorName: error instanceof Error ? error.name : typeof error,
          },
        },
      });
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Die Anfrage hat zu lange gedauert. Bitte erneut versuchen.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type CampaignOverlapErrorPayload = {
  code?: string;
  conflicts?: CampaignMarketOverlapConflict[];
};

type PraemienWaveStatus = "draft" | "active" | "archived";

type BackendPraemienThreshold = {
  id: string;
  label: string;
  minPoints: number;
  rewardEur: number;
};

type BackendPraemienSourceRef = {
  id: string;
  sectionType: PraemienSourceRef["sectionType"];
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
  distributionFreqRule?: "lt8" | "gt8";
};

type BackendPraemienPillar = {
  id: string;
  name: string;
  description: string;
  color: string;
  sourceRefs: BackendPraemienSourceRef[];
};

type BackendPraemienQualitySubmission = {
  gmId: string;
  gmName: string;
  scores: {
    zeiterfassung: number;
    reporting: number;
    accuracy: number;
  };
  totalPoints: number;
  note?: string;
  updatedAt: string;
};

type BackendPraemienWave = {
  id: string;
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: PraemienWaveStatus;
  startDate: string;
  endDate: string;
  description: string;
  timezone: string;
  thresholds: BackendPraemienThreshold[];
  pillars: BackendPraemienPillar[];
  qualitySubmissions: BackendPraemienQualitySubmission[];
  createdAt: string;
  updatedAt: string;
};

type BackendPraemienWaveListRow = {
  id: string;
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: PraemienWaveStatus;
  startDate: string;
  endDate: string;
  description: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

type BackendPraemienSourceCatalogRow = {
  key: string;
  sectionType: PraemienSourceRef["sectionType"];
  fragebogenId: string | null;
  fragebogenName: string;
  moduleId: string | null;
  moduleName: string;
  questionId: string;
  questionText: string;
  scoringKey?: string;
  scoreKey?: string;
  boniValue: number;
  isFactorMode: boolean;
  displayLabel: string;
};

type PraemienWaveWriteMetadata = {
  name?: string;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  status?: PraemienWaveStatus;
  startDate?: string;
  endDate?: string;
  description?: string;
  timezone?: string;
  expectedUpdatedAt?: string;
};

type PraemienThresholdWrite = {
  id?: string;
  label: string;
  orderIndex: number;
  minPoints: number;
  rewardEur: number;
};

type PraemienPillarWrite = {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  orderIndex: number;
  isManual?: boolean;
};

type PraemienSourceWrite = {
  id?: string;
  pillarId: string;
  sectionType: PraemienSourceRef["sectionType"];
  fragebogenId?: string | null;
  fragebogenName?: string;
  moduleId?: string | null;
  moduleName?: string;
  questionId: string;
  questionText?: string;
  scoringKey?: string;
  scoreKey?: string;
  displayLabel?: string;
  isFactorMode?: boolean;
  boniValue: number;
  distributionFreqRule?: "lt8" | "gt8" | null;
};

type PraemienQualityWrite = {
  id?: string;
  gmUserId: string;
  zeiterfassung: number;
  reporting: number;
  accuracy: number;
  note?: string | null;
};

function buildPraemienSourceCatalogKey(input: {
  sectionType: PraemienSourceRef["sectionType"];
  fragebogenId: string | null;
  moduleId: string | null;
  questionId: string;
  scoringKey: string;
}): string {
  return [input.sectionType, input.fragebogenId ?? "", input.moduleId ?? "", input.questionId, input.scoringKey].join("__");
}

export function getCampaignOverlapConflicts(error: unknown): CampaignMarketOverlapConflict[] {
  if (!(error instanceof BackendApiError)) return [];
  if (error.code !== "campaign_market_overlap") return [];
  const payload = error.data as CampaignOverlapErrorPayload;
  return Array.isArray(payload?.conflicts) ? payload.conflicts : [];
}

function mapPraemienWaveToQuarter(wave: BackendPraemienWave): PraemienQuarter {
  return {
    id: wave.id,
    name: wave.name,
    year: wave.year,
    quarter: wave.quarter,
    status: wave.status,
    startDate: wave.startDate,
    endDate: wave.endDate,
    description: wave.description ?? "",
    timezone: wave.timezone,
    thresholds: (wave.thresholds ?? []).map((entry) => ({
      id: entry.id,
      label: entry.label,
      minPoints: Number(entry.minPoints ?? 0),
      rewardEur: Number(entry.rewardEur ?? 0),
    })),
    pillars: (wave.pillars ?? []).map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      description: pillar.description ?? "",
      color: pillar.color ?? "#DC2626",
      sourceRefs: (pillar.sourceRefs ?? []).map((source) => ({
        id: source.id,
        catalogKey: buildPraemienSourceCatalogKey({
          sectionType: source.sectionType,
          fragebogenId: source.fragebogenId ?? null,
          moduleId: source.moduleId ?? null,
          questionId: source.questionId,
          scoringKey: source.scoringKey,
        }),
        sectionType: source.sectionType,
        fragebogenId: source.fragebogenId ?? "",
        fragebogenName: source.fragebogenName ?? "",
        moduleId: source.moduleId ?? "",
        moduleName: source.moduleName ?? "",
        questionId: source.questionId,
        questionText: source.questionText ?? "",
        scoringKey: source.scoringKey,
        boniValue: Number(source.boniValue ?? 0),
        isFactorMode: Boolean(source.isFactorMode),
        displayLabel: source.displayLabel ?? "",
        distributionFreqRule: source.distributionFreqRule,
      })),
    })),
    qualitySubmissions: (wave.qualitySubmissions ?? []).map((entry) => ({
      gmId: entry.gmId,
      gmName: entry.gmName ?? "",
      scores: {
        zeiterfassung: Number(entry.scores?.zeiterfassung ?? 0),
        reporting: Number(entry.scores?.reporting ?? 0),
        accuracy: Number(entry.scores?.accuracy ?? 0),
      },
      totalPoints: Number(entry.totalPoints ?? 0),
      note: entry.note ?? undefined,
      updatedAt: entry.updatedAt,
    })),
    createdAt: wave.createdAt,
    updatedAt: wave.updatedAt,
  };
}

export async function fetchAdminPraemienWaves(input?: {
  year?: number;
  status?: PraemienWaveStatus;
  limit?: number;
  offset?: number;
}): Promise<{
  waves: BackendPraemienWaveListRow[];
  limit: number;
  offset: number;
  total: number;
}> {
  const params = new URLSearchParams();
  if (input?.year != null) params.set("year", String(input.year));
  if (input?.status) params.set("status", input.status);
  if (input?.limit != null) params.set("limit", String(input.limit));
  if (input?.offset != null) params.set("offset", String(input.offset));
  const query = params.toString();
  return (await authedFetch(`/admin/praemien/waves${query ? `?${query}` : ""}`)) as {
    waves: BackendPraemienWaveListRow[];
    limit: number;
    offset: number;
    total: number;
  };
}

export async function fetchAdminPraemienWave(waveId: string): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}`)) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function createAdminPraemienWave(input: {
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status?: PraemienWaveStatus;
  startDate: string;
  endDate: string;
  description?: string;
  timezone?: string;
  thresholds?: PraemienThresholdWrite[];
  pillars?: PraemienPillarWrite[];
}): Promise<PraemienQuarter> {
  const data = (await authedFetch("/admin/praemien/waves", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function patchAdminPraemienWave(waveId: string, input: PraemienWaveWriteMetadata): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function replaceAdminPraemienThresholds(
  waveId: string,
  input: { thresholds: PraemienThresholdWrite[]; expectedUpdatedAt?: string },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/thresholds`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function replaceAdminPraemienPillars(
  waveId: string,
  input: { pillars: PraemienPillarWrite[]; expectedUpdatedAt?: string },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/pillars`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function replaceAdminPraemienSources(
  waveId: string,
  input: { sources: PraemienSourceWrite[]; expectedUpdatedAt?: string },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/sources`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function replaceAdminPraemienQualityScores(
  waveId: string,
  input: { qualityScores: PraemienQualityWrite[]; expectedUpdatedAt?: string },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/quality-scores`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function fetchAdminPraemienSources(): Promise<Array<BackendPraemienSourceCatalogRow & { scoringKey: string }>> {
  const data = (await authedFetch("/admin/praemien/sources")) as { sources?: BackendPraemienSourceCatalogRow[] };
  return (data.sources ?? []).map((row) => ({
    ...row,
    scoringKey: row.scoringKey ?? row.scoreKey ?? "",
  }));
}

export async function deleteAdminPraemienWave(waveId: string): Promise<{ ok: boolean; waveId: string }> {
  return (await authedFetch(`/admin/praemien/waves/${waveId}/delete`, {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { ok: boolean; waveId: string };
}

export async function fetchGmBonusSummary(): Promise<PraemienGmBonusSummary> {
  const data = (await authedFetch("/markets/gm/bonus-summary")) as Partial<PraemienGmBonusSummary>;
  return {
    hasActiveWave: Boolean(data.hasActiveWave),
    waveId: data.waveId ?? null,
    waveName: data.waveName ?? null,
    year: typeof data.year === "number" ? data.year : null,
    quarter: typeof data.quarter === "number" ? data.quarter : null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    totalPoints: Number(data.totalPoints ?? 0),
    totalMaxPoints: Number(data.totalMaxPoints ?? 0),
    currentRewardEur: Number(data.currentRewardEur ?? 0),
    fullRewardEur: Number(data.fullRewardEur ?? 0),
    goals: Array.isArray(data.goals)
      ? data.goals.map((goal) => ({
          pillarId: String(goal.pillarId ?? ""),
          name: String(goal.name ?? ""),
          color: String(goal.color ?? "#DC2626"),
          points: Number(goal.points ?? 0),
          maxPoints: Number(goal.maxPoints ?? 0),
          percent: Number(goal.percent ?? 0),
        }))
      : [],
    thresholds: Array.isArray(data.thresholds)
      ? data.thresholds.map((entry) => ({
          label: String(entry.label ?? ""),
          minPoints: Number(entry.minPoints ?? 0),
          rewardEur: Number(entry.rewardEur ?? 0),
        }))
      : [],
  };
}

export type GmKpiSummary = {
  ippAllTimeAvg: number;
  ippSampleCount: number;
  bonusCumulativeEur: number;
  lastComputedAt: string;
};

const GM_KPI_SUMMARY_CACHE_KEY = "gm_kpi_summary_v1";

export function readCachedGmKpiSummary(): GmKpiSummary | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(GM_KPI_SUMMARY_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GmKpiSummary>;
    if (!parsed) return null;
    const lastComputedAt = typeof parsed.lastComputedAt === "string" ? parsed.lastComputedAt : "";
    if (!lastComputedAt) return null;
    return {
      ippAllTimeAvg: Number(parsed.ippAllTimeAvg ?? 0),
      ippSampleCount: Number(parsed.ippSampleCount ?? 0),
      bonusCumulativeEur: Number(parsed.bonusCumulativeEur ?? 0),
      lastComputedAt,
    };
  } catch {
    return null;
  }
}

export function writeCachedGmKpiSummary(summary: GmKpiSummary): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GM_KPI_SUMMARY_CACHE_KEY, JSON.stringify(summary));
  } catch {
    // noop
  }
}

export async function fetchGmKpiSummary(): Promise<GmKpiSummary> {
  const data = (await authedFetch("/markets/gm/kpi-summary")) as Partial<GmKpiSummary>;
  const normalized: GmKpiSummary = {
    ippAllTimeAvg: Number(data.ippAllTimeAvg ?? 0),
    ippSampleCount: Number(data.ippSampleCount ?? 0),
    bonusCumulativeEur: Number(data.bonusCumulativeEur ?? 0),
    lastComputedAt: typeof data.lastComputedAt === "string" && data.lastComputedAt.length > 0
      ? data.lastComputedAt
      : new Date(0).toISOString(),
  };
  writeCachedGmKpiSummary(normalized);
  return normalized;
}

async function refreshAuthSession(): Promise<AuthSessionPayload | null> {
  const currentSession = readAuthSessionWithTarget();
  if (!currentSession?.payload.session.refreshToken) {
    clearAuthSession();
    return null;
  }

  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: currentSession.payload.session.refreshToken }),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AuthSessionPayload>;
  if (!res.ok || !data.user || !data.session) {
    clearAuthSession();
    return null;
  }

  const refreshed = data as AuthSessionPayload;
  saveAuthSession(refreshed, { remember: currentSession.target === "local" });
  return refreshed;
}

export async function fetchGmUsers(): Promise<GMRecord[]> {
  const data = (await authedFetch("/admin/users?role=gm")) as { users?: BackendUser[] };
  const users = data.users ?? [];
  return users.map((u) => mapBackendUserToGmRecord(u));
}

export async function createGmUser(
  payload: Omit<GMRecord, "id" | "createdAt" | "password" | "ipp"> & { ipp?: number },
): Promise<GMRecord> {
  const data = (await authedFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      role: "gm",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      city: payload.city,
      postalCode: payload.postalCode,
      region: payload.region,
      ipp: payload.ipp,
    }),
  })) as { user: BackendUser; oneTimePassword?: string };
  return mapBackendUserToGmRecord(data.user, data.oneTimePassword);
}

export async function updateGmUser(payload: GMRecord): Promise<GMRecord> {
  const data = (await authedFetch(`/admin/users/${payload.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      city: payload.city,
      postalCode: payload.postalCode,
      region: payload.region,
      ipp: payload.ipp,
    }),
  })) as { user: BackendUser };
  return mapBackendUserToGmRecord(data.user);
}

export async function fetchAdminLager(): Promise<LagerRecord[]> {
  const data = (await authedFetch("/admin/lager")) as { lagers?: BackendLager[] };
  return (data.lagers ?? []).map((entry) => mapBackendLagerToLagerRecord(entry));
}

export async function createAdminLager(input: CreateLagerInput): Promise<LagerRecord> {
  const data = (await authedFetch("/admin/lager", {
    method: "POST",
    body: JSON.stringify({
      address: input.address,
      postalCode: input.postalCode,
      city: input.city,
      gmUserId: input.gmUserId ?? null,
    }),
  })) as { lager: BackendLager };
  return mapBackendLagerToLagerRecord(data.lager);
}

type ImportMarketsInput = {
  importType: "universum" | "kuehler";
  fileName: string;
  sheetName: string;
  rows: string[][];
  mapping: ColumnMapping;
};

export type NormalizeMarketRegionsResult = {
  ok: boolean;
  processedCount: number;
  updatedCount: number;
  unchangedCount: number;
  unmatchedCount: number;
  unmatched: Array<{
    marketId: string;
    marketName: string;
    region: string;
    normalizedToken: string;
  }>;
  allowedRegions: string[];
};

export async function fetchMarkets(): Promise<MarketRecord[]> {
  const data = (await authedFetch("/markets")) as { markets?: BackendMarket[] };
  return (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market));
}

export async function fetchGmAssignedActiveCampaignMarkets(): Promise<MarketRecord[]> {
  const data = (await authedFetch("/markets/gm/assigned-active")) as { markets?: BackendMarket[] };
  return (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market));
}

export type GmStartMarket = {
  market: MarketRecord;
  activeNowCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    section: "standard" | "flex" | "kuehler" | "mhd" | "billa";
  }>;
};

export type GmKuehlerMhdProgressMarket = {
  marketId: string;
  campaignId: string;
  campaignName: string;
  chain: string;
  address: string;
  done: boolean;
  doneAt: string | null;
};

export type GmKuehlerMhdProgressSection = {
  current: number;
  total: number;
  percent: number;
  startDate: string;
  endDate: string;
  markets: GmKuehlerMhdProgressMarket[];
};

export type GmKuehlerMhdProgressPayload = {
  kuehler: GmKuehlerMhdProgressSection;
  mhd: GmKuehlerMhdProgressSection;
  generatedAt: string;
  timezone: string;
  periodFallback: {
    startDate: string;
    endDate: string;
  };
};

export async function fetchGmAssignedStartMarkets(): Promise<GmStartMarket[]> {
  const data = (await authedFetch("/markets/gm/assigned-active")) as { markets?: BackendMarket[] };
  return (data.markets ?? []).map((market) => ({
    market: mapBackendMarketToMarketRecord(market),
    activeNowCampaigns: market.activeNowCampaigns ?? [],
  }));
}

export async function fetchGmKuehlerMhdProgress(): Promise<GmKuehlerMhdProgressPayload> {
  return (await authedFetch("/markets/gm/kuehler-mhd-progress")) as GmKuehlerMhdProgressPayload;
}

export type GmVisitStartSection = {
  section: "standard" | "flex" | "billa" | "kuehler" | "mhd";
  campaignId: string;
  campaignName: string;
  fragebogenId: string;
  fragebogenName: string;
  questions: Array<{
    id: string;
    questionId?: string;
    type: "single" | "yesno" | "yesnomulti" | "multiple" | "likert" | "text" | "numeric" | "slider" | "photo" | "matrix";
    text: string;
    required: boolean;
    config: Record<string, unknown>;
    rules: Array<{
      id?: string;
      triggerQuestionId: string;
      operator: string;
      triggerValue: string;
      triggerValueMax: string;
      action: "hide" | "show";
      targetQuestionIds: string[];
    }>;
    scoring: Record<string, { ipp?: number; boni?: number }>;
    chains?: string[];
    appliesToMarketChain?: boolean;
    options?: string[];
    moduleId: string;
    moduleName: string;
  }>;
};

export type GmVisitStartPayload = {
  market: {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  };
  sections: GmVisitStartSection[];
};

export type GmVisitSessionReadPayload = {
  session: {
    id: string;
    status: "draft" | "submitted" | "cancelled";
    startedAt: string;
    submittedAt: string | null;
  };
  market: {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  };
  sections: Array<{
    id: string;
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd";
    campaignId: string;
    campaignName: string;
    fragebogenId: string | null;
    fragebogenName: string;
    orderIndex: number;
    questions: Array<{
      id: string;
      questionId?: string;
      type: "single" | "yesno" | "yesnomulti" | "multiple" | "likert" | "text" | "numeric" | "slider" | "photo" | "matrix";
      text: string;
      required: boolean;
      config: Record<string, unknown>;
      rules: Array<Record<string, unknown>>;
      chains?: string[];
      appliesToMarketChain?: boolean;
      answer: {
        id: string;
        answerStatus: "unanswered" | "answered" | "invalid";
        valueText: string | null;
        valueNumber: string | null;
        valueJson: Record<string, unknown> | null;
        isValid: boolean;
        validationError: string | null;
        version: number;
        options: Array<{ optionRole: "top" | "sub"; optionValue: string; orderIndex: number }>;
        matrixCells: Array<{
          rowKey: string;
          columnKey: string;
          cellValueText: string | null;
          cellValueDate: string | null;
          cellSelected: boolean | null;
          orderIndex: number;
        }>;
        photos: Array<{
          id: string;
          storageBucket: string;
          storagePath: string;
          mimeType: string | null;
          byteSize: number | null;
          widthPx: number | null;
          heightPx: number | null;
          sha256: string | null;
          tags: Array<{
            id: string;
            photoTagId: string | null;
            photoTagLabelSnapshot: string;
          }>;
        }>;
      } | null;
      comment: string;
    }>;
  }>;
};

export type CampaignMarketVisitSummary = BackendCampaignMarketVisitSummary;
export type AdminIppListRow = Omit<BackendIppListRow, "marketIpp"> & { marketIpp: number };
export type AdminIppDetailRecord = Omit<BackendIppDetailRecord, "marketIpp"> & { marketIpp: number };
export type TimeTrackingActivityType =
  | "sonderaufgabe"
  | "arztbesuch"
  | "werkstatt"
  | "homeoffice"
  | "schulung"
  | "lager"
  | "heimfahrt"
  | "hotel"
  | "hoteluebernachtung";

export type TimeTrackingEntry = {
  id: string;
  gmUserId: string;
  marketId: string | null;
  activityType: string;
  clientEntryToken: string | null;
  startAt: string | null;
  endAt: string | null;
  comment: string | null;
  status: "draft" | "submitted" | "cancelled";
  submittedAt: string | null;
  cancelledAt: string | null;
  durationMin: number | null;
};

export type DaySessionStatus = "draft" | "started" | "ended" | "submitted" | "cancelled";

export type DaySession = {
  id: string;
  gmUserId: string;
  workDate: string;
  timezone: string;
  status: DaySessionStatus;
  dayStartedAt: string | null;
  dayEndedAt: string | null;
  startKm: number | null;
  endKm: number | null;
  startKmDeferred: boolean;
  endKmDeferred: boolean;
  isStartKmCompleted: boolean;
  isEndKmCompleted: boolean;
  comment: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
};

export type DaySessionCurrentPayload = {
  session: DaySession | null;
  gate: {
    dayStarted: boolean;
    startKmPending: boolean;
    endKmPending: boolean;
    pauseOpen: boolean;
  };
};

export type DayPause = {
  id: string;
  daySessionId: string;
  gmUserId: string;
  pauseStartedAt: string;
  pauseEndedAt: string | null;
};

export type TodaySubmissionKind = "day" | "markt" | "zusatz" | "pause";

export type TodaySubmissionItem = {
  id: string;
  kind: TodaySubmissionKind;
  submittedAt: string;
  label: string;
  timeText: string;
};

export type AdminZeiterfassungSessionEntry = {
  id: string;
  kind: "marktbesuch" | "pause" | "zusatzzeit";
  startTime: string;
  endTime: string;
  durationMin: number;
  marketName?: string;
  marketAddress?: string;
  subtype?: string;
  questionnaireType?: string;
  questionnaireTypes?: string[];
};

export type AdminZeiterfassungTimelineSegment = {
  kind: "anfahrt" | "fahrtzeit" | "marktbesuch" | "pause" | "zusatzzeit" | "heimfahrt";
  start: string;
  end: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  subtype?: string;
  questionnaireType?: string;
};

export type AdminZeiterfassungSession = {
  id: string;
  date: string;
  gmId: string;
  gmName: string;
  region: string;
  status: "started" | "ended" | "submitted";
  isLive: boolean;
  timezone: string;
  startTime: string;
  endTime: string;
  startKm: number | null;
  endKm: number | null;
  entries: AdminZeiterfassungSessionEntry[];
  timeline: AdminZeiterfassungTimelineSegment[];
  stats: {
    arbeitstag: number;
    pauseMin: number;
    reineArbeitszeit: number;
    kmGefahren: number | null;
    marktbesuche: number;
    zusatz: number;
  };
  hasCompleteKm: boolean;
};

export type AdminZeiterfassungAggregateRow = {
  gmId: string;
  gmName: string;
  region: string;
  currentKwNumber: number;
  currentKwReineArbeitszeitMin: number;
  totalReineArbeitszeitMin: number;
  averageWorkdayMin: number;
  totalKmDriven: number;
  privatnutzungKm: number;
  trackedDays: number;
  liveSessionCount: number;
  visibleSessionCount: number;
};

export async function fetchGmVisitStartPayload(marketId: string, campaignIds: string[]): Promise<GmVisitStartPayload> {
  const params = new URLSearchParams({
    marketId,
    campaignIds: campaignIds.join(","),
  });
  return (await authedFetch(`/markets/gm/visit-start?${params.toString()}`)) as GmVisitStartPayload;
}

export type GmVisitSessionPayload = GmVisitStartPayload & {
  session: {
    id: string;
    status: "draft" | "submitted" | "cancelled";
    startedAt: string;
  };
};

export type GmVisitPreloadCachePayload = GmVisitSessionReadPayload;

const GM_VISIT_PRELOAD_CACHE_PREFIX = "gm_visit_preload_v1:";
const GM_VISIT_PRELOAD_CACHE_TTL_MS = 10 * 60 * 1000;

type GmVisitPreloadCacheEnvelope = {
  sessionId: string;
  createdAtMs: number;
  payload: GmVisitPreloadCachePayload;
};

const gmVisitPreloadMemoryCache: Record<string, GmVisitPreloadCacheEnvelope> = {};

export function getGmVisitPreloadCacheKey(sessionId: string): string {
  return `${GM_VISIT_PRELOAD_CACHE_PREFIX}${sessionId}`;
}

export function setGmVisitPreloadCache(payload: GmVisitPreloadCachePayload): void {
  const sessionId = payload?.session?.id;
  if (!sessionId) return;
  const envelope: GmVisitPreloadCacheEnvelope = {
    sessionId,
    createdAtMs: Date.now(),
    payload,
  };
  gmVisitPreloadMemoryCache[sessionId] = envelope;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getGmVisitPreloadCacheKey(sessionId), JSON.stringify(envelope));
  } catch {
    // Keep in-memory cache as best-effort fallback.
  }
}

export function readGmVisitPreloadCache(sessionId: string): GmVisitPreloadCachePayload | null {
  const inMemory = gmVisitPreloadMemoryCache[sessionId];
  if (inMemory) {
    if (Date.now() - inMemory.createdAtMs <= GM_VISIT_PRELOAD_CACHE_TTL_MS && Array.isArray(inMemory.payload.sections) && inMemory.payload.session?.id === sessionId) {
      return inMemory.payload;
    }
    delete gmVisitPreloadMemoryCache[sessionId];
  }
  if (typeof window === "undefined") return null;
  const key = getGmVisitPreloadCacheKey(sessionId);
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GmVisitPreloadCacheEnvelope>;
    if (!parsed || parsed.sessionId !== sessionId) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const createdAtMs = Number(parsed.createdAtMs ?? 0);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > GM_VISIT_PRELOAD_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const payload = parsed.payload;
    if (!payload || payload.session?.id !== sessionId || !Array.isArray(payload.sections)) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function clearGmVisitPreloadCache(sessionId: string): void {
  delete gmVisitPreloadMemoryCache[sessionId];
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getGmVisitPreloadCacheKey(sessionId));
  } catch {
    // noop
  }
}

export async function fetchGmVisitSession(sessionId: string): Promise<GmVisitSessionReadPayload> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}`)) as GmVisitSessionReadPayload;
}

export async function createGmVisitSession(input: {
  marketId: string;
  campaignIds: string[];
  clientSessionToken?: string;
}): Promise<GmVisitSessionPayload> {
  return (await authedFetch("/markets/gm/visit-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  })) as GmVisitSessionPayload;
}

export async function saveGmVisitAnswer(input: {
  sessionId: string;
  visitQuestionId: string;
  answer?: unknown;
  comment?: string;
}): Promise<{ ok: boolean; result: { answerId: string; answerStatus: string; isValid: boolean; validationError: string | null } }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/answers`, {
    method: "PATCH",
    body: JSON.stringify({
      visitQuestionId: input.visitQuestionId,
      answer: input.answer,
      comment: input.comment,
    }),
  })) as { ok: boolean; result: { answerId: string; answerStatus: string; isValid: boolean; validationError: string | null } };
}

export async function submitGmVisitSession(sessionId: string): Promise<{ ok: boolean; sessionId: string; status: "submitted" }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  })) as { ok: boolean; sessionId: string; status: "submitted" };
}

export async function presignGmVisitPhoto(input: {
  sessionId: string;
  visitAnswerId: string;
  extension?: string;
}): Promise<{ upload: { bucket: string; path: string; signedUrl: string; token: string } }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/photos/presign`, {
    method: "POST",
    body: JSON.stringify({
      visitAnswerId: input.visitAnswerId,
      extension: input.extension,
    }),
  })) as { upload: { bucket: string; path: string; signedUrl: string; token: string } };
}

export async function commitGmVisitPhotos(input: {
  sessionId: string;
  visitAnswerId: string;
  photos: Array<{
    storageBucket: string;
    storagePath: string;
    mimeType?: string;
    byteSize?: number;
    widthPx?: number;
    heightPx?: number;
    sha256?: string;
    photoTagIds?: string[];
  }>;
}): Promise<{ ok: boolean }> {
  const { sessionId, visitAnswerId, photos } = input;
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/photos/commit`, {
    method: "POST",
    body: JSON.stringify({ visitAnswerId, photos }),
  })) as { ok: boolean };
}

export async function importMarkets(input: ImportMarketsInput): Promise<{ markets: MarketRecord[]; summary: ImportSummary }> {
  const data = (await authedFetch("/admin/markets/import", {
    method: "POST",
    body: JSON.stringify(input),
  }, 300000)) as { markets?: BackendMarket[]; summary: ImportSummary };

  return {
    markets: (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market)),
    summary: data.summary,
  };
}

export async function normalizeAllMarketRegions(input?: {
  batchSize?: number;
  reportLimit?: number;
}): Promise<NormalizeMarketRegionsResult> {
  return (await authedFetch("/admin/markets/normalize-regions", {
    method: "POST",
    body: JSON.stringify({
      batchSize: input?.batchSize,
      reportLimit: input?.reportLimit,
    }),
  }, 300000)) as NormalizeMarketRegionsResult;
}

export async function createMarket(payload: MarketRecord): Promise<MarketRecord> {
  const data = (await authedFetch("/admin/markets", {
    method: "POST",
    body: JSON.stringify({
      standardMarketNumber: payload.standardMarketNumber,
      cokeMasterNumber: payload.cokeMasterNumber,
      flexNumber: payload.flexNumber,
      name: payload.name,
      dbName: payload.dbName,
      address: payload.address,
      postalCode: payload.postalCode,
      city: payload.city,
      region: payload.region,
      emEh: payload.emEh,
      employee: payload.employee,
      currentGmName: payload.currentGmName,
      visitFrequencyPerYear: payload.visitFrequencyPerYear,
      infoFlag: payload.infoFlag,
      infoNote: payload.infoNote,
      universeMarket: payload.universeMarket,
      marketType: payload.marketType,
      kuehlerStammnr: payload.kuehlerStammnr,
      isActive: payload.isActive,
      importSourceFileName: payload.importSourceFileName,
      importedAt: payload.importedAt,
      plannedToId: payload.plannedToId ?? null,
    }),
  })) as { market: BackendMarket };

  return mapBackendMarketToMarketRecord(data.market);
}

export async function updateMarket(payload: MarketRecord): Promise<MarketRecord> {
  const data = (await authedFetch(`/admin/markets/${payload.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      standardMarketNumber: payload.standardMarketNumber,
      cokeMasterNumber: payload.cokeMasterNumber,
      flexNumber: payload.flexNumber,
      name: payload.name,
      dbName: payload.dbName,
      address: payload.address,
      postalCode: payload.postalCode,
      city: payload.city,
      region: payload.region,
      emEh: payload.emEh,
      employee: payload.employee,
      currentGmName: payload.currentGmName,
      visitFrequencyPerYear: payload.visitFrequencyPerYear,
      infoFlag: payload.infoFlag,
      infoNote: payload.infoNote,
      universeMarket: payload.universeMarket,
      marketType: payload.marketType,
      kuehlerStammnr: payload.kuehlerStammnr,
      isActive: payload.isActive,
      importSourceFileName: payload.importSourceFileName,
      importedAt: payload.importedAt,
      plannedToId: payload.plannedToId ?? null,
    }),
  })) as { market: BackendMarket };

  return mapBackendMarketToMarketRecord(data.market);
}

export async function softDeleteMarket(marketId: string): Promise<void> {
  await authedFetch(`/admin/markets/${marketId}/delete`, { method: "PATCH" });
}

export async function hardDeleteMarket(marketId: string): Promise<void> {
  await authedFetch(`/admin/markets/${marketId}/hard-delete`, { method: "DELETE" });
}

export async function fetchMarketKuehlerUnits(marketId: string): Promise<KuehlerUnitRecord[]> {
  const data = (await authedFetch(`/admin/markets/${marketId}/kuehler-units`)) as {
    units?: BackendKuehlerUnit[];
  };
  return (data.units ?? []).map((unit) => mapBackendKuehlerUnitToRecord(unit));
}

export type WriteKuehlerUnitInput = {
  marketId: string;
  name?: string;
  employee?: string;
  kuehlerInternalId?: string | null;
  kuehlerBd?: string | null;
  kuehlerAnzahlKsAmStandort?: number | null;
  kuehlerSerialNumber?: string | null;
  kuehlerModel?: string | null;
  importSourceFileName?: string;
  importedAt?: string;
};

export async function createMarketKuehlerUnit(input: WriteKuehlerUnitInput): Promise<KuehlerUnitRecord> {
  const data = (await authedFetch(`/admin/markets/${input.marketId}/kuehler-units`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name ?? "",
      employee: input.employee ?? "",
      kuehlerInternalId: input.kuehlerInternalId ?? undefined,
      kuehlerBd: input.kuehlerBd ?? undefined,
      kuehlerAnzahlKsAmStandort: input.kuehlerAnzahlKsAmStandort ?? undefined,
      kuehlerSerialNumber: input.kuehlerSerialNumber ?? undefined,
      kuehlerModel: input.kuehlerModel ?? undefined,
      importSourceFileName: input.importSourceFileName ?? "",
      importedAt: input.importedAt,
    }),
  })) as { unit: BackendKuehlerUnit };
  return mapBackendKuehlerUnitToRecord(data.unit);
}

export async function updateMarketKuehlerUnit(
  input: WriteKuehlerUnitInput & { unitId: string; isDeleted?: boolean },
): Promise<KuehlerUnitRecord> {
  const data = (await authedFetch(`/admin/markets/${input.marketId}/kuehler-units/${input.unitId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name,
      employee: input.employee,
      kuehlerInternalId: input.kuehlerInternalId ?? undefined,
      kuehlerBd: input.kuehlerBd ?? undefined,
      kuehlerAnzahlKsAmStandort: input.kuehlerAnzahlKsAmStandort ?? undefined,
      kuehlerSerialNumber: input.kuehlerSerialNumber ?? undefined,
      kuehlerModel: input.kuehlerModel ?? undefined,
      importSourceFileName: input.importSourceFileName,
      importedAt: input.importedAt,
      isDeleted: input.isDeleted,
    }),
  })) as { unit: BackendKuehlerUnit };
  return mapBackendKuehlerUnitToRecord(data.unit);
}

function normalizeQuestion(input: Question): Question {
  return {
    ...input,
    rules: input.rules ?? [],
    scoring: input.scoring ?? {},
    config: input.config ?? {},
  };
}

function normalizeModule(input: Module): Module {
  return {
    ...input,
    description: input.description ?? "",
    questions: (input.questions ?? []).map(normalizeQuestion),
    createdAt: input.createdAt ?? new Date().toISOString(),
    usedInCount: input.usedInCount ?? 0,
  };
}

function normalizeFragebogen(input: Fragebogen): Fragebogen {
  return {
    ...input,
    description: input.description ?? "",
    moduleIds: input.moduleIds ?? [],
    markets: input.markets ?? [],
    scheduleType: input.scheduleType ?? "always",
    sectionKeywords: input.sectionKeywords ? Array.from(new Set(input.sectionKeywords)) : undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: input.status ?? "inactive",
    spezialfragen: (input.spezialfragen ?? []).map(normalizeQuestion),
    nurEinmalAusfuellbar: input.nurEinmalAusfuellbar ?? false,
  };
}

type FragebogenWritePayload = {
  id?: string;
  name: string;
  description: string;
  moduleIds: string[];
  scheduleType: "always" | "scheduled";
  startDate?: string;
  endDate?: string;
  status: "active" | "scheduled" | "inactive";
  sectionKeywords?: Array<"standard" | "flex" | "billa">;
  nurEinmalAusfuellbar?: boolean;
  spezialfragen?: Question[];
  createdAt?: string;
};

const fragebogenModuleIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toFragebogenWritePayload(
  fragebogen: Fragebogen & { sectionKeywords?: Array<"standard" | "flex" | "billa"> },
): FragebogenWritePayload {
  const moduleIds = Array.from(new Set(fragebogen.moduleIds ?? []));
  const invalidModuleIds = moduleIds.filter((id) => !fragebogenModuleIdRegex.test(id));
  if (invalidModuleIds.length > 0) {
    throw new Error("Fragebogen konnte nicht gespeichert werden: Mindestens ein Modul ist noch nicht persistiert.");
  }

  return {
    id: fragebogen.id,
    name: fragebogen.name,
    description: fragebogen.description ?? "",
    moduleIds,
    scheduleType: fragebogen.scheduleType ?? "always",
    startDate: fragebogen.startDate,
    endDate: fragebogen.endDate,
    status: fragebogen.status ?? "inactive",
    sectionKeywords: fragebogen.sectionKeywords,
    nurEinmalAusfuellbar: fragebogen.nurEinmalAusfuellbar ?? false,
    spezialfragen: fragebogen.spezialfragen ?? [],
    createdAt: fragebogen.createdAt,
  };
}

function normalizeCampaign(input: BackendCampaign): Campaign {
  return {
    id: input.id,
    name: input.name,
    section: input.section,
    currentFragebogenId: input.currentFragebogenId ?? null,
    currentFragebogenName: input.currentFragebogenName ?? null,
    status: input.status,
    scheduleType: input.scheduleType,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    marketIds: Array.from(new Set(input.marketIds ?? [])),
    assignments: (input.assignments ?? []).map((assignment) => ({
      marketId: assignment.marketId,
      gmUserId: assignment.gmUserId ?? null,
      gmName: assignment.gmName ?? null,
      assignmentSlot: assignment.assignmentSlot ?? 1,
      visitTargetCount: assignment.visitTargetCount ?? 1,
      currentVisitsCount: assignment.currentVisitsCount ?? 0,
    })),
    history: (input.history ?? []).map((entry) => ({
      id: entry.id,
      fromFragebogenId: entry.fromFragebogenId ?? null,
      toFragebogenId: entry.toFragebogenId,
      changedAt: entry.changedAt,
    })),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export type FragebogenScope = "main" | "kuehler" | "mhd";

export async function fetchPhotoTags(): Promise<BackendPhotoTag[]> {
  const data = (await authedFetch("/admin/photo-tags")) as { tags?: BackendPhotoTag[] };
  return data.tags ?? [];
}

export async function fetchMarketChains(): Promise<string[]> {
  const data = (await authedFetch("/admin/markets/chains")) as { chains?: string[] };
  if (!Array.isArray(data.chains)) return [];
  return Array.from(
    new Set(
      data.chains
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

export async function createPhotoTag(label: string): Promise<BackendPhotoTag> {
  const data = (await authedFetch("/admin/photo-tags", {
    method: "POST",
    body: JSON.stringify({ label }),
  })) as { tag: BackendPhotoTag };
  return data.tag;
}

export async function updatePhotoTag(tagId: string, patch: { label?: string; deleted?: boolean }): Promise<BackendPhotoTag> {
  const data = (await authedFetch(`/admin/photo-tags/${tagId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })) as { tag: BackendPhotoTag };
  return data.tag;
}

export async function fetchModules(scope: FragebogenScope): Promise<Module[]> {
  const data = (await authedFetch(`/admin/modules/${scope}`)) as { modules?: Module[] };
  return (data.modules ?? []).map(normalizeModule);
}

export async function createModule(scope: FragebogenScope, module: Module & { sectionKeywords?: Array<"standard" | "flex" | "billa"> }): Promise<Module> {
  const data = (await authedFetch(`/admin/modules/${scope}`, {
    method: "POST",
    body: JSON.stringify(module),
  })) as { module: Module };
  return normalizeModule(data.module);
}

export async function updateModuleBackend(scope: FragebogenScope, module: Module & { sectionKeywords?: Array<"standard" | "flex" | "billa"> }): Promise<Module> {
  const data = (await authedFetch(`/admin/modules/${scope}/${module.id}`, {
    method: "PATCH",
    body: JSON.stringify(module),
  })) as { module: Module };
  return normalizeModule(data.module);
}

export async function deleteModuleBackend(scope: FragebogenScope, moduleId: string): Promise<void> {
  await authedFetch(`/admin/modules/${scope}/${moduleId}/delete`, { method: "PATCH" });
}

export async function duplicateModuleBackend(
  sourceScope: FragebogenScope,
  moduleId: string,
  targetScope: FragebogenScope,
  sectionKeywords?: Array<"standard" | "flex" | "billa">,
): Promise<Module> {
  const data = (await authedFetch(`/admin/modules/${sourceScope}/${moduleId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ targetScope, sectionKeywords }),
  })) as { module: Module };
  return normalizeModule(data.module);
}

export async function fetchFragebogen(scope: FragebogenScope): Promise<Fragebogen[]> {
  const data = (await authedFetch(`/admin/fragebogen/${scope}`)) as { fragebogen?: Fragebogen[] };
  return (data.fragebogen ?? []).map(normalizeFragebogen);
}

export async function createFragebogen(
  scope: FragebogenScope,
  fragebogen: Fragebogen & { sectionKeywords?: Array<"standard" | "flex" | "billa"> },
): Promise<Fragebogen> {
  const payload = toFragebogenWritePayload(fragebogen);
  const data = (await authedFetch(`/admin/fragebogen/${scope}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { fragebogen: Fragebogen };
  return normalizeFragebogen(data.fragebogen);
}

export async function updateFragebogenBackend(
  scope: FragebogenScope,
  fragebogen: Fragebogen & { sectionKeywords?: Array<"standard" | "flex" | "billa"> },
): Promise<Fragebogen> {
  const payload = toFragebogenWritePayload(fragebogen);
  const data = (await authedFetch(`/admin/fragebogen/${scope}/${fragebogen.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })) as { fragebogen: Fragebogen };
  return normalizeFragebogen(data.fragebogen);
}

export async function deleteFragebogenBackend(scope: FragebogenScope, fragebogenId: string): Promise<void> {
  await authedFetch(`/admin/fragebogen/${scope}/${fragebogenId}/delete`, { method: "PATCH" });
}

export async function duplicateFragebogenBackend(
  sourceScope: FragebogenScope,
  fragebogenId: string,
  targetScope: FragebogenScope,
  options?: {
    sectionKeywords?: Array<"standard" | "flex" | "billa">;
    duplicateModulesToTargetSection?: boolean;
  },
): Promise<Fragebogen> {
  const data = (await authedFetch(`/admin/fragebogen/${sourceScope}/${fragebogenId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({
      targetScope,
      sectionKeywords: options?.sectionKeywords,
      duplicateModulesToTargetSection: options?.duplicateModulesToTargetSection,
    }),
  })) as { fragebogen: Fragebogen };
  return normalizeFragebogen(data.fragebogen);
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const data = (await authedFetch("/admin/campaigns")) as { campaigns?: BackendCampaign[] };
  return (data.campaigns ?? []).map(normalizeCampaign);
}

export async function fetchCampaignMarketVisitSummaries(campaignId: string): Promise<CampaignMarketVisitSummary[]> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/market-visits`)) as {
    markets?: BackendCampaignMarketVisitSummary[];
  };
  return data.markets ?? [];
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const data = (await authedFetch("/admin/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function updateCampaign(campaignId: string, patch: UpdateCampaignInput): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await authedFetch(`/admin/campaigns/${campaignId}/delete`, { method: "PATCH" });
}

export async function assignCampaignMarkets(campaignId: string, marketIds: string[]): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/markets`, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function assignCampaignMarketAssignments(
  campaignId: string,
  assignments: CampaignMarketAssignmentInput[],
): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/markets`, {
    method: "POST",
    body: JSON.stringify({ assignments }),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function migrateCampaignMarkets(
  campaignId: string,
  moves: Array<{ marketId: string; fromCampaignId: string; gmUserId?: string | null; reason?: string }>,
): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/markets/migrate`, {
    method: "POST",
    body: JSON.stringify({ moves }),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function removeCampaignMarket(campaignId: string, marketId: string): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/markets/${marketId}/delete`, {
    method: "PATCH",
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function switchCampaignFragebogen(campaignId: string, toFragebogenId: string): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/fragebogen/switch`, {
    method: "POST",
    body: JSON.stringify({ toFragebogenId }),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function fetchAdminIppRows(): Promise<{
  rows: AdminIppListRow[];
  filters: {
    regions: string[];
    gms: string[];
    chains: string[];
    redMonats: string[];
  };
}> {
  const data = (await authedFetch("/admin/ipp")) as {
    rows?: BackendIppListRow[];
    filters?: {
      regions?: string[];
      gms?: string[];
      chains?: string[];
      redMonats?: string[];
    };
  };
  return {
    rows: (data.rows ?? []).map((row) => ({
      ...row,
      marketIpp: Number(row.marketIpp ?? 0),
    })),
    filters: {
      regions: data.filters?.regions ?? [],
      gms: data.filters?.gms ?? [],
      chains: data.filters?.chains ?? [],
      redMonats: data.filters?.redMonats ?? [],
    },
  };
}

export async function fetchAdminIppDetail(marketId: string, periodStart: string): Promise<AdminIppDetailRecord> {
  const params = new URLSearchParams({ periodStart });
  const data = (await authedFetch(`/admin/ipp/${marketId}/detail?${params.toString()}`)) as {
    record: BackendIppDetailRecord;
  };
  return {
    ...data.record,
    marketIpp: Number(data.record.marketIpp ?? 0),
  };
}

export async function fetchCurrentRedMonth(): Promise<RedMonthCurrentPayload> {
  const data = (await authedFetch("/red-month/current")) as {
    current: BackendRedMonthPeriod;
    config: BackendRedMonthConfig;
  };
  return {
    current: mapBackendRedMonthPeriod(data.current),
    config: mapBackendRedMonthConfig(data.config),
  };
}

export async function fetchRedMonthCalendar(input?: { from?: string; to?: string }): Promise<RedMonthPeriod[]> {
  const params = new URLSearchParams();
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  const query = params.toString();
  const data = (await authedFetch(`/red-month/calendar${query ? `?${query}` : ""}`)) as {
    periods?: BackendRedMonthPeriod[];
  };
  return (data.periods ?? []).map(mapBackendRedMonthPeriod);
}

export async function updateRedMonthConfig(input: {
  anchorStart: string;
  cycleWeeks: number[];
  timezone?: string;
}): Promise<RedMonthCurrentPayload> {
  const data = (await authedFetch("/admin/red-month/config", {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as {
    current: BackendRedMonthPeriod;
    config: BackendRedMonthConfig;
  };
  return {
    current: mapBackendRedMonthPeriod(data.current),
    config: mapBackendRedMonthConfig(data.config),
  };
}

export async function startTimeTrackingDraft(input: {
  activityType: TimeTrackingActivityType;
  startAt: string;
  marketId?: string | null;
  clientEntryToken?: string;
}): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch("/time-tracking/entries/draft/start", {
    method: "POST",
    body: JSON.stringify({
      activityType: input.activityType,
      startAt: input.startAt,
      marketId: input.marketId ?? null,
      clientEntryToken: input.clientEntryToken,
    }),
  })) as { entry: TimeTrackingEntry };
}

export async function endTimeTrackingDraft(entryId: string, input: {
  endAt: string;
}): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch(`/time-tracking/entries/${entryId}/draft/end`, {
    method: "PATCH",
    body: JSON.stringify({
      endAt: input.endAt,
    }),
  })) as { entry: TimeTrackingEntry };
}

export async function commentTimeTrackingDraft(entryId: string, input: {
  comment?: string | null;
}): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch(`/time-tracking/entries/${entryId}/draft/comment`, {
    method: "PATCH",
    body: JSON.stringify({
      comment: input.comment ?? null,
    }),
  })) as { entry: TimeTrackingEntry };
}

export async function submitTimeTrackingEntry(entryId: string): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch(`/time-tracking/entries/${entryId}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  })) as { entry: TimeTrackingEntry };
}

export async function cancelTimeTrackingEntry(entryId: string): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch(`/time-tracking/entries/${entryId}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { entry: TimeTrackingEntry };
}

export async function fetchActiveTimeTrackingDrafts(input?: { gmUserId?: string }): Promise<{
  entries: TimeTrackingEntry[];
  offlineContract?: {
    idempotentTokenField: string;
    retryGuidance: string;
  };
}> {
  const params = new URLSearchParams();
  if (input?.gmUserId) params.set("gmUserId", input.gmUserId);
  const query = params.toString();
  return (await authedFetch(`/time-tracking/entries/draft/active${query ? `?${query}` : ""}`)) as {
    entries: TimeTrackingEntry[];
    offlineContract?: {
      idempotentTokenField: string;
      retryGuidance: string;
    };
  };
}

export async function fetchCurrentDaySession(): Promise<DaySessionCurrentPayload> {
  return (await authedFetch("/day-session/current")) as DaySessionCurrentPayload;
}

export async function fetchTodaySubmissions(): Promise<{ items: TodaySubmissionItem[] }> {
  return (await authedFetch("/day-session/today-submissions")) as { items: TodaySubmissionItem[] };
}

export async function fetchAdminZeiterfassungDays(input?: {
  from?: string;
  to?: string;
  gmUserIds?: string[];
  region?: string;
  search?: string;
  includeLive?: boolean;
  timezone?: string;
}): Promise<{
  sessions: AdminZeiterfassungSession[];
  meta: {
    from: string;
    to: string;
    includeLive: boolean;
    timezone: string;
    totalSessions: number;
  };
}> {
  const params = new URLSearchParams();
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  if (input?.gmUserIds && input.gmUserIds.length > 0) params.set("gmUserIds", input.gmUserIds.join(","));
  if (input?.region) params.set("region", input.region);
  if (input?.search) params.set("search", input.search);
  if (typeof input?.includeLive === "boolean") params.set("includeLive", input.includeLive ? "true" : "false");
  if (input?.timezone) params.set("timezone", input.timezone);
  const query = params.toString();
  return (await authedFetch(`/admin/zeiterfassung/days${query ? `?${query}` : ""}`)) as {
    sessions: AdminZeiterfassungSession[];
    meta: {
      from: string;
      to: string;
      includeLive: boolean;
      timezone: string;
      totalSessions: number;
    };
  };
}

export async function fetchAdminZeiterfassungGmAggregates(input?: {
  from?: string;
  to?: string;
  gmUserIds?: string[];
  region?: string;
  search?: string;
  includeLive?: boolean;
  timezone?: string;
}): Promise<{
  rows: AdminZeiterfassungAggregateRow[];
  meta: {
    from: string;
    to: string;
    includeLive: boolean;
    timezone: string;
    totalGms: number;
  };
}> {
  const params = new URLSearchParams();
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  if (input?.gmUserIds && input.gmUserIds.length > 0) params.set("gmUserIds", input.gmUserIds.join(","));
  if (input?.region) params.set("region", input.region);
  if (input?.search) params.set("search", input.search);
  if (typeof input?.includeLive === "boolean") params.set("includeLive", input.includeLive ? "true" : "false");
  if (input?.timezone) params.set("timezone", input.timezone);
  const query = params.toString();
  return (await authedFetch(`/admin/zeiterfassung/gm-aggregates${query ? `?${query}` : ""}`)) as {
    rows: AdminZeiterfassungAggregateRow[];
    meta: {
      from: string;
      to: string;
      includeLive: boolean;
      timezone: string;
      totalGms: number;
    };
  };
}

export async function startDaySession(input?: { timezone?: string }): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/start", {
    method: "POST",
    body: JSON.stringify({ timezone: input?.timezone }),
  })) as { session: DaySession };
}

export async function startDayPause(): Promise<{ pause: DayPause }> {
  return (await authedFetch("/day-session/pause/start", {
    method: "POST",
    body: JSON.stringify({}),
  })) as { pause: DayPause };
}

export async function endDayPause(): Promise<{ pause: DayPause }> {
  return (await authedFetch("/day-session/pause/end", {
    method: "POST",
    body: JSON.stringify({}),
  })) as { pause: DayPause };
}

export async function setDaySessionStartKm(km: number): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/start-km", {
    method: "PATCH",
    body: JSON.stringify({ km }),
  })) as { session: DaySession };
}

export async function deferDaySessionStartKm(): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/start-km/defer", {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { session: DaySession };
}

export async function endDaySession(input?: { endAt?: string }): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/end", {
    method: "PATCH",
    body: JSON.stringify({ endAt: input?.endAt }),
  })) as { session: DaySession };
}

export async function setDaySessionEndKm(km: number): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/end-km", {
    method: "PATCH",
    body: JSON.stringify({ km }),
  })) as { session: DaySession };
}

export async function deferDaySessionEndKm(): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/end-km/defer", {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { session: DaySession };
}

export async function submitDaySession(input?: { comment?: string }): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/submit", {
    method: "POST",
    body: JSON.stringify({ comment: input?.comment }),
  })) as { session: DaySession };
}

export async function cancelDaySession(): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/cancel", {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { session: DaySession };
}
