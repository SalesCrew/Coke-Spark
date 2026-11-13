// Requires the independent 3037/4037 preview with a disposable PGlite fixture.
// The synthetic-identity check is mandatory; this script never uses production env files.
const {createRequire}=require('node:module');
const {mkdirSync,writeFileSync}=require('node:fs');const assert=require('node:assert/strict');
const {chromium}=createRequire(process.env.HOME+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const out=require('node:path').resolve(process.env.BONI_TEST_OUTPUT || 'outputs/boni-save-conflicts-synthetic');mkdirSync(out,{recursive:true});
(async()=>{
 const base='http://127.0.0.1:4037',info=await(await fetch(base+'/__synthetic/identity')).json();assert.equal(info.synthetic,true);
 const path='/admin/praemien/workspace/waves/'+info.waveId;
 const get=async()=>{const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');return r.json()};
 const put=async body=>{const r=await fetch(base+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.text());return get()};
 const edit=async(delta,gm=info.otherGmId)=>{const w=await get(),e=w.entries.find(e=>e.gmId===gm&&e.pillarKey==='displays'&&e.metricKey==='percent');return put({type:'values',revision:w.revision,entries:[{...e,...delta}]})};
 const bump=async()=>{const w=await get();return put({type:'rules',revision:w.revision,model:w.model})};
 const entry=w=>w.entries.find(e=>e.gmId===info.otherGmId&&e.pillarKey==='displays'&&e.metricKey==='percent');
 const integrity=async()=>(await(await fetch(base+'/__synthetic/integrity')).json()).digest;
 const initialIntegrity=await integrity();
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(20000);
 const errors=[],external=[],checks=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(new URL(r.url()).pathname===path&&r.request().method()==='PUT')writes.push(r.status())});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(['http://127.0.0.1:3037',base].includes(u.origin)||['data:','blob:'].includes(u.protocol))return route.continue();external.push(u.origin);return route.abort();});
 async function open(){await page.goto('http://127.0.0.1:3037/admin/praemien',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Mitarbeiterwerte',exact:true}).click();await page.getByRole('textbox',{name:'GM suchen',exact:true}).fill('Beispiel GM 2');await page.getByRole('button',{name:'Werte bearbeiten',exact:true}).click();return page.getByRole('dialog',{name:'Werte für Beispiel GM 2',exact:true});}
 const target=d=>d.getByRole('textbox',{name:'Persönlicher Sollwert',exact:true});
 const save=d=>d.getByRole('button',{name:'Werte speichern & neu berechnen',exact:true});
 async function submit(d,status){const response=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='PUT');await save(d).click();assert.equal((await response).status(),status)}
 async function synced(d){await d.getByText('Stand aktualisiert. Deine Eingaben sind erhalten. Bitte erneut speichern.',{exact:true}).waitFor();assert.equal(await target(d).isDisabled(),false)}
 async function visibleAlert(d){const a=d.getByRole('alert').first();await a.waitFor();const box=await a.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000,'alert remains visible above scroll form');}
 // Independent fields: refresh changes another GM and same entry's untouched fields.
 await edit({target:90,value:null,note:'vorhanden',rawPoints:null});let d=await open();await target(d).fill('83,5593');
 await edit({value:97.66,note:'anderer Admin',rawPoints:44});await edit({target:111},info.gmId);
 const count=writes.length;await submit(d,409);await synced(d);assert.equal(writes.length,count+1,'no automatic retry');
 assert.equal(await target(d).inputValue(),'83,5593');assert.equal(entry(await get()).target,90);
 await page.screenshot({path:out+'/01-version-aktualisiert.png'});
 await submit(d,200);await d.waitFor({state:'hidden'});let stored=entry(await get());assert.equal(stored.target,83.5593);assert.equal(stored.value,97.66);assert.equal(stored.note,'anderer Admin');assert.equal(stored.rawPoints,44);
 d=await open();assert.equal(await target(d).inputValue(),'83,5593');await d.getByRole('button',{name:'Schließen',exact:true}).first().click();checks.push('409 refresh + explicit retry preserves local target and concurrent value/note/raw points/other GM; reopen persists');
 // Same-field conflict: no save until choice, choose foreign value, preserve independent note.
 d=await open();await target(d).fill('80');await d.getByRole('textbox',{name:'Begründung / Nachweis',exact:true}).first().fill('eigene Begründung');await edit({target:75});await submit(d,409);
 await d.getByRole('button',{name:'Aktuellen Wert übernehmen',exact:true}).waitFor();await visibleAlert(d);assert.equal(await save(d).isDisabled(),true);assert.equal(await target(d).inputValue(),'80');
 await page.screenshot({path:out+'/02-feldkonflikt.png'});
 await d.getByRole('button',{name:'Aktuellen Wert übernehmen',exact:true}).click();assert.equal(await target(d).inputValue(),'75');await submit(d,200);await d.waitFor({state:'hidden'});assert.equal(entry(await get()).target,75);assert.equal(entry(await get()).note,'eigene Begründung');checks.push('same-field conflict blocks save, retains candidates, current-value choice preserves other local edits');
 // A further race after refresh must still be protected by backend revision.
 d=await open();await target(d).fill('70');await bump();await submit(d,409);await synced(d);await edit({target:65});await submit(d,409);await d.getByRole('button',{name:'Eigene Eingabe bestätigen',exact:true}).waitFor();assert.equal(entry(await get()).target,65);assert.equal(await target(d).inputValue(),'70');
 await d.getByRole('button',{name:'Eigene Eingabe bestätigen',exact:true}).click();await submit(d,200);await d.waitFor({state:'hidden'});assert.equal(entry(await get()).target,70);checks.push('second race rejects stale revision again; explicit own-value confirmation required');
 // Draft closing / Escape must never silently discard.
 d=await open();await target(d).fill('68');await d.getByRole('button',{name:'Schließen',exact:true}).first().click();await d.getByText('Ungespeicherte Eingaben verwerfen?',{exact:true}).waitFor();await page.screenshot({path:out+'/03-ungespeicherte-eingaben.png'});
 await page.keyboard.press('Escape');assert.equal(await target(d).inputValue(),'68');assert.equal(await d.getByText('Ungespeicherte Eingaben verwerfen?',{exact:true}).count(),0);await page.keyboard.press('Escape');await d.getByRole('button',{name:'Weiterbearbeiten',exact:true}).click();assert.equal(await target(d).inputValue(),'68');await page.keyboard.press('Escape');await d.getByRole('button',{name:'Eingaben verwerfen',exact:true}).click();await d.waitFor({state:'hidden'});assert.equal(entry(await get()).target,70);checks.push('header close + Escape + keep/discard protect draft; discard never writes');
 // Failed fresh GET preserves the local draft and forbids blind retry.
 d=await open();await target(d).fill('67');await bump();
 let rejectFresh=true;const freshFailure=async route=>{if(route.request().method()==='GET'&&rejectFresh){rejectFresh=false;return route.fulfill({status:503,json:{error:'Synthetic fresh-read outage'}})}return route.fallback()};
 await page.route(base+path,freshFailure);await submit(d,409);await d.getByRole('button',{name:'Aktuellen Stand erneut laden',exact:true}).waitFor();await visibleAlert(d);assert.equal(await target(d).inputValue(),'67');assert.equal(await save(d).isDisabled(),true);await d.getByRole('button',{name:'Aktuellen Stand erneut laden',exact:true}).click();await synced(d);await page.unroute(base+path,freshFailure);await submit(d,200);await d.waitFor({state:'hidden'});assert.equal(entry(await get()).target,67);checks.push('failed refresh retains draft, visible retry, no blind write');
 // Server validation/transport errors visible without losing fields.
 d=await open();await target(d).fill('66');const putFailure=route=>route.request().method()==='PUT'?route.fulfill({status:400,json:{error:'Synthetischer Validierungsfehler'}}):route.fallback();await page.route(base+path,putFailure);await submit(d,400);await visibleAlert(d);assert.equal(await target(d).inputValue(),'66');await page.unroute(base+path,putFailure);
 // Confirmed PUT must not be labelled failed if subsequent wave list refresh fails.
 const listFailure=route=>route.fulfill({status:503,json:{error:'Synthetic list outage'}});await page.route(base+'/admin/praemien/workspace/waves',listFailure);await submit(d,200);await d.waitFor({state:'hidden'});await page.unroute(base+'/admin/praemien/workspace/waves',listFailure);assert.equal(entry(await get()).target,66);checks.push('validation error visible; committed PUT still closes successfully after list GET failure');
 // In-flight fields and close are locked, then save completes.
 d=await open();await target(d).fill('64');let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);const delay=async route=>{if(route.request().method()==='PUT'){entered();await gate;}await route.fallback()};await page.route(base+path,delay);await save(d).click();await started;assert.equal(await target(d).isDisabled(),true);assert.equal(await d.getByRole('button',{name:'Schließen',exact:true}).first().isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await d.count(),1);release();await d.waitFor({state:'hidden'});await page.unroute(base+path,delay);assert.equal(entry(await get()).target,64);checks.push('in-flight fields, close and Escape locked until response');
 // Laptop layout and no rule reinterpretation.
 await page.setViewportSize({width:1280,height:800});d=await open();await target(d).fill('63');const w=await get();w.model.pillars[0].metrics[0].sources[0].weight=2;await put({type:'rules',revision:w.revision,model:w.model});await submit(d,409);await d.getByRole('alert').filter({hasText:'Berechnungsregeln'}).waitFor();const box=await d.getByRole('alert').first().boundingBox();assert.ok(box.y+box.height<800);assert.equal(await target(d).inputValue(),'63');assert.equal(await save(d).isDisabled(),true);assert.equal(entry(await get()).target,64);await page.screenshot({path:out+'/04-regelaenderung-1280.png'});checks.push('1280 laptop: changed calculation rules block save, retain original inputs and previous value');
 assert.equal(await integrity(),initialIntegrity,'historical answers, answer options and frozen snapshot remain byte-identical');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(out+'/synthetic-e2e.json',JSON.stringify({synthetic:true,database:'Disposable PGlite',viewports:['1440x1000','1280x800'],checks,uiPutStatuses:writes,integrityUnchanged:true,pageErrors:errors,externalRequests:external},null,2));console.log(JSON.stringify({passed:checks.length,checks,uiPutStatuses:writes,integrityUnchanged:true,pageErrors:errors,externalRequests:external},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
