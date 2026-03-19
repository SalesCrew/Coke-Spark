"use client";

import { useState, useEffect } from "react";

// ── Mock data ─────────────────────────────────────────────────

const CAMPAIGNS = [
  // ── Aktiv ─────────────────────────────────────────────────
  {
    id: "1",
    name: "Standartbesuch KW12",
    type: "standart",
    color: "#DC2626",
    inactive: false,
    filled: 1240,
    total: 2800,
    todayNew: 87,
    thisWeek: 412,
    regions: [
      { name: "Nord", pct: 94 },
      { name: "Ost", pct: 38 },
      { name: "Süd", pct: 31 },
      { name: "West", pct: 14 },
    ],
  },
  {
    id: "2",
    name: "Flexbesuch April",
    type: "flex",
    color: "#84CC16",
    inactive: false,
    filled: 640,
    total: 2800,
    todayNew: 52,
    thisWeek: 198,
    regions: [
      { name: "Nord", pct: 28 },
      { name: "Ost", pct: 21 },
      { name: "Süd", pct: 18 },
      { name: "West", pct: 24 },
    ],
  },
  {
    id: "3",
    name: "Kühlerinventur März",
    type: "kuehler",
    color: "#D97706",
    inactive: false,
    filled: 3104,
    total: 3200,
    todayNew: 4,
    thisWeek: 29,
    regions: [
      { name: "Nord", pct: 99 },
      { name: "Ost", pct: 97 },
      { name: "Süd", pct: 95 },
      { name: "West", pct: 96 },
    ],
  },
  {
    id: "4",
    name: "MHD Kontrolle KW11",
    type: "mhd",
    color: "#7C3AED",
    inactive: false,
    filled: 410,
    total: 1200,
    todayNew: 33,
    thisWeek: 140,
    regions: [
      { name: "Nord", pct: 41 },
      { name: "Ost", pct: 35 },
      { name: "Süd", pct: 30 },
      { name: "West", pct: 28 },
    ],
  },
  {
    id: "5",
    name: "Billa Frühjahr 2026",
    type: "billa",
    color: "#0891B2",
    inactive: false,
    filled: 88,
    total: 540,
    todayNew: 11,
    thisWeek: 44,
    regions: [
      { name: "Nord", pct: 12 },
      { name: "Ost", pct: 19 },
      { name: "Süd", pct: 14 },
      { name: "West", pct: 17 },
    ],
  },
  // ── Inaktiv ───────────────────────────────────────────────
  {
    id: "6",
    name: "Standartbesuch KW08",
    type: "standart",
    color: "#DC2626",
    inactive: true,
    filled: 2800,
    total: 2800,
    todayNew: 0,
    thisWeek: 0,
    regions: [
      { name: "Nord", pct: 100 },
      { name: "Ost", pct: 100 },
      { name: "Süd", pct: 100 },
      { name: "West", pct: 100 },
    ],
  },
  {
    id: "7",
    name: "Flexbesuch März",
    type: "flex",
    color: "#84CC16",
    inactive: true,
    filled: 1820,
    total: 1950,
    todayNew: 0,
    thisWeek: 0,
    regions: [
      { name: "Nord", pct: 98 },
      { name: "Ost", pct: 91 },
      { name: "Süd", pct: 95 },
      { name: "West", pct: 88 },
    ],
  },
  {
    id: "8",
    name: "Kühlerinventur Februar",
    type: "kuehler",
    color: "#D97706",
    inactive: true,
    filled: 3200,
    total: 3200,
    todayNew: 0,
    thisWeek: 0,
    regions: [
      { name: "Nord", pct: 100 },
      { name: "Ost", pct: 100 },
      { name: "Süd", pct: 100 },
      { name: "West", pct: 100 },
    ],
  },
];

const MOCK_MARKETS = [
  { id: "m1", name: "Billa Wien 10", region: "Wien", finished: true },
  { id: "m2", name: "Billa Wien 12", region: "Wien", finished: true },
  { id: "m3", name: "Merkur Graz Hauptplatz", region: "Steiermark", finished: false },
  { id: "m4", name: "Spar Linz Nord", region: "Oberösterreich", finished: false },
  { id: "m5", name: "Billa Wien 6", region: "Wien", finished: true },
  { id: "m6", name: "Billa Mödling", region: "Niederösterreich", finished: false },
  { id: "m7", name: "Merkur Wien 22", region: "Wien", finished: true },
  { id: "m8", name: "Spar Graz West", region: "Steiermark", finished: true },
  { id: "m9", name: "Billa Baden", region: "Niederösterreich", finished: false },
  { id: "m10", name: "Merkur Salzburg", region: "Salzburg", finished: false },
  { id: "m11", name: "Billa Wien 15", region: "Wien", finished: true },
  { id: "m12", name: "Spar Wels", region: "Oberösterreich", finished: true },
  { id: "m13", name: "Billa Klagenfurt", region: "Kärnten", finished: false },
  { id: "m14", name: "Merkur Innsbruck", region: "Tirol", finished: false },
  { id: "m15", name: "Billa Wien 3", region: "Wien", finished: true },
  { id: "m16", name: "Spar St. Pölten", region: "Niederösterreich", finished: true },
];

