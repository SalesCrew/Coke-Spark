// Run only against backend/tests/gm-action-briefing-preview.ts and its isolated frontend.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const web = process.env.ACTION_BRIEFING_WEB_ORIGIN ?? "http://127.0.0.1:3038",
  api = process.env.ACTION_BRIEFING_API_ORIGIN ?? "http://127.0.0.1:4038";
for (const origin of [web, api]) {
  const url = new URL(origin);
  assert.equal(url.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.ok(url.port && !["3000", "4000"].includes(url.port), "Use an independent synthetic preview");
}
const identity = await fetch(`${api}/__synthetic/identity`).then((r) =>
  r.json(),
);
assert.equal(identity.synthetic, true);
assert.equal(identity.feature, "gm-action-briefings");
const require = createRequire(
  process.env.PLAYWRIGHT_MODULE_ROOT ??
    `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`,
);
const engines = require("playwright");
const engine = process.env.BROWSER_ENGINE === "webkit" ? "webkit" : "chromium";
const browser = await engines[engine].launch({
  headless: true,
  args:
    engine === "chromium"
      ? [
          "--use-gl=angle",
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
        ]
      : [],
});
const artifacts = process.env.ACTION_BRIEFING_ARTIFACT_DIR ?? await mkdtemp(path.join(tmpdir(), "coke-action-briefings-"));
await (await import("node:fs/promises")).mkdir(artifacts, { recursive: true });
const errors = [],
  external = [];
const name = `Aktionsbriefing · Prüfung ${Date.now()}`;
async function inbox(token = "gm") {
  return fetch(`${api}/gm/action-briefings`, {
    headers: { Authorization: `Bearer synthetic-${token}` },
  }).then((r) => r.json());
}
async function until(fn) {
  for (let n = 0; n < 60; n++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.fail("Expected condition did not settle");
}
async function login(viewport, email) {
  const ctx = await browser.newContext({
    viewport,
    timezoneId: "Europe/Vienna",
  });
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      [web, api].includes(url.origin) ||
      ["data:", "blob:"].includes(url.protocol)
    )
      return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(web);
  await page.locator("input[type=email]").fill(`${email}@preview.invalid`);
  await page.locator("input[type=password]").fill("synthetic");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(
    email.startsWith("gm") ? "**/gm" : "**/admin/fragebogen",
  );
  return page;
}
async function openPanel(page) {
  const menu = page.locator("[data-gm-briefings-menu]");
  await menu.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Aktionsbriefings", exact: true })
    .click();
  await page.waitForTimeout(550); // Existing menu slide animation.
  return page.locator("[data-gm-action-briefings-panel]");
}
try {
  const admin = await login({ width: 1440, height: 1000 }, "admin");
  await admin.locator('a[href="/admin/aktionsbriefings"]').click();
  await admin
    .getByRole("heading", { name: "Aktionsbriefings", exact: true })
    .waitFor();
  await admin
    .locator("input[type=file]")
    .setInputFiles("/tmp/coke-action-briefing-synthetic.pdf");
  await admin.getByLabel("Name", { exact: true }).fill(name);
  assert(
    await admin
      .getByRole("button", { name: "Veröffentlichen", exact: true })
      .isDisabled(),
  );
  await admin.getByRole("button", { name: "Heute", exact: true }).click();
  await admin
    .getByRole("button", { name: "Sichtbar bis einschließlich", exact: true })
    .click();
  const end = new Date(`${identity.today}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const dateLabel = new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Vienna",
  }).format(end);
  await admin
    .getByRole("dialog", { name: "Sichtbar bis einschließlich auswählen" })
    .getByRole("button", { name: dateLabel, exact: true })
    .click();
  assert(await admin.getByRole("button", { name: "Veröffentlichen", exact: true }).isDisabled());
  const actionStart = new Date(identity.today + "T12:00:00Z");
  actionStart.setUTCDate(actionStart.getUTCDate() + 7);
  const actionEnd = new Date(actionStart);
  actionEnd.setUTCDate(actionEnd.getUTCDate() + 7);
  async function chooseDate(label, value) {
    await admin.getByRole("button", { name: label, exact: true }).click();
    const dialog = admin.getByRole("dialog", { name: label + " auswählen" });
    const name = new Intl.DateTimeFormat("de-AT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Vienna",
    }).format(value);
    for (let count = 0; count < 4; count++) {
      const day = dialog.getByRole("button", { name, exact: true });
      if (await day.count() && await day.isEnabled()) {
        await day.click();
        return;
      }
      await dialog.getByRole("button", { name: "Nächster Monat", exact: true }).click();
    }
    assert.fail("Action date not found in custom calendar");
  }
  await chooseDate("Aktionsbeginn", actionStart);
  await chooseDate("Aktionsende einschließlich", actionEnd);
  await admin.locator("canvas").first().waitFor();
  await admin.screenshot({ path: path.join(artifacts, "admin-editor.png") });
  await admin
    .getByRole("button", { name: "Veröffentlichen", exact: true })
    .click();
  await admin
    .getByRole("dialog", { name: "Für GMs veröffentlichen?" })
    .getByRole("button", { name: "Veröffentlichen", exact: true })
    .click();
  await until(async () =>
    (await inbox()).items.some((item) => item.title === name),
  );
  const published = (await inbox()).items.find(item => item.title === name);
  assert.equal(published.visibleFrom, identity.today);
  assert.equal(published.actionFrom, actionStart.toISOString().slice(0, 10));
  assert.equal(published.actionUntil, actionEnd.toISOString().slice(0, 10));
  console.log(
    "PASS admin: upload → name → independent visibility/action dates → PDF preview → publish",
  );
  const gm = await login({ width: 1024, height: 768 }, "gm");
  let panel = await openPanel(gm);
  await panel.getByRole("heading", { name, exact: true }).waitFor();
  assert((await panel.locator("article").count()) >= 3);
  assert.equal(
    await panel.getByText("Vorschau · Neujahrsaktion", { exact: true }).count(),
    0,
  );
  await gm.screenshot({ path: path.join(artifacts, "gm-menu.png") });
  const open = panel.getByRole("button", {
    name: `${name} öffnen`,
    exact: true,
  });
  await open.click();
  await gm.locator("dialog[open] canvas").first().waitFor();
  await until(async () =>
    (await inbox()).items.find((i) => i.title === name)?.seenPages.includes(1),
  );
  await gm.screenshot({ path: path.join(artifacts, "gm-pdf.png") });
  await gm.getByRole("button", { name: "Nächste Seite", exact: true }).click();
  await until(
    async () => (await inbox()).items.find((i) => i.title === name)?.readAt,
  );
  assert.equal(
    (await inbox("gm2")).items.find((i) => i.title === name).readAt,
    null,
  );
  await gm
    .getByRole("button", { name: "Zurück zum Home-Menü", exact: true })
    .click();
  await gm.locator("dialog[open]").waitFor({ state: "detached" });
  await until(() =>
    open.evaluate((button) => document.activeElement === button),
  );
  await gm.setViewportSize({ width: 768, height: 1024 });
  await gm.screenshot({ path: path.join(artifacts, "gm-menu-portrait.png") });
  const gm2 = await login({ width: 1024, height: 768 }, "gm2");
  const panel2 = await openPanel(gm2);
  await panel2.getByRole("heading", { name, exact: true }).waitFor();
  assert.equal(
    await panel2
      .locator("article")
      .filter({ hasText: name })
      .getByText("Neu", { exact: true })
      .count(),
    1,
  );
  console.log(
    "PASS GM: overlapping global briefings; future hidden; PDF pages readable; independent receipts; return focus; landscape + portrait",
  );
  await admin.getByRole("button", { name: "Archivieren", exact: true }).click();
  await admin
    .getByRole("dialog", { name: "Dokument archivieren?" })
    .getByRole("button", { name: "Archivieren", exact: true })
    .click();
  await until(async () => !(await inbox()).items.some((i) => i.title === name));
  await gm.evaluate(() => window.dispatchEvent(new Event("focus")));
  await panel
    .getByRole("heading", { name, exact: true })
    .waitFor({ state: "detached" });
  await admin
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  await admin
    .getByRole("dialog", { name: "Dokument wiederherstellen?" })
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  await until(
    async () => (await inbox()).items.find((i) => i.title === name)?.readAt,
  );
  console.log(
    "PASS archive/restore: worker visibility updates; same publication and read state retained",
  );
  await gm.route(`${api}/gm/action-briefings`, (route) =>
    route.fulfill({ status: 503, json: { error: "Synthetic failure" } }),
  );
  await gm.evaluate(() => window.dispatchEvent(new Event("focus")));
  await panel
    .getByRole("button", { name: "Erneut laden", exact: true })
    .waitFor();
  await gm.unroute(`${api}/gm/action-briefings`);
  await panel
    .getByRole("button", { name: "Erneut laden", exact: true })
    .click();
  await panel.getByRole("heading", { name, exact: true }).waitFor();
  await gm.route(`${api}/gm/action-briefings`, (route) =>
    route.fulfill({ json: { items: [], unreadCount: 0 } }),
  );
  await gm.evaluate(() => window.dispatchEvent(new Event("focus")));
  await panel
    .getByText("Aktuell keine Aktionsbriefings.", { exact: true })
    .waitFor();
  await gm.unroute(`${api}/gm/action-briefings`);
  await gm.evaluate(() => window.dispatchEvent(new Event("focus")));
  await panel.getByRole("heading", { name, exact: true }).waitFor();
  await panel
    .getByRole("button", { name: "Zurück zum GM-Menü", exact: true })
    .click();
  await gm
    .getByRole("button", { name: "Wochenschwerpunkte", exact: true })
    .click();
  await gm.locator("dialog[open] canvas").first().waitFor();
  assert(
    (await gm.locator("dialog[open]").innerText()).includes(
      "Wochenschwerpunkte",
    ),
  );
  console.log(
    "PASS states: retry recovers, empty list stays usable, existing WSP reader still works",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    path.join(artifacts, "result.json"),
    JSON.stringify({ passed: true, errors, external }, null, 2),
  );
  console.log(`Artifacts: ${artifacts}`);
} finally {
  await browser.close();
}
