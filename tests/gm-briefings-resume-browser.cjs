// Run only with gm-briefings-resume-server.mts on4037 and the isolated app on3037.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium, webkit } = createRequire(process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  if (process.env[key]) throw Error('Production configuration forbidden');
const front = 'http://127.0.0.1:3037', api = 'http://127.0.0.1:4037';
const output = resolve(process.env.GM_RESUME_TEST_OUTPUT || 'outputs/gm-briefings-resume-synthetic');
mkdirSync(output, { recursive: true });
(async () => {
  const info = await (await fetch(api + '/__synthetic/identity')).json();
  assert.equal(info.synthetic, true);
  const login = await (await fetch(api + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'gm@preview.invalid', password: 'preview' }) })).json();
  assert.equal(login.session.accessToken, 'synthetic-gm');
  const integrity = async () => (await (await fetch(api + '/__synthetic/integrity')).json());
  const results = [];
  for (const [engine, width, height, mode, keyboard] of [
    [chromium, 1024, 1366, 'slow', false],
    [webkit, 1366, 1024, 'slow', false],
    [chromium, 1366, 1024, 'retry', true],
    [webkit, 1024, 1366, 'close-pending', false],
    [chromium, 1024, 1366, 'empty', false],
    [chromium, 1024, 1366, 'reader-error', false],
  ]) {
    if (process.env.GM_RESUME_CASE && mode !== process.env.GM_RESUME_CASE) continue;
    const name = `${engine.name()}-${width}x${height}-${mode}`;
    const browser = await engine.launch({ headless: true, ...(engine === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}) });
    let page;
    try {
      page = await browser.newPage({ viewport: { width, height }, hasTouch: true, ...(engine === webkit ? { isMobile: true } : {}) });
      page.setDefaultTimeout(18000);
      const pageErrors = [], consoleErrors = [], external = [], mutations = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('console', e => { if (e.type() === 'error') consoleErrors.push(e.text()); });
      page.on('request', r => {
        const u = new URL(r.url());
        if (u.pathname.includes('/visit-sessions') && r.method() !== 'GET') mutations.push({ path: u.pathname, method: r.method() });
      });
      await page.context().addInitScript(login => localStorage.setItem('coke_spark_auth_v1', JSON.stringify(login)), login);
      await page.route('**/*', r => {
        const u = new URL(r.request().url());
        if ([front, api].includes(u.origin) || ['blob:', 'data:'].includes(u.protocol)) return r.continue();
        external.push(u.origin); return r.abort();
      });
      let release, requested;
      let released = false;
      let replyWithError = mode === 'reader-error';
      let initialErrors = mode === 'retry';
      const pending = new Promise(r => { release = r; });
      const began = new Promise(r => { requested = r; });
      let calls = 0;
      await page.route(api + '/gm/briefings', async r => {
        calls++; requested();
        if (initialErrors) return r.fulfill({ status: 503, json: { error: 'Synthetische Verbindungsunterbrechung' } });
        if (!released) await pending;
        if (replyWithError) return r.fulfill({ status: 503, json: { error: 'Synthetische Verbindungsunterbrechung' } });
        if (mode === 'empty') return r.fulfill({ status: 200, json: { items: [], unreadCount: 0 } });
        return r.continue();
      });
      await page.goto(front + info.url, { waitUntil: 'domcontentloaded' });
      await page.getByText('Wie viele Displays sind vorhanden?', { exact: true }).first().waitFor();
      await page.getByPlaceholder('0', { exact: true }).fill('7');
      await page.getByRole('button').first().click();
      await page.getByRole('button', { name: 'Später fortsetzen', exact: true }).click();
      await page.waitForURL('**/gm');
      await began;
      const beforeReading = await integrity();
      const mutationsAfterSave = mutations.length;
      const menu = page.locator('[data-gm-briefings-menu]');
      if (keyboard) { await menu.focus(); await page.keyboard.press('Enter'); }
      else await menu.tap();
      const row = page.getByRole('button', { name: /^Wochenschwerpunkte/ });
      if (mode === 'retry') {
        await page.getByRole('button', { name: 'Wochenschwerpunkte · erneut laden', exact: true }).waitFor();
        initialErrors = false;
      }
      assert.equal(await row.getAttribute('aria-disabled'), null, 'loading/retry remains actionable');
      if (keyboard) { await row.focus(); await page.keyboard.press('Enter'); }
      else await row.tap();
      const settleReader = () => page.locator('dialog[open]').evaluate(e => Promise.all(e.getAnimations({subtree:true}).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
      const dialog = page.getByRole('dialog', { name: 'Wochenschwerpunkte', exact: true });
      await dialog.getByRole('status').filter({ hasText: 'werden geladen' }).waitFor();
      await settleReader();
      await page.screenshot({ path: `${output}/${name}-loading.png` });
      if (mode === 'close-pending') {
        await dialog.getByRole('button', { name: 'Zurück zum Home-Menü', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        released = true; release();
        await menu.click();
        await page.getByRole('button', { name: 'Wochenschwerpunkte', exact: true }).waitFor();
        assert.equal(await page.locator('dialog[open]').count(), 0, 'late inbox does not reopen a dismissed reader');
        await page.getByRole('button', { name: 'Wochenschwerpunkte', exact: true }).tap();
      } else { released = true; release(); }
      if (mode === 'reader-error') {
        await dialog.getByRole('alert').waitFor();
        await page.screenshot({path: `${output}/${name}-retry.png`});
        replyWithError = false;
        await dialog.getByRole('button',{name:'Erneut laden',exact:true}).click();
      }
      if (mode === 'empty') {
        await dialog.getByText('Aktuell keine Wochenschwerpunkte verfügbar.', { exact: false }).waitFor();
        assert.equal(await page.locator('dialog canvas').count(), 0);
      } else {
        await page.locator('dialog section:not([inert]) canvas').waitFor({ state: 'visible' });
        await page.getByRole('dialog', { name: 'Wochenfokus – Vorschau', exact: true }).waitFor();
        assert.equal(await page.locator('dialog[open]').count(), 1);
      }
      await settleReader();
      if(mode !== 'empty') await page.locator('dialog section:not([inert]) [class*=pdfLoading]').waitFor({state:'hidden'});
      await page.screenshot({ path: `${output}/${name}-loaded.png` });
      await page.getByRole('button', { name: 'Zurück zum Home-Menü', exact: true }).click();
      await page.locator('dialog[open]').waitFor({ state: 'hidden' });
      assert.equal(await menu.count(), 1, 'navigation identity remains intact');
      if (mode !== 'empty') {
        await menu.tap(); await page.getByRole('button', { name: 'Wochenschwerpunkte', exact: true }).tap();
        await page.locator('dialog section:not([inert]) canvas').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Zurück zum Home-Menü', exact: true }).click();
        await page.locator('dialog[open]').waitFor({ state: 'hidden' });
      }
      assert.equal(mutations.length, mutationsAfterSave, 'reading/retry/closing never cancels, submits or edits the visit');
      const afterReading = await integrity();
      assert.equal(afterReading.digest, beforeReading.digest, 'all answers and photo references unchanged by briefing access');
      await page.getByRole('button', { name: 'Zum Fragebogen', exact: true }).click();
      await page.waitForURL('**/gm/marktbesuch?**');
      await page.getByText('Wie viele Displays sind vorhanden?', { exact: true }).first().waitFor();
      assert.equal(Number(await page.getByPlaceholder('0', { exact: true }).inputValue()), 7);
      assert.equal(new URL(page.url()).searchParams.get('sessionId'), info.sessionId);
      assert.equal((await integrity()).sessions.find(s => s.id === info.sessionId).status, 'draft');
      assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
      assert.ok(!consoleErrors.some(s => /same key|unique.*key|two children/.test(s)), 'no duplicate reconciliation keys');
      results.push({ name, passed: true, unchangedAnswersAndPhotos: true, sameDraftResumed: true, briefingRequests: calls, pageErrors, external, consoleErrors });
      writeFileSync(`${output}/synthetic-e2e.json`, JSON.stringify({synthetic:true,results},null,2));
      console.log('PASS', name);
    } catch (e) {
      if (page) { await page.screenshot({path: `${output}/${name}-failure.png`}); writeFileSync(`${output}/${name}-failure.html`, await page.locator('body').innerHTML()); console.error((await page.locator('body').innerText()).slice(-1300)); }
      throw e;
    } finally { await browser.close(); }
  }
  writeFileSync(`${output}/synthetic-e2e.json`, JSON.stringify({ synthetic: true, results }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
