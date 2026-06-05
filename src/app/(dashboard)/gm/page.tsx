"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Clock, Calendar, User, Map, LogOut } from "lucide-react";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { GMStatusCard } from "@/components/dashboard/GMStatusCard";
import { BonusCircles } from "@/components/dashboard/BonusCircles";
import { BonusDetailModal } from "@/components/dashboard/BonusDetailModal";
import { TimeTracker } from "@/components/dashboard/TimeTracker";
import { KuehlerInventurCard } from "@/components/dashboard/KuehlerInventurCard";
import { MarketList } from "@/components/dashboard/MarketList";
import { ActivityLauncher } from "@/components/dashboard/ActivityLauncher";
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
  readAuthSession,
  fetchGmKuehlerMhdProgress,
  readCachedGmKpiSummary,
  setGmVisitPreloadCache,
  type GmKpiSummary,
  type GmKuehlerMhdProgressPayload,
  type GmVisitSessionReadPayload,
} from "@/lib/api/backend";
import { clearLocalActiveVisitSnapshot } from "@/lib/gm/visitSessionPersistence";
import type { PraemienGmBonusSummary } from "@/types/praemien";

const gmMenuItems = [
  { label: "Home", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Gebiet", icon: <Map size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Kalender", icon: <Calendar size={11} strokeWidth={1.8} /> },
  { label: "Profil", icon: <User size={11} strokeWidth={1.8} /> },
  { label: "Logout", icon: <LogOut size={11} strokeWidth={1.9} />, action: "logout" as const, tone: "danger" as const },
];

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
  const [bonusLoading, setBonusLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const activeVisit = await fetchLatestActiveGmVisitSession();
        if (cancelled || !activeVisit.session?.id) return;
        const payload = await fetchGmVisitSession(activeVisit.session.id);
        if (cancelled) return;
        setGmVisitPreloadCache(payload);
        setActiveVisitPayload(payload);
        setActiveVisitCancelConfirm(false);
        setActiveVisitCancelError(null);
      } catch {
        // Dashboard remains usable when there is no resumable visit or the lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    ? `${activeVisitPayload.market.address}, ${activeVisitPayload.market.postalCode} ${activeVisitPayload.market.city}`.trim()
    : "";

  async function openActiveVisit() {
    if (!activeVisitPayload || activeVisitOpening) return;
    setActiveVisitOpening(true);
    try {
      setGmVisitPreloadCache(activeVisitPayload);
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
      clearLocalActiveVisitSnapshot({
        marketId: activeVisitPayload.market.id,
        campaignIds: activeVisitCampaignIds,
      });
      setActiveVisitPayload(null);
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
            border: "1px solid rgba(220,38,38,0.10)",
            borderRadius: 12,
            background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.91))",
            boxShadow: "0 16px 38px rgba(17,24,39,0.10), 0 2px 8px rgba(220,38,38,0.08), inset 0 1px 0 rgba(255,255,255,0.78)",
            backdropFilter: "blur(20px)",
            padding: "13px 14px 11px",
            fontFamily: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#DC2626",
                boxShadow: "0 0 0 4px rgba(220,38,38,0.09)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#111827", letterSpacing: "0" }}>
              Aktiver Fragebogen
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsedTime(activeVisitSeconds)}
            </span>
          </div>
          {activeVisitCancelConfirm ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 850, color: "#111827", lineHeight: 1.25, marginBottom: 6 }}>
                Fragebogen abbrechen?
              </div>
              <div style={{ fontSize: 10, color: "rgba(17,24,39,0.58)", lineHeight: 1.38 }}>
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
                    borderRadius: 8,
                    border: "1px solid rgba(17,24,39,0.08)",
                    background: "rgba(17,24,39,0.04)",
                    color: "rgba(17,24,39,0.58)",
                    fontSize: 10,
                    fontWeight: 850,
                    cursor: activeVisitCancelling ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
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
                    borderRadius: 8,
                    border: "1px solid rgba(220,38,38,0.18)",
                    background: activeVisitCancelling ? "rgba(220,38,38,0.08)" : "rgba(220,38,38,0.10)",
                    color: activeVisitCancelling ? "rgba(220,38,38,0.48)" : "#DC2626",
                    fontSize: 10,
                    fontWeight: 900,
                    cursor: activeVisitCancelling ? "wait" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {activeVisitCancelling ? "Loesche..." : "Abbrechen bestaetigen"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", lineHeight: 1.25, marginBottom: 5 }}>
                {activeVisitCampaignNames[0] ?? "Marktbesuch"}
              </div>
              {activeVisitCampaignNames.length > 1 && (
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(17,24,39,0.52)", marginBottom: 5 }}>
                  +{activeVisitCampaignNames.length - 1} weitere Sektion
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 650, color: "rgba(17,24,39,0.54)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeVisitPayload.market.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(17,24,39,0.46)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeVisitAddress}
              </div>
              <div style={{ marginTop: 10, height: 1, background: "linear-gradient(90deg, rgba(34,197,94,0.16), rgba(220,38,38,0.10), rgba(17,24,39,0.045))" }} />
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { void openActiveVisit(); }}
                  disabled={activeVisitOpening}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 900,
                    color: activeVisitOpening ? "rgba(22,163,74,0.48)" : "#16A34A",
                    cursor: activeVisitOpening ? "wait" : "pointer",
                    fontFamily: "inherit",
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
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    textAlign: "right",
                    fontSize: 10,
                    fontWeight: 850,
                    color: "rgba(220,38,38,0.72)",
                    cursor: "pointer",
                    fontFamily: "inherit",
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
        <GMStatusCard name={gmDisplayName || ""} bars={statusBars} ipp={averageIpp} praemie={cumulativeBonus} />

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
          items={gmMenuItems}
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
