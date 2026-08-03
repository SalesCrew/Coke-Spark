import type { AdminDiaetenExportPayload } from "@/lib/api/backend";

type DiaetenGm = AdminDiaetenExportPayload["gls"][number];
type CellStyle = Record<string, unknown>;
type Worksheet = Record<string, unknown>;

const TIMEZONE = "Europe/Vienna";
const CUTOVER_YEAR = 2026;
const CUTOVER_MONTH = 4;

const RATE_BEFORE = {
  base: 9.77,
  increment: 4.03,
  max: 31.77,
  taxThreshold: 30.0,
  overnightFull: 39.58,
  overnightReduced: 23.3,
  overnightFlat: 17.7,
};

const RATE_AFTER = {
  base: 10.01,
  increment: 4.13,
  max: 32.53,
  taxThreshold: 30.0,
  overnightFull: 40.53,
  overnightReduced: 23.86,
  overnightFlat: 18.13,
};

const MONTH_LABELS = [
  "Januar",
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
];

type DailyExportRow = {
  date: string;
  startAt: Date | null;
  endAt: Date | null;
  pauseMin: number;
  locations: string[];
  reasons: string[];
  startKm: number | null;
  endKm: number | null;
};

type AwayEvent = {
  id: string;
  startAt: Date;
  endAt: Date;
  kind: "eligible" | "hard_break" | "pause";
  reason?: string;
  location?: string;
};

function getRates(year: number, month: number) {
  return year > CUTOVER_YEAR || (year === CUTOVER_YEAR && month >= CUTOVER_MONTH) ? RATE_AFTER : RATE_BEFORE;
}

export type DiaetenDayAmounts = {
  grossMinutes: number;
  pauseMinutes: number;
  netMinutes: number;
  taggeld: number;
  taxFree: number;
  taxable: number;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiaetenDayAmounts(input: {
  grossMinutes: number;
  recordedPauseMinutes: number;
  year: number;
  month: number;
}): DiaetenDayAmounts {
  const rates = getRates(input.year, input.month);
  const grossMinutes = Math.max(0, Math.round(input.grossMinutes));
  const recordedPauseMinutes = Math.max(0, Math.round(input.recordedPauseMinutes));
  const pauseMinutes = recordedPauseMinutes > 0 ? recordedPauseMinutes : grossMinutes > 360 ? 30 : 0;
  const netMinutes = Math.max(0, grossMinutes - pauseMinutes);

  if (grossMinutes < 360) {
    return { grossMinutes, pauseMinutes, netMinutes, taggeld: 0, taxFree: 0, taxable: 0 };
  }

  const fullHoursAfterSix = Math.floor(Math.max(0, netMinutes / 60 - 6));
  const taggeld = roundCurrency(Math.min(rates.base + fullHoursAfterSix * rates.increment, rates.max));
  const taxFree = roundCurrency(Math.min(taggeld, rates.taxThreshold));
  const taxable = roundCurrency(Math.max(0, taggeld - rates.taxThreshold));

  return { grossMinutes, pauseMinutes, netMinutes, taggeld, taxFree, taxable };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getDiaetenExportDates(from: string, to: string): string[] {
  const cursor = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor.getTime() > end.getTime()) {
    throw new Error("Der gewählte Diäten-Zeitraum ist ungültig.");
  }
  const result: string[] = [];
  while (cursor.getTime() <= end.getTime()) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (result.length > 370) throw new Error("Der Diäten-Zeitraum darf höchstens 370 Tage umfassen.");
  }
  return result;
}

