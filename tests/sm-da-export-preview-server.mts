// Standalone disposable preview: no app entrypoint, environment files or background jobs.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createQuestionnaireUpdateFixture } from "../backend/tests/SMDurcharbeit-questionnaire-update-fixture.ts";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { eq } = require("drizzle-orm");
const express = require("express"), cors = require("cors");
for (const key of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (process.env[key]) throw Error("Production configuration forbidden");
const otherSm = randomUUID();
const f = await createQuestionnaireUpdateFixture([{ id: otherSm, token: "synthetic-other-sm" }]);
f.setNow("2026-10-21T10:00:00Z");
const preview = (await f.admin("get", `${f.root}/${f.campaign.id}/questionnaire-update?month=2026-10-01`).expect(200)).body;
await f.admin("patch", `${f.root}/${f.campaign.id}/questionnaire-update`).send({ month: preview.month, expectedRevision: preview.campaignRevision, previewToken: preview.previewToken }).expect(200);
async function finish(targetId: string, begin: string, followUp = false, token = "synthetic-sm") {
  const started = await f.start(targetId, followUp, token), path = `${f.visitRoot}/${started.visitId}`;
  const payload = (await f.sm("get", path, token).expect(200)).body;
  for (const q of payload.sections[0].questions) {
    if (q.type === "photo") continue;
    await f.sm("put", `${path}/answers/${q.id}`, token).send({ expectedAnswerVersion: payload.answerVersions[q.id] ?? 0, clientMutationToken: randomUUID(),
      answer: q.type === "text" ? { kind: "text", value: "Synthetische Besuchsnotiz", comment: "Kommentar zur Notiz" }
        : { kind: "choice", optionCode: q.options[1].code, comment: "Synthetischer Kommentar" } }).expect(200);
  }
  await f.sm("post", `${path}/submit`, token).send({ visitStartedAt: begin, visitCompletedAt: new Date(Date.parse(begin) + 20 * 60000).toISOString(), clientMutationToken: randomUUID() }).expect(200);
}
await finish(f.targets[0].id, "2026-10-20T22:15:00Z", true);
const target = (await f.list()).find((row: any) => row.campaignId === f.otherCampaign.id && row.market.id !== f.targets[0].market.id && row.market.id !== f.targets[1].market.id);
await f.admin("patch", `${f.root}/targets/${target.id}/owner`).send({ expectedRevision: target.revision, reason: "Synthetischer SM-Wechsel", SMDurcharbeitSmUserId: otherSm }).expect(200);
await finish(target.id, "2026-10-21T06:00:00Z", false, "synthetic-other-sm");
await f.database.update(f.schema.smSMDurcharbeitTargets).set({ marketSnapshot: { ...f.targets[0].market, chain: "Spar", region: "Ost" } }).where(eq(f.schema.smSMDurcharbeitTargets.id, f.targets[0].id));
await f.database.update(f.schema.users).set({ isActive: false }).where(eq(f.schema.users.id, otherSm));
await f.database.update(f.schema.smSMDurcharbeitTargets).set({ marketSnapshot: { ...target.market, region: "West", chain: "Billa" } }).where(eq(f.schema.smSMDurcharbeitTargets.id, target.id));
await f.database.update(f.schema.smSMDurcharbeitCampaigns).set({ status: "archived" }).where(eq(f.schema.smSMDurcharbeitCampaigns.id, f.otherCampaign.id));
const app = express(), requests: Array<{ method: string; path: string }> = [];
app.use(cors({ origin: "http://127.0.0.1:3037" })); app.use(express.json());
app.use((req: any, _res: any, next: any) => { requests.push({ method: req.method, path: req.path }); next(); });
const user = { id: f.adminId, role: "sm_admin", firstName: "Vorschau", lastName: "Admin", email: "admin@preview.test" };
const login = { user, session: { accessToken: "synthetic-sm-admin", refreshToken: "synthetic-refresh", expiresAt: null } };
app.get("/__synthetic/identity", (_req: any, res: any) => res.json({ synthetic: true, login }));
app.get("/__synthetic/requests", (_req: any, res: any) => res.json({ synthetic: true, requests }));
app.get("/auth/me", (_req: any, res: any) => res.json({ user }));
app.get("/admin/kurti/layout", (_req: any, res: any) => res.json({ layout: null }));
// The existing shell persists window position on resize. Keep that entirely in memory.
app.put("/admin/kurti/layout", (req: any, res: any) => res.json({ layout: { ...req.body, updatedAt: new Date().toISOString() } }));
app.get("/red-month/current", (_req: any, res: any) => res.json({
  current: { id: "synthetic-red", label: "RED 11", periodIndexFromAnchor: 10, start: "2026-11-02", end: "2026-11-29", year: 2026, isCurrent: true, daysUntilEnd: 5 },
  config: { anchorStart: "2026-01-05", cycleWeeks: [4, 4, 5], timezone: "Europe/Vienna", updatedAt: null },
}));
app.post("/telemetry/events", (_req: any, res: any) => res.sendStatus(204));
app.get(/^\/admin\/modules\/(main|kuehler|mhd|durcharbeit)$/, (_req: any, res: any) => res.json({ modules: [] }));
app.get(/^\/admin\/fragebogen\/(main|kuehler|mhd|durcharbeit)$/, (_req: any, res: any) => res.json({ fragebogen: [] }));
app.get("/admin/markets/chains", (_req: any, res: any) => res.json({ chains: ["Billa", "Spar"] }));
app.use(f.app);
app.use((req: any, res: any) => res.status(404).json({ error: "Unimplemented synthetic preview route", path: req.path }));
app.listen(4037, "127.0.0.1", () => console.log("Disposable SM export preview ready on 4037; synthetic data only."));
