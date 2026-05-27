"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Clock, Calendar, User, Map } from "lucide-react";
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
  fetchGmBonusSummary,
  fetchGmKpiSummary,
  logoutCurrentUser,
  fetchGmKuehlerMhdProgress,
  readCachedGmKpiSummary,
  type GmKpiSummary,
  type GmKuehlerMhdProgressPayload,
} from "@/lib/api/backend";
import type { PraemienGmBonusSummary } from "@/types/praemien";

const gmMenuItems = [
  { label: "Home", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Gebiet", icon: <Map size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Kalender", icon: <Calendar size={11} strokeWidth={1.8} /> },
  { label: "Profil", icon: <User size={11} strokeWidth={1.8} /> },
];

export default function GMDashboard() {
  const router = useRouter();
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [bonusSummary, setBonusSummary] = useState<PraemienGmBonusSummary | null>(null);
  const [gmKpiSummary, setGmKpiSummary] = useState<GmKpiSummary | null>(null);
  const [kuehlerMhdProgress, setKuehlerMhdProgress] = useState<GmKuehlerMhdProgressPayload | null>(null);
  const [bonusLoading, setBonusLoading] = useState(true);

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

  return (
    <RedMonthProvider>
    <main className="min-h-screen" style={{ position: "relative", backgroundColor: "#f5f5f7" }}>
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
        <GMStatusCard bars={statusBars} ipp={averageIpp} praemie={cumulativeBonus} />

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
          onLogout={() => {
            logoutCurrentUser();
            router.push("/");
            router.refresh();
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
