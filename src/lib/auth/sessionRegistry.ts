"use client";

export type AuthUserRole = "admin" | "sm_admin" | "gm" | "sm" | "kunde";
export type AuthStorageTarget = "local" | "session";
export type KundePermissionAction = "read" | "write" | "update";
export type KundePagePermissions = Record<string, KundePermissionAction[]>;

export type AuthSessionPayload = {
  user: {
    id: string;
    role: AuthUserRole;
    email: string;
    firstName: string;
    lastName: string;
    permissions?: KundePagePermissions | null;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  };
};

export const LEGACY_AUTH_STORAGE_KEY = "coke_spark_auth_v1";
export const AUTH_ACTIVE_POINTER_KEY = "auth_active_v2";
export const AUTH_SESSION_KEY_PREFIX = "auth_session_v2:";
export const AUTH_CHANGED_EVENT = "coke_spark:auth-changed";
const AUTH_BROADCAST_CHANNEL = "coke_spark_auth_v2";

type AuthSessionRecord = {
  version: 2;
  userId: string;
  role: AuthUserRole;
  remember: boolean;
  updatedAtMs: number;
  payload: AuthSessionPayload;
};

type AuthActivePointer = {
  version: 2;
  sessionKey: string;
  target: AuthStorageTarget;
  userId: string;
  role: AuthUserRole;
  remember: boolean;
  updatedAtMs: number;
};

let migrationAttempted = false;

function getStorage(target: AuthStorageTarget): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return target === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidAuthRole(value: unknown): value is AuthUserRole {
  return value === "admin" || value === "sm_admin" || value === "gm" || value === "sm" || value === "kunde";
}

function normalizeKundePermissions(value: unknown): KundePagePermissions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized: KundePagePermissions = {};
  for (const [pageKey, rawActions] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rawActions)) continue;
    const actions = rawActions.filter((entry): entry is KundePermissionAction =>
      entry === "read" || entry === "write" || entry === "update",
    );
    if (actions.length > 0) {
      normalized[pageKey] = Array.from(new Set(actions));
    }
  }
  return normalized;
}

function isValidAuthSessionPayload(value: unknown): value is AuthSessionPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthSessionPayload>;
  return (
    !!candidate.user &&
    typeof candidate.user.id === "string" &&
    candidate.user.id.trim().length > 0 &&
    isValidAuthRole(candidate.user.role) &&
    typeof candidate.user.email === "string" &&
    typeof candidate.user.firstName === "string" &&
    typeof candidate.user.lastName === "string" &&
    !!candidate.session &&
    typeof candidate.session.accessToken === "string" &&
    candidate.session.accessToken.trim().length > 0 &&
    typeof candidate.session.refreshToken === "string" &&
    candidate.session.refreshToken.trim().length > 0 &&
    (typeof candidate.session.expiresAt === "number" ||
      candidate.session.expiresAt === null ||
      typeof candidate.session.expiresAt === "undefined")
  );
}

function sanitizePayload(payload: AuthSessionPayload): AuthSessionPayload {
  return {
    user: {
      id: payload.user.id.trim(),
      role: payload.user.role,
      email: payload.user.email.trim(),
      firstName: payload.user.firstName.trim(),
      lastName: payload.user.lastName.trim(),
      permissions: normalizeKundePermissions(payload.user.permissions),
    },
    session: {
      accessToken: payload.session.accessToken.trim(),
      refreshToken: payload.session.refreshToken.trim(),
      expiresAt: Number.isFinite(payload.session.expiresAt ?? NaN)
        ? Number(payload.session.expiresAt)
        : null,
    },
  };
}

function readLegacyPayload(target: AuthStorageTarget): AuthSessionPayload | null {
  const storage = getStorage(target);
  const parsed = parseJson<unknown>(storage?.getItem(LEGACY_AUTH_STORAGE_KEY) ?? null);
  if (!isValidAuthSessionPayload(parsed)) return null;
  return sanitizePayload(parsed);
}

function removeLegacyKeys() {
  getStorage("local")?.removeItem(LEGACY_AUTH_STORAGE_KEY);
  getStorage("session")?.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

function buildSessionKey(payload: AuthSessionPayload): string {
  return `${AUTH_SESSION_KEY_PREFIX}${payload.user.id}:${payload.user.role}`;
}

function removeNamespacedSessionKeys(target: AuthStorageTarget) {
  const storage = getStorage(target);
  if (!storage) return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (key.startsWith(AUTH_SESSION_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function emitAuthChanged(reason: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { reason, at: Date.now() } }));
  if ("BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      channel.postMessage({ type: AUTH_CHANGED_EVENT, reason, at: Date.now() });
      channel.close();
    } catch {
      // noop
    }
  }
}

function writePointer(pointer: AuthActivePointer) {
  const serialized = JSON.stringify(pointer);
  const local = getStorage("local");
  const session = getStorage("session");
  if (local) {
    local.setItem(AUTH_ACTIVE_POINTER_KEY, serialized);
  } else {
    session?.setItem(AUTH_ACTIVE_POINTER_KEY, serialized);
  }
}

function readPointer(): AuthActivePointer | null {
  const localPointer = parseJson<AuthActivePointer>(getStorage("local")?.getItem(AUTH_ACTIVE_POINTER_KEY) ?? null);
  const sessionPointer = parseJson<AuthActivePointer>(getStorage("session")?.getItem(AUTH_ACTIVE_POINTER_KEY) ?? null);
  const pointer = localPointer ?? sessionPointer;
  if (!pointer) return null;
  if (
    pointer.version !== 2 ||
    typeof pointer.sessionKey !== "string" ||
    !pointer.sessionKey.startsWith(AUTH_SESSION_KEY_PREFIX) ||
    (pointer.target !== "local" && pointer.target !== "session") ||
    !isValidAuthRole(pointer.role) ||
    typeof pointer.userId !== "string" ||
    pointer.userId.trim().length === 0
  ) {
    return null;
  }
  return pointer;
}

