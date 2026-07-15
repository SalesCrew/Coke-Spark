import type { AdminZeitenaufstellungExportRow } from "@/lib/api/backend";

export type ZeitenaufstellungExportRange = {
  from: string;
  to: string;
  label: string;
  filenameLabel: string;
};

const HEADERS = [
  "Zielobjekt",
  "Kundennummer",
  "Besuchsdatum",
  "Besuchsstartzeit",
  "Person",
  "Bilder",
  "Fahrtbeginn",
  "Fahrtende",
  "Fahrtdauer",
  "Distanz",
  "Besuchsbeginn",
  "Besuchsende",
  "Besuchsdauer",
  "Ausfülldauer",
  "Fragebogenkategorie",
  "Ausfülldauer (berechnet)",
  "Kommentar",
  "Nicht Auswertbar",
  "Begründung",
  "Fragebogen",
] as const;

const COLUMN_WIDTHS = [
  13,
  19.44140625,
  20.44140625,
  13,
  13,
  6.33203125,
  13,
  13,
  13,
  13,
  13,
  13,
  13,
  13,
  13,
  13,
  13,
  8.6640625,
  13,
  13,
] as const;

export const ZEITENAUFSTELLUNG_MONTH_LABELS = [
  "Jänner",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function excelDateSerial(dateYmd: string): number {
  const [yearRaw, monthRaw, dayRaw] = dateYmd.split("-").map(Number);
  return Math.round(Date.UTC(yearRaw ?? 1970, (monthRaw ?? 1) - 1, dayRaw ?? 1) / 86_400_000 + 25_569);
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || "Zeitraum";
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

export function getZeitenaufstellungMonthRange(year: number, month: number): ZeitenaufstellungExportRange {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const next = new Date(Date.UTC(year, month + 1, 1, 12));
  const last = new Date(next);
  last.setUTCDate(last.getUTCDate() - 1);
  const monthLabel = ZEITENAUFSTELLUNG_MONTH_LABELS[month] ?? pad2(month + 1);
  return {
    from: toYmd(first),
    to: toYmd(last),
    label: `${monthLabel} ${year}`,
    filenameLabel: `${monthLabel}_${year}`,
  };
}

export function getZeitenaufstellungWeekRange(value: string): ZeitenaufstellungExportRange {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) throw new Error("Die ausgewählte Kalenderwoche ist ungültig.");
  const year = Number(match[1]);
  const week = Number(match[2]);
  const fourthJanuary = new Date(Date.UTC(year, 0, 4, 12));
  const fourthJanuaryWeekday = fourthJanuary.getUTCDay() || 7;
  const monday = new Date(fourthJanuary);
  monday.setUTCDate(fourthJanuary.getUTCDate() - fourthJanuaryWeekday + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: toYmd(monday),
    to: toYmd(sunday),
    label: `KW ${pad2(week)} · ${monday.toLocaleDateString("de-AT", { timeZone: "UTC" })} – ${sunday.toLocaleDateString("de-AT", { timeZone: "UTC" })}`,
    filenameLabel: `KW_${pad2(week)}_${year}`,
  };
}

type BuildZeitenaufstellungWorkbookInput = {
  rows: AdminZeitenaufstellungExportRow[];
  range: ZeitenaufstellungExportRange;
};

export async function buildAdminZeitenaufstellungWorkbook(input: BuildZeitenaufstellungWorkbookInput): Promise<ArrayBuffer> {
  if (input.rows.length === 0) {
    throw new Error("Für diesen Zeitraum gibt es keine Daten für die Zeitenaufstellung.");
  }

  const xlsxModule = await import("xlsx");
  const XLSX = ((xlsxModule as unknown as { default?: typeof xlsxModule }).default ?? xlsxModule);
  const data: Array<Array<string | number | boolean>> = [
    [...HEADERS],
    ...input.rows.map((row) => [
      row.targetObject,
      row.customerNumber,
      excelDateSerial(row.visitDate),
      row.visitStartTime,
      row.person,
      row.imageCount,
      "",
      "",
      row.travelDurationMin ?? "",
      "",
      "",
      "",
      row.visitDurationMin ?? "",
      "",
      "",
      row.calculatedFillDurationMin,
      row.comment,
      row.notEvaluable,
      row.reason,
      row.questionnaire,
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: 2 });
    const cell = worksheet[address];
    if (cell) {
      cell.t = "n";
      cell.z = "mm-dd-yy";
    }
  }
  worksheet["!cols"] = COLUMN_WIDTHS.map((width) => ({ width }));
  worksheet["!autofilter"] = { ref: "A1:T1" };
  worksheet["!views"] = [{ zoomScale: 80 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Gesamt");
  workbook.Workbook = {
    Views: [{ RTL: false }],
    Sheets: [{ name: "Gesamt", Hidden: 0 }],
  };

  const rawWorkbook = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  }) as ArrayBuffer;
  const jsZipModule = await import("jszip");
  const JSZip = (jsZipModule as unknown as { default: typeof jsZipModule.default }).default;
  const zip = await JSZip.loadAsync(rawWorkbook);
  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (sheetFile) {
    let xml = await sheetFile.async("string");
    xml = xml.replace(
      /<sheetView\b[^>]*workbookViewId="0"[^>]*\/>/,
      '<sheetView workbookViewId="0" rightToLeft="0" zoomScale="80" zoomScaleNormal="80"/>',
    );
    xml = xml.replace(/<autoFilter ref="[^"]+"\/>/, '<autoFilter ref="A1:T1"/>');
    zip.file("xl/worksheets/sheet1.xml", xml);
  }
  const stylesFile = zip.file("xl/styles.xml");
  if (stylesFile) {
    const stylesXml = (await stylesFile.async("string")).replace('<sz val="12"/>', '<sz val="11"/>');
    zip.file("xl/styles.xml", stylesXml);
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

export async function exportAdminZeitenaufstellung(input: BuildZeitenaufstellungWorkbookInput): Promise<void> {
  const array = await buildAdminZeitenaufstellungWorkbook(input);
  downloadBlob(
    new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Zeitenaufstellung_${safeFilenamePart(input.range.filenameLabel)}.xlsx`,
  );
}
