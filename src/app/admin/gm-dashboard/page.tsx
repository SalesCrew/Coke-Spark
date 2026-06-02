"use client";

import { IppAuswertungCard } from "@/components/admin/gm-dashboard/IppAuswertungCard";
import { FuellstandCard } from "@/components/admin/gm-dashboard/FuellstandCard";
import { PlatzierungenCard } from "@/components/admin/gm-dashboard/PlatzierungenCard";
import { PlaceholderCardNine } from "@/components/admin/gm-dashboard/PlaceholderCardNine";

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
          alignItems: "start",
        }}
      >
        <PlatzierungenCard />
        <PlaceholderCardNine />
      </div>
    </div>
  );
}
