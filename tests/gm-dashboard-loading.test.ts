import test from "node:test";
import assert from "node:assert/strict";
import { DashboardRequestQueue } from "../src/lib/gm-dashboard/request-queue";
import { selectBonusResult, ALL_BONUS_GMS } from "../src/lib/gm-dashboard/bonus-selection";
import { activitySegments } from "../src/lib/gm-dashboard/activity-segments";
import type { GmResult, Workspace } from "../src/types/praemien-workspace";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
test("first-screen work precedes speculative reads; interactive work keeps a slot and promotes without duplicating", async () => {
  const queue = new DashboardRequestQueue(), started: string[] = [];
  const top = deferred<string>(), directory = deferred<string>(), bonus = deferred<string>();
  const filters = queue.request("filters", () => { started.push("filters"); return directory.promise; }, 2);
  const lower = queue.request("bonus", () => { started.push("bonus"); return bonus.promise; }, 2);
  const chart = queue.request("top", () => { started.push("top"); return top.promise; }, 0);
  await tick(); assert.deepEqual(started, ["top"]);
  top.resolve("chart"); assert.equal(await chart, "chart");
  queue.allowBackground(); await tick(); assert.deepEqual(started, ["top", "filters"]);
  const promoted = queue.request("bonus", () => { throw new Error("duplicate"); }, 1);
  assert.equal(promoted, lower);
  await tick(); assert.deepEqual(started, ["top", "filters", "bonus"]);
  bonus.resolve("bonus"); directory.resolve("directory");
  assert.deepEqual(await Promise.all([filters, promoted]), ["directory", "bonus"]);
  assert.equal(await queue.request("filters", () => { throw new Error("warm filter must not refetch"); }, 1), "directory");
});
test("failed background reads can retry; export promotes queued work; disposal rejects and never starts queued work", async () => {
  const queue = new DashboardRequestQueue();
  queue.allowBackground();
  await assert.rejects(queue.request("retry", async () => { throw new Error("synthetic failure"); }, 2), /synthetic/);
  assert.equal(await queue.request("retry", async () => 7, 1), 7);
  const closed = new DashboardRequestQueue();
  const pending = closed.request("lower", async () => 42, 2);
  closed.promoteAll(); assert.equal(await pending, 42);
  let started = false;
  const dead = new DashboardRequestQueue();
  const discarded = dead.request("unseen", async () => { started = true; }, 2);
  dead.dispose(); await assert.rejects(discarded, /geschlossen/); await tick(); assert.equal(started, false);
});
test("effect replay shares reads while a real route exit disposes cached and queued work", async () => {
  const queue = new DashboardRequestQueue(), request = deferred<number>();
  let count = 0;
  const first = queue.request("metadata", () => { count++; return request.promise; }, 0);
  queue.pause(); queue.resume();
  const second = queue.request("metadata", async () => 999, 0);
  request.resolve(12); assert.equal(first, second); assert.equal(await second, 12); assert.equal(count, 1);
  queue.dispose(); queue.resume();
  assert.equal(await queue.request("metadata", async () => 13, 0), 13);
});
function participant(gmId: string, earned: number, maximum: number, pending: boolean, active = true): GmResult {
  return { gmId, name: gmId, earned, maximum, pending, active, rank: 1,
    pillars: [{ key: "quality", name: "Qualität", color: "red", earned, maximum, pending, metrics: [], achieved: [], next: null }] };
}
test("Alle uses summed money/weighted progress, inactive participants and pending pillars; individual identity is preserved", () => {
  const rows = [participant("A", 50, 100, false), participant("B", 450, 900, true, false), participant("C", 0, 200, false)];
  const workspace = { results: rows } as Workspace;
  const all = selectBonusResult(workspace, ALL_BONUS_GMS)!;
  assert.equal(all.earned, 500); assert.equal(all.maximum, 1200);
  assert.equal(Math.round(100 * all.earned / all.maximum), 42);
  assert.equal(all.pillars[0].earned, 500); assert.equal(all.pillars[0].maximum, 1200); assert.equal(all.pillars[0].pending, true);
  assert.equal(selectBonusResult(workspace, "B"), rows[1]);
  assert.equal(selectBonusResult(workspace, null), rows[0]);
  assert.equal(selectBonusResult({ results: [] } as unknown as Workspace, ALL_BONUS_GMS), undefined);
  assert.equal(selectBonusResult({ results: [participant("zero", 0, 0, true)] } as Workspace, ALL_BONUS_GMS)?.earned, 0);
  assert.equal(rows[0].earned, 50); assert.equal(rows[0].pillars[0].maximum, 100);
});
test("activity remainder is its own non-overlapping tile, with no phantom zero-size segments", () => {
  const segments = activitySegments(100, 50, 20);
  assert.deepEqual(segments, [{ index: 0, start: 180, end: 268 }, { index: 1, start: 272, end: 304 }, { index: 2, start: 308, end: 360 }]);
  for (const values of [[100, 100, 0], [100, 0, 100], [100, 0, 0], [0, 0, 0], [10000, 9998, 1]]) {
    const tiles = activitySegments(...values as [number, number, number]);
    assert.equal(tiles[0].start, 180); assert.equal(tiles.at(-1)?.end, 360);
    tiles.forEach((tile, i) => { assert.ok(tile.end > tile.start); if (i) assert.ok(tile.start > tiles[i - 1].end); });
  }
  assert.equal(activitySegments(100, 100, 0).some((segment) => segment.index === 2), false);
});