function toViennaYmd(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toViennaTimeFraction(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour") ?? "0");
  const minute = Number(map.get("minute") ?? "0");
  return (hour * 60 + minute) / 1440;
}

function excelDateSerial(dateYmd: string): number {
  const [yearRaw, monthRaw, dayRaw] = dateYmd.split("-").map(Number);
  return Math.round(Date.UTC(yearRaw, (monthRaw ?? 1) - 1, dayRaw ?? 1) / 86400000 + 25569);
}

function normalizeCompact(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isHardBreak(reason: string): boolean {
  const compact = normalizeCompact(reason);
  return (
    compact === "homeoffice" ||
    compact.includes("homeoffice") ||
    compact === "arztbesuch" ||
    compact === "arzt" ||
    compact === "buero" ||
    compact === "buro"
  );
}

function fallbackReasonLabel(reason: string): string {
  const compact = normalizeCompact(reason);
  if (compact === "marktbesuch") return "Marktbesuch";
  if (compact === "sonderaufgabe") return "Sonderaufgabe";
  if (compact === "werkstatt") return "Werkstatt";
  if (compact === "lager") return "Lager";
  if (compact === "hotel" || compact === "hoteluebernachtung") return "Hotel";
  if (compact === "dienstreise") return "Dienstreise";
  if (compact === "heimfahrt") return "Heimfahrt";
  if (compact === "schulung") return "Schulung (Auto)";
  return reason;
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? Math.round((end - start) / 60000) : 0;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function marketLocation(input: {
  marketName: string;
  marketAddress: string;
  marketCity: string;
  marketPostalCode: string;
}): string {
  return [input.marketName, input.marketAddress, input.marketCity, input.marketPostalCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

function fileSafeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildDayRows(payload: AdminDiaetenExportPayload, gm: DiaetenGm): DailyExportRow[] {
  const dates = getDiaetenExportDates(payload.range.from, payload.range.to);
  const eventsByDate = new Map<string, AwayEvent[]>();
  const trackingByDate = new Map<string, DiaetenGm["dayTrackings"][number]>();

  for (const tracking of gm.dayTrackings) {
    trackingByDate.set(tracking.date, tracking);
  }

  const pushEvent = (date: string, event: AwayEvent) => {
    const bucket = eventsByDate.get(date) ?? [];
    bucket.push(event);
    eventsByDate.set(date, bucket);
  };

  for (const visit of gm.marketVisits) {
    const startAt = new Date(visit.startAt);
    const endAt = new Date(visit.endAt);
    if (endAt.getTime() <= startAt.getTime()) continue;
    pushEvent(toViennaYmd(startAt), {
      id: visit.id,
      startAt,
      endAt,
      kind: "eligible",
      reason: "Marktbesuch",
      location: marketLocation(visit),
    });
  }

  for (const entry of gm.zusatzEntries) {
    const startAt = new Date(entry.startAt);
    const endAt = new Date(entry.endAt);
    if (endAt.getTime() <= startAt.getTime()) continue;
    const reason = entry.reason || entry.reasonLabel || "Zusatz";
    const compact = normalizeCompact(reason);
    const kind =
      isHardBreak(reason)
        ? "hard_break"
        : entry.isWorkTimeDeduction || compact === "unterbrechung"
          ? "pause"
          : "eligible";
    pushEvent(toViennaYmd(startAt), {
      id: entry.id,
      startAt,
      endAt,
      kind,
      reason: entry.reasonLabel || fallbackReasonLabel(reason),
      location: kind === "eligible" ? entry.location || entry.marketName || entry.schulungOrt || "" : "",
    });
  }

  for (const pause of gm.pauses) {
    const startAt = new Date(pause.startAt);
    const endAt = new Date(pause.endAt);
    if (endAt.getTime() <= startAt.getTime()) continue;
    pushEvent(toViennaYmd(startAt), {
      id: pause.id,
      startAt,
      endAt,
      kind: "pause",
      reason: "Pause",
    });
  }

  const result: DailyExportRow[] = [];
  for (const date of dates) {
    const events = [...(eventsByDate.get(date) ?? [])].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const tracking = trackingByDate.get(date);
    const startCandidates = events.map((event) => event.startAt);
    const endCandidates = events.map((event) => event.endAt);
    if (tracking?.dayStartAt) startCandidates.push(new Date(tracking.dayStartAt));
    if (tracking?.dayEndAt) endCandidates.push(new Date(tracking.dayEndAt));

    const eligibleEvents = events.filter((event) => event.kind === "eligible");
    if (startCandidates.length === 0 || endCandidates.length === 0 || eligibleEvents.length === 0) {
      result.push({
        date,
        startAt: null,
        endAt: null,
        pauseMin: 0,
        locations: [],
        reasons: [],
        startKm: tracking?.startKm ?? null,
        endKm: tracking?.endKm ?? null,
      });
      continue;
    }

    const dayStart = new Date(Math.min(...startCandidates.map((value) => value.getTime())));
    const dayEnd = new Date(Math.max(...endCandidates.map((value) => value.getTime())));
    const hardBreaks = events
      .filter((event) => event.kind === "hard_break")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const segments: Array<{ startAt: Date; endAt: Date }> = [];
    let cursor = dayStart;
    for (const hardBreak of hardBreaks) {
      if (hardBreak.endAt.getTime() <= cursor.getTime() || hardBreak.startAt.getTime() >= dayEnd.getTime()) continue;
      const breakStart = new Date(Math.max(hardBreak.startAt.getTime(), dayStart.getTime()));
      const breakEnd = new Date(Math.min(hardBreak.endAt.getTime(), dayEnd.getTime()));
      if (breakStart.getTime() > cursor.getTime()) {
        segments.push({ startAt: cursor, endAt: breakStart });
      }
      if (breakEnd.getTime() > cursor.getTime()) cursor = breakEnd;
    }
    if (cursor.getTime() < dayEnd.getTime()) {
      segments.push({ startAt: cursor, endAt: dayEnd });
    }

    const eligibleSegments = segments.filter((segment) =>
      eligibleEvents.some((event) => intervalsOverlap(segment.startAt, segment.endAt, event.startAt, event.endAt)),
    );
    const selected = eligibleSegments.sort(
      (a, b) => b.endAt.getTime() - b.startAt.getTime() - (a.endAt.getTime() - a.startAt.getTime()),
    )[0];

    if (!selected) {
      result.push({
        date,
        startAt: null,
        endAt: null,
        pauseMin: 0,
        locations: [],
        reasons: [],
        startKm: tracking?.startKm ?? null,
        endKm: tracking?.endKm ?? null,
      });
      continue;
    }

    const inSegment = eligibleEvents.filter((event) =>
      intervalsOverlap(selected.startAt, selected.endAt, event.startAt, event.endAt),
    );
    const pauseMin = events
      .filter((event) => event.kind === "pause")
      .reduce((sum, pause) => sum + overlapMinutes(selected.startAt, selected.endAt, pause.startAt, pause.endAt), 0);

    result.push({
      date,
      startAt: selected.startAt,
      endAt: selected.endAt,
      pauseMin,
      locations: uniqueNonEmpty(inSegment.map((event) => event.location ?? "")),
      reasons: uniqueNonEmpty(inSegment.map((event) => event.reason ?? "")),
      startKm: tracking?.startKm ?? null,
      endKm: tracking?.endKm ?? null,
    });
  }

  return result;
}

function euro(value: number): string {
  return value.toFixed(2);
}

function legendEuro(value: number): string {
  return euro(value).replace(".", ",");
}

function makeBorder(color = "B0B0B0") {
  return {
    top: { style: "thin", color: { rgb: color } },
    right: { style: "thin", color: { rgb: color } },
    bottom: { style: "thin", color: { rgb: color } },
    left: { style: "thin", color: { rgb: color } },
  };
}

export function buildAdminDiaetenWorkbook(payload: AdminDiaetenExportPayload, gm: DiaetenGm, XLSX: typeof import("xlsx-js-style")) {
  const rates = getRates(payload.year, payload.month);
  const wb = XLSX.utils.book_new();
  (wb as unknown as { Workbook?: Record<string, unknown> }).Workbook = {
    CalcPr: {
      calcMode: "auto",
      fullCalcOnLoad: true,
      forceFullCalc: true,
    },
  };
  const ws: Worksheet = {};
  const encodeCell = XLSX.utils.encode_cell;
  const fullName = `${gm.firstName} ${gm.lastName}`.trim();
  const dayRows = buildDayRows(payload, gm);
  const dataStart = 13;
  const totalRow = dataStart + dayRows.length;
  const footerStart = totalRow + 2;
  const payoutRow = footerStart + 3;
  const signatureDateRow = footerStart + 5;
  const signatureLabelRow = signatureDateRow + 1;
  const legendStart = signatureLabelRow + 4;
  const lastRow = legendStart + 7;

  const noBorder: CellStyle = {
    font: { sz: 10, color: { rgb: "000000" } },
    alignment: { vertical: "center" },
  };
  const thinBorder = makeBorder();
  const purple = "F2CFEE";
  const headerGrey = "D9D9D9";
  const subGrey = "E8E8E8";
  const dataGrey = "BFBFBF";
  const baseCell: CellStyle = {
    ...noBorder,
    border: thinBorder,
    alignment: { vertical: "center", wrapText: true },
  };
  const headerCell: CellStyle = {
    ...baseCell,
    fill: { fgColor: { rgb: headerGrey } },
    font: { sz: 10, bold: true, color: { rgb: "000000" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  };
  const subHeaderCell: CellStyle = {
    ...baseCell,
    fill: { fgColor: { rgb: subGrey } },
    font: { sz: 9, italic: true, color: { rgb: "555555" } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  };
  const purpleCell: CellStyle = {
    ...baseCell,
    fill: { fgColor: { rgb: purple } },
    font: { sz: 11, bold: true, color: { rgb: "000000" } },
  };
  const purpleNoBorderCell: CellStyle = {
    ...noBorder,
    fill: { fgColor: { rgb: purple } },
  };
  const dataCell: CellStyle = {
    ...baseCell,
    fill: { fgColor: { rgb: dataGrey } },
  };
  const plainCell: CellStyle = {
    ...baseCell,
  };
  const totalCell: CellStyle = {
    ...baseCell,
    fill: { fgColor: { rgb: headerGrey } },
    font: { sz: 10, bold: true, color: { rgb: "000000" } },
  };

  function setCell(row: number, col: number, value: unknown, style: CellStyle = noBorder, extra?: Record<string, unknown>) {
    ws[encodeCell({ r: row, c: col })] = {
      v: value,
      t: typeof value === "number" ? "n" : "s",
      s: style,
      ...(extra ?? {}),
    };
  }

  function setFormula(
    row: number,
    col: number,
    formula: string,
    style: CellStyle = baseCell,
    numFmt?: string,
    cachedValue?: number,
  ) {
    ws[encodeCell({ r: row, c: col })] = {
      f: formula,
      t: "n",
      s: style,
      ...(numFmt ? { z: numFmt } : {}),
      ...(cachedValue == null ? {} : { v: cachedValue }),
    };
  }

  setCell(0, 0, "Diäten Dokumentation", {
    ...noBorder,
    font: { sz: 16, bold: true, color: { rgb: "000000" } },
    alignment: { vertical: "center" },
  });

  setCell(2, 0, "Name", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(2, 2, fullName, { ...purpleNoBorderCell, font: { sz: 11, bold: true, color: { rgb: "000000" } } });
  setCell(2, 6, "Adresse", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(2, 7, "", noBorder);
  setCell(3, 7, "", noBorder);

  setCell(4, 0, "Abrechnungszeitraum", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(4, 2, excelDateSerial(payload.range.from), purpleNoBorderCell, { t: "n", z: "DD.MM.YYYY" });
  setCell(4, 6, `bis ${payload.range.to.split("-").reverse().join(".")}`, {
    ...noBorder,
    font: { sz: 9, italic: true, color: { rgb: "999999" } },
  });

  setCell(6, 0, "Firma", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(6, 2, "Merchandising - Institut für Verkaufsförderung", purpleNoBorderCell);

  setCell(8, 6, "Bitte Legende unterhalb der Abrechnung beachten!", {
    ...noBorder,
    font: { sz: 9, italic: true, color: { rgb: "999999" } },
  });
  setCell(8, 7, "Bei Auslandsaufenthalt:\nRücksprache mit Projektleitung", {
    ...noBorder,
    font: { sz: 9, italic: true, color: { rgb: "999999" } },
    alignment: { vertical: "center", wrapText: true },
  });

  setCell(9, 0, "Diäten (kalendertagbasiert)", {
    ...noBorder,
    font: { sz: 12, bold: true, color: { rgb: "000000" } },
  });

  const headers = [
    "Datum ",
    "Dienstreise:\nBeginn",
    "Dienstreise:\nEnde",
    "Pause",
    "Dienstreise Dauer",
    "Ort (genaue Adresse angeben)",
    "Kunde und/oder Grund",
    "bezahlte Nächtigung?",
    "Taggeld Inland",
    "Taggeld Inland steuerfrei",
    "Taggeld Inland zu Versteuern",
    "KM-Stand Beginn",
    "KM-Stand Ende",
    "erstattungs- fähige Nächtigung? (ohne Beleg)",
    "pauschales Nächtigungs-geld Inland",
    "Abwesenheit in h",
  ];
  headers.forEach((label, index) => setCell(11, index, label, headerCell));
  const subHeaders = [
    "Datum ",
    "Uhrzeit",
    "Uhrzeit",
    "Zeit",
    "Zeit",
    "",
    "",
    ":H = Hinfahrt\nM = Mitteltag\nR = Rückfahrt",
    "",
    "",
    "",
    "",
    "",
    "X",
    "",
    "",
  ];
  subHeaders.forEach((label, index) => setCell(12, index, label, subHeaderCell));

  const euroFormat = '#,##0.00" €"';
  const optionalEuroFormat = '#,##0.00" €";-#,##0.00" €";""';
  const taxableEuroFormat = '#,##0.00" €";-#,##0.00" €";"-"';
  let totalTaggeld = 0;
  let totalTaxFree = 0;
  let totalTaxable = 0;

  dayRows.forEach((row, index) => {
    const r = dataStart + index;
    const excelRow = r + 1;
    const locationText = row.locations.join("\n");
    const reasonText = row.reasons.join(", ");
    const startFraction = row.startAt ? toViennaTimeFraction(row.startAt) : null;
    const endFraction = row.endAt ? toViennaTimeFraction(row.endAt) : null;
    let grossMinutes = 0;
    if (startFraction != null && endFraction != null) {
      grossMinutes = Math.round((endFraction - startFraction) * 1440);
      if (grossMinutes < 0) grossMinutes += 1440;
    }
    const amounts = calculateDiaetenDayAmounts({
      grossMinutes,
      recordedPauseMinutes: row.pauseMin,
      year: payload.year,
      month: payload.month,
    });
    totalTaggeld = roundCurrency(totalTaggeld + amounts.taggeld);
    totalTaxFree = roundCurrency(totalTaxFree + amounts.taxFree);
    totalTaxable = roundCurrency(totalTaxable + amounts.taxable);

    setCell(r, 0, excelDateSerial(row.date), plainCell, { t: "n", z: "DD.MM.YYYY" });
    if (startFraction != null) setCell(r, 1, startFraction, { ...plainCell, fill: { fgColor: { rgb: purple } } }, { t: "n", z: "HH:MM" });
    else setCell(r, 1, "", { ...plainCell, fill: { fgColor: { rgb: purple } } });
    if (endFraction != null) setCell(r, 2, endFraction, { ...plainCell, fill: { fgColor: { rgb: purple } } }, { t: "n", z: "HH:MM" });
    else setCell(r, 2, "", { ...plainCell, fill: { fgColor: { rgb: purple } } });

    const pauseFraction = Number((row.pauseMin / 1440).toFixed(12));
    setFormula(
      r,
      3,
      `IF($B${excelRow}="","",IF(${pauseFraction}>0,${pauseFraction},IF(($C${excelRow}-$B${excelRow})>0.25,0.0208333333333333,"")))`,
      { ...plainCell, fill: { fgColor: { rgb: purple } } },
      "HH:MM",
      amounts.pauseMinutes > 0 ? amounts.pauseMinutes / 1440 : undefined,
    );
    setFormula(
      r,
      4,
      `IF($C${excelRow}="","",$C${excelRow}-$B${excelRow})`,
      { ...plainCell, fill: { fgColor: { rgb: purple } } },
      "HH:MM",
      startFraction != null && endFraction != null ? amounts.grossMinutes / 1440 : undefined,
    );
    setCell(r, 5, locationText, { ...plainCell, alignment: { vertical: "top", wrapText: true } });
    setCell(r, 6, reasonText, plainCell);
    setCell(r, 7, "", plainCell);
    setFormula(
      r,
      8,
      `IF($B${excelRow}="",0,IF((($C${excelRow}-$B${excelRow})*24)>=6,MIN(${euro(rates.max)},${euro(rates.base)}+(ROUNDDOWN(MAX(0,(($C${excelRow}-$B${excelRow})-IF(ISNUMBER($D${excelRow}),$D${excelRow},0))*24)-6,0)*${euro(rates.increment)})),0))`,
      dataCell,
      optionalEuroFormat,
      amounts.taggeld,
    );
    setFormula(
      r,
      9,
      `IF($B${excelRow}="",0,$I${excelRow}-$K${excelRow})`,
      { ...plainCell, fill: { fgColor: { rgb: purple } } },
      optionalEuroFormat,
      amounts.taxFree,
    );
    setFormula(
      r,
      10,
      `IF($B${excelRow}="",0,MAX(0,$I${excelRow}-${euro(rates.taxThreshold)}))`,
      dataCell,
      taxableEuroFormat,
      amounts.taxable,
    );
    setCell(r, 11, row.startKm ?? "", plainCell, row.startKm == null ? undefined : { t: "n", z: "#,##0" });
    setCell(r, 12, row.endKm ?? "", plainCell, row.endKm == null ? undefined : { t: "n", z: "#,##0" });
    setCell(r, 13, "", plainCell);
    setFormula(
      r,
      14,
      `IF($A${excelRow}="",0,IF($N${excelRow}="",0,${euro(rates.overnightFlat)}))`,
      plainCell,
      optionalEuroFormat,
      0,
    );
    setFormula(
      r,
      15,
      `IF($E${excelRow}="",0,ROUND(MAX(0,($E${excelRow}-IF(ISNUMBER($D${excelRow}),$D${excelRow},0))*24),2))`,
      plainCell,
      "0.00",
      startFraction != null && endFraction != null ? roundCurrency(amounts.netMinutes / 60) : 0,
    );
  });

  const firstDataExcelRow = dataStart + 1;
  const lastDataExcelRow = totalRow;
  const totalExcelRow = totalRow + 1;
  setCell(totalRow, 0, "Gesamt", totalCell);
  for (let c = 1; c <= 15; c += 1) setCell(totalRow, c, "", totalCell);
  setFormula(totalRow, 8, `SUM(I${firstDataExcelRow}:I${lastDataExcelRow})`, totalCell, euroFormat, totalTaggeld);
  setFormula(totalRow, 9, `SUM(J${firstDataExcelRow}:J${lastDataExcelRow})`, totalCell, euroFormat, totalTaxFree);
  setFormula(totalRow, 10, `SUM(K${firstDataExcelRow}:K${lastDataExcelRow})`, totalCell, euroFormat, totalTaxable);
  setFormula(totalRow, 14, `SUM(O${firstDataExcelRow}:O${lastDataExcelRow})`, totalCell, euroFormat, 0);

  setCell(footerStart, 0, "Gesamtsumme Taggelder Inland:", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setFormula(footerStart, 14, `I${totalExcelRow}`, { ...noBorder, font: { sz: 11, bold: true } }, euroFormat, totalTaggeld);
  setCell(footerStart + 1, 0, "Gesamtsumme der pauschalen Nächtigungsgelder:", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setFormula(footerStart + 1, 14, `O${totalExcelRow}`, noBorder, euroFormat, 0);
  setCell(payoutRow, 0, "Auszahlungsbetrag für Verpflegungsmehraufwendungen mit der nächsten Lohn- & Gehaltsabrechnung:", { ...noBorder, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setFormula(
    payoutRow,
    14,
    `SUM(O${footerStart + 1}:O${footerStart + 2})`,
    { ...noBorder, font: { sz: 12, bold: true, color: { rgb: "000000" } } },
    euroFormat,
    totalTaggeld,
  );

  setCell(signatureDateRow, 0, excelDateSerial(payload.range.to), noBorder, { t: "n", z: "DD.MM.YYYY" });
  setCell(signatureLabelRow, 0, "Datum", noBorder);
  setCell(signatureLabelRow, 1, "Unterschrift\nMitarbeiter", { ...noBorder, alignment: { vertical: "center", wrapText: true } });
  setCell(signatureLabelRow, 13, "Stempel/Unterschrift Zeichner", { ...noBorder, alignment: { vertical: "center", horizontal: "center", wrapText: true } });

  setCell(legendStart, 0, "Legende:", { ...noBorder, font: { sz: 11, bold: true } });
  setCell(legendStart, 1, "Taggeld", { ...noBorder, fill: { fgColor: { rgb: dataGrey } }, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(legendStart, 4, "Ab einer Dienstreise von 6 Stunden (inkl. Fahrtzeit, exkl. Mittagspause) außerhalb der Heimadresse", noBorder);
  setCell(legendStart + 1, 4, `€ ${legendEuro(rates.base)} ab 6h + € ${legendEuro(rates.increment)} für jede zusätzliche volle Stunde | max. € ${legendEuro(rates.max)} pro Tag`, noBorder);
  setCell(legendStart + 2, 1, "Taggeld bei Nächtigung", { ...noBorder, fill: { fgColor: { rgb: dataGrey } }, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(legendStart + 2, 4, 'Ab einer Abwesenheit von 11 Stunden (tagesübergreifend) und wenn eine Nächtigung nötig ist → Spalte "bezahlte Nächtigung"', noBorder);
  setCell(legendStart + 3, 4, `- Abfahrt bei Hinreise vor 12 Uhr: € ${legendEuro(rates.overnightFull)}/Tag  |  nach 12 Uhr: € ${legendEuro(rates.overnightReduced)}/Tag`, noBorder);
  setCell(legendStart + 4, 4, `- Mitteltag (=Übernachtungen vom Vortag & auf den nächsten Tag): € ${legendEuro(rates.overnightFull)}/Tag`, noBorder);
  setCell(legendStart + 5, 4, `- Ankunft bei Rückreise vor 17 Uhr: € ${legendEuro(rates.overnightReduced)}/Tag  |  nach 17 Uhr: € ${legendEuro(rates.overnightFull)}/Tag`, noBorder);
  setCell(legendStart + 6, 1, "Nächtigungsgeld", { ...noBorder, fill: { fgColor: { rgb: dataGrey } }, font: { sz: 10, bold: true, color: { rgb: "000000" } } });
  setCell(legendStart + 6, 4, `Wenn Übernachtung nötig, aber nicht vom Dienstnehmer bereit gestellt: € ${legendEuro(rates.overnightFlat)}/Nacht → Spalte "erstattungsfähige Nächtigung"`, noBorder);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 14 } },
    { s: { r: 3, c: 7 }, e: { r: 3, c: 14 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 5 } },
    { s: { r: 6, c: 2 }, e: { r: 6, c: 5 } },
    { s: { r: 9, c: 0 }, e: { r: 10, c: 4 } },
    { s: { r: signatureLabelRow, c: 13 }, e: { r: signatureLabelRow, c: 14 } },
    { s: { r: legendStart, c: 1 }, e: { r: legendStart + 1, c: 2 } },
    { s: { r: legendStart, c: 4 }, e: { r: legendStart, c: 14 } },
    { s: { r: legendStart + 1, c: 4 }, e: { r: legendStart + 1, c: 14 } },
    { s: { r: legendStart + 2, c: 1 }, e: { r: legendStart + 5, c: 2 } },
    { s: { r: legendStart + 2, c: 4 }, e: { r: legendStart + 2, c: 14 } },
    { s: { r: legendStart + 3, c: 4 }, e: { r: legendStart + 3, c: 14 } },
    { s: { r: legendStart + 4, c: 4 }, e: { r: legendStart + 4, c: 14 } },
    { s: { r: legendStart + 5, c: 4 }, e: { r: legendStart + 5, c: 14 } },
    { s: { r: legendStart + 6, c: 1 }, e: { r: legendStart + 6, c: 2 } },
    { s: { r: legendStart + 6, c: 4 }, e: { r: legendStart + 6, c: 14 } },
  ];

  ws["!cols"] = [40, 14, 13, 12, 21, 70, 30, 21, 17, 26, 30, 19, 17, 31, 32, 16].map((wch) => ({ wch }));
  const rows: Array<{ hpt: number }> = Array.from({ length: lastRow + 1 }, () => ({ hpt: 18 }));
  rows[0] = { hpt: 28 };
  rows[9] = { hpt: 24 };
  rows[11] = { hpt: 42 };
  rows[12] = { hpt: 36 };
  dayRows.forEach((row, index) => {
    rows[dataStart + index] = { hpt: Math.max(18, Math.max(1, row.locations.length) * 14) };
  });
  ws["!rows"] = rows;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 15 } });

  XLSX.utils.book_append_sheet(wb, ws, "Diätendokumentation");
  return wb;
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

function payloadPeriodFileLabel(payload: AdminDiaetenExportPayload): string {
  return payload.range.from === `${payload.year}-${pad2(payload.month + 1)}-01`
    && payload.range.to === new Date(Date.UTC(payload.year, payload.month + 1, 0, 12)).toISOString().slice(0, 10)
    ? `${pad2(payload.month + 1)}_${payload.year}`
    : `${payload.range.from}_bis_${payload.range.to}`;
}

function workbookFileName(payload: AdminDiaetenExportPayload, gm: DiaetenGm): string {
  const fullName = fileSafeName(`${gm.firstName} ${gm.lastName}`);
  const period = payloadPeriodFileLabel(payload);
  return `${period}_Diäten_${fullName}.xlsx`;
}

export async function exportAdminDiaeten(payload: AdminDiaetenExportPayload): Promise<void> {
  if (payload.gls.length === 0) {
    throw new Error("Für diesen Zeitraum gibt es keine Diäten-Daten.");
  }
  const XLSX = await import("xlsx-js-style");
  const workbooks = payload.gls.map((gm) => ({
    gm,
    fileName: workbookFileName(payload, gm),
    workbook: buildAdminDiaetenWorkbook(payload, gm, XLSX),
  }));

  if (workbooks.length === 1) {
    const first = workbooks[0];
    if (!first) return;
    const array = XLSX.write(first.workbook, { bookType: "xlsx", type: "array", cellStyles: true }) as ArrayBuffer;
    downloadBlob(
      new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      first.fileName,
    );
    return;
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const item of workbooks) {
    const array = XLSX.write(item.workbook, { bookType: "xlsx", type: "array", cellStyles: true }) as ArrayBuffer;
    zip.file(item.fileName, array);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `Diäten_${payloadPeriodFileLabel(payload)}.zip`);
}

export { MONTH_LABELS };
