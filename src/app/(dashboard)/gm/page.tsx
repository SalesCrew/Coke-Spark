"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { GMStatusCard } from "@/components/dashboard/GMStatusCard";
import { BonusCircles } from "@/components/dashboard/BonusCircles";
import { BonusDetailModal } from "@/components/dashboard/BonusDetailModal";
import { TimeTracker } from "@/components/dashboard/TimeTracker";
import { KuehlerInventurCard } from "@/components/dashboard/KuehlerInventurCard";
import { MarketList } from "@/components/dashboard/MarketList";
import { ActivityLauncher } from "@/components/dashboard/ActivityLauncher";
import { GM_MENU_ITEMS } from "@/components/dashboard/gmMenuItems";
import Aurora from "@/components/ui/Aurora";
import { RedMonthProvider } from "@/context/RedMonthContext";
import {
  cancelGmVisitSession,
  clearGmVisitPreloadCache,
  fetchGmBonusSummary,
  fetchGmVisitSession,
  fetchGmKpiSummary,
  fetchLatestActiveGmVisitSession,
  logoutCurrentUser,
  clearLatestActiveGmVisitHandoff,
  readLatestActiveGmVisitHandoff,
  readAuthSession,
  fetchGmKuehlerMhdProgress,
  readCachedGmKpiSummary,
  setGmVisitPreloadCache,
  type GmKpiSummary,
  type GmKuehlerMhdProgressPayload,
  type GmVisitSessionReadPayload,
} from "@/lib/api/backend";
import type { PraemienGmBonusSummary } from "@/types/praemien";

