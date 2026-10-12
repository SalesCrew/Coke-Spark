// Real question picker + real HTTP router, served only from a disposable PGlite
// fixture. No app entry point, environment files, production URLs or accounts.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "../backend/node_modules/express/index.js";
import { build } from "../backend/node_modules/esbuild/lib/main.js";
import { praemienFixture } from "../backend/src/lib/praemien-test-fixture.ts";
import { createPraemienWorkspaceRouter } from "../backend/src/routes/praemien-workspace.ts";
import { mutateWorkspace, readWorkspace } from "../backend/src/lib/praemien-workspace.ts";

for (const key of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  assert.ok(!process.env[key], "Browser test requires a clean synthetic environment");
}
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH, "Set the bundled Playwright module path");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const root = resolve(import.meta.dirname, ".."), output = await mkdtemp(join(tmpdir(), "boni-active-questions-"));
const f = await praemienFixture();
let server, browser;
try {
  const old = randomUUID();
  await f.pg.query("insert into question_bank_shared(id,text,question_type) values($1,'Old unlinked rack question','numeric')", [old]);
  const unscored=randomUUID();
  await f.pg.query("insert into question_bank_shared(id,text,question_type) values($1,'Active question without Boni points','numeric')",[unscored]);
  await f.pg.query("insert into module_main_question(module_id,question_id) values($1,$2)",[f.ids.catalogModule,unscored]);
  const model = structuredClone(f.model);
  model.pillars[0].metrics[0].method = "answer_sum";
  model.pillars[0].metrics[0].sources = [{ questionId:old, label:"Old unlinked rack question", section:"standard", scoreKey:"__value__", factor:true, weight:2, minFrequency:8, chains:["Billa"], counting:"once" }];
  const saved = await mutateWorkspace(f.database,f.ids.wave,f.workspace.revision,{id:f.ids.admin,name:"Synthetic admin"},{type:"rules",model});
  const originalEntries = structuredClone(saved.entries);
  await build({
    stdin: { resolveDir:root, loader:"tsx", contents:`
      import React, { useState, useEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import { QuestionSources } from './src/components/admin/praemien/QuestionSources';
      import styles from './src/components/admin/praemien/praemien.module.css';
      async function api(path, body) {
        const response = await fetch('/admin/praemien/workspace'+path, { method:body ? 'PUT':'GET', headers:{'Content-Type':'application/json'}, body:body && JSON.stringify(body) });
        if(!response.ok) throw new Error('Synthetic API status '+response.status);
        return response.json();
      }
      function App() {
        const [workspace,setWorkspace]=useState(null), [questions,setQuestions]=useState([]), [metric,setMetric]=useState(null), [loading,setLoading]=useState(true), [message,setMessage]=useState('');
        async function reload() {
          setLoading(true);
          const w=await api('/waves/${f.ids.wave}'), q=await api('/sources');
          setWorkspace(w);setMetric(w.model.pillars[0].metrics[0]);setQuestions(q.questions);setLoading(false);
        }
        useEffect(()=>{reload().catch(e=>setMessage(e.message));},[]);
        async function save() {
          const model=structuredClone(workspace.model);model.pillars[0].metrics[0]=metric;
          const w=await api('/waves/${f.ids.wave}',{revision:workspace.revision,type:'rules',model});
          setWorkspace(w);setMetric(w.model.pillars[0].metrics[0]);setMessage('Gespeichert');
        }
        return <div className={styles.backdrop}><section className={styles.editor}>
          <header><h2>Prämien · isolierter Test</h2></header>
          <div style={{padding:24,overflow:'auto',flex:1,minHeight:0}}>{metric && <QuestionSources metric={metric} questions={questions} loading={loading} onChange={setMetric}/>}</div>
          <footer><button onClick={reload}>Neu laden</button><button onClick={save} disabled={loading}>Speichern</button><span role="status">{message}</span></footer>
        </section></div>;
      }
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle:true, format:"esm", platform:"browser", jsx:"automatic", outfile:join(output,"app.js"),
    alias:{"@":join(root,"src")}, tsconfig:join(root,"tsconfig.json"), logLevel:"silent",
  });
  const app = express(); app.use(express.json());
  app.get("/", (_req,res)=>res.type("html").send('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>'));
  app.get("/app.js",async (_req,res)=>res.type("js").send(await readFile(join(output,"app.js"))));
  app.get("/app.css",async (_req,res)=>res.type("css").send(await readFile(join(output,"app.css"))));
  app.use((req,_res,next)=>{req.authUser={appUserId:f.ids.admin,role:"admin"};next();});
  app.use("/admin/praemien/workspace",createPraemienWorkspaceRouter(f.database));
  server = await new Promise(resolveServer=>{const s=app.listen(0,"127.0.0.1",()=>resolveServer(s));});
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  await page.route("**/*",route=>new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(origin);
  const active=page.getByRole("region",{name:"Geeignete Fragen"});
  await active.getByRole("checkbox",{name:"Permanente Racks – Testfrage"}).waitFor();
  assert.equal(await active.getByRole("checkbox").count(),1);
  assert.equal(await active.getByRole("checkbox",{name:"Old unlinked rack question"}).count(),0);
  assert.equal(await active.getByRole("checkbox",{name:"Active question without Boni points"}).count(),0);
  const retained=page.locator("details").filter({hasText:"Gespeicherte Quellen außerhalb der aktuellen Auswahl"});
  assert.equal(await retained.getAttribute("open"),null);
  await active.getByRole("checkbox").click();
  assert.equal(await active.getByRole("checkbox").getAttribute("aria-checked"),"true");
  await active.getByRole("checkbox").press("Space");
  await page.getByRole("button",{name:"Alle Treffer zuordnen"}).click();
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Gespeichert"}).waitFor();
  let reopened=await readWorkspace(f.database,f.ids.wave);
  assert.equal(reopened.model.pillars[0].metrics[0].sources.length,2);
  assert.deepEqual(reopened.model.pillars[0].metrics[0].sources[0],model.pillars[0].metrics[0].sources[0]);
  assert.deepEqual(reopened.entries,originalEntries);
  await retained.locator("summary").click();
  await retained.getByRole("button",{name:"Einstellungen: Old unlinked rack question"}).click();
  assert.equal(await retained.getByRole("button",{name:"Weiteren Besuchsbereich / Antwort zuordnen"}).isDisabled(),true);
  await f.pg.query("update campaigns set status='inactive' where id=$1",[f.ids.catalogCampaign]);
  await page.getByRole("button",{name:"Neu laden",exact:true}).click();
  await active.getByText("Keine passenden aktiven Fragen").waitFor();
  assert.equal(await active.getByRole("checkbox").count(),0);
  assert.match(await retained.locator("summary").textContent(),/\(2\)/);
  const before=reopened.model;
  const savedAgain=page.waitForResponse(response=>response.request().method()==="PUT" && response.url().endsWith(`/waves/${f.ids.wave}`));
  await page.getByRole("button",{name:"Speichern",exact:true}).click();
  assert.equal((await savedAgain).status(),200);
  reopened=await readWorkspace(f.database,f.ids.wave);
  assert.deepEqual(reopened.model,before);
  assert.deepEqual(reopened.entries,originalEntries);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log("PASS browser: active-only selection, bulk assignment, save/reopen, preserved historical sources and values, expired campaign, blocked new inactive assignments, mobile layout, no runtime errors");
} finally {
  if(browser) await browser.close();
  if(server) await new Promise(resolveClose=>server.close(resolveClose));
  await f.pg.close();
  await rm(output,{recursive:true,force:true});
}
