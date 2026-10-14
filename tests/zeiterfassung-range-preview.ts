import { createRequire } from "node:module";
import { zeiterfassungRangeFixture } from "./zeiterfassung-range-fixture";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const express = require("express");
async function main() {
  const f = await zeiterfassungRangeFixture();
  const before = await f.fingerprint(), requests: Array<Record<string, unknown>> = [];
  const app = express();
  app.use((req: any, res: any, next: () => void) => {
    if (req.get("origin") === "http://127.0.0.1:3037") res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3037");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-coke-spark-page-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json());
  const user = { id: f.ids.admin, role: "admin", email: "gm-admin@preview.test", firstName: "Synthetic", lastName: "Admin", isActive: true };
  const session = { accessToken: "synthetic-gm-admin", refreshToken: "synthetic-gm-admin", expiresAt: Math.floor(Date.now() / 1000) + 86_400 };
  app.post("/auth/login", (req: any, res: any) => req.body.email === user.email && req.body.password === "preview" ? res.json({ user, session }) : res.sendStatus(401));
  app.post("/auth/refresh", (req: any, res: any) => req.body.refreshToken === session.refreshToken ? res.json({ user, session }) : res.sendStatus(401));
  app.get("/auth/me", (req: any, res: any) => req.get("authorization") === "Bearer synthetic-gm-admin" ? res.json({ user }) : res.sendStatus(401));
  app.get("/employee-agreement/current", (_req: unknown, res: any) => res.json({ accepted: true }));
  app.get("/__preview/proof", async (_req: unknown, res: any) => res.json({ before, after: await f.fingerprint(), requests }));
  app.use((req: any, res: any, next: () => void) => { if (!["GET", "HEAD"].includes(req.method)) return res.sendStatus(405); next(); });
  app.use("/admin/zeiterfassung", async (req: any, res: any, next: () => void) => {
    requests.push({ path: req.path, from: req.query.from, to: req.query.to });
    // Synthetic, read-only fault case. No production route contains this behavior.
    if (req.query.from === "2026-08-02") await new Promise(resolve => setTimeout(resolve, 1200));
    if (req.query.from === "2026-02-02" && req.path === "/gm-aggregates") return res.status(503).json({ error: "Synthetic range failure" });
    next();
  });
  const periods = await f.database.select().from(f.schema.redMonthPeriods);
  const [year] = await f.database.select().from(f.schema.redMonthYears);
  const current = { ...periods[0], start: periods[0].startDate, end: periods[0].endDate, lookupEnd: periods[0].lookupEndDate, year: 2026, periodIndexFromAnchor: 9, isCurrent: true, daysUntilEnd: 16, status: "active" };
  app.get("/red-month/current", (_req: unknown, res: any) => res.json({ current, config: { ...year, redMonthYearId: year.id } }));
  app.get("/red-month/calendar", (_req: unknown, res: any) => res.json({ periods: [current] }));
  app.get("/admin/red-month/years", (_req: unknown, res: any) => res.json({ years: [{ ...year, periods: [current], editable: false }], current }));
  for (const path of ["/admin/modules/main", "/admin/fragebogen/main", "/admin/users", "/admin/market-chains"]) {
    app.get(path, (_req: unknown, res: any) => res.json({ modules: [], fragebogen: [], users: [], chains: [] }));
  }
  for (const path of ["/admin/campaigns/answer-change-requests", "/admin/campaigns/visit-session-delete-requests", "/admin/time-change-requests"]) app.get(path, (_req: unknown, res: any) => res.json({ requests: [] }));
  app.use(f.app);
  const server = app.listen(4037, "127.0.0.1", () => console.log("Isolated synthetic Zeiterfassung preview ready at 127.0.0.1:4037"));
  process.once("SIGTERM", () => server.close(async () => { await f.pg.close(); process.exit(0); }));

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
