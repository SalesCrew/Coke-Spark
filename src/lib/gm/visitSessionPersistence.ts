"use client";

import { readActiveAuthSession } from "@/lib/auth/sessionRegistry";

const STORAGE_PREFIX = "gm_visit_session_active_v1:";
const MAX_ACTIVE_VISIT_AGE_MS = 36 * 60 * 60 * 1000;

export type LocalActiveVisitSnapshot = {
  version: 1;
  userId: string;
  marketId: string;
  campaignIds: string[];
  clientSessionToken: string;
  clientStartedAt: string;
  sessionId: string | null;
  updatedAtMs: number;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function activeGmUserId(): string | null {
  const session = readActiveAuthSession();
  if (session?.user.role !== "gm") return null;
  return session.user.id;
}

function normalizeCampaignIds(campaignIds: string[]): string[] {
  return Array.from(new Set(campaignIds.map((id) => id.trim()).filter(Boolean))).sort();
}

function keyFor(userId: string, marketId: string, campaignIds: string[]): string {
  return `${STORAGE_PREFIX}${userId}:${marketId}:${normalizeCampaignIds(campaignIds).join(",")}`;
}

function parseSnapshot(raw: string | null): LocalActiveVisitSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalActiveVisitSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.userId !== "string" ||
      typeof parsed.marketId !== "string" ||
      !Array.isArray(parsed.campaignIds) ||
      typeof parsed.clientSessionToken !== "string" ||
      typeof parsed.clientStartedAt !== "string" ||
      typeof parsed.updatedAtMs !== "number"
    ) {
      return null;
    }
    return {
      version: 1,
      userId: parsed.userId,
      marketId: parsed.marketId,
      campaignIds: normalizeCampaignIds(parsed.campaignIds.filter((entry): entry is string => typeof entry === "string")),
      clientSessionToken: parsed.clientSessionToken,
      clientStartedAt: parsed.clientStartedAt,
      sessionId: typeof parsed.sessionId === "string" && parsed.sessionId.length > 0 ? parsed.sessionId : null,
      updatedAtMs: parsed.updatedAtMs,
    };
  } catch {
    return null;
  }
}

function isFresh(snapshot: LocalActiveVisitSnapshot): boolean {
  const startedAtMs = new Date(snapshot.clientStartedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return false;
  return Date.now() - startedAtMs <= MAX_ACTIVE_VISIT_AGE_MS;
}

export function saveLocalActiveVisitSnapshot(input: {
  marketId: string;
  campaignIds: string[];
  clientStartedAt: string;
  clientSessionToken: string;
  sessionId?: string | null;
}): LocalActiveVisitSnapshot | null {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return null;
  const snapshot: LocalActiveVisitSnapshot = {
    version: 1,
    userId,
    marketId: input.marketId,
    campaignIds: normalizeCampaignIds(input.campaignIds),
    clientStartedAt: input.clientStartedAt,
    clientSessionToken: input.clientSessionToken,
    sessionId: input.sessionId ?? null,
    updatedAtMs: Date.now(),
  };
  localStorage.setItem(keyFor(userId, input.marketId, input.campaignIds), JSON.stringify(snapshot));
  return snapshot;
}

export function readLocalActiveVisitSnapshot(input: {
  marketId: string;
  campaignIds: string[];
}): LocalActiveVisitSnapshot | null {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return null;
  const key = keyFor(userId, input.marketId, input.campaignIds);
  const snapshot = parseSnapshot(localStorage.getItem(key));
  if (!snapshot || !isFresh(snapshot)) {
    localStorage.removeItem(key);
    return null;
  }
  return snapshot;
}

export function clearLocalActiveVisitSnapshot(input: {
  marketId: string;
  campaignIds: string[];
}): void {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return;
  localStorage.removeItem(keyFor(userId, input.marketId, input.campaignIds));
}
