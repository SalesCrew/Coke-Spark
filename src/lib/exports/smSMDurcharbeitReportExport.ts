import type { SMDurcharbeitReport, SMDurcharbeitReportAnswer } from "@/types/smSMDurcharbeitCampaign";
import { appendMetaSheet, appendTableSheet, buildAndDownloadWorkbook, fileSafeName, formatExportDateTime, type ExportColumn } from "./workbook";
import { smExportAnswerComment, smExportAnswerValue } from "./smAnswerValue";

type XlsxModule = typeof import("xlsx-js-style");
type Workbook = ReturnType<XlsxModule["utils"]["book_new"]>;

function visitDateTime(value: string | null, part: "date" | "time") {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", ...(part === "date"
    ? { day: "2-digit", month: "2-digit", year: "numeric" } as const
    : { hour: "2-digit", minute: "2-digit", hour12: false } as const) }).format(new Date(value));
}

function appendVisitAnswers(XLSX: XlsxModule, wb: Workbook, report: SMDurcharbeitReport, campaignName: string) {
  if (!report.visitAnswers) throw new Error("Die Besuchsantworten fehlen. Bitte die Monatsauswertung neu laden und den Export erneut starten.");
  const targets = new Map(report.targets.map(target => [target.id, target]));
  const validIds = new Set(report.physicalVisits.filter(visit => visit.questionnaireValid).map(visit => visit.submissionId));
  const answersBySubmission = new Map<string, Map<string, SMDurcharbeitReportAnswer>>();
  const key = (row: SMDurcharbeitReportAnswer) => `${row.question.questionVersionId}:${row.question.questionCodeSnapshot}`;
  for (const row of report.visitAnswers) {
    if (!validIds.has(row.question.submissionId)) throw new Error("Eine Antwort gehört nicht zu den gültigen Besuchen dieser Auswertung. Bitte neu laden.");
    const answers = answersBySubmission.get(row.question.submissionId) ?? new Map<string, SMDurcharbeitReportAnswer>();
    if (answers.has(key(row))) throw new Error("Doppelte Frage im Besuch. Der Export wurde zum Schutz vor unvollständigen Antworten abgebrochen.");
    answers.set(key(row), row); answersBySubmission.set(row.question.submissionId, answers);
  }
  const start = (visit: SMDurcharbeitReport["physicalVisits"][number]) => visit.startedAt ?? visit.originalStartedAt ?? visit.submittedAt;
  const rows = report.physicalVisits.slice().sort((a, b) => start(a).localeCompare(start(b)) || a.id.localeCompare(b.id))
    .map(visit => ({ visit, target: targets.get(visit.targetId), answers: answersBySubmission.get(visit.submissionId) }));
  type Row = typeof rows[number];
  const questionColumns = new Map<string, { label: string }>();
  for (const row of rows) for (const [id, answer] of row.answers ?? []) {
    if (questionColumns.has(id)) continue;
    questionColumns.set(id, { label: answer.question.questionTextSnapshot });
  }
  const columns: ExportColumn<Row>[] = [
    { header: "Kampagne", value: () => campaignName, width: 28 },
    { header: "Kalendermonat", value: () => report.month.slice(0, 7), width: 16 },
    { header: "Markt", value: r => r.visit.marketName, width: 32 },
    { header: "Markt-Nr.", value: r => r.target?.market.internalId, width: 18 },
    { header: "Handelskette", value: r => r.target?.market.chain, width: 18 },
    { header: "Adresse", value: r => r.visit.marketAddress ?? r.target?.market.address, width: 32 },
    { header: "PLZ", value: r => r.visit.marketPostalCode ?? r.target?.market.postalCode, width: 10 },
    { header: "Ort", value: r => r.visit.marketCity ?? r.target?.market.city, width: 24 },
    { header: "Region", value: r => r.target?.market.region, width: 16 },
    { header: "Shelf Merchandiser", value: r => r.visit.smName, width: 26 },
    { header: "Besuchsdatum", value: r => visitDateTime(start(r.visit), "date"), width: 16 },
    { header: "Besuchsbeginn", value: r => visitDateTime(start(r.visit), "time"), width: 16 },
    { header: "Besuchsende", value: r => visitDateTime(r.visit.completedAt ?? r.visit.originalCompletedAt, "time"), width: 16 },
    { header: "Istzeit (Min)", value: r => r.visit.actualMinutes, width: 16 },
    { header: "Fahrtzeit (Min)", value: r => r.visit.travelMinutes, width: 16 },
    { header: "Fragebogen", value: r => r.visit.questionnaireName, width: 30 },
    { header: "Fragebogen-Version", value: r => r.visit.questionnaireVersion, width: 18 },
    { header: "Antwortstatus", value: r => r.visit.questionnaireValid ? "Gültig" : "Ungültig / zurückgezogen", width: 24 },
    { header: "Monatsstand", value: r => r.target?.eligibility === "required" && r.target.latestSubmissionId === r.visit.submissionId ? "Aktuell" : "Nicht im aktuellen Monatsstand", width: 30 },
  ];
  const usedLabels = new Set(columns.map(column => column.header));
  for (const [id, question] of questionColumns) {
    let label = question.label, suffix = 1;
    while (usedLabels.has(label) || usedLabels.has(`${label} · Kommentar`)) label = `${question.label} (${++suffix})`;
    usedLabels.add(label); usedLabels.add(`${label} · Kommentar`);
    columns.push(
      { header: label, width: 52, value: r => { const answer = r.answers?.get(id); return answer ? smExportAnswerValue(answer) : ""; } },
      { header: `${label} · Kommentar`, width: 32, value: r => { const answer = r.answers?.get(id); return answer ? smExportAnswerComment(answer) : ""; } },
    );
  }
  if (columns.length > 16384 || Math.max(1, rows.length) * columns.length > 2_000_000) throw new Error("Der Excel-Export ist zu groß. Bitte die Monatsauswertung auf einen SM eingrenzen.");
  appendTableSheet(XLSX, wb, { name: "Einsätze", title: "SM Durcharbeit · Besuchsantworten", rows, columns,
    description: "Eine Zeile je tatsächlichem Besuch; Antworten in der damals abgegebenen Fragebogenfassung. Leere Zellen: Frage war in diesem Besuch nicht enthalten. Zeiten: Europe/Vienna." });
  const sheet = wb.Sheets["Einsätze"]!;
  if (!rows.length) {
    const end = XLSX.utils.encode_col(columns.length - 1);
    sheet["!ref"] = `A1:${end}4`;
    sheet["!autofilter"] = { ref: `A4:${end}4` };
  }
  sheet["!freeze"] = { xSplit: 3, ySplit: 4 };
  sheet["!rows"] = sheet["!rows"]?.map((row, index) => index >= 4 ? {} : row);
  for (let row = 4; row < rows.length + 4; row++) for (let col = 0; col < columns.length; col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell) cell.s = { ...cell.s, alignment: { ...cell.s?.alignment, vertical: "top", wrapText: true } };
  }
}

