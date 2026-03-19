"use client";

import { useState } from "react";
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

const gmMenuItems = [
  { label: "Home", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Gebiet", icon: <Map size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Kalender", icon: <Calendar size={11} strokeWidth={1.8} /> },
  { label: "Profil", icon: <User size={11} strokeWidth={1.8} /> },
];

const BONUS_GOALS = [
  { name: "Schütten/Displays", percent: 95, color: "#22c55e" },
  { name: "Distributionsziel", percent: 82, color: "#eab308" },
  { name: "Flexziel",          percent: 84, color: "#eab308" },
  { name: "Qualitätsziele",    percent: 83, color: "#eab308" },
];

export default function GMDashboard() {
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  return (
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
        <GMStatusCard />

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
              <BonusCircles onOpenDetail={() => setBonusModalOpen(true)} />
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
        <CollapsibleMenu items={gmMenuItems} defaultIndex={0} />
      </div>

      {bonusModalOpen && (
        <BonusDetailModal
          goals={BONUS_GOALS}
          onClose={() => setBonusModalOpen(false)}
        />
      )}
    </main>
  );
}
