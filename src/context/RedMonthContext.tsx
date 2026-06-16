"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  activateRedMonthYear,
  createRedMonthYear,
  fetchCurrentRedMonth,
  fetchRedMonthCalendar,
  fetchRedMonthYears,
  previewRedMonthYear,
  updateRedMonthYear,
  updateRedMonthConfig,
} from "@/lib/api/backend";
import type { RedMonthConfig, RedMonthPeriod, RedMonthYear } from "@/types/red-month";

type RedMonthContextValue = {
  current: RedMonthPeriod | null;
  config: RedMonthConfig | null;
  calendar: RedMonthPeriod[];
  years: RedMonthYear[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refreshCurrent: () => Promise<void>;
  loadCalendar: (input?: { from?: string; to?: string }) => Promise<void>;
  loadYears: () => Promise<void>;
  previewYear: (input: { redYear: number; anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string }) => Promise<RedMonthPeriod[]>;
  createYear: (input: { redYear: number; anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string; status?: "draft" | "active" | "locked" }) => Promise<void>;
  updateYear: (id: string, input: { anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string }) => Promise<void>;
  activateYear: (id: string) => Promise<void>;
  saveConfig: (input: { anchorStart: string; cycleWeeks: number[]; timezone?: string }) => Promise<void>;
};

const RedMonthContext = createContext<RedMonthContextValue | null>(null);

export function RedMonthProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<RedMonthPeriod | null>(null);
  const [config, setConfig] = useState<RedMonthConfig | null>(null);
  const [calendar, setCalendar] = useState<RedMonthPeriod[]>([]);
  const [years, setYears] = useState<RedMonthYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCurrentRedMonth();
      setCurrent(data.current);
      setConfig(data.config);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Monat konnte nicht geladen werden.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async (input?: { from?: string; to?: string }) => {
    try {
      const periods = await fetchRedMonthCalendar(input);
      setCalendar(periods);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Kalender konnte nicht geladen werden.";
      setError(message);
      setCalendar([]);
    }
  }, []);

  const loadYears = useCallback(async () => {
    try {
      const data = await fetchRedMonthYears();
      setYears(data.years);
      if (data.current) setCurrent(data.current);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Jahre konnten nicht geladen werden.";
      setError(message);
      setYears([]);
    }
  }, []);

  const previewYear = useCallback(async (input: { redYear: number; anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string }) => {
    const data = await previewRedMonthYear(input);
    return data.periods;
  }, []);

  const createYear = useCallback(async (input: { redYear: number; anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string; status?: "draft" | "active" | "locked" }) => {
    setSaving(true);
    try {
      const data = await createRedMonthYear(input);
      setYears((previous) => [data.year, ...previous.filter((entry) => entry.id !== data.year.id)].sort((left, right) => right.redYear - left.redYear));
      if (data.periods.length > 0) {
        setCalendar((previous) => [...data.periods, ...previous.filter((entry) => !data.periods.some((period) => period.id === entry.id))]);
      }
      setError(null);
      await refreshCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Jahr konnte nicht erstellt werden.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshCurrent]);

  const updateYear = useCallback(async (id: string, input: { anchorStart: string; cycleWeeks: number[]; periodCount: number; timezone?: string }) => {
    setSaving(true);
    try {
      const data = await updateRedMonthYear(id, input);
      setYears((previous) => previous.map((entry) => entry.id === data.year.id ? data.year : entry));
      setCalendar((previous) => [...data.periods, ...previous.filter((entry) => !data.periods.some((period) => period.id === entry.id))]);
      setError(null);
      await refreshCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Jahr konnte nicht gespeichert werden.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshCurrent]);

  const activateYear = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const year = await activateRedMonthYear(id);
      setYears((previous) => previous.map((entry) => entry.id === year.id ? year : entry));
      setError(null);
      await refreshCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Jahr konnte nicht aktiviert werden.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshCurrent]);

  const saveConfig = useCallback(async (input: { anchorStart: string; cycleWeeks: number[]; timezone?: string }) => {
    setSaving(true);
    try {
      const data = await updateRedMonthConfig(input);
      setCurrent(data.current);
      setConfig(data.config);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "RED-Konfiguration konnte nicht gespeichert werden.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    void refreshCurrent();
  }, [refreshCurrent]);

  const value = useMemo<RedMonthContextValue>(
    () => ({
      current,
      config,
      calendar,
      years,
      loading,
      saving,
      error,
      refreshCurrent,
      loadCalendar,
      loadYears,
      previewYear,
      createYear,
      updateYear,
      activateYear,
      saveConfig,
    }),
    [activateYear, calendar, config, createYear, current, error, loadCalendar, loadYears, loading, previewYear, refreshCurrent, saveConfig, saving, updateYear, years],
  );

  return <RedMonthContext.Provider value={value}>{children}</RedMonthContext.Provider>;
}

export function useRedMonth(): RedMonthContextValue {
  const context = useContext(RedMonthContext);
  if (!context) {
    throw new Error("useRedMonth must be used within RedMonthProvider");
  }
  return context;
}

