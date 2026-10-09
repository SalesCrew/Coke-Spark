import type { SMDurcharbeitReport } from "@/types/smSMDurcharbeitCampaign";
import { appendMetaSheet, appendTableSheet, buildAndDownloadWorkbook, fileSafeName, formatExportDateTime } from "./workbook";

type XlsxModule = typeof import("xlsx-js-style");
type Workbook = ReturnType<XlsxModule["utils"]["book_new"]>;
export function buildSMDurcharbeitReportWorkbook(XLSX: XlsxModule, wb: Workbook, report: SMDurcharbeitReport, campaignName: string) {
  const summary = report.summary;
  appendMetaSheet(XLSX, wb, [
    { label: "Auswertung", value: "SM Durcharbeit · Monatsstand" }, { label: "Kampagne", value: campaignName }, { label: "Kalendermonat", value: report.month },
    { label: "Erstellt", value: formatExportDateTime() }, { label: "Erforderliche Märkte", value: summary.required },
    { label: "Erledigte Märkte", value: summary.completed }, { label: "Abdeckung (%)", value: summary.coveragePercentage },
    { label: "Ausgenommene Märkte", value: summary.waived }, { label: "Aktuelle Monatsantworten", value: summary.latestSubmissions },
    { label: "Tatsächliche Besuche", value: summary.physicalVisits }, { label: "Gültige Fragebogenbesuche", value: summary.validQuestionnaireVisits },
    { label: "Istzeit (Minuten)", value: summary.actualMinutes }, { label: "Fahrtzeit (Minuten)", value: summary.travelMinutes },
    { label: "Verfügbare Foto-Originale", value: summary.availablePhotoUploads },
    { label: "Antwortbasis", value: "Letzte gültige Abgabe je erforderlichem Markt; Folgeabgaben zählen als ein Monatsstand." },
    { label: "Verteilungsbasis", value: "Auswahl je beantworteter, anwendbarer Frage. Mehrfachauswahl kann zusammen über 100 % ergeben." },
    { label: "Zeitbasis", value: "Jeder tatsächliche Besuch einmal mit aktueller Zeitrevision. Ungültige Antworten entfernen keine geleistete Zeit." },
    { label: "Zeitstempel", value: "ISO 8601 / UTC; Monatszuordnung Europe/Vienna." },
  ]);
  appendTableSheet(XLSX, wb, { name: "Monatsmärkte", title: "Monatsstand je Markt", rows: report.targets, columns: [
    { header: "Monatsziel-ID", value: r => r.id, width: 38 }, { header: "Markt-ID", value: r => r.market.id, width: 38 },
    { header: "Markt", value: r => r.market.name, width: 30 }, { header: "Adresse", value: r => `${r.market.address}, ${r.market.postalCode} ${r.market.city}`, width: 42 },
    { header: "Aktueller SM", value: r => r.smName, width: 24 }, { header: "SM-ID", value: r => r.smUserId, width: 38 },
    { header: "Verpflichtung", value: r => r.eligibility === "required" ? "Erforderlich" : "Ausgenommen" },
    { header: "Ausnahmegrund", value: r => r.waiverReason, width: 32 }, { header: "Monatsstand", value: r => r.completed ? "Erledigt" : "Offen" },
    { header: "Letzte Abgabe-ID", value: r => r.latestSubmissionId, width: 38 }, { header: "Abgegeben", value: r => r.completedAt, width: 26 },
  ] });
  appendTableSheet(XLSX, wb, { name: "Fragen", title: "Aktuelle Monatsantworten · Fragebasis", rows: report.questionResults, columns: [
    { header: "Frageversion-ID", value: r => r.questionVersionId, width: 38 }, { header: "Fragecode", value: r => r.questionCode, width: 28 },
    { header: "Frage", value: r => r.text, width: 55 }, { header: "Typ", value: r => r.type }, { header: "Anwendbar", value: r => r.applicable },
    { header: "Beantwortet", value: r => r.answered }, { header: "Unbeantwortet", value: r => r.unanswered },
    { header: "Zahlendurchschnitt", value: r => r.average, numberFormat: "0.00" },
  ] });
  const distribution = report.questionResults.flatMap(q => q.distribution.map(option => ({ ...option, questionVersionId: q.questionVersionId, text: q.text, answered: q.answered })));
  appendTableSheet(XLSX, wb, { name: "Antwortverteilung", title: "Auswahl je beantworteter Frage", description: "Mehrfachauswahl: ein Markt kann mehrere Optionen wählen; die Summe darf über 100 % liegen.", rows: distribution, columns: [
    { header: "Frageversion-ID", value: r => r.questionVersionId, width: 38 }, { header: "Frage", value: r => r.text, width: 55 },
    { header: "Optionscode", value: r => r.code, width: 24 }, { header: "Antwort", value: r => r.label, width: 30 },
    { header: "Gewählt", value: r => r.count }, { header: "Beantwortet (Nenner)", value: r => r.answered },
    { header: "Anteil (%)", value: r => r.percentage, numberFormat: "0.00" },
  ] });
  appendTableSheet(XLSX, wb, { name: "Letzte Antworten", title: "Letzte gültige Abgabe je erforderlichem Markt", rows: report.answers, columns: [
    { header: "Monatsziel-ID", value: r => r.targetId, width: 38 }, { header: "Abgabe-ID", value: r => r.question.submissionId, width: 38 },
    { header: "Abgebender SM", value: r => r.smName, width: 26 }, { header: "Frageversion-ID", value: r => r.question.questionVersionId, width: 38 },
    { header: "Frage", value: r => r.question.questionTextSnapshot, width: 55 }, { header: "Antwort-ID", value: r => r.answer?.id, width: 38 },
    { header: "Antwortstatus", value: r => r.answer?.answerState ?? "unanswered" }, { header: "Antwort (JSON)", value: r => JSON.stringify(r.answer?.valueJson ?? null), width: 55 },
    { header: "Antwortversion", value: r => r.answer?.answerVersion }, { header: "Original beantwortet", value: r => r.answer?.answeredAt, width: 26 },
    { header: "Übernommen aus Abgabe", value: r => r.sourceSubmissionId, width: 38 }, { header: "Übernommen aus Antwort", value: r => r.sourceAnswerId, width: 38 },
  ] });
  appendTableSheet(XLSX, wb, { name: "Tatsächliche Besuche", title: "Jeder Besuch einmal · aktuelle Zeitrevision", rows: report.physicalVisits, columns: [
    { header: "Besuch-ID", value: r => r.id, width: 38 }, { header: "Monatsziel-ID", value: r => r.targetId, width: 38 },
    { header: "Markt", value: r => r.marketName, width: 30 }, { header: "SM", value: r => r.smName, width: 26 },
    { header: "Abgabe-ID", value: r => r.submissionId, width: 38 }, { header: "Fragebogen gültig", value: r => r.questionnaireValid },
    { header: "Abgegeben", value: r => r.submittedAt, width: 26 }, { header: "Originalbeginn", value: r => r.originalStartedAt, width: 26 },
    { header: "Originalende", value: r => r.originalCompletedAt, width: 26 }, { header: "Aktueller Beginn", value: r => r.startedAt, width: 26 },
    { header: "Aktuelles Ende", value: r => r.completedAt, width: 26 }, { header: "Istzeit (Min)", value: r => r.actualMinutes },
    { header: "Fahrtzeit (Min)", value: r => r.travelMinutes }, { header: "Zeitrevision", value: r => r.timeRevision },
  ] });
}
export async function exportSMDurcharbeitReport(report: SMDurcharbeitReport, campaignName: string, isCurrent: () => boolean) {
  // Lazy dependency loading is also guarded against an account/filter switch.
  if (!isCurrent()) return;
  const XLSX = await import("xlsx-js-style");
  if (!isCurrent()) return;
  await buildAndDownloadWorkbook({ filename: `CokeSpark_SM_Durcharbeit_${fileSafeName(campaignName)}_${report.month.slice(0, 7)}.xlsx`,
    build: ({ wb }) => { if (!isCurrent()) throw new Error("Die Auswertung wurde gewechselt. Bitte neu laden."); buildSMDurcharbeitReportWorkbook(XLSX, wb, report, campaignName); } });
}
