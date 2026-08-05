"use client";

import type { GMRecord } from "@/types/gebietsmanager";
import type { SMRecord } from "@/types/shelfmerchandiser";
import type { KuehlerUnitRecord, MarketRecord } from "@/types/markets";
import type { Fragebogen, Module, Question, SingleChoiceAvailabilityType } from "@/types/fragebogen";
import type {
  Campaign,
  CampaignMarketAssignmentInput,
  CampaignMarketOverlapConflict,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@/types/campaign";
import type { PraemienGmBonusSummary, PraemienQuarter, PraemienSourceRef } from "@/types/praemien";
import type { ColumnMapping, ImportDatasetType, ImportSummary, KuehlerUpdateIdentifier } from "@/utils/marketImport";
import type { IppQuestionAuditRow } from "@/types/ipp";
import type { CreateLagerInput, LagerRecord, UpdateLagerInput } from "@/types/lager";
import type { RedMonthConfig, RedMonthCurrentPayload, RedMonthPeriod, RedMonthYear } from "@/types/red-month";
import { emitClientTelemetry } from "@/lib/clientTelemetry";
import {
  LEGACY_AUTH_STORAGE_KEY,
  clearAllAuthSessions,
  emitAuthSessionChanged,
  readActiveAuthSession,
  readActiveAuthSessionWithTarget,
  saveActiveAuthSession,
  subscribeToAuthSessionChanges,
  type AuthSessionPayload,
  type KundePagePermissions,
} from "@/lib/auth/sessionRegistry";

export type LoginRole = "gm" | "sm" | "admin" | "kunde";
export type { AuthSessionPayload };

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const AUTH_STORAGE_KEY = LEGACY_AUTH_STORAGE_KEY;

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
  role: "admin" | "gm" | "sm" | "kunde";
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  region?: string | null;
  isBillaGm?: boolean | null;
  ipp?: number | null;
  ippSampleCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  deletedAt?: string | null;
  anonymizedAt?: string | null;
  permissions?: KundePagePermissions | null;
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
    section: "standard" | "flex" | "kuehler" | "mhd" | "billa" | "durcharbeit";
    targetVisitCount?: number | null;
    submittedVisitCount?: number | null;
    isComplete?: boolean | null;
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
  kuehlerTechnicalIdentNo?: string | null;
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
  gmUserIds?: string[] | null;
  gmNames?: string[] | null;
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
  assignedGmUserId?: string | null;
  assignedGmName?: string | null;
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
  redPeriodId?: string | null;
  redMonthYearId?: string | null;
  label: string;
  periodIndexFromAnchor: number;
  periodIndex?: number;
  start: string;
  end: string;
  lookupEnd?: string;
  year: number;
  status?: "draft" | "active" | "locked";
  isCurrent: boolean;
  daysUntilEnd: number;
};

type BackendRedMonthConfig = {
  redMonthYearId?: string | null;
  redYear?: number | null;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount?: number;
  timezone: string;
  status?: "draft" | "active" | "locked";
  updatedAt: string | null;
};

type BackendRedMonthYear = {
  id: string;
  redMonthYearId?: string;
  redYear: number;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone: string;
  status: "draft" | "active" | "locked";
  createdAt: string;
  updatedAt: string;
};

