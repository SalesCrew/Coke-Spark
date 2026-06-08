"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BackendApiError,
  cancelGmVisitSession,
  clearGmVisitPreloadCache,
  commitGmVisitPhotos,
  createGmVisitSession,
  fetchActiveGmVisitSession,
  fetchGmVisitSession,
  fetchGmVisitStartPayload,
  presignGmVisitPhoto,
  clearGmVisitStartPreloadCache,
  readGmVisitPreloadCache,
  readGmVisitStartPreloadCache,
  saveGmVisitAnswer,
  setLatestActiveGmVisitHandoff,
  submitGmVisitSession,
  updateGmVisitSessionStart,
  type GmVisitSessionReadPayload,
  type GmVisitStartPayload,
  type GmVisitStartSection,
} from "@/lib/api/backend";
import { getPhotoTagPoolStorageKey } from "@/utils/photoTags";
import { computeHiddenQuestionIds as computeRuleHiddenQuestionIds } from "@/lib/conditional-visibility";
import {
  ChevronLeft,
  ChevronDown,
  Clock,
  Check,
  ChevronRight,
  Thermometer,
  Lock,
  MessageSquare,
  FileText,
  Refrigerator,
  MapPin,
  CheckCircle2,
  Camera,
  NotebookPen,
  Tag,
} from "lucide-react";
import Aurora from "@/components/ui/Aurora";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "active" | "abschluss" | "confirm";
type ActiveSection = "fragebogen" | "kuehler" | "mhd";

interface Answer {
  questionId: string;
  value: string | string[];
}

interface SampleQuestion {
  id: string;
  questionId?: string;
  type: "yesno" | "single" | "multiple" | "yesnomulti" | "text" | "numeric" | "likert" | "slider" | "photo" | "matrix";
  text: string;
  options?: string[];
  required: boolean;
  moduleId: string;
  moduleName: string;
  imageUrl?: string;
  imageUrls?: string[];
  rules?: Array<Record<string, unknown>>;
  chains?: string[];
  appliesToMarketChain?: boolean;
  // type-specific config
  config?: {
    // likert
    min?: number; max?: number; minLabel?: string; maxLabel?: string;
    // slider
    step?: number; unit?: string;
    // numeric
    decimals?: boolean;
    // photo
    instruction?: string;
    tagsEnabled?: boolean;
    tagIds?: string[];
    tagMeta?: Array<{ id: string; label: string; deletedAt: string | null }>;
    // matrix
    rows?: string[]; columns?: string[]; matrixSubtype?: string;
    // yesnomulti
    answers?: string[];
    branches?: { answer: string; options: string[] }[];
  };
}

