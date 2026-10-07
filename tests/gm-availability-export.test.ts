import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import * as XLSX from "xlsx-js-style";
import { praemienFixture } from "../backend/src/lib/praemien-test-fixture";
import { installDashboardFixture } from "../backend/src/lib/gm-dashboard-test-fixture";
import { createGmDashboardRouter } from "../backend/src/routes/gm-dashboard";
import { isolatedModule } from "../backend/tests/isolated-module";
import { auditAvailability, summarizeAvailability, type AvailabilityAudit, type AvailabilityObservation } from "../src/lib/availability.shared";
import { buildFbManagementCampaignSheets, prepareFbManagementExportVisitRow } from "../src/lib/exports/planningExports";
import { appendAvailabilityExportSheets, availabilityExportRows } from "../src/lib/exports/availabilityExport";
import * as workbook from "../src/lib/exports/workbook";
import { availabilitySummary } from "../src/lib/gm-dashboard/data";
import { availabilityDistribution, availabilitySeries } from "../src/lib/gm-dashboard/chart-adapters";
import type { CampaignMarketVisitSummary } from "../src/lib/api/backend";
import type { Campaign } from "../src/types/campaign";
import type { DashboardData, DashboardExport } from "../src/types/gm-dashboard";

const backendRequire = createRequire(new URL("../backend/package.json", import.meta.url));
const express = backendRequire("express"), request = backendRequire("supertest");

