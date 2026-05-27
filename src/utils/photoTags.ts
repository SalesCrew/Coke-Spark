// ── Shared photo-tag pool ─────────────────────────────────────
// Persisted in localStorage so tags are shared across all module editors.

import { readAuthSession } from "@/lib/api/backend";

export interface PhotoTagPoolItem {
  id: string;
  label: string;
  deletedAt?: string | null; // ISO string when soft-deleted; null/undefined = active
}

const LEGACY_POOL_KEY = "admin_photo_tag_pool_v1";
const POOL_KEY_PREFIX = "admin_photo_tag_pool_v2:";

export function getPhotoTagPoolStorageKey(): string {
  const userId = readAuthSession()?.user.id ?? "anonymous";
  return `${POOL_KEY_PREFIX}${userId}`;
}

function uid(): string {
  return `tag-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

export function loadTagPool(): PhotoTagPoolItem[] {
  if (typeof window === "undefined") return [];
  try {
    const scopedRaw = localStorage.getItem(getPhotoTagPoolStorageKey());
    if (scopedRaw) {
      return JSON.parse(scopedRaw) as PhotoTagPoolItem[];
    }
    const legacyRaw = localStorage.getItem(LEGACY_POOL_KEY);
    if (!legacyRaw) return [];
    localStorage.setItem(getPhotoTagPoolStorageKey(), legacyRaw);
    localStorage.removeItem(LEGACY_POOL_KEY);
    return JSON.parse(legacyRaw) as PhotoTagPoolItem[];
  } catch {
    return [];
  }
}

export function saveTagPool(pool: PhotoTagPoolItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getPhotoTagPoolStorageKey(), JSON.stringify(pool));
    localStorage.removeItem(LEGACY_POOL_KEY);
  } catch { /* noop */ }
}

/** Returns only non-deleted tags. */
export function activeTagPool(pool: PhotoTagPoolItem[]): PhotoTagPoolItem[] {
  return pool.filter(t => !t.deletedAt);
}

/** Create a new tag, add to pool, and return the updated pool + the new item. */
export function createTag(
  pool: PhotoTagPoolItem[],
  label: string,
): { pool: PhotoTagPoolItem[]; tag: PhotoTagPoolItem } {
  const tag: PhotoTagPoolItem = { id: uid(), label: label.trim() };
  const next = [...pool, tag];
  saveTagPool(next);
  return { pool: next, tag };
}

/** Soft-delete a tag by id. */
export function softDeleteTag(pool: PhotoTagPoolItem[], id: string): PhotoTagPoolItem[] {
  const next = pool.map(t =>
    t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t
  );
  saveTagPool(next);
  return next;
}
