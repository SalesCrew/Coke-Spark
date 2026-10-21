import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium, webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const front = 'http://127.0.0.1:3037', api = 'http://127.0.0.1:4037';
const output = process.env.PDF_TEST_OUTPUT || '/tmp/coke-gm-pdf-recovery-20261021';
await mkdir(output, { recursive: true });

// Only the disposable gm-briefing-preview.ts service is allowed. No app env files.
if (process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Production configuration is forbidden');
const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'gm@preview.invalid', password: 'preview' }) }).then(r => r.json());
assert.equal(login.session.accessToken, 'synthetic-gm', 'requires the isolated synthetic service');

for (const [engine, device, fault] of [
  [webkit, 'iPad (gen 7)', 'none'],
  [webkit, 'iPad (gen 7)', 'large'],
  [webkit, 'iPad (gen 7)', 'always'],
  [webkit, 'iPad (gen 7)', 'text'],
  [webkit, 'iPad (gen 7)', 'download'],
  [webkit, 'iPhone 13', 'none'],
  [chromium, 'iPad (gen 7)', 'large'],
]) {
  const scenario = await fetch(`${api}/__synthetic/scenario`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newVersion: true }) });
  assert.equal(scenario.status, 200);
  const browser = await engine.launch({ headless: true });
  const options = { ...devices[device] }; delete options.defaultBrowserType;
  if (engine === chromium) delete options.isMobile;
  const context = await browser.newContext(options);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && [3037, 4037].includes(+url.port) ? route.continue() : route.abort();
  });
  await context.addInitScript(({ login, fault }) => {
    localStorage.setItem('coke_spark_auth_v1', JSON.stringify(login));
    window.__pdfFault = fault;
    window.__pdfCanvases = new Set();
    window.__pdfFailures = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      if (this.getAttribute('aria-label')?.startsWith('PDF-Seite')) {
        window.__pdfCanvases.add(this);
        if (window.__pdfFault === 'always' || (window.__pdfFault === 'large' && this.width * this.height > 750_000)) {
          window.__pdfFailures.push({ width: this.width, height: this.height });
          throw new DOMException('Synthetic canvas memory allocation failure', 'InvalidStateError');
        }
      }
      return getContext.apply(this, args);
    };
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, ...rest) {
      if (window.__pdfFault === 'text' && message?.action === 'GetTextContent')
        throw new Error('Synthetic text extraction failure');
      return post.call(this, message, ...rest);
    };
  }, { login, fault });
  const page = await context.newPage();
  const pageErrors = [], receipts = [], files = [], telemetry = [], nativeRequests = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  context.on('request', request => {
    if (/\/gm\/briefings\/[^/]+\/read$/.test(request.url()) && request.method() === 'POST') receipts.push(request.postDataJSON());
    if (/\/gm\/briefings\/[^/]+\/file$/.test(request.url()) && request.method() === 'GET') files.push(request.url());
    if (request.url().endsWith('/telemetry/events') && request.method() === 'POST') telemetry.push(request.postDataJSON());
    if (request.url().includes('/synthetic-pdf/') && request.resourceType() === 'document') nativeRequests.push(request.url());
  });
  if (fault === 'download') await page.route('**/synthetic-pdf/**', route => route.fulfill({ status: 503, body: 'Synthetic download failure' }));
  const label = `${engine.name()}-${device.replace(/[^a-z0-9]/gi, '-')}-${fault}`;
  try {
    await page.goto(`${front}/gm`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-gm-briefings-menu]').focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Wochenschwerpunkte', exact: true }).focus(); await page.keyboard.press('Enter');
    const visibleCanvas = page.locator('dialog section:not([inert]) canvas');
    if (['always', 'download'].includes(fault)) {
      await page.getByRole('button', { name: 'PDF öffnen', exact: true }).waitFor();
      await page.waitForTimeout(1200);
      assert.equal(receipts.length, 0, 'failed rendering never acknowledges a page');
      if (fault === 'always') {
        assert.equal(await page.evaluate(() => window.__pdfFailures.length), 2, 'exactly one automatic retry');
        assert.ok(telemetry.some(e => e.event === 'gm_briefing_pdf_error' && e.details.errorCode === 'memory_limit'));
      }
      await page.screenshot({ path: `${output}/${label}.png` });
      const popupEvent = context.waitForEvent('page');
      await page.getByRole('button', { name: 'PDF öffnen', exact: true }).click();
      const popup = await popupEvent;
      for (let i = 0; i < 40 && !nativeRequests.length; i++) await page.waitForTimeout(100);
      assert.ok(files.length >= 2, 'fallback renews the authorized file URL');
      assert.equal(nativeRequests.length, 1, 'fallback opens the original PDF outside the custom renderer');
      assert.equal(receipts.length, 0, 'opening an original file does not mark unread pages read');
      await popup.close();
      if (fault === 'download') await page.unroute('**/synthetic-pdf/**');
      await page.evaluate(() => { window.__pdfFault = 'none'; });
      await page.getByRole('button', { name: 'Erneut laden', exact: true }).click();
    }
    await visibleCanvas.waitFor();
    await page.waitForFunction(() => document.querySelector('dialog section:not([inert]) canvas')?.style.opacity === '1');
    assert.equal(await page.locator('dialog canvas').count(), 1, 'only the visible page owns a canvas');
    const bitmap = await visibleCanvas.evaluate(c => ({ width: c.width, height: c.height }));
    assert.ok(bitmap.width * bitmap.height <= 2_500_000);
    if (fault === 'large') {
      assert.equal(await page.evaluate(() => window.__pdfFailures.length), 1, 'one failed large bitmap recovers automatically');
      assert.ok(bitmap.width * bitmap.height <= 750_000);
    }
    if (fault === 'text') {
      await page.waitForFunction(() => document.querySelector('dialog section:not([inert]) canvas')?.style.opacity === '1');
      assert.equal(await page.locator('dialog').getByRole('alert').count(), 0, 'text failure cannot hide a rendered page');
      assert.ok(telemetry.some(e => e.event === 'gm_briefing_pdf_error' && e.details.stage === 'text'), 'text error was actually exercised');
    }
    await page.waitForTimeout(1200);
    assert.ok(receipts.some(r => r.pageNumber === 1), 'successful visible render acknowledges page 1');
    assert.ok(receipts.every(r => r.pageNumber === 1), 'unvisited pages remain unread');
    await page.screenshot({ path: `${output}/${label}-recovered.png` });
    await page.getByRole('button', { name: 'Nächste Seite', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog section:not([inert]) canvas')?.getAttribute('aria-label') === 'PDF-Seite 2' && document.querySelector('dialog section:not([inert]) canvas')?.style.opacity === '1');
    assert.ok(await page.evaluate(() => [...window.__pdfCanvases].filter(c => !c.isConnected).every(c => c.width === 0 && c.height === 0)), 'leaving a page releases its bitmap');
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.waitForFunction(() => document.querySelector('dialog section:not([inert]) canvas')?.style.opacity === '1');
    await page.keyboard.press('Escape');
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.ok(await page.evaluate(() => [...window.__pdfCanvases].every(c => c.width === 0 && c.height === 0)), 'closing releases all page canvases');
    assert.deepEqual(pageErrors, []);
    assert.ok(!JSON.stringify(telemetry.filter(e => e.event === 'gm_briefing_pdf_error')).includes('synthetic-pdf/'), 'diagnostics contain no file URL');
    console.log(`PASS ${label}: bounded rendering, recovery, original-file access, read receipts and cleanup`);
  } catch (error) {
    await page.screenshot({ path: `${output}/${label}-failed.png` });
    console.error(JSON.stringify({ label, telemetry, pageErrors, canvasFailures: await page.evaluate(() => window.__pdfFailures) }));
    throw error;
  } finally { await browser.close(); }
}