function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const h = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(safeSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function GMDashboard() {
  const router = useRouter();
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [bonusSummary, setBonusSummary] = useState<PraemienGmBonusSummary | null>(null);
  const [gmKpiSummary, setGmKpiSummary] = useState<GmKpiSummary | null>(null);
  const [kuehlerMhdProgress, setKuehlerMhdProgress] = useState<GmKuehlerMhdProgressPayload | null>(null);
  const [activeVisitPayload, setActiveVisitPayload] = useState<GmVisitSessionReadPayload | null>(null);
  const [activeVisitSeconds, setActiveVisitSeconds] = useState(0);
  const [activeVisitOpening, setActiveVisitOpening] = useState(false);
  const [activeVisitCancelConfirm, setActiveVisitCancelConfirm] = useState(false);
  const [activeVisitCancelling, setActiveVisitCancelling] = useState(false);
  const [activeVisitCancelError, setActiveVisitCancelError] = useState<string | null>(null);
  const [activeVisitSource, setActiveVisitSource] = useState<"backend" | "handoff" | null>(null);
  const [bonusLoading, setBonusLoading] = useState(true);

  const rememberActiveVisitPayload = useCallback((
    payload: GmVisitSessionReadPayload,
    source: "backend" | "handoff" = "backend",
  ): boolean => {
    if (payload.session.status !== "draft" || payload.session.submittedAt) return false;
    const campaignIds = Array.from(
      new Set((payload.sections ?? []).map((section) => section.campaignId).filter(Boolean)),
    );
    if (campaignIds.length === 0) return false;
    if (source === "backend") {
      setGmVisitPreloadCache(payload);
      clearLatestActiveGmVisitHandoff(payload.session.id);
    }
    setActiveVisitPayload(payload);
    setActiveVisitSource(source);
    setActiveVisitCancelConfirm(false);
    setActiveVisitCancelError(null);
    return true;
  }, []);

  const loadActiveVisitPopup = useCallback(async () => {
    try {
      const activeVisit = await fetchLatestActiveGmVisitSession();
      if (activeVisit.session?.id) {
        const payload = await fetchGmVisitSession(activeVisit.session.id);
        if (rememberActiveVisitPayload(payload, "backend")) return;
      }
    } catch {
      // Dashboard remains usable when the backend active-visit lookup fails.
      return;
    }

    clearLatestActiveGmVisitHandoff();
    setActiveVisitPayload(null);
    setActiveVisitSource(null);
    setActiveVisitCancelConfirm(false);
    setActiveVisitCancelError(null);
  }, [rememberActiveVisitPayload]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      void loadActiveVisitPopup();
    };
    const handoff = readLatestActiveGmVisitHandoff();
    if (handoff) {
      rememberActiveVisitPayload(handoff, "handoff");
    }
    refresh();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", refresh);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", refresh);
      }
    };
  }, [loadActiveVisitPopup, rememberActiveVisitPayload]);

  useEffect(() => {
    if (!activeVisitPayload?.session.startedAt) {
      setActiveVisitSeconds(0);
      return;
    }
    const startedAtMs = new Date(activeVisitPayload.session.startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      setActiveVisitSeconds(0);
      return;
    }
    const update = () => {
      setActiveVisitSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    };
    update();
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeVisitPayload?.session.startedAt]);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedGmKpiSummary();
    if (cached && !cancelled) {
      setGmKpiSummary(cached);
    }
    setBonusLoading(true);
    void (async () => {
      const [bonusResult, progressResult, kpiResult] = await Promise.allSettled([
        fetchGmBonusSummary(),
        fetchGmKuehlerMhdProgress(),
        fetchGmKpiSummary(),
      ]);
      if (!cancelled) {
        setBonusSummary(bonusResult.status === "fulfilled" ? bonusResult.value : null);
        setKuehlerMhdProgress(progressResult.status === "fulfilled" ? progressResult.value : null);
        if (kpiResult.status === "fulfilled") {
          setGmKpiSummary(kpiResult.value);
        }
        setBonusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bonusGoals = bonusSummary?.goals.map((goal) => ({
    name: goal.name,
    percent: goal.percent,
    color: goal.color,
    points: goal.points,
    maxPoints: goal.maxPoints,
    isManual: goal.isManual,
    isPending: goal.isPending,
  })) ?? [];
  const personalBonusPercent = bonusSummary && bonusSummary.totalMaxPoints > 0
    ? Math.max(0, Math.min(100, Math.round((bonusSummary.totalPoints / bonusSummary.totalMaxPoints) * 100)))
    : 0;
  const kuehlerCurrent = kuehlerMhdProgress?.kuehler.current ?? 0;
  const kuehlerTotal = kuehlerMhdProgress?.kuehler.total ?? 0;
  const kuehlerPercent = kuehlerMhdProgress?.kuehler.percent ?? 0;
  const mhdPercent = kuehlerMhdProgress?.mhd.percent ?? 0;
  const statusBars = [
    { label: "Persönliche Boni Ziele", value: `${personalBonusPercent}%`, percent: personalBonusPercent, color: "#F4B4B4" },
    { label: "Kühlerinventur", value: `${kuehlerCurrent}/${kuehlerTotal}`, percent: kuehlerPercent, color: "#E86B5A" },
    { label: "MHD", value: `${mhdPercent}%`, percent: mhdPercent, color: "#DC2626" },
  ];
  const cumulativeBonus = Math.round((gmKpiSummary?.bonusCumulativeEur ?? 0) * 100) / 100;
  const displayedBonus = bonusSummary?.hasActiveWave
    ? Math.round((bonusSummary.currentRewardEur ?? 0) * 100) / 100
    : cumulativeBonus;
  const averageIpp = Math.round((gmKpiSummary?.ippAllTimeAvg ?? 0) * 10) / 10;
  const authSession = readAuthSession();
  const gmDisplayName = [authSession?.user.firstName?.trim(), authSession?.user.lastName?.trim()]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(" ");
  const activeVisitCampaignNames = Array.from(
    new Set((activeVisitPayload?.sections ?? []).map((section) => section.campaignName).filter(Boolean)),
  );
  const activeVisitCampaignIds = Array.from(
    new Set((activeVisitPayload?.sections ?? []).map((section) => section.campaignId).filter(Boolean)),
  );
  const activeVisitAddress = activeVisitPayload
    ? [
      activeVisitPayload.market.address,
      [activeVisitPayload.market.postalCode, activeVisitPayload.market.city].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ")
    : "";

  async function openActiveVisit() {
    if (!activeVisitPayload || activeVisitOpening) return;
    setActiveVisitOpening(true);
    try {
      if (activeVisitSource === "backend" && (activeVisitPayload.sections ?? []).some((section) => section.questions.length > 0)) {
        setGmVisitPreloadCache(activeVisitPayload);
      }
      clearLatestActiveGmVisitHandoff(activeVisitPayload.session.id);
      router.push(
        `/gm/marktbesuch?chain=${encodeURIComponent(activeVisitPayload.market.name)}&address=${encodeURIComponent(activeVisitAddress)}&marketId=${encodeURIComponent(activeVisitPayload.market.id)}&campaignIds=${encodeURIComponent(activeVisitCampaignIds.join(","))}&sessionId=${encodeURIComponent(activeVisitPayload.session.id)}`,
      );
    } finally {
      setActiveVisitOpening(false);
    }
  }

  async function confirmCancelActiveVisit() {
    if (!activeVisitPayload || activeVisitCancelling) return;
    setActiveVisitCancelling(true);
    setActiveVisitCancelError(null);
    try {
      await cancelGmVisitSession(activeVisitPayload.session.id);
      clearGmVisitPreloadCache(activeVisitPayload.session.id);
      clearLatestActiveGmVisitHandoff(activeVisitPayload.session.id);
      setActiveVisitPayload(null);
      setActiveVisitSource(null);
      setActiveVisitCancelConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fragebogen konnte nicht abgebrochen werden.";
      setActiveVisitCancelError(message);
    } finally {
      setActiveVisitCancelling(false);
    }
  }

  return (
    <RedMonthProvider>
    <main className="min-h-screen" style={{ position: "relative", backgroundColor: "#f5f5f7" }}>
      {activeVisitPayload && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 22,
            zIndex: 80,
            width: 312,
            maxWidth: "calc(100vw - 32px)",
            textAlign: "left",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 14,
            backgroundColor: "#ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 18px 42px rgba(15,23,42,0.10)",
            padding: "14px",
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "#DC2626",
                boxShadow: "0 0 0 3px rgba(220,38,38,0.08)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.42)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
              Aktiver Fragebogen
            </span>
            <span style={{
              marginLeft: "auto",
              padding: "3px 7px",
              borderRadius: 7,
              background: "rgba(220,38,38,0.06)",
              boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.11)",
              fontSize: 10,
              fontWeight: 750,
              color: "#DC2626",
              fontVariantNumeric: "tabular-nums",
            }}>
              {formatElapsedTime(activeVisitSeconds)}
            </span>
          </div>
          {activeVisitCancelConfirm ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 750, color: "#1a1a1a", lineHeight: 1.25, marginBottom: 5 }}>
                Fragebogen abbrechen?
              </div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.46)", lineHeight: 1.45 }}>
                Willst du wirklich abbrechen? Alle Daten aus diesem laufenden Fragebogen werden geloescht.
              </div>
              {activeVisitCancelError && (
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "#DC2626", lineHeight: 1.35 }}>
                  {activeVisitCancelError}
                </div>
              )}
              <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeVisitCancelling) return;
                    setActiveVisitCancelConfirm(false);
                    setActiveVisitCancelError(null);
                  }}
                  disabled={activeVisitCancelling}
                  style={{
                    height: 30,
                    borderRadius: 7,
                    border: "none",
                    background: "rgba(0,0,0,0.04)",
                    color: "rgba(0,0,0,0.48)",
                    fontSize: 10,
                    fontWeight: 650,
                    cursor: activeVisitCancelling ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)",
                  }}
                >
                  Zurueck
                </button>
                <button
                  type="button"
                  onClick={() => { void confirmCancelActiveVisit(); }}
                  disabled={activeVisitCancelling}
                  style={{
                    height: 30,
                    borderRadius: 7,
                    border: "none",
                    background: activeVisitCancelling ? "rgba(0,0,0,0.10)" : "linear-gradient(to bottom, #DC2626, #b91c1c)",
                    color: activeVisitCancelling ? "rgba(0,0,0,0.26)" : "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    cursor: activeVisitCancelling ? "wait" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: activeVisitCancelling
                      ? "none"
                      : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                  }}
                >
                  {activeVisitCancelling ? "Loesche..." : "Abbrechen bestaetigen"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 750, color: "#1a1a1a", lineHeight: 1.25, marginBottom: 5 }}>
                {activeVisitCampaignNames[0] ?? "Marktbesuch"}
              </div>
              {activeVisitCampaignNames.length > 1 && (
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.38)", marginBottom: 5 }}>
                  +{activeVisitCampaignNames.length - 1} weitere Sektion
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 650, color: "rgba(0,0,0,0.52)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeVisitPayload.market.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.36)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeVisitAddress}
              </div>
              <div style={{ marginTop: 10, height: 1, background: "rgba(0,0,0,0.06)" }} />
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { void openActiveVisit(); }}
                  disabled={activeVisitOpening}
                  style={{
                    height: 29,
                    border: "none",
                    borderRadius: 7,
                    background: activeVisitOpening ? "rgba(0,0,0,0.10)" : "linear-gradient(to bottom, #059669, #0cb880)",
                    padding: "0 10px",
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: activeVisitOpening ? "rgba(0,0,0,0.26)" : "#ffffff",
                    cursor: activeVisitOpening ? "wait" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: activeVisitOpening
                      ? "none"
                      : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeVisitOpening ? "Oeffne..." : "Zum Fragebogen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveVisitCancelConfirm(true);
                    setActiveVisitCancelError(null);
                  }}
                  style={{
                    height: 29,
                    border: "none",
                    borderRadius: 7,
                    background: "rgba(220,38,38,0.06)",
                    padding: "0 9px",
                    textAlign: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: "rgba(180,60,60,0.72)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 0 0 0.5px rgba(220,38,38,0.12)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Fragebogen abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 500,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.4,
        }}
      >
        <Aurora
          colorStops={["#F4B4B4", "#DC2626", "#F4B4B4"]}
          blend={0.6}
          amplitude={0.8}
          speed={0.3}
        />
      </div>

      <div
        className="mx-auto px-6 pt-6 lg:px-10 lg:pt-8"
        style={{ maxWidth: 960, position: "relative", zIndex: 1 }}
      >
        <GMStatusCard name={gmDisplayName || ""} bars={statusBars} ipp={averageIpp} praemie={displayedBonus} />

        <div className="mt-5 flex gap-5 items-stretch">
          <div className="flex-1">
            <TimeTracker />
          </div>
          <div className="flex-1">
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 14,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                padding: "20px",
              }}
            >
              <BonusCircles
                bonus={bonusSummary?.currentRewardEur}
                goals={bonusGoals}
                hasActiveWave={bonusSummary?.hasActiveWave ?? false}
                isLoading={bonusLoading}
                onOpenDetail={() => setBonusModalOpen(true)}
              />
            </div>

            <div className="mt-4" style={{ position: "relative", zIndex: 5 }}>
              <KuehlerInventurCard />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-5 items-start">
          <div className="flex-1">
            <MarketList />
          </div>
          <div className="flex-1">
            <ActivityLauncher />
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu
          items={GM_MENU_ITEMS}
          defaultIndex={0}
          onSelect={(_index, item) => {
            if (item.action === "logout") {
              logoutCurrentUser();
              if (typeof window !== "undefined") {
                window.location.assign("/");
                return;
              }
              router.replace("/");
              router.refresh();
              return;
            }
            if (item.href) {
              router.push(item.href);
            }
          }}
        />
      </div>

      {bonusModalOpen && (
        <BonusDetailModal
          goals={bonusGoals}
          summary={bonusSummary}
          onClose={() => setBonusModalOpen(false)}
        />
      )}
    </main>
    </RedMonthProvider>
  );
}