function writeSessionRecord(payload: AuthSessionPayload, target: AuthStorageTarget, remember: boolean): {
  record: AuthSessionRecord;
  sessionKey: string;
} | null {
  const storage = getStorage(target);
  if (!storage) return null;
  const now = Date.now();
  const sanitized = sanitizePayload(payload);
  const sessionKey = buildSessionKey(sanitized);
  const record: AuthSessionRecord = {
    version: 2,
    userId: sanitized.user.id,
    role: sanitized.user.role,
    remember,
    updatedAtMs: now,
    payload: sanitized,
  };
  storage.setItem(sessionKey, JSON.stringify(record));
  return { record, sessionKey };
}

function migrateLegacyIfNeeded() {
  if (migrationAttempted) return;
  migrationAttempted = true;
  if (readPointer()) return;

  const sessionPayload = readLegacyPayload("session");
  if (sessionPayload) {
    const written = writeSessionRecord(sessionPayload, "session", false);
    if (written) {
      writePointer({
        version: 2,
        sessionKey: written.sessionKey,
        target: "session",
        userId: written.record.userId,
        role: written.record.role,
        remember: false,
        updatedAtMs: Date.now(),
      });
    }
    removeLegacyKeys();
    return;
  }

  const localPayload = readLegacyPayload("local");
  if (localPayload) {
    const written = writeSessionRecord(localPayload, "local", true);
    if (written) {
      writePointer({
        version: 2,
        sessionKey: written.sessionKey,
        target: "local",
        userId: written.record.userId,
        role: written.record.role,
        remember: true,
        updatedAtMs: Date.now(),
      });
    }
    removeLegacyKeys();
  }
}

export function readActiveAuthSessionWithTarget():
  | { payload: AuthSessionPayload; target: AuthStorageTarget; sessionKey: string; remember: boolean }
  | null {
  migrateLegacyIfNeeded();
  const pointer = readPointer();
  if (!pointer) return null;
  const storage = getStorage(pointer.target);
  if (!storage) return null;
  const rawRecord = storage.getItem(pointer.sessionKey);
  if (!rawRecord) {
    if (pointer.target === "session") {
      // Session-scoped login exists only in the originating tab.
      // Other tabs should see "not authenticated" without deleting the active pointer.
      return null;
    }
    clearAllAuthSessions({ emit: false });
    return null;
  }
  const parsedRecord = parseJson<AuthSessionRecord>(rawRecord);
  if (
    !parsedRecord ||
    parsedRecord.version !== 2 ||
    !isValidAuthSessionPayload(parsedRecord.payload) ||
    parsedRecord.userId !== pointer.userId ||
    parsedRecord.role !== pointer.role
  ) {
    clearAllAuthSessions({ emit: false });
    return null;
  }
  const payload = sanitizePayload(parsedRecord.payload);
  if (payload.user.id !== pointer.userId || payload.user.role !== pointer.role) {
    clearAllAuthSessions({ emit: false });
    return null;
  }
  return { payload, target: pointer.target, sessionKey: pointer.sessionKey, remember: Boolean(parsedRecord.remember) };
}

export function readActiveAuthSession(): AuthSessionPayload | null {
  return readActiveAuthSessionWithTarget()?.payload ?? null;
}

export function saveActiveAuthSession(payload: AuthSessionPayload, options?: { remember?: boolean }) {
  migrateLegacyIfNeeded();
  const remember = options?.remember !== false;
  const target: AuthStorageTarget = remember ? "local" : "session";
  removeNamespacedSessionKeys("local");
  removeNamespacedSessionKeys("session");
  removeLegacyKeys();
  const writeResult = writeSessionRecord(payload, target, remember);
  if (!writeResult) return;
  writePointer({
    version: 2,
    sessionKey: writeResult.sessionKey,
    target,
    userId: writeResult.record.userId,
    role: writeResult.record.role,
    remember,
    updatedAtMs: Date.now(),
  });
  emitAuthChanged("save");
}

export function clearAllAuthSessions(options?: { emit?: boolean }) {
  removeNamespacedSessionKeys("local");
  removeNamespacedSessionKeys("session");
  getStorage("local")?.removeItem(AUTH_ACTIVE_POINTER_KEY);
  getStorage("session")?.removeItem(AUTH_ACTIVE_POINTER_KEY);
  removeLegacyKeys();
  if (options?.emit !== false) {
    emitAuthChanged("clear");
  }
}

export function emitAuthSessionChanged(reason: string) {
  emitAuthChanged(reason);
}

export function subscribeToAuthSessionChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => handler();
  const onStorage = (event: StorageEvent) => {
    if (!event.key) {
      handler();
      return;
    }
    if (
      event.key === AUTH_ACTIVE_POINTER_KEY ||
      event.key === LEGACY_AUTH_STORAGE_KEY ||
      event.key.startsWith(AUTH_SESSION_KEY_PREFIX)
    ) {
      handler();
    }
  };

  window.addEventListener(AUTH_CHANGED_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  const onMessage = () => handler();
  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      channel.addEventListener("message", onMessage);
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
    if (channel) {
      channel.removeEventListener("message", onMessage);
      channel.close();
    }
  };
}
