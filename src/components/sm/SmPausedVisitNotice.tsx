"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkCheck, ChevronRight, LoaderCircle, Trash2, X } from "lucide-react";

import { discardSmVisit, getSmVisitStartTokenStorageKey } from "@/lib/api/backend";

const STORAGE_KEY = "sm-paused-visit-notice";
const EVENT_NAME = "sm-paused-visit";
const POPUP_OWNER_EVENT = "sm-questionnaire-popup-owner-change";
const popupOwners: symbol[] = [];

type PausedVisit = {
  assignmentId: string;
  marketName: string;
  resumeHref: string;
  pausedAt: number;
};

function isPausedVisit(value: unknown): value is PausedVisit {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PausedVisit>;
  return typeof candidate.assignmentId === "string"
    && candidate.assignmentId.trim().length > 0
    && typeof candidate.marketName === "string"
    && typeof candidate.resumeHref === "string"
    && candidate.resumeHref.startsWith("/sm/marktbesuch?")
    && typeof candidate.pausedAt === "number";
}

function readStoredPausedVisit(): PausedVisit | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return isPausedVisit(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readPausedVisitSignal(): PausedVisit | null {
  const stored = readStoredPausedVisit();
  if (stored) return stored;
  const assignmentId = new URL(window.location.href).searchParams.get("pausedVisit")?.trim();
  if (!assignmentId) return null;
  return {
    assignmentId,
    marketName: "Marktbesuch",
    resumeHref: `/sm/marktbesuch?assignmentId=${encodeURIComponent(assignmentId)}`,
    pausedAt: Date.now(),
  };
}

export function announcePausedVisit(assignmentId: string, marketName: string, questionId?: string | null) {
  const resumeQuery = new URLSearchParams({ assignmentId });
  if (questionId) resumeQuery.set("questionId", questionId);
  const notice: PausedVisit = {
    assignmentId,
    marketName,
    resumeHref: `/sm/marktbesuch?${resumeQuery.toString()}`,
    pausedAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notice));
  } catch {
    // The mounted SM layout still receives the event when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<PausedVisit>(EVENT_NAME, { detail: notice }));
}

