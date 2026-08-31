"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RotateCw } from "lucide-react";
import {
  fetchMySmHomeDashboard,
  readAuthSession,
  SM_HOME_DASHBOARD_CHANGED_EVENT,
  subscribeAuthSession,
} from "@/lib/api/backend";
import { createSmHomeLoader, smHomeDate, smHomeDayRolloverDelay, smHomeEmptyMessage, smHomeSegments, type SmHomeLoadState } from "@/lib/sm/homeDashboard";
import type { SmHomeDashboardPayload } from "@/types/smDashboard";

function readSmOwner(): string | null {
  const session = readAuthSession();
  return session?.user.role === "sm" ? session.user.id : null;
}

const serverOwner = () => null;
const cardClassName = "mx-auto w-full rounded-[14px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]";

export function SmDashboardHeroSkeleton() {
  return (
    <section className={cardClassName} aria-label="Tagesübersicht wird geladen" aria-busy="true">
      <span className="sr-only" role="status">Deine Tagesübersicht wird geladen.</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex h-[22px] items-center justify-between gap-3">
          <div className="h-3 w-28 rounded bg-gray-100" />
          <div className="flex items-center gap-2"><div className="h-2 w-16 rounded bg-gray-100" /><div className="h-5 w-6 rounded bg-gray-100" /></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => <div key={index} className="flex items-center gap-1.5"><div className="size-1.5 shrink-0 rounded-full bg-gray-100" /><div className="h-2 w-full rounded bg-gray-100" /></div>)}
        </div>
        <div className="mt-2.5 h-2.5 rounded-md bg-gray-100" />
        <div className="mt-2 h-3 w-40 rounded bg-gray-100" />
      </div>
    </section>
  );
}

export function SmDashboardHeroCard({ data, loading, error, onRetry }: {
  data: SmHomeDashboardPayload | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (!data && !error) return <SmDashboardHeroSkeleton />;

  const segments = data ? smHomeSegments(data) : [];
  const filledSegments = segments.filter((segment) => segment.value > 0);
  const emptyMessage = data ? smHomeEmptyMessage(data) : null;
  return (
    <section className={cardClassName} aria-label="Deine Tagesübersicht" aria-busy={loading}>
      <div className="flex min-h-[22px] items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-medium text-gray-800" title={data?.name}>
          {data?.name || "Dein Tag"}
        </span>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-[11px] text-gray-400">Einsätze heute:</span>
          <span className="text-[22px] font-bold leading-none tabular-nums text-gray-800">{data ? data.assignmentsToday : "—"}</span>
        </div>
      </div>

      {data ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {segments.map((segment) => (
              <div key={segment.label} className="flex items-center gap-1.5" title={`${segment.value} abgeschlossene Besuche: ${segment.label}`}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                <span className="text-[10px] leading-tight text-gray-500">{segment.label} <span className="font-medium tabular-nums text-gray-600">{segment.value}</span></span>
              </div>
            ))}
          </div>
          <div
            className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-md bg-gray-100"
            role="img"
            aria-label={data.visits.classified > 0
              ? `Heute abgeschlossen: ${segments.map((segment) => `${segment.value} ${segment.label}`).join(", ")}`
              : "Noch keine auswertbaren OOS-Ergebnisse"}
          >
            {filledSegments.map((segment) => <div key={segment.label} className="min-w-0 basis-0" style={{ flexGrow: segment.value, backgroundColor: segment.color }} />)}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-gray-400" aria-live="polite">
            {emptyMessage ?? `${data.visits.completed} ${data.visits.completed === 1 ? "Besuch" : "Besuche"} heute abgeschlossen${data.visits.unclassified > 0 ? ` · ${data.visits.unclassified} ohne OOS-Auswertung` : ""}`}
          </p>
        </>
      ) : null}

      {error ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] leading-4 text-gray-500" role="status">
            {data ? "Letzter geladener Stand · aktuell nicht erreichbar." : "Deine Übersicht ist gerade nicht erreichbar."}
          </p>
          <button type="button" onClick={onRetry} disabled={loading} aria-label="Tagesübersicht erneut laden" className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50">
            <RotateCw size={12} className={loading ? "motion-safe:animate-spin" : undefined} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function SmDashboardHero() {
  const owner = useSyncExternalStore(subscribeAuthSession, readSmOwner, serverOwner);
  const [state, setState] = useState<SmHomeLoadState>({ data: null, error: false, loading: true });
  const loaderRef = useRef<ReturnType<typeof createSmHomeLoader> | null>(null);
  const reload = useCallback(() => { void loaderRef.current?.refresh(); }, []);

  useEffect(() => {
    if (!owner) return;
    const loader = createSmHomeLoader({ owner, getOwner: readSmOwner, fetch: fetchMySmHomeDashboard, onChange: setState });
    loaderRef.current = loader;
    const refresh = () => { void loader.refresh(); };
    const refreshAfterSubmission = () => { void loader.refresh(true); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    let rollover: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      rollover = setTimeout(() => { void loader.refresh(true); scheduleRollover(); }, smHomeDayRolloverDelay());
    };
    refresh();
    scheduleRollover();
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(SM_HOME_DASHBOARD_CHANGED_EVENT, refreshAfterSubmission);
    return () => {
      loader.dispose();
      if (loaderRef.current === loader) loaderRef.current = null;
      clearTimeout(rollover);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(SM_HOME_DASHBOARD_CHANGED_EVENT, refreshAfterSubmission);
    };
  }, [owner]);

  // Never render the previous account/day, including the render before effect cleanup.
  const data = state.data?.userId === owner && state.data.date === smHomeDate() ? state.data : null;
  return <SmDashboardHeroCard data={data} loading={state.loading} error={Boolean(owner) && state.error} onRetry={reload} />;
}
