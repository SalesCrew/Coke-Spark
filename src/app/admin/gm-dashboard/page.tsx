"use client";

import { useEffect, useState } from "react";
import { IppAuswertungCard } from "@/components/admin/gm-dashboard/IppAuswertungCard";
import { FuellstandCard } from "@/components/admin/gm-dashboard/FuellstandCard";
import { PlatzierungenCard } from "@/components/admin/gm-dashboard/PlatzierungenCard";
import { PlaceholderCardNine } from "@/components/admin/gm-dashboard/PlaceholderCardNine";
import { readAuthSession } from "@/lib/api/backend";
import { exportGmDashboardExcel } from "@/lib/exports/planningExports";

export default function GmDashboardPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await exportGmDashboardExcel({
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handler = () => { void handleExport(); };
    window.addEventListener("admin:gm-dashboard:export", handler);
    return () => window.removeEventListener("admin:gm-dashboard:export", handler);
  });

  return (
    <div style={{ minHeight: "68vh", display: "flex", flexDirection: "column", gap: 12 }}>
      {exportError && (
        <div style={{ padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#DC2626", fontSize: 11, fontWeight: 600 }}>
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
  );
}
