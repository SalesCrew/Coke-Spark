"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  Play,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import {
  fetchActiveGmVisitSession,
  fetchCurrentDaySession,
  fetchLatestActiveGmVisitSession,
  fetchGmAssignedStartMarkets,
  fetchGmMarketDetail,
  fetchGmVisitSession,
  fetchGmVisitStartPayload,
  setGmVisitPreloadCache,
  setGmVisitStartPreloadCache,
  type GmMarketDetailActiveCampaign,
  type GmMarketDetailSection,
  type GmMarketDetailPayload,
  type GmMarketPastVisit,
  type GmStartMarket,
  type GmVisitSessionPayload,
} from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import { readLatestLocalDaySessionSnapshot } from "@/lib/gm/daySessionPersistence";
import { ActiveFragebogenBlockModal } from "./ActiveFragebogenBlockModal";
import type { MarketRecord } from "@/types/markets";

type MarketCampaignSummary = GmStartMarket["activeNowCampaigns"][number];

export interface GmDashboardMarket {
  id: string;
  name: string;
  chain: string;
  address: string;
  visited: number;
  frequency: number;
  visitedThisMonth: boolean;
  record: MarketRecord;
  activeNowCampaigns: MarketCampaignSummary[];
  nextSM?: string;
}

type Market = GmDashboardMarket;

interface MarketListProps {
  visited?: number;
  total?: number;
}

const CARD_MENU_SPACE = 80;
const MIN_CARD_HEIGHT = 260;
const DAY_SESSION_UPDATED_EVENT = "gm:day-session-updated";