// ── Region progress bar ───────────────────────────────────────

function RegionBar({ name, pct }: { name: string; pct: number }) {
  const color = pct >= 80 ? "#16a34a" : pct >= 40 ? "#d97706" : "#DC2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", fontWeight: 500, width: 130, flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, backgroundColor: color, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, width: 34, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

// ── Campaign list item ────────────────────────────────────────

function CampaignListItem({
  campaign,
  selected,
  onClick,
}: {
  campaign: typeof CAMPAIGNS[0];
  selected: boolean;
  onClick: () => void;
}) {
  const pct = campaign.total > 0 ? Math.round((campaign.filled / campaign.total) * 100) : 0;
  const dotColor = campaign.color;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        cursor: "pointer",
        backgroundColor: selected ? "rgba(220,38,38,0.05)" : "transparent",
        borderLeft: selected ? "2px solid #DC2626" : "2px solid transparent",
        transition: "all 0.15s ease",
        marginBottom: 2,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0, opacity: campaign.inactive ? 0.3 : 1 }} />
          <span style={{ fontSize: 12, fontWeight: selected ? 700 : 500, color: selected ? "#1a1a1a" : "#374151", letterSpacing: "-0.01em" }}>{campaign.name}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "rgba(0,0,0,0.25)" }}>{pct}%</span>
      </div>
      <div style={{ paddingLeft: 14 }}>
        <div style={{ height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, backgroundColor: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "transparent" }} />
        </div>
        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 3, display: "block" }}>{campaign.filled.toLocaleString("de-AT")} / {campaign.total.toLocaleString("de-AT")}</span>
      </div>
    </div>
  );
}

// ── Market row ────────────────────────────────────────────────

