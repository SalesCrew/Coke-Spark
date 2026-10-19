import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequire } from "node:module";
import * as XLSX from "xlsx-js-style";
import { createQuestionnaireUpdateFixture } from "../backend/tests/SMDurcharbeit-questionnaire-update-fixture";
import { buildSMDurcharbeitReportWorkbook } from "../src/lib/exports/smSMDurcharbeitReportExport";
import type { SMDurcharbeitReport } from "../src/types/smSMDurcharbeitCampaign";

const { eq } = createRequire(new URL("../backend/package.json", import.meta.url))("drizzle-orm");

test("SM submission → revised questionnaire → follow-up → scoped report → GM-style XLSX preserves every original visit", async t => {
  const f = await createQuestionnaireUpdateFixture();
  const root = `${f.root}/${f.campaign.id}`;
  const history = () => Promise.all([f.schema.smQuestionnaireSubmissions, f.schema.smQuestionnaireSubmissionQuestions,
    f.schema.smQuestionAnswers, f.schema.smQuestionAnswerOptions, f.schema.smQuestionAnswerFiles, f.schema.smQuestionAnswerEvents,
    f.schema.smSMDurcharbeitTargets, f.schema.smSMDurcharbeitVisits, f.schema.smSMDurcharbeitTimeRevisions,
    f.schema.smSMDurcharbeitAnswerProvenance, f.schema.smSMDurcharbeitFileLinks].map(table => f.database.select().from(table as never)));
  const read = async (suffix = "", token = "synthetic-sm-admin") => (await f.admin("get", `${root}/results?month=2026-10-01&includeVisitAnswers=true${suffix}`, token).expect(200)).body as SMDurcharbeitReport;
  function workbook(report: SMDurcharbeitReport) {
    const wb = XLSX.utils.book_new(); buildSMDurcharbeitReportWorkbook(XLSX, wb, report, "Synthetic campaign");
    return XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellFormula: true });
  }
  function visits(wb: XLSX.WorkBook) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Einsätze"]!, { header: 1, range: 3 });
    return rows.slice(1).map(row => Object.fromEntries(rows[0]!.map((name, index) => [String(name), row[index]])));
  }
  try {
    const preview = (await f.admin("get", `${root}/questionnaire-update?month=2026-10-01`).expect(200)).body;
    await f.admin("patch", `${root}/questionnaire-update`).send({ month: preview.month, expectedRevision: preview.campaignRevision, previewToken: preview.previewToken }).expect(200);
    const followUp = await f.start(f.targets[0].id, true);
    const visitPath = `${f.visitRoot}/${followUp.visitId}`;
    const payload = (await f.sm("get", visitPath).expect(200)).body;
    for (const question of payload.sections[0].questions) {
      if (question.type === "photo") continue; // The unchanged photo is inherited, never reuploaded.
      await f.sm("put", `${visitPath}/answers/${question.id}`).send({ expectedAnswerVersion: payload.answerVersions[question.id] ?? 0,
        clientMutationToken: randomUUID(), answer: question.type === "text" ? { kind: "text", value: "New visit note" }
          : { kind: "choice", optionCode: question.options[1].code } }).expect(200);
    }
    await f.sm("post", `${visitPath}/submit`).send({ visitStartedAt: "2026-10-19T09:00:00Z", visitCompletedAt: "2026-10-19T09:15:00Z", clientMutationToken: randomUUID() }).expect(200);
    await f.database.update(f.schema.users).set({ firstName: "Renamed" }).where(eq(f.schema.users.id, f.employee));
    await f.database.update(f.schema.smMarkets).set({ name: "Renamed market", address: "New registry address" }).where(eq(f.schema.smMarkets.id, f.targets[0].market.id));

    await t.test("fresh read-only export contains both visits and readable historical snapshots; monthly totals stay latest-only", async () => {
      const before = await history();
      const normal = (await f.admin("get", `${root}/results?month=2026-10-01`).expect(200)).body;
      assert.equal(normal.visitAnswers, undefined, "Normal UI requests do not load the full answer history");
      const report = await read(), rows = visits(workbook(report));
      assert.deepEqual(report.summary, normal.summary);
      assert.equal(report.summary.physicalVisits, 2); assert.equal(report.summary.latestSubmissions, 1);
      assert.equal(report.summary.actualMinutes, 35); assert.equal(report.summary.availablePhotoUploads, 1);
      assert.equal(report.answers.length, 4); assert.equal(report.visitAnswers?.length, 11);
      assert.equal(rows.length, 2); assert.equal(rows[0]!["Bestand geprüft"], "Ja"); assert.equal(rows[1]!["Bestand geprüft"], "Nein");
      assert.equal(rows[0]!.Notiz, "Original note"); assert.equal(rows[1]!["Aktualisierte Notiz"], "New visit note");
      assert.equal(rows[0]!["Entfernte Frage 1"], "Ja"); assert.equal(rows[1]!["Entfernte Frage 1"], "");
      assert.equal(rows[0]!["Neue Kontrollfrage"], ""); assert.equal(rows[1]!["Neue Kontrollfrage"], "Nein");
      assert.equal(rows[0]!.Regalfoto, "1 Foto"); assert.equal(rows[1]!.Regalfoto, "1 Foto");
      assert.equal(rows[0]!["Fragebogen-Version"], 1); assert.equal(rows[1]!["Fragebogen-Version"], 2);
      assert.equal(rows[0]!["Shelf Merchandiser"], "Local SM"); assert.notEqual(rows[0]!.Markt, "Renamed market");
      assert.equal(rows[1]!.Monatsstand, "Aktuell"); assert.equal(rows[0]!["Istzeit (Min)"], 20); assert.equal(rows[1]!["Istzeit (Min)"], 15);
      assert.equal(f.objects.size, 1);
      await read("", "synthetic-reader");
      for (const token of ["synthetic-sm", "synthetic-normal-editor"]) await f.admin("get", `${root}/results?includeVisitAnswers=true`, token).expect(403);
      const empty = await read(`&smUserId=${randomUUID()}`); assert.deepEqual(empty.visitAnswers, []); assert.equal(visits(workbook(empty)).length, 0);
      const november = (await f.admin("get", `${root}/results?month=2026-11-01&includeVisitAnswers=true`).expect(200)).body;
      assert.deepEqual(november.visitAnswers, []); assert.equal(november.physicalVisits.length, 0);
      const other = (await f.admin("get", `${f.root}/${f.otherCampaign.id}/results?month=2026-10-01&includeVisitAnswers=true`).expect(200)).body;
      assert.deepEqual(other.visitAnswers, []);
      await f.admin("get", `${root}/results?includeVisitAnswers=invalid`).expect(400);
      assert.deepEqual(await history(), before, "GET and XLSX generation never change answer, photo, provenance or time history");
    });
    await t.test("withdrawn originals disappear from photo counts in both original and inherited answers", async () => {
      await f.database.update(f.schema.smQuestionAnswerFiles).set({ isDeleted: true, deletedAt: new Date() }).where(eq(f.schema.smQuestionAnswerFiles.id, f.photoId));
      const before = await history(), report = await read(), rows = visits(workbook(report));
      assert.equal(report.summary.availablePhotoUploads, 0);
      assert.ok(report.visitAnswers?.filter(row => row.question.questionTypeSnapshot === "photo").every(row => row.answer?.valueJson?.kind === "photo" && row.answer.valueJson.fileIds.length === 0));
      assert.ok(rows.every(row => row.Regalfoto === "Keine verfügbaren Fotos"));
      assert.deepEqual(await history(), before);
    });
    await t.test("invalidated visits keep their recorded time row without exposing the withdrawn answers", async () => {
      await f.database.update(f.schema.smQuestionnaireSubmissions).set({ status: "invalidated", invalidatedAt: new Date(), invalidationReason: "Synthetic withdrawal" })
        .where(eq(f.schema.smQuestionnaireSubmissions.id, f.completed.submissionId));
      const before = await history(), report = await read(), rows = visits(workbook(report));
      assert.equal(report.summary.physicalVisits, 2); assert.equal(report.summary.actualMinutes, 35);
      assert.equal(report.summary.validQuestionnaireVisits, 1); assert.equal(report.visitAnswers?.length, 4);
      assert.equal(rows[0]!["Antwortstatus"], "Ungültig / zurückgezogen"); assert.equal(rows[0]!["Bestand geprüft"], "");
      assert.equal(rows[0]!["Istzeit (Min)"], 20); assert.equal(rows[1]!["Bestand geprüft"], "Nein");
      assert.deepEqual(await history(), before);
    });
  } finally { await f.pg.close(); }
});