type BackendCampaignMarketVisitSummary = {
  marketId: string;
  hasSubmittedVisit: boolean;
  sessionId: string | null;
  kuehlerUnitId: string | null;
  kuehlerInternalId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number | null;
  gmUserId: string | null;
  gmName: string | null;
  sections: Array<{
    id: string;
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
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
      singleChoiceAvailability: boolean | null;
      singleChoiceAvailabilityType: SingleChoiceAvailabilityType | null;
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
          inherited?: boolean;
          sourceSessionId?: string;
          sourceAnswerId?: string;
          signedUrl?: string | null;
          signedUrlExpiresAt?: string | null;
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

function getAuthPrincipalKey(session: AuthSessionPayload | null): string | null {
  if (!session) return null;
  return `${session.user.id}:${session.user.role}`;
}

function removeStorageKeysWithPrefix(storage: Storage | null, prefix: string): void {
  if (!storage) return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function purgeAuthScopedClientState(options?: { emit?: boolean }): void {
  if (typeof window !== "undefined") {
    try {
      removeStorageKeysWithPrefix(window.sessionStorage, GM_KPI_SUMMARY_CACHE_PREFIX);
      window.sessionStorage.removeItem(LEGACY_GM_KPI_SUMMARY_CACHE_KEY);
      removeStorageKeysWithPrefix(window.sessionStorage, GM_VISIT_PRELOAD_CACHE_PREFIX);
      removeStorageKeysWithPrefix(window.sessionStorage, GM_ACTIVE_VISIT_HANDOFF_CACHE_PREFIX);
      window.localStorage.removeItem("admin_market_visits_v1");
      window.localStorage.removeItem("admin_photo_tag_pool_v1");
      removeStorageKeysWithPrefix(window.localStorage, "admin_photo_tag_pool_v2:");
      removeStorageKeysWithPrefix(window.localStorage, "gm_day_session_local_v1:");
    } catch {
      // noop
    }
  }
  clearInMemoryGmVisitPreloadCache();
  if (options?.emit !== false) {
    emitAuthSessionChanged("cache-purge");
  }
}

export function resolveRoleHomePath(role: "admin" | "gm" | "sm" | "kunde"): string {
  if (role === "admin" || role === "kunde") return "/admin";
  if (role === "gm") return "/gm";
  return "/sm";
}

export function subscribeAuthSession(listener: () => void): () => void {
  return subscribeToAuthSessionChanges(listener);
}

export function saveAuthSession(payload: AuthSessionPayload, options?: { remember?: boolean }) {
  const beforePrincipal = getAuthPrincipalKey(readAuthSession());
  saveActiveAuthSession(payload, options);
  const afterPrincipal = getAuthPrincipalKey(readAuthSession());
  if (beforePrincipal !== afterPrincipal) {
    purgeAuthScopedClientState({ emit: false });
    emitAuthSessionChanged("identity-switch");
  }
}

export function clearAuthSession(options?: { emit?: boolean }) {
  clearAllAuthSessions({ emit: false });
  purgeAuthScopedClientState({ emit: false });
  if (options?.emit !== false) {
    emitAuthSessionChanged("logout");
  }
}

export function logoutCurrentUser() {
  clearAuthSession();
}

let authSessionObserverInstalled = false;
let lastObservedPrincipalKey: string | null = null;

function ensureAuthSessionObserver(): void {
  if (authSessionObserverInstalled || typeof window === "undefined") return;
  authSessionObserverInstalled = true;
  lastObservedPrincipalKey = getAuthPrincipalKey(readAuthSession());
  subscribeToAuthSessionChanges(() => {
    const nextPrincipal = getAuthPrincipalKey(readAuthSession());
    if (nextPrincipal !== lastObservedPrincipalKey) {
      purgeAuthScopedClientState({ emit: false });
      lastObservedPrincipalKey = nextPrincipal;
    }
  });
}

export function readAuthSession(): AuthSessionPayload | null {
  ensureAuthSessionObserver();
  return readActiveAuthSession();
}

export function getAccessToken(): string | null {
  return readAuthSession()?.session.accessToken ?? null;
}

export async function loginWithBackend(input: {
  email: string;
  password: string;
  role?: LoginRole;
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

export async function fetchCurrentAuthUser(): Promise<AuthSessionPayload["user"]> {
  const data = (await authedFetch("/auth/me", { cache: "no-store" })) as {
    user?: AuthSessionPayload["user"];
  };
  if (!data.user) throw new Error("Aktueller Benutzer konnte nicht geladen werden.");
  return data.user;
}

export type EmployeeAgreementSection = {
  title: string;
  body: string[];
};

export type EmployeeAgreementPayload = {
  agreement: {
    key: string;
    version: string;
    title: string;
    hash: string;
    effectiveDate: string;
    sections: EmployeeAgreementSection[];
  };
  accepted: boolean;
  acceptance: {
    acceptedAt: string;
    version: string;
    hash: string;
  } | null;
};

export async function fetchCurrentEmployeeAgreement(): Promise<EmployeeAgreementPayload> {
  return (await authedFetch("/employee-agreement/current", { cache: "no-store" })) as EmployeeAgreementPayload;
}

export async function acceptCurrentEmployeeAgreement(version: string): Promise<EmployeeAgreementPayload["acceptance"]> {
  const data = (await authedFetch("/employee-agreement/accept", {
    method: "POST",
    body: JSON.stringify({ version }),
  })) as {
    accepted?: boolean;
    acceptance?: EmployeeAgreementPayload["acceptance"];
  };
  if (!data.accepted || !data.acceptance) {
    throw new Error("Vereinbarung konnte nicht gespeichert werden.");
  }
  return data.acceptance;
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
    isBillaGm: Boolean(user.isBillaGm ?? false),
    isActive: Boolean(user.isActive ?? true),
    deletedAt: user.deletedAt ?? null,
    anonymizedAt: user.anonymizedAt ?? null,
    ipp: Number.isFinite(ippValue) ? ippValue : 0,
    ippSampleCount: Number.isFinite(ippSampleCountValue) && ippSampleCountValue > 0 ? Math.trunc(ippSampleCountValue) : 0,
    createdAt: user.createdAt ?? new Date().toISOString(),
    password: oneTimePassword,
  };
}

function mapBackendUserToSmRecord(user: BackendUser, oneTimePassword?: string): SMRecord {
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
    visitCount: 0,
    createdAt: user.createdAt ?? new Date().toISOString(),
    password: oneTimePassword,
  };
}

export type AdminUserRecord = {
  id: string;
  role: "admin";
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateAdminUserInput = {
  firstName: string;
  lastName: string;
  email: string;
};

export type CustomerPermissionAction = "read" | "write" | "update";
export type CustomerPagePermissions = Record<string, CustomerPermissionAction[]>;

export type CustomerAccessUserRecord = {
  id: string;
  role: "kunde";
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  permissions: CustomerPagePermissions;
};

export type CreateCustomerAccessUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  permissions: CustomerPagePermissions;
};

export type UpdateCustomerAccessUserInput = CreateCustomerAccessUserInput & {
  id: string;
};

export type DsarRequestType =
  | "access"
  | "rectification"
  | "erasure"
  | "restriction"
  | "portability"
  | "objection"
  | "mixed";

export type DsarRequestStatus =
  | "open"
  | "identity_check"
  | "collecting"
  | "decision"
  | "responded"
  | "closed"
  | "cancelled";

export type DsarRequestRecord = {
  id: string;
  requestType: DsarRequestType;
  status: DsarRequestStatus;
  intakeChannel: string;
  requesterName: string;
  requesterEmail: string;
  requesterUserId: string | null;
  subjectUserId: string | null;
  subjectNameSnapshot: string;
  subjectEmailSnapshot: string;
  subjectRoleSnapshot: string | null;
  requestSummary: string;
  assignedToUserId: string | null;
  receivedAt: string;
  dueAt: string;
  extendedUntil: string | null;
  extensionReason: string | null;
  identityVerifiedAt: string | null;
  identityVerifiedByUserId: string | null;
  decisionSummary: string | null;
  legalBlockers: string | null;
  responseChannel: string | null;
  responseSentAt: string | null;
  responseSentByUserId: string | null;
  exportPackageSummary: Record<string, unknown> | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DsarDataPackageCategory = {
  key: string;
  label: string;
  count: number;
  retention: string;
  actionHint: string;
};

export type DsarDataPackage = {
  generatedAt: string;
  subject: {
    id: string;
    role: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    region: string | null;
    isActive: boolean;
    deletedAt: string | null;
    anonymizedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  categories: DsarDataPackageCategory[];
  limitations: string[];
};

export type CreateDsarRequestInput = {
  requestType: DsarRequestType;
  intakeChannel?: string;
  requesterName: string;
  requesterEmail: string;
  requesterUserId?: string | null;
  subjectUserId?: string | null;
  subjectName?: string;
  subjectEmail?: string;
  subjectRole?: string | null;
  requestSummary?: string;
  assignedToUserId?: string | null;
};

export type UpdateDsarRequestInput = {
  status?: DsarRequestStatus;
  assignedToUserId?: string | null;
  identityVerified?: boolean;
  extendedUntil?: string | null;
  extensionReason?: string | null;
  decisionSummary?: string | null;
  legalBlockers?: string | null;
  responseChannel?: string | null;
  responseSentAt?: string | null;
  exportPackageSummary?: Record<string, unknown> | null;
};

function mapBackendUserToAdminRecord(user: BackendUser): AdminUserRecord {
  return {
    id: user.id,
    role: "admin",
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: Boolean(user.isActive ?? true),
    createdAt: user.createdAt ?? new Date().toISOString(),
    updatedAt: user.updatedAt ?? user.createdAt ?? new Date().toISOString(),
    deletedAt: user.deletedAt ?? null,
  };
}

function normalizeCustomerPermissions(input: unknown): CustomerPagePermissions {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.entries(input as Record<string, unknown>).reduce<CustomerPagePermissions>((acc, [pageKey, rawActions]) => {
    if (!Array.isArray(rawActions)) return acc;
    const actions = rawActions.filter((entry): entry is CustomerPermissionAction =>
      entry === "read" || entry === "write" || entry === "update",
    );
    if (actions.length > 0) {
      acc[pageKey] = Array.from(new Set(actions));
    }
    return acc;
  }, {});
}

function mapBackendUserToCustomerAccessRecord(user: BackendUser): CustomerAccessUserRecord {
  return {
    id: user.id,
    role: "kunde",
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: Boolean(user.isActive ?? true),
    createdAt: user.createdAt ?? new Date().toISOString(),
    updatedAt: user.updatedAt ?? user.createdAt ?? new Date().toISOString(),
    deletedAt: user.deletedAt ?? null,
    permissions: normalizeCustomerPermissions(user.permissions),
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
    kuehlerTechnicalIdentNo: unit.kuehlerTechnicalIdentNo ?? null,
    kuehlerModel: unit.kuehlerModel ?? null,
    importSourceFileName: unit.importSourceFileName ?? "",
    importedAt: unit.importedAt ?? new Date().toISOString(),
    isDeleted: Boolean(unit.isDeleted ?? false),
    createdAt: unit.createdAt ?? undefined,
    updatedAt: unit.updatedAt ?? undefined,
  };
}

function mapBackendLagerToLagerRecord(input: BackendLager): LagerRecord {
  const gmUserIds = Array.isArray(input.gmUserIds)
    ? Array.from(
        new Set(
          input.gmUserIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
        ),
      )
    : input.gmUserId
      ? [input.gmUserId]
      : [];
  const gmNames = Array.isArray(input.gmNames)
    ? Array.from(
        new Set(
          input.gmNames
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        ),
      )
    : input.gmName
      ? [input.gmName]
      : [];
  return {
    id: input.id,
    address: input.address,
    postalCode: input.postalCode,
    city: input.city,
    gmUserIds,
    gmNames,
    gmUserId: gmUserIds[0] ?? input.gmUserId ?? null,
    gmName: gmNames[0] ?? input.gmName ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function normalizeLagerGmUserIds(input: { gmUserIds?: string[]; gmUserId?: string | null }): string[] {
  return Array.from(
    new Set(
      (Array.isArray(input.gmUserIds) ? input.gmUserIds : input.gmUserId ? [input.gmUserId] : [])
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

function mapBackendRedMonthPeriod(period: BackendRedMonthPeriod): RedMonthPeriod {
  return {
    id: period.id,
    redPeriodId: period.redPeriodId ?? period.id ?? null,
    redMonthYearId: period.redMonthYearId ?? null,
    label: period.label,
    periodIndexFromAnchor: Number(period.periodIndexFromAnchor ?? 0),
    periodIndex: Number(period.periodIndex ?? Number(period.periodIndexFromAnchor ?? 0) + 1),
    start: period.start,
    end: period.end,
    lookupEnd: period.lookupEnd ?? period.end,
    year: Number(period.year ?? 0),
    status: period.status ?? "active",
    isCurrent: Boolean(period.isCurrent),
    daysUntilEnd: Number(period.daysUntilEnd ?? 0),
  };
}

function mapBackendRedMonthConfig(config: BackendRedMonthConfig): RedMonthConfig {
  return {
    redMonthYearId: config.redMonthYearId ?? null,
    redYear: typeof config.redYear === "number" ? config.redYear : null,
    anchorStart: config.anchorStart,
    cycleWeeks: Array.isArray(config.cycleWeeks) ? config.cycleWeeks.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : [],
    periodCount: Number(config.periodCount ?? 13),
    timezone: config.timezone,
    status: config.status ?? "active",
    updatedAt: config.updatedAt ?? null,
  };
}

function mapBackendRedMonthYear(year: BackendRedMonthYear): RedMonthYear {
  return {
    id: year.id,
    redMonthYearId: year.redMonthYearId ?? year.id,
    redYear: Number(year.redYear ?? 0),
    anchorStart: year.anchorStart,
    cycleWeeks: Array.isArray(year.cycleWeeks) ? year.cycleWeeks.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : [],
    periodCount: Number(year.periodCount ?? 13),
    timezone: year.timezone,
    status: year.status,
    createdAt: year.createdAt,
    updatedAt: year.updatedAt,
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

function isAuthFailureStatus(status: number, code: string | null): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (!code) return false;
  return code.startsWith("auth_") || code === "account_inactive" || code === "forbidden";
}

function handleAuthExpired(reason: string): void {
  clearAuthSession({ emit: false });
  emitAuthSessionChanged(reason);
}

function resolveAdminPageKeyForPath(pathname: string): string | null {
  if (pathname.startsWith("/admin/gm-dashboard")) return "gm_dashboard";
  if (pathname.startsWith("/admin/datenschutzanfragen")) return "datenschutzanfragen";
  if (pathname.startsWith("/admin/ipp-berechnung")) return "ipp_berechnung";
  if (pathname.startsWith("/admin/praemien")) return "praemien";
  if (pathname.startsWith("/admin/flexbesuche")) return "flexbesuche";
  if (pathname.startsWith("/admin/billa")) return "billa";
  if (pathname.startsWith("/admin/kuehlerinventur")) return "kuehlerinventur";
  if (pathname.startsWith("/admin/mhd")) return "mhd";
  if (pathname.startsWith("/admin/durcharbeit")) return "durcharbeit";
  if (pathname.startsWith("/admin/fbmanagement")) return "fbmanagement";
  if (pathname.startsWith("/admin/fotoarchiv")) return "fotoarchiv";
  if (pathname.startsWith("/admin/zeiterfassung")) return "zeiterfassung";
  if (pathname.startsWith("/admin/maerkte")) return "maerkte";
  if (pathname.startsWith("/admin/lager")) return "lager";
  if (pathname.startsWith("/admin/shelfmerchandiser")) return "shelfmerchandiser";
  if (pathname.startsWith("/admin/gebietsmanager")) return "gebietsmanager";
  if (pathname.startsWith("/admin/fragebogen")) return "fragebogen";
  return null;
}

function getKundePageKeyHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const pageKey = resolveAdminPageKeyForPath(window.location.pathname);
  return pageKey ? { "x-coke-spark-page-key": pageKey } : {};
}

async function authedFetch(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const token = getAccessToken();
  if (!token) {
    handleAuthExpired("missing-access-token");
    throw new Error("Nicht eingeloggt. Bitte erneut anmelden.");
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
        ...getKundePageKeyHeader(),
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
      const code = typeof data?.code === "string" ? data.code : null;
      if (isAuthFailureStatus(res.status, code)) {
        handleAuthExpired(`api-auth-failed:${res.status}`);
      }
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
              errorCode: code,
            },
          },
        });
      }
      const msg = typeof data?.error === "string" ? data.error : "Backend request failed.";
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
  isManual: boolean;
  payoutMode: "highest_tier" | "sum_earned_tiers";
  targetPoints: number | null;
  rewardEur: number;
  maxRewardEur: number;
  metrics: Array<{
    id: string;
    key: string;
    label: string;
    unit: "points" | "percent" | "count" | "currency";
    valueSource: "contribution_points" | "contribution_percent" | "quality_zeiterfassung" | "quality_reporting" | "quality_accuracy" | "quality_average" | "flex_total_points" | "flex_component";
    sourceKey?: string | null;
    orderIndex: number;
  }>;
  tiers: Array<{
    id: string;
    label: string;
    orderIndex: number;
    rewardEur: number;
    conditions: Array<{
      id: string;
      metricKey: string;
      operator: "gte" | "lte" | "eq";
      thresholdValue: number;
      orderIndex: number;
    }>;
  }>;
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

type BackendPraemienFlexSubmission = {
  gmId: string;
  gmName: string;
  totalPoints: number;
  componentValues: Record<string, number>;
  note?: string;
  updatedAt: string;
};

type BackendPraemienPillarOverride = {
  id: string;
  pillarId: string;
  gmId: string;
  gmName: string;
  points: number;
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
  rewardModel: "global_thresholds" | "pillar_targets" | "pillar_tiers";
  thresholds: BackendPraemienThreshold[];
  pillars: BackendPraemienPillar[];
  qualitySubmissions: BackendPraemienQualitySubmission[];
  flexSubmissions: BackendPraemienFlexSubmission[];
  pillarOverrides: BackendPraemienPillarOverride[];
  createdAt: string;
  updatedAt: string;
};

export type PraemienWaveSummary = {
  id: string;
  name: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: PraemienWaveStatus;
  startDate: string;
  endDate: string;
  description: string;
  timezone: string;
  rewardModel: "global_thresholds" | "pillar_targets" | "pillar_tiers";
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
  rewardModel?: "global_thresholds" | "pillar_targets" | "pillar_tiers";
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
  payoutMode: "highest_tier" | "sum_earned_tiers";
  targetPoints?: number | null;
  rewardEur?: number;
  maxRewardEur: number;
  metrics: Array<{
    id?: string;
    key: string;
    label: string;
    unit: "points" | "percent" | "count" | "currency";
    valueSource: "contribution_points" | "contribution_percent" | "quality_zeiterfassung" | "quality_reporting" | "quality_accuracy" | "quality_average" | "flex_total_points" | "flex_component";
    sourceKey?: string | null;
    orderIndex: number;
  }>;
  tiers: Array<{
    id?: string;
    label: string;
    orderIndex: number;
    rewardEur: number;
    conditions: Array<{
      id?: string;
      metricKey: string;
      operator: "gte" | "lte" | "eq";
      thresholdValue: number;
      orderIndex: number;
    }>;
  }>;
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

type PraemienFlexWrite = {
  id?: string;
  gmUserId: string;
  totalPoints: number;
  componentValues?: Record<string, number>;
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
    rewardModel: wave.rewardModel ?? "global_thresholds",
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
      isManual: Boolean(pillar.isManual),
      payoutMode: pillar.payoutMode ?? "highest_tier",
      targetPoints: pillar.targetPoints == null ? null : Number(pillar.targetPoints),
      rewardEur: Number(pillar.rewardEur ?? 0),
      maxRewardEur: Number(pillar.maxRewardEur ?? 0),
      metrics: (pillar.metrics ?? []).map((metric) => ({
        id: metric.id,
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        valueSource: metric.valueSource,
        sourceKey: metric.sourceKey ?? null,
        orderIndex: Number(metric.orderIndex ?? 0),
      })),
      tiers: (pillar.tiers ?? []).map((tier) => ({
        id: tier.id,
        label: tier.label,
        orderIndex: Number(tier.orderIndex ?? 0),
        rewardEur: Number(tier.rewardEur ?? 0),
        conditions: (tier.conditions ?? []).map((condition) => ({
          id: condition.id,
          metricKey: condition.metricKey,
          operator: condition.operator,
          thresholdValue: Number(condition.thresholdValue ?? 0),
          orderIndex: Number(condition.orderIndex ?? 0),
        })),
      })),
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
    flexSubmissions: (wave.flexSubmissions ?? []).map((entry) => ({
      gmId: entry.gmId,
      gmName: entry.gmName ?? "",
      totalPoints: Number(entry.totalPoints ?? 0),
      componentValues: entry.componentValues ?? {},
      note: entry.note ?? undefined,
      updatedAt: entry.updatedAt,
    })),
    pillarOverrides: (wave.pillarOverrides ?? []).map((entry) => ({
      id: entry.id,
      pillarId: entry.pillarId,
      gmId: entry.gmId,
      gmName: entry.gmName ?? "",
      points: Number(entry.points ?? 0),
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
  includeInitial?: boolean;
}): Promise<{
  waves: PraemienWaveSummary[];
  limit: number;
  offset: number;
  total: number;
  initialWave: PraemienQuarter | null;
}> {
  const params = new URLSearchParams();
  if (input?.year != null) params.set("year", String(input.year));
  if (input?.status) params.set("status", input.status);
  if (input?.limit != null) params.set("limit", String(input.limit));
  if (input?.offset != null) params.set("offset", String(input.offset));
  if (input?.includeInitial != null) params.set("includeInitial", input.includeInitial ? "true" : "false");
  const query = params.toString();
  const data = (await authedFetch(`/admin/praemien/waves${query ? `?${query}` : ""}`)) as {
    waves: PraemienWaveSummary[];
    limit: number;
    offset: number;
    total: number;
    initialWave?: BackendPraemienWave | null;
  };
  return {
    waves: data.waves,
    limit: data.limit,
    offset: data.offset,
    total: data.total,
    initialWave: data.initialWave ? mapPraemienWaveToQuarter(data.initialWave) : null,
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
  rewardModel?: "global_thresholds" | "pillar_targets" | "pillar_tiers";
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

export async function replaceAdminPraemienFlexScores(
  waveId: string,
  input: { flexScores: PraemienFlexWrite[]; expectedUpdatedAt?: string },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/flex-scores`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as { wave: BackendPraemienWave };
  return mapPraemienWaveToQuarter(data.wave);
}

export async function replaceAdminPraemienPillarOverrides(
  waveId: string,
  input: {
    pillarOverrides: Array<{
      id?: string;
      pillarId: string;
      gmUserId: string;
      points: number;
      note?: string | null;
    }>;
    expectedUpdatedAt?: string;
  },
): Promise<PraemienQuarter> {
  const data = (await authedFetch(`/admin/praemien/waves/${waveId}/pillar-overrides`, {
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
    rewardModel: data.rewardModel ?? null,
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
          isManual: Boolean(goal.isManual),
          isPending: Boolean(goal.isPending),
          earnedRewardEur: Number(goal.earnedRewardEur ?? 0),
          maxRewardEur: Number(goal.maxRewardEur ?? 0),
          metricValues: goal.metricValues ?? {},
          achievedTierLabels: Array.isArray(goal.achievedTierLabels) ? goal.achievedTierLabels.map(String) : [],
          nextTierLabel: goal.nextTierLabel ?? null,
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

export type GmProfilePhoto = {
  storageBucket: string;
  storagePath: string;
  signedUrl: string;
  expiresAt: string;
};

export type GmProfilePayload = {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    region: string;
    isBillaGm: boolean;
    profilePhoto: GmProfilePhoto | null;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    redPeriod: {
      redPeriodId: string | null;
      redMonthYearId: string | null;
      label: string;
      startDate: string;
      endDate: string;
      redYear: number;
    };
    currentRedVisitCount: number;
    allTimeVisitCount: number;
    latestVisit: {
      id: string;
      startedAt: string | null;
      submittedAt: string | null;
      marketName: string;
      marketAddress: string;
    } | null;
    ippAllTimeAvg: number;
    ippSampleCount: number;
    bonusCumulativeEur: number;
    weekWorkMinutes: number;
    averageWorkdayMin: number;
    trackedWeekDays: number;
  };
};

const LEGACY_GM_KPI_SUMMARY_CACHE_KEY = "gm_kpi_summary_v1";
const GM_KPI_SUMMARY_CACHE_PREFIX = "gm_kpi_summary_v2:";

function getGmKpiSummaryCacheKey(userId: string): string {
  return `${GM_KPI_SUMMARY_CACHE_PREFIX}${userId}`;
}

export function readCachedGmKpiSummary(): GmKpiSummary | null {
  if (typeof window === "undefined") return null;
  const activeUserId = readAuthSession()?.user.id;
  if (!activeUserId) return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(getGmKpiSummaryCacheKey(activeUserId));
    if (!raw) {
      const legacy = window.sessionStorage.getItem(LEGACY_GM_KPI_SUMMARY_CACHE_KEY);
      if (legacy) {
        raw = legacy;
        window.sessionStorage.setItem(getGmKpiSummaryCacheKey(activeUserId), legacy);
        window.sessionStorage.removeItem(LEGACY_GM_KPI_SUMMARY_CACHE_KEY);
      }
    }
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
  const activeUserId = readAuthSession()?.user.id;
  if (!activeUserId) return;
  try {
    window.sessionStorage.setItem(getGmKpiSummaryCacheKey(activeUserId), JSON.stringify(summary));
    window.sessionStorage.removeItem(LEGACY_GM_KPI_SUMMARY_CACHE_KEY);
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

export async function fetchGmProfile(): Promise<GmProfilePayload> {
  return (await authedFetch("/gm/profile", { cache: "no-store" })) as GmProfilePayload;
}

export type GmTextSettingsPayload = {
  textScalePercent: number;
  updatedAt: string | null;
};

export async function fetchGmTextSettings(): Promise<GmTextSettingsPayload> {
  return (await authedFetch("/gm/settings/text-scale", { cache: "no-store" })) as GmTextSettingsPayload;
}

export async function updateGmTextSettings(input: { textScalePercent: number }): Promise<GmTextSettingsPayload> {
  return (await authedFetch("/gm/settings/text-scale", {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as GmTextSettingsPayload;
}

export async function presignGmProfilePhoto(input: {
  extension?: string;
  mimeType?: string;
}): Promise<{ upload: { bucket: string; path: string; signedUrl: string; token: string } }> {
  return (await authedFetch("/gm/profile/photo/presign", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { upload: { bucket: string; path: string; signedUrl: string; token: string } };
}

export async function commitGmProfilePhoto(input: {
  storageBucket: string;
  storagePath: string;
  mimeType?: string;
  byteSize?: number;
}): Promise<{ ok: boolean; profilePhoto: GmProfilePhoto | null }> {
  return (await authedFetch("/gm/profile/photo/commit", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { ok: boolean; profilePhoto: GmProfilePhoto | null };
}

export async function updateOwnPasswordWithCurrent(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await authedFetch("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function refreshAuthSession(): Promise<AuthSessionPayload | null> {
  const currentSession = readActiveAuthSessionWithTarget();
  if (!currentSession?.payload.session.refreshToken) {
    handleAuthExpired("refresh-missing-token");
    return null;
  }

  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: currentSession.payload.session.refreshToken }),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AuthSessionPayload>;
  if (!res.ok || !data.user || !data.session) {
    handleAuthExpired("refresh-failed");
    return null;
  }

  if (
    data.user.id !== currentSession.payload.user.id ||
    data.user.role !== currentSession.payload.user.role
  ) {
    handleAuthExpired("refresh-identity-mismatch");
    return null;
  }

  const refreshed = data as AuthSessionPayload;
  saveAuthSession(refreshed, { remember: currentSession.remember });
  return refreshed;
}

const DIRECTORY_CACHE_TTL_MS = 60_000;

let gmUsersDirectoryCache: { expiresAt: number; data: GMRecord[] } | null = null;
let gmUsersDirectoryInFlight: Promise<GMRecord[]> | null = null;
let smUsersDirectoryCache: { expiresAt: number; data: SMRecord[] } | null = null;
let smUsersDirectoryInFlight: Promise<SMRecord[]> | null = null;
let marketsDirectoryCache: { expiresAt: number; data: MarketRecord[] } | null = null;
let marketsDirectoryInFlight: Promise<MarketRecord[]> | null = null;

function invalidateGmUsersDirectoryCache(): void {
  gmUsersDirectoryCache = null;
  gmUsersDirectoryInFlight = null;
}

function invalidateSmUsersDirectoryCache(): void {
  smUsersDirectoryCache = null;
  smUsersDirectoryInFlight = null;
}

function invalidateMarketsDirectoryCache(): void {
  marketsDirectoryCache = null;
  marketsDirectoryInFlight = null;
}

export async function fetchGmUsers(): Promise<GMRecord[]> {
  const now = Date.now();
  if (gmUsersDirectoryCache && gmUsersDirectoryCache.expiresAt > now) {
    return gmUsersDirectoryCache.data;
  }
  if (gmUsersDirectoryInFlight) {
    return gmUsersDirectoryInFlight;
  }

  gmUsersDirectoryInFlight = (async () => {
    try {
      const data = (await authedFetch("/admin/users?role=gm")) as { users?: BackendUser[] };
      const users = (data.users ?? []).map((u) => mapBackendUserToGmRecord(u));
      gmUsersDirectoryCache = { data: users, expiresAt: Date.now() + DIRECTORY_CACHE_TTL_MS };
      return users;
    } catch (error) {
      if (gmUsersDirectoryCache) return gmUsersDirectoryCache.data;
      throw error;
    }
  })().finally(() => {
    gmUsersDirectoryInFlight = null;
  });

  return gmUsersDirectoryInFlight;
}

export async function fetchSmUsers(): Promise<SMRecord[]> {
  const now = Date.now();
  if (smUsersDirectoryCache && smUsersDirectoryCache.expiresAt > now) {
    return smUsersDirectoryCache.data;
  }
  if (smUsersDirectoryInFlight) {
    return smUsersDirectoryInFlight;
  }

  smUsersDirectoryInFlight = (async () => {
    try {
      const data = (await authedFetch("/admin/users?role=sm")) as { users?: BackendUser[] };
      const users = (data.users ?? []).map((u) => mapBackendUserToSmRecord(u));
      smUsersDirectoryCache = { data: users, expiresAt: Date.now() + DIRECTORY_CACHE_TTL_MS };
      return users;
    } catch (error) {
      if (smUsersDirectoryCache) return smUsersDirectoryCache.data;
      throw error;
    }
  })().finally(() => {
    smUsersDirectoryInFlight = null;
  });

  return smUsersDirectoryInFlight;
}

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const data = (await authedFetch("/admin/users?role=admin")) as { users?: BackendUser[] };
  return (data.users ?? []).filter((user) => user.role === "admin").map((user) => mapBackendUserToAdminRecord(user));
}

export async function createAdminUser(
  payload: CreateAdminUserInput,
): Promise<{ user: AdminUserRecord; oneTimePassword: string | null }> {
  const data = (await authedFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      role: "admin",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    }),
  })) as { user: BackendUser; oneTimePassword?: string };
  return {
    user: mapBackendUserToAdminRecord(data.user),
    oneTimePassword: data.oneTimePassword ?? null,
  };
}

export async function deactivateAdminUser(userId: string): Promise<{ ok: boolean; alreadyInactive?: boolean }> {
  return (await authedFetch(`/admin/users/${userId}/deactivate`, {
    method: "PATCH",
  })) as { ok: boolean; alreadyInactive?: boolean };
}

export async function anonymizeGmUser(userId: string): Promise<{ ok: boolean; alreadyAnonymized?: boolean; authDeleted?: boolean; authDeleteError?: string | null; user: GMRecord | null }> {
  const data = (await authedFetch(`/admin/users/${userId}/anonymize`, {
    method: "PATCH",
  })) as { ok: boolean; alreadyAnonymized?: boolean; authDeleted?: boolean; authDeleteError?: string | null; user?: BackendUser };
  return {
    ok: data.ok,
    alreadyAnonymized: data.alreadyAnonymized,
    authDeleted: data.authDeleted,
    authDeleteError: data.authDeleteError,
    user: data.user ? mapBackendUserToGmRecord(data.user) : null,
  };
}

export async function fetchCustomerAccessUsers(): Promise<CustomerAccessUserRecord[]> {
  const data = (await authedFetch("/admin/kunden-users", { cache: "no-store" })) as { users?: BackendUser[] };
  return (data.users ?? [])
    .filter((user) => user.role === "kunde")
    .map((user) => mapBackendUserToCustomerAccessRecord(user));
}

export async function createCustomerAccessUser(
  payload: CreateCustomerAccessUserInput,
): Promise<{ user: CustomerAccessUserRecord; oneTimePassword: string | null }> {
  const data = (await authedFetch("/admin/kunden-users", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { user: BackendUser; oneTimePassword?: string };
  return {
    user: mapBackendUserToCustomerAccessRecord(data.user),
    oneTimePassword: data.oneTimePassword ?? null,
  };
}

export async function updateCustomerAccessUser(payload: UpdateCustomerAccessUserInput): Promise<CustomerAccessUserRecord> {
  const data = (await authedFetch(`/admin/kunden-users/${payload.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      isActive: payload.isActive,
      permissions: payload.permissions,
    }),
  })) as { user: BackendUser };
  return mapBackendUserToCustomerAccessRecord(data.user);
}

export async function deactivateCustomerAccessUser(userId: string): Promise<{ ok: boolean }> {
  return (await authedFetch(`/admin/kunden-users/${userId}/deactivate`, {
    method: "PATCH",
  })) as { ok: boolean };
}

export async function fetchDsarRequests(params: { status?: DsarRequestStatus; search?: string } = {}): Promise<DsarRequestRecord[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const data = (await authedFetch(`/admin/dsar${suffix}`, { cache: "no-store" })) as { requests?: DsarRequestRecord[] };
  return data.requests ?? [];
}

export async function createDsarRequest(payload: CreateDsarRequestInput): Promise<DsarRequestRecord> {
  const data = (await authedFetch("/admin/dsar", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { request: DsarRequestRecord };
  return data.request;
}

export async function updateDsarRequest(id: string, payload: UpdateDsarRequestInput): Promise<DsarRequestRecord> {
  const data = (await authedFetch(`/admin/dsar/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })) as { request: DsarRequestRecord };
  return data.request;
}

export async function fetchDsarDataPackage(id: string): Promise<DsarDataPackage> {
  const data = (await authedFetch(`/admin/dsar/${id}/package`, { cache: "no-store" })) as { package: DsarDataPackage };
  return data.package;
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
      isBillaGm: Boolean(payload.isBillaGm ?? false),
      ipp: payload.ipp,
    }),
  })) as { user: BackendUser; oneTimePassword?: string };
  const next = mapBackendUserToGmRecord(data.user, data.oneTimePassword);
  invalidateGmUsersDirectoryCache();
  return next;
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
      isBillaGm: Boolean(payload.isBillaGm ?? false),
      ipp: payload.ipp,
    }),
  })) as { user: BackendUser };
  const next = mapBackendUserToGmRecord(data.user);
  invalidateGmUsersDirectoryCache();
  return next;
}

export interface SpecialArthurFilterEntry {
  id: string;
  matchValue: string;
  createdAt?: string;
}

export async function fetchSpecialArthurFilter(gmUserId: string): Promise<SpecialArthurFilterEntry[]> {
  const data = (await authedFetch(`/admin/users/${gmUserId}/special-arthur-filter`, {
    cache: "no-store",
  })) as { entries?: SpecialArthurFilterEntry[] };
  return data.entries ?? [];
}

export async function replaceSpecialArthurFilter(
  gmUserId: string,
  matchValues: string[],
): Promise<SpecialArthurFilterEntry[]> {
  const data = (await authedFetch(`/admin/users/${gmUserId}/special-arthur-filter`, {
    method: "PUT",
    body: JSON.stringify({ matchValues }),
  })) as { entries?: SpecialArthurFilterEntry[] };
  return data.entries ?? [];
}

export async function createSmUser(payload: Omit<SMRecord, "id" | "createdAt" | "password" | "visitCount">): Promise<SMRecord> {
  const data = (await authedFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      role: "sm",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      city: payload.city,
      postalCode: payload.postalCode,
      region: payload.region,
    }),
  })) as { user: BackendUser; oneTimePassword?: string };
  const next = mapBackendUserToSmRecord(data.user, data.oneTimePassword);
  invalidateSmUsersDirectoryCache();
  return next;
}

export async function updateSmUser(payload: SMRecord): Promise<SMRecord> {
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
    }),
  })) as { user: BackendUser };
  const next = mapBackendUserToSmRecord(data.user);
  invalidateSmUsersDirectoryCache();
  return next;
}

export async function fetchAdminLager(): Promise<LagerRecord[]> {
  const data = (await authedFetch("/admin/lager")) as { lagers?: BackendLager[] };
  return (data.lagers ?? []).map((entry) => mapBackendLagerToLagerRecord(entry));
}

export async function createAdminLager(input: CreateLagerInput): Promise<LagerRecord> {
  const gmUserIds = normalizeLagerGmUserIds(input);
  const data = (await authedFetch("/admin/lager", {
    method: "POST",
    body: JSON.stringify({
      address: input.address,
      postalCode: input.postalCode,
      city: input.city,
      gmUserIds,
      gmUserId: gmUserIds[0] ?? null,
    }),
  })) as { lager: BackendLager };
  return mapBackendLagerToLagerRecord(data.lager);
}

export async function updateAdminLager(input: UpdateLagerInput): Promise<LagerRecord> {
  const gmUserIds = normalizeLagerGmUserIds(input);
  const data = (await authedFetch(`/admin/lager/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      address: input.address,
      postalCode: input.postalCode,
      city: input.city,
      gmUserIds,
      gmUserId: gmUserIds[0] ?? null,
    }),
  })) as { lager: BackendLager };
  return mapBackendLagerToLagerRecord(data.lager);
}

type ImportMarketsInput = {
  importType: ImportDatasetType;
  kuehlerUpdateIdentifier?: KuehlerUpdateIdentifier;
  allowMissingCokeMasterNumber?: boolean;
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

export async function fetchMarkets(options?: { forceFresh?: boolean }): Promise<MarketRecord[]> {
  const forceFresh = Boolean(options?.forceFresh);
  const now = Date.now();
  if (!forceFresh && marketsDirectoryCache && marketsDirectoryCache.expiresAt > now) {
    return marketsDirectoryCache.data;
  }
  if (!forceFresh && marketsDirectoryInFlight) {
    return marketsDirectoryInFlight;
  }

  const request = (async () => {
    try {
      const data = (await authedFetch("/markets", forceFresh ? { cache: "no-store" } : {}, 60000)) as { markets?: BackendMarket[] };
      const markets = (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market));
      marketsDirectoryCache = { data: markets, expiresAt: Date.now() + DIRECTORY_CACHE_TTL_MS };
      return markets;
    } catch (error) {
      if (!forceFresh && marketsDirectoryCache) return marketsDirectoryCache.data;
      throw error;
    }
  })();

  if (forceFresh) {
    return request;
  }

  marketsDirectoryInFlight = request.finally(() => {
    marketsDirectoryInFlight = null;
  });

  return marketsDirectoryInFlight;
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
    section: "standard" | "flex" | "kuehler" | "mhd" | "billa" | "durcharbeit";
    targetVisitCount?: number | null;
    submittedVisitCount?: number | null;
    isComplete?: boolean | null;
  }>;
};

export type GmMarketDetailSection = "standard" | "flex" | "kuehler" | "mhd" | "billa" | "durcharbeit";

export type GmMarketDetailActiveCampaign = {
  campaignId: string;
  campaignName: string;
  section: GmMarketDetailSection;
  targetVisitCount: number;
  submittedVisitCount: number;
  isComplete: boolean;
  isStartable: boolean;
};

export type GmMarketDetailDraft = {
  sessionId: string;
  startedAt: string;
  campaignIds: string[];
  campaignNames: string[];
};

export type GmMarketPastVisitSection = {
  section: GmMarketDetailSection;
  campaignId: string;
  campaignName: string;
  fragebogenName: string;
  answeredQuestionCount: number;
  photoCount: number;
  commentCount: number;
};

export type GmMarketPastVisit = {
  sessionId: string;
  startedAt: string;
  submittedAt: string;
  durationMinutes: number | null;
  sections: GmMarketPastVisitSection[];
};

export type GmMarketDetailPayload = {
  period: {
    startDate: string;
    endDate: string;
  };
  market: MarketRecord;
  activeCampaigns: GmMarketDetailActiveCampaign[];
  drafts: GmMarketDetailDraft[];
  pastVisits: GmMarketPastVisit[];
};

export type GmKuehlerMhdProgressMarket = {
  marketId: string;
  campaignId: string;
  campaignName: string;
  kuehlerUnitId?: string | null;
  kuehlerNumber?: string | null;
  chain: string;
  address: string;
  stammnr: string | null;
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
  durcharbeit: GmKuehlerMhdProgressSection;
  generatedAt: string;
  timezone: string;
  periodFallback: {
    startDate: string;
    endDate: string;
  };
};

type TimedApiCache<T> = {
  data: T | null;
  expiresAt: number;
  promise: Promise<T> | null;
};

const GM_START_MARKETS_CACHE_TTL_MS = 45_000;
const GM_PROGRESS_CACHE_TTL_MS = 30_000;

const gmAssignedStartMarketsCache: TimedApiCache<GmStartMarket[]> = {
  data: null,
  expiresAt: 0,
  promise: null,
};

const gmFlexStartMarketsCache: TimedApiCache<GmStartMarket[]> = {
  data: null,
  expiresAt: 0,
  promise: null,
};

const gmKuehlerMhdProgressCache: TimedApiCache<GmKuehlerMhdProgressPayload> = {
  data: null,
  expiresAt: 0,
  promise: null,
};

function cloneGmStartMarkets(rows: GmStartMarket[]): GmStartMarket[] {
  return rows.map((row) => ({
    market: { ...row.market },
    activeNowCampaigns: row.activeNowCampaigns.map((campaign) => ({ ...campaign })),
  }));
}

function cloneGmKuehlerMhdProgress(payload: GmKuehlerMhdProgressPayload): GmKuehlerMhdProgressPayload {
  return {
    ...payload,
    kuehler: {
      ...payload.kuehler,
      markets: payload.kuehler.markets.map((market) => ({ ...market })),
    },
    mhd: {
      ...payload.mhd,
      markets: payload.mhd.markets.map((market) => ({ ...market })),
    },
    durcharbeit: {
      ...payload.durcharbeit,
      markets: payload.durcharbeit.markets.map((market) => ({ ...market })),
    },
    periodFallback: { ...payload.periodFallback },
  };
}

async function readTimedApiCache<T>(
  cache: TimedApiCache<T>,
  ttlMs: number,
  loader: () => Promise<T>,
  clone: (value: T) => T,
  options?: { force?: boolean },
): Promise<T> {
  const now = Date.now();
  if (!options?.force && cache.data && cache.expiresAt > now) return clone(cache.data);
  if (!options?.force && cache.promise) return clone(await cache.promise);
  cache.promise = loader()
    .then((value) => {
      cache.data = value;
      cache.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .finally(() => {
      cache.promise = null;
    });
  return clone(await cache.promise);
}

export async function fetchGmAssignedStartMarkets(): Promise<GmStartMarket[]> {
  return readTimedApiCache(
    gmAssignedStartMarketsCache,
    GM_START_MARKETS_CACHE_TTL_MS,
    async () => {
      const data = (await authedFetch("/markets/gm/assigned-active")) as { markets?: BackendMarket[] };
      return (data.markets ?? []).map((market) => ({
        market: mapBackendMarketToMarketRecord(market),
        activeNowCampaigns: market.activeNowCampaigns ?? [],
      }));
    },
    cloneGmStartMarkets,
  );
}

export async function fetchGmMarketDetail(marketId: string): Promise<GmMarketDetailPayload> {
  const data = (await authedFetch(`/markets/gm/${encodeURIComponent(marketId)}/detail`, { cache: "no-store" })) as Omit<
    GmMarketDetailPayload,
    "market"
  > & { market: BackendMarket };
  return {
    ...data,
    market: mapBackendMarketToMarketRecord(data.market),
  };
}

export async function fetchGmFlexStartMarkets(): Promise<GmStartMarket[]> {
  return readTimedApiCache(
    gmFlexStartMarketsCache,
    GM_START_MARKETS_CACHE_TTL_MS,
    async () => {
      const data = (await authedFetch("/markets/gm/flex-start-markets")) as { markets?: BackendMarket[] };
      return (data.markets ?? []).map((market) => ({
        market: mapBackendMarketToMarketRecord(market),
        activeNowCampaigns: market.activeNowCampaigns ?? [],
      }));
    },
    cloneGmStartMarkets,
  );
}

export async function fetchGmKuehlerMhdProgress(options?: { force?: boolean }): Promise<GmKuehlerMhdProgressPayload> {
  return readTimedApiCache(
    gmKuehlerMhdProgressCache,
    GM_PROGRESS_CACHE_TTL_MS,
    async () => (await authedFetch("/markets/gm/kuehler-mhd-progress")) as GmKuehlerMhdProgressPayload,
    cloneGmKuehlerMhdProgress,
    options,
  );
}

export type GmVisitStartSection = {
  section: "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
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
    singleChoiceAvailability?: boolean | null;
    singleChoiceAvailabilityType?: SingleChoiceAvailabilityType | null;
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
    scoring: Record<string, { ipp?: number; zweitplatzierung?: number; mitbewerberabfrage?: number; boni?: number }>;
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
    kuehlerUnitId?: string | null;
    kuehlerNumber?: string | null;
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
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
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
      singleChoiceAvailability?: boolean | null;
      singleChoiceAvailabilityType?: SingleChoiceAvailabilityType | null;
      config: Record<string, unknown>;
      rules: Array<Record<string, unknown>>;
      chains?: string[];
      appliesToMarketChain?: boolean;
      moduleId?: string;
      moduleName?: string;
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
          inherited?: boolean;
          sourceSessionId?: string;
          sourceAnswerId?: string;
          signedUrl?: string | null;
          signedUrlExpiresAt?: string | null;
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

export type GmCompletedVisitSummary = {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  durationMinutes: number | null;
  kuehlerUnitId?: string | null;
  kuehlerNumber?: string | null;
  market: {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  };
  sections: Array<{
    id: string;
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
    campaignId: string;
    campaignName: string;
    fragebogenName: string;
    questionCount: number;
    answeredCount: number;
    photoCount: number;
  }>;
  totals: {
    questionCount: number;
    answeredCount: number;
    photoCount: number;
  };
};
export type GmVisitAnswerChangeRequestResult = {
  ok: boolean;
  request: {
    id: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    createdAt: string;
    updatedAt: string;
  } | null;
};
export type VisitSessionDeleteRequest = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  visitSessionId: string;
  requestNote: string | null;
  campaignSummary: string;
  sectionSummary: string;
  gm: {
    id: string;
    name: string;
    email: string;
    region: string | null;
  };
  market: {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
    region: string | null;
  };
  session: {
    id: string;
    startedAt: string | null;
    submittedAt: string | null;
  };
};
export type GmVisitSessionDeleteRequest = VisitSessionDeleteRequest;
export type AdminVisitSessionDeleteRequest = VisitSessionDeleteRequest;
export type GmVisitSessionDeleteRequestResult = {
  ok: boolean;
  request: {
    id: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    createdAt: string;
    updatedAt: string;
  } | null;
};
export type AdminAnswerChangeRequest = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  visitSessionId: string;
  visitSessionQuestionId: string;
  visitAnswerId: string | null;
  questionType: "single" | "yesno" | "yesnomulti" | "multiple" | "likert" | "text" | "numeric" | "slider" | "photo" | "matrix";
  questionText: string;
  currentAnswerSnapshot: Record<string, unknown>;
  requestedAnswerPayload: Record<string, unknown>;
  requestedAnswerSummary: string;
  requestNote: string | null;
  autoApplicable: boolean;
  autoApplicabilityError: string | null;
  gm: {
    id: string;
    name: string;
    email: string;
    region: string | null;
  };
  market: {
    id: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
    region: string | null;
  };
  session: {
    id: string;
    startedAt: string | null;
    submittedAt: string | null;
  };
  section: {
    section: "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
    campaignId: string;
    campaignName: string;
    fragebogenName: string;
  };
};
export type GmAnswerChangeRequest = AdminAnswerChangeRequest;

export type TimeEntryChangeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TimeEntryChangeRequestSourceKind = "day_start" | "day_end" | "day_km" | "marktbesuch" | "pause" | "zusatzzeit";
export type TimeEntryChangeRequest = {
  id: string;
  daySessionId: string;
  gmUserId: string;
  sourceKind: TimeEntryChangeRequestSourceKind;
  sourceId: string;
  workDate: string;
  timezone: string;
  title: string;
  subtitle: string | null;
  requestedActivityType:
    | "sonderaufgabe"
    | "arztbesuch"
    | "werkstatt"
    | "homeoffice"
    | "schulung"
    | "lager"
    | "hoteluebernachtung"
    | "heimfahrt"
    | null;
  originalStartAt: string;
  originalEndAt: string;
  requestedStartAt: string;
  requestedEndAt: string;
  originalStartKm: number | null;
  originalEndKm: number | null;
  requestedStartKm: number | null;
  requestedEndKm: number | null;
  requestNote: string | null;
  status: TimeEntryChangeRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  gm: {
    id: string;
    name: string;
    email: string;
    region: string | null;
  } | null;
};

export type GmTimeEntryChangeRequestResult = {
  ok: boolean;
  request: TimeEntryChangeRequest | null;
};

export type CampaignMarketVisitSummary = BackendCampaignMarketVisitSummary;
export type CampaignMarketVisitStatus = {
  rowId?: string;
  marketId: string;
  kuehlerUnitId?: string | null;
  kuehlerNumber?: string | null;
  targetVisitCount: number;
  submittedVisitCount: number;
  isComplete: boolean;
  hasSubmittedVisit: boolean;
  sessionId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationMinutes: number | null;
  gmUserId: string | null;
  gmName: string | null;
};
export type CampaignMarketVisitStatusBatch = {
  campaignId: string;
  markets: CampaignMarketVisitStatus[];
};
export type CampaignMarketVisitExportIndexItem = {
  campaignId: string;
  marketId: string;
  sessionId: string;
  gmUserId: string | null;
  gmName: string | null;
  startedAt: string;
  submittedAt: string | null;
};
export type AdminPhotoCampaignType = "standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit";
export type AdminPhotoArchiveFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  campaignId?: string;
  campaignType?: AdminPhotoCampaignType;
  dateFrom?: string;
  dateTo?: string;
  week?: string;
  marketId?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  chain?: string;
  gmUserId?: string;
  tagId?: string;
  tagLabel?: string;
  questionId?: string;
  moduleId?: string;
};
export type AdminPhotoArchiveItem = {
  id: string;
  visitAnswerId: string;
  visitSessionId: string;
  storageBucket: string;
  storagePath: string;
  signedUrl: string | null;
  signedUrlExpiresAt: string;
  mimeType: string | null;
  byteSize: number | null;
  widthPx: number | null;
  heightPx: number | null;
  sha256: string | null;
  uploadedAt: string | null;
  tags: Array<{ id: string; photoTagId: string | null; label: string }>;
  question: {
    id: string;
    visitQuestionId: string;
    text: string;
    moduleId: string | null;
    moduleName: string;
    sectionName: string;
  };
  campaign: {
    id: string;
    name: string;
    type: AdminPhotoCampaignType;
    startDate: string | null;
    endDate: string | null;
  };
  market: {
    id: string;
    name: string;
    standardMarketNumber: string | null;
    cokeMasterNumber: string | null;
    kuehlerStammnr: string | null;
    address: string;
    postalCode: string;
    city: string;
    region: string;
    chain: string;
  };
  gm: { id: string; name: string };
  visit: {
    startedAt: string | null;
    submittedAt: string | null;
    durationMinutes: number | null;
  };
  comment: string;
};
export type AdminPhotoArchiveFacets = {
  campaigns: Array<{ id: string; name: string; type: AdminPhotoCampaignType }>;
  gms: Array<{ id: string; name: string }>;
  tags: Array<{ id: string | null; label: string }>;
  regions: string[];
  chains: string[];
};
export type AdminPhotoArchiveResponse = {
  photos: AdminPhotoArchiveItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: { visitedMarkets: number; campaigns: number };
  facets?: AdminPhotoArchiveFacets;
};
export type AdminPhotoSignedUrlVariant = "preview" | "original";
export type AdminPhotoSignedUrl = {
  photoId: string;
  variant: AdminPhotoSignedUrlVariant;
  signedUrl: string | null;
  expiresAt: string;
};
export type CampaignVisitAnswerPatchResult = {
  answerId: string;
  answerStatus: "unanswered" | "answered" | "invalid" | "hidden_by_rule" | "skipped";
  isValid: boolean;
  validationError: string | null;
};
export type CampaignVisitAnswerPatchMissingRequired = {
  visitQuestionId: string;
  questionId: string;
  questionText: string;
  questionType: string;
};
export type AdminIppListRow = Omit<BackendIppListRow, "marketIpp"> & { marketIpp: number };
export type AdminIppDetailRecord = Omit<BackendIppDetailRecord, "marketIpp"> & { marketIpp: number };
export type AdminIppAdjustmentEvent = {
  id: string;
  revisionNumber: number;
  requestId: string;
  gmUserId: string;
  redPeriodId: string;
  eventType: "set" | "clear";
  correctedIpp: number | null;
  baseCalculatedIpp: number;
  baseSampleCount: number;
  baseFingerprint: string;
  reason: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
};
export type AdminIppGmPeriodRow = {
  gmUserId: string;
  gmName: string;
  region: string;
  redPeriodId: string;
  redPeriodLabel: string;
  redPeriodYear: number;
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  calculatedIpp: number;
  effectiveIpp: number;
  difference: number;
  marketSampleCount: number;
  zeroOrUnscoredMarketCount: number;
  sourceSubmissionCount: number;
  baseFingerprint: string;
  calculationSource: "finalized" | "live" | "live_fallback" | "no_data";
  adjustment: AdminIppAdjustmentEvent | null;
  adjustmentIsStale: boolean;
};
export type AdminIppPeriodOption = {
  id: string;
  redYear: number;
  periodIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};
export type TimeTrackingActivityType =
  | "sonderaufgabe"
  | "arztbesuch"
  | "werkstatt"
  | "homeoffice"
  | "schulung"
  | "lager"
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
  doctorConfirmation: {
    isRequired: boolean;
    isUploaded: boolean;
    uploadedAt: string | null;
    fileName: string | null;
  } | null;
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
    staleDayOpen?: boolean;
  };
};

export type GmDashboardCriticalPayload = {
  serverTime: string;
  daySession: DaySessionCurrentPayload;
  activeVisit: {
    sessionId: string;
    startedAt: string;
    marketId: string;
    marketName: string;
    marketAddress: string;
    marketPostalCode: string | null;
    marketCity: string | null;
    campaignIds: string[];
    campaignNames: string[];
  } | null;
  activeTimeTrackingDrafts: TimeTrackingEntry[];
  redPeriod: {
    redPeriodId: string | null;
    label: string;
    startDate: string;
    endDate: string;
    daysUntilEnd: number;
  } | null;
};

export type GmKurtiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  expiresAt: string;
};

export type GmKurtiMessagesPayload = {
  messages: GmKurtiMessage[];
  configured: boolean;
  expiresAt: string | null;
};

export type GmKurtiReplyPayload = {
  messages: GmKurtiMessage[];
  assistantMessage: GmKurtiMessage | null;
  expiresAt: string | null;
};

export type AdminKurtiChartSpec = {
  type: "line" | "bar";
  title: string;
  subtitle: string | null;
  xLabel: string | null;
  yLabel: string | null;
  valueFormat: "number" | "decimal" | "percent" | "currency";
  series: Array<{
    key: string;
    label: string;
  }>;
  points: Array<{
    label: string;
    values: Array<{
      seriesKey: string;
      value: number | null;
    }>;
  }>;
};

export type AdminKurtiVisualizationTone = "red" | "slate" | "amber" | "emerald" | "blue" | "violet" | "cyan" | "pink";
export type AdminKurtiVisualizationValueFormat = "number" | "decimal" | "percent" | "currency" | "duration_minutes" | "duration_hours";

type AdminKurtiVisualizationBase = {
  title: string;
  subtitle: string | null;
  sourceLabel: string | null;
  timeframe: string | null;
  note: string | null;
};

export type AdminKurtiSeriesVisualization = AdminKurtiVisualizationBase & {
  kind: "series";
  variant: "line" | "area" | "bar" | "stacked_bar" | "horizontal_bar" | "combo";
  xLabel: string | null;
  yLabel: string | null;
  valueFormat: AdminKurtiVisualizationValueFormat;
  showLegend: boolean;
  series: Array<{ key: string; label: string; display: "line" | "area" | "bar"; tone: AdminKurtiVisualizationTone }>;
  points: Array<{ label: string; values: Array<number | null> }>;
  referenceLines: Array<{ label: string; value: number }>;
};

export type AdminKurtiCompositionVisualization = AdminKurtiVisualizationBase & {
  kind: "composition";
  variant: "donut" | "pie" | "funnel";
  valueFormat: AdminKurtiVisualizationValueFormat;
  centerLabel: string | null;
  items: Array<{ label: string; value: number; tone: AdminKurtiVisualizationTone }>;
};

export type AdminKurtiScatterVisualization = AdminKurtiVisualizationBase & {
  kind: "scatter";
  xLabel: string;
  yLabel: string;
  xFormat: AdminKurtiVisualizationValueFormat;
  yFormat: AdminKurtiVisualizationValueFormat;
  series: Array<{ key: string; label: string; tone: AdminKurtiVisualizationTone }>;
  points: Array<{ label: string; seriesKey: string; x: number; y: number; size: number | null }>;
};

export type AdminKurtiHeatmapVisualization = AdminKurtiVisualizationBase & {
  kind: "heatmap";
  valueFormat: AdminKurtiVisualizationValueFormat;
  xLabels: string[];
  rows: Array<{ label: string; values: Array<number | null> }>;
};

export type AdminKurtiMetricsVisualization = AdminKurtiVisualizationBase & {
  kind: "metrics";
  columns: "2" | "3" | "4";
  items: Array<{
    label: string;
    value: number | null;
    displayValue: string | null;
    valueFormat: AdminKurtiVisualizationValueFormat;
    delta: number | null;
    deltaLabel: string | null;
    progress: number | null;
    status: "neutral" | "positive" | "warning" | "critical";
  }>;
};

export type AdminKurtiTableVisualization = AdminKurtiVisualizationBase & {
  kind: "table";
  columns: Array<{ key: string; label: string; align: "left" | "center" | "right" }>;
  rows: Array<{ label: string; values: Array<string | null>; status: "neutral" | "positive" | "warning" | "critical" }>;
};

export type AdminKurtiTimelineVisualization = AdminKurtiVisualizationBase & {
  kind: "timeline";
  items: Array<{
    date: string;
    label: string;
    description: string | null;
    value: string | null;
    status: "completed" | "active" | "pending" | "warning" | "critical";
  }>;
};

export type AdminKurtiRadarVisualization = AdminKurtiVisualizationBase & {
  kind: "radar";
  valueFormat: AdminKurtiVisualizationValueFormat;
  maximum: number | null;
  axes: string[];
  series: Array<{ label: string; tone: AdminKurtiVisualizationTone; values: number[] }>;
};

export type AdminKurtiDistributionVisualization = AdminKurtiVisualizationBase & {
  kind: "distribution";
  variant: "histogram" | "box_plot";
  xLabel: string;
  valueFormat: AdminKurtiVisualizationValueFormat;
  binCount: number | null;
  showOutliers: boolean;
  series: Array<{ label: string; tone: AdminKurtiVisualizationTone; values: number[] }>;
};

export type AdminKurtiWaterfallVisualization = AdminKurtiVisualizationBase & {
  kind: "waterfall";
  valueFormat: AdminKurtiVisualizationValueFormat;
  startLabel: string;
  startValue: number;
  steps: Array<{ label: string; value: number }>;
  endLabel: string;
  showConnectors: boolean;
};

export type AdminKurtiTreemapVisualization = AdminKurtiVisualizationBase & {
  kind: "treemap";
  valueFormat: AdminKurtiVisualizationValueFormat;
  items: Array<{ label: string; value: number; tone: AdminKurtiVisualizationTone }>;
};

export type AdminKurtiVisualization =
  | AdminKurtiSeriesVisualization
  | AdminKurtiCompositionVisualization
  | AdminKurtiScatterVisualization
  | AdminKurtiHeatmapVisualization
  | AdminKurtiMetricsVisualization
  | AdminKurtiTableVisualization
  | AdminKurtiTimelineVisualization
  | AdminKurtiRadarVisualization
  | AdminKurtiDistributionVisualization
  | AdminKurtiWaterfallVisualization
  | AdminKurtiTreemapVisualization;

export type AdminKurtiExcelExportKind =
  | "zeiterfassung"
  | "zeitenaufstellung"
  | "diaeten"
  | "maerkte"
  | "gebietsmanager"
  | "shelf_merchandiser"
  | "lager"
  | "fragebogen_standard"
  | "fragebogen_flex"
  | "fragebogen_billa"
  | "fragebogen_kuehler"
  | "fragebogen_mhd"
  | "fragebogen_durcharbeit"
  | "fotoarchiv";

export type AdminKurtiExcelExport = {
  id: string;
  kind: AdminKurtiExcelExportKind;
  title: string;
  description: string | null;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    gmUserIds: string[];
    gmNames: string[];
    regions: string[];
    campaignIds: string[];
    campaignNames: string[];
    marketIds: string[];
    marketSearch: string | null;
    sections: Array<"standard" | "flex" | "billa" | "kuehler" | "mhd" | "durcharbeit">;
    statuses: string[];
    search: string | null;
    includeLive: boolean;
  };
};

export type AdminKurtiMessage = GmKurtiMessage & {
  charts?: AdminKurtiChartSpec[];
  visualizations?: AdminKurtiVisualization[];
  exports?: AdminKurtiExcelExport[];
};

export type AdminKurtiMessagesPayload = {
  messages: AdminKurtiMessage[];
  configured: boolean;
  expiresAt: string | null;
  capabilities: {
    readOnly: boolean;
    crossGm: boolean;
    toolCount: number;
    memoryMinutes: number;
  };
};

export type AdminKurtiReplyPayload = {
  messages: AdminKurtiMessage[];
  assistantMessage: AdminKurtiMessage | null;
  expiresAt: string | null;
};

export type AdminKurtiWindowLayoutInput = {
  panel: { x: number; y: number; width: number; height: number };
  bubble: { x: number; y: number };
  bubbleDismissed: boolean;
  isCollapsed: boolean;
};

export type AdminKurtiWindowLayout = AdminKurtiWindowLayoutInput & {
  updatedAt: string;
};

export type AdminKurtiWindowLayoutPayload = {
  layout: AdminKurtiWindowLayout | null;
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
  comment?: string;
  doctorConfirmation?: {
    isRequired: boolean;
    isUploaded: boolean;
    uploadedAt: string | null;
    fileName: string | null;
  };
  questionnaireType?: string;
  questionnaireTypes?: string[];
};

export type AdminZeiterfassungTimelineSegment = {
  id: string;
  kind: "anfahrt" | "fahrtzeit" | "marktbesuch" | "pause" | "zusatzzeit" | "heimfahrt";
  start: string;
  end: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  subtype?: string;
  comment?: string;
  doctorConfirmation?: {
    isRequired: boolean;
    isUploaded: boolean;
    uploadedAt: string | null;
    fileName: string | null;
  };
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

export type TodaySubmissionsPayload = {
  items: TodaySubmissionItem[];
  timeline?: AdminZeiterfassungTimelineSegment[];
  stats?: AdminZeiterfassungSession["stats"] | null;
  session?: {
    id: string;
    date: string;
    status: "started" | "ended" | "submitted";
    startTime: string;
    endTime: string;
    startKm: number | null;
    endKm: number | null;
  } | null;
};

export type GmZeiterfassungPayload = {
  sessions: AdminZeiterfassungSession[];
  aggregate: AdminZeiterfassungAggregateRow | null;
  meta: {
    from: string;
    to: string;
    includeLive: boolean;
    timezone: string;
    totalSessions: number;
  };
};

export type DaySessionReviewEdit = {
  kind: "day_start" | "day_end" | "marktbesuch" | "pause" | "zusatzzeit";
  segmentId: string;
  startTime: string;
  endTime: string;
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

export type AdminDiaetenExportPayload = {
  month: number;
  year: number;
  timezone: string;
  range: {
    from: string;
    to: string;
    next: string;
  };
  gls: Array<{
    gmId: string;
    firstName: string;
    lastName: string;
    dayTrackings: Array<{
      id: string;
      date: string;
      dayStartAt: string | null;
      dayEndAt: string | null;
      startKm: number | null;
      endKm: number | null;
    }>;
    marketVisits: Array<{
      id: string;
      createdAt: string;
      startAt: string;
      endAt: string;
      marketName: string;
      marketAddress: string;
      marketCity: string;
      marketPostalCode: string;
    }>;
    zusatzEntries: Array<{
      id: string;
      entryDate: string;
      reason: string;
      reasonLabel: string;
      startAt: string;
      endAt: string;
      isWorkTimeDeduction: boolean;
      marketName: string | null;
      location: string | null;
      schulungOrt: string | null;
    }>;
    pauses: Array<{
      id: string;
      date: string;
      startAt: string;
      endAt: string;
    }>;
  }>;
};

export type AdminZeitenaufstellungExportRow = {
  targetObject: string;
  customerNumber: string;
  visitDate: string;
  visitStartTime: string;
  person: string;
  imageCount: number;
  travelDurationMin: number | null;
  visitDurationMin: number | null;
  calculatedFillDurationMin: number;
  comment: string;
  notEvaluable: boolean;
  reason: string;
  questionnaire: string;
};

export type AdminZeitenaufstellungExportPayload = {
  rows: AdminZeitenaufstellungExportRow[];
  meta: {
    from: string;
    to: string;
    timezone: string;
    totalRows: number;
  };
};

export async function fetchGmVisitStartPayload(
  marketId: string,
  campaignIds: string[],
  options: { kuehlerUnitId?: string | null } = {},
): Promise<GmVisitStartPayload> {
  const params = new URLSearchParams({
    marketId,
    campaignIds: campaignIds.join(","),
  });
  if (options.kuehlerUnitId) params.set("kuehlerUnitId", options.kuehlerUnitId);
  return (await authedFetch(`/markets/gm/visit-sessions/start-payload?${params.toString()}`, { cache: "no-store" })) as GmVisitStartPayload;
}

export type GmVisitSessionPayload = GmVisitStartPayload & {
  session: {
    id: string;
    status: "draft" | "submitted" | "cancelled";
    startedAt: string;
    kuehlerUnitId?: string | null;
  };
};

export type GmVisitPreloadCachePayload = GmVisitSessionReadPayload;

const GM_VISIT_PRELOAD_CACHE_PREFIX = "gm_visit_preload_v2:";
const GM_VISIT_START_PRELOAD_CACHE_PREFIX = "gm_visit_start_preload_v1:";
const GM_ACTIVE_VISIT_HANDOFF_CACHE_PREFIX = "gm_active_visit_handoff_v1:";
const GM_VISIT_PRELOAD_CACHE_TTL_MS = 10 * 60 * 1000;
const GM_ACTIVE_VISIT_HANDOFF_CACHE_TTL_MS = 2 * 60 * 1000;

type GmVisitPreloadCacheEnvelope = {
  ownerUserId: string;
  sessionId: string;
  createdAtMs: number;
  payload: GmVisitPreloadCachePayload;
};

const gmVisitPreloadMemoryCache: Record<string, GmVisitPreloadCacheEnvelope> = {};

type GmVisitStartPreloadCacheEnvelope = {
  ownerUserId: string;
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
  createdAtMs: number;
  payload: GmVisitStartPayload;
};

const gmVisitStartPreloadMemoryCache: Record<string, GmVisitStartPreloadCacheEnvelope> = {};

type GmActiveVisitHandoffCacheEnvelope = {
  ownerUserId: string;
  sessionId: string;
  createdAtMs: number;
  payload: GmVisitSessionReadPayload;
};

const gmActiveVisitHandoffMemoryCache: Record<string, GmActiveVisitHandoffCacheEnvelope> = {};

function clearInMemoryGmVisitPreloadCache(): void {
  for (const key of Object.keys(gmVisitPreloadMemoryCache)) {
    delete gmVisitPreloadMemoryCache[key];
  }
  for (const key of Object.keys(gmVisitStartPreloadMemoryCache)) {
    delete gmVisitStartPreloadMemoryCache[key];
  }
  for (const key of Object.keys(gmActiveVisitHandoffMemoryCache)) {
    delete gmActiveVisitHandoffMemoryCache[key];
  }
}

function getActiveAuthUserId(): string | null {
  return readAuthSession()?.user.id ?? null;
}

function getGmVisitPreloadMemoryKey(sessionId: string, userId: string): string {
  return `${userId}:${sessionId}`;
}

function normalizeVisitPreloadCampaignIds(campaignIds: string[]): string[] {
  return Array.from(new Set(campaignIds.map((id) => id.trim()).filter(Boolean))).sort();
}

function normalizeVisitPreloadKuehlerUnitId(kuehlerUnitId?: string | null): string {
  return typeof kuehlerUnitId === "string" ? kuehlerUnitId.trim() : "";
}

function getGmVisitStartPreloadMemoryKey(
  userId: string,
  marketId: string,
  campaignIds: string[],
  kuehlerUnitId?: string | null,
): string {
  return `${userId}:${marketId}:${normalizeVisitPreloadCampaignIds(campaignIds).join(",")}:${normalizeVisitPreloadKuehlerUnitId(kuehlerUnitId)}`;
}

function getGmActiveVisitHandoffMemoryKey(userId: string): string {
  return userId;
}

function getGmActiveVisitHandoffCacheKey(): string {
  const userId = getActiveAuthUserId();
  return userId ? `${GM_ACTIVE_VISIT_HANDOFF_CACHE_PREFIX}${userId}` : `${GM_ACTIVE_VISIT_HANDOFF_CACHE_PREFIX}anon`;
}

export function getGmVisitStartPreloadCacheKey(
  marketId: string,
  campaignIds: string[],
  kuehlerUnitId?: string | null,
): string {
  const userId = getActiveAuthUserId();
  const campaignKey = normalizeVisitPreloadCampaignIds(campaignIds).join(",");
  const unitKey = normalizeVisitPreloadKuehlerUnitId(kuehlerUnitId);
  return userId
    ? `${GM_VISIT_START_PRELOAD_CACHE_PREFIX}${userId}:${marketId}:${campaignKey}:${unitKey}`
    : `${GM_VISIT_START_PRELOAD_CACHE_PREFIX}anon:${marketId}:${campaignKey}:${unitKey}`;
}

export function getGmVisitPreloadCacheKey(sessionId: string): string {
  const userId = getActiveAuthUserId();
  return userId ? `${GM_VISIT_PRELOAD_CACHE_PREFIX}${userId}:${sessionId}` : `${GM_VISIT_PRELOAD_CACHE_PREFIX}anon:${sessionId}`;
}

export function setGmVisitPreloadCache(payload: GmVisitPreloadCachePayload): void {
  const sessionId = payload?.session?.id;
  if (!sessionId) return;
  const userId = getActiveAuthUserId();
  if (!userId) return;
  const envelope: GmVisitPreloadCacheEnvelope = {
    ownerUserId: userId,
    sessionId,
    createdAtMs: Date.now(),
    payload,
  };
  gmVisitPreloadMemoryCache[getGmVisitPreloadMemoryKey(sessionId, userId)] = envelope;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getGmVisitPreloadCacheKey(sessionId), JSON.stringify(envelope));
  } catch {
    // Keep in-memory cache as best-effort fallback.
  }
}

export function readGmVisitPreloadCache(sessionId: string): GmVisitPreloadCachePayload | null {
  const userId = getActiveAuthUserId();
  if (!userId) return null;
  const memoryKey = getGmVisitPreloadMemoryKey(sessionId, userId);
  const inMemory = gmVisitPreloadMemoryCache[memoryKey];
  if (inMemory) {
    if (
      inMemory.ownerUserId === userId &&
      Date.now() - inMemory.createdAtMs <= GM_VISIT_PRELOAD_CACHE_TTL_MS &&
      Array.isArray(inMemory.payload.sections) &&
      inMemory.payload.session?.id === sessionId
    ) {
      return inMemory.payload;
    }
    delete gmVisitPreloadMemoryCache[memoryKey];
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
    if (!parsed || parsed.sessionId !== sessionId || parsed.ownerUserId !== userId) {
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
  const userId = getActiveAuthUserId();
  if (userId) {
    delete gmVisitPreloadMemoryCache[getGmVisitPreloadMemoryKey(sessionId, userId)];
  }
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getGmVisitPreloadCacheKey(sessionId));
  } catch {
    // noop
  }
}

export function setGmVisitStartPreloadCache(input: {
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
  payload: GmVisitStartPayload;
}): void {
  const userId = getActiveAuthUserId();
  if (!userId || !Array.isArray(input.payload.sections)) return;
  const normalizedCampaignIds = normalizeVisitPreloadCampaignIds(input.campaignIds);
  const envelope: GmVisitStartPreloadCacheEnvelope = {
    ownerUserId: userId,
    marketId: input.marketId,
    campaignIds: normalizedCampaignIds,
    kuehlerUnitId: normalizeVisitPreloadKuehlerUnitId(input.kuehlerUnitId) || null,
    createdAtMs: Date.now(),
    payload: input.payload,
  };
  gmVisitStartPreloadMemoryCache[getGmVisitStartPreloadMemoryKey(userId, input.marketId, normalizedCampaignIds, input.kuehlerUnitId)] = envelope;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getGmVisitStartPreloadCacheKey(input.marketId, normalizedCampaignIds, input.kuehlerUnitId), JSON.stringify(envelope));
  } catch {
    // Keep in-memory cache as best-effort fallback.
  }
}

