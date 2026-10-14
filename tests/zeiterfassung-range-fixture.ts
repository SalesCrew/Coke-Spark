import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spezialfragenPeriodFixture } from "../backend/tests/spezialfragen-period-fixture";
import { isolatedModule } from "../backend/tests/isolated-module";
import * as adminRole from "../backend/src/lib/admin-role";
import * as timeCalculations from "../backend/src/lib/admin-zeiterfassung";
import * as exportCalculations from "../backend/src/lib/zeitenaufstellung-export";

const require = createRequire(new URL("../backend/package.json", import.meta.url));
const express = require("express");

/** Actual read routes and Drizzle schema in memory. No env loader, app entry point or jobs. */
export async function zeiterfassungRangeFixture() {
  const now = new Date("2026-10-14T10:00:00Z");
  const f = await spezialfragenPeriodFixture(now);
  const secondGm = randomUUID();
  await f.database.insert(f.schema.users).values({ id: secondGm, supabaseAuthId: randomUUID(), firstName: "Synthetic", lastName: "West", role: "gm", email: "west@preview.test", region: "West" });
  const dates = ["2025-12-31", "2026-01-01", "2026-08-01", "2026-08-10", "2026-08-31", "2026-09-13", "2026-09-14", "2026-10-12"];
  for (const date of dates) {
    const start = new Date(`${date}T06:00:00Z`), end = new Date(`${date}T14:00:00Z`);
    await f.database.insert(f.schema.gmDaySessions).values({ gmUserId: f.ids.gm, workDate: date, status: "submitted", dayStartedAt: start, dayEndedAt: end, startKm: 100, endKm: 140, isStartKmCompleted: true, isEndKmCompleted: true, submittedAt: end });
  }
  const [westDay] = await f.database.insert(f.schema.gmDaySessions).values({ gmUserId: secondGm, workDate: "2026-08-10", status: "submitted", dayStartedAt: new Date("2026-08-10T08:00:00Z"), dayEndedAt: new Date("2026-08-10T12:00:00Z"), startKm: 200, endKm: 220, isStartKmCompleted: true, isEndKmCompleted: true }).returning();
  await f.database.insert(f.schema.timeTrackingEntries).values({ gmUserId: secondGm, status: "submitted", activityType: "schulung", startAt: new Date("2026-08-10T09:00:00Z"), endAt: new Date("2026-08-10T10:00:00Z"), comment: "Synthetic training only" });
  await f.database.insert(f.schema.gmDaySessionPauses).values({ daySessionId: westDay.id, gmUserId: secondGm, pauseStartedAt: new Date("2026-08-10T10:00:00Z"), pauseEndedAt: new Date("2026-08-10T10:15:00Z") });
  for (const values of [{ workDate: "2026-08-11", status: "draft" as const }, { workDate: "2026-08-12", status: "submitted" as const, isDeleted: true }]) {
    await f.database.insert(f.schema.gmDaySessions).values({ gmUserId: f.ids.gm, ...values, dayStartedAt: new Date(`${values.workDate}T06:00:00Z`), dayEndedAt: new Date(`${values.workDate}T14:00:00Z`) });
  }
  const [redYear] = await f.database.insert(f.schema.redMonthYears).values({ redYear: 2026, anchorStart: "2026-01-05", cycleWeeks: [4, 4, 5], periodCount: 13, status: "active" }).returning();
  await f.database.insert(f.schema.redMonthPeriods).values({ redMonthYearId: redYear.id, redYear: 2026, periodIndex: 10, label: "RED 10", startDate: "2026-10-05", endDate: "2026-10-30", lookupEndDate: "2026-11-01", cycleIndex: 1, cycleWeeks: 4 });
  class Clock extends Date {
    constructor(value?: string | number | Date) { super(value === undefined ? now.getTime() : value instanceof Date ? value.getTime() : value); }
    static now() { return now.getTime(); }
  }
  const forbidden = () => { throw new Error("External calls and write jobs are forbidden in this fixture"); };
  const kundeAccess = await isolatedModule<typeof import("../backend/src/lib/kunde-access")>(new URL("../backend/src/lib/kunde-access.ts", import.meta.url), { "./db.js": { db: f.database }, "./schema.js": f.schema, "./admin-role.js": adminRole });
  const route = await isolatedModule<typeof import("../backend/src/routes/admin-zeiterfassung")>(new URL("../backend/src/routes/admin-zeiterfassung.ts", import.meta.url), {
    "../lib/admin-role.js": adminRole,
    "../lib/admin-zeiterfassung.js": timeCalculations,
    "../lib/zeitenaufstellung-export.js": exportCalculations,
    "../lib/db.js": { db: f.database }, "../lib/schema.js": f.schema,
    "../lib/kunde-access.js": kundeAccess,
    "../lib/bonus-finalizer.js": { recomputeBonusWaveTx: forbidden },
    "../lib/gm-kpi-cache.js": { recomputeGmKpiCache: forbidden },
    "../lib/ipp-finalizer.js": { enqueueIppRecalcForDate: forbidden },
    "../lib/logger.js": { logAction() {}, startActionTimer: () => 0, logger: { info() {}, warn() {}, error() {} } },
    "../middleware/auth.js": { requireAuth: (roles: string[]) => (req: any, res: any, next: () => void) => {
      const role = req.get("authorization") === "Bearer synthetic-gm-admin" ? "admin" : req.get("authorization") === "Bearer synthetic-gm" ? "gm" : null;
      if (!role) return res.sendStatus(401);
      if (!roles.includes(role)) return res.sendStatus(403);
      req.authUser = { appUserId: role === "admin" ? f.ids.admin : f.ids.gm, role };
      next();
    } },
  }, Clock as typeof Date);
  const app = express();
  app.use("/admin/zeiterfassung", (req: any, res: any, next: () => void) => { if (req.method !== "GET" && req.method !== "HEAD") return res.sendStatus(405); next(); });
  app.use("/admin/zeiterfassung", route.adminZeiterfassungRouter);
  app.use((error: Error, _req: unknown, res: any, _next: unknown) => res.status(500).json({ error: error.message }));
  // Database-level protection as well as route-level protection after synthetic seeding.
  await f.pg.exec("set default_transaction_read_only = on");
  const fingerprint = async () => {
    const tables = await f.pg.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by tablename");
    const hash = createHash("sha256");
    for (const { tablename } of tables.rows) {
      const result = await f.pg.query(`select row_to_json(t) as row from "${tablename.replaceAll('"', '""')}" t`);
      hash.update(tablename + JSON.stringify(result.rows.map(row => JSON.stringify(row)).sort()));
    }
    return hash.digest("hex");
  };
  return { ...f, app, fingerprint, dates, secondGm };
}
