import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { zeiterfassungRangeFixture } from "./zeiterfassung-range-fixture";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const request = require("supertest");

test("historical selection reaches actual GET routes and DB; both views agree without altering any stored row", async () => {
  const f = await zeiterfassungRangeFixture();
  try {
    const before = await f.fingerprint();
    const read = (path: string, from?: string, to?: string) => request(f.app).get(`/admin/zeiterfassung/${path}`).auth("synthetic-gm-admin", { type: "bearer" }).query({ ...(from ? { from, to } : {}), timezone: "Europe/Vienna", includeLive: true }).expect(200);
    const defaultDays = (await read("days")).body;
    assert.equal(defaultDays.meta.from, "2026-09-14");
    assert.deepEqual(defaultDays.sessions.map((s: any) => s.date), ["2026-10-12", "2026-09-14"]);
    for (const [from, to, dates] of [
      ["2026-08-01", "2026-08-31", ["2026-08-31", "2026-08-10", "2026-08-10", "2026-08-01"]],
      ["2026-09-13", "2026-09-14", ["2026-09-14", "2026-09-13"]],
      ["2025-12-31", "2026-01-01", ["2026-01-01", "2025-12-31"]],
      ["2026-08-10", "2026-08-10", ["2026-08-10", "2026-08-10"]],
      ["2026-02-01", "2026-02-28", []],
    ] as const) {
      const days = (await read("days", from, to)).body, gm = (await read("gm-aggregates", from, to)).body;
      assert.equal(days.meta.from, from); assert.equal(gm.meta.from, from);
      assert.equal(days.meta.to, to); assert.equal(gm.meta.to, to);
      assert.deepEqual(days.sessions.map((s: any) => s.date), [...dates]);
      assert.equal(gm.rows.length, new Set(days.sessions.map((s: any) => s.gmId)).size);
      for (const row of gm.rows) {
        const sessions = days.sessions.filter((s: any) => s.gmId === row.gmId);
        assert.equal(row.totalReineArbeitszeitMin, sessions.reduce((total: number, s: any) => total + s.stats.reineArbeitszeit, 0));
        assert.equal(row.totalKmDriven, sessions.reduce((total: number, s: any) => total + (s.endKm - s.startKm), 0));
      }
    }
    await request(f.app).get("/admin/zeiterfassung/days").expect(401);
    await request(f.app).get("/admin/zeiterfassung/days").auth("synthetic-gm", { type: "bearer" }).expect(403);
    await request(f.app).patch("/admin/zeiterfassung/day-sessions/anything").send({}).expect(405);
    assert.equal(await f.fingerprint(), before, "Historical sessions, answers, users and RED periods must be byte-for-byte unchanged");
  } finally { await f.pg.close(); }
});
