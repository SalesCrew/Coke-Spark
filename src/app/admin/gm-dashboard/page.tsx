"use client";

import { IppAuswertungCard } from "@/components/admin/gm-dashboard/IppAuswertungCard";
import { FuellstandCard } from "@/components/admin/gm-dashboard/FuellstandCard";

export default function GmDashboardPage() {
  return (
    <div style={{ minHeight: "68vh", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            GM Dashboard
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Analyse
          </h1>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(640px, 1fr) minmax(320px, 1fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        <IppAuswertungCard />
        <FuellstandCard />
      </div>
    </div>
  );
}
