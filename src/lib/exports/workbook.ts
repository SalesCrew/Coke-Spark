type XlsxModule = typeof import("xlsx-js-style");
type Workbook = ReturnType<XlsxModule["utils"]["book_new"]>;
type Worksheet = Record<string, unknown>;
type CellStyle = Record<string, unknown>;

export type ExportCellValue = string | number | boolean | null | undefined;

export type ExportColumn<T> = {
  header: string;
  width?: number;
  value: (row: T, index: number) => ExportCellValue;
  numberFormat?: string;
  align?: "left" | "center" | "right";
};

export type ExportMetaRow = {
  label: string;
  value: ExportCellValue;
};

export type ExportTableSheet<T> = {
  name: string;
  title: string;
  description?: string;
  rows: T[];
  columns: ExportColumn<T>[];
};

export const COKE_RED = "DC2626";
export const COKE_DARK_RED = "B91C1C";

function makeBorder(color = "D9DEE8") {
  return {
    top: { style: "thin", color: { rgb: color } },
    right: { style: "thin", color: { rgb: color } },
    bottom: { style: "thin", color: { rgb: color } },
    left: { style: "thin", color: { rgb: color } },
  };
}

function makeBaseStyle(): CellStyle {
  return {
    font: { name: "Inter", sz: 10, color: { rgb: "111827" } },
    alignment: { vertical: "center" },
  };
}

export function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Tabelle";
}

export function fileSafeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || "Export";
}

export function excelDateSerial(dateYmd: string): number | string {
  const [yearRaw, monthRaw, dayRaw] = dateYmd.split("-").map(Number);
  if (!yearRaw || !monthRaw || !dayRaw) return "";
  return Math.round(Date.UTC(yearRaw, monthRaw - 1, dayRaw) / 86400000 + 25569);
}

export function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "";
  return value ? "Ja" : "Nein";
}

export function formatExportDateTime(date = new Date()): string {
  return date.toLocaleString("de-AT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row)?.trim() || "Leer";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "de"));
}

function cellType(value: ExportCellValue): "s" | "n" | "b" {
  if (typeof value === "number") return "n";
  if (typeof value === "boolean") return "b";
  return "s";
}

function cellValue(value: ExportCellValue): string | number | boolean {
  if (value == null) return "";
  return value;
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
  encodeCell: XlsxModule["utils"]["encode_cell"],
  row: number,
  col: number,
  value: ExportCellValue,
  style: CellStyle,
  extra?: Record<string, unknown>,
) {
  const normalized = cellValue(value);
  ws[encodeCell({ r: row, c: col })] = {
    v: normalized,
    t: cellType(normalized),
    s: style,
    ...(extra ?? {}),
  };
}

export function appendMetaSheet(XLSX: XlsxModule, wb: Workbook, metaRows: ExportMetaRow[]) {
  const ws: Worksheet = {};
  const encodeCell = XLSX.utils.encode_cell;
  const encodeRange = XLSX.utils.encode_range;
  const base = makeBaseStyle();
  const title: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 16, bold: true, color: { rgb: "111827" } },
  };
  const labelStyle: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 9, bold: true, color: { rgb: "6B7280" } },
    fill: { fgColor: { rgb: "F9FAFB" } },
    border: makeBorder(),
  };
  const valueStyle: CellStyle = {
    ...base,
    border: makeBorder(),
  };

  setCell(ws, encodeCell, 0, 0, "Coke Spark Export", title);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  metaRows.forEach((row, index) => {
    const excelRow = index + 2;
    setCell(ws, encodeCell, excelRow, 0, row.label, labelStyle);
    setCell(ws, encodeCell, excelRow, 1, row.value, valueStyle);
  });
  const lastRow = Math.max(2, metaRows.length + 1);
  ws["!ref"] = encodeRange({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 2 } });
  ws["!cols"] = [{ wch: 26 }, { wch: 44 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName("Meta"));
}

export function appendTableSheet<T>(XLSX: XlsxModule, wb: Workbook, sheet: ExportTableSheet<T>) {
  const ws: Worksheet = {};
  const encodeCell = XLSX.utils.encode_cell;
  const encodeRange = XLSX.utils.encode_range;
  const base = makeBaseStyle();
  const title: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 15, bold: true, color: { rgb: "111827" } },
  };
  const subtitle: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 10, color: { rgb: "6B7280" } },
  };
  const header: CellStyle = {
    ...base,
    font: { name: "Inter", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "111827" } },
    border: makeBorder("111827"),
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  };
  const textCell: CellStyle = {
    ...base,
    border: makeBorder(),
  };
  const numberCell: CellStyle = {
    ...textCell,
    alignment: { vertical: "center", horizontal: "right" },
  };
  const centerCell: CellStyle = {
    ...textCell,
    alignment: { vertical: "center", horizontal: "center" },
  };

  setCell(ws, encodeCell, 0, 0, sheet.title, title);
  setCell(ws, encodeCell, 1, 0, sheet.description ?? `${sheet.rows.length} Zeilen`, subtitle);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, sheet.columns.length - 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, sheet.columns.length - 1) } },
  ];
  sheet.columns.forEach((column, col) => setCell(ws, encodeCell, 3, col, column.header, header));

  sheet.rows.forEach((rowData, index) => {
    const row = index + 4;
    sheet.columns.forEach((column, col) => {
      const rawValue = column.value(rowData, index);
      const isNumber = typeof rawValue === "number";
      const style = column.align === "center" ? centerCell : isNumber || column.align === "right" ? numberCell : textCell;
      setCell(ws, encodeCell, row, col, rawValue, style, column.numberFormat ? { z: column.numberFormat } : undefined);
    });
  });

  const lastRow = Math.max(4, sheet.rows.length + 3);
  const lastCol = Math.max(0, sheet.columns.length - 1);
  ws["!ref"] = encodeRange({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
  ws["!autofilter"] = { ref: encodeRange({ s: { r: 3, c: 0 }, e: { r: lastRow, c: lastCol } }) };
  ws["!freeze"] = { xSplit: 0, ySplit: 4 };
  ws["!cols"] = sheet.columns.map((column) => ({ wch: column.width ?? 18 }));
  ws["!rows"] = Array.from({ length: lastRow + 1 }, (_, index) => ({
    hpt: index === 0 ? 24 : index === 1 ? 20 : index === 3 ? 28 : 18,
  }));
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name));
}

export async function buildAndDownloadWorkbook(input: {
  filename: string;
  build: (ctx: { XLSX: XlsxModule; wb: Workbook }) => void;
}) {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  input.build({ XLSX, wb });
  wb.Workbook = { Views: [{ RTL: false }] };
  const array = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true }) as ArrayBuffer;
  downloadBlob(
    new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    input.filename,
  );
}
