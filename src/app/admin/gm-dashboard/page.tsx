"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RealDashboardProvider } from "@/components/admin/gm-dashboard/RealGmDashboard";
import { IppAuswertungCard } from "@/components/admin/gm-dashboard/IppAuswertungCard";
import { FuellstandCard } from "@/components/admin/gm-dashboard/FuellstandCard";
import { PlatzierungenCard } from "@/components/admin/gm-dashboard/PlatzierungenCard";
import { PlaceholderCardNine } from "@/components/admin/gm-dashboard/PlaceholderCardNine";
import type { DashboardExport } from "@/types/gm-dashboard";
import type { Workspace } from "@/types/praemien-workspace";
import { BonusOverviewCard } from "@/components/admin/gm-dashboard/BonusOverviewCard";
import { readAuthSession } from "@/lib/api/backend";
import { exportRealGmDashboard } from "@/lib/gm-dashboard/export";
import { useAdminAccess } from "@/context/AdminAccessContext";

export default function GmDashboardPage() {
  const { isAdmin } = useAdminAccess();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const prepareExport = useRef<(() => Promise<void>) | null>(null);
  const datasets = useRef(new Map<string, DashboardExport>()),
    bonus = useRef<Workspace | null>(null);
  const register = useCallback((key: string, value: DashboardExport | null) => {
    if (value) datasets.current.set(key, value);
    else datasets.current.delete(key);
  }, []);
  const bonusSnapshot = useCallback((value: Workspace | null) => {
    bonus.current = value;
  }, []);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await prepareExport.current?.();
      await exportRealGmDashboard({
        datasets: [...datasets.current.values()],
        bonus: isAdmin ? bonus.current : null,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Export konnte nicht erstellt werden.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [isAdmin, isExporting]);

  useEffect(() => {
    const handler = () => {
      void handleExport();
    };
    window.addEventListener("admin:gm-dashboard:export", handler);
    return () =>
      window.removeEventListener("admin:gm-dashboard:export", handler);
  }, [handleExport]);

  return (
    <RealDashboardProvider register={register} prepareExportRef={prepareExport} needsBonus={isAdmin}>
      <div
        style={{
          minHeight: "68vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {exportError && (
          <div
            style={{
              padding: "9px 11px",
              borderRadius: 8,
              border: "1px solid rgba(220,38,38,0.2)",
              background: "rgba(220,38,38,0.06)",
              color: "#DC2626",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Export fehlgeschlagen: {exportError}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 12,
            alignItems: "start",
          }}
        >
          <IppAuswertungCard />
          <FuellstandCard />
        </div>

        {isAdmin && <BonusOverviewCard onSnapshot={bonusSnapshot} />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(520px, 1.35fr) minmax(260px, 0.65fr)",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <PlatzierungenCard />
          <PlaceholderCardNine />
        </div>
      </div>
    </RealDashboardProvider>
  );
}