function MarketRow({ market }: { market: typeof MOCK_MARKETS[0] }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "9px 14px",
      borderBottom: "1px solid rgba(0,0,0,0.04)",
      gap: 10,
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        backgroundColor: market.finished ? "#16a34a" : "rgba(0,0,0,0.18)",
      }} />
      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{market.name}</span>
      <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>{market.region}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
        backgroundColor: market.finished ? "rgba(22,163,74,0.08)" : "rgba(0,0,0,0.04)",
        color: market.finished ? "#16a34a" : "rgba(0,0,0,0.35)",
      }}>
        {market.finished ? "Abgeschlossen" : "Ausstehend"}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function FbManagementPage() {
  const [selectedId, setSelectedId] = useState("1");
  const [marketFilter, setMarketFilter] = useState<"all" | "finished" | "pending">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [extraCampaigns, setExtraCampaigns] = useState<typeof CAMPAIGNS>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("fbm_new_campaigns") || "[]");
      if (stored.length > 0) {
        setExtraCampaigns(stored);
        setSelectedId(stored[0].id);
      }
    } catch {}
  }, []);

  const allCampaigns = [...extraCampaigns, ...CAMPAIGNS];
  const visibleCampaigns = allCampaigns.filter((c) => showInactive ? c.inactive : !c.inactive);
  const campaign = allCampaigns.find((c) => c.id === selectedId) ?? allCampaigns[0];
  const pct = campaign.total > 0 ? Math.round((campaign.filled / campaign.total) * 100) : 0;

  const filteredMarkets = MOCK_MARKETS.filter((m) => {
    if (marketFilter === "finished") return m.finished;
    if (marketFilter === "pending") return !m.finished;
    return true;
  });

  const finishedCount = MOCK_MARKETS.filter((m) => m.finished).length;
  const pendingCount = MOCK_MARKETS.length - finishedCount;

  return (
    <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Main card ─────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        overflow: "hidden",
        display: "flex",
        minHeight: 480,
      }}>

        {/* Left: campaign list */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid rgba(0,0,0,0.06)",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px", marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Kampagnen</span>
            <button
              onClick={() => { setShowInactive(!showInactive); setSelectedId(showInactive ? "1" : "4"); }}
              style={{
                fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer",
                backgroundColor: showInactive ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)",
                color: showInactive ? "#DC2626" : "#16a34a",
                transition: "all 0.15s ease",
              }}
            >
              {showInactive ? "Inaktiv" : "Aktiv"}
            </button>
          </div>
          {visibleCampaigns.map((c) => (
            <CampaignListItem
              key={c.id}
              campaign={c}
              selected={c.id === selectedId}
              onClick={() => setSelectedId(c.id)}
            />
          ))}
        </div>

        {/* Right: campaign detail */}
        <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>

          {/* Campaign title + status */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2 }}>{campaign.name}</h2>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 36, height: 20, borderRadius: 99, cursor: "pointer",
                  backgroundColor: !campaign.inactive ? campaign.color : "rgba(0,0,0,0.12)",
                  position: "relative", transition: "background-color 0.2s ease",
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: !campaign.inactive ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s ease",
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(0,0,0,0.35)", letterSpacing: "0" }}>Kampagne aktiv</span>
              </div>
            </div>

            <span style={{
              fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, flexShrink: 0, letterSpacing: "0.01em",
              backgroundColor: !campaign.inactive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
              color: !campaign.inactive ? "#16a34a" : "#DC2626",
            }}>
              {!campaign.inactive ? "Aktiv" : "Inaktiv"}
            </span>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {campaign.filled.toLocaleString("de-AT")}
              </span>
              <span style={{ fontSize: 13, color: "rgba(0,0,0,0.35)", fontWeight: 400, letterSpacing: "-0.01em" }}>
                / {campaign.total.toLocaleString("de-AT")} Märkte
              </span>
              <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 700, color: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "rgba(0,0,0,0.2)", letterSpacing: "-0.02em" }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", borderRadius: 99,
                background: pct >= 80 ? "linear-gradient(to right, #16a34a, #15803d)" : pct > 0 ? "linear-gradient(to right, #DC2626, #b91c1c)" : "transparent",
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
          </div>

          {/* Stat pills + Fragebogen card */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>

            {/* Fragebogen assigned card — left, wider */}
            <div style={{
              width: 200, flexShrink: 0, padding: "13px 16px", borderRadius: 10,
              background: "linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.03) 100%)",
              border: "1px solid rgba(220,38,38,0.15)",
              display: "flex", flexDirection: "column", justifyContent: "center",
              gap: 5,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{campaign.name}</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a", flexShrink: 0, boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(220,38,38,0.5)", letterSpacing: "0.02em" }}>3 Module</span>
                <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.25)" }} />
                <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(220,38,38,0.5)", letterSpacing: "0.02em" }}>67 Fragen</span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, backgroundColor: "rgba(0,0,0,0.06)", margin: "0 14px", flexShrink: 0 }} />

            {/* Stat pills — fill remaining space */}
            <div style={{ flex: 1, display: "flex", gap: 8 }}>
              {[
                { label: "HEUTE NEU", value: campaign.todayNew.toString(), red: true },
                { label: "DIESE WOCHE", value: campaign.thisWeek.toString(), red: false },
                { label: "ABSCHLUSSRATE", value: `${pct}%`, red: false },
              ].map((s) => (
                <div key={s.label} style={{
                  flex: 1, padding: "13px 12px", borderRadius: 10,
                  backgroundColor: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.045)",
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", marginBottom: 7, textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.red ? "#DC2626" : "#1a1a1a", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase", display: "block", marginBottom: 18 }}>Regionen</span>
            {campaign.regions.map((r) => (
              <RegionBar key={r.name} name={r.name} pct={r.pct} />
            ))}
          </div>
        </div>

        {/* Far right: Fragebogen preview placeholder */}
        <div style={{
          width: 360,
          flexShrink: 0,
          borderLeft: "1px solid rgba(0,0,0,0.06)",
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Fragebogen Vorschau</span>
          <div style={{
            flex: 1,
            borderRadius: 10,
            backgroundColor: "rgba(0,0,0,0.018)",
            border: "1.5px dashed rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 288,
          }}>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.18)", fontWeight: 400, textAlign: "center", padding: "0 24px", lineHeight: 1.7 }}>Vorschau wird hier angezeigt</span>
          </div>
        </div>
      </div>

      {/* ── Markets card ──────────────────────────────────── */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Zugewiesene Märkte</span>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginLeft: 8 }}>{MOCK_MARKETS.length} Märkte gesamt</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "finished", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMarketFilter(f)}
                style={{
                  padding: "5px 12px", fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "none",
                  backgroundColor: marketFilter === f ? "#1a1a1a" : "rgba(0,0,0,0.04)",
                  color: marketFilter === f ? "#fff" : "rgba(0,0,0,0.45)",
                  transition: "all 0.15s ease",
                }}
              >
                {f === "all" ? `Alle (${MOCK_MARKETS.length})` : f === "finished" ? `Abgeschlossen (${finishedCount})` : `Ausstehend (${pendingCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Market list */}
        <div>
          {filteredMarkets.map((m) => (
            <MarketRow key={m.id} market={m} />
          ))}
        </div>
      </div>

    </div>
  );
}
