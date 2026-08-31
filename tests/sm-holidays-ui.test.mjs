import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
async function load(path, mocks = {}) {
  const url = new URL(path, import.meta.url), source = await readFile(url, "utf8"), module = { exports: {} }, require = createRequire(url);
  const result = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(result.outputText, { module, exports: module.exports, require: (name) => mocks[name] ?? require(name) });
  return module.exports;
}
const holidays = await load("../src/lib/sm/austrianHolidays.ts");
const controls = await load("../src/components/admin/AdminFilterControls.tsx");
const { SmHolidayCalendarCard } = await load("../src/components/admin/sm/SmHolidayCalendarCard.tsx", { "@/lib/sm/austrianHolidays": holidays, "@/components/admin/AdminFilterControls": controls });
const { SmHolidayNote } = await load("../src/components/sm/SmHolidayNote.tsx");
const { WeekStrip } = await load("../src/components/dashboard/WeekStrip.tsx");
const render = (Component, props = {}) => renderToStaticMarkup(createElement(Component, props));

test("frontend and backend share identical holiday rules", async () => {
  assert.equal((await read("../src/lib/sm/austrianHolidays.ts")).replaceAll("\r\n", "\n").trim(), (await read("../backend/src/sm-holidays.shared.ts")).replaceAll("\r\n", "\n").trim());
});
test("holiday card renders all 13 holidays, year dropdown, ten-year horizon and rule text", () => {
  const html = render(SmHolidayCalendarCard);
  assert.equal((html.match(/<time /g) ?? []).length, 13);
  for (const text of ["Feiertagsjahr", "Österreichische Feiertage", "Ostermontag", "Fronleichnam", "weniger", "Manuelle Datumsänderungen", "<summary"]) assert.ok(html.toLowerCase().includes(text.toLowerCase()), text);
});
test("shift note contains name, old/new dates, both workloads and the manual override", () => {
  const adjustment = holidays.chooseSmHolidayDate("2026-12-08", "2026-01-01", (d) => d === "2026-12-07" ? 120 : 360);
  const html = render(SmHolidayNote, { adjustment, currentDate: "2026-12-07" });
  for (const text of ["Mariä Empfängnis", "08.12.2026", "07.12.2026", "2 h", "6 h", "Nur dieser Einsatz"]) assert.ok(html.includes(text), text);
  assert.ok(render(SmHolidayNote, { adjustment: { ...adjustment, manualOverride: true }, currentDate: "2026-12-10" }).includes("manuell angepasst"));
});
test("phone holidays are opt-in: SM has amber markers and holiday name; GM/default does not", () => {
  const props = { selectedDate: "2026-12-08", visitsByDate: {}, onDateChange() {} };
  const sm = render(WeekStrip, { ...props, holidayLabel: (date) => holidays.austrianHoliday(date)?.name });
  const unchangedDefault = render(WeekStrip, props);
  assert.ok(sm.includes("Mariä Empfängnis")); assert.ok(sm.includes("title=\"Mariä Empfängnis\""));
  assert.ok(!unchangedDefault.includes("Mariä Empfängnis")); assert.ok(!unchangedDefault.includes("amber"));
});
test("admin keeps empty holiday days visible and shows single-occurrence notices", async () => {
  const source = await read("../src/components/admin/sm/SmVerplanungWorkspace.tsx");
  for (const text of ["groups.set(holiday.date, [])", "is-holiday", "holiday.name", "SmHolidayNote", "holidayAdjustedCount", "manuelle", "Feiertage werden je Einzeltermin"]) assert.ok(source.toLowerCase().includes(text.toLowerCase()), text);
});
