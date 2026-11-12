// Run only against the disposable in-memory SM report fixture.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const web=process.env.SM_REPORT_WEB_ORIGIN??'http://127.0.0.1:3062';
const api=process.env.SM_REPORT_API_ORIGIN??'http://127.0.0.1:4062';
const output=process.env.SM_REPORT_BROWSER_OUTPUT??'/tmp/coke-sm-report-preview';
for(const origin of [web,api]) { const u=new URL(origin);assert.equal(u.hostname,'127.0.0.1');assert.ok(!['3000','4000','3037','4037'].includes(u.port)); }
const identity=await fetch(api+'/__synthetic/identity').then(r=>r.json());assert.equal(identity.synthetic,true);assert.equal(identity.feature,'sm-management-report');
fs.mkdirSync(output,{recursive:true});
const {chromium}=createRequire(process.env.HOME+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const XLSX=createRequire(new URL('../package.json',import.meta.url))('xlsx-js-style');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[],failed=[],reportRequests=[],downloads=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url()})});
 page.on('request',r=>{if(r.url().includes('/completed/report?'))reportRequests.push(r.url())});page.on('download',d=>downloads.push(d.suggestedFilename()));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return [web,api].includes(u.origin)||['blob:','data:'].includes(u.protocol)?route.continue():route.abort()});
 await page.addInitScript(()=>localStorage.setItem('coke_spark_auth_v1',JSON.stringify({user:{id:'00000000-0000-4000-8000-000000000001',role:'sm_admin',email:'preview@example.invalid',firstName:'Lokale',lastName:'Vorschau'},session:{accessToken:'isolated-sm-report-preview',refreshToken:'isolated-sm-report-preview',expiresAt:4102444800}})));
 await page.goto(web+'/admin/sm/fbmanagement',{waitUntil:'domcontentloaded'});
 const button=page.getByRole('button',{name:'Komplettauswertung',exact:true});await button.waitFor();await button.waitFor({state:'visible'});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Komplettauswertung'&&!b.disabled));
 const shot=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);await page.screenshot({path:`${output}/${name}.png`})};
 await shot('01-sm-management');
 const getDownload=async(name)=>{
   const pending=page.waitForEvent('download');await button.click();const download=await pending;const path=`${output}/${name}.xlsx`;await download.saveAs(path);
   const wb=XLSX.readFile(path),visits=XLSX.utils.sheet_to_json(wb.Sheets.Besuche,{range:3}),details=XLSX.utils.sheet_to_json(wb.Sheets.Antwortdetails,{range:3});
   assert.equal(visits.length,105);assert.equal(details.length,108);assert.ok(wb.Sheets.Exportinfo);assert.equal(wb.Sheets.Meta,undefined);
   assert.ok(details.some(row=>row['Beantwortet von']==='Local Admin'));assert.ok(details.some(row=>row['Beantwortet von']==='Original SM'));
   for(const [name,sheet] of Object.entries(wb.Sheets)){
     if(name!=='Exportinfo')for(const header of XLSX.utils.sheet_to_json(sheet,{header:1,range:3})[0]??[])assert.doesNotMatch(String(header),/(?:^|[- (])IDs?(?:$|[ )])|JSON|Frage-Code/);
     for(const [key,cell] of Object.entries(sheet))if(!key.startsWith('!')&&typeof cell.v==='string')assert.doesNotMatch(cell.v,/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|https?:\/\//i,'technical IDs and URLs must not appear in visible spreadsheet values');
   }
   return {file:download.suggestedFilename(),rows:visits.length};
 };
 const first=await getDownload('SM_Komplettauswertung');await page.getByRole('status').filter({hasText:'105 Besuche'}).waitFor();await shot('02-export-fertig');
 await page.getByRole('button',{name:'Weiter',exact:true}).click();await page.waitForTimeout(300);const second=await getDownload('SM_Seite2');
 for(const request of reportRequests){const params=new URL(request).searchParams;assert.equal(params.has('cursorId'),false);assert.equal(params.has('cursorDate'),false);assert.equal(params.has('limit'),false)}
 await page.getByRole('button',{name:'Fragebogentyp',exact:true}).click();await page.getByRole('option',{name:'Standard',exact:true}).click();await page.waitForTimeout(350);
 assert.equal(await button.isEnabled(),true);
 const search=page.getByRole('searchbox');await search.fill('does-not-exist');await page.getByText('Keine Treffer für diese Filter',{exact:true}).waitFor();assert.equal(await button.isDisabled(),true);await shot('03-keine-treffer');await search.fill('');await page.waitForTimeout(350);
 let release; const wait=new Promise(resolve=>release=resolve);
 const intercept=async route=>{await wait;await route.continue()};await page.route('**/completed/report?*',intercept);
 await button.click();await page.getByRole('button',{name:'Wird exportiert …'}).waitFor();assert.equal(await page.getByRole('button',{name:'Wird exportiert …'}).isDisabled(),true);await shot('04-export-laedt');
 await search.fill('does-not-exist');await page.getByText('Keine Treffer für diese Filter',{exact:true}).waitFor();release();await page.waitForTimeout(600);assert.equal(downloads.length,2,'filter switch must discard stale export');await page.unroute('**/completed/report?*',intercept);await search.fill('');await page.waitForTimeout(350);
 const fail=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Der Exportdienst ist vorübergehend nicht erreichbar.',code:'synthetic_unavailable'})});await page.route('**/completed/report?*',fail);await button.click();await page.getByRole('alert').filter({hasText:'Der Exportdienst'}).waitFor();await shot('05-export-fehler');await page.unroute('**/completed/report?*',fail);const retriedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Erneut exportieren'}).click();const retry=await retriedDownload;await retry.saveAs(output+'/SM_Retry.xlsx');await page.getByRole('status').filter({hasText:'105 Besuche'}).waitFor();
 await page.setViewportSize({width:1280,height:800});await shot('06-sm-management-1280');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 // An account change during the same response also must discard the download.
 let releaseAccount;const pendingAccount=new Promise(resolve=>releaseAccount=resolve);
 const accountIntercept=async route=>{await pendingAccount;await route.continue()};await page.route('**/completed/report?*',accountIntercept);
 const beforeAccount=downloads.length;await button.click();await page.getByRole('button',{name:'Wird exportiert …'}).waitFor();
 await page.evaluate(()=>{
   const payload={user:{id:'00000000-0000-4000-8000-000000000002',role:'sm_admin',email:'other-preview@example.invalid',firstName:'Andere',lastName:'Vorschau'},session:{accessToken:'isolated-sm-report-preview',refreshToken:'isolated-sm-report-preview',expiresAt:4102444800}};
   const sessionKey=`auth_session_v2:${payload.user.id}:sm_admin`,updatedAtMs=Date.now();
   localStorage.clear();sessionStorage.clear();
   localStorage.setItem(sessionKey,JSON.stringify({version:2,userId:payload.user.id,role:'sm_admin',remember:true,updatedAtMs,payload}));
   localStorage.setItem('auth_active_v2',JSON.stringify({version:2,sessionKey,target:'local',userId:payload.user.id,role:'sm_admin',remember:true,updatedAtMs}));
   window.dispatchEvent(new Event('coke_spark:auth-changed'));
 });
 releaseAccount();await page.waitForTimeout(600);assert.equal(downloads.length,beforeAccount);await page.unroute('**/completed/report?*',accountIntercept);
 const featureFailures=failed.filter(f=>f.status!==503);assert.deepEqual(featureFailures,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(output+'/e2e-results.json',JSON.stringify({first,second,downloads,reportRequests,errors,failed,checks:['actual app and HTTP report to downloaded XLSX','all 105 visits, 108 answers, private photo metadata; readable author names and labels without technical ID/JSON columns','second list page exports all pages','standard filter, empty results','loading and disabled button','no stale download after filter or account switch','error and retry','1440 and 1280 layouts']},null,2));
 console.log('SM report browser E2E passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
