"use client";
import { forwardRef, useEffect, useId, useRef, useState, type TextareaHTMLAttributes } from "react";
import { fetchKurtiPeople } from "@/lib/api/backend";
import { decodeKurtiDraft, editKurtiMentions, encodeKurtiDraft, type KurtiPerson } from "@/lib/kurti-identity";
type Props=Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,"value"|"onChange"> & {value:string;onChange:(value:string)=>void;onDisplayChange:(value:string)=>void;workspace:"gm"|"sm";audience:"worker"|"admin"};
const fold=(s:string)=>s.normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase("de-AT");
export const KurtiMessageInput=forwardRef<HTMLTextAreaElement,Props>(function KurtiMessageInput({value,onChange,onDisplayChange,workspace,audience,onKeyDown,style,...props},forwardedRef){
 const ref=useRef<HTMLTextAreaElement|null>(null),listRef=useRef<HTMLDivElement|null>(null),listId=useId();
 const [people,setPeople]=useState<KurtiPerson[]>([]),[loadState,setLoadState]=useState("loading"),[caret,setCaret]=useState(0),[focused,setFocused]=useState(false),[dismissed,setDismissed]=useState(false),[active,setActive]=useState(0);
 useEffect(()=>{let live=true;setLoadState("loading");setPeople([]);void fetchKurtiPeople(workspace,audience).then(p=>{if(live){setPeople(p.people);setLoadState("ready");}},()=>{if(live)setLoadState("error");});return()=>{live=false;};},[workspace,audience]);
 const draft=decodeKurtiDraft(value,people);
 useEffect(()=>onDisplayChange(draft.display),[draft.display,onDisplayChange]);
 const match=draft.display.slice(0,caret).match(/(?:^|\s)@([^\s@]*)$/u),open=focused&&!dismissed&&Boolean(match),query=fold(match?.[1]??"");
 const options=people.filter(p=>fold(p.label).includes(query)).sort((a,b)=>Number(!fold(a.label).startsWith(query))-Number(!fold(b.label).startsWith(query))||a.label.localeCompare(b.label,"de-AT")).slice(0,8),selected=Math.min(active,Math.max(0,options.length-1));
 useEffect(()=>{
  const list=listRef.current,option=document.getElementById(`${listId}-${selected}`);
  if(!open||!list||!option)return;
  // Scroll only the suggestions; scrollIntoView would move the sliding chat's hidden ancestors.
  if(option.offsetTop<list.scrollTop)list.scrollTop=option.offsetTop;
  else if(option.offsetTop+option.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=option.offsetTop+option.offsetHeight-list.clientHeight;
 },[open,listId,selected]);
 function choose(person:KurtiPerson){
  if(!match)return;const start=caret-match[1]!.length-1,display=draft.display.slice(0,start)+person.label+" "+draft.display.slice(caret),kept=editKurtiMentions(draft.display,display,draft.mentions);
  onChange(encodeKurtiDraft(display,[...kept,{start,end:start+person.label.length,id:person.id}]));onDisplayChange(display);setDismissed(true);const next=start+person.label.length+1;setCaret(next);
  requestAnimationFrame(()=>{ref.current?.focus({preventScroll:true});ref.current?.setSelectionRange(next,next);});
 }
 return <div style={{position:"relative",flex:1,minWidth:0}}>
  {open&&<div ref={listRef} className="map-scroll" style={{position:"absolute",bottom:"calc(100% + 6px)",left:0,width:"min(260px,100%)",maxHeight:240,overflowY:"auto",border:"1px solid #e5e7eb",borderRadius:10,background:"#fff",boxShadow:"0 4px 16px #0f172a1c",padding:4,zIndex:5}}>
   <div id={listId} role="listbox" aria-label="Personenvorschläge">
    {options.map((person,index)=><button key={person.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={index===selected} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(person)} onPointerMove={()=>setActive(index)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",minHeight:34,padding:"5px 8px",border:0,borderRadius:6,textAlign:"left",background:index===selected?"#f1f2f4":"transparent",color:"#1f2937",cursor:"pointer"}}>
     <span aria-hidden="true" style={{width:24,height:24,flex:"0 0 24px",borderRadius:"50%",display:"grid",placeItems:"center",fontSize:9,fontWeight:600,color:"#64748b",background:"#e5e7eb"}}>{person.label.split(/\s+/).map(p=>p[0]).slice(0,2).join("")}</span>
     <span style={{minWidth:0,flex:1}}><span style={{display:"block",fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{person.label}</span></span>
    </button>)}
    {!options.length&&<div role="status" style={{padding:"12px 8px",fontSize:11,color:"#64748b"}}>{loadState==="loading"?"Personen werden geladen…":loadState==="error"?"Personen konnten nicht geladen werden. Chat erneut öffnen.":"Keine passende Person."}</div>}
   </div>
  </div>}
  <textarea autoComplete="off" spellCheck={false} {...props} ref={node=>{ref.current=node;if(typeof forwardedRef==="function")forwardedRef(node);else if(forwardedRef)forwardedRef.current=node;}} value={draft.display} rows={props.rows??1} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open&&options.length?`${listId}-${selected}`:undefined}
   onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onSelect={e=>setCaret(e.currentTarget.selectionStart)}
   onChange={e=>{const display=e.target.value,mentions=editKurtiMentions(draft.display,display,draft.mentions);onChange(encodeKurtiDraft(display,mentions));onDisplayChange(display);setCaret(e.target.selectionStart);setDismissed(false);setActive(0);}}
   onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(open){if(["ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();setActive((selected+(e.key==="ArrowDown"?1:-1)+Math.max(1,options.length))%Math.max(1,options.length));return;}if(e.key==="Enter"){e.preventDefault();if(options[selected])choose(options[selected]);return;}if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setDismissed(true);return;}if(e.key==="Tab")setDismissed(true);}if(onKeyDown)onKeyDown(e);else if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ref.current?.form?.requestSubmit();}}}
   style={{...style,display:"block",width:"100%",resize:"none"}} />
 </div>;
});
