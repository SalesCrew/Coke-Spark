import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import * as XLSX from "xlsx-js-style";
import { createQuestionnaireUpdateFixture } from "../backend/tests/SMDurcharbeit-questionnaire-update-fixture";
import { buildSMDurcharbeitPlanningWorkbook } from "../src/lib/exports/smSMDurcharbeitPlanningExport";
import { buildPreparedFbManagementExportRows } from "../src/lib/exports/planningExports";
import { SMDurcharbeitExportQuery } from "../src/types/smSMDurcharbeitExport";
import type { SMDurcharbeitPlanningReport, SMDurcharbeitExportSelection } from "../src/types/smSMDurcharbeitExport";
const { eq } = createRequire(new URL("../backend/package.json", import.meta.url))("drizzle-orm");

test("planning header export filters real Durcharbeit routes and round-trips the exact GM workbook contract", async t => {
  const historicalSm = randomUUID();
  const f = await createQuestionnaireUpdateFixture([{ id: historicalSm, token: "synthetic-historical-sm" }]);
  const defaults = { campaignIds: [], smUserIds: [], regions: [], chains: [], status: "all" } as SMDurcharbeitExportSelection;
  const read = async (mode: "options" | "preview" | "report", selection: Partial<SMDurcharbeitExportSelection> = {}, token = "synthetic-sm-admin", expected = 200) =>
    f.admin("get", `${f.root}/export/${mode}${mode === "options" ? "" : `?${SMDurcharbeitExportQuery({ ...defaults, ...selection })}`}`, token).expect(response => assert.equal(response.status, expected, JSON.stringify(response.body)));
  const history = () => Promise.all([f.schema.smQuestionnaireSubmissions, f.schema.smQuestionAnswers, f.schema.smQuestionAnswerFiles,
    f.schema.smSMDurcharbeitTargets, f.schema.smSMDurcharbeitTimeRevisions, f.schema.smSMDurcharbeitAnswerProvenance,
    f.schema.smSMDurcharbeitFileLinks, f.schema.smSMDurcharbeitEvents].map(table => f.database.select().from(table as never)));
  try {
    const preview = (await f.admin("get", `${f.root}/${f.campaign.id}/questionnaire-update?month=2026-10-01`).expect(200)).body;
    await f.admin("patch", `${f.root}/${f.campaign.id}/questionnaire-update`).send({ month: preview.month, expectedRevision: preview.campaignRevision, previewToken: preview.previewToken }).expect(200);
    f.setNow("2026-10-21T10:00:00Z");
    async function complete(targetId: string, followUp: boolean, begin: string, token = "synthetic-sm") {
      const started = await f.start(targetId, followUp, token);
      const path = `${f.visitRoot}/${started.visitId}`, payload = (await f.sm("get", path, token).expect(200)).body;
      for (const q of payload.sections.flatMap((section: { questions: unknown[] }) => section.questions)) {
        if (q.type === "photo") continue;
        await f.sm("put", `${path}/answers/${q.id}`, token).send({ expectedAnswerVersion: payload.answerVersions[q.id] ?? 0, clientMutationToken: randomUUID(),
          answer: q.type === "text" ? { kind: "text", value: '=HYPERLINK("synthetic")', comment: "Notiz zur Frage" }
            : { kind: "choice", optionCode: q.options[1].code, comment: "Neuer Kommentar" } }).expect(200);
      }
      const end = new Date(Date.parse(begin) + 20 * 60000).toISOString();
      await f.sm("post", `${path}/submit`, token).send({ visitStartedAt: begin, visitCompletedAt: end, clientMutationToken: randomUUID() }).expect(200);
      return started;
    }
    await complete(f.targets[0].id, true, "2026-10-20T22:15:00Z"); // 21 October in Vienna, not the UTC day.
    const otherTarget = (await f.list()).find((row: { campaignId: string; market: { id: string } }) => row.campaignId === f.otherCampaign.id && row.market.id !== f.targets[0].market.id && row.market.id !== f.targets[1].market.id);
    await f.admin("patch", `${f.root}/targets/${otherTarget.id}/owner`).send({ expectedRevision: otherTarget.revision, reason: "Synthetischer SM-Wechsel", SMDurcharbeitSmUserId: historicalSm }).expect(200);
    await complete(otherTarget.id, false, "2026-10-21T06:00:00Z", "synthetic-historical-sm");
    await f.database.update(f.schema.smSMDurcharbeitTargets).set({ marketSnapshot: { ...f.targets[0].market, chain: "Spar", region: "Ost" } }).where(eq(f.schema.smSMDurcharbeitTargets.id, f.targets[0].id));
    const initial = (await read("report")).body as SMDurcharbeitPlanningReport;
    const otherVisit = initial.visits.find(visit => visit.SMDurcharbeitContext!.campaignId === f.otherCampaign.id)!;
    await f.database.update(f.schema.users).set({ isActive: false }).where(eq(f.schema.users.id, historicalSm));
    await f.database.update(f.schema.smSMDurcharbeitTargets).set({ marketSnapshot: { ...otherTarget.market, chain: "Billa", region: "West" } }).where(eq(f.schema.smSMDurcharbeitTargets.id, otherTarget.id));

    await t.test("only the existing Durcharbeit planning permission authorizes all three read endpoints", async () => {
      for (const mode of ["options", "preview", "report"] as const) {
        await read(mode, {}, "synthetic-sm", 403); await read(mode, {}, "synthetic-normal-editor", 403);
        await read(mode, {}, "synthetic-reader");
      }
      await f.admin("get", `${f.root}/export/report?from=2026-02-30&to=2026-03-01`).expect(400);
      await f.admin("get", `${f.root}/export/report?from=2026-10-21`).expect(400);
      await f.admin("get", `${f.root}/export/report?campaignIds=broken`).expect(400);
      await f.admin("get", `${f.root}/export/report?limit=1`).expect(400);
    });
    await t.test("available facets include historical authors and only actual Durcharbeit results", async () => {
      const result = await read("options"), options = result.body;
      assert.equal(result.headers["cache-control"], "private, no-store");
      assert.equal(options.campaigns.length, 2); assert.equal(options.people.length, 2);
      assert.ok(options.people.some((person: { id: string; name: string }) => person.id === historicalSm && person.name === "Second SM"));
      assert.deepEqual(options.regions, ["Ost", "West"]); assert.deepEqual(options.chains, ["Billa", "Spar"]);
      assert.equal(options.range.visits, 3);
    });
    await t.test("campaign, historical SM, region, chain and inclusive Vienna dates combine without widening", async () => {
      assert.equal((await read("preview", { from: "2026-10-20", to: "2026-10-20" })).body.visits, 0);
      assert.equal((await read("preview", { campaignIds: [f.campaign.id], from: "2026-10-21", to: "2026-10-21" })).body.visits, 1);
      const selection = { campaignIds: [f.campaign.id, f.otherCampaign.id], smUserIds: [historicalSm], regions: ["West"], chains: ["Billa"] };
      assert.equal((await read("preview", selection)).body.visits, 1);
      const report = (await read("report", selection)).body as SMDurcharbeitPlanningReport;
      assert.deepEqual(report.visits.map(visit => visit.id), [otherVisit.id]);
      assert.ok(report.answers.every(answer => answer.question.submissionId === otherVisit.id));
      assert.equal((await read("preview", { ...selection, regions: ["Ost"] })).body.visits, 0);
      assert.equal((await read("preview", { campaignIds: [randomUUID()] })).body.visits, 0);
      await f.database.update(f.schema.smSMDurcharbeitCampaigns).set({ status: "archived" }).where(eq(f.schema.smSMDurcharbeitCampaigns.id, f.otherCampaign.id));
      assert.equal((await read("preview", { status: "inactive" })).body.visits, 1);
      assert.equal((await read("preview", { status: "active" })).body.visits, 2);
    });
    await t.test("actual serialized XLSX uses unchanged GM headers, widths and paired short comments", async () => {
      const before = await history(), report = (await read("report", { campaignIds: [f.campaign.id] })).body as SMDurcharbeitPlanningReport;
      const wb = XLSX.utils.book_new(); buildSMDurcharbeitPlanningWorkbook(XLSX, wb, report);
      const saved = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }), { type: "buffer", cellStyles: true });
      assert.deepEqual(saved.SheetNames, ["Einsätze"]);
      const sheet = saved.Sheets["Einsätze"]!, rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const gm = buildPreparedFbManagementExportRows([]);
      assert.deepEqual(wb.Sheets["Einsätze"]!["!cols"]!.slice(0, 22), gm.columns.map(column => ({ wch: column.width })));
      assert.deepEqual(rows[0]!.slice(0, 22), gm.columns.map(column => column.h1));
      assert.deepEqual(rows[1]!.slice(0, 22), gm.columns.map(column => column.h2));
      assert.equal(rows.length, 4, "Exactly two header rows and both physical visits");
      assert.equal(rows[0]![22], "Bestand geprüft"); assert.equal(rows[0]![23], "");
      assert.deepEqual(rows[1]!.slice(22, 24), ["Wert", "Kommentar"]);
      assert.equal(rows[2]![22], "Ja"); assert.equal(rows[3]![22], "Nein"); assert.equal(rows[3]![23], "Neuer Kommentar");
      assert.equal(rows[0]!.filter(value => value === "Bestand geprüft").length, 1);
      assert.ok(!rows[0]!.some(value => typeof value === "string" && value.endsWith(" (2)")));
      const noteColumn = rows[0]!.indexOf("Aktualisierte Notiz");
      assert.ok(noteColumn >= 0); assert.equal(rows[2]![noteColumn], "Original note"); assert.equal(rows[3]![noteColumn], '=HYPERLINK("synthetic")');
      assert.equal(sheet[XLSX.utils.encode_cell({ r: 3, c: noteColumn })]!.f, undefined);
      assert.equal(rows[2]![8], 1); assert.equal(rows[3]![8], 1, "Inherited photo ownership remains available");
      assert.equal(sheet.A1!.v, "Zielobjekt"); assert.equal(sheet.A3!.t, "s");
      assert.deepEqual(await history(), before, "Exports do not mutate answers, photos, time revisions, targets or history");
    });
  } finally { await f.pg.close(); }
});
