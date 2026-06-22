"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Camera, FileText, Search, Minus, Plus, X, ChevronDown, Trash2, AlertTriangle, ListPlus } from "lucide-react";
import Aurora from "@/components/ui/Aurora";
import type { Campaign, CampaignMarketOverlapConflict, CampaignSection } from "@/types/campaign";
import type { ConditionalRule, Fragebogen, Module, Question } from "@/types/fragebogen";
import type { GMRecord } from "@/types/gebietsmanager";
import {
  BackendApiError,
  assignCampaignMarketAssignments,
  assignCampaignMarkets,
  deleteCampaign,
  fetchCampaignMarketVisitDetail,
  fetchCampaignMarketVisitStatuses,
  fetchCampaigns,
  fetchFragebogen,
  fetchGmUsers,
  fetchMarkets,
  fetchModules,
  getCampaignOverlapConflicts,
  hardDeleteCampaign,
  migrateCampaignMarkets,
  patchCampaignVisitAnswer,
  reassignCampaignGms,
  readAuthSession,
  removeCampaignMarket,
  switchCampaignFragebogen,
} from "@/lib/api/backend";
import type { CampaignMarketVisitStatus, CampaignMarketVisitSummary, CampaignVisitAnswerPatchMissingRequired } from "@/lib/api/backend";
import { exportFbManagementExcel } from "@/lib/exports/planningExports";

type FragebogenOption = {
  id: string;
  name: string;
  modules: number;
  questions: number;
};

const SECTION_COLORS: Record<CampaignSection, string> = {
  standard: "#DC2626",
  flex: "#84CC16",
  kuehler: "#D97706",
  mhd: "#7C3AED",
  billa: "#0891B2",
};

const MARKET_LIST_INITIAL_LIMIT = 120;
const MARKET_LIST_LOAD_STEP = 120;
const ADD_PANEL_INITIAL_LIMIT = 80;
const ADD_PANEL_LOAD_STEP = 80;
const VISIT_STATUS_BATCH_SIZE = 50;
const VISIT_STATUS_MAX_CONCURRENT_BATCHES = 2;
const VISIT_DETAIL_PREFETCH_MAX_CONCURRENT = 1;
const HARD_DELETE_CAMPAIGN_CONFIRMATION_TEXT = "Ich bin mir sicher, dass ich alle Daten zu dieser Kampagne Löschen will!";

type CampaignContextMenuState = {
  campaignId: string;
  x: number;
  y: number;
};

type CampaignDeleteDialogState = {
  campaignId: string;
  mode: "soft" | "hard";
};

type CampaignReassignDialogState = {
  campaignId: string;
};

type CampaignGmReassignGroup = {
  gmUserId: string;
  gmName: string;
  marketCount: number;
  visitTargetCount: number;
  completedCount: number;
};

// ── Static UI helpers ─────────────────────────────────────────

interface MarketCatalogItem {
  id: string;
  name: string;
  chain: string;
  city: string;
  region: string;
  address: string;
  stammnr?: string;
  gm: string;
  finished: boolean;
}

type CampaignVisitStatusByMarket = Record<string, CampaignMarketVisitStatus>;
type CampaignVisitDetailByKey = Record<string, CampaignMarketVisitSummary>;

interface MarketListFilters {
  chain: string | null;
  gm: string | null;
  city: string | null;
  region: string | null;
}

const MARKET_CATALOG: MarketCatalogItem[] = [
  { id: "m1",  name: "Billa Wien 10",          chain: "Billa",  city: "Wien",        region: "Ost",  address: "Favoritenstr. 10, 1100 Wien",            gm: "Thomas Huber",   finished: true  },
  { id: "m2",  name: "Billa Wien 12",           chain: "Billa",  city: "Wien",        region: "Ost",  address: "Meidlinger Hauptstr. 12, 1120 Wien",     gm: "Thomas Huber",   finished: true  },
  { id: "m3",  name: "Merkur Graz Hauptplatz",  chain: "Merkur", city: "Graz",        region: "Süd",  address: "Hauptplatz 1, 8010 Graz",                gm: "Anna Gruber",    finished: false },
  { id: "m4",  name: "Spar Linz Nord",          chain: "Spar",   city: "Linz",        region: "West", address: "Industriezeile 44, 4020 Linz",            gm: "Michael Huber",  finished: false },
  { id: "m5",  name: "Billa Wien 6",            chain: "Billa",  city: "Wien",        region: "Ost",  address: "Mariahilfer Str. 58, 1060 Wien",          gm: "Sandra Mayer",   finished: true  },
  { id: "m6",  name: "Billa Mödling",           chain: "Billa",  city: "Mödling",     region: "Ost",  address: "Wiener Str. 22, 2340 Mödling",            gm: "Sandra Mayer",   finished: false },
  { id: "m7",  name: "Merkur Wien 22",          chain: "Merkur", city: "Wien",        region: "Ost",  address: "Donaustadtstr. 7, 1220 Wien",             gm: "Klaus Berger",   finished: true  },
  { id: "m8",  name: "Spar Graz West",          chain: "Spar",   city: "Graz",        region: "Süd",  address: "Westring 381, 8051 Graz",                 gm: "Anna Gruber",    finished: true  },
  { id: "m9",  name: "Billa Baden",             chain: "Billa",  city: "Baden",       region: "Ost",  address: "Kaiser Franz-Josef Ring 5, 2500 Baden",   gm: "Sandra Mayer",   finished: false },
  { id: "m10", name: "Merkur Salzburg",         chain: "Merkur", city: "Salzburg",    region: "West", address: "Europark Allee 1, 5020 Salzburg",         gm: "Michael Huber",  finished: false },
  { id: "m11", name: "Billa Wien 15",           chain: "Billa",  city: "Wien",        region: "Ost",  address: "Schönbrunner Str. 131, 1050 Wien",        gm: "Thomas Huber",   finished: true  },
  { id: "m12", name: "Spar Wels",               chain: "Spar",   city: "Wels",        region: "West", address: "Stadtplatz 12, 4600 Wels",                gm: "Klaus Berger",   finished: true  },
  { id: "m13", name: "Billa Klagenfurt",        chain: "Billa",  city: "Klagenfurt",  region: "Süd",  address: "Völkermarkter Str. 27, 9020 Klagenfurt",  gm: "Anna Gruber",    finished: false },
  { id: "m14", name: "Merkur Innsbruck",        chain: "Merkur", city: "Innsbruck",   region: "Nord", address: "Museumstr. 38, 6020 Innsbruck",           gm: "Klaus Berger",   finished: false },
  { id: "m15", name: "Billa Wien 3",            chain: "Billa",  city: "Wien",        region: "Ost",  address: "Landstr. Hauptstr. 44, 1030 Wien",        gm: "Anna Fuchs",     finished: true  },
  { id: "m16", name: "Spar St. Pölten",         chain: "Spar",   city: "St. Pölten",  region: "Ost",  address: "Rathausplatz 8, 3100 St. Pölten",         gm: "Anna Fuchs",     finished: true  },
  // Extra markets available to assign
  { id: "m17", name: "Billa Salzburg Mitte",    chain: "Billa",  city: "Salzburg",    region: "West", address: "Getreidegasse 10, 5020 Salzburg",         gm: "Michael Huber",  finished: false },
  { id: "m18", name: "Merkur Villach",          chain: "Merkur", city: "Villach",     region: "Süd",  address: "Hans-Gasser-Platz 3, 9500 Villach",       gm: "Anna Gruber",    finished: false },
  { id: "m19", name: "Spar Innsbruck Ost",      chain: "Spar",   city: "Innsbruck",   region: "Nord", address: "Pradler Str. 66, 6020 Innsbruck",         gm: "Klaus Berger",   finished: false },
  { id: "m20", name: "Billa Bregenz",           chain: "Billa",  city: "Bregenz",     region: "Nord", address: "Kirchstr. 19, 6900 Bregenz",              gm: "Klaus Berger",   finished: false },
  { id: "m21", name: "Spar Steyr",              chain: "Spar",   city: "Steyr",       region: "West", address: "Stadtplatz 14, 4400 Steyr",               gm: "Michael Huber",  finished: false },
  { id: "m22", name: "Billa Eisenstadt",        chain: "Billa",  city: "Eisenstadt",  region: "Ost",  address: "Domplatz 11, 7000 Eisenstadt",            gm: "Anna Fuchs",     finished: false },
  { id: "m23", name: "Merkur Linz Mitte",       chain: "Merkur", city: "Linz",        region: "West", address: "Herrenstr. 9, 4020 Linz",                 gm: "Michael Huber",  finished: false },
  { id: "m24", name: "Spar Wien Mitte",         chain: "Spar",   city: "Wien",        region: "Ost",  address: "Landstr. Hauptstr. 1b, 1030 Wien",        gm: "Thomas Huber",   finished: false },
];

function applyMarketFilters(
  markets: MarketCatalogItem[],
  search: string,
  filters: MarketListFilters,
): MarketCatalogItem[] {
  let r = markets;
  const q = search.trim().toLowerCase();
  if (q) r = r.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.address.toLowerCase().includes(q) ||
    (m.stammnr ?? "").toLowerCase().includes(q) ||
    m.gm.toLowerCase().includes(q) ||
    m.city.toLowerCase().includes(q) ||
    m.chain.toLowerCase().includes(q)
  );
  if (filters.chain)  r = r.filter(m => m.chain  === filters.chain);
  if (filters.gm)     r = r.filter(m => m.gm     === filters.gm);
  if (filters.city)   r = r.filter(m => m.city   === filters.city);
  if (filters.region) r = r.filter(m => m.region === filters.region);
  return r;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getVisitDetailKey(campaignId: string, marketId: string, sessionId: string | null | undefined): string {
  return `${campaignId}:${marketId}:${sessionId ?? "latest"}`;
}

function getMarketDisplayName(input: {
  name?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string {
  const name = input.name?.trim();
  if (name) return name;
  const address = input.address?.trim() ?? "";
  const place = [input.postalCode?.trim(), input.city?.trim()].filter(Boolean).join(" ");
  const fallback = [address, place].filter(Boolean).join(", ");
  return fallback || "Unbenannter Markt";
}

function getGmDisplayName(gm: Pick<GMRecord, "firstName" | "lastName" | "email">): string {
  const name = `${gm.firstName ?? ""} ${gm.lastName ?? ""}`.trim();
  return name || gm.email;
}

function getCampaignGmReassignGroups(campaign: Campaign | null, gmUsers: GMRecord[]): CampaignGmReassignGroup[] {
  if (!campaign) return [];
  const gmNameById = new Map(gmUsers.map((gm) => [gm.id, getGmDisplayName(gm)]));
  const groups = new Map<
    string,
    {
      gmUserId: string;
      gmName: string;
      marketIds: Set<string>;
      visitTargetCount: number;
      completedCount: number;
    }
  >();

  for (const assignment of campaign.assignments ?? []) {
    if (!assignment.gmUserId) continue;
    const current = groups.get(assignment.gmUserId) ?? {
      gmUserId: assignment.gmUserId,
      gmName: gmNameById.get(assignment.gmUserId) ?? assignment.gmName ?? "Unbekannter GM",
      marketIds: new Set<string>(),
      visitTargetCount: 0,
      completedCount: 0,
    };
    current.marketIds.add(assignment.marketId);
    current.visitTargetCount += Math.max(1, Number(assignment.visitTargetCount ?? 1));
    current.completedCount += Math.max(0, Number(assignment.currentVisitsCount ?? 0));
    groups.set(assignment.gmUserId, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      gmUserId: group.gmUserId,
      gmName: group.gmName,
      marketCount: group.marketIds.size,
      visitTargetCount: group.visitTargetCount,
      completedCount: group.completedCount,
    }))
    .sort((a, b) => a.gmName.localeCompare(b.gmName, "de"));
}

// Keep a thin alias so MOCK_MARKET_META still resolves cleanly
const MOCK_MARKETS = MARKET_CATALOG;

// ── Fragebogen Vorschau ──────────────────────────────────────

interface PreviewQuestion {
  id: string;
  type: "yesno" | "single" | "multiple" | "yesnomulti" | "text" | "numeric" | "likert" | "slider" | "photo" | "matrix";
  text: string;
  options?: string[];
  required: boolean;
  moduleId: string;
  moduleName: string;
  imageUrl?: string;
  config?: {
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    step?: number;
    unit?: string;
    decimals?: boolean;
    instruction?: string;
    rows?: string[];
    columns?: string[];
    answers?: string[];
    branches?: { answer: string; options: string[] }[];
    matrixSubtype?: string;
  };
  rules?: ConditionalRule[];
}

type FragebogenScopeKey = "main" | "kuehler" | "mhd";

function sectionToScope(section: CampaignSection): FragebogenScopeKey {
  if (section === "kuehler") return "kuehler";
  if (section === "mhd") return "mhd";
  return "main";
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === "string");
  return items.length > 0 ? items : undefined;
}

function toPreviewQuestion(question: Question, moduleId: string, moduleName: string): PreviewQuestion {
  const config = question.config ?? {};
  const numericValue = (raw: unknown) => (typeof raw === "number" ? raw : undefined);
  const stringValue = (raw: unknown) => (typeof raw === "string" ? raw : undefined);
  const branchesRaw = Array.isArray(config.branches) ? config.branches : [];
  const branches = branchesRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const answer = typeof value.answer === "string" ? value.answer : "";
      const options = getStringArray(value.options) ?? [];
      if (!answer) return null;
      return { answer, options };
    })
    .filter((entry): entry is { answer: string; options: string[] } => Boolean(entry));

  return {
    id: question.id,
    type: question.type,
    text: question.text,
    options: getStringArray(config.options),
    required: question.required,
    moduleId,
    moduleName,
    imageUrl: stringValue(config.imageUrl),
    rules: question.rules ?? [],
    config: {
      min: numericValue(config.min),
      max: numericValue(config.max),
      minLabel: stringValue(config.minLabel),
      maxLabel: stringValue(config.maxLabel),
      step: numericValue(config.step),
      unit: stringValue(config.unit),
      decimals: typeof config.decimals === "boolean" ? config.decimals : undefined,
      instruction: stringValue(config.instruction),
      rows: getStringArray(config.rows),
      columns: getStringArray(config.columns),
      answers: getStringArray(config.answers),
      branches: branches.length > 0 ? branches : undefined,
      matrixSubtype: stringValue(config.matrixSubtype),
    },
  };
}

const PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "pq1", type: "yesno",
    text: "Sind alle Coke-Produkte sichtbar und frontal platziert?",
    required: true, moduleId: "pm1", moduleName: "Regalprüfung",
    imageUrl: "https://picsum.photos/seed/cokeregal/480/320",
  },
  {
    id: "pq2", type: "single",
    text: "Wie ist der allgemeine Zustand der Regalfläche?",
    options: ["Sehr gut", "Gut", "Befriedigend", "Verbesserungswürdig"],
    required: true, moduleId: "pm1", moduleName: "Regalprüfung",
  },
  {
    id: "pq3", type: "multiple",
    text: "Welche Aktionsmaterialien sind aktuell vorhanden?",
    options: ["Aufsteller", "Deckenanhänger", "Regalblende", "Preisschild", "Plakat"],
    required: false, moduleId: "pm2", moduleName: "Aktionsmaterial",
  },
  {
    id: "pq4", type: "yesnomulti",
    text: "Ist das Display korrekt bestückt?",
    required: true, moduleId: "pm2", moduleName: "Aktionsmaterial",
    config: {
      answers: ["Ja", "Nein"],
      branches: [
        { answer: "Ja", options: ["Produkt A vollständig", "Produkt B vollständig", "Etiketten korrekt", "Mengen stimmen", "Preisschilder vorhanden"] },
        { answer: "Nein", options: ["Ware fehlt komplett", "Falsche Produkte", "Display defekt", "Preisschilder fehlen", "Etiketten unleserlich"] },
      ],
    },
  },
  {
    id: "pq5", type: "likert",
    text: "Wie zufrieden bist du mit der Platzierung?",
    required: false, moduleId: "pm3", moduleName: "Kundenerlebnis",
    config: { min: 1, max: 5, minLabel: "Sehr unzufrieden", maxLabel: "Sehr zufrieden" },
  },
  {
    id: "pq6", type: "text",
    text: "Gibt es besondere Auffälligkeiten oder Anmerkungen?",
    required: false, moduleId: "pm3", moduleName: "Kundenerlebnis",
  },
  {
    id: "pq7", type: "numeric",
    text: "Wie viele Facings hat das Coke-Produkt im Hauptregal?",
    required: true, moduleId: "pm4", moduleName: "Bestandserfassung",
    config: { min: 0, max: 100, decimals: false },
  },
  {
    id: "pq8", type: "slider",
    text: "Geschätzter Lagerbestand in Prozent?",
    required: false, moduleId: "pm4", moduleName: "Bestandserfassung",
    config: { min: 0, max: 100, step: 5, unit: "%" },
  },
  {
    id: "pq9", type: "photo",
    text: "Mache ein Foto des Hauptregals.",
    required: false, moduleId: "pm5", moduleName: "Dokumentation",
    config: { instruction: "Bitte das gesamte Coke-Regal fotografieren." },
  },
  {
    id: "pq10", type: "matrix",
    text: "Bewerte folgende Aspekte des Marktauftritts.",
    required: false, moduleId: "pm5", moduleName: "Dokumentation",
    config: {
      rows: ["Regalordnung", "Preisgestaltung", "Sauberkeit"],
      columns: ["Gut", "Mittel", "Schlecht"],
    },
  },
];

const FLEX_PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "fq1", type: "yesno",
    text: "Wurde die vereinbarte Zweitplatzierung umgesetzt?",
    required: true, moduleId: "fm1", moduleName: "Platzierung",
  },
  {
    id: "fq2", type: "single",
    text: "Wo befindet sich die Zweitplatzierung?",
    options: ["Kassenzone", "Gangende", "Eingangsbereich", "Sonderaufbau", "Kühlregal"],
    required: true, moduleId: "fm1", moduleName: "Platzierung",
  },
  {
    id: "fq3", type: "multiple",
    text: "Welche Produkte sind in der Zweitplatzierung enthalten?",
    options: ["Coca-Cola Classic", "Coca-Cola Zero", "Fanta", "Sprite", "Mezzo Mix", "Fuze Tea"],
    required: true, moduleId: "fm2", moduleName: "Sortiment",
  },
  {
    id: "fq4", type: "yesnomulti",
    text: "Ist die Aktion korrekt umgesetzt?",
    required: true, moduleId: "fm2", moduleName: "Sortiment",
    config: {
      answers: ["Ja", "Nein"],
      branches: [
        { answer: "Ja", options: ["Preise korrekt", "Beschilderung vorhanden", "Ware vollständig", "Display ordentlich"] },
        { answer: "Nein", options: ["Preise falsch", "Beschilderung fehlt", "Ware unvollständig", "Display beschädigt", "Falscher Standort"] },
      ],
    },
  },
  {
    id: "fq5", type: "likert",
    text: "Wie prominent ist die Platzierung im Markt?",
    required: false, moduleId: "fm3", moduleName: "Bewertung",
    config: { min: 1, max: 5, minLabel: "Kaum sichtbar", maxLabel: "Sehr prominent" },
  },
  {
    id: "fq6", type: "text",
    text: "Anmerkungen zur Flexbesuch-Aktion?",
    required: false, moduleId: "fm3", moduleName: "Bewertung",
  },
  {
    id: "fq7", type: "numeric",
    text: "Wie viele Kartons sind noch auf der Zweitplatzierung?",
    required: true, moduleId: "fm4", moduleName: "Bestand",
    config: { min: 0, max: 50, decimals: false },
  },
  {
    id: "fq8", type: "slider",
    text: "Geschätzter Füllstand der Zweitplatzierung?",
    required: false, moduleId: "fm4", moduleName: "Bestand",
    config: { min: 0, max: 100, step: 10, unit: "%" },
  },
  {
    id: "fq9", type: "photo",
    text: "Fotografiere die Zweitplatzierung.",
    required: false, moduleId: "fm5", moduleName: "Dokumentation",
    config: { instruction: "Bitte die gesamte Zweitplatzierung inklusive Preisschild fotografieren." },
  },
  {
    id: "fq10", type: "matrix",
    text: "Bewerte die Umsetzung der Flexbesuch-Aktion.",
    required: false, moduleId: "fm5", moduleName: "Dokumentation",
    config: {
      rows: ["Platzierung", "Beschilderung", "Warenbestand", "Sauberkeit"],
      columns: ["Gut", "Mittel", "Schlecht"],
    },
  },
];

const KUEHLER_PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "kpq1", type: "single",
    text: "Wie ist der Kühler aktuell befüllt?",
    options: ["Sehr voll", "Halb voll", "Nicht voll"],
    required: true, moduleId: "k-m1", moduleName: "Befüllung",
    imageUrl: "https://picsum.photos/seed/kuehler/400/280",
  },
  {
    id: "kpq2", type: "yesno",
    text: "Sind alle Produkte im Kühler frontal und sichtbar platziert?",
    required: true, moduleId: "k-m1", moduleName: "Befüllung",
  },
  {
    id: "kpq3", type: "yesno",
    text: "Funktioniert die Kühlung einwandfrei (Temperatur OK)?",
    required: true, moduleId: "k-m2", moduleName: "Technik & Hygiene",
  },
  {
    id: "kpq4", type: "single",
    text: "Wie ist der Hygienezustand des Kühlers?",
    options: ["Sauber", "Leicht verschmutzt", "Stark verschmutzt"],
    required: true, moduleId: "k-m2", moduleName: "Technik & Hygiene",
    imageUrl: "https://picsum.photos/seed/hygiene/260/380",
  },
  {
    id: "kpq5", type: "yesno",
    text: "Sind Preisschilder im Kühler korrekt angebracht?",
    required: false, moduleId: "k-m3", moduleName: "Kennzeichnung",
  },
  {
    id: "kpq6", type: "yesno",
    text: "Ist das Coke-Branding im Kühler sichtbar und unversehrt?",
    required: false, moduleId: "k-m3", moduleName: "Kennzeichnung",
  },
];

// ── Kühler Mini components (independent, orange-themed) ──────

