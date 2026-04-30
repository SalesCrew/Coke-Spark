"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCurrentRedMonth,
  fetchRedMonthCalendar,
  updateRedMonthConfig,
} from "@/lib/api/backend";
import type { RedMonthConfig, RedMonthPeriod } from "@/types/red-month";

type RedMonthContextValue = {
  current: RedMonthPeriod | null;
  config: RedMonthConfig | null;
  calendar: RedMonthPeriod[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refreshCurrent: () => Promise<void>;
  loadCalendar: (input?: { from?: string; to?: string }) => Promise<void>;
  saveConfig: (input: { anchorStart: string; cycleWeeks: number[]; timezone?: string }) => Promise<void>;
};

const RedMonthContext = createContext<RedMonthContextValue | null>(null);

export function RedMonthProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<RedMonthPeriod | null>(null);
  const [config, setConfig] = useState<RedMonthConfig | null>(null);
  const [calendar, setCalendar] = useState<RedMonthPeriod[]>([]);
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
      loading,
      saving,
      error,
      refreshCurrent,
      loadCalendar,
      saveConfig,
    }),
    [calendar, config, current, error, loadCalendar, loading, refreshCurrent, saveConfig, saving],
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

