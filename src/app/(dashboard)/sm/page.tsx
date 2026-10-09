"use client";

import type { CSSProperties } from "react";
import { SmDashboardNavigation } from "@/components/sm/SmDashboardNavigation";
import { SmDashboardHero } from "@/components/dashboard/SmDashboardHero";
import { SmDashboardSchedule } from "@/components/dashboard/SmDashboardSchedule";
import { SmSMDurcharbeitSummary } from "@/components/dashboard/SmSMDurcharbeitSummary";

export default function SMDashboard() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="mx-auto flex min-h-[100svh] max-w-[420px] flex-col px-6 pb-[calc(92px+env(safe-area-inset-bottom))] pt-6">
        <div className="max-h-[max(144px,calc(100svh-300px-env(safe-area-inset-bottom)))] shrink-0 overflow-y-auto" data-sm-dashboard-overview role="region" aria-label="Tagesübersicht und Kalender" tabIndex={0}>
          <SmDashboardHero />
          <SmDashboardSchedule />
        </div>
        <div className="mt-6 flex flex-1" data-sm-durcharbeit-section><SmSMDurcharbeitSummary /></div>
      </div>

      <div className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-0 right-0 z-50" data-sm-home-dock style={{
        "--sm-menu-chat-max-height": "calc(100dvh - 80px - env(safe-area-inset-bottom))",
      } as CSSProperties}>
        <SmDashboardNavigation />
      </div>
    </main>
  );
}
