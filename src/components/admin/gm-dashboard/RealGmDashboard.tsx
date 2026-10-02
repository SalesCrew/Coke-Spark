"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { requestGmDashboard, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import { calendarToday } from "@/lib/gm-dashboard/data";
import { dashboardStartDate } from "@/lib/gm-dashboard/date-range";
import { DashboardRequestQueue, type DashboardPriority } from "@/lib/gm-dashboard/request-queue";
import type { AvailabilityType, DashboardData, DashboardExport, DashboardFacets, DashboardScope } from "@/types/gm-dashboard";

type ExportStatus = { ready: boolean; error: string | null };
type Shared = {
  facets: DashboardFacets | null;
  metadata: { firstEntryDate: string | null } | null;
  error: string | null;
  metadataError: string | null;
  calendarReady: boolean;
  version: number;
  force: boolean;
  load: (query: string, priority: DashboardPriority) => Promise<DashboardData>;
  resource: <T>(key: string, run: () => Promise<T>, priority: DashboardPriority) => Promise<T>;
  promote: (key: string, priority: DashboardPriority) => void;
  ensureFilters: () => Promise<void>;
  register: (key: string, value: DashboardExport | null) => void;
  report: (key: string, status: ExportStatus) => void;
  refresh: () => void;
};
const SharedContext = createContext<Shared | null>(null);
const EMPTY_MARKETS: DashboardFacets["markets"] = [];
const EMPTY_GMS: DashboardFacets["gms"] = [];
function dashboardActor() {
  const user = readAuthSession()?.user;
  return user ? `${user.id}:${user.role}:${JSON.stringify(user.permissions ?? {})}` : "anonymous";
}
export function RealDashboardProvider({ children, register, prepareExportRef, needsBonus = false }: {
  children: ReactNode;
  register: Shared["register"];
  prepareExportRef?: RefObject<(() => Promise<void>) | null>;
  needsBonus?: boolean;
}) {
  const { loadCalendar, error: calendarError } = useRedMonth();
  const [facets, setFacets] = useState<DashboardFacets | null>(null);
  const [metadata, setMetadata] = useState<Shared["metadata"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [calendarReady, setCalendarReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [force, setForce] = useState(false);
  const forceRef = useRef(false);
  const queue = useMemo(() => new DashboardRequestQueue(), [version]);
  const disposal = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statuses = useRef(new Map<string, ExportStatus>());
  const listeners = useRef(new Set<() => void>());
  const report = useCallback((key: string, status: ExportStatus) => {
    statuses.current.set(key, status);
    for (const listener of listeners.current) listener();
  }, []);
  const resource = useCallback(<T,>(key: string, run: () => Promise<T>, priority: DashboardPriority) => {
    const actor = dashboardActor();
    return queue.request(`${actor}:${key}`, async () => {
      const result = await run();
      if (dashboardActor() !== actor) throw new Error("Der angemeldete Zugang hat sich geändert.");
      return result;
    }, forceRef.current ? Math.min(priority, 1) as DashboardPriority : priority);
  }, [queue]);
  const promote = useCallback((key: string, priority: DashboardPriority) => {
    queue.promote(`${dashboardActor()}:${key}`, priority);
  }, [queue]);
  const ensureFilters = useCallback(async (priority: DashboardPriority = 1) => {
    try {
      const data = await resource("facets", () => requestGmDashboard<DashboardFacets>("/facets"), priority);
      setFacets(data);
      setError(null);
    } catch (e) {
      if (!(e instanceof Error && e.message === "Dashboard wurde geschlossen."))
        setError(e instanceof Error ? e.message : "Filterdaten konnten nicht geladen werden.");
    }
  }, [resource]);
  const load = useCallback((query: string, priority: DashboardPriority) => {
    const request = resource(`query:${query}`, () => requestGmDashboard<DashboardData>("/query", JSON.parse(query)), priority);
    if (priority === 0) void request.finally(() => queue.allowBackground()).catch(() => {});
    return request;
  }, [resource, queue]);
  const refresh = useCallback(() => {
    queue.dispose();
    statuses.current.clear();
    setFacets(null); setMetadata(null);
    setForce(false);
    forceRef.current = false;
    setVersion((v) => v + 1);
  }, [queue]);
  useEffect(() => {
    let actor = dashboardActor();
    return subscribeAuthSession(() => {
      const next = dashboardActor();
      if (next !== actor) { actor = next; refresh(); }
    });
  }, [refresh]);
  useEffect(() => {
    if (disposal.current) clearTimeout(disposal.current);
    queue.resume();
    let cancelled = false;
    setFacets(null); setError(null); setMetadata(null); setMetadataError(null); setCalendarReady(false);
    // Child effects also defer their queue call until setup has resumed it.
    void resource("metadata", () => requestGmDashboard<NonNullable<Shared["metadata"]>>("/metadata"), 0)
      .then((data) => { if (!cancelled) setMetadata(data); })
      .catch((e) => { if (!cancelled) { setMetadataError(e instanceof Error ? e.message : "Dashboard konnte nicht geladen werden."); queue.allowBackground(); } });
    void ensureFilters(2);
    const year = Number(calendarToday().slice(0, 4));
    void resource("calendar", () => loadCalendar({ from: `${year - 2}-01-01`, to: `${year + 1}-12-31` }), 0)
      .catch(() => {})
      .finally(() => { if (!cancelled) setCalendarReady(true); });
    return () => {
      cancelled = true;
      // React's development effect replay reuses the same in-flight reads.
      queue.pause();
      disposal.current = setTimeout(() => queue.dispose(), 0);
    };
  }, [queue, resource, ensureFilters, loadCalendar]);
  useEffect(() => {
    if (metadata && calendarReady && (!metadata.firstEntryDate || calendarError)) queue.allowBackground();
  }, [metadata, calendarReady, calendarError, queue]);
  useEffect(() => {
    if (!prepareExportRef) return;
    let closed = false;
    prepareExportRef.current = () => {
      setForce(true);
      forceRef.current = true;
      queue.promoteAll();
      return new Promise<void>((resolve, reject) => {
        const keys = ["IPP", "Fuellstand", "Kühlerinventur", "Platzierungen", "Aktivitaet", ...(needsBonus ? ["Boni"] : [])];
        const finish = (error?: string) => {
          clearTimeout(timeout); listeners.current.delete(check);
          if (error) reject(new Error(error)); else resolve();
        };
        const check = () => {
          if (closed) return finish("Dashboard wurde geschlossen.");
          const states = keys.map((key) => statuses.current.get(key));
          const failure = states.find((state) => state?.error);
          if (failure?.error) return finish(failure.error);
          if (states.every((state) => state?.ready)) finish();
        };
        const timeout = setTimeout(() => finish("Bitte warten, bis alle Dashboardkarten geladen sind."), 60000);
        listeners.current.add(check); check();
      });
    };
    return () => {
      closed = true;
      prepareExportRef.current = null;
      for (const listener of listeners.current) listener();
    };
  }, [prepareExportRef, needsBonus, queue]);
  const shared = useMemo(() => ({ facets, metadata, error, metadataError, calendarReady, version, force, load, resource, promote, ensureFilters, register, report, refresh }),
    [facets, metadata, error, metadataError, calendarReady, version, force, load, resource, promote, ensureFilters, register, report, refresh]);
  return (
    <SharedContext.Provider value={shared}>
      {/^http:\/\/(127\.0\.0\.1|localhost):4017$/.test(process.env.NEXT_PUBLIC_BACKEND_URL ?? "") && (
        <Message>Isolierter lokaler Test · synthetische Besuchs- und Prämienwerte aus einer In-Memory-Datenbank. Keine Produktionsverbindung.</Message>
      )}
      {children}
    </SharedContext.Provider>
  );
}

export function useDashboardExportStatus(key: string, ready: boolean, error: string | null) {
  const shared = useContext(SharedContext)!;
  useEffect(() => {
    shared.report(key, { ready, error });
    return () => shared.report(key, { ready: false, error: null });
  }, [key, ready, error, shared.report, shared.version]);
}
export function useDashboardFilterWarmup() {
  return useContext(SharedContext)?.ensureFilters;
}
export function useDashboardResource() {
  const shared = useContext(SharedContext)!;
  return { load: shared.resource, promote: shared.promote, version: shared.version };
}
export function useDashboardStage() {
  const shared = useContext(SharedContext)!;
  const ref = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, priority: (near || shared.force ? 1 : 2) as DashboardPriority };
}
export function useDashboardData(
  title: string,
  intervals: DashboardScopeInterval[],
  scope: DashboardScope,
  selectedId: string | null,
  type: AvailabilityType | null = null,
  comparisonPreset?: string,
  comparisonIntervalId?: string | null,
  priority: DashboardPriority = 0,
) {
  const shared = useContext(SharedContext)!;
  const [state, setState] = useState<{
    key: string;
    data: DashboardData | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const today = calendarToday();
  const query = intervals.length
    ? JSON.stringify({
        intervals: intervals.map(({ id, label, shortLabel, start, end }) => ({
          id,
          label,
          shortLabel,
          start,
          end: end > today ? today : end,
        })),
        scope,
      })
    : "";
  const key = `${shared.version}:${query}`;
  useEffect(() => {
    let cancelled = false;
    if (!query || !shared.metadata || !shared.calendarReady) {
      setState({ key, data: null, error: null });
      return;
    }
    void Promise.resolve().then(() => shared.load(query, priority))
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((e) => {
        if (!cancelled)
          setState({
            key,
            data: null,
            error:
              e instanceof Error
                ? e.message
                : "Daten konnten nicht geladen werden.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key, query, shared.load, shared.register, shared.metadata, shared.calendarReady, title, priority]);
  const data = state.key === key ? state.data : null,
    error = state.key === key ? state.error : null;
  useEffect(() => {
    shared.register(
      title,
      data
        ? {
            title,
            data,
            selectedIntervalId: selectedId,
            highlightedType: type,
            comparisonPreset,
            comparisonIntervalId,
          }
        : null,
    );
    return () => shared.register(title, null);
  }, [
    data,
    selectedId,
    shared.register,
    title,
    type,
    comparisonPreset,
    comparisonIntervalId,
  ]);
  const loadError = shared.metadataError ?? error;
  const loading = !loadError && (!shared.metadata || !shared.calendarReady || Boolean(query && !data));
  useDashboardExportStatus(title, !loading, loadError);
  return { data, error: loadError, loading };
}
export function useDashboardFacets() {
  const shared = useContext(SharedContext)!;
  return {
    markets: shared.facets?.markets ?? EMPTY_MARKETS,
    gms: shared.facets?.gms ?? EMPTY_GMS,
    startDate: dashboardStartDate(shared.metadata?.firstEntryDate),
    metadataLoading: !shared.metadata && !shared.metadataError,
    metadataError: shared.metadataError,
    ensureFilters: shared.ensureFilters,
    loading: !shared.facets && !shared.error,
    error: shared.error,
  };
}
type DashboardScopeInterval = {
  id: string;
  label: string;
  shortLabel: string;
  start: string;
  end: string;
};
function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      style={{
        fontSize: 11,
        padding: "9px 12px",
        color: error ? "#991b1b" : "#6b7280",
        background: error ? "rgba(185,28,28,.06)" : undefined,
        borderRadius: 9,
      }}
    >
      {children}
    </div>
  );
}