function chainColors(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function deriveChainLabel(record: MarketRecord): string {
  const dbName = record.dbName?.trim();
  if (dbName) return dbName.toUpperCase();
  const source = `${record.name} ${record.dbName}`.toUpperCase();
  if (source.includes("BILLA+")) return "BILLA+";
  if (source.includes("BILLA")) return "BILLA";
  if (source.includes("SPAR")) return "SPAR";
  if (source.includes("ADEG")) return "ADEG";
  if (source.includes("PENNY")) return "PENNY";
  if (source.includes("HOFER")) return "HOFER";
  if (source.includes("MERKUR")) return "MERKUR";
  return record.name.split(" ")[0]?.toUpperCase() || "MARKT";
}

function formatMarketName(record: MarketRecord): string {
  const name = record.name?.trim() || record.dbName?.trim();
  if (name) return name;
  return [record.address, [record.postalCode, record.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Markt";
}

function formatAddress(record: MarketRecord): string {
  return [record.address, [record.postalCode, record.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function formatStammnr(record: MarketRecord): string {
  return record.cokeMasterNumber?.trim() || record.kuehlerStammnr?.trim() || "";
}

export function toMarketListEntry(record: MarketRecord, activeNowCampaigns: MarketCampaignSummary[] = []): Market {
  return {
    id: record.id,
    name: formatMarketName(record),
    chain: deriveChainLabel(record),
    address: formatAddress(record),
    visited: 0,
    frequency: Math.max(1, record.visitFrequencyPerYear || activeNowCampaigns.length || 1),
    visitedThisMonth: false,
    record,
    activeNowCampaigns,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sectionLabel(section: string): string {
  if (section === "standard") return "Standard";
  if (section === "flex") return "Flex";
  if (section === "kuehler") return "Kühler";
  if (section === "mhd") return "MHD";
  if (section === "billa") return "Billa";
  return section;
}

function marketTypeLabel(record: MarketRecord): string {
  if (record.marketType === "both") return "Universum + Kühler";
  if (record.marketType === "universum") return "Universum";
  if (record.marketType === "kuehler") return "Kühler";
  return "-";
}

function FactRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "-" : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "7px 0" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.36)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.82)", textAlign: "right" }}>{display}</span>
    </div>
  );
}

function PastVisitRow({ visit }: { visit: GmMarketPastVisit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ border: "1px solid rgba(15,23,42,0.06)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: "11px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              background: "rgba(220,38,38,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#DC2626",
            }}
          >
            <Clock size={12} />
          </span>
          <span style={{ minWidth: 0, textAlign: "left" }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.86)" }}>
              {formatDateTime(visit.submittedAt)}
            </span>
            <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(15,23,42,0.42)" }}>
              {visit.durationMinutes ?? "-"} min - {visit.sections.length} Sektion{visit.sections.length === 1 ? "" : "en"}
            </span>
          </span>
        </span>
        <ChevronDown size={14} style={{ color: "rgba(15,23,42,0.38)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.16s ease" }} />
      </button>
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(15,23,42,0.06)", padding: "8px 12px 12px", display: "grid", gap: 7 }}>
          {visit.sections.map((section) => (
            <div key={`${visit.sessionId}-${section.campaignId}`} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.86)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {section.campaignName}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.38)" }}>{sectionLabel(section.section)}</div>
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.48)", whiteSpace: "nowrap" }}>
                {section.answeredQuestionCount} A - {section.photoCount} F - {section.commentCount} K
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  selected,
  disabled,
  onToggle,
}: {
  campaign: GmMarketDetailActiveCampaign;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const progress = `${campaign.submittedVisitCount}/${campaign.targetVisitCount}`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      style={{
        border: selected ? "1px solid rgba(220,38,38,0.42)" : "1px solid rgba(15,23,42,0.07)",
        background: selected ? "rgba(220,38,38,0.055)" : disabled ? "rgba(15,23,42,0.025)" : "#fff",
        borderRadius: 13,
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.62 : 1,
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: "#DC2626",
              background: "rgba(220,38,38,0.08)",
              borderRadius: 999,
              padding: "3px 7px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {sectionLabel(campaign.section)}
          </span>
          {campaign.isComplete && <Check size={12} color="#16a34a" />}
        </span>
        <span style={{ display: "block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.86)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {campaign.campaignName}
        </span>
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: campaign.isComplete ? "#16a34a" : "rgba(15,23,42,0.82)" }}>{progress}</span>
        <span style={{ display: "block", marginTop: 1, fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.38)" }}>
          {campaign.isComplete ? "fertig" : "offen"}
        </span>
      </span>
    </button>
  );
}

export type GmMarketDetailCampaignChoice = {
  key: string;
  campaignId: string;
  campaignName: string;
  section: GmMarketDetailSection;
  kuehlerUnitId?: string | null;
  kuehlerNumber?: string | null;
  done?: boolean;
  doneDate?: string;
  isStartable?: boolean;
};

function CampaignChoiceRow({
  choice,
  selected,
  disabled,
  onSelect,
}: {
  choice: GmMarketDetailCampaignChoice;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const done = Boolean(choice.done);
  const unitLabel = choice.kuehlerNumber?.trim() || "Kühler";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      style={{
        border: selected ? "1px solid rgba(220,38,38,0.42)" : "1px solid rgba(15,23,42,0.07)",
        background: selected ? "rgba(220,38,38,0.055)" : disabled ? "rgba(15,23,42,0.025)" : "#fff",
        borderRadius: 13,
        padding: "11px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.62 : 1,
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: "#b45309",
              background: "rgba(245,158,11,0.10)",
              borderRadius: 999,
              padding: "3px 7px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {sectionLabel(choice.section)}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "rgba(15,23,42,0.62)",
              background: "rgba(15,23,42,0.045)",
              borderRadius: 999,
              padding: "3px 7px",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {unitLabel}
          </span>
          {done && <Check size={12} color="#16a34a" />}
        </span>
        <span style={{ display: "block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.86)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {choice.campaignName}
        </span>
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: done ? "#16a34a" : "rgba(15,23,42,0.82)" }}>{done ? "1/1" : "0/1"}</span>
        <span style={{ display: "block", marginTop: 1, fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.38)" }}>
          {done ? (choice.doneDate || "fertig") : "offen"}
        </span>
      </span>
    </button>
  );
}

export function GmMarketDetailModal({
  market,
  detail,
  isLoading,
  error,
  sectionFilter,
  selectedCampaignIds,
  campaignChoices,
  selectedCampaignChoiceKey,
  isLaunching,
  dayStarted,
  dayGateLoading,
  launchError,
  onToggleCampaign,
  onSelectCampaignChoice,
  onStart,
  onContinueDraft,
  onClose,
}: {
  market: Market;
  detail: GmMarketDetailPayload | null;
  isLoading: boolean;
  error: string | null;
  sectionFilter?: GmMarketDetailSection[];
  selectedCampaignIds: string[];
  campaignChoices?: GmMarketDetailCampaignChoice[];
  selectedCampaignChoiceKey?: string | null;
  isLaunching: boolean;
  dayStarted: boolean;
  dayGateLoading: boolean;
  launchError: string | null;
  onToggleCampaign: (campaignId: string) => void;
  onSelectCampaignChoice?: (choice: GmMarketDetailCampaignChoice) => void;
  onStart: () => void;
  onContinueDraft: (sessionId: string, campaignIds: string[]) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const record = detail?.market ?? market.record;
  const chain = chainColors(market.chain);
  const allowedSections = sectionFilter?.length ? new Set(sectionFilter) : null;
  const visibleCampaigns = detail?.activeCampaigns.filter((campaign) => !allowedSections || allowedSections.has(campaign.section)) ?? [];
  const visibleCampaignIds = new Set(visibleCampaigns.map((campaign) => campaign.campaignId));
  const visibleDrafts = detail?.drafts.filter((draft) => draft.campaignIds.some((campaignId) => visibleCampaignIds.has(campaignId))) ?? [];
  const visiblePastVisits =
    detail?.pastVisits
      .map((visit) => ({
        ...visit,
        sections: visit.sections.filter((section) => !allowedSections || allowedSections.has(section.section)),
      }))
      .filter((visit) => visit.sections.length > 0) ?? [];
  const selectableCampaigns = visibleCampaigns.filter((campaign) => campaign.isStartable);
  const visibleCampaignChoices =
    campaignChoices?.filter((choice) => !allowedSections || allowedSections.has(choice.section)) ?? [];
  const hasCampaignChoices = visibleCampaignChoices.length > 0;
  const selectableCampaignChoiceCount = visibleCampaignChoices.filter((choice) => choice.isStartable !== false && !choice.done).length;
  const selectedCampaignChoice = hasCampaignChoices
    ? visibleCampaignChoices.find((choice) => choice.key === selectedCampaignChoiceKey) ?? null
    : null;
  const startDisabled =
    isLoading ||
    isLaunching ||
    dayGateLoading ||
    !dayStarted ||
    selectedCampaignIds.length === 0 ||
    (hasCampaignChoices
      ? !selectedCampaignChoice || selectedCampaignChoice.done || selectedCampaignChoice.isStartable === false || selectableCampaignChoiceCount === 0
      : selectableCampaigns.length === 0);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
        background: "rgba(15,23,42,0.18)",
        backdropFilter: "blur(7px)",
        WebkitBackdropFilter: "blur(7px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          border: "1px solid rgba(255,255,255,0.76)",
          borderRadius: 20,
          boxShadow: "0 28px 80px rgba(15,23,42,0.18), 0 5px 18px rgba(15,23,42,0.08)",
          animation: "gmMarketModalIn 0.2s cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        <style>{`
          @keyframes gmMarketModalIn {
            from { opacity: 0; transform: scale(0.97) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: chain.text,
                    background: chain.bg,
                    borderRadius: 7,
                    padding: "4px 8px",
                    letterSpacing: "0.035em",
                    textTransform: "uppercase",
                  }}
                >
                  {market.chain}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(15,23,42,0.88)", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
                {formatMarketName(record)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, fontWeight: 600, color: "rgba(15,23,42,0.45)" }}>
                <MapPin size={12} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatAddress(record)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                border: "none",
                background: "rgba(15,23,42,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={14} color="rgba(15,23,42,0.44)" />
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "14px 18px 18px", display: "grid", gap: 13 }}>
          {isLoading && (
            <div style={{ borderRadius: 14, background: "rgba(15,23,42,0.025)", border: "1px solid rgba(15,23,42,0.05)", padding: 16, color: "rgba(15,23,42,0.45)", fontSize: 11, fontWeight: 700 }}>
              Marktdetails werden geladen...
            </div>
          )}

          {error && (
            <div style={{ borderRadius: 14, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", padding: 14, color: "#DC2626", fontSize: 11, fontWeight: 800 }}>
              {error}
            </div>
          )}

          <section style={{ borderRadius: 15, background: "rgba(15,23,42,0.025)", border: "1px solid rgba(15,23,42,0.055)", padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.34)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
              Marktdaten
            </div>
            <FactRow label="Stammnr." value={record.cokeMasterNumber || record.kuehlerStammnr} />
            <FactRow label="Flex-Nr." value={record.flexNumber} />
            <FactRow label="Region" value={record.region} />
            <FactRow label="PLZ / Ort" value={[record.postalCode, record.city].filter(Boolean).join(" ")} />
            <FactRow label="EM/EH" value={record.emEh} />
            <FactRow label="Verplant an" value={record.plannedByActiveStandardGmName || record.currentGmName} />
            <FactRow label="Frequenz" value={record.visitFrequencyPerYear ? `${record.visitFrequencyPerYear} / Jahr` : "-"} />
            <FactRow label="Universums-Markt" value={record.universeMarket ? "Ja" : "Nein"} />
            <FactRow label="Markt-Typ" value={marketTypeLabel(record)} />
          </section>

          {visibleDrafts.length ? (
            <section style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.86)" }}>Offener Fragebogen</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.36)" }}>Fortsetzen</div>
              </div>
              {visibleDrafts.map((draft) => (
                <button
                  key={draft.sessionId}
                  type="button"
                  disabled={!dayStarted || dayGateLoading || isLaunching}
                  onClick={() => onContinueDraft(draft.sessionId, draft.campaignIds)}
                  style={{
                    border: "1px solid rgba(22,163,74,0.16)",
                    background: "rgba(22,163,74,0.055)",
                    borderRadius: 13,
                    padding: "11px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    cursor: !dayStarted || dayGateLoading || isLaunching ? "not-allowed" : "pointer",
                    opacity: !dayStarted || dayGateLoading ? 0.58 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.86)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {draft.campaignNames.join(", ") || "Aktiver Fragebogen"}
                    </span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.42)" }}>
                      Gestartet {formatDateTime(draft.startedAt)}
                    </span>
                  </span>
                  {isLaunching ? <Loader2 size={14} className="animate-spin" color="#15803d" /> : <Play size={14} color="#15803d" />}
                </button>
              ))}
            </section>
          ) : null}

          <section style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.86)" }}>Kampagnen</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.36)" }}>
                {hasCampaignChoices ? selectableCampaignChoiceCount : selectableCampaigns.length} auswählbar
              </div>
            </div>
            {hasCampaignChoices ? (
              visibleCampaignChoices.map((choice) => (
                <CampaignChoiceRow
                  key={choice.key}
                  choice={choice}
                  selected={selectedCampaignChoiceKey === choice.key}
                  disabled={choice.isStartable === false || Boolean(choice.done) || isLaunching}
                  onSelect={() => onSelectCampaignChoice?.(choice)}
                />
              ))
            ) : visibleCampaigns.length ? (
              visibleCampaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.campaignId}
                  campaign={campaign}
                  selected={selectedCampaignIds.includes(campaign.campaignId)}
                  disabled={!campaign.isStartable || isLaunching}
                  onToggle={() => onToggleCampaign(campaign.campaignId)}
                />
              ))
            ) : (
              <div style={{ borderRadius: 13, background: "rgba(15,23,42,0.025)", padding: 14, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.42)", textAlign: "center" }}>
                Keine Kampagnen für diesen Markt.
              </div>
            )}
          </section>

          <section style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.86)" }}>Vergangene Besuche</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.36)" }}>{visiblePastVisits.length}</div>
            </div>
            {visiblePastVisits.length ? (
              visiblePastVisits.map((visit) => <PastVisitRow key={visit.sessionId} visit={visit} />)
            ) : (
              <div style={{ borderRadius: 13, background: "rgba(15,23,42,0.025)", padding: 14, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.42)", textAlign: "center" }}>
                Noch keine Besuche von dir in diesem Markt.
              </div>
            )}
          </section>

          {(!dayStarted || launchError) && (
            <div style={{ fontSize: 10, fontWeight: 700, color: !dayStarted ? "#b45309" : "#DC2626" }}>
              {!dayStarted ? "Bitte zuerst den Arbeitstag starten." : launchError}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px 18px", borderTop: "1px solid rgba(15,23,42,0.06)" }}>
          <button
            type="button"
            disabled={startDisabled}
            onClick={onStart}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(220,38,38,0.24)",
              background: startDisabled ? "rgba(15,23,42,0.08)" : "linear-gradient(180deg,#ef4444 0%,#DC2626 100%)",
              boxShadow: startDisabled ? "none" : "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 18px rgba(220,38,38,0.18)",
              color: startDisabled ? "rgba(15,23,42,0.34)" : "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: startDisabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isLaunching ? "Wird vorbereitet..." : "Starten"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MarketList({ visited = 0, total }: MarketListProps) {
  const router = useRouter();
  const { current } = useRedMonth();
  const [search, setSearch] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [cardMaxH, setCardMaxH] = useState<number | undefined>(undefined);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [detail, setDetail] = useState<GmMarketDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [dayStarted, setDayStarted] = useState(false);
  const [dayGateLoading, setDayGateLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [blockedActiveVisit, setBlockedActiveVisit] = useState<GmVisitSessionPayload | null>(null);
  const [blockedActiveOpening, setBlockedActiveOpening] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const daysLeft = current?.daysUntilEnd ?? 0;
  const totalMarkets = total ?? markets.length;

  const refreshDayGate = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setDayGateLoading(true);
    try {
      const payload = await fetchCurrentDaySession();
      setDayStarted(Boolean(payload.gate?.dayStarted) || Boolean(readLatestLocalDaySessionSnapshot()));
    } catch {
      setDayStarted(Boolean(readLatestLocalDaySessionSnapshot()));
    } finally {
      if (!silent) setDayGateLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    void fetchGmAssignedStartMarkets()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map((row) => toMarketListEntry(row.market, row.activeNowCampaigns));
        const deduped = Array.from(new Map(mapped.map((entry) => [entry.id, entry])).values());
        setMarkets(deduped);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Märkte konnten nicht geladen werden.";
        setLoadError(message);
        setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshDayGate();
  }, [refreshDayGate]);

  useEffect(() => {
    const handleDaySessionUpdated = () => {
      if (readLatestLocalDaySessionSnapshot()) {
        setDayStarted(true);
        setDayGateLoading(false);
      }
      void refreshDayGate({ silent: true });
    };
    window.addEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
    return () => {
      window.removeEventListener(DAY_SESSION_UPDATED_EVENT, handleDaySessionUpdated);
    };
  }, [refreshDayGate]);

  useEffect(() => {
    function calc() {
      if (!cardRef.current) return;
      const top = cardRef.current.getBoundingClientRect().top;
      const available = Math.floor(window.innerHeight - top - CARD_MENU_SPACE);
      if (!Number.isFinite(available)) return;
      setCardMaxH(Math.max(MIN_CARD_HEIGHT, available));
    }
    requestAnimationFrame(() => requestAnimationFrame(calc));
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleReveal = useCallback((id: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRevealedId(id);
    setCountdown(5);
    let c = 5;
    intervalRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRevealedId(null);
        setCountdown(0);
      }
    }, 1000);
  }, []);

  const openDetail = useCallback((market: Market) => {
    setSelectedMarket(market);
    setSelectedCampaignIds([]);
    setLaunchError(null);
    setDetailError(null);

    setDetail(null);
    setDetailLoading(true);
    void fetchGmMarketDetail(market.id)
      .then((payload) => {
        setDetail(payload);
        const defaultCampaign =
          payload.activeCampaigns.find((campaign) => (campaign.section === "standard" || campaign.section === "billa") && campaign.isStartable) ?? null;
        setSelectedCampaignIds(defaultCampaign ? [defaultCampaign.campaignId] : []);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Marktdetails konnten nicht geladen werden.";
        setDetailError(message);
      })
      .finally(() => setDetailLoading(false));
  }, []);

  const closeDetail = useCallback(() => {
    if (isLaunching) return;
    setSelectedMarket(null);
    setDetail(null);
    setDetailError(null);
    setSelectedCampaignIds([]);
    setLaunchError(null);
  }, [isLaunching]);

  const toggleCampaign = useCallback((campaignId: string) => {
    setSelectedCampaignIds((current) =>
      current.includes(campaignId) ? current.filter((id) => id !== campaignId) : [...current, campaignId],
    );
  }, []);

  const blockedActiveCampaignNames = useMemo(
    () => Array.from(new Set((blockedActiveVisit?.sections ?? []).map((section) => section.campaignName).filter(Boolean))),
    [blockedActiveVisit],
  );

  const openBlockedActiveVisit = useCallback(async () => {
    if (!blockedActiveVisit || blockedActiveOpening) return;
    setBlockedActiveOpening(true);
    try {
      const payload = await fetchGmVisitSession(blockedActiveVisit.session.id);
      setGmVisitPreloadCache(payload);
      const campaignIds = Array.from(new Set(payload.sections.map((section) => section.campaignId).filter(Boolean)));
      const address = [
        payload.market.address,
        [payload.market.postalCode, payload.market.city].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      router.push(
        `/gm/marktbesuch?chain=${encodeURIComponent(payload.market.name)}&address=${encodeURIComponent(address)}&marketId=${encodeURIComponent(payload.market.id)}&campaignIds=${encodeURIComponent(campaignIds.join(","))}&sessionId=${encodeURIComponent(payload.session.id)}`,
      );
    } catch {
      setBlockedActiveOpening(false);
      setLaunchError("Aktiver Fragebogen konnte nicht geoeffnet werden. Bitte erneut versuchen.");
    }
  }, [blockedActiveOpening, blockedActiveVisit, router]);

  const launchVisit = useCallback(
    async (market: Market, campaignIds: string[], sessionId?: string) => {
      if (!dayStarted) {
        setLaunchError("Bitte zuerst den Arbeitstag starten.");
        return;
      }
      if (campaignIds.length === 0) {
        setLaunchError("Bitte mindestens eine Kampagne auswählen.");
        return;
      }

      setIsLaunching(true);
      setLaunchError(null);
      setBlockedActiveVisit(null);
      try {
        let sessionParam = "";
        if (sessionId) {
          const payload = await fetchGmVisitSession(sessionId);
          setGmVisitPreloadCache(payload);
          sessionParam = `&sessionId=${encodeURIComponent(sessionId)}`;
        } else {
          const activeVisit = await fetchActiveGmVisitSession({
            marketId: market.id,
            campaignIds,
          });
          if (activeVisit.session?.id) {
            const payload = await fetchGmVisitSession(activeVisit.session.id);
            setGmVisitPreloadCache(payload);
            sessionParam = `&sessionId=${encodeURIComponent(activeVisit.session.id)}`;
          } else {
            const latestActiveVisit = await fetchLatestActiveGmVisitSession();
            if (latestActiveVisit.session?.id) {
              setIsLaunching(false);
              setBlockedActiveVisit(latestActiveVisit as GmVisitSessionPayload);
              return;
            }
            const payload = await fetchGmVisitStartPayload(market.id, campaignIds);
            setGmVisitStartPreloadCache({
              marketId: market.id,
              campaignIds,
              payload,
            });
          }
        }

        router.push(
          `/gm/marktbesuch?chain=${encodeURIComponent(market.chain)}&address=${encodeURIComponent(market.address)}&marketId=${encodeURIComponent(market.id)}&campaignIds=${encodeURIComponent(campaignIds.join(","))}${sessionParam}`,
        );
      } catch {
        setIsLaunching(false);
        setLaunchError("Marktbesuch konnte nicht vorbereitet werden. Bitte erneut versuchen.");
      }
    },
    [dayStarted, router],
  );

  const handleStartSelected = useCallback(() => {
    if (!selectedMarket) return;
    void launchVisit(selectedMarket, selectedCampaignIds);
  }, [launchVisit, selectedCampaignIds, selectedMarket]);

  const handleContinueDraft = useCallback(
    (sessionId: string, campaignIds: string[]) => {
      if (!selectedMarket) return;
      void launchVisit(selectedMarket, campaignIds, sessionId);
    },
    [launchVisit, selectedMarket],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return markets;
    const q = search.toLowerCase();
    return markets.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.chain.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q),
    );
  }, [search, markets]);

  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
        maxHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        minHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold" style={{ color: "#DC2626" }}>
          RED Monat endet in {daysLeft} Tagen
        </span>
        <span className="text-[11px] font-medium text-gray-500">
          Märkte besucht <span className="font-semibold text-gray-700">{visited}/{totalMarkets}</span>
        </span>
      </div>

      <div className="mt-2.5 relative">
        <Search
          size={11}
          strokeWidth={1.8}
          className="absolute"
          style={{ left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.25)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen..."
          className="w-full text-[10px] text-gray-600 placeholder-gray-300 outline-none"
          style={{
            padding: "5px 10px 5px 24px",
            backgroundColor: "transparent",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderRadius: 0,
          }}
        />
      </div>

      <div
        className="mt-3"
        style={{
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          flex: 1,
          minHeight: 0,
        }}
      >
        {!isLoading && !loadError && filtered.map((m, i) => {
          const stammnr = formatStammnr(m.record);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2"
              onClick={() => openDetail(m)}
              style={{
                padding: "8px 10px",
                borderRadius: 7,
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                transition: "background-color 0.12s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="shrink-0 text-[9px] font-semibold uppercase"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 5,
                    backgroundColor: chainColors(m.chain).bg,
                    color: chainColors(m.chain).text,
                    letterSpacing: "0.02em",
                    maxWidth: 78,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.chain}
                </span>

                <div className="min-w-0 flex-1">
                  {revealedId === m.id && m.nextSM ? (
                    <>
                      <span className="block text-[10px] font-medium truncate" style={{ color: "#DC2626" }} title={`Naechster SM: ${m.nextSM}`}>
                        Naechster SM: {m.nextSM}
                      </span>
                      {m.address && (
                        <span className="block text-[9px] font-medium truncate" style={{ color: "rgba(15,23,42,0.34)", marginTop: 1 }} title={m.address}>
                          {m.address}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="block text-[10px] font-medium text-gray-600 truncate" title={m.name}>
                        {m.name}
                      </span>
                      {m.address && (
                        <span className="block text-[9px] font-medium truncate" style={{ color: "rgba(15,23,42,0.34)", marginTop: 1 }} title={m.address}>
                          {m.address}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {m.nextSM && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleReveal(m.id);
                    }}
                    className="shrink-0 flex items-center justify-center"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      backgroundColor: revealedId === m.id ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.08)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {revealedId === m.id ? (
                      <span style={{ fontSize: 8, fontWeight: 700, color: "#16a34a" }}>{countdown}</span>
                    ) : (
                      <UserCheck size={9} strokeWidth={2} color="#DC2626" />
                    )}
                  </button>
                )}
                {stammnr && (
                  <span
                    className="shrink-0 text-[9px] font-semibold text-gray-400 tabular-nums"
                    title={`Stammnr: ${stammnr}`}
                  >
                    {stammnr}
                  </span>
                )}
                <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
                  <svg viewBox="0 0 36 36" width={32} height={32} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
                    <circle cx={18} cy={18} r={15} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={2.5} />
                    <circle
                      cx={18}
                      cy={18}
                      r={15}
                      fill="none"
                      stroke={m.visitedThisMonth ? "#16a34a" : "#DC2626"}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={`${(m.visited / m.frequency) * 94.25} 94.25`}
                    />
                  </svg>
                  <span className="text-[8px] font-semibold text-gray-700 tabular-nums" style={{ position: "relative", zIndex: 1 }}>
                    {m.visited}/{m.frequency}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="text-center py-8">
            <span className="text-[10px] text-gray-400">Märkte werden geladen...</span>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="text-center py-8">
            <span className="text-[10px] text-gray-400">Märkte konnten nicht geladen werden</span>
          </div>
        )}

        {!isLoading && !loadError && markets.length === 0 && (
          <div className="text-center py-10">
            <div className="text-[11px] font-medium text-gray-500">Noch keine zugewiesenen Märkte</div>
            <div className="mt-1 text-[10px] text-gray-400">
              Sobald aktive Kampagnen-Märkte für dich zugewiesen sind, erscheinen sie hier.
            </div>
          </div>
        )}

        {!isLoading && !loadError && markets.length > 0 && filtered.length === 0 && (
          <div className="text-center py-4">
            <span className="text-[10px] text-gray-400">Keine Märkte gefunden</span>
          </div>
        )}
      </div>

      {selectedMarket && (
        <GmMarketDetailModal
          market={selectedMarket}
          detail={detail}
          isLoading={detailLoading}
          error={detailError}
          sectionFilter={["standard", "billa"]}
          selectedCampaignIds={selectedCampaignIds}
          isLaunching={isLaunching}
          dayStarted={dayStarted}
          dayGateLoading={dayGateLoading}
          launchError={launchError}
          onToggleCampaign={toggleCampaign}
          onStart={handleStartSelected}
          onContinueDraft={handleContinueDraft}
          onClose={closeDetail}
        />
      )}
      <ActiveFragebogenBlockModal
        open={Boolean(blockedActiveVisit)}
        opening={blockedActiveOpening}
        marketName={blockedActiveVisit?.market.name}
        campaignNames={blockedActiveCampaignNames}
        onClose={() => {
          if (blockedActiveOpening) return;
          setBlockedActiveVisit(null);
        }}
        onOpenActive={() => {
          void openBlockedActiveVisit();
        }}
      />
    </div>
  );
}