export function readGmVisitStartPreloadCache(input: {
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
}): GmVisitStartPayload | null {
  const userId = getActiveAuthUserId();
  if (!userId) return null;
  const normalizedCampaignIds = normalizeVisitPreloadCampaignIds(input.campaignIds);
  const normalizedKuehlerUnitId = normalizeVisitPreloadKuehlerUnitId(input.kuehlerUnitId);
  const memoryKey = getGmVisitStartPreloadMemoryKey(userId, input.marketId, normalizedCampaignIds, normalizedKuehlerUnitId);
  const inMemory = gmVisitStartPreloadMemoryCache[memoryKey];
  if (inMemory) {
    if (
      inMemory.ownerUserId === userId &&
      inMemory.marketId === input.marketId &&
      inMemory.campaignIds.join(",") === normalizedCampaignIds.join(",") &&
      normalizeVisitPreloadKuehlerUnitId(inMemory.kuehlerUnitId) === normalizedKuehlerUnitId &&
      Date.now() - inMemory.createdAtMs <= GM_VISIT_PRELOAD_CACHE_TTL_MS &&
      Array.isArray(inMemory.payload.sections)
    ) {
      return inMemory.payload;
    }
    delete gmVisitStartPreloadMemoryCache[memoryKey];
  }
  if (typeof window === "undefined") return null;
  const key = getGmVisitStartPreloadCacheKey(input.marketId, normalizedCampaignIds, normalizedKuehlerUnitId);
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GmVisitStartPreloadCacheEnvelope>;
    const parsedCampaignIds = Array.isArray(parsed.campaignIds)
      ? normalizeVisitPreloadCampaignIds(parsed.campaignIds.filter((entry): entry is string => typeof entry === "string"))
      : [];
    if (
      !parsed ||
      parsed.ownerUserId !== userId ||
      parsed.marketId !== input.marketId ||
      parsedCampaignIds.join(",") !== normalizedCampaignIds.join(",") ||
      normalizeVisitPreloadKuehlerUnitId(parsed.kuehlerUnitId) !== normalizedKuehlerUnitId
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const createdAtMs = Number(parsed.createdAtMs ?? 0);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > GM_VISIT_PRELOAD_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const payload = parsed.payload;
    if (!payload || !Array.isArray(payload.sections)) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function clearGmVisitStartPreloadCache(input: {
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
}): void {
  const userId = getActiveAuthUserId();
  const normalizedCampaignIds = normalizeVisitPreloadCampaignIds(input.campaignIds);
  const normalizedKuehlerUnitId = normalizeVisitPreloadKuehlerUnitId(input.kuehlerUnitId);
  if (userId) {
    delete gmVisitStartPreloadMemoryCache[getGmVisitStartPreloadMemoryKey(userId, input.marketId, normalizedCampaignIds, normalizedKuehlerUnitId)];
  }
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getGmVisitStartPreloadCacheKey(input.marketId, normalizedCampaignIds, normalizedKuehlerUnitId));
  } catch {
    // noop
  }
}

