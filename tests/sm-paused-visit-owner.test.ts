import assert from "node:assert/strict";
import test from "node:test";
import { isSmPausedVisitNotice, readSmPausedVisitNotice, smPausedVisitStorageKey } from "../src/lib/sm/pausedVisitNotice";
import { smVisitResumeHref } from "../src/lib/sm/SMDurcharbeitVisitReference";

test("paused visit metadata stays with its author for Standard and monthly executions", () => {
  const values = new Map<string, string>(), store = { getItem: (key: string) => values.get(key) ?? null };
  for (const assignmentId of ["standard-assignment", "SMDurcharbeit:00000000-0000-4000-8000-000000000001"]) {
    const notice = { ownerKey: "sm:A", assignmentId, marketName: "Private synthetic A", resumeHref: smVisitResumeHref(assignmentId, "question-1"), pausedAt: Date.now() };
    values.set(smPausedVisitStorageKey("sm:A"), JSON.stringify(notice));
    assert.deepEqual(readSmPausedVisitNotice(store, "sm:A"), notice);
    assert.equal(readSmPausedVisitNotice(store, "sm:B"), null);
    values.set(smPausedVisitStorageKey("sm:B"), JSON.stringify(notice));
    assert.equal(readSmPausedVisitNotice(store, "sm:B"), null, "Copied foreign metadata is rejected");
    assert.equal(isSmPausedVisitNotice({ ...notice, resumeHref: "/admin/sm/fbmanagement" }, "sm:A"), false);
    assert.equal(isSmPausedVisitNotice({ ...notice, resumeHref: smVisitResumeHref("different") }, "sm:A"), false);
    assert.equal(isSmPausedVisitNotice({ ...notice, pausedAt: Infinity }, "sm:A"), false);
  }
  values.clear(); values.set("sm-paused-visit-notice", JSON.stringify({ assignmentId: "old-unowned", marketName: "Unknown author", pausedAt: Date.now() }));
  assert.equal(readSmPausedVisitNotice(store, "sm:A"), null, "Legacy unowned metadata cannot be assigned to the next login");
});
