export type KurtiPerson = {id:string;label:string;role:string;firstName?:string};
const refs=/\[user:([0-9a-f-]{36})(:first)?\]/gi;
export function kurtiDisplayText(text:string, people:readonly KurtiPerson[]):string {
  const names=new Map(people.map(p=>[p.id.toLowerCase(),p]));
  return text.replace(refs,(original,id:string,first:string)=>{const p=names.get(id.toLowerCase());return p ? (first ? p.firstName || p.label : p.label) : original;})
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,(id)=>names.get(id.toLowerCase())?.label??id);
}
/** Display copies only: IDs, export filters, URLs and machine keys retain their exact values. */
export function kurtiDisplayPayload<T>(value:T, people:readonly KurtiPerson[], key=""):T {
  if(typeof value==="string")return (/^(id|key|.*Id|.*Ids|href|url|.*Url|path|.*Path|seriesKey)$/i.test(key)?value:kurtiDisplayText(value,people)) as T;
  if(Array.isArray(value))return value.map(v=>kurtiDisplayPayload(v,people,key)) as T;
  if(!value || typeof value!=="object")return value;
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==="filters"?v:kurtiDisplayPayload(v,people,k)])) as T;
}
export type MentionRange={start:number;end:number;id:string};
export function decodeKurtiDraft(value:string,people:readonly KurtiPerson[]) {
  const names=new Map(people.map(p=>[p.id.toLowerCase(),p.label]));
  const mentions:MentionRange[]=[];let display="",offset=0;
  for(const match of value.matchAll(refs)){
    display+=value.slice(offset,match.index);
    const label=names.get(match[1]!.toLowerCase());
    if(label){const start=display.length;display+=label;mentions.push({start,end:display.length,id:match[1]!});}else display+=match[0];
    offset=match.index!+match[0].length;
  }
  return {display:display+value.slice(offset),mentions};
}
export function encodeKurtiDraft(display:string,mentions:readonly MentionRange[]):string {
  let value=display;for(const m of [...mentions].sort((a,b)=>b.start-a.start))value=value.slice(0,m.start)+`[user:${m.id}]`+value.slice(m.end);return value;
}
export function editKurtiMentions(before:string,after:string,mentions:readonly MentionRange[]):MentionRange[] {
  let start=0;while(start<before.length && start<after.length && before[start]===after[start])start++;
  let tail=0;while(tail<before.length-start && tail<after.length-start && before[before.length-1-tail]===after[after.length-1-tail])tail++;
  const end=before.length-tail,delta=after.length-before.length;
  return mentions.flatMap(m=>m.end<=start?[m]:m.start>=end?[{...m,start:m.start+delta,end:m.end+delta}]:[]);
}