export function setLatestActiveGmVisitHandoff(payload: GmVisitSessionReadPayload): void {
  const userId = getActiveAuthUserId();
  const sessionId = payload?.session?.id;
  if (!userId || !sessionId || payload.session.status !== "draft" || payload.session.submittedAt) return;
  const envelope: GmActiveVisitHandoffCacheEnvelope = {
    ownerUserId: userId,
    sessionId,
    createdAtMs: Date.now(),
    payload,
  };
  gmActiveVisitHandoffMemoryCache[getGmActiveVisitHandoffMemoryKey(userId)] = envelope;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getGmActiveVisitHandoffCacheKey(), JSON.stringify(envelope));
  } catch {
    // Keep in-memory cache as best-effort fallback.
  }
}

export function readLatestActiveGmVisitHandoff(): GmVisitSessionReadPayload | null {
  const userId = getActiveAuthUserId();
  if (!userId) return null;
  const memoryKey = getGmActiveVisitHandoffMemoryKey(userId);
  const inMemory = gmActiveVisitHandoffMemoryCache[memoryKey];
  if (inMemory) {
    if (
      inMemory.ownerUserId === userId &&
      Date.now() - inMemory.createdAtMs <= GM_ACTIVE_VISIT_HANDOFF_CACHE_TTL_MS &&
      inMemory.payload.session?.id === inMemory.sessionId &&
      inMemory.payload.session.status === "draft" &&
      !inMemory.payload.session.submittedAt
    ) {
      return inMemory.payload;
    }
    delete gmActiveVisitHandoffMemoryCache[memoryKey];
  }
  if (typeof window === "undefined") return null;
  const key = getGmActiveVisitHandoffCacheKey();
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GmActiveVisitHandoffCacheEnvelope>;
    const createdAtMs = Number(parsed.createdAtMs ?? 0);
    const payload = parsed.payload;
    if (
      !parsed ||
      parsed.ownerUserId !== userId ||
      !parsed.sessionId ||
      !Number.isFinite(createdAtMs) ||
      Date.now() - createdAtMs > GM_ACTIVE_VISIT_HANDOFF_CACHE_TTL_MS ||
      !payload ||
      payload.session?.id !== parsed.sessionId ||
      payload.session.status !== "draft" ||
      payload.session.submittedAt
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function clearLatestActiveGmVisitHandoff(sessionId?: string): void {
  const userId = getActiveAuthUserId();
  if (userId) {
    const memoryKey = getGmActiveVisitHandoffMemoryKey(userId);
    const inMemory = gmActiveVisitHandoffMemoryCache[memoryKey];
    if (!sessionId || inMemory?.sessionId === sessionId) {
      delete gmActiveVisitHandoffMemoryCache[memoryKey];
    }
  }
  if (typeof window === "undefined") return;
  const key = getGmActiveVisitHandoffCacheKey();
  try {
    if (!sessionId) {
      window.sessionStorage.removeItem(key);
      return;
    }
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<GmActiveVisitHandoffCacheEnvelope>;
    if (parsed.sessionId === sessionId) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    window.sessionStorage.removeItem(key);
  }
}

export async function fetchGmVisitSession(sessionId: string): Promise<GmVisitSessionReadPayload> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}`, { cache: "no-store" })) as GmVisitSessionReadPayload;
}

export async function syncGmVisitSessionSpezialfragen(
  sessionId: string,
): Promise<{ ok: boolean; addedQuestionCount: number }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/spezialfragen/sync`, {
    method: "POST",
  })) as { ok: boolean; addedQuestionCount: number };
}

