// Full UI regression against the explicitly isolated preview only.
// Never reads .env or accepts a production URL/account.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const cli = process.env.AGENT_BROWSER_CLI;
if (!cli) throw new Error("Set AGENT_BROWSER_CLI to the installed agent-browser entry point.");
const output = resolve(process.env.BONI_UI_EVIDENCE_DIR || "/tmp/boni-ui-evidence");
mkdirSync(output, { recursive: true });
const info = await (await fetch("http://127.0.0.1:4017/fixture-info")).json();
assert.deepEqual(info, { synthetic: true, database: "PGlite in memory", externalConnections: false, questions: 121 });
const checks = [];
const startedAt = new Date().toISOString();
const session = "boni-ui-regression";
function browser(...args) {
  return execFileSync(process.execPath, [cli, "--session", session, ...args], { encoding: "utf8", timeout: 40000 }).trim();
}
function read(expression) { return JSON.parse(JSON.parse(browser("eval", `JSON.stringify(${expression})`))); }
function click(name, role = "button") { browser("find", "role", role, "click", "--name", name); }
function fill(name, value) { browser("find", "role", "textbox", "fill", "--name", name, value); }
function choose(name, option) { click(name, "combobox"); click(option, "option"); }
function shot(name) { const full = !read("!!document.querySelector('[role=dialog]')"); browser("screenshot", `${output}/${name}.png`, ...(full ? ["--full"] : [])); }
function checked(name, condition) { assert.ok(condition, name); checks.push(name); writeFileSync(`${output}/checks.json`, JSON.stringify({ isolation: info, startedAt, complete: false, checks }, null, 2)); process.stdout.write(`PASS ${name}\n`); }
async function waitFor(expression) {
  for (let i = 0; i < 50; i++) { if (read(expression)) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error(`UI did not settle: ${expression}`);
}
async function api(path) {
  const response = await fetch(`http://127.0.0.1:4017/admin/praemien/workspace${path}`, { headers: { Authorization: "Bearer synthetic-boni-only" } });
  assert.equal(response.status, 200); return response.json();
}
async function currentWave(name) { const { waves } = await api("/waves"); return api(`/waves/${waves.find((w) => w.name === name).id}`); }

const init = process.env.AGENT_BROWSER_EXECUTABLE ? ["--executable-path", process.env.AGENT_BROWSER_EXECUTABLE] : [];
browser(...init, "open", "http://localhost:3017/dev/praemien-fixture");
browser("set", "viewport", "1440", "1000"); click("Boni-Vorschau öffnen");
await waitFor("!!document.querySelector('[aria-label=\"Prämienwelle wählen\"]')");
choose("Prämienwelle wählen", "Isolierter Test Q3 · Q3 2026");
checked("normal Boni page with four original pillars", read("document.querySelectorAll('article').length === 4"));
const pageA11y = JSON.parse(browser("a11y", "--selector", "main", "--json"));
writeFileSync(`${output}/a11y-page.json`, JSON.stringify(pageA11y, null, 2));
checked("page accessibility audit has zero violations", pageA11y.data.violations.length === 0);
shot("overview-desktop");
click("Schütten / Displays bearbeiten"); choose("Berechnung", "Besuchsantworten · Wert / Punkte");
fill("Fragen suchen", "Display"); click("Alle Treffer zuordnen");
checked("80 questions assigned in a bounded scroll list", read("document.querySelectorAll('[role=checkbox][aria-checked=true]').length === 80 && document.querySelector('[aria-label=\"Geeignete Fragen\"]').scrollHeight > 400 && document.querySelector('[aria-label=\"Geeignete Fragen\"]').clientHeight <= 400"));
browser("find", "role", "textbox", "click", "--name", "Fragen suchen"); shot("question-picker-desktop");
click("Display 001 · synthetische Testfrage", "checkbox"); browser("press", "Space");
checked("individual assignment toggles with keyboard", read("document.querySelectorAll('[role=checkbox][aria-checked=true]').length === 80"));
click("Einstellungen: Display 001 · synthetische Testfrage");
fill("Punkte pro Einheit", "3,5"); fill("Besuche pro Jahr · mindestens", "8"); fill("Handelsketten · leer = alle", "Billa, Sparmarkt");
click("Zählweise", "combobox"); browser("press", "Escape");
checked("Escape closes dropdown and keeps editor/focus", read("document.querySelectorAll('[role=dialog]').length === 1 && document.querySelectorAll('[role=listbox]').length === 0 && document.activeElement.getAttribute('aria-label') === 'Zählweise'"));
choose("Zählweise", "Einmal pro Markt / Quartal · höchster Wert");
browser("click", '[role=combobox][aria-label="Besuchsbereich"]'); click("Flexbesuch", "option");
const editorA11y = JSON.parse(browser("a11y", "--selector", "[role=dialog]", "--json"));
writeFileSync(`${output}/a11y-editor.json`, JSON.stringify(editorA11y, null, 2));
checked("question editor accessibility audit has zero violations", editorA11y.data.violations.length === 0);
shot("question-settings-desktop");
click("Einstellungen: Display 001 · synthetische Testfrage");
fill("Fragen suchen", "no-such-question");
checked("empty search keeps all assigned questions", read("document.querySelector('[class*=selectedCount]').textContent === '80 zugeordnet' && document.querySelectorAll('[role=checkbox]').length === 0"));
click("Filter zurücksetzen"); choose("Fragentyp filtern", "Ja / Nein");
checked("question eligibility/type filter", read("document.querySelectorAll('[role=checkbox]').length === 20"));
click("Distribution 081 · synthetische Testfrage", "checkbox");
click("Änderungen prüfen"); await waitFor("!!document.querySelector('[class*=preview]')");
let saved = await currentWave("Isolierter Test Q3");
checked("preview leaves rules and revision untouched", saved.revision === 2 && saved.model.pillars[0].metrics[0].sources.length === 0);
click("Speichern & neu berechnen"); await waitFor("!document.querySelector('[role=dialog]')");
saved = await currentWave("Isolierter Test Q3"); const sources = saved.model.pillars[0].metrics[0].sources;
const configured = sources.find((s) => s.label.startsWith("Display 001"));
checked("81 sources and detailed settings persist", sources.length === 81 && configured.weight === 3.5 && configured.minFrequency === 8 && configured.section === "flex" && configured.counting === "once" && configured.chains.join() === "Billa,Sparmarkt" && sources.at(-1).scoreKey === "Ja");
click("Schütten / Displays bearbeiten"); fill("Fragen suchen", "Display 001"); click("Einstellungen: Display 001 · synthetische Testfrage");
checked("saved question settings reopen", read("[...document.querySelectorAll('label')].find(x => x.textContent.includes('Punkte pro Einheit')).querySelector('input').value === '3,5'"));
click("Abbrechen");

// Availability is one product quote per metric; prevent invalid bulk assignment.
click("Distribution bearbeiten"); choose("Berechnung", "Verfügbarkeit · Marktquote");
fill("Fragen suchen", "Distribution"); click("Distribution 082 · synthetische Testfrage", "checkbox");
checked("availability limits assignment to one product", read("document.querySelectorAll('[role=checkbox][aria-checked=true]').length === 1 && document.querySelectorAll('[role=checkbox]:disabled').length > 0"));
checked("question already owned by another metric excluded", read("!document.querySelector('[role=checkbox][aria-label=\"Distribution 081 · synthetische Testfrage\"]')"));
click("Abbrechen");

click("Regeln kopieren"); fill("Name", "Boni UI Kopie"); browser("fill", "input[type=number]", "2027"); choose("Quartal", "Q1"); click("Entwurf erstellen");
await waitFor("!document.querySelector('[role=dialog]')");
const copied = await currentWave("Boni UI Kopie");
checked("copy preserves rules and excludes employee values", copied.model.pillars[0].metrics[0].sources.length === 81 && copied.entries.length === 0);

click("Neue Welle"); fill("Name", "Boni UI UND"); browser("fill", "input[type=number]", "2027"); choose("Quartal", "Q2"); choose("Regelvorlage", "Q3 · Kühler & permanente Racks (Stufen offen)");
shot("new-wave-dialog"); click("Entwurf erstellen"); await waitFor("!document.querySelector('[role=dialog]')");
click("Flexziel bearbeiten"); click("Stufe hinzufügen"); fill("Stufenname", "Beide Teilziele mindestens 50 %"); browser("fill", '[role=dialog] [class*=tier] [class*=twoColumns] label:nth-child(2) input', "82,5"); click("Weiteres Teilziel (UND)");
checked("AND adds independently selected second target", read("document.querySelector('[class*=conditionSummary]').textContent.includes('Kühler mindestens 50 % UND Permanente Racks mindestens 50 %')"));
browser("click", '[role=dialog] [class*=tier] [class*=condition]:nth-of-type(4) [aria-label="Teilziel / Bedingung"]');
checked("used goal cannot be selected again as a different AND target", read("document.querySelector('[role=listbox]').textContent.includes('Permanente Racks') && !document.querySelector('[role=listbox]').textContent.includes('Kühler')"));
browser("press", "Escape");
browser("click", '[role=dialog] [class*=tier] [class*=condition]:nth-of-type(4) [aria-label="Mindestziel"]'); browser("press", "Home"); browser("press", "Enter");
checked("minimum target is selectable with keyboard", read("document.querySelector('[class*=conditionSummary]').textContent.includes('Kühler mindestens 50 % UND Permanente Racks mindestens 50 %')"));
shot("and-editor-desktop");
click("Speichern & neu berechnen"); await waitFor("!document.querySelector('[role=dialog]')");
const und = await currentWave("Boni UI UND");
checked("AND rule persists with separate keys and thresholds", und.model.pillars[2].tiers[0].rewardEur === 82.5 && und.model.pillars[2].maxRewardEur === 165 && und.model.pillars[2].tiers[0].conditions.map((c) => `${c.metricKey}:${c.value}`).join() === "coolers:50,racks:50");
click("Mitarbeiterwerte"); fill("GM suchen", "Nord"); click("Werte bearbeiten");
fill("Kühler", "100"); fill("Permanente Racks", "49,99"); click("Werte prüfen"); await waitFor("!!document.querySelector('[class*=preview]')");
checked("one target below 50 blocks UI payout", read("document.querySelector('[class*=preview]').textContent.includes('Flexziel: € 0,00')"));
fill("Permanente Racks", "50"); click("Werte prüfen"); await waitFor("!!document.querySelector('[class*=preview]')");
checked("both targets at 50 permit UI payout", read("document.querySelector('[class*=preview]').textContent.includes('Flexziel: € 82,50')"));
browser("scrollintoview", '[role=dialog] [class*=preview]'); shot("employee-preview"); click("Werte speichern & neu berechnen"); await waitFor("!document.querySelector('[role=dialog]')");
click("Werte bearbeiten"); fill("Permanente Racks", "abc"); click("Werte prüfen");
checked("invalid numbers block preview with visible feedback", read("[...document.querySelectorAll('[role=alert]')].some(x=>x.textContent.includes('gültige Zahlen'))"));
fill("Permanente Racks", "50"); browser("press", "Escape");
click("Regeln & Quellen"); shot("rules-desktop"); checked("rules summary shows the combined payout requirement", read("document.querySelector('main').textContent.includes('UND')"));
click("Verlauf"); shot("history-desktop"); checked("history records rule and employee edits", read("document.querySelector('main').textContent.includes('Werte bearbeitet') && document.querySelector('main').textContent.includes('Regeln gespeichert')"));

const exportRef = browser("snapshot", "-i").match(/button "Excel Export" \[ref=(e\d+)\]/)?.[1];
assert.ok(exportRef, "export control exists");
browser("download", `@${exportRef}`, `${output}/boni-synthetic-export.xlsx`);
const XLSX = createRequire(import.meta.url)("xlsx");
const exported = XLSX.readFile(`${output}/boni-synthetic-export.xlsx`);
checked("Excel export includes actual synthetic employee and metric rows", exported.SheetNames.includes("Prämien") && exported.SheetNames.includes("Messwerte") && JSON.stringify(XLSX.utils.sheet_to_json(exported.Sheets["Prämien"], { header: 1 })).includes("GM Test Nord"));

// Complete quarter lifecycle on fully rated synthetic seed wave.
choose("Prämienwelle wählen", "Isolierter Test Q3 · Q3 2026"); click("Welle aktivieren"); click("Aktivierung bestätigen"); await waitFor("!document.querySelector('[role=dialog]')");
checked("wave activation works", (await currentWave("Isolierter Test Q3")).wave.status === "active");
click("Übersicht"); click("Schütten / Displays bearbeiten");
checked("active rules require preview before save", read("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Speichern & neu berechnen')).disabled"));
click("Abbrechen"); click("Quartal abschließen"); click("Abschluss bestätigen"); await waitFor("!document.querySelector('[role=dialog]')");
checked("archived wave freezes model and results", (await currentWave("Isolierter Test Q3")).wave.status === "archived" && read("document.querySelector('[aria-label=\"Schütten / Displays bearbeiten\"]').disabled"));
shot("archived-desktop"); click("Gesamt"); checked("cumulative leaderboard includes archived results", read("document.querySelector('main').textContent.includes('€ 907,50')"));

choose("Prämienwelle wählen", "Boni UI Kopie · Q1 2027");
for (const [width, height, name] of [[1024, 900, "tablet"], [390, 844, "mobile"]]) {
  browser("set", "viewport", String(width), String(height));
  checked(`${name} page has no horizontal overflow`, read("document.documentElement.scrollWidth <= innerWidth")); shot(`overview-${name}`);
  click("Schütten / Displays bearbeiten"); fill("Fragen suchen", "Display");
  checked(`${name} question list retains 80 selections`, read("document.querySelectorAll('[role=checkbox][aria-checked=true]').length === 80"));
  click("Einstellungen: Display 001 · synthetische Testfrage"); click("Zählweise", "combobox");
  checked(`${name} dropdown contained in viewport`, read("(() => { const r=document.querySelector('[role=listbox]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })()"));
  shot(`questions-${name}`); browser("press", "Escape");
  browser("eval", "document.querySelector('[role=dialog] footer button:last-child').focus()"); browser("press", "Tab");
  checked(`${name} modal traps keyboard focus`, read("document.activeElement === document.querySelector('[role=dialog] header button')"));
  browser("press", "Shift+Tab");
  checked(`${name} reverse focus wraps to footer`, read("document.activeElement === document.querySelector('[role=dialog] footer button:last-child')"));
  click("Abbrechen"); await waitFor("!document.querySelector('[role=dialog]')");
}
browser("set", "viewport", "1440", "1000");

// Edge cases remain unsaved, and operate only on the copied synthetic wave.
click("Schütten / Displays bearbeiten"); fill("Fragen suchen", ""); click("Nächste 19 zuordnen");
checked("bulk assignment respects the 100-source limit", read("document.querySelector('[class*=pickerFooter]').textContent.includes('100 Zuordnungen') && [...document.querySelectorAll('[role=checkbox][aria-checked=false]')].every(x => x.disabled)"));
click("Display 002 · synthetische Testfrage", "checkbox"); click("Einstellungen: Display 001 · synthetische Testfrage");
click("Weiteren Besuchsbereich / Antwort zuordnen");
checked("expanded question supports a second assignment without exceeding the limit", read("document.querySelectorAll('[class*=sourceSettings]').length === 2 && document.querySelector('[class*=pickerFooter]').textContent.includes('100 Zuordnungen')"));
browser("click", '[class*=sourceSettings]:first-child label:nth-child(5) input'); browser("press", "ControlOrMeta+A"); browser("press", "Backspace"); click("Änderungen prüfen");
checked("blank required numbers block model preview with feedback", read("!!document.querySelector('input[aria-invalid=true]') && [...document.querySelectorAll('[role=alert]')].some(x => x.textContent.includes('markierte Zahl'))"));
checked("model validation feedback stays visible above the scrolling form", read("(() => { const r=document.querySelector('[role=dialog] [role=alert]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()"));
shot("invalid-number-feedback"); click("Abbrechen");
const copyAfterCancel = await currentWave("Boni UI Kopie");
checked("cancelled source edits leave saved model and revision untouched", copyAfterCancel.revision === copied.revision && copyAfterCancel.model.pillars[0].metrics[0].sources.length === 81);

// Seed additional synthetic waves through the real router to exercise searchable dropdowns.
for (let i = 1; i <= 6; i++) {
  const response = await fetch("http://127.0.0.1:4017/admin/praemien/workspace/waves", {
    method: "POST", headers: { Authorization: "Bearer synthetic-boni-only", "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Synthetische Auswahl ${i}`, year: 2024 + Math.floor((i - 1) / 4), quarter: (i - 1) % 4 + 1, template: "empty" }),
  });
  assert.equal(response.status, 201);
}
click("Neu laden"); await waitFor("![...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Neu laden').disabled");
click("Prämienwelle wählen", "combobox"); fill("Prämienwelle wählen suchen", "keine-dieser-wellen");
checked("long wave dropdown has searchable empty feedback", read("document.querySelector('[role=listbox]').textContent.includes('Keine Treffer')"));
fill("Prämienwelle wählen suchen", "Auswahl 6"); browser("press", "ArrowDown"); browser("press", "Enter");
await waitFor("document.querySelector('[class*=wavebar]').textContent.includes('Synthetische Auswahl 6')");
checked("long dropdown search and keyboard selection work", read("document.querySelector('[aria-label=\"Prämienwelle wählen\"]').textContent.includes('Synthetische Auswahl 6')"));
shot("empty-configuration-desktop"); click("Neues Ziel bearbeiten"); choose("Berechnung", "Besuchsantworten · Wert / Punkte"); click("Zugeordnet (0)");
checked("unassigned question list explains its empty state", read("document.querySelector('[aria-label=\"Geeignete Fragen\"]').textContent.includes('Noch keine Zuordnung')"));
click("Abbrechen"); click("Prämienwelle wählen", "combobox"); browser("press", "Tab");
checked("Tab closes dropdown and advances to the next control", read("!document.querySelector('[role=listbox]') && document.activeElement.getAttribute('aria-label') === 'Neu laden'"));
choose("Prämienwelle wählen", "Boni UI Kopie · Q1 2027");
async function delayRead(path) {
  const response = await fetch("http://127.0.0.1:4017/fixture-ui-delay", { method: "POST", headers: { Authorization: "Bearer synthetic-boni-only", "Content-Type": "application/json" }, body: JSON.stringify({ path, milliseconds: 1500 }) });
  assert.equal(response.status, 200);
}
await delayRead("/sources"); click("Schütten / Displays bearbeiten");
checked("question loading state is visible without dropping assignments", read("[...document.querySelectorAll('[role=status]')].some(x => x.textContent.includes('Fragen werden geladen')) && document.querySelector('[class*=selectedCount]').textContent === '81 zugeordnet'"));
shot("question-loading"); await waitFor("!document.querySelector('[role=dialog] [role=status]')"); click("Abbrechen");
browser("network", "route", "**/admin/praemien/workspace/sources", "--abort"); click("Schütten / Displays bearbeiten");
await waitFor("!!document.querySelector('[role=dialog] [role=alert]')");
checked("catalog failure preserves assigned sources and explains the error", read("document.querySelector('[class*=selectedCount]').textContent === '81 zugeordnet' && !!document.querySelector('[role=dialog] [role=alert]').textContent"));
checked("catalog error and retry control remain in view", read("(() => { const r=document.querySelector('[role=dialog] [role=alert]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()"));
shot("question-load-error"); browser("network", "unroute"); click("Fragen neu laden");
await waitFor("!document.querySelector('[role=dialog] [role=alert]') && !!document.querySelector('[role=checkbox][aria-label=\"Display 001 · synthetische Testfrage\"]')");
checked("catalog retry recovers without closing the editor or dropping assignments", read("document.querySelector('[class*=selectedCount]').textContent === '81 zugeordnet'")); click("Abbrechen");
browser("network", "route", "**/admin/praemien/workspace/waves", "--abort"); browser("click", '[aria-label="Neu laden"]');
await waitFor("!!document.querySelector('main [role=alert]')"); checked("wave read failure has visible retry feedback", read("document.querySelector('main [role=alert]').textContent.includes('Neu laden')")); shot("wave-load-error");
browser("network", "unroute"); await delayRead("/waves"); browser("click", '[aria-label="Neu laden"]');
checked("wave loading status is visible during retry", read("!!document.querySelector('main [role=status]')"));
shot("wave-loading"); await waitFor("!document.querySelector('main [role=status]') && !document.querySelector('main [role=alert]') && !!document.querySelector('[class*=wavebar]')");
checked("wave reload recovers without changing saved data", (await currentWave("Boni UI Kopie")).revision === copied.revision);
checked("UI rendered without error alerts", read("document.querySelectorAll('[role=alert]').length === 0"));
const errors = JSON.parse(browser("errors", "--json"));
writeFileSync(`${output}/runtime-errors.json`, JSON.stringify(errors, null, 2));
checked("no browser runtime errors", errors.success && errors.data.errors.length === 0);
writeFileSync(`${output}/checks.json`, JSON.stringify({ isolation: info, startedAt, complete: true, checks }, null, 2));
process.stdout.write(`Evidence: ${output}\n`);
browser("close");