const scope = { gmId: null, region: null, chain: null, marketId: null, stc: null };
const intervals = [{ id: "kw38", label: "KW38", shortLabel: "KW38", start: "2026-09-14", end: "2026-09-20" }];
const observation: AvailabilityObservation = {
  intervalId: "", sessionId: "synthetic-visit", visitQuestionId: "first", questionId: "synthetic-question",
  sectionId: "section", campaignId: null, questionText: "Synthetic Cooler", moduleName: "Synthetic",
  marketId: "synthetic-market", chain: "Billa", region: "Nord", gmId: null, startedAt: null,
  submittedAt: "2021-01-04T08:00:00+01:00", changedAt: "2021-01-04T07:30:00+01:00", version: 1,
  availabilityType: "Cooler", appliesToChain: true, visible: true,
  answer: { id: "synthetic-answer", isValid: true, answerStatus: "answered", valueText: "Top" },
};
test("empty duplicate snapshots cannot erase an answer; latest unknown metadata is excluded without guessing", () => {
  const empty = { ...observation, visitQuestionId: "empty", changedAt: null, answer: null };
  const rows = auditAvailability([observation, empty]);
  assert.equal(rows[0]!.included, true); assert.equal(rows[1]!.exclusion, "duplicate_visit_question");
  assert.equal(rows[0]!.dateBasis, "submission_fallback");
  const unknown = { ...observation, visitQuestionId: "unknown", changedAt: "2021-01-04T09:00:00+01:00", availabilityType: null };
  const revised = auditAvailability([observation, unknown]);
  assert.equal(revised[0]!.exclusion, "duplicate_visit_question");
  assert.equal(revised[1]!.exclusion, "unknown_availability_type");
  assert.equal(summarizeAvailability(revised, "").availability.Cooler.total, 0);
});
test("weekly export uses ISO weeks at year boundaries and leaves uncounted percentages blank", () => {
  for (const [date, label] of [["2020-12-31", "KW 53 · 2020"], ["2021-01-04", "KW 1 · 2021"], ["2027-01-04", "KW 1 · 2027"]]) {
    const audit = auditAvailability([{ ...observation, submittedAt: date + "T08:00:00+01:00", answer: null }]);
    assert.equal(availabilityExportRows(audit).weeks[0]!.label, label);
    const wb = XLSX.utils.book_new();
    appendAvailabilityExportSheets(XLSX, wb, audit, { source: "Synthetic", scope: "All" });
    assert.equal(wb.Sheets["Verfügbarkeit Wochen"]!["J5"]!.v, 0);
    assert.equal(wb.Sheets["Verfügbarkeit Wochen"]!["K5"]!.v, "");
    assert.equal(wb.Sheets["Verfügbarkeit Wochen"]!["K5"]!.f, 'IF(J5=0,"",G5/J5)');
  }
});
test("individual Excel chain formulas match literal case-sensitive labels rather than wildcard criteria", () => {
  const audit = auditAvailability([
    observation, { ...observation, sessionId: "second", chain: "billa", answer: { ...observation.answer!, valueText: "Bad" } },
    { ...observation, sessionId: "third", chain: "Synthetic *?~" },
  ]);
  const wb = XLSX.utils.book_new();
  appendAvailabilityExportSheets(XLSX, wb, audit, { source: "Synthetic", scope: "All" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Verfügbarkeit Wochen"]!, { header: 1 });
  for (const [chain, expected] of [["Billa", [1, 0, 0]], ["billa", [0, 0, 1]], ["Synthetic *?~", [1, 0, 0]]] as const) {
    const index = rows.findIndex(row => row[3] === "Kette" && row[4] === chain);
    assert.deepEqual(rows[index]!.slice(6, 9), [...expected]);
    assert.match(wb.Sheets["Verfügbarkeit Wochen"]!["G" + (index + 1)]!.f!, /SUMPRODUCT.*EXACT/);
  }
});
test("overlapping dashboard intervals do not duplicate stored answers in the weekly export", () => {
  const audit = auditAvailability([{ ...observation, intervalId: "week" }, { ...observation, intervalId: "month" }]);
  assert.equal(audit.filter(o => o.included).length, 2);
  const exported = availabilityExportRows(audit);
  assert.equal(exported.answers.length, 1);
  assert.equal(exported.weeks.find(w => w.scopeKind === "Alle")!.counts.total, 1);
});
function prepareFromAudit(audit: AvailabilityAudit[]) {
  const visits = new Map<string, AvailabilityAudit[]>();
  for (const o of audit) {
    const key = JSON.stringify([o.campaignId, o.sessionId]);
    const rows = visits.get(key) ?? []; rows.push(o); visits.set(key, rows);
  }
  return [...visits.values()].map(rows => {
    const first = rows[0]!;
    const sectionIds = [...new Set(rows.map(o => o.sectionId))];
    const visit: CampaignMarketVisitSummary = {
      marketId: first.marketId, hasSubmittedVisit: true, sessionId: first.sessionId,
      kuehlerUnitId: null, kuehlerInternalId: null, kuehlerTechnicalIdentNo: null,
      gmUserId: first.gmId, gmName: "Synthetic GM", startedAt: first.startedAt, submittedAt: first.submittedAt, durationMinutes: 30,
      sections: sectionIds.map(id => ({
        id, section: "standard", campaignId: first.campaignId!, fragebogenId: null,
        fragebogenName: "Historical snapshot", orderIndex: 0,
        questions: rows.filter(o => o.sectionId === id).map(o => ({
          id: o.visitQuestionId, questionId: o.questionId, moduleId: "synthetic", moduleName: o.moduleName,
          type: "single", text: o.questionText, required: false, singleChoiceAvailability: true,
          singleChoiceAvailabilityType: o.availabilityType, appliesToMarketChain: o.appliesToChain,
          config: {}, rules: [], chains: [], comment: "",
          visibility: { isVisibleAtSubmit: o.visible && o.appliesToChain, isHiddenByChain: !o.appliesToChain, isHiddenByRule: !o.visible },
          answer: o.answer ? { ...o.answer, id: o.answer.id!, valueText: o.answer.valueText ?? null,
            valueJson: o.answer.valueJson ?? null, valueNumber: null, validationError: null, version: o.version, changedAt: o.changedAt,
            answerStatus: o.answer.answerStatus as "answered", options: (o.answer.options ?? []).map(p => ({ ...p, optionRole: p.optionRole as "top", orderIndex: p.orderIndex ?? 0 })),
            matrixCells: [], photos: [], isValid: o.answer.isValid } : null,
        })),
      })),
    };
    return prepareFbManagementExportVisitRow({ visit, campaignId: first.campaignId, campaignName: "Synthetic campaign",
      allowedQuestionIds: new Set(), // Every availability question was removed from the current catalog.
      market: { id: first.marketId, chain: first.chain, name: "Synthetic market", city: "Test", region: first.region, address: "Test", gm: "" },
    })!;
  });
}
test("frontend/backend counting rules remain identical without a frontend dependency on the backend repository", async () => {
  const [frontend, backend] = await Promise.all([
    readFile(new URL("../src/lib/availability.shared.ts", import.meta.url), "utf8"),
    readFile(new URL("../backend/src/gm-availability.shared.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(frontend, backend);
  assert.doesNotMatch(frontend, /import.*backend|process\.env|fetch\(/);
});
test("HTTP → canonical answers → original chart formulas → FB export → formula-linked XLSX all agree, with no database writes", async () => {
  const f = await praemienFixture();
  try {
    const fixture = await installDashboardFixture(f), plus = randomUUID(), campaign = randomUUID(), secondCampaign = randomUUID();
    await f.pg.exec("update visit_sessions set is_deleted=true");
    await f.pg.query("update markets set db_name='Billa' where id=$1", [f.ids.market]);
    await f.pg.query("insert into markets(id,db_name,name,region) values($1,'Billa+','Synthetic plus','Nord')", [plus]);
    await fixture.seedVisit({ when: "2026-09-21T08:00:00+02:00", startedAt: "2026-09-20T23:50:00+02:00", category: "Top" });
    const duplicate = await fixture.seedVisit({ when: "2026-09-15T08:00:00+02:00", category: "Top", mixed: true });
    await fixture.seedVisit({ when: "2026-09-15T08:00:00+02:00", category: "(3) = mittelmäßig, Verfügbarkeit gewährleistet" });
    await fixture.seedVisit({ when: "2026-09-15T08:00:00+02:00", category: "Bad", market: plus });
    const invalid = await fixture.seedVisit({ when: "2026-09-15T08:00:00+02:00", category: "Top", invalid: true });
    await f.pg.query("update visit_session_sections set campaign_id=$1", [campaign]);
    await f.pg.query("update visit_session_sections set campaign_id=$1 where visit_session_id=$2 and section='flex'", [secondCampaign, duplicate]);
    await f.pg.query(`update visit_answers a set value_text='Mediocre',changed_at='2026-09-15T09:00:00Z',version=2
      from visit_session_sections sec where a.visit_session_section_id=sec.id and a.visit_session_id=$1 and sec.section='flex'`, [duplicate]);
    const before = (await f.pg.query("select jsonb_agg(a order by id) as answers from visit_answers a")).rows;
    await f.pg.exec("set default_transaction_read_only=on");
    const app = express(); app.use(express.json()); app.use("/admin/gm-dashboard", createGmDashboardRouter(f.database));
    const response = await request(app).post("/admin/gm-dashboard/query").send({ intervals, scope: { ...scope, chainGroups: ["rewe"] }, includeAvailabilityAudit: true });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const data = response.body as DashboardData, counts = data.points[0]!.availability.Cooler;
    assert.deepEqual(counts, { top: 1, mediocre: 2, bad: 1, total: 4, average: 50 });
    const split = availabilityDistribution(availabilitySeries(data.points), "cooler")[0]!;
    assert.deepEqual([split.vollPct, split.mittelPct, split.leerPct], [25, 50, 25]);
    assert.equal(availabilitySummary(data.points[0]!, "Cooler").topPct, 25);
    const audit = data.availabilityAudit!;
    const prepared = prepareFromAudit(audit);
    const frontendAudit = auditAvailability(prepared.flatMap(row => row.availabilityObservations ?? []));
    assert.deepEqual(summarizeAvailability(frontendAudit, "").availability.Cooler, counts);
    const campaigns = [campaign, secondCampaign].map(id => ({ id, name: "Synthetic campaign", section: "standard" } as Campaign));
    const catalog = { questions: [], questionsByCampaignId: {}, questionIdsByCampaignId: {} };
    const sheets = buildFbManagementCampaignSheets({ campaigns, preparedRows: prepared, questionCatalog: catalog });
    const columns = sheets[0]!.columns, coolerTop = columns.findIndex(c => c.h1 === "Füllstand Test");
    assert.ok(coolerTop >= 0, "Removed historical availability question remains in the export");
    assert.deepEqual([0, 1, 2].map(offset => sheets[0]!.rows.filter(row => row[coolerTop + offset] === "X").length), [1, 2, 1]);
    assert.ok(frontendAudit.some(o => o.sessionId === invalid && !o.included));
    const wb = XLSX.utils.book_new();
    appendAvailabilityExportSheets(XLSX, wb, frontendAudit, { source: "Synthetic FB Management", scope: "Synthetic REWE" });
    const rewe = availabilityExportRows(frontendAudit).weeks.find(w => w.scopeKind === "Gruppe" && w.scope === "REWE")!;
    assert.deepEqual(rewe.counts, counts);
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const saved = XLSX.read(bytes, { type: "buffer", cellFormula: true });
    const summary = saved.Sheets["Verfügbarkeit Wochen"]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(summary, { header: 1 });
    const summaryIndex = rows.findIndex(row => row[3] === "Gruppe" && row[4] === "REWE");
    assert.deepEqual(rows[summaryIndex]!.slice(6, 13), [1, 2, 1, 4, 0.25, 0.5, 0.25]);
    assert.match(summary["G" + (summaryIndex + 1)]!.f!, /COUNTIFS\('Verfügbarkeit Antworten'/);
    assert.equal(summary["K" + (summaryIndex + 1)]!.f, `IF(J${summaryIndex + 1}=0,"",G${summaryIndex + 1}/J${summaryIndex + 1})`);
    assert.equal(saved.Sheets["Verfügbarkeit Antworten"]!["!autofilter"]?.ref?.startsWith("A4:"), true);
    assert.deepEqual((await f.pg.query("select jsonb_agg(a order by id) as answers from visit_answers a")).rows, before);
  } finally { await f.pg.close(); }
});

test("dashboard export retrieves a matching audit and refuses stale chart counts before downloading", async () => {
  // Execute the real export function with explicit client/download boundaries.
  // No production API module, auth, environment files or network is loaded.
  const availability = { Cooler: { top: 1, mediocre: 2, bad: 1, total: 4, average: 50 },
    SingleServe: { top: 0, mediocre: 0, bad: 0, total: 0, average: null },
    MultiServe: { top: 0, mediocre: 0, bad: 0, total: 0, average: null },
    Promos: { top: 0, mediocre: 0, bad: 0, total: 0, average: null },
    Warehouse: { top: 0, mediocre: 0, bad: 0, total: 0, average: null } };
  const point = { ...intervals[0]!, availability, availabilityExpected: 4, availabilityAnswered: 4 } as DashboardData["points"][number];
  const data: DashboardData = { scope, points: [point], timezone: "Europe/Vienna", calculatedAt: "2026-10-07", stcApplied: false };
  let latest = { ...data, availabilityAudit: [] as AvailabilityAudit[] }, downloads = 0;
  const module = await isolatedModule<{ exportRealGmDashboard: (input: { datasets: DashboardExport[] }) => Promise<void> }>(
    new URL("../src/lib/gm-dashboard/export.ts", import.meta.url), {
      "@/lib/api/backend": { requestGmDashboard: async (path: string, body: any) => { assert.equal(path, "/query"); assert.equal(body.includeAvailabilityAudit, true); return latest; } },
      "@/lib/exports/availabilityExport": { appendAvailabilityExportSheets },
      "./data": { availabilitySummary }, "./chain-groups": { chainGroupLabel: () => "REWE" },
      "@/lib/exports/workbook": { ...workbook, buildAndDownloadWorkbook: async ({ build }: any) => { build({ XLSX, wb: XLSX.utils.book_new() }); downloads++; } },
    },
  );
  const datasets = ["IPP", "Fuellstand", "Platzierungen", "Aktivitaet"].map(title => ({ title, data, selectedIntervalId: "kw38", highlightedType: "Cooler" as const }));
  await module.exportRealGmDashboard({ datasets }); assert.equal(downloads, 1);
  latest = { ...latest, points: [{ ...point, availability: { ...availability, Cooler: { ...availability.Cooler, top: 2 } } }] };
  await assert.rejects(() => module.exportRealGmDashboard({ datasets }), /Dashboard aktualisieren/);
  assert.equal(downloads, 1);
});
