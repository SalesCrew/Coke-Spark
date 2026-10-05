import test from "node:test";
import assert from "node:assert/strict";
import { createRedMonthLoader, redMonthContainsDate, redMonthDaysLeft, redMonthToday, redMonthRolloverDelay } from "../src/lib/gm/redMonthRefresh";
import type { RedMonthCurrentPayload } from "../src/types/red-month";

const payload = (next = false): RedMonthCurrentPayload => ({
  current: { id: next ? "new" : "old", redPeriodId: null, redMonthYearId: null, label: "RED", periodIndex: 1, periodIndexFromAnchor: 0, start: next ? "2026-10-05" : "2026-08-31", end: next ? "2026-10-30" : "2026-10-02", lookupEnd: next ? "2026-11-01" : "2026-10-04", year: 2026, status: "active", isCurrent: true, daysUntilEnd: 999 },
  config: { redMonthYearId: null, redYear: 2026, anchorStart: "2026-01-05", cycleWeeks: [4,4,5], periodCount: 13, timezone: "Europe/Vienna", status: "active", updatedAt: null },
});
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test("Vienna day and midnight handle DST, independent of the browser timezone", () => {
  assert.equal(redMonthToday(new Date("2026-10-04T22:01:00Z")), "2026-10-05");
  for (const [start, hours] of [["2026-03-28T23:00:00Z",23], ["2026-10-24T22:00:00Z",25], ["2026-10-04T22:00:00Z",24]] as const) {
    assert.equal(redMonthRolloverDelay(new Date(start)), hours * 3_600_000 + 50);
  }
  assert.equal(redMonthDaysLeft("2026-03-30", "2026-03-28"), 2);
  assert.equal(redMonthDaysLeft("2026-10-02", "2026-10-04"), 0);
});

test("Friday end retains its weekend; Monday requires the next existing period", () => {
  for (const date of ["2026-10-02", "2026-10-03", "2026-10-04"]) assert.equal(redMonthContainsDate(payload().current, date), true);
  assert.equal(redMonthContainsDate(payload().current, "2026-10-05"), false);
  assert.equal(redMonthContainsDate(payload(true).current, "2026-10-05"), true);
});

test("same-period refresh increments the data revision and recomputes the countdown", async () => {
  let date = "2026-10-01";
  const states: any[] = [];
  const loader = createRedMonthLoader({ fetch: async () => payload(), getDate: () => date, onChange: s => states.push(s) });
  await loader.refresh(); assert.equal(states.at(-1).current.daysUntilEnd, 1);
  date = "2026-10-02"; await loader.refresh();
  assert.equal(states.at(-1).current.daysUntilEnd, 0); assert.equal(states.at(-1).revision, 2);
});

test("wake-up supersedes a delayed read, serializes requests and publishes only fresh data", async () => {
  const first = deferred<RedMonthCurrentPayload>(), second = deferred<RedMonthCurrentPayload>();
  const states: any[] = []; let calls = 0;
  const loader = createRedMonthLoader({ fetch: () => ++calls === 1 ? first.promise : second.promise, getDate: () => "2026-10-05", onChange: s => states.push(s) });
  const pending = loader.refresh(); await settle();
  void loader.refresh(true); void loader.refresh(true); assert.equal(calls, 1);
  first.resolve(payload()); await pending; await settle(); assert.equal(calls, 2);
  assert.equal(states.some(s => s.current?.id === "old"), false);
  second.resolve(payload(true)); await settle(); assert.equal(states.at(-1).current.id, "new");
  assert.equal(states.at(-1).revision, 1);
});

test("a response crossing midnight is discarded and triggers a fresh read", async () => {
  let date = "2026-10-04", calls = 0;
  const first = deferred<RedMonthCurrentPayload>(), states: any[] = [];
  const loader = createRedMonthLoader({ fetch: () => ++calls === 1 ? first.promise : Promise.resolve(payload(true)), getDate: () => date, onChange: s => states.push(s) });
  const pending = loader.refresh(); await settle(); date = "2026-10-05";
  first.resolve(payload()); await pending; await settle();
  assert.equal(calls, 2); assert.equal(states.at(-1).current.id, "new");
  assert.equal(states.some(s => s.current?.id === "old"), false);
});

test("failed rollover clears expired values, exposes an error and recovers on retry", async () => {
  let date = "2026-10-04", failed = false;
  const states: any[] = [];
  const loader = createRedMonthLoader({ fetch: async () => { if (failed) throw new Error("Offline"); return payload(date === "2026-10-05"); }, getDate: () => date, onChange: s => states.push(s) });
  await loader.refresh(); date = "2026-10-05"; failed = true; await loader.refresh();
  assert.equal(states.at(-1).current, null); assert.equal(states.at(-1).error, "Offline"); assert.equal(states.at(-1).loading, false);
  failed = false; await loader.refresh(); assert.equal(states.at(-1).current.id, "new"); assert.equal(states.at(-1).error, null);
});

test("wrong period responses fail instead of accepting an expired month", async () => {
  const states: any[] = [];
  const loader = createRedMonthLoader({ fetch: async () => payload(), getDate: () => "2026-10-05", onChange: s => states.push(s) });
  await loader.refresh(); assert.equal(states.at(-1).current, null); assert.ok(states.at(-1).error); assert.equal(states.at(-1).revision, 0);
});

test("unmount and account changes reject pending responses", async () => {
  for (const change of ["unmount", "account"]) {
    let owner = true; const read = deferred<RedMonthCurrentPayload>(), states: any[] = [];
    const loader = createRedMonthLoader({ fetch: () => read.promise, getDate: () => "2026-10-05", isCurrent: () => owner, onChange: s => states.push(s) });
    const pending = loader.refresh(); await settle();
    if (change === "unmount") loader.dispose(); else owner = false;
    const count = states.length; read.resolve(payload(true)); await pending;
    assert.equal(states.length, count);
  }
});
