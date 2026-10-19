import assert from "node:assert/strict";
import test from "node:test";
import { smManagementHistoryEntries } from "../src/lib/sm/managementHistory";
import type { SmManagementHistory } from "../src/types/smManagement";

type Entry = SmManagementHistory["entries"][number];
const entry = (version: number, comment: string, extra: Partial<Entry> = {}): Entry => ({ id: `answer-${version}`, version,
  current: version === 32, state: "answered", value: { kind: "choice", optionCode: "no", ...(comment ? { comment } : {}) },
  at: new Date(Date.parse("2026-10-19T11:38:00Z") + version * 500).toISOString(), actorId: "same-sm", actor: "SM", reason: null, photos: [], ...extra });

test("one comment typing burst becomes one readable change, preserving original answer and raw rows", () => {
  const text = "Aufgefüllt wird am Nachmittag weil dann mehr Personal da ist.";
  const raw = Array.from({length:31}, (_, i) => entry(32-i, text.slice(0, 32-i))).concat(entry(1,""));
  const original = JSON.stringify(raw);
  assert.equal(smManagementHistoryEntries(raw.slice(0,20)).length, 1);
  const visible = smManagementHistoryEntries(raw);
  assert.deepEqual(visible.map(item => item.version), [32,1]);
  assert.equal(visible[0], raw[0]); assert.equal(JSON.stringify(raw), original);
});
test("real answer changes, separate actors and explicit corrections are never grouped", () => {
  const newer = entry(3,"Kommentar fertig");
  for (const older of [entry(2,"Kommentar", {actorId:"different-sm",actor:"SM"}),
    entry(2,"Kommentar", {reason:"Bewusste Korrektur"}), entry(2,"Kommentar", {value:{kind:"choice",optionCode:"yes",comment:"Kommentar"}}),
    entry(2,"Kommentar", {state:"invalidated"})]) assert.equal(smManagementHistoryEntries([newer,older]).length,2);
});
test("a later or unrelated comment edit remains a separate change", () => {
  const newer = entry(3,"Kommentar fertig");
  assert.equal(smManagementHistoryEntries([newer,entry(2,"Kommentar", {at:"2026-10-19T11:30:00Z"})]).length,2);
  assert.equal(smManagementHistoryEntries([newer,entry(2,"Völlig andere Aussage")]).length,2);
  assert.equal(smManagementHistoryEntries([newer,entry(1,"Kommentar")]).length,2);
  assert.equal(smManagementHistoryEntries([entry(3,""),entry(2,"Kommentar")]).length,2);
  assert.equal(smManagementHistoryEntries([entry(3,"Kommentar fertig", {actorId:null}),entry(2,"Kommentar",{actorId:null})]).length,2);
});
test("typed answer text is not mistaken for comment-only autosaves", () => {
  assert.equal(smManagementHistoryEntries([entry(3,"Kommentar",{value:{kind:"text",value:"Antwort fertig",comment:"Kommentar"}}),entry(2,"Kommentar",{value:{kind:"text",value:"Antwort",comment:"Kommentar"}})]).length,2);
});
