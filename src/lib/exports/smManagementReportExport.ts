import type { SmManagementReport } from "@/types/smManagement";
import { appendMetaSheet, appendTableSheet, buildAndDownloadWorkbook, type ExportColumn } from "./workbook";
import { smExportAnswerComment, smExportAnswerValue } from "./smAnswerValue";
import { smReportAnswerCell, smReportQuestionColumnKey, smReportLatestQuestion } from "./smReportQuestionColumns";

type Xlsx = typeof import("xlsx-js-style");
type Answer = SmManagementReport["answers"][number];
const moment = (value: string | null) => value ? new Intl.DateTimeFormat("de-AT", {
  timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value)) : "";
const date = (value: string) => new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
const number = (value: string | undefined) => value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : "";

export function buildSmManagementReportWorkbook(XLSX: Xlsx, report: SmManagementReport, appOrigin?: string) {
  if (!report.visits.length) throw new Error("Für diese Auswahl gibt es keine abgeschlossenen Fragebögen.");
  const ids = new Set(report.visits.map(visit => visit.id));
  const durcharbeitIds = new Set(report.visits.filter(visit => visit.SMDurcharbeitCatalogScope === "SMDurcharbeit" || visit.SMDurcharbeitContext).map(visit => visit.id));
  if (ids.size !== report.visits.length) throw new Error("Doppelte Besuche in der Auswertung. Bitte neu laden.");
  const grouped = new Map<string, Map<string, Answer[]>>(), columns = new Map<string, string>(), seen = new Set<string>();
  const definitions = new Map<string, Answer["question"]>();
  for (const row of report.answers) {
    if (!ids.has(row.question.submissionId) || seen.has(row.question.id)) throw new Error("Die Besuchsantworten sind nicht eindeutig. Bitte neu laden.");
    seen.add(row.question.id);
    const durcharbeit = durcharbeitIds.has(row.question.submissionId);
    const key = smReportQuestionColumnKey(row, durcharbeit), groups = grouped.get(row.question.submissionId) ?? new Map<string, Answer[]>();
    groups.set(key, [...(groups.get(key) ?? []), row]); grouped.set(row.question.submissionId, groups);
    const definition = durcharbeit ? smReportLatestQuestion(definitions.get(key), row.question) : definitions.get(key) ?? row.question;
    definitions.set(key, definition); columns.set(key, definition.questionTextSnapshot);
  }
  const rows = report.visits.map(visit => ({ visit, cells: new Map([...(grouped.get(visit.id) ?? [])].map(([key, values]) => [key, smReportAnswerCell(values)])) }));
  type Row = typeof rows[number];
  const link = (visit: SmManagementReport["visits"][number]) => appOrigin && /^https?:\/\//.test(appOrigin)
    ? `${appOrigin}/admin/sm/fbmanagement?submissionId=${encodeURIComponent(visit.id)}&workDate=${visit.workDate}` : "";
  const base: ExportColumn<Row>[] = [
    { header: "Besuchsdatum", width: 16, value: r => date(r.visit.workDate) },
    { header: "Mitarbeiter", width: 28, value: r => r.visit.smName },
    { header: "Markt", width: 30, value: r => r.visit.marketName },
    { header: "Adresse", width: 30, value: r => r.visit.address },
    { header: "PLZ", width: 10, value: r => r.visit.postalCode },
    { header: "Ort", width: 22, value: r => r.visit.city },
    { header: "Besuchsbeginn", width: 24, value: r => moment(r.visit.startedAt) },
    { header: "Besuchsende", width: 24, value: r => moment(r.visit.completedAt) },
    { header: "Besuchsdauer (Minuten)", width: 16, value: r => r.visit.actualMinutes },
    { header: "Fahrtzeit (Minuten)", width: 16, value: r => r.visit.travelMinutes },
    { header: "Fragebogen", width: 30, value: r => r.visit.questionnaireName },
    { header: "Fragebogen-Version", width: 20, value: r => r.visit.questionnaireVersion },
    { header: "Fragebogentyp", width: 18, value: r => r.visit.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? "Durcharbeit" : "Standard" },
    { header: "Abgegeben am", width: 24, value: r => moment(r.visit.submittedAt) },
    { header: "Ursprünglicher Beginn", width: 24, value: r => moment(r.visit.originalStartedAt) },
    { header: "Ursprüngliches Ende", width: 24, value: r => moment(r.visit.originalCompletedAt) },
    { header: "Fragebogen öffnen", width: 34, value: r => link(r.visit) ? "In der App öffnen" : "" },
  ];
  const used = new Set(base.map(column => column.header));
  for (const [key, text] of columns) {
    let label = text, suffix = 1;
    while (used.has(label) || used.has(`${label} · Kommentar`)) label = `${text} (${++suffix})`;
    used.add(label); used.add(`${label} · Kommentar`); columns.set(key, label);
    base.push({ header: label, width: 42, value: r => r.cells.get(key)?.value ?? "" },
      { header: `${label} · Kommentar`, width: 36, value: r => r.cells.get(key)?.comment ?? "" });
  }
  base.push({ header: "Prüfhinweise", width: 42, value: r => [...r.cells].filter(([, cell]) => cell.conflict).map(([key]) => `Widersprüchliche Antworten: ${columns.get(key)}`).join("\n") });
  const visits = new Map(report.visits.map(visit => [visit.id, visit]));
  const details = report.answers.map(answer => ({ ...answer, visit: visits.get(answer.question.submissionId)! }));
  const photos = details.flatMap(answer => answer.photos.map(photo => ({ photo, answer })));
  if (base.length > 16384 || (rows.length + 4) * base.length + (details.length + 13) * 13 + (photos.length + 4) * 9 + 40 > 2_000_000) {
    throw new Error("Die Auswertung ist zu groß. Bitte grenze den Zeitraum, Mitarbeiter oder Fragebogen weiter ein.");
  }
  const wb = XLSX.utils.book_new();
  appendTableSheet(XLSX, wb, { name: "Besuche", title: "SM · Komplettauswertung", description: `${date(report.filters.from)} – ${date(report.filters.to)} · ${rows.length} Besuche · Alle Treffer der Auswahl · Uhrzeiten in österreichischer Ortszeit`, rows, columns: base });
  appendTableSheet(XLSX, wb, { name: "Antwortdetails", title: "Sämtliche Besuchsantworten", description: "Antworten je Besuch. Nicht beantwortete und nicht anwendbare Fragen sind gekennzeichnet.", rows: details, columns: [
    { header: "Besuchsdatum", width: 16, value: r => date(r.visit.workDate) },
    { header: "Mitarbeiter", width: 28, value: r => r.visit.smName },
    { header: "Markt", width: 30, value: r => r.visit.marketName },
    { header: "Fragebogen", width: 30, value: r => r.visit.questionnaireName },
    { header: "Modul", width: 28, value: r => r.module },
    { header: "Frage", width: 54, value: r => r.question.questionTextSnapshot },
    { header: "Antwort", width: 42, value: smExportAnswerValue },
    { header: "Kommentar", width: 42, value: smExportAnswerComment },
    { header: "Antwortstatus", width: 22, value: r => r.question.isApplicable === false ? "Nicht anwendbar" : r.answer?.answerState === "answered" ? "Beantwortet" : r.answer?.answerState === "not_applicable" ? "Nicht anwendbar" : r.answer?.answerState === "unanswered" || !r.answer ? "Nicht beantwortet" : r.answer.answerState === "invalidated" ? "Nicht mehr gültig" : "Nicht verfügbar" },
    { header: "Beantwortet am", width: 24, value: r => moment(r.answer?.answeredAt ?? null) },
    { header: "Beantwortet von", width: 28, value: r => r.answer ? r.answer.answeredByName || "Nicht dokumentiert" : "" },
    { header: "Punkte", width: 14, value: r => number(r.answer?.earnedPoints) },
    { header: "Mögliche Punkte", width: 18, value: r => number(r.answer?.possiblePoints) },
  ] });
  appendTableSheet(XLSX, wb, { name: "Fotos", title: "Fotoangaben", description: "Fotos über „In der App öffnen“ im zugehörigen Fragebogen ansehen. Dafür ist die Anmeldung in der App erforderlich.", rows: photos, columns: [
    { header: "Besuchsdatum", width: 16, value: r => date(r.answer.visit.workDate) },
    { header: "Mitarbeiter", width: 28, value: r => r.answer.visit.smName },
    { header: "Markt", width: 30, value: r => r.answer.visit.marketName },
    { header: "Frage", width: 48, value: r => r.answer.question.questionTextSnapshot },
    { header: "Dateiname", width: 32, value: r => r.photo.fileName },
    { header: "Dateityp", width: 18, value: r => ({ "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" }[r.photo.mimeType] ?? "Bilddatei") },
    { header: "Dateigröße", width: 18, value: r => `${new Intl.NumberFormat("de-AT", { maximumFractionDigits: 1 }).format(r.photo.byteSize / (r.photo.byteSize >= 1024 * 1024 ? 1024 * 1024 : 1024))} ${r.photo.byteSize >= 1024 * 1024 ? "MB" : "KB"}` },
    { header: "Hochgeladen am", width: 24, value: r => moment(r.photo.uploadedAt) },
    { header: "Fragebogen öffnen", width: 34, value: r => link(r.answer.visit) ? "In der App öffnen" : "" },
  ] });
  appendMetaSheet(XLSX, wb, [
    { label: "Auswertung", value: "SM · Komplettauswertung" },
    { label: "Erstellt am", value: moment(report.generatedAt) },
    { label: "Besuchszeitraum", value: `${date(report.filters.from)} – ${date(report.filters.to)}` },
    { label: "Besuche", value: report.visits.length }, { label: "Fragen", value: report.answers.length }, { label: "Fotos", value: photos.length },
    { label: "Umfang", value: "Alle abgeschlossenen Fragebögen der Auswahl, eine Zeile je Besuch. Antworten und Bezeichnungen stammen aus dem jeweiligen Besuch; spätere Korrekturen sind berücksichtigt." },
    { label: "Mitarbeiter", value: report.filters.smUserId ? report.visits.find(visit => visit.smUserId === report.filters.smUserId)?.smName || "Ausgewählter Mitarbeiter" : "Alle Mitarbeiter" },
    { label: "Markt", value: report.filters.marketId ? report.visits.find(visit => visit.marketId === report.filters.marketId)?.marketName || "Ausgewählter Markt" : "Alle Märkte" },
    { label: "Fragebogen", value: report.filters.questionnaireId ? report.visits.find(visit => visit.questionnaireId === report.filters.questionnaireId)?.questionnaireName || "Ausgewählter Fragebogen" : "Alle Fragebögen" },
    { label: "Fragebogentyp", value: report.filters.SMDurcharbeitCatalogScope === "standard" ? "Standard" : report.filters.SMDurcharbeitCatalogScope === "SMDurcharbeit" ? "Durcharbeit" : "Alle Fragebögen" },
    ...(report.filters.SMDurcharbeitCampaignId ? [{ label: "Kampagne", value: report.visits.find(visit => visit.SMDurcharbeitContext?.campaignId === report.filters.SMDurcharbeitCampaignId)?.SMDurcharbeitContext?.campaignName || "Ausgewählte Kampagne" }] : []),
    ...(report.filters.SMDurcharbeitMonth ? [{ label: "Kalendermonat", value: new Intl.DateTimeFormat("de-AT", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${report.filters.SMDurcharbeitMonth}T12:00:00Z`)) }] : []),
    ...(report.filters.search ? [{ label: "Suche", value: report.filters.search }] : []),
    { label: "Uhrzeiten", value: "Österreichische Ortszeit" },
    { label: "Leere Zelle bei Frage", value: "Diese Frage gehört nicht zu diesem Besuch. Nicht beantwortet und Nicht anwendbar werden gesondert ausgewiesen." },
  ]);
  wb.Sheets.Exportinfo = wb.Sheets.Meta!;
  delete wb.Sheets.Meta;
  wb.SheetNames = wb.SheetNames.map(name => name === "Meta" ? "Exportinfo" : name);
  const addLinks = (sheetName: string, column: number, links: Array<string>) => {
    if (column < 0) return;
    links.forEach((target, index) => {
      if (!target) return;
      const cell = wb.Sheets[sheetName]![XLSX.utils.encode_cell({ r: index + 4, c: column })]!;
      cell.l = { Target: target, Tooltip: "Fragebogen in der App öffnen (Anmeldung erforderlich)" };
      cell.s = { ...cell.s, font: { ...cell.s?.font, color: { rgb: "2563EB" }, underline: true } };
    });
  };
  addLinks("Besuche", base.findIndex(column => column.header === "Fragebogen öffnen"), rows.map(row => link(row.visit)));
  addLinks("Fotos", 8, photos.map(row => link(row.answer.visit)));
  // Keep white backgrounds, wrapping and frozen visit columns like the Durcharbeit workbook.
  for (const sheet of Object.values(wb.Sheets)) {
    sheet["!freeze"] = { xSplit: sheet === wb.Sheets.Besuche ? 3 : 0, ySplit: 4, topLeftCell: sheet === wb.Sheets.Besuche ? "D5" : "A5", activePane: "bottomRight", state: "frozen" };
    for (const [address, raw] of Object.entries(sheet)) {
      if (address.startsWith("!") || !raw || typeof raw !== "object") continue;
      const cell = raw as import("xlsx-js-style").CellObject;
      if (typeof cell.v === "string" && cell.v.length > 32767) throw new Error("Eine Antwort überschreitet die Excel-Zellgrenze. Die Auswertung wurde ohne Kürzung abgebrochen.");
      cell.s = { ...cell.s, fill: cell.s?.fill ?? { patternType: "solid", fgColor: { rgb: "FFFFFF" } }, alignment: { ...cell.s?.alignment, vertical: "top", wrapText: true } };
    }
  }
  return wb;
}

export async function exportSmManagementReport(report: SmManagementReport, isCurrent: () => boolean) {
  if (!isCurrent()) return false;
  await buildAndDownloadWorkbook({ filename: `SM_Komplettauswertung_${report.filters.from}_${report.filters.to}.xlsx`,
    build: ({ XLSX, wb }) => {
      if (!isCurrent()) throw new Error("Die Auswahl hat sich geändert. Bitte starte den Export erneut.");
      Object.assign(wb, buildSmManagementReportWorkbook(XLSX, report, window.location.origin));
    },
  });
  return true;
}
