import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";

import type { AdminDiaetenExportPayload } from "../api/backend";
import {
  buildAdminDiaetenWorkbook,
  calculateDiaetenDayAmounts,
  getDiaetenExportDates,
} from "./diaetenExport";

test("creates every day of a selected calendar week", () => {
  assert.deepEqual(getDiaetenExportDates("2026-07-13", "2026-07-19"), [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ]);
});

test("supports the complete RED-month range", () => {
  const dates = getDiaetenExportDates("2026-07-06", "2026-07-31");
  assert.equal(dates.length, 26);
  assert.equal(dates[0], "2026-07-06");
  assert.equal(dates.at(-1), "2026-07-31");
});

test("rejects an inverted range", () => {
  assert.throws(
    () => getDiaetenExportDates("2026-07-31", "2026-07-06"),
    /ungültig/,
  );
});

test("calculates the Mars reference amounts for payroll-safe formula caches", () => {
  assert.deepEqual(
    calculateDiaetenDayAmounts({
      grossMinutes: 750,
      recordedPauseMinutes: 0,
      year: 2026,
      month: 6,
    }),
    {
      grossMinutes: 750,
      pauseMinutes: 30,
      netMinutes: 720,
      taggeld: 32.53,
      taxFree: 30,
      taxable: 2.53,
    },
  );

  assert.deepEqual(
    calculateDiaetenDayAmounts({
      grossMinutes: 360,
      recordedPauseMinutes: 0,
      year: 2026,
      month: 6,
    }),
    {
      grossMinutes: 360,
      pauseMinutes: 0,
      netMinutes: 360,
      taggeld: 10.01,
      taxFree: 10.01,
      taxable: 0,
    },
  );

  assert.deepEqual(
    calculateDiaetenDayAmounts({
      grossMinutes: 359,
      recordedPauseMinutes: 0,
      year: 2026,
      month: 6,
    }),
    {
      grossMinutes: 359,
      pauseMinutes: 0,
      netMinutes: 359,
      taggeld: 0,
      taxFree: 0,
      taxable: 0,
    },
  );
});

test("writes formula-driven payroll cells and includes Lager, visits and special duties", () => {
  const payload: AdminDiaetenExportPayload = {
    month: 6,
    year: 2026,
    timezone: "Europe/Vienna",
    range: {
      from: "2026-07-06",
      to: "2026-07-06",
      next: "2026-07-07",
    },
    gls: [
      {
        gmId: "gm-1",
        firstName: "Test",
        lastName: "Mitarbeiter",
        dayTrackings: [
          {
            id: "day-1",
            date: "2026-07-06",
            dayStartAt: "2026-07-06T04:00:00.000Z",
            dayEndAt: "2026-07-06T16:30:00.000Z",
            startKm: 1000,
            endKm: 1080,
          },
        ],
        marketVisits: [
          {
            id: "visit-1",
            createdAt: "2026-07-06T06:00:00.000Z",
            startAt: "2026-07-06T06:00:00.000Z",
            endAt: "2026-07-06T07:00:00.000Z",
            marketName: "Testmarkt",
            marketAddress: "Marktstraße 1",
            marketCity: "Wien",
            marketPostalCode: "1010",
          },
        ],
        zusatzEntries: [
          {
            id: "lager-1",
            entryDate: "2026-07-06",
            reason: "lager",
            reasonLabel: "Lager",
            startAt: "2026-07-06T04:00:00.000Z",
            endAt: "2026-07-06T05:00:00.000Z",
            isWorkTimeDeduction: false,
            marketName: null,
            location: "Lagerstraße 2, 1120 Wien",
            schulungOrt: null,
          },
          {
            id: "special-1",
            entryDate: "2026-07-06",
            reason: "sonderaufgabe",
            reasonLabel: "Sondereinsatz",
            startAt: "2026-07-06T15:00:00.000Z",
            endAt: "2026-07-06T16:00:00.000Z",
            isWorkTimeDeduction: false,
            marketName: null,
            location: "Sondereinsatz Ort",
            schulungOrt: null,
          },
        ],
        pauses: [],
      },
    ],
  };

  const workbook = buildAdminDiaetenWorkbook(payload, payload.gls[0]!, XLSX);
  const sheet = workbook.Sheets.Diätendokumentation!;

  assert.match(String(sheet.F14?.v), /Lagerstraße 2, 1120 Wien/);
  assert.match(String(sheet.F14?.v), /Testmarkt, Marktstraße 1, Wien, 1010/);
  assert.match(String(sheet.G14?.v), /Lager/);
  assert.match(String(sheet.G14?.v), /Marktbesuch/);
  assert.match(String(sheet.G14?.v), /Sondereinsatz/);

  assert.deepEqual(
    [sheet.I14?.t, sheet.I14?.v, sheet.J14?.t, sheet.J14?.v, sheet.K14?.t, sheet.K14?.v],
    ["n", 32.53, "n", 30, "n", 2.53],
  );
  assert.match(String(sheet.D14?.f), /0\.0208333333333333/);
  assert.match(String(sheet.D14?.f), />0\.25/);
  assert.match(String(sheet.I14?.f), /\*24\)>=6/);
  assert.match(String(sheet.I14?.f), /10\.01/);
  assert.match(String(sheet.I14?.f), /4\.13/);
  assert.match(String(sheet.I14?.f), /32\.53/);
  assert.match(String(sheet.I14?.f), /IF\(ISNUMBER\(\$D14\),\$D14,0\)/);
  assert.equal(sheet.J14?.f, 'IF($B14="",0,$I14-$K14)');
  assert.equal(sheet.K14?.f, 'IF($B14="",0,MAX(0,$I14-30.00))');
  assert.equal(sheet.D14?.v, 30 / 1440);
  assert.equal(sheet.E14?.v, 750 / 1440);
  assert.equal(sheet.P14?.v, 12);
  assert.match(String(sheet.P14?.f), /IF\(ISNUMBER\(\$D14\),\$D14,0\)/);
  assert.equal(sheet.I15?.f, "SUM(I14:I14)");
  assert.equal(sheet.J15?.f, "SUM(J14:J14)");
  assert.equal(sheet.K15?.f, "SUM(K14:K14)");

  const workbookCells = Object.values(sheet).filter(
    (cell): cell is XLSX.CellObject => Boolean(cell && typeof cell === "object" && "v" in cell),
  );
  assert.equal(workbookCells.some((cell) => Boolean(cell.f)), true);
  assert.equal(
    workbookCells.filter((cell) => Boolean(cell.f)).every((cell) => cell.t === "n"),
    true,
  );

  const serialized = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellStyles: true });
  const reopened = XLSX.read(serialized, { type: "buffer", cellStyles: true });
  const reopenedSheet = reopened.Sheets.Diätendokumentation!;
  assert.deepEqual(
    [reopenedSheet.I14?.t, reopenedSheet.I14?.v, reopenedSheet.J14?.t, reopenedSheet.J14?.v, reopenedSheet.K14?.t, reopenedSheet.K14?.v],
    ["n", 32.53, "n", 30, "n", 2.53],
  );
  assert.equal(reopenedSheet.I14?.f, sheet.I14?.f);
  assert.equal(reopenedSheet.J14?.f, sheet.J14?.f);
  assert.equal(reopenedSheet.K14?.f, sheet.K14?.f);
});
