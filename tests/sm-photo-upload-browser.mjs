import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const front = "http://127.0.0.1:3038", api = "http://127.0.0.1:4038";
const artifacts = process.env.SM_PHOTO_ARTIFACT_DIR ?? "/tmp/coke-sm-photo-recovery-artifacts";
await mkdir(artifacts, { recursive: true });
const state = async () => (await fetch(`${api}/__fixture/state`)).json();
const before = await state();
assert.equal(before.status, "draft", "Start this test with a fresh disposable fixture");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: "Europe/Vienna" });
const page = await context.newPage();
const errors = []; page.on("pageerror", error => errors.push(error.message));
let policy = "normal", transfers = new Map(), partialPaths = [], writes = [];
let holdRefresh = false, heldRefreshes = [];
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (!["http://127.0.0.1:3038", "http://127.0.0.1:4038"].includes(url.origin)) { await route.abort(); return; }
  if (request.method() === "DELETE") writes.push(request.url());
  if (holdRefresh && request.method() === "GET" && url.pathname === `/sm/smdurcharbeit/visits/${before.visitId}`
    && [...transfers.values()].reduce((sum, count) => sum + count, 0) >= 3) {
    await new Promise(resolve => heldRefreshes.push(resolve));
  }
  if (url.pathname === "/synthetic-photo-storage/upload" && request.method() === "PUT") {
    const key = url.searchParams.get("path"), count = (transfers.get(key) ?? 0) + 1; transfers.set(key, count);
    if (policy === "retry" && count < 3 || policy === "fail") { await route.abort("failed"); return; }
    if (policy === "partial") {
      if (!partialPaths.includes(key)) partialPaths.push(key);
      if (partialPaths.indexOf(key) === 1) { await route.abort("failed"); return; }
    }
    if (policy === "lost-response" && count === 1) { await route.fetch(); await route.abort("failed"); return; }
  }
  await route.continue();
});
async function until(check, label) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
async function select(files) {
  await page.getByRole("button", { name: "Weiteres Foto hinzufügen" }).click();
  await page.locator('input[type=file][multiple]').setInputFiles(files);
}
try {
  await page.goto(front);
  await page.locator("#cs-email").fill("sm@preview.test");
  await page.locator("#cs-pass").fill("preview");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/sm");
  await page.goto(`${front}/sm/durcharbeit-besuch?visitId=${before.visitId}&questionId=${before.photoQuestionId}`);
  await page.getByRole("heading", { name: "Fotos der Platzierung" }).waitFor();
  const jpeg = Buffer.from(await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 3200; c.height = 2400;
    const x = c.getContext("2d"), image = x.createImageData(c.width, c.height);
    let seed = 42;
    for (let i = 0; i < image.data.length; i += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; image.data[i] = seed & 255; image.data[i+1] = seed >>> 8 & 255; image.data[i+2] = seed >>> 16 & 255; image.data[i+3] = 255; }
    x.putImageData(image, 0, 0); return c.toDataURL("image/jpeg", .98).split(",")[1];
  }), "base64");
  assert.ok(jpeg.length > 2 * 1024 * 1024);
  policy = "retry"; transfers = new Map();
  await select({ name: "synthetic-large-shelf.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await until(async () => (await state()).photos.length === 2, "automatic retry commits new photo");
  await until(() => page.getByRole("button", { name: "Weiteres Foto hinzufügen" }).isEnabled(), "uploader ready");
  assert.deepEqual([...transfers.values()], [3]);
  const resized = (await state()).photos.find(photo => photo.id !== before.oldPhotoId);
  assert.ok(resized.byteSize < jpeg.length, "Only the newly selected large JPEG is optimized");
  console.log(JSON.stringify({ scenario: "automatic retry and image preparation", originalBytes: jpeg.length, uploadedBytes: resized.byteSize, transferAttempts: 3 }));

  policy = "partial"; transfers = new Map(); partialPaths = [];
  await select(["first.png", "second.png"].map(name => ({ name, mimeType: "image/png", buffer: png })));
  await page.getByText("1 Foto wartet", { exact: true }).waitFor();
  assert.equal((await state()).photos.length, 3, "First file is already durably committed despite second failing");
  await page.screenshot({ path: `${artifacts}/phone-recovery.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  policy = "normal";
  await page.getByRole("button", { name: "Erneut versuchen", exact: true }).click();
  await until(async () => (await state()).photos.length === 4, "retained failed file retries without reselection");
  await until(() => page.getByRole("button", { name: "Weiteres Foto hinzufügen" }).isEnabled(), "retry finished");
  assert.equal(transfers.get(partialPaths[0]), 1, "Already saved file is never uploaded again");
  assert.equal(transfers.get(partialPaths[1]), 4);
  await page.getByText("1 Foto wartet", { exact: true }).waitFor({ state: "hidden" });
  console.log("PASS partial batch preservation and retained-file recovery");

  policy = "lost-response"; transfers = new Map();
  await select({ name: "lost-response.png", mimeType: "image/png", buffer: png });
  await until(async () => (await state()).photos.length === 5, "lost successful transfer reconciles duplicate");
  await until(() => page.getByRole("button", { name: "Weiteres Foto hinzufügen" }).isEnabled(), "lost response recovery finished");
  assert.deepEqual([...transfers.values()], [2]);
  console.log("PASS lost response commits once without duplicate photo records");

  policy = "fail"; transfers = new Map();
  holdRefresh = true;
  await select({ name: "reconnect.png", mimeType: "image/png", buffer: png });
  await page.getByText("1 Foto wartet", { exact: true }).waitFor();
  policy = "normal";
  await until(() => heldRefreshes.length > 0, "failed queue still refreshing when connection returns");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  holdRefresh = false; heldRefreshes.splice(0).forEach(resolve => resolve());
  await until(async () => (await state()).photos.length === 6, "reconnection automatically retries retained file");
  await until(() => page.getByRole("button", { name: "Weiteres Foto hinzufügen" }).isEnabled(), "reconnection recovery finished");
  console.log("PASS automatic recovery on reconnection");

  policy = "fail"; transfers = new Map();
  await select({ name: "not-sent.png", mimeType: "image/png", buffer: png });
  await page.getByText("1 Foto wartet", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Nur gespeicherte behalten", exact: true }).click();
  await page.getByText("1 Foto wartet", { exact: true }).waitFor({ state: "hidden" });
  assert.equal((await state()).photos.length, 6);
  assert.deepEqual(writes, [], "Retrying/dismissing failures never sends any photo deletion");
  assert.doesNotMatch(await page.locator("body").innerText(), /Failed to fetch/);
  await page.screenshot({ path: `${artifacts}/phone-recovered.png`, fullPage: true });
  await select(Array.from({ length: 21 }, (_, index) => ({ name: `too-many-${index}.png`, mimeType: "image/png", buffer: png })));
  await page.getByText("Pro Foto-Frage sind maximal 20 Fotos erlaubt.", { exact: true }).waitFor();
  // A stale local error with no outstanding transfer cannot strand valid server-saved photos.
  await page.getByRole("button", { name: "Zur Übersicht", exact: true }).click();
  await page.getByLabel("Startzeit des Marktbesuchs", { exact: true }).fill("12:00");
  await page.getByLabel("Endezeit des Marktbesuchs", { exact: true }).fill("12:30");
  await page.getByRole("button", { name: "Marktbesuch abschließen", exact: true }).click();
  await page.getByRole("heading", { name: "Marktbesuch abgeschlossen", exact: true }).waitFor();
  const after = await state();
  assert.equal(after.visitId, before.visitId); assert.equal(after.submissionId, before.submissionId);
  assert.equal(after.status, "submitted"); assert.equal(after.visits, 2);
  assert.equal(after.textUnchanged, true); assert.equal(after.historyUnchanged, true);
  assert.ok(after.photos.some(photo => photo.id === before.oldPhotoId));
  const originalBytes = Buffer.from(await (await fetch(`${api}/synthetic-photo-storage/object?path=${encodeURIComponent(before.oldPhotoPath)}`)).arrayBuffer());
  assert.equal(createHash("sha256").update(originalBytes).digest("hex"), before.oldPhotoHash);
  await page.screenshot({ path: `${artifacts}/phone-completed.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ scenario: "same visit completed", sameVisitAndSubmission: true, historicalGraphUnchanged: true, originalPhotoHashUnchanged: true, preexistingAnswersUnchanged: true, photos: after.photos.length, browserErrors: errors }));
} finally { await browser.close(); }
