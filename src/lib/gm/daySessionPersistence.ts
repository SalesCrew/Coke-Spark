"use client";

import { readActiveAuthSession } from "@/lib/auth/sessionRegistry";
import type { DaySession } from "@/lib/api/backend";

const STORAGE_PREFIX = "gm_day_session_local_v1:";
const DEFAULT_TIMEZONE = "Europe/Vienna";
const MAX_LOCAL_START_AGE_MS = 36 * 60 * 60 * 1000;

export type LocalDaySessionSnapshot = {
  version: 1;
  userId: string;
  workDate: string;
  timezone: string;
  status: "started" | "ended";
  clientStartedAt: string;
  updatedAtMs: number;
  session: DaySession | null;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function toYmdInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function activeGmUserId(): string | null {
  const session = readActiveAuthSession();
  if (session?.user.role !== "gm") return null;
  return session.user.id;
}

function keyFor(userId: string, workDate: string): string {
  return `${STORAGE_PREFIX}${userId}:${workDate}`;
}

function parseSnapshot(raw: string | null): LocalDaySessionSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDaySessionSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.userId !== "string" ||
      typeof parsed.workDate !== "string" ||
      typeof parsed.timezone !== "string" ||
      typeof parsed.clientStartedAt !== "string" ||
      typeof parsed.updatedAtMs !== "number" ||
      (parsed.status !== "started" && parsed.status !== "ended")
    ) {
      return null;
    }
    return {
      version: 1,
      userId: parsed.userId,
      workDate: parsed.workDate,
      timezone: parsed.timezone,
      status: parsed.status,
      clientStartedAt: parsed.clientStartedAt,
      updatedAtMs: parsed.updatedAtMs,
      session: parsed.session ?? null,
    };
  } catch {
    return null;
  }
}

function isFreshSnapshot(snapshot: LocalDaySessionSnapshot): boolean {
  const startedAtMs = new Date(snapshot.clientStartedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return false;
  return Date.now() - startedAtMs <= MAX_LOCAL_START_AGE_MS;
}

export function saveLocalDaySessionStartSnapshot(input: {
  startedAt: string;
  timezone?: string;
  session?: DaySession | null;
}): LocalDaySessionSnapshot | null {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return null;

  const startedAt = new Date(input.startedAt);
  if (!Number.isFinite(startedAt.getTime())) return null;
  const timezone = input.timezone ?? input.session?.timezone ?? DEFAULT_TIMEZONE;
  const workDate = input.session?.workDate ?? toYmdInTimezone(startedAt, timezone);
  const snapshot: LocalDaySessionSnapshot = {
    version: 1,
    userId,
    workDate,
    timezone,
    status: input.session?.status === "ended" ? "ended" : "started",
    clientStartedAt: input.session?.dayStartedAt ?? input.startedAt,
    updatedAtMs: Date.now(),
    session: input.session ?? null,
  };
  localStorage.setItem(keyFor(userId, workDate), JSON.stringify(snapshot));
  return snapshot;
}

export function persistLocalDaySessionFromBackend(session: DaySession | null): void {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return;
  if (!session?.dayStartedAt) return;

  if (session.status === "submitted" || session.status === "cancelled") {
    localStorage.removeItem(keyFor(userId, session.workDate));
    return;
  }
  if (session.status !== "started" && session.status !== "ended") return;

  const snapshot: LocalDaySessionSnapshot = {
    version: 1,
    userId,
    workDate: session.workDate,
    timezone: session.timezone || DEFAULT_TIMEZONE,
    status: session.status,
    clientStartedAt: session.dayStartedAt,
    updatedAtMs: Date.now(),
    session,
  };
  localStorage.setItem(keyFor(userId, session.workDate), JSON.stringify(snapshot));
}

export function readLatestLocalDaySessionSnapshot(): LocalDaySessionSnapshot | null {
  const localStorage = storage();
  const userId = activeGmUserId();
  if (!localStorage || !userId) return null;
  const prefix = `${STORAGE_PREFIX}${userId}:`;
  let latest: LocalDaySessionSnapshot | null = null;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const snapshot = parseSnapshot(localStorage.getItem(key));
    if (!snapshot || !isFreshSnapshot(snapshot)) {
      localStorage.removeItem(key);
      continue;
    }
    if (!latest || snapshot.updatedAtMs > latest.updatedAtMs) {
      latest = snapshot;
    }
  }
  return latest;
}