function mapVisitQuestionToSample(
  section: GmVisitStartSection,
  question: GmVisitStartSection["questions"][number],
): SampleQuestion {
  const rawConfig = (question.config ?? {}) as Record<string, unknown>;
  const configOptions = Array.isArray(rawConfig.options) ? (rawConfig.options as string[]) : undefined;
  const imageList = Array.isArray(rawConfig.images) ? (rawConfig.images as string[]) : [];
  const normalizedImages = imageList
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const config = rawConfig as SampleQuestion["config"];
  return {
    id: question.id,
    questionId: question.questionId,
    type: question.type,
    text: question.text,
    options: question.options ?? configOptions,
    required: question.required,
    moduleId: question.moduleId,
    moduleName: `${section.campaignName} · ${question.moduleName}`,
    imageUrl: normalizedImages[0],
    imageUrls: normalizedImages,
    rules: question.rules ?? [],
    chains: question.chains ?? [],
    appliesToMarketChain: question.appliesToMarketChain ?? true,
    config,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo answer model
// ─────────────────────────────────────────────────────────────────────────────

interface PhotoAnswerState {
  photos: string[];
  selectedTagIds: string[];
}

interface UploadedPhotoMeta {
  storageBucket: string;
  storagePath: string;
  mimeType?: string;
  byteSize?: number;
  widthPx?: number;
  heightPx?: number;
  sha256?: string;
}

/** Encode a PhotoAnswerState into the generic answer storage */
function encodePhotoAnswer(state: PhotoAnswerState): string {
  return JSON.stringify(state);
}

/** Decode a raw answer value back to PhotoAnswerState. Falls back gracefully for legacy plain string[] answers. */
function decodePhotoAnswer(raw: string | string[] | undefined): PhotoAnswerState {
  if (!raw) return { photos: [], selectedTagIds: [] };
  if (Array.isArray(raw)) return { photos: raw, selectedTagIds: [] };
  try {
    const parsed = JSON.parse(raw as string) as Partial<PhotoAnswerState>;
    if (parsed && Array.isArray(parsed.photos)) return { photos: parsed.photos, selectedTagIds: parsed.selectedTagIds ?? [] };
  } catch { /* noop */ }
  return { photos: [raw as string], selectedTagIds: [] };
}

function isPreviewablePhotoSrc(value: string): boolean {
  return /^blob:|^data:image\/|^https?:\/\//i.test(value);
}

function photoArtifactLabel(path: string): string {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const segments = clean.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function isoToDisplayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function displayDateToIso(value: string): string | null {
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function sanitizeNumericDraftInput(raw: string, decimals: boolean): string {
  let next = raw.replace(",", ".");
  next = next.replace(decimals ? /[^0-9.\-]/g : /[^0-9\-]/g, "");
  next = next.replace(/(?!^)-/g, "");
  if (decimals) {
    const dotIdx = next.indexOf(".");
    if (dotIdx >= 0) {
      next = `${next.slice(0, dotIdx + 1)}${next.slice(dotIdx + 1).replace(/\./g, "")}`;
    }
  } else {
    next = next.replace(/\./g, "");
  }
  return next;
}

function parseYesNoMultiAnswer(rawAnswer: string | string[] | undefined): { sel: string; subs: string[] } | null {
  if (typeof rawAnswer !== "string" || rawAnswer.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(rawAnswer) as { sel?: unknown; subs?: unknown };
    const sel = typeof parsed?.sel === "string" ? parsed.sel.trim() : "";
    if (!sel) return null;
    const seen = new Set<string>();
    const subs = Array.isArray(parsed?.subs)
      ? parsed.subs
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0 && !seen.has(entry) && (seen.add(entry), true))
      : [];
    return { sel, subs };
  } catch {
    return null;
  }
}

function parseMatrixAnswer(
  question: SampleQuestion,
  rawAnswer: string | string[] | undefined,
): string[] | Record<string, string> | null {
  const subtype = String(question.config?.matrixSubtype ?? "toggle");
  if (subtype === "toggle") {
    if (!Array.isArray(rawAnswer)) return null;
    const seen = new Set<string>();
    const values = rawAnswer
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !seen.has(entry) && (seen.add(entry), true));
    return values.length > 0 ? values : null;
  }
  if (typeof rawAnswer !== "string" || rawAnswer.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(rawAnswer) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" &&
          entry[0].trim().length > 0 &&
          typeof entry[1] === "string",
      )
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0);
    if (entries.length === 0) return null;
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

function getConfiguredOptionValues(q: SampleQuestion): string[] {
  if (Array.isArray(q.options) && q.options.length > 0) {
    return q.options.filter((entry): entry is string => typeof entry === "string");
  }
  const configOptions = (q.config as { options?: unknown } | undefined)?.options;
  return Array.isArray(configOptions)
    ? configOptions.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** True when a question is complete from the GM's perspective */
function isQuestionComplete(q: SampleQuestion, rawAnswer: string | string[] | undefined): boolean {
  if (!q.required) return true;
  if (q.type === "photo") {
    if (!q.config?.tagsEnabled || !q.config?.tagIds?.length) {
      // No tag requirement — just need at least one photo
      const state = decodePhotoAnswer(rawAnswer);
      return state.photos.length > 0;
    }
    // Tag requirement — need photo(s) AND at least one selected tag
    const state = decodePhotoAnswer(rawAnswer);
    return state.photos.length > 0 && state.selectedTagIds.length > 0;
  }
  if (q.type === "yesnomulti") {
    const parsed = parseYesNoMultiAnswer(rawAnswer);
    return Boolean(parsed?.sel);
  }
  if (q.type === "matrix") {
    return parseMatrixAnswer(q, rawAnswer) !== null;
  }
  if (q.type === "multiple") {
    return Array.isArray(rawAnswer) && rawAnswer.length > 0;
  }
  if (q.type === "single") {
    if (typeof rawAnswer !== "string") return false;
    const normalized = rawAnswer.trim();
    if (normalized.length === 0) return false;
    const allowed = getConfiguredOptionValues(q);
    return allowed.length === 0 ? true : allowed.includes(normalized);
  }
  if (q.type === "yesno") {
    if (typeof rawAnswer !== "string") return false;
    const normalized = rawAnswer.trim();
    if (normalized.length === 0) return false;
    const configured = getConfiguredOptionValues(q);
    const allowed = configured.length > 0 ? configured : ["Ja", "Nein", "ja", "nein"];
    return allowed.includes(normalized);
  }
  return normalizeAnswerForPersistence(q, rawAnswer) !== undefined;
}

/** True when a tagged photo question specifically is ready to proceed. Optional photo questions are skippable. */
function isTaggedPhotoReady(q: SampleQuestion, rawAnswer: string | string[] | undefined): boolean {
  if (q.type !== "photo") return true;
  if (!q.required) return true;
  if (!q.config?.tagsEnabled || !q.config?.tagIds?.length) return true; // no tags configured
  const state = decodePhotoAnswer(rawAnswer);
  return state.photos.length > 0 && state.selectedTagIds.length > 0;
}

function normalizeAnswerForPersistence(
  question: SampleQuestion,
  rawAnswer: string | string[] | undefined,
): string | string[] | undefined {
  if (rawAnswer === undefined) return undefined;
  if (question.type === "yesnomulti") {
    const parsed = parseYesNoMultiAnswer(rawAnswer);
    return parsed ? JSON.stringify(parsed) : undefined;
  }
  if (question.type === "matrix") {
    const parsed = parseMatrixAnswer(question, rawAnswer);
    if (!parsed) return undefined;
    return Array.isArray(parsed) ? parsed : JSON.stringify(parsed);
  }
  if (Array.isArray(rawAnswer)) return rawAnswer.length > 0 ? rawAnswer : undefined;
  if (question.type === "text" || question.type === "slider" || question.type === "likert") {
    const normalized = rawAnswer.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (question.type === "numeric") {
    const normalized = rawAnswer.trim();
    if (normalized.length === 0) return undefined;
    if (/^-?$|^\.$|^-?\.$/.test(normalized)) return undefined;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? normalized : undefined;
  }
  if (question.type === "single" || question.type === "yesno") {
    const normalized = rawAnswer.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  return rawAnswer;
}

const DEFAULT_SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    id: "q1",
    type: "yesno",
    text: "[Ja / Nein] Sind alle Coke-Produkte sichtbar und frontal platziert?",
    required: true,
    moduleId: "m1",
    moduleName: "Regalprüfung",
    imageUrl: "https://picsum.photos/seed/cokeregal/480/320",
  },
  {
    id: "q2",
    type: "single",
    text: "[Single Choice] Wie ist der allgemeine Zustand der Regalfläche?",
    options: ["Sehr gut", "Gut", "Befriedigend", "Verbesserungswürdig"],
    required: true,
    moduleId: "m1",
    moduleName: "Regalprüfung",
  },
  {
    id: "q3",
    type: "multiple",
    text: "[Multiple Choice] Welche Aktionsmaterialien sind aktuell vorhanden?",
    options: ["Aufsteller", "Deckenanhänger", "Regalblende", "Preisschild", "Plakat"],
    required: false,
    moduleId: "m2",
    moduleName: "Aktionsmaterial",
    imageUrl: "https://picsum.photos/seed/aktion/300/400",
  },
  {
    id: "q4",
    type: "yesnomulti",
    text: "[Ja / Nein Multi] Ist das Display korrekt bestückt?",
    required: true,
    moduleId: "m2",
    moduleName: "Aktionsmaterial",
    config: {
      answers: ["Ja", "Nein"],
      branches: [
        {
          answer: "Ja",
          options: [
            "Produkt A vollständig", "Produkt B vollständig", "Produkt C vollständig",
            "Produkt D vollständig", "Etiketten korrekt", "Mengen stimmen überein",
            "Frontings korrekt", "Preisschilder vorhanden", "Aktionsware platziert",
            "Kühlware vorhanden", "Neue Produkte sichtbar", "Saisonware platziert",
            "Display sauber", "Beleuchtung funktioniert", "Regal vollständig",
            "POS-Material korrekt", "Lagerbestand ausreichend", "Lieferung eingetroffen",
            "Rücklaufware entfernt", "Verfallsdaten geprüft",
          ],
        },
        {
          answer: "Nein",
          options: [
            "Ware fehlt komplett", "Falsche Produkte platziert", "Display defekt",
            "Preisschilder fehlen", "Etiketten unleserlich", "Aktionsware fehlt",
            "Kühlkette unterbrochen", "Falsche Mengen geliefert", "Regal beschädigt",
            "POS-Material fehlt", "Lieferung ausständig", "Neue Produkte nicht vorhanden",
            "Saisonware fehlt", "Beleuchtung defekt", "Display verschmutzt",
            "Lagerbestand kritisch", "Falsche Preise ausgezeichnet", "Rücklaufware vorhanden",
            "MHD abgelaufen", "Bestellung nicht angekommen",
          ],
        },
      ],
    },
  },
  {
    id: "q5",
    type: "likert",
    text: "[Likert Skala] Wie zufrieden bist du mit der Platzierung der Produkte?",
    required: false,
    moduleId: "m3",
    moduleName: "Kundenerlebnis",
    config: { min: 1, max: 5, minLabel: "Sehr unzufrieden", maxLabel: "Sehr zufrieden" },
  },
  {
    id: "q6",
    type: "text",
    text: "[Offener Text] Gibt es besondere Auffälligkeiten oder Anmerkungen?",
    required: false,
    moduleId: "m3",
    moduleName: "Kundenerlebnis",
  },
  {
    id: "q7",
    type: "numeric",
    text: "[Offene Zahl] Wie viele Facings hat das Coke-Produkt im Hauptregal?",
    required: true,
    moduleId: "m4",
    moduleName: "Bestandserfassung",
    config: { min: 0, max: 100, decimals: false },
    imageUrl: "https://picsum.photos/seed/facings/360/360",
  },
  {
    id: "q8",
    type: "slider",
    text: "[Slider] Wie hoch ist der geschätzte Lagerbestand in Prozent?",
    required: false,
    moduleId: "m4",
    moduleName: "Bestandserfassung",
    config: { min: 0, max: 100, step: 5, unit: "%" },
  },
  {
    id: "q9",
    type: "photo",
    text: "[Foto Upload] Mache ein Foto des Hauptregals.",
    required: true,
    moduleId: "m5",
    moduleName: "Dokumentation",
    config: {
      instruction: "Bitte das gesamte Coke-Regal von vorne fotografieren.",
      tagsEnabled: true,
      tagIds: ["tag-seed-regal", "tag-seed-preis", "tag-seed-aktion"],
    },
  },
  {
    id: "q10",
    type: "matrix",
    text: "[Matrix] Bewerte folgende Aspekte des Marktauftritts.",
    required: false,
    moduleId: "m5",
    moduleName: "Dokumentation",
    config: {
      rows: ["Regalordnung", "Preisgestaltung", "Sauberkeit"],
      columns: ["Gut", "Mittel", "Schlecht"],
    },
  },
  {
    id: "q11",
    type: "matrix",
    text: "[Freitext Matrix] Notizen zur Produktplatzierung je Regalbereich.",
    required: false,
    moduleId: "m5",
    moduleName: "Dokumentation",
    config: {
      matrixSubtype: "freitext",
      rows: ["Coke Original", "Coke Zero", "Fanta", "Sprite"],
      columns: ["Regal A", "Regal B", "Regal C"],
    },
  },
];

// Ensure demo photo tags exist in the shared pool so q9 tag IDs resolve correctly
const SEED_PHOTO_TAGS = [
  { id: "tag-seed-regal", label: "Regal vollständig" },
  { id: "tag-seed-preis", label: "Preisschild korrekt" },
  { id: "tag-seed-aktion", label: "Aktionsfläche" },
];
if (typeof window !== "undefined") {
  try {
    const poolKey = getPhotoTagPoolStorageKey();
    const existing = JSON.parse(localStorage.getItem(poolKey) ?? "[]") as { id: string }[];
    const existingIds = new Set(existing.map((t) => t.id));
    const toAdd = SEED_PHOTO_TAGS.filter((t) => !existingIds.has(t.id));
    if (toAdd.length > 0) {
      localStorage.setItem(poolKey, JSON.stringify([...existing, ...toAdd]));
      localStorage.removeItem("admin_photo_tag_pool_v1");
    }
  } catch { /* noop */ }
}

const DEFAULT_MHD_QUESTIONS: SampleQuestion[] = [
  {
    id: "mhd1",
    type: "yesno",
    text: "Sind alle MHD-Etiketten korrekt angebracht und lesbar?",
    required: true,
    moduleId: "mhd-m1",
    moduleName: "Etikettierung",
  },
  {
    id: "mhd2",
    type: "single",
    text: "Wie viele Produkte sind innerhalb von 3 Tagen ablaufend?",
    options: ["Keine", "1–3 Produkte", "4–10 Produkte", "Mehr als 10"],
    required: true,
    moduleId: "mhd-m1",
    moduleName: "Etikettierung",
    imageUrl: "https://picsum.photos/seed/mhdlabel/480/270",
  },
  {
    id: "mhd3",
    type: "yesno",
    text: "Wurden abgelaufene Produkte aus dem Regal entfernt?",
    required: true,
    moduleId: "mhd-m1",
    moduleName: "Etikettierung",
  },
  {
    id: "mhd4",
    type: "single",
    text: "Welche Produktkategorie hat die meisten nahenden Ablaufdaten?",
    options: ["Softdrinks", "Säfte", "Energy Drinks", "Wasser", "Keine"],
    required: false,
    moduleId: "mhd-m2",
    moduleName: "Risikoanalyse",
  },
  {
    id: "mhd5",
    type: "yesno",
    text: "Wurde der Marktleiter über kritische MHD-Fälle informiert?",
    required: true,
    moduleId: "mhd-m2",
    moduleName: "Risikoanalyse",
  },
  {
    id: "mhd6",
    type: "yesno",
    text: "Sind FIFO-Regeln (First In, First Out) eingehalten?",
    required: true,
    moduleId: "mhd-m3",
    moduleName: "Lagerhaltung",
    imageUrl: "https://picsum.photos/seed/fifo/320/420",
  },
  {
    id: "mhd7",
    type: "single",
    text: "Wie ist der allgemeine Zustand der MHD-Kontrolle in diesem Markt?",
    options: ["Sehr gut", "Gut", "Verbesserungswürdig", "Kritisch"],
    required: true,
    moduleId: "mhd-m3",
    moduleName: "Lagerhaltung",
  },
  {
    id: "mhd8",
    type: "matrix",
    text: "MHD-Übersicht: Wann läuft welches Produkt ab?",
    required: false,
    moduleId: "mhd-m3",
    moduleName: "Lagerhaltung",
    config: {
      matrixSubtype: "datum",
      rows: ["Coca-Cola", "Fanta", "Sprite", "Römerquelle"],
      columns: ["Regal 1", "Regal 2", "Kühlzone"],
    },
  },
];

const DEFAULT_KUEHLER_QUESTIONS: SampleQuestion[] = [
  {
    id: "k1",
    type: "single",
    text: "Wie ist der Kühler aktuell befüllt?",
    options: ["Sehr voll", "Halb voll", "Nicht voll"],
    required: true,
    moduleId: "k-m1",
    moduleName: "Befüllung",
    imageUrl: "https://picsum.photos/seed/kuehler/400/280",
  },
  {
    id: "k2",
    type: "yesno",
    text: "Sind alle Produkte im Kühler frontal und sichtbar platziert?",
    required: true,
    moduleId: "k-m1",
    moduleName: "Befüllung",
  },
  {
    id: "k3",
    type: "yesno",
    text: "Funktioniert die Kühlung einwandfrei (Temperatur OK)?",
    required: true,
    moduleId: "k-m2",
    moduleName: "Technik & Hygiene",
  },
  {
    id: "k4",
    type: "single",
    text: "Wie ist der Hygienezustand des Kühlers?",
    options: ["Sauber", "Leicht verschmutzt", "Stark verschmutzt"],
    required: true,
    moduleId: "k-m2",
    moduleName: "Technik & Hygiene",
    imageUrl: "https://picsum.photos/seed/hygiene/260/380",
  },
  {
    id: "k5",
    type: "yesno",
    text: "Sind Preisschilder im Kühler korrekt angebracht?",
    required: false,
    moduleId: "k-m3",
    moduleName: "Kennzeichnung",
  },
  {
    id: "k6",
    type: "yesno",
    text: "Ist das Coke-Branding im Kühler sichtbar und unversehrt?",
    required: false,
    moduleId: "k-m3",
    moduleName: "Kennzeichnung",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function fmtHM(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function secondsSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

function hhmmFromIso(iso: string | null): string {
  if (!iso) return nowHHMM();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowHHMM();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

function isValidHm(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toIsoForLocalTime(baseDate: Date, hm: string): string {
  const [hRaw, mRaw] = hm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  const local = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    h,
    m,
    0,
    0,
  );
  return local.toISOString();
}

function chainColor(chain: string): { bg: string; text: string } {
  const k = chain.toUpperCase();
  if (k.includes("BILLA")) return { bg: "rgba(234,179,8,0.12)", text: "#a16207" };
  if (k.includes("SPAR")) return { bg: "rgba(220,38,38,0.08)", text: "#DC2626" };
  if (k.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (k.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (k.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.06)", text: "#6b7280" };
}

// ─────────────────────────────────────────────────────────────────────────────
// ClockPicker (copied from ActivityLauncher)
// ─────────────────────────────────────────────────────────────────────────────

interface ClockPickerProps {
  onSelect: (h: number, m: number) => void;
  onCancel: () => void;
  initialHour?: number;
  initialMinute?: number;
}

function ClockPicker({ onSelect, onCancel, initialHour = 8, initialMinute = 0 }: ClockPickerProps) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const items = step === "hour" ? hours : minutes;
  const selected = step === "hour" ? hour : minute;

  const R = 114;
  const CENTER = 135;
  const NUM_R = 93;

  function posFor(val: number) {
    const inner = step === "hour" && val >= 12;
    const r = inner ? NUM_R - 22 : NUM_R;
    const count = 12;
    const idx = step === "hour" ? val % 12 : val / 5;
    const a = (idx / count) * 360 - 90;
    const rad = (a * Math.PI) / 180;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  }

  function handleTap(val: number) {
    if (step === "hour") {
      setHour(val);
      setTimeout(() => setStep("minute"), 200);
    } else {
      setMinute(val);
      setTimeout(() => onSelect(hour, val), 150);
    }
  }

  const count = 12;
  const idx = step === "hour" ? selected % 12 : selected / 5;
  const selAngle = (idx / count) * 360 - 90;
  const selRad = (selAngle * Math.PI) / 180;
  const inner = step === "hour" && selected >= 12;
  const lineR = inner ? NUM_R - 22 : NUM_R;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "rgba(255,255,255,0.97)",
          borderRadius: 14,
          padding: "24px 24px 18px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: "clockIn 0.2s ease",
        }}
      >
        <style>{`
          @keyframes clockIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 8 }}>
          {step === "hour" ? "Stunde" : "Minute"}
        </span>

        <svg width={270} height={270} viewBox="0 0 270 270">
          <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
          <line
            x1={CENTER} y1={CENTER}
            x2={CENTER + lineR * Math.cos(selRad)}
            y2={CENTER + lineR * Math.sin(selRad)}
            stroke="#DC2626" strokeWidth={1.5} strokeLinecap="round"
            style={{ transition: "all 0.15s ease" }}
          />
          <circle cx={CENTER} cy={CENTER} r={3} fill="#DC2626" />
          {items.map((val) => {
            const p = posFor(val);
            const isSel = val === selected;
            const label = step === "hour" ? String(val) : String(val).padStart(2, "0");
            return (
              <g key={val} onClick={() => handleTap(val)} style={{ cursor: "pointer" }}>
                {isSel && <circle cx={p.x} cy={p.y} r={21} fill="#DC2626" style={{ transition: "all 0.15s ease" }} />}
                <text
                  x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={step === "hour" && val >= 12 ? 11 : 13}
                  fontWeight={isSel ? 700 : 500}
                  fill={isSel ? "#fff" : "rgba(0,0,0,0.55)"}
                  style={{ transition: "fill 0.15s ease", userSelect: "none" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        <span style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>
          {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
        </span>

        <button
          onClick={onCancel}
          style={{ marginTop: 8, fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px 12px" }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionCard — renders a single question with animation
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: SampleQuestion;
  answer: string | string[] | undefined;
  onAnswer: (value: string | string[]) => void;
  onPhotoSync?: (payload: {
    questionId: string;
    files: File[];
    selectedTagIds: string[];
  }) => Promise<void>;
  photoCommittedMeta?: UploadedPhotoMeta[];
  photoSyncBusy?: boolean;
  photoSyncError?: string | null;
  direction: "forward" | "back";
  animKey: string;
  compact?: boolean;
}

function MatrixInput({ rows, cols, answers, onToggle }: { rows: string[]; cols: string[]; answers: string[]; onToggle: (key: string) => void }) {
  const [expandedCol, setExpandedCol] = React.useState<string | null>(null);
  const colTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleColExpand = (col: string) => {
    if (colTimerRef.current) clearTimeout(colTimerRef.current);
    setExpandedCol(col);
    colTimerRef.current = setTimeout(() => setExpandedCol(null), 3000);
  };

  return (
    <div style={{ margin: "0 -16px", overflowX: "auto" }}>
      <div style={{ minWidth: `${Math.max(300, cols.length * 52 + 120)}px`, padding: "0 16px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px 3px", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 110, padding: "4px 6px", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", textAlign: "left" }} />
              {cols.map((col) => (
                <ColHeader key={col} label={col} expanded={expandedCol === col} onExpand={() => handleColExpand(col)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td style={{ padding: "5px 6px", fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{row}</td>
                {cols.map((col) => {
                  const cellKey = `${row}: ${col}`;
                  const selected = answers.includes(cellKey);
                  return (
                    <td key={col} style={{ textAlign: "center", padding: "2px 3px" }}>
                      <button
                        onClick={() => onToggle(cellKey)}
                        style={{
                          width: "100%", padding: "7px 0",
                          borderRadius: 7, border: "none", cursor: "pointer",
                          fontSize: 9.5, fontWeight: 600,
                          transition: "all 0.14s ease",
                          background: selected ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.03)",
                          color: selected ? "#DC2626" : "rgba(0,0,0,0.35)",
                          boxShadow: selected ? "inset 0 0 0 1px rgba(220,38,38,0.3)" : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                        }}
                      >
                        {selected ? "✓" : "○"}
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

function ColHeader({ label, expanded, onExpand }: { label: string; expanded: boolean; onExpand: () => void }) {
  return (
    <th
      onClick={onExpand}
      style={{
        padding: "4px 3px", fontSize: 10, fontWeight: 600,
        color: "rgba(0,0,0,0.5)", textAlign: "center",
        cursor: "pointer", userSelect: "none",
        maxWidth: 48,
        overflow: expanded ? "visible" : "hidden",
        position: "relative",
      }}
    >
      <span style={{
        display: "block",
        overflow: expanded ? "visible" : "hidden",
        whiteSpace: "nowrap",
        textOverflow: expanded ? "clip" : "ellipsis",
        position: expanded ? "absolute" : "static",
        top: expanded ? 4 : "auto",
        left: expanded ? "50%" : "auto",
        transform: expanded ? "translateX(-50%)" : "none",
        background: expanded ? "#fff" : "transparent",
        borderRadius: expanded ? 5 : 0,
        padding: expanded ? "3px 7px" : 0,
        boxShadow: expanded ? "0 2px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)" : "none",
        zIndex: expanded ? 20 : "auto",
        fontSize: expanded ? 10 : 10,
        fontWeight: 600,
        color: "rgba(0,0,0,0.7)",
        whiteSpaceCollapse: "preserve",
      }}>
        {label}
      </span>
      {/* placeholder to keep column width stable */}
      {expanded && (
        <span style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", opacity: 0 }}>
          {label}
        </span>
      )}
    </th>
  );
}

function DatePickerMatrix({
  rows, cols, answers, onAnswer, accentColor = "#7C3AED",
}: {
  rows: string[]; cols: string[];
  answers: Record<string, string>;
  onAnswer: (dates: Record<string, string>) => void;
  accentColor?: string;
}) {
  const [openCell, setOpenCell] = React.useState<string | null>(null);
  const [calPos, setCalPos] = React.useState({ x: 0, y: 0 });
  const [calStep, setCalStep] = React.useState<"year" | "month" | "day">("year");
  const [calSel, setCalSel] = React.useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const TODAY = new Date();
  const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => TODAY.getFullYear() - 3 + i);
  const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  const DAY_NAMES = ["Mo","Di","Mi","Do","Fr","Sa","So"];

  const handleCellClick = (cellKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openCell === cellKey) { setOpenCell(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const CAL_H = 220;
    const above = rect.bottom + 8 + CAL_H > window.innerHeight;
    let x = rect.left;
    if (x + 220 > window.innerWidth) x = Math.max(8, window.innerWidth - 228);
    setCalPos({ x, y: above ? rect.top - CAL_H - 6 : rect.bottom + 6 });
    if (answers[cellKey]) {
      const iso = displayDateToIso(answers[cellKey]);
      if (iso) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (match) setCalSel({ year: Number(match[1]), month: Number(match[2]) - 1 });
      }
    } else {
      setCalSel({ year: TODAY.getFullYear(), month: TODAY.getMonth() });
    }
    setCalStep("year");
    setOpenCell(cellKey);
  };

  const selectDate = (date: Date) => {
    if (!openCell) return;
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    onAnswer({ ...answers, [openCell]: `${yyyy}-${mm}-${dd}` });
    setOpenCell(null);
  };

  React.useEffect(() => {
    if (!openCell) return;
    const handler = () => setOpenCell(null);
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [openCell]);

  const buildDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  };

  const days = buildDays(calSel.year, calSel.month);
  const openDateStr = openCell ? answers[openCell] : null;
  const openDate = openDateStr ? (() => {
    const iso = displayDateToIso(openDateStr);
    if (!iso) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  })() : null;

  const btnBase = { border: "none", cursor: "pointer", borderRadius: 8, transition: "all 0.12s ease", display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties;

  const calendarPortal = mounted && openCell && typeof document !== "undefined" ? createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", left: calPos.x, top: calPos.y, zIndex: 9999, width: 224, background: "white", borderRadius: 16, padding: "14px 12px 13px", boxShadow: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)", animation: "questionIn 0.15s ease both" }}
    >
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 1, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={(e) => { e.stopPropagation(); setCalStep("year"); }}
          style={{ ...btnBase, fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", color: calStep === "year" ? accentColor : "rgba(0,0,0,0.35)", background: "none", padding: "2px 5px", textDecoration: calStep === "year" ? "none" : "none", opacity: calStep === "year" ? 1 : 0.7 }}
        >{calSel.year}</button>
        {calStep !== "year" && <>
          <span style={{ fontSize: 8, color: "rgba(0,0,0,0.18)", fontWeight: 600, padding: "0 1px", lineHeight: 1 }}>›</span>
          <button onClick={(e) => { e.stopPropagation(); setCalStep("month"); }}
            style={{ ...btnBase, fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", color: calStep === "month" ? accentColor : "rgba(0,0,0,0.35)", background: "none", padding: "2px 5px", opacity: calStep === "month" ? 1 : 0.7 }}
          >{MONTH_NAMES[calSel.month]}</button>
        </>}
        {calStep === "day" && <>
          <span style={{ fontSize: 8, color: "rgba(0,0,0,0.18)", fontWeight: 600, padding: "0 1px", lineHeight: 1 }}>›</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: accentColor, padding: "2px 5px", letterSpacing: "-0.01em" }}>Tag</span>
        </>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          {(["year","month","day"] as const).map((s, i) => {
            const reached = calStep === "year" ? i === 0 : calStep === "month" ? i <= 1 : true;
            return <div key={s} style={{ width: calStep === s ? 12 : 5, height: 4, borderRadius: 99, background: calStep === s ? accentColor : reached ? `${accentColor}40` : "rgba(0,0,0,0.1)", transition: "all 0.2s ease" }} />;
          })}
        </div>
      </div>

      {/* STEP 1 — Year */}
      {calStep === "year" && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 5 }}>
          {YEAR_RANGE.map((y) => {
            const isCur = y === TODAY.getFullYear();
            const isSel = y === calSel.year;
            return (
              <button key={y} onClick={(e) => { e.stopPropagation(); setCalSel((p) => ({ ...p, year: y })); setCalStep("month"); }}
                style={{ ...btnBase, width: 50, height: 34, fontSize: 11, fontWeight: isSel ? 700 : isCur ? 600 : 400, flexDirection: "column", gap: 2, background: isSel ? accentColor : "transparent", color: isSel ? "white" : isCur ? accentColor : "rgba(0,0,0,0.6)", boxShadow: isSel ? `0 2px 8px ${accentColor}40` : "none" }}
                onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; } }}
                onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = "transparent"; } }}
              >
                {y}
                {isCur && !isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* STEP 2 — Month */}
      {calStep === "month" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {MONTH_NAMES.map((m, i) => {
            const isCur = i === TODAY.getMonth() && calSel.year === TODAY.getFullYear();
            const isSel = i === calSel.month;
            return (
              <button key={m} onClick={(e) => { e.stopPropagation(); setCalSel((p) => ({ ...p, month: i })); setCalStep("day"); }}
                style={{ ...btnBase, height: 34, flexDirection: "column", gap: 2, fontSize: 10, fontWeight: isSel ? 700 : isCur ? 600 : 400, background: isSel ? accentColor : "transparent", color: isSel ? "white" : isCur ? accentColor : "rgba(0,0,0,0.6)", boxShadow: isSel ? `0 2px 8px ${accentColor}40` : "none" }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                {m}
                {isCur && !isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* STEP 3 — Day */}
      {calStep === "day" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 5 }}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 8, fontWeight: 700, color: "rgba(0,0,0,0.22)", padding: "2px 0", letterSpacing: "0.02em" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {days.map((date, i) => {
              if (!date) return <div key={i} />;
              const isToday = date.toDateString() === TODAY.toDateString();
              const isSel = openDate && date.toDateString() === openDate.toDateString();
              return (
                <button key={i} onClick={(e) => { e.stopPropagation(); selectDate(date); }}
                  style={{ ...btnBase, aspectRatio: "1", flexDirection: "column", gap: 1, fontSize: 10, fontWeight: isSel ? 700 : 400, background: isSel ? accentColor : "transparent", color: isSel ? "white" : isToday ? accentColor : "rgba(0,0,0,0.65)", boxShadow: isSel ? `0 2px 6px ${accentColor}40` : "none" }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {date.getDate()}
                  {isToday && !isSel && <div style={{ width: 3, height: 3, borderRadius: "50%", background: accentColor }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ margin: "0 -16px", overflowX: "auto" }}>
      <div style={{ minWidth: `${Math.max(300, cols.length * 52 + 120)}px`, padding: "0 16px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px 3px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 110 }} />
            {cols.map((_, i) => <col key={i} style={{ width: 52 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: "4px 6px" }} />
              {cols.map((col) => (
                <th key={col} style={{ padding: "4px 3px", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.5)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 52 }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td style={{ padding: "5px 6px", fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{row}</td>
                {cols.map((col) => {
                  const cellKey = `${row}: ${col}`;
                  const dateStr = answers[cellKey];
                  const isOpen = openCell === cellKey;
                  return (
                    <td key={col} style={{ textAlign: "center", padding: "2px 3px" }}>
                      <button
                        onClick={(e) => handleCellClick(cellKey, e)}
                        style={{ width: "100%", padding: "7px 2px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "all 0.14s ease", background: isOpen ? `${accentColor}14` : dateStr ? `${accentColor}0a` : "rgba(0,0,0,0.03)", color: isOpen ? accentColor : dateStr ? accentColor : "rgba(0,0,0,0.35)", boxShadow: isOpen ? `inset 0 0 0 1px ${accentColor}70` : dateStr ? `inset 0 0 0 1px ${accentColor}35` : "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
                      >
                        {dateStr ? isoToDisplayDate(dateStr) : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {calendarPortal}
    </div>
  );
}

function FreeInputMatrix({
  rows, cols, answers, onAnswer,
}: {
  rows: string[]; cols: string[];
  answers: Record<string, string>;
  onAnswer: (vals: Record<string, string>) => void;
}) {
  return (
    <div style={{ margin: "0 -16px", overflowX: "auto" }}>
      <div style={{ minWidth: `${Math.max(300, cols.length * 72 + 120)}px`, padding: "0 16px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px 3px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 110 }} />
            {cols.map((_, i) => <col key={i} style={{ width: 72 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: "4px 6px" }} />
              {cols.map((col) => (
                <th key={col} style={{ padding: "4px 3px", fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.5)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 72 }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td style={{ padding: "5px 6px", fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{row}</td>
                {cols.map((col) => {
                  const cellKey = `${row}: ${col}`;
                  const val = answers[cellKey] ?? "";
                  return (
                    <td key={col} style={{ padding: "2px 3px" }}>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => onAnswer({ ...answers, [cellKey]: e.target.value })}
                        placeholder="—"
                        style={{ width: "100%", boxSizing: "border-box", padding: "6px 6px", borderRadius: 7, border: "none", outline: "none", fontSize: 10, fontWeight: 500, color: val ? "#1a1a1a" : "rgba(0,0,0,0.3)", background: val ? "rgba(220,38,38,0.04)" : "rgba(0,0,0,0.03)", boxShadow: val ? "inset 0 0 0 1px rgba(220,38,38,0.2)" : "inset 0 0 0 1px rgba(0,0,0,0.07)", transition: "all 0.14s ease" }}
                        onFocus={(e) => { e.currentTarget.style.boxShadow = "inset 0 0 0 1.5px rgba(220,38,38,0.4)"; e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
                        onBlur={(e) => { e.currentTarget.style.boxShadow = val ? "inset 0 0 0 1px rgba(220,38,38,0.2)" : "inset 0 0 0 1px rgba(0,0,0,0.07)"; e.currentTarget.style.background = val ? "rgba(220,38,38,0.04)" : "rgba(0,0,0,0.03)"; }}
                      />
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

function PhotoLightbox({ photos }: { photos: string[] }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const count = photos.length;

  React.useEffect(() => { setMounted(true); }, []);

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setOpen((i) => (i !== null ? (i - 1 + count) % count : 0)); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setOpen((i) => (i !== null ? (i + 1) % count : 0)); };

  const overlay = open !== null && mounted ? createPortal(
    <div
      onClick={() => setOpen(null)}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* image */}
      <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <img
          src={photos[open]}
          style={{
            maxWidth: "88vw", maxHeight: "78vh",
            borderRadius: 14, objectFit: "contain",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            display: "block",
          }}
        />
        {/* X on top-right of the image */}
        <button
          onClick={() => setOpen(null)}
          style={{
            position: "absolute", top: -14, right: -14,
            width: 30, height: 30, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* nav arrows + counter */}
      {count > 1 && (
        <div style={{
          position: "absolute", bottom: 28,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <button onClick={prev} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 }}>‹</button>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600 }}>{open + 1} / {count}</span>
          <button onClick={next} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 }}>›</button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
        {photos.map((src, i) => (
          <img
            key={i}
            src={src}
            onClick={() => setOpen(i)}
            style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 7, cursor: "pointer" }}
          />
        ))}
      </div>
      {overlay}
    </>
  );
}

function QuestionImage({ url, compact }: { url: string; compact?: boolean }) {
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  const scale = compact ? 0.7 : 1;
  const MAX_W = 320 * scale;
  const MAX_H = 220 * scale;

  let displayW = MAX_W;
  let displayH = MAX_H;

  if (dims) {
    const ratio = dims.w / dims.h;
    if (ratio >= 1) {
      displayW = MAX_W;
      displayH = Math.round(MAX_W / ratio);
      if (displayH > MAX_H) { displayH = MAX_H; displayW = Math.round(MAX_H * ratio); }
    } else {
      displayH = MAX_H;
      displayW = Math.round(MAX_H * ratio);
      if (displayW > MAX_W) { displayW = MAX_W; displayH = Math.round(MAX_W / ratio); }
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
      <div
        style={{
          width: dims ? displayW : MAX_W,
          height: dims ? displayH : MAX_H * 0.73,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          border: "1px solid rgba(255,255,255,0.7)",
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), height 0.3s cubic-bezier(0.4,0,0.2,1)",
          backgroundColor: "rgba(0,0,0,0.04)",
          flexShrink: 0,
        }}
      >
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    </div>
  );
}

function RotatingQuestionImage({
  urls,
  fallbackUrl,
  compact,
  resetKey,
}: {
  urls?: string[];
  fallbackUrl?: string;
  compact?: boolean;
  resetKey: string;
}) {
  const normalized = React.useMemo(() => {
    const list = (urls ?? [])
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (list.length > 0) return list;
    if (fallbackUrl && fallbackUrl.trim().length > 0) return [fallbackUrl.trim()];
    return [];
  }, [urls, fallbackUrl]);
  const signature = normalized.join("||");
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
  }, [resetKey, signature]);

  React.useEffect(() => {
    if (normalized.length <= 1) return;
    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % normalized.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [normalized.length, signature]);

  if (normalized.length === 0) return null;

  return <QuestionImage url={normalized[index] ?? normalized[0]} compact={compact} />;
}

function QuestionCard({
  question,
  answer,
  onAnswer,
  onPhotoSync,
  photoCommittedMeta = [],
  photoSyncBusy = false,
  photoSyncError = null,
  direction,
  animKey,
  compact,
}: QuestionCardProps) {
  const fromX = direction === "forward" ? 24 : -24;
  const cfg = question.config ?? {};
  const yesNoOptions = (
    Array.isArray(question.options) && question.options.length > 0
      ? question.options
      : Array.isArray((cfg as Record<string, unknown>).options)
        ? ((cfg as Record<string, unknown>).options as unknown[])
            .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : ["Ja", "Nein"]
  );

  // helpers
  const multiAnswers: string[] = Array.isArray(answer) ? answer : [];
  const toggleMulti = (opt: string) => {
    const next = multiAnswers.includes(opt)
      ? multiAnswers.filter((x) => x !== opt)
      : [...multiAnswers, opt];
    onAnswer(next);
  };

  // yesnomulti state is self-contained inside the IIFE renderer below

  // numeric local state handled via string representation in answer
  const [sliderVal, setSliderVal] = React.useState<number>(() => {
    const v = Number(answer);
    return isNaN(v) ? (cfg.min ?? 0) : v;
  });
  const [numInput, setNumInput] = React.useState<string>(() =>
    answer !== undefined && answer !== "" ? String(answer) : ""
  );
  const [textVal, setTextVal] = React.useState<string>(() =>
    typeof answer === "string" ? answer : ""
  );
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const [photoSourcePickerOpen, setPhotoSourcePickerOpen] = React.useState(false);

  React.useEffect(() => {
    const nextSlider = Number(answer);
    setSliderVal(isNaN(nextSlider) ? Number(cfg.min ?? 0) : nextSlider);
  }, [answer, cfg.min, question.id]);

  React.useEffect(() => {
    setNumInput(answer !== undefined && answer !== "" ? String(answer) : "");
  }, [answer, question.id]);

  React.useEffect(() => {
    setTextVal(typeof answer === "string" ? answer : "");
  }, [answer, question.id]);

  React.useEffect(() => {
    setPhotoSourcePickerOpen(false);
  }, [question.id]);

  return (
    <div
      key={animKey}
      style={{ animation: `questionIn 0.2s cubic-bezier(0.4,0,0.2,1) both` }}
    >
      <style>{`
        @keyframes questionIn {
          from { opacity: 0; transform: translateX(${fromX}px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <p style={{
        fontSize: 13, fontWeight: 600, color: "#1a1a1a",
        lineHeight: 1.5, letterSpacing: "-0.01em",
        margin: "0 0 16px",
      }}>
        {question.text}
        {question.required && (
          <span style={{ color: "#DC2626", marginLeft: 3, fontSize: 11 }}>*</span>
        )}
      </p>

      <RotatingQuestionImage
        urls={question.imageUrls}
        fallbackUrl={question.imageUrl}
        compact={compact}
        resetKey={question.id}
      />

      {/* ── YA / NEIN ── */}
      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 7 }}>
          {yesNoOptions.map((opt) => {
            const selected = answer === opt;
            return (
              <button
                key={opt}
                onClick={() => onAnswer(opt)}
                style={{
                  flex: 1, padding: "9px 0",
                  borderRadius: 9, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
                  transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                  background: selected
                    ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                    : "rgba(0,0,0,0.04)",
                  color: selected ? "#fff" : "rgba(0,0,0,0.45)",
                  boxShadow: selected
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 2px 8px rgba(180,20,20,0.18)"
                    : "none",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* ── SINGLE CHOICE ── */}
      {question.type === "single" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {question.options.map((opt) => {
            const selected = answer === opt;
            return (
              <button
                key={opt}
                onClick={() => onAnswer(opt)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 500, textAlign: "left",
                  transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                  display: "flex", alignItems: "center", gap: 10,
                  background: selected ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.03)",
                  color: selected ? "#DC2626" : "rgba(0,0,0,0.6)",
                  boxShadow: selected ? "inset 0 0 0 1px rgba(220,38,38,0.25)" : "none",
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: selected ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: selected ? "#DC2626" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.16s ease",
                }}>
                  {selected && <Check size={8} strokeWidth={3} color="#fff" />}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* ── MULTIPLE CHOICE ── */}
      {question.type === "multiple" && question.options && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {question.options.map((opt) => {
            const selected = multiAnswers.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggleMulti(opt)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 500, textAlign: "left",
                  transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                  display: "flex", alignItems: "center", gap: 10,
                  background: selected ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.03)",
                  color: selected ? "#DC2626" : "rgba(0,0,0,0.6)",
                  boxShadow: selected ? "inset 0 0 0 1px rgba(220,38,38,0.25)" : "none",
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: selected ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                  background: selected ? "#DC2626" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.16s ease",
                }}>
                  {selected && <Check size={8} strokeWidth={3} color="#fff" />}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* ── JA/NEIN MULTI ── */}
      {question.type === "yesnomulti" && (() => {
        // answer encoded as JSON: { sel: string | null, subs: string[] }
        let ynmState: { sel: string | null; subs: string[] } = { sel: null, subs: [] };
        try {
          if (typeof answer === "string" && answer.startsWith("{")) {
            ynmState = JSON.parse(answer);
          }
        } catch { /* ignore */ }

        const ynmSel = ynmState.sel;
        const ynmSubs = ynmState.subs;
        const ynmAnswers2 = cfg.answers ?? ["Ja", "Nein"];
        const activeBranch = (cfg.branches ?? []).find((b) => b.answer === ynmSel);

        const selectTop = (ans: string) => {
          // radio: selecting same again deselects, selecting new clears subs
          const newSel = ynmSel === ans ? null : ans;
          onAnswer(JSON.stringify({ sel: newSel, subs: [] }));
        };
        const toggleSub = (sub: string) => {
          const next = ynmSubs.includes(sub)
            ? ynmSubs.filter((x) => x !== sub)
            : [...ynmSubs, sub];
          onAnswer(JSON.stringify({ sel: ynmSel, subs: next }));
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Stage 1 – single select */}
            <div style={{ display: "flex", gap: 7 }}>
              {ynmAnswers2.map((ans) => {
                const selected = ynmSel === ans;
                return (
                  <button
                    key={ans}
                    onClick={() => selectTop(ans)}
                    style={{
                      flex: 1, padding: "9px 0",
                      borderRadius: 9, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
                      transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                      background: selected
                        ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                        : "rgba(0,0,0,0.04)",
                      color: selected ? "#fff" : "rgba(0,0,0,0.45)",
                      boxShadow: selected
                        ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 2px 8px rgba(180,20,20,0.18)"
                        : "none",
                    }}
                  >
                    {ans}
                  </button>
                );
              })}
            </div>

            {/* Stage 2 – multi-select sub-options, scrollable tray */}
            {ynmSel && activeBranch && activeBranch.options.length > 0 && (
              <div style={{
                marginTop: 2,
                borderRadius: 10,
                background: "rgba(0,0,0,0.02)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}>
                {/* header showing count */}
                <div style={{
                  padding: "7px 12px 6px",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Optionen für „{ynmSel}"
                  </span>
                  {ynmSubs.length > 0 && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, color: "#DC2626",
                      background: "rgba(220,38,38,0.08)",
                      borderRadius: 20, padding: "2px 7px",
                    }}>
                      {ynmSubs.length} gewählt
                    </span>
                  )}
                </div>
                {/* scrollable list — max ~8 items visible */}
                <div style={{
                  maxHeight: 220, overflowY: "auto",
                  padding: "6px 8px",
                  display: "flex", flexDirection: "column", gap: 3,
                  scrollbarWidth: "none", msOverflowStyle: "none",
                }}>
                  <style>{`.ynm-scroll::-webkit-scrollbar{display:none}`}</style>
                  {activeBranch.options.map((sub) => {
                    const subSel = ynmSubs.includes(sub);
                    return (
                      <button
                        key={sub}
                        onClick={() => toggleSub(sub)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 7, border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: 500, textAlign: "left",
                          display: "flex", alignItems: "center", gap: 9,
                          background: subSel ? "rgba(220,38,38,0.05)" : "rgba(0,0,0,0.025)",
                          color: subSel ? "#DC2626" : "rgba(0,0,0,0.6)",
                          boxShadow: subSel ? "inset 0 0 0 1px rgba(220,38,38,0.2)" : "none",
                          transition: "all 0.14s ease",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                          background: subSel ? "#DC2626" : "transparent",
                          border: subSel ? "none" : "1.5px solid rgba(0,0,0,0.13)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.14s ease",
                        }}>
                          {subSel && <Check size={7} strokeWidth={3} color="#fff" />}
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

      {/* ── LIKERT ── */}
      {question.type === "likert" && cfg.min !== undefined && cfg.max !== undefined && (() => {
        const minVal = cfg.min as number;
        const maxVal = cfg.max as number;
        const count = maxVal - minVal + 1;

        // Interpolate red → yellow → green across the scale
        const getColor = (t: number): [number, number, number] => {
          // red: 220,38,38  yellow: 234,179,8  green: 22,163,74
          let r: number, g: number, b: number;
          if (t < 0.5) {
            const s = t / 0.5;
            r = Math.round(220 + (234 - 220) * s);
            g = Math.round(38  + (179 - 38)  * s);
            b = Math.round(38  + (8   - 38)  * s);
          } else {
            const s = (t - 0.5) / 0.5;
            r = Math.round(234 + (22  - 234) * s);
            g = Math.round(179 + (163 - 179) * s);
            b = Math.round(8   + (74  - 8)   * s);
          }
          return [r, g, b];
        };
        const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;
        const darken = ([r, g, b]: [number, number, number], amt: number): [number, number, number] =>
          [Math.min(255, Math.round(r * (1 - amt))), Math.min(255, Math.round(g * (1 - amt))), Math.min(255, Math.round(b * (1 - amt)))];

        return (
          <div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Array.from({ length: count }, (_, i) => {
                const val = String(minVal + i);
                const selected = answer === val;
                const t = count <= 1 ? 1 : i / (count - 1);
                const c = getColor(t);
                const cLight = c;                // base color at top (same as Weiter uses #DC2626 at top)
                const cd = darken(c, 0.16);      // ~16% darker for gradient bottom (Weiter: #b91c1c)
                const cRing = darken(c, 0.23);   // ~23% darker for sharp ring (Weiter: #a91b1b)
                const cGlow = darken(c, 0.18);   // for the soft drop glow
                return (
                  <button
                    key={val}
                    onClick={() => onAnswer(val)}
                    style={{
                      flex: 1, minWidth: 36, padding: "9px 4px",
                      borderRadius: 9, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 700,
                      transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)",
                      background: selected
                        ? `linear-gradient(to bottom, ${rgb(cLight)}, ${rgb(cd)})`
                        : "rgba(0,0,0,0.04)",
                      color: selected ? "#fff" : "rgba(0,0,0,0.5)",
                      boxShadow: selected
                        ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${rgb(cRing)}, 0 1px 6px rgba(${cGlow[0]},${cGlow[1]},${cGlow[2]},0.18)`
                        : "none",
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
            {(cfg.minLabel || cfg.maxLabel) && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, padding: "0 2px" }}>
                <span style={{ fontSize: 9.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.minLabel}</span>
                <span style={{ fontSize: 9.5, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{cfg.maxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── OFFENER TEXT ── */}
      {question.type === "text" && (
        <textarea
          value={textVal}
          onChange={(e) => {
            setTextVal(e.target.value);
            onAnswer(e.target.value);
          }}
          placeholder="Antwort eingeben…"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", boxSizing: "border-box",
            borderRadius: 9, border: "1.5px solid rgba(0,0,0,0.09)",
            background: "rgba(0,0,0,0.02)", fontSize: 12,
            color: "#1a1a1a", resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.55,
            transition: "border-color 0.15s",
          }}
        />
      )}

      {/* ── OFFENE ZAHL / NUMERIC ── */}
      {question.type === "numeric" && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <input
            type="text"
            inputMode={cfg.decimals ? "decimal" : "numeric"}
            value={numInput}
            onChange={(e) => {
              const v = sanitizeNumericDraftInput(e.target.value, Boolean(cfg.decimals));
              setNumInput(v);
              onAnswer(v);
            }}
            placeholder="0"
            style={{
              flex: 1, padding: "10px 12px",
              borderRadius: 9, border: "1.5px solid rgba(0,0,0,0.09)",
              background: "rgba(0,0,0,0.02)", fontSize: 13, fontWeight: 600,
              color: "#1a1a1a", outline: "none", fontFamily: "inherit",
              textAlign: "center",
              WebkitAppearance: "none", MozAppearance: "textfield",
            }}
          />
        </div>
      )}

      {/* ── SLIDER ── */}
      {question.type === "slider" && cfg.min !== undefined && cfg.max !== undefined && (() => {
        const minV = cfg.min as number;
        const maxV = cfg.max as number;
        const pct = ((sliderVal - minV) / (maxV - minV)) * 100;
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{minV}{cfg.unit}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#DC2626", letterSpacing: "-0.02em" }}>
                {sliderVal}{cfg.unit}
              </span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{maxV}{cfg.unit}</span>
            </div>
            <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
              {/* track background */}
              <div style={{
                position: "absolute", left: 0, right: 0, height: 3,
                borderRadius: 99, background: "rgba(0,0,0,0.07)",
              }} />
              {/* filled portion */}
              <div style={{
                position: "absolute", left: 0, width: `${pct}%`, height: 3,
                borderRadius: 99,
                background: "linear-gradient(to right, #DC2626, #b91c1c)",
              }} />
              {/* native input overlaid invisibly for interaction */}
              <input
                type="range"
                min={minV}
                max={maxV}
                step={(cfg.step as number) || 1}
                value={sliderVal}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSliderVal(v);
                  onAnswer(String(v));
                }}
                style={{
                  position: "absolute", left: 0, right: 0, width: "100%",
                  opacity: 0, cursor: "pointer", height: 20, margin: 0,
                  WebkitAppearance: "none",
                }}
              />
              {/* custom thumb */}
              <div style={{
                position: "absolute",
                left: `calc(${pct}% - 6px)`,
                width: 12, height: 12,
                borderRadius: "50%",
                background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                boxShadow: "0 0 0 1px #a91b1b, 0 1px 4px rgba(180,20,20,0.35)",
                pointerEvents: "none",
              }} />
            </div>
          </div>
        );
      })()}

      {/* ── FOTO UPLOAD ── */}
      {question.type === "photo" && (() => {
        const photoState = decodePhotoAnswer(answer);
        const photos = photoState.photos;
        const previewPhotos = photos.filter(isPreviewablePhotoSrc);
        const fallbackArtifacts = (photoCommittedMeta.length > 0
          ? photoCommittedMeta.map((meta) => meta.storagePath)
          : photos
        ).filter((value) => !isPreviewablePhotoSrc(value));
        const fallbackLabels = Array.from(new Set(fallbackArtifacts.map(photoArtifactLabel)));
        const tagsEnabled = Boolean(cfg?.tagsEnabled) && Array.isArray(cfg?.tagIds) && (cfg.tagIds as string[]).length > 0;
        const configuredTagIds: string[] = tagsEnabled ? (cfg.tagIds as string[]) : [];

        // Resolve tag labels from backend-provided config metadata
        const resolvedTags = configuredTagIds.map((id) => {
          const configTagMeta = Array.isArray(cfg?.tagMeta)
            ? (cfg.tagMeta as Array<{ id: string; label: string; deletedAt: string | null }>).find((entry) => entry.id === id)
            : null;
          return configTagMeta ?? { id, label: id, deletedAt: null };
        });

        const selectedTagIds = photoState.selectedTagIds;

        const handleSelectedPhotoFiles = (files: File[]) => {
          if (files.length === 0) return;
          const objectUrls = files.map((file) => URL.createObjectURL(file));
          handlePhotos([...photos, ...objectUrls]);
          if (onPhotoSync) {
            void onPhotoSync({
              questionId: question.id,
              files,
              selectedTagIds,
            });
          }
        };

        const handlePhotos = (urls: string[]) => {
          const next: PhotoAnswerState = { ...photoState, photos: urls };
          onAnswer(encodePhotoAnswer(next));
        };
        const toggleTag = async (id: string) => {
          const next = selectedTagIds.includes(id)
            ? selectedTagIds.filter((t) => t !== id)
            : [...selectedTagIds, id];
          onAnswer(encodePhotoAnswer({ ...photoState, selectedTagIds: next }));
          if (onPhotoSync && photoState.photos.length > 0) {
            await onPhotoSync({
              questionId: question.id,
              files: [],
              selectedTagIds: next,
            });
          }
        };

        return (
          <div>
            {cfg?.instruction && (
              <p style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontStyle: "italic", margin: "0 0 10px" }}>
                {cfg.instruction}
              </p>
            )}
            {/* Upload area */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setPhotoSourcePickerOpen((prev) => !prev)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "16px 12px",
                  borderRadius: 10,
                  border: "1.5px dashed rgba(0,0,0,0.13)",
                  background: "rgba(0,0,0,0.02)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.4)",
                  fontFamily: "inherit",
                }}
              >
                <Camera size={16} strokeWidth={1.8} />
                {photos.length > 0 ? `${photos.length} Foto(s) ausgewählt` : "Foto auswählen"}
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  handleSelectedPhotoFiles(files);
                }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  handleSelectedPhotoFiles(files);
                }}
              />
              {photoSourcePickerOpen && (
                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 7,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoSourcePickerOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      color: "#1a1a1a",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoSourcePickerOpen(false);
                      galleryInputRef.current?.click();
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      color: "#1a1a1a",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Galerie
                  </button>
                </div>
              )}
            </div>
            {previewPhotos.length > 0 && (
              <PhotoLightbox photos={previewPhotos} />
            )}
            {fallbackLabels.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)", marginBottom: 6 }}>
                  Gespeicherte Fotos
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {fallbackLabels.map((label) => (
                    <span
                      key={label}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "rgba(0,0,0,0.55)",
                        background: "rgba(0,0,0,0.05)",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {photoSyncBusy && (
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Fotos werden gespeichert...</div>
            )}
            {photoSyncError && (
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(220,38,38,0.85)", fontWeight: 600 }}>{photoSyncError}</div>
            )}
            {/* Tag selection — only shown when admin configured tags for this question */}
            {tagsEnabled && resolvedTags.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Tag size={10} strokeWidth={2} color="rgba(0,0,0,0.35)" />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "rgba(0,0,0,0.35)" }}>
                    Tags
                  </span>
                  {question.required && selectedTagIds.length === 0 && (
                    <span style={{ fontSize: 9, color: "rgba(220,38,38,0.7)", fontWeight: 600, marginLeft: 2 }}>— mind. 1 auswählen</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {resolvedTags.map((tag) => {
                    const isDeleted = !!tag.deletedAt;
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          void toggleTag(tag.id);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 14px",
                          borderRadius: 99,
                          border: isSelected
                            ? "1.5px solid rgba(220,38,38,0.5)"
                            : isDeleted
                              ? "1.5px solid rgba(0,0,0,0.08)"
                              : "1.5px solid rgba(0,0,0,0.12)",
                          background: isSelected
                            ? "linear-gradient(to bottom, #DC2626, #b91c1c)"
                            : "rgba(255,255,255,0.7)",
                          color: isSelected ? "#fff" : isDeleted ? "rgba(0,0,0,0.28)" : "#1a1a1a",
                          fontSize: 12, fontWeight: isSelected ? 700 : 500,
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "inset 0 1px 0.6px rgba(255,255,255,0.2), 0 0 0 1px #a91b1b, 0 1px 4px rgba(180,20,20,0.2)"
                            : "0 1px 3px rgba(0,0,0,0.06)",
                          transition: "all 0.15s ease",
                          backdropFilter: "blur(4px)",
                          WebkitBackdropFilter: "blur(4px)",
                          fontFamily: "inherit",
                          opacity: isDeleted && !isSelected ? 0.55 : 1,
                          textDecoration: isDeleted ? "line-through" : "none",
                          minHeight: 38, // comfortable tap target
                        }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── MATRIX ── */}
      {question.type === "matrix" && cfg.rows && cfg.columns && (() => {
        if (cfg.matrixSubtype === "datum") {
          let dateVals: Record<string, string> = {};
          if (typeof answer === "string" && answer.startsWith("{")) {
            try {
              const parsed = JSON.parse(answer) as Record<string, unknown>;
              dateVals = Object.fromEntries(
                Object.entries(parsed)
                  .filter(
                    (entry): entry is [string, string] =>
                      typeof entry[0] === "string" &&
                      typeof entry[1] === "string",
                  ),
              );
            } catch {
              dateVals = {};
            }
          }
          return (
            <DatePickerMatrix
              rows={cfg.rows!}
              cols={cfg.columns!}
              answers={dateVals}
              onAnswer={(vals) => onAnswer(JSON.stringify(vals))}
            />
          );
        }
        if (cfg.matrixSubtype === "freitext") {
          let freeVals: Record<string, string> = {};
          if (typeof answer === "string" && answer.startsWith("{")) {
            try {
              freeVals = JSON.parse(answer) as Record<string, string>;
            } catch {
              freeVals = {};
            }
          }
          return (
            <FreeInputMatrix
              rows={cfg.rows!}
              cols={cfg.columns!}
              answers={freeVals}
              onAnswer={(vals) => onAnswer(JSON.stringify(vals))}
            />
          );
        }
        return <MatrixInput rows={cfg.rows!} cols={cfg.columns!} answers={multiAnswers} onToggle={toggleMulti} />;
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Jump Navigator Panel
// ─────────────────────────────────────────────────────────────────────────────

interface JumpNavigatorProps {
  questions: SampleQuestion[];
  mhdQuestions: SampleQuestion[];
  mhdAnswers: Record<string, string | string[]>;
  kuehlerQuestions: SampleQuestion[];
  kuehlerAnswers: Record<string, string | string[]>;
  answers: Record<string, string | string[]>;
  currentIndex: number;
  currentKuehlerIndex: number;
  currentMhdIndex: number;
  onJump: (index: number) => void;
  onJumpKuehler: (index: number) => void;
  onJumpMhd: (index: number) => void;
  onClose: () => void;
  isOpen: boolean;
  flashSections?: ("fragebogen" | "kuehler" | "mhd")[];
  flashModules?: string[];
}

function JumpNavigator({
  questions, mhdQuestions, mhdAnswers, kuehlerQuestions, kuehlerAnswers, answers, currentIndex,
  currentKuehlerIndex, currentMhdIndex,
  onJump, onJumpKuehler, onJumpMhd, onClose, isOpen,
  flashSections = [], flashModules = [],
}: JumpNavigatorProps) {

  // Build module groups helper
  function buildGroups(qs: SampleQuestion[], answerMap: Record<string, string | string[]>) {
    const groups: { moduleId: string; moduleName: string; questions: { q: SampleQuestion; idx: number }[] }[] = [];
    qs.forEach((q, i) => {
      const existing = groups.find((g) => g.moduleId === q.moduleId);
      if (existing) existing.questions.push({ q, idx: i });
      else groups.push({ moduleId: q.moduleId, moduleName: q.moduleName, questions: [{ q, idx: i }] });
    });
    return groups;
  }

  const fragebogenGroups = buildGroups(questions, answers);
  const kuehlerGroups = buildGroups(kuehlerQuestions, kuehlerAnswers);
  const mhdGroups = buildGroups(mhdQuestions, mhdAnswers);
  const moduleIdsSignature = Array.from(
    new Set([...fragebogenGroups, ...kuehlerGroups, ...mhdGroups].map((group) => group.moduleId)),
  ).join("|");

  // Active section tab inside the navigator
  type NavSection = "fragebogen" | "kuehler" | "mhd";
  const [activeNavSection, setActiveNavSection] = useState<NavSection>("fragebogen");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!moduleIdsSignature) return;
    const moduleIds = moduleIdsSignature.split("|");
    setExpandedModules((prev) => {
      let changed = false;
      const next = { ...prev };
      moduleIds.forEach((moduleId) => {
        if (moduleId in next) return;
        next[moduleId] = true;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [moduleIdsSignature]);

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: prev[moduleId] === false }));
  }

  function handlePillTap(i: number) { onJump(i); onClose(); }

  const fragebogenAnswered = questions.filter((q) => answers[q.id] !== undefined).length;
  const kuehlerAnsweredCount = kuehlerQuestions.filter((q) => kuehlerAnswers[q.id] !== undefined).length;
  const mhdAnsweredCount = mhdQuestions.filter((q) => mhdAnswers[q.id] !== undefined).length;

  const sectionTabs: { key: NavSection; label: string; color: string; answered: number; total: number }[] = [
    { key: "fragebogen", label: "Fragebogen", color: "#DC2626", answered: fragebogenAnswered, total: questions.length },
    { key: "kuehler",    label: "Kühler",     color: "#d97706", answered: kuehlerAnsweredCount, total: kuehlerQuestions.length },
    { key: "mhd",        label: "MHD",        color: "#7C3AED", answered: mhdAnsweredCount, total: mhdQuestions.length },
  ];
  const visibleSectionTabs = sectionTabs.filter((tab) => tab.total > 0);
  const effectiveActiveNavSection = visibleSectionTabs.some((tab) => tab.key === activeNavSection)
    ? activeNavSection
    : visibleSectionTabs[0]?.key ?? activeNavSection;

  useEffect(() => {
    if (visibleSectionTabs.length === 0) return;
    if (visibleSectionTabs.some((tab) => tab.key === activeNavSection)) return;
    setActiveNavSection(visibleSectionTabs[0].key);
  }, [activeNavSection, visibleSectionTabs]);

  // Reusable module-group renderer
  function renderGroups(
    groups: ReturnType<typeof buildGroups>,
    answerMap: Record<string, string | string[]>,
    color: string,
    onTap: (idx: number) => void,
    highlightCurrentIdx?: number,
  ) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {groups.map((group) => {
          const isExpanded = expandedModules[group.moduleId] !== false;
          const groupAnswered = group.questions.filter(({ q }) => answerMap[q.id] !== undefined).length;
          const groupTotal = group.questions.length;
          const allGroupDone = groupAnswered === groupTotal;
          const hasCurrentQ = highlightCurrentIdx !== undefined && group.questions.some(({ idx }) => idx === highlightCurrentIdx);
          const colorAlpha = (a: number) => color + Math.round(a * 255).toString(16).padStart(2, "0");

          return (
            <div key={group.moduleId}>
              <button
                onClick={() => onTap(group.questions[0].idx)}
                onContextMenu={(e) => { e.preventDefault(); toggleModule(group.moduleId); }}
                className={flashModules.includes(group.moduleId) ? "nav-flash" : ""}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all 0.15s ease", background: flashModules.includes(group.moduleId) ? `${color}14` : hasCurrentQ && !isExpanded ? `${color}0a` : "transparent", boxShadow: flashModules.includes(group.moduleId) ? `inset 0 0 0 1.5px ${color}50` : hasCurrentQ && !isExpanded ? `inset 0 0 0 1px ${color}26` : "none" }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: allGroupDone ? color : hasCurrentQ ? `${color}14` : "rgba(0,0,0,0.05)", transition: "all 0.15s ease" }}>
                  {allGroupDone
                    ? <Check size={9} strokeWidth={3} color="#fff" />
                    : <span style={{ fontSize: 9, fontWeight: 700, color: hasCurrentQ ? color : "rgba(0,0,0,0.35)" }}>{groupAnswered}/{groupTotal}</span>
                  }
                </div>
                <span style={{ fontSize: 11, fontWeight: hasCurrentQ ? 600 : 500, color: hasCurrentQ ? "#1a1a1a" : "rgba(0,0,0,0.55)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {group.moduleName}
                </span>
                <div onClick={(e) => { e.stopPropagation(); toggleModule(group.moduleId); }} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.04)", transition: "transform 0.18s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", cursor: "pointer" }}>
                  <ChevronDown size={10} strokeWidth={2.5} color="rgba(0,0,0,0.3)" />
                </div>
              </button>

              {isExpanded && (
                <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginBottom: 2 }}>
                  {group.questions.map(({ q, idx }) => {
                    const isDone = answerMap[q.id] !== undefined;
                    const isCurrent = highlightCurrentIdx === idx;
                    return (
                      <button key={`${q.id}-${idx}`} onClick={() => onTap(idx)} style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left", transition: "all 0.15s ease", background: isCurrent ? `${color}0a` : "transparent", boxShadow: isCurrent ? `inset 0 0 0 1px ${color}20` : "none" }}>
                        <div style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? color : isCurrent ? `${color}14` : "rgba(0,0,0,0.05)" }}>
                          {isDone ? <Check size={7} strokeWidth={3} color="#fff" /> : <span style={{ fontSize: 8, fontWeight: 700, color: isCurrent ? color : "rgba(0,0,0,0.3)" }}>{idx + 1}</span>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: isCurrent ? 600 : 400, color: isDone ? "rgba(0,0,0,0.3)" : isCurrent ? "#1a1a1a" : "rgba(0,0,0,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDone ? "line-through" : "none" }}>
                          {q.text}
                        </span>
                        {isCurrent && <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: isOpen ? "auto" : "none" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, opacity: isOpen ? 1 : 0, transition: "opacity 0.22s ease" }} />

      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderRadius: "16px 16px 0 0",
          border: "1px solid rgba(255,255,255,0.9)", borderBottom: "none",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.08)",
          maxHeight: "72vh",
          display: "flex", flexDirection: "column",
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: isOpen ? "transform 0.28s cubic-bezier(0.4,0,0.2,1)" : "transform 0.2s ease-in",
        }}
      >
        <style>{`
          @keyframes navFlash {
            0%,100% { opacity: 1; }
            25%,75% { opacity: 0.2; }
            50% { opacity: 1; }
          }
          .nav-flash { animation: navFlash 0.6s ease-in-out 3; }
        `}</style>
        {/* Fixed top: handle + header + tabs */}
        <div style={{ padding: "0 20px", flexShrink: 0 }}>
          {/* Handle */}
          <div onClick={onClose} style={{ display: "flex", justifyContent: "center", padding: "12px 0 14px", cursor: "pointer" }}>
            <div style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.1)" }} />
          </div>

          {/* Header */}
          <div onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, cursor: "pointer" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Übersicht</div>
            <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: 7, border: "none", backgroundColor: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.35)", fontSize: 13, fontWeight: 500 }}>×</button>
          </div>

          {/* Section tabs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)", marginBottom: 8 }}>Sektionen</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {visibleSectionTabs.map(({ key, label, color, answered, total }) => {
                const isActive = effectiveActiveNavSection === key;
                const done = answered === total;
                const isFlashing = flashSections.includes(key);
                return (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); setActiveNavSection(key); }}
                    className={isFlashing ? "nav-flash" : ""}
                    style={{
                      flex: visibleSectionTabs.length >= 3 ? 1 : "0 1 236px",
                      maxWidth: visibleSectionTabs.length === 1 ? 260 : undefined,
                      padding: "7px 4px",
                      borderRadius: 9,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      transition: "all 0.16s ease",
                      background: isFlashing ? `${color}22` : isActive ? `${color}12` : "rgba(0,0,0,0.03)",
                      color: isActive || isFlashing ? color : "rgba(0,0,0,0.45)",
                      boxShadow: isActive ? `inset 0 0 0 1px ${color}30` : isFlashing ? `inset 0 0 0 1.5px ${color}60` : "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: done ? color : isActive ? `${color}80` : "rgba(0,0,0,0.12)", transition: "all 0.15s ease" }} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 14 }} />
        </div>

        {/* Scrollable content — max 10 items visible (~40px each = 400px), hidden scrollbar */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "0 20px 32px",
          maxHeight: 400,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          <style>{`.nav-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className="nav-scroll">
            {effectiveActiveNavSection === "fragebogen" && renderGroups(fragebogenGroups, answers, "#DC2626", handlePillTap, currentIndex)}
            {effectiveActiveNavSection === "kuehler"    && renderGroups(kuehlerGroups, kuehlerAnswers, "#d97706", (idx) => { onJumpKuehler(idx); onClose(); }, currentKuehlerIndex)}
            {effectiveActiveNavSection === "mhd"        && renderGroups(mhdGroups, mhdAnswers, "#7C3AED", (idx) => { onJumpMhd(idx); onClose(); }, currentMhdIndex)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment Modal
// ─────────────────────────────────────────────────────────────────────────────

interface CommentModalProps {
  questionId: string;
  existingComment: string;
  accentColor: string;
  onSave: (id: string, text: string) => void;
  onClose: () => void;
}

function CommentModal({ questionId, existingComment, accentColor, onSave, onClose }: CommentModalProps) {
  const [text, setText] = useState(existingComment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 20px",
        backgroundColor: "rgba(0,0,0,0.18)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <style>{`@keyframes cmIn { from { opacity:0; transform:scale(0.95) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360,
          backgroundColor: "rgba(255,255,255,0.98)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
          animation: "cmIn 0.18s cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        {/* Header */}
        <div style={{ padding: "12px 16px 10px", backgroundColor: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)" }}>
            Kommentar
          </div>
        </div>

        {/* Textarea */}
        <div style={{ padding: "12px 16px", backgroundColor: "#fff" }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Notiz zu dieser Frage..."
            style={{
              width: "100%", minHeight: 80,
              fontSize: 12, color: "#1a1a1a",
              background: "#fff", border: "none", outline: "none",
              resize: "none", lineHeight: 1.6,
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "10px", display: "flex", alignItems: "center", gap: 7, backgroundColor: "rgba(0,0,0,0.03)", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.07), inset 0 0 0 1px rgba(0,0,0,0.06)", transition: "opacity 0.15s" }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => { onSave(questionId, text); onClose(); }}
            style={{
              flex: 2, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, color: "#fff",
              background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.28), 0 0 0 1px ${accentColor}80, 0 2px 8px ${accentColor}30`,
              transition: "opacity 0.15s",
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component (inner, uses hooks that need Suspense)
// ─────────────────────────────────────────────────────────────────────────────

function MarktbesuchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const chain = params.get("chain") || "Markt";
  const address = params.get("address") || "";
  const marketId = params.get("marketId") || "";
  const campaignIdsParam = params.get("campaignIds") || "";
  const sessionIdFromParams = params.get("sessionId") || "";
  const paramsString = params.toString();
  const campaignIds = useMemo(
    () =>
      campaignIdsParam
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    [campaignIdsParam],
  );
  const hasVisitStartParams = Boolean(marketId) && campaignIds.length > 0;

  // Phase state
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseVisible, setPhaseVisible] = useState(true);

  // Visit note (idle card)
  const [visitNote, setVisitNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStopped, setTimerStopped] = useState(false);
  const [startTime] = useState(nowHHMM);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fragebogen
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState("0");

  // Kühler
  const [kuehlerAnswers, setKuehlerAnswers] = useState<Record<string, string | string[]>>({});
  const [kuehlerQIndex, setKuehlerQIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<ActiveSection>("fragebogen");
  const [mhdAnswers, setMhdAnswers] = useState<Record<string, string | string[]>>({});
  const [mhdQIndex, setMhdQIndex] = useState(0);

  // Per-question comments (keyed by question id)
  const [questionComments, setQuestionComments] = useState<Record<string, string>>({});
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);

  // Aurora colors
  const [auroraColors, setAuroraColors] = useState<[string, string, string]>(["#F4B4B4", "#DC2626", "#F4B4B4"]);

  // Jump navigator
  const [navOpen, setNavOpen] = useState(false);
  const [flashSections, setFlashSections] = useState<("fragebogen" | "kuehler" | "mhd")[]>([]);
  const [flashModules, setFlashModules] = useState<string[]>([]);

  // Abschluss
  const [vonVal, setVonVal] = useState(startTime);
  const [bisVal, setBisVal] = useState("");
  const [manualTimeEdited, setManualTimeEdited] = useState(false);
  const [comment, setComment] = useState("");
  const [clockTarget, setClockTarget] = useState<"von" | "bis" | null>(null);
  const [visitStartLoading, setVisitStartLoading] = useState(false);
  const [visitStartError, setVisitStartError] = useState<string | null>(null);
  const [visitStartRetryNonce, setVisitStartRetryNonce] = useState(0);
  const [visitSections, setVisitSections] = useState<GmVisitStartSection[]>([]);
  const [visitSessionId, setVisitSessionId] = useState<string | null>(null);
  const [visitSessionStartedAt, setVisitSessionStartedAt] = useState<string | null>(null);
  const [visitBootstrapDone, setVisitBootstrapDone] = useState(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [submitSessionError, setSubmitSessionError] = useState<string | null>(null);
  const [visitExitDialog, setVisitExitDialog] = useState<"choice" | "abort-confirm" | null>(null);
  const [visitExitBusy, setVisitExitBusy] = useState(false);
  const [visitExitError, setVisitExitError] = useState<string | null>(null);
  const [photoSyncBusyByQuestionId, setPhotoSyncBusyByQuestionId] = useState<Record<string, boolean>>({});
  const [photoSyncErrorByQuestionId, setPhotoSyncErrorByQuestionId] = useState<Record<string, string | null>>({});
  const [photoMetaByQuestionId, setPhotoMetaByQuestionId] = useState<Record<string, UploadedPhotoMeta[]>>({});
  const [photoAnswerIdByQuestionId, setPhotoAnswerIdByQuestionId] = useState<Record<string, string>>({});
  const persistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistFlushersRef = useRef<Record<string, () => Promise<void>>>({});
  const persistInFlightRef = useRef<Record<string, Promise<void>>>({});
  const lastPersistSigRef = useRef<Record<string, string>>({});
  const bootstrapRequestSeqRef = useRef(0);
  const bootstrapRunKeyRef = useRef<string | null>(null);

  const setSessionIdInUrl = useCallback((sessionId: string) => {
    const next = new URLSearchParams(paramsString);
    if (next.get("sessionId") === sessionId) return;
    next.set("sessionId", sessionId);
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [paramsString, router]);

  const hydrateFromStartPayload = useCallback((payload: GmVisitStartPayload) => {
    setVisitSections(payload.sections ?? []);
    setVisitSessionId(null);
    setVisitSessionStartedAt(null);
    setAnswers({});
    setKuehlerAnswers({});
    setMhdAnswers({});
    setQuestionComments({});
    setPhotoMetaByQuestionId({});
    setPhotoAnswerIdByQuestionId({});
    setTimerRunning(false);
    setTimerStopped(false);
    setTimerSeconds(0);
  }, []);

  const hydrateFromSessionPayload = useCallback((payload: GmVisitSessionReadPayload) => {
    const nextFragebogenAnswers: Record<string, string | string[]> = {};
    const nextKuehlerAnswers: Record<string, string | string[]> = {};
    const nextMhdAnswers: Record<string, string | string[]> = {};
    const nextComments: Record<string, string> = {};
    const nextPhotoMetaByQuestionId: Record<string, UploadedPhotoMeta[]> = {};
    const nextPhotoAnswerIdByQuestionId: Record<string, string> = {};

    const writeAnswer = (
      section: "standard" | "flex" | "billa" | "kuehler" | "mhd",
      questionId: string,
      value: string | string[] | undefined,
    ) => {
      if (value === undefined) return;
      if (section === "kuehler") {
        nextKuehlerAnswers[questionId] = value;
        return;
      }
      if (section === "mhd") {
        nextMhdAnswers[questionId] = value;
        return;
      }
      nextFragebogenAnswers[questionId] = value;
    };

    for (const section of payload.sections ?? []) {
      for (const question of section.questions ?? []) {
        const answer = question.answer;
        if (!answer) {
          if ((question.comment ?? "").trim().length > 0) {
            nextComments[question.id] = question.comment;
          }
          continue;
        }
        let uiValue: string | string[] | undefined;
        if (question.type === "multiple") {
          uiValue = (answer.options ?? [])
            .filter((opt) => opt.optionRole === "sub")
            .map((opt) => opt.optionValue);
        } else if (question.type === "yesnomulti") {
          const top = (answer.options ?? []).find((opt) => opt.optionRole === "top")?.optionValue ?? "";
          const subs = (answer.options ?? [])
            .filter((opt) => opt.optionRole === "sub")
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((opt) => opt.optionValue);
          uiValue = top ? JSON.stringify({ sel: top, subs }) : undefined;
        } else if (question.type === "matrix") {
          const subtype = String((question.config ?? {}).matrixSubtype ?? "toggle");
          if (subtype === "toggle") {
            uiValue = (answer.matrixCells ?? [])
              .filter((cell) => cell.cellSelected)
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((cell) => `${cell.rowKey}: ${cell.columnKey}`);
          } else if (subtype === "datum") {
            const mapped = Object.fromEntries(
              (answer.matrixCells ?? [])
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((cell) => [`${cell.rowKey}: ${cell.columnKey}`, cell.cellValueDate ?? ""]),
            );
            uiValue = JSON.stringify(mapped);
          } else {
            const mapped = Object.fromEntries(
              (answer.matrixCells ?? [])
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((cell) => [`${cell.rowKey}: ${cell.columnKey}`, cell.cellValueText ?? ""]),
            );
            uiValue = JSON.stringify(mapped);
          }
        } else if (question.type === "photo") {
          const selectedTagIds = Array.from(
            new Set(
              (answer.photos ?? []).flatMap((photo) =>
                (photo.tags ?? [])
                  .map((tag) => tag.photoTagId)
                  .filter((tagId): tagId is string => typeof tagId === "string" && tagId.length > 0),
              ),
            ),
          );
          const photos = (answer.photos ?? []).map((photo) => photo.storagePath);
          uiValue = encodePhotoAnswer({ photos, selectedTagIds });
          nextPhotoMetaByQuestionId[question.id] = (answer.photos ?? []).map((photo) => ({
            storageBucket: photo.storageBucket,
            storagePath: photo.storagePath,
            mimeType: photo.mimeType ?? undefined,
            byteSize: photo.byteSize ?? undefined,
            widthPx: photo.widthPx ?? undefined,
            heightPx: photo.heightPx ?? undefined,
            sha256: photo.sha256 ?? undefined,
          }));
          nextPhotoAnswerIdByQuestionId[question.id] = answer.id;
        } else if (question.type === "numeric" || question.type === "slider" || question.type === "likert") {
          uiValue = answer.valueNumber ?? answer.valueText ?? undefined;
        } else {
          uiValue = answer.valueText ?? undefined;
        }
        writeAnswer(section.section, question.id, uiValue);
        if ((question.comment ?? "").trim().length > 0) {
          nextComments[question.id] = question.comment;
        }
      }
    }

    setVisitSessionId(payload.session.id);
    setVisitSessionStartedAt(payload.session.startedAt ?? null);
    setVonVal(hhmmFromIso(payload.session.startedAt ?? null));
    if (payload.session.status === "draft" && !payload.session.submittedAt) {
      setTimerSeconds(secondsSince(payload.session.startedAt ?? null));
      setTimerRunning(true);
      setTimerStopped(false);
      setPhase("active");
      setPhaseVisible(true);
    }
    setVisitSections((payload.sections ?? []).map((section) => ({
      section: section.section,
      campaignId: section.campaignId,
      campaignName: section.campaignName,
      fragebogenId: section.fragebogenId ?? "",
      fragebogenName: section.fragebogenName,
      questions: section.questions.map((question) => ({
        id: question.id,
        questionId: question.questionId,
        type: question.type,
        text: question.text,
        required: question.required,
        config: question.config,
        rules: (question.rules ?? [])
          .map((rule) => ({
            id: typeof rule.id === "string" ? rule.id : undefined,
            triggerQuestionId: typeof rule.triggerQuestionId === "string" ? rule.triggerQuestionId : "",
            operator: typeof rule.operator === "string" ? rule.operator : "equals",
            triggerValue: typeof rule.triggerValue === "string" ? rule.triggerValue : "",
            triggerValueMax: typeof rule.triggerValueMax === "string" ? rule.triggerValueMax : "",
            action: (rule.action === "show" ? "show" : "hide") as "show" | "hide",
            targetQuestionIds: Array.isArray(rule.targetQuestionIds)
              ? rule.targetQuestionIds.filter((entry): entry is string => typeof entry === "string")
              : [],
          }))
          .filter((rule) => rule.triggerQuestionId.length > 0 && rule.targetQuestionIds.length > 0),
        scoring: {},
        chains: question.chains ?? [],
        appliesToMarketChain: question.appliesToMarketChain ?? true,
        options: Array.isArray((question.config ?? {}).options) ? ((question.config ?? {}).options as string[]) : undefined,
        moduleId: "",
        moduleName: "",
      })),
    })));
    setAnswers(nextFragebogenAnswers);
    setKuehlerAnswers(nextKuehlerAnswers);
    setMhdAnswers(nextMhdAnswers);
    setQuestionComments(nextComments);
    setPhotoMetaByQuestionId(nextPhotoMetaByQuestionId);
    setPhotoAnswerIdByQuestionId(nextPhotoAnswerIdByQuestionId);
    setSessionIdInUrl(payload.session.id);
  }, [setSessionIdInUrl]);

  useEffect(() => {
    if (!hasVisitStartParams || phase !== "abschluss" || !manualTimeEdited || !visitSessionId || !visitSessionStartedAt || !isValidHm(vonVal)) return;
    const baseDate = new Date(visitSessionStartedAt);
    if (!Number.isFinite(baseDate.getTime())) return;
    const startedAtIso = toIsoForLocalTime(baseDate, vonVal);
    if (startedAtIso === visitSessionStartedAt) return;

    const timeoutId = window.setTimeout(() => {
      setSubmitSessionError(null);
      void updateGmVisitSessionStart(visitSessionId, { startedAt: startedAtIso })
        .then((result) => {
          setVisitSessionStartedAt(result.session.startedAt);
          setTimerSeconds(secondsSince(result.session.startedAt));
        })
        .catch((error) => {
          console.error("visit start time update failed", error);
          setSubmitSessionError("Startzeit konnte nicht gespeichert werden. Bitte Verbindung pruefen und erneut versuchen.");
        });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [
    hasVisitStartParams,
    manualTimeEdited,
    phase,
    visitSessionId,
    visitSessionStartedAt,
    vonVal,
  ]);

  useEffect(() => {
    if (!hasVisitStartParams || visitBootstrapDone) return;
    const runKey = `${marketId}|${campaignIdsParam}|${sessionIdFromParams.trim()}|${visitStartRetryNonce}`;
    if (bootstrapRunKeyRef.current === runKey) return;
    bootstrapRunKeyRef.current = runKey;
    let active = true;
    const requestSeq = ++bootstrapRequestSeqRef.current;
    const isStale = () => !active || bootstrapRequestSeqRef.current !== requestSeq;
    const resumeId = sessionIdFromParams.trim();

    if (resumeId) {
      const preloaded = readGmVisitPreloadCache(resumeId);
      if (preloaded && preloaded.session?.id === resumeId && Array.isArray(preloaded.sections)) {
        hydrateFromSessionPayload(preloaded);
        clearGmVisitPreloadCache(resumeId);
        setVisitStartError(null);
        setVisitStartLoading(false);
        setVisitBootstrapDone(true);
        return () => {
          active = false;
        };
      }
    }

    if (!resumeId) {
      const preloaded = readGmVisitStartPreloadCache({ marketId, campaignIds });
      if (preloaded && Array.isArray(preloaded.sections)) {
        hydrateFromStartPayload(preloaded);
        clearGmVisitStartPreloadCache({ marketId, campaignIds });
        setVisitStartError(null);
        setVisitStartLoading(false);
        setVisitBootstrapDone(true);
        return () => {
          active = false;
        };
      }
    }

    setVisitStartLoading(true);
    setVisitStartError(null);
    const run = async () => {
      try {
        if (resumeId) {
          const payload = await fetchGmVisitSession(resumeId);
          if (isStale()) return;
          hydrateFromSessionPayload(payload);
          setVisitBootstrapDone(true);
          return;
        }

        const activeVisit = await fetchActiveGmVisitSession({ marketId, campaignIds });
        if (isStale()) return;
        if (activeVisit?.session?.id) {
          const hydratedPayload = await fetchGmVisitSession(activeVisit.session.id);
          if (isStale()) return;
          hydrateFromSessionPayload(hydratedPayload);
          setVisitBootstrapDone(true);
          return;
        }

        const payload = await fetchGmVisitStartPayload(marketId, campaignIds);
        if (isStale()) return;
        hydrateFromStartPayload(payload);
        setVisitBootstrapDone(true);
      } catch (error) {
        if (isStale()) return;
        setVisitSessionId(null);
        setVisitSections([]);
        const message = error instanceof Error ? error.message : "Visit-Start Daten konnten nicht geladen werden.";
        setVisitStartError(message);
      } finally {
        if (isStale()) return;
        setVisitStartLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [
    campaignIdsParam,
    campaignIds,
    hasVisitStartParams,
    hydrateFromSessionPayload,
    hydrateFromStartPayload,
    marketId,
    sessionIdFromParams,
    visitBootstrapDone,
    visitStartRetryNonce,
  ]);

  useEffect(() => {
    return () => {
      Object.values(persistTimersRef.current).forEach((timer) => clearTimeout(timer));
      persistTimersRef.current = {};
      persistFlushersRef.current = {};
      persistInFlightRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (visitSessionId) return;
    setVisitSessionStartedAt(null);
    setPhotoSyncBusyByQuestionId({});
    setPhotoSyncErrorByQuestionId({});
    setPhotoMetaByQuestionId({});
    setPhotoAnswerIdByQuestionId({});
  }, [visitSessionId]);

  const dynamicQuestionSets = useMemo<{ fragebogen: SampleQuestion[]; kuehler: SampleQuestion[]; mhd: SampleQuestion[] }>(() => {
    if (!hasVisitStartParams) {
      return {
        fragebogen: DEFAULT_SAMPLE_QUESTIONS,
        kuehler: DEFAULT_KUEHLER_QUESTIONS,
        mhd: DEFAULT_MHD_QUESTIONS,
      };
    }
    const ordered = [...visitSections].sort((left, right) => {
      const order = ["standard", "flex", "billa", "kuehler", "mhd"] as const;
      const li = order.indexOf(left.section);
      const ri = order.indexOf(right.section);
      if (li !== ri) return li - ri;
      return 0;
    });
    const fragebogen = ordered
      .filter((entry) => entry.section === "standard" || entry.section === "flex" || entry.section === "billa")
      .flatMap((entry) => entry.questions.map((question) => mapVisitQuestionToSample(entry, question)));
    const kuehler = ordered
      .filter((entry) => entry.section === "kuehler")
      .flatMap((entry) => entry.questions.map((question) => mapVisitQuestionToSample(entry, question)));
    const mhd = ordered
      .filter((entry) => entry.section === "mhd")
      .flatMap((entry) => entry.questions.map((question) => mapVisitQuestionToSample(entry, question)));
    return { fragebogen, kuehler, mhd };
  }, [hasVisitStartParams, visitSections]);

  const SAMPLE_QUESTIONS = dynamicQuestionSets.fragebogen;
  const KUEHLER_QUESTIONS = dynamicQuestionSets.kuehler;
  const MHD_QUESTIONS = dynamicQuestionSets.mhd;

  const allRenderedQuestions = useMemo(
    () => [...SAMPLE_QUESTIONS, ...KUEHLER_QUESTIONS, ...MHD_QUESTIONS],
    [SAMPLE_QUESTIONS, KUEHLER_QUESTIONS, MHD_QUESTIONS],
  );

  const answerByQuestionId = useMemo(() => {
    const map = new Map<string, string | string[] | undefined>();
    for (const q of SAMPLE_QUESTIONS) map.set(q.id, answers[q.id]);
    for (const q of KUEHLER_QUESTIONS) map.set(q.id, kuehlerAnswers[q.id]);
    for (const q of MHD_QUESTIONS) map.set(q.id, mhdAnswers[q.id]);
    return map;
  }, [KUEHLER_QUESTIONS, MHD_QUESTIONS, SAMPLE_QUESTIONS, answers, kuehlerAnswers, mhdAnswers]);

  const chainHiddenQuestionIds = useMemo(
    () =>
      new Set(
        allRenderedQuestions
          .filter((question) => question.appliesToMarketChain === false)
          .map((question) => question.id),
      ),
    [allRenderedQuestions],
  );

  const hiddenQuestionIds = useMemo(() => {
    const ruleEligibleQuestions = allRenderedQuestions.filter((question) => !chainHiddenQuestionIds.has(question.id));
    const ruleHiddenQuestionIds = computeRuleHiddenQuestionIds(ruleEligibleQuestions, answerByQuestionId);
    return new Set<string>([...chainHiddenQuestionIds, ...ruleHiddenQuestionIds]);
  }, [allRenderedQuestions, answerByQuestionId, chainHiddenQuestionIds]);

  const handlePhotoSync = useCallback(
    async (payload: { questionId: string; files: File[]; selectedTagIds: string[] }) => {
      if (!visitSessionId) return;
      setPhotoSyncBusyByQuestionId((prev) => ({ ...prev, [payload.questionId]: true }));
      setPhotoSyncErrorByQuestionId((prev) => ({ ...prev, [payload.questionId]: null }));
      try {
        const existingAnswerId = photoAnswerIdByQuestionId[payload.questionId] ?? null;
        const answerId = existingAnswerId
          ? existingAnswerId
          : (await saveGmVisitAnswer({
              sessionId: visitSessionId,
              visitQuestionId: payload.questionId,
            })).result.answerId;
        if (!answerId) throw new Error("Foto-Antwort konnte nicht initialisiert werden.");
        if (!existingAnswerId) {
          setPhotoAnswerIdByQuestionId((prev) => ({ ...prev, [payload.questionId]: answerId }));
        }

        const existingMeta = photoMetaByQuestionId[payload.questionId] ?? [];
        const uploadedMeta: UploadedPhotoMeta[] = [];
        for (const file of payload.files) {
          const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
          const presign = await presignGmVisitPhoto({
            sessionId: visitSessionId,
            visitAnswerId: answerId,
            extension: ext,
          });
          const uploadResponse = await fetch(presign.upload.signedUrl, {
            method: "PUT",
            headers: {
              "content-type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!uploadResponse.ok) {
            throw new Error("Foto-Upload fehlgeschlagen.");
          }
          uploadedMeta.push({
            storageBucket: presign.upload.bucket,
            storagePath: presign.upload.path,
            mimeType: file.type || undefined,
            byteSize: file.size,
          });
        }

        const mergedMeta = payload.files.length > 0 ? [...existingMeta, ...uploadedMeta] : existingMeta;
        await commitGmVisitPhotos({
          sessionId: visitSessionId,
          visitAnswerId: answerId,
          photos: mergedMeta.map((meta) => ({
            ...meta,
            photoTagIds: payload.selectedTagIds,
          })),
        });
        setPhotoMetaByQuestionId((prev) => ({ ...prev, [payload.questionId]: mergedMeta }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Fotos konnten nicht gespeichert werden.";
        setPhotoSyncErrorByQuestionId((prev) => ({ ...prev, [payload.questionId]: message }));
      } finally {
        setPhotoSyncBusyByQuestionId((prev) => ({ ...prev, [payload.questionId]: false }));
      }
    },
    [photoAnswerIdByQuestionId, photoMetaByQuestionId, visitSessionId],
  );

  useEffect(() => {
    if (!visitSessionId || allRenderedQuestions.length === 0) return;
    for (const question of allRenderedQuestions) {
      const answerValue = answerByQuestionId.get(question.id);
      const commentValue = questionComments[question.id] ?? "";
      const isPhoto = question.type === "photo";
      const normalizedAnswer = isPhoto ? undefined : normalizeAnswerForPersistence(question, answerValue);
      const hasAnswer = normalizedAnswer !== undefined;
      const hasData = isPhoto ? commentValue.trim().length > 0 : hasAnswer || commentValue.trim().length > 0;
      const answerToPersist = normalizedAnswer;
      const nextSig = JSON.stringify({ answer: answerToPersist ?? null, comment: commentValue });
      const previousSig = lastPersistSigRef.current[question.id];
      if (!hasData && !previousSig) continue;
      if (previousSig === nextSig) continue;

      const existingTimer = persistTimersRef.current[question.id];
      if (existingTimer) clearTimeout(existingTimer);
      const runPersist = async () => {
        await saveGmVisitAnswer({
          sessionId: visitSessionId,
          visitQuestionId: question.id,
          answer: answerToPersist,
          comment: commentValue,
        });
        if (hasData) {
          lastPersistSigRef.current[question.id] = nextSig;
        } else {
          delete lastPersistSigRef.current[question.id];
        }
      };
      persistFlushersRef.current[question.id] = runPersist;
      persistTimersRef.current[question.id] = setTimeout(() => {
        delete persistTimersRef.current[question.id];
        const persistPromise = runPersist()
          .catch((error) => {
            console.error("visit answer save failed", error);
            throw error;
          })
          .finally(() => {
            if (persistInFlightRef.current[question.id] === persistPromise) {
              delete persistInFlightRef.current[question.id];
            }
            if (persistFlushersRef.current[question.id] === runPersist) {
              delete persistFlushersRef.current[question.id];
            }
          });
        persistInFlightRef.current[question.id] = persistPromise;
        void persistPromise;
      }, 320);
    }
  }, [
    allRenderedQuestions,
    answerByQuestionId,
    questionComments,
    visitSessionId,
  ]);

  useEffect(() => {
    if (SAMPLE_QUESTIONS.length > 0) {
      setActiveSection("fragebogen");
      return;
    }
    if (KUEHLER_QUESTIONS.length > 0) {
      setActiveSection("kuehler");
      return;
    }
    if (MHD_QUESTIONS.length > 0) {
      setActiveSection("mhd");
    }
  }, [SAMPLE_QUESTIONS.length, KUEHLER_QUESTIONS.length, MHD_QUESTIONS.length]);

  // Timer logic
  useEffect(() => {
    if (timerRunning && !timerStopped) {
      intervalRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerStopped]);

  // Aurora switches with active section
  useEffect(() => {
    if (phase === "confirm") {
      setAuroraColors(["#D1FAE5", "#059669", "#D1FAE5"]);
    } else if (phase === "abschluss") {
      setAuroraColors(["#F4B4B4", "#DC2626", "#F4B4B4"]);
    } else if (activeSection === "kuehler") {
      setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
    } else if (activeSection === "mhd") {
      setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]);
    } else {
      setAuroraColors(["#F4B4B4", "#DC2626", "#F4B4B4"]);
    }
  }, [activeSection, phase]);

  const cc = chainColor(chain);
  const isVisitBootstrapLoading = hasVisitStartParams && !visitBootstrapDone && visitStartLoading;

  // Phase transition helper
  function transitionTo(next: Phase) {
    setPhaseVisible(false);
    setTimeout(() => {
      setPhase(next);
      setPhaseVisible(true);
      if (next === "abschluss") {
        setBisVal(nowHHMM());
        setManualTimeEdited(false);
        setTimerStopped(true);
      }
      if (next === "confirm") {
        setAuroraColors(["#D1FAE5", "#059669", "#D1FAE5"]);
      }
    }, 260);
  }

  const flushPendingAnswerSaves = useCallback(async (): Promise<{ ok: boolean; failedQuestionIds: string[] }> => {
    const pendingFlushers = { ...persistFlushersRef.current };
    Object.values(persistTimersRef.current).forEach((timer) => clearTimeout(timer));
    persistTimersRef.current = {};
    persistFlushersRef.current = {};

    const immediateEntries = Object.entries(pendingFlushers);
    const immediatePromises = immediateEntries.map(([questionId, runPersist]) => {
      const promise = runPersist()
        .catch((error) => {
          console.error("visit answer immediate flush failed", error);
          throw error;
        })
        .finally(() => {
          if (persistInFlightRef.current[questionId] === promise) {
            delete persistInFlightRef.current[questionId];
          }
        });
      persistInFlightRef.current[questionId] = promise;
      return { questionId, promise };
    });

    const immediateResults = await Promise.allSettled(
      immediatePromises.map(({ promise }) => promise),
    );
    const immediateFailed = immediateResults.flatMap((result, idx) =>
      result.status === "rejected" ? [immediatePromises[idx]?.questionId ?? ""] : [],
    );

    const inFlightEntries = Object.entries(persistInFlightRef.current);
    const inFlightResults = await Promise.allSettled(
      inFlightEntries.map(([, promise]) => promise),
    );
    const inFlightFailed = inFlightResults.flatMap((result, idx) =>
      result.status === "rejected" ? [inFlightEntries[idx]?.[0] ?? ""] : [],
    );

    const failedQuestionIds = Array.from(new Set([...immediateFailed, ...inFlightFailed].filter((id) => id.length > 0)));
    return { ok: failedQuestionIds.length === 0, failedQuestionIds };
  }, []);

  async function persistVisitStartBeforeLeaving(): Promise<boolean> {
    if (!hasVisitStartParams || !manualTimeEdited) return true;
    if (!visitSessionId) return false;
    if (!visitSessionStartedAt || !isValidHm(vonVal)) {
      setVisitExitError("Startzeit konnte nicht gespeichert werden. Bitte gueltige Zeit im Format HH:MM eingeben.");
      return false;
    }
    let startedAtIso = visitSessionStartedAt ?? new Date().toISOString();
    const baseDate = new Date(visitSessionStartedAt);
    if (Number.isFinite(baseDate.getTime())) {
      startedAtIso = toIsoForLocalTime(baseDate, vonVal);
    }
    try {
      const result = await updateGmVisitSessionStart(visitSessionId, { startedAt: startedAtIso });
      setVisitSessionStartedAt(result.session.startedAt);
      setTimerSeconds(secondsSince(result.session.startedAt));
      return true;
    } catch (error) {
      console.error("visit start time update before leaving failed", error);
      setVisitExitError("Startzeit konnte nicht gespeichert werden. Bitte Verbindung pruefen und erneut versuchen.");
      return false;
    }
  }

  function buildActiveVisitHandoffPayload(): GmVisitSessionReadPayload | null {
    if (!hasVisitStartParams || !visitSessionId || !visitSessionStartedAt) return null;
    const addressParts = address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const lastAddressPart = addressParts[addressParts.length - 1] ?? "";
    const postalCityMatch = lastAddressPart.match(/^(\d{4,5})\s+(.+)$/);
    const streetAddress = postalCityMatch && addressParts.length > 1
      ? addressParts.slice(0, -1).join(", ")
      : address;

    return {
      session: {
        id: visitSessionId,
        status: "draft",
        startedAt: visitSessionStartedAt,
        submittedAt: null,
      },
      market: {
        id: marketId,
        name: chain,
        address: streetAddress,
        postalCode: postalCityMatch?.[1] ?? "",
        city: postalCityMatch?.[2] ?? "",
      },
      sections: visitSections.map((section, orderIndex) => ({
        id: `handoff-${section.campaignId}-${section.section}-${orderIndex}`,
        section: section.section,
        campaignId: section.campaignId,
        campaignName: section.campaignName,
        fragebogenId: section.fragebogenId || null,
        fragebogenName: section.fragebogenName,
        orderIndex,
        questions: section.questions.map((question) => ({
          id: question.id,
          questionId: question.questionId,
          type: question.type,
          text: question.text,
          required: question.required,
          singleChoiceAvailability: question.singleChoiceAvailability ?? null,
          singleChoiceAvailabilityType: question.singleChoiceAvailabilityType ?? null,
          config: question.config,
          rules: question.rules,
          chains: question.chains,
          appliesToMarketChain: question.appliesToMarketChain,
          answer: null,
          comment: questionComments[question.id] ?? "",
        })),
      })),
    };
  }

  async function handleContinueVisitLater() {
    if (visitExitBusy) return;
    setVisitExitBusy(true);
    setVisitExitError(null);
    try {
      const flushResult = await flushPendingAnswerSaves();
      if (!flushResult.ok) {
        setVisitExitError("Speichern der Antworten fehlgeschlagen. Bitte kurz warten und erneut versuchen.");
        return;
      }
      const startPersisted = await persistVisitStartBeforeLeaving();
      if (!startPersisted) return;
      const handoffPayload = buildActiveVisitHandoffPayload();
      if (handoffPayload) {
        setLatestActiveGmVisitHandoff(handoffPayload);
      }
      router.push("/gm");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Marktbesuch konnte nicht gespeichert werden.";
      setVisitExitError(message || "Marktbesuch konnte nicht gespeichert werden.");
    } finally {
      setVisitExitBusy(false);
    }
  }

  async function handleConfirmAbortVisit() {
    if (visitExitBusy) return;
    setVisitExitBusy(true);
    setVisitExitError(null);
    try {
      if (visitSessionId) {
        await cancelGmVisitSession(visitSessionId);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gm:kuehler-mhd-progress-updated"));
      }
      router.push("/gm");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fragebogen konnte nicht abgebrochen werden.";
      setVisitExitError(message || "Fragebogen konnte nicht abgebrochen werden.");
    } finally {
      setVisitExitBusy(false);
    }
  }

  async function handleSubmitVisit() {
    setSubmitSessionError(null);
    if (!visitSessionId) {
      transitionTo("confirm");
      return;
    }
    setIsSubmittingSession(true);
    try {
      const flushResult = await flushPendingAnswerSaves();
      if (!flushResult.ok) {
        setSubmitSessionError("Speichern der Antworten fehlgeschlagen. Bitte kurz warten und erneut versuchen.");
        return;
      }

      const localMissing = computeMissingRequired();
      if (localMissing.all.length > 0) {
        setSubmitSessionError("Nicht alle Pflichtfragen sind vollständig beantwortet.");
        triggerMissingHighlight(localMissing.all.map((q) => q.id));
        return;
      }

      const requiredPhotoCommitCheck = await ensureRequiredPhotoArtifactsCommitted();
      if (!requiredPhotoCommitCheck.ok) {
        setSubmitSessionError(requiredPhotoCommitCheck.message ?? "Nicht alle Pflichtfragen sind vollständig beantwortet.");
        if (requiredPhotoCommitCheck.missingIds.length > 0) {
          triggerMissingHighlight(requiredPhotoCommitCheck.missingIds);
        }
        return;
      }

      if (manualTimeEdited) {
        if (!isValidHm(vonVal) || !isValidHm(bisVal)) {
          setSubmitSessionError("Bitte gültige Zeiten im Format HH:MM eingeben.");
          return;
        }
        const baseDate = visitSessionStartedAt ? new Date(visitSessionStartedAt) : new Date();
        const startedAtIso = toIsoForLocalTime(baseDate, vonVal);
        let submittedAtIso = toIsoForLocalTime(baseDate, bisVal);
        if (new Date(submittedAtIso).getTime() <= new Date(startedAtIso).getTime()) {
          const nextDay = new Date(baseDate);
          nextDay.setDate(nextDay.getDate() + 1);
          submittedAtIso = toIsoForLocalTime(nextDay, bisVal);
        }

        await submitGmVisitSession(visitSessionId, {
          startedAt: startedAtIso,
          submittedAt: submittedAtIso,
        });
      } else {
        await submitGmVisitSession(visitSessionId);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("gm:kuehler-mhd-progress-updated"));
      }
      transitionTo("confirm");
    } catch (error) {
      if (error instanceof BackendApiError && error.code === "visit_submit_incomplete_required") {
        const payload = error.data as { missingRequired?: Array<{ visitQuestionId?: string; questionText?: string }> };
        const missing = Array.isArray(payload.missingRequired) ? payload.missingRequired : [];
        const missingIds = missing
          .map((entry) => (typeof entry.visitQuestionId === "string" ? entry.visitQuestionId : ""))
          .filter((id) => id.length > 0);
        if (missingIds.length > 0) {
          triggerMissingHighlight(missingIds);
        }
        const labels = missing
          .map((entry) => (typeof entry.questionText === "string" ? entry.questionText.trim() : ""))
          .filter((text) => text.length > 0)
          .slice(0, 2);
        setSubmitSessionError(
          labels.length > 0
            ? `Nicht alle Pflichtfragen sind vollständig beantwortet: ${labels.join(" | ")}`
            : "Nicht alle Pflichtfragen sind vollständig beantwortet.",
        );
        return;
      }
      const message = error instanceof Error ? error.message : "Marktbesuch konnte nicht abgeschlossen werden.";
      setSubmitSessionError(message);
    } finally {
      setIsSubmittingSession(false);
    }
  }

  const visibleSAMPLE_QUESTIONS = SAMPLE_QUESTIONS.filter((q) => !hiddenQuestionIds.has(q.id));
  const visibleKUEHLER_QUESTIONS = KUEHLER_QUESTIONS.filter((q) => !hiddenQuestionIds.has(q.id));
  const visibleMHD_QUESTIONS = MHD_QUESTIONS.filter((q) => !hiddenQuestionIds.has(q.id));

  useEffect(() => {
    setCurrentQIndex((prev) => {
      const max = Math.max(visibleSAMPLE_QUESTIONS.length - 1, 0);
      return Math.min(prev, max);
    });
  }, [visibleSAMPLE_QUESTIONS.length]);

  useEffect(() => {
    setKuehlerQIndex((prev) => {
      const max = Math.max(visibleKUEHLER_QUESTIONS.length - 1, 0);
      return Math.min(prev, max);
    });
  }, [visibleKUEHLER_QUESTIONS.length]);

  useEffect(() => {
    setMhdQIndex((prev) => {
      const max = Math.max(visibleMHD_QUESTIONS.length - 1, 0);
      return Math.min(prev, max);
    });
  }, [visibleMHD_QUESTIONS.length]);

  useEffect(() => {
    const hasFragebogen = visibleSAMPLE_QUESTIONS.length > 0;
    const hasKuehler = visibleKUEHLER_QUESTIONS.length > 0;
    const hasMhd = visibleMHD_QUESTIONS.length > 0;
    if (activeSection === "fragebogen" && !hasFragebogen) {
      if (hasKuehler) {
        setActiveSection("kuehler");
        setKuehlerQIndex(0);
      } else if (hasMhd) {
        setActiveSection("mhd");
        setMhdQIndex(0);
      }
    } else if (activeSection === "kuehler" && !hasKuehler) {
      if (hasMhd) {
        setActiveSection("mhd");
        setMhdQIndex(0);
      } else if (hasFragebogen) {
        setActiveSection("fragebogen");
        setCurrentQIndex(0);
      }
    } else if (activeSection === "mhd" && !hasMhd) {
      if (hasKuehler) {
        setActiveSection("kuehler");
        setKuehlerQIndex(0);
      } else if (hasFragebogen) {
        setActiveSection("fragebogen");
        setCurrentQIndex(0);
      }
    }
  }, [
    activeSection,
    visibleKUEHLER_QUESTIONS.length,
    visibleMHD_QUESTIONS.length,
    visibleSAMPLE_QUESTIONS.length,
  ]);

  // Question navigation
  function goNext() {
    if (currentQIndex < visibleSAMPLE_QUESTIONS.length - 1) {
      setDirection("forward");
      setAnimKey(`${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    } else if (visibleKUEHLER_QUESTIONS.length > 0) {
      setActiveSection("kuehler");
      setKuehlerQIndex(0);
      setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
    } else if (visibleMHD_QUESTIONS.length > 0) {
      setActiveSection("mhd");
      setMhdQIndex(0);
      setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]);
    } else {
      handleAbschluss();
    }
  }

  function goBack() {
    if (activeSection === "mhd") {
      if (mhdQIndex > 0) {
        setMhdQIndex((i) => i - 1);
      } else {
        if (visibleKUEHLER_QUESTIONS.length > 0) {
          setActiveSection("kuehler");
          setKuehlerQIndex(visibleKUEHLER_QUESTIONS.length - 1);
          setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
        } else if (visibleSAMPLE_QUESTIONS.length > 0) {
          setActiveSection("fragebogen");
          setCurrentQIndex(Math.max(0, visibleSAMPLE_QUESTIONS.length - 1));
          setAuroraColors(["#F4B4B4", "#DC2626", "#F4B4B4"]);
        }
      }
    } else if (activeSection === "kuehler") {
      if (kuehlerQIndex > 0) {
        setKuehlerQIndex((i) => i - 1);
      } else if (visibleSAMPLE_QUESTIONS.length > 0) {
        setActiveSection("fragebogen");
        setAuroraColors(["#F4B4B4", "#DC2626", "#F4B4B4"]);
      }
    } else if (currentQIndex > 0) {
      setDirection("back");
      setAnimKey(`${currentQIndex - 1}-back`);
      setCurrentQIndex((i) => i - 1);
    }
  }

  const jumpTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, Math.max(visibleSAMPLE_QUESTIONS.length - 1, 0)));
    if (visibleSAMPLE_QUESTIONS.length === 0) return;
    setDirection(clamped >= currentQIndex ? "forward" : "back");
    setAnimKey(`${clamped}-jump-${Date.now()}`);
    setCurrentQIndex(clamped);
    setActiveSection("fragebogen");
  }, [currentQIndex, visibleSAMPLE_QUESTIONS.length]);

  const jumpToKuehler = useCallback((index = 0) => {
    if (visibleKUEHLER_QUESTIONS.length === 0) return;
    const clamped = Math.max(0, Math.min(index, Math.max(visibleKUEHLER_QUESTIONS.length - 1, 0)));
    setActiveSection("kuehler");
    setKuehlerQIndex(clamped);
    setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
  }, [visibleKUEHLER_QUESTIONS.length]);

  const jumpToMhd = useCallback((index = 0) => {
    if (visibleMHD_QUESTIONS.length === 0) return;
    const clamped = Math.max(0, Math.min(index, Math.max(visibleMHD_QUESTIONS.length - 1, 0)));
    setActiveSection("mhd");
    setMhdQIndex(clamped);
    setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]);
  }, [visibleMHD_QUESTIONS.length]);

  const getCurrentAnswerForQuestion = useCallback((questionId: string): string | string[] | undefined => {
    const fb = answers[questionId];
    if (fb !== undefined) return fb;
    const k = kuehlerAnswers[questionId];
    if (k !== undefined) return k;
    return mhdAnswers[questionId];
  }, [answers, kuehlerAnswers, mhdAnswers]);

  const ensureRequiredPhotoArtifactsCommitted = useCallback(async (): Promise<{ ok: boolean; missingIds: string[]; message?: string }> => {
    if (!visitSessionId) return { ok: true, missingIds: [] };
    const requiredPhotos = allRenderedQuestions.filter(
      (q) => q.required && q.type === "photo" && !hiddenQuestionIds.has(q.id),
    );
    if (requiredPhotos.length === 0) return { ok: true, missingIds: [] };

    const missingIds: string[] = [];

    for (const question of requiredPhotos) {
      const answerValue = getCurrentAnswerForQuestion(question.id);
      const photoState = decodePhotoAnswer(answerValue);
      const hasLocalPhotos = photoState.photos.length > 0;
      const tagsEnabled = Boolean(question.config?.tagsEnabled) && Array.isArray(question.config?.tagIds) && question.config.tagIds.length > 0;

      if (!hasLocalPhotos) {
        missingIds.push(question.id);
        continue;
      }
      if (tagsEnabled && photoState.selectedTagIds.length === 0) {
        missingIds.push(question.id);
        continue;
      }
      if (photoSyncBusyByQuestionId[question.id]) {
        return {
          ok: false,
          missingIds: [question.id],
          message: "Fotos werden noch gespeichert. Bitte kurz warten und erneut versuchen.",
        };
      }
      if (photoSyncErrorByQuestionId[question.id]) {
        return {
          ok: false,
          missingIds: [question.id],
          message: photoSyncErrorByQuestionId[question.id] ?? "Foto-Synchronisierung fehlgeschlagen.",
        };
      }

      const meta = photoMetaByQuestionId[question.id] ?? [];
      if (meta.length === 0) {
        missingIds.push(question.id);
        continue;
      }

      let answerId = photoAnswerIdByQuestionId[question.id];
      if (!answerId) {
        const created = await saveGmVisitAnswer({
          sessionId: visitSessionId,
          visitQuestionId: question.id,
        });
        answerId = created.result.answerId;
        if (answerId) {
          setPhotoAnswerIdByQuestionId((prev) => ({ ...prev, [question.id]: answerId as string }));
        }
      }
      if (!answerId) {
        missingIds.push(question.id);
        continue;
      }

      await commitGmVisitPhotos({
        sessionId: visitSessionId,
        visitAnswerId: answerId,
        photos: meta.map((entry) => ({
          ...entry,
          photoTagIds: photoState.selectedTagIds,
        })),
      });
    }

    return { ok: missingIds.length === 0, missingIds };
  }, [
    allRenderedQuestions,
    getCurrentAnswerForQuestion,
    photoAnswerIdByQuestionId,
    photoMetaByQuestionId,
    photoSyncBusyByQuestionId,
    photoSyncErrorByQuestionId,
    visitSessionId,
    hiddenQuestionIds,
  ]);

  const buildMissingFocus = useCallback((missingIds: string[]) => {
    const missingSet = new Set(missingIds);
    const sectionSet = new Set<"fragebogen" | "kuehler" | "mhd">();
    const moduleSet = new Set<string>();

    SAMPLE_QUESTIONS.forEach((q) => {
      if (!missingSet.has(q.id)) return;
      sectionSet.add("fragebogen");
      moduleSet.add(q.moduleId);
    });
    KUEHLER_QUESTIONS.forEach((q) => {
      if (!missingSet.has(q.id)) return;
      sectionSet.add("kuehler");
      moduleSet.add(q.moduleId);
    });
    MHD_QUESTIONS.forEach((q) => {
      if (!missingSet.has(q.id)) return;
      sectionSet.add("mhd");
      moduleSet.add(q.moduleId);
    });

    return {
      sections: Array.from(sectionSet),
      modules: Array.from(moduleSet),
    };
  }, [KUEHLER_QUESTIONS, MHD_QUESTIONS, SAMPLE_QUESTIONS]);

  const computeMissingRequired = useCallback(() => {
    const missingFb = SAMPLE_QUESTIONS.filter((q) => q.required && !hiddenQuestionIds.has(q.id) && !isQuestionComplete(q, answers[q.id]));
    const missingK = KUEHLER_QUESTIONS.filter((q) => q.required && !hiddenQuestionIds.has(q.id) && !isQuestionComplete(q, kuehlerAnswers[q.id]));
    const missingM = MHD_QUESTIONS.filter((q) => q.required && !hiddenQuestionIds.has(q.id) && !isQuestionComplete(q, mhdAnswers[q.id]));
    return {
      missingFb,
      missingK,
      missingM,
      all: [...missingFb, ...missingK, ...missingM],
    };
  }, [KUEHLER_QUESTIONS, MHD_QUESTIONS, SAMPLE_QUESTIONS, answers, hiddenQuestionIds, kuehlerAnswers, mhdAnswers]);

  const triggerMissingHighlight = useCallback((missingIds: string[]) => {
    if (missingIds.length === 0) return;
    const focus = buildMissingFocus(missingIds);
    setFlashSections(focus.sections);
    setFlashModules(focus.modules);
    setNavOpen(true);
    setTimeout(() => {
      setFlashSections([]);
      setFlashModules([]);
    }, 2200);
  }, [buildMissingFocus]);

  function handleAbschluss() {
    const missing = computeMissingRequired();
    if (missing.all.length === 0) {
      transitionTo("abschluss");
      return;
    }
    triggerMissingHighlight(missing.all.map((q) => q.id));
  }

  const kuehlerAnsweredCount = visibleKUEHLER_QUESTIONS.filter((q) => kuehlerAnswers[q.id] !== undefined).length;
  const mhdAnsweredCount = visibleMHD_QUESTIONS.filter((q) => mhdAnswers[q.id] !== undefined).length;
  const answeredCount = visibleSAMPLE_QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const totalSectionQuestionCount = visibleSAMPLE_QUESTIONS.length + visibleKUEHLER_QUESTIONS.length + visibleMHD_QUESTIONS.length;
  const allDone = answeredCount === visibleSAMPLE_QUESTIONS.length && kuehlerAnsweredCount === visibleKUEHLER_QUESTIONS.length && mhdAnsweredCount === visibleMHD_QUESTIONS.length;
  const fragebogenProgressPct = visibleSAMPLE_QUESTIONS.length > 0 ? (answeredCount / visibleSAMPLE_QUESTIONS.length) * 100 : 0;
  const kuehlerProgressPct = visibleKUEHLER_QUESTIONS.length > 0 ? (kuehlerAnsweredCount / visibleKUEHLER_QUESTIONS.length) * 100 : 0;
  const mhdProgressPct = visibleMHD_QUESTIONS.length > 0 ? (mhdAnsweredCount / visibleMHD_QUESTIONS.length) * 100 : 0;
  const visitStartBlocked = visitStartLoading || (!!hasVisitStartParams && (Boolean(visitStartError) || totalSectionQuestionCount === 0));

  async function handleTimerStart() {
    if (visitStartBlocked) return;
    if (!hasVisitStartParams) {
      setTimerRunning(true);
      setTimerStopped(false);
      transitionTo("active");
      return;
    }

    const clientStartedAt = new Date().toISOString();
    const clientSessionToken =
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 120);
    setVisitStartError(null);

    try {
      setVisitStartLoading(true);
      const sessionId = visitSessionId;
      if (sessionId) {
        const updated = await updateGmVisitSessionStart(sessionId, { startedAt: clientStartedAt });
        const hydratedPayload = await fetchGmVisitSession(updated.session.id);
        hydrateFromSessionPayload(hydratedPayload);
        return;
      }

      const created = await createGmVisitSession({
        marketId,
        campaignIds,
        clientSessionToken,
        startedAt: clientStartedAt,
      });
      const hydratedPayload = await fetchGmVisitSession(created.session.id);
      hydrateFromSessionPayload(hydratedPayload);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : "Start konnte nicht gespeichert werden. Bitte Verbindung pruefen und erneut versuchen.";
      setVisitStartError(message);
    } finally {
      setVisitStartLoading(false);
    }
  }

  const currentQ = visibleSAMPLE_QUESTIONS[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const currentQReady = currentQ
    ? (!currentQ.required || isQuestionComplete(currentQ, currentAnswer)) && isTaggedPhotoReady(currentQ, currentAnswer)
    : true;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f7", position: "relative" }}>

      {/* Aurora */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 500,
        pointerEvents: "none", zIndex: 0, opacity: 0.45,
        transition: "opacity 0.6s ease",
      }}>
        <Aurora
          colorStops={auroraColors}
          blend={0.6}
          amplitude={0.75}
          speed={0.3}
        />
      </div>

      {/* Content wrapper with phase transitions */}
      <div
        style={{
          position: "relative", zIndex: 1,
          opacity: phaseVisible ? 1 : 0,
          transform: phaseVisible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.26s ease, transform 0.26s ease",
        }}
      >

        {/* ── IDLE PHASE ──────────────────────────────────────────────────── */}
        {phase === "idle" && isVisitBootstrapLoading && (
          <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px 80px",
          }}>
            <style>{`
              @keyframes visitBootstrapIn {
                from { opacity: 0; transform: scale(0.96) translateY(8px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              @keyframes visitBootstrapStripe {
                from { background-position: 0 0; }
                to { background-position: 28px 0; }
              }
            `}</style>
            <div style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: "rgba(255,255,255,0.74)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow: "0 2px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
              padding: "24px 24px 22px",
              animation: "visitBootstrapIn 0.28s cubic-bezier(0.4,0,0.2,1) both",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#991b1b", letterSpacing: "-0.01em", textAlign: "center" }}>
                Marktbesuch wird vorbereitet...
              </div>
              <div
                style={{
                  marginTop: 10,
                  height: 8,
                  borderRadius: 99,
                  background: "rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: "88%",
                    height: "100%",
                    borderRadius: 99,
                    backgroundImage: "repeating-linear-gradient(-45deg, rgba(220,38,38,0.92) 0px, rgba(220,38,38,0.92) 4px, rgba(248,113,113,0.45) 4px, rgba(248,113,113,0.45) 8px)",
                    backgroundColor: "#DC2626",
                    animation: "visitBootstrapStripe 0.8s linear infinite",
                  }}
                />
              </div>
              <div style={{ marginTop: 7, fontSize: 10, color: "rgba(0,0,0,0.42)", textAlign: "center" }}>
                Besuchsfragen werden geladen...
              </div>
            </div>
          </div>
        )}

        {phase === "idle" && !isVisitBootstrapLoading && (
          <div style={{
            minHeight: "100vh",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "0 24px 80px",
          }}>
            <style>{`
              @keyframes fadeUp {
                from { opacity: 0; transform: translateY(10px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
              @keyframes noteJump {
                0%      { transform: translateY(0); }
                8%      { transform: translateY(-4px); }
                16%     { transform: translateY(0); }
                24%     { transform: translateY(-4px); }
                32%     { transform: translateY(0); }
                100%    { transform: translateY(0); }
              }
              }
            `}</style>

            {/* Floating card — no heavy shadow, low-opacity background */}
            <div style={{
              width: "100%", maxWidth: 320,
              backgroundColor: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow: "0 2px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
              padding: "28px 24px 22px",
              animation: "fadeUp 0.38s cubic-bezier(0.4,0,0.2,1) both",
              position: "relative",
            }}>

              {/* Note icon — top right */}
              <button
                onClick={() => { setNoteDraft(visitNote); setNoteOpen(true); }}
                style={{
                  position: "absolute", top: 14, right: 14,
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6,
                  animation: visitNote ? "noteJump 2.4s ease-in-out infinite" : "none",
                }}
                title="Notiz"
              >
                <NotebookPen
                  size={15}
                  strokeWidth={1.8}
                  color={visitNote ? "#34d399" : "rgba(0,0,0,0.22)"}
                />
              </button>

              {/* Note modal — portalled to body so full-page blur works */}
              {noteOpen && typeof document !== "undefined" && createPortal(
                <div
                  onClick={() => setNoteOpen(false)}
                  style={{
                    position: "fixed", inset: 0, zIndex: 300,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 20px",
                    backgroundColor: "rgba(0,0,0,0.18)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                  }}
                >
                  <style>{`@keyframes visitNoteIn { from { opacity:0; transform:scale(0.95) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: "100%", maxWidth: 360,
                      backgroundColor: "rgba(255,255,255,0.98)",
                      borderRadius: 16,
                      boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                      animation: "visitNoteIn 0.18s cubic-bezier(0.4,0,0.2,1) both",
                    }}
                  >
                    <div style={{ padding: "12px 16px 10px", backgroundColor: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.28)" }}>
                        Kommentar
                      </div>
                    </div>
                    <div style={{ padding: "12px 16px", backgroundColor: "#fff" }}>
                      <textarea
                        autoFocus
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        placeholder="Notiz zum Marktbesuch..."
                        style={{
                          width: "100%", minHeight: 80,
                          fontSize: 12, color: "#1a1a1a",
                          background: "#fff", border: "none", outline: "none",
                          resize: "none", lineHeight: 1.6,
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                    <div style={{ padding: "10px", display: "flex", alignItems: "center", gap: 7, backgroundColor: "rgba(0,0,0,0.03)", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                      <button
                        onClick={() => setNoteOpen(false)}
                        style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.07), inset 0 0 0 1px rgba(0,0,0,0.06)", transition: "opacity 0.15s" }}
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => { setVisitNote(noteDraft); setNoteOpen(false); }}
                        style={{
                          flex: 2, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: 700, color: "#fff",
                          background: "linear-gradient(to bottom, #DC2626, #DC2626cc)",
                          boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.28), 0 0 0 1px #DC262680, 0 2px 8px #DC262630",
                          transition: "opacity 0.15s",
                        }}
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* Market info — top of card */}
              <div style={{
                display: "flex", alignItems: "center", gap: 7, marginBottom: 22,
              }}>
                <MapPin size={13} strokeWidth={1.6} color="rgba(0,0,0,0.3)" />
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  padding: "2px 8px", borderRadius: 6,
                  backgroundColor: cc.bg, color: cc.text,
                }}>
                  {chain}
                </span>
                {address && (
                  <span style={{
                    fontSize: 10, color: "rgba(0,0,0,0.4)", fontWeight: 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1, minWidth: 0,
                  }}>
                    {address}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 20 }} />

              {/* Heading + subtext */}
              <div style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: "#1a1a1a",
                  letterSpacing: "-0.02em", marginBottom: 4,
                }}>
                  Aktiver Marktbesuch
                </div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", lineHeight: 1.5 }}>
                  Timer läuft automatisch. Du kannst die Zeit danach anpassen.
                </div>
                {visitStartLoading && visitBootstrapDone && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "rgba(0,0,0,0.42)" }}>
                    Start wird gespeichert...
                  </div>
                )}
                {visitStartError && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: "rgba(220,38,38,0.85)", fontWeight: 600 }}>
                      {visitStartError}
                    </div>
                    <button
                      onClick={() => {
                        bootstrapRunKeyRef.current = null;
                        setVisitBootstrapDone(false);
                        setVisitStartRetryNonce((prev) => prev + 1);
                      }}
                      style={{
                        marginTop: 6,
                        border: "none",
                        background: "none",
                        color: "#DC2626",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Erneut versuchen
                    </button>
                  </div>
                )}
                {hasVisitStartParams && !visitStartLoading && !visitStartError && totalSectionQuestionCount === 0 && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "rgba(220,38,38,0.85)", fontWeight: 600 }}>
                    Für die ausgewählten Sektionen sind aktuell keine Fragen verfügbar.
                  </div>
                )}
              </div>

              {/* Timer starten button */}
              <button
                onClick={() => { void handleTimerStart(); }}
                disabled={visitStartBlocked}
                style={{
                  width: "100%", padding: "9px 0",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                  color: visitStartBlocked ? "rgba(0,0,0,0.28)" : "#fff",
                  border: "none",
                  borderRadius: 9,
                  cursor: visitStartBlocked ? "not-allowed" : "pointer",
                  background:
                    visitStartBlocked
                      ? "rgba(0,0,0,0.08)"
                      : "linear-gradient(to bottom, #DC2626, #b91c1c)",
                  boxShadow:
                    visitStartBlocked
                      ? "none"
                      : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (e.currentTarget.disabled) return;
                  e.currentTarget.style.opacity = "0.88";
                }}
                onMouseLeave={(e) => {
                  if (e.currentTarget.disabled) return;
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Timer starten
              </button>

              {/* Skip */}
              <button
                onClick={() => {
                  if (visitStartBlocked) return;
                  transitionTo("active");
                }}
                style={{
                  marginTop: 10, width: "100%",
                  fontSize: 10,
                  color: visitStartBlocked ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.3)",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: visitStartBlocked ? "not-allowed" : "pointer",
                  padding: "3px 0", letterSpacing: "0.01em",
                }}
              >
                Überspringen und manuell eintragen
              </button>
            </div>
          </div>
        )}



        {/* ── CONFIRM PHASE ───────────────────────────────────────────────── */}
        {phase === "confirm" && (
          <div style={{
            minHeight: "100vh",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "30px 18px 56px",
            background: "linear-gradient(180deg, rgba(249,250,251,0.28) 0%, rgba(255,255,255,0.16) 72%)",
          }}>
            <style>{`
              @keyframes fadeUp {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes checkPop {
                0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
                60%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
              }
            `}</style>

            <div style={{
              width: "100%",
              maxWidth: 410,
              borderRadius: 22,
              background: "linear-gradient(180deg, rgba(249,250,251,0.98), rgba(244,245,247,0.96))",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 12px 34px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)",
              padding: "20px 14px 14px",
            }}>

              {/* Hero */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center", marginBottom: 28, gap: 0,
              }}>
                {/* Icon */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 18,
                  animation: "checkPop 0.55s 0.08s cubic-bezier(0.34,1.56,0.64,1) both",
                }}>
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
                    border: "1px solid rgba(16,185,129,0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <CheckCircle2 size={38} strokeWidth={1.6} color="#059669" />
                  </div>
                </div>

                {/* Title */}
                <div style={{
                  fontSize: 23, fontWeight: 800, color: "#111827",
                  letterSpacing: "-0.035em", lineHeight: 1.15, marginBottom: 10,
                  animation: "fadeUp 0.38s 0.18s cubic-bezier(0.4,0,0.2,1) both",
                }}>
                  Marktbesuch abgeschlossen
                </div>

                {/* Market line */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginBottom: 14,
                  animation: "fadeUp 0.38s 0.24s cubic-bezier(0.4,0,0.2,1) both",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                    padding: "2px 8px", borderRadius: 20,
                    backgroundColor: cc.bg, color: cc.text,
                  }}>
                    {chain}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 400 }}>
                    {address}
                  </span>
                </div>

                {/* Time pill */}
                <div style={{
                  animation: "fadeUp 0.38s 0.3s cubic-bezier(0.4,0,0.2,1) both",
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10, fontWeight: 700, color: "#047857",
                    padding: "4px 12px", borderRadius: 20,
                    backgroundColor: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.01em",
                  }}>
                    <Clock size={9} strokeWidth={2} />
                    {vonVal} – {bisVal} · {fmtHM(timerSeconds)}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{
                display: "flex", gap: 8, marginBottom: 12,
                animation: "fadeUp 0.4s 0.44s cubic-bezier(0.4,0,0.2,1) both",
              }}>
                {/* Time */}
                <div style={{
                  flex: 1, backgroundColor: "#ffffff",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", marginBottom: 5 }}>Dauer</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {fmtHM(timerSeconds)}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {vonVal} – {bisVal}
                  </div>
                </div>
                {/* Questions */}
                <div style={{
                  flex: 1, backgroundColor: "#ffffff",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", marginBottom: 5 }}>Fragen</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: answeredCount === visibleSAMPLE_QUESTIONS.length ? "#059669" : "#DC2626", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {answeredCount}/{visibleSAMPLE_QUESTIONS.length}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 4 }}>
                    {answeredCount === visibleSAMPLE_QUESTIONS.length ? "Alle beantwortet" : "Unvollständig"}
                  </div>
                </div>
              </div>

              {/* Detail cards */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 8, marginBottom: 20,
                animation: "fadeUp 0.4s 0.52s cubic-bezier(0.4,0,0.2,1) both",
              }}>
                {/* Fragebogen */}
                <div style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <FileText size={16} strokeWidth={1.8} color={answeredCount === visibleSAMPLE_QUESTIONS.length ? "#059669" : "#DC2626"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>Fragebogen</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${fragebogenProgressPct}%`,
                        background: answeredCount === visibleSAMPLE_QUESTIONS.length
                          ? "linear-gradient(to right, #10b981, #059669)"
                          : "linear-gradient(to right, #DC2626, #e84040)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: answeredCount === visibleSAMPLE_QUESTIONS.length ? "#059669" : "#DC2626",
                    flexShrink: 0,
                  }}>
                    {answeredCount}/{visibleSAMPLE_QUESTIONS.length}
                  </span>
                </div>

                {/* Kühlerinventur */}
                <div style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Refrigerator size={16} strokeWidth={1.8} color={kuehlerAnsweredCount === visibleKUEHLER_QUESTIONS.length ? "#d97706" : "rgba(0,0,0,0.25)"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>Kühlerinventur</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${kuehlerProgressPct}%`,
                        background: visibleKUEHLER_QUESTIONS.length === 0
                          ? "linear-gradient(to right, rgba(0,0,0,0.1), rgba(0,0,0,0.1))"
                          : kuehlerAnsweredCount === visibleKUEHLER_QUESTIONS.length
                          ? "linear-gradient(to right, #F59E0B, #d97706)"
                          : "linear-gradient(to right, #fbbf24, #F59E0B)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color:
                      visibleKUEHLER_QUESTIONS.length === 0
                        ? "rgba(0,0,0,0.24)"
                        : kuehlerAnsweredCount === visibleKUEHLER_QUESTIONS.length
                          ? "#d97706"
                          : "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                  }}>
                    {visibleKUEHLER_QUESTIONS.length === 0 ? "—" : `${kuehlerAnsweredCount}/${visibleKUEHLER_QUESTIONS.length}`}
                  </span>
                </div>

                {/* MHD */}
                <div style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Thermometer size={16} strokeWidth={1.8} color={mhdAnsweredCount === visibleMHD_QUESTIONS.length ? "#7C3AED" : "rgba(0,0,0,0.25)"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>MHD-Prüfung</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${mhdProgressPct}%`,
                        background: visibleMHD_QUESTIONS.length === 0
                          ? "linear-gradient(to right, rgba(0,0,0,0.1), rgba(0,0,0,0.1))"
                          : mhdAnsweredCount === visibleMHD_QUESTIONS.length
                          ? "linear-gradient(to right, #8b5cf6, #7C3AED)"
                          : "linear-gradient(to right, #a78bfa, #8b5cf6)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color:
                      visibleMHD_QUESTIONS.length === 0
                        ? "rgba(0,0,0,0.24)"
                        : mhdAnsweredCount === visibleMHD_QUESTIONS.length
                          ? "#7C3AED"
                          : "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                  }}>
                    {visibleMHD_QUESTIONS.length === 0 ? "—" : `${mhdAnsweredCount}/${visibleMHD_QUESTIONS.length}`}
                  </span>
                </div>

                {/* Comment */}
                {comment && (
                  <div style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 14, padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <MessageSquare size={16} strokeWidth={1.8} color="rgba(0,0,0,0.28)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 3 }}>Kommentar</div>
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {comment}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div style={{ animation: "fadeUp 0.4s 0.6s cubic-bezier(0.4,0,0.2,1) both" }}>
                <button
                  onClick={() => router.push("/gm")}
                  style={{
                    width: "100%", padding: "10px 0",
                    fontSize: 12, fontWeight: 700, letterSpacing: "0.01em",
                    color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
                    background: "linear-gradient(to bottom, #10b981, #059669)",
                    boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.28), inset 0 -1px 0 rgba(255,255,255,0.12), 0 0 0 1px #047857, 0 4px 20px rgba(5,150,105,0.28)",
                    transition: "opacity 0.15s ease",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <CheckCircle2 size={14} strokeWidth={2.5} color="rgba(255,255,255,0.8)" />
                  Zurück zum Dashboard
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ── ACTIVE PHASE — root level (outside phaseVisible wrapper so position:fixed works correctly) ── */}
      {phase === "active" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2, display: "flex", flexDirection: "column" }}>
          <style>{`
            .gm-active-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(0,0,0,0.16) transparent;
            }
            .gm-active-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .gm-active-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .gm-active-scroll::-webkit-scrollbar-thumb {
              background: rgba(0,0,0,0.14);
              border-radius: 999px;
            }
            .gm-active-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(0,0,0,0.22);
            }
          `}</style>

          {/* Top bar */}
          <div style={{
            padding: "14px 16px 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <button
              onClick={() => {
                setVisitExitError(null);
                setVisitExitDialog("choice");
              }}
              style={{
                width: 28, height: 28, borderRadius: 8, border: "none",
                backgroundColor: "rgba(255,255,255,0.75)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                backdropFilter: "blur(8px)",
              }}
            >
              <ChevronLeft size={14} strokeWidth={2} color="rgba(0,0,0,0.5)" />
            </button>

            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                padding: "2px 7px", borderRadius: 5,
                backgroundColor: cc.bg, color: cc.text,
              }}>
                {chain}
              </span>
              {address && (
                <span style={{
                  fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {address}
                </span>
              )}
            </div>
          </div>

          {/* Content — fills remaining height, centers card vertically */}
          <div
            className="gm-active-scroll"
            style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "0 16px",
            paddingBottom: navOpen ? "0px" : "64px",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            transition: "padding-bottom 0.28s cubic-bezier(0.4,0,0.2,1)",
          }}
          >
            <div style={{ width: "100%", maxWidth: 480, margin: "10px auto 0", marginBottom: navOpen ? "65vh" : 12, transition: "margin-bottom 0.28s cubic-bezier(0.4,0,0.2,1)" }}>

              {/* ── FRAGEBOGEN SECTION ── */}
              {activeSection === "fragebogen" && currentQ && (
                <div>
                  {/* Section label + dot progress */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                  }}>
                    <FileText size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.4)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                      Fragebogen
                    </span>

                    {/* Step-bar */}
                    <div style={{ flex: 1, minWidth: 0, position: "relative", height: 16, display: "flex", alignItems: "center" }}>
                      {(() => {
                        const n = visibleSAMPLE_QUESTIONS.length;
                        const allAnswered = answeredCount === n;
                        const lastAnsweredIdx = visibleSAMPLE_QUESTIONS.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
                        const fillPct = n <= 1 ? 0 : (lastAnsweredIdx / (n - 1)) * 100;
                        const trackColor = allAnswered ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.08)";
                        const fillColor = allAnswered
                          ? "linear-gradient(to right, #16a34a, #22c55e)"
                          : "linear-gradient(to right, #b91c1c, #DC2626)";
                        return (
                          <>
                            <div style={{ position: "absolute", left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: trackColor, transition: "background-color 0.4s ease" }} />
                            <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 2, borderRadius: 1, background: fillColor, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.4s ease" }} />
                            {visibleSAMPLE_QUESTIONS.map((q, i) => {
                              const done = answers[q.id] !== undefined;
                              const current = i === currentQIndex;
                              const leftPct = n === 1 ? 50 : (i / (n - 1)) * 100;
                              const dotBg = allAnswered ? "#22c55e" : done ? "#DC2626" : current ? "rgba(220,38,38,0.45)" : "rgba(0,0,0,0.12)";
                              const size = current && !done ? 9 : 7;
                              return (
                                <div key={`${q.id}-${i}`} style={{
                                  position: "absolute", left: `${leftPct}%`, transform: "translateX(-50%)",
                                  width: size, height: size, borderRadius: "50%", backgroundColor: dotBg,
                                  boxShadow: done ? allAnswered ? "0 0 0 2px rgba(34,197,94,0.2)" : "0 0 0 2px rgba(220,38,38,0.15)" : current ? "0 0 0 3px rgba(220,38,38,0.12)" : "none",
                                  transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", zIndex: 1,
                                }} />
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>

                    <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
                      {answeredCount}/{visibleSAMPLE_QUESTIONS.length}
                    </span>
                  </div>

                  {/* Question card */}
                  <div style={{
                    backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    borderRadius: 14, border: "1px solid rgba(255,255,255,0.9)",
                    padding: "18px 16px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)", marginBottom: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)" }}>
                        Frage {Math.min(currentQIndex + 1, Math.max(visibleSAMPLE_QUESTIONS.length, 1))} von {visibleSAMPLE_QUESTIONS.length}
                      </div>
                      <button
                        onClick={() => setCommentOpenId(currentQ.id)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: questionComments[currentQ.id] ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.04)", transition: "all 0.15s ease", flexShrink: 0 }}
                        title={questionComments[currentQ.id] ? "Kommentar bearbeiten" : "Kommentar hinzufügen"}
                      >
                        {questionComments[currentQ.id]
                          ? <Check size={11} strokeWidth={3} color="#16a34a" />
                          : <MessageSquare size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
                        }
                      </button>
                    </div>
                    <QuestionCard
                      key={currentQ.id}
                      question={currentQ}
                      answer={currentAnswer}
                      onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
                      onPhotoSync={handlePhotoSync}
                      photoCommittedMeta={photoMetaByQuestionId[currentQ.id] ?? []}
                      photoSyncBusy={Boolean(photoSyncBusyByQuestionId[currentQ.id])}
                      photoSyncError={photoSyncErrorByQuestionId[currentQ.id] ?? null}
                      direction={direction}
                      animKey={animKey}
                      compact={navOpen}
                    />
                  </div>

                  {/* Navigation */}
                  <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                    <button onClick={goBack} disabled={currentQIndex === 0} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: currentQIndex === 0 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, color: currentQIndex === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", boxShadow: currentQIndex === 0 ? "none" : "0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s ease" }}>
                      <ChevronLeft size={12} strokeWidth={2} />
                      Zurück
                    </button>
                    <button onClick={goNext} disabled={!currentQReady} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: !currentQReady ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: !currentQReady ? "rgba(0,0,0,0.2)" : "#fff", background: !currentQReady ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: !currentQReady ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {currentQIndex < visibleSAMPLE_QUESTIONS.length - 1
                        ? "Weiter"
                        : visibleKUEHLER_QUESTIONS.length > 0
                          ? "Zur Kühlerinventur"
                          : visibleMHD_QUESTIONS.length > 0
                            ? "Zur MHD-Prüfung"
                          : "Abschließen"}
                      <ChevronRight size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── KÜHLERINVENTUR SECTION ── */}
              {activeSection === "kuehler" && (() => {
                const kQ = visibleKUEHLER_QUESTIONS[kuehlerQIndex];
                const kAns = kuehlerAnswers[kQ?.id];
                const isLast = kuehlerQIndex === visibleKUEHLER_QUESTIONS.length - 1;
                const kReady = kQ
                  ? (!kQ.required || isQuestionComplete(kQ, kAns)) && isTaggedPhotoReady(kQ, kAns)
                  : false;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Refrigerator size={11} strokeWidth={1.8} color="rgba(217,119,6,0.5)" />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(217,119,6,0.7)" }}>Kühlerinventur</span>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginLeft: "auto" }}>{Math.min(kuehlerQIndex + 1, Math.max(visibleKUEHLER_QUESTIONS.length, 1))}/{visibleKUEHLER_QUESTIONS.length}</span>
                    </div>

                    {/* Dot progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, width: "100%" }}>
                      {visibleKUEHLER_QUESTIONS.map((q, i) => {
                        const done = kuehlerAnswers[q.id] !== undefined;
                        const active = i === kuehlerQIndex;
                        const isLastDot = i === visibleKUEHLER_QUESTIONS.length - 1;
                        return (
                          <div key={`${q.id}-${i}`} style={{ display: "flex", alignItems: "center", flex: isLastDot ? "0 0 auto" : 1, minWidth: 0 }}>
                            <div style={{
                              width: active ? 7 : 6, height: active ? 7 : 6, borderRadius: "50%", flexShrink: 0,
                              backgroundColor: done ? "#d97706" : active ? "#fbbf24" : "rgba(217,119,6,0.18)",
                              transition: "all 0.25s ease",
                              boxShadow: active ? "0 0 0 2px rgba(217,119,6,0.18)" : "none",
                            }} />
                            {!isLastDot && (
                              <div style={{ flex: 1, height: 1.5, minWidth: 4, background: done ? "linear-gradient(to right, #d97706, #fbbf24)" : "rgba(217,119,6,0.12)", transition: "background 0.4s ease" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.9)", padding: "18px 16px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)", marginBottom: 10, animation: "questionIn 0.2s cubic-bezier(0.4,0,0.2,1) both" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(217,119,6,0.4)" }}>
                          Frage {Math.min(kuehlerQIndex + 1, Math.max(visibleKUEHLER_QUESTIONS.length, 1))} von {visibleKUEHLER_QUESTIONS.length}
                        </div>
                        <button
                          onClick={() => kQ && setCommentOpenId(kQ.id)}
                          style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: kQ && questionComments[kQ.id] ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.04)", transition: "all 0.15s ease", flexShrink: 0 }}
                        >
                          {kQ && questionComments[kQ.id]
                            ? <Check size={11} strokeWidth={3} color="#16a34a" />
                            : <MessageSquare size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
                          }
                        </button>
                      </div>
                      {kQ && (
                        <QuestionCard
                          key={kQ.id}
                          question={kQ}
                          answer={kAns}
                          onAnswer={(val) => setKuehlerAnswers((prev) => ({ ...prev, [kQ.id]: val }))}
                          onPhotoSync={handlePhotoSync}
                          photoCommittedMeta={photoMetaByQuestionId[kQ.id] ?? []}
                          photoSyncBusy={Boolean(photoSyncBusyByQuestionId[kQ.id])}
                          photoSyncError={photoSyncErrorByQuestionId[kQ.id] ?? null}
                          direction={direction}
                          animKey={animKey}
                          compact={navOpen}
                        />
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                      <button onClick={goBack} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", boxShadow: "0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronLeft size={12} strokeWidth={2} />
                        Zurück
                      </button>
                      <button
                        onClick={() => {
                          if (!kReady) return;
                          if (!isLast) { setKuehlerQIndex((i) => i + 1); }
                          else if (visibleMHD_QUESTIONS.length > 0) { setActiveSection("mhd"); setMhdQIndex(0); setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]); }
                          else { handleAbschluss(); }
                        }}
                        disabled={!kReady}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: !kReady ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: !kReady ? "rgba(0,0,0,0.2)" : "#fff", background: !kReady ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #F59E0B, #d97706)", boxShadow: !kReady ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #b45309, 0 1px 6px rgba(180,100,0,0.16)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        {isLast ? (visibleMHD_QUESTIONS.length > 0 ? "Weiter zu MHD" : "Abschließen") : "Weiter"}
                        <ChevronRight size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── MHD SECTION ── */}
              {activeSection === "mhd" && (() => {
                const mhdQ = visibleMHD_QUESTIONS[mhdQIndex];
                const mhdAns = mhdAnswers[mhdQ?.id];
                const isLast = mhdQIndex === visibleMHD_QUESTIONS.length - 1;
                const mhdReady = mhdQ
                  ? (!mhdQ.required || isQuestionComplete(mhdQ, mhdAns)) && isTaggedPhotoReady(mhdQ, mhdAns)
                  : false;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Thermometer size={11} strokeWidth={1.8} color="rgba(124,58,237,0.5)" />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(124,58,237,0.7)" }}>MHD-Prüfung</span>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginLeft: "auto" }}>{Math.min(mhdQIndex + 1, Math.max(visibleMHD_QUESTIONS.length, 1))}/{visibleMHD_QUESTIONS.length}</span>
                    </div>

                    {/* Dot progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, width: "100%" }}>
                      {visibleMHD_QUESTIONS.map((q, i) => {
                        const done = mhdAnswers[q.id] !== undefined;
                        const active = i === mhdQIndex;
                        const isFirst = i === 0;
                        const isLastDot = i === visibleMHD_QUESTIONS.length - 1;
                        return (
                          <div key={`${q.id}-${i}`} style={{ display: "flex", alignItems: "center", flex: isLastDot ? "0 0 auto" : 1, minWidth: 0 }}>
                            <div style={{
                              width: active ? 7 : 6, height: active ? 7 : 6,
                              borderRadius: "50%", flexShrink: 0,
                              backgroundColor: done ? "#7C3AED" : active ? "#a78bfa" : "rgba(124,58,237,0.18)",
                              transition: "all 0.25s ease",
                              boxShadow: active ? "0 0 0 2px rgba(124,58,237,0.18)" : "none",
                            }} />
                            {!isLastDot && (
                              <div style={{
                                flex: 1, height: 1.5, minWidth: 4,
                                background: done ? "linear-gradient(to right, #7C3AED, #a78bfa)" : "rgba(124,58,237,0.12)",
                                transition: "background 0.4s ease",
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ backgroundColor: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.9)", padding: "18px 16px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04)", marginBottom: 10, animation: "questionIn 0.2s cubic-bezier(0.4,0,0.2,1) both" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(124,58,237,0.4)" }}>
                          Frage {Math.min(mhdQIndex + 1, Math.max(visibleMHD_QUESTIONS.length, 1))} von {visibleMHD_QUESTIONS.length}
                        </div>
                        <button
                          onClick={() => mhdQ && setCommentOpenId(mhdQ.id)}
                          style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: mhdQ && questionComments[mhdQ.id] ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.04)", transition: "all 0.15s ease", flexShrink: 0 }}
                        >
                          {mhdQ && questionComments[mhdQ.id]
                            ? <Check size={11} strokeWidth={3} color="#16a34a" />
                            : <MessageSquare size={11} strokeWidth={1.8} color="rgba(0,0,0,0.3)" />
                          }
                        </button>
                      </div>
                      {mhdQ && (
                        <QuestionCard
                          key={mhdQ.id}
                          question={mhdQ}
                          answer={mhdAns}
                          onAnswer={(val) => setMhdAnswers((prev) => ({ ...prev, [mhdQ.id]: val }))}
                          onPhotoSync={handlePhotoSync}
                          photoCommittedMeta={photoMetaByQuestionId[mhdQ.id] ?? []}
                          photoSyncBusy={Boolean(photoSyncBusyByQuestionId[mhdQ.id])}
                          photoSyncError={photoSyncErrorByQuestionId[mhdQ.id] ?? null}
                          direction={direction}
                          animKey={animKey}
                          compact={navOpen}
                        />
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                      <button onClick={goBack} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", boxShadow: "0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronLeft size={12} strokeWidth={2} />
                        Zurück
                      </button>
                      <button
                        onClick={() => {
                          if (!mhdReady) return;
                          if (!isLast) {
                            setMhdQIndex((i) => i + 1);
                          } else {
                            handleAbschluss();
                          }
                        }}
                        disabled={!mhdReady}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: !mhdReady ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: !mhdReady ? "rgba(0,0,0,0.2)" : "#fff", background: !mhdReady ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #8b5cf6, #7C3AED)", boxShadow: !mhdReady ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #6d28d9, 0 1px 6px rgba(109,40,217,0.2)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        {isLast ? "Abschließen" : "Weiter"}
                        <ChevronRight size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>

        </div>
      )}

      {visitExitDialog && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (visitExitBusy) return;
            if (event.target === event.currentTarget) {
              setVisitExitDialog(null);
              setVisitExitError(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(15,23,42,0.18)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={visitExitDialog === "choice" ? "Fragebogen später fortsetzen" : "Fragebogen abbrechen bestätigen"}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(360px, calc(100vw - 36px))",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.06)",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 18px 42px rgba(15,23,42,0.10)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            {visitExitDialog === "choice" ? (
              <>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 750, color: "#1a1a1a", lineHeight: 1.2 }}>
                    Fragebogen später fortsetzen?
                  </div>
                  <div style={{ marginTop: 7, fontSize: 10, fontWeight: 450, color: "rgba(0,0,0,0.46)", lineHeight: 1.5 }}>
                    Deine bisherigen Antworten werden gespeichert. Der Marktbesuch bleibt ohne Endzeit offen und kann später über den aktiven Fragebogen wieder geöffnet werden.
                  </div>
                </div>

                {visitExitError && (
                  <div style={{ borderRadius: 10, border: "1px solid rgba(185,28,28,0.22)", background: "rgba(185,28,28,0.07)", color: "#991b1b", padding: "8px 10px", fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>
                    {visitExitError}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void handleContinueVisitLater()}
                    disabled={visitExitBusy}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 7,
                      padding: "8px 12px",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      cursor: visitExitBusy ? "not-allowed" : "pointer",
                      opacity: visitExitBusy ? 0.72 : 1,
                      background: visitExitBusy ? "rgba(0,0,0,0.10)" : "linear-gradient(to bottom, #059669, #0cb880)",
                      boxShadow: visitExitBusy
                        ? "none"
                        : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                      fontFamily: "inherit",
                    }}
                  >
                    {visitExitBusy ? "Speichere..." : "Später fortsetzen"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (visitExitBusy) return;
                      setVisitExitError(null);
                      setVisitExitDialog("abort-confirm");
                    }}
                    disabled={visitExitBusy}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 7,
                      padding: "8px 12px",
                      color: "rgba(180,60,60,0.72)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      cursor: visitExitBusy ? "not-allowed" : "pointer",
                      background: "rgba(220,38,38,0.06)",
                      boxShadow: "0 0 0 0.5px rgba(220,38,38,0.12)",
                      fontFamily: "inherit",
                    }}
                  >
                    Fragebogen abbrechen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 750, color: "#1a1a1a", lineHeight: 1.2 }}>
                    Wirklich abbrechen?
                  </div>
                  <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid rgba(185,28,28,0.18)", background: "rgba(185,28,28,0.06)", color: "#7f1d1d", padding: "9px 10px", fontSize: 10, fontWeight: 650, lineHeight: 1.45 }}>
                    Alle Daten aus diesem Lauf werden gelöscht. Antworten, Fotos und Fortschritt werden verworfen und der Fragebogen kann danach nicht weitergeführt werden.
                  </div>
                </div>

                {visitExitError && (
                  <div style={{ borderRadius: 10, border: "1px solid rgba(185,28,28,0.22)", background: "rgba(185,28,28,0.07)", color: "#991b1b", padding: "8px 10px", fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>
                    {visitExitError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (visitExitBusy) return;
                      setVisitExitError(null);
                      setVisitExitDialog("choice");
                    }}
                    disabled={visitExitBusy}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: 7,
                      padding: "8px 10px",
                      color: "rgba(0,0,0,0.48)",
                      fontSize: 10,
                      fontWeight: 650,
                      cursor: visitExitBusy ? "not-allowed" : "pointer",
                      background: "rgba(0,0,0,0.04)",
                      boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)",
                      fontFamily: "inherit",
                    }}
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmAbortVisit()}
                    disabled={visitExitBusy}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: 7,
                      padding: "8px 10px",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      cursor: visitExitBusy ? "not-allowed" : "pointer",
                      opacity: visitExitBusy ? 0.72 : 1,
                      background: visitExitBusy ? "rgba(0,0,0,0.10)" : "linear-gradient(to bottom, #DC2626, #b91c1c)",
                      boxShadow: visitExitBusy
                        ? "none"
                        : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                      fontFamily: "inherit",
                    }}
                  >
                    {visitExitBusy ? "Breche ab..." : "Endgültig abbrechen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Comment modal */}
      {commentOpenId && (
        <CommentModal
          questionId={commentOpenId}
          existingComment={questionComments[commentOpenId] || ""}
          accentColor={
            activeSection === "kuehler" ? "#d97706" :
            activeSection === "mhd"    ? "#7C3AED" :
            "#DC2626"
          }
          onSave={(id, text) => setQuestionComments((p) => ({ ...p, [id]: text }))}
          onClose={() => setCommentOpenId(null)}
        />
      )}

      {/* ClockPicker overlay */}
      {clockTarget && (
        <ClockPicker
          onSelect={(h, m) => {
            const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            if (clockTarget === "von") setVonVal(val);
            else setBisVal(val);
            setManualTimeEdited(true);
            setClockTarget(null);
          }}
          onCancel={() => setClockTarget(null)}
          initialHour={parseInt((clockTarget === "von" ? vonVal : bisVal).split(":")[0] || "8", 10)}
          initialMinute={parseInt((clockTarget === "von" ? vonVal : bisVal).split(":")[1] || "0", 10)}
        />
      )}

      {/* ── ABSCHLUSS PHASE — root level ── */}
      {phase === "abschluss" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center" }}>
            <button onClick={() => transitionTo("active")} style={{ width: 28, height: 28, borderRadius: 8, border: "none", backgroundColor: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", backdropFilter: "blur(8px)" }}>
              <ChevronLeft size={14} strokeWidth={2} color="rgba(0,0,0,0.5)" />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px 24px" }}>
            <div style={{ width: "100%", maxWidth: 480, margin: "auto" }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 4 }}>Abschließen</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", lineHeight: 1.5 }}>Zeiten prüfen, Kommentar hinterlassen.</div>
              </div>
              <div style={{ backgroundColor: "rgba(255,255,255,0.72)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03)", padding: "16px 16px 14px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.25)", marginBottom: 3 }}>Gesamtzeit</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#DC2626", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", lineHeight: 1 }}>{fmtTime(timerSeconds)}</div>
                  </div>
                  {timerRunning && !timerStopped && (
                    <button onClick={() => setTimerStopped(true)} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.8)" }} />
                      Stoppen
                    </button>
                  )}
                  {timerStopped && <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.25)", padding: "3px 10px", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.04)" }}>Gestoppt</span>}
                </div>
                <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 12 }} />
                {(["von", "bis"] as const).map((field) => {
                  const val = field === "von" ? vonVal : bisVal;
                  const setVal = field === "von" ? setVonVal : setBisVal;
                  const label = field === "von" ? "Start" : "Ende";
                  const labelColor = field === "von" ? "#16a34a" : "#DC2626";
                  return (
                    <div key={field} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: field === "von" ? 8 : 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: labelColor, width: 36, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            setVal(formatTimeInput(e.target.value));
                            setManualTimeEdited(true);
                          }}
                          placeholder="HH:MM"
                          maxLength={5}
                          style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1a1a1a", background: "none", border: "none", outline: "none", fontVariantNumeric: "tabular-nums" }}
                        />
                        <button onClick={() => setClockTarget(field)} style={{ width: 22, height: 22, borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Clock size={11} strokeWidth={1.8} color="rgba(0,0,0,0.25)" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ backgroundColor: "rgba(255,255,255,0.72)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03)", padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <MessageSquare size={10} strokeWidth={1.8} color="rgba(0,0,0,0.25)" />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.3)", letterSpacing: "0.02em" }}>Kommentar (optional)</span>
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anmerkungen zum Marktbesuch..." rows={2} style={{ width: "100%", resize: "none", border: "none", outline: "none", fontSize: 11, color: "#1a1a1a", lineHeight: 1.6, background: "transparent", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {submitSessionError && (
                <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>{submitSessionError}</div>
              )}
              <button
                onClick={() => {
                  if (!isSubmittingSession) void handleSubmitVisit();
                }}
                disabled={isSubmittingSession}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  cursor: isSubmittingSession ? "not-allowed" : "pointer",
                  opacity: isSubmittingSession ? 0.75 : 1,
                  background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSubmittingSession) e.currentTarget.style.opacity = "0.88";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = isSubmittingSession ? "0.75" : "1";
                }}
              >
                {isSubmittingSession ? "Speichert..." : "Beenden"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent bottom flap + expandable navigator — root level */}
      {phase === "active" && (
        <>
          {/* Collapsed flap — always visible at bottom */}
          <div
            onClick={() => setNavOpen(true)}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              zIndex: navOpen ? 90 : 50,
              pointerEvents: navOpen ? "none" : "auto",
              opacity: navOpen ? 0 : 1,
              transform: navOpen ? "translateY(8px)" : "translateY(0)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              cursor: "pointer",
            }}
          >
            <div style={{
              backgroundColor: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "14px 14px 0 0",
              border: "1px solid rgba(255,255,255,0.9)",
              borderBottom: "none",
              boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
              padding: "10px 16px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {/* Handle */}
              <div style={{
                position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)",
                width: 28, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.1)",
              }} />

              {/* Section label */}
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: activeSection === "kuehler" ? "#d97706" : activeSection === "mhd" ? "#7C3AED" : "#DC2626",
                letterSpacing: "-0.01em", whiteSpace: "nowrap",
              }}>
                {activeSection === "kuehler" ? "Kühlerinventur" : activeSection === "mhd" ? "MHD-Prüfung" : "Fragebogen"}
              </div>

              {/* Separator */}
              <div style={{ width: 1, height: 14, backgroundColor: "rgba(0,0,0,0.08)", flexShrink: 0 }} />

              {/* Active question text */}
              <div style={{
                flex: 1, minWidth: 0,
                fontSize: 10, fontWeight: 400, color: "rgba(0,0,0,0.4)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {activeSection === "kuehler"
                  ? (kuehlerAnsweredCount === visibleKUEHLER_QUESTIONS.length ? "Abgeschlossen" : `${Math.min(kuehlerQIndex + 1, Math.max(visibleKUEHLER_QUESTIONS.length, 1))}/${visibleKUEHLER_QUESTIONS.length} — ${visibleKUEHLER_QUESTIONS[kuehlerQIndex]?.text || ""}`)
                  : activeSection === "mhd"
                  ? (mhdAnsweredCount === visibleMHD_QUESTIONS.length ? "Abgeschlossen" : `${Math.min(mhdQIndex + 1, Math.max(visibleMHD_QUESTIONS.length, 1))}/${visibleMHD_QUESTIONS.length} — ${visibleMHD_QUESTIONS[mhdQIndex]?.text || ""}`)
                  : `${Math.min(currentQIndex + 1, Math.max(visibleSAMPLE_QUESTIONS.length, 1))}/${visibleSAMPLE_QUESTIONS.length} — ${visibleSAMPLE_QUESTIONS[currentQIndex]?.text || ""}`
                }
              </div>

              {/* Timer */}
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  backgroundColor: timerRunning ? "#DC2626" : "rgba(0,0,0,0.15)",
                  animation: timerRunning ? "pulse 1.5s infinite" : "none",
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#DC2626",
                  fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
                }}>
                  {fmtTime(timerSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Expanded sheet */}
          <JumpNavigator
            questions={visibleSAMPLE_QUESTIONS}
            mhdQuestions={visibleMHD_QUESTIONS}
            mhdAnswers={mhdAnswers}
            kuehlerQuestions={visibleKUEHLER_QUESTIONS}
            kuehlerAnswers={kuehlerAnswers}
            answers={answers}
            currentIndex={currentQIndex}
            currentKuehlerIndex={kuehlerQIndex}
            currentMhdIndex={mhdQIndex}
            onJump={jumpTo}
            onJumpKuehler={jumpToKuehler}
            onJumpMhd={jumpToMhd}
            onClose={() => setNavOpen(false)}
            isOpen={navOpen}
            flashSections={flashSections}
            flashModules={flashModules}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export with Suspense for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────

export default function MarktbesuchPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", backgroundColor: "#f5f5f7",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #DC2626", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <MarktbesuchInner />
    </Suspense>
  );
}
