"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { requestGmDashboard, readAuthSession } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import { calendarToday } from "@/lib/gm-dashboard/data";
import type {
  AvailabilityType,
  DashboardData,
  DashboardExport,
  DashboardFacets,
  DashboardScope,
} from "@/types/gm-dashboard";
type Shared = {
  facets: DashboardFacets | null;
  error: string | null;
  version: number;
  load: (query: string) => Promise<DashboardData>;
  register: (key: string, value: DashboardExport | null) => void;
  refresh: () => void;
};
const SharedContext = createContext<Shared | null>(null);
export function RealDashboardProvider({
  children,
  register,
}: {
  children: ReactNode;
  register: Shared["register"];
}) {
  const { loadCalendar } = useRedMonth();
  const [facets, setFacets] = useState<DashboardFacets | null>(null),
    [error, setError] = useState<string | null>(null),
    [version, setVersion] = useState(0);
  const requests = useRef(new Map<string, Promise<DashboardData>>());
  const refresh = useCallback(() => {
    requests.current.clear();
    setVersion((v) => v + 1);
  }, []);
  const load = useCallback((query: string) => {
    const actor = readAuthSession()?.user.id;
    const key = `${actor}:${query}`;
    const existing = requests.current.get(key);
    if (existing) return existing;
    const request = requestGmDashboard<DashboardData>(
      "/query",
      JSON.parse(query),
    ).then((data) => {
      if (readAuthSession()?.user.id !== actor)
        throw new Error("Der angemeldete Zugang hat sich geändert.");
      return data;
    });
    requests.current.set(key, request);
    return request;
  }, []);
  useEffect(() => {
    let cancelled = false;
    setFacets(null);
    setError(null);
    const actor = readAuthSession()?.user.id;
    void requestGmDashboard<DashboardFacets>("/facets")
      .then((data) => {
        if (!cancelled && readAuthSession()?.user.id === actor) setFacets(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Filterdaten konnten nicht geladen werden.",
          );
      });
    const today = calendarToday(),
      date = new Date(`${today}T00:00:00Z`);
    void loadCalendar({
      from: `${date.getUTCFullYear() - 2}-01-01`,
      to: `${date.getUTCFullYear() + 1}-12-31`,
    });
    return () => {
      cancelled = true;
    };
  }, [loadCalendar, version]);
  const shared = useMemo(
    () => ({ facets, error, version, load, register, refresh }),
    [facets, error, version, load, register, refresh],
  );
  return (
    <SharedContext.Provider value={shared}>
      {/^http:\/\/(127\.0\.0\.1|localhost):4017$/.test(
        process.env.NEXT_PUBLIC_BACKEND_URL ?? "",
      ) && (
        <Message>
          Isolierter lokaler Test · synthetische Besuchs- und Prämienwerte aus
          einer In-Memory-Datenbank. Keine Produktionsverbindung.
        </Message>
      )}
      {children}
    </SharedContext.Provider>
  );
}
export function useDashboardData(
  title: string,
  intervals: DashboardScopeInterval[],
  scope: DashboardScope,
  selectedId: string | null,
  type: AvailabilityType | null = null,
  comparisonPreset?: string,
  comparisonIntervalId?: string | null,
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
    shared.register(title, null);
    if (!query) {
      setState({ key, data: null, error: null });
      return;
    }
    void shared
      .load(query)
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
  }, [key, query, shared.load, shared.register, title]);
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
  return { data, error, loading: Boolean(query && !data && !error) };
}
export function useDashboardFacets() {
  const shared = useContext(SharedContext)!;
  return {
    markets: shared.facets?.markets ?? [],
    gms: shared.facets?.gms ?? [],
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
