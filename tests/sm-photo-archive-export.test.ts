import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { exportSmArchivePhotos, smPhotoArchiveManifest } from "../src/lib/exports/smPhotoArchiveExport";
import type { SmArchivePhoto, SmPhotoArchiveApi } from "../src/types/smPhotoArchive";

const photo = (id: string, scope: "standard" | "SMDurcharbeit"): SmArchivePhoto => ({ id, SMDurcharbeitCatalogScope: scope,
  submissionId: "submission-" + id, assignmentId: "assignment-" + id, questionId: "question-" + id, questionText: "Foto der Platzierung", moduleName: "Foto-Modul",
  fileName: "Bild.png", mimeType: "image/png", byteSize: 4, widthPx: 320, heightPx: 240, uploadedAt: "2026-10-07T10:00:00Z", workDate: "2026-10-07",
  smUserId: "sm", smName: "Synthetic SM", marketId: "market", marketName: "Synthetic / Markt", address: "Testweg 1", postalCode: "1010", city: "Wien",
  questionnaireId: "questionnaire-" + id, questionnaireName: "Synthetic Fragebogen", questionnaireVersion: 1,
});
function apiFor(photos: SmArchivePhoto[]): SmPhotoArchiveApi {
  return { list: async () => { throw new Error("Unused"); }, facets: async () => ({ facets: [], truncated: false }),
    export: async () => ({ photos }), urls: async ids => ({ photos: ids.map(id => ({ id, signedUrl: `http://synthetic.invalid/${id}`, expiresAt: "2026-10-07T10:10:00Z" })) }) };
}
test("SM photo ZIP includes the filtered originals, separates types and records visit metadata", async () => {
  const items = [photo("one", "standard"), photo("two", "SMDurcharbeit")], api = apiFor(items);
  let captured: Blob | null = null, filename = "", seenFilters: unknown;
  api.export = async filters => { seenFilters = filters; return { photos: items }; };
  const result = await exportSmArchivePhotos({ api, filters: { SMDurcharbeitCatalogScope: "SMDurcharbeit", from: "2026-10-01" }, isCurrent: () => true, onProgress() {},
    fetchPhoto: async (_url, init) => { assert.equal(init?.credentials, "omit"); return new Response(new Uint8Array([1, 2, 3, 4])); }, save: (blob, name) => { captured = blob; filename = name; } });
  assert.equal(result.count, 2); assert.deepEqual(seenFilters, { SMDurcharbeitCatalogScope: "SMDurcharbeit", from: "2026-10-01" });
  assert.ok(captured); assert.match(filename, /^CokeSpark_SM_Fotoarchiv_.*\.zip$/);
  const zip = await JSZip.loadAsync(await (captured as Blob).arrayBuffer());
  assert.ok(zip.file("Standardfragebogen/2026-10-07_Synthetic _ Markt/one_Bild.png"));
  assert.ok(zip.file("Durcharbeit/2026-10-07_Synthetic _ Markt/two_Bild.png"));
  assert.deepEqual(await zip.file("Standardfragebogen/2026-10-07_Synthetic _ Markt/one_Bild.png")!.async("uint8array"), new Uint8Array([1, 2, 3, 4]));
  const manifest = await zip.file("Fotoliste.csv")!.async("string");
  assert.match(manifest, /Standardfragebogen/); assert.match(manifest, /Durcharbeit/); assert.match(manifest, /Foto der Platzierung/);
});
test("CSV treats user-supplied cells as text and preserves quotes/newlines", () => {
  const item = { ...photo("one", "standard"), smName: '=HYPERLINK("evil")', questionText: 'Line 1\n"Line 2"', fileName: "+formula.png" };
  const csv = smPhotoArchiveManifest([item]);
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"')); assert.ok(csv.includes('"\'+formula.png"')); assert.ok(csv.includes('Line 1\n""Line 2""'));
});
test("failed or missing originals never create a misleading partial ZIP", async () => {
  let saved = false;
  const input = { api: apiFor([photo("one", "standard")]), filters: {}, isCurrent: () => true, onProgress() {}, save: () => { saved = true; } };
  await assert.rejects(exportSmArchivePhotos({ ...input, fetchPhoto: async () => new Response("Unavailable", { status: 404 }) }), /heruntergeladen/);
  assert.equal(saved, false);
  input.api.urls = async () => ({ photos: [] });
  await assert.rejects(exportSmArchivePhotos(input), /nicht mehr verfügbar/); assert.equal(saved, false);
});
test("account switching cancels export before downloading private files", async () => {
  let current = true, fetches = 0, saved = false;
  const api = apiFor([photo("one", "standard")]);
  api.export = async () => { current = false; return { photos: [photo("one", "standard")] }; };
  await assert.rejects(exportSmArchivePhotos({ api, filters: {}, isCurrent: () => current, onProgress() {}, save: () => { saved = true; },
    fetchPhoto: async () => { fetches++; return new Response("x"); } }), /Zugang/);
  assert.equal(fetches, 0); assert.equal(saved, false);
});
test("export signs in batches of 60 and downloads at most four originals concurrently", async () => {
  const items = Array.from({ length: 130 }, (_, index) => photo(String(index), index % 2 ? "standard" : "SMDurcharbeit"));
  const api = apiFor(items), batches: string[][] = [], requests: string[] = [];
  const urls = api.urls; api.urls = async ids => { batches.push(ids); return urls(ids); };
  let concurrent = 0, peak = 0, captured: Blob | null = null;
  await exportSmArchivePhotos({ api, filters: {}, isCurrent: () => true, onProgress() {}, save: blob => { captured = blob; },
    fetchPhoto: async url => { concurrent++; peak = Math.max(peak, concurrent); requests.push(String(url)); await new Promise(resolve => setTimeout(resolve, 1)); concurrent--; return new Response(new Uint8Array([1, 2, 3, 4])); } });
  assert.deepEqual(batches.map(batch => batch.length), [60, 60, 10]); assert.equal(peak, 4);
  assert.equal(new Set(requests).size, 130);
  const zip = await JSZip.loadAsync(await captured!.arrayBuffer());
  assert.equal(Object.values(zip.files).filter(file => !file.dir && file.name.endsWith(".png")).length, 130);
});
test("empty or oversized selections never fetch originals or create a ZIP", async () => {
  let fetched = 0, saved = false;
  const input = { filters: {}, isCurrent: () => true, onProgress() {}, save: () => { saved = true; }, fetchPhoto: async () => { fetched++; return new Response("x"); } };
  await assert.rejects(exportSmArchivePhotos({ ...input, api: apiFor([]) }), /keine Fotos/);
  await assert.rejects(exportSmArchivePhotos({ ...input, api: apiFor(Array.from({ length: 251 }, (_, index) => photo(String(index), "standard"))) }), /250/);
  assert.equal(fetched, 0); assert.equal(saved, false);
});
test("actual downloaded size is bounded even when stored size metadata is wrong", async () => {
  let saved = false;
  await assert.rejects(exportSmArchivePhotos({ api: apiFor([photo("one", "standard")]), filters: {}, isCurrent: () => true, onProgress() {}, save: () => { saved = true; },
    fetchPhoto: async () => ({ ok: true, arrayBuffer: async () => ({ byteLength: 151 * 1024 * 1024 }) }) as Response }), /150 MB/);
  assert.equal(saved, false);
});
test("account switching while signing or downloading cancels before save", async () => {
  for (const phase of ["sign", "download"]) {
    let current = true, fetched = 0, saved = false;
    const api = apiFor([photo("one", "standard")]), urls = api.urls;
    api.urls = async ids => { if (phase === "sign") current = false; return urls(ids); };
    await assert.rejects(exportSmArchivePhotos({ api, filters: {}, isCurrent: () => current, onProgress() {}, save: () => { saved = true; },
      fetchPhoto: async () => { fetched++; current = false; return new Response("x"); } }), /Zugang/);
    assert.equal(fetched, phase === "sign" ? 0 : 1); assert.equal(saved, false);
  }
});
test("account changes stop subsequent parallel downloads immediately", async () => {
  let current = true, fetched = 0, saved = false;
  await assert.rejects(exportSmArchivePhotos({ api: apiFor(Array.from({ length: 8 }, (_, index) => photo(String(index), "standard"))), filters: {}, isCurrent: () => current, onProgress() {}, save: () => { saved = true; },
    fetchPhoto: async () => { fetched++; current = false; return new Response("x"); } }), /Zugang/);
  assert.equal(fetched, 1); assert.equal(saved, false);
});
test("unsafe and missing filenames cannot escape ZIP directories or overwrite other files", async () => {
  const items = [{ ...photo("one", "standard"), fileName: "../../evil.png", marketName: ".. / \\ ?" }, { ...photo("two", "standard"), fileName: "../../evil.png", marketName: ".. / \\ ?" }, { ...photo("three", "SMDurcharbeit"), fileName: null }];
  let captured: Blob | null = null;
  await exportSmArchivePhotos({ api: apiFor(items), filters: {}, isCurrent: () => true, onProgress() {}, save: blob => { captured = blob; }, fetchPhoto: async () => new Response("photo") });
  const zip = await JSZip.loadAsync(await captured!.arrayBuffer());
  const names = Object.keys(zip.files).filter(name => !zip.files[name]!.dir && name !== "Fotoliste.csv");
  assert.equal(names.length, 3); assert.ok(names.every(name => !name.split("/").includes("..")));
  assert.ok(names.some(name => name.endsWith("three_Foto.png")));
});