function NoticePanel({ notice, open, deleting, deleteError, onOpenChange, onResume, onDelete }: {
  notice: PausedVisit;
  open: boolean;
  deleting: boolean;
  deleteError: string | null;
  onOpenChange: (open: boolean) => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const [peeking, setPeeking] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const swipe = useRef<{ pointerId: number; startX: number; startY: number; offset: number; startedAt: number; horizontal: boolean } | null>(null);

  useEffect(() => {
    if (open) return;
    swipe.current = null;
    setDragging(false);
    setDragOffset(0);
  }, [open]);

  const beginSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    if (!open || deleting || event.pointerType === "mouse") return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    swipe.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset: 0,
      startedAt: performance.now(),
      horizontal: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.horizontal) {
      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipe.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      gesture.horizontal = true;
      setDragging(true);
    }
    gesture.offset = Math.max(0, Math.min(deltaX, 228));
    setDragOffset(gesture.offset);
  };

  const endSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const shouldClose = gesture.offset >= 54 || (gesture.offset >= 24 && gesture.offset / elapsed > 0.45);
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    setDragOffset(0);
    if (shouldClose) onOpenChange(false);
  };

  const cancelSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    if (swipe.current?.pointerId !== event.pointerId) return;
    swipe.current = null;
    setDragging(false);
    setDragOffset(0);
  };

  return <aside
    id="sm-questionnaire-popup"
    aria-label="Gespeicherter Marktbesuch"
    className={`fixed right-2 top-[max(12px,env(safe-area-inset-top))] z-[90] w-[min(242px,calc(100vw-16px))] will-change-transform ${dragging ? "transition-none" : "transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"}`}
    style={{ transform: open ? `translateX(${dragOffset}px)` : peeking ? "translateX(calc(100% - 44px))" : "translateX(calc(100% - 14px))", touchAction: "pan-y" }}
    onMouseEnter={() => { if (!open) setPeeking(true); }}
    onMouseLeave={() => setPeeking(false)}
    onPointerDown={beginSwipe}
    onPointerMove={moveSwipe}
    onPointerUp={endSwipe}
    onPointerCancel={cancelSwipe}
  >
    {!open ? <button type="button" onClick={() => onOpenChange(true)} aria-label="Gespeicherten Marktbesuch anzeigen" aria-expanded={false} className="absolute inset-0 z-20 cursor-pointer rounded-[16px]" /> : null}

    <div
      role="status"
      aria-live="polite"
      className="min-w-0 rounded-[16px] border border-white/90 bg-white/95 p-2.5 pl-3 shadow-[0_12px_34px_rgba(15,23,42,.11),0_2px_7px_rgba(15,23,42,.045)] backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/80">
          <BookmarkCheck size={12} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-semibold leading-tight text-[#202124]">Fragebogen gespeichert</p>
          <p className="mt-0.5 truncate text-[8px] font-normal leading-tight text-black/42">{notice.marketName || "Marktbesuch"}</p>
        </div>
        <button type="button" disabled={deleting} onClick={() => onOpenChange(false)} aria-label="Hinweis einklappen" className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/[0.035] hover:text-black/50 disabled:opacity-40">
          <X size={10} strokeWidth={2.2} />
        </button>
      </div>

      <p className="mt-2 text-[8px] font-normal leading-[1.4] text-black/43">Später exakt an dieser Stelle fortsetzen.</p>
      {deleteError ? <p role="alert" className="mt-1.5 text-[7.5px] font-medium leading-tight text-red-600">{deleteError}</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" disabled={deleting} onClick={onDelete} className="flex h-7 items-center justify-center gap-1 rounded-[8px] bg-red-50 text-[8px] font-semibold text-red-600 ring-1 ring-inset ring-red-100 transition-colors hover:bg-red-100/75 disabled:opacity-45">
          {deleting ? <LoaderCircle size={9} className="animate-spin" /> : <Trash2 size={9} strokeWidth={2.1} />} Löschen
        </button>
        <button type="button" disabled={deleting} onClick={onResume} className="flex h-7 items-center justify-center gap-0.5 rounded-[8px] bg-emerald-500 text-[8px] font-semibold text-white shadow-[0_2px_7px_rgba(16,185,129,.18)] transition-colors hover:bg-emerald-600 disabled:opacity-45">
          Fortsetzen <ChevronRight size={9} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  </aside>;
}

export function SmPausedVisitNoticeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const popupOwner = useRef(Symbol("sm-questionnaire-popup"));
  const [ownsPopup, setOwnsPopup] = useState(false);
  const [notice, setNotice] = useState<PausedVisit | null>(null);
  const [open, setOpen] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const owner = popupOwner.current;
    const updateOwnership = () => setOwnsPopup(popupOwners[0] === owner);
    if (!popupOwners.includes(owner)) popupOwners.push(owner);
    window.addEventListener(POPUP_OWNER_EVENT, updateOwnership);
    window.dispatchEvent(new Event(POPUP_OWNER_EVENT));
    return () => {
      window.removeEventListener(POPUP_OWNER_EVENT, updateOwnership);
      const index = popupOwners.indexOf(owner);
      if (index >= 0) popupOwners.splice(index, 1);
      window.dispatchEvent(new Event(POPUP_OWNER_EVENT));
    };
  }, []);

  useEffect(() => {
    const receiveNotice = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isPausedVisit(detail)) setNotice(detail);
    };
    window.addEventListener(EVENT_NAME, receiveNotice);
    setNotice(readPausedVisitSignal());
    return () => window.removeEventListener(EVENT_NAME, receiveNotice);
  }, []);

  useEffect(() => {
    if (pathname !== "/sm") return;
    setNotice((current) => current ?? readPausedVisitSignal());
  }, [pathname]);

  const visible = ownsPopup && pathname === "/sm" && notice !== null;

  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible, notice?.pausedAt]);

  useEffect(() => {
    if (!visible || !open || deleting || deleteError) return;
    const timer = window.setTimeout(() => setOpen(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [deleteError, deleting, open, visible]);

  const resume = () => {
    if (!notice) return;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory notice is still cleared below.
    }
    const resumeHref = notice.resumeHref;
    setNotice(null);
    setOpen(false);
    router.push(resumeHref);
  };

  const discard = async () => {
    if (!notice || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await discardSmVisit(notice.assignmentId);
      try {
        window.localStorage.removeItem(getSmVisitStartTokenStorageKey(notice.assignmentId));
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // The successfully discarded visit is still removed from the current UI.
      }
      setNotice(null);
      setOpen(false);
      router.replace("/sm");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Der Marktbesuch konnte nicht gelöscht werden.");
      setOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  return <>{children}{visible && notice ? <NoticePanel notice={notice} open={open} deleting={deleting} deleteError={deleteError} onOpenChange={setOpen} onResume={resume} onDelete={() => void discard()} /> : null}</>;
}
