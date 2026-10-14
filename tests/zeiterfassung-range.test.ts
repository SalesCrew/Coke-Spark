import test from "node:test";
import assert from "node:assert/strict";
import { defaultZeiterfassungRange, ZeiterfassungRangeRequests } from "../src/lib/admin/zeiterfassung-range";

test("default matches the existing 30-day window in Vienna, including midnight, DST and year boundaries", () => {
  for (const [now, from, to] of [
    ["2026-10-14T10:00:00Z", "2026-09-14", "2026-10-14"],
    ["2026-10-13T22:30:00Z", "2026-09-14", "2026-10-14"],
    ["2025-12-31T23:30:00Z", "2025-12-02", "2026-01-01"],
    ["2026-03-29T01:30:00Z", "2026-02-27", "2026-03-29"],
    ["2024-03-01T12:00:00Z", "2024-01-31", "2024-03-01"],
  ]) assert.deepEqual(defaultZeiterfassungRange(new Date(now)), { from, to });
});

const range = { from: "2026-08-01", to: "2026-08-31" };

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("days and GM totals publish together; a slower previous range cannot overwrite them or end their loading state", async () => {
  const requests = new ZeiterfassungRangeRequests(range), old = deferred<string>(), days = deferred<string>(), totals = deferred<string>();
  const events: unknown[] = [];
  const callbacks = { success: (data: unknown) => { events.push(data); }, error: (error: unknown) => { events.push(error); }, settled: () => { events.push("settled"); } };
  const previous = requests.run(range, () => old.promise, callbacks);
  const current = requests.run(range, () => Promise.all([days.promise, totals.promise]), callbacks);
  old.resolve("old range"); await previous;
  days.resolve("August days"); await Promise.resolve();
  assert.deepEqual(events, []);
  totals.resolve("August GM totals"); await current;
  assert.deepEqual(events, [["August days", "August GM totals"], "settled"]);
});

test("previous errors are ignored; current errors settle once without publishing a partial pair", async () => {
  const requests = new ZeiterfassungRangeRequests(range), old = deferred<string>(), current = deferred<string>();
  const events: unknown[] = [];
  const callbacks = { success: (data: unknown) => { events.push(data); }, error: (error: unknown) => { events.push(error); }, settled: () => { events.push("settled"); } };
  const previous = requests.run(range, () => old.promise, callbacks);
  const newest = requests.run(range, () => Promise.all([Promise.resolve("days"), current.promise]), callbacks);
  old.reject("old error"); await previous;
  assert.deepEqual(events, []);
  current.reject("GM request failed"); await newest;
  assert.deepEqual(events, ["GM request failed", "settled"]);
});

test("range changes and unmount invalidate pending success/error/loading callbacks", async () => {
  for (const fails of [false, true]) {
    const requests = new ZeiterfassungRangeRequests(range), pending = deferred<string>();
    const unexpected = () => assert.fail("An invalidated request must not publish");
    const result = requests.run(range, () => pending.promise, { success: unexpected, error: unexpected, settled: unexpected });
    requests.invalidate();
    if (fails) pending.reject("late error"); else pending.resolve("late data");
    await result;
  }
});


test("a completed edit from an older range cannot refresh the new selection", async () => {
  const requests = new ZeiterfassungRangeRequests(range), next = { from: "2026-09-01", to: "2026-09-30" };
  requests.select(next);
  const unexpected = () => assert.fail("A refresh for the old range must not even fetch");
  await requests.run(range, async () => { unexpected(); }, { success: unexpected, error: unexpected, settled: unexpected });
  let refreshed = false;
  await requests.run(next, async () => "September", { success: data => { assert.equal(data, "September"); refreshed = true; }, error: unexpected, settled() {} });
  assert.equal(refreshed, true);
});
