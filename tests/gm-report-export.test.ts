import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import request from "../backend/node_modules/supertest/index.js";
import JSZip from "jszip";
import {reportFixture,emptyReportScope} from "../backend/tests/gm-report-fixture";
import {writeDashboardPptx,reportArtwork} from "../src/lib/exports/gmReportPptx";
import {reportSlides} from "../src/lib/exports/gmReportSlides";
import {reportPeriodChoices} from "../src/lib/gm-report-periods";
import type {DashboardReport} from "../src/lib/gm-report.shared";

test("report period choices reuse configured RED boundaries, never calendar-quarter guesses",()=>{
 const periods=Array.from({length:12},(_,i)=>({id:`p${i+1}`,redPeriodId:null,redMonthYearId:null,label:`RED ${i+1}`,periodIndexFromAnchor:i,periodIndex:i+1,start:`2026-${String(i+1).padStart(2,'0')}-02`,end:i===8?"2026-10-02":`2026-${String(i+1).padStart(2,'0')}-27`,year:2026,status:"active" as const,isCurrent:false,daysUntilEnd:0}));
 const quarters=reportPeriodChoices(periods,"quarter","2026-11-06");assert.equal(quarters[2]?.end,"2026-10-02");assert.equal(quarters[3]?.end,"2026-12-27");
 assert.equal(reportPeriodChoices(periods,"month","2026-11-06").length,11);
});
test("frontend and backend report contract stay identical",async()=>{
 const front=(await readFile("src/lib/gm-report.shared.ts","utf8")).replaceAll('"@/types/gm-dashboard"','"./gm-dashboard.shared.js"').replaceAll('"@/lib/availability.shared"','"./gm-availability.shared.js"');
 assert.equal(front,await readFile("backend/src/gm-report.shared.ts","utf8"));
});
test("API → actual native PowerPoint exports, embedded data and complete tables",async()=>{
 const f=await reportFixture();
 try{
  const images:Record<string,string>={};for(const name of reportArtwork)images[name]=`data:image/${name.endsWith('.jpg')?'jpeg':'png'};base64,${(await readFile(`public/gm-reports/${name}`)).toString('base64')}`;
  const modes=[{name:"Verfuegbarkeit",kind:"availability",periods:[{id:"oct",label:"RED Oktober 2026",start:"2026-10-05",end:"2026-10-30"}],cutoff:"2026-10-20"},
   {name:"Mitbewerb_Monate",kind:"competitor",periods:[{id:"aug",label:"RED August 2026",start:"2026-08-03",end:"2026-08-28"},{id:"sep",label:"RED September 2026",start:"2026-08-31",end:"2026-10-02"},{id:"oct",label:"RED Oktober 2026",start:"2026-10-05",end:"2026-10-30"}],cutoff:"2026-10-20"},
   {name:"Mitbewerb_Quartale",kind:"competitor",periods:[{id:"q2",label:"Q2/2026",start:"2026-04-06",end:"2026-07-03"},{id:"q3",label:"Q3/2026",start:"2026-07-06",end:"2026-10-02"},{id:"q4",label:"Q4/2026",start:"2026-10-05",end:"2026-12-31"}],cutoff:"2026-10-20"}];
  await mkdir("outputs/gm-dashboard-reports-20261106",{recursive:true});
  for(const mode of modes){
   const res=await request(f.app).post("/admin/gm-dashboard/reports/query").set("Authorization","Bearer synthetic-admin").send({...mode,name:undefined,scope:emptyReportScope});assert.equal(res.status,200,JSON.stringify(res.body));
   const report=res.body as DashboardReport;
   const bytes=await writeDashboardPptx(report,images);
   const file=resolve(`outputs/gm-dashboard-reports-20261106/${mode.name}.pptx`);await writeFile(file,bytes);await writeFile(file.replace('.pptx','.json'),JSON.stringify(report,null,2));
   const zip=await JSZip.loadAsync(bytes),files=Object.keys(zip.files),slides=files.filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p));
   assert.equal(slides.length,reportSlides(report).length);assert.equal(slides.length,mode.kind==="availability"?7:4);
   const manifest=await zip.file('[Content_Types].xml')!.async('string');
   for(const part of manifest.matchAll(/PartName="([^"]+)"/g))assert.ok(zip.file(part[1]!.slice(1)),`Manifest target exists: ${part[1]}`);
   const pres=await zip.file('ppt/presentation.xml')!.async('string');assert.match(pres,/cx="12192000" cy="6858000"/);
   const chartFiles=files.filter(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p));assert.equal(chartFiles.length,mode.kind==="availability"?10:2);
   assert.equal(files.filter(p=>/^ppt\/embeddings\/.*\.xlsx$/.test(p)).length,chartFiles.length);
   const tables=(await Promise.all(slides.map(p=>zip.file(p)!.async('string')))).join('');assert.equal((tables.match(/<a:tbl>/g)??[]).length,mode.kind==="availability"?4:4);
   const charts=(await Promise.all(chartFiles.map(p=>zip.file(p)!.async('string')))).join('');assert.doesNotMatch(charts,/<c:v>(?:777|999)<\/c:v>/);
   assert.match(charts,mode.kind==="availability"?/<c:numFmt formatCode="0%"/:/RED|Q3/);
   const xml=(await Promise.all(files.filter(p=>/\.xml$/.test(p)).map(p=>zip.file(p)!.async('string')))).join('');assert.doesNotMatch(xml,/supabase\.co|storage\/v1|Bearer |synthetic\/.*\.svg/);
   if(mode.name==="Mitbewerb_Quartale") {
     const sparse=structuredClone(report);sparse.competitor!.cooler[0]!.values[0]=null;
     const sparseZip=await JSZip.loadAsync(await writeDashboardPptx(sparse,images));
     const chartName=Object.keys(sparseZip.files).find(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p))!;
     const xml=await sparseZip.file(chartName)!.async('string');
     const firstSeries=xml.match(/<c:ser>([\s\S]*?)<\/c:ser>/)![1]!;
     const numericCache=firstSeries.match(/<c:numCache>([\s\S]*?)<\/c:numCache>/)![1]!;
     assert.doesNotMatch(numericCache,/<c:pt idx="0">/);assert.match(numericCache,/<c:ptCount val="10"/);
     const embedding=Object.keys(sparseZip.files).find(p=>p.endsWith('.xlsx'))!;
     const workbook=await JSZip.loadAsync(await sparseZip.file(embedding)!.async('uint8array'));
     assert.match(await workbook.file('xl/worksheets/sheet1.xml')!.async('string'),/<c r="B2"><v><\/v><\/c>/);
   }
   console.info(`Verified ${mode.name}: ${slides.length} slides, ${chartFiles.length} native charts with workbooks`);
  }
 }finally{await f.close();}
});
