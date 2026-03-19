"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
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
  type: "yesno" | "single" | "multiple" | "yesnomulti" | "text" | "numeric" | "likert" | "slider" | "photo" | "matrix";
  text: string;
  options?: string[];
  required: boolean;
  moduleId: string;
  moduleName: string;
  imageUrl?: string;
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
    // matrix
    rows?: string[]; columns?: string[];
    // yesnomulti
    answers?: string[];
    branches?: { answer: string; options: string[] }[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — 5 questions for the first draft
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_QUESTIONS: SampleQuestion[] = [
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
    required: false,
    moduleId: "m5",
    moduleName: "Dokumentation",
    config: { instruction: "Bitte das gesamte Coke-Regal von vorne fotografieren." },
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
];

const MHD_QUESTIONS: SampleQuestion[] = [
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
];

const KUEHLER_QUESTIONS: SampleQuestion[] = [
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

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
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

function QuestionCard({ question, answer, onAnswer, direction, animKey, compact }: QuestionCardProps) {
  const fromX = direction === "forward" ? 24 : -24;
  const cfg = question.config ?? {};

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

      {question.imageUrl && (
        <QuestionImage url={question.imageUrl} compact={compact} />
      )}

      {/* ── YA / NEIN ── */}
      {question.type === "yesno" && (
        <div style={{ display: "flex", gap: 7 }}>
          {["Ja", "Nein"].map((opt) => {
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
              const v = e.target.value.replace(cfg.decimals ? /[^0-9.]/g : /[^0-9]/g, "");
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
        const photos = Array.isArray(answer) ? (answer as string[]) : [];
        return (
          <div>
            {cfg.instruction && (
              <p style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontStyle: "italic", margin: "0 0 10px" }}>
                {cfg.instruction}
              </p>
            )}
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "16px 12px",
              borderRadius: 10, border: "1.5px dashed rgba(0,0,0,0.13)",
              background: "rgba(0,0,0,0.02)", cursor: "pointer",
              fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)",
            }}>
              <Camera size={16} strokeWidth={1.8} />
              {photos.length > 0 ? `${photos.length} Foto(s) ausgewählt` : "Foto auswählen"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const readers = files.map((f) => new Promise<string>((res) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result as string);
                    r.readAsDataURL(f);
                  }));
                  Promise.all(readers).then((urls) => {
                    onAnswer([...photos, ...urls]);
                  });
                }}
              />
            </label>
            {photos.length > 0 && (
              <PhotoLightbox photos={photos} />
            )}
          </div>
        );
      })()}

      {/* ── MATRIX ── */}
      {question.type === "matrix" && cfg.rows && cfg.columns && (
        <MatrixInput rows={cfg.rows!} cols={cfg.columns!} answers={multiAnswers} onToggle={toggleMulti} />
      )}
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

  // Active section tab inside the navigator
  type NavSection = "fragebogen" | "kuehler" | "mhd";
  const [activeNavSection, setActiveNavSection] = useState<NavSection>("fragebogen");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
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
          const isExpanded = !!expandedModules[group.moduleId];
          const groupAnswered = group.questions.filter(({ q }) => answerMap[q.id] !== undefined).length;
          const groupTotal = group.questions.length;
          const allGroupDone = groupAnswered === groupTotal;
          const hasCurrentQ = highlightCurrentIdx !== undefined && group.questions.some(({ idx }) => idx === highlightCurrentIdx);
          const colorAlpha = (a: number) => color + Math.round(a * 255).toString(16).padStart(2, "0");

          return (
            <div key={group.moduleId}>
              <button
                onClick={() => { if (!isExpanded) onTap(group.questions[0].idx); else toggleModule(group.moduleId); }}
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
                <div onClick={(e) => { e.stopPropagation(); toggleModule(group.moduleId); }} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.04)", transition: "transform 0.18s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <ChevronDown size={10} strokeWidth={2.5} color="rgba(0,0,0,0.3)" />
                </div>
              </button>

              {isExpanded && (
                <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginBottom: 2 }}>
                  {group.questions.map(({ q, idx }) => {
                    const isDone = answerMap[q.id] !== undefined;
                    const isCurrent = highlightCurrentIdx === idx;
                    return (
                      <button key={q.id} onClick={() => onTap(idx)} style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left", transition: "all 0.15s ease", background: isCurrent ? `${color}0a` : "transparent", boxShadow: isCurrent ? `inset 0 0 0 1px ${color}20` : "none" }}>
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
            <div style={{ display: "flex", gap: 6 }}>
              {sectionTabs.map(({ key, label, color, answered, total }) => {
                const isActive = activeNavSection === key;
                const done = answered === total;
                const isFlashing = flashSections.includes(key);
                return (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); setActiveNavSection(key); }}
                    className={isFlashing ? "nav-flash" : ""}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 10, fontWeight: isActive ? 700 : 500, transition: "all 0.16s ease", background: isFlashing ? `${color}22` : isActive ? `${color}12` : "rgba(0,0,0,0.03)", color: isActive || isFlashing ? color : "rgba(0,0,0,0.45)", boxShadow: isActive ? `inset 0 0 0 1px ${color}30` : isFlashing ? `inset 0 0 0 1.5px ${color}60` : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
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
            {activeNavSection === "fragebogen" && renderGroups(fragebogenGroups, answers, "#DC2626", handlePillTap, currentIndex)}
            {activeNavSection === "kuehler"    && renderGroups(kuehlerGroups, kuehlerAnswers, "#d97706", (idx) => { onJumpKuehler(idx); onClose(); })}
            {activeNavSection === "mhd"        && renderGroups(mhdGroups, mhdAnswers, "#7C3AED", (idx) => { onJumpMhd(idx); onClose(); })}
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
  const [comment, setComment] = useState("");
  const [clockTarget, setClockTarget] = useState<"von" | "bis" | null>(null);

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

  // Phase transition helper
  function transitionTo(next: Phase) {
    setPhaseVisible(false);
    setTimeout(() => {
      setPhase(next);
      setPhaseVisible(true);
      if (next === "abschluss") {
        setBisVal(nowHHMM());
        setTimerStopped(true);
      }
      if (next === "confirm") {
        setAuroraColors(["#D1FAE5", "#059669", "#D1FAE5"]);
      }
    }, 260);
  }

  // Question navigation
  function goNext() {
    if (currentQIndex < SAMPLE_QUESTIONS.length - 1) {
      setDirection("forward");
      setAnimKey(`${currentQIndex + 1}-fwd`);
      setCurrentQIndex((i) => i + 1);
    } else if (KUEHLER_QUESTIONS.length > 0) {
      setActiveSection("kuehler");
      setKuehlerQIndex(0);
      setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
    } else {
      handleAbschluss();
    }
  }

  function goBack() {
    if (activeSection === "mhd") {
      if (mhdQIndex > 0) {
        setMhdQIndex((i) => i - 1);
      } else {
        setActiveSection("kuehler");
        setKuehlerQIndex(KUEHLER_QUESTIONS.length - 1);
        setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
      }
    } else if (activeSection === "kuehler") {
      if (kuehlerQIndex > 0) {
        setKuehlerQIndex((i) => i - 1);
      } else {
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
    setDirection(index >= currentQIndex ? "forward" : "back");
    setAnimKey(`${index}-jump-${Date.now()}`);
    setCurrentQIndex(index);
    setActiveSection("fragebogen");
  }, [currentQIndex]);

  const jumpToKuehler = useCallback((index = 0) => {
    setActiveSection("kuehler");
    setKuehlerQIndex(index);
    setAuroraColors(["#FEF3C7", "#F59E0B", "#FEF3C7"]);
  }, []);

  const jumpToMhd = useCallback((index = 0) => {
    setActiveSection("mhd");
    setMhdQIndex(index);
    setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]);
  }, []);

  function handleAbschluss() {
    // Find unanswered required questions per section
    const missingFb = SAMPLE_QUESTIONS.filter((q) => q.required && answers[q.id] === undefined);
    const missingK  = KUEHLER_QUESTIONS.filter((q) => q.required && kuehlerAnswers[q.id] === undefined);
    const missingM  = MHD_QUESTIONS.filter((q) => q.required && mhdAnswers[q.id] === undefined);

    if (missingFb.length === 0 && missingK.length === 0 && missingM.length === 0) {
      transitionTo("abschluss");
      return;
    }

    // Build flash lists
    const sections: ("fragebogen" | "kuehler" | "mhd")[] = [];
    if (missingFb.length > 0) sections.push("fragebogen");
    if (missingK.length > 0)  sections.push("kuehler");
    if (missingM.length > 0)  sections.push("mhd");

    const moduleIds = new Set<string>();
    [...missingFb, ...missingK, ...missingM].forEach((q) => moduleIds.add(q.moduleId));

    setFlashSections(sections);
    setFlashModules(Array.from(moduleIds));
    setNavOpen(true);

    // Clear flash after animation completes (3 × 0.6s = 1.8s + small buffer)
    setTimeout(() => {
      setFlashSections([]);
      setFlashModules([]);
    }, 2200);
  }

  const kuehlerAnsweredCount = KUEHLER_QUESTIONS.filter((q) => kuehlerAnswers[q.id] !== undefined).length;
  const mhdAnsweredCount = MHD_QUESTIONS.filter((q) => mhdAnswers[q.id] !== undefined).length;
  const answeredCount = SAMPLE_QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const allDone = answeredCount === SAMPLE_QUESTIONS.length && kuehlerAnsweredCount === KUEHLER_QUESTIONS.length && mhdAnsweredCount === MHD_QUESTIONS.length;

  const currentQ = SAMPLE_QUESTIONS[currentQIndex];
  const currentAnswer = answers[currentQ?.id];

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
        {phase === "idle" && (
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
              </div>

              {/* Timer starten button */}
              <button
                onClick={() => {
                  setTimerRunning(true);
                  transitionTo("active");
                }}
                style={{
                  width: "100%", padding: "9px 0",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
                  color: "#fff", border: "none", borderRadius: 9, cursor: "pointer",
                  background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)",
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Timer starten
              </button>

              {/* Skip */}
              <button
                onClick={() => transitionTo("active")}
                style={{
                  marginTop: 10, width: "100%",
                  fontSize: 10, color: "rgba(0,0,0,0.3)", fontWeight: 500,
                  background: "none", border: "none", cursor: "pointer",
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
            padding: "40px 20px 60px",
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

            <div style={{ width: "100%", maxWidth: 380 }}>

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
                  <CheckCircle2 size={48} strokeWidth={1.5} color="#059669" />
                </div>

                {/* Title */}
                <div style={{
                  fontSize: 22, fontWeight: 800, color: "#0f172a",
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
                    fontSize: 10, fontWeight: 600, color: "#059669",
                    padding: "4px 12px", borderRadius: 20,
                    backgroundColor: "rgba(5,150,105,0.08)",
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
                  flex: 1, backgroundColor: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
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
                  flex: 1, backgroundColor: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", marginBottom: 5 }}>Fragen</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: answeredCount === SAMPLE_QUESTIONS.length ? "#059669" : "#DC2626", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {answeredCount}/{SAMPLE_QUESTIONS.length}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", marginTop: 4 }}>
                    {answeredCount === SAMPLE_QUESTIONS.length ? "Alle beantwortet" : "Unvollständig"}
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
                  backgroundColor: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <FileText size={16} strokeWidth={1.8} color={answeredCount === SAMPLE_QUESTIONS.length ? "#059669" : "#DC2626"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>Fragebogen</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(answeredCount / SAMPLE_QUESTIONS.length) * 100}%`,
                        background: answeredCount === SAMPLE_QUESTIONS.length
                          ? "linear-gradient(to right, #10b981, #059669)"
                          : "linear-gradient(to right, #DC2626, #e84040)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: answeredCount === SAMPLE_QUESTIONS.length ? "#059669" : "#DC2626",
                    flexShrink: 0,
                  }}>
                    {answeredCount}/{SAMPLE_QUESTIONS.length}
                  </span>
                </div>

                {/* Kühlerinventur */}
                <div style={{
                  backgroundColor: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Refrigerator size={16} strokeWidth={1.8} color={kuehlerAnsweredCount === KUEHLER_QUESTIONS.length ? "#d97706" : "rgba(0,0,0,0.25)"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>Kühlerinventur</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(kuehlerAnsweredCount / KUEHLER_QUESTIONS.length) * 100}%`,
                        background: kuehlerAnsweredCount === KUEHLER_QUESTIONS.length
                          ? "linear-gradient(to right, #F59E0B, #d97706)"
                          : "linear-gradient(to right, #fbbf24, #F59E0B)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: kuehlerAnsweredCount === KUEHLER_QUESTIONS.length ? "#d97706" : "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                  }}>
                    {kuehlerAnsweredCount}/{KUEHLER_QUESTIONS.length}
                  </span>
                </div>

                {/* MHD */}
                <div style={{
                  backgroundColor: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 14, padding: "14px 16px",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Thermometer size={16} strokeWidth={1.8} color={mhdAnsweredCount === MHD_QUESTIONS.length ? "#7C3AED" : "rgba(0,0,0,0.25)"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>MHD-Prüfung</div>
                    <div style={{ height: 3, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(mhdAnsweredCount / MHD_QUESTIONS.length) * 100}%`,
                        background: mhdAnsweredCount === MHD_QUESTIONS.length
                          ? "linear-gradient(to right, #8b5cf6, #7C3AED)"
                          : "linear-gradient(to right, #a78bfa, #8b5cf6)",
                        borderRadius: 2,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: mhdAnsweredCount === MHD_QUESTIONS.length ? "#7C3AED" : "rgba(0,0,0,0.3)",
                    flexShrink: 0,
                  }}>
                    {mhdAnsweredCount}/{MHD_QUESTIONS.length}
                  </span>
                </div>

                {/* Comment */}
                {comment && (
                  <div style={{
                    backgroundColor: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    borderRadius: 14, padding: "14px 16px",
                    border: "1px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
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

          {/* Top bar */}
          <div style={{
            padding: "14px 16px 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <button
              onClick={() => router.push("/gm")}
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
          <div style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "0 16px",
            paddingBottom: navOpen ? "0px" : "64px",
            transition: "padding-bottom 0.28s cubic-bezier(0.4,0,0.2,1)",
          }}>
            <div style={{ width: "100%", maxWidth: 480, margin: "auto", marginBottom: navOpen ? "65vh" : "auto", transition: "margin-bottom 0.28s cubic-bezier(0.4,0,0.2,1)" }}>

              {/* ── FRAGEBOGEN SECTION ── */}
              {activeSection === "fragebogen" && (
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
                        const n = SAMPLE_QUESTIONS.length;
                        const allAnswered = answeredCount === n;
                        const lastAnsweredIdx = SAMPLE_QUESTIONS.reduce((acc, q, i) => answers[q.id] !== undefined ? i : acc, -1);
                        const fillPct = n <= 1 ? 0 : (lastAnsweredIdx / (n - 1)) * 100;
                        const trackColor = allAnswered ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.08)";
                        const fillColor = allAnswered
                          ? "linear-gradient(to right, #16a34a, #22c55e)"
                          : "linear-gradient(to right, #b91c1c, #DC2626)";
                        return (
                          <>
                            <div style={{ position: "absolute", left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: trackColor, transition: "background-color 0.4s ease" }} />
                            <div style={{ position: "absolute", left: 0, width: `${fillPct}%`, height: 2, borderRadius: 1, background: fillColor, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.4s ease" }} />
                            {SAMPLE_QUESTIONS.map((q, i) => {
                              const done = answers[q.id] !== undefined;
                              const current = i === currentQIndex;
                              const leftPct = n === 1 ? 50 : (i / (n - 1)) * 100;
                              const dotBg = allAnswered ? "#22c55e" : done ? "#DC2626" : current ? "rgba(220,38,38,0.45)" : "rgba(0,0,0,0.12)";
                              const size = current && !done ? 9 : 7;
                              return (
                                <div key={q.id} style={{
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
                      {answeredCount}/{SAMPLE_QUESTIONS.length}
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
                        Frage {currentQIndex + 1} von {SAMPLE_QUESTIONS.length}
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
                      question={currentQ}
                      answer={currentAnswer}
                      onAnswer={(val) => setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))}
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
                    <button onClick={goNext} disabled={currentQ.required && !currentAnswer} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: (currentQ.required && !currentAnswer) ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: (currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.2)" : "#fff", background: (currentQ.required && !currentAnswer) ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: (currentQ.required && !currentAnswer) ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {currentQIndex < SAMPLE_QUESTIONS.length - 1
                        ? "Weiter"
                        : KUEHLER_QUESTIONS.length > 0
                          ? "Zur Kühlerinventur"
                          : "Abschließen"}
                      <ChevronRight size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── KÜHLERINVENTUR SECTION ── */}
              {activeSection === "kuehler" && (() => {
                const kQ = KUEHLER_QUESTIONS[kuehlerQIndex];
                const kAns = kuehlerAnswers[kQ?.id];
                const isLast = kuehlerQIndex === KUEHLER_QUESTIONS.length - 1;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Refrigerator size={11} strokeWidth={1.8} color="rgba(217,119,6,0.5)" />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(217,119,6,0.7)" }}>Kühlerinventur</span>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginLeft: "auto" }}>{kuehlerQIndex + 1}/{KUEHLER_QUESTIONS.length}</span>
                    </div>

                    {/* Dot progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, width: "100%" }}>
                      {KUEHLER_QUESTIONS.map((q, i) => {
                        const done = kuehlerAnswers[q.id] !== undefined;
                        const active = i === kuehlerQIndex;
                        const isLastDot = i === KUEHLER_QUESTIONS.length - 1;
                        return (
                          <div key={q.id} style={{ display: "flex", alignItems: "center", flex: isLastDot ? "0 0 auto" : 1, minWidth: 0 }}>
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
                          {kQ?.type === "yesno" ? "Ja / Nein" : "Auswahl"}
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
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.5, letterSpacing: "-0.01em", margin: "0 0 14px" }}>{kQ?.text}</p>
                      {kQ?.type === "yesno" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[{ label: "Ja", val: "ja" }, { label: "Nein", val: "nein" }].map(({ label, val }) => {
                            const sel = kAns === val;
                            return (
                              <button key={val} onClick={() => setKuehlerAnswers((p) => ({ ...p, [kQ.id]: val }))}
                                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)", background: sel ? "rgba(217,119,6,0.08)" : "rgba(0,0,0,0.03)", color: sel ? "#d97706" : "rgba(0,0,0,0.5)", boxShadow: sel ? "inset 0 0 0 1px rgba(217,119,6,0.3)" : "none" }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {kQ?.type === "single" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {kQ.options?.map((opt) => {
                            const sel = kAns === opt;
                            const optColor =
                              opt === "Sehr voll"  ? { dot: "#22c55e", bg: "rgba(34,197,94,0.07)",  border: "rgba(34,197,94,0.3)",  text: "#15803d",  check: "#22c55e"  } :
                              opt === "Halb voll"  ? { dot: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.3)", text: "#92400e",  check: "#f59e0b" } :
                              opt === "Nicht voll" ? { dot: "#DC2626", bg: "rgba(220,38,38,0.07)",  border: "rgba(220,38,38,0.3)",  text: "#b91c1c",  check: "#DC2626"  } :
                              { dot: "#d97706", bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.25)", text: "#d97706", check: "#d97706" };
                            return (
                              <button key={opt} onClick={() => setKuehlerAnswers((p) => ({ ...p, [kQ.id]: opt }))}
                                style={{ padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, textAlign: "left", transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)", display: "flex", alignItems: "center", gap: 10, background: sel ? optColor.bg : "rgba(0,0,0,0.03)", color: sel ? optColor.text : "rgba(0,0,0,0.6)", boxShadow: sel ? `inset 0 0 0 1px ${optColor.border}` : "none" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: optColor.dot, flexShrink: 0, opacity: sel ? 1 : 0.4 }} />
                                {opt}
                                {sel && <Check size={10} strokeWidth={3} color={optColor.check} style={{ marginLeft: "auto" }} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                      <button onClick={goBack} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", boxShadow: "0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronLeft size={12} strokeWidth={2} />
                        Zurück
                      </button>
                      <button
                        onClick={() => {
                          if (!kAns) return;
                          if (!isLast) { setKuehlerQIndex((i) => i + 1); }
                          else if (MHD_QUESTIONS.length > 0) { setActiveSection("mhd"); setMhdQIndex(0); setAuroraColors(["#EDE9FE", "#7C3AED", "#EDE9FE"]); }
                          else { handleAbschluss(); }
                        }}
                        disabled={!kAns}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: !kAns ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: !kAns ? "rgba(0,0,0,0.2)" : "#fff", background: !kAns ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #F59E0B, #d97706)", boxShadow: !kAns ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #b45309, 0 1px 6px rgba(180,100,0,0.16)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        {isLast ? (MHD_QUESTIONS.length > 0 ? "Weiter zu MHD" : "Abschließen") : "Weiter"}
                        <ChevronRight size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── MHD SECTION ── */}
              {activeSection === "mhd" && (() => {
                const mhdQ = MHD_QUESTIONS[mhdQIndex];
                const mhdAns = mhdAnswers[mhdQ?.id];
                const isLast = mhdQIndex === MHD_QUESTIONS.length - 1;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Thermometer size={11} strokeWidth={1.8} color="rgba(124,58,237,0.5)" />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(124,58,237,0.7)" }}>MHD-Prüfung</span>
                      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginLeft: "auto" }}>{mhdQIndex + 1}/{MHD_QUESTIONS.length}</span>
                    </div>

                    {/* Dot progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, width: "100%" }}>
                      {MHD_QUESTIONS.map((q, i) => {
                        const done = mhdAnswers[q.id] !== undefined;
                        const active = i === mhdQIndex;
                        const isFirst = i === 0;
                        const isLastDot = i === MHD_QUESTIONS.length - 1;
                        return (
                          <div key={q.id} style={{ display: "flex", alignItems: "center", flex: isLastDot ? "0 0 auto" : 1, minWidth: 0 }}>
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
                          {mhdQ?.type === "yesno" ? "Ja / Nein" : "Auswahl"}
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
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.5, letterSpacing: "-0.01em", margin: "0 0 14px" }}>
                        {mhdQ?.text}
                      </p>

                      {mhdQ?.type === "yesno" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[{ label: "Ja", val: "ja" }, { label: "Nein", val: "nein" }].map(({ label, val }) => {
                            const sel = mhdAns === val;
                            return (
                              <button key={val} onClick={() => setMhdAnswers((p) => ({ ...p, [mhdQ.id]: val }))}
                                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)", background: sel ? "rgba(124,58,237,0.08)" : "rgba(0,0,0,0.03)", color: sel ? "#7C3AED" : "rgba(0,0,0,0.5)", boxShadow: sel ? "inset 0 0 0 1px rgba(124,58,237,0.3)" : "none" }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {mhdQ?.type === "single" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {mhdQ.options?.map((opt) => {
                            const sel = mhdAns === opt;
                            return (
                              <button key={opt} onClick={() => setMhdAnswers((p) => ({ ...p, [mhdQ.id]: opt }))}
                                style={{ padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, textAlign: "left", transition: "all 0.16s cubic-bezier(0.4,0,0.2,1)", display: "flex", alignItems: "center", gap: 10, background: sel ? "rgba(124,58,237,0.07)" : "rgba(0,0,0,0.03)", color: sel ? "#7C3AED" : "rgba(0,0,0,0.6)", boxShadow: sel ? "inset 0 0 0 1px rgba(124,58,237,0.25)" : "none" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#7C3AED", flexShrink: 0, opacity: sel ? 1 : 0.25 }} />
                                {opt}
                                {sel && <Check size={10} strokeWidth={3} color="#7C3AED" style={{ marginLeft: "auto" }} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                      <button onClick={goBack} style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", boxShadow: "0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 4 }}>
                        <ChevronLeft size={12} strokeWidth={2} />
                        Zurück
                      </button>
                      <button
                        onClick={() => {
                          if (!mhdAns) return;
                          if (!isLast) {
                            setMhdQIndex((i) => i + 1);
                          } else {
                            handleAbschluss();
                          }
                        }}
                        disabled={!mhdAns}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: !mhdAns ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: !mhdAns ? "rgba(0,0,0,0.2)" : "#fff", background: !mhdAns ? "rgba(0,0,0,0.05)" : "linear-gradient(to bottom, #8b5cf6, #7C3AED)", boxShadow: !mhdAns ? "none" : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #6d28d9, 0 1px 6px rgba(109,40,217,0.2)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
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
                        <input type="text" value={val} onChange={(e) => setVal(formatTimeInput(e.target.value))} placeholder="HH:MM" maxLength={5} style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1a1a1a", background: "none", border: "none", outline: "none", fontVariantNumeric: "tabular-nums" }} />
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
              <button onClick={() => transitionTo("confirm")} style={{ width: "100%", padding: "9px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", background: "linear-gradient(to bottom, #DC2626, #b91c1c)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.18)", transition: "opacity 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                Beenden
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
                  ? (kuehlerAnsweredCount === KUEHLER_QUESTIONS.length ? "Abgeschlossen" : `${kuehlerQIndex + 1}/${KUEHLER_QUESTIONS.length} — ${KUEHLER_QUESTIONS[kuehlerQIndex]?.text || ""}`)
                  : activeSection === "mhd"
                  ? (mhdAnsweredCount === MHD_QUESTIONS.length ? "Abgeschlossen" : `${mhdQIndex + 1}/${MHD_QUESTIONS.length} — ${MHD_QUESTIONS[mhdQIndex]?.text || ""}`)
                  : `${currentQIndex + 1}/${SAMPLE_QUESTIONS.length} — ${SAMPLE_QUESTIONS[currentQIndex]?.text || ""}`
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
            questions={SAMPLE_QUESTIONS}
            mhdQuestions={MHD_QUESTIONS}
            mhdAnswers={mhdAnswers}
            kuehlerQuestions={KUEHLER_QUESTIONS}
            kuehlerAnswers={kuehlerAnswers}
            answers={answers}
            currentIndex={currentQIndex}
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
