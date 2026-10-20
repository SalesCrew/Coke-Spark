import assert from "node:assert/strict";
import test from "node:test";
import {decodeKurtiDraft,encodeKurtiDraft,editKurtiMentions,kurtiDisplayPayload} from "../src/lib/kurti-identity";
const id="07542750-2848-4091-8240-927350000001",ref=`[user:${id}]`,people=[{id,label:"Annika Musterfrau",role:"sm"}];
test("mentions survive adjacent editing and become plain text when modified or pasted",()=>{
 const draft=decodeKurtiDraft(`Was macht ${ref}?`,people);assert.equal(draft.display,"Was macht Annika Musterfrau?");
 assert.equal(encodeKurtiDraft(draft.display,draft.mentions),`Was macht ${ref}?`);
 const prefix="Heute: "+draft.display;
 assert.equal(encodeKurtiDraft(prefix,editKurtiMentions(draft.display,prefix,draft.mentions)),`Heute: Was macht ${ref}?`);
 const modified=draft.display.replace("Annika","Anni");assert.deepEqual(editKurtiMentions(draft.display,modified,draft.mentions),[]);
 assert.equal(encodeKurtiDraft("Annika Musterfrau",[]),"Annika Musterfrau");
});
test("display resolves messages, tables and chart labels without touching IDs or export filters",()=>{
 const raw={content:`${ref} hat 12 Besuche.`,charts:[{title:ref,series:[{key:id,label:ref}],data:[{label:id,value:12}]}],exports:[{title:ref,filters:{gmUserId:id,search:ref}}],id,href:`/gm/${id}`};
 const displayed=kurtiDisplayPayload(raw,people);
 assert.equal(displayed.content,"Annika Musterfrau hat 12 Besuche.");assert.equal(displayed.charts[0].title,"Annika Musterfrau");assert.equal(displayed.charts[0].series[0].key,id);assert.equal(displayed.charts[0].data[0].label,"Annika Musterfrau");assert.deepEqual(displayed.exports[0].filters,raw.exports[0].filters);assert.equal(displayed.href,raw.href);assert.equal(raw.content,`${ref} hat 12 Besuche.`);
 assert.deepEqual(kurtiDisplayPayload(raw,[]),raw);
});

test("editing one mention preserves another identity and its shifted position",()=>{
 const second="07542750-2848-4091-8240-927350000002",users=[...people,{id:second,label:"Carolin Beispielsm",role:"sm"}];
 const draft=decodeKurtiDraft(`${ref} und [user:${second}]`,users),after=draft.display.replace("Annika","Anni");
 assert.equal(encodeKurtiDraft(after,editKurtiMentions(draft.display,after,draft.mentions)),`Anni Musterfrau und [user:${second}]`);
});
