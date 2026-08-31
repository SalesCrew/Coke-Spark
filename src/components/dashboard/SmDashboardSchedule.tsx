"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AssignmentList, type DashboardAssignment } from "@/components/dashboard/AssignmentList";
import { WeekStrip, type CalendarVisitPreview } from "@/components/dashboard/WeekStrip";
import {
  fetchMySmPlanningAssignments,
  fetchSmVisit,
  readMySmPlanningAssignmentsCache,
  readSmVisitPreloadCache,
  setMySmPlanningAssignmentsCache,
  setSmVisitPreloadCache,
} from "@/lib/api/backend";
import type { SmPlanningAssignment } from "@/types/smPlanning";
import { austrianHoliday } from "@/lib/sm/austrianHolidays";

type DateRange = { from: string; to: string };
const smHolidayLabel = (date: string) => austrianHoliday(date)?.name;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function buildRange(center: string): DateRange {
  return { from: shiftIsoDate(center, -46), to: shiftIsoDate(center, 46) };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString("de-AT", { maximumFractionDigits: 2 })} h`;
}

const STATUS_PRIORITY: Record<SmPlanningAssignment["status"], number> = {
  in_progress: 0,
  open: 1,
  confirmed: 2,
  planned: 3,
  missed: 4,
  cancelled: 5,
  completed: 6,
};

function toDashboardAssignment(assignment: SmPlanningAssignment): DashboardAssignment {
  return {
    id: assignment.id,
    duration: formatDuration(assignment.effective.plannedMinutes),
    market: assignment.effective.marketName,
    address: assignment.effective.address,
    workDate: assignment.effective.workDate,
    marketInternalId: assignment.effective.marketInternalId,
    region: assignment.effective.region,
    sourceType: assignment.sourceType,
    status: assignment.status,
    holidayAdjustment: assignment.holidayAdjustment,
  };
}

function buildSmVisitHref(assignment: DashboardAssignment): string {
  const query = new URLSearchParams({ assignmentId: assignment.id });
  return `/sm/marktbesuch?${query.toString()}`;
}

export function SmDashboardSchedule() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [range, setRange] = useState<DateRange>(() => buildRange(toIsoDate(new Date())));
  const [assignments, setAssignments] = useState<SmPlanningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [startingAssignmentId, setStartingAssignmentId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = readMySmPlanningAssignmentsCache(range.from, range.to);
    if (cached) {
      setAssignments(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }
    fetchMySmPlanningAssignments(range.from, range.to)
      .then((rows) => {
        if (cancelled) return;
        setAssignments(rows);
        setMySmPlanningAssignmentsCache(range.from, range.to, rows);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        if (!cached) setError(loadError instanceof Error ? loadError.message : "Einsätze konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const visitsByDate = useMemo(() => {
    const grouped: Record<string, CalendarVisitPreview[]> = {};
    for (const assignment of assignments) {
      const date = assignment.effective.workDate;
      (grouped[date] ??= []).push({
        id: assignment.id,
        name: assignment.effective.marketName,
        detail: formatDuration(assignment.effective.plannedMinutes),
      });
    }
    return grouped;
  }, [assignments]);

  const selectedAssignments = useMemo<DashboardAssignment[]>(() => assignments
    .filter((assignment) => assignment.effective.workDate === selectedDate)
    .sort((left, right) => STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status])
    .map(toDashboardAssignment), [assignments, selectedDate]);

  useEffect(() => {
    if ((typeof navigator !== "undefined" && !navigator.onLine) || selectedAssignments.length === 0) return;
    let cancelled = false;
    void Promise.allSettled(selectedAssignments.map(async (assignment) => {
      const payload = await fetchSmVisit(assignment.id);
      if (!cancelled) setSmVisitPreloadCache(assignment.id, payload);
    }));
    return () => { cancelled = true; };
  }, [selectedAssignments]);

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    if (date <= shiftIsoDate(range.from, 7) || date >= shiftIsoDate(range.to, -7)) {
      setRange(buildRange(date));
    }
  }, [range.from, range.to]);

  const launchAssignment = useCallback(async (assignment: DashboardAssignment) => {
    if (startingAssignmentId) return;
    setStartingAssignmentId(assignment.id);
    setLaunchError(null);
    const cached = readSmVisitPreloadCache(assignment.id);
    if (cached) {
      router.push(buildSmVisitHref(assignment));
      return;
    }
    try {
      const payload = await fetchSmVisit(assignment.id);
      setSmVisitPreloadCache(assignment.id, payload);
      router.push(buildSmVisitHref(assignment));
    } catch (launchFailure) {
      setLaunchError(launchFailure instanceof Error ? launchFailure.message : "Der Einsatz konnte nicht vorbereitet werden.");
      setStartingAssignmentId(null);
    }
  }, [router, startingAssignmentId]);

  return (
    <>
      <div className="mt-5 px-1">
        {launchError ? <p role="alert" className="mb-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-[9px] font-medium leading-relaxed text-red-700">{launchError}</p> : null}
        <AssignmentList
          assignments={selectedAssignments}
          loading={loading}
          error={error}
          onRetry={() => setReloadKey((value) => value + 1)}
          startingAssignmentId={startingAssignmentId}
          onStart={(assignment) => { void launchAssignment(assignment); }}
        />
      </div>
      <div className="mt-6 px-1">
        <WeekStrip selectedDate={selectedDate} visitsByDate={visitsByDate} onDateChange={handleDateChange} holidayLabel={smHolidayLabel} />
      </div>
    </>
  );
}
