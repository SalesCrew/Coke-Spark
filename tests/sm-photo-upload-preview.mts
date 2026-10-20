import { createRequire } from "node:module";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const express = require("express");
import { randomUUID, createHash } from "node:crypto";
const { eq } = require("drizzle-orm");
const request = require("supertest");
import { createSMDurcharbeitFixture } from "../backend/tests/SMDurcharbeit-fixture.js";
import { createSyntheticPhotoStorage, syntheticShelfPhoto } from "../backend/tests/synthetic-photo-storage.js";

// Isolated browser fixture: actual SM routes, disposable DB and synthetic loopback storage only.
class Clock extends Date { constructor(value?: string | number | Date) { super(value === undefined ? "2026-10-20T12:00:00Z" : value instanceof Date ? value.getTime() : value); } static now() { return Date.parse("2026-10-20T12:00:00Z"); } }
const storage = createSyntheticPhotoStorage("http://127.0.0.1:4038");
const f = await createSMDurcharbeitFixture({ clock: Clock as typeof Date, photoStorage: storage.storage });
const admin = (method: "get" | "post", path: string) => request(f.app)[method](path).auth("synthetic-sm-admin", { type: "bearer" });
const sm = (method: "get" | "post" | "put", path: string) => request(f.app)[method](path).auth("synthetic-sm", { type: "bearer" });
await f.database.insert(f.schema.smSMDurcharbeitMarkets).values({ smMarketId: f.market, SMDurcharbeitSmUserId: f.employee });
const q = (type: string, text: string) => ({ id: `new-${randomUUID()}`, type, text, required: true, options: [], config: {}, rules: [] });
const module = (await admin("post", "/admin/sm-questionnaires/modules?scope=SMDurcharbeit").send({ id: `new-${randomUUID()}`, name: "Durcharbeit · Fotoprüfung", description: "", questions: [q("text", "Notiz zum Markt"), q("photo", "Fotos der Platzierung")] }).expect(201)).body.module;
const form = (await admin("post", "/admin/sm-questionnaires/questionnaires?scope=SMDurcharbeit").send({ id: `new-${randomUUID()}`, name: "Durcharbeit · Fotoprüfung", description: "", status: "active", moduleIds: [module.id] }).expect(201)).body.questionnaire;
const [version] = await f.database.select().from(f.schema.smQuestionnaireVersions).where(eq(f.schema.smQuestionnaireVersions.questionnaireTemplateId, form.id));
const campaign = (await admin("post", "/admin/sm-smdurcharbeit-campaigns").send({ name: "Synthetic photo recovery", startDate: "2026-10-01", endDate: "2026-10-31", questionnaireVersionId: version!.id, rosterDraft: [{ smMarketId: f.market }] }).expect(201)).body.campaign;
const preview = (await admin("get", `/admin/sm-smdurcharbeit-campaigns/${campaign.id}/preview`).expect(200)).body;
await admin("post", `/admin/sm-smdurcharbeit-campaigns/${campaign.id}/publish`).send({ expectedRevision: campaign.revision, previewToken: preview.previewToken }).expect(200);
const start = async (followUp: boolean) => {
  const target = (await sm("get", "/sm/smdurcharbeit/targets").expect(200)).body.targets[0];
  return (await sm("post", `/sm/smdurcharbeit/targets/${target.id}/start`).send({ expectedRevision: target.revision, followUp, mode: "manual", clientSubmissionToken: randomUUID() }).expect(201)).body;
};
const old = await start(false), oldPath = `/sm/smdurcharbeit/visits/${old.visitId}`;
const oldPayload = (await sm("get", oldPath).expect(200)).body;
const [oldText, oldPhoto] = oldPayload.sections[0].questions;
await sm("put", `${oldPath}/answers/${oldText.id}`).send({ expectedAnswerVersion: 0, answer: { kind: "text", value: "Historische Antwort bleibt erhalten" }, clientMutationToken: randomUUID() }).expect(200);
const answerId = (await sm("post", `${oldPath}/photos/initialize`).send({ submissionQuestionId: oldPhoto.id }).expect(200)).body.answerId;
const upload = (await sm("post", `${oldPath}/photos/presign`).send({ answerId, extension: "png" }).expect(200)).body.upload;
const bytes = syntheticShelfPhoto(true); storage.put(upload.path, bytes);
const oldPhotoId = (await sm("post", `${oldPath}/photos/commit`).send({ answerId, photos: [{ storageBucket: upload.bucket, storagePath: upload.path, byteSize: bytes.length, mimeType: "image/png" }] }).expect(200)).body.fileIds[0];
await sm("post", `${oldPath}/submit`).send({ visitStartedAt: "2026-10-20T08:00:00Z", visitCompletedAt: "2026-10-20T08:10:00Z", clientMutationToken: randomUUID() }).expect(200);
const draft = await start(true), path = `/sm/smdurcharbeit/visits/${draft.visitId}`;
const payload = (await sm("get", path).expect(200)).body;
const [textQuestion, photoQuestion] = payload.sections[0].questions;
await sm("put", `${path}/answers/${textQuestion.id}`).send({ expectedAnswerVersion: payload.answerVersions[textQuestion.id], answer: { kind: "text", value: "Bereits gespeicherte Antwort" }, clientMutationToken: randomUUID() }).expect(200);
await f.database.update(f.schema.smQuestionnaireSubmissions).set({ visitStartedAt: new Date("2026-10-20T10:00:00Z") }).where(eq(f.schema.smQuestionnaireSubmissions.id, draft.submissionId));
const historicalGraph = async () => JSON.stringify(await Promise.all([
  f.database.select().from(f.schema.smQuestionnaireSubmissions).where(eq(f.schema.smQuestionnaireSubmissions.id, old.submissionId)),
  f.database.select().from(f.schema.smQuestionAnswers).where(eq(f.schema.smQuestionAnswers.submissionId, old.submissionId)),
  f.database.select().from(f.schema.smQuestionAnswerFiles).where(eq(f.schema.smQuestionAnswerFiles.answerId, answerId)),
]));
const historical = await historicalGraph();
const currentText = JSON.stringify(await f.database.select().from(f.schema.smQuestionAnswers).where(eq(f.schema.smQuestionAnswers.submissionQuestionId, textQuestion.id)));
const app = express(); app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3038"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-coke-spark-page-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; } next();
});
const user = { id: f.employee, role: "sm", email: "sm@preview.test", firstName: "Local", lastName: "SM", isActive: true };
const session = () => ({ user, session: { accessToken: "synthetic-sm", refreshToken: "synthetic-sm", expiresAt: Math.floor(Date.now() / 1000) + 86400 } });
app.post("/auth/login", (req, res) => req.body.email === user.email && req.body.password === "preview" ? res.json(session()) : res.sendStatus(401));
app.post("/auth/refresh", (_req, res) => res.json(session()));
app.get("/auth/me", (_req, res) => res.json({ user }));
app.get("/employee-agreement/current", (_req, res) => res.json({ accepted: true, agreement: { key: "synthetic", version: "synthetic", title: "Synthetic", sections: [] }, acceptance: { acceptedAt: "2026-10-01T00:00:00Z" } }));
app.post("/telemetry/events", (_req, res) => res.json({ ok: true }));
app.get("/__fixture/state", async (_req, res) => {
  const current = (await sm("get", path).expect(200)).body;
  res.json({ visitId: draft.visitId, submissionId: draft.submissionId, photoQuestionId: photoQuestion.id, oldPhotoId, oldPhotoPath: upload.path,
    oldPhotoHash: createHash("sha256").update(bytes).digest("hex"), status: current.submission.status, photos: current.photoFiles[photoQuestion.id],
    textUnchanged: currentText === JSON.stringify(await f.database.select().from(f.schema.smQuestionAnswers).where(eq(f.schema.smQuestionAnswers.submissionQuestionId, textQuestion.id))),
    historyUnchanged: historical === await historicalGraph(), visits: (await f.database.select().from(f.schema.smSMDurcharbeitVisits)).length });
});
const seenUploads = new Set<string>();
app.use("/synthetic-photo-storage/upload", (req, res, next) => {
  if (req.method === "PUT") {
    const key = String(req.query.path);
    if (seenUploads.has(key)) { res.status(400).json({ error: "Duplicate", message: "The resource already exists" }); return; }
    seenUploads.add(key);
  }
  next();
});
app.use("/synthetic-photo-storage", storage.router);
app.use(f.app);
const server = app.listen(4038, "127.0.0.1", () => console.log("Synthetic SM photo recovery fixture ready on 4038"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close(() => { void f.pg.close().then(() => process.exit(0)); }));
