import type { AdminZeiterfassungSession } from "@/lib/api/backend";

type CellStyle = Record<string, unknown>;
type Worksheet = Record<string, unknown>;

type ExportRange = {
  from: string;
  to: string;
  label: string;
};

type ZeiterfassungExportInput = {
  sessions: AdminZeiterfassungSession[];
  range: ExportRange;
  timezone: string;
};

const SEGMENT_LABELS: Record<AdminZeiterfassungSession["timeline"][number]["kind"], string> = {
  anfahrt: "Anfahrt",
  fahrtzeit: "Fahrtzeit",
  marktbesuch: "Marktbesuch",
  pause: "Pause",
  zusatzzeit: "Zusatz",
  heimfahrt: "Heimfahrt",
};

const CALCULATED_SEGMENTS = new Set<AdminZeiterfassungSession["timeline"][number]["kind"]>([
  "anfahrt",
  "fahrtzeit",
  "heimfahrt",
]);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function excelDateSerial(dateYmd: string): number {
  const [yearRaw, monthRaw, dayRaw] = dateYmd.split("-").map(Number);
  return Math.round(Date.UTC(yearRaw ?? 1970, (monthRaw ?? 1) - 1, dayRaw ?? 1) / 86400000 + 25569);
}

function timeFraction(hhmm: string): number | string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return (hour * 60 + minute) / 1440;
}

function weekdayLabel(dateYmd: string): string {
  return new Date(`${dateYmd}T12:00:00`).toLocaleDateString("de-AT", { weekday: "long" });
}

function statusLabel(status: AdminZeiterfassungSession["status"], isLive: boolean): string {
  if (isLive) return "Live";
  if (status === "submitted") return "Abgeschlossen";
  if (status === "ended") return "Beendet";
  return "Gestartet";
}

function kindSort(kind: AdminZeiterfassungSession["timeline"][number]["kind"]): number {
  switch (kind) {
    case "anfahrt": return 10;
    case "marktbesuch": return 20;
    case "zusatzzeit": return 30;
    case "pause": return 40;
    case "fahrtzeit": return 50;
    case "heimfahrt": return 60;
    default: return 99;
  }
}

function subtypeLabel(value: string | undefined | null): string {
  switch (value) {
    case "schulung": return "Schulung";
    case "sonderaufgabe": return "Sonderaufgabe";
    case "arztbesuch": return "Arztbesuch";
    case "werkstatt": return "Werkstatt";
    case "homeoffice": return "Homeoffice";
    case "lager": return "Lager";
    case "hoteluebernachtung": return "Hotel";
    default: return value ?? "";
  }
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Tabelle";
}

function fileSafeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Zeiterfassung";
}