export async function fetchGmCompletedVisitSessions(input: { limit?: number } = {}): Promise<GmCompletedVisitSummary[]> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  const response = (await authedFetch(
    `/markets/gm/visit-sessions/completed${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  )) as { visits?: GmCompletedVisitSummary[] };
  return response.visits ?? [];
}

export async function requestGmVisitAnswerChange(input: {
  sessionId: string;
  visitQuestionId: string;
  requestedAnswerPayload: Record<string, unknown>;
  requestedAnswerSummary: string;
  requestNote?: string;
}): Promise<GmVisitAnswerChangeRequestResult> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/change-requests`, {
    method: "POST",
    body: JSON.stringify({
      visitQuestionId: input.visitQuestionId,
      requestedAnswerPayload: input.requestedAnswerPayload,
      requestedAnswerSummary: input.requestedAnswerSummary,
      ...(input.requestNote?.trim() ? { requestNote: input.requestNote.trim() } : {}),
    }),
  })) as GmVisitAnswerChangeRequestResult;
}

export async function fetchGmAnswerChangeRequests(): Promise<GmAnswerChangeRequest[]> {
  const response = (await authedFetch("/markets/gm/visit-sessions/change-requests", {
    cache: "no-store",
  })) as { requests?: GmAnswerChangeRequest[] };
  return response.requests ?? [];
}

