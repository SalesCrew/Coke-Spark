"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, TrendingUp, ChevronDown, ChevronRight, Info } from "lucide-react";
import type {
  IppSubmission, IppQuestionAnswer, IppMarketAuditRecord,
  IppQuestionAuditRow, IppAverageSummary, SectionType,
} from "@/types/ipp";

// ── Constants ─────────────────────────────────────────────────
const R = "#DC2626";
const GREEN = "#16a34a";

const SECTION_META: Record<SectionType, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard",  color: "#DC2626", bg: "rgba(220,38,38,0.08)"  },
  flex:     { label: "Flex",      color: "#65a30d", bg: "rgba(132,204,22,0.08)" },
  mhd:      { label: "MHD",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  kuehler:  { label: "Kühler",    color: "#D97706", bg: "rgba(245,158,11,0.08)" },
  billa:    { label: "Billa",     color: "#0891B2", bg: "rgba(8,145,178,0.08)"  },
};

// ── Helpers ───────────────────────────────────────────────────
function fmtIpp(v: number): string {
  return v.toFixed(2);
}
function chainInitials(name: string): { bg: string; text: string } {
  const k = name.toUpperCase();
  if (k.includes("BILLA"))  return { bg: "rgba(234,179,8,0.10)",  text: "#a16207" };
  if (k.includes("SPAR"))   return { bg: "rgba(220,38,38,0.08)",  text: "#DC2626" };
  if (k.includes("MERKUR")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  if (k.includes("PENNY"))  return { bg: "rgba(194,65,12,0.08)",  text: "#c2410c" };
  if (k.includes("HOFER"))  return { bg: "rgba(16,185,129,0.08)", text: "#065f46" };
  if (k.includes("ADEG"))   return { bg: "rgba(34,197,94,0.08)",  text: "#15803d" };
  return { bg: "rgba(0,0,0,0.05)", text: "#6b7280" };
}

// ── Question fingerprint ──────────────────────────────────────
function buildFingerprint(q: IppQuestionAnswer): string {
  const normalized = q.questionText.trim().toLowerCase().replace(/\s+/g, " ");
  const opts = (q.options ?? []).map(o => o.trim().toLowerCase()).sort().join("|");
  const scoring = Object.entries(q.scoringMap).map(([k, v]) => `${k}:${v}`).sort().join("|");
  return `${normalized}::${q.questionType}::${opts}::${scoring}`;
}

// ── Compute applied IPP for a single question+answer ──────────
function computeAppliedIpp(q: IppQuestionAnswer): number {
  const ans = q.selectedAnswer;
  if (q.questionType === "numeric") {
    const factor = q.scoringMap["__value__"] ?? 0;
    const val = parseFloat(typeof ans === "string" ? ans : ans[0] ?? "0");
    return isNaN(val) ? 0 : val * factor;
  }
  if (q.questionType === "yesno") {
    const key = typeof ans === "string" ? ans : ans[0] ?? "";
    return q.scoringMap[key] ?? 0;
  }
  if (q.questionType === "single") {
    const key = typeof ans === "string" ? ans : ans[0] ?? "";
    return q.scoringMap[key] ?? 0;
  }
  if (q.questionType === "multiple") {
    const keys = Array.isArray(ans) ? ans : [ans];
    return keys.reduce((s, k) => s + (q.scoringMap[k] ?? 0), 0);
  }
  return 0;
}

// ── Build normalized audit records from raw submissions ───────
function buildAuditRecords(submissions: IppSubmission[]): IppMarketAuditRecord[] {
  // Group by marketId × redMonatLabel
  const groupMap = new Map<string, IppSubmission[]>();
  for (const sub of submissions) {
    const key = `${sub.marketId}::${sub.redMonatLabel}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(sub);
  }

  const records: IppMarketAuditRecord[] = [];
  groupMap.forEach((subs, key) => {
    const base = subs[0];
    // Collect all questions across all submissions for this market×redMonat
    // Key: fingerprint → best answer (last submission wins)
    const fpMap = new Map<string, {
      q: IppQuestionAnswer;
      sections: Set<SectionType>;
      fragebogen: Set<string>;
    }>();

    for (const sub of subs) {
      for (const qa of sub.questionAnswers) {
        const fp = buildFingerprint(qa);
        if (!fpMap.has(fp)) {
          fpMap.set(fp, { q: qa, sections: new Set(), fragebogen: new Set() });
        }
        const entry = fpMap.get(fp)!;
        // Always update to latest answer (last submission wins)
        entry.q = qa;
        entry.sections.add(sub.sectionType);
        entry.fragebogen.add(sub.fragebogenName);
      }
    }

    // Build question audit rows
    const questionRows: IppQuestionAuditRow[] = [];
    fpMap.forEach((entry, fp) => {
      const ipp = computeAppliedIpp(entry.q);
      const deduped = entry.sections.size > 1 || entry.fragebogen.size > 1;
      const hasScore = Object.keys(entry.q.scoringMap).length > 0;
      let counted = hasScore && ipp > 0;
      let countedReason = counted
        ? "IPP-Wert vergeben und Antwort > 0"
        : !hasScore
        ? "Keine IPP-Bewertung für diese Frage"
        : "Gewählte Antwort ergibt IPP 0";

      if (deduped) {
        countedReason = counted
          ? `1 Antwort für RED Monat übernommen (${entry.sections.size} Sektionen)`
          : `Duplizierte Frage, Antwort ergibt IPP 0`;
      }

      questionRows.push({
        questionFingerprint: fp,
        questionText: entry.q.questionText,
        questionType: entry.q.questionType,
        selectedAnswer: entry.q.selectedAnswer,
        appliedIppValue: ipp,
        counted,
        countedReason,
        sourceSections: Array.from(entry.sections),
        sourceFrageboegen: Array.from(entry.fragebogen),
        deduped,
      });
    });

    // Sort: counted first, then descending IPP
    questionRows.sort((a, b) => {
      if (a.counted !== b.counted) return a.counted ? -1 : 1;
      return b.appliedIppValue - a.appliedIppValue;
    });

    const marketIpp = questionRows
      .filter(r => r.counted)
      .reduce((s, r) => s + r.appliedIppValue, 0);

    records.push({
      id: key,
      marketId: base.marketId,
      marketName: base.marketName,
      chain: base.chain,
      region: base.region,
      postalCode: base.postalCode,
      city: base.city,
      gmName: base.gmName,
      redMonatLabel: base.redMonatLabel,
      marketIpp: Math.round(marketIpp * 100) / 100,
      includedInAverage: marketIpp > 0,
      questionRows,
      submissionRefs: subs.map(s => ({
        sectionType: s.sectionType,
        fragebogenName: s.fragebogenName,
        submittedAt: s.submittedAt,
      })),
    });
  });

  return records.sort((a, b) => b.marketIpp - a.marketIpp);
}

function buildSummary(records: IppMarketAuditRecord[]): IppAverageSummary {
  const included = records.filter(r => r.includedInAverage);
  const excluded = records.filter(r => !r.includedInAverage);
  const numeratorTotal = included.reduce((s, r) => s + r.marketIpp, 0);
  const denominatorIncludedMarkets = included.length;
  const averageIpp = denominatorIncludedMarkets > 0
    ? Math.round((numeratorTotal / denominatorIncludedMarkets) * 100) / 100
    : 0;
  const contributingQuestionCount = included.reduce(
    (s, r) => s + r.questionRows.filter(q => q.counted).length, 0
  );
  return {
    averageIpp,
    numeratorTotal: Math.round(numeratorTotal * 100) / 100,
    denominatorIncludedMarkets,
    excludedZeroMarkets: excluded.length,
    contributingQuestionCount,
    totalMarkets: records.length,
  };
}

// ── Seed Data ─────────────────────────────────────────────────
// IPP scoring maps for common placement questions
const Y: Record<"Ja"|"Nein", number> = { Ja: 0.6, Nein: 0 };
const PLACEMENT_OPTS: Record<string, number> = {
  "Ja, vollständig": 0.8, "Ja, teilweise": 0.4, "Nein": 0,
};
const STANDORT_OPTS: Record<string, number> = {
  "Eingang": 0.8, "Kasse": 0.65, "Mitte": 0.4, "Nicht vorhanden": 0,
};
const ZUSTAND_OPTS: Record<string, number> = {
  "Sehr gut": 0.8, "Gut": 0.65, "Ausreichend": 0.15, "Mangelhaft": 0,
};
const KUEHLER_OPTS: Record<string, number> = {
  "Sehr voll": 0.4, "Halb voll": 0.2, "Nicht voll": 0.05, "Leer": 0,
};
const POS_OPTS: Record<string, number> = {
  "Vollständig vorhanden": 0.65, "Teilweise vorhanden": 0.3, "Nicht vorhanden": 0,
};

// Helper to build common standard questions for a market
function stdQuestions(placementAns: string, standortAns: string, zustandAns: string, plakateAns: string, posAns: string): IppQuestionAnswer[] {
  return [
    {
      questionId: "std_q1",
      questionText: "Ist ein Coca-Cola Display platziert?",
      questionType: "single",
      options: ["Ja, vollständig", "Ja, teilweise", "Nein"],
      scoringMap: PLACEMENT_OPTS,
      selectedAnswer: placementAns,
    },
    {
      questionId: "std_q2",
      questionText: "Standort des Hauptdisplays",
      questionType: "single",
      options: ["Eingang", "Kasse", "Mitte", "Nicht vorhanden"],
      scoringMap: STANDORT_OPTS,
      selectedAnswer: standortAns,
    },
    {
      questionId: "std_q3",
      questionText: "Zustand der Platzierung",
      questionType: "single",
      options: ["Sehr gut", "Gut", "Ausreichend", "Mangelhaft"],
      scoringMap: ZUSTAND_OPTS,
      selectedAnswer: zustandAns,
    },
    {
      questionId: "std_q4",
      questionText: "Sind aktuelle Preisschilder vorhanden?",
      questionType: "yesno",
      scoringMap: { Ja: 0.6, Nein: 0 },
      selectedAnswer: "Ja",
    },
    {
      questionId: "std_q5",
      questionText: "Plakate / Aufkleber korrekt angebracht?",
      questionType: "yesno",
      scoringMap: { Ja: 0.6, Nein: 0 },
      selectedAnswer: plakateAns,
    },
    {
      questionId: "std_q6",
      questionText: "POS-Material vollständig?",
      questionType: "single",
      options: ["Vollständig vorhanden", "Teilweise vorhanden", "Nicht vorhanden"],
      scoringMap: POS_OPTS,
      selectedAnswer: posAns,
    },
    {
      questionId: "std_q7",
      questionText: "Anzahl Facings Coca-Cola 1.5L",
      questionType: "numeric",
      scoringMap: { "__value__": 0.08 },
      selectedAnswer: "6",
    },
    {
      questionId: "std_q8",
      questionText: "Anzahl Facings Coca-Cola Zero 1L",
      questionType: "numeric",
      scoringMap: { "__value__": 0.08 },
      selectedAnswer: "4",
    },
    {
      questionId: "std_q9",
      questionText: "Promotionartikel im Aktionsregal?",
      questionType: "yesno",
      scoringMap: { Ja: 0.6, Nein: 0 },
      selectedAnswer: "Ja",
    },
    {
      questionId: "std_q10",
      questionText: "Saisonale Aktionsfläche bespielt?",
      questionType: "yesno",
      scoringMap: { Ja: 0.6, Nein: 0 },
      selectedAnswer: "Nein",
    },
  ];
}

function flexQuestions(placementAns: string, standortAns: string): IppQuestionAnswer[] {
  return [
    // Shared question — same text/scoring as std_q1 → will be deduped
    {
      questionId: "flex_q1",
      questionText: "Ist ein Coca-Cola Display platziert?",
      questionType: "single",
      options: ["Ja, vollständig", "Ja, teilweise", "Nein"],
      scoringMap: PLACEMENT_OPTS,
      selectedAnswer: placementAns,
    },
    {
      questionId: "flex_q2",
      questionText: "Standort des Hauptdisplays",
      questionType: "single",
      options: ["Eingang", "Kasse", "Mitte", "Nicht vorhanden"],
      scoringMap: STANDORT_OPTS,
      selectedAnswer: standortAns,
    },
    {
      questionId: "flex_q3",
      questionText: "Flex-Aktionsfläche korrekt aufgebaut?",
      questionType: "yesno",
      scoringMap: { Ja: 0.2, Nein: 0 },
      selectedAnswer: "Ja",
    },
    {
      questionId: "flex_q4",
      questionText: "Aktionsartikel vollständig vorhanden?",
      questionType: "yesno",
      scoringMap: { Ja: 0.2, Nein: 0 },
      selectedAnswer: "Ja",
    },
  ];
}

function kuehlerQuestions(kuehlerAns: string, sauberAns: "Ja" | "Nein"): IppQuestionAnswer[] {
  return [
    {
      questionId: "kue_q1",
      questionText: "Befüllungsgrad Hauptkühler Coca-Cola",
      questionType: "single",
      options: ["Sehr voll", "Halb voll", "Nicht voll", "Leer"],
      scoringMap: KUEHLER_OPTS,
      selectedAnswer: kuehlerAns,
    },
    {
      questionId: "kue_q2",
      questionText: "Kühler sauber und gepflegt?",
      questionType: "yesno",
      scoringMap: { Ja: 0.2, Nein: 0 },
      selectedAnswer: sauberAns,
    },
    {
      questionId: "kue_q3",
      questionText: "Planogramm eingehalten?",
      questionType: "yesno",
      scoringMap: { Ja: 0.2, Nein: 0 },
      selectedAnswer: "Ja",
    },
  ];
}

function mhdQuestions(): IppQuestionAnswer[] {
  return [
    {
      questionId: "mhd_q1",
      questionText: "MHD-Kontrolle durchgeführt und dokumentiert?",
      questionType: "yesno",
      scoringMap: { Ja: 0.25, Nein: 0 },
      selectedAnswer: "Ja",
    },
    {
      questionId: "mhd_q2",
      questionText: "Abgelaufene Artikel entfernt?",
      questionType: "yesno",
      scoringMap: { Ja: 0.15, Nein: 0 },
      selectedAnswer: "Ja",
    },
  ];
}

const SEED_SUBMISSIONS: IppSubmission[] = [
  // ── RED 28 ──────────────────────────────────────────────────
  // MK1: BILLA Favoriten — Standard + Flex + Kühler (multi-section, shared question deduped)
  {
    id: "sub-mk1-std-28", marketId: "mk1", marketName: "BILLA Wien Favoriten", chain: "BILLA",
    postalCode: "1100", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-02T09:52:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk1-flex-28", marketId: "mk1", marketName: "BILLA Wien Favoriten", chain: "BILLA",
    postalCode: "1100", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "flex", fragebogenName: "Flex Fragebogen Q2 2026",
    submittedAt: "2026-04-02T10:05:00Z",
    questionAnswers: flexQuestions("Ja, vollständig", "Eingang"),
  },
  {
    id: "sub-mk1-kue-28", marketId: "mk1", marketName: "BILLA Wien Favoriten", chain: "BILLA",
    postalCode: "1100", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q2 2026",
    submittedAt: "2026-04-02T10:20:00Z",
    questionAnswers: kuehlerQuestions("Sehr voll", "Ja"),
  },
  // MK2: BILLA Meidling — Standard + Flex
  {
    id: "sub-mk2-std-28", marketId: "mk2", marketName: "BILLA Wien Meidling", chain: "BILLA",
    postalCode: "1120", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-02T11:05:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk2-flex-28", marketId: "mk2", marketName: "BILLA Wien Meidling", chain: "BILLA",
    postalCode: "1120", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "flex", fragebogenName: "Flex Fragebogen Q2 2026",
    submittedAt: "2026-04-02T11:20:00Z",
    questionAnswers: flexQuestions("Ja, vollständig", "Eingang"),
  },
  // MK3: MERKUR Graz Hauptplatz — Standard + Kühler + MHD
  {
    id: "sub-mk3-std-28", marketId: "mk3", marketName: "MERKUR Graz Hauptplatz", chain: "MERKUR",
    postalCode: "8010", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-03T09:40:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk3-kue-28", marketId: "mk3", marketName: "MERKUR Graz Hauptplatz", chain: "MERKUR",
    postalCode: "8010", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q2 2026",
    submittedAt: "2026-04-03T10:00:00Z",
    questionAnswers: kuehlerQuestions("Sehr voll", "Ja"),
  },
  {
    id: "sub-mk3-mhd-28", marketId: "mk3", marketName: "MERKUR Graz Hauptplatz", chain: "MERKUR",
    postalCode: "8010", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "mhd", fragebogenName: "MHD Check Q2 2026",
    submittedAt: "2026-04-03T10:15:00Z",
    questionAnswers: mhdQuestions(),
  },
  // MK4: SPAR Linz Nord — Standard only (weak IPP)
  {
    id: "sub-mk4-std-28", marketId: "mk4", marketName: "SPAR Linz Nord", chain: "SPAR",
    postalCode: "4020", city: "Linz", region: "West", gmId: "gm-seed-3", gmName: "Markus Steiner",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-04T09:00:00Z",
    questionAnswers: stdQuestions("Ja, teilweise", "Kasse", "Gut", "Ja", "Teilweise vorhanden"),
  },
  // MK5: BILLA Wien Mariahilf — Standard + Flex + Kühler
  {
    id: "sub-mk5-std-28", marketId: "mk5", marketName: "BILLA Wien Mariahilf", chain: "BILLA",
    postalCode: "1060", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-02T12:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk5-kue-28", marketId: "mk5", marketName: "BILLA Wien Mariahilf", chain: "BILLA",
    postalCode: "1060", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q2 2026",
    submittedAt: "2026-04-02T12:15:00Z",
    questionAnswers: kuehlerQuestions("Halb voll", "Ja"),
  },
  // MK6: BILLA Mödling — Standard (IPP = 0, excluded)
  {
    id: "sub-mk6-std-28", marketId: "mk6", marketName: "BILLA Mödling", chain: "BILLA",
    postalCode: "2340", city: "Mödling", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-03T14:30:00Z",
    questionAnswers: [
      {
        questionId: "std_q1", questionText: "Ist ein Coca-Cola Display platziert?",
        questionType: "single", options: ["Ja, vollständig", "Ja, teilweise", "Nein"],
        scoringMap: PLACEMENT_OPTS, selectedAnswer: "Nein",
      },
      {
        questionId: "std_q2", questionText: "Standort des Hauptdisplays",
        questionType: "single", options: ["Eingang", "Kasse", "Mitte", "Nicht vorhanden"],
        scoringMap: STANDORT_OPTS, selectedAnswer: "Nicht vorhanden",
      },
      {
        questionId: "std_q3", questionText: "Zustand der Platzierung",
        questionType: "single", options: ["Sehr gut", "Gut", "Ausreichend", "Mangelhaft"],
        scoringMap: ZUSTAND_OPTS, selectedAnswer: "Mangelhaft",
      },
      {
        questionId: "std_q5", questionText: "Plakate / Aufkleber korrekt angebracht?",
        questionType: "yesno", scoringMap: { Ja: 0.6, Nein: 0 }, selectedAnswer: "Nein",
      },
      {
        questionId: "std_q6", questionText: "POS-Material vollständig?",
        questionType: "single", options: ["Vollständig vorhanden", "Teilweise vorhanden", "Nicht vorhanden"],
        scoringMap: POS_OPTS, selectedAnswer: "Nicht vorhanden",
      },
      {
        questionId: "std_q7", questionText: "Anzahl Facings Coca-Cola 1.5L",
        questionType: "numeric", scoringMap: { "__value__": 0.08 }, selectedAnswer: "0",
      },
    ],
  },
  // MK7: MERKUR Wien Donaustadt — Standard + Flex + Kühler (very strong IPP)
  {
    id: "sub-mk7-std-28", marketId: "mk7", marketName: "MERKUR Wien Donaustadt", chain: "MERKUR",
    postalCode: "1220", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-04T09:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk7-flex-28", marketId: "mk7", marketName: "MERKUR Wien Donaustadt", chain: "MERKUR",
    postalCode: "1220", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "flex", fragebogenName: "Flex Fragebogen Q2 2026",
    submittedAt: "2026-04-04T09:15:00Z",
    questionAnswers: flexQuestions("Ja, vollständig", "Eingang"),
  },
  {
    id: "sub-mk7-kue-28", marketId: "mk7", marketName: "MERKUR Wien Donaustadt", chain: "MERKUR",
    postalCode: "1220", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q2 2026",
    submittedAt: "2026-04-04T09:30:00Z",
    questionAnswers: kuehlerQuestions("Sehr voll", "Ja"),
  },
  // MK8: SPAR Graz West — Standard + Kühler (Anna Gruber)
  {
    id: "sub-mk8-std-28", marketId: "mk8", marketName: "SPAR Graz West", chain: "SPAR",
    postalCode: "8051", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-03T11:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk8-kue-28", marketId: "mk8", marketName: "SPAR Graz West", chain: "SPAR",
    postalCode: "8051", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q2 2026",
    submittedAt: "2026-04-03T11:20:00Z",
    questionAnswers: kuehlerQuestions("Halb voll", "Ja"),
  },
  // MK9: BILLA Baden — Standard only (mid IPP)
  {
    id: "sub-mk9-std-28", marketId: "mk9", marketName: "BILLA Baden", chain: "BILLA",
    postalCode: "2500", city: "Baden", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-05T10:00:00Z",
    questionAnswers: stdQuestions("Ja, teilweise", "Kasse", "Gut", "Ja", "Teilweise vorhanden"),
  },
  // MK10: HOFER Klagenfurt West — Standard (Michael Berger, Süd)
  {
    id: "sub-mk10-std-28", marketId: "mk10", marketName: "HOFER Klagenfurt West", chain: "HOFER",
    postalCode: "9020", city: "Klagenfurt", region: "Süd", gmId: "gm-seed-5", gmName: "Michael Berger",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-06T09:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  // MK11: BILLA Wien Schönbrunn — Standard + Billa
  {
    id: "sub-mk11-std-28", marketId: "mk11", marketName: "BILLA Wien Schönbrunn", chain: "BILLA",
    postalCode: "1050", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-06T10:30:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk11-billa-28", marketId: "mk11", marketName: "BILLA Wien Schönbrunn", chain: "BILLA",
    postalCode: "1050", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 28", sectionType: "billa", fragebogenName: "Billa Fragebogen Q2 2026",
    submittedAt: "2026-04-06T10:45:00Z",
    questionAnswers: [
      {
        questionId: "bil_q1", questionText: "Billa Aktionsfläche mit Coca-Cola Produkten?",
        questionType: "yesno", scoringMap: { Ja: 0.35, Nein: 0 }, selectedAnswer: "Ja",
      },
      {
        questionId: "bil_q2", questionText: "Billa-spezifisches Regal optimal befüllt?",
        questionType: "single", options: ["Vollständig vorhanden", "Teilweise vorhanden", "Nicht vorhanden"],
        scoringMap: POS_OPTS, selectedAnswer: "Vollständig vorhanden",
      },
      {
        questionId: "bil_q3", questionText: "Sonderplatzierung Billa aktiv?",
        questionType: "yesno", scoringMap: { Ja: 0.3, Nein: 0 }, selectedAnswer: "Ja",
      },
    ],
  },
  // MK12: PENNY Wien — Standard (Lisa Wagner, Nord)
  {
    id: "sub-mk12-std-28", marketId: "mk12", marketName: "PENNY Wien Nord", chain: "PENNY",
    postalCode: "1210", city: "Wien", region: "Nord", gmId: "gm-seed-4", gmName: "Lisa Wagner",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-05T11:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Gut", "Ja", "Teilweise vorhanden"),
  },
  // MK13: ADEG Graz Straßgang — Standard + MHD (Anna Gruber, Süd)
  {
    id: "sub-mk13-std-28", marketId: "mk13", marketName: "ADEG Graz Straßgang", chain: "ADEG",
    postalCode: "8054", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "standard", fragebogenName: "Standard Fragebogen Q2 2026",
    submittedAt: "2026-04-03T15:00:00Z",
    questionAnswers: stdQuestions("Ja, teilweise", "Eingang", "Gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk13-mhd-28", marketId: "mk13", marketName: "ADEG Graz Straßgang", chain: "ADEG",
    postalCode: "8054", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 28", sectionType: "mhd", fragebogenName: "MHD Check Q2 2026",
    submittedAt: "2026-04-03T15:15:00Z",
    questionAnswers: mhdQuestions(),
  },

  // ── RED 27 ──────────────────────────────────────────────────
  // MK1 in RED 27 — different answers (slightly lower IPP)
  {
    id: "sub-mk1-std-27", marketId: "mk1", marketName: "BILLA Wien Favoriten", chain: "BILLA",
    postalCode: "1100", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 27", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1 2026",
    submittedAt: "2026-03-18T09:52:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Gut", "Ja", "Vollständig vorhanden"),
  },
  {
    id: "sub-mk1-kue-27", marketId: "mk1", marketName: "BILLA Wien Favoriten", chain: "BILLA",
    postalCode: "1100", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 27", sectionType: "kuehler", fragebogenName: "Kühler Inventur Q1 2026",
    submittedAt: "2026-03-18T10:10:00Z",
    questionAnswers: kuehlerQuestions("Halb voll", "Ja"),
  },
  // MK3 in RED 27
  {
    id: "sub-mk3-std-27", marketId: "mk3", marketName: "MERKUR Graz Hauptplatz", chain: "MERKUR",
    postalCode: "8010", city: "Graz", region: "Süd", gmId: "gm-seed-2", gmName: "Anna Gruber",
    redMonatLabel: "RED 27", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1 2026",
    submittedAt: "2026-03-20T09:40:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
  // MK7 in RED 27
  {
    id: "sub-mk7-std-27", marketId: "mk7", marketName: "MERKUR Wien Donaustadt", chain: "MERKUR",
    postalCode: "1220", city: "Wien", region: "Ost", gmId: "gm-seed-1", gmName: "Thomas Huber",
    redMonatLabel: "RED 27", sectionType: "standard", fragebogenName: "Standard Fragebogen Q1 2026",
    submittedAt: "2026-03-22T09:00:00Z",
    questionAnswers: stdQuestions("Ja, vollständig", "Eingang", "Sehr gut", "Ja", "Vollständig vorhanden"),
  },
];

const ALL_AUDIT_RECORDS = buildAuditRecords(SEED_SUBMISSIONS);

// ── Filter options derived from records ───────────────────────
const ALL_REGIONS   = [...new Set(ALL_AUDIT_RECORDS.map(r => r.region))].sort();
const ALL_GMS       = [...new Set(ALL_AUDIT_RECORDS.map(r => r.gmName))].sort();
const ALL_CHAINS    = [...new Set(ALL_AUDIT_RECORDS.map(r => r.chain))].sort();
const ALL_RED_MONATS= [...new Set(ALL_AUDIT_RECORDS.map(r => r.redMonatLabel))].sort((a, b) => b.localeCompare(a));

// ── Small UI helpers ──────────────────────────────────────────
function SectionPill({ type }: { type: SectionType }) {
  const m = SECTION_META[type];
  return (
    <span style={{ fontSize: 8.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: m.bg, color: m.color, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>
      {m.label}
    </span>
  );
}

function StatTile({ label, value, color = "#1a1a1a", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.055)", padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" as const }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", fontVariantNumeric: "tabular-nums" }}>{sub}</span>}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 600, background: "rgba(220,38,38,0.07)", color: R, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
      {label}<X size={7} strokeWidth={2.5} />
    </button>
  );
}

// ── Inspector ─────────────────────────────────────────────────
function QuestionAuditRow({ row }: { row: IppQuestionAuditRow }) {
  const answerStr = Array.isArray(row.selectedAnswer)
    ? row.selectedAnswer.join(", ")
    : row.selectedAnswer;

  const isNumeric = row.questionType === "numeric";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "9px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
    }}>
      {/* Left: type badge */}
      <div style={{ width: 52, flexShrink: 0, paddingTop: 1 }}>
        <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 4, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.45)" }}>
          {isNumeric ? "Zahl" : row.questionType === "yesno" ? "Ja/N" : "Wahl"}
        </span>
      </div>

      {/* Center: question + answer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 3 }}>{row.questionText}</div>
        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: row.deduped ? 4 : 0 }}>
          Antwort: <span style={{ fontWeight: 600, color: "#374151" }}>{answerStr}</span>
          {isNumeric && row.appliedIppValue > 0 && (
            <span style={{ color: "rgba(0,0,0,0.38)", marginLeft: 6 }}>
              ({answerStr} × {Object.values(row.questionFingerprint.match(/\d+(\.\d+)?/g) ?? []).slice(-1)[0] ?? "?"} Faktor)
            </span>
          )}
        </div>
        {row.deduped && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Info size={9} strokeWidth={2} color="rgba(0,0,0,0.3)" />
            <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontStyle: "italic" }}>
              {row.countedReason}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
          {row.sourceSections.map(s => <SectionPill key={s} type={s} />)}
        </div>
      </div>

      {/* Right: IPP value */}
      <div style={{ flexShrink: 0, textAlign: "right" as const, minWidth: 52 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: row.counted && row.appliedIppValue > 0 ? GREEN : "rgba(0,0,0,0.22)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {row.counted && row.appliedIppValue > 0 ? `+${fmtIpp(row.appliedIppValue)}` : "—"}
        </div>
      </div>
    </div>
  );
}

function MarketInspector({ record }: { record: IppMarketAuditRecord | null }) {
  const [ignoredOpen, setIgnoredOpen] = useState(false);

  if (!record) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center" as const, maxWidth: 240 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <TrendingUp size={20} strokeWidth={1.5} color={R} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 5 }}>Markt auswählen</div>
          <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Klicke auf einen Markt in der Liste um die IPP-Berechnung zu prüfen.</div>
        </div>
      </div>
    );
  }

  const counted   = record.questionRows.filter(r => r.counted && r.appliedIppValue > 0);
  const ignored   = record.questionRows.filter(r => !r.counted || r.appliedIppValue === 0);
  const deduped   = record.questionRows.filter(r => r.deduped).length;
  const ci        = chainInitials(record.chain);
  const sections  = [...new Set(record.submissionRefs.map(s => s.sectionType))];
  const frageOgen = [...new Set(record.submissionRefs.map(s => s.fragebogenName))];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Inspector header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 5, background: ci.bg, color: ci.text, letterSpacing: "0.04em", textTransform: "uppercase" as const, flexShrink: 0 }}>
              {record.chain}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{record.marketName}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 1 }}>{record.postalCode} {record.city} · {record.region} · {record.gmName}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: record.includedInAverage ? GREEN : "rgba(0,0,0,0.35)", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {fmtIpp(record.marketIpp)}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, marginTop: 3, color: record.includedInAverage ? GREEN : "rgba(0,0,0,0.4)" }}>
              {record.includedInAverage ? "Im Durchschnitt" : "Ausgeschlossen (0)"}
            </div>
          </div>
        </div>

        {/* RED Monat + source summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "rgba(220,38,38,0.08)", color: R, letterSpacing: "0.04em" }}>
            {record.redMonatLabel}
          </span>
          {sections.map(s => <SectionPill key={s} type={s} />)}
          <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>
            {frageOgen.length} {frageOgen.length === 1 ? "Fragebogen" : "Fragebögen"} · {record.questionRows.length} IPP-relevante Fragen
          </span>
        </div>
      </div>

      {/* Summary stat strip */}
      <div style={{ padding: "10px 20px 8px", borderBottom: "1px solid rgba(0,0,0,0.04)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.055)", borderRadius: 9, padding: 5 }}>
          <StatTile label="Markt IPP" value={fmtIpp(record.marketIpp)} color={record.includedInAverage ? GREEN : "rgba(0,0,0,0.35)"} />
          <StatTile label="Gezählt" value={String(counted.length)} color="#1a1a1a" sub={`${fmtIpp(counted.reduce((s, r) => s + r.appliedIppValue, 0))} Punkte`} />
          <StatTile label="Kein IPP / 0" value={String(ignored.length)} color="rgba(0,0,0,0.38)" />
          <StatTile label="Dedupl." value={String(deduped)} color={deduped > 0 ? "#D97706" : "rgba(0,0,0,0.35)"} sub={deduped > 0 ? "zusammengeführt" : "keine"} />
          <StatTile label="Sektionen" value={String(sections.length)} color="#374151" />
        </div>
      </div>

      {/* Question audit list */}
      <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>

        {/* Counted contributions */}
        {counted.length > 0 && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: GREEN, marginBottom: 4 }}>
              Gezählte Beiträge · {counted.length} Fragen
            </div>
            {counted.map((r, i) => <QuestionAuditRow key={i} row={r} />)}
          </div>
        )}

        {/* Ignored / not counted */}
        {ignored.length > 0 && (
          <div style={{ paddingTop: 10, paddingBottom: 16 }}>
            <button
              onClick={() => setIgnoredOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit" }}
            >
              {ignoredOpen ? <ChevronDown size={10} strokeWidth={2} /> : <ChevronRight size={10} strokeWidth={2} />}
              Nicht gezählt · {ignored.length} Fragen
            </button>
            <div style={{ maxHeight: ignoredOpen ? "1000px" : 0, overflow: "hidden", opacity: ignoredOpen ? 1 : 0, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease" }}>
              {ignored.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.03)", opacity: 0.6 }}>
                  <div style={{ width: 52, flexShrink: 0, paddingTop: 1 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 4, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.3)" }}>
                      {r.questionType === "numeric" ? "Zahl" : r.questionType === "yesno" ? "Ja/N" : "Wahl"}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.5)", lineHeight: 1.4, marginBottom: 2 }}>{r.questionText}</div>
                    <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontStyle: "italic" }}>{r.countedReason}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.2)", flexShrink: 0 }}>—</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter Dropdown (portal-less, inline) ─────────────────────
function FilterDropdown({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function update() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(140, r.width) });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const portal = document.getElementById(`ipp-filter-portal-${label}`);
      if (btnRef.current?.contains(e.target as Node) || portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, label]);

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid rgba(0,0,0,0.1)", background: value ? "rgba(220,38,38,0.06)" : "linear-gradient(to bottom,#fff,#f5f5f5)", color: value ? R : "rgba(0,0,0,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s", whiteSpace: "nowrap" as const, boxShadow: "inset 0 1px 0.5px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.07)" }}>
        {value ?? label}
        <ChevronDown size={9} strokeWidth={2.5} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div id={`ipp-filter-portal-${label}`} className="map-scroll" style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999, background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", padding: 4, maxHeight: 280, overflowY: "auto" }}>
          <button onMouseDown={e => { e.preventDefault(); onChange(null); setOpen(false); }}
            style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: !value ? "rgba(220,38,38,0.06)" : "transparent", color: !value ? R : "#374151", fontWeight: !value ? 600 : 400, fontFamily: "inherit" }}>
            Alle
          </button>
          {options.map(o => (
            <button key={o} onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              style={{ width: "100%", textAlign: "left" as const, padding: "6px 10px", fontSize: 11, borderRadius: 5, border: "none", cursor: "pointer", background: value === o ? "rgba(220,38,38,0.06)" : "transparent", color: value === o ? R : "#374151", fontWeight: value === o ? 600 : 400, fontFamily: "inherit" }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}>
              {o}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function IppBerechnungPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [filterGm,     setFilterGm]     = useState<string | null>(null);
  const [filterChain,  setFilterChain]  = useState<string | null>(null);
  const [filterMonat,  setFilterMonat]  = useState<string | null>(null);

  const hasFilters = !!(search || filterRegion || filterGm || filterChain || filterMonat);

  const filtered = useMemo(() => {
    return ALL_AUDIT_RECORDS.filter(r => {
      if (filterRegion && r.region !== filterRegion) return false;
      if (filterGm     && r.gmName !== filterGm)     return false;
      if (filterChain  && r.chain !== filterChain)   return false;
      if (filterMonat  && r.redMonatLabel !== filterMonat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.marketName.toLowerCase().includes(q) &&
            !r.gmName.toLowerCase().includes(q) &&
            !r.city.toLowerCase().includes(q) &&
            !r.chain.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, filterRegion, filterGm, filterChain, filterMonat]);

  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const selectedRecord = filtered.find(r => r.id === selectedId) ?? null;

  const clearFilters = () => { setSearch(""); setFilterRegion(null); setFilterGm(null); setFilterChain(null); setFilterMonat(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes ippFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .ipp-main { animation: ippFadeIn 0.25s ease both; }
        @keyframes inspFade { from { opacity:0 } to { opacity:1 } }
        .ipp-insp { animation: inspFade 0.18s ease both; }
      `}</style>

      {/* Summary strip */}
      <div className="ipp-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>IPP Österreich Übersicht</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>
            {hasFilters ? `${filtered.length} / ${ALL_AUDIT_RECORDS.length} Märkte` : `${ALL_AUDIT_RECORDS.length} Märkte`}
          </span>
        </div>
        <div style={{ margin: "0 10px 10px" }}>
          <div style={{ display: "flex", gap: 7, background: "rgba(0,0,0,0.022)", border: "1px solid rgba(0,0,0,0.055)", borderRadius: 10, padding: 6 }}>
            <StatTile
              label="IPP Ø Österreich"
              value={fmtIpp(summary.averageIpp)}
              color={summary.averageIpp > 0 ? GREEN : "rgba(0,0,0,0.3)"}
              sub={`${fmtIpp(summary.numeratorTotal)} ÷ ${summary.denominatorIncludedMarkets} Märkte`}
            />
            <StatTile label="Berechnungsformel" value={`Σ IPP / n > 0`} color="rgba(0,0,0,0.45)" sub={`${fmtIpp(summary.numeratorTotal)} / ${summary.denominatorIncludedMarkets}`} />
            <StatTile label="Im Durchschnitt" value={String(summary.denominatorIncludedMarkets)} color={GREEN} sub="IPP > 0" />
            <StatTile label="Nullwerte ausgeschl." value={String(summary.excludedZeroMarkets)} color={summary.excludedZeroMarkets > 0 ? "#D97706" : "rgba(0,0,0,0.25)"} sub="IPP = 0" />
            <StatTile label="Beitragsfragen" value={String(summary.contributingQuestionCount)} color="#2563eb" sub="gezählte Antworten" />
            <StatTile label="Gesamt Märkte" value={String(summary.totalMarkets)} color="rgba(0,0,0,0.45)" />
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="ipp-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>IPP Berechnung</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.28)", fontStyle: "italic" }}>
              Austria Ø = Σ Markt-IPP / Märkte mit IPP &gt; 0
            </span>
          </div>
        </div>

        {/* White inner card */}
        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Toolbar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(0,0,0,0.03)", border: "1px solid transparent", flex: "0 0 220px", transition: "border 0.15s, background 0.15s" }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,0,0,0.14)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.border = "1px solid transparent"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}>
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,0.3)" />
                <input type="text" placeholder="Markt / GM / Kette suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1a1a1a", fontFamily: "inherit" }} />
                {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.3)", display: "flex" }}><X size={10} strokeWidth={2} /></button>}
              </div>

              {/* Filters */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <FilterDropdown label="RED Monat" options={ALL_RED_MONATS} value={filterMonat} onChange={setFilterMonat} />
                <FilterDropdown label="Region"    options={ALL_REGIONS}    value={filterRegion} onChange={setFilterRegion} />
                <FilterDropdown label="GM"        options={ALL_GMS}        value={filterGm}    onChange={setFilterGm} />
                <FilterDropdown label="Kette"     options={ALL_CHAINS}     value={filterChain} onChange={setFilterChain} />
                {hasFilters && (
                  <button onClick={clearFilters}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.035)", cursor: "pointer", color: "rgba(0,0,0,0.4)", fontSize: 9, fontWeight: 600, fontFamily: "inherit" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; e.currentTarget.style.color = R; e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.035)"; e.currentTarget.style.color = "rgba(0,0,0,0.4)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; }}>
                    <X size={9} strokeWidth={2.5} /> Filter
                  </button>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {hasFilters && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>{filtered.length} Märkte</span>
                {filterMonat  && <FilterPill label={filterMonat}  onRemove={() => setFilterMonat(null)} />}
                {filterRegion && <FilterPill label={filterRegion} onRemove={() => setFilterRegion(null)} />}
                {filterGm     && <FilterPill label={filterGm}     onRemove={() => setFilterGm(null)} />}
                {filterChain  && <FilterPill label={filterChain}  onRemove={() => setFilterChain(null)} />}
                {search       && <FilterPill label={`"${search}"`} onRemove={() => setSearch("")} />}
              </div>
            )}
          </div>

          {/* Master / detail split */}
          <div style={{ display: "flex", height: "calc(100vh - 340px)", minHeight: 480 }}>

            {/* Left: master list */}
            <div className="map-scroll" style={{ width: 420, flexShrink: 0, overflowY: "auto", borderRight: "1px solid rgba(0,0,0,0.05)", boxShadow: "4px 0 16px rgba(0,0,0,0.06)" }}>

              {/* Column header */}
              <div style={{ padding: "5px 14px", background: "rgba(0,0,0,0.018)", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "grid", gridTemplateColumns: "1fr 28px 60px", gap: "0 12px" }}>
                {["Markt", "Im Ø", "IPP"].map((h, i) => (
                  <span key={i} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: i === 1 ? GREEN : "rgba(0,0,0,0.28)", textAlign: i === 2 ? "right" as const : "left" as const }}>{h}</span>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" as const }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TrendingUp size={18} strokeWidth={1.5} color={R} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Keine Märkte gefunden</div>
                    <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Filter anpassen oder Suche zurücksetzen.</div>
                  </div>
                </div>
              ) : filtered.map(r => {
                const active = r.id === selectedId;
                const ci = chainInitials(r.chain);
                const sections = [...new Set(r.submissionRefs.map(s => s.sectionType))];
                return (
                  <div key={r.id} onClick={() => setSelectedId(active ? null : r.id)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.04)", background: active ? "rgba(220,38,38,0.04)" : "transparent", borderLeft: active ? `3px solid ${R}` : "3px solid transparent", transition: "all 0.1s ease", display: "grid", gridTemplateColumns: "1fr 28px 60px", gap: "0 12px", alignItems: "center" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

                    {/* Market identity */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: ci.bg, color: ci.text, letterSpacing: "0.03em", flexShrink: 0, textTransform: "uppercase" as const }}>
                          {r.chain.slice(0, 5)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: active ? R : "#1a1a1a", letterSpacing: "-0.01em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.marketName}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>{r.postalCode} {r.city}</span>
                        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)" }}>·</span>
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.38)" }}>{r.gmName}</span>
                        <span style={{ fontSize: 8, color: "rgba(0,0,0,0.25)" }}>·</span>
                        <span style={{ fontSize: 8.5, fontWeight: 600, color: R, letterSpacing: "0.02em" }}>{r.redMonatLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                        {sections.map(s => <SectionPill key={s} type={s} />)}
                      </div>
                    </div>

                    {/* Status dot */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" as const, width: 14, height: 14 }}>
                      {/* Glow layer */}
                      <div style={{
                        position: "absolute" as const, width: 7, height: 7, borderRadius: "50%",
                        background: r.includedInAverage ? GREEN : "rgba(0,0,0,0.12)",
                        opacity: r.includedInAverage ? 0.28 : 0.5,
                        filter: r.includedInAverage ? "blur(3px)" : "none",
                      }} />
                      {/* Sharp dot */}
                      <div style={{
                        position: "absolute" as const, width: 5, height: 5, borderRadius: "50%",
                        background: r.includedInAverage ? GREEN : "rgba(0,0,0,0.2)",
                      }} />
                    </div>

                    {/* IPP value — right-aligned */}
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: r.includedInAverage ? GREEN : "rgba(0,0,0,0.25)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                        {fmtIpp(r.marketIpp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: inspector */}
            <div key={selectedId ?? "empty"} className="ipp-insp" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <MarketInspector record={selectedRecord} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
