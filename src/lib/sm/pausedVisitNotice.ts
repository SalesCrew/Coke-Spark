import { smVisitResumeHref } from "./SMDurcharbeitVisitReference";

export type SmPausedVisitNotice = { ownerKey: string; assignmentId: string; marketName: string; resumeHref: string; pausedAt: number };
export const smPausedVisitStorageKey = (ownerKey: string) => `sm-paused-visit-notice:${ownerKey}`;
export function isSmPausedVisitNotice(value: unknown, ownerKey: string): value is SmPausedVisitNotice {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SmPausedVisitNotice>;
  if (candidate.ownerKey !== ownerKey || typeof candidate.assignmentId !== "string" || !candidate.assignmentId.trim()
    || typeof candidate.marketName !== "string" || typeof candidate.resumeHref !== "string" || typeof candidate.pausedAt !== "number" || !Number.isFinite(candidate.pausedAt)) return false;
  try {
    const href = new URL(candidate.resumeHref, "https://sm.invalid");
    return candidate.resumeHref === smVisitResumeHref(candidate.assignmentId, href.searchParams.get("questionId"));
  } catch { return false; }
}
export function readSmPausedVisitNotice(storage: Pick<Storage, "getItem">, ownerKey: string): SmPausedVisitNotice | null {
  try {
    const raw = storage.getItem(smPausedVisitStorageKey(ownerKey));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isSmPausedVisitNotice(value, ownerKey) ? value : null;
  } catch { return null; }
}
