"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Camera, FileText } from "lucide-react";
import Aurora from "@/components/ui/Aurora";

// ── Mock data ─────────────────────────────────────────────────

const CAMPAIGNS = [
  // ── Aktiv ─────────────────────────────────────────────────
  {
    id: "1",
    name: "Standartbesuch KW12",
    type: "standart",
    color: "#DC2626",
    inactive: false,
    period: "17.03 – 23.03.2026",
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
    period: "01.04 – 30.04.2026",
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
    period: "01.03 – 31.03.2026",
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
    period: "10.03 – 16.03.2026",
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
    period: "01.03 – 30.06.2026",
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
    period: "17.02 – 23.02.2026",
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
    period: "01.03 – 31.03.2026",
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
    period: "01.02 – 28.02.2026",
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

// ── Mock Fragebogen per section type ─────────────────────────

interface MockFragebogen {
  id: string;
  name: string;
  modules: number;
  questions: number;
  active: boolean;
}

const MOCK_FRAGEBOGEN: Record<string, MockFragebogen[]> = {
  standart: [
    { id: "sf1", name: "Standartbesuch KW12", modules: 3, questions: 67, active: true },
    { id: "sf2", name: "Standartbesuch V2", modules: 4, questions: 82, active: false },
    { id: "sf3", name: "Standartbesuch Basis", modules: 2, questions: 34, active: false },
    { id: "sf4", name: "Standartbesuch Erweitert", modules: 5, questions: 95, active: false },
    { id: "sf5", name: "Standartbesuch KW08", modules: 3, questions: 67, active: false },
    { id: "sf6", name: "Standartbesuch Kompakt", modules: 2, questions: 28, active: false },
    { id: "sf7", name: "Standartbesuch Premium", modules: 6, questions: 110, active: false },
    { id: "sf8", name: "Standartbesuch Q1 2026", modules: 4, questions: 74, active: false },
  ],
  flex: [
    { id: "ff1", name: "Flexbesuch April", modules: 3, questions: 42, active: true },
    { id: "ff2", name: "Flexbesuch Sommer", modules: 2, questions: 28, active: false },
    { id: "ff3", name: "Flexbesuch Kompakt", modules: 1, questions: 15, active: false },
    { id: "ff4", name: "Flexbesuch Basis", modules: 2, questions: 22, active: false },
    { id: "ff5", name: "Flexbesuch Erweitert", modules: 4, questions: 55, active: false },
    { id: "ff6", name: "Flexbesuch Q2 2026", modules: 3, questions: 38, active: false },
  ],
  kuehler: [
    { id: "kf1", name: "Kühlerinventur Standard", modules: 3, questions: 6, active: true },
    { id: "kf2", name: "Kühlerinventur Detailliert", modules: 4, questions: 12, active: false },
    { id: "kf3", name: "Kühlerinventur Express", modules: 2, questions: 4, active: false },
    { id: "kf4", name: "Kühlerinventur Premium", modules: 5, questions: 18, active: false },
    { id: "kf5", name: "Kühlerinventur Kompakt", modules: 2, questions: 5, active: false },
    { id: "kf6", name: "Kühlerinventur Q1 2026", modules: 3, questions: 8, active: false },
  ],
  mhd: [
    { id: "mf1", name: "MHD Kontrolle Standard", modules: 3, questions: 7, active: true },
    { id: "mf2", name: "MHD Kontrolle Erweitert", modules: 4, questions: 14, active: false },
    { id: "mf3", name: "MHD Kontrolle Schnell", modules: 2, questions: 5, active: false },
    { id: "mf4", name: "MHD Kontrolle Detailliert", modules: 5, questions: 20, active: false },
    { id: "mf5", name: "MHD Kontrolle Basis", modules: 2, questions: 6, active: false },
    { id: "mf6", name: "MHD Q1 2026", modules: 3, questions: 9, active: false },
  ],
  billa: [
    { id: "bf1", name: "Billa Frühjahr 2026", modules: 4, questions: 8, active: true },
    { id: "bf2", name: "Billa Sommer Aktion", modules: 3, questions: 10, active: false },
    { id: "bf3", name: "Billa Standard Check", modules: 2, questions: 6, active: false },
    { id: "bf4", name: "Billa Premium Audit", modules: 5, questions: 16, active: false },
    { id: "bf5", name: "Billa Kompakt", modules: 2, questions: 5, active: false },
    { id: "bf6", name: "Billa Q2 2026", modules: 3, questions: 11, active: false },
    { id: "bf7", name: "Billa Erweitert", modules: 6, questions: 22, active: false },
  ],
};

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

// ── Heatmap aggregate mock data (Standart) ──────────────────

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

// ── FragebogenVorschau container (Standart, red-themed) ──────

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

  const currentQ = questions[currentQIndex];
  const currentAnswer = answers[currentQ?.id];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;

  const goNext = () => {
    if (currentQIndex < questions.length - 1) {
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
              const n = questions.length;
              const lastIdx = questions.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
              const fillPct = n <= 1 ? 0 : (lastIdx / (n - 1)) * 100;
              const tColor = allAnswered ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.08)";
              const fColor = allAnswered ? "linear-gradient(to right, #16a34a, #22c55e)" : `linear-gradient(to right, #b91c1c, ${accentColor})`;
              return (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, borderRadius: 1, backgroundColor: tColor }} />
                  <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 1.5, borderRadius: 1, background: fColor, transition: "width 0.35s ease" }} />
                  {questions.map((q, i) => {
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

          <span style={{ fontSize: 6.5, fontWeight: 600, color: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{answeredCount}/{questions.length}</span>
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
            Frage {currentQIndex + 1} von {questions.length}
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
          {currentQIndex < questions.length - 1 ? "Weiter" : "Abschließen"}
          <ChevronRight size={8} strokeWidth={2.5} />
        </button>
        </div>
      </div>
    </div>
  );
}

// ── Fragebogen Switcher Overlay ───────────────────────────────

function FragebogenSwitcher({ campaignType, campaignColor }: { campaignType: string; campaignColor: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const list = MOCK_FRAGEBOGEN[campaignType] || MOCK_FRAGEBOGEN["standart"];
  const [activeId, setActiveId] = useState(() => list.find((f) => f.active)?.id || list[0].id);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ROW_H = 62; // px per row (padding 13+13 + ~32 content + 4 margin)
  const VISIBLE = 5;

  const getOrderedList = (q: string) => {
    const activeFbItem = list.find((f) => f.id === activeId) || list[0];
    const others = list.filter((f) => f.id !== activeId && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
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

  const activeFb = list.find((f) => f.id === activeId) || list[0];

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

  const confirmSwitch = () => {
    if (pendingSwitch) { setActiveId(pendingSwitch); setPendingSwitch(null); close(); }
  };

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
        onClick={() => { if (!isExpanded) { setIsExpanded(true); setIsHovered(false); } }}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 10,
          background: `linear-gradient(135deg, ${accentRgba(0.06)} 0%, ${accentRgba(0.03)} 100%)`,
          border: `1px solid ${isHovered && !isExpanded ? accentRgba(0.35) : accentRgba(0.15)}`,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
          cursor: isExpanded ? "default" : "pointer",
          transform: isHovered && !isExpanded ? "scale(1.015)" : "scale(1)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.22s ease, box-shadow 0.22s ease, opacity 0.15s ease",
          boxShadow: isHovered && !isExpanded ? `0 0 0 3px ${accentRgba(0.08)}, 0 4px 12px ${accentRgba(0.1)}` : "none",
          position: "relative", zIndex: isExpanded ? 51 : 1,
          opacity: isExpanded ? 0 : 1, pointerEvents: isExpanded ? "none" : "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{activeFb.name}</span>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a", flexShrink: 0, boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 500, color: accentRgba(0.5), letterSpacing: "0.02em" }}>{activeFb.modules} Module</span>
          <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: accentRgba(0.25) }} />
          <span style={{ fontSize: 9, fontWeight: 500, color: accentRgba(0.5), letterSpacing: "0.02em" }}>{activeFb.questions} Fragen</span>
        </div>
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
                  <button onClick={confirmSwitch} style={{
                    flex: 1, padding: "6px 10px", borderRadius: 8, border: "none",
                    background: `linear-gradient(to bottom, color-mix(in srgb, ${campaignColor} 70%, white), ${campaignColor})`,
                    cursor: "pointer",
                    fontSize: 9, fontWeight: 600, color: "#fff",
                    boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${campaignColor}, 0 1px 6px ${accentRgba(0.27)}`,
                    transition: "all 0.15s ease",
                  }}>Bestätigen</button>
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
  standart: {
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

function AnswerYesNo({ answer, color }: { answer: string; color: string }) {
  const isJa = answer === "Ja" || answer === "ja";
  const hex = color.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);
  return (
    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
      {["Ja", "Nein"].map((opt) => {
        const sel = isJa ? opt === "Ja" : opt === "Nein";
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

function AnswerSlider({ answer, config }: { answer: string; config: PreviewQuestion["config"] }) {
  const val = parseFloat(answer);
  const min = config?.min || 0;
  const max = config?.max || 100;
  const pct = Math.round(((val - min) / (max - min)) * 100);
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(to right, #DC2626, #b91c1c)" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", minWidth: 36, textAlign: "right" }}>{answer}{config?.unit || ""}</span>
    </div>
  );
}

function AnswerPhoto({ answer }: { answer: string[] }) {
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
        {isReal(answer[lightbox]) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={answer[lightbox]} alt="" style={{ maxWidth: "88vw", maxHeight: "78vh", borderRadius: 14, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", display: "block" }} />
        ) : (
          <div style={{ width: 320, height: 240, borderRadius: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Camera size={32} strokeWidth={1.5} color="rgba(255,255,255,0.35)" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{getFileName(answer[lightbox], lightbox)}</span>
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
          const src = answer[i];
          const name = getFileName(src, i);
          const real = isReal(src);
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
              {/* Hover preview */}
              {hovered === i && real && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                  zIndex: 9999, borderRadius: 9, overflow: "hidden",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.2)", border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fff", padding: 3, pointerEvents: "none",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 7, display: "block" }} />
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

function AnswerMatrix({ answer, config, color }: { answer: string[]; config: PreviewQuestion["config"]; color: string }) {
  const rows = config?.rows || [];
  const cols = config?.columns || [];
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
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
                const sel = answer.includes(key);
                return (
                  <td key={col} style={{ textAlign: "center", padding: "2px" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, margin: "0 auto",
                      background: sel ? `rgba(${r},${g},${b},0.10)` : "rgba(0,0,0,0.03)",
                      boxShadow: sel ? `inset 0 0 0 1.5px rgba(${r},${g},${b},0.4)` : "inset 0 0 0 1px rgba(0,0,0,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {sel && <span style={{ fontSize: 9, fontWeight: 700, color, lineHeight: 1 }}>✓</span>}
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

function MarketVisitDetail({
  market,
  campaignType,
  campaignColor,
  onClose,
}: {
  market: typeof MOCK_MARKETS[0];
  campaignType: string;
  campaignColor: string;
  onClose: () => void;
}) {
  const meta = MOCK_MARKET_META[market.id];
  const answers = MOCK_MARKET_ANSWERS[campaignType] || {};
  const questions: PreviewQuestion[] =
    campaignType === "flex" ? FLEX_PREVIEW_QUESTIONS :
    campaignType === "kuehler" ? KUEHLER_PREVIEW_QUESTIONS :
    campaignType === "mhd" ? MHD_PREVIEW_QUESTIONS :
    campaignType === "billa" ? BILLA_PREVIEW_QUESTIONS :
    PREVIEW_QUESTIONS;

  const showIPP = ["standart", "flex", "billa"].includes(campaignType);
  const ipp = showIPP ? computeIPP(answers, questions) : null;

  const visitDate = meta ? new Date(meta.visitedAt).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const visitTime = meta ? new Date(meta.visitedAt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }) : "—";

  const hex = campaignColor.replace("#", "");
  const cr = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const cb = parseInt(hex.substring(4, 6), 16);

  // Group questions by module
  const modules: { id: string; name: string; questions: PreviewQuestion[] }[] = [];
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

  const renderAnswer = (q: PreviewQuestion) => {
    const raw = answers[q.id];
    if (raw === undefined) return <p style={{ margin: "6px 0 0", fontSize: 10, color: "rgba(0,0,0,0.3)", fontStyle: "italic" }}>Keine Antwort</p>;
    switch (q.type) {
      case "yesno": return <AnswerYesNo answer={raw as string} color={campaignColor} />;
      case "single": return <AnswerSingle answer={raw as string} options={q.options || []} color={campaignColor} />;
      case "multiple": return <AnswerMultiple answer={Array.isArray(raw) ? raw : []} options={q.options || []} color={campaignColor} />;
      case "yesnomulti": return <AnswerYesNoMulti answer={raw as string} color={campaignColor} config={q.config} />;
      case "likert": return <AnswerLikert answer={raw as string} config={q.config} />;
      case "text": return <AnswerText answer={raw as string} />;
      case "numeric": return <AnswerNumeric answer={raw as string} config={q.config} />;
      case "slider": return <AnswerSlider answer={raw as string} config={q.config} />;
      case "photo": return <AnswerPhoto answer={Array.isArray(raw) ? raw : [raw as string]} />;
      case "matrix": return <AnswerMatrix answer={Array.isArray(raw) ? raw : []} config={q.config} color={campaignColor} />;
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
        {meta && (
          <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
            {showIPP && ipp !== null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>IPP</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>{(ipp / 10).toFixed(1)}</div>
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Fragen</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{Object.keys(answers).length}/{questions.length}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Besuch</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{visitDate} · {visitTime}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>Dauer</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{meta.duration} Min</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>GM</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{meta.gm}</div>
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
        {modules.map((mod, modIdx) => (
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
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.45, flex: 1 }}>
                      {q.text}
                      {q.required && <span style={{ color: campaignColor, marginLeft: 3, fontSize: 9 }}>*</span>}
                    </p>
                  </div>
                  <div style={{ paddingLeft: 22 }}>
                    {renderAnswer(q)}
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
        backgroundColor: selected ? `${campaign.color}0d` : "transparent",
        borderLeft: selected ? `2px solid ${campaign.color}` : "2px solid transparent",
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

function MarketRow({ market, onClick }: { market: typeof MOCK_MARKETS[0]; onClick?: () => void }) {
  const clickable = market.finished && !!onClick;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 14px",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        gap: 10,
        cursor: clickable ? "pointer" : "default",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={(e) => { if (clickable) e.currentTarget.style.background = "transparent"; }}
    >
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
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [extraCampaigns, setExtraCampaigns] = useState<typeof CAMPAIGNS>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);

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

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {"period" in campaign && (
                <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(0,0,0,0.35)", letterSpacing: "0" }}>{(campaign as typeof campaign & { period: string }).period}</span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, letterSpacing: "0.01em",
                backgroundColor: !campaign.inactive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
                color: !campaign.inactive ? "#16a34a" : "#DC2626",
              }}>
                {!campaign.inactive ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
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

            {/* Fragebogen assigned card — interactive switcher */}
            <FragebogenSwitcher key={campaign.type} campaignType={campaign.type} campaignColor={campaign.color} />

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
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Regionen</span>
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 14 }} />
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Fragebogen Vorschau</span>
            <button
              onClick={() => setShowHeatmap((h) => !h)}
              style={{
                fontSize: 8, fontWeight: 600, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                color: showHeatmap ? "#DC2626" : "rgba(0,0,0,0.35)",
                background: showHeatmap ? "rgba(220,38,38,0.08)" : "transparent",
                border: showHeatmap ? "1px solid rgba(220,38,38,0.2)" : "1px solid transparent",
                letterSpacing: "0.01em", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { if (!showHeatmap) e.currentTarget.style.color = "rgba(0,0,0,0.55)"; }}
              onMouseLeave={(e) => { if (!showHeatmap) e.currentTarget.style.color = "rgba(0,0,0,0.35)"; }}
            >Antworten anzeigen</button>
          </div>
          {campaign.type === "flex"
            ? <FlexFragebogenVorschau key="flex" showHeatmap={showHeatmap} />
            : campaign.type === "kuehler"
            ? <KuehlerFragebogenVorschau key="kuehler" showHeatmap={showHeatmap} />
            : campaign.type === "mhd"
            ? <MhdFragebogenVorschau key="mhd" showHeatmap={showHeatmap} />
            : campaign.type === "billa"
            ? <BillaFragebogenVorschau key="billa" showHeatmap={showHeatmap} />
            : <FragebogenVorschau key="standart" showHeatmap={showHeatmap} />
          }
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
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 3 }}>
            {(["all", "finished", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMarketFilter(f)}
                style={{
                  padding: "5px 12px", fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "none",
                  backgroundColor: marketFilter === f ? "#fff" : "transparent",
                  color: marketFilter === f ? "#1a1a1a" : "rgba(0,0,0,0.4)",
                  boxShadow: marketFilter === f ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                {f === "all" ? `Alle (${MOCK_MARKETS.length})` : f === "finished" ? `Abgeschlossen (${finishedCount})` : `Ausstehend (${pendingCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Market list */}
        <div style={{ position: "relative" }}>
          {filteredMarkets.map((m) => (
            <MarketRow key={m.id} market={m} onClick={m.finished ? () => setSelectedMarket(m.id) : undefined} />
          ))}
          {selectedMarket && (() => {
            const m = MOCK_MARKETS.find((x) => x.id === selectedMarket);
            if (!m) return null;
            return (
              <MarketVisitDetail
                market={m}
                campaignType={campaign.type}
                campaignColor={campaign.color}
                onClose={() => setSelectedMarket(null)}
              />
            );
          })()}
        </div>
      </div>

    </div>
  );
}