export async function requestGmVisitSessionDelete(input: {
  sessionId: string;
  requestNote?: string;
}): Promise<GmVisitSessionDeleteRequestResult> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/delete-request`, {
    method: "POST",
    body: JSON.stringify({
      ...(input.requestNote?.trim() ? { requestNote: input.requestNote.trim() } : {}),
    }),
  })) as GmVisitSessionDeleteRequestResult;
}

export async function fetchGmVisitSessionDeleteRequests(): Promise<GmVisitSessionDeleteRequest[]> {
  const response = (await authedFetch("/markets/gm/visit-sessions/delete-requests", {
    cache: "no-store",
  })) as { requests?: GmVisitSessionDeleteRequest[] };
  return response.requests ?? [];
}

export async function fetchGmTimeEntryChangeRequests(input: { from?: string; to?: string } = {}): Promise<TimeEntryChangeRequest[]> {
  const params = new URLSearchParams();
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  const query = params.toString();
  const response = (await authedFetch(`/day-session/time-change-requests${query ? `?${query}` : ""}`, {
    cache: "no-store",
  })) as { requests?: TimeEntryChangeRequest[] };
  return response.requests ?? [];
}

export async function requestGmTimeEntryChange(input: {
  sessionId: string;
  kind: TimeEntryChangeRequestSourceKind;
  segmentId: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
  requestedStartKm?: number;
  requestedEndKm?: number;
  requestNote?: string;
}): Promise<GmTimeEntryChangeRequestResult> {
  return (await authedFetch("/day-session/time-change-requests", {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      kind: input.kind,
      segmentId: input.segmentId,
      ...(input.requestedStartTime !== undefined ? { requestedStartTime: input.requestedStartTime } : {}),
      ...(input.requestedEndTime !== undefined ? { requestedEndTime: input.requestedEndTime } : {}),
      ...(input.requestedStartKm !== undefined ? { requestedStartKm: input.requestedStartKm } : {}),
      ...(input.requestedEndKm !== undefined ? { requestedEndKm: input.requestedEndKm } : {}),
      ...(input.requestNote?.trim() ? { requestNote: input.requestNote.trim() } : {}),
    }),
  })) as GmTimeEntryChangeRequestResult;
}

export async function requestGmAdditionalTimeEntry(input: {
  sessionId: string;
  activityType: Exclude<TimeTrackingActivityType, "hotel">;
  requestedStartTime: string;
  requestedEndTime: string;
  comment?: string;
  requestNote?: string;
}): Promise<GmTimeEntryChangeRequestResult> {
  return (await authedFetch("/day-session/time-change-requests/zusatzzeit", {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      activityType: input.activityType,
      requestedStartTime: input.requestedStartTime,
      requestedEndTime: input.requestedEndTime,
      ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
      ...(input.requestNote?.trim() ? { requestNote: input.requestNote.trim() } : {}),
    }),
  })) as GmTimeEntryChangeRequestResult;
}

export async function fetchAdminAnswerChangeRequests(): Promise<AdminAnswerChangeRequest[]> {
  const response = (await authedFetch("/admin/campaigns/answer-change-requests", {
    cache: "no-store",
  })) as { requests?: AdminAnswerChangeRequest[] };
  return response.requests ?? [];
}

export async function fetchAdminVisitSessionDeleteRequests(): Promise<AdminVisitSessionDeleteRequest[]> {
  const response = (await authedFetch("/admin/campaigns/visit-session-delete-requests", {
    cache: "no-store",
  })) as { requests?: AdminVisitSessionDeleteRequest[] };
  return response.requests ?? [];
}

export async function fetchAdminTimeEntryChangeRequests(): Promise<TimeEntryChangeRequest[]> {
  const response = (await authedFetch("/admin/time-change-requests", {
    cache: "no-store",
  })) as { requests?: TimeEntryChangeRequest[] };
  return response.requests ?? [];
}

export async function approveAdminAnswerChangeRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: { id: string; status: "approved" }; answerId?: string }> {
  return (await authedFetch(`/admin/campaigns/answer-change-requests/${requestId}/approve`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: { id: string; status: "approved" }; answerId?: string };
}

export async function rejectAdminAnswerChangeRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: { id: string; status: "rejected"; updatedAt?: string } }> {
  return (await authedFetch(`/admin/campaigns/answer-change-requests/${requestId}/reject`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: { id: string; status: "rejected"; updatedAt?: string } };
}

export async function approveAdminVisitSessionDeleteRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: { id: string; status: "approved" }; sessionId?: string }> {
  return (await authedFetch(`/admin/campaigns/visit-session-delete-requests/${requestId}/approve`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: { id: string; status: "approved" }; sessionId?: string };
}

export async function rejectAdminVisitSessionDeleteRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: { id: string; status: "rejected"; updatedAt?: string } }> {
  return (await authedFetch(`/admin/campaigns/visit-session-delete-requests/${requestId}/reject`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: { id: string; status: "rejected"; updatedAt?: string } };
}

export async function approveAdminTimeEntryChangeRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: TimeEntryChangeRequest | null }> {
  return (await authedFetch(`/admin/time-change-requests/${requestId}/approve`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: TimeEntryChangeRequest | null };
}

export async function rejectAdminTimeEntryChangeRequest(
  requestId: string,
  input: { adminNote?: string } = {},
): Promise<{ ok: boolean; request: TimeEntryChangeRequest | null }> {
  return (await authedFetch(`/admin/time-change-requests/${requestId}/reject`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: boolean; request: TimeEntryChangeRequest | null };
}

export async function fetchActiveGmVisitSession(input: {
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
}): Promise<GmVisitSessionPayload | { session: null }> {
  const params = new URLSearchParams({
    marketId: input.marketId,
    campaignIds: input.campaignIds.join(","),
  });
  if (input.kuehlerUnitId) params.set("kuehlerUnitId", input.kuehlerUnitId);
  return (await authedFetch(`/markets/gm/visit-sessions/active?${params.toString()}`, { cache: "no-store" })) as GmVisitSessionPayload | { session: null };
}

export async function fetchLatestActiveGmVisitSession(): Promise<GmVisitSessionPayload | { session: null }> {
  return (await authedFetch("/markets/gm/visit-sessions/latest-active", { cache: "no-store" })) as GmVisitSessionPayload | { session: null };
}

export async function createGmVisitSession(input: {
  marketId: string;
  campaignIds: string[];
  kuehlerUnitId?: string | null;
  clientSessionToken?: string;
  startedAt?: string;
}): Promise<GmVisitSessionPayload> {
  return (await authedFetch("/markets/gm/visit-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  })) as GmVisitSessionPayload;
}

export async function cancelGmVisitSession(sessionId: string): Promise<{ ok: boolean; sessionId: string; status: "cancelled" }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}`, {
    method: "DELETE",
  })) as { ok: boolean; sessionId: string; status: "cancelled" };
}

