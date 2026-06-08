"use client";

import { IppAuswertungCard } from "@/components/admin/gm-dashboard/IppAuswertungCard";
import { FuellstandCard } from "@/components/admin/gm-dashboard/FuellstandCard";
import { PlatzierungenCard } from "@/components/admin/gm-dashboard/PlatzierungenCard";
import { PlaceholderCardNine } from "@/components/admin/gm-dashboard/PlaceholderCardNine";

export default function GmDashboardPage() {
  return (
    <div style={{ minHeight: "68vh", display: "flex", flexDirection: "column", gap: 12 }}>
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
