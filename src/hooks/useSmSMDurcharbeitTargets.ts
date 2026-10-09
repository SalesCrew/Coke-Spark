"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fetchMySMDurcharbeitTargets, getAuthPrincipalKey, readAuthSession, SM_HOME_DASHBOARD_CHANGED_EVENT, subscribeAuthSession } from "@/lib/api/backend";
import { smHomeDate, smHomeDayRolloverDelay } from "@/lib/sm/homeDashboard";
import type { SMDurcharbeitTargetList } from "@/types/smSMDurcharbeitCampaign";

const ownerKey = () => getAuthPrincipalKey(readAuthSession());
const noOwner = () => null;

/** The compact Home entry and full page read the same owned monthly targets. */
export function useSmSMDurcharbeitTargets(monthSelection: string | null = null) {
  const owner = useSyncExternalStore(subscribeAuthSession, ownerKey, noOwner);
  const [state, setState] = useState<(SMDurcharbeitTargetList & { requestedMonth: string | null; owner: string }) | null>(null);
  const [failure, setFailure] = useState<{ owner: string; month: string | null; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    if (!owner) return;
    let current = true;
    fetchMySMDurcharbeitTargets(monthSelection ?? undefined)
      .then(result => { if (current) { setState({ ...result, requestedMonth: monthSelection, owner }); setFailure(null); } })
      .catch(error => { if (current) setFailure({ owner, month: monthSelection, message: error instanceof Error ? error.message : "Durcharbeit konnte nicht geladen werden." }); });
    return () => { current = false; };
  }, [owner, reloadKey, monthSelection]);

  useEffect(() => {
    const visible = () => { if (!document.hidden) reload(); };
    window.addEventListener(SM_HOME_DASHBOARD_CHANGED_EVENT, reload);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const refresh = window.setInterval(visible, 300_000);
    let knownMonth = smHomeDate().slice(0, 7);
    let boundary: ReturnType<typeof setTimeout>;
    const atMidnight = () => {
      boundary = setTimeout(() => {
        const month = smHomeDate().slice(0, 7);
        if (month !== knownMonth) { knownMonth = month; reload(); }
        atMidnight();
      }, smHomeDayRolloverDelay());
    };
    atMidnight();
    return () => {
      window.removeEventListener(SM_HOME_DASHBOARD_CHANGED_EVENT, reload);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(refresh);
      clearTimeout(boundary);
    };
  }, [reload]);

  const ownState = state?.owner === owner ? state : null;
  return {
    owner,
    state: ownState,
    loaded: ownState?.requestedMonth === monthSelection ? ownState : null,
    error: failure?.owner === owner && failure?.month === monthSelection ? failure.message : null,
    reload,
  };
}