export function buildSMDurcharbeitReportWorkbook(XLSX: XlsxModule, wb: Workbook, report: SMDurcharbeitReport, campaignName: string) {
  appendVisitAnswers(XLSX, wb, report, campaignName);
  const summary = report.summary;
  const targetById = new Map(report.targets.map(target => [target.id, target]));
  const visitBySubmission = new Map(report.physicalVisits.map(visit => [visit.submissionId, visit]));
  appendMetaSheet(XLSX, wb, [
    { label: "Auswertung", value: "SM Durcharbeit · Monatsstand" }, { label: "Kampagne", value: campaignName }, { label: "Kalendermonat", value: report.month },
    { label: "Erstellt", value: formatExportDateTime() }, { label: "Erforderliche Märkte", value: summary.required },
    { label: "Erledigte Märkte", value: summary.completed }, { label: "Abdeckung (%)", value: summary.coveragePercentage },
    { label: "Ausgenommene Märkte", value: summary.waived }, { label: "Aktuelle Monatsantworten", value: summary.latestSubmissions },
    { label: "Tatsächliche Besuche", value: summary.physicalVisits }, { label: "Gültige Fragebogenbesuche", value: summary.validQuestionnaireVisits },
    { label: "Istzeit (Minuten)", value: summary.actualMinutes }, { label: "Fahrtzeit (Minuten)", value: summary.travelMinutes },
    { label: "Verfügbare Foto-Originale", value: summary.availablePhotoUploads },
    { label: "Antwortbasis", value: "Letzte gültige Abgabe je erforderlichem Markt; Folgeabgaben zählen als ein Monatsstand." },
    { label: "Blatt Einsätze", value: "Jeder tatsächliche Besuch mit eigenen Antworten und aktuellen Zeiten. Ungültige/zurückgezogene Abgaben behalten die Zeitzeile, ohne Antwortinhalte." },
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
    { header: "Markt", value: r => visitBySubmission.get(r.question.submissionId)?.marketName ?? targetById.get(r.targetId)?.market.name, width: 32 },
    { header: "Antwort", value: smExportAnswerValue, width: 52 }, { header: "Kommentar", value: smExportAnswerComment, width: 32 },
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
