import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx-js-style";
import { buildSmManagementReportWorkbook } from "../src/lib/exports/smManagementReportExport";
import type { SmManagementReport } from "../src/types/smManagement";
import type { SmVisitAnswer } from "../src/types/smVisit";

type Entry = SmManagementReport["answers"][number];
const visit = (id: string): SmManagementReport["visits"][number] => ({ id, assignmentId: null, workDate: "2026-11-10", smUserId: "sm", smName: "Mitarbeiterin Test",
  marketId: "market", marketName: '=HYPERLINK("example")', address: "Testgasse 1", postalCode: "1010", city: "Wien", questionnaireId: "form",
  questionnaireName: "Gespeicherter Standardfragebogen", questionnaireVersion: 2, answeredCount: 8, startedAt: "2026-11-10T08:15:00Z", completedAt: "2026-11-10T09:15:00Z",
  submittedAt: "2026-11-10T09:16:00Z", SMDurcharbeitCatalogScope: "standard", travelMinutes: 25, actualMinutes: 60, originalStartedAt: "2026-11-10T08:00:00Z",
  originalCompletedAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:16:00Z", timeMode: "timer", revision: 1 });
const entry = (id: string, type: string, value: SmVisitAnswer | null, submissionId = "visit-1"): Entry => ({ module: "Gespeichertes Modul",
  question: { id, submissionId, questionVersionId: `version-${id}`, questionCodeSnapshot: id, questionTypeSnapshot: type, questionTextSnapshot: id,
    answerOptionsSnapshot: [{ code: "yes", label: "Ja" }, { code: "no", label: "Nein" }], configSnapshot: {}, isApplicable: true, applicabilityReason: null },
  answer: value ? { id: `answer-${id}`, answerVersion: 2, answerState: "answered", valueJson: value, answeredAt: "2026-11-10T08:30:00Z", answeredByUserId: "sm", answeredByName: "Mitarbeiterin Test", earnedPoints: "0", possiblePoints: "1" } : null, photos: [] });
const report = (): SmManagementReport => {
  const matrix = entry("Matrix", "matrix", { kind: "matrix", cells: [{ rowCode: "row_2", columnCode: "column_2", selected: true }] });
  matrix.question.configSnapshot = { rows: ["", "Regal"], columns: ["", "Vollständig"] };
  const photo = entry("Foto", "photo", { kind: "photo", fileIds: ["photo-1"] });
  photo.photos = [{ id: "photo-1", fileName: "Regal.jpg", mimeType: "image/jpeg", byteSize: 123, uploadedAt: "2026-11-10T08:30:00Z" }];
  const hidden = entry("Versteckte Frage", "text", { kind: "text", value: "Alt" }); hidden.question.isApplicable = false;
  return { generatedAt: "2026-11-12T12:00:00Z", filters: { from: "2026-11-01", to: "2026-11-30", SMDurcharbeitCatalogScope: "standard" }, visits: [visit("visit-1"), visit("visit-2")], answers: [
    entry("Ja/Nein", "yesno", { kind: "choice", optionCode: "no", comment: "Fehlt im Regal" }),
    entry("Anzahl", "numeric", { kind: "number", value: 0 }), entry("Freitext", "text", { kind: "text", value: "=1+1" }),
    entry("Mehrfach", "multiple", { kind: "multi", optionCodes: ["yes", "no"] }),
    entry("Zusatz", "yesno-multi", { kind: "yesnomulti", optionCode: "yes", subOptions: ["Fanta", "Sprite"] }),
    matrix, photo, hidden, entry("Unbeantwortet", "text", null),
    { ...entry("Ja/Nein", "yesno", { kind: "choice", optionCode: "yes" }, "visit-2"), question: { ...entry("Ja/Nein", "yesno", null, "visit-2").question, id: "visit2-question" } },
  ] };
};
const table = (sheet: XLSX.WorkSheet) => XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { range: 3, defval: "" });

test("complete SM workbook keeps individual visits, Vienna times, zeros, every answer type, comments and private photo references", () => {
  const wb = buildSmManagementReportWorkbook(XLSX, report(), "https://app.example.invalid");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const saved = XLSX.read(bytes, { type: "buffer", cellStyles: true });
  assert.deepEqual(saved.SheetNames, ["Besuche", "Antwortdetails", "Fotos", "Exportinfo"]);
  const rows = table(saved.Sheets.Besuche!); assert.equal(rows.length, 2);
  assert.equal(rows[0]!["Besuchsdatum"], "10.11.2026"); assert.match(String(rows[0]!.Besuchsbeginn), /09:15/);
  assert.equal(rows[0]!["Besuchsdauer (Minuten)"], 60); assert.equal(rows[0]!["Fahrtzeit (Minuten)"], 25);
  assert.equal(rows[0]!.Anzahl, 0); assert.equal(rows[0]!.Freitext, "=1+1");
  assert.equal(rows[0]!["Ja/Nein"], "Nein"); assert.equal(rows[0]!["Ja/Nein · Kommentar"], "Fehlt im Regal");
  assert.equal(rows[1]!["Ja/Nein"], "Ja"); assert.equal(rows[1]!.Anzahl, "");
  assert.equal(rows[0]!.Mehrfach, "Ja, Nein"); assert.equal(rows[0]!.Zusatz, "Ja · Fanta · Sprite");
  assert.equal(rows[0]!.Matrix, "Regal: Vollständig"); assert.equal(rows[0]!.Foto, "1 Foto");
  assert.equal(rows[0]!["Versteckte Frage"], "Nicht anwendbar"); assert.equal(rows[0]!.Unbeantwortet, "Nicht beantwortet");
  assert.equal(table(saved.Sheets.Antwortdetails!).length, 10);
  const photos = table(saved.Sheets.Fotos!); assert.equal(photos.length, 1); assert.equal(photos[0]!.Dateiname, "Regal.jpg");
  assert.equal(photos[0]!["Fragebogen öffnen"], "In der App öffnen");
  assert.equal(photos[0]!.Dateityp, "JPEG"); assert.equal(photos[0]!.Dateigröße, "0,1 KB");
  const photoLink = Object.entries(saved.Sheets.Fotos!).find(([key, cell]) => !key.startsWith("!") && cell.l)?.[1];
  assert.match(photoLink?.l?.Target ?? "", /\/admin\/sm\/fbmanagement\?submissionId=visit-1/);
  assert.equal(table(saved.Sheets.Antwortdetails!)[0]!["Beantwortet von"], "Mitarbeiterin Test");
  for (const sheet of Object.values(saved.Sheets)) for (const [key, cell] of Object.entries(sheet)) {
    if (key.startsWith("!") || typeof cell !== "object") continue;
    assert.equal(cell.f, undefined, `${key} must remain a literal, never a formula`);
    if (typeof cell.v === "string") assert.doesNotMatch(cell.v, /visit-[12]|version-|answer-|photo-1|https?:\/\//, "technical identifiers and URLs must not be visible spreadsheet values");
  }
});

test("conflicting compatible question revisions remain explicit; identical titles with different identities stay separate", () => {
  const data = report(), first = data.answers[0]!;
  const conflict = structuredClone(first); conflict.question.id = "duplicate-code-new-version"; conflict.question.questionVersionId = "version-2";
  conflict.answer!.valueJson = { kind: "choice", optionCode: "yes", comment: "Abweichend" }; data.answers.push(conflict);
  const unrelated = entry("another-code", "text", { kind: "text", value: "Eigenständige Frage" }); unrelated.question.questionTextSnapshot = "Ja/Nein"; data.answers.push(unrelated);
  const rows = table(buildSmManagementReportWorkbook(XLSX, data).Sheets.Besuche!);
  assert.match(String(rows[0]!["Ja/Nein"]), /Widersprüchlich.*Nein.*Ja/);
  assert.equal(rows[0]!["Ja/Nein (2)"], "Eigenständige Frage"); assert.match(String(rows[0]!.Prüfhinweise), /Widersprüchliche Antworten/);
});

test("invalid, duplicate, empty or oversized report data fails without a silently partial download", () => {
  const empty = report(); empty.visits = []; assert.throws(() => buildSmManagementReportWorkbook(XLSX, empty), /keine abgeschlossenen/);
  const duplicate = report(); duplicate.answers.push(duplicate.answers[0]!); assert.throws(() => buildSmManagementReportWorkbook(XLSX, duplicate), /nicht eindeutig/);
  const foreign = report(); foreign.answers[0]!.question.submissionId = "outside"; assert.throws(() => buildSmManagementReportWorkbook(XLSX, foreign), /nicht eindeutig/);
  const tooLong = report(); tooLong.answers[2]!.answer!.valueJson = { kind: "text", value: "x".repeat(32768) }; assert.throws(() => buildSmManagementReportWorkbook(XLSX, tooLong), /ohne Kürzung/);
});

test("Durcharbeit revisions also combine in the management export while standard SM retains its existing behavior", () => {
  const data = report(), old = structuredClone(data.answers[0]!);
  old.question.questionVersionNumber = 1;
  const next = structuredClone(old);
  next.question = { ...next.question, id: "next-question", submissionId: "visit-2", questionVersionId: "new-version", questionVersionNumber: 2,
    questionTextSnapshot: "Ja/Nein mit Grund", questionTypeSnapshot: "yesnomulti", configSnapshot: { photoRequired: true } };
  next.answer!.valueJson = { kind: "yesnomulti", optionCode: "no", subOptions: ["Bestellt"], comment: "Neuer Kommentar" };
  data.answers = [next, old];
  data.visits = data.visits.map(visit => ({ ...visit, SMDurcharbeitCatalogScope: "SMDurcharbeit" }));
  const before = JSON.stringify(data);
  const wb = buildSmManagementReportWorkbook(XLSX, data);
  const saved = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const rows = table(saved.Sheets.Besuche!);
  assert.equal(rows[0]!["Ja/Nein mit Grund"], "Nein");
  assert.equal(rows[1]!["Ja/Nein mit Grund"], "Nein · Bestellt");
  assert.ok(rows.every(row => !("Ja/Nein" in row) && !("Ja/Nein mit Grund (2)" in row)));
  const details = table(saved.Sheets.Antwortdetails!);
  assert.deepEqual(details.map(row => row.Frage), ["Ja/Nein mit Grund", "Ja/Nein"]);
  assert.equal(JSON.stringify(data), before);
  const standard = structuredClone(data);
  standard.visits = standard.visits.map(visit => ({ ...visit, SMDurcharbeitCatalogScope: "standard" }));
  standard.answers[0]!.question.questionTextSnapshot = "Ja/Nein";
  const standardRows = table(buildSmManagementReportWorkbook(XLSX, standard).Sheets.Besuche!);
  assert.ok("Ja/Nein" in standardRows[0]! && "Ja/Nein (2)" in standardRows[0]!, "Do not change unrelated standard SM column rules");
});

test("selected filters show names, while unmapped answer authors never inherit another employee's name", () => {
  const data = report(); data.filters = { ...data.filters, smUserId: "sm", marketId: "market", questionnaireId: "form", search: "Test" };
  data.answers[0]!.answer!.answeredByName = "Admin Muster";
  data.answers[1]!.answer!.answeredByName = null; data.answers[1]!.answer!.answeredByUserId = "unknown-admin-id";
  const wb = buildSmManagementReportWorkbook(XLSX, data);
  const details = table(wb.Sheets.Antwortdetails!);
  assert.equal(details[0]!["Beantwortet von"], "Admin Muster");
  assert.equal(details[1]!["Beantwortet von"], "Nicht dokumentiert");
  const info = XLSX.utils.sheet_to_json(wb.Sheets.Exportinfo!, { header: 1 }).flat();
  assert.ok(info.includes("Mitarbeiterin Test")); assert.ok(info.includes("Gespeicherter Standardfragebogen")); assert.ok(info.includes("Standard"));
  assert.ok(!info.includes("sm")); assert.ok(!info.includes("market")); assert.ok(!info.includes("form"));
  for (const name of wb.SheetNames) {
    const headers = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, { header: 1, range: 3 })[0] ?? [];
    for (const label of headers) assert.doesNotMatch(label, /(?:^|[- (])IDs?(?:$|[ )])|JSON|Frage-Code|Antwortversion/);
  }
});
