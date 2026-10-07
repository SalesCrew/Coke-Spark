import {
  availabilityChainGroup, availabilityCounts, availabilityKinds,
  type AvailabilityAudit, type AvailabilityKind,
} from "@/lib/availability.shared";
import { appendTableSheet, excelDateSerial } from "./workbook";

const groupLabels = { rewe: "REWE", spar: "SPAR", other: "Sonstige Märkte" };
const categoryLabels = { top: "Top", mediocre: "Mediocre", bad: "Bad" };
function weekStart(date: string) {
  const day = new Date(date + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
function weekLabel(start: string) {
  const thursday = new Date(start + "T12:00:00Z");
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const first = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return `KW ${Math.ceil((Math.floor((thursday.getTime() - first) / 86400000) + 1) / 7)} · ${thursday.getUTCFullYear()}`;
}
export function availabilityExportRows(audit: AvailabilityAudit[]) {
  // Overlapping selected/comparison intervals can contain the same recorded
  // observation. The weekly answer sheet counts that stored observation once.
  const observations = new Map<string, AvailabilityAudit>();
  for (const observation of audit) {
    const key = JSON.stringify([observation.sessionId, observation.visitQuestionId, observation.answer?.id ?? null]);
    if (!observations.has(key) || observation.included) observations.set(key, observation);
  }
  const answers = [...observations.values()].map(o => ({
    ...o, week: weekStart(o.visitDate), chainLabel: o.chain || "Ohne Handelskette",
    group: groupLabels[availabilityChainGroup(o.chain)],
  })).sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.sessionId.localeCompare(b.sessionId)
    || a.questionId.localeCompare(b.questionId) || a.visitQuestionId.localeCompare(b.visitQuestionId));
  const bins = new Map<string, { start: string; scopeKind: string; scope: string; type: AvailabilityKind; rows: typeof answers }>();
  for (const answer of answers) {
    if (!availabilityKinds.includes(answer.availabilityType as AvailabilityKind)) continue;
    for (const [scopeKind, scope] of [["Alle", "Alle"], ["Gruppe", answer.group], ["Kette", answer.chainLabel]]) {
      const key = JSON.stringify([answer.week, scopeKind, scope, answer.availabilityType]);
      const bin = bins.get(key) ?? { start: answer.week, scopeKind: scopeKind!, scope: scope!, type: answer.availabilityType as AvailabilityKind, rows: [] };
      bin.rows.push(answer); bins.set(key, bin);
    }
  }
  const weeks = [...bins.values()].map(bin => {
    const end = new Date(bin.start + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + 6);
    const counts = availabilityCounts(bin.rows.filter(o => o.included).map(o => o.category!));
    return { ...bin, end: end.toISOString().slice(0, 10), label: weekLabel(bin.start), counts };
  }).sort((a, b) => a.start.localeCompare(b.start) || a.scopeKind.localeCompare(b.scopeKind)
    || a.scope.localeCompare(b.scope) || a.type.localeCompare(b.type));
  return { answers, weeks };
}

// Percentages are Excel formulas with cached numeric values, linked to audited
// answer rows. Group results pool answer counts rather than averaging chains.
export function appendAvailabilityExportSheets(
  XLSX: typeof import("xlsx-js-style"),
  wb: ReturnType<(typeof import("xlsx-js-style"))["utils"]["book_new"]>,
  audit: AvailabilityAudit[],
  context: { source: string; scope: string },
) {
  const { answers, weeks } = availabilityExportRows(audit);
  appendTableSheet(XLSX, wb, {
    name: "Verfügbarkeit Antworten", title: "Verfügbarkeit – gezählte und ausgeschlossene Antworten",
    description: "Eine Antwort je Besuch und Frage. Prozentanteile beziehen sich auf gültige Top/Mediocre/Bad-Antworten.",
    rows: answers,
    columns: [
      { header: "Besuchsdatum", value: o => excelDateSerial(o.visitDate), numberFormat: "dd.mm.yyyy" },
      { header: "Wochenbeginn", value: o => excelDateSerial(o.week), numberFormat: "dd.mm.yyyy" },
      { header: "Besuch-ID", value: o => o.sessionId, width: 38 },
      { header: "Besuchsfrage-ID", value: o => o.visitQuestionId, width: 38 },
      { header: "Frage-ID", value: o => o.questionId, width: 38 },
      { header: "Kampagne-ID", value: o => o.campaignId, width: 38 },
      { header: "GM-ID", value: o => o.gmId, width: 38 },
      { header: "Markt-ID", value: o => o.marketId, width: 38 },
      { header: "Handelskette", value: o => o.chainLabel },
      { header: "Kettengruppe", value: o => o.group },
      { header: "Kategorie", value: o => o.availabilityType },
      { header: "Antwort", value: o => o.category ? categoryLabels[o.category] : "" },
      { header: "Gezählt", value: o => o.included ? "Ja" : "Nein" },
      { header: "Ausschlussgrund", value: o => o.exclusion, width: 30 },
      { header: "Besuchsstart", value: o => o.startedAt, width: 28 },
      { header: "Eingereicht", value: o => o.submittedAt, width: 28 },
      { header: "Frage", value: o => o.questionText, width: 60 },
      { header: "Datumsquelle", value: o => o.dateBasis, width: 24 },
      { header: "Antwort-ID", value: o => o.answer?.id, width: 38 },
      { header: "Gespeicherter Wert", value: o => String(o.answer?.valueText ?? JSON.stringify(o.answer?.valueJson?.raw) ?? "").slice(0, 1000), width: 45 },
    ],
  });
  appendTableSheet(XLSX, wb, {
    name: "Verfügbarkeit Wochen", title: "Verfügbarkeit – Antwortanteile pro Kalenderwoche",
    description: "Einzelne Wochen (Mo–So, Europe/Vienna); Gruppenwerte werden aus allen gezählten Antworten berechnet.",
    rows: weeks,
    columns: [
      { header: "Woche", value: w => w.label },
      { header: "Von", value: w => excelDateSerial(w.start), numberFormat: "dd.mm.yyyy" },
      { header: "Bis", value: w => excelDateSerial(w.end), numberFormat: "dd.mm.yyyy" },
      { header: "Filterart", value: w => w.scopeKind },
      { header: "Filter", value: w => w.scope },
      { header: "Kategorie", value: w => w.type },
      { header: "Top Anzahl", value: w => w.counts.top },
      { header: "Mediocre Anzahl", value: w => w.counts.mediocre },
      { header: "Bad Anzahl", value: w => w.counts.bad },
      { header: "Antworten gezählt", value: w => w.counts.total },
      { header: "Top Anteil", value: w => w.counts.total ? w.counts.top / w.counts.total : null, numberFormat: "0.0%" },
      { header: "Mediocre Anteil", value: w => w.counts.total ? w.counts.mediocre / w.counts.total : null, numberFormat: "0.0%" },
      { header: "Bad Anteil", value: w => w.counts.total ? w.counts.bad / w.counts.total : null, numberFormat: "0.0%" },
    ],
  });
  const summary = wb.Sheets["Verfügbarkeit Wochen"]!;
  const last = Math.max(5, answers.length + 4);
  const range = (col: string) => `'Verfügbarkeit Antworten'!$${col}$5:$${col}$${last}`;
  weeks.forEach((_, index) => {
    const r = index + 5;
    const conditions = `${range("B")},$B${r},${range("K")},$F${r},${range("M")},"Ja"`;
    for (const [col, label] of [["G", "Top"], ["H", "Mediocre"], ["I", "Bad"]]) {
      const base = `${conditions},${range("L")},"${label}"`;
      // Exact chain labels stay distinct after Excel recalculates (COUNTIFS is
      // case-insensitive and interprets wildcard characters in text criteria).
      const chainCount = `SUMPRODUCT(--(${range("B")}=$B${r}),--(${range("K")}=$F${r}),--(${range("M")}="Ja"),--(${range("L")}="${label}"),--EXACT(${range("I")},$E${r}))`;
      summary[`${col}${r}`]!.f = `IF($D${r}="Alle",COUNTIFS(${base}),IF($D${r}="Gruppe",COUNTIFS(${base},${range("J")},$E${r}),${chainCount}))`;
    }
    summary[`J${r}`]!.f = `SUM(G${r}:I${r})`;
    for (const [col, count] of [["K", "G"], ["L", "H"], ["M", "I"]]) {
      const cell = summary[`${col}${r}`]!;
      cell.f = `IF(J${r}=0,"",${count}${r}/J${r})`;
      if (!_.counts.total) { cell.t = "s"; cell.v = ""; }
    }
  });
  appendTableSheet(XLSX, wb, {
    name: "Verfügbarkeit Regeln", title: "Verfügbarkeit – Datenumfang und Berechnungsregeln",
    rows: [
      ["Quelle", context.source], ["Filter / Kampagnen", context.scope], ["Zeitzone", "Europe/Vienna"],
      ["Zeitraum", "Besuchsstart; bei historischen Besuchen ohne Startzeit: Einreichungsdatum (in Antworten markiert)"],
      ["Nenner", "Gültige beantwortete Top/Mediocre/Bad-Antworten; eine pro Besuch und Frage"],
      ["Top / Mediocre / Bad Anteil", "Anzahl der jeweiligen Antworten / Anzahl aller gezählten Antworten"],
      ["Durchschnitt im linken Diagramm", "(Top × 100 + Mediocre × 50 + Bad × 0) / Anzahl aller gezählten Antworten"],
      ["REWE", "Billa, Billa+, Billa Plus, Billa Corso"], ["SPAR", "Spar, ESP/Eurospar, ISP/Interspar"],
      ["Umfang", "Ein Kampagnenexport enthält nur seine ausgewählten Kampagnen und Besuche. Dashboard-Filter müssen für einen Vergleich übereinstimmen."],
    ],
    columns: [{ header: "Regel", value: r => r[0], width: 32 }, { header: "Wert", value: r => r[1], width: 100 }],
  });
}
