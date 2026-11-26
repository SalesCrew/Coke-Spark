import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:3037',api='http://127.0.0.1:4037';
const out=process.env.SM_ACTIVITY_COMMENT_EVIDENCE_DIR||'/tmp/spark-approved-evidence/comments';
await mkdir(out,{recursive:true});
const status=await(await fetch(api+'/__synthetic/status')).json();
assert.equal(status.kind,'sm-activity-comments-disposable','Disposable server required');
const info=await(await fetch(api+'/__synthetic/info')).json();
const {chromium,expect}=createRequire(process.env.HOME+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright/test');
const browser=await chromium.launch({headless:true}),outside=[],errors=[],changes=[];
async function context(email,viewport){
 const ctx=await browser.newContext({viewport});
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if([origin,api].includes(u.origin)||['data:','blob:'].includes(u.protocol))return route.continue();outside.push(u.origin);return route.abort();});
 const session=await(await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'preview'})})).json();
 await ctx.addInitScript(s=>{if(location.origin==='http://127.0.0.1:3037'&&!localStorage.getItem('auth_active_v2'))localStorage.setItem('coke_spark_auth_v1',JSON.stringify(s));},session);
 return ctx;
}
const headers={Authorization:'Bearer synthetic-sm'},read=async()=>{const response=await fetch(api+info.path,{headers});assert.equal(response.status,200);return response.json();};
const original=await read(),photoQuestion=original.sections[0].questions.find(q=>q.type==='photo');
const photoBytes=Buffer.from(await(await fetch(original.photoFiles[photoQuestion.id][0].signedUrl)).arrayBuffer());
// The existing revision writer marks reused files as inherited; compare persistent photo identity and content.
const photoMetadata=files=>Object.fromEntries(Object.entries(files).map(([id,rows])=>[id,rows.map(({SMDurcharbeitInherited,...file})=>file)]));
const ctx=await context('sm@preview.test',{width:390,height:844}),page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!['GET','OPTIONS'].includes(r.method())&&!r.url().endsWith('/telemetry/events'))changes.push({method:r.method(),url:r.url(),body:r.postDataJSON()});});
try{
 await page.goto(origin+'/sm/aktivitaet');
 await page.locator('.sm-act-card').filter({hasText:'Vorschau Markt'}).click({timeout:90000});
 const card=page.locator('.sm-act-question-card').filter({has:page.getByRole('heading',{name:'Regalfoto',exact:true})});
 await card.getByRole('button',{name:'Kommentar nachtragen',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Kommentar anfragen',exact:true});
 await dialog.getByRole('textbox',{name:'Gewünschter Kommentar'}).fill('Regalfoto nach dem Einsatz geprüft');
 await dialog.getByRole('textbox',{name:'Grund für die Änderung'}).fill('Dokumentation ergänzt');
 // A real server rejection must keep both entered fields and the original answer.
 await page.route('**/change-requests',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Synthetischer Versionskonflikt'})}),{times:1});
 await dialog.getByRole('button',{name:'Anfrage senden',exact:true}).click();
 await expect(dialog.getByText('Synthetischer Versionskonflikt',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('textbox',{name:'Gewünschter Kommentar'})).toHaveValue('Regalfoto nach dem Einsatz geprüft');
 await expect(dialog.getByRole('textbox',{name:'Grund für die Änderung'})).toHaveValue('Dokumentation ergänzt');
 assert.deepEqual((await read()).answers,original.answers);
 await page.screenshot({path:out+'/01-comment-request.png'});
 const request=page.waitForResponse(r=>r.url().includes('/change-requests')&&r.status()===201);
 await dialog.getByRole('button',{name:'Anfrage senden',exact:true}).click();
 const created=(await(await request).json()).request;
 await expect(dialog).not.toBeVisible();
 await expect(card.getByRole('button',{name:'In Prüfung',exact:true})).toBeVisible();
 assert.deepEqual((await read()).answers,original.answers);
 await page.screenshot({path:out+'/02-awaiting-approval.png'});
 const adminCtx=await context('sm-admin@preview.test',{width:1440,height:1000}),admin=await adminCtx.newPage();
 admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(origin+'/admin/sm/durcharbeit-verplanung');
 await admin.getByRole('button',{name:'Änderungsanfragen öffnen',exact:true}).click({timeout:90000});
 const review=admin.locator('.answer-request-card').filter({hasText:'Regalfoto nach dem Einsatz geprüft'});
 await expect(review).toBeVisible();await expect(review).toContainText('Dokumentation ergänzt');
 await admin.screenshot({path:out+'/03-admin-review.png'});
 const approved=admin.waitForResponse(r=>r.url().endsWith('/'+created.id+'/approve')&&r.status()===200);
 await review.getByRole('button',{name:'Annehmen',exact:true}).click();await approved;
 const after=await read();
 assert.equal(after.answers[photoQuestion.id].comment,'Regalfoto nach dem Einsatz geprüft');
 assert.deepEqual(after.answers[photoQuestion.id].fileIds,original.answers[photoQuestion.id].fileIds);
 assert.deepEqual(photoMetadata(after.photoFiles),photoMetadata(original.photoFiles));
 assert.deepEqual(Buffer.from(await(await fetch(after.photoFiles[photoQuestion.id][0].signedUrl)).arrayBuffer()),photoBytes);
 for(const [id,value] of Object.entries(original.answers))if(id!==photoQuestion.id)assert.deepEqual(after.answers[id],value);
 await page.reload();await page.locator('.sm-act-card').filter({hasText:'Vorschau Markt'}).click();
 await expect(card).toContainText('Regalfoto nach dem Einsatz geprüft');
 await expect(card.getByRole('button',{name:'Kommentar ändern',exact:true})).toBeVisible();
 await card.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/04-approved-comment.png'});
 const afterStatus=await(await fetch(api+'/__synthetic/status')).json();assert.equal(afterStatus.currentFingerprint,afterStatus.originalFingerprint);
 const requests=changes.filter(x=>x.url.includes('/change-requests'));assert.equal(requests.length,2);
 for(const r of requests){assert.equal(r.body.commentOnly,true);assert.equal(r.body.expectedAnswerVersion,original.answerVersions[photoQuestion.id]);assert.deepEqual(r.body.answer.fileIds,original.answers[photoQuestion.id].fileIds);}
 assert.ok(!changes.some(x=>x.url.includes('/answers/')),'Comment UI cannot directly write an answer');
 assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
 await writeFile(out+'/results.json',JSON.stringify({passed:5,checks:['409 retains comment and reason','SM submits comment-only proposal; stored answer unchanged','Actual admin review accepts proposal','SM reload sees approved comment with original photos','Protected historical answers and photos fingerprint unchanged'],outside,errors},null,2));
 console.log('PASS: comment-only proposal, visible error retention, admin approval, employee reload and historical preservation');
}catch(error){console.log('FAILED PAGE',page.url(),(await page.locator('body').innerText()).slice(-5000));await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();}