export async function updateGmVisitSessionStart(
  sessionId: string,
  input: { startedAt: string },
): Promise<{ ok: boolean; session: { id: string; status: "draft"; startedAt: string; submittedAt: null } }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/start`, {
    method: "PATCH",
    body: JSON.stringify({ startedAt: input.startedAt }),
  })) as { ok: boolean; session: { id: string; status: "draft"; startedAt: string; submittedAt: null } };
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

export async function submitGmVisitSession(
  sessionId: string,
  input?: { startedAt?: string; submittedAt?: string },
): Promise<{ ok: boolean; sessionId: string; status: "submitted" }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      ...(input?.startedAt ? { startedAt: input.startedAt } : {}),
      ...(input?.submittedAt ? { submittedAt: input.submittedAt } : {}),
    }),
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

export async function deleteGmVisitPhoto(input: {
  sessionId: string;
  visitAnswerId: string;
  storagePath: string;
}): Promise<{ ok: boolean }> {
  const { sessionId, visitAnswerId, storagePath } = input;
  return (await authedFetch(`/markets/gm/visit-sessions/${sessionId}/photos/delete`, {
    method: "POST",
    body: JSON.stringify({ visitAnswerId, storagePath }),
  })) as { ok: boolean };
}

export async function updateInheritedGmVisitPhotoTags(input: {
  sessionId: string;
  photos: Array<{ photoId: string; photoTagIds: string[] }>;
}): Promise<{ ok: boolean }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/inherited-photos/tags`, {
    method: "PATCH",
    body: JSON.stringify({ photos: input.photos }),
  })) as { ok: boolean };
}

export async function deleteInheritedGmVisitPhoto(input: {
  sessionId: string;
  photoId: string;
}): Promise<{ ok: boolean }> {
  return (await authedFetch(`/markets/gm/visit-sessions/${input.sessionId}/inherited-photos/delete`, {
    method: "POST",
    body: JSON.stringify({ photoId: input.photoId }),
  })) as { ok: boolean };
}

export async function importMarkets(input: ImportMarketsInput): Promise<{ markets: MarketRecord[]; summary: ImportSummary }> {
  const data = (await authedFetch("/admin/markets/import", {
    method: "POST",
    body: JSON.stringify(input),
  }, 300000)) as { markets?: BackendMarket[]; summary: ImportSummary };

  const result = {
    markets: (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market)),
    summary: data.summary,
  };
  invalidateMarketsDirectoryCache();
  return result;
}

export async function patchAdminZeiterfassungSegment(input: {
  sessionId: string;
  segmentKind: "marktbesuch" | "pause" | "zusatzzeit";
  segmentId: string;
  startTime?: string;
  endTime?: string;
  comment?: string | null;
}): Promise<{ ok: boolean }> {
  return (await authedFetch(`/admin/zeiterfassung/segments/${encodeURIComponent(input.segmentKind)}/${encodeURIComponent(input.segmentId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      sessionId: input.sessionId,
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    }),
  })) as { ok: boolean };
}

export async function patchAdminZeiterfassungDaySession(input: {
  sessionId: string;
  startTime?: string;
  endTime?: string;
  startKm?: number;
  endKm?: number;
}): Promise<{ ok: boolean }> {
  return (await authedFetch(`/admin/zeiterfassung/day-sessions/${encodeURIComponent(input.sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.startKm !== undefined ? { startKm: input.startKm } : {}),
      ...(input.endKm !== undefined ? { endKm: input.endKm } : {}),
    }),
  })) as { ok: boolean };
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

  const next = mapBackendMarketToMarketRecord(data.market);
  invalidateMarketsDirectoryCache();
  return next;
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

  const next = mapBackendMarketToMarketRecord(data.market);
  invalidateMarketsDirectoryCache();
  return next;
}

export async function updateMarketUniverseMarket(
  marketId: string,
  universeMarket: boolean,
): Promise<{ id: string; universeMarket: boolean }> {
  const data = (await authedFetch(`/admin/markets/${encodeURIComponent(marketId)}/universe-market`, {
    method: "PATCH",
    body: JSON.stringify({ universeMarket }),
  })) as { market: { id: string; universeMarket: boolean } };

  invalidateMarketsDirectoryCache();
  return data.market;
}

export async function softDeleteMarket(marketId: string): Promise<void> {
  await authedFetch(`/admin/markets/${marketId}/delete`, { method: "PATCH" });
  invalidateMarketsDirectoryCache();
}

export async function hardDeleteMarket(marketId: string): Promise<void> {
  await authedFetch(`/admin/markets/${marketId}/hard-delete`, { method: "DELETE" });
  invalidateMarketsDirectoryCache();
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
  kuehlerTechnicalIdentNo?: string | null;
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
      kuehlerTechnicalIdentNo: input.kuehlerTechnicalIdentNo ?? undefined,
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
      kuehlerTechnicalIdentNo: input.kuehlerTechnicalIdentNo ?? undefined,
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
    redSurvey: Object.prototype.hasOwnProperty.call(input, "redSurvey") ? (input.redSurvey ?? null) : null,
    singleChoiceAvailability: Object.prototype.hasOwnProperty.call(input, "singleChoiceAvailability")
      ? (input.singleChoiceAvailability ?? null)
      : null,
    singleChoiceAvailabilityType: Object.prototype.hasOwnProperty.call(input, "singleChoiceAvailabilityType")
      ? (input.singleChoiceAvailabilityType ?? null)
      : null,
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
  const startDate = input.startDate ?? null;
  const endDate = input.endDate ?? null;
  return {
    id: input.id,
    name: input.name,
    section: input.section,
    assignedGmUserId: input.assignedGmUserId ?? null,
    assignedGmName: input.assignedGmName ?? null,
    currentFragebogenId: input.currentFragebogenId ?? null,
    currentFragebogenName: input.currentFragebogenName ?? null,
    status: input.status,
    scheduleType: input.scheduleType,
    startDate,
    endDate,
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

export type FragebogenScope = "main" | "kuehler" | "mhd" | "durcharbeit";

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

export async function fetchSpezialfragenLibrary(scope: FragebogenScope = "main"): Promise<Question[]> {
  const data = (await authedFetch(`/admin/spezialfragen?scope=${encodeURIComponent(scope)}`)) as { spezialfragen?: Question[] };
  return (data.spezialfragen ?? []).map(normalizeQuestion);
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
  const data = await authedFetch(`/admin/fragebogen/${scope}/${fragebogen.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const persisted = data && typeof data === "object" && "fragebogen" in data
    ? (data as { fragebogen?: Fragebogen }).fragebogen
    : undefined;

  // A successful PATCH has already committed the submitted state. Keep the
  // editor usable if an intermediary returns an empty/non-JSON success body.
  return normalizeFragebogen(persisted ?? fragebogen);
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

export async function duplicateFragebogenToDurcharbeitBackend(
  sourceScope: FragebogenScope,
  fragebogenId: string,
): Promise<{ fragebogen: Fragebogen; modules: Module[] }> {
  const data = (await authedFetch(`/admin/fragebogen/${sourceScope}/${fragebogenId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ targetScope: "durcharbeit" }),
  })) as { fragebogen: Fragebogen; modules?: Module[] };

  return {
    fragebogen: normalizeFragebogen(data.fragebogen),
    modules: (data.modules ?? []).map(normalizeModule),
  };
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const data = (await authedFetch("/admin/campaigns")) as { campaigns?: BackendCampaign[] };
  return (data.campaigns ?? []).map(normalizeCampaign);
}

export async function fetchCampaignAssignedMarkets(campaignIds: string[]): Promise<MarketRecord[]> {
  const uniqueCampaignIds = Array.from(new Set(campaignIds.map((entry) => entry.trim()).filter(Boolean)));
  if (uniqueCampaignIds.length === 0) return [];
  const params = new URLSearchParams({ campaignIds: uniqueCampaignIds.join(",") });
  const data = (await authedFetch(`/admin/campaigns/assigned-markets?${params.toString()}`)) as { markets?: BackendMarket[] };
  return (data.markets ?? []).map((market) => mapBackendMarketToMarketRecord(market));
}

export async function fetchAdminPhotos(input: AdminPhotoArchiveFilters = {}): Promise<AdminPhotoArchiveResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    const serialized = String(value).trim();
    if (!serialized) continue;
    params.set(key, serialized);
  }
  const query = params.toString();
  return (await authedFetch(`/admin/photos${query ? `?${query}` : ""}`, {}, 30000)) as AdminPhotoArchiveResponse;
}

export async function fetchAdminPhotoFacets(): Promise<AdminPhotoArchiveFacets> {
  const data = (await authedFetch("/admin/photos/facets", {}, 30000)) as {
    facets?: AdminPhotoArchiveFacets;
  };
  return data.facets ?? { campaigns: [], gms: [], tags: [], regions: [], chains: [] };
}

export async function fetchAdminPhotoSignedUrls(
  photoIds: string[],
  variant: AdminPhotoSignedUrlVariant,
): Promise<AdminPhotoSignedUrl[]> {
  const uniquePhotoIds = Array.from(new Set(photoIds.map((entry) => entry.trim()).filter(Boolean))).slice(0, 40);
  if (uniquePhotoIds.length === 0) return [];
  const data = (await authedFetch("/admin/photos/signed-urls", {
    method: "POST",
    body: JSON.stringify({ photoIds: uniquePhotoIds, variant }),
  }, 30000)) as {
    urls?: AdminPhotoSignedUrl[];
  };
  return data.urls ?? [];
}

function photoExportFilename(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim());
    } catch {
      // Fall through to the plain filename and deterministic fallback.
    }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() || `CokeSpark_Fotoexport_${new Date().toISOString().slice(0, 10)}.zip`;
}

async function fetchAdminPhotoExportResponse(filters: AdminPhotoArchiveFilters): Promise<Response> {
  const firstToken = getAccessToken();
  if (!firstToken) {
    handleAuthExpired("missing-access-token");
    throw new Error("Nicht eingeloggt. Bitte erneut anmelden.");
  }
  const { page: _page, pageSize: _pageSize, ...exportFilters } = filters;
  const request = (accessToken: string) => fetch(`${BACKEND_URL}/admin/photos/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...getKundePageKeyHeader(),
    },
    body: JSON.stringify({ filters: exportFilters }),
  });

  let response = await request(firstToken);
  if (response.status === 401) {
    const refreshed = await refreshAuthSession();
    if (refreshed) response = await request(refreshed.session.accessToken);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const code = typeof data?.code === "string" ? data.code : null;
    if (isAuthFailureStatus(response.status, code)) {
      handleAuthExpired(`api-auth-failed:${response.status}`);
    }
    throw new BackendApiError(
      typeof data?.error === "string" ? data.error : "Fotoarchiv-Export konnte nicht erstellt werden.",
      response.status,
      code,
      data,
    );
  }
  return response;
}

export async function downloadAdminPhotoArchiveZip(
  filters: AdminPhotoArchiveFilters,
): Promise<{ downloaded: boolean; filename: string | null }> {
  type SaveFileHandle = {
    createWritable: () => Promise<WritableStream<Uint8Array>>;
  };
  type SaveFilePickerWindow = Window & {
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<SaveFileHandle>;
  };

  const suggestedName = `CokeSpark_Fotoexport_${new Date().toISOString().slice(0, 10)}.zip`;
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  let fileHandle: SaveFileHandle | null = null;
  if (typeof picker === "function") {
    try {
      fileHandle = await picker({
        suggestedName,
        types: [{ description: "ZIP-Archiv", accept: { "application/zip": [".zip"] } }],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { downloaded: false, filename: null };
      }
      throw error;
    }
  }

  const response = await fetchAdminPhotoExportResponse(filters);
  const filename = photoExportFilename(response);
  if (fileHandle && response.body) {
    const writable = await fileHandle.createWritable();
    await response.body.pipeTo(writable);
    return { downloaded: true, filename };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { downloaded: true, filename };
}

export async function fetchAdminPhotoDetail(photoId: string): Promise<AdminPhotoArchiveItem> {
  const data = (await authedFetch(`/admin/photos/${encodeURIComponent(photoId)}`, {}, 30000)) as {
    photo?: AdminPhotoArchiveItem;
  };
  if (!data.photo) {
    throw new BackendApiError("Foto konnte nicht geladen werden.", 500, "photo_detail_missing", data);
  }
  return data.photo;
}

export async function updateAdminPhotoTags(photoId: string, photoTagIds: string[]): Promise<AdminPhotoArchiveItem["tags"]> {
  const data = (await authedFetch(`/admin/photos/${encodeURIComponent(photoId)}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ photoTagIds: Array.from(new Set(photoTagIds)) }),
  })) as { tags?: AdminPhotoArchiveItem["tags"] };
  return data.tags ?? [];
}

export async function fetchCampaignMarketVisitStatuses(
  campaignIds: string[],
  dateRange?: { dateFrom?: string; dateTo?: string },
): Promise<CampaignMarketVisitStatusBatch[]> {
  const uniqueCampaignIds = Array.from(new Set(campaignIds.map((entry) => entry.trim()).filter(Boolean)));
  if (uniqueCampaignIds.length === 0) return [];
  const params = new URLSearchParams({ campaignIds: uniqueCampaignIds.join(",") });
  if (dateRange?.dateFrom) params.set("dateFrom", dateRange.dateFrom);
  if (dateRange?.dateTo) params.set("dateTo", dateRange.dateTo);
  const data = (await authedFetch(`/admin/campaigns/market-visit-status?${params.toString()}`)) as {
    campaigns?: CampaignMarketVisitStatusBatch[];
  };
  return data.campaigns ?? [];
}

export async function fetchCampaignMarketVisitExportIndex(
  campaignIds: string[],
  dateRange?: { dateFrom?: string; dateTo?: string },
): Promise<CampaignMarketVisitExportIndexItem[]> {
  const uniqueCampaignIds = Array.from(new Set(campaignIds.map((entry) => entry.trim()).filter(Boolean)));
  if (uniqueCampaignIds.length === 0) return [];
  const params = new URLSearchParams({ campaignIds: uniqueCampaignIds.join(",") });
  if (dateRange?.dateFrom) params.set("dateFrom", dateRange.dateFrom);
  if (dateRange?.dateTo) params.set("dateTo", dateRange.dateTo);
  const data = (await authedFetch(`/admin/campaigns/market-visit-export-index?${params.toString()}`, {}, 60000)) as {
    visits?: CampaignMarketVisitExportIndexItem[];
  };
  return data.visits ?? [];
}

export async function fetchCampaignMarketVisitExportDetails(input: {
  campaignId: string;
  visits: Array<{ marketId: string; sessionId: string }>;
}): Promise<CampaignMarketVisitSummary[]> {
  if (input.visits.length === 0) return [];
  const data = (await authedFetch(
    `/admin/campaigns/${encodeURIComponent(input.campaignId)}/market-visits/export-details`,
    {
      method: "POST",
      body: JSON.stringify({ visits: input.visits }),
    },
    60000,
  )) as {
    markets?: BackendCampaignMarketVisitSummary[];
  };
  return data.markets ?? [];
}

export async function fetchCampaignMarketVisitSummaries(
  campaignId: string,
  options?: { timeoutMs?: number },
): Promise<CampaignMarketVisitSummary[]> {
  const data = (await authedFetch(
    `/admin/campaigns/${campaignId}/market-visits`,
    {},
    options?.timeoutMs ?? 30000,
  )) as {
    markets?: BackendCampaignMarketVisitSummary[];
  };
  return data.markets ?? [];
}

