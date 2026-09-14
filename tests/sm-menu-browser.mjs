import assert from 'node:assert/strict';

const ws = new WebSocket(process.argv[2]);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let id = 0, sessionId;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const result = JSON.parse(data);
  const call = pending.get(result.id);
  if (call) { pending.delete(result.id); result.error ? call.reject(new Error(result.error.message)) : call.resolve(result.result); }
});
function send(method, params = {}, session = sessionId) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function state() { return evaluate(`(() => { const menu = document.querySelector('.gm-menu-scrollbars-hidden'); const rect = menu.getBoundingClientRect(); return { height: parseFloat(menu.style.height), x: rect.x + rect.width / 2, y: rect.y, page: document.querySelector('[data-testid="current-page"]').textContent, count: Number(document.querySelector('[data-testid="navigation-count"]').textContent.split(': ')[1]) }; })()`); }
async function touch(type, x, y) { await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] }); }
async function tap(x, y) { await touch('touchStart', x, y); await delay(55); await touch('touchEnd'); await delay(580); }
try {
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find(target => target.type === 'page' && target.url.startsWith('http://localhost:3000/dev/sm-menu'));
  assert.ok(page, 'local no-data menu preview exists');
  ({ sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true }));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await send('Page.reload', { ignoreCache: true });
  await delay(800);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { ready = await evaluate(`Boolean(document.querySelector('[data-menu-ready="true"]'))`); } catch { /* navigation may replace the execution context */ }
    if (ready) break;
    await delay(150);
  }
  assert.ok(ready, 'React menu preview hydrated');
  let current = await state();
  await tap(current.x, current.y + 20);
  current = await state();
  console.log('First real touchscreen tap:', current);
  assert.equal(current.count, 0, 'opening must never navigate');
  assert.ok(current.height > 40, 'first tap keeps menu open');
  await tap(current.x, current.y + 5 + 3 * 30 + 15);
  current = await state();
  assert.equal(current.page, 'Profil');
  assert.equal(current.count, 1);
  assert.equal(current.height, 40, 'new page menu stays collapsed after compatibility events');
  await tap(current.x, current.y + 20);
  current = await state();
  assert.equal(current.count, 1, 'second opening does not navigate');
  assert.ok(current.height > 40);
  await tap(current.x, current.y + 5 + 1 * 30 + 15);
  current = await state();
  assert.equal(current.page, 'Aktivitäten');
  assert.equal(current.count, 2);
  assert.equal(current.height, 40);
  console.log('PASS: repeated touch navigation, one selection per tap, no reopened menu');
  await touch('touchStart', current.x, current.y + 20);
  await delay(900);
  await touch('touchEnd');
  await delay(580);
  current = await state();
  assert.ok(current.height > 40, 'stationary long press leaves the menu open');
  assert.equal(current.count, 2, 'stationary long press never selects a row underneath the finger');
  await tap(current.x, current.y + 20);
  current = await state();
  assert.equal(current.page, 'Home');
  assert.equal(current.count, 3);
  await touch('touchStart', current.x, current.y + 20);
  await delay(900);
  current = await state();
  await touch('touchMove', current.x, current.y + 5 + 3 * 30 + 15);
  await touch('touchEnd');
  await delay(580);
  current = await state();
  assert.equal(current.page, 'Profil');
  assert.equal(current.count, 4);
  assert.equal(current.height, 40);
  console.log('PASS: hold-to-open and hold-slide-release selection');
  await touch('touchStart', current.x, current.y + 20);
  await delay(400);
  await touch('touchCancel');
  await delay(650);
  current = await state();
  assert.equal(current.count, 4);
  assert.equal(current.height, 40, 'cancelled gesture closes and clears the hold timer');
  await tap(current.x, current.y + 20);
  current = await state();
  await touch('touchStart', current.x, current.y + 20);
  await touch('touchMove', 2, current.y + 20);
  await touch('touchEnd');
  await delay(580);
  current = await state();
  assert.equal(current.count, 4, 'release horizontally outside never selects a row');
  assert.equal(current.height, 40);
  await touch('touchStart', current.x, current.y + 20);
  await touch('touchMove', current.x, current.y - 90);
  await touch('touchEnd');
  await delay(650);
  current = await state();
  assert.equal(current.count, 4, 'short swipe without a hold does not navigate');
  assert.equal(current.height, 40);
  console.log('PASS: cancellation, outside release and accidental short swipe');
  await tap(current.x, current.y + 20);
  current = await state();
  await tap(current.x, current.y + 5 + 5 * 30 + 15);
  current = await state();
  assert.equal(current.height, 104, 'settings panel opens without selecting a page');
  const back = await evaluate(`(() => { const r = document.querySelector('[aria-label="Einstellungen schließen"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await tap(back.x, back.y);
  current = await state();
  assert.ok(current.height > 104, 'settings back button still receives normal clicks');
  assert.equal(current.count, 4);
  await tap(current.x, current.y + 20);
  current = await state();
  assert.equal(current.page, 'Home');
  assert.equal(current.count, 5);
  console.log('PASS: utility panel click isolation');
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  async function mouseClick(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await delay(580);
  }
  await mouseClick(current.x, current.y + 20);
  current = await state();
  assert.ok(current.height > 40);
  await mouseClick(current.x, current.y + 5 + 2 * 30 + 15);
  current = await state();
  assert.equal(current.page, 'Zeiterfassung');
  assert.equal(current.count, 6);
  assert.equal(current.height, 40);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: current.x, y: current.y + 20, button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: current.x, y: current.y + 20, button: 'right', clickCount: 1 });
  await delay(500);
  assert.equal((await state()).height, 40, 'right-click does not open or navigate');
  console.log('PASS: desktop clicks and ignored secondary mouse button');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    current = await state();
    await touch('touchStart', current.x, current.y + 20);
    await touch('touchEnd');
    await delay(90);
    const target = await evaluate(`(() => {
      const box = document.querySelector('.gm-menu-scrollbars-hidden').getBoundingClientRect();
      return Array.from(document.querySelectorAll('[data-menu-row]')).map(row => {
        const r = row.getBoundingClientRect();
        return { index: Number(row.dataset.menuRow), label: row.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }).find(row => row.index < 4 && row.y > box.top + 5 && row.y < box.bottom - 5 && row.label !== document.querySelector('[data-testid="current-page"]').textContent);
    })()`);
    assert.ok(target, 'a different visible navigation row exists during expansion');
    await touch('touchStart', target.x, target.y);
    await delay(160);
    await touch('touchEnd');
    await delay(580);
    const after = await state();
    assert.equal(after.page, target.label, 'animation must not change the row selected by a stationary tap');
    assert.equal(after.count, current.count + 1);
    assert.equal(after.height, 40);
  }
  console.log('PASS: four rapid selections during expansion preserve the pressed row');
} finally { ws.close(); }
