// Run only with the isolated report fixture. All other network destinations are blocked.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
const web=process.env.REPORT_WEB_ORIGIN??'http://127.0.0.1:3070',api=process.env.REPORT_API_ORIGIN??'http://127.0.0.1:4070';
for(const origin of [web,api]){const url=new URL(origin);assert.equal(url.hostname,'127.0.0.1');assert.ok(!['3000','4000'].includes(url.port));}
const identity=await fetch(api+'/__synthetic/identity').then(r=>r.json());assert.equal(identity.synthetic,true);assert.equal(identity.feature,'gm-dashboard-reports');
const {chromium}=createRequire(process.env.HOME+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await chromium.launch({headless:true});const dir='outputs/gm-dashboard-reports-20261106/browser';await mkdir(dir,{recursive:true});const errors=[],external=[],queries=[];
async function login(email,width=1440,height=1000){
 const ctx=await browser.newContext({viewport:{width,height},timezoneId:'Europe/Vienna',acceptDownloads:true});
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if([web,api].includes(u.origin)||['data:','blob:'].includes(u.protocol))return route.continue();external.push(u.origin);return route.abort();});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/reports/query'))queries.push(r.postDataJSON());});
 await page.goto(web);await page.locator('input[type=email]').fill(email+'@preview.invalid');await page.locator('input[type=password]').fill('synthetic');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname.startsWith('/admin')||url.pathname==='/datenschutz/admin');
 await page.goto(web+'/admin/gm-dashboard');await page.getByRole('button',{name:'Exportieren',exact:true}).waitFor();return page;
}
async function open(page){await page.getByRole('button',{name:'Exportieren',exact:true}).click();await page.getByRole('dialog').waitFor();await ready(page);return page.getByRole('dialog');}
async function ready(page){await page.getByRole('button',{name:'PowerPoint herunterladen',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('dialog footer button:last-child')?.disabled);}
async function choose(page,label,option){await page.getByRole('button',{name:label,exact:true}).click();const list=page.getByRole('listbox');await list.waitFor();const response=page.waitForResponse(r=>r.url().endsWith('/reports/query'));await list.getByRole('option').filter({hasText:option}).first().click();await response;await ready(page);}
async function download(page,name){const event=page.waitForEvent('download');await page.getByRole('button',{name:'PowerPoint herunterladen',exact:true}).click();const d=await event;assert.match(d.suggestedFilename(),/\.pptx$/);const path=dir+'/'+name+'.pptx';await d.saveAs(path);const zip=await JSZip.loadAsync(await readFile(path));assert.ok(zip.file('ppt/presentation.xml'));return zip;}
try{
 const page=await login('admin');await open(page);assert.equal(queries.at(-1).kind,'availability');await page.screenshot({path:dir+'/availability.png'});
 await choose(page,'RED-Monat für Bericht','RED Oktober 2026');assert.equal(queries.at(-1).periods[0].start,'2026-10-05');
 await page.getByRole('button',{name:'Berichtsstichtag',exact:true}).click();await page.getByRole('button',{name:/20\. Oktober 2026/}).click();await page.waitForTimeout(450);await ready(page);assert.equal(queries.at(-1).cutoff,'2026-10-20');
 await page.getByRole('button',{name:'Folie 3 anzeigen',exact:true}).click();await page.screenshot({path:dir+'/availability-table.png'});const withPhotos=await download(page,'availability');const photoSlide=await withPhotos.file('ppt/slides/slide7.xml').async('string');assert.equal((photoSlide.match(/<p:pic>/g)??[]).length,10);assert.doesNotMatch(photoSlide,/Foto konnte nicht geladen werden/);assert.match(photoSlide,/<a:srcRect[^>]*[ltrb]="[1-9]\d*"/);
 await page.getByRole('button',{name:'Mitbewerb',exact:true}).click();await page.waitForTimeout(450);await ready(page);assert.equal(queries.at(-1).kind,'competitor');await page.getByRole('button',{name:'Folie 3 anzeigen',exact:true}).click();assert.equal(await page.getByRole('img',{name:'Folie 3: Kühler Mitbewerber',exact:true}).evaluate(svg=>[...svg.querySelectorAll('tspan[data-fit-width]')].every(t=>t.getComputedTextLength()<=Number(t.dataset.fitWidth)+1)),true);await page.screenshot({path:dir+'/competitor-months.png'});await download(page,'competitor-months');
 await page.getByRole('button',{name:'Datenzuordnung'}).click();await page.getByRole('button',{name:/Platzierungstyp für Wie viele Coke Kühler/}).click();await page.getByRole('listbox').getByRole('option',{name:'Nicht auswerten',exact:true}).click();await page.waitForTimeout(450);await ready(page);assert.equal(queries.at(-1).mappings[0].excluded,true);
 await page.getByRole('button',{name:'Quartale',exact:true}).click();await page.waitForTimeout(450);await ready(page);assert.ok(queries.at(-1).periods[0].label.startsWith('Q'));await page.getByRole('button',{name:'Folie 3 anzeigen',exact:true}).click();await page.screenshot({path:dir+'/competitor-quarters.png'});await download(page,'competitor-quarters');
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'Exportieren',exact:true}).evaluate(e=>e===document.activeElement),true);
 // Error and retry use actual report route, not a mocked browser response.
 await fetch(api+'/__synthetic/scenario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({failRead:true})});await page.getByRole('button',{name:'Exportieren',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();await page.screenshot({path:dir+'/error.png'});
 await fetch(api+'/__synthetic/scenario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({failRead:false})});const recovered=page.waitForResponse(r=>r.url().endsWith('/reports/query'));await page.getByRole('button',{name:'Erneut versuchen'}).click();await recovered;await ready(page);
 await page.getByRole('button',{name:'Export schließen',exact:true}).click();await page.setViewportSize({width:1280,height:800});const dialog=await open(page);const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1280&&box.y+box.height<=800);await page.screenshot({path:dir+'/laptop-1280.png'});await page.getByRole('button',{name:'Export schließen',exact:true}).click();
 // Existing per-card multi-selects feed the report; the dashboard layout is unchanged.
 const availabilityCard=page.getByText('Verfügbarkeitsabfrage',{exact:true}).locator('xpath=ancestor::section[1]');
 await availabilityCard.getByRole('button',{name:'Chain: Alle Chains',exact:true}).click();
 await availabilityCard.getByRole('group',{name:'Chain Mehrfachauswahl'}).getByRole('checkbox',{name:'Billa',exact:true}).click();
 await availabilityCard.getByRole('group',{name:'Chain Mehrfachauswahl'}).getByRole('checkbox',{name:'SPAR',exact:true}).last().click();
 await page.keyboard.press('Escape');await page.waitForTimeout(500);await open(page);assert.deepEqual(queries.at(-1).scope.chains.slice().sort(),['Billa','SPAR']);
 await page.getByRole('button',{name:'Export schließen',exact:true}).click();await availabilityCard.getByRole('button',{name:'Alle Filter zurücksetzen',exact:true}).click();await page.waitForTimeout(500);
 // The original Excel export remains available in the new dialog.
 await open(page);const excelEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Stattdessen Excel exportieren',exact:true}).click();const excel=await excelEvent;assert.match(excel.suggestedFilename(),/\.xlsx$/);await excel.saveAs(dir+'/dashboard.xlsx');
 const customer=await login('kunde-no-photos');await open(customer);
 await customer.getByRole('button',{name:'Folie 6 anzeigen',exact:true}).click();assert.ok(await customer.getByRole('img',{name:'Folie 6: Marktfotos',exact:true}).count());await customer.screenshot({path:dir+'/customer-no-photo-access.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile(dir+'/verification.json',JSON.stringify({passed:true,queries:queries.length,viewports:['1440x1000','1280x800'],errors,external},null,2));console.info('Browser flow passed: periods, cutoff, three real PPTX downloads, mappings, error/retry, photo access, laptop layouts.');
}finally{await browser.close();}