function makeBorder(color = "D9DEE8") {
  return {
    top: { style: "thin", color: { rgb: color } },
    right: { style: "thin", color: { rgb: color } },
    bottom: { style: "thin", color: { rgb: color } },
    left: { style: "thin", color: { rgb: color } },
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setCell(
  ws: Worksheet,
  encodeCell: (cell: { r: number; c: number }) => string,
  row: number,
  col: number,
  value: unknown,
  style: CellStyle,
  extra?: Record<string, unknown>,
) {
  ws[encodeCell({ r: row, c: col })] = {
    v: value,
    t: typeof value === "number" ? "n" : "s",
    s: style,
    ...(extra ?? {}),
  };
}

function buildSegmentRows(sessions: AdminZeiterfassungSession[]) {
  return sessions
    .flatMap((session) =>
      (session.timeline ?? []).map((segment, index) => ({
        session,
        segment,
        index,
      })),
    )
    .sort((left, right) =>
      left.session.date.localeCompare(right.session.date) ||
      left.session.gmName.localeCompare(right.session.gmName, "de") ||
      left.segment.start.localeCompare(right.segment.start) ||
      kindSort(left.segment.kind) - kindSort(right.segment.kind) ||
      left.index - right.index,
    );
}

function buildGmSummary(sessions: AdminZeiterfassungSession[]) {
  const byGm = new Map<string, {
    gmName: string;
    region: string;
    days: number;
    arbeitstagMin: number;
    reineArbeitszeitMin: number;
    pauseMin: number;
    fahrtzeitMin: number;
    anfahrtMin: number;
    heimfahrtMin: number;
    marktbesuchMin: number;
    zusatzMin: number;
    marktbesuche: number;
    zusatz: number;
    km: number;
    liveDays: number;
  }>();

  for (const session of sessions) {
    const current = byGm.get(session.gmId) ?? {
      gmName: session.gmName,
      region: session.region,
      days: 0,
      arbeitstagMin: 0,
      reineArbeitszeitMin: 0,
      pauseMin: 0,
      fahrtzeitMin: 0,
      anfahrtMin: 0,
      heimfahrtMin: 0,
      marktbesuchMin: 0,
      zusatzMin: 0,
      marktbesuche: 0,
      zusatz: 0,
      km: 0,
      liveDays: 0,
    };
    current.days += 1;
    current.arbeitstagMin += session.stats?.arbeitstag ?? 0;
    current.reineArbeitszeitMin += session.stats?.reineArbeitszeit ?? 0;
    current.pauseMin += session.stats?.pauseMin ?? 0;
    current.marktbesuche += session.stats?.marktbesuche ?? 0;
    current.zusatz += session.stats?.zusatz ?? 0;
    current.km += session.stats?.kmGefahren ?? 0;
    if (session.isLive) current.liveDays += 1;

    for (const segment of session.timeline ?? []) {
      if (segment.kind === "fahrtzeit") current.fahrtzeitMin += segment.durationMin;
      if (segment.kind === "anfahrt") current.anfahrtMin += segment.durationMin;
      if (segment.kind === "heimfahrt") current.heimfahrtMin += segment.durationMin;
      if (segment.kind === "marktbesuch") current.marktbesuchMin += segment.durationMin;
      if (segment.kind === "zusatzzeit") current.zusatzMin += segment.durationMin;
    }
    byGm.set(session.gmId, current);
  }

  return Array.from(byGm.values()).sort((left, right) => left.gmName.localeCompare(right.gmName, "de"));
}

export function getMonthBoundsForZeiterfassungExport(year: number, month: number): ExportRange {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const next = new Date(Date.UTC(year, month + 1, 1, 12));
  const last = new Date(next);
  last.setUTCDate(last.getUTCDate() - 1);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: `${pad2(month + 1)}.${year}`,
  };
}

export async function exportAdminZeiterfassung(input: ZeiterfassungExportInput): Promise<void> {
  if (input.sessions.length === 0) {
    throw new Error("Für diesen Zeitraum gibt es keine Zeiterfassungsdaten.");
  }

  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const encodeCell = XLSX.utils.encode_cell;
  const encodeRange = XLSX.utils.encode_range;

  const base: CellStyle = {
    font: { name: "Inter", sz: 10, color: { rgb: "111827" } },
    alignment: { vertical: "center" },
  };
  const header: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "111827" } },
    border: makeBorder("111827"),
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  };
  const title: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 16, bold: true, color: { rgb: "111827" } },
  };
  const subtitle: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 10, color: { rgb: "6B7280" } },
  };
  const textCell: CellStyle = {
    ...base,
    border: makeBorder(),
  };
  const numberCell: CellStyle = {
    ...textCell,
    alignment: { vertical: "center", horizontal: "right" },
  };
  const calculatedCell: CellStyle = {
    ...textCell,
    fill: { fgColor: { rgb: "F3F7FF" } },
  };
  const groupCell: CellStyle = {
    ...textCell,
    font: { name: "Inter", sz: 10, bold: true, color: { rgb: "111827" } },
    fill: { fgColor: { rgb: "F9FAFB" } },
  };

  const addTitle = (ws: Worksheet, sheetTitle: string, description: string, lastCol: number) => {
    setCell(ws, encodeCell, 0, 0, sheetTitle, title);
    setCell(ws, encodeCell, 1, 0, description, subtitle);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    ];
  };

  const detailHeaders = [
    "Datum",
    "Wochentag",
    "GM",
    "Region",
    "Status",
    "Typ",
    "Berechnet",
    "Titel",
    "Detail",
    "Start",
    "Ende",
    "Dauer Min",
    "Dauer Std",
    "Start-KM",
    "End-KM",
    "KM gefahren",
    "Arbeitstag Min",
    "Reine AZ Min",
    "Pause Min",
    "Marktbesuche",
    "Zusatz",
    "Fragebogen",
    "Kommentar",
    "Session ID",
    "Segment ID",
  ];
  const detailWs: Worksheet = {};
  addTitle(detailWs, "Zeiterfassung Einträge", `${input.range.from} bis ${input.range.to} - ${input.timezone}`, detailHeaders.length - 1);
  detailHeaders.forEach((label, col) => setCell(detailWs, encodeCell, 3, col, label, header));

  const detailRows = buildSegmentRows(input.sessions);
  detailRows.forEach(({ session, segment }, index) => {
    const row = 4 + index;
    const style = CALCULATED_SEGMENTS.has(segment.kind) ? calculatedCell : textCell;
    const detail = segment.subtitle || subtypeLabel(segment.subtype) || "";
    const isCalculated = CALCULATED_SEGMENTS.has(segment.kind) ? "Ja" : "Nein";
    const values: Array<{ value: unknown; style?: CellStyle; extra?: Record<string, unknown> }> = [
      { value: excelDateSerial(session.date), extra: { t: "n", z: "DD.MM.YYYY" } },
      { value: weekdayLabel(session.date) },
      { value: session.gmName },
      { value: session.region || "" },
      { value: statusLabel(session.status, session.isLive) },
      { value: SEGMENT_LABELS[segment.kind] },
      { value: isCalculated },
      { value: segment.title },
      { value: detail },
      { value: timeFraction(segment.start), extra: { t: typeof timeFraction(segment.start) === "number" ? "n" : "s", z: "HH:MM" } },
      { value: timeFraction(segment.end), extra: { t: typeof timeFraction(segment.end) === "number" ? "n" : "s", z: "HH:MM" } },
      { value: segment.durationMin, style: numberCell },
      { value: Number((segment.durationMin / 60).toFixed(2)), style: numberCell },
      { value: session.startKm ?? "", style: numberCell },
      { value: session.endKm ?? "", style: numberCell },
      { value: session.stats?.kmGefahren ?? "", style: numberCell },
      { value: session.stats?.arbeitstag ?? 0, style: numberCell },
      { value: session.stats?.reineArbeitszeit ?? 0, style: numberCell },
      { value: session.stats?.pauseMin ?? 0, style: numberCell },
      { value: session.stats?.marktbesuche ?? 0, style: numberCell },
      { value: session.stats?.zusatz ?? 0, style: numberCell },
      { value: segment.questionnaireType ?? "" },
      { value: segment.comment ?? "" },
      { value: session.id },
      { value: segment.id },
    ];
    values.forEach((cell, col) => setCell(detailWs, encodeCell, row, col, cell.value, cell.style ?? style, cell.extra));
  });

  const detailLastRow = Math.max(4, detailRows.length + 3);
  detailWs["!ref"] = encodeRange({ s: { r: 0, c: 0 }, e: { r: detailLastRow, c: detailHeaders.length - 1 } });
  detailWs["!autofilter"] = { ref: encodeRange({ s: { r: 3, c: 0 }, e: { r: detailLastRow, c: detailHeaders.length - 1 } }) };
  detailWs["!cols"] = [12, 13, 24, 12, 14, 14, 11, 26, 36, 10, 10, 11, 11, 10, 10, 12, 13, 13, 11, 12, 10, 15, 34, 38, 38].map((wch) => ({ wch }));
  detailWs["!rows"] = Array.from({ length: detailLastRow + 1 }, (_, index) => ({ hpt: index === 0 ? 24 : index === 1 ? 20 : index === 3 ? 28 : 18 }));
  XLSX.utils.book_append_sheet(wb, detailWs, safeSheetName("Einträge"));

  const dayHeaders = [
    "Datum",
    "Wochentag",
    "GM",
    "Region",
    "Status",
    "Arbeitsbeginn",
    "Arbeitsende",
    "Arbeitstag Min",
    "Reine AZ Min",
    "Pause Min",
    "Anfahrt Min",
    "Fahrtzeit Min",
    "Heimfahrt Min",
    "Marktbesuch Min",
    "Zusatz Min",
    "Start-KM",
    "End-KM",
    "KM gefahren",
    "Marktbesuche",
    "Zusatz",
    "Session ID",
  ];
  const dayWs: Worksheet = {};
  addTitle(dayWs, "Tagesübersicht", "Ein Tag pro GM, inklusive berechneter Fahrtzeiten und Tages-KPIs.", dayHeaders.length - 1);
  dayHeaders.forEach((label, col) => setCell(dayWs, encodeCell, 3, col, label, header));
  input.sessions
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.gmName.localeCompare(right.gmName, "de"))
    .forEach((session, index) => {
      const row = 4 + index;
      const sumKind = (kind: AdminZeiterfassungSession["timeline"][number]["kind"]) =>
        (session.timeline ?? []).filter((segment) => segment.kind === kind).reduce((sum, segment) => sum + segment.durationMin, 0);
      const values: Array<{ value: unknown; style?: CellStyle; extra?: Record<string, unknown> }> = [
        { value: excelDateSerial(session.date), extra: { t: "n", z: "DD.MM.YYYY" } },
        { value: weekdayLabel(session.date) },
        { value: session.gmName },
        { value: session.region || "" },
        { value: statusLabel(session.status, session.isLive) },
        { value: timeFraction(session.startTime), extra: { t: typeof timeFraction(session.startTime) === "number" ? "n" : "s", z: "HH:MM" } },
        { value: timeFraction(session.endTime), extra: { t: typeof timeFraction(session.endTime) === "number" ? "n" : "s", z: "HH:MM" } },
        { value: session.stats?.arbeitstag ?? 0, style: numberCell },
        { value: session.stats?.reineArbeitszeit ?? 0, style: numberCell },
        { value: session.stats?.pauseMin ?? 0, style: numberCell },
        { value: sumKind("anfahrt"), style: numberCell },
        { value: sumKind("fahrtzeit"), style: numberCell },
        { value: sumKind("heimfahrt"), style: numberCell },
        { value: sumKind("marktbesuch"), style: numberCell },
        { value: sumKind("zusatzzeit"), style: numberCell },
        { value: session.startKm ?? "", style: numberCell },
        { value: session.endKm ?? "", style: numberCell },
        { value: session.stats?.kmGefahren ?? "", style: numberCell },
        { value: session.stats?.marktbesuche ?? 0, style: numberCell },
        { value: session.stats?.zusatz ?? 0, style: numberCell },
        { value: session.id },
      ];
      values.forEach((cell, col) => setCell(dayWs, encodeCell, row, col, cell.value, cell.style ?? textCell, cell.extra));
    });
  const dayLastRow = Math.max(4, input.sessions.length + 3);
  dayWs["!ref"] = encodeRange({ s: { r: 0, c: 0 }, e: { r: dayLastRow, c: dayHeaders.length - 1 } });
  dayWs["!autofilter"] = { ref: encodeRange({ s: { r: 3, c: 0 }, e: { r: dayLastRow, c: dayHeaders.length - 1 } }) };
  dayWs["!cols"] = [12, 13, 24, 12, 14, 12, 12, 14, 13, 11, 12, 13, 13, 15, 11, 10, 10, 12, 12, 10, 38].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, dayWs, safeSheetName("Tage"));

  const summaryHeaders = [
    "GM",
    "Region",
    "Tage",
    "Live Tage",
    "Arbeitstag Min",
    "Reine AZ Min",
    "Pause Min",
    "Anfahrt Min",
    "Fahrtzeit Min",
    "Heimfahrt Min",
    "Marktbesuch Min",
    "Zusatz Min",
    "KM gefahren",
    "Marktbesuche",
    "Zusatz",
  ];
  const summaryWs: Worksheet = {};
  addTitle(summaryWs, "GM Summen", "Praktische Summen pro GM für schnelle Kontrollen und Pivot-Auswertungen.", summaryHeaders.length - 1);
  summaryHeaders.forEach((label, col) => setCell(summaryWs, encodeCell, 3, col, label, header));
  const gmRows = buildGmSummary(input.sessions);
  gmRows.forEach((rowData, index) => {
    const row = 4 + index;
    const values = [
      rowData.gmName,
      rowData.region,
      rowData.days,
      rowData.liveDays,
      rowData.arbeitstagMin,
      rowData.reineArbeitszeitMin,
      rowData.pauseMin,
      rowData.anfahrtMin,
      rowData.fahrtzeitMin,
      rowData.heimfahrtMin,
      rowData.marktbesuchMin,
      rowData.zusatzMin,
      rowData.km,
      rowData.marktbesuche,
      rowData.zusatz,
    ];
    values.forEach((value, col) => setCell(summaryWs, encodeCell, row, col, value, col >= 2 ? numberCell : textCell));
  });
  const totalRow = 4 + gmRows.length;
  setCell(summaryWs, encodeCell, totalRow, 0, "Gesamt", groupCell);
  setCell(summaryWs, encodeCell, totalRow, 1, "", groupCell);
  for (let col = 2; col < summaryHeaders.length; col += 1) {
    const column = XLSX.utils.encode_col(col);
    summaryWs[encodeCell({ r: totalRow, c: col })] = {
      f: `SUM(${column}5:${column}${totalRow})`,
      t: "n",
      s: groupCell,
    };
  }
  const summaryLastRow = Math.max(totalRow, 4);
  summaryWs["!ref"] = encodeRange({ s: { r: 0, c: 0 }, e: { r: summaryLastRow, c: summaryHeaders.length - 1 } });
  summaryWs["!autofilter"] = { ref: encodeRange({ s: { r: 3, c: 0 }, e: { r: summaryLastRow - 1, c: summaryHeaders.length - 1 } }) };
  summaryWs["!cols"] = [24, 12, 10, 10, 14, 13, 11, 12, 13, 13, 15, 11, 12, 12, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, summaryWs, safeSheetName("GM Summen"));

  wb.Workbook = {
    Views: [{ RTL: false }],
  };

  const array = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true }) as ArrayBuffer;
  const filename = `Zeiterfassung_${fileSafeName(input.range.label)}.xlsx`;
  downloadBlob(
    new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}