function KuehlerMiniQuestionCard({ question, answer, onAnswer, direction, animKey }: {
  question: PreviewQuestion;
  answer: string | string[] | undefined;
  onAnswer: (val: string | string[]) => void;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const C1 = "#F59E0B";
  const C2 = "#d97706";

  const fillColors: Record<string, { dot: string; bg: string; border: string; text: string }> = {
    "Sehr voll":  { dot: "#22c55e", bg: "rgba(34,197,94,0.07)",  border: "rgba(34,197,94,0.3)",  text: "#15803d" },
    "Halb voll":  { dot: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.3)", text: "#92400e" },
    "Nicht voll": { dot: "#DC2626", bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.3)",  text: "#b91c1c" },
  };
  const defaultOptColor = { dot: C2, bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.25)", text: C2 };

  return (
    <div key={animKey} style={{ animation: `kQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <style>{`@keyframes kQIn{from{opacity:0;transform:translateX(${fromX}px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: C1, marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 4 }}>
          {[{ label: "Ja", val: "ja" }, { label: "Nein", val: "nein" }].map(({ label, val }) => {
            const sel = answer === val;
            return (
              <button key={val} onClick={() => onAnswer(val)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 600, transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                background: sel ? "rgba(217,119,6,0.08)" : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.5)",
                boxShadow: sel ? "inset 0 0 0 1px rgba(217,119,6,0.3)" : "none",
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = answer === opt;
            const oc = fillColors[opt] ?? defaultOptColor;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? oc.bg : "rgba(0,0,0,0.03)",
                color: sel ? oc.text : "rgba(0,0,0,0.6)",
                boxShadow: sel ? `inset 0 0 0 1px ${oc.border}` : "none",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: oc.dot, opacity: sel ? 1 : 0.4,
                }} />
                {opt}
                {sel && <Check size={5} strokeWidth={3} color={oc.dot} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── KuehlerFragebogenVorschau (independent, orange-themed) ───

function KuehlerFragebogenVorschau({ questions = KUEHLER_PREVIEW_QUESTIONS, showHeatmap = false }: { questions?: PreviewQuestion[]; showHeatmap?: boolean }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState("k0-init");

  const C1 = "#F59E0B";
  const C2 = "#d97706";
  const auroraColors = ["#FEF3C7", "#F59E0B", "#FEF3C7"];

  const currentQ = questions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;

  const goNext = () => {
    if (currentQIndex < questions.length - 1) {
      setDirection("forward");
      setAnimKey(`k${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    if (currentQIndex > 0) {
      setDirection("backward");
      setAnimKey(`k${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  return (
    <div style={{
      flex: 1, minHeight: 380, borderRadius: 12, overflow: "hidden",
      position: "relative", backgroundColor: "#f5f5f7",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
      }}>
        <Aurora colorStops={auroraColors} blend={0.6} amplitude={0.75} speed={0.3} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "10px 10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={8} strokeWidth={1.8} color="rgba(217,119,6,0.5)" />
          <span style={{ fontSize: 7, fontWeight: 600, color: "rgba(217,119,6,0.7)", whiteSpace: "nowrap" }}>Kühlerinventur</span>
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 10, display: "flex", alignItems: "center" }}>
            {(() => {
              const n = questions.length;
              const lastIdx = questions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(217,119,6,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = allAnswered ? `linear-gradient(to right, ${C2}, ${C1})` : `linear-gradient(to right, ${C2}, ${C1})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {questions.map((q, i) => {
                    const done = answers[q.id] !== undefined;
                    const cur = i === currentQIndex;
                    const lp = n === 1 ? 50 : (i / (n - 1)) * 100;
                    const bg = allAnswered ? C2 : done ? C2 : cur ? "#fbbf24" : "rgba(217,119,6,0.18)";
                    const sz = cur && !done ? 5 : 4;
                    return <div key={q.id} style={{
                      position: "absolute", left: `${lp}%`, transform: "translateX(-50%)",
                      width: sz, height: sz, borderRadius: "50%", backgroundColor: bg,
                      transition: "all 0.3s ease", zIndex: 1,
                      boxShadow: cur ? "0 0 0 1.5px rgba(217,119,6,0.18)" : "none",
                    }} />;
                  })}
                </>
              );
            })()}
          </div>
          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(217,119,6,0.5)", whiteSpace: "nowrap" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 1, padding: "0 10px 8px",
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto", scrollbarWidth: "none",
      }}>
        <style>{`.fbm-vorschau::-webkit-scrollbar{display:none}`}</style>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.9)",
          padding: "8px 8px 7px", boxShadow: "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(217,119,6,0.4)" }}>
              {currentQ.type === "yesno" ? "Ja / Nein" : "Auswahl"}
            </div>
            <span style={{ fontSize: 6, color: "rgba(0,0,0,0.25)" }}>
              {currentQIndex + 1}/{questions.length}
            </span>
          </div>
          {showHeatmap ? (
            <HeatmapQuestionCard
              question={currentQ}
              data={MOCK_AGGREGATE_KUEHLER[currentQ.id]}
              accentColor={C1}
              direction={direction}
              animKey={animKey + "-hm"}
            />
          ) : (
            <KuehlerMiniQuestionCard
              question={currentQ}
              answer={currentAnswer}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
              direction={direction}
              animKey={animKey}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button onClick={goBack} disabled={currentQIndex === 0} style={{
            padding: "5px 8px", borderRadius: 5, border: "none",
            cursor: currentQIndex === 0 ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 600,
            color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)",
            background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
            boxShadow: currentQIndex === 0 ? "none" : "0 1px 3px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
          }}>
            <ChevronLeft size={8} strokeWidth={2} />
            Zurück
          </button>
          <button onClick={goNext} disabled={!showHeatmap && !!(currentQ.required && !currentAnswer)} style={{
            flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
            cursor: (!showHeatmap && currentQ.required && !currentAnswer) ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 700,
            color: (!showHeatmap && currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff",
            background: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "rgba(0,0,0,0.05)"
              : `linear-gradient(to bottom, ${C1}, ${C2})`,
            boxShadow: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "none"
              : `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px #b45309, 0 1px 4px rgba(180,100,0,0.18)`,
            transition: "all 0.18s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            {currentQIndex < questions.length - 1 ? "Weiter" : "Abschließen"}
            <ChevronRight size={8} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MHD data + independent components (purple-themed) ────────

const MHD_PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "mpq1", type: "yesno",
    text: "Sind alle MHD-Etiketten korrekt angebracht und lesbar?",
    required: true, moduleId: "mhd-m1", moduleName: "Etikettierung",
  },
  {
    id: "mpq2", type: "single",
    text: "Wie viele Produkte sind innerhalb von 3 Tagen ablaufend?",
    options: ["Keine", "1–3 Produkte", "4–10 Produkte", "Mehr als 10"],
    required: true, moduleId: "mhd-m1", moduleName: "Etikettierung",
    imageUrl: "https://picsum.photos/seed/mhdlabel/480/270",
  },
  {
    id: "mpq3", type: "yesno",
    text: "Wurden abgelaufene Produkte aus dem Regal entfernt?",
    required: true, moduleId: "mhd-m1", moduleName: "Etikettierung",
  },
  {
    id: "mpq4", type: "single",
    text: "Welche Produktkategorie hat die meisten nahenden Ablaufdaten?",
    options: ["Softdrinks", "Säfte", "Energy Drinks", "Wasser", "Keine"],
    required: false, moduleId: "mhd-m2", moduleName: "Risikoanalyse",
  },
  {
    id: "mpq5", type: "yesno",
    text: "Wurde der Marktleiter über kritische MHD-Fälle informiert?",
    required: true, moduleId: "mhd-m2", moduleName: "Risikoanalyse",
  },
  {
    id: "mpq6", type: "yesno",
    text: "Sind FIFO-Regeln (First In, First Out) eingehalten?",
    required: true, moduleId: "mhd-m3", moduleName: "Lagerhaltung",
    imageUrl: "https://picsum.photos/seed/fifo/320/420",
  },
  {
    id: "mpq7", type: "single",
    text: "Wie ist der allgemeine Zustand der MHD-Kontrolle in diesem Markt?",
    options: ["Sehr gut", "Gut", "Verbesserungswürdig", "Kritisch"],
    required: true, moduleId: "mhd-m3", moduleName: "Lagerhaltung",
  },
];

function MhdMiniQuestionCard({ question, answer, onAnswer, direction, animKey }: {
  question: PreviewQuestion;
  answer: string | string[] | undefined;
  onAnswer: (val: string | string[]) => void;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const C1 = "#8b5cf6";
  const C2 = "#7C3AED";

  return (
    <div key={animKey} style={{ animation: `mQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <style>{`@keyframes mQIn{from{opacity:0;transform:translateX(${fromX}px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: C2, marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 4 }}>
          {[{ label: "Ja", val: "ja" }, { label: "Nein", val: "nein" }].map(({ label, val }) => {
            const sel = answer === val;
            return (
              <button key={val} onClick={() => onAnswer(val)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 600, transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                background: sel ? "rgba(124,58,237,0.08)" : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.5)",
                boxShadow: sel ? "inset 0 0 0 1px rgba(124,58,237,0.3)" : "none",
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? "rgba(124,58,237,0.07)" : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.6)",
                boxShadow: sel ? "inset 0 0 0 1px rgba(124,58,237,0.25)" : "none",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: C2, opacity: sel ? 1 : 0.25,
                }} />
                {opt}
                {sel && <Check size={5} strokeWidth={3} color={C2} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MhdFragebogenVorschau({ questions = MHD_PREVIEW_QUESTIONS, showHeatmap = false }: { questions?: PreviewQuestion[]; showHeatmap?: boolean }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState("m0-init");

  const C1 = "#8b5cf6";
  const C2 = "#7C3AED";
  const C3 = "#6d28d9";
  const auroraColors = ["#EDE9FE", "#7C3AED", "#EDE9FE"];

  const currentQ = questions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;

  const goNext = () => {
    if (currentQIndex < questions.length - 1) {
      setDirection("forward");
      setAnimKey(`m${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    if (currentQIndex > 0) {
      setDirection("backward");
      setAnimKey(`m${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  return (
    <div style={{
      flex: 1, minHeight: 380, borderRadius: 12, overflow: "hidden",
      position: "relative", backgroundColor: "#f5f5f7",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
      }}>
        <Aurora colorStops={auroraColors} blend={0.6} amplitude={0.75} speed={0.3} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "10px 10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={8} strokeWidth={1.8} color="rgba(124,58,237,0.5)" />
          <span style={{ fontSize: 7, fontWeight: 600, color: "rgba(124,58,237,0.7)", whiteSpace: "nowrap" }}>MHD-Prüfung</span>
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 10, display: "flex", alignItems: "center" }}>
            {(() => {
              const n = questions.length;
              const lastIdx = questions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(124,58,237,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = `linear-gradient(to right, ${C2}, ${C1})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {questions.map((q, i) => {
                    const done = answers[q.id] !== undefined;
                    const cur = i === currentQIndex;
                    const lp = n === 1 ? 50 : (i / (n - 1)) * 100;
                    const bg = allAnswered ? C2 : done ? C2 : cur ? "#a78bfa" : "rgba(124,58,237,0.18)";
                    const sz = cur && !done ? 5 : 4;
                    return <div key={q.id} style={{
                      position: "absolute", left: `${lp}%`, transform: "translateX(-50%)",
                      width: sz, height: sz, borderRadius: "50%", backgroundColor: bg,
                      transition: "all 0.3s ease", zIndex: 1,
                      boxShadow: cur ? "0 0 0 1.5px rgba(124,58,237,0.18)" : "none",
                    }} />;
                  })}
                </>
              );
            })()}
          </div>
          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(124,58,237,0.5)", whiteSpace: "nowrap" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 1, padding: "0 10px 8px",
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto", scrollbarWidth: "none",
      }}>
        <style>{`.fbm-vorschau::-webkit-scrollbar{display:none}`}</style>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.9)",
          padding: "8px 8px 7px", boxShadow: "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(124,58,237,0.4)" }}>
              {currentQ.type === "yesno" ? "Ja / Nein" : "Auswahl"}
            </div>
            <span style={{ fontSize: 6, color: "rgba(0,0,0,0.25)" }}>
              {currentQIndex + 1}/{questions.length}
            </span>
          </div>
          {showHeatmap ? (
            <HeatmapQuestionCard
              question={currentQ}
              data={MOCK_AGGREGATE_MHD[currentQ.id]}
              accentColor={C1}
              direction={direction}
              animKey={animKey + "-hm"}
            />
          ) : (
            <MhdMiniQuestionCard
              question={currentQ}
              answer={currentAnswer}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
              direction={direction}
              animKey={animKey}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button onClick={goBack} disabled={currentQIndex === 0} style={{
            padding: "5px 8px", borderRadius: 5, border: "none",
            cursor: currentQIndex === 0 ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 600,
            color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)",
            background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
            boxShadow: currentQIndex === 0 ? "none" : "0 1px 3px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
          }}>
            <ChevronLeft size={8} strokeWidth={2} />
            Zurück
          </button>
          <button onClick={goNext} disabled={!showHeatmap && !!(currentQ.required && !currentAnswer)} style={{
            flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
            cursor: (!showHeatmap && currentQ.required && !currentAnswer) ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 700,
            color: (!showHeatmap && currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff",
            background: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "rgba(0,0,0,0.05)"
              : `linear-gradient(to bottom, ${C1}, ${C2})`,
            boxShadow: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "none"
              : `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${C3}, 0 1px 4px rgba(109,40,217,0.2)`,
            transition: "all 0.18s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            {currentQIndex < questions.length - 1 ? "Weiter" : "Abschließen"}
            <ChevronRight size={8} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Billa data + independent components (teal-themed) ────────

const BILLA_PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "bpq1", type: "yesno",
    text: "Ist die Billa-Aktionsfläche für die Frühjahrsaktion eingerichtet?",
    required: true, moduleId: "b-m1", moduleName: "Aktionsfläche",
  },
  {
    id: "bpq2", type: "single",
    text: "Wo befindet sich der Aktionsaufbau im Markt?",
    options: ["Eingang", "Kassenzone", "Getränkeabteilung", "Sonderplatzierung", "Kühlregal"],
    required: true, moduleId: "b-m1", moduleName: "Aktionsfläche",
  },
  {
    id: "bpq3", type: "multiple",
    text: "Welche Aktionsprodukte sind vorhanden?",
    options: ["Coca-Cola 1.5L", "Coca-Cola Zero 1L", "Fanta 1.5L", "Sprite 1L", "Mezzo Mix 1.5L", "Römerquelle"],
    required: true, moduleId: "b-m2", moduleName: "Sortiment",
  },
  {
    id: "bpq4", type: "yesno",
    text: "Sind die Aktionspreise korrekt ausgezeichnet?",
    required: true, moduleId: "b-m2", moduleName: "Sortiment",
  },
  {
    id: "bpq5", type: "single",
    text: "Wie ist der Füllstand der Aktionsfläche?",
    options: ["Voll bestückt", "Teilweise bestückt", "Fast leer", "Leer"],
    required: true, moduleId: "b-m3", moduleName: "Bestand",
  },
  {
    id: "bpq6", type: "yesno",
    text: "Ist das POS-Material (Poster, Wobbler, Preisschilder) vorhanden?",
    required: false, moduleId: "b-m3", moduleName: "Bestand",
  },
  {
    id: "bpq7", type: "photo",
    text: "Fotografiere die Billa-Aktionsfläche.",
    required: false, moduleId: "b-m4", moduleName: "Dokumentation",
    config: { instruction: "Bitte die gesamte Aktionsfläche inkl. Preisbeschilderung fotografieren." },
  },
  {
    id: "bpq8", type: "text",
    text: "Anmerkungen zur Billa Frühjahrsaktion?",
    required: false, moduleId: "b-m4", moduleName: "Dokumentation",
  },
];

function BillaMiniQuestionCard({ question, answer, onAnswer, direction, animKey }: {
  question: PreviewQuestion;
  answer: string | string[] | undefined;
  onAnswer: (val: string | string[]) => void;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const cfg = question.config;
  const multiAnswers: string[] = Array.isArray(answer) ? answer : [];
  const toggleMulti = (opt: string) => {
    const next = multiAnswers.includes(opt) ? multiAnswers.filter((x) => x !== opt) : [...multiAnswers, opt];
    onAnswer(next);
  };
  const [textVal, setTextVal] = useState<string>(() => typeof answer === "string" ? answer : "");

  const C1 = "#06b6d4";
  const C2 = "#0891B2";
  const selBg = "rgba(8,145,178,0.08)";
  const selBorder = "rgba(8,145,178,0.3)";

  return (
    <div key={animKey} style={{ animation: `bQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <style>{`@keyframes bQIn{from{opacity:0;transform:translateX(${fromX}px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: C2, marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 4 }}>
          {["Ja", "Nein"].map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 700, letterSpacing: "0.01em",
                transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                background: sel ? `linear-gradient(to bottom, ${C1}, ${C2})` : "rgba(0,0,0,0.04)",
                color: sel ? "#fff" : "rgba(0,0,0,0.45)",
                boxShadow: sel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${C2}, 0 1px 5px rgba(8,145,178,0.22)` : "none",
              }}>{opt}</button>
            );
          })}
        </div>
      )}

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? selBg : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.6)",
                boxShadow: sel ? `inset 0 0 0 1px ${selBorder}` : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? C1 : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "multiple" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = multiAnswers.includes(opt);
            return (
              <button key={opt} onClick={() => toggleMulti(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? selBg : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.6)",
                boxShadow: sel ? `inset 0 0 0 1px ${selBorder}` : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? C1 : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "text" && (
        <textarea
          value={textVal}
          onChange={(e) => { setTextVal(e.target.value); onAnswer(e.target.value); }}
          placeholder="Antwort eingeben…"
          rows={2}
          style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 7.5,
            color: "#1a1a1a", resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.4,
          }}
        />
      )}

      {question.type === "photo" && (() => {
        const photos = Array.isArray(answer) ? (answer as string[]) : [];
        return (
          <div>
            {cfg?.instruction && <p style={{ fontSize: 7, color: "rgba(0,0,0,0.45)", fontStyle: "italic", margin: "0 0 5px" }}>{cfg.instruction}</p>}
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "8px 6px", borderRadius: 5, border: "1.5px dashed rgba(0,0,0,0.13)",
              background: "rgba(0,0,0,0.02)", cursor: "pointer",
              fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.4)",
            }}>
              <Camera size={10} strokeWidth={1.8} />
              {photos.length > 0 ? `${photos.length} Foto(s)` : "Foto auswählen"}
              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  Promise.all(files.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })))
                    .then((urls) => onAnswer([...photos, ...urls]));
                }}
              />
            </label>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function BillaFragebogenVorschau({ questions = BILLA_PREVIEW_QUESTIONS, showHeatmap = false }: { questions?: PreviewQuestion[]; showHeatmap?: boolean }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState("b0-init");

  const C1 = "#06b6d4";
  const C2 = "#0891B2";
  const C3 = "#0e7490";
  const auroraColors = ["#CFFAFE", "#06b6d4", "#CFFAFE"];

  const currentQ = questions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;

  const goNext = () => {
    if (currentQIndex < questions.length - 1) {
      setDirection("forward");
      setAnimKey(`b${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    if (currentQIndex > 0) {
      setDirection("backward");
      setAnimKey(`b${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  return (
    <div style={{
      flex: 1, minHeight: 380, borderRadius: 12, overflow: "hidden",
      position: "relative", backgroundColor: "#f5f5f7",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
      }}>
        <Aurora colorStops={auroraColors} blend={0.6} amplitude={0.75} speed={0.3} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "10px 10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={8} strokeWidth={1.8} color="rgba(8,145,178,0.5)" />
          <span style={{ fontSize: 7, fontWeight: 600, color: "rgba(8,145,178,0.7)", whiteSpace: "nowrap" }}>Billa Fragebogen</span>
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 10, display: "flex", alignItems: "center" }}>
            {(() => {
              const n = questions.length;
              const lastIdx = questions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(8,145,178,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = `linear-gradient(to right, ${C2}, ${C1})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {questions.map((q, i) => {
                    const done = answers[q.id] !== undefined;
                    const cur = i === currentQIndex;
                    const lp = n === 1 ? 50 : (i / (n - 1)) * 100;
                    const bg = allAnswered ? C2 : done ? C2 : cur ? `${C1}73` : "rgba(8,145,178,0.18)";
                    const sz = cur && !done ? 5 : 4;
                    return <div key={q.id} style={{
                      position: "absolute", left: `${lp}%`, transform: "translateX(-50%)",
                      width: sz, height: sz, borderRadius: "50%", backgroundColor: bg,
                      transition: "all 0.3s ease", zIndex: 1,
                      boxShadow: cur ? "0 0 0 1.5px rgba(8,145,178,0.18)" : "none",
                    }} />;
                  })}
                </>
              );
            })()}
          </div>
          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(8,145,178,0.5)", whiteSpace: "nowrap" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 1, padding: "0 10px 8px",
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto", scrollbarWidth: "none",
      }}>
        <style>{`.fbm-vorschau::-webkit-scrollbar{display:none}`}</style>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.9)",
          padding: "8px 8px 7px", boxShadow: "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)", marginBottom: 5 }}>
            Frage {currentQIndex + 1} von {questions.length}
          </div>
          {showHeatmap ? (
            <HeatmapQuestionCard
              question={currentQ}
              data={MOCK_AGGREGATE_BILLA[currentQ.id]}
              accentColor={C1}
              direction={direction}
              animKey={animKey + "-hm"}
            />
          ) : (
            <BillaMiniQuestionCard
              question={currentQ}
              answer={currentAnswer}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
              direction={direction}
              animKey={animKey}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button onClick={goBack} disabled={currentQIndex === 0} style={{
            padding: "5px 8px", borderRadius: 5, border: "none",
            cursor: currentQIndex === 0 ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 600,
            color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)",
            background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
            boxShadow: currentQIndex === 0 ? "none" : "0 1px 3px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
          }}>
            <ChevronLeft size={8} strokeWidth={2} />
            Zurück
          </button>
          <button onClick={goNext} disabled={!showHeatmap && !!(currentQ.required && !currentAnswer)} style={{
            flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
            cursor: (!showHeatmap && currentQ.required && !currentAnswer) ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 700,
            color: (!showHeatmap && currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff",
            background: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "rgba(0,0,0,0.05)"
              : `linear-gradient(to bottom, ${C1}, ${C2})`,
            boxShadow: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "none"
              : `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${C3}, 0 1px 4px rgba(14,116,144,0.2)`,
            transition: "all 0.18s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            {currentQIndex < questions.length - 1 ? "Weiter" : "Abschließen"}
            <ChevronRight size={8} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini components for Vorschau ─────────────────────────────

function MiniQuestionImage({ url }: { url: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: 120,
          borderRadius: 7,
          objectFit: "cover",
          display: "block",
          boxShadow: "0 1px 8px rgba(0,0,0,0.10), 0 0.5px 3px rgba(0,0,0,0.07)",
          border: "1px solid rgba(255,255,255,0.7)",
        }}
      />
    </div>
  );
}

function MiniMatrixInput({ rows, cols, answers, onToggle }: {
  rows: string[]; cols: string[]; answers: string[]; onToggle: (key: string) => void;
}) {
  return (
    <div style={{ margin: "0 -10px", overflowX: "auto" }}>
      <div style={{ minWidth: `${Math.max(200, cols.length * 40 + 80)}px`, padding: "0 10px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 70, padding: "3px 4px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "left" }} />
              {cols.map((col) => (
                <th key={col} style={{ padding: "3px 2px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.5)", textAlign: "center" }}>
                  <span style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td style={{ padding: "3px 4px", fontSize: 8.5, fontWeight: 500, color: "rgba(0,0,0,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 70 }}>{row}</td>
                {cols.map((col) => {
                  const cellKey = `${row}: ${col}`;
                  const sel = answers.includes(cellKey);
                  return (
                    <td key={col} style={{ textAlign: "center", padding: "1px 2px" }}>
                      <button
                        onClick={() => onToggle(cellKey)}
                        style={{
                          width: "100%", padding: "5px 0",
                          borderRadius: 5, border: "none", cursor: "pointer",
                          fontSize: 7.5, fontWeight: 600,
                          transition: "all 0.14s ease",
                          background: sel ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.03)",
                          color: sel ? "#DC2626" : "rgba(0,0,0,0.35)",
                          boxShadow: sel ? "inset 0 0 0 1px rgba(220,38,38,0.3)" : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                        }}
                      >
                        {sel ? "✓" : "○"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniQuestionCard({ question, answer, onAnswer, direction, animKey }: {
  question: PreviewQuestion;
  answer: string | string[] | undefined;
  onAnswer: (val: string | string[]) => void;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const cfg = question.config;
  const multiAnswers: string[] = Array.isArray(answer) ? answer : [];
  const toggleMulti = (opt: string) => {
    const next = multiAnswers.includes(opt)
      ? multiAnswers.filter((x) => x !== opt)
      : [...multiAnswers, opt];
    onAnswer(next);
  };

  const [sliderVal, setSliderVal] = useState<number>(() => {
    const v = Number(answer);
    return isNaN(v) ? (cfg?.min ?? 0) : v;
  });
  const [numInput, setNumInput] = useState<string>(() =>
    answer !== undefined && answer !== "" ? String(answer) : ""
  );
  const [textVal, setTextVal] = useState<string>(() =>
    typeof answer === "string" ? answer : ""
  );

  return (
    <div key={animKey} style={{ animation: `sQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <style>{`@keyframes sQIn{from{opacity:0;transform:translateX(${fromX}px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: "#DC2626", marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 4 }}>
          {["Ja", "Nein"].map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 700, letterSpacing: "0.01em",
                transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                background: sel ? "linear-gradient(to bottom, #DC2626, #b91c1c)" : "rgba(0,0,0,0.04)",
                color: sel ? "#fff" : "rgba(0,0,0,0.45)",
                boxShadow: sel ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.18)" : "none",
              }}>{opt}</button>
            );
          })}
        </div>
      )}

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.03)",
                color: sel ? "#DC2626" : "rgba(0,0,0,0.6)",
                boxShadow: sel ? "inset 0 0 0 1px rgba(220,38,38,0.25)" : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? "#DC2626" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "multiple" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = multiAnswers.includes(opt);
            return (
              <button key={opt} onClick={() => toggleMulti(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.03)",
                color: sel ? "#DC2626" : "rgba(0,0,0,0.6)",
                boxShadow: sel ? "inset 0 0 0 1px rgba(220,38,38,0.25)" : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? "#DC2626" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "yesnomulti" && (() => {
        let ynm: { sel: string | null; subs: string[] } = { sel: null, subs: [] };
        try { if (typeof answer === "string" && answer.startsWith("{")) ynm = JSON.parse(answer); } catch { /* ignore */ }
        const ynmSel = ynm.sel;
        const ynmSubs = ynm.subs;
        const topAnswers = cfg?.answers ?? ["Ja", "Nein"];
        const activeBranch = (cfg?.branches ?? []).find((b) => b.answer === ynmSel);
        const selectTop = (ans: string) => {
          onAnswer(JSON.stringify({ sel: ynmSel === ans ? null : ans, subs: [] }));
        };
        const toggleSub = (sub: string) => {
          const next = ynmSubs.includes(sub) ? ynmSubs.filter((x) => x !== sub) : [...ynmSubs, sub];
          onAnswer(JSON.stringify({ sel: ynmSel, subs: next }));
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {topAnswers.map((ans) => {
                const sel = ynmSel === ans;
                return (
                  <button key={ans} onClick={() => selectTop(ans)} style={{
                    flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 8, fontWeight: 700, transition: "all 0.16s ease",
                    background: sel ? "linear-gradient(to bottom, #DC2626, #b91c1c)" : "rgba(0,0,0,0.04)",
                    color: sel ? "#fff" : "rgba(0,0,0,0.45)",
                    boxShadow: sel ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 5px rgba(180,20,20,0.18)" : "none",
                  }}>{ans}</button>
                );
              })}
            </div>

            {ynmSel && activeBranch && activeBranch.options.length > 0 && (
              <div style={{ marginTop: 1, borderRadius: 5, background: "rgba(0,0,0,0.02)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "3px 6px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.35)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Optionen für &bdquo;{ynmSel}&ldquo;</span>
                  {ynmSubs.length > 0 && <span style={{ fontSize: 6, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.08)", borderRadius: 20, padding: "1px 4px" }}>{ynmSubs.length} gewählt</span>}
                </div>
                <div style={{ maxHeight: 100, overflowY: "auto", padding: "3px 4px", display: "flex", flexDirection: "column", gap: 1, scrollbarWidth: "none" }}>
                  {activeBranch.options.map((sub) => {
                    const subSel = ynmSubs.includes(sub);
                    return (
                      <button key={sub} onClick={() => toggleSub(sub)} style={{
                        padding: "3px 5px", borderRadius: 4, border: "none", cursor: "pointer",
                        fontSize: 7.5, fontWeight: 500, textAlign: "left",
                        display: "flex", alignItems: "center", gap: 4,
                        background: subSel ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.025)",
                        color: subSel ? "#DC2626" : "rgba(0,0,0,0.6)",
                        boxShadow: subSel ? "inset 0 0 0 1px rgba(220,38,38,0.2)" : "none",
                        transition: "all 0.14s ease", flexShrink: 0,
                      }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: subSel ? "#DC2626" : "transparent", border: subSel ? "none" : "1.5px solid rgba(0,0,0,0.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {subSel && <Check size={4} strokeWidth={3} color="#fff" />}
                        </div>
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "likert" && cfg?.min !== undefined && cfg?.max !== undefined && (() => {
        const minVal = cfg.min!;
        const maxVal = cfg.max!;
        const count = maxVal - minVal + 1;
        const getColor = (t: number): [number, number, number] => {
          if (t < 0.5) {
            const s = t / 0.5;
            return [Math.round(220 + 14 * s), Math.round(38 + 141 * s), Math.round(38 - 30 * s)];
          }
          const s = (t - 0.5) / 0.5;
          return [Math.round(234 - 212 * s), Math.round(179 - 16 * s), Math.round(8 + 66 * s)];
        };
        const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;
        const darken = ([r, g, b]: [number, number, number], a: number): [number, number, number] =>
          [Math.round(r * (1 - a)), Math.round(g * (1 - a)), Math.round(b * (1 - a))];

        return (
          <div>
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {Array.from({ length: count }, (_, i) => {
                const val = String(minVal + i);
                const sel = answer === val;
                const t = count <= 1 ? 1 : i / (count - 1);
                const c = getColor(t);
                const cd = darken(c, 0.16);
                const cr = darken(c, 0.23);
                return (
                  <button key={val} onClick={() => onAnswer(val)} style={{
                    flex: 1, minWidth: 22, padding: "5px 2px",
                    borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 8, fontWeight: 700, transition: "all 0.16s ease",
                    background: sel ? `linear-gradient(to bottom, ${rgb(c)}, ${rgb(cd)})` : "rgba(0,0,0,0.04)",
                    color: sel ? "#fff" : "rgba(0,0,0,0.5)",
                    boxShadow: sel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${rgb(cr)}, 0 1px 4px rgba(${cr[0]},${cr[1]},${cr[2]},0.18)` : "none",
                  }}>{val}</button>
                );
              })}
            </div>
            {(cfg?.minLabel || cfg?.maxLabel) && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, padding: "0 1px" }}>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.minLabel}</span>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.maxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "text" && (
        <textarea
          value={textVal}
          onChange={(e) => { setTextVal(e.target.value); onAnswer(e.target.value); }}
          placeholder="Antwort eingeben…"
          rows={2}
          style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 7.5,
            color: "#1a1a1a", resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.4,
          }}
        />
      )}

      {question.type === "numeric" && (
        <input
          type="text"
          inputMode={cfg?.decimals ? "decimal" : "numeric"}
          value={numInput}
          onChange={(e) => { const v = e.target.value.replace(cfg?.decimals ? /[^0-9.]/g : /[^0-9]/g, ""); setNumInput(v); onAnswer(v); }}
          placeholder="0"
          style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 8.5, fontWeight: 600,
            color: "#1a1a1a", outline: "none", fontFamily: "inherit", textAlign: "center",
          }}
        />
      )}

      {question.type === "slider" && cfg?.min !== undefined && cfg?.max !== undefined && (() => {
        const minV = cfg.min!;
        const maxV = cfg.max!;
        const pct = ((sliderVal - minV) / (maxV - minV)) * 100;
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{minV}{cfg.unit}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", letterSpacing: "-0.02em" }}>{sliderVal}{cfg.unit}</span>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{maxV}{cfg.unit}</span>
            </div>
            <div style={{ position: "relative", height: 12, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, borderRadius: 99, background: "rgba(0,0,0,0.07)" }} />
              <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 2, borderRadius: 99, background: "linear-gradient(to right, #DC2626, #b91c1c)" }} />
              <input type="range" min={minV} max={maxV} step={cfg.step || 1} value={sliderVal}
                onChange={(e) => { const v = Number(e.target.value); setSliderVal(v); onAnswer(String(v)); }}
                style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, cursor: "pointer", height: 12, margin: 0 }}
              />
              <div style={{
                position: "absolute", left: `calc(${pct}% - 4px)`, width: 8, height: 8,
                borderRadius: "50%", background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                boxShadow: "0 0 0 1px #a91b1b, 0 1px 3px rgba(180,20,20,0.35)", pointerEvents: "none",
              }} />
            </div>
          </div>
        );
      })()}

      {question.type === "photo" && (() => {
        const photos = Array.isArray(answer) ? (answer as string[]) : [];
        return (
          <div>
            {cfg?.instruction && <p style={{ fontSize: 7, color: "rgba(0,0,0,0.45)", fontStyle: "italic", margin: "0 0 5px" }}>{cfg.instruction}</p>}
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "8px 6px", borderRadius: 5, border: "1.5px dashed rgba(0,0,0,0.13)",
              background: "rgba(0,0,0,0.02)", cursor: "pointer",
              fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.4)",
            }}>
              <Camera size={10} strokeWidth={1.8} />
              {photos.length > 0 ? `${photos.length} Foto(s)` : "Foto auswählen"}
              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  Promise.all(files.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })))
                    .then((urls) => onAnswer([...photos, ...urls]));
                }}
              />
            </label>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "matrix" && cfg?.rows && cfg?.columns && (
        <MiniMatrixInput rows={cfg.rows} cols={cfg.columns} answers={multiAnswers} onToggle={toggleMulti} />
      )}
    </div>
  );
}

// ── Flex Mini components (independent, green-themed) ─────────

function FlexMiniMatrixInput({ rows, cols, answers, onToggle }: {
  rows: string[]; cols: string[]; answers: string[]; onToggle: (key: string) => void;
}) {
  return (
    <div style={{ margin: "0 -10px", overflowX: "auto" }}>
      <div style={{ minWidth: `${Math.max(200, cols.length * 40 + 80)}px`, padding: "0 10px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 70, padding: "3px 4px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "left" }} />
              {cols.map((col) => (
                <th key={col} style={{ padding: "3px 2px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.5)", textAlign: "center" }}>
                  <span style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td style={{ padding: "3px 4px", fontSize: 8.5, fontWeight: 500, color: "rgba(0,0,0,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 70 }}>{row}</td>
                {cols.map((col) => {
                  const cellKey = `${row}: ${col}`;
                  const sel = answers.includes(cellKey);
                  return (
                    <td key={col} style={{ textAlign: "center", padding: "1px 2px" }}>
                      <button onClick={() => onToggle(cellKey)} style={{
                        width: "100%", padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                        fontSize: 7.5, fontWeight: 600, transition: "all 0.14s ease",
                        background: sel ? "rgba(132,204,22,0.1)" : "rgba(0,0,0,0.03)",
                        color: sel ? "#65a30d" : "rgba(0,0,0,0.35)",
                        boxShadow: sel ? "inset 0 0 0 1px rgba(132,204,22,0.35)" : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                      }}>
                        {sel ? "✓" : "○"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FlexMiniQuestionCard({ question, answer, onAnswer, direction, animKey }: {
  question: PreviewQuestion;
  answer: string | string[] | undefined;
  onAnswer: (val: string | string[]) => void;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const cfg = question.config;
  const multiAnswers: string[] = Array.isArray(answer) ? answer : [];
  const toggleMulti = (opt: string) => {
    const next = multiAnswers.includes(opt) ? multiAnswers.filter((x) => x !== opt) : [...multiAnswers, opt];
    onAnswer(next);
  };

  const [sliderVal, setSliderVal] = useState<number>(() => {
    const v = Number(answer);
    return isNaN(v) ? (cfg?.min ?? 0) : v;
  });
  const [numInput, setNumInput] = useState<string>(() =>
    answer !== undefined && answer !== "" ? String(answer) : ""
  );
  const [textVal, setTextVal] = useState<string>(() =>
    typeof answer === "string" ? answer : ""
  );

  const C1 = "#84CC16";
  const C2 = "#65a30d";
  const selBg = "rgba(132,204,22,0.08)";
  const selBorder = "rgba(132,204,22,0.3)";

  return (
    <div key={animKey} style={{ animation: `fQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <style>{`@keyframes fQIn{from{opacity:0;transform:translateX(${fromX}px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: C1, marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 4 }}>
          {["Ja", "Nein"].map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 700, letterSpacing: "0.01em",
                transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                background: sel ? `linear-gradient(to bottom, ${C1}, ${C2})` : "rgba(0,0,0,0.04)",
                color: sel ? "#fff" : "rgba(0,0,0,0.45)",
                boxShadow: sel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${C2}, 0 1px 5px rgba(101,163,13,0.22)` : "none",
              }}>{opt}</button>
            );
          })}
        </div>
      )}

      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = answer === opt;
            return (
              <button key={opt} onClick={() => onAnswer(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? selBg : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.6)",
                boxShadow: sel ? `inset 0 0 0 1px ${selBorder}` : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? C1 : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "multiple" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {question.options.map((opt) => {
            const sel = multiAnswers.includes(opt);
            return (
              <button key={opt} onClick={() => toggleMulti(opt)} style={{
                padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 8, fontWeight: 500, textAlign: "left",
                transition: "all 0.16s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: sel ? selBg : "rgba(0,0,0,0.03)",
                color: sel ? C2 : "rgba(0,0,0,0.6)",
                boxShadow: sel ? `inset 0 0 0 1px ${selBorder}` : "none",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  border: sel ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: sel ? C1 : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{sel && <Check size={5} strokeWidth={3} color="#fff" />}</div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "yesnomulti" && (() => {
        let ynm: { sel: string | null; subs: string[] } = { sel: null, subs: [] };
        try { if (typeof answer === "string" && answer.startsWith("{")) ynm = JSON.parse(answer); } catch { /* ignore */ }
        const ynmSel = ynm.sel;
        const ynmSubs = ynm.subs;
        const topAnswers = cfg?.answers ?? ["Ja", "Nein"];
        const activeBranch = (cfg?.branches ?? []).find((b) => b.answer === ynmSel);
        const selectTop = (ans: string) => {
          onAnswer(JSON.stringify({ sel: ynmSel === ans ? null : ans, subs: [] }));
        };
        const toggleSub = (sub: string) => {
          const next = ynmSubs.includes(sub) ? ynmSubs.filter((x) => x !== sub) : [...ynmSubs, sub];
          onAnswer(JSON.stringify({ sel: ynmSel, subs: next }));
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {topAnswers.map((ans) => {
                const sel = ynmSel === ans;
                return (
                  <button key={ans} onClick={() => selectTop(ans)} style={{
                    flex: 1, padding: "5px 0", borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 8, fontWeight: 700, transition: "all 0.16s ease",
                    background: sel ? `linear-gradient(to bottom, ${C1}, ${C2})` : "rgba(0,0,0,0.04)",
                    color: sel ? "#fff" : "rgba(0,0,0,0.45)",
                    boxShadow: sel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${C2}, 0 1px 5px rgba(101,163,13,0.22)` : "none",
                  }}>{ans}</button>
                );
              })}
            </div>

            {ynmSel && activeBranch && activeBranch.options.length > 0 && (
              <div style={{ marginTop: 1, borderRadius: 5, background: "rgba(0,0,0,0.02)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "3px 6px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.35)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Optionen für &bdquo;{ynmSel}&ldquo;</span>
                  {ynmSubs.length > 0 && <span style={{ fontSize: 6, fontWeight: 700, color: C2, background: "rgba(132,204,22,0.1)", borderRadius: 20, padding: "1px 4px" }}>{ynmSubs.length} gewählt</span>}
                </div>
                <div style={{ maxHeight: 100, overflowY: "auto", padding: "3px 4px", display: "flex", flexDirection: "column", gap: 1, scrollbarWidth: "none" }}>
                  {activeBranch.options.map((sub) => {
                    const subSel = ynmSubs.includes(sub);
                    return (
                      <button key={sub} onClick={() => toggleSub(sub)} style={{
                        padding: "3px 5px", borderRadius: 4, border: "none", cursor: "pointer",
                        fontSize: 7.5, fontWeight: 500, textAlign: "left",
                        display: "flex", alignItems: "center", gap: 4,
                        background: subSel ? selBg : "rgba(0,0,0,0.025)",
                        color: subSel ? C2 : "rgba(0,0,0,0.6)",
                        boxShadow: subSel ? `inset 0 0 0 1px ${selBorder}` : "none",
                        transition: "all 0.14s ease", flexShrink: 0,
                      }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: subSel ? C1 : "transparent", border: subSel ? "none" : "1.5px solid rgba(0,0,0,0.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {subSel && <Check size={4} strokeWidth={3} color="#fff" />}
                        </div>
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "likert" && cfg?.min !== undefined && cfg?.max !== undefined && (() => {
        const minVal = cfg.min!;
        const maxVal = cfg.max!;
        const count = maxVal - minVal + 1;
        const getColor = (t: number): [number, number, number] => {
          if (t < 0.5) {
            const s = t / 0.5;
            return [Math.round(220 + 14 * s), Math.round(38 + 141 * s), Math.round(38 - 30 * s)];
          }
          const s = (t - 0.5) / 0.5;
          return [Math.round(234 - 212 * s), Math.round(179 - 16 * s), Math.round(8 + 66 * s)];
        };
        const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;
        const darken = ([r, g, b]: [number, number, number], a: number): [number, number, number] =>
          [Math.round(r * (1 - a)), Math.round(g * (1 - a)), Math.round(b * (1 - a))];

        return (
          <div>
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {Array.from({ length: count }, (_, i) => {
                const val = String(minVal + i);
                const sel = answer === val;
                const t = count <= 1 ? 1 : i / (count - 1);
                const c = getColor(t);
                const cd = darken(c, 0.16);
                const cr = darken(c, 0.23);
                return (
                  <button key={val} onClick={() => onAnswer(val)} style={{
                    flex: 1, minWidth: 22, padding: "5px 2px",
                    borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 8, fontWeight: 700, transition: "all 0.16s ease",
                    background: sel ? `linear-gradient(to bottom, ${rgb(c)}, ${rgb(cd)})` : "rgba(0,0,0,0.04)",
                    color: sel ? "#fff" : "rgba(0,0,0,0.5)",
                    boxShadow: sel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${rgb(cr)}, 0 1px 4px rgba(${cr[0]},${cr[1]},${cr[2]},0.18)` : "none",
                  }}>{val}</button>
                );
              })}
            </div>
            {(cfg?.minLabel || cfg?.maxLabel) && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, padding: "0 1px" }}>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.minLabel}</span>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.maxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "text" && (
        <textarea
          value={textVal}
          onChange={(e) => { setTextVal(e.target.value); onAnswer(e.target.value); }}
          placeholder="Antwort eingeben…"
          rows={2}
          style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 7.5,
            color: "#1a1a1a", resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.4,
          }}
        />
      )}

      {question.type === "numeric" && (
        <input
          type="text"
          inputMode={cfg?.decimals ? "decimal" : "numeric"}
          value={numInput}
          onChange={(e) => { const v = e.target.value.replace(cfg?.decimals ? /[^0-9.]/g : /[^0-9]/g, ""); setNumInput(v); onAnswer(v); }}
          placeholder="0"
          style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 8.5, fontWeight: 600,
            color: "#1a1a1a", outline: "none", fontFamily: "inherit", textAlign: "center",
          }}
        />
      )}

      {question.type === "slider" && cfg?.min !== undefined && cfg?.max !== undefined && (() => {
        const minV = cfg.min!;
        const maxV = cfg.max!;
        const pct = ((sliderVal - minV) / (maxV - minV)) * 100;
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{minV}{cfg.unit}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C1, letterSpacing: "-0.02em" }}>{sliderVal}{cfg.unit}</span>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{maxV}{cfg.unit}</span>
            </div>
            <div style={{ position: "relative", height: 12, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, borderRadius: 99, background: "rgba(0,0,0,0.07)" }} />
              <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 2, borderRadius: 99, background: `linear-gradient(to right, ${C1}, ${C2})` }} />
              <input type="range" min={minV} max={maxV} step={cfg.step || 1} value={sliderVal}
                onChange={(e) => { const v = Number(e.target.value); setSliderVal(v); onAnswer(String(v)); }}
                style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, cursor: "pointer", height: 12, margin: 0 }}
              />
              <div style={{
                position: "absolute", left: `calc(${pct}% - 4px)`, width: 8, height: 8,
                borderRadius: "50%", background: `linear-gradient(to bottom, ${C1}, ${C2})`,
                boxShadow: `0 0 0 1px ${C2}, 0 1px 3px rgba(101,163,13,0.35)`, pointerEvents: "none",
              }} />
            </div>
          </div>
        );
      })()}

      {question.type === "photo" && (() => {
        const photos = Array.isArray(answer) ? (answer as string[]) : [];
        return (
          <div>
            {cfg?.instruction && <p style={{ fontSize: 7, color: "rgba(0,0,0,0.45)", fontStyle: "italic", margin: "0 0 5px" }}>{cfg.instruction}</p>}
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "8px 6px", borderRadius: 5, border: "1.5px dashed rgba(0,0,0,0.13)",
              background: "rgba(0,0,0,0.02)", cursor: "pointer",
              fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.4)",
            }}>
              <Camera size={10} strokeWidth={1.8} />
              {photos.length > 0 ? `${photos.length} Foto(s)` : "Foto auswählen"}
              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  Promise.all(files.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })))
                    .then((urls) => onAnswer([...photos, ...urls]));
                }}
              />
            </label>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {question.type === "matrix" && cfg?.rows && cfg?.columns && (
        <FlexMiniMatrixInput rows={cfg.rows} cols={cfg.columns} answers={multiAnswers} onToggle={toggleMulti} />
      )}
    </div>
  );
}

// ── FlexFragebogenVorschau (independent, green-themed) ───────

function FlexFragebogenVorschau({ questions = FLEX_PREVIEW_QUESTIONS, showHeatmap = false }: { questions?: PreviewQuestion[]; showHeatmap?: boolean }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState("f0-init");

  const C1 = "#84CC16";
  const C2 = "#65a30d";
  const auroraColors = ["#D9F99D", "#84CC16", "#D9F99D"];

  const currentQ = questions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;

  const goNext = () => {
    if (currentQIndex < questions.length - 1) {
      setDirection("forward");
      setAnimKey(`f${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    if (currentQIndex > 0) {
      setDirection("backward");
      setAnimKey(`f${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  return (
    <div style={{
      flex: 1, minHeight: 380, borderRadius: 12, overflow: "hidden",
      position: "relative", backgroundColor: "#f5f5f7",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
      }}>
        <Aurora colorStops={auroraColors} blend={0.6} amplitude={0.75} speed={0.3} />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "10px 10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={8} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
          <span style={{ fontSize: 7, fontWeight: 600, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>Fragebogen</span>
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 10, display: "flex", alignItems: "center" }}>
            {(() => {
              const n = questions.length;
              const lastIdx = questions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = allAnswered ? "linear-gradient(to right, #16a34a, #22c55e)" : `linear-gradient(to right, ${C2}, ${C1})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {questions.map((q, i) => {
                    const done = answers[q.id] !== undefined;
                    const cur = i === currentQIndex;
                    const lp = n === 1 ? 50 : (i / (n - 1)) * 100;
                    const bg = allAnswered ? "#22c55e" : done ? C1 : cur ? `${C1}73` : "rgba(0,0,0,0.12)";
                    const sz = cur && !done ? 5 : 4;
                    return <div key={q.id} style={{
                      position: "absolute", left: `${lp}%`, transform: "translateX(-50%)",
                      width: sz, height: sz, borderRadius: "50%", backgroundColor: bg,
                      transition: "all 0.3s ease", zIndex: 1,
                    }} />;
                  })}
                </>
              );
            })()}
          </div>
          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div style={{
        position: "relative", zIndex: 1, padding: "0 10px 8px",
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto", scrollbarWidth: "none",
      }}>
        <style>{`.fbm-vorschau::-webkit-scrollbar{display:none}`}</style>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.9)",
          padding: "8px 8px 7px", boxShadow: "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)", marginBottom: 5 }}>
            Frage {currentQIndex + 1} von {questions.length}
          </div>
          {showHeatmap ? (
            <HeatmapQuestionCard
              question={currentQ}
              data={MOCK_AGGREGATE_FLEX[currentQ.id]}
              accentColor={C1}
              direction={direction}
              animKey={animKey + "-hm"}
            />
          ) : (
            <FlexMiniQuestionCard
              question={currentQ}
              answer={currentAnswer}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
              direction={direction}
              animKey={animKey}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button onClick={goBack} disabled={currentQIndex === 0} style={{
            padding: "5px 8px", borderRadius: 5, border: "none",
            cursor: currentQIndex === 0 ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 600,
            color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)",
            background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
            boxShadow: currentQIndex === 0 ? "none" : "0 1px 3px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
          }}>
            <ChevronLeft size={8} strokeWidth={2} />
            Zurück
          </button>
          <button onClick={goNext} disabled={!showHeatmap && !!(currentQ.required && !currentAnswer)} style={{
            flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
            cursor: (!showHeatmap && currentQ.required && !currentAnswer) ? "not-allowed" : "pointer",
            fontSize: 8, fontWeight: 700,
            color: (!showHeatmap && currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff",
            background: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "rgba(0,0,0,0.05)"
              : `linear-gradient(to bottom, ${C1}, ${C2})`,
            boxShadow: (!showHeatmap && currentQ.required && !currentAnswer)
              ? "none"
              : `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${C2}, 0 1px 4px rgba(101,163,13,0.22)`,
            transition: "all 0.18s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            {currentQIndex < questions.length - 1 ? "Weiter" : "Abschließen"}
            <ChevronRight size={8} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Heatmap aggregate mock data (Standard) ──────────────────

type HeatmapData = {
  total: number;
  options?: Record<string, number>;
  avg?: number;
  topOptions?: Record<string, number>;
  subOptions?: Record<string, Record<string, number>>;
  matrix?: Record<string, number>;
};

const MOCK_AGGREGATE_STANDART: Record<string, HeatmapData> = {
  pq1: { total: 843, options: { Ja: 711, Nein: 132 } },
  pq2: { total: 843, options: { "Sehr gut": 284, "Gut": 371, "Befriedigend": 153, "Verbesserungswürdig": 35 } },
  pq3: { total: 843, options: { "Aufsteller": 612, "Deckenanhänger": 298, "Regalblende": 541, "Preisschild": 789, "Plakat": 204 } },
  pq4: {
    total: 843,
    topOptions: { Ja: 631, Nein: 212 },
    subOptions: {
      Ja:   { "Produkt A vollständig": 520, "Produkt B vollständig": 487, "Etiketten korrekt": 601, "Mengen stimmen": 445, "Preisschilder vorhanden": 598 },
      Nein: { "Ware fehlt komplett": 98, "Falsche Produkte": 67, "Display defekt": 41, "Preisschilder fehlen": 155, "Etiketten unleserlich": 82 },
    },
  },
  pq5: { total: 843, avg: 3.8, options: { "1": 28, "2": 74, "3": 198, "4": 321, "5": 222 } },
  pq6: { total: 843 },
  pq7: { total: 843, avg: 12 },
  pq8: { total: 843, avg: 70 },
  pq9: { total: 843 },
  pq10: {
    total: 843,
    matrix: {
      "Regalordnung: Gut": 498, "Regalordnung: Mittel": 271, "Regalordnung: Schlecht": 74,
      "Preisgestaltung: Gut": 312, "Preisgestaltung: Mittel": 401, "Preisgestaltung: Schlecht": 130,
      "Sauberkeit: Gut": 623, "Sauberkeit: Mittel": 178, "Sauberkeit: Schlecht": 42,
    },
  },
};

const MOCK_AGGREGATE_FLEX: Record<string, HeatmapData> = {
  fq1: { total: 512, options: { Ja: 421, Nein: 91 } },
  fq2: { total: 421, options: { Kassenzone: 187, Gangende: 134, Eingangsbereich: 62, Sonderaufbau: 28, Kühlregal: 10 } },
  fq3: { total: 512, options: { "Coca-Cola Classic": 489, "Zero": 431, "Fanta": 378, "Sprite": 312, "Mezzo Mix": 198, "Fuze Tea": 143 } },
  fq4: {
    total: 512,
    topOptions: { Ja: 389, Nein: 123 },
    subOptions: {
      Ja:   { "Preisschild korrekt": 341, "Produkte vollständig": 312, "Aufbau ordentlich": 298, "Branding sichtbar": 367 },
      Nein: { "Preisschilder fehlen": 78, "Produkte fehlen": 56, "Aufbau beschädigt": 23, "Falsche Produkte": 41 },
    },
  },
  fq5: { total: 512, avg: 4.1, options: { "1": 12, "2": 31, "3": 89, "4": 201, "5": 179 } },
  fq6: { total: 512 },
  fq7: { total: 512, avg: 8 },
  fq8: { total: 512, avg: 65 },
  fq9: { total: 512 },
  fq10: {
    total: 512,
    matrix: {
      "Platzierung: Gut": 312, "Platzierung: Mittel": 148, "Platzierung: Schlecht": 52,
      "Beschilderung: Gut": 278, "Beschilderung: Mittel": 189, "Beschilderung: Schlecht": 45,
      "Warenbestand: Gut": 391, "Warenbestand: Mittel": 98, "Warenbestand: Schlecht": 23,
      "Sauberkeit: Gut": 421, "Sauberkeit: Mittel": 74, "Sauberkeit: Schlecht": 17,
    },
  },
};

const MOCK_AGGREGATE_KUEHLER: Record<string, HeatmapData> = {
  kpq1: { total: 634, options: { "Sehr voll": 421, "Halb voll": 167, "Nicht voll": 46 } },
  kpq2: { total: 634, options: { Ja: 589, Nein: 45 } },
  kpq3: { total: 634, options: { Ja: 601, Nein: 33 } },
  kpq4: { total: 634, options: { "Sauber": 478, "Leicht verschmutzt": 131, "Stark verschmutzt": 25 } },
  kpq5: { total: 634, options: { Ja: 572, Nein: 62 } },
  kpq6: { total: 634, options: { Ja: 608, Nein: 26 } },
};

const MOCK_AGGREGATE_MHD: Record<string, HeatmapData> = {
  mpq1: { total: 387, options: { Ja: 341, Nein: 46 } },
  mpq2: { total: 387, options: { Keine: 218, "1–3 Produkte": 112, "4–10 Produkte": 43, "Mehr als 10": 14 } },
  mpq3: { total: 387, options: { Ja: 352, Nein: 35 } },
  mpq4: { total: 387, options: { Softdrinks: 178, Säfte: 89, "Energy Drinks": 67, Wasser: 34, Keine: 19 } },
  mpq5: { total: 169, options: { Ja: 138, Nein: 31 } },
  mpq6: { total: 387, options: { Ja: 361, Nein: 26 } },
  mpq7: { total: 387, options: { "Sehr gut": 201, "Gut": 134, "Verbesserungswürdig": 42, "Kritisch": 10 } },
};

const MOCK_AGGREGATE_BILLA: Record<string, HeatmapData> = {
  bpq1: { total: 298, options: { Ja: 261, Nein: 37 } },
  bpq2: { total: 261, options: { Eingang: 98, Kassenzone: 72, Getränkeabteilung: 61, Sonderplatzierung: 19, Kühlregal: 11 } },
  bpq3: { total: 298, options: { "Coca-Cola 1.5L": 241, "Coca-Cola Zero 1L": 198, "Fanta 1.5L": 176, "Sprite 1L": 154, "Mezzo Mix 1.5L": 132, "Römerquelle": 109 } },
  bpq4: { total: 298, options: { Ja: 267, Nein: 31 } },
  bpq5: { total: 298, options: { "Voll bestückt": 134, "Teilweise bestückt": 112, "Fast leer": 38, "Leer": 14 } },
  bpq6: { total: 298, options: { Ja: 254, Nein: 44 } },
  bpq7: { total: 298 },
  bpq8: { total: 298 },
};

// ── HeatmapQuestionCard ──────────────────────────────────────

function HeatmapQuestionCard({ question, data, accentColor, direction, animKey }: {
  question: PreviewQuestion;
  data: HeatmapData | undefined;
  accentColor: string;
  direction: "forward" | "backward";
  animKey: string;
}) {
  const fromX = direction === "forward" ? 16 : -16;
  const cfg = question.config;
  const total = data?.total ?? 0;
  const topKeys = cfg?.answers ?? ["Ja", "Nein"];
  const [hmTab, setHmTab] = useState<string>(() => {
    if (question.type === "yesnomulti" && data?.topOptions) {
      return Object.entries(data.topOptions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? topKeys[0];
    }
    return topKeys[0];
  });

  const hex = accentColor.replace("#", "");
  const ar = parseInt(hex.substring(0, 2), 16);
  const ag = parseInt(hex.substring(2, 4), 16);
  const ab = parseInt(hex.substring(4, 6), 16);
  const accent = (a: number) => `rgba(${ar},${ag},${ab},${a})`;

  const HEATMAP_SEMANTIC: Record<string, string> = {
    "Sehr voll": "#16a34a", "Halb voll": "#d97706", "Nicht voll": "#dc2626",
    "Sauber": "#16a34a", "Leicht verschmutzt": "#d97706", "Stark verschmutzt": "#dc2626",
    "Voll bestückt": "#16a34a", "Teilweise bestückt": "#d97706", "Fast leer": "#ea580c", "Leer": "#dc2626",
  };
  const optColor = (label: string, t: number): string =>
    HEATMAP_SEMANTIC[label] ?? (t > 0.5 ? accentColor : "rgba(0,0,0,0.35)");

  const pct = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;
  const maxOpt = (opts: Record<string, number>) => Math.max(...Object.values(opts), 1);

  return (
    <div key={animKey} style={{ animation: `sQIn 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
      <p style={{ fontSize: 8.5, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, letterSpacing: "-0.01em", margin: "0 0 7px" }}>
        {question.text}
        {question.required && <span style={{ color: accentColor, marginLeft: 2, fontSize: 7 }}>*</span>}
      </p>

      {question.imageUrl && <MiniQuestionImage url={question.imageUrl} />}

      {/* ── yesno ── */}
      {question.type === "yesno" && data?.options && (() => {
        const opts = data.options!;
        const mx = maxOpt(opts);
        return (
          <div>
            <div style={{ display: "flex", gap: 4 }}>
              {["Ja", "Nein"].map((opt) => {
                const cnt = opts[opt] ?? 0;
                const p = pct(cnt);
                const t = mx > 0 ? cnt / mx : 0;
                return (
                  <div key={opt} style={{
                    flex: 1, padding: "5px 0", borderRadius: 5,
                    background: `rgba(${ar},${ag},${ab},${(0.05 + t * 0.2).toFixed(2)})`,
                    boxShadow: `inset 0 0 0 1px rgba(${ar},${ag},${ab},${(0.1 + t * 0.25).toFixed(2)})`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: t > 0.5 ? accentColor : "rgba(0,0,0,0.5)" }}>{opt}</span>
                    <span style={{ fontSize: 8, fontWeight: 800, color: t > 0.5 ? accentColor : "rgba(0,0,0,0.35)", letterSpacing: "-0.02em" }}>{p}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "right", marginTop: 3, fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>n = {total}</div>
          </div>
        );
      })()}

      {/* ── single ── */}
      {question.type === "single" && question.options && data?.options && (() => {
        const opts = data.options!;
        const mx = maxOpt(opts);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {question.options.map((opt) => {
              const cnt = opts[opt] ?? 0;
              const p = pct(cnt);
              const t = mx > 0 ? cnt / mx : 0;
              const isTop = cnt === mx;
              const oc = optColor(opt, t);
              const hasSemantic = !!HEATMAP_SEMANTIC[opt];
              return (
                <div key={opt} style={{
                  position: "relative", overflow: "hidden",
                  padding: "4px 6px", borderRadius: 5,
                  background: "rgba(0,0,0,0.025)",
                  boxShadow: isTop ? `inset 0 0 0 1px ${hasSemantic ? oc + "55" : `rgba(${ar},${ag},${ab},0.3)`}` : "none",
                }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 5, width: `${p}%`, background: hasSemantic ? oc + "18" : accent(0.07 + t * 0.07), transition: "width 0.4s ease" }} />
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hasSemantic ? oc + "55" : accent(0.15 + t * 0.55), border: `1.5px solid ${hasSemantic ? oc + "88" : accent(0.2 + t * 0.4)}` }} />
                    <span style={{ fontSize: 8, fontWeight: isTop ? 600 : 500, color: isTop ? oc : "rgba(0,0,0,0.55)", flex: 1 }}>{opt}</span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: isTop ? oc : "rgba(0,0,0,0.35)", minWidth: 22, textAlign: "right" }}>{p}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ textAlign: "right", marginTop: 1, fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>n = {total}</div>
          </div>
        );
      })()}

      {/* ── multiple ── */}
      {question.type === "multiple" && question.options && data?.options && (() => {
        const opts = data.options!;
        const mx = maxOpt(opts);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {question.options.map((opt) => {
              const cnt = opts[opt] ?? 0;
              const p = pct(cnt);
              const t = mx > 0 ? cnt / mx : 0;
              const isTop = cnt === mx;
              const oc = optColor(opt, t);
              const hasSemantic = !!HEATMAP_SEMANTIC[opt];
              return (
                <div key={opt} style={{
                  position: "relative", overflow: "hidden",
                  padding: "4px 6px", borderRadius: 5,
                  background: "rgba(0,0,0,0.025)",
                  boxShadow: isTop ? `inset 0 0 0 1px ${hasSemantic ? oc + "55" : `rgba(${ar},${ag},${ab},0.3)`}` : "none",
                }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 5, width: `${p}%`, background: hasSemantic ? oc + "18" : accent(0.07 + t * 0.07) }} />
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: hasSemantic ? oc + "55" : accent(0.15 + t * 0.55), border: `1.5px solid ${hasSemantic ? oc + "88" : accent(0.2 + t * 0.4)}` }} />
                    <span style={{ fontSize: 8, fontWeight: isTop ? 600 : 500, color: isTop ? oc : "rgba(0,0,0,0.55)", flex: 1 }}>{opt}</span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: isTop ? oc : "rgba(0,0,0,0.35)", minWidth: 22, textAlign: "right" }}>{p}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ textAlign: "right", marginTop: 1, fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>n = {total} · Mehrfachauswahl</div>
          </div>
        );
      })()}

      {/* ── yesnomulti ── */}
      {question.type === "yesnomulti" && data?.topOptions && (() => {
        const topOpts = data.topOptions!;
        const subOpts = data.subOptions ?? {};
        const mx = maxOpt(topOpts);
        const activeSubs = subOpts[hmTab] ?? {};
        const subMx = Math.max(...Object.values(activeSubs), 1);
        const topKeys = cfg?.answers ?? ["Ja", "Nein"];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {topKeys.map((opt) => {
                const cnt = topOpts[opt] ?? 0;
                const p = pct(cnt);
                const t = mx > 0 ? cnt / mx : 0;
                const isActive = opt === hmTab;
                return (
                  <div key={opt} onClick={() => setHmTab(opt)} style={{
                    flex: 1, padding: "5px 0", borderRadius: 5, cursor: "pointer",
                    background: accent(0.05 + t * 0.18),
                    boxShadow: isActive
                      ? `inset 0 0 0 1.5px ${accent(0.45)}`
                      : `inset 0 0 0 1px ${accent(0.08 + t * 0.28)}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    transition: "box-shadow 0.15s ease",
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: t > 0.5 ? accentColor : "rgba(0,0,0,0.45)" }}>{opt}</span>
                    <span style={{ fontSize: 8, fontWeight: 800, color: t > 0.5 ? accentColor : "rgba(0,0,0,0.35)", letterSpacing: "-0.02em" }}>{p}%</span>
                  </div>
                );
              })}
            </div>
            {Object.keys(activeSubs).length > 0 && (
              <div style={{ borderRadius: 5, background: "rgba(0,0,0,0.02)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)", padding: "4px 5px" }}>
                <div style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.32)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>Meistgenannte bei „{hmTab}"</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {Object.entries(activeSubs).sort((a, b) => b[1] - a[1]).map(([sub, cnt]) => {
                    const t = subMx > 0 ? cnt / subMx : 0;
                    const p = pct(cnt);
                    return (
                      <div key={sub} style={{ position: "relative", overflow: "hidden", padding: "3px 5px", borderRadius: 4, background: "rgba(0,0,0,0.02)" }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: 4, width: `${p}%`, background: accent(0.05 + t * 0.09) }} />
                        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 7, fontWeight: 500, color: "rgba(0,0,0,0.55)", flex: 1 }}>{sub}</span>
                          <span style={{ fontSize: 7, fontWeight: 700, color: accent(0.5 + t * 0.5) }}>{p}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ textAlign: "right", fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>n = {total}</div>
          </div>
        );
      })()}

      {/* ── likert ── */}
      {question.type === "likert" && cfg?.min !== undefined && cfg?.max !== undefined && data?.options && (() => {
        const minV = cfg.min!;
        const maxV = cfg.max!;
        const opts = data.options!;
        const mx = maxOpt(opts);
        const getColor = (t: number): [number, number, number] => {
          if (t < 0.5) { const s = t / 0.5; return [Math.round(220 + 14 * s), Math.round(38 + 141 * s), Math.round(38 - 30 * s)]; }
          const s = (t - 0.5) / 0.5;
          return [Math.round(234 - 212 * s), Math.round(179 - 16 * s), Math.round(8 + 66 * s)];
        };
        const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;
        const count = maxV - minV + 1;
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, color: accentColor, background: accent(0.08), padding: "1px 6px", borderRadius: 4 }}>Ø {data.avg?.toFixed(1)}</span>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: count }, (_, i) => {
                const val = String(minV + i);
                const cnt = opts[val] ?? 0;
                const t = count <= 1 ? 1 : i / (count - 1);
                const c = getColor(t);
                const intensity = mx > 0 ? cnt / mx : 0;
                const p = pct(cnt);
                return (
                  <div key={val} style={{
                    flex: 1, minWidth: 22, padding: "4px 2px 3px", borderRadius: 5, textAlign: "center",
                    background: `rgba(${c[0]},${c[1]},${c[2]},${(0.04 + intensity * 0.22).toFixed(2)})`,
                    boxShadow: intensity > 0.7 ? `inset 0 0 0 1.5px rgba(${c[0]},${c[1]},${c[2]},0.45)` : `inset 0 0 0 1px rgba(${c[0]},${c[1]},${c[2]},0.15)`,
                  }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: `rgba(${c[0]},${c[1]},${c[2]},${0.5 + intensity * 0.5})` }}>{val}</div>
                    <div style={{ fontSize: 6.5, fontWeight: 700, color: `rgba(${c[0]},${c[1]},${c[2]},${0.4 + intensity * 0.55})`, marginTop: 1 }}>{p}%</div>
                  </div>
                );
              })}
            </div>
            {(cfg?.minLabel || cfg?.maxLabel) && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)" }}>{cfg.minLabel}</span>
                <span style={{ fontSize: 6, color: "rgba(0,0,0,0.35)" }}>{cfg.maxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── text ── */}
      {question.type === "text" && (
        <div style={{ padding: "8px 6px", borderRadius: 5, background: "rgba(0,0,0,0.025)", border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center" }}>
          <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.3)", fontStyle: "italic" }}>Offene Frage — keine Auswertung</span>
        </div>
      )}

      {/* ── numeric ── */}
      {question.type === "numeric" && data?.avg !== undefined && (
        <div>
          <div style={{
            width: "100%", padding: "5px 6px", boxSizing: "border-box",
            borderRadius: 5, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", color: "#1a1a1a", textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)" }}>Ø</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "-0.01em" }}>{Math.round(data.avg)}</span>
            {cfg?.unit && <span style={{ fontSize: 7.5, fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>{cfg.unit}</span>}
          </div>
          <div style={{ marginTop: 3, fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500, textAlign: "right" }}>n = {total}</div>
        </div>
      )}

      {/* ── slider ── */}
      {question.type === "slider" && cfg?.min !== undefined && cfg?.max !== undefined && data?.avg !== undefined && (() => {
        const minV = cfg.min!;
        const maxV = cfg.max!;
        const avgPct = ((data.avg - minV) / (maxV - minV)) * 100;
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{minV}{cfg.unit}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)" }}>Ø</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, letterSpacing: "-0.02em" }}>{data.avg}{cfg.unit}</span>
              </div>
              <span style={{ fontSize: 6.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{maxV}{cfg.unit}</span>
            </div>
            <div style={{ position: "relative", height: 12, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, borderRadius: 99, background: "rgba(0,0,0,0.07)" }} />
              <div style={{ position: "absolute", left: 0, width: `${avgPct}%`, height: 2, borderRadius: 99, background: `linear-gradient(to right, ${accent(0.55)}, ${accentColor})` }} />
              <div style={{ position: "absolute", left: `calc(${avgPct}% - 4px)`, width: 8, height: 8, borderRadius: "50%", background: `linear-gradient(to bottom, ${accentColor}, ${accent(0.85)})`, boxShadow: `0 0 0 1px ${accent(0.7)}, 0 1px 3px ${accent(0.35)}` }} />
            </div>
            <div style={{ textAlign: "right", marginTop: 2, fontSize: 6, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>n = {total}</div>
          </div>
        );
      })()}

      {/* ── photo ── */}
      {question.type === "photo" && (
        <div style={{ padding: "8px 6px", borderRadius: 5, background: "rgba(0,0,0,0.025)", border: "1px dashed rgba(0,0,0,0.1)", textAlign: "center" }}>
          <span style={{ fontSize: 7.5, color: "rgba(0,0,0,0.3)", fontStyle: "italic" }}>Fotoaufgabe — keine Auswertung</span>
        </div>
      )}

      {/* ── matrix ── */}
      {question.type === "matrix" && cfg?.rows && cfg?.columns && data?.matrix && (() => {
        const mat = data.matrix!;
        const allVals = Object.values(mat);
        const mx = Math.max(...allVals, 1);
        return (
          <div style={{ margin: "0 -10px", overflowX: "auto" }}>
            <div style={{ minWidth: `${Math.max(200, cfg.columns!.length * 40 + 80)}px`, padding: "0 10px" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: 70, padding: "3px 4px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "left" }} />
                    {cfg.columns!.map((col) => (
                      <th key={col} style={{ padding: "3px 2px", fontSize: 7.5, fontWeight: 600, color: "rgba(0,0,0,0.5)", textAlign: "center" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfg.rows!.map((row) => (
                    <tr key={row}>
                      <td style={{ padding: "3px 4px", fontSize: 7.5, fontWeight: 500, color: "rgba(0,0,0,0.6)", verticalAlign: "middle" }}>{row}</td>
                      {cfg.columns!.map((col) => {
                        const key = `${row}: ${col}`;
                        const cnt = mat[key] ?? 0;
                        const intensity = mx > 0 ? cnt / mx : 0;
                        const p = total > 0 ? Math.round((cnt / total) * 100) : 0;
                        return (
                          <td key={col} style={{ textAlign: "center", padding: "2px" }}>
                            <div style={{
                              width: 26, height: 22, borderRadius: 4, margin: "0 auto",
                              background: accent(0.04 + intensity * 0.2),
                              boxShadow: intensity > 0.5 ? `inset 0 0 0 1.5px ${accent(0.25 + intensity * 0.25)}` : `inset 0 0 0 1px rgba(0,0,0,0.07)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <span style={{ fontSize: 6.5, fontWeight: 700, color: intensity > 0.4 ? accentColor : "rgba(0,0,0,0.3)" }}>{p}%</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── FragebogenVorschau container (Standard, red-themed) ──────

function FragebogenVorschau({
  questions = PREVIEW_QUESTIONS,
  accentColor = "#DC2626",
  auroraColors = ["#F4B4B4", "#DC2626", "#F4B4B4"],
  showHeatmap = false,
}: {
  questions?: PreviewQuestion[];
  accentColor?: string;
  auroraColors?: string[];
  showHeatmap?: boolean;
}) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState("s0-init");

  const normalizeAnswer = (answer: string | string[] | undefined) => {
    if (Array.isArray(answer)) return answer.map((value) => String(value).trim().toLowerCase());
    if (answer == null) return [];
    return [String(answer).trim().toLowerCase()];
  };

  const evaluateRule = (rule: ConditionalRule, triggerAnswer: string | string[] | undefined) => {
    const values = normalizeAnswer(triggerAnswer);
    if (values.length === 0) return false;
    const expected = String(rule.triggerValue ?? "").trim().toLowerCase();
    const expectedMax = String(rule.triggerValueMax ?? "").trim().toLowerCase();

    if (rule.operator === "equals") return values.includes(expected);
    if (rule.operator === "not_equals") return !values.includes(expected);
    if (rule.operator === "includes") return values.some((value) => value.includes(expected));
    if (rule.operator === "not_includes") return values.every((value) => !value.includes(expected));

    const valueNum = Number(values[0]);
    const expectedNum = Number(expected);
    const expectedMaxNum = Number(expectedMax);
    if (Number.isNaN(valueNum) || Number.isNaN(expectedNum)) return false;
    if (rule.operator === "gt") return valueNum > expectedNum;
    if (rule.operator === "gte") return valueNum >= expectedNum;
    if (rule.operator === "lt") return valueNum < expectedNum;
    if (rule.operator === "lte") return valueNum <= expectedNum;
    if (rule.operator === "between" && !Number.isNaN(expectedMaxNum)) {
      return valueNum >= expectedNum && valueNum <= expectedMaxNum;
    }
    return false;
  };

  const visibleQuestions = useMemo(() => {
    if (showHeatmap) return questions;
    if (questions.length === 0) return [];

    const visibility = new Map<string, boolean>();
    for (const question of questions) visibility.set(question.id, true);

    const showTargetIds = new Set<string>();
    for (const question of questions) {
      for (const rule of question.rules ?? []) {
        if (rule.action === "show") {
          for (const targetId of rule.targetQuestionIds ?? []) {
            showTargetIds.add(targetId);
          }
        }
      }
    }
    for (const targetId of showTargetIds) {
      if (visibility.has(targetId)) visibility.set(targetId, false);
    }

    for (const question of questions) {
      const questionRules = question.rules ?? [];
      if (questionRules.length === 0) continue;
      for (const rule of questionRules) {
        const triggerAnswer = answers[rule.triggerQuestionId];
        const matched = evaluateRule(rule, triggerAnswer);
        if (!matched) continue;
        for (const targetId of rule.targetQuestionIds ?? []) {
          if (!visibility.has(targetId)) continue;
          if (rule.action === "hide") visibility.set(targetId, false);
          if (rule.action === "show") visibility.set(targetId, true);
        }
      }
    }

    return questions.filter((question) => visibility.get(question.id) !== false);
  }, [answers, questions, showHeatmap]);

  useEffect(() => {
    if (visibleQuestions.length === 0) {
      setCurrentQIndex(0);
      return;
    }
    if (currentQIndex > visibleQuestions.length - 1) {
      setCurrentQIndex(visibleQuestions.length - 1);
    }
  }, [currentQIndex, visibleQuestions.length]);

  const currentQ = visibleQuestions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = visibleQuestions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = visibleQuestions.length > 0 && answeredCount === visibleQuestions.length;

  const goNext = () => {
    if (currentQIndex < visibleQuestions.length - 1) {
      setDirection("forward");
      setAnimKey(`s${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    if (currentQIndex > 0) {
      setDirection("backward");
      setAnimKey(`s${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  };

  if (!currentQ) return null;

  return (
    <div style={{
      flex: 1, minHeight: 380, borderRadius: 12, overflow: "hidden",
      position: "relative", backgroundColor: "#f5f5f7",
      display: "flex", flexDirection: "column",
    }}>
      {/* Aurora — covers most of the preview like the real GM UI */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
      }}>
        <Aurora colorStops={auroraColors} blend={0.6} amplitude={0.75} speed={0.3} />
      </div>

      {/* Progress bar pinned to top */}
      <div style={{
        position: "relative", zIndex: 1, padding: "10px 10px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <FileText size={8} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
          <span style={{ fontSize: 7, fontWeight: 600, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>Fragebogen</span>

          <div style={{ flex: 1, minWidth: 0, position: "relative", height: 10, display: "flex", alignItems: "center" }}>
            {(() => {
              const n = visibleQuestions.length;
              const lastIdx = visibleQuestions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = allAnswered ? "linear-gradient(to right, #16a34a, #22c55e)" : `linear-gradient(to right, #b91c1c, ${accentColor})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {visibleQuestions.map((q, i) => {
                    const done = answers[q.id] !== undefined;
                    const cur = i === currentQIndex;
                    const lp = n === 1 ? 50 : (i / (n - 1)) * 100;
                    const bg = allAnswered ? "#22c55e" : done ? accentColor : cur ? `${accentColor}73` : "rgba(0,0,0,0.12)";
                    const sz = cur && !done ? 5 : 4;
                    return <div key={q.id} style={{
                      position: "absolute", left: `${lp}%`, transform: "translateX(-50%)",
                      width: sz, height: sz, borderRadius: "50%", backgroundColor: bg,
                      transition: "all 0.3s ease", zIndex: 1,
                    }} />;
                  })}
                </>
              );
            })()}
          </div>

          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{answeredCount}/{visibleQuestions.length}</span>
        </div>
      </div>

      {/* Centered content: card + buttons */}
      <div style={{
        position: "relative", zIndex: 1, padding: "0 10px 8px",
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto", scrollbarWidth: "none",
      }}>
        <style>{`.fbm-vorschau::-webkit-scrollbar{display:none}`}</style>

        {/* Glass card */}
        <div style={{
          backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.9)",
          padding: "8px 8px 7px", boxShadow: "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)", marginBottom: 5 }}>
            Frage {currentQIndex + 1} von {visibleQuestions.length}
          </div>
          {showHeatmap ? (
            <HeatmapQuestionCard
              question={currentQ}
              data={MOCK_AGGREGATE_STANDART[currentQ.id]}
              accentColor={accentColor}
              direction={direction}
              animKey={animKey + "-hm"}
            />
          ) : (
            <MiniQuestionCard
              question={currentQ}
              answer={currentAnswer}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
              direction={direction}
              animKey={animKey}
            />
          )}
        </div>

        {/* Navigation — directly below the card, like the real GM UI */}
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <button onClick={goBack} disabled={currentQIndex === 0} style={{
          padding: "5px 8px", borderRadius: 5, border: "none",
          cursor: currentQIndex === 0 ? "not-allowed" : "pointer",
          fontSize: 8, fontWeight: 600,
          color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)",
          background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
          boxShadow: currentQIndex === 0 ? "none" : "0 1px 3px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 2, transition: "all 0.15s ease",
        }}>
          <ChevronLeft size={8} strokeWidth={2} />
          Zurück
        </button>
        <button onClick={goNext} disabled={!showHeatmap && !!(currentQ.required && !currentAnswer)} style={{
          flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
          cursor: (!showHeatmap && currentQ.required && !currentAnswer) ? "not-allowed" : "pointer",
          fontSize: 8, fontWeight: 700,
          color: (!showHeatmap && currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff",
          background: (!showHeatmap && currentQ.required && !currentAnswer)
            ? "rgba(0,0,0,0.05)"
            : `linear-gradient(to bottom, ${accentColor}, #b91c1c)`,
          boxShadow: (!showHeatmap && currentQ.required && !currentAnswer)
            ? "none"
            : "inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px #a91b1b, 0 1px 4px rgba(180,20,20,0.18)",
          transition: "all 0.18s ease",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          {currentQIndex < visibleQuestions.length - 1 ? "Weiter" : "Abschließen"}
          <ChevronRight size={8} strokeWidth={2.5} />
        </button>
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Switcher Overlay ───────────────────────────────

function FragebogenSwitcher({
  campaignColor,
  options,
  activeId,
  onSwitch,
  isSwitching,
  disabled = false,
}: {
  campaignColor: string;
  options: FragebogenOption[];
  activeId: string | null;
  onSwitch: (nextId: string) => Promise<void>;
  isSwitching: boolean;
  disabled?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const list = useMemo(
    () =>
      options.filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index),
    [options],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ROW_H = 62; // px per row (padding 13+13 + ~32 content + 4 margin)
  const VISIBLE = 5;

  const getOrderedList = (q: string) => {
    const normalizedQuery = q.trim().toLowerCase();
    const filtered = list.filter((entry) => !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery));
    const activeFbItem = activeId ? filtered.find((entry) => entry.id === activeId) ?? null : null;
    if (!activeFbItem) return filtered;
    const others = filtered.filter((entry) => entry.id !== activeFbItem.id);
    const half = Math.floor(others.length / 2);
    return [...others.slice(0, half), activeFbItem, ...others.slice(half)];
  };

  const scrollToActive = useCallback((q = "") => {
    if (!listRef.current) return;
    const ordered = getOrderedList(q);
    const activeIdx = ordered.findIndex((f) => f.id === activeId);
    if (activeIdx < 0) return;
    const scrollTop = activeIdx * ROW_H - Math.floor(VISIBLE / 2) * ROW_H;
    listRef.current.scrollTop = Math.max(0, scrollTop);
  }, [activeId, list]); // eslint-disable-line

  const activeFb = activeId ? list.find((entry) => entry.id === activeId) ?? null : null;

  const close = useCallback(() => {
    setClosing(true);
    setPendingSwitch(null);
    setSearch("");
    setTimeout(() => { setClosing(false); setIsExpanded(false); }, 220);
  }, []);

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        searchRef.current?.focus();
        scrollToActive("");
      }, 50);
    }
  }, [isExpanded]);

  useEffect(() => {
    scrollToActive(search);
  }, [search]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick, true);
    return () => { window.removeEventListener("keydown", handleKey); window.removeEventListener("mousedown", handleClick, true); };
  }, [isExpanded, close]);

  const accentRgba = (a: number) => {
    const hex = campaignColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const confirmSwitch = async () => {
    if (!pendingSwitch || pendingSwitch === activeId || isSwitching) return;
    await onSwitch(pendingSwitch);
    setPendingSwitch(null);
    close();
  };

  if (list.length === 0) {
    return (
      <div style={{ width: 200, flexShrink: 0, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", padding: "10px 12px", fontSize: 11, color: "rgba(0,0,0,0.45)" }}>
        Kein Fragebogen in dieser Sektion.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: 200, flexShrink: 0 }}>
      <style>{`
        @keyframes fbSwExpand { from { opacity:0; transform:scaleY(0.3) } to { opacity:1; transform:scaleY(1) } }
        @keyframes fbSwCollapse { from { opacity:1; transform:scaleY(1) } to { opacity:0; transform:scaleY(0.3) } }
        @keyframes fbSwConfirm { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fbSwPulse { 0%,100% { background-color: ${accentRgba(0.08)} } 50% { background-color: ${accentRgba(0.16)} } }
      `}</style>

      {/* Idle / Hover card */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => { if (!isExpanded && !disabled) { setIsExpanded(true); setIsHovered(false); } }}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 10,
          background: `linear-gradient(135deg, ${accentRgba(0.06)} 0%, ${accentRgba(0.03)} 100%)`,
          border: `1px solid ${isHovered && !isExpanded ? accentRgba(0.35) : accentRgba(0.15)}`,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
          cursor: isExpanded ? "default" : disabled ? "not-allowed" : "pointer",
          transform: isHovered && !isExpanded ? "scale(1.015)" : "scale(1)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.22s ease, box-shadow 0.22s ease, opacity 0.15s ease",
          boxShadow: isHovered && !isExpanded ? `0 0 0 3px ${accentRgba(0.08)}, 0 4px 12px ${accentRgba(0.1)}` : "none",
          position: "relative", zIndex: isExpanded ? 51 : 1,
          opacity: isExpanded ? 0 : disabled ? 0.65 : 1, pointerEvents: isExpanded ? "none" : "auto",
        }}
      >
        {activeFb ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{activeFb.name}</span>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a", flexShrink: 0, boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: accentRgba(0.5), letterSpacing: "0.02em" }}>{activeFb.modules} Module</span>
              <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: accentRgba(0.25) }} />
              <span style={{ fontSize: 9, fontWeight: 500, color: accentRgba(0.5), letterSpacing: "0.02em" }}>{activeFb.questions} Fragen</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.68)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                Kein Fragebogen zugewiesen
              </span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.44)", letterSpacing: "0.02em" }}>
              Wähle einen Fragebogen für diese Kampagne.
            </div>
          </>
        )}
        {/* Hover hint */}
        <span style={{
          position: "absolute", bottom: 3, right: 8, fontSize: 7, fontWeight: 600,
          color: accentRgba(0.4), letterSpacing: "0.06em", textTransform: "uppercase",
          opacity: isHovered && !isExpanded ? 1 : 0, transition: "opacity 0.18s ease",
          pointerEvents: "none",
        }}>Wechseln</span>
      </div>

      {/* Expanded overlay — active row aligned over the card */}
      {isExpanded && (() => {
        const headerH = 35;
        const listPad = 4;
        const rowH = 62;
        const activeIdx = 2; // always centered at position 2 of 5
        const offset = headerH + listPad + activeIdx * rowH;
        return (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: -offset,
          zIndex: 50,
          animation: `${closing ? "fbSwCollapse" : "fbSwExpand"} 0.22s cubic-bezier(0.4,0,0.2,1) forwards`,
          transformOrigin: `center ${offset + 22}px`,
        }}>
          <div style={{
            borderRadius: 14, overflow: "hidden",
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${accentRgba(0.18)}`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px ${accentRgba(0.06)}`,
          }}>
            {/* Search input replaces header */}
            <div style={{
              padding: "10px 12px 8px", borderBottom: `1px solid ${accentRgba(0.1)}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Fragebogen suchen…"
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 10, fontWeight: 500, color: "#1a1a1a",
                  fontFamily: "inherit", letterSpacing: "-0.01em",
                }}
              />
              <button onClick={close} style={{
                background: "none", border: "none", cursor: "pointer", padding: 2,
                color: "rgba(0,0,0,0.25)", fontSize: 14, lineHeight: 1, display: "flex", flexShrink: 0,
              }}>✕</button>
            </div>

            {/* List — exactly 5 rows visible, active centered, rest scrollable */}
            <div ref={listRef} className="fbSwList" style={{ padding: "4px 4px", height: VISIBLE * ROW_H, overflowY: "auto", scrollbarWidth: "none" }}>
              <style>{`.fbSwList::-webkit-scrollbar { display: none; }`}</style>
              {getOrderedList(search.trim()).map((fb, i, arr) => {
                const isActive = fb.id === activeId;
                const isPending = fb.id === pendingSwitch;
                return (
                  <div key={fb.id} onClick={() => { if (!isActive) setPendingSwitch(fb.id); }}
                    style={{
                      padding: "13px 16px", borderRadius: 10, marginBottom: i < arr.length - 1 ? 4 : 0,
                      display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
                      cursor: isActive ? "default" : "pointer",
                      background: isPending ? accentRgba(0.08) : isActive ? `linear-gradient(135deg, ${accentRgba(0.06)} 0%, ${accentRgba(0.03)} 100%)` : "transparent",
                      border: isActive ? `1px solid ${accentRgba(0.3)}` : "1px solid transparent",
                      transition: "all 0.15s ease",
                      animation: isPending ? "fbSwPulse 1.2s ease-in-out infinite" : "none",
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.background = accentRgba(0.05)); }}
                    onMouseLeave={(e) => { if (!isActive && !isPending) (e.currentTarget.style.background = "transparent"); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{fb.name}</span>
                      {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a", flexShrink: 0, boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" }} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: isActive ? accentRgba(0.5) : "rgba(0,0,0,0.35)", letterSpacing: "0.02em" }}>{fb.modules} Module</span>
                      <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: isActive ? accentRgba(0.25) : "rgba(0,0,0,0.15)" }} />
                      <span style={{ fontSize: 9, fontWeight: 500, color: isActive ? accentRgba(0.5) : "rgba(0,0,0,0.35)", letterSpacing: "0.02em" }}>{fb.questions} Fragen</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirmation bar */}
            {pendingSwitch && (
              <div style={{
                padding: "10px 12px", borderTop: `1px solid ${accentRgba(0.1)}`,
                display: "flex", flexDirection: "column", gap: 8,
                animation: "fbSwConfirm 0.18s cubic-bezier(0.4,0,0.2,1) forwards",
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.45)", letterSpacing: "0.02em" }}>Fragebogen wechseln?</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPendingSwitch(null)} style={{
                    flex: 1, padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                    border: "none",
                    background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                    fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.5)",
                    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
                    transition: "all 0.15s ease",
                  }}>Abbrechen</button>
                  <button onClick={() => { void confirmSwitch(); }} disabled={isSwitching} style={{
                    flex: 1, padding: "6px 10px", borderRadius: 8, border: "none",
                    background: `linear-gradient(to bottom, color-mix(in srgb, ${campaignColor} 70%, white), ${campaignColor})`,
                    cursor: isSwitching ? "wait" : "pointer",
                    fontSize: 9, fontWeight: 600, color: "#fff",
                    boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${campaignColor}, 0 1px 6px ${accentRgba(0.27)}`,
                    transition: "all 0.15s ease",
                    opacity: isSwitching ? 0.7 : 1,
                  }}>{isSwitching ? "Wechsel..." : "Bestätigen"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

// ── Market Visit Mock Data ────────────────────────────────────

const MOCK_MARKET_META: Record<string, { visitedAt: string; duration: number; gm: string }> = {
  m1:  { visitedAt: "2026-02-25T09:14:00", duration: 34, gm: "Thomas Huber" },
  m2:  { visitedAt: "2026-02-25T11:02:00", duration: 28, gm: "Thomas Huber" },
  m5:  { visitedAt: "2026-02-26T08:47:00", duration: 41, gm: "Sandra Mayer" },
  m7:  { visitedAt: "2026-02-26T13:30:00", duration: 22, gm: "Klaus Berger" },
  m8:  { visitedAt: "2026-02-24T10:15:00", duration: 37, gm: "Sandra Mayer" },
  m11: { visitedAt: "2026-02-27T09:00:00", duration: 30, gm: "Thomas Huber" },
  m12: { visitedAt: "2026-02-27T14:20:00", duration: 25, gm: "Klaus Berger" },
  m15: { visitedAt: "2026-02-28T08:30:00", duration: 45, gm: "Anna Fuchs" },
  m16: { visitedAt: "2026-02-28T11:55:00", duration: 19, gm: "Anna Fuchs" },
};

const MOCK_MARKET_ANSWERS: Record<string, Record<string, string | string[]>> = {
  standard: {
    pq1:  "Ja",
    pq2:  "Gut",
    pq3:  ["Aufsteller", "Preisschild", "Plakat"],
    pq4:  JSON.stringify({ sel: "Ja", subs: ["Produkt A vollständig", "Etiketten korrekt", "Mengen stimmen"] }),
    pq5:  "4",
    pq6:  "Frontale Platzierung bei Coca-Cola Classic fehlt im dritten Regalfach. Auffüllung wurde mit dem Marktleiter besprochen.",
    pq7:  "12",
    pq8:  "70",
    pq9:  ["photo_placeholder"],
    pq10: ["Regalordnung: Gut", "Preisgestaltung: Mittel", "Sauberkeit: Gut"],
  },
  flex: {
    fq1:  "Ja",
    fq2:  "Kassenzone",
    fq3:  ["Coca-Cola Classic", "Coca-Cola Zero", "Fanta", "Sprite"],
    fq4:  JSON.stringify({ sel: "Ja", subs: ["Preise korrekt", "Beschilderung vorhanden", "Ware vollständig"] }),
    fq5:  "4",
    fq6:  "Zweitplatzierung sehr gut sichtbar. Kundenfrequenz im Kassenbereich hoch.",
    fq7:  "18",
    fq8:  "80",
    fq9:  ["photo_placeholder"],
    fq10: ["Platzierung: Gut", "Beschilderung: Gut", "Warenbestand: Mittel", "Sauberkeit: Gut"],
  },
  kuehler: {
    kpq1: "Sehr voll",
    kpq2: "Ja",
    kpq3: "Ja",
    kpq4: "Sauber",
    kpq5: "Ja",
    kpq6: "Ja",
  },
  mhd: {
    mpq1: "Ja",
    mpq2: "1–3 Produkte",
    mpq3: "Ja",
    mpq4: "Softdrinks",
    mpq5: "Ja",
    mpq6: "Ja",
    mpq7: "Gut",
  },
  billa: {
    bpq1: "Ja",
    bpq2: "Eingang",
    bpq3: ["Coca-Cola 1.5L", "Coca-Cola Zero 1L", "Fanta 1.5L", "Sprite 1L", "Mezzo Mix 1.5L"],
    bpq4: "Ja",
    bpq5: "Voll bestückt",
    bpq6: "Ja",
    bpq7: ["photo_placeholder"],
    bpq8: "Aktionsfläche sehr gut bestückt. POS-Material vollständig vorhanden.",
  },
};

// ── IPP calculation ───────────────────────────────────────────

function computeIPP(answers: Record<string, string | string[]>, questions: PreviewQuestion[]): number {
  let total = 0;
  let score = 0;
  for (const q of questions) {
    const raw = answers[q.id];
    if (raw === undefined || raw === null) continue;
    total++;
    if (q.type === "yesno") {
      score += (raw === "Ja" || raw === "ja") ? 1 : 0;
    } else if (q.type === "single") {
      const idx = (q.options || []).indexOf(raw as string);
      if (idx === 0) score += 1;
      else if (idx === 1) score += 0.66;
      else if (idx === 2) score += 0.33;
    } else if (q.type === "multiple") {
      const sel = Array.isArray(raw) ? raw : [];
      const total_opts = (q.options || []).length;
      score += total_opts > 0 ? sel.length / total_opts : 0;
    } else if (q.type === "yesnomulti") {
      try { const p = JSON.parse(raw as string); score += (p.sel === "Ja") ? 1 : 0; } catch { score += 0; }
    } else if (q.type === "likert") {
      const v = parseFloat(raw as string);
      const max = q.config?.max || 5;
      score += isNaN(v) ? 0 : v / max;
    } else if (q.type === "slider") {
      const v = parseFloat(raw as string);
      score += isNaN(v) ? 0 : v / 100;
    } else if (q.type === "numeric") {
      const v = parseFloat(raw as string);
      score += (!isNaN(v) && v > 0) ? 1 : 0;
    } else {
      // text, photo, matrix — completion based
      const notEmpty = Array.isArray(raw) ? raw.length > 0 : (raw as string).length > 0;
      score += notEmpty ? 1 : 0;
    }
  }
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}

// ── Answer display renderers ──────────────────────────────────

function AnswerYesNo({ answer, color, options }: { answer: string; color: string; options?: string[] }) {
  const normalizedOptions = (options ?? []).filter((entry) => entry.trim().length > 0);
  const optionSet = normalizedOptions.length > 0 ? normalizedOptions : ["Ja", "Nein"];
  const hex = color.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);
  return (
    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
      {optionSet.map((opt) => {
        const sel = opt === answer;
        return (
          <div key={opt} style={{
            flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 11, fontWeight: 700,
            textAlign: "center",
            background: sel
              ? `linear-gradient(to bottom, rgba(${cr},${cg},${cb},0.18), rgba(${cr},${cg},${cb},0.28))`
              : "rgba(0,0,0,0.04)",
            color: sel ? color : "rgba(0,0,0,0.45)",
            border: sel ? `1px solid rgba(${cr},${cg},${cb},0.35)` : "1px solid rgba(0,0,0,0.07)",
            boxShadow: sel
              ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 3px rgba(${cr},${cg},${cb},0.2)`
              : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            {sel && <Check size={9} strokeWidth={3.5} />}
            {opt}
          </div>
        );
      })}
    </div>
  );
}

// Semantic colors for known fill-level / cleanliness option labels (Kühler-specific)
const OPTION_SEMANTIC_COLORS: Record<string, { dot: string; bg: string; text: string; ring: string }> = {
  "Sehr voll":           { dot: "#22c55e", bg: "rgba(34,197,94,0.08)",   text: "#15803d", ring: "rgba(34,197,94,0.3)"   },
  "Halb voll":           { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)",  text: "#b45309", ring: "rgba(245,158,11,0.3)"  },
  "Nicht voll":          { dot: "#DC2626", bg: "rgba(220,38,38,0.08)",   text: "#b91c1c", ring: "rgba(220,38,38,0.3)"   },
  "Leer":                { dot: "#DC2626", bg: "rgba(220,38,38,0.08)",   text: "#b91c1c", ring: "rgba(220,38,38,0.3)"   },
  "Sauber":              { dot: "#22c55e", bg: "rgba(34,197,94,0.08)",   text: "#15803d", ring: "rgba(34,197,94,0.3)"   },
  "Leicht verschmutzt":  { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)",  text: "#b45309", ring: "rgba(245,158,11,0.3)"  },
  "Stark verschmutzt":   { dot: "#DC2626", bg: "rgba(220,38,38,0.08)",   text: "#b91c1c", ring: "rgba(220,38,38,0.3)"   },
  "Voll bestückt":       { dot: "#22c55e", bg: "rgba(34,197,94,0.08)",   text: "#15803d", ring: "rgba(34,197,94,0.3)"   },
  "Teilweise bestückt":  { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)",  text: "#b45309", ring: "rgba(245,158,11,0.3)"  },
  "Kaum bestückt":       { dot: "#DC2626", bg: "rgba(220,38,38,0.08)",   text: "#b91c1c", ring: "rgba(220,38,38,0.3)"   },
};

function getOptionColor(opt: string, fallbackColor: string) {
  const sem = OPTION_SEMANTIC_COLORS[opt];
  if (sem) return sem;
  const hex = fallbackColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { dot: fallbackColor, bg: `rgba(${r},${g},${b},0.08)`, text: fallbackColor, ring: `rgba(${r},${g},${b},0.3)` };
}

function AnswerSingle({ answer, options, color }: { answer: string; options: string[]; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {options.map((opt) => {
        const sel = opt === answer;
        const oc = getOptionColor(opt, color);
        return (
          <div key={opt} style={{
            padding: "8px 11px", borderRadius: 8, fontSize: 11, fontWeight: sel ? 600 : 500,
            background: sel ? oc.bg : "rgba(0,0,0,0.03)",
            color: sel ? oc.text : "rgba(0,0,0,0.6)",
            boxShadow: sel ? `inset 0 0 0 1px ${oc.ring}` : "none",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
              background: sel ? oc.dot : "transparent",
              border: `2px solid ${sel ? oc.dot : "rgba(0,0,0,0.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {sel && <Check size={8} strokeWidth={3} color="#fff" />}
            </div>
            {opt}
          </div>
        );
      })}
    </div>
  );
}

function AnswerMultiple({ answer, options, color }: { answer: string[]; options: string[]; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {options.map((opt) => {
        const sel = answer.includes(opt);
        const oc = getOptionColor(opt, color);
        return (
          <div key={opt} style={{
            padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: sel ? 600 : 500,
            background: sel ? oc.bg : "rgba(0,0,0,0.03)",
            color: sel ? oc.text : "rgba(0,0,0,0.6)",
            boxShadow: sel ? `inset 0 0 0 1px ${oc.ring}` : "none",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              background: sel ? oc.dot : "transparent",
              border: `2px solid ${sel ? oc.dot : "rgba(0,0,0,0.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {sel && <Check size={8} strokeWidth={3} color="#fff" />}
            </div>
            {opt}
          </div>
        );
      })}
    </div>
  );
}

function AnswerYesNoMulti({ answer, color, config }: { answer: string; color: string; config?: PreviewQuestion["config"] }) {
  const hex = color.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);
  try {
    const parsed = JSON.parse(answer);
    const selAnswer: string = parsed.sel;
    const subs: string[] = parsed.subs || [];
    const branch = config?.branches?.find((bx: { answer: string; options: string[] }) => bx.answer === selAnswer);
    const allBranchOptions: string[] = branch?.options || [];
    return (
      <div style={{ marginTop: 8 }}>
        {/* Primary pills */}
        <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
          {(config?.answers || ["Ja", "Nein"]).map((opt: string) => {
            const sel = opt === selAnswer;
            return (
              <div key={opt} style={{
                flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 11, fontWeight: 700,
                textAlign: "center",
                background: sel
                  ? `linear-gradient(to bottom, rgba(${cr},${cg},${cb},0.18), rgba(${cr},${cg},${cb},0.28))`
                  : "rgba(0,0,0,0.04)",
                color: sel ? color : "rgba(0,0,0,0.45)",
                border: sel ? `1px solid rgba(${cr},${cg},${cb},0.35)` : "1px solid rgba(0,0,0,0.07)",
                boxShadow: sel
                  ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 3px rgba(${cr},${cg},${cb},0.2)`
                  : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                {sel && <Check size={9} strokeWidth={3.5} />}
                {opt}
              </div>
            );
          })}
        </div>
        {/* Branch options tray */}
        {allBranchOptions.length > 0 && (
          <div style={{
            borderRadius: 8, padding: "8px 10px",
            background: "rgba(0,0,0,0.02)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
              {selAnswer === "Ja" ? "Bestätigt" : "Probleme"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {allBranchOptions.map((opt: string) => {
                const sel = subs.includes(opt);
                return (
                  <div key={opt} style={{
                    padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: sel ? 600 : 500,
                    background: sel ? `rgba(${cr},${cg},${cb},0.08)` : "rgba(0,0,0,0.04)",
                    color: sel ? color : "rgba(0,0,0,0.4)",
                    boxShadow: sel ? `inset 0 0 0 1px rgba(${cr},${cg},${cb},0.25)` : "none",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {sel && <Check size={8} strokeWidth={3} />}
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  } catch { return null; }
}

function AnswerLikert({ answer, config }: { answer: string; config: PreviewQuestion["config"] }) {
  const val = parseInt(answer);
  const min = config?.min || 1;
  const max = config?.max || 5;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const getColor = (v: number): string => {
    const t = (v - min) / (max - min);
    if (t <= 0.5) {
      const tt = t * 2;
      const r = Math.round(220 + (234 - 220) * tt);
      const g = Math.round(38 + (179 - 38) * tt);
      const b = Math.round(38 + (8 - 38) * tt);
      return `rgb(${r},${g},${b})`;
    } else {
      const tt = (t - 0.5) * 2;
      const r = Math.round(234 + (22 - 234) * tt);
      const g = Math.round(179 + (163 - 179) * tt);
      const b = Math.round(8 + (74 - 8) * tt);
      return `rgb(${r},${g},${b})`;
    }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {steps.map((v) => {
          const sel = v === val;
          const c = getColor(v);
          const rgb = c.slice(4, -1);
          return (
            <div key={v} style={{
              flex: 1, padding: "5px 2px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
              background: sel
                ? `linear-gradient(to bottom, rgba(${rgb},0.18), rgba(${rgb},0.28))`
                : "rgba(0,0,0,0.03)",
              boxShadow: sel
                ? `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 0 0 1.5px ${c}, 0 1px 3px rgba(${rgb},0.25)`
                : "none",
              color: sel ? c : "rgba(0,0,0,0.3)",
            }}>
              {v}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)" }}>{config?.minLabel}</span>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)" }}>{config?.maxLabel}</span>
      </div>
    </div>
  );
}

function AnswerText({ answer }: { answer: string }) {
  return (
    <div style={{
      marginTop: 6, padding: "7px 12px 7px 11px", borderRadius: 8,
      background: "rgba(0,0,0,0.028)", border: "1px solid rgba(0,0,0,0.06)",
      borderLeft: "3px solid rgba(220,38,38,0.28)",
      maxHeight: 100, overflowY: "auto",
    }}>
      <p style={{ margin: 0, fontSize: 12, color: "#1a1a1a", lineHeight: 1.55, fontWeight: 400 }}>
        {answer}
      </p>
    </div>
  );
}

function AnswerNumeric({ answer, config }: { answer: string; config: PreviewQuestion["config"] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: "inline-flex", alignItems: "baseline", gap: 5,
        padding: "6px 10px", borderRadius: 8,
        background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)",
      }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.03em", lineHeight: 1 }}>{answer}</span>
        {config?.unit && <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.42)" }}>{config.unit}</span>}
      </div>
    </div>
  );
}

function AnswerSlider({ answer, config, color }: { answer: string; config: PreviewQuestion["config"]; color: string }) {
  const val = parseFloat(answer);
  const min = config?.min || 0;
  const max = config?.max || 100;
  const pct = Math.round(((val - min) / (max - min)) * 100);
  const hex = color.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);
  const darker = `rgba(${Math.round(cr * 0.8)},${Math.round(cg * 0.8)},${Math.round(cb * 0.8)},1)`;
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `linear-gradient(to right, ${color}, ${darker})` }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>{answer}{config?.unit || ""}</span>
    </div>
  );
}

type AnswerPhotoEntry = {
  src: string;
  tags: string[];
};

function normalizeReplayPhotoSrc(storagePath: string, storageBucket: string): string {
  const raw = (storagePath ?? "").trim();
  if (!raw) return "";
  if (/^(https?:|data:image\/|blob:|\/)/i.test(raw)) return raw;

  const supabaseBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  if (!supabaseBase || !storageBucket) return raw;

  const normalizedPath = raw.replace(/^\/+/, "");
  const bucketPrefix = `${storageBucket}/`;
  const pathWithinBucket = normalizedPath.toLowerCase().startsWith(bucketPrefix.toLowerCase())
    ? normalizedPath.slice(bucketPrefix.length)
    : normalizedPath;
  return `${supabaseBase}/storage/v1/object/public/${storageBucket}/${pathWithinBucket}`;
}

function AnswerPhoto({ answer }: { answer: AnswerPhotoEntry[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const count = answer.length;
  const visibleCount = Math.min(count, 5);
  const overflow = count - visibleCount;

  const getFileName = (src: string, idx: number) => {
    if (src === "photo_placeholder" || !src) return `Foto ${idx + 1}`;
    if (src.startsWith("data:")) return `Foto ${idx + 1}`;
    try { return decodeURIComponent(src.split("/").pop()?.split("?")[0] || `Foto ${idx + 1}`); } catch { return `Foto ${idx + 1}`; }
  };

  const isReal = (src: string) => src && src !== "photo_placeholder" && (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/") || src.startsWith("blob:"));

  const overlay = lightbox !== null && mounted ? createPortal(
    <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        {isReal(answer[lightbox].src) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={answer[lightbox].src} alt="" style={{ maxWidth: "88vw", maxHeight: "78vh", borderRadius: 14, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", display: "block" }} />
        ) : (
          <div style={{ width: 320, height: 240, borderRadius: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Camera size={32} strokeWidth={1.5} color="rgba(255,255,255,0.35)" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{getFileName(answer[lightbox].src, lightbox)}</span>
          </div>
        )}
        {answer[lightbox].tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "88vw", marginTop: 10 }}>
            {answer[lightbox].tags.map((tag) => (
              <span key={`${lightbox}-${tag}`} style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: "2px 8px" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: -14, right: -14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      {count > 1 && (
        <div style={{ position: "absolute", bottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={(e) => { e.stopPropagation(); setLightbox((i) => i !== null ? (i - 1 + count) % count : 0); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600 }}>{(lightbox ?? 0) + 1} / {count}</span>
          <button onClick={(e) => { e.stopPropagation(); setLightbox((i) => i !== null ? (i + 1) % count : 0); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {Array.from({ length: visibleCount }).map((_, i) => {
          const entry = answer[i];
          const name = getFileName(entry.src, i);
          const real = isReal(entry.src);
          return (
            <div
              key={i}
              onClick={() => setLightbox(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ position: "relative", cursor: "pointer" }}
            >
              {/* Tile */}
              <div style={{
                height: 34, maxWidth: 120, minWidth: 60, padding: "0 10px",
                borderRadius: 7, background: hovered === i ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${hovered === i ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.08)"}`,
                display: "flex", alignItems: "center", gap: 6,
                transition: "background 0.15s, border-color 0.15s",
              }}>
                <Camera size={11} strokeWidth={1.8} color="rgba(0,0,0,0.35)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{name}</span>
              </div>
              {entry.tags.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 140 }}>
                  {entry.tags.slice(0, 2).map((tag) => (
                    <span key={`${i}-${tag}`} style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.48)", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 999, padding: "1px 5px" }}>
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 2 && (
                    <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>+{entry.tags.length - 2}</span>
                  )}
                </div>
              )}
              {/* Hover preview */}
              {hovered === i && real && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                  zIndex: 9999, borderRadius: 9, overflow: "hidden",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.2)", border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fff", padding: 3, pointerEvents: "none",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.src} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 7, display: "block" }} />
                </div>
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <div style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,0,0,0.07)" }}>+{overflow}</div>
        )}
      </div>
      {overlay}
    </>
  );
}

function AnswerMatrix({ answer, config, color }: { answer: string[] | Record<string, string>; config: PreviewQuestion["config"]; color: string }) {
  const rows = config?.rows || [];
  const cols = config?.columns || [];
  const subtype = String(config?.matrixSubtype ?? "toggle");
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const answerMap = !Array.isArray(answer) ? answer : {};
  const formatDate = (raw: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return raw;
    return `${match[3]}.${match[2]}.${match[1]}`;
  };
  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
        <thead>
          <tr>
            <th style={{ width: 88, padding: "3px 6px", textAlign: "left", fontSize: 8, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}></th>
            {cols.map((col) => (
              <th key={col} style={{ padding: "3px 4px", textAlign: "center", fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.4)", letterSpacing: "0.02em" }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td style={{ width: 88, padding: "4px 6px", fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.65)" }}>{row}</td>
              {cols.map((col) => {
                const key = `${row}: ${col}`;
                const sel = Array.isArray(answer) && answer.includes(key);
                const cellValue = answerMap[key] ?? "";
                return (
                  <td key={col} style={{ textAlign: "center", padding: "2px" }}>
                    <div style={{
                      minWidth: subtype === "toggle" ? 28 : 74,
                      minHeight: 28,
                      borderRadius: 6,
                      margin: "0 auto",
                      padding: subtype === "toggle" ? 0 : "6px 7px",
                      background: subtype === "toggle"
                        ? sel ? `rgba(${r},${g},${b},0.10)` : "rgba(0,0,0,0.03)"
                        : cellValue ? `rgba(${r},${g},${b},0.08)` : "rgba(0,0,0,0.03)",
                      boxShadow: subtype === "toggle"
                        ? sel ? `inset 0 0 0 1.5px rgba(${r},${g},${b},0.4)` : "inset 0 0 0 1px rgba(0,0,0,0.07)"
                        : cellValue ? `inset 0 0 0 1px rgba(${r},${g},${b},0.24)` : "inset 0 0 0 1px rgba(0,0,0,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {subtype === "toggle" ? (
                        sel && <span style={{ fontSize: 9, fontWeight: 700, color, lineHeight: 1 }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 600, color: cellValue ? "#1f2937" : "rgba(0,0,0,0.24)", lineHeight: 1.15 }}>
                          {cellValue ? (subtype === "datum" ? formatDate(cellValue) : cellValue) : "—"}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Market Visit Detail ───────────────────────────────────────

function MarketVisitDetailSkeleton({
  market,
  campaignColor,
  loading,
  error,
  onRetry,
  onClose,
}: {
  market: MarketCatalogItem;
  campaignColor: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      background: "#fff", display: "flex", flexDirection: "column",
      animation: "mvdSlideIn 0.28s cubic-bezier(0.4,0,0.2,1) forwards",
    }}>
      <style>{`
        @keyframes mvdSlideIn { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes mvdSkeletonPulse { 0%, 100% { opacity: 0.48; } 50% { opacity: 0.86; } }
        .mvd-skeleton {
          position: relative;
          overflow: hidden;
          background: rgba(0,0,0,0.075);
          animation: mvdSkeletonPulse 1.45s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        flexShrink: 0, padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", position: "sticky", top: 0, zIndex: 2,
      }}>
        <button onClick={onClose} style={{
          width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
          background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(0,0,0,0.45)", flexShrink: 0,
        }}>
          <ChevronLeft size={15} strokeWidth={2.2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: campaignColor }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{market.name}</span>
          </div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{market.address}</div>
        </div>
        <div className="mvd-skeleton" style={{ width: 56, height: 18, borderRadius: 7 }} />
        <div className="mvd-skeleton" style={{ width: 64, height: 18, borderRadius: 7 }} />
        <div className="mvd-skeleton" style={{ width: 44, height: 18, borderRadius: 7 }} />
      </div>

      <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "7px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#fff" }}>
        {[82, 58, 74, 64].map((width, index) => (
          <div key={index} className="mvd-skeleton" style={{ width, height: 24, borderRadius: 7 }} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px", background: "linear-gradient(180deg, rgba(0,0,0,0.012), #fff 120px)" }}>
        {error ? (
          <div style={{
            borderRadius: 12,
            border: "1px solid rgba(220,38,38,0.14)",
            background: "rgba(220,38,38,0.04)",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c" }}>{error}</span>
            <button
              onClick={onRetry}
              disabled={loading}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                background: "linear-gradient(to bottom, #111827, #020617)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(2,6,23,0.9), 0 4px 12px rgba(2,6,23,0.16)",
                opacity: loading ? 0.75 : 1,
              }}
            >
              Erneut laden
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.05)",
                  background: "#fff",
                  padding: "12px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.025)",
                }}
              >
                <div className="mvd-skeleton" style={{ width: `${68 - (index % 3) * 10}%`, height: 10, borderRadius: 99, marginBottom: 10 }} />
                <div className="mvd-skeleton" style={{ width: `${38 + (index % 4) * 8}%`, height: 22, borderRadius: 7 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarketVisitDetail({
  market,
  campaignColor,
  visitSummary,
  onVisitUpdated,
  onClose,
}: {
  market: MarketCatalogItem;
  campaignColor: string;
  visitSummary: CampaignMarketVisitSummary | null;
  onVisitUpdated: () => Promise<void>;
  onClose: () => void;
}) {
  type SessionQuestionView = PreviewQuestion & {
    answerStatus: "unanswered" | "answered" | "invalid" | "hidden_by_rule" | "skipped";
    validationError: string | null;
    rawAnswer: string | string[] | Record<string, string> | AnswerPhotoEntry[] | undefined;
    comment: string;
  };

  const sections = visitSummary?.sections ?? [];
  const mappedQuestions = useMemo<SessionQuestionView[]>(() => {
    const result: SessionQuestionView[] = [];
    for (const section of sections) {
      for (const question of section.questions) {
        const optionValues = Array.isArray((question.config ?? {}).options)
          ? (question.config.options as string[])
          : [];
        const yesNoAnswers = Array.isArray((question.config ?? {}).answers)
          ? (question.config.answers as string[])
          : [];
        let rawAnswer: SessionQuestionView["rawAnswer"] = undefined;
        if (question.answer) {
          if (question.type === "multiple") {
            rawAnswer = (question.answer.options ?? [])
              .filter((opt) => opt.optionRole === "sub")
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((opt) => opt.optionValue);
          } else if (question.type === "yesnomulti") {
            const top = (question.answer.options ?? []).find((opt) => opt.optionRole === "top")?.optionValue ?? "";
            const subs = (question.answer.options ?? [])
              .filter((opt) => opt.optionRole === "sub")
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((opt) => opt.optionValue);
            rawAnswer = top ? JSON.stringify({ sel: top, subs }) : undefined;
          } else if (question.type === "matrix") {
            const subtype = String((question.config ?? {}).matrixSubtype ?? "toggle");
            if (subtype === "toggle") {
              rawAnswer = (question.answer.matrixCells ?? [])
                .filter((cell) => cell.cellSelected)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((cell) => `${cell.rowKey}: ${cell.columnKey}`);
            } else if (subtype === "datum") {
              rawAnswer = Object.fromEntries(
                (question.answer.matrixCells ?? [])
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((cell) => [`${cell.rowKey}: ${cell.columnKey}`, cell.cellValueDate ?? ""]),
              );
            } else {
              rawAnswer = Object.fromEntries(
                (question.answer.matrixCells ?? [])
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((cell) => [`${cell.rowKey}: ${cell.columnKey}`, cell.cellValueText ?? ""]),
              );
            }
          } else if (question.type === "photo") {
            rawAnswer = (question.answer.photos ?? []).map((photo) => ({
              src: normalizeReplayPhotoSrc(photo.storagePath, photo.storageBucket),
              tags: (photo.tags ?? [])
                .map((tag) => tag.photoTagLabelSnapshot)
                .filter((label) => label.trim().length > 0),
            }));
          } else if (question.type === "numeric" || question.type === "slider" || question.type === "likert") {
            rawAnswer = question.answer.valueNumber ?? question.answer.valueText ?? undefined;
          } else {
            rawAnswer = question.answer.valueText ?? undefined;
          }
        }

        result.push({
          id: question.id,
          type: question.type,
          text: question.text,
          required: question.required,
          moduleId: question.moduleId || `${section.id}-${question.id}`,
          moduleName: question.moduleName || "Modul",
          options: optionValues.length > 0 ? optionValues : undefined,
          config: {
            min: typeof question.config.min === "number" ? question.config.min : undefined,
            max: typeof question.config.max === "number" ? question.config.max : undefined,
            minLabel: typeof question.config.minLabel === "string" ? question.config.minLabel : undefined,
            maxLabel: typeof question.config.maxLabel === "string" ? question.config.maxLabel : undefined,
            step: typeof question.config.step === "number" ? question.config.step : undefined,
            unit: typeof question.config.unit === "string" ? question.config.unit : undefined,
            decimals: typeof question.config.decimals === "boolean" ? question.config.decimals : undefined,
            instruction: typeof question.config.instruction === "string" ? question.config.instruction : undefined,
            rows: Array.isArray(question.config.rows) ? (question.config.rows as string[]) : undefined,
            columns: Array.isArray(question.config.columns) ? (question.config.columns as string[]) : undefined,
            answers: yesNoAnswers.length > 0 ? yesNoAnswers : undefined,
            branches: Array.isArray(question.config.branches) ? (question.config.branches as { answer: string; options: string[] }[]) : undefined,
            matrixSubtype: typeof question.config.matrixSubtype === "string" ? question.config.matrixSubtype : undefined,
          },
          rules: [],
          answerStatus: question.answer?.answerStatus ?? "unanswered",
          validationError: question.answer?.validationError ?? null,
          rawAnswer,
          comment: question.comment ?? "",
        });
      }
    }
    return result.filter((question) => {
      const source = sections
        .flatMap((section) => section.questions)
        .find((entry) => entry.id === question.id);
      return source?.visibility?.isVisibleAtSubmit ?? true;
    });
  }, [sections]);

  const questions = mappedQuestions;

  const answerByQuestionId = useMemo(() => {
    const mapped: Record<string, SessionQuestionView["rawAnswer"]> = {};
    for (const question of questions) {
      mapped[question.id] = question.rawAnswer;
    }
    return mapped;
  }, [questions]);

  const answeredCount = useMemo(
    () => questions.filter((question) => question.answerStatus === "answered").length,
    [questions],
  );

  const submittedAtRaw = visitSummary?.submittedAt ?? visitSummary?.startedAt ?? null;
  const visitDate = submittedAtRaw ? new Date(submittedAtRaw).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const visitTime = submittedAtRaw ? new Date(submittedAtRaw).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }) : "—";

  const hex = campaignColor.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);

  // Group questions by module
  const modules: { id: string; name: string; questions: SessionQuestionView[] }[] = [];
  for (const q of questions) {
    const existing = modules.find((m) => m.id === q.moduleId);
    if (existing) existing.questions.push(q);
    else modules.push({ id: q.moduleId, name: q.moduleName, questions: [q] });
  }

  const [activeModule, setActiveModule] = useState<string>(modules[0]?.id || "");
  const bodyRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // IntersectionObserver: track which module section is in view
  useEffect(() => {
    if (!bodyRef.current) return;
    const observers: IntersectionObserver[] = [];
    modules.forEach((mod) => {
      const el = moduleRefs.current[mod.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveModule(mod.id); },
        { root: bodyRef.current, rootMargin: "-10px 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules.map((m) => m.id).join(",")]);

  // Scroll active tab into view in the nav bar
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !activeModule) return;
    const btn = nav.querySelector<HTMLElement>(`[data-mod="${activeModule}"]`);
    if (btn) btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeModule]);

  const scrollToModule = (modId: string) => {
    const el = moduleRefs.current[modId];
    const body = bodyRef.current;
    if (!el || !body) return;
    const elTop = el.getBoundingClientRect().top;
    const bodyTop = body.getBoundingClientRect().top;
    const target = body.scrollTop + (elTop - bodyTop) - 8;
    body.scrollTo({ top: target, behavior: "smooth" });
  };

  type YesNoMultiDraft = { sel: string; subs: string[] };
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<SessionQuestionView["rawAnswer"] | YesNoMultiDraft>(undefined);
  const [draftComment, setDraftComment] = useState("");
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [saveErrorByQuestionId, setSaveErrorByQuestionId] = useState<Record<string, string>>({});

  const parseYesNoMultiDraft = useCallback((value: SessionQuestionView["rawAnswer"]): YesNoMultiDraft => {
    if (typeof value === "string" && value.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(value) as { sel?: unknown; subs?: unknown };
        const sel = typeof parsed.sel === "string" ? parsed.sel : "";
        const subs = Array.isArray(parsed.subs)
          ? parsed.subs.filter((entry): entry is string => typeof entry === "string")
          : [];
        return { sel, subs };
      } catch {
        return { sel: "", subs: [] };
      }
    }
    return { sel: "", subs: [] };
  }, []);

  const normalizeDraftAnswer = useCallback((question: SessionQuestionView): SessionQuestionView["rawAnswer"] | YesNoMultiDraft => {
    const raw = question.rawAnswer;
    if (question.type === "yesnomulti") {
      return parseYesNoMultiDraft(raw);
    }
    if (question.type === "multiple" || (question.type === "matrix" && String(question.config?.matrixSubtype ?? "toggle") === "toggle")) {
      return Array.isArray(raw)
        ? raw.filter((entry): entry is string => typeof entry === "string")
        : [];
    }
    if (question.type === "matrix") {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
        );
      }
      return {};
    }
    if (raw && typeof raw === "object") {
      return undefined;
    }
    return raw;
  }, [parseYesNoMultiDraft]);

  const startEditingQuestion = useCallback((question: SessionQuestionView) => {
    if (question.type === "photo") return;
    setEditingQuestionId(question.id);
    setDraftAnswer(normalizeDraftAnswer(question));
    setDraftComment(question.comment ?? "");
    setSaveErrorByQuestionId((current) => {
      if (!current[question.id]) return current;
      const next = { ...current };
      delete next[question.id];
      return next;
    });
  }, [normalizeDraftAnswer]);

  const cancelEditingQuestion = useCallback(() => {
    setEditingQuestionId(null);
    setDraftAnswer(undefined);
    setDraftComment("");
    setSavingQuestionId(null);
  }, []);

  const buildPatchAnswerPayload = useCallback((question: SessionQuestionView): unknown => {
    if (question.type === "yesnomulti") {
      const draft = (draftAnswer && typeof draftAnswer === "object" && !Array.isArray(draftAnswer) && "sel" in draftAnswer && "subs" in draftAnswer)
        ? (draftAnswer as YesNoMultiDraft)
        : { sel: "", subs: [] };
      return JSON.stringify({
        sel: typeof draft.sel === "string" ? draft.sel : "",
        subs: Array.isArray(draft.subs) ? draft.subs.filter((entry): entry is string => typeof entry === "string") : [],
      });
    }
    if (question.type === "multiple") {
      return Array.isArray(draftAnswer)
        ? draftAnswer.filter((entry): entry is string => typeof entry === "string")
        : [];
    }
    if (question.type === "matrix") {
      const subtype = String(question.config?.matrixSubtype ?? "toggle");
      if (subtype === "toggle") {
        return Array.isArray(draftAnswer)
          ? draftAnswer.filter((entry): entry is string => typeof entry === "string")
          : [];
      }
      const matrixMap = draftAnswer && typeof draftAnswer === "object" && !Array.isArray(draftAnswer)
        ? Object.fromEntries(
            Object.entries(draftAnswer as Record<string, unknown>).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
          )
        : {};
      return JSON.stringify(matrixMap);
    }
    if (question.type === "likert" || question.type === "numeric" || question.type === "slider") {
      if (typeof draftAnswer === "number") return String(draftAnswer);
      if (typeof draftAnswer === "string") return draftAnswer;
      return "";
    }
    if (typeof draftAnswer === "string") return draftAnswer;
    return "";
  }, [draftAnswer]);

  const saveQuestionEdit = useCallback(async (question: SessionQuestionView) => {
    if (!visitSummary?.sessionId || savingQuestionId) return;
    setSavingQuestionId(question.id);
    setSaveErrorByQuestionId((current) => {
      if (!current[question.id]) return current;
      const next = { ...current };
      delete next[question.id];
      return next;
    });
    try {
      await patchCampaignVisitAnswer({
        sessionId: visitSummary.sessionId,
        visitQuestionId: question.id,
        answer: buildPatchAnswerPayload(question),
        comment: draftComment,
      });
      await onVisitUpdated();
      setEditingQuestionId(null);
      setDraftAnswer(undefined);
      setDraftComment("");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden.";
      if (error instanceof BackendApiError && error.code === "visit_edit_incomplete_required") {
        const data = (error.data ?? {}) as { missingRequired?: CampaignVisitAnswerPatchMissingRequired[] };
        const first = Array.isArray(data.missingRequired) ? data.missingRequired[0] : null;
        const firstLabel = first && typeof first.questionText === "string" ? first.questionText : null;
        message = firstLabel
          ? `Regelkonflikt: Pflichtfrage fehlt nach Änderung (${firstLabel}).`
          : "Regelkonflikt: Pflichtfragen wären nach der Änderung unvollständig.";
      }
      setSaveErrorByQuestionId((current) => ({ ...current, [question.id]: message }));
    } finally {
      setSavingQuestionId(null);
    }
  }, [buildPatchAnswerPayload, draftComment, onVisitUpdated, savingQuestionId, visitSummary?.sessionId]);

  const renderEditControls = (q: SessionQuestionView) => {
    const commonInputStyle: React.CSSProperties = {
      width: "100%",
      borderRadius: 7,
      border: "1px solid rgba(0,0,0,0.13)",
      background: "#fff",
      color: "#1a1a1a",
      fontSize: 10.5,
      fontWeight: 500,
      padding: "6px 8px",
      outline: "none",
      fontFamily: "inherit",
    };
    const chipButtonStyle = (active: boolean): React.CSSProperties => ({
      borderRadius: 7,
      border: active ? `1px solid ${campaignColor}` : "1px solid rgba(0,0,0,0.12)",
      background: active ? `linear-gradient(to bottom, ${campaignColor}20, ${campaignColor}12)` : "#fff",
      color: active ? "#1a1a1a" : "rgba(0,0,0,0.62)",
      fontSize: 10,
      fontWeight: active ? 700 : 600,
      padding: "4px 8px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      transition: "all 0.12s ease",
    });

    const renderInlineEditor = () => {
      if (q.type === "yesno" || q.type === "single") {
        const options = q.type === "yesno"
          ? (Array.isArray(q.config?.answers) && q.config.answers.length > 0 ? q.config.answers : q.options ?? ["Ja", "Nein"])
          : (q.options ?? []);
        const selected = typeof draftAnswer === "string" ? draftAnswer : "";
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDraftAnswer(option)}
                style={chipButtonStyle(selected === option)}
              >
                {option}
              </button>
            ))}
            <button type="button" onClick={() => setDraftAnswer("")} style={chipButtonStyle(selected.length === 0)}>
              Keine Antwort
            </button>
          </div>
        );
      }

      if (q.type === "multiple") {
        const selected = new Set(
          Array.isArray(draftAnswer)
            ? draftAnswer.filter((entry): entry is string => typeof entry === "string")
            : [],
        );
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(q.options ?? []).map((option) => {
              const active = selected.has(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    if (next.has(option)) next.delete(option);
                    else next.add(option);
                    setDraftAnswer(Array.from(next));
                  }}
                  style={chipButtonStyle(active)}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, border: active ? `1px solid ${campaignColor}` : "1px solid rgba(0,0,0,0.24)", background: active ? campaignColor : "#fff" }} />
                  {option}
                </button>
              );
            })}
          </div>
        );
      }

      if (q.type === "yesnomulti") {
        const draft = (draftAnswer && typeof draftAnswer === "object" && !Array.isArray(draftAnswer) && "sel" in draftAnswer && "subs" in draftAnswer)
          ? (draftAnswer as YesNoMultiDraft)
          : { sel: "", subs: [] };
        const topOptions = Array.isArray(q.config?.answers) && q.config.answers.length > 0
          ? q.config.answers
          : (q.options ?? []);
        const branches = Array.isArray(q.config?.branches) ? q.config.branches : [];
        const branchOptions = branches.find((entry) => entry.answer === draft.sel)?.options ?? [];
        const subSet = new Set(draft.subs);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {topOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraftAnswer({ sel: option, subs: [] })}
                  style={chipButtonStyle(draft.sel === option)}
                >
                  {option}
                </button>
              ))}
              <button type="button" onClick={() => setDraftAnswer({ sel: "", subs: [] })} style={chipButtonStyle(draft.sel.length === 0)}>
                Keine Antwort
              </button>
            </div>
            {branchOptions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {branchOptions.map((option) => {
                  const active = subSet.has(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        const next = new Set(subSet);
                        if (next.has(option)) next.delete(option);
                        else next.add(option);
                        setDraftAnswer({ sel: draft.sel, subs: Array.from(next) });
                      }}
                      style={chipButtonStyle(active)}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 3, border: active ? `1px solid ${campaignColor}` : "1px solid rgba(0,0,0,0.24)", background: active ? campaignColor : "#fff" }} />
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      if (q.type === "text") {
        return (
          <textarea
            rows={3}
            value={typeof draftAnswer === "string" ? draftAnswer : ""}
            onChange={(event) => setDraftAnswer(event.target.value)}
            style={{ ...commonInputStyle, resize: "vertical", minHeight: 66, lineHeight: 1.4 }}
          />
        );
      }

      if (q.type === "slider") {
        const min = typeof q.config?.min === "number" ? q.config.min : 0;
        const max = typeof q.config?.max === "number" ? q.config.max : 100;
        const step = typeof q.config?.step === "number" ? q.config.step : 1;
        const value = Number(typeof draftAnswer === "string" ? draftAnswer : "");
        const safeValue = Number.isFinite(value) ? value : min;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={safeValue}
              onChange={(event) => setDraftAnswer(event.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={typeof draftAnswer === "string" ? draftAnswer : ""}
              onChange={(event) => setDraftAnswer(event.target.value)}
              style={{ ...commonInputStyle, width: 88, padding: "5px 7px" }}
            />
          </div>
        );
      }

      if (q.type === "likert") {
        const min = typeof q.config?.min === "number" ? q.config.min : 1;
        const max = typeof q.config?.max === "number" ? q.config.max : 5;
        if (Number.isInteger(min) && Number.isInteger(max) && max - min <= 10) {
          const selected = typeof draftAnswer === "string" ? draftAnswer : "";
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from({ length: max - min + 1 }).map((_, idx) => {
                const value = String(min + idx);
                return (
                  <button key={value} type="button" onClick={() => setDraftAnswer(value)} style={chipButtonStyle(selected === value)}>
                    {value}
                  </button>
                );
              })}
              <button type="button" onClick={() => setDraftAnswer("")} style={chipButtonStyle(selected.length === 0)}>
                Keine Antwort
              </button>
            </div>
          );
        }
      }

      if (q.type === "numeric" || q.type === "likert") {
        const min = typeof q.config?.min === "number" ? q.config.min : undefined;
        const max = typeof q.config?.max === "number" ? q.config.max : undefined;
        const step = q.type === "numeric"
          ? (q.config?.decimals ? 0.01 : 1)
          : 1;
        return (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={typeof draftAnswer === "string" || typeof draftAnswer === "number" ? String(draftAnswer) : ""}
            onChange={(event) => setDraftAnswer(event.target.value)}
            style={commonInputStyle}
            inputMode="decimal"
            placeholder="Wert eingeben"
          />
        );
      }

      if (q.type === "matrix") {
        const rows = q.config?.rows ?? [];
        const columns = q.config?.columns ?? [];
        const subtype = String(q.config?.matrixSubtype ?? "toggle");
        if (rows.length === 0 || columns.length === 0) {
          return <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Matrix ohne Rows/Columns.</div>;
        }
        if (subtype === "toggle") {
          const selected = new Set(
            Array.isArray(draftAnswer)
              ? draftAnswer.filter((entry): entry is string => typeof entry === "string")
              : [],
          );
          return (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row}>
                      <td style={{ fontSize: 10, color: "rgba(0,0,0,0.6)", paddingRight: 6, whiteSpace: "nowrap" }}>{row}</td>
                      {columns.map((column) => {
                        const key = `${row}: ${column}`;
                        const active = selected.has(key);
                        return (
                          <td key={column} style={{ textAlign: "center" }}>
                            <label style={{ ...chipButtonStyle(active), padding: "4px 7px", gap: 5 }}>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => {
                                  const next = new Set(selected);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  setDraftAnswer(Array.from(next));
                                }}
                                style={{ margin: 0 }}
                              />
                              {column}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const matrixMap = draftAnswer && typeof draftAnswer === "object" && !Array.isArray(draftAnswer)
          ? { ...(draftAnswer as Record<string, string>) }
          : {};
        return (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
              <tbody>
                {rows.map((row) => (
                  <tr key={row}>
                    <td style={{ fontSize: 10, color: "rgba(0,0,0,0.6)", paddingRight: 6, whiteSpace: "nowrap" }}>{row}</td>
                    {columns.map((column) => {
                      const key = `${row}: ${column}`;
                      const value = typeof matrixMap[key] === "string" ? matrixMap[key] : "";
                      return (
                        <td key={column}>
                          <input
                            type={subtype === "datum" ? "date" : "text"}
                            value={value}
                            onChange={(event) => {
                              const next = { ...matrixMap, [key]: event.target.value };
                              setDraftAnswer(next);
                            }}
                            style={{ ...commonInputStyle, minWidth: 110, padding: "5px 7px" }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Dieser Fragetyp ist hier nicht editierbar.</div>;
    };

    return (
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
        {renderInlineEditor()}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            value={draftComment}
            onChange={(event) => setDraftComment(event.target.value)}
            maxLength={4000}
            style={{ ...commonInputStyle, flex: 1, padding: "5px 8px" }}
            placeholder="Kommentar (optional)"
          />
          <button
            type="button"
            onClick={cancelEditingQuestion}
            disabled={savingQuestionId === q.id}
            style={{
              padding: "5px 8px",
              borderRadius: 7,
              border: "none",
              background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.5)",
              fontSize: 10,
              fontWeight: 600,
              cursor: savingQuestionId === q.id ? "not-allowed" : "pointer",
              opacity: savingQuestionId === q.id ? 0.75 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => { void saveQuestionEdit(q); }}
            disabled={savingQuestionId === q.id}
            style={{
              padding: "5px 9px",
              borderRadius: 7,
              border: "none",
              background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
              boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              cursor: savingQuestionId === q.id ? "not-allowed" : "pointer",
              opacity: savingQuestionId === q.id ? 0.85 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {savingQuestionId === q.id ? "Speichern..." : "Speichern"}
          </button>
        </div>
        {saveErrorByQuestionId[q.id] && (
          <div style={{ fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>
            {saveErrorByQuestionId[q.id]}
          </div>
        )}
      </div>
    );
  };

  const renderAnswer = (q: SessionQuestionView) => {
    const raw = answerByQuestionId[q.id];
    if (q.answerStatus === "invalid") {
      return (
        <p style={{ margin: "6px 0 0", fontSize: 10, color: "#DC2626", fontWeight: 600 }}>
          Ungültige Antwort{q.validationError ? `: ${q.validationError}` : ""}
        </p>
      );
    }
    if (raw === undefined) return <p style={{ margin: "6px 0 0", fontSize: 10, color: "rgba(0,0,0,0.3)", fontStyle: "italic" }}>Keine Antwort</p>;
    switch (q.type) {
      case "yesno": {
        const options = Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : Array.isArray(q.config?.answers)
            ? q.config.answers
            : undefined;
        return <AnswerYesNo answer={raw as string} color={campaignColor} options={options} />;
      }
      case "single": return <AnswerSingle answer={raw as string} options={q.options || []} color={campaignColor} />;
      case "multiple":
        return (
          <AnswerMultiple
            answer={Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : []}
            options={q.options || []}
            color={campaignColor}
          />
        );
      case "yesnomulti": return <AnswerYesNoMulti answer={raw as string} color={campaignColor} config={q.config} />;
      case "likert": return <AnswerLikert answer={raw as string} config={q.config} />;
      case "text": return <AnswerText answer={raw as string} />;
      case "numeric": return <AnswerNumeric answer={raw as string} config={q.config} />;
      case "slider": return <AnswerSlider answer={raw as string} config={q.config} color={campaignColor} />;
      case "photo": return <AnswerPhoto answer={Array.isArray(raw) ? (raw as AnswerPhotoEntry[]) : []} />;
      case "matrix": return <AnswerMatrix answer={raw as string[] | Record<string, string>} config={q.config} color={campaignColor} />;
      default: return null;
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40,
      background: "#fff", display: "flex", flexDirection: "column",
      animation: "mvdSlideIn 0.28s cubic-bezier(0.4,0,0.2,1) forwards",
    }}>
      <style>{`
        @keyframes mvdSlideIn { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        .mvd-nav::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Sticky header */}
      <div style={{
        flexShrink: 0, padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", position: "sticky", top: 0, zIndex: 2,
      }}>
        <button onClick={onClose} style={{
          width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
          background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "background 0.15s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{market.name}</div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>{market.region}</div>
        </div>
        {visitSummary?.hasSubmittedVisit && (
          <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Fragen</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{answeredCount}/{questions.length}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Besuch</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{visitDate} · {visitTime}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Dauer</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{visitSummary.durationMinutes ?? "—"} Min</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>GM</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{visitSummary.gmName ?? market.gm}</div>
            </div>
          </div>
        )}
      </div>

      {/* Module nav bar */}
      <div
        ref={navRef}
        className="mvd-nav"
        style={{
          flexShrink: 0, display: "flex", gap: 2, padding: "7px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          background: "#fff", overflowX: "auto", scrollbarWidth: "none",
          position: "sticky", top: 57, zIndex: 2,
        }}
      >
        {modules.map((mod) => {
          const active = mod.id === activeModule;
          return (
            <button
              key={mod.id}
              data-mod={mod.id}
              onClick={() => scrollToModule(mod.id)}
              style={{
                flexShrink: 0, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 10, fontWeight: active ? 700 : 500,
                background: active ? `rgba(${cr},${cg},${cb},0.09)` : "transparent",
                color: active ? campaignColor : "rgba(0,0,0,0.4)",
                transition: "background 0.18s, color 0.18s",
                letterSpacing: active ? "-0.01em" : "0",
                boxShadow: active ? `inset 0 0 0 1px rgba(${cr},${cg},${cb},0.22)` : "none",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              {mod.name}
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "16px 16px 24px" }}>
        <style>{`.mvdBody::-webkit-scrollbar { display: none; }`}</style>

        {/* Questions by module */}
        {modules.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontWeight: 600 }}>Keine sichtbaren Fragen für diesen Besuch.</span>
          </div>
        ) : modules.map((mod, modIdx) => (
          <div
            key={mod.id}
            ref={(el) => { moduleRefs.current[mod.id] = el; }}
            style={{ marginBottom: modIdx < modules.length - 1 ? 20 : 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 12, borderRadius: 99, background: campaignColor, flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{mod.name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {mod.questions.map((q) => (
                <div key={q.id} style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.05)",
                  marginBottom: 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, color: `rgba(${cr},${cg},${cb},0.6)`,
                      background: `rgba(${cr},${cg},${cb},0.08)`, padding: "1px 4px", borderRadius: 3,
                      flexShrink: 0, marginTop: 2, letterSpacing: "0.03em",
                    }}>
                      {questions.indexOf(q) + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, flex: 1 }}>
                        {q.text}
                        {q.required && <span style={{ color: campaignColor, marginLeft: 3, fontSize: 9 }}>*</span>}
                      </p>
                      {q.type !== "photo" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingQuestionId === q.id) {
                              cancelEditingQuestion();
                              return;
                            }
                            startEditingQuestion(q);
                          }}
                          disabled={Boolean(savingQuestionId)}
                          style={{
                            flexShrink: 0,
                            padding: "4px 8px",
                            borderRadius: 7,
                            border: editingQuestionId === q.id ? "none" : "1px solid rgba(0,0,0,0.11)",
                            background: editingQuestionId === q.id ? `linear-gradient(to bottom, ${campaignColor}, ${campaignColor})` : "#fff",
                            color: editingQuestionId === q.id ? "#fff" : "rgba(0,0,0,0.56)",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: savingQuestionId ? "not-allowed" : "pointer",
                            opacity: savingQuestionId ? 0.7 : 1,
                          }}
                        >
                          {editingQuestionId === q.id ? "Schließen" : "Bearbeiten"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ paddingLeft: 22 }}>
                    {editingQuestionId === q.id ? renderEditControls(q) : renderAnswer(q)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Region progress bar ───────────────────────────────────────

function CampaignReassignModal({
  campaign,
  groups,
  gmUsers,
  values,
  loadingGms,
  gmUsersError,
  submitting,
  changedCount,
  onChange,
  onClose,
  onSubmit,
}: {
  campaign: Campaign;
  groups: CampaignGmReassignGroup[];
  gmUsers: GMRecord[];
  values: Record<string, string>;
  loadingGms: boolean;
  gmUsersError: string | null;
  submitting: boolean;
  changedCount: number;
  onChange: (sourceGmUserId: string, targetGmUserId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const totalMarkets = groups.reduce((sum, group) => sum + group.marketCount, 0);
  const totalTargets = groups.reduce((sum, group) => sum + group.visitTargetCount, 0);
  const sortedGmUsers = useMemo(
    () => [...gmUsers].sort((a, b) => getGmDisplayName(a).localeCompare(getGmDisplayName(b), "de")),
    [gmUsers],
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9900,
        background: "rgba(15,23,42,0.28)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.075)",
          boxShadow: "0 24px 70px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.06)",
          overflow: "hidden",
          fontFamily: "inherit",
          color: "#1a1a1a",
        }}
      >
        <div style={{ padding: "18px 18px 15px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 14, alignItems: "flex-start", background: "#fff" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.30)" }}>
              Kampagne umtauschen
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25 }}>
              {campaign.name}
            </div>
            <div style={{ marginTop: 5, fontSize: 10.5, fontWeight: 500, lineHeight: 1.45, color: "rgba(0,0,0,0.46)" }}>
              Märkte werden je GM vollständig an den ausgewählten neuen GM übergeben.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <MiniMetric label="GMs" value={groups.length.toLocaleString("de-AT")} />
            <MiniMetric label="Märkte" value={totalMarkets.toLocaleString("de-AT")} />
            <MiniMetric label="Ziel-Visits" value={totalTargets.toLocaleString("de-AT")} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              border: "none",
              background: "rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: submitting ? "not-allowed" : "pointer",
              color: "rgba(0,0,0,0.45)",
              flexShrink: 0,
              boxShadow: "none",
              transition: "all 0.12s",
            }}
            onMouseEnter={(event) => { if (!submitting) event.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ padding: "14px 16px", overflowY: "auto", background: "#fff" }}>
          {gmUsersError && (
            <div style={{ marginBottom: 10, padding: "9px 10px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.055)", color: "#b91c1c", fontSize: 11, fontWeight: 700 }}>
              {gmUsersError}
            </div>
          )}
          {groups.length === 0 ? (
            <div style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.015)", padding: "26px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Keine GM-Zuordnungen</div>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.44)" }}>Diese Kampagne hat aktuell keine Märkte mit GM-Zuweisung.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.map((group) => {
                const value = values[group.gmUserId] ?? group.gmUserId;
                const changed = value !== group.gmUserId;
                return (
                  <div
                    key={group.gmUserId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 132px 250px",
                      gap: 12,
                      alignItems: "center",
                      borderRadius: 10,
                      border: changed ? "1px solid rgba(220,38,38,0.22)" : "1px solid rgba(0,0,0,0.065)",
                      background: changed ? "rgba(220,38,38,0.025)" : "rgba(0,0,0,0.012)",
                      padding: "10px 10px",
                      boxShadow: changed ? "inset 2px 0 0 rgba(220,38,38,0.72)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(220,38,38,0.08)", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0 }}>
                        {group.gmName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {group.gmName}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.38)" }}>
                          bisheriger Gebietsmanager
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", fontVariantNumeric: "tabular-nums" }}>
                        {group.marketCount.toLocaleString("de-AT")} {group.marketCount === 1 ? "Markt" : "Märkte"}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.38)", fontVariantNumeric: "tabular-nums" }}>
                        {group.visitTargetCount.toLocaleString("de-AT")} Ziel-Visits
                        {group.completedCount > 0 ? ` · ${group.completedCount.toLocaleString("de-AT")} erledigt` : ""}
                      </div>
                    </div>

                    <GmReassignSelect
                      sourceGmName={group.gmName}
                      value={value}
                      gmUsers={sortedGmUsers}
                      open={openSourceId === group.gmUserId}
                      disabled={loadingGms || submitting || sortedGmUsers.length === 0}
                      loading={loadingGms}
                      onToggle={() => setOpenSourceId((current) => (current === group.gmUserId ? null : group.gmUserId))}
                      onSelect={(nextId) => {
                        onChange(group.gmUserId, nextId);
                        setOpenSourceId(null);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: changedCount > 0 ? "#DC2626" : "rgba(0,0,0,0.36)" }}>
            {changedCount > 0 ? `${changedCount} Änderung${changedCount === 1 ? "" : "en"} vorbereitet` : "Keine Änderung ausgewählt"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "linear-gradient(to bottom,#fff,#f7f7f8)",
                color: "rgba(0,0,0,0.58)",
                fontSize: 11,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || changedCount === 0 || loadingGms}
              style={{
                height: 34,
                minWidth: 126,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: submitting || changedCount === 0 || loadingGms
                  ? "rgba(0,0,0,0.12)"
                  : "linear-gradient(to bottom,#DC2626,#b91c1c)",
                color: submitting || changedCount === 0 || loadingGms ? "rgba(0,0,0,0.28)" : "#fff",
                fontSize: 11,
                fontWeight: 700,
                cursor: submitting || changedCount === 0 || loadingGms ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: submitting || changedCount === 0 || loadingGms
                  ? "none"
                  : "inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)",
                transition: "all 0.15s",
              }}
            >
              {submitting ? "Speichert..." : "Bestätigen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 68, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.07)", background: "linear-gradient(to bottom,#fff,#f8f8f8)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(0,0,0,0.30)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function GmReassignSelect({
  sourceGmName,
  value,
  gmUsers,
  open,
  disabled,
  loading,
  onToggle,
  onSelect,
}: {
  sourceGmName: string;
  value: string;
  gmUsers: GMRecord[];
  open: boolean;
  disabled: boolean;
  loading: boolean;
  onToggle: () => void;
  onSelect: (gmUserId: string) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selectedGm = gmUsers.find((gm) => gm.id === value) ?? null;
  const selectedLabel = selectedGm ? getGmDisplayName(selectedGm) : sourceGmName;
  const filtered = gmUsers.filter((gm) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const label = `${getGmDisplayName(gm)} ${gm.email} ${gm.region}`.toLowerCase();
    return label.includes(q);
  });

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        style={{
          width: "100%",
          height: 34,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "linear-gradient(to bottom,#fff,#f7f7f7)",
          color: disabled ? "rgba(0,0,0,0.3)" : "#1a1a1a",
          fontSize: 11,
          fontWeight: 600,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.04),0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {loading ? "GMs werden geladen..." : selectedLabel}
        </span>
        <ChevronDown size={13} strokeWidth={2} color="rgba(0,0,0,0.42)" style={{ flexShrink: 0 }} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            right: 0,
            width: 280,
            maxWidth: "min(280px, 80vw)",
            borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.09)",
            background: "#fff",
            boxShadow: "0 14px 34px rgba(15,23,42,0.14), 0 2px 7px rgba(15,23,42,0.06)",
            zIndex: 10020,
            padding: 6,
          }}
        >
          <div style={{ padding: "4px 4px 6px" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="GM suchen..."
              autoFocus
              style={{
                width: "100%",
                height: 28,
                borderRadius: 7,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(0,0,0,0.025)",
                outline: "none",
                padding: "0 9px",
                fontSize: 11,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "#1a1a1a",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ maxHeight: 210, overflowY: "auto", scrollbarWidth: "none" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 10px", fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.38)", textAlign: "center" }}>
                Kein GM gefunden
              </div>
            ) : (
              filtered.map((gm) => {
                const selected = gm.id === value;
                return (
                  <button
                    key={gm.id}
                    type="button"
                    onClick={() => onSelect(gm.id)}
                    style={{
                      width: "100%",
                      minHeight: 36,
                      border: "none",
                      borderRadius: 7,
                      background: selected ? "rgba(220,38,38,0.07)" : "transparent",
                      color: selected ? "#DC2626" : "#1a1a1a",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "7px 8px",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(event) => {
                      if (!selected) event.currentTarget.style.background = "rgba(0,0,0,0.035)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = selected ? "rgba(220,38,38,0.07)" : "transparent";
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {getGmDisplayName(gm)}
                      </span>
                      <span style={{ display: "block", marginTop: 1, fontSize: 9, fontWeight: 500, color: "rgba(0,0,0,0.36)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {gm.region || gm.email}
                      </span>
                    </span>
                    {selected && <Check size={13} strokeWidth={2.6} color="#DC2626" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RegionBar({
  name,
  pct,
  onClick,
  hideMetrics = false,
}: {
  name: string;
  pct: number;
  onClick?: () => void;
  hideMetrics?: boolean;
}) {
  const color = pct >= 80 ? "#16a34a" : pct >= 40 ? "#d97706" : "#DC2626";
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: onClick ? "pointer" : "default", borderRadius: 6, transition: "background 0.12s ease" }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", fontWeight: 500, width: 130, flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div
          style={{
            width: hideMetrics ? "0%" : `${pct}%`,
            height: "100%",
            borderRadius: 99,
            backgroundColor: hideMetrics ? "transparent" : color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, width: 34, textAlign: "right", flexShrink: 0 }}>
        {hideMetrics ? "" : `${pct}%`}
      </span>
    </div>
  );
}

// ── Campaign list item ────────────────────────────────────────

function CampaignListItem({
  campaign,
  selected,
  onClick,
  onContextMenu,
}: {
  campaign: {
    id: string;
    name: string;
    color: string;
    inactive: boolean;
    filled: number;
    total: number;
    statusLoaded?: boolean;
    statusLoading?: boolean;
  };
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const metricsLoading = Boolean(campaign.statusLoading && !campaign.statusLoaded);
  const pct = !metricsLoading && campaign.total > 0 ? Math.round((campaign.filled / campaign.total) * 100) : 0;
  const dotColor = campaign.color;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={(event) => {
        if (event.button === 2) {
          event.preventDefault();
          onContextMenu?.(event);
        }
      }}
      style={{
        padding: "10px 14px",
        borderRadius: 0,
        cursor: "pointer",
        backgroundColor: selected ? `${campaign.color}0d` : "transparent",
        borderLeft: selected ? `3px solid ${campaign.color}` : "3px solid transparent",
        transition: "all 0.15s ease",
        marginBottom: 0,
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.025)"; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0, opacity: campaign.inactive ? 0.3 : 1 }} />
          <span style={{ fontSize: 12, fontWeight: selected ? 700 : 500, color: selected ? "#1a1a1a" : "#374151", letterSpacing: "-0.01em" }}>{campaign.name}</span>
        </div>
        {metricsLoading ? (
          <span className="fbm-inline-skeleton" style={{ width: 28, height: 12, borderRadius: 99, display: "inline-block" }} />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "rgba(0,0,0,0.25)" }}>{pct}%</span>
        )}
      </div>
      <div style={{ paddingLeft: 13 }}>
        <div style={{ height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, backgroundColor: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "transparent" }} />
        </div>
        {metricsLoading ? (
          <span className="fbm-inline-skeleton" style={{ width: 62, height: 10, borderRadius: 99, display: "block", marginTop: 5 }} />
        ) : (
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 3, display: "block" }}>{campaign.filled.toLocaleString("de-AT")} / {campaign.total.toLocaleString("de-AT")}</span>
        )}
      </div>
    </div>
  );
}

// ── Market row ────────────────────────────────────────────────

const MarketRow = React.memo(function MarketRow({
  market,
  visitStatus = null,
  statusLoading = false,
  mode = "idle",
  isRemoving = false,
  isEntering = false,
  onRemove,
  onClick,
  removeDisabled = false,
}: {
  market: MarketCatalogItem;
  visitStatus?: CampaignMarketVisitStatus | null;
  statusLoading?: boolean;
  mode?: "idle" | "remove" | "add";
  isRemoving?: boolean;
  isEntering?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  removeDisabled?: boolean;
}) {
  const targetVisitCount = Math.max(visitStatus?.targetVisitCount ?? 1, 1);
  const submittedVisitCount = Math.max(visitStatus?.submittedVisitCount ?? 0, 0);
  const hasSubmittedVisit = Boolean(visitStatus?.hasSubmittedVisit);
  const complete = Boolean(visitStatus?.isComplete);
  const partial = hasSubmittedVisit && !complete;
  const clickable = hasSubmittedVisit && !!onClick && mode === "idle";
  const dotColor = statusLoading ? "rgba(0,0,0,0.12)" : complete ? "#16a34a" : partial ? "#d97706" : "rgba(0,0,0,0.18)";
  const badgeLabel = statusLoading
    ? ""
    : targetVisitCount > 1
      ? complete
        ? `Abgeschlossen ${submittedVisitCount}/${targetVisitCount}`
        : partial
          ? `Teilweise ${submittedVisitCount}/${targetVisitCount}`
          : `Ausstehend 0/${targetVisitCount}`
      : complete || hasSubmittedVisit
        ? "Besucht"
        : "Ausstehend";
  const badgeColor = complete || (targetVisitCount === 1 && hasSubmittedVisit)
    ? "#16a34a"
    : partial
      ? "#d97706"
      : "rgba(0,0,0,0.35)";
  const badgeBackground = complete || (targetVisitCount === 1 && hasSubmittedVisit)
    ? "rgba(22,163,74,0.08)"
    : partial
      ? "rgba(217,119,6,0.1)"
      : "rgba(0,0,0,0.04)";
  const anim = isRemoving ? "mrSlideOut 0.3s cubic-bezier(0.4,0,0.6,1) forwards"
             : isEntering  ? "mrSlideIn 0.3s cubic-bezier(0.2,0,0,1) both"
             : undefined;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex", alignItems: "center", padding: "10px 14px",
        borderBottom: "1px solid rgba(0,0,0,0.04)", gap: 10,
        cursor: clickable ? "pointer" : "default",
        transition: "background 0.12s ease",
        animation: anim,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { if (clickable) e.currentTarget.style.background = "transparent"; }}
    >
      {mode === "remove" && (
        <button
          disabled={removeDisabled}
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          style={{
            width: 20, height: 20, borderRadius: "50%", border: "none", cursor: removeDisabled ? "not-allowed" : "pointer",
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: removeDisabled ? "rgba(0,0,0,0.08)" : "rgba(220,38,38,0.08)", color: removeDisabled ? "rgba(0,0,0,0.35)" : "#DC2626",
            transition: "background 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            if (removeDisabled) return;
            e.currentTarget.style.background = "rgba(220,38,38,0.15)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            if (removeDisabled) return;
            e.currentTarget.style.background = "rgba(220,38,38,0.08)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <Minus size={10} strokeWidth={2.5} />
        </button>
      )}
      {mode !== "remove" && (
        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, backgroundColor: dotColor }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 650, color: "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {market.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, marginTop: 4 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 520, color: "rgba(0,0,0,0.46)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {market.address}
          </span>
        </div>
      </div>
      <span style={{ width: 112, flexShrink: 0, textAlign: "right", fontSize: 10, color: "rgba(0,0,0,0.42)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {market.stammnr || "-"}
      </span>
      <span style={{ width: 150, flexShrink: 0, textAlign: "right", fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {market.city}
      </span>
      {statusLoading ? (
        <span style={{ width: 86, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          <span
            className="fbm-inline-skeleton"
            style={{ width: 58, height: 17, borderRadius: 20, display: "inline-block" }}
          />
        </span>
      ) : (
        <span style={{ width: 86, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            backgroundColor: badgeBackground,
            color: badgeColor,
            whiteSpace: "nowrap",
          }}>
            {badgeLabel}
          </span>
        </span>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.market.id === next.market.id &&
    prev.market.finished === next.market.finished &&
    prev.market.name === next.market.name &&
    prev.market.address === next.market.address &&
    prev.market.stammnr === next.market.stammnr &&
    prev.market.city === next.market.city &&
    prev.visitStatus?.targetVisitCount === next.visitStatus?.targetVisitCount &&
    prev.visitStatus?.submittedVisitCount === next.visitStatus?.submittedVisitCount &&
    prev.visitStatus?.isComplete === next.visitStatus?.isComplete &&
    prev.visitStatus?.hasSubmittedVisit === next.visitStatus?.hasSubmittedVisit &&
    prev.statusLoading === next.statusLoading &&
    prev.mode === next.mode &&
    prev.isRemoving === next.isRemoving &&
    prev.isEntering === next.isEntering &&
    prev.removeDisabled === next.removeDisabled &&
    Boolean(prev.onClick) === Boolean(next.onClick)
  );
});

// ── Market filter chip ─────────────────────────────────────────

function MarketFilterChip({
  label, value, options, onChange,
}: {
  label: string; value: string | null; options: string[]; onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const syncPos = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom + 5 });
    }
  }, []);

  // Outside-click close
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  // Keep dropdown attached during scroll / resize
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", syncPos, true); // capture catches nested scrollers
    window.addEventListener("resize", syncPos);
    return () => {
      window.removeEventListener("scroll", syncPos, true);
      window.removeEventListener("resize", syncPos);
    };
  }, [open, syncPos]);

  const toggleOpen = () => {
    syncPos();
    setOpen((o) => !o);
  };

  const active = value !== null;
  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600,
          background: active ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.035)",
          color: active ? "#1a1a1a" : "rgba(0,0,0,0.4)",
          boxShadow: active ? "0 0 0 1.5px rgba(0,0,0,0.2)" : "none",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.055)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.035)"; }}
      >
        {active ? value : label}
        {active
          ? <span onMouseDown={(e) => { e.stopPropagation(); onChange(null); }} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}><X size={9} strokeWidth={2.5} /></span>
          : <ChevronDown size={9} strokeWidth={2} />
        }
      </button>
      {mounted && open && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9998, minWidth: 160, background: "#fff", borderRadius: 10, padding: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mfcIn 0.14s ease both" }}
        >
          <style>{`@keyframes mfcIn { from { opacity:0; transform:translateY(-4px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }`}</style>
          {options.map((opt) => {
            const sel = opt === value;
            return (
              <button key={opt} onClick={() => { onChange(sel ? null : opt); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: sel ? 600 : 400, textAlign: "left", background: sel ? "rgba(0,0,0,0.05)" : "transparent", color: sel ? "#1a1a1a" : "#374151", transition: "background 0.1s ease" }}
                onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{sel && <Check size={10} strokeWidth={3} />}</div>
                {opt}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Market edit menu (small 2-option popover) ─────────────────

function MarketEditMenu({
  pos, onAdd, onRemove, onClose,
}: {
  pos: { x: number; y: number };
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", right: window.innerWidth - pos.x, top: pos.y, zIndex: 9998, width: 168, background: "#fff", borderRadius: 11, padding: 5, boxShadow: "0 8px 30px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.055)", animation: "memIn 0.15s cubic-bezier(0.2,0,0,1) both" }}
    >
      <style>{`@keyframes memIn { from { opacity:0; transform:translateY(-6px) scale(0.96) } to { opacity:1; transform:translateY(0) scale(1) } }`}</style>
      {[
        { icon: <Plus size={13} strokeWidth={2} />, label: "Märkte hinzufügen", action: onAdd, color: "#16a34a" },
        { icon: <Minus size={13} strokeWidth={2} />, label: "Märkte entfernen", action: onRemove, color: "#DC2626" },
      ].map(({ icon, label, action, color }) => (
        <button key={label} onClick={action}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#1a1a1a", background: "transparent", transition: "background 0.1s ease", textAlign: "left" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; (e.currentTarget.querySelector("span") as HTMLElement).style.color = color; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; (e.currentTarget.querySelector("span") as HTMLElement).style.color = "rgba(0,0,0,0.4)"; }}
        >
          <span style={{ color: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", transition: "color 0.1s ease" }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ── Market add panel (large anchored popover) ─────────────────

function MarketAddPanel({
  pos, availableMarkets, onAdd, onUndoAdd, onClose, isPending = false,
}: {
  pos: { x: number; y: number };
  availableMarkets: MarketCatalogItem[];
  onAdd: (id: string) => void;
  onUndoAdd: (id: string) => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MarketListFilters>({ chain: null, gm: null, city: null, region: null });
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [expandedAdded, setExpandedAdded] = useState(false);
  const [undoMenu, setUndoMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [candidateLimit, setCandidateLimit] = useState(ADD_PANEL_INITIAL_LIMIT);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!undoMenu) return;
    const h = () => setUndoMenu(null);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [undoMenu]);

  const PANEL_W = 520;

  // Draggable position — initialise from prop, clamp once on mount
  const [panelPos, setPanelPos] = useState({ x: pos.x, y: pos.y });
  const dragRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPanelPos({
      x: Math.max(8, Math.min(pos.x, window.innerWidth - PANEL_W - 8)),
      y: Math.max(8, Math.min(pos.y, window.innerHeight - 60)),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPanelPos({
        x: Math.max(0, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - PANEL_W)),
        y: Math.max(0, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - 60)),
      });
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = false;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
  }, []);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // don't drag from close button
    dragRef.current = true;
    dragOffsetRef.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
    document.body.style.cursor = "grabbing";
    e.preventDefault(); // prevent text selection during drag
  };

  useEffect(() => {
    return () => { document.body.style.cursor = ""; };
  }, [onClose]);

  const filteredAvailableMarkets = useMemo(
    () => availableMarkets.filter((m) => !addedIds.includes(m.id)),
    [availableMarkets, addedIds],
  );
  const candidates = useMemo(
    () => applyMarketFilters(filteredAvailableMarkets, search, filters),
    [filteredAvailableMarkets, search, filters],
  );
  const visibleCandidates = useMemo(
    () => candidates.slice(0, candidateLimit),
    [candidates, candidateLimit],
  );
  const hasMoreCandidates = visibleCandidates.length < candidates.length;

  const chains  = useMemo(() => Array.from(new Set(availableMarkets.map((m) => m.chain))).sort(), [availableMarkets]);
  const gms     = useMemo(() => Array.from(new Set(availableMarkets.map((m) => m.gm))).sort(), [availableMarkets]);
  const cities  = useMemo(() => Array.from(new Set(availableMarkets.map((m) => m.city))).sort(), [availableMarkets]);
  const regions = useMemo(() => Array.from(new Set(availableMarkets.map((m) => m.region))).sort(), [availableMarkets]);

  useEffect(() => {
    setCandidateLimit(ADD_PANEL_INITIAL_LIMIT);
  }, [search, filters.chain, filters.gm, filters.city, filters.region, addedIds.length, availableMarkets.length]);

  const handleAdd = (id: string) => {
    if (isPending) return;
    setAddedIds((p) => [...p, id]);
    onAdd(id);
  };

  const handleUndoSingle = (id: string) => {
    if (isPending) return;
    const remaining = addedIds.filter((aid) => aid !== id);
    setAddedIds(remaining);
    setUndoMenu(null);
    onUndoAdd(id);
    if (remaining.length === 0) setExpandedAdded(false);
  };

  const handleUndoAll = () => {
    if (isPending) return;
    const toUndo = [...addedIds];
    setAddedIds([]);
    setExpandedAdded(false);
    toUndo.forEach((id) => onUndoAdd(id));
  };

  const addedMarketLookup = useMemo(() => {
    const lookup = new Map<string, MarketCatalogItem>();
    for (const market of MOCK_MARKETS) lookup.set(market.id, market);
    for (const market of availableMarkets) lookup.set(market.id, market);
    return lookup;
  }, [availableMarkets]);

  const addedMarkets = useMemo(
    () =>
      [...addedIds]
        .reverse()
        .map((id) => addedMarketLookup.get(id))
        .filter(Boolean) as MarketCatalogItem[],
    [addedIds, addedMarketLookup],
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", left: panelPos.x, top: panelPos.y, zIndex: 9998, width: PANEL_W, maxHeight: 520, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, boxShadow: "0 16px 50px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mapIn 0.18s cubic-bezier(0.2,0,0,1) both", overflow: "hidden" }}
    >
      <style>{`
        @keyframes mapIn { from { opacity:0; transform:translateY(-8px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        .map-scroll::-webkit-scrollbar { width: 3px; }
        .map-scroll::-webkit-scrollbar-track { background: transparent; }
        .map-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }
      `}</style>

      {/* Draggable header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, cursor: "grab", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Märkte hinzufügen</span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)", transition: "background 0.12s ease", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
        {/* Search */}
        <div
          onMouseDown={(e) => e.stopPropagation()} // don't trigger drag from search area
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 34, borderRadius: 8, background: "rgba(0,0,0,0.04)", border: "1px solid transparent", transition: "border 0.15s ease", cursor: "text", userSelect: "text" }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.15)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
        >
          <Search size={13} strokeWidth={2} color="rgba(0,0,0,0.35)" />
          <input
            autoFocus
            type="text"
            placeholder="Markt, Adresse oder GM suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "#1a1a1a", userSelect: "text" }}
          />
          {search && <button onClick={() => setSearch("")} style={{ display: "flex", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)", padding: 0 }}><X size={11} strokeWidth={2} /></button>}
        </div>
        {/* Filters */}
        <div onMouseDown={(e) => e.stopPropagation()} style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap", cursor: "default", userSelect: "none" }}>
          <MarketFilterChip label="Kette"  value={filters.chain}  options={chains}  onChange={(v) => setFilters((p) => ({ ...p, chain: v }))} />
          <MarketFilterChip label="GM"     value={filters.gm}     options={gms}     onChange={(v) => setFilters((p) => ({ ...p, gm: v }))} />
          <MarketFilterChip label="Stadt"  value={filters.city}   options={cities}  onChange={(v) => setFilters((p) => ({ ...p, city: v }))} />
          <MarketFilterChip label="Region" value={filters.region} options={regions} onChange={(v) => setFilters((p) => ({ ...p, region: v }))} />
        </div>
      </div>

      {/* Count row — doubles as expansion trigger */}
      <div style={{ padding: "8px 16px", borderBottom: expandedAdded ? "none" : "1px solid rgba(0,0,0,0.05)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 500, flex: 1 }}>
          {candidates.length} {candidates.length === 1 ? "Markt verfügbar" : "Märkte verfügbar"}
        </span>
        {addedIds.length > 0 && (
          <>
            <button
              onClick={handleUndoAll}
              disabled={isPending}
              style={{ fontSize: 10, fontWeight: 600, color: isPending ? "rgba(0,0,0,0.35)" : "#DC2626", background: "none", border: "none", cursor: isPending ? "not-allowed" : "pointer", padding: "2px 4px", transition: "opacity 0.15s ease", letterSpacing: "-0.01em" }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >{isPending ? "Rückgängig..." : "Alles rückgängig"}</button>
            <button
              onClick={() => setExpandedAdded((o) => !o)}
              style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {addedIds.length} hinzugefügt
              <ChevronDown
                size={10} strokeWidth={2.5}
                style={{ display: "block", transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)", transform: expandedAdded ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
          </>
        )}
      </div>

      {/* Inline added-markets expansion */}
      <div style={{ maxHeight: expandedAdded ? "200px" : "0px", opacity: expandedAdded ? 1 : 0, overflow: "hidden", flexShrink: 0, borderBottom: expandedAdded ? "1px solid rgba(0,0,0,0.05)" : "none", transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
        <div className="map-scroll" style={{ overflowY: "auto", maxHeight: 200, transform: expandedAdded ? "translateY(0)" : "translateY(-4px)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", paddingTop: 4, paddingBottom: 4 }}>
          {addedMarkets.map((m) => (
            <div
              key={m.id}
              onContextMenu={(e) => { e.preventDefault(); setUndoMenu({ id: m.id, x: e.clientX, y: e.clientY }); }}
              style={{ display: "flex", alignItems: "center", padding: "9px 16px", gap: 10, borderBottom: "1px solid rgba(0,0,0,0.03)", background: "rgba(22,163,74,0.025)", cursor: "context-menu", transition: "background 0.12s ease" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(22,163,74,0.055)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(22,163,74,0.025)"; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 1 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.55)" }}>{m.gm}</span>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 20, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.35)" }}>{m.region}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidate list */}
      <div className="map-scroll" style={{ overflowY: "auto", flex: 1 }}>
        {candidates.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>Keine Märkte gefunden</span>
          </div>
        ) : visibleCandidates.map((m) => (
          <button
            key={m.id}
            onClick={() => handleAdd(m.id)}
            disabled={isPending}
            style={{ display: "flex", alignItems: "center", width: "100%", padding: "11px 16px", gap: 10, border: "none", cursor: isPending ? "not-allowed" : "pointer", borderBottom: "1px solid rgba(0,0,0,0.04)", background: "transparent", textAlign: "left", transition: "background 0.12s ease", opacity: isPending ? 0.6 : 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {/* Name + address */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 1 }}>{m.name}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
            </div>
            {/* Meta */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.55)" }}>{m.gm}</span>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 20, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.35)" }}>{m.region}</span>
            </div>
            {/* Add icon */}
            <div style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(22,163,74,0.07)", color: "#16a34a", flexShrink: 0 }}>
              {isPending ? "..." : <Plus size={12} strokeWidth={2.5} />}
            </div>
          </button>
        ))}
        {hasMoreCandidates && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(0,0,0,0.05)", background: "#fff", position: "sticky", bottom: 0 }}>
            <button
              onClick={() => setCandidateLimit((current) => current + ADD_PANEL_LOAD_STEP)}
              style={{
                width: "100%",
                height: 30,
                borderRadius: 7,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(0,0,0,0.6)",
              }}
            >
              Mehr laden ({visibleCandidates.length} / {candidates.length})
            </button>
          </div>
        )}
      </div>

      {/* Right-click per-market undo menu */}
      {undoMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: undoMenu.x, top: undoMenu.y, zIndex: 9999, background: "#fff", borderRadius: 10, padding: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.055)", animation: "mfcIn 0.14s ease both" }}
        >
          <button
            onClick={() => handleUndoSingle(undoMenu.id)}
            style={{ display: "flex", alignItems: "center", width: "100%", padding: "8px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#DC2626", background: "transparent", whiteSpace: "nowrap", transition: "background 0.1s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >Rückgängig machen</button>
        </div>
      )}
    </div>,
    document.body
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function FbManagementPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState<"all" | "finished" | "pending">("all");
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [campaignsData, setCampaignsData] = useState<Campaign[]>([]);
  const [marketsData, setMarketsData] = useState<MarketCatalogItem[]>([]);
  const [fragebogenOptions, setFragebogenOptions] = useState<Record<CampaignSection, FragebogenOption[]>>({
    standard: [],
    flex: [],
    billa: [],
    kuehler: [],
    mhd: [],
  });
  const [fragebogenByScope, setFragebogenByScope] = useState<Record<FragebogenScopeKey, Fragebogen[]>>({
    main: [],
    kuehler: [],
    mhd: [],
  });
  const [modulesByScope, setModulesByScope] = useState<Record<FragebogenScopeKey, Module[]>>({
    main: [],
    kuehler: [],
    mhd: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visitLoadError, setVisitLoadError] = useState<string | null>(null);
  const [visitStatusByCampaignId, setVisitStatusByCampaignId] = useState<Record<string, CampaignVisitStatusByMarket>>({});
  const [visitStatusLoadingByCampaignId, setVisitStatusLoadingByCampaignId] = useState<Record<string, boolean>>({});
  const [visitStatusErrorByCampaignId, setVisitStatusErrorByCampaignId] = useState<Record<string, string | null>>({});
  const [visitDetailByKey, setVisitDetailByKey] = useState<CampaignVisitDetailByKey>({});
  const [visitDetailLoadingByKey, setVisitDetailLoadingByKey] = useState<Record<string, boolean>>({});
  const [visitDetailErrorByKey, setVisitDetailErrorByKey] = useState<Record<string, string | null>>({});
  const [isExportingFbManagement, setIsExportingFbManagement] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [switchingCampaignId, setSwitchingCampaignId] = useState<string | null>(null);
  const [campaignPendingOps, setCampaignPendingOps] = useState<Record<string, number>>({});
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [campaignContextMenu, setCampaignContextMenu] = useState<CampaignContextMenuState | null>(null);
  const [campaignDeleteDialog, setCampaignDeleteDialog] = useState<CampaignDeleteDialogState | null>(null);
  const [campaignReassignDialog, setCampaignReassignDialog] = useState<CampaignReassignDialogState | null>(null);
  const [gmUsers, setGmUsers] = useState<GMRecord[]>([]);
  const [gmUsersLoading, setGmUsersLoading] = useState(false);
  const [gmUsersError, setGmUsersError] = useState<string | null>(null);
  const [reassignmentsBySourceGm, setReassignmentsBySourceGm] = useState<Record<string, string>>({});
  const [isReassigningCampaign, setIsReassigningCampaign] = useState(false);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
  const [hardDeleteConfirmationInput, setHardDeleteConfirmationInput] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [overlapConflicts, setOverlapConflicts] = useState<CampaignMarketOverlapConflict[] | null>(null);
  const [overlapConflictMarketId, setOverlapConflictMarketId] = useState<string | null>(null);
  const [resolvingOverlap, setResolvingOverlap] = useState(false);
  const regionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campaignContextMenuRef = useRef<HTMLDivElement | null>(null);
  const visitStatusInFlightRef = useRef<Record<string, Promise<void>>>({});
  const visitDetailInFlightRef = useRef<Record<string, Promise<void>>>({});
  const visitDetailPrefetchStartedRef = useRef<Set<string>>(new Set());

  // ── Market management state ────────────────────────────────────
  const [marketSearch, setMarketSearch] = useState("");
  const [marketFilters, setMarketFilters] = useState<MarketListFilters>({ chain: null, gm: null, city: null, region: null });
  const [marketEditMode, setMarketEditMode] = useState<"idle" | "remove" | "add">("idle");
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [editMenuPos, setEditMenuPos] = useState({ x: 0, y: 0 });
  const [addPanelPos, setAddPanelPos] = useState({ x: 0, y: 0 });
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [marketRenderLimit, setMarketRenderLimit] = useState(MARKET_LIST_INITIAL_LIMIT);
  const editBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const settled = await Promise.allSettled([
          fetchCampaigns(),
          fetchMarkets(),
          fetchFragebogen("main"),
          fetchFragebogen("kuehler"),
          fetchFragebogen("mhd"),
          fetchModules("main"),
          fetchModules("kuehler"),
          fetchModules("mhd"),
        ]);

        const campaignsResult = settled[0] as PromiseSettledResult<Awaited<ReturnType<typeof fetchCampaigns>>>;
        const marketsResult = settled[1] as PromiseSettledResult<Awaited<ReturnType<typeof fetchMarkets>>>;
        if (campaignsResult.status !== "fulfilled") {
          throw campaignsResult.reason;
        }
        if (marketsResult.status !== "fulfilled") {
          throw marketsResult.reason;
        }

        const optionalOrEmpty = <T,>(result: PromiseSettledResult<T>): T | [] => {
          if (result.status === "fulfilled") return result.value;
          return [];
        };

        const campaignsRes = campaignsResult.value;
        const marketsRes = marketsResult.value;
        const mainFragebogen = optionalOrEmpty(
          settled[2] as PromiseSettledResult<Awaited<ReturnType<typeof fetchFragebogen>>>,
        );
        const kuehlerFragebogen = optionalOrEmpty(
          settled[3] as PromiseSettledResult<Awaited<ReturnType<typeof fetchFragebogen>>>,
        );
        const mhdFragebogen = optionalOrEmpty(
          settled[4] as PromiseSettledResult<Awaited<ReturnType<typeof fetchFragebogen>>>,
        );
        const mainModules = optionalOrEmpty(
          settled[5] as PromiseSettledResult<Awaited<ReturnType<typeof fetchModules>>>,
        );
        const kuehlerModules = optionalOrEmpty(
          settled[6] as PromiseSettledResult<Awaited<ReturnType<typeof fetchModules>>>,
        );
        const mhdModules = optionalOrEmpty(
          settled[7] as PromiseSettledResult<Awaited<ReturnType<typeof fetchModules>>>,
        );

        const toCatalogItem = (market: Awaited<ReturnType<typeof fetchMarkets>>[number]): MarketCatalogItem => {
          const chainSource = (market.dbName || market.name || "").trim();
          const chain = chainSource ? chainSource.split(/\s+/)[0] : "Unbekannt";
          return {
            id: market.id,
            name: getMarketDisplayName(market),
            chain,
            city: market.city,
            region: market.region,
            address: market.address,
            stammnr: String(market.kuehlerStammnr || market.cokeMasterNumber || market.standardMarketNumber || "").trim(),
            gm: market.currentGmName || market.employee || "Unbekannt",
            finished: Boolean(market.infoFlag),
          };
        };

        const moduleQuestionCountMain = new Map(mainModules.map((module) => [module.id, module.questions.length]));
        const moduleQuestionCountKuehler = new Map(kuehlerModules.map((module) => [module.id, module.questions.length]));
        const moduleQuestionCountMhd = new Map(mhdModules.map((module) => [module.id, module.questions.length]));

        const toOptions = (fragebogenList: Fragebogen[], moduleCountMap: Map<string, number>) =>
          fragebogenList
            .filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index)
            .map((entry) => ({
              id: entry.id,
              name: entry.name,
              modules: entry.moduleIds.length,
              questions: entry.moduleIds.reduce((sum, moduleId) => sum + (moduleCountMap.get(moduleId) ?? 0), 0),
            }));
        const byMainSection = (section: "standard" | "flex" | "billa") =>
          toOptions(
            mainFragebogen.filter((entry) => Array.isArray(entry.sectionKeywords) && entry.sectionKeywords.includes(section)),
            moduleQuestionCountMain,
          );

        setCampaignsData(campaignsRes);
        setMarketsData(marketsRes.map(toCatalogItem));
        setFragebogenByScope({
          main: mainFragebogen,
          kuehler: kuehlerFragebogen,
          mhd: mhdFragebogen,
        });
        setModulesByScope({
          main: mainModules,
          kuehler: kuehlerModules,
          mhd: mhdModules,
        });
        setFragebogenOptions({
          standard: byMainSection("standard"),
          flex: byMainSection("flex"),
          billa: byMainSection("billa"),
          kuehler: toOptions(kuehlerFragebogen, moduleQuestionCountKuehler),
          mhd: toOptions(mhdFragebogen, moduleQuestionCountMhd),
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Kampagnen konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    if (campaignsData.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !campaignsData.some((campaign) => campaign.id === selectedId)) {
      setSelectedId(campaignsData[0]?.id ?? null);
    }
  }, [campaignsData, selectedId]);

  const refreshCampaignVisitStatuses = useCallback(async (
    targetCampaignIds: string[],
    options?: {
      suppressErrorBanner?: boolean;
      force?: boolean;
      maxAttempts?: number;
    },
  ) => {
    const campaignIds = Array.from(new Set(targetCampaignIds.filter(Boolean))).slice(0, VISIT_STATUS_BATCH_SIZE);
    if (campaignIds.length === 0) return;
    const batchKey = campaignIds.slice().sort((a, b) => a.localeCompare(b, "de")).join("|");
    const existingTask = visitStatusInFlightRef.current[batchKey];
    if (existingTask && !options?.force) {
      await existingTask;
      return;
    }
    if (!options?.suppressErrorBanner) {
      setVisitLoadError(null);
    }
    setVisitStatusLoadingByCampaignId((current) => {
      const next = { ...current };
      for (const id of campaignIds) next[id] = true;
      return next;
    });
    const task = (async () => {
      const maxAttempts = Math.max(1, options?.maxAttempts ?? 2);
      let lastError: unknown = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const batches = await fetchCampaignMarketVisitStatuses(campaignIds);
          const received = new Set<string>();
          setVisitStatusByCampaignId((current) => {
            const next = { ...current };
            for (const batch of batches) {
              received.add(batch.campaignId);
              next[batch.campaignId] = Object.fromEntries(
                batch.markets.map((status) => [status.marketId, status]),
              ) as CampaignVisitStatusByMarket;
            }
            for (const id of campaignIds) {
              if (!received.has(id) && !Object.prototype.hasOwnProperty.call(next, id)) {
                next[id] = {};
              }
            }
            return next;
          });
          setVisitStatusErrorByCampaignId((current) => {
            const next = { ...current };
            for (const id of campaignIds) next[id] = null;
            return next;
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 220 * (attempt + 1)));
          }
        }
      }
      const message = lastError instanceof Error ? lastError.message : "Besuchsstatus konnte nicht geladen werden.";
      if (!options?.suppressErrorBanner) {
        setVisitLoadError(message);
      }
      setVisitStatusErrorByCampaignId((current) => {
        const next = { ...current };
        for (const id of campaignIds) next[id] = message;
        return next;
      });
      setVisitStatusByCampaignId((current) => {
        const next = { ...current };
        for (const id of campaignIds) {
          if (!Object.prototype.hasOwnProperty.call(next, id)) next[id] = {};
        }
        return next;
      });
    })();
    visitStatusInFlightRef.current[batchKey] = task;
    try {
      await task;
    } finally {
      delete visitStatusInFlightRef.current[batchKey];
      setVisitStatusLoadingByCampaignId((current) => {
        const next = { ...current };
        for (const id of campaignIds) next[id] = false;
        return next;
      });
    }
  }, []);

  const refreshMarketVisitDetail = useCallback(async (
    targetCampaignId: string,
    targetMarketId: string,
    sessionId?: string | null,
    options?: { force?: boolean },
  ) => {
    if (!targetCampaignId || !targetMarketId) return;
    const key = getVisitDetailKey(targetCampaignId, targetMarketId, sessionId);
    if (!options?.force && visitDetailByKey[key]) return;
    const existingTask = visitDetailInFlightRef.current[key];
    if (existingTask && !options?.force) {
      await existingTask;
      return;
    }
    setVisitDetailLoadingByKey((current) => ({ ...current, [key]: true }));
    setVisitDetailErrorByKey((current) => ({ ...current, [key]: null }));
    const task = (async () => {
      try {
        const detail = await fetchCampaignMarketVisitDetail({
          campaignId: targetCampaignId,
          marketId: targetMarketId,
          sessionId,
        }, { timeoutMs: 45000 });
        setVisitDetailByKey((current) => ({ ...current, [key]: detail }));
      } catch (error) {
        setVisitDetailErrorByKey((current) => ({
          ...current,
          [key]: error instanceof Error ? error.message : "Besuchsdetails konnten nicht geladen werden.",
        }));
      }
    })();
    visitDetailInFlightRef.current[key] = task;
    try {
      await task;
    } finally {
      delete visitDetailInFlightRef.current[key];
      setVisitDetailLoadingByKey((current) => ({ ...current, [key]: false }));
    }
  }, [visitDetailByKey]);

  const formatPeriod = (campaign: Campaign) => {
    if (campaign.scheduleType === "always") return "Immer aktiv";
    if (!campaign.startDate || !campaign.endDate) return "Geplant";
    const start = campaign.startDate.split("-").reverse().join(".");
    const end = campaign.endDate.split("-").reverse().join(".");
    return `${start} – ${end}`;
  };

  const marketById = useMemo(() => new Map(marketsData.map((market) => [market.id, market])), [marketsData]);

  const assignedMarketsByCampaignId = useMemo(() => {
    const byCampaign = new Map<string, MarketCatalogItem[]>();
    for (const campaignEntry of campaignsData) {
      const visitStatusByMarket = visitStatusByCampaignId[campaignEntry.id] ?? {};
      const assigned: MarketCatalogItem[] = [];
      for (const marketId of campaignEntry.marketIds) {
        const market = marketById.get(marketId);
        if (!market) continue;
        const visitStatus = visitStatusByMarket[marketId] ?? null;
        assigned.push({
          ...market,
          finished: visitStatus ? visitStatus.isComplete : false,
        });
      }
      byCampaign.set(campaignEntry.id, assigned);
    }
    return byCampaign;
  }, [campaignsData, marketById, visitStatusByCampaignId]);

  const campaignsView = useMemo(
    () =>
      campaignsData.map((campaignEntry) => {
        const visitStatusByMarket = visitStatusByCampaignId[campaignEntry.id] ?? {};
        const statusLoaded = Object.prototype.hasOwnProperty.call(visitStatusByCampaignId, campaignEntry.id);
        const statusLoading = Boolean(visitStatusLoadingByCampaignId[campaignEntry.id]);
        const assignedMarketsForCampaign = assignedMarketsByCampaignId.get(campaignEntry.id) ?? [];
        const total = assignedMarketsForCampaign.length;
        const filled = statusLoaded
          ? assignedMarketsForCampaign.filter((market) => visitStatusByMarket[market.id]?.isComplete).length
          : 0;
        const byRegion = new Map<string, { total: number; filled: number }>();
        for (const market of assignedMarketsForCampaign) {
          const current = byRegion.get(market.region) ?? { total: 0, filled: 0 };
          current.total += 1;
          if (statusLoaded && visitStatusByMarket[market.id]?.isComplete) current.filled += 1;
          byRegion.set(market.region, current);
        }
        const regions = Array.from(byRegion.entries())
          .map(([name, stats]) => ({
            name,
            pct: stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de"));

        return {
          ...campaignEntry,
          type: campaignEntry.section,
          color: SECTION_COLORS[campaignEntry.section],
          inactive: campaignEntry.status === "inactive",
          period: formatPeriod(campaignEntry),
          total,
          filled,
          todayNew: 0,
          thisWeek: 0,
          regions,
          statusLoaded,
          statusLoading,
          statusError: visitStatusErrorByCampaignId[campaignEntry.id] ?? null,
        };
      }),
    [assignedMarketsByCampaignId, campaignsData, visitStatusByCampaignId, visitStatusErrorByCampaignId, visitStatusLoadingByCampaignId],
  );

  const visibleCampaigns = useMemo(
    () => campaignsView.filter((entry) => (showInactive ? entry.inactive : !entry.inactive)),
    [campaignsView, showInactive],
  );
  const campaign = useMemo(
    () => campaignsView.find((entry) => entry.id === selectedId) ?? campaignsView[0],
    [campaignsView, selectedId],
  );
  const contextMenuCampaign = useMemo(
    () => campaignsView.find((entry) => entry.id === campaignContextMenu?.campaignId) ?? null,
    [campaignContextMenu?.campaignId, campaignsView],
  );
  const deleteTargetCampaign = useMemo(
    () => campaignsData.find((entry) => entry.id === campaignDeleteDialog?.campaignId) ?? null,
    [campaignDeleteDialog?.campaignId, campaignsData],
  );
  const reassignTargetCampaign = useMemo(
    () => campaignsData.find((entry) => entry.id === campaignReassignDialog?.campaignId) ?? null,
    [campaignReassignDialog?.campaignId, campaignsData],
  );
  const reassignGroups = useMemo(
    () => getCampaignGmReassignGroups(reassignTargetCampaign, gmUsers),
    [gmUsers, reassignTargetCampaign],
  );
  const reassignChangedCount = useMemo(
    () => reassignGroups.filter((group) => reassignmentsBySourceGm[group.gmUserId] && reassignmentsBySourceGm[group.gmUserId] !== group.gmUserId).length,
    [reassignGroups, reassignmentsBySourceGm],
  );
  const hardDeletePhraseMatches = hardDeleteConfirmationInput === HARD_DELETE_CAMPAIGN_CONFIRMATION_TEXT;

  const handleSelectCampaign = useCallback((nextCampaignId: string) => {
    setCampaignContextMenu(null);
    setSelectedId(nextCampaignId);
    setSelectedRegion(null);
    if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
    setMarketEditMode("idle");
    setEditMenuOpen(false);
    setMarketSearch("");
    setMarketFilters({ chain: null, gm: null, city: null, region: null });
    setMarketFilter("all");
  }, []);
  const previewQuestions = useMemo(() => {
    if (!campaign) return PREVIEW_QUESTIONS;
    if (!campaign.currentFragebogenId) return [];
    const scope = sectionToScope(campaign.section);
    const fragebogenList = fragebogenByScope[scope] ?? [];
    const moduleList = modulesByScope[scope] ?? [];
    const targetFragebogen = fragebogenList.find((entry) => entry.id === campaign.currentFragebogenId) ?? null;
    if (!targetFragebogen) {
      if (campaign.section === "flex") return FLEX_PREVIEW_QUESTIONS;
      if (campaign.section === "kuehler") return KUEHLER_PREVIEW_QUESTIONS;
      if (campaign.section === "mhd") return MHD_PREVIEW_QUESTIONS;
      if (campaign.section === "billa") return BILLA_PREVIEW_QUESTIONS;
      return PREVIEW_QUESTIONS;
    }
    const moduleMap = new Map(moduleList.map((module) => [module.id, module]));
    const dynamicQuestions: PreviewQuestion[] = [];
    for (const moduleId of targetFragebogen.moduleIds) {
      const module = moduleMap.get(moduleId);
      if (!module) continue;
      for (const question of module.questions) {
        dynamicQuestions.push(toPreviewQuestion(question, module.id, module.name));
      }
    }
    if (scope === "main") {
      for (const spezial of targetFragebogen.spezialfragen ?? []) {
        dynamicQuestions.push(toPreviewQuestion(spezial, "__spezial__", "Spezialfragen"));
      }
    }
    if (dynamicQuestions.length > 0) return dynamicQuestions;
    if (campaign.section === "flex") return FLEX_PREVIEW_QUESTIONS;
    if (campaign.section === "kuehler") return KUEHLER_PREVIEW_QUESTIONS;
    if (campaign.section === "mhd") return MHD_PREVIEW_QUESTIONS;
    if (campaign.section === "billa") return BILLA_PREVIEW_QUESTIONS;
    return PREVIEW_QUESTIONS;
  }, [campaign, fragebogenByScope, modulesByScope]);
  const campaignStatusMetricsLoading = Boolean(campaign && campaign.statusLoading && !campaign.statusLoaded);
  const pct = !campaignStatusMetricsLoading && campaign && campaign.total > 0 ? Math.round((campaign.filled / campaign.total) * 100) : 0;
  const campaignId = campaign?.id ?? null;
  const campaignMarketIds = campaign?.marketIds ?? [];
  const campaignCurrentFragebogenId = campaign?.currentFragebogenId ?? null;
  const isVisitStatusLoading = campaignId ? Boolean(visitStatusLoadingByCampaignId[campaignId]) : false;

  const allCampaignVisitSignature = useMemo(
    () =>
      campaignsData
        .map((entry) => `${entry.id}:${entry.marketIds.join(",")}`)
        .sort((a, b) => a.localeCompare(b, "de"))
        .join("|"),
    [campaignsData],
  );

  useEffect(() => {
    if (!campaignId) return;
    if (Object.prototype.hasOwnProperty.call(visitStatusByCampaignId, campaignId)) return;
    if (visitStatusLoadingByCampaignId[campaignId]) return;
    void refreshCampaignVisitStatuses([campaignId], { suppressErrorBanner: true });
  }, [campaignId, refreshCampaignVisitStatuses, visitStatusByCampaignId, visitStatusLoadingByCampaignId]);

  useEffect(() => {
    if (loading || campaignsData.length === 0) return;
    const priorityIds = [
      ...(campaignId ? [campaignId] : []),
      ...visibleCampaigns.map((entry) => entry.id),
      ...campaignsData.map((entry) => entry.id),
    ];
    const pendingIds = Array.from(new Set(priorityIds)).filter((id) => (
      !Object.prototype.hasOwnProperty.call(visitStatusByCampaignId, id)
      && !visitStatusLoadingByCampaignId[id]
    ));
    if (pendingIds.length === 0) return;
    const queue = chunkArray(pendingIds, VISIT_STATUS_BATCH_SIZE);
    const workerCount = Math.min(VISIT_STATUS_MAX_CONCURRENT_BATCHES, queue.length);
    const runWorker = async () => {
      while (queue.length > 0) {
        const nextCampaignIds = queue.shift();
        if (!nextCampaignIds) return;
        await refreshCampaignVisitStatuses(nextCampaignIds, { suppressErrorBanner: true });
      }
    };
    void Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  }, [
    allCampaignVisitSignature,
    campaignId,
    campaignsData,
    loading,
    refreshCampaignVisitStatuses,
    visibleCampaigns,
    visitStatusByCampaignId,
    visitStatusLoadingByCampaignId,
  ]);

  useEffect(() => {
    if (loading || campaignsData.length === 0) return;
    let cancelled = false;
    const runPrefetch = () => {
      if (cancelled) return;
      const campaignOrder = Array.from(new Set([
        ...(campaignId ? [campaignId] : []),
        ...visibleCampaigns.map((entry) => entry.id),
        ...campaignsData.map((entry) => entry.id),
      ]));
      const queue: Array<{ campaignId: string; marketId: string; sessionId: string | null }> = [];
      for (const targetCampaignId of campaignOrder) {
        const statusByMarket = visitStatusByCampaignId[targetCampaignId];
        if (!statusByMarket) continue;
        for (const status of Object.values(statusByMarket)) {
          if (!status.hasSubmittedVisit) continue;
          const detailKey = getVisitDetailKey(targetCampaignId, status.marketId, status.sessionId);
          if (
            visitDetailByKey[detailKey]
            || visitDetailLoadingByKey[detailKey]
            || visitDetailPrefetchStartedRef.current.has(detailKey)
          ) {
            continue;
          }
          visitDetailPrefetchStartedRef.current.add(detailKey);
          queue.push({ campaignId: targetCampaignId, marketId: status.marketId, sessionId: status.sessionId });
        }
      }
      if (queue.length === 0) return;
      const workerCount = Math.min(VISIT_DETAIL_PREFETCH_MAX_CONCURRENT, queue.length);
      const runWorker = async () => {
        while (!cancelled && queue.length > 0) {
          const next = queue.shift();
          if (!next) return;
          await refreshMarketVisitDetail(next.campaignId, next.marketId, next.sessionId);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      };
      void Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    };

    if (typeof window === "undefined") {
      runPrefetch();
      return () => {
        cancelled = true;
      };
    }
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleId = idleWindow.requestIdleCallback?.(runPrefetch, { timeout: 1800 });
    if (idleId != null) {
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = window.setTimeout(runPrefetch, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    campaignId,
    campaignsData,
    loading,
    refreshMarketVisitDetail,
    visibleCampaigns,
    visitDetailByKey,
    visitDetailLoadingByKey,
    visitStatusByCampaignId,
  ]);

  const assignedIds = campaignMarketIds;
  const isCampaignBusy = (campaignId: string) => (campaignPendingOps[campaignId] ?? 0) > 0;
  const campaignBusy = campaignId ? isCampaignBusy(campaignId) : false;
  const handleOpenCampaignContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>, targetCampaignId: string) => {
    event.preventDefault();
    if (isDeletingCampaign || isCampaignBusy(targetCampaignId)) return;
    const menuWidth = 200;
    const targetCampaign = campaignsView.find((entry) => entry.id === targetCampaignId);
    const menuHeight = targetCampaign && targetCampaign.section !== "flex" ? 128 : 94;
    const maxX = Math.max(8, window.innerWidth - menuWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menuHeight - 8);
    setCampaignContextMenu({
      campaignId: targetCampaignId,
      x: Math.min(Math.max(8, event.clientX), maxX),
      y: Math.min(Math.max(8, event.clientY), maxY),
    });
  }, [campaignPendingOps, campaignsView, isDeletingCampaign]);
  const handleOpenCampaignDeleteDialog = useCallback((mode: "soft" | "hard") => {
    if (!campaignContextMenu?.campaignId) return;
    setCampaignDeleteDialog({ campaignId: campaignContextMenu.campaignId, mode });
    setCampaignContextMenu(null);
    setHardDeleteConfirmationInput("");
  }, [campaignContextMenu?.campaignId]);
  const handleOpenCampaignReassignDialog = useCallback(() => {
    if (!campaignContextMenu?.campaignId) return;
    const targetCampaign = campaignsData.find((entry) => entry.id === campaignContextMenu.campaignId) ?? null;
    if (!targetCampaign) return;
    setCampaignReassignDialog({ campaignId: targetCampaign.id });
    setReassignmentsBySourceGm(() => {
      const next: Record<string, string> = {};
      for (const group of getCampaignGmReassignGroups(targetCampaign, gmUsers)) {
        next[group.gmUserId] = group.gmUserId;
      }
      return next;
    });
    setCampaignContextMenu(null);
    setMutationError(null);
  }, [campaignContextMenu?.campaignId, campaignsData, gmUsers]);
  const handleCloseCampaignDeleteDialog = useCallback(() => {
    if (isDeletingCampaign) return;
    setCampaignDeleteDialog(null);
    setHardDeleteConfirmationInput("");
  }, [isDeletingCampaign]);
  const handleCloseCampaignReassignDialog = useCallback(() => {
    if (isReassigningCampaign) return;
    setCampaignReassignDialog(null);
    setReassignmentsBySourceGm({});
    setGmUsersError(null);
  }, [isReassigningCampaign]);

  useEffect(() => {
    if (!campaignReassignDialog || gmUsers.length > 0 || gmUsersLoading) return;
    setGmUsersLoading(true);
    setGmUsersError(null);
    fetchGmUsers()
      .then((rows) => {
        setGmUsers(rows);
      })
      .catch((error) => {
        setGmUsersError(error instanceof Error ? error.message : "GM-Liste konnte nicht geladen werden.");
      })
      .finally(() => {
        setGmUsersLoading(false);
      });
  }, [campaignReassignDialog, gmUsers.length, gmUsersLoading]);

  useEffect(() => {
    if (!campaignReassignDialog) return;
    setReassignmentsBySourceGm((current) => {
      const next = { ...current };
      let changed = false;
      const validSourceIds = new Set(reassignGroups.map((group) => group.gmUserId));
      for (const key of Object.keys(next)) {
        if (!validSourceIds.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      for (const group of reassignGroups) {
        if (!next[group.gmUserId]) {
          next[group.gmUserId] = group.gmUserId;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [campaignReassignDialog, reassignGroups]);

  const handleDeleteCampaign = useCallback(async () => {
    if (!campaignDeleteDialog?.campaignId || isDeletingCampaign) return;
    const targetCampaignId = campaignDeleteDialog.campaignId;
    if ((campaignPendingOps[targetCampaignId] ?? 0) > 0) return;
    if (campaignDeleteDialog.mode === "hard" && !hardDeletePhraseMatches) return;
    setMutationError(null);
    setIsDeletingCampaign(true);
    setCampaignPendingOps((current) => ({ ...current, [targetCampaignId]: (current[targetCampaignId] ?? 0) + 1 }));
    try {
      if (campaignDeleteDialog.mode === "hard") {
        await hardDeleteCampaign(targetCampaignId, hardDeleteConfirmationInput);
      } else {
        await deleteCampaign(targetCampaignId);
      }
      const deletedWasSelected = selectedId === targetCampaignId;
      setCampaignsData((current) => current.filter((entry) => entry.id !== targetCampaignId));
      setVisitStatusByCampaignId((current) => {
        const next = { ...current };
        delete next[targetCampaignId];
        return next;
      });
      setVisitStatusLoadingByCampaignId((current) => {
        const next = { ...current };
        delete next[targetCampaignId];
        return next;
      });
      setVisitStatusErrorByCampaignId((current) => {
        const next = { ...current };
        delete next[targetCampaignId];
        return next;
      });
      setVisitDetailByKey((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${targetCampaignId}:`)),
      ));
      setVisitDetailLoadingByKey((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${targetCampaignId}:`)),
      ));
      setVisitDetailErrorByKey((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${targetCampaignId}:`)),
      ));
      setSelectedId((current) => (current === targetCampaignId ? null : current));
      if (deletedWasSelected) {
        setSelectedMarket(null);
        setSelectedRegion(null);
        if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
        setMarketEditMode("idle");
        setEditMenuOpen(false);
        setMarketSearch("");
        setMarketFilters({ chain: null, gm: null, city: null, region: null });
        setMarketFilter("all");
      }
      setCampaignContextMenu(null);
      setCampaignDeleteDialog(null);
      setHardDeleteConfirmationInput("");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Kampagne konnte nicht gelöscht werden.");
    } finally {
      setIsDeletingCampaign(false);
      setCampaignPendingOps((current) => {
        const next = Math.max(0, (current[targetCampaignId] ?? 0) - 1);
        return { ...current, [targetCampaignId]: next };
      });
    }
  }, [
    campaignDeleteDialog,
    campaignPendingOps,
    hardDeleteConfirmationInput,
    hardDeletePhraseMatches,
    isDeletingCampaign,
    selectedId,
  ]);

  useEffect(() => {
    if (!campaignContextMenu) return;
    const closeMenu = () => setCampaignContextMenu(null);
    const handleMouseDown = (event: MouseEvent) => {
      if (campaignContextMenuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [campaignContextMenu]);
  const assignedMarkets = useMemo(
    () => (campaignId ? assignedMarketsByCampaignId.get(campaignId) ?? [] : []),
    [assignedMarketsByCampaignId, campaignId],
  );
  const campaignVisitStatusByMarket = useMemo(
    () => (campaignId ? visitStatusByCampaignId[campaignId] ?? {} : {}),
    [campaignId, visitStatusByCampaignId],
  );
  const selectedVisitStatus = selectedMarket ? campaignVisitStatusByMarket[selectedMarket] ?? null : null;
  const selectedVisitDetailKey =
    campaignId && selectedMarket && selectedVisitStatus?.hasSubmittedVisit
      ? getVisitDetailKey(campaignId, selectedMarket, selectedVisitStatus.sessionId)
      : null;
  const selectedVisitDetail = selectedVisitDetailKey ? visitDetailByKey[selectedVisitDetailKey] ?? null : null;
  const selectedVisitDetailLoading = selectedVisitDetailKey ? Boolean(visitDetailLoadingByKey[selectedVisitDetailKey]) : false;
  const selectedVisitDetailError = selectedVisitDetailKey ? visitDetailErrorByKey[selectedVisitDetailKey] ?? null : null;

  useEffect(() => {
    if (!campaignId || !selectedMarket || !selectedVisitStatus?.hasSubmittedVisit) return;
    void refreshMarketVisitDetail(campaignId, selectedMarket, selectedVisitStatus.sessionId);
  }, [
    campaignId,
    refreshMarketVisitDetail,
    selectedMarket,
    selectedVisitStatus?.hasSubmittedVisit,
    selectedVisitStatus?.sessionId,
  ]);

  const assignedMarketIdSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const availableMarkets = useMemo(
    () => marketsData.filter((m) => !assignedMarketIdSet.has(m.id)),
    [assignedMarketIdSet, marketsData],
  );

  const finishedCount = useMemo(() => assignedMarkets.filter((m) => m.finished).length, [assignedMarkets]);
  const pendingCount = assignedMarkets.length - finishedCount;

  const statusFiltered = useMemo(
    () =>
      marketEditMode === "remove"
        ? assignedMarkets.filter((m) => !m.finished)
        : marketFilter === "finished"
          ? assignedMarkets.filter((m) => m.finished)
          : marketFilter === "pending"
            ? assignedMarkets.filter((m) => !m.finished)
            : assignedMarkets,
    [assignedMarkets, marketEditMode, marketFilter],
  );

  const filteredMarkets = useMemo(
    () => applyMarketFilters(statusFiltered, marketSearch, marketFilters),
    [marketFilters, marketSearch, statusFiltered],
  );
  const visibleFilteredMarkets = useMemo(
    () => filteredMarkets.slice(0, marketRenderLimit),
    [filteredMarkets, marketRenderLimit],
  );
  const hasMoreFilteredMarkets = visibleFilteredMarkets.length < filteredMarkets.length;

  // Derive filter option lists from the full assigned set
  const mfChains = useMemo(() => Array.from(new Set(assignedMarkets.map((m) => m.chain))).sort(), [assignedMarkets]);
  const mfGms = useMemo(() => Array.from(new Set(assignedMarkets.map((m) => m.gm))).sort(), [assignedMarkets]);
  const mfCities = useMemo(() => Array.from(new Set(assignedMarkets.map((m) => m.city))).sort(), [assignedMarkets]);
  const mfRegions = useMemo(() => Array.from(new Set(assignedMarkets.map((m) => m.region))).sort(), [assignedMarkets]);
  const selectedRegionGms = useMemo(() => {
    if (!selectedRegion || !campaign) return [];
    const marketsInRegion = assignedMarkets.filter((market) => market.region === selectedRegion);
    const marketById = new Map(marketsInRegion.map((market) => [market.id, market] as const));
    const statsByGm = new Map<string, { name: string; total: number; filled: number }>();
    const normalizeGmKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");

    const ensure = (name: string) => {
      const trimmed = name.trim().replace(/\s+/g, " ");
      if (!trimmed) return null;
      const key = normalizeGmKey(trimmed);
      const current = statsByGm.get(key) ?? { name: trimmed, total: 0, filled: 0 };
      if (!statsByGm.has(key)) {
        statsByGm.set(key, current);
      }
      return current;
    };

    for (const assignment of campaign.assignments ?? []) {
      const market = marketById.get(assignment.marketId);
      if (!market) continue;
      const current = ensure(assignment.gmName?.trim() ?? "");
      if (!current) continue;
      current.total += 1;
      if (market.finished) current.filled += 1;
    }

    // Fallback for rows that have no explicit assignment but do carry market GM metadata.
    for (const market of marketsInRegion) {
      const gmName = market.gm?.trim() ?? "";
      if (!gmName) continue;
      if (campaign.assignments?.some((assignment) => assignment.marketId === market.id)) continue;
      const current = ensure(gmName);
      if (!current) continue;
      current.total += 1;
      if (market.finished) current.filled += 1;
    }

    return Array.from(statsByGm.values())
      .map((stats) => ({
        name: stats.name,
        pct: stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [assignedMarkets, campaign, selectedRegion]);

  useEffect(() => {
    setMarketRenderLimit(MARKET_LIST_INITIAL_LIMIT);
  }, [campaignId, marketEditMode, marketFilter, marketSearch, marketFilters.chain, marketFilters.gm, marketFilters.city, marketFilters.region]);

  const invalidateCampaignVisitStatus = useCallback((targetCampaignId: string) => {
    for (const key of Array.from(visitDetailPrefetchStartedRef.current)) {
      if (key.startsWith(`${targetCampaignId}:`)) {
        visitDetailPrefetchStartedRef.current.delete(key);
      }
    }
    setVisitStatusByCampaignId((current) => {
      const next = { ...current };
      delete next[targetCampaignId];
      return next;
    });
    setVisitStatusErrorByCampaignId((current) => {
      const next = { ...current };
      delete next[targetCampaignId];
      return next;
    });
    setVisitDetailByKey((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${targetCampaignId}:`)),
    ));
  }, []);

  const handleConfirmCampaignReassignment = useCallback(async () => {
    if (!campaignReassignDialog?.campaignId || isReassigningCampaign) return;
    const targetCampaignId = campaignReassignDialog.campaignId;
    if ((campaignPendingOps[targetCampaignId] ?? 0) > 0) return;
    const reassignments = reassignGroups
      .map((group) => ({
        fromGmUserId: group.gmUserId,
        toGmUserId: reassignmentsBySourceGm[group.gmUserId] ?? group.gmUserId,
      }))
      .filter((entry) => entry.fromGmUserId !== entry.toGmUserId);
    if (reassignments.length === 0) return;

    setMutationError(null);
    setIsReassigningCampaign(true);
    setCampaignPendingOps((current) => ({ ...current, [targetCampaignId]: (current[targetCampaignId] ?? 0) + 1 }));
    try {
      const updated = await reassignCampaignGms(targetCampaignId, reassignments);
      setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      invalidateCampaignVisitStatus(updated.id);
      void refreshCampaignVisitStatuses([updated.id], { suppressErrorBanner: true, force: true });
      setCampaignReassignDialog(null);
      setReassignmentsBySourceGm({});
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "GM-Zuordnung konnte nicht umgestellt werden.");
    } finally {
      setIsReassigningCampaign(false);
      setCampaignPendingOps((current) => {
        const next = Math.max(0, (current[targetCampaignId] ?? 0) - 1);
        return { ...current, [targetCampaignId]: next };
      });
    }
  }, [
    campaignPendingOps,
    campaignReassignDialog?.campaignId,
    invalidateCampaignVisitStatus,
    isReassigningCampaign,
    reassignGroups,
    reassignmentsBySourceGm,
    refreshCampaignVisitStatuses,
  ]);

  const handleRemoveMarket = useCallback((id: string) => {
    if (!campaignId || isCampaignBusy(campaignId)) return;
    setMutationError(null);
    setRemovingIds((p) => [...p, id]);
    setTimeout(() => {
      const previousMarketIds = campaignMarketIds;
      setCampaignsData((current) =>
        current.map((entry) =>
          entry.id === campaignId ? { ...entry, marketIds: entry.marketIds.filter((marketId) => marketId !== id) } : entry,
        ),
      );
      setCampaignPendingOps((current) => ({ ...current, [campaignId]: (current[campaignId] ?? 0) + 1 }));
      void removeCampaignMarket(campaignId, id)
        .then((updated) => {
          setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
          invalidateCampaignVisitStatus(updated.id);
          void refreshCampaignVisitStatuses([updated.id], { suppressErrorBanner: true, force: true });
        })
        .catch((error) => {
          setCampaignsData((current) =>
            current.map((entry) => (entry.id === campaignId ? { ...entry, marketIds: previousMarketIds } : entry)),
          );
          setMutationError(error instanceof Error ? error.message : "Markt konnte nicht entfernt werden.");
        })
        .finally(() => {
          setCampaignPendingOps((current) => {
            const next = Math.max(0, (current[campaignId] ?? 0) - 1);
            return { ...current, [campaignId]: next };
          });
        });
      setRemovingIds((p) => p.filter((rid) => rid !== id));
    }, 320);
  }, [campaignId, campaignMarketIds, campaignPendingOps, invalidateCampaignVisitStatus, refreshCampaignVisitStatuses]);

  const handleAddMarket = useCallback((id: string) => {
    if (!campaignId || isCampaignBusy(campaignId)) return;
    setMutationError(null);
    const previousMarketIds = campaignMarketIds;
    setCampaignsData((current) =>
      current.map((entry) =>
        entry.id === campaignId
          ? { ...entry, marketIds: entry.marketIds.includes(id) ? entry.marketIds : [id, ...entry.marketIds] }
          : entry,
      ),
    );
    setCampaignPendingOps((current) => ({ ...current, [campaignId]: (current[campaignId] ?? 0) + 1 }));
    void assignCampaignMarkets(campaignId, [id])
      .then((updated) => {
        setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
        invalidateCampaignVisitStatus(updated.id);
        void refreshCampaignVisitStatuses([updated.id], { suppressErrorBanner: true, force: true });
      })
      .catch((error) => {
        setCampaignsData((current) =>
          current.map((entry) => (entry.id === campaignId ? { ...entry, marketIds: previousMarketIds } : entry)),
        );
        const conflicts = getCampaignOverlapConflicts(error);
        if (conflicts.length > 0) {
          setOverlapConflictMarketId(id);
          setOverlapConflicts(conflicts);
        } else {
          setMutationError(error instanceof Error ? error.message : "Markt konnte nicht hinzugefuegt werden.");
        }
      })
      .finally(() => {
        setCampaignPendingOps((current) => {
          const next = Math.max(0, (current[campaignId] ?? 0) - 1);
          return { ...current, [campaignId]: next };
        });
      });
    setEnteringIds((p) => [...p, id]);
    setTimeout(() => setEnteringIds((p) => p.filter((eid) => eid !== id)), 320);
  }, [campaignId, campaignMarketIds, campaignPendingOps, invalidateCampaignVisitStatus, refreshCampaignVisitStatuses]);

  const handleUndoAddMarket = useCallback((id: string) => {
    if (!campaignId || isCampaignBusy(campaignId)) return;
    setMutationError(null);
    const previousMarketIds = campaignMarketIds;
    setCampaignsData((current) =>
      current.map((entry) =>
        entry.id === campaignId ? { ...entry, marketIds: entry.marketIds.filter((marketId) => marketId !== id) } : entry,
      ),
    );
    setCampaignPendingOps((current) => ({ ...current, [campaignId]: (current[campaignId] ?? 0) + 1 }));
    void removeCampaignMarket(campaignId, id)
      .then((updated) => {
        setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
        invalidateCampaignVisitStatus(updated.id);
        void refreshCampaignVisitStatuses([updated.id], { suppressErrorBanner: true, force: true });
      })
      .catch((error) => {
        setCampaignsData((current) =>
          current.map((entry) => (entry.id === campaignId ? { ...entry, marketIds: previousMarketIds } : entry)),
        );
        setMutationError(error instanceof Error ? error.message : "?nderung konnte nicht rückgängig gemacht werden.");
      })
      .finally(() => {
        setCampaignPendingOps((current) => {
          const next = Math.max(0, (current[campaignId] ?? 0) - 1);
          return { ...current, [campaignId]: next };
        });
      });
    setEnteringIds((p) => p.filter((eid) => eid !== id));
  }, [campaignId, campaignMarketIds, campaignPendingOps, invalidateCampaignVisitStatus, refreshCampaignVisitStatuses]);

  const handleSwitchFragebogen = useCallback(
    async (nextId: string) => {
      if (!campaignId || switchingCampaignId || isCampaignBusy(campaignId) || campaignCurrentFragebogenId === nextId) return;
      setMutationError(null);
      try {
        setSwitchingCampaignId(campaignId);
        setCampaignPendingOps((current) => ({ ...current, [campaignId]: (current[campaignId] ?? 0) + 1 }));
        const updated = await switchCampaignFragebogen(campaignId, nextId);
        setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : "Fragebogen konnte nicht gewechselt werden.");
      } finally {
        setCampaignPendingOps((current) => {
          const next = Math.max(0, (current[campaignId] ?? 0) - 1);
          return { ...current, [campaignId]: next };
        });
        setSwitchingCampaignId(null);
      }
    },
    [campaignCurrentFragebogenId, campaignId, campaignPendingOps, switchingCampaignId],
  );

  const handleExportFbManagement = useCallback(async () => {
    if (isExportingFbManagement) return;
    setIsExportingFbManagement(true);
    setExportError(null);
    try {
      await exportFbManagementExcel({
        campaigns: campaignsData,
        markets: marketsData,
        visitStatusByCampaignId,
        fragebogenByScope,
        modulesByScope,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExportingFbManagement(false);
    }
  }, [campaignsData, fragebogenByScope, isExportingFbManagement, marketsData, modulesByScope, visitStatusByCampaignId]);

  useEffect(() => {
    const handler = () => { void handleExportFbManagement(); };
    window.addEventListener("admin:fbmanagement:export", handler);
    return () => window.removeEventListener("admin:fbmanagement:export", handler);
  }, [handleExportFbManagement]);

  if (loading) {
    return (
      <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
        <style>{`
          @keyframes campaignSkeletonPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.85; }
          }
          @keyframes campaignSkeletonShimmer {
            0% { transform: translate(-120%, -120%) rotate(24deg); opacity: 0; }
            22% { opacity: 0.7; }
            70% { opacity: 0.18; }
            100% { transform: translate(120%, 120%) rotate(24deg); opacity: 0; }
          }
          .campaign-skeleton-block {
            position: relative;
            overflow: hidden;
            background: rgba(0,0,0,0.08);
            animation: campaignSkeletonPulse 1.8s ease-in-out infinite;
          }
          .campaign-skeleton-block::after {
            content: "";
            position: absolute;
            inset: -130% -140%;
            background: linear-gradient(135deg, transparent 43%, rgba(255,255,255,0.92) 50%, transparent 57%);
            animation: campaignSkeletonShimmer 2.3s ease-in-out infinite;
            pointer-events: none;
          }
        `}</style>

        <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
              overflow: "hidden",
              display: "flex",
              minHeight: 480,
              margin: "8px 8px 8px",
            }}
          >
            <div
              style={{
                width: 240,
                flexShrink: 0,
                borderRight: "1px solid rgba(0,0,0,0.06)",
                padding: "16px 0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", marginBottom: 8 }}>
                <div className="campaign-skeleton-block" style={{ height: 10, width: 76, borderRadius: 6 }} />
                <div className="campaign-skeleton-block" style={{ height: 18, width: 52, borderRadius: 5 }} />
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`campaign-skeleton-item-${index}`}
                  style={{ margin: "0 10px", padding: "10px 10px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.045)" }}
                >
                  <div className="campaign-skeleton-block" style={{ height: 12, width: "74%", borderRadius: 6 }} />
                  <div className="campaign-skeleton-block" style={{ height: 9, width: "48%", borderRadius: 5, marginTop: 8 }} />
                </div>
              ))}
            </div>

            <div style={{ flex: 1, padding: "14px", display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
              <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ background: "#fff", margin: "8px 8px 8px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", gap: 22 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div className="campaign-skeleton-block" style={{ height: 24, width: 280, borderRadius: 7 }} />
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="campaign-skeleton-block" style={{ width: 36, height: 20, borderRadius: 99 }} />
                        <div className="campaign-skeleton-block" style={{ height: 10, width: 100, borderRadius: 5 }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="campaign-skeleton-block" style={{ height: 10, width: 110, borderRadius: 5 }} />
                      <div className="campaign-skeleton-block" style={{ height: 22, width: 68, borderRadius: 6 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                      <div className="campaign-skeleton-block" style={{ height: 32, width: 84, borderRadius: 8 }} />
                      <div className="campaign-skeleton-block" style={{ height: 13, width: 122, borderRadius: 6 }} />
                      <div style={{ marginLeft: "auto" }} className="campaign-skeleton-block">
                        <div style={{ height: 20, width: 52, borderRadius: 7 }} />
                      </div>
                    </div>
                    <div className="campaign-skeleton-block" style={{ height: 6, width: "100%", borderRadius: 99 }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                    <div className="campaign-skeleton-block" style={{ width: 250, borderRadius: 10, height: 82 }} />
                    <div style={{ width: 1, backgroundColor: "rgba(0,0,0,0.06)", margin: "0 14px", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", gap: 8 }}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`campaign-stat-skeleton-${i}`} style={{ flex: 1, padding: "13px 12px", borderRadius: 10, backgroundColor: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.045)" }}>
                          <div className="campaign-skeleton-block" style={{ height: 8, width: "58%", borderRadius: 5, marginBottom: 9 }} />
                          <div className="campaign-skeleton-block" style={{ height: 17, width: "42%", borderRadius: 6 }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                      <div className="campaign-skeleton-block" style={{ height: 10, width: 84, borderRadius: 5 }} />
                    </div>
                    <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 14 }} />
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={`campaign-region-skeleton-${index}`} style={{ marginBottom: index === 2 ? 0 : 10 }}>
                        <div className="campaign-skeleton-block" style={{ height: 10, width: `${56 + index * 9}%`, borderRadius: 6 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div style={{ padding: 16, fontSize: 13, color: "#DC2626" }}>{loadError}</div>;
  }

  if (!campaign) {
    return (
      <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
              overflow: "hidden",
              minHeight: 480,
              margin: "8px 8px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "28px 24px",
            }}
          >
            <div
              style={{
                width: "min(560px, 100%)",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(0,0,0,0.02)",
                padding: "22px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)" }}>
                FB Management
              </div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
                Keine Kampagnen vorhanden
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
                Erstelle zuerst eine Kampagne, damit Märkte, Fragebogen und Zuordnungen hier angezeigt werden.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openEditMenu = () => {
    if (editBtnRef.current) {
      const r = editBtnRef.current.getBoundingClientRect();
      setEditMenuPos({ x: r.right, y: r.bottom + 6 });
    }
    setEditMenuOpen(true);
  };

  const openAddPanel = () => {
    setEditMenuOpen(false);
    if (editBtnRef.current) {
      const r = editBtnRef.current.getBoundingClientRect();
      setAddPanelPos({ x: r.right - 520, y: r.bottom + 6 });
    }
    setSelectedMarket(null);
    setMarketEditMode("add");
  };

  const startRemoveMode = () => {
    setEditMenuOpen(false);
    setMarketFilter("pending");
    setSelectedMarket(null);
    setMarketEditMode("remove");
  };

  const exitEditMode = () => {
    setMarketEditMode("idle");
    setMarketFilter("all");
  };

  return (
    <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
      {mutationError && (
        <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.22)", background: "rgba(220,38,38,0.06)", color: "#DC2626", fontSize: 11, fontWeight: 600 }}>
          {mutationError}
        </div>
      )}
      {visitLoadError && (
        <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(217,119,6,0.24)", background: "rgba(217,119,6,0.07)", color: "#b45309", fontSize: 11, fontWeight: 600 }}>
          {visitLoadError}
        </div>
      )}
      {exportError && (
        <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.22)", background: "rgba(220,38,38,0.06)", color: "#DC2626", fontSize: 11, fontWeight: 600 }}>
          Export fehlgeschlagen: {exportError}
        </div>
      )}
      {overlapConflicts && overlapConflicts.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "rgba(10,16,28,0.36)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(860px, 95vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
              padding: 18,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Marktkonflikte in derselben Sektion</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Dieser Markt ist bereits in einer anderen aktiven Kampagne derselben Sektion enthalten.
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {overlapConflicts.map((conflict) => (
                <div
                  key={`${conflict.marketId}:${conflict.existingCampaignId}`}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "rgba(0,0,0,0.015)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{conflict.marketName}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
                    Aktuell in: <strong>{conflict.existingCampaignName}</strong> · Zeitraum: {conflict.existingPeriodLabel}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
                    Zugewiesener GM: {conflict.existingGmName ?? "Kein GM"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setOverlapConflicts(null);
                  setOverlapConflictMarketId(null);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.6)",
                  cursor: "pointer",
                }}
                disabled={resolvingOverlap}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverlapConflicts(null);
                  setOverlapConflictMarketId(null);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(0,0,0,0.08)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1f2937",
                  cursor: resolvingOverlap ? "not-allowed" : "pointer",
                  opacity: resolvingOverlap ? 0.7 : 1,
                }}
                disabled={resolvingOverlap}
              >
                Nur konfliktfreie übernehmen
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!campaignId || resolvingOverlap || !overlapConflictMarketId) return;
                  setResolvingOverlap(true);
                  setMutationError(null);
                  try {
                    const relevantConflicts = overlapConflicts.filter(
                      (conflict) => conflict.marketId === overlapConflictMarketId,
                    );
                    const updated = await migrateCampaignMarkets(
                      campaignId,
                      relevantConflicts.map((conflict) => ({
                        marketId: conflict.marketId,
                        fromCampaignId: conflict.existingCampaignId,
                        gmUserId: conflict.existingGmUserId ?? null,
                        reason: "campaign_overlap_resolution",
                      })),
                    );
                    setCampaignsData((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
                    invalidateCampaignVisitStatus(updated.id);
                    void refreshCampaignVisitStatuses([updated.id], { suppressErrorBanner: true, force: true });
                    setOverlapConflicts(null);
                    setOverlapConflictMarketId(null);
                  } catch (error) {
                    setMutationError(error instanceof Error ? error.message : "Migration konnte nicht durchgeführt werden.");
                  } finally {
                    setResolvingOverlap(false);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: resolvingOverlap ? "not-allowed" : "pointer",
                  opacity: resolvingOverlap ? 0.7 : 1,
                }}
                disabled={resolvingOverlap || !campaignId || !overlapConflictMarketId}
              >
                Markt(e) migrieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main card ─────────────────────────────────────── */}
      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        overflow: "hidden",
        display: "flex",
        minHeight: 480,
        margin: "8px 8px 8px",
      }}>

        {/* Left: campaign list */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid rgba(0,0,0,0.06)",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", marginBottom: 8, gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Kampagnen</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => { setShowInactive((prev) => !prev); }}
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
          </div>
          <div
            className="fbmCampaignList"
            style={{
              maxHeight: 486,
              overflowY: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style>{`.fbmCampaignList::-webkit-scrollbar{display:none}`}</style>
            {visibleCampaigns.map((c) => (
              <CampaignListItem
                key={c.id}
                campaign={c}
                selected={c.id === selectedId}
                onClick={() => handleSelectCampaign(c.id)}
                onContextMenu={(event) => handleOpenCampaignContextMenu(event, c.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: campaign detail */}
        <div style={{ flex: 1, padding: "14px", display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>

          {/* Grey outer / white inner card */}
          <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#fff", margin: "8px 8px 8px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", gap: 22 }}>

          {/* Campaign title + status */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2 }}>{campaign.name}</h2>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 36, height: 20, borderRadius: 99, cursor: "pointer",
                  backgroundColor: campaign.status !== "inactive" ? campaign.color : "rgba(0,0,0,0.12)",
                  position: "relative", transition: "background-color 0.2s ease",
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: campaign.status !== "inactive" ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s ease",
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(0,0,0,0.35)", letterSpacing: "0" }}>Kampagne aktiv</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(0,0,0,0.35)", letterSpacing: "0" }}>{campaign.period}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, letterSpacing: "0.01em",
                backgroundColor: campaign.status === "inactive" ? "rgba(220,38,38,0.08)" : campaign.status === "active" ? "rgba(22,163,74,0.08)" : "rgba(217,119,6,0.08)",
                color: campaign.status === "inactive" ? "#DC2626" : campaign.status === "active" ? "#16a34a" : "#d97706",
              }}>
                {campaign.status === "active" ? "Aktiv" : campaign.status === "scheduled" ? "Geplant" : "Inaktiv"}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              {campaignStatusMetricsLoading ? (
                <>
                  <span className="fbm-inline-skeleton" style={{ width: 76, height: 32, borderRadius: 8, display: "inline-block" }} />
                  <span className="fbm-inline-skeleton" style={{ width: 88, height: 14, borderRadius: 99, display: "inline-block" }} />
                  <span className="fbm-inline-skeleton" style={{ marginLeft: "auto", width: 48, height: 22, borderRadius: 8, display: "inline-block" }} />
                </>
              ) : (
                <>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.04em", lineHeight: 1 }}>
                    {campaign.filled.toLocaleString("de-AT")}
                  </span>
                  <span style={{ fontSize: 13, color: "rgba(0,0,0,0.35)", fontWeight: 400, letterSpacing: "-0.01em" }}>
                    / {campaign.total.toLocaleString("de-AT")} Märkte
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 700, color: pct >= 80 ? "#16a34a" : pct > 0 ? "#d97706" : "rgba(0,0,0,0.2)", letterSpacing: "-0.02em" }}>
                    {pct}%
                  </span>
                </>
              )}
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

            {/* Fragebogen assigned card — interactive switcher */}
            <FragebogenSwitcher
              key={campaign.id}
              campaignColor={campaign.color}
              options={fragebogenOptions[campaign.section] ?? []}
              activeId={campaign.currentFragebogenId}
              onSwitch={handleSwitchFragebogen}
              isSwitching={switchingCampaignId === campaign.id || campaignBusy}
              disabled={campaignBusy}
            />
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
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <span
                style={{ fontSize: 9, fontWeight: 700, color: selectedRegion ? campaign.color : "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase", transition: "color 0.2s ease", cursor: selectedRegion ? "pointer" : "default" }}
                onClick={() => { if (selectedRegion) { if (regionTimerRef.current) clearTimeout(regionTimerRef.current); setSelectedRegion(null); } }}
              >
                {selectedRegion ?? "Regionen"}
              </span>
              {selectedRegion && (
                <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)", marginLeft: "auto", fontWeight: 500 }}>kehrt zurück…</span>
              )}
            </div>
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 14 }} />
            {selectedRegion
              ? selectedRegionGms.length > 0
                ? selectedRegionGms.map((gm) => (
                    <RegionBar key={gm.name} name={gm.name} pct={gm.pct} />
                  ))
                : (
                    <div style={{ padding: "2px 0", fontSize: 11, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
                      Keine GM-Zuordnung für diese Region verfügbar.
                    </div>
                  )
              : campaignStatusMetricsLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <span className="fbm-inline-skeleton" style={{ width: 130, height: 11, borderRadius: 99, flexShrink: 0 }} />
                      <span className="fbm-inline-skeleton" style={{ flex: 1, height: 5, borderRadius: 99 }} />
                      <span className="fbm-inline-skeleton" style={{ width: 34, height: 11, borderRadius: 99, flexShrink: 0 }} />
                    </div>
                  ))
                : campaign.regions.map((r) => (
                    <RegionBar
                      key={r.name}
                      name={r.name}
                      pct={r.pct}
                      onClick={() => {
                        if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
                        setSelectedRegion(r.name);
                        regionTimerRef.current = setTimeout(() => setSelectedRegion(null), 10000);
                      }}
                    />
                  ))
            }
          </div>
            </div>{/* end white inner */}
          </div>{/* end grey outer */}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Fragebogen Vorschau</span>
            <button
              disabled={!campaignCurrentFragebogenId}
              onClick={() => setShowHeatmap((h) => !h)}
              style={{
                fontSize: 8, fontWeight: 600, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                color: !campaignCurrentFragebogenId ? "rgba(0,0,0,0.2)" : showHeatmap ? "#DC2626" : "rgba(0,0,0,0.35)",
                background: !campaignCurrentFragebogenId ? "transparent" : showHeatmap ? "rgba(220,38,38,0.08)" : "transparent",
                border: !campaignCurrentFragebogenId ? "1px solid transparent" : showHeatmap ? "1px solid rgba(220,38,38,0.2)" : "1px solid transparent",
                letterSpacing: "0.01em", transition: "all 0.15s ease",
                opacity: !campaignCurrentFragebogenId ? 0.65 : 1,
              }}
              onMouseEnter={(e) => { if (!showHeatmap && campaignCurrentFragebogenId) e.currentTarget.style.color = "rgba(0,0,0,0.55)"; }}
              onMouseLeave={(e) => { if (!showHeatmap && campaignCurrentFragebogenId) e.currentTarget.style.color = "rgba(0,0,0,0.35)"; }}
            >Antworten anzeigen</button>
          </div>
          {!campaignCurrentFragebogenId ? (
            <div
              style={{
                flex: 1,
                minHeight: 380,
                borderRadius: 12,
                border: "1px dashed rgba(0,0,0,0.14)",
                background: "rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 18px",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.62)", letterSpacing: "-0.01em" }}>
                  Kein Fragebogen zugewiesen
                </span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.42)", fontWeight: 500 }}>
                  Wähle links einen Fragebogen, um die Vorschau zu sehen.
                </span>
              </div>
            </div>
          ) : campaign.section === "flex" ? (
            <FlexFragebogenVorschau key="flex" questions={previewQuestions} showHeatmap={showHeatmap} />
          ) : campaign.section === "kuehler" ? (
            <KuehlerFragebogenVorschau key="kuehler" questions={previewQuestions} showHeatmap={showHeatmap} />
          ) : campaign.section === "mhd" ? (
            <MhdFragebogenVorschau key="mhd" questions={previewQuestions} showHeatmap={showHeatmap} />
          ) : campaign.section === "billa" ? (
            <BillaFragebogenVorschau key="billa" questions={previewQuestions} showHeatmap={showHeatmap} />
          ) : (
            <FragebogenVorschau key="standard" questions={previewQuestions} showHeatmap={showHeatmap} />
          )}
        </div>
      </div>{/* end white inner */}
      </div>{/* end grey outer */}

      {/* ── Markets card ──────────────────────────────────── */}
      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>

        {/* Grey header row — Zugewiesene Märkte + all controls */}
        <div style={{ padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>Zugewiesene Märkte</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>{assignedMarkets.length} Märkte gesamt</span>
            {isVisitStatusLoading && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.42)" }}>Besuchsstatus lädt...</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Status tabs */}
            {marketEditMode !== "remove" && (
              <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,0.06)", borderRadius: 8, padding: 3 }}>
                {(["all", "finished", "pending"] as const).map((f) => (
                  <button key={f} onClick={() => setMarketFilter(f)}
                    style={{ padding: "4px 10px", fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "none", backgroundColor: marketFilter === f ? "#fff" : "transparent", color: marketFilter === f ? "#1a1a1a" : "rgba(0,0,0,0.4)", boxShadow: marketFilter === f ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none", transition: "all 0.18s ease", whiteSpace: "nowrap" as const }}
                  >
                    {f === "all"
                      ? `Alle (${assignedMarkets.length})`
                      : campaignStatusMetricsLoading
                        ? f === "finished" ? "Abgeschlossen (...)" : "Ausstehend (...)"
                        : f === "finished" ? `Abgeschlossen (${finishedCount})` : `Ausstehend (${pendingCount})`}
                  </button>
                ))}
              </div>
            )}
            {/* Edit / remove mode controls */}
            {marketEditMode === "remove" ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", padding: "4px 8px", borderRadius: 6, background: "rgba(220,38,38,0.07)" }}>Entfernen-Modus</span>
                <button onClick={exitEditMode} disabled={campaignBusy}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)", cursor: campaignBusy ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", background: "transparent", transition: "all 0.15s ease", opacity: campaignBusy ? 0.7 : 1 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >Fertig</button>
              </div>
            ) : marketEditMode === "add" ? (
              <button onClick={exitEditMode} disabled={campaignBusy}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)", cursor: campaignBusy ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", background: "transparent", transition: "all 0.15s ease", opacity: campaignBusy ? 0.7 : 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >{campaignBusy ? "Speichern..." : "Fertig"}</button>
            ) : (
              <button ref={editBtnRef} onClick={() => { if (!campaignBusy) openEditMenu(); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", background: "transparent", transition: "all 0.15s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#1a1a1a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(0,0,0,0.5)"; }}
                disabled={campaignBusy}
              >
                {campaignBusy ? "Speichern..." : "Bearbeiten"}
              </button>
            )}
          </div>
        </div>

        {/* White inner card — search, filters, market list */}
        <div style={{ margin: "0 8px 8px", background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <style>{`
          @keyframes mrSlideOut { from { transform:translateX(0); opacity:1; max-height:60px } to { transform:translateX(110%); opacity:0; max-height:0; padding-top:0; padding-bottom:0; border-width:0 } }
          @keyframes mrSlideIn  { from { transform:translateX(40px); opacity:0 } to { transform:translateX(0); opacity:1 } }
          @keyframes fbmInlineSkeletonPulse { 0%, 100% { opacity: 0.46; } 50% { opacity: 0.84; } }
          .fbm-inline-skeleton {
            position: relative;
            overflow: hidden;
            background: rgba(0,0,0,0.075);
            animation: fbmInlineSkeletonPulse 1.4s ease-in-out infinite;
          }
        `}</style>

        {/* Header row 2: search + filter chips */}
        <div style={{ padding: "10px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "1 1 200px", minWidth: 160, padding: "0 10px", height: 32, borderRadius: 8, background: "rgba(0,0,0,0.035)", border: "1px solid transparent", transition: "border 0.15s, background 0.15s" }}
            onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
            onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.035)"; }}
          >
            <Search size={12} strokeWidth={2} color="rgba(0,0,0,0.3)" />
            <input
              type="text"
              placeholder="Markt, Adresse oder GM suchen"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a" }}
            />
            {marketSearch && (
              <button onClick={() => setMarketSearch("")} style={{ display: "flex", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)", padding: 0 }}>
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>
          {/* Filter chips */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <MarketFilterChip label="Kette"  value={marketFilters.chain}  options={mfChains}  onChange={(v) => setMarketFilters((p) => ({ ...p, chain: v }))} />
            <MarketFilterChip label="GM"     value={marketFilters.gm}     options={mfGms}     onChange={(v) => setMarketFilters((p) => ({ ...p, gm: v }))} />
            <MarketFilterChip label="Stadt"  value={marketFilters.city}   options={mfCities}  onChange={(v) => setMarketFilters((p) => ({ ...p, city: v }))} />
            <MarketFilterChip label="Region" value={marketFilters.region} options={mfRegions} onChange={(v) => setMarketFilters((p) => ({ ...p, region: v }))} />
          </div>
        </div>

        {/* Market list */}
        <div style={{ position: "relative", overflow: "hidden", minHeight: selectedMarket ? 520 : undefined }}>
          {filteredMarkets.length === 0 && (
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>
                {marketEditMode === "remove" ? "Keine ausstehenden Märkte zum Entfernen." : "Keine Märkte gefunden."}
              </span>
            </div>
          )}
          {visibleFilteredMarkets.map((m) => {
            const visitStatus = campaignVisitStatusByMarket[m.id] ?? null;
            const rowStatusLoading = Boolean(campaign && !campaign.statusLoaded && (campaign.statusLoading || isVisitStatusLoading));
            return (
              <MarketRow
                key={m.id}
                market={m}
                visitStatus={visitStatus}
                statusLoading={rowStatusLoading}
                mode={marketEditMode}
                isRemoving={removingIds.includes(m.id)}
                isEntering={enteringIds.includes(m.id)}
                onRemove={() => handleRemoveMarket(m.id)}
                removeDisabled={campaignBusy}
                onClick={visitStatus?.hasSubmittedVisit && marketEditMode === "idle" ? () => setSelectedMarket(m.id) : undefined}
              />
            );
          })}
          {selectedMarket && (() => {
            const m = marketsData.find((x) => x.id === selectedMarket);
            if (!m) return null;
            const visitStatus = campaignVisitStatusByMarket[m.id] ?? null;
            if (!campaignId || !visitStatus?.hasSubmittedVisit) return null;
            const retryDetail = () => {
              void refreshMarketVisitDetail(campaignId, m.id, visitStatus.sessionId, { force: true });
            };
            return selectedVisitDetail ? (
              <MarketVisitDetail
                market={m}
                campaignColor={campaign.color}
                visitSummary={selectedVisitDetail}
                onVisitUpdated={async () => {
                  await refreshMarketVisitDetail(campaignId, m.id, visitStatus.sessionId, { force: true });
                }}
                onClose={() => setSelectedMarket(null)}
              />
            ) : (
              <MarketVisitDetailSkeleton
                market={m}
                campaignColor={campaign.color}
                loading={selectedVisitDetailLoading}
                error={selectedVisitDetailError}
                onRetry={retryDetail}
                onClose={() => setSelectedMarket(null)}
              />
            );
          })()}
          {hasMoreFilteredMarkets && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,0,0,0.05)", background: "#fff", position: "sticky", bottom: 0 }}>
              <button
                onClick={() => setMarketRenderLimit((current) => current + MARKET_LIST_LOAD_STEP)}
                style={{
                  width: "100%",
                  height: 30,
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.6)",
                }}
              >
                Mehr laden ({visibleFilteredMarkets.length} / {filteredMarkets.length})
              </button>
            </div>
          )}
        </div>
        </div>{/* end white inner */}
      </div>{/* end grey outer */}

      {/* Portals */}
      {editMenuOpen && (
        <MarketEditMenu
          pos={editMenuPos}
          onAdd={openAddPanel}
          onRemove={startRemoveMode}
          onClose={() => setEditMenuOpen(false)}
        />
      )}
      {marketEditMode === "add" && (
        <MarketAddPanel
          pos={addPanelPos}
          availableMarkets={availableMarkets}
          onAdd={handleAddMarket}
          onUndoAdd={handleUndoAddMarket}
          onClose={exitEditMode}
          isPending={campaignBusy}
        />
      )}
      {campaignContextMenu && contextMenuCampaign && createPortal(
        <div
          ref={campaignContextMenuRef}
          style={{
            position: "fixed",
            top: campaignContextMenu.y,
            left: campaignContextMenu.x,
            zIndex: 9800,
            minWidth: 200,
            backgroundColor: "#fff",
            borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
            padding: 4,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenuCampaign.section !== "flex" && (
            <button
              type="button"
              onClick={() => {
                setCampaignContextMenu(null);
                router.push(`/admin/fbmanagement/erweitern/${contextMenuCampaign.id}`);
              }}
              disabled={isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                border: "none",
                borderRadius: 6,
                padding: "7px 10px",
                background: "none",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 600,
                color: "#111827",
                cursor: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background-color 0.1s ease",
                opacity: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? 0.6 : 1,
              }}
              onMouseEnter={(event) => {
                if (isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)) return;
                event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.045)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <ListPlus size={12} strokeWidth={1.9} color="#111827" />
              Erweitern...
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCampaignReassignDialog}
            disabled={isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              border: "none",
              borderRadius: 6,
              padding: "7px 10px",
              background: "none",
              textAlign: "left",
              fontSize: 11,
              fontWeight: 600,
              color: "#111827",
              cursor: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background-color 0.1s ease",
              opacity: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? 0.6 : 1,
            }}
            onMouseEnter={(event) => {
              if (isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)) return;
              event.currentTarget.style.backgroundColor = "rgba(0,0,0,0.045)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ArrowRightLeft size={12} strokeWidth={1.9} color="#111827" />
            Umtauschen...
          </button>
          <button
            type="button"
            onClick={() => handleOpenCampaignDeleteDialog("soft")}
            disabled={isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              border: "none",
              borderRadius: 6,
              padding: "7px 10px",
              background: "none",
              textAlign: "left",
              fontSize: 11,
              fontWeight: 600,
              color: "#d97706",
              cursor: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background-color 0.1s ease",
              opacity: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? 0.6 : 1,
            }}
            onMouseEnter={(event) => {
              if (isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)) return;
              event.currentTarget.style.backgroundColor = "rgba(217,119,6,0.05)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Trash2 size={12} strokeWidth={1.8} color="#d97706" />
            Soft löschen…
          </button>
          <button
            type="button"
            onClick={() => handleOpenCampaignDeleteDialog("hard")}
            disabled={isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              border: "none",
              borderRadius: 6,
              padding: "7px 10px",
              background: "none",
              textAlign: "left",
              fontSize: 11,
              fontWeight: 600,
              color: "#DC2626",
              cursor: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background-color 0.1s ease",
              opacity: isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id) ? 0.6 : 1,
            }}
            onMouseEnter={(event) => {
              if (isDeletingCampaign || isCampaignBusy(contextMenuCampaign.id)) return;
              event.currentTarget.style.backgroundColor = "rgba(220,38,38,0.05)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Trash2 size={12} strokeWidth={1.8} color="#DC2626" />
            Hard löschen…
          </button>
        </div>,
        document.body,
      )}
      {campaignReassignDialog && reassignTargetCampaign && createPortal(
        <CampaignReassignModal
          campaign={reassignTargetCampaign}
          groups={reassignGroups}
          gmUsers={gmUsers}
          values={reassignmentsBySourceGm}
          loadingGms={gmUsersLoading}
          gmUsersError={gmUsersError}
          submitting={isReassigningCampaign}
          changedCount={reassignChangedCount}
          onChange={(sourceGmUserId, targetGmUserId) => {
            setReassignmentsBySourceGm((current) => ({ ...current, [sourceGmUserId]: targetGmUserId }));
          }}
          onClose={handleCloseCampaignReassignDialog}
          onSubmit={() => void handleConfirmCampaignReassignment()}
        />,
        document.body,
      )}
      {campaignDeleteDialog && deleteTargetCampaign && createPortal(
        <div
          onClick={handleCloseCampaignDeleteDialog}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9900,
            backgroundColor: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
              padding: "20px 20px 16px",
              width: 420,
              maxWidth: "92vw",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  backgroundColor: campaignDeleteDialog.mode === "hard" ? "rgba(220,38,38,0.08)" : "rgba(217,119,6,0.09)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {campaignDeleteDialog.mode === "hard"
                  ? <AlertTriangle size={13} strokeWidth={1.8} color="#DC2626" />
                  : <Trash2 size={13} strokeWidth={1.8} color="#d97706" />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
                  {campaignDeleteDialog.mode === "hard" ? "Kampagne hard löschen" : "Kampagne soft löschen"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.42)", marginTop: 3, lineHeight: 1.5 }}>
                  <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{deleteTargetCampaign.name || "Unbenannte Kampagne"}</span>
                  {" "}
                  {campaignDeleteDialog.mode === "hard"
                    ? "wird dauerhaft entfernt."
                    : "wird ausgeblendet."}
                </div>
              </div>
            </div>
            <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />
            {campaignDeleteDialog.mode === "soft" ? (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 7,
                  marginBottom: 14,
                  backgroundColor: "rgba(217,119,6,0.06)",
                  border: "1px solid rgba(217,119,6,0.16)",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309" }}>
                  Soft Delete entfernt nur die Kampagne aus der Ansicht. Submissions bleiben erhalten.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 7,
                    backgroundColor: "rgba(220,38,38,0.06)",
                    border: "1px solid rgba(220,38,38,0.16)",
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>
                    Hard Delete löscht die Kampagne und alle zugehörigen Submissions dauerhaft.
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>
                    Zur Bestätigung exakt eingeben:
                  </label>
                  <code
                    style={{
                      fontSize: 10,
                      color: "rgba(0,0,0,0.68)",
                      background: "rgba(0,0,0,0.035)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    }}
                  >
                    {HARD_DELETE_CAMPAIGN_CONFIRMATION_TEXT}
                  </code>
                  <input
                    value={hardDeleteConfirmationInput}
                    onChange={(event) => setHardDeleteConfirmationInput(event.target.value)}
                    placeholder="Bestätigungssatz hier eingeben"
                    style={{
                      border: `1px solid ${hardDeleteConfirmationInput.length > 0 && !hardDeletePhraseMatches ? "rgba(220,38,38,0.3)" : "rgba(0,0,0,0.16)"}`,
                      borderRadius: 7,
                      padding: "8px 10px",
                      fontSize: 11,
                      background: "#fff",
                      color: "#1a1a1a",
                      fontWeight: 500,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 7 }}>
              <button
                onClick={handleCloseCampaignDeleteDialog}
                disabled={isDeletingCampaign}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.4)",
                  cursor: isDeletingCampaign ? "not-allowed" : "pointer",
                  opacity: isDeletingCampaign ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => void handleDeleteCampaign()}
                disabled={
                  isDeletingCampaign
                  || (campaignDeleteDialog.mode === "hard" && !hardDeletePhraseMatches)
                  || isCampaignBusy(deleteTargetCampaign.id)
                }
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: campaignDeleteDialog.mode === "hard"
                    ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                    : "linear-gradient(to bottom, #f97316, #ea580c)",
                  boxShadow: campaignDeleteDialog.mode === "hard"
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)"
                    : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c2410c, 0 1px 6px rgba(180,80,20,0.18)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: isDeletingCampaign ? "not-allowed" : "pointer",
                  opacity: isDeletingCampaign
                    ? 0.85
                    : campaignDeleteDialog.mode === "hard" && !hardDeletePhraseMatches
                      ? 0.55
                      : 1,
                  fontFamily: "inherit",
                }}
              >
                {isDeletingCampaign
                  ? "Lösche…"
                  : campaignDeleteDialog.mode === "hard"
                    ? "Hard löschen"
                    : "Soft löschen"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
