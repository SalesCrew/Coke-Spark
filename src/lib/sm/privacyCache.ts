import type { SmVisitPayload } from "@/types/smVisit";

export const SM_OFFLINE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isSmOfflineCacheTimestampFresh(timestampMs: unknown, nowMs = Date.now()): boolean {
  const value = Number(timestampMs);
  return Number.isFinite(value)
    && value > 0
    && value <= nowMs + 5 * 60 * 1000
    && nowMs - value <= SM_OFFLINE_CACHE_TTL_MS;
}

export function sanitizeSmVisitPayloadForPersistentCache(payload: SmVisitPayload): SmVisitPayload {
  return {
    ...payload,
    photoFiles: Object.fromEntries(
      Object.entries(payload.photoFiles).map(([questionId, files]) => [
        questionId,
        files.map((file) => ({ ...file, signedUrl: null })),
      ]),
    ),
  };
}
