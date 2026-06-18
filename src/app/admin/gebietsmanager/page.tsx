"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Copy, Check, UserCheck, Mail, Phone, Home, Eye, EyeOff, Save, ChevronDown } from "lucide-react";
import type { GMRecord } from "@/types/gebietsmanager";
import type { MarketVisitLog } from "@/types/markets";
import { createGmUser, fetchGmUsers, readAuthSession, updateGmUser } from "@/lib/api/backend";
import { exportGebietsmanagerExcel } from "@/lib/exports/masterDataExports";

// ── Constants ─────────────────────────────────────────────────
const R  = "#DC2626";
const RD = "#b91c1c";
const LS_VISITS_PREFIX = "admin_market_visits_v2:";
const LS_VISITS_LEGACY = "admin_market_visits_v1";
const REGIONS = ["Nord", "Ost", "Süd", "West", "Mitte"];

function getVisitsStorageKey(): string {
  const userId = readAuthSession()?.user.id ?? "anonymous";
  return `${LS_VISITS_PREFIX}${userId}`;
}

// ── Temp GM visits (supplement Märkte seed data) ──────────────
const SEED_GM_VISITS: MarketVisitLog[] = [
  // Thomas Huber
  { id: "gmv-th-1", marketId: "mk1", marketName: "Billa Favoriten", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Thomas Huber", visitedAt: "2026-04-02T09:15:00Z", durationMin: 28, redMonatLabel: "RED 28" },
  { id: "gmv-th-2", marketId: "mk1", marketName: "Billa Favoriten", sectionType: "flex", fragebogenName: "Flex Frühjahr 2026", gmName: "Thomas Huber", visitedAt: "2026-04-02T09:15:00Z", durationMin: 18, redMonatLabel: "RED 28" },
  { id: "gmv-th-3", marketId: "mk4", marketName: "Spar Meidling", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Thomas Huber", visitedAt: "2026-03-18T10:30:00Z", durationMin: 32, redMonatLabel: "RED 27" },
  { id: "gmv-th-4", marketId: "mk7", marketName: "Penny Mariahilf", sectionType: "mhd", fragebogenName: "MHD Check März", gmName: "Thomas Huber", visitedAt: "2026-03-05T08:45:00Z", durationMin: 22, redMonatLabel: "RED 27" },
  // Anna Gruber
  { id: "gmv-ag-1", marketId: "mk2", marketName: "Spar Graz Hauptplatz", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Anna Gruber", visitedAt: "2026-04-03T11:00:00Z", durationMin: 30, redMonatLabel: "RED 28" },
  { id: "gmv-ag-2", marketId: "mk5", marketName: "Hofer Graz West", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q1", gmName: "Anna Gruber", visitedAt: "2026-04-03T11:00:00Z", durationMin: 25, redMonatLabel: "RED 28" },
  { id: "gmv-ag-3", marketId: "mk2", marketName: "Spar Graz Hauptplatz", sectionType: "flex", fragebogenName: "Flex Frühjahr 2026", gmName: "Anna Gruber", visitedAt: "2026-03-20T09:00:00Z", durationMin: 20, redMonatLabel: "RED 27" },
  { id: "gmv-ag-4", marketId: "mk8", marketName: "Billa Graz Münzgrabenstr.", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Anna Gruber", visitedAt: "2026-02-14T14:00:00Z", durationMin: 35, redMonatLabel: "RED 26" },
  // Markus Steiner
  { id: "gmv-ms-1", marketId: "mk3", marketName: "Merkur Linz Center", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Markus Steiner", visitedAt: "2026-04-04T08:00:00Z", durationMin: 40, redMonatLabel: "RED 28" },
  { id: "gmv-ms-2", marketId: "mk3", marketName: "Merkur Linz Center", sectionType: "billa", fragebogenName: "Billa Check Q1", gmName: "Markus Steiner", visitedAt: "2026-04-04T08:00:00Z", durationMin: 15, redMonatLabel: "RED 28" },
  { id: "gmv-ms-3", marketId: "mk9", marketName: "Spar Linz Landstr.", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Markus Steiner", visitedAt: "2026-03-22T10:15:00Z", durationMin: 28, redMonatLabel: "RED 27" },
  { id: "gmv-ms-4", marketId: "mk11", marketName: "Penny Linz Nord", sectionType: "mhd", fragebogenName: "MHD Check März", gmName: "Markus Steiner", visitedAt: "2026-03-10T09:30:00Z", durationMin: 19, redMonatLabel: "RED 27" },
  { id: "gmv-ms-5", marketId: "mk3", marketName: "Merkur Linz Center", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q1", gmName: "Markus Steiner", visitedAt: "2026-02-20T11:00:00Z", durationMin: 24, redMonatLabel: "RED 26" },
  // Lisa Wagner
  { id: "gmv-lw-1", marketId: "mk6", marketName: "Spar Salzburg Getreideg.", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Lisa Wagner", visitedAt: "2026-04-05T09:45:00Z", durationMin: 33, redMonatLabel: "RED 28" },
  { id: "gmv-lw-2", marketId: "mk6", marketName: "Spar Salzburg Getreideg.", sectionType: "flex", fragebogenName: "Flex Frühjahr 2026", gmName: "Lisa Wagner", visitedAt: "2026-04-05T09:45:00Z", durationMin: 17, redMonatLabel: "RED 28" },
  { id: "gmv-lw-3", marketId: "mk14", marketName: "Billa Salzburg Rainerstr.", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Lisa Wagner", visitedAt: "2026-03-24T08:30:00Z", durationMin: 29, redMonatLabel: "RED 27" },
  { id: "gmv-lw-4", marketId: "mk6", marketName: "Spar Salzburg Getreideg.", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q1", gmName: "Lisa Wagner", visitedAt: "2026-02-10T13:00:00Z", durationMin: 21, redMonatLabel: "RED 26" },
  // Michael Berger
  { id: "gmv-mb-1", marketId: "mk10", marketName: "Hofer Klagenfurt West", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Michael Berger", visitedAt: "2026-04-06T10:00:00Z", durationMin: 27, redMonatLabel: "RED 28" },
  { id: "gmv-mb-2", marketId: "mk16", marketName: "Spar Klagenfurt Villacher", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1", gmName: "Michael Berger", visitedAt: "2026-03-19T09:15:00Z", durationMin: 31, redMonatLabel: "RED 27" },
  { id: "gmv-mb-3", marketId: "mk16", marketName: "Spar Klagenfurt Villacher", sectionType: "mhd", fragebogenName: "MHD Check März", gmName: "Michael Berger", visitedAt: "2026-03-19T09:15:00Z", durationMin: 16, redMonatLabel: "RED 27" },
  { id: "gmv-mb-4", marketId: "mk10", marketName: "Hofer Klagenfurt West", sectionType: "flex", fragebogenName: "Flex Frühjahr 2026", gmName: "Michael Berger", visitedAt: "2026-02-25T14:30:00Z", durationMin: 22, redMonatLabel: "RED 26" },
];

// ── Visit helpers (shared with Märkte page) ───────────────────
function fmtDate(iso: string) { const d = new Date(iso); return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function fmtTime(iso: string) { const d = new Date(iso); return d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }); }

const SECTION_META: Record<string, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard", color: "#DC2626", bg: "rgba(220,38,38,0.07)" },
  flex:     { label: "Flex",     color: "#65a30d", bg: "rgba(132,204,22,0.07)" },
  kuehler:  { label: "Kühler",   color: "#D97706", bg: "rgba(245,158,11,0.07)" },
  mhd:      { label: "MHD",      color: "#7C3AED", bg: "rgba(124,58,237,0.07)" },
  billa:    { label: "Billa",    color: "#0891B2", bg: "rgba(8,145,178,0.07)"  },
};

const SEED_GMS: GMRecord[] = [
  { id: "gm-seed-1", firstName: "Thomas", lastName: "Huber", email: "t.huber@salescrew.at", phone: "+43 664 123 45 67", address: "Mariahilfer Str. 58", city: "Wien", postalCode: "1060", region: "Ost", ipp: 6.4, createdAt: "2025-10-01T08:00:00Z", password: "Kx7!mR2wPqN9" },
  { id: "gm-seed-2", firstName: "Anna", lastName: "Gruber", email: "a.gruber@salescrew.at", phone: "+43 664 234 56 78", address: "Hauptplatz 12", city: "Graz", postalCode: "8010", region: "Süd", ipp: 5.8, createdAt: "2025-10-15T09:30:00Z", password: "Lp4@nZ8vQc3J" },
  { id: "gm-seed-3", firstName: "Markus", lastName: "Steiner", email: "m.steiner@salescrew.at", phone: "+43 664 345 67 89", address: "Bahnhofstr. 7", city: "Linz", postalCode: "4020", region: "West", ipp: 7.1, createdAt: "2025-11-01T10:00:00Z", password: "Wq2#bN5xHm7R" },
  { id: "gm-seed-4", firstName: "Lisa", lastName: "Wagner", email: "l.wagner@salescrew.at", phone: "+43 664 456 78 90", address: "Rathausplatz 3", city: "Salzburg", postalCode: "5020", region: "Nord", ipp: 6.9, createdAt: "2025-11-20T11:00:00Z", password: "Yh9!cV3kTz6M" },
  { id: "gm-seed-5", firstName: "Michael", lastName: "Berger", email: "m.berger@salescrew.at", phone: "+43 664 567 89 01", address: "Wiener Str. 22", city: "Klagenfurt", postalCode: "9020", region: "Süd", ipp: 5.3, createdAt: "2025-12-05T08:30:00Z", password: "Dg6@pW1nXk4F" },
];

// ── Helpers ───────────────────────────────────────────────────
function genId() { return `gm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function initials(gm: GMRecord) { return `${gm.firstName[0] ?? ""}${gm.lastName[0] ?? ""}`.toUpperCase(); }
function avatarColor(gm: GMRecord) {
  const palettes = [
    { bg: "rgba(220,38,38,0.10)",  text: R },
    { bg: "rgba(37,99,235,0.10)",  text: "#2563eb" },
    { bg: "rgba(22,163,74,0.10)",  text: "#16a34a" },
    { bg: "rgba(217,119,6,0.10)",  text: "#D97706" },
    { bg: "rgba(124,58,237,0.10)", text: "#7c3aed" },
  ];
  const hash = (gm.firstName + gm.lastName).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// ── Shared input style ─────────────────────────────────────────
function inp(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", height: 34, fontSize: 11, fontWeight: 500, padding: "0 10px",
    borderRadius: 7, border: "1px solid rgba(0,0,0,0.12)", outline: "none",
    color: "#1a1a1a", background: "#fff", fontFamily: "inherit",
    transition: "border 0.15s, box-shadow 0.15s", boxSizing: "border-box" as const,
    ...extra,
  };
}

// ── Region badge ──────────────────────────────────────────────
function RegionBadge({ region }: { region: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
      {region}
    </span>
  );
}

// ── GM Card ───────────────────────────────────────────────────
function GMCard({
  gm,
  isNew,
  onClick,
  onContextMenu,
  active,
}: {
  gm: GMRecord;
  isNew?: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  active?: boolean;
}) {
  const av = avatarColor(gm);
  const hasIppData = (gm.ippSampleCount ?? 0) > 0;
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        background: active ? "rgba(220,38,38,0.03)" : "rgba(0,0,0,0.025)",
        border: active ? `1px solid rgba(220,38,38,0.25)` : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        animation: isNew ? "gmCardIn 0.3s cubic-bezier(0.4,0,0.2,1) both" : "none",
        transition: "border 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.025)"; }}
    >
      <style>{`@keyframes gmCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(220,38,38,0.12)" : av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: active ? R : av.text, letterSpacing: "-0.02em" }}>{initials(gm)}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: active ? R : "#1a1a1a", letterSpacing: "-0.02em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}>
              {gm.firstName} {gm.lastName}
            </div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>Gebietsmanager</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {gm.isBillaGm && (
            <span
              title="Billa-Flexfilter aktiv"
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "#2563eb",
                boxShadow: "0 0 0 3px rgba(37,99,235,0.10)",
                flexShrink: 0,
              }}
            />
          )}
          <RegionBadge region={gm.region} />
        </div>
      </div>
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", textAlign: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 4 }}>IPP</div>
          {hasIppData ? (
            <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{gm.ipp.toFixed(1)}</div>
          ) : (
            <div style={{ fontSize: 21, fontWeight: 800, color: "rgba(0,0,0,0.22)", letterSpacing: "0.08em", lineHeight: 1.1 }}>IPP</div>
          )}
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Mail size={10} strokeWidth={1.8} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{gm.email}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Phone size={10} strokeWidth={1.8} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#374151" }}>{gm.phone}</span>
          </div>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
          <Home size={10} strokeWidth={1.8} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gm.address}, ${gm.postalCode} ${gm.city}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0, flex: 1, textDecoration: "none", transition: "color 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = R; (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#374151"; (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
          >
            {gm.address}, {gm.postalCode} {gm.city}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Visit card (mirrors Märkte VisitCard) ─────────────────────
function GmVisitCard({ logs }: { logs: MarketVisitLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...logs].sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime());
  const primary = sorted[0];
  const isFlexVisit = sorted.some(l => l.sectionType === "flex");
  const visitType  = isFlexVisit ? "Flexbesuch" : "Standardbesuch";
  const vtColor    = isFlexVisit
    ? { color: "#65a30d", bg: "rgba(132,204,22,0.09)", border: "rgba(132,204,22,0.22)" }
    : { color: R,        bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.18)" };
  const totalDuration = sorted.reduce((n, l) => n + l.durationMin, 0);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", boxShadow: expanded ? "0 4px 18px rgba(0,0,0,0.07)" : "0 1px 5px rgba(0,0,0,0.04)", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.22s ease" }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 5px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: vtColor.bg, color: vtColor.color, border: `1px solid ${vtColor.border}`, letterSpacing: "0.02em", flexShrink: 0, whiteSpace: "nowrap" as const }}>
          {visitType}
        </span>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {sorted.map((l, i) => {
            const sm = SECTION_META[l.sectionType] ?? SECTION_META.standard;
            return <span key={l.id} title={sm.label} style={{ width: 9, height: 9, borderRadius: "50%", background: sm.color, border: "1.5px solid #fff", display: "inline-block", marginLeft: i === 0 ? 0 : -4, flexShrink: 0 }} />;
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
            {primary.marketName ?? "Markt"}
          </div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" as const }}>
            {fmtDate(primary.visitedAt)} · {fmtTime(primary.visitedAt)} · {totalDuration} Min
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
            {primary.redMonatLabel && <span style={{ fontSize: 8, color: "rgba(0,0,0,0.26)", fontWeight: 500 }}>{primary.redMonatLabel}</span>}
            <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
          </div>
        </div>
      </div>
      <div style={{ maxHeight: expanded ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.2s ease 0.06s, transform 0.2s ease 0.06s", borderTop: "1px solid rgba(0,0,0,0.05)", padding: "9px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {sorted.map(l => {
            const sm = SECTION_META[l.sectionType] ?? SECTION_META.standard;
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 8, background: "rgba(0,0,0,0.025)" }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: sm.bg, color: sm.color, border: `1px solid ${sm.color}28`, letterSpacing: "0.03em", flexShrink: 0, whiteSpace: "nowrap" as const }}>{sm.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", flex: 1, minWidth: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{l.fragebogenName}</span>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{fmtTime(l.visitedAt)} · {l.durationMin} Min</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────
function DrawerField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp() }}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.28)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.06)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function DrawerSelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function update() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const portal = document.getElementById("gm-drawer-select-portal");
      if (btnRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>{label}</label>
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp(), display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#fff", textAlign: "left" as const, borderColor: open ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)", boxShadow: open ? "0 0 0 2px rgba(0,0,0,0.06)" : "none" }}>
        <span style={{ fontSize: 11, color: "#1a1a1a" }}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(0,0,0,0.4)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div id="gm-drawer-select-portal" style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4 }}>
          {options.map(o => (
            <button key={o} type="button" onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === o ? "rgba(220,38,38,0.06)" : "transparent", color: value === o ? R : "#374151", fontWeight: value === o ? 600 : 400, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}>
              {o}
              {value === o && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke={R} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function GMDetailDrawer({ gm, onClose, onSave, visits }: { gm: GMRecord; onClose: () => void; onSave: (updated: GMRecord) => Promise<void> | void; visits: MarketVisitLog[] }) {
  const [tab, setTab] = useState<"profil" | "besuche">("profil");
  const [draft, setDraft] = useState<GMRecord>({ ...gm });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password reveal state
  const [pwVisible, setPwVisible] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft when gm changes
  useEffect(() => { setDraft({ ...gm }); setDirty(false); setTab("profil"); }, [gm.id]);

  const set = (k: keyof GMRecord) => (v: string) => {
    setDraft(d => ({ ...d, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await onSave(draft);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const revealPassword = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setPwVisible(true);
    revealTimerRef.current = setTimeout(() => { setPwVisible(false); }, 5000);
  };

  const hidePassword = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setPwVisible(false);
  };

  const copyPassword = () => {
    if (!gm.password) return;
    navigator.clipboard.writeText(gm.password).then(() => {
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 2000);
    });
  };

  const av = avatarColor(draft);
  const hasIppData = (draft.ippSampleCount ?? 0) > 0;

  // Group visits by session (same day + same GM)
  const gmVisits = visits
    .filter(v => v.gmName === `${gm.firstName} ${gm.lastName}`)
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());

  const sessionMap = new Map<string, MarketVisitLog[]>();
  gmVisits.forEach(v => {
    const key = `${new Date(v.visitedAt).toDateString()}__${v.marketId}__${v.gmName}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(v);
  });
  const sessions = Array.from(sessionMap.values());

  return createPortal(
    <>
      <style>{`
        @keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes drawerBdIn{from{opacity:0}to{opacity:1}}
      `}</style>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 799, background: "rgba(0,0,0,0.12)", animation: "drawerBdIn 0.2s ease both" }} />

      {/* Drawer */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, zIndex: 800, display: "flex", flexDirection: "column", background: "#f5f5f7", boxShadow: "-6px 0 32px rgba(0,0,0,0.12), -1px 0 0 rgba(0,0,0,0.06)", animation: "drawerIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "16px 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{initials(draft)}</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", lineHeight: 1.2 }}>{draft.firstName} {draft.lastName}</div>
                <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 2 }}>Gebietsmanager · {draft.region}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.4)", transition: "all 0.12s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>

          {/* IPP + created */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)" }}>IPP</div>
              {hasIppData ? (
                <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{draft.ipp.toFixed(1)}</div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(0,0,0,0.22)", letterSpacing: "0.08em", lineHeight: 1.1 }}>IPP</div>
              )}
            </div>
            <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.07)" }} />
            <div>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)" }}>Erstellt</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.5)" }}>
                {new Date(draft.createdAt).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 18px", display: "flex", gap: 0, flexShrink: 0 }}>
          {(["profil", "besuche"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", fontSize: 11, fontWeight: tab === t ? 700 : 500, color: tab === t ? R : "rgba(0,0,0,0.45)", border: "none", background: "none", cursor: "pointer", borderBottom: tab === t ? `2px solid ${R}` : "2px solid transparent", transition: "all 0.12s", fontFamily: "inherit", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 5 }}>
              {t === "profil" ? "Profil" : "Marktbesuche"}
              {t === "besuche" && sessions.length > 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: tab === "besuche" ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.07)", color: tab === "besuche" ? R : "rgba(0,0,0,0.38)" }}>{sessions.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Section: Kontakt */}
          {tab === "profil" && (<>
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <DrawerField label="Vorname" value={draft.firstName} onChange={set("firstName")} />
                <DrawerField label="Nachname" value={draft.lastName} onChange={set("lastName")} />
              </div>
              <DrawerField label="E-Mail" value={draft.email} onChange={set("email")} />
              <DrawerField label="Telefon" value={draft.phone} onChange={set("phone")} />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

          {/* Section: Adresse & Region */}
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>Adresse & Region</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DrawerField label="Adresse" value={draft.address} onChange={set("address")} />
              <div style={{ display: "flex", gap: 8 }}>
                <DrawerField label="Ort" value={draft.city} onChange={set("city")} />
                <div style={{ flex: "0 0 90px" }}>
                  <DrawerField label="PLZ" value={draft.postalCode} onChange={set("postalCode")} />
                </div>
              </div>
              <DrawerSelectField label="Region" value={draft.region} onChange={set("region")} options={REGIONS} />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

          {/* Section: Passwort */}
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>Passwort</div>
            {gm.password ? (
              <div style={{ background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Einmalpasswort</div>
                  {pwVisible ? (
                    <div
                      onClick={copyPassword}
                      title="Klicken zum Kopieren"
                      style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", fontFamily: "monospace", cursor: "pointer", userSelect: "all" as const, transition: "opacity 0.15s" }}
                    >
                      {gm.password}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.1em", fontFamily: "monospace" }}>
                      {"•".repeat(Math.min(gm.password.length, 12))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {pwVisible && (
                    <button onClick={copyPassword}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: pwCopied ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.05)", color: pwCopied ? "#16a34a" : "rgba(0,0,0,0.5)" }}>
                      {pwCopied ? <Check size={10} strokeWidth={2.5} /> : <Copy size={10} strokeWidth={2} />}
                      {pwCopied ? "Kopiert" : "Kopieren"}
                    </button>
                  )}
                  <button
                    onClick={pwVisible ? hidePassword : revealPassword}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: pwVisible ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.05)", color: pwVisible ? R : "rgba(0,0,0,0.45)" }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {pwVisible ? <EyeOff size={10} strokeWidth={2} /> : <Eye size={10} strokeWidth={2} />}
                    {pwVisible ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)" }}>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>Kein Passwort gespeichert.</span>
              </div>
            )}
          </div>
          </>)}

          {/* Marktbesuche tab */}
          {tab === "besuche" && (
            sessions.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" as const }}>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", lineHeight: 1.6 }}>Noch keine Marktbesuche für diesen GM.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessions.map((logs, i) => <GmVisitCard key={i} logs={logs} />)}
              </div>
            )
          )}
        </div>

        {/* Save footer */}
        {tab === "profil" && (
        <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 18px", flexShrink: 0 }}>
          <button
            onClick={() => { void handleSave(); }}
            disabled={!dirty || saving}
            style={{ width: "100%", height: 36, borderRadius: 8, border: "none", cursor: dirty && !saving ? "pointer" : "default", fontSize: 11, fontWeight: 700, color: dirty && !saving ? "#fff" : "rgba(0,0,0,0.25)", fontFamily: "inherit", background: dirty && !saving ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.05)", boxShadow: dirty && !saving ? `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {saving ? <><Save size={11} strokeWidth={2} /> Speichern...</> : saved ? <><Check size={11} strokeWidth={2.5} /> Gespeichert</> : <><Save size={11} strokeWidth={2} /> Änderungen speichern</>}
          </button>
        </div>
        )}
      </div>
    </>,
    document.body,
  );
}

// ── Create Modal form helpers ─────────────────────────────────
type FormState = {
  firstName: string; lastName: string;
  email: string; phone: string;
  address: string; city: string; postalCode: string; region: string;
};
const EMPTY_FORM: FormState = { firstName: "", lastName: "", email: "", phone: "", address: "", city: "", postalCode: "", region: "" };
function isValidEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isFormValid(f: FormState) {
  return f.firstName.trim() && f.lastName.trim() && f.email.trim() && isValidEmail(f.email) &&
    f.phone.trim() && f.address.trim() && f.city.trim() && f.postalCode.trim() && f.region;
}

function InputField({ label, value, onChange, placeholder, type = "text", error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: error ? R : "rgba(0,0,0,0.35)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inp(), borderColor: error ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.12)" }}
        onFocus={e => { e.currentTarget.style.borderColor = error ? R : "rgba(0,0,0,0.28)"; e.currentTarget.style.boxShadow = error ? "0 0 0 2px rgba(220,38,38,0.08)" : "0 0 0 2px rgba(0,0,0,0.06)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  React.useEffect(() => {
    if (!open) return;
    function update() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const portal = document.getElementById("gm-select-portal");
      if (btnRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: value ? "rgba(0,0,0,0.35)" : R }}>{label}</label>
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp(), display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#fff", textAlign: "left" as const, borderColor: open ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)", boxShadow: open ? "0 0 0 2px rgba(0,0,0,0.06)" : "none" }}>
        <span style={{ fontSize: 11, color: value ? "#1a1a1a" : "rgba(0,0,0,0.38)" }}>{value || "Region wählen…"}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(0,0,0,0.4)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div id="gm-select-portal" style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4 }}>
          {options.map(o => (
            <button key={o} type="button" onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === o ? "rgba(220,38,38,0.06)" : "transparent", color: value === o ? R : "#374151", fontWeight: value === o ? 600 : 400, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}>
              {o}
              {value === o && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke={R} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function GmCardsSkeleton() {
  return (
    <div style={{ padding: 14 }}>
      <style>{`
        @keyframes gmSkeletonPulse {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.07)",
              background: "rgba(0,0,0,0.018)",
              padding: 10,
              animation: "gmSkeletonPulse 1.25s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(0,0,0,0.08)" }} />
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ width: 84, height: 9, borderRadius: 5, background: "rgba(0,0,0,0.1)" }} />
                  <div style={{ width: 64, height: 7, borderRadius: 4, background: "rgba(0,0,0,0.08)" }} />
                </div>
              </div>
              <div style={{ width: 52, height: 16, borderRadius: 999, background: "rgba(0,0,0,0.09)" }} />
            </div>
            <div style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: 10, display: "grid", gap: 8 }}>
              <div style={{ width: "100%", height: 48, borderRadius: 8, background: "rgba(0,0,0,0.06)" }} />
              <div style={{ width: "100%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
              <div style={{ width: "86%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
              <div style={{ width: "72%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────
function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (form: FormState) => Promise<{ gm: GMRecord; password: string }>;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [step, setStep] = useState<"form" | "success">("form");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isFormValid(form);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const touch = (k: keyof FormState) => setTouched(t => ({ ...t, [k]: true }));
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onCreate(form);
      setPassword(result.password);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erstellung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleCopy = () => { navigator.clipboard.writeText(password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const emailError = touched.email && form.email && !isValidEmail(form.email);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", animation: "bdIn 0.18s ease both" }} />
      <style>{`@keyframes bdIn{from{opacity:0}to{opacity:1}} @keyframes modalIn{from{opacity:0;transform:scale(0.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes successIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ position: "relative", zIndex: 1, width: 480, background: "#fff", borderRadius: 16, boxShadow: "0 8px 48px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.1)", border: "1px solid rgba(0,0,0,0.07)", animation: "modalIn 0.22s cubic-bezier(0.4,0,0.2,1) both", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={14} strokeWidth={2} color={R} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{step === "form" ? "Gebietsmanager erstellen" : "GM erfolgreich erstellt"}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 1 }}>{step === "form" ? "Alle Felder ausfüllen" : `${form.firstName} ${form.lastName}`}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.45)", transition: "all 0.12s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
        {step === "form" ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <InputField label="Vorname *" value={form.firstName} onChange={set("firstName")} placeholder="Max" />
              <InputField label="Nachname *" value={form.lastName} onChange={set("lastName")} placeholder="Mustermann" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <InputField label="E-Mail *" value={form.email} onChange={set("email")} placeholder="m.mustermann@salescrew.at" type="email" error={!!emailError} />
              <InputField label="Telefon *" value={form.phone} onChange={set("phone")} placeholder="+43 664 …" />
            </div>
            <InputField label="Adresse *" value={form.address} onChange={set("address")} placeholder="Mariahilfer Str. 58" />
            <div style={{ display: "flex", gap: 10 }}>
              <InputField label="Ort *" value={form.city} onChange={set("city")} placeholder="Wien" />
              <div style={{ flex: "0 0 90px" }}><InputField label="PLZ *" value={form.postalCode} onChange={set("postalCode")} placeholder="1060" /></div>
              <SelectField label="Region *" value={form.region} onChange={set("region")} options={REGIONS} />
            </div>
            {error ? (
              <div style={{ fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>{error}</div>
            ) : null}
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, height: 36, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", fontFamily: "inherit", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.12s" }}>Abbrechen</button>
              <button onClick={handleSubmit} disabled={!valid || submitting} style={{ flex: 2, height: 36, borderRadius: 8, border: "none", cursor: valid && !submitting ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "inherit", background: valid && !submitting ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.12)", boxShadow: valid && !submitting ? `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` : "none", transition: "all 0.15s" }}>{submitting ? "Erstellt..." : "Erstellen"}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 18, alignItems: "center", animation: "successIn 0.25s ease both" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(22,163,74,0.09)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={22} strokeWidth={2.5} color="#16a34a" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 5 }}>{form.firstName} {form.lastName} wurde angelegt.</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Das Passwort wird nur einmal angezeigt. Bitte jetzt kopieren.</div>
            </div>
            <div style={{ width: "100%", background: "rgba(0,0,0,0.025)", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>Einmalpasswort</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", letterSpacing: "0.04em", fontFamily: "monospace", userSelect: "all" as const }}>{password}</div>
              </div>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: copied ? "rgba(22,163,74,0.1)" : `linear-gradient(to bottom,${R},${RD})`, color: copied ? "#16a34a" : "#fff", boxShadow: copied ? "none" : `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, flexShrink: 0 }}>
                {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            </div>
            <button onClick={onClose} style={{ width: "100%", height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "inherit", background: `linear-gradient(to bottom,${R},${RD})`, boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, transition: "all 0.15s" }}>Fertig</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function GebietsmanagerPage() {
  const [gms, setGms] = useState<GMRecord[]>([]);
  const [visits, setVisits] = useState<MarketVisitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingGms, setIsExportingGms] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ gmId: string; x: number; y: number } | null>(null);
  const [billaToggleBusyId, setBillaToggleBusyId] = useState<string | null>(null);
  const selectedGm = gms.find(g => g.id === selectedId) ?? null;
  const contextMenuGm = contextMenu ? gms.find((gm) => gm.id === contextMenu.gmId) ?? null : null;

  useEffect(() => {
    setLoading(true);
    fetchGmUsers()
      .then((rows) => {
        setGms(rows);
        setBackendError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "GM-Liste konnte nicht geladen werden.";
        setBackendError(msg);
        setGms([]);
      })
      .finally(() => {
        setLoading(false);
      });

    // Load visits from Märkte page storage, supplement with seed GM visits
    try {
      const scopedKey = getVisitsStorageKey();
      const scoped = localStorage.getItem(scopedKey);
      const legacy = scoped ? null : localStorage.getItem(LS_VISITS_LEGACY);
      if (!scoped && legacy) {
        localStorage.setItem(scopedKey, legacy);
        localStorage.removeItem(LS_VISITS_LEGACY);
      }
      const storedV = scoped ?? legacy;
      const loaded: MarketVisitLog[] = storedV ? JSON.parse(storedV) : [];
      // Merge in seed GM visits that aren't already present (by id)
      const existingIds = new Set(loaded.map(v => v.id));
      const merged = [...loaded, ...SEED_GM_VISITS.filter(v => !existingIds.has(v.id))];
      setVisits(merged);
    } catch { setVisits(SEED_GM_VISITS); }
  }, []);

  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener("gebietsmanager:openCreate", handler);
    return () => window.removeEventListener("gebietsmanager:openCreate", handler);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleCreate = useCallback(async (form: FormState) => {
    const created = await createGmUser({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      postalCode: form.postalCode,
      region: form.region,
    });
    setGms((prev) => [created, ...prev]);
    setNewId(created.id);
    setTimeout(() => setNewId(null), 600);
    setBackendError(null);
    return { gm: created, password: created.password ?? "" };
  }, []);

  const handleSave = useCallback(async (updated: GMRecord) => {
    try {
      const saved = await updateGmUser(updated);
      setGms((prev) => prev.map((g) => (g.id === saved.id ? { ...saved, password: g.password } : g)));
      setBackendError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "GM konnte nicht gespeichert werden.";
      setBackendError(msg);
    }
  }, []);

  const handleToggleBillaGm = useCallback(async (gm: GMRecord) => {
    if (billaToggleBusyId) return;
    setBillaToggleBusyId(gm.id);
    setContextMenu(null);
    try {
      const saved = await updateGmUser({ ...gm, isBillaGm: !gm.isBillaGm });
      setGms((prev) => prev.map((entry) => (entry.id === saved.id ? { ...saved, password: entry.password } : entry)));
      setBackendError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Billa-Filter konnte nicht gespeichert werden.";
      setBackendError(msg);
    } finally {
      setBillaToggleBusyId(null);
    }
  }, [billaToggleBusyId]);

  const handleExportGms = useCallback(async () => {
    if (isExportingGms) return;
    setExportError(null);
    setIsExportingGms(true);
    try {
      await exportGebietsmanagerExcel({
        gms,
        visits,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExportingGms(false);
    }
  }, [gms, isExportingGms, visits]);

  useEffect(() => {
    const handler = () => { void handleExportGms(); };
    window.addEventListener("admin:gebietsmanager:export", handler);
    return () => window.removeEventListener("admin:gebietsmanager:export", handler);
  }, [handleExportGms]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>Gebietsmanager</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {gms.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>{gms.length} {gms.length === 1 ? "GM" : "GMs"}</span>}
          </div>
        </div>
        {backendError ? (
          <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
            {backendError}
          </div>
        ) : null}
        {exportError ? (
          <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
            Export fehlgeschlagen: {exportError}
          </div>
        ) : null}

        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {loading ? (
            <GmCardsSkeleton />
          ) : gms.length === 0 ? (
            <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={22} strokeWidth={1.5} color={R} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>Noch keine Gebietsmanager angelegt</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 300, lineHeight: 1.6 }}>Erstelle den ersten GM, um Märkte und Prämien zuordnen zu können.</div>
              </div>
              <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, border: "none", borderRadius: 8, cursor: "pointer", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, fontFamily: "inherit" }}>
                <Plus size={11} strokeWidth={2.5} /> GM erstellen
              </button>
            </div>
          ) : (
            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {gms.map(gm => (
                  <GMCard
                    key={gm.id} gm={gm} isNew={gm.id === newId}
                    active={gm.id === selectedId}
                    onClick={() => setSelectedId(selectedId === gm.id ? null : gm.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu({ gmId: gm.id, x: event.clientX, y: event.clientY });
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {selectedGm && <GMDetailDrawer gm={selectedGm} onClose={() => setSelectedId(null)} onSave={handleSave} visits={visits} />}
      {contextMenu && contextMenuGm && createPortal(
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, Math.max(12, window.innerWidth - 210)),
            top: Math.min(contextMenu.y, Math.max(12, window.innerHeight - 64)),
            zIndex: 9999,
            width: 198,
            borderRadius: 11,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 12px 34px rgba(15,23,42,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            padding: 5,
            fontFamily: "inherit",
          }}
        >
          <button
            type="button"
            onClick={() => { void handleToggleBillaGm(contextMenuGm); }}
            disabled={billaToggleBusyId === contextMenuGm.id}
            style={{
              width: "100%",
              height: 34,
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "0 9px",
              cursor: billaToggleBusyId === contextMenuGm.id ? "wait" : "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 700,
              textAlign: "left",
            }}
            onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(37,99,235,0.06)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#2563eb",
                boxShadow: "0 0 0 3px rgba(37,99,235,0.10)",
                flexShrink: 0,
              }}
            />
            {contextMenuGm.isBillaGm ? "Billa-Filter entfernen" : "Billa-Filter setzen"}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
