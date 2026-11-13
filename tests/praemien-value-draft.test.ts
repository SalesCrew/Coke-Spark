import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftIsDirty, valueDraft, valueChanges, reconcileValueDraft } from '../src/lib/praemien-value-draft.ts';
import type { Workspace } from '../src/types/praemien-workspace.ts';

// Entirely synthetic contract fixture; no env loading, network or DB client.
function fixture(): Workspace {
  const metric = { key:'percent',label:'Zielerreichung',method:'answer_sum',unit:'percent',inputs:[],target:null,sources:[],steps:[] };
  return structuredClone({ wave:{id:'wave',status:'active'},revision:10,closedAt:null,
    model:{version:1,provenance:'synthetic',pillars:[{key:'ziel',name:'Schütten / Displays',kind:'displays',metrics:[metric]}]},
    entries:[{gmId:'gm',pillarKey:'ziel',metricKey:'percent',value:85,target:90,note:'vorhanden',rawPoints:12},
      {gmId:'other',pillarKey:'ziel',metricKey:'percent',value:50,target:100,note:'fremd'}],
    results:['gm','other'].map(gmId=>({gmId,pillars:[{key:'ziel',metrics:[{key:'percent'}]}]})),
  } as Workspace);
}
const key='ziel/percent';
test('retains typed input and adopts untouched foreign fields, never mutates snapshots',()=>{
  const before=fixture(), draft=valueDraft(before,'gm'), latest=structuredClone(before);
  draft[key].target='83,5593';
  Object.assign(latest.entries[0],{value:97.66,note:'von anderem Admin',rawPoints:44}); latest.entries[1].target=120; latest.revision++;
  const original=JSON.stringify({before,draft,latest});
  const merged=reconcileValueDraft(before,latest,'gm',draft);
  assert.equal(merged.blocked,null);assert.deepEqual(merged.conflicts,[]);
  assert.equal(merged.draft[key].target,'83,5593');assert.equal(merged.draft[key].value,'97,66');
  assert.deepEqual(valueChanges(latest,'gm',merged.draft),[{gmId:'gm',pillarKey:'ziel',metricKey:'percent',target:83.5593,value:97.66,note:'von anderem Admin',rawPoints:44}]);
  assert.equal(JSON.stringify({before,draft,latest}),original);
});
test('same-field conflicts keep both candidates, explicit current choice removes local write',()=>{
  const before=fixture(), latest=structuredClone(before), draft=valueDraft(before,'gm');
  draft[key].target='80'; latest.entries[0].target=75;
  const r=reconcileValueDraft(before,latest,'gm',draft);
  assert.deepEqual(r.conflicts,[{id:key,field:'target',label:'Zielerreichung · Persönlicher Sollwert',current:'75',mine:'80'}]);
  assert.equal(r.draft[key].target,'80');r.draft[key].target=r.conflicts[0].current;
  assert.deepEqual(valueChanges(latest,'gm',r.draft),[]);
});
test('same value concurrently entered is already saved; equivalent numeric formatting is clean',()=>{
  const before=fixture(), latest=structuredClone(before), draft=valueDraft(before,'gm');
  draft[key].target='80,00';latest.entries[0].target=80;
  const r=reconcileValueDraft(before,latest,'gm',draft);assert.deepEqual(r.conflicts,[]);
  assert.equal(draftIsDirty(latest,'gm',r.draft),false);
  draft[key].target=' 90,000 ';assert.equal(draftIsDirty(before,'gm',draft),false);
});
test('zero, explicit clears and partial invalid input are retained',()=>{
  const before=fixture(), latest=structuredClone(before), draft=valueDraft(before,'gm');
  draft[key].value='0';draft[key].rawPoints='';draft[key].target='';draft[key].note='';
  let r=reconcileValueDraft(before,latest,'gm',draft);
  assert.deepEqual(valueChanges(latest,'gm',r.draft),[{gmId:'gm',pillarKey:'ziel',metricKey:'percent',value:0,target:null,note:'',rawPoints:null}]);
  draft[key].target='1,2,3';r=reconcileValueDraft(before,latest,'gm',draft);
  assert.equal(r.draft[key].target,'1,2,3');assert.equal(draftIsDirty(latest,'gm',r.draft),true);
  assert.throws(()=>valueChanges(latest,'gm',r.draft),/gültige Zahlen/);
});
test('a second conflict uses the rebased revision and retains the first local edit',()=>{
  const before=fixture(), middle=structuredClone(before), draft=valueDraft(before,'gm');draft[key].target='80';middle.revision++;
  const first=reconcileValueDraft(before,middle,'gm',draft), latest=structuredClone(middle);latest.entries[0].target=70;latest.revision++;
  const second=reconcileValueDraft(middle,latest,'gm',first.draft);
  assert.equal(second.conflicts[0].mine,'80');assert.equal(second.conflicts[0].current,'70');
});
test('another employee exception and cosmetic changes do not reinterpret this employee',()=>{
  const before=fixture(), latest=structuredClone(before), draft=valueDraft(before,'gm');draft[key].target='80';
  const m=latest.model!.pillars[0].metrics[0];m.sourceSectionOverrides=[{gmId:'other',sections:['standard','flex','billa']}];m.label='Neuer Titel';m.hint='Hinweis';
  assert.equal(reconcileValueDraft(before,latest,'gm',draft).blocked,null);
});
for (const [name,change] of Object.entries({
  timeframe:(w:Workspace)=>{w.wave.endDate='2026-12-20'},
  closed:(w:Workspace)=>{w.closedAt='2026-11-13T10:00:00Z'},
  archived:(w:Workspace)=>{w.wave.status='archived'},
  removedEmployee:(w:Workspace)=>{w.results=w.results.filter(g=>g.gmId!=='gm')},
  removedMetric:(w:Workspace)=>{w.model!.pillars[0].metrics=[]},
  unit:(w:Workspace)=>{w.model!.pillars[0].metrics[0].unit='count'},
  method:(w:Workspace)=>{w.model!.pillars[0].metrics[0].method='manual'},
  readOnly:(w:Workspace)=>{w.model!.pillars[0].metrics[0].readOnly=true},
  ownScope:(w:Workspace)=>{w.model!.pillars[0].metrics[0].sourceSectionOverrides=[{gmId:'gm',sections:['standard','billa']}]},
  weight:(w:Workspace)=>{w.model!.pillars[0].metrics[0].weights={source:2}},
})) test(`blocks ${name} and retains original text`,()=>{
  const before=fixture(),latest=structuredClone(before),draft=valueDraft(before,'gm');draft[key].target='80,1234';change(latest);
  const result=reconcileValueDraft(before,latest,'gm',draft);
  assert.ok(result.blocked);assert.equal(result.draft[key].target,'80,1234');
});
test('validates personal targets and configured manual limits before any request',()=>{
  const w=fixture(),d=valueDraft(w,'gm');d[key].target='0';assert.throws(()=>valueChanges(w,'gm',d),/größer/);
  d[key].target='80';w.model!.pillars[0].metrics[0].maxValue=100;d[key].value='101';assert.throws(()=>valueChanges(w,'gm',d),/zulässigen/);
});

test('changed input metric rules are protected without blocking unrelated metrics',()=>{
  const before=fixture();const m=before.model!.pillars[0].metrics[0];m.method='ratio';m.inputs=['points'];
  before.model!.pillars[0].metrics.push({...m,key:'points',method:'manual',unit:'points',inputs:[]});
  const d=valueDraft(before,'gm');d[key].target='80';const latest=structuredClone(before);
  latest.model!.pillars[0].metrics[1].maxValue=20;assert.ok(reconcileValueDraft(before,latest,'gm',d).blocked);
});
test('interior whitespace is not silently converted to a number',()=>{
  const w=fixture(),d=valueDraft(w,'gm');d[key].target='1 0';assert.throws(()=>valueChanges(w,'gm',d),/gültige Zahlen/);
});
