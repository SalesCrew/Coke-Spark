const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtime = createRequire(path.join(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'));
const { chromium } = runtime('playwright');
const XLSX = require('xlsx-js-style');
const output = process.env.SM_EXPORT_EVIDENCE_DIR || '/tmp/coke-sm-da-header-export-20261124';
const origin = 'http://127.0.0.1:3037', api = 'http://127.0.0.1:4037';

(async () => {
  assert.equal((await (await fetch(`${api}/__synthetic/identity`)).json()).synthetic, true);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const external = [], errors = [], failures = [], checks = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ([origin, api].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    external.push(url.origin); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
  const dialog = page.getByRole('dialog', { name: 'Durcharbeit exportieren', exact: true });
  const header = page.getByRole('button', { name: 'Excel Export', exact: true });
  const count = async expected => {
    await page.waitForFunction(value => {
      const d = document.querySelector('dialog[open]');
      const stat = [...(d?.querySelectorAll('strong') || [])];
      return stat.length === 3 && stat[2].textContent === String(value);
    }, expected);
  };
  try {
    await page.goto(`${origin}/dev/sm-da-export-preview`);
    await page.waitForURL('**/admin/sm/durcharbeit-verplanung');
    await header.waitFor();
    await page.screenshot({ path: path.join(output, 'planning-header.png') });
    await page.getByText('Monatsauswertung', { exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Antworten exportieren', exact: true }).count(), 0);
    checks.push('Same header export entry; old monthly export absent; statistics retained');
    await header.click(); await count(3);
    await page.screenshot({ path: path.join(output, 'export-dialog.png') });
    for (const size of [{ width: 1280, height: 800 }, { width: 760, height: 800 }]) {
      await page.setViewportSize(size);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= size.width && bounds.y + bounds.height <= size.height);
      await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).scrollIntoViewIfNeeded();
      assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth), false);
      await page.screenshot({ path: path.join(output, `export-${size.width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await dialog.getByRole('button', { name: 'Monat', exact: true }).click();
    await dialog.getByRole('button', { name: 'Kalendermonat für Export', exact: true }).click();
    await page.getByRole('listbox').getByRole('option', { name: 'Oktober 2026' }).click(); await count(3);
    await dialog.getByRole('button', { name: 'Woche', exact: true }).click();
    await dialog.getByRole('button', { name: 'Kalenderwoche für Export', exact: true }).press('ArrowDown');
    await page.getByRole('listbox').getByRole('option').first().click(); await count(3);
    await dialog.getByRole('button', { name: 'Zeitraum', exact: true }).click();
    await dialog.getByRole('button', { name: 'Export von', exact: true }).click();
    const calendar = page.getByRole('dialog', { name: 'Export von auswählen', exact: true });
    await calendar.getByRole('button', { name: /21\. Oktober 2026/ }).click(); await count(2);
    await dialog.getByRole('checkbox', { name: 'Local SM', exact: true }).check(); await count(1);
    checks.push('Shared week/month/date controls work inside the modal; Vienna day and author filters combine');
    await dialog.getByRole('checkbox', { name: 'West', exact: true }).check(); await count(0);
    assert.equal(await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).isDisabled(), true);
    assert.match(await dialog.innerText(), /keine abgeschlossenen Besuche/);
    checks.push('Empty intersection stays empty and disables download');
    await dialog.getByRole('button', { name: 'Filter zurücksetzen', exact: true }).click(); await count(3);
    await dialog.getByRole('button', { name: 'Status der Durcharbeiten im Export', exact: true }).click();
    await page.getByRole('option', { name: 'Archivierte Durcharbeiten', exact: true }).click(); await count(1);
    await dialog.getByRole('checkbox', { name: 'Second SM', exact: true }).check(); await count(1);
    checks.push('Archived Durcharbeit and inactive historical SM remain exportable');
    await dialog.getByRole('button', { name: 'Filter zurücksetzen', exact: true }).click(); await count(3);
    for (const name of ['SPAR DA Tour 1 · Vorschau', 'Weitere Tour · unverändert']) await dialog.getByRole('checkbox', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check();
    await count(3);
    await dialog.getByRole('checkbox', { name: 'Ost', exact: true }).check(); await count(2);
    await dialog.getByRole('checkbox', { name: 'Spar', exact: true }).check(); await count(2);
    const reportUrl = '**/admin/sm-smdurcharbeit-campaigns/export/report?*';
    await page.route(reportUrl, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetischer Exportfehler' }) }), { times: 1 });
    await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.match(await dialog.getByRole('alert').innerText(), /Synthetischer Exportfehler/);
    assert.equal(await dialog.getByRole('checkbox', { name: 'Spar', exact: true }).isChecked(), true);
    await dialog.getByRole('button', { name: 'Erneut versuchen', exact: true }).click(); await count(2);
    await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).waitFor({ state: 'visible' });
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).click();
    const download = await downloaded, file = path.join(output, 'filtered.xlsx'); await download.saveAs(file);
    const book = XLSX.readFile(file), rows = XLSX.utils.sheet_to_json(book.Sheets['Einsätze'], { header: 1, defval: '' });
    assert.deepEqual(book.SheetNames, ['Einsätze']); assert.equal(rows.length, 4);
    assert.deepEqual(rows[0].slice(0, 5), ['Zielobjekt', 'Stammnr.', 'Besuchsdatum', 'Besuchsstartzeit', 'Einsatz']);
    assert.equal(rows[1][4], 'Verplanung'); assert.equal(rows[1][23], 'Kommentar');
    assert.ok(rows.slice(2).every(row => row[7] === 'Local SM' && row[8] === 1));
    assert.ok(!rows[0].some(value => String(value).endsWith(' (2)')));
    await dialog.waitFor({ state: 'detached' });
    checks.push('Visible server error retains filters; retry downloads real XLSX with exact GM two-row header, both visits and original/inherited photos');
    await header.click(); await count(3);
    let delayed = false;
    await page.route('**/admin/sm-smdurcharbeit-campaigns/export/preview?*', async route => {
      const response = await route.fetch(); delayed = true;
      await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ response });
    }, { times: 1 });
    await dialog.getByRole('checkbox', { name: 'West', exact: true }).check();
    await page.waitForTimeout(230);
    assert.equal(delayed, true);
    await dialog.getByRole('checkbox', { name: 'West', exact: true }).uncheck(); await count(3);
    await page.waitForTimeout(1300); await count(3);
    checks.push('Late preview response cannot overwrite a newer selection');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await header.evaluate(node => document.activeElement === node), true);
    checks.push('Escape closes modal and restores focus to header button');
    await header.click(); await count(3);
    let downloadsAfterSwitch = 0; page.on('download', () => downloadsAfterSwitch++);
    let principalChanged = false, reportReady;
    const reportStarted = new Promise(resolve => { reportReady = resolve; });
    await page.route(reportUrl, async route => {
      try { const response = await route.fetch(); reportReady(); await new Promise(resolve => setTimeout(resolve, 1000)); await route.fulfill({ response }); }
      catch (error) { if (!principalChanged) throw error; }
    }, { times: 1 });
    await dialog.getByRole('button', { name: 'Excel exportieren', exact: true }).click();
    await reportStarted; principalChanged = true;
    await page.evaluate(() => {
      const activePointer = JSON.parse(localStorage.getItem('auth_active_v2') || sessionStorage.getItem('auth_active_v2'));
      const storage = activePointer.target === 'local' ? localStorage : sessionStorage;
      const oldKey = activePointer.sessionKey, record = JSON.parse(storage.getItem(oldKey));
      record.role = record.payload.user.role = 'admin'; record.payload.session.accessToken = 'synthetic-admin';
      const key = `auth_session_v2:${record.userId}:admin`;
      storage.removeItem(oldKey); storage.setItem(key, JSON.stringify(record));
      const pointer = { ...activePointer, sessionKey: key, role: 'admin', updatedAtMs: Date.now() };
      localStorage.setItem('auth_active_v2', JSON.stringify(pointer)); sessionStorage.setItem('auth_active_v2', JSON.stringify(pointer));
      window.dispatchEvent(new CustomEvent('coke_spark:auth-changed', { detail: { reason: 'identity-switch', at: Date.now() } }));
    });
    await page.waitForTimeout(1300); assert.equal(downloadsAfterSwitch, 0); assert.equal(await page.locator('dialog[open]').count(), 0);
    checks.push('Authenticated principal/role switch cancels pending export and clears owner-scoped modal');
    const requestLog = await (await fetch(`${api}/__synthetic/requests`)).json();
    const shellPreferences = requestLog.requests.filter(row => row.method === 'PUT' && row.path === '/admin/kurti/layout');
    const mutations = requestLog.requests.filter(row => !['GET', 'OPTIONS'].includes(row.method) && row.path !== '/telemetry/events' && !(row.method === 'PUT' && row.path === '/admin/kurti/layout'));
    assert.deepEqual(mutations, []); assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(failures.every(row => row.status === 503 && row.url.includes('/export/report')));
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ checks, failuresExpected: failures, errors, external, businessMutations: mutations, inMemoryShellPreferences: shellPreferences.length, download: download.suggestedFilename() }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