export async function fetchCampaignMarketVisitDetail(
  input: { campaignId: string; marketId: string; sessionId?: string | null; includePhotoSignedUrls?: boolean },
  options?: { timeoutMs?: number },
): Promise<CampaignMarketVisitSummary> {
  const params = new URLSearchParams();
  if (input.sessionId) params.set("sessionId", input.sessionId);
  if (input.includePhotoSignedUrls === false) params.set("includePhotoSignedUrls", "false");
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = (await authedFetch(
    `/admin/campaigns/${encodeURIComponent(input.campaignId)}/markets/${encodeURIComponent(input.marketId)}/visit-detail${query}`,
    {},
    options?.timeoutMs ?? 30000,
  )) as {
    market?: BackendCampaignMarketVisitSummary;
  };
  if (!data.market) {
    throw new BackendApiError("Besuchsdetails konnten nicht geladen werden.", 500, "visit_detail_missing", data);
  }
  return data.market;
}

export async function deleteAdminCampaignVisitPhoto(input: {
  sessionId: string;
  photoId: string;
}): Promise<{ ok: boolean }> {
  return (await authedFetch(
    `/admin/campaigns/visit-sessions/${encodeURIComponent(input.sessionId)}/photos/${encodeURIComponent(input.photoId)}`,
    { method: "DELETE" },
    30000,
  )) as { ok: boolean };
}

export async function patchCampaignVisitAnswer(input: {
  sessionId: string;
  visitQuestionId: string;
  answer: unknown;
  comment?: string;
}): Promise<{ ok: boolean; result: CampaignVisitAnswerPatchResult }> {
  const data = (await authedFetch(`/admin/campaigns/visit-sessions/${encodeURIComponent(input.sessionId)}/answers`, {
    method: "PATCH",
    body: JSON.stringify({
      visitQuestionId: input.visitQuestionId,
      answer: input.answer,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    }),
  })) as { ok: boolean; result: CampaignVisitAnswerPatchResult };
  return data;
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

export async function hardDeleteCampaign(campaignId: string, confirmationText: string): Promise<void> {
  await authedFetch(`/admin/campaigns/${campaignId}/hard-delete`, {
    method: "DELETE",
    body: JSON.stringify({ confirmationText }),
  });
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

export async function reassignCampaignGms(
  campaignId: string,
  reassignments: Array<{ fromGmUserId: string; toGmUserId: string }>,
): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/gm-reassignments`, {
    method: "PATCH",
    body: JSON.stringify({ reassignments }),
  })) as { campaign: BackendCampaign };
  return normalizeCampaign(data.campaign);
}

export async function setFlexCampaignAudience(
  campaignId: string,
  gmUserId: string | null,
): Promise<Campaign> {
  const data = (await authedFetch(`/admin/campaigns/${campaignId}/flex-audience`, {
    method: "PATCH",
    body: JSON.stringify({ gmUserId }),
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

function normalizeAdminIppAdjustmentEvent(event: AdminIppAdjustmentEvent): AdminIppAdjustmentEvent {
  return {
    ...event,
    revisionNumber: Number(event.revisionNumber),
    correctedIpp: event.correctedIpp == null ? null : Number(event.correctedIpp),
    baseCalculatedIpp: Number(event.baseCalculatedIpp ?? 0),
    baseSampleCount: Number(event.baseSampleCount ?? 0),
  };
}

function normalizeAdminIppGmPeriodRow(row: AdminIppGmPeriodRow): AdminIppGmPeriodRow {
  return {
    ...row,
    calculatedIpp: Number(row.calculatedIpp ?? 0),
    effectiveIpp: Number(row.effectiveIpp ?? 0),
    difference: Number(row.difference ?? 0),
    marketSampleCount: Number(row.marketSampleCount ?? 0),
    zeroOrUnscoredMarketCount: Number(row.zeroOrUnscoredMarketCount ?? 0),
    sourceSubmissionCount: Number(row.sourceSubmissionCount ?? 0),
    adjustment: row.adjustment ? normalizeAdminIppAdjustmentEvent(row.adjustment) : null,
  };
}

export async function fetchAdminIppGmPeriods(periodStart?: string): Promise<{
  periods: AdminIppPeriodOption[];
  selectedPeriod: AdminIppPeriodOption;
  rows: AdminIppGmPeriodRow[];
  canEdit: boolean;
}> {
  const params = new URLSearchParams();
  if (periodStart) params.set("periodStart", periodStart);
  const data = (await authedFetch(`/admin/ipp/gm-periods${params.size ? `?${params.toString()}` : ""}`)) as {
    periods: AdminIppPeriodOption[];
    selectedPeriod: AdminIppPeriodOption;
    rows: AdminIppGmPeriodRow[];
    canEdit: boolean;
  };
  return { ...data, rows: (data.rows ?? []).map(normalizeAdminIppGmPeriodRow) };
}

export async function fetchAdminIppAdjustmentHistory(gmUserId: string, redPeriodId: string): Promise<AdminIppAdjustmentEvent[]> {
  const params = new URLSearchParams({ redPeriodId });
  const data = (await authedFetch(`/admin/ipp/gm-periods/${gmUserId}/history?${params.toString()}`)) as {
    events?: AdminIppAdjustmentEvent[];
  };
  return (data.events ?? []).map(normalizeAdminIppAdjustmentEvent);
}

export async function saveAdminIppAdjustment(input: {
  gmUserId: string;
  requestId: string;
  redPeriodId: string;
  correctedIpp: number;
  reason: string;
  expectedBaseFingerprint: string;
  expectedLatestRevisionNumber: number | null;
}): Promise<AdminIppGmPeriodRow> {
  const { gmUserId, ...body } = input;
  const data = (await authedFetch(`/admin/ipp/gm-periods/${gmUserId}/adjustments`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as { row: AdminIppGmPeriodRow };
  return normalizeAdminIppGmPeriodRow(data.row);
}

export async function clearAdminIppAdjustment(input: {
  gmUserId: string;
  requestId: string;
  redPeriodId: string;
  reason: string;
  expectedBaseFingerprint: string;
  expectedLatestRevisionNumber: number;
}): Promise<AdminIppGmPeriodRow> {
  const { gmUserId, ...body } = input;
  const data = (await authedFetch(`/admin/ipp/gm-periods/${gmUserId}/adjustments/clear`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as { row: AdminIppGmPeriodRow };
  return normalizeAdminIppGmPeriodRow(data.row);
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

export async function fetchRedMonthYears(): Promise<{ years: RedMonthYear[]; current: RedMonthPeriod | null }> {
  const data = (await authedFetch("/admin/red-month/years")) as {
    years?: BackendRedMonthYear[];
    current?: BackendRedMonthPeriod;
  };
  return {
    years: (data.years ?? []).map(mapBackendRedMonthYear),
    current: data.current ? mapBackendRedMonthPeriod(data.current) : null,
  };
}

export async function previewRedMonthYear(input: {
  redYear: number;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone?: string;
}): Promise<{ periods: RedMonthPeriod[] }> {
  const data = (await authedFetch("/admin/red-month/years/preview", {
    method: "POST",
    body: JSON.stringify(input),
  })) as {
    periods?: BackendRedMonthPeriod[];
  };
  return {
    periods: (data.periods ?? []).map(mapBackendRedMonthPeriod),
  };
}

export async function createRedMonthYear(input: {
  redYear: number;
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone?: string;
  status?: "draft" | "active" | "locked";
}): Promise<{ year: RedMonthYear; periods: RedMonthPeriod[] }> {
  const data = (await authedFetch("/admin/red-month/years", {
    method: "POST",
    body: JSON.stringify(input),
  })) as {
    year: BackendRedMonthYear;
    periods?: BackendRedMonthPeriod[];
  };
  return {
    year: mapBackendRedMonthYear(data.year),
    periods: (data.periods ?? []).map(mapBackendRedMonthPeriod),
  };
}

export async function updateRedMonthYear(id: string, input: {
  anchorStart: string;
  cycleWeeks: number[];
  periodCount: number;
  timezone?: string;
}): Promise<{ year: RedMonthYear; periods: RedMonthPeriod[] }> {
  const data = (await authedFetch(`/admin/red-month/years/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as {
    year: BackendRedMonthYear;
    periods?: BackendRedMonthPeriod[];
  };
  return {
    year: mapBackendRedMonthYear(data.year),
    periods: (data.periods ?? []).map(mapBackendRedMonthPeriod),
  };
}

export async function activateRedMonthYear(id: string): Promise<RedMonthYear> {
  const data = (await authedFetch(`/admin/red-month/years/${id}/activate`, {
    method: "POST",
  })) as {
    year: BackendRedMonthYear;
  };
  return mapBackendRedMonthYear(data.year);
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
  endAt?: string;
  marketId?: string | null;
  clientEntryToken?: string;
}): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch("/time-tracking/entries/draft/start", {
    method: "POST",
    body: JSON.stringify({
      activityType: input.activityType,
      startAt: input.startAt,
      endAt: input.endAt,
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

export async function presignTimeTrackingDoctorConfirmation(input: {
  entryId: string;
  extension?: string;
  mimeType?: string;
  fileName?: string;
}): Promise<{ upload: { bucket: string; path: string; signedUrl: string; token: string } }> {
  return (await authedFetch(`/time-tracking/entries/${input.entryId}/doctor-confirmation/presign`, {
    method: "POST",
    body: JSON.stringify({
      extension: input.extension,
      mimeType: input.mimeType,
      fileName: input.fileName,
    }),
  })) as { upload: { bucket: string; path: string; signedUrl: string; token: string } };
}

export async function commitTimeTrackingDoctorConfirmation(input: {
  entryId: string;
  storageBucket: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
}): Promise<{ entry: TimeTrackingEntry }> {
  return (await authedFetch(`/time-tracking/entries/${input.entryId}/doctor-confirmation/commit`, {
    method: "POST",
    body: JSON.stringify({
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
    }),
  })) as { entry: TimeTrackingEntry };
}

export async function uploadTimeTrackingDoctorConfirmation(entryId: string, file: File): Promise<{ entry: TimeTrackingEntry }> {
  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const presign = await presignTimeTrackingDoctorConfirmation({
    entryId,
    extension,
    mimeType: file.type || undefined,
    fileName: file.name,
  });
  const uploadResponse = await fetch(presign.upload.signedUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Arztbestätigung konnte nicht hochgeladen werden.");
  }
  return commitTimeTrackingDoctorConfirmation({
    entryId,
    storageBucket: presign.upload.bucket,
    storagePath: presign.upload.path,
    fileName: file.name,
    mimeType: file.type || undefined,
    byteSize: file.size,
  });
}

export async function fetchTimeTrackingDoctorConfirmation(entryId: string): Promise<{
  doctorConfirmation: {
    signedUrl: string;
    expiresAt: string;
    fileName: string | null;
    mimeType: string | null;
  };
}> {
  return (await authedFetch(`/time-tracking/entries/${entryId}/doctor-confirmation`)) as {
    doctorConfirmation: {
      signedUrl: string;
      expiresAt: string;
      fileName: string | null;
      mimeType: string | null;
    };
  };
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

export async function fetchGmDashboardCritical(): Promise<GmDashboardCriticalPayload> {
  return (await authedFetch("/gm/dashboard/critical", { cache: "no-store" })) as GmDashboardCriticalPayload;
}

export async function fetchGmKurtiMessages(): Promise<GmKurtiMessagesPayload> {
  return (await authedFetch("/gm/kurti/messages", { cache: "no-store" })) as GmKurtiMessagesPayload;
}

export async function sendGmKurtiMessage(message: string): Promise<GmKurtiReplyPayload> {
  return (await authedFetch("/gm/kurti/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  }, 60000)) as GmKurtiReplyPayload;
}

export async function fetchAdminKurtiMessages(): Promise<AdminKurtiMessagesPayload> {
  return (await authedFetch("/admin/kurti/messages", { cache: "no-store" })) as AdminKurtiMessagesPayload;
}

export async function fetchAdminKurtiWindowLayout(): Promise<AdminKurtiWindowLayoutPayload> {
  return (await authedFetch("/admin/kurti/layout", { cache: "no-store" })) as AdminKurtiWindowLayoutPayload;
}

export async function saveAdminKurtiWindowLayout(
  layout: AdminKurtiWindowLayoutInput,
): Promise<AdminKurtiWindowLayoutPayload> {
  return (await authedFetch("/admin/kurti/layout", {
    method: "PUT",
    body: JSON.stringify(layout),
  })) as AdminKurtiWindowLayoutPayload;
}

export async function sendAdminKurtiMessage(message: string): Promise<AdminKurtiReplyPayload> {
  return (await authedFetch("/admin/kurti/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  }, 120000)) as AdminKurtiReplyPayload;
}

export async function fetchTodaySubmissions(): Promise<TodaySubmissionsPayload> {
  return (await authedFetch("/day-session/today-submissions", { cache: "no-store" })) as TodaySubmissionsPayload;
}

export async function fetchGmZeiterfassung(input?: {
  from?: string;
  to?: string;
  includeLive?: boolean;
  timezone?: string;
}): Promise<GmZeiterfassungPayload> {
  const params = new URLSearchParams();
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  if (typeof input?.includeLive === "boolean") params.set("includeLive", input.includeLive ? "true" : "false");
  if (input?.timezone) params.set("timezone", input.timezone);
  const query = params.toString();
  return (await authedFetch(`/day-session/zeiterfassung${query ? `?${query}` : ""}`)) as GmZeiterfassungPayload;
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

export async function fetchAdminDiaetenExport(input: {
  from: string;
  to: string;
  timezone?: string;
}): Promise<AdminDiaetenExportPayload> {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.timezone) params.set("timezone", input.timezone);
  return (await authedFetch(`/admin/zeiterfassung/diaeten-export?${params.toString()}`, {
    cache: "no-store",
  })) as AdminDiaetenExportPayload;
}

export async function fetchAdminZeitenaufstellungExport(input: {
  from: string;
  to: string;
  timezone?: string;
}): Promise<AdminZeitenaufstellungExportPayload> {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.timezone) params.set("timezone", input.timezone);
  return (await authedFetch(`/admin/zeiterfassung/zeitenaufstellung-export?${params.toString()}`, {
    cache: "no-store",
  }, 60000)) as AdminZeitenaufstellungExportPayload;
}

export async function startDaySession(input?: { timezone?: string; startedAt?: string }): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/start", {
    method: "POST",
    body: JSON.stringify({ timezone: input?.timezone, startedAt: input?.startedAt }),
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

export async function createManualDayPause(input: { startAt: string; endAt: string }): Promise<{ pause: DayPause }> {
  return (await authedFetch("/day-session/pause/manual", {
    method: "POST",
    body: JSON.stringify(input),
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

export async function endDaySession(input?: { endAt?: string; endTime?: string }): Promise<{ session: DaySession }> {
  const payload: { endAt?: string; endTime?: string } = {};
  if (input?.endAt !== undefined) payload.endAt = input.endAt;
  if (input?.endTime !== undefined) payload.endTime = input.endTime;
  return (await authedFetch("/day-session/end", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })) as { session: DaySession };
}

export async function reopenEndedDaySession(): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/end/reopen", {
    method: "PATCH",
    body: JSON.stringify({}),
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

export async function submitDaySession(input?: {
  comment?: string;
  reviewEdits?: DaySessionReviewEdit[];
}): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/submit", {
    method: "POST",
    body: JSON.stringify({
      comment: input?.comment,
      reviewEdits: input?.reviewEdits,
    }),
  })) as { session: DaySession };
}

export async function patchDaySessionReviewEdits(input: {
  sessionId: string;
  edits: DaySessionReviewEdit[];
}): Promise<{ ok: true }> {
  return (await authedFetch("/day-session/review-edits", {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as { ok: true };
}

export async function cancelDaySession(): Promise<{ session: DaySession }> {
  return (await authedFetch("/day-session/cancel", {
    method: "PATCH",
    body: JSON.stringify({}),
  })) as { session: DaySession };
}
