"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown, Clock, Store, Car, Coffee,
  GraduationCap, Wrench, Home, Warehouse, Star, Search,
} from "lucide-react";
import type { TimeDaySession } from "@/types/zeiterfassung";

// ── Constants ─────────────────────────────────────────────────
const R  = "#DC2626";

// ── Helpers ───────────────────────────────────────────────────
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function diffMin(start: string, end: string): number {
  return Math.max(0, toMin(end) - toMin(start));
}
function fmtDur(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
function fmtKm(km: number): string {
  return km.toLocaleString("de-AT") + " km";
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmtDateLabel(dateISO: string): { weekday: string; date: string } {
  const d = new Date(dateISO + "T12:00:00");
  return {
    weekday: d.toLocaleDateString("de-AT", { weekday: "long" }),
    date: d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
  };
}
function gmInitials(name: string): string {
  const parts = name.split(" ");
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
function gmAvatarColor(name: string): { bg: string; text: string } {
  const palettes = [
    { bg: "rgba(220,38,38,0.10)",  text: R },
    { bg: "rgba(37,99,235,0.10)",  text: "#2563eb" },
    { bg: "rgba(22,163,74,0.10)",  text: "#16a34a" },
    { bg: "rgba(217,119,6,0.10)",  text: "#D97706" },
    { bg: "rgba(124,58,237,0.10)", text: "#7c3aed" },
  ];
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// Current ISO week number
function getISOWeek(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// ── Display segment types ─────────────────────────────────────
type SegmentKind = "anfahrt" | "marktbesuch" | "fahrtzeit" | "pause" | "zusatzzeit" | "heimfahrt";
interface DisplaySegment {
  kind: SegmentKind;
  start: string;
  end: string;
  durationMin: number;
  title: string;
  subtitle?: string;
  kmNote?: string;
  subtype?: string;
  questionnaireType?: string;
}

function deriveTimeline(session: TimeDaySession): DisplaySegment[] {
  const segments: DisplaySegment[] = [];
  const sorted = [...session.entries].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const firstEntryStart = sorted[0]?.startTime ?? session.endTime;
  segments.push({ kind: "anfahrt", start: session.startTime, end: firstEntryStart, durationMin: diffMin(session.startTime, firstEntryStart), title: "Anfahrt", kmNote: `KM Start: ${fmtKm(session.startKm)}` });
  sorted.forEach((entry, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = diffMin(prev.endTime, entry.startTime);
      if (gap > 0) segments.push({ kind: "fahrtzeit", start: prev.endTime, end: entry.startTime, durationMin: gap, title: "Fahrtzeit" });
    }
    if (entry.kind === "marktbesuch") {
      segments.push({ kind: "marktbesuch", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: entry.marketName ?? "Marktbesuch", subtitle: entry.marketAddress, questionnaireType: entry.questionnaireType });
    } else if (entry.kind === "pause") {
      segments.push({ kind: "pause", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: "Pause" });
    } else if (entry.kind === "zusatzzeit") {
      const label = entry.subtype ? SUBTYPE_META[entry.subtype]?.label ?? entry.subtype : "Zusatzzeit";
      segments.push({ kind: "zusatzzeit", start: entry.startTime, end: entry.endTime, durationMin: entry.durationMin, title: label, subtype: entry.subtype });
    }
  });
  const lastEntryEnd = sorted[sorted.length - 1]?.endTime ?? session.startTime;
  segments.push({ kind: "heimfahrt", start: lastEntryEnd, end: session.endTime, durationMin: diffMin(lastEntryEnd, session.endTime), title: "Heimfahrt", kmNote: `KM Ende: ${fmtKm(session.endKm)}` });
  return segments;
}

function deriveStats(session: TimeDaySession) {
  const arbeitstag = diffMin(session.startTime, session.endTime);
  const pauseMin = session.entries.filter(e => e.kind === "pause").reduce((s, e) => s + e.durationMin, 0);
  const reineArbeitszeit = arbeitstag - pauseMin;
  const kmGefahren = session.endKm - session.startKm;
  const marktbesuche = session.entries.filter(e => e.kind === "marktbesuch").length;
  const zusatz = session.entries.filter(e => e.kind === "zusatzzeit").length;
  return { arbeitstag, pauseMin, reineArbeitszeit, kmGefahren, marktbesuche, zusatz };
}

// ── Subtype + questionnaire meta ──────────────────────────────
const SUBTYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> }> = {
  schulung:           { label: "Schulung",              color: "#2563eb", bg: "rgba(37,99,235,0.08)",   icon: GraduationCap },
  sonderaufgabe:      { label: "Sonderaufgabe",          color: "#D97706", bg: "rgba(217,119,6,0.08)",   icon: Star },
  arztbesuch:         { label: "Arztbesuch",             color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  icon: Coffee },
  werkstatt:          { label: "Werkstatt/Autoreinigung",color: "#6b7280", bg: "rgba(107,114,128,0.08)", icon: Wrench },
  homeoffice:         { label: "Homeoffice",             color: "#16a34a", bg: "rgba(22,163,74,0.08)",   icon: Home },
  lager:              { label: "Lager",                  color: "#0891B2", bg: "rgba(8,145,178,0.08)",   icon: Warehouse },
  hoteluebernachtung: { label: "Hotelübernachtung",      color: "#9333ea", bg: "rgba(147,51,234,0.08)",  icon: Coffee },
};
const QUESTIONNAIRE_META: Record<string, { label: string; color: string }> = {
  standard: { label: "Standard", color: R },
  flex:     { label: "Flex",     color: "#65a30d" },
  kuehler:  { label: "Kühler",   color: "#D97706" },
  mhd:      { label: "MHD",      color: "#7C3AED" },
  billa:    { label: "Billa",    color: "#0891B2" },
};

// ── Aggregated GM model ───────────────────────────────────────
interface AggregatedGmRow {
  gmId: string;
  gmName: string;
  region: string;
  sessions: TimeDaySession[];
  currentKwNumber: number;
  currentKwReineArbeitszeitMin: number;
  totalReineArbeitszeitMin: number;
  averageWorkdayMin: number;
  totalKmDriven: number;
  privatnutzungKm: number;
}

function buildCurrentKwBounds(): { start: Date; end: Date } {
  const today = new Date();
  const day = (today.getDay() + 6) % 7; // Mon=0
  const mon = new Date(today);
  mon.setDate(today.getDate() - day);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

function aggregateGms(sessions: TimeDaySession[]): AggregatedGmRow[] {
  const kwBounds = buildCurrentKwBounds();
  const currentKwNum = getISOWeek(todayISO());
  const map = new Map<string, TimeDaySession[]>();
  sessions.forEach(s => {
    if (!map.has(s.gmId)) map.set(s.gmId, []);
    map.get(s.gmId)!.push(s);
  });
  return Array.from(map.entries()).map(([gmId, gmSessions]) => {
    const sorted = [...gmSessions].sort((a, b) => a.date.localeCompare(b.date));
    let totalReineAz = 0;
    let kwReineAz = 0;
    let totalKm = 0;
    let privatnutzung = 0;
    sorted.forEach((s, i) => {
      const stats = deriveStats(s);
      totalReineAz += stats.reineArbeitszeit;
      totalKm += stats.kmGefahren;
      const sd = new Date(s.date + "T12:00:00");
      if (sd >= kwBounds.start && sd <= kwBounds.end) kwReineAz += stats.reineArbeitszeit;
      // privatnutzung: gap between end KM of this day and start KM of next workday
      if (i < sorted.length - 1) {
        const gap = sorted[i + 1].startKm - s.endKm;
        if (gap > 0) privatnutzung += gap;
      }
    });
    return {
      gmId,
      gmName: sorted[0].gmName,
      region: sorted[0].region,
      sessions: sorted,
      currentKwNumber: currentKwNum,
      currentKwReineArbeitszeitMin: kwReineAz,
      totalReineArbeitszeitMin: totalReineAz,
      averageWorkdayMin: sorted.length > 0 ? Math.round(totalReineAz / sorted.length) : 0,
      totalKmDriven: totalKm,
      privatnutzungKm: privatnutzung,
    };
  });
}

// ── Seed data ─────────────────────────────────────────────────
const TODAY = todayISO();
const D = (n: number): string => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const SEED_SESSIONS: TimeDaySession[] = [
  // Thomas Huber (Ost) — 3 sessions, privatnutzung between day D(2)->D(0): endKm 48210 but D(0) startKm is 48230 (+20 priv)
  {
    id: "s-th-today", date: TODAY, gmId: "gm-seed-1", gmName: "Thomas Huber", region: "Ost",
    startTime: "08:55", endTime: "18:10", startKm: 48230, endKm: 48362,
    entries: [
      { id: "e1", kind: "marktbesuch", startTime: "09:05", endTime: "09:52", durationMin: 47, marketName: "Billa Favoriten", marketAddress: "Favoritenstr. 10, 1100 Wien", questionnaireType: "standard" },
      { id: "e2", kind: "marktbesuch", startTime: "10:15", endTime: "11:05", durationMin: 50, marketName: "Spar Meidling", marketAddress: "Meidlinger Hauptstr. 12, 1120 Wien", questionnaireType: "flex" },
      { id: "e3", kind: "pause",       startTime: "11:10", endTime: "11:40", durationMin: 30 },
      { id: "e4", kind: "marktbesuch", startTime: "12:00", endTime: "12:55", durationMin: 55, marketName: "Penny Mariahilf", marketAddress: "Mariahilfer Str. 58, 1060 Wien", questionnaireType: "standard" },
      { id: "e5", kind: "marktbesuch", startTime: "14:10", endTime: "15:00", durationMin: 50, marketName: "Hofer Rudolfsheim", marketAddress: "Rudolfsheimer Str. 44, 1150 Wien", questionnaireType: "standard" },
      { id: "e6", kind: "marktbesuch", startTime: "15:45", endTime: "16:40", durationMin: 55, marketName: "Merkur Wien 22", marketAddress: "Donaustadtstr. 7, 1220 Wien", questionnaireType: "flex" },
    ],
  },
  {
    id: "s-th-2", date: D(2), gmId: "gm-seed-1", gmName: "Thomas Huber", region: "Ost",
    startTime: "09:10", endTime: "17:30", startKm: 48100, endKm: 48210,
    entries: [
      { id: "j1", kind: "zusatzzeit",  startTime: "09:20", endTime: "10:20", durationMin: 60, subtype: "sonderaufgabe" },
      { id: "j2", kind: "marktbesuch", startTime: "11:00", endTime: "11:55", durationMin: 55, marketName: "Billa Baden", marketAddress: "Hauptpl. 1, 2500 Baden", questionnaireType: "standard" },
      { id: "j3", kind: "pause",       startTime: "11:55", endTime: "12:30", durationMin: 35 },
      { id: "j4", kind: "marktbesuch", startTime: "13:00", endTime: "14:00", durationMin: 60, marketName: "Spar St. Pölten", marketAddress: "Bahnhofpl. 3, 3100 St. Pölten", questionnaireType: "billa" },
      { id: "j5", kind: "marktbesuch", startTime: "14:45", endTime: "15:40", durationMin: 55, marketName: "Hofer St. Pölten Ost", marketAddress: "Ostbahnstr. 15, 3100 St. Pölten", questionnaireType: "standard" },
    ],
  },
  {
    id: "s-th-5", date: D(5), gmId: "gm-seed-1", gmName: "Thomas Huber", region: "Ost",
    startTime: "08:30", endTime: "17:15", startKm: 47920, endKm: 48100,
    entries: [
      { id: "m1", kind: "marktbesuch", startTime: "08:45", endTime: "09:45", durationMin: 60, marketName: "Spar Favoriten", marketAddress: "Favoritenstr. 88, 1100 Wien", questionnaireType: "standard" },
      { id: "m2", kind: "marktbesuch", startTime: "10:10", endTime: "11:05", durationMin: 55, marketName: "Billa Simmering", marketAddress: "Simmeringer Hptstr. 10, 1110 Wien", questionnaireType: "flex" },
      { id: "m3", kind: "pause",       startTime: "11:10", endTime: "11:40", durationMin: 30 },
      { id: "m4", kind: "marktbesuch", startTime: "12:00", endTime: "12:55", durationMin: 55, marketName: "Penny Simmering", marketAddress: "Simmeringer Hptstr. 90, 1110 Wien", questionnaireType: "standard" },
      { id: "m5", kind: "marktbesuch", startTime: "14:00", endTime: "15:00", durationMin: 60, marketName: "Merkur Donaustadt", marketAddress: "Donaustadtstr. 44, 1220 Wien", questionnaireType: "standard" },
    ],
  },

  // Anna Gruber (Süd) — 3 sessions, privatnutzung: D(3) endKm 22100, D(1) startKm 22115 (+15)
  {
    id: "s-ag-today", date: TODAY, gmId: "gm-seed-2", gmName: "Anna Gruber", region: "Süd",
    startTime: "08:30", endTime: "17:45", startKm: 22200, endKm: 22298,
    entries: [
      { id: "f1", kind: "marktbesuch", startTime: "08:45", endTime: "09:40", durationMin: 55, marketName: "Spar Graz Hauptplatz", marketAddress: "Hauptplatz 1, 8010 Graz", questionnaireType: "standard" },
      { id: "f2", kind: "zusatzzeit",  startTime: "10:05", endTime: "11:35", durationMin: 90, subtype: "schulung" },
      { id: "f3", kind: "pause",       startTime: "11:35", endTime: "12:00", durationMin: 25 },
      { id: "f4", kind: "marktbesuch", startTime: "12:30", endTime: "13:20", durationMin: 50, marketName: "Billa Graz Münzgrabenstr.", marketAddress: "Münzgrabenstr. 36, 8010 Graz", questionnaireType: "kuehler" },
      { id: "f5", kind: "marktbesuch", startTime: "14:15", endTime: "15:15", durationMin: 60, marketName: "Hofer Graz West", marketAddress: "Westring 381, 8051 Graz", questionnaireType: "standard" },
    ],
  },
  {
    id: "s-ag-3", date: D(3), gmId: "gm-seed-2", gmName: "Anna Gruber", region: "Süd",
    startTime: "08:00", endTime: "16:45", startKm: 21990, endKm: 22100,
    entries: [
      { id: "k1", kind: "marktbesuch", startTime: "08:20", endTime: "09:10", durationMin: 50, marketName: "Spar Graz Jakominiplatz", marketAddress: "Jakominiplatz 1, 8010 Graz", questionnaireType: "standard" },
      { id: "k2", kind: "marktbesuch", startTime: "09:45", endTime: "10:40", durationMin: 55, marketName: "Merkur Graz City", marketAddress: "Conrad-von-Hötzendorf-Str. 1, 8010 Graz", questionnaireType: "standard" },
      { id: "k3", kind: "pause",       startTime: "10:40", endTime: "11:10", durationMin: 30 },
      { id: "k4", kind: "marktbesuch", startTime: "11:30", endTime: "12:25", durationMin: 55, marketName: "Penny Graz Reininghaus", marketAddress: "Reininghaus 2, 8020 Graz", questionnaireType: "kuehler" },
      { id: "k5", kind: "marktbesuch", startTime: "13:30", endTime: "14:30", durationMin: 60, marketName: "Billa Graz Münzgrabenstr.", marketAddress: "Münzgrabenstr. 36, 8010 Graz", questionnaireType: "flex" },
      { id: "k6", kind: "marktbesuch", startTime: "15:00", endTime: "15:55", durationMin: 55, marketName: "Adeg Graz Straßgang", marketAddress: "Straßganger Str. 390, 8054 Graz", questionnaireType: "standard" },
    ],
  },
  // D(1) for Anna: startKm 22115 (gap of 15 from D(3) endKm 22100)
  {
    id: "s-ag-1", date: D(1), gmId: "gm-seed-2", gmName: "Anna Gruber", region: "Süd",
    startTime: "08:10", endTime: "17:00", startKm: 22115, endKm: 22200,
    entries: [
      { id: "p1", kind: "marktbesuch", startTime: "08:25", endTime: "09:20", durationMin: 55, marketName: "Hofer Graz Ost", marketAddress: "Ostbahnstr. 1, 8041 Graz", questionnaireType: "standard" },
      { id: "p2", kind: "marktbesuch", startTime: "10:00", endTime: "11:00", durationMin: 60, marketName: "Spar Graz Puntigam", marketAddress: "Puntigamer Str. 100, 8055 Graz", questionnaireType: "standard" },
      { id: "p3", kind: "pause",       startTime: "11:00", endTime: "11:30", durationMin: 30 },
      { id: "p4", kind: "marktbesuch", startTime: "12:00", endTime: "13:00", durationMin: 60, marketName: "Penny Graz Eggenberg", marketAddress: "Eggenberger Gürtel 7, 8020 Graz", questionnaireType: "flex" },
      { id: "p5", kind: "marktbesuch", startTime: "14:00", endTime: "15:00", durationMin: 60, marketName: "Billa Graz Liebenau", marketAddress: "Liebenauer Hauptstr. 2, 8041 Graz", questionnaireType: "standard" },
    ],
  },

  // Markus Steiner (West) — 2 sessions, privatnutzung: D(1) endKm 62080, D(4) startKm 62080 (no gap)
  {
    id: "s-ms-y", date: D(1), gmId: "gm-seed-3", gmName: "Markus Steiner", region: "West",
    startTime: "07:50", endTime: "17:30", startKm: 61900, endKm: 62080,
    entries: [
      { id: "g1", kind: "marktbesuch", startTime: "08:05", endTime: "09:00", durationMin: 55, marketName: "Merkur Linz Center", marketAddress: "Industriezeile 44, 4020 Linz", questionnaireType: "standard" },
      { id: "g2", kind: "marktbesuch", startTime: "09:35", endTime: "10:30", durationMin: 55, marketName: "Spar Linz Landstr.", marketAddress: "Landstr. 41, 4020 Linz", questionnaireType: "mhd" },
      { id: "g3", kind: "pause",       startTime: "10:30", endTime: "11:00", durationMin: 30 },
      { id: "g4", kind: "marktbesuch", startTime: "11:20", endTime: "12:15", durationMin: 55, marketName: "Penny Linz Nord", marketAddress: "Unionstr. 12, 4020 Linz", questionnaireType: "standard" },
      { id: "g5", kind: "zusatzzeit",  startTime: "13:30", endTime: "14:30", durationMin: 60, subtype: "werkstatt" },
      { id: "g6", kind: "marktbesuch", startTime: "15:00", endTime: "16:00", durationMin: 60, marketName: "Billa Linz Hbf", marketAddress: "Wankmüllerhofstr. 1, 4020 Linz", questionnaireType: "flex" },
    ],
  },
  {
    id: "s-ms-4", date: D(4), gmId: "gm-seed-3", gmName: "Markus Steiner", region: "West",
    startTime: "08:00", endTime: "17:00", startKm: 61720, endKm: 61900,
    entries: [
      { id: "q1", kind: "marktbesuch", startTime: "08:15", endTime: "09:10", durationMin: 55, marketName: "Merkur Wels", marketAddress: "Stadtplatz 1, 4600 Wels", questionnaireType: "standard" },
      { id: "q2", kind: "marktbesuch", startTime: "09:45", endTime: "10:40", durationMin: 55, marketName: "Spar Wels Neustadt", marketAddress: "Neustadt 2, 4600 Wels", questionnaireType: "standard" },
      { id: "q3", kind: "pause",       startTime: "10:45", endTime: "11:15", durationMin: 30 },
      { id: "q4", kind: "marktbesuch", startTime: "11:30", endTime: "12:25", durationMin: 55, marketName: "Billa Wels Mitte", marketAddress: "Stadtpl. 10, 4600 Wels", questionnaireType: "standard" },
      { id: "q5", kind: "marktbesuch", startTime: "13:30", endTime: "14:30", durationMin: 60, marketName: "Hofer Wels Ost", marketAddress: "Ostbahnstr. 5, 4600 Wels", questionnaireType: "flex" },
      { id: "q6", kind: "marktbesuch", startTime: "15:00", endTime: "15:55", durationMin: 55, marketName: "Penny Linz Süd", marketAddress: "Südring 20, 4020 Linz", questionnaireType: "standard" },
    ],
  },

  // Lisa Wagner (Nord) — 3 sessions, privatnutzung between D(5)->D(1): endKm 33540, startKm 33612 (+72 priv), D(1) endKm 33612, today startKm 33660 (+48 priv)
  {
    id: "s-lw-y", date: D(1), gmId: "gm-seed-4", gmName: "Lisa Wagner", region: "Nord",
    startTime: "09:00", endTime: "18:27", startKm: 33612, endKm: 33684,
    entries: [
      { id: "h1", kind: "zusatzzeit",  startTime: "09:15", endTime: "10:00", durationMin: 45, subtype: "homeoffice" },
      { id: "h2", kind: "marktbesuch", startTime: "10:45", endTime: "11:40", durationMin: 55, marketName: "Spar Salzburg Getreideg.", marketAddress: "Getreidegasse 9, 5020 Salzburg", questionnaireType: "standard" },
      { id: "h3", kind: "pause",       startTime: "11:40", endTime: "12:10", durationMin: 30 },
      { id: "h4", kind: "marktbesuch", startTime: "12:30", endTime: "13:20", durationMin: 50, marketName: "Billa Salzburg Rainerstr.", marketAddress: "Rainerstr. 2, 5020 Salzburg", questionnaireType: "flex" },
      { id: "h5", kind: "marktbesuch", startTime: "14:00", endTime: "14:55", durationMin: 55, marketName: "Hofer Salzburg Süd", marketAddress: "Alpenstr. 44, 5020 Salzburg", questionnaireType: "standard" },
      { id: "h6", kind: "marktbesuch", startTime: "16:00", endTime: "16:55", durationMin: 55, marketName: "Merkur Salzburg Center", marketAddress: "Europastr. 2, 5020 Salzburg", questionnaireType: "kuehler" },
    ],
  },
  {
    id: "s-lw-5", date: D(5), gmId: "gm-seed-4", gmName: "Lisa Wagner", region: "Nord",
    startTime: "10:30", endTime: "15:00", startKm: 33490, endKm: 33540,
    entries: [
      { id: "l1", kind: "zusatzzeit",  startTime: "10:45", endTime: "12:15", durationMin: 90, subtype: "arztbesuch" },
      { id: "l2", kind: "marktbesuch", startTime: "13:00", endTime: "13:55", durationMin: 55, marketName: "Spar Salzburg Nord", marketAddress: "Maxglaner Hauptstr. 1, 5020 Salzburg", questionnaireType: "standard" },
    ],
  },
  {
    id: "s-lw-today", date: TODAY, gmId: "gm-seed-4", gmName: "Lisa Wagner", region: "Nord",
    startTime: "08:00", endTime: "17:00", startKm: 33732, endKm: 33810,
    entries: [
      { id: "n1", kind: "marktbesuch", startTime: "08:15", endTime: "09:10", durationMin: 55, marketName: "Hofer Salzburg Nord", marketAddress: "Münchner Bundesstr. 1, 5020 Salzburg", questionnaireType: "standard" },
      { id: "n2", kind: "marktbesuch", startTime: "09:45", endTime: "10:40", durationMin: 55, marketName: "Spar Salzburg Schallmoos", marketAddress: "Schallmooser Hptstr. 10, 5020 Salzburg", questionnaireType: "standard" },
      { id: "n3", kind: "pause",       startTime: "10:40", endTime: "11:10", durationMin: 30 },
      { id: "n4", kind: "marktbesuch", startTime: "11:30", endTime: "12:30", durationMin: 60, marketName: "Merkur Salzburg Ost", marketAddress: "Innsbrucker Bundesstr. 35, 5020 Salzburg", questionnaireType: "flex" },
      { id: "n5", kind: "marktbesuch", startTime: "13:30", endTime: "14:25", durationMin: 55, marketName: "Penny Salzburg Mitte", marketAddress: "Rainerstr. 22, 5020 Salzburg", questionnaireType: "standard" },
    ],
  },

  // Michael Berger (Süd) — 2 sessions, D(2) endKm 77418, D(6) startKm 77418 (no private use = 0)
  {
    id: "s-mb-2", date: D(2), gmId: "gm-seed-5", gmName: "Michael Berger", region: "Süd",
    startTime: "08:20", endTime: "17:10", startKm: 77300, endKm: 77418,
    entries: [
      { id: "i1", kind: "marktbesuch", startTime: "08:40", endTime: "09:35", durationMin: 55, marketName: "Hofer Klagenfurt West", marketAddress: "Südring 5, 9020 Klagenfurt", questionnaireType: "standard" },
      { id: "i2", kind: "marktbesuch", startTime: "10:05", endTime: "11:05", durationMin: 60, marketName: "Spar Klagenfurt Villacher", marketAddress: "Villacher Ring 1, 9020 Klagenfurt", questionnaireType: "mhd" },
      { id: "i3", kind: "pause",       startTime: "11:05", endTime: "11:35", durationMin: 30 },
      { id: "i4", kind: "marktbesuch", startTime: "12:00", endTime: "12:50", durationMin: 50, marketName: "Billa Klagenfurt Am Ring", marketAddress: "Am Europapl. 1, 9020 Klagenfurt", questionnaireType: "standard" },
      { id: "i5", kind: "zusatzzeit",  startTime: "14:00", endTime: "14:45", durationMin: 45, subtype: "lager" },
      { id: "i6", kind: "marktbesuch", startTime: "15:15", endTime: "16:10", durationMin: 55, marketName: "Penny Klagenfurt Nord", marketAddress: "Nordring 22, 9020 Klagenfurt", questionnaireType: "flex" },
    ],
  },
  {
    id: "s-mb-6", date: D(6), gmId: "gm-seed-5", gmName: "Michael Berger", region: "Süd",
    startTime: "08:00", endTime: "16:50", startKm: 77170, endKm: 77300,
    entries: [
      { id: "r1", kind: "marktbesuch", startTime: "08:20", endTime: "09:15", durationMin: 55, marketName: "Spar Klagenfurt Süd", marketAddress: "Südring 100, 9020 Klagenfurt", questionnaireType: "standard" },
      { id: "r2", kind: "marktbesuch", startTime: "09:50", endTime: "10:45", durationMin: 55, marketName: "Billa Klagenfurt Waidmannsdorf", marketAddress: "Waidmannsdorfer Str. 1, 9020 Klagenfurt", questionnaireType: "standard" },
      { id: "r3", kind: "pause",       startTime: "10:45", endTime: "11:15", durationMin: 30 },
      { id: "r4", kind: "marktbesuch", startTime: "11:30", endTime: "12:25", durationMin: 55, marketName: "Hofer Klagenfurt Nord", marketAddress: "Völkermarkter Str. 5, 9020 Klagenfurt", questionnaireType: "kuehler" },
      { id: "r5", kind: "marktbesuch", startTime: "13:30", endTime: "14:30", durationMin: 60, marketName: "Merkur Klagenfurt Ost", marketAddress: "Viktringer Ring 26, 9020 Klagenfurt", questionnaireType: "standard" },
    ],
  },
];

// ── Action Row ────────────────────────────────────────────────
function ActionRow({ seg }: { seg: DisplaySegment }) {
  const isAnfahrt   = seg.kind === "anfahrt";
  const isHeimfahrt = seg.kind === "heimfahrt";
  const isFahrtzeit = seg.kind === "fahrtzeit";
  const isPause     = seg.kind === "pause";
  const isMarkt     = seg.kind === "marktbesuch";
  const smeta = seg.subtype ? SUBTYPE_META[seg.subtype] : null;
  const qmeta = seg.questionnaireType ? QUESTIONNAIRE_META[seg.questionnaireType] : null;
  const color = isMarkt ? R : isAnfahrt || isHeimfahrt ? "#374151" : isFahrtzeit ? "rgba(0,0,0,0.32)" : isPause ? "#D97706" : smeta?.color ?? "#6b7280";
  const bg = isMarkt ? "rgba(220,38,38,0.04)" : isAnfahrt || isHeimfahrt ? "rgba(0,0,0,0.025)" : isFahrtzeit ? "transparent" : isPause ? "rgba(217,119,6,0.05)" : smeta?.bg ?? "rgba(0,0,0,0.03)";
  const Icon = isMarkt ? Store : isAnfahrt || isHeimfahrt || isFahrtzeit ? Car : isPause ? Coffee : smeta?.icon ?? Clock;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isFahrtzeit ? "5px 14px" : "8px 14px", background: bg, borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
      <div style={{ width: 68, flexShrink: 0, paddingTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={10} strokeWidth={isFahrtzeit ? 1.4 : 2} color={color} />
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color, whiteSpace: "nowrap" as const }}>
          {isFahrtzeit ? "Fahrtzeit" : isAnfahrt ? "Anfahrt" : isHeimfahrt ? "Heimfahrt" : isPause ? "Pause" : isMarkt ? "Markt" : smeta?.label ?? "Zusatz"}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: isMarkt || isAnfahrt || isHeimfahrt ? 600 : 500, color: isFahrtzeit ? "rgba(0,0,0,0.35)" : "#1a1a1a", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{seg.title}</span>
          {qmeta && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${qmeta.color}14`, color: qmeta.color, letterSpacing: "0.04em", flexShrink: 0 }}>{qmeta.label}</span>}
        </div>
        {seg.subtitle && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{seg.subtitle}</div>}
        {seg.kmNote && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{seg.kmNote}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" as const }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: isFahrtzeit ? "rgba(0,0,0,0.35)" : "#374151", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{seg.start}–{seg.end}</div>
        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{fmtDur(seg.durationMin)}</div>
      </div>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────
function StatTile({ label, value, color = "#1a1a1a" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.055)", padding: "9px 11px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
    </div>
  );
}

// ── GM Day Row (daily view) ───────────────────────────────────
function GMDayRow({ session }: { session: TimeDaySession }) {
  const [expanded, setExpanded] = useState(false);
  const stats = deriveStats(session);
  const timeline = useMemo(() => deriveTimeline(session), [session]);
  const av = gmAvatarColor(session.gmName);
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 180, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{gmInitials(session.gmName)}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>{session.gmName}</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{session.region}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{m.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ maxHeight: expanded ? "1200px" : "0", overflow: "hidden", transition: "max-height 0.36s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.22s ease 0.05s" }}>
          <div style={{ padding: "8px 18px 10px", borderTop: "1px solid rgba(0,0,0,0.045)" }}>
            <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 6 }}>
              <StatTile label="Start-KM" value={fmtKm(session.startKm)} />
              <StatTile label="End-KM" value={fmtKm(session.endKm)} />
              <StatTile label="Gefahren" value={`${stats.kmGefahren.toLocaleString("de-AT")} km`} color="#374151" />
              <StatTile label="Arbeitstag" value={fmtDur(stats.arbeitstag)} color="#1a1a1a" />
              <StatTile label="Reine AZ" value={fmtDur(stats.reineArbeitszeit)} color="#16a34a" />
              <StatTile label="Pause" value={fmtDur(stats.pauseMin)} color="#D97706" />
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {timeline.map((seg, i) => <ActionRow key={i} seg={seg} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date group (daily view) ───────────────────────────────────
function DateGroup({ dateISO, sessions }: { dateISO: string; sessions: TimeDaySession[] }) {
  const { weekday, date } = fmtDateLabel(dateISO);
  const isToday = dateISO === TODAY;
  const totalEntries = sessions.reduce((s, sess) => s + sess.entries.length, 0);
  return (
    <div>
      <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{weekday},</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{date}</span>
          {isToday && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(220,38,38,0.09)", color: R, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>Heute</span>}
        </div>
        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {sessions.length} {sessions.length === 1 ? "GM" : "GMs"} · {totalEntries} Einträge
        </span>
      </div>
      <div style={{ margin: "0 10px 16px", background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: "#fff", margin: "8px 8px 8px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {sessions.map(s => <GMDayRow key={s.id} session={s} />)}
        </div>
      </div>
    </div>
  );
}

// ── History Day Row (inside GM expansion) ────────────────────
function HistoryDayRow({ session, timeline, stats }: {
  session: TimeDaySession;
  timeline: DisplaySegment[];
  stats: ReturnType<typeof deriveStats>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { weekday, date } = fmtDateLabel(session.date);
  const isToday = session.date === TODAY;

  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      {/* Collapsed row — same column structure as daily GMDayRow */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Date identity — same width as daily identity block */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>
            {weekday}, {date}
          </div>
          {isToday && (
            <span style={{ fontSize: 7.5, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: "rgba(220,38,38,0.09)", color: R, letterSpacing: "0.05em", textTransform: "uppercase" as const, flexShrink: 0 }}>
              Heute
            </span>
          )}
        </div>

        {/* Same center metrics as daily collapsed row */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {[
            { label: "Arbeitstag", value: `${session.startTime}–${session.endTime}`, color: "#1a1a1a" },
            { label: "Reine AZ",   value: fmtDur(stats.reineArbeitszeit),            color: "#374151" },
            { label: "Pause",      value: fmtDur(stats.pauseMin),                    color: "#D97706" },
            { label: "KM",         value: `${stats.kmGefahren.toLocaleString("de-AT")} km`, color: "#374151" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Same right counts as daily row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Besuche</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.marktbesuche > 0 ? R : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.marktbesuche > 0 ? stats.marktbesuche : "—"}</div>
          </div>
          <div style={{ textAlign: "right" as const, width: 44 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>Zusatz</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: stats.zusatz > 0 ? "#2563eb" : "rgba(0,0,0,0.2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{stats.zusatz > 0 ? stats.zusatz : "—"}</div>
          </div>
          <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
        </div>
      </div>

      {/* Expanded timeline */}
      <div style={{ maxHeight: expanded ? "1000px" : "0", overflow: "hidden", transition: "max-height 0.32s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s ease 0.05s", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
          {timeline.map((seg, i) => <ActionRow key={i} seg={seg} />)}
        </div>
      </div>
    </div>
  );
}

// ── GM Ansicht Row ────────────────────────────────────────────
function GMAnsichtRow({ gm }: { gm: AggregatedGmRow }) {
  const [expanded, setExpanded] = useState(false);
  const av = gmAvatarColor(gm.gmName);

  // Build sorted history groups
  const historyGroups = useMemo(() => {
    const sorted = [...gm.sessions].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map(s => ({ session: s, timeline: deriveTimeline(s), stats: deriveStats(s) }));
  }, [gm.sessions]);

  const metrics = [
    { label: "Aktuelle KW", value: fmtDur(gm.currentKwReineArbeitszeitMin), sub: `KW ${gm.currentKwNumber}`, color: "#1a1a1a" },
    { label: "Reine AZ gesamt", value: fmtDur(gm.totalReineArbeitszeitMin), sub: `${gm.sessions.length} Tage`, color: "#374151" },
    { label: "Ø Arbeitstag", value: fmtDur(gm.averageWorkdayMin), sub: "", color: "#374151" },
    { label: "KM", value: `${gm.totalKmDriven.toLocaleString("de-AT")} km`, sub: "", color: "#374151" },
    { label: "Privatnutzung", value: gm.privatnutzungKm > 0 ? `${gm.privatnutzungKm} km` : "—", sub: "", color: gm.privatnutzungKm > 0 ? R : "rgba(0,0,0,0.2)" },
  ];

  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      {/* Collapsed row */}
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

        {/* Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 180, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{gmInitials(gm.gmName)}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.015em", whiteSpace: "nowrap" as const }}>{gm.gmName}</div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{gm.region}</div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
          {metrics.map(m => (
            <div key={m.label} style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const, lineHeight: 1.3 }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.32)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        <ChevronDown size={14} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
      </div>

      {/* Expanded history */}
      <div style={{ maxHeight: expanded ? "1600px" : "0", overflow: "hidden", transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.22s ease 0.06s" }}>

          {/* Summary strip */}
          <div style={{ padding: "8px 18px 10px", borderTop: "1px solid rgba(0,0,0,0.045)" }}>
            <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 6 }}>
              <StatTile label={`KW ${gm.currentKwNumber}`} value={fmtDur(gm.currentKwReineArbeitszeitMin)} color="#1a1a1a" />
              <StatTile label="Reine AZ gesamt" value={fmtDur(gm.totalReineArbeitszeitMin)} color="#16a34a" />
              <StatTile label="Ø Arbeitstag" value={fmtDur(gm.averageWorkdayMin)} color="#374151" />
              <StatTile label="KM gesamt" value={`${gm.totalKmDriven.toLocaleString("de-AT")} km`} color="#374151" />
              <StatTile label="Privatnutzung" value={gm.privatnutzungKm > 0 ? `${gm.privatnutzungKm} km` : "—"} color={gm.privatnutzungKm > 0 ? R : "rgba(0,0,0,0.25)"} />
              <StatTile label="Tage erfasst" value={`${gm.sessions.length}`} color="#374151" />
            </div>
          </div>

          {/* Historical date blocks — each day is its own collapsible row */}
          <div className="map-scroll" style={{ maxHeight: 800, overflowY: "auto", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            {historyGroups.map(({ session, timeline, stats }) => (
              <HistoryDayRow key={session.id} session={session} timeline={timeline} stats={stats} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function ZeiterfassungPage() {
  const [view, setView] = useState<"tage" | "gm">("tage");
  const [search, setSearch] = useState("");

  // Daily view: group by date, newest first
  const dateGroups = useMemo(() => {
    if (view !== "tage") return [];
    const filtered = SEED_SESSIONS.filter(s =>
      !search.trim() ||
      s.gmName.toLowerCase().includes(search.toLowerCase()) ||
      s.entries.some(e => e.marketName?.toLowerCase().includes(search.toLowerCase()))
    );
    const map = new Map<string, TimeDaySession[]>();
    filtered.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, sessions]) => ({ date, sessions }));
  }, [view, search]);

  // GM view: aggregate per GM
  const gmRows = useMemo(() => {
    if (view !== "gm") return [];
    const filtered = SEED_SESSIONS.filter(s =>
      !search.trim() || s.gmName.toLowerCase().includes(search.toLowerCase())
    );
    return aggregateGms(filtered).sort((a, b) => a.gmName.localeCompare(b.gmName));
  }, [view, search]);

  const totalDays = dateGroups.length;
  const totalGmDays = dateGroups.reduce((s, g) => s + g.sessions.length, 0);

  const isBodyEmpty = view === "tage" ? dateGroups.length === 0 : gmRows.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes ztFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ztBodyFade { from { opacity:0 } to { opacity:1 } }
        .zt-main { animation: ztFadeIn 0.25s ease both; }
        .zt-body { animation: ztBodyFade 0.2s ease both; }
      `}</style>

      <div className="zt-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>

        {/* Grey header */}
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>Zeiterfassung</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
            {view === "tage"
              ? `${totalDays} ${totalDays === 1 ? "Tag" : "Tage"} · ${totalGmDays} GM-Tage`
              : `${gmRows.length} ${gmRows.length === 1 ? "GM" : "GMs"}`}
          </span>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12 }}>

            {/* View switcher — two tabs only */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 2 }}>
              {([
                { key: "tage", label: "Tage" },
                { key: "gm",   label: "GM Ansicht" },
              ] as const).map(v => (
                <div key={v.key} onClick={() => { setView(v.key); setSearch(""); }}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: view === v.key ? "#fff" : "transparent", color: view === v.key ? "#1a1a1a" : "rgba(0,0,0,0.38)", boxShadow: view === v.key ? "0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0.5px rgba(255,255,255,0.9)" : "none", cursor: "pointer", transition: "all 0.15s", userSelect: "none" as const, whiteSpace: "nowrap" as const }}>
                  {v.label}
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 220px", transition: "border 0.15s, background 0.15s" }}
              onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
              <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
              <input type="text" placeholder={view === "tage" ? "GM / Markt suchen…" : "GM suchen…"} value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
            </div>
          </div>

          {/* Body — fade key forces re-mount on tab switch */}
          <div key={view} className="zt-body">
            {isBodyEmpty ? (
              <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" as const }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={22} strokeWidth={1.5} color={R} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>
                    {search ? "Keine Einträge gefunden." : "Noch keine Zeiterfassungseinträge."}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 320, lineHeight: 1.6 }}>
                    {search ? "Versuche einen anderen Suchbegriff." : "Sobald GMs ihren Arbeitstag starten, erscheinen die Einträge hier."}
                  </div>
                </div>
              </div>
            ) : view === "tage" ? (
              <div style={{ padding: "4px 0 0" }}>
                {dateGroups.map(g => <DateGroup key={g.date} dateISO={g.date} sessions={g.sessions} />)}
              </div>
            ) : (
              <div>
                {/* Column header for GM view */}
                <div style={{ padding: "6px 18px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ minWidth: 180, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-evenly" }}>
                    {["Aktuelle KW", "Reine AZ gesamt", "Ø Arbeitstag", "KM", "Privatnutzung"].map(h => (
                      <span key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.28)" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ width: 22 }} />
                </div>
                {/* GM rows */}
                <div>
                  {gmRows.map(gm => <GMAnsichtRow key={gm.gmId} gm={gm} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
