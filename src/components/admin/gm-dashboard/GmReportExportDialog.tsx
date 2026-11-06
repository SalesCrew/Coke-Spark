"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownToLine, Check, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, LoaderCircle, Presentation, RefreshCw, X } from "lucide-react";
import { useRedMonth } from "@/context/RedMonthContext";
import { AdminControlPortal, AdminDatePicker, AdminDropdown, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { readAuthSession, requestGmDashboard } from "@/lib/api/backend";
import { calendarToday } from "@/lib/gm-dashboard/data";
import { reportPeriodChoices } from "@/lib/gm-report-periods";
import { reportBrands, type DashboardReport, type ReportMapping, type ReportRequest } from "@/lib/gm-report.shared";
import { reportSlides } from "@/lib/exports/gmReportSlides";
import type { DashboardExport } from "@/types/gm-dashboard";
import { ReportSlidePreview } from "./ReportSlidePreview";
import styles from "./gm-report-export.module.css";

const actor=()=>readAuthSession()?.user.id??"";
const fmt=(v:string)=>new Date(v+"T12:00:00Z").toLocaleDateString("de-AT",{timeZone:"Europe/Vienna"});
export function GmReportExportDialog({datasets,onClose,onExcel}:{datasets:DashboardExport[];onClose:()=>void;onExcel:()=>Promise<void>}){
  const {calendar,error:calendarError}=useRedMonth(),today=calendarToday();
  const dialogRef=useRef<HTMLDialogElement>(null),fetchRef=useRef<AbortController|null>(null),jobRef=useRef<AbortController|null>(null),principal=useRef(actor());
  const [portal,setPortal]=useState<HTMLDialogElement|null>(null),[kind,setKind]=useState<ReportRequest["kind"]>("availability"),[mode,setMode]=useState<"month"|"quarter">("month");
  const [ids,setIds]=useState<string[]>([]),[cutoff,setCutoff]=useState(today),[report,setReport]=useState<DashboardReport|null>(null),[error,setError]=useState("");
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[page,setPage]=useState(0),[mappingOpen,setMappingOpen]=useState(false),[mappings,setMappings]=useState<ReportMapping[]>([]),[retry,setRetry]=useState(0);
  const choices=useMemo(()=>reportPeriodChoices(calendar,kind==="availability"?"month":mode,today),[calendar,kind,mode,today]);
  const entry=datasets.find(d=>d.title===(kind==="availability"?"Fuellstand":"Platzierungen"));
  useEffect(()=>{
    const el=dialogRef.current;if(!el)return;const previous=document.activeElement as HTMLElement|null;
    el.showModal();setPortal(el);el.querySelector<HTMLElement>("h2")?.focus();
    return()=>{fetchRef.current?.abort();jobRef.current?.abort();el.close();previous?.focus();};
  },[]);
  useEffect(()=>{
    if(!choices.length)return;
    const wanted=kind==="availability"?1:3;
    setIds(old=>{
      const valid=old.filter(id=>choices.some(p=>p.id===id));
      if(valid.length&&valid.length<=wanted)return valid;
      const selected=entry?.data.points.find(p=>p.id===entry.selectedIntervalId);
      if(kind==="availability"&&selected){const matching=choices.find(p=>p.start<=selected.start&&p.end>=selected.start);if(matching)return[matching.id];}
      return choices.slice(-wanted).map(p=>p.id);
    });
  },[choices,kind,entry]);
  const selected=useMemo(()=>choices.filter(p=>ids.includes(p.id)).sort((a,b)=>a.start.localeCompare(b.start)),[choices,ids]);
  const minDate=selected[selected.length-1]?.start??today,maxDate=selected.length?selected[selected.length-1]!.end<today?selected[selected.length-1]!.end:today:today;
  useEffect(()=>{if(selected.length)setCutoff(old=>old<minDate||old>maxDate?maxDate:old);},[minDate,maxDate,selected.length]);
  const scope=entry?.data.scope;
  const requestKey=scope&&selected.length?JSON.stringify({kind,periods:selected,cutoff,scope,...(kind==="competitor"&&mappings.length?{mappings}:{})} satisfies ReportRequest):"";
  const load=useCallback(async(signal:AbortSignal):Promise<DashboardReport>=>{
    if(!requestKey)throw new Error("Die Dashboard-Filter werden noch geladen.");
    const result=await requestGmDashboard<DashboardReport>("/reports/query",JSON.parse(requestKey),signal);
    if(principal.current!==actor())throw new Error("Der angemeldete Zugang hat sich geändert.");
    return result;
  },[requestKey]);
  useEffect(()=>{
    fetchRef.current?.abort();setError("");setLoading(!!requestKey);setPage(0);
    if(!requestKey)return;
    const controller=new AbortController();fetchRef.current=controller;
    const timer=setTimeout(()=>{void load(controller.signal).then(data=>{if(!controller.signal.aborted)setReport(data);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Bericht konnte nicht geladen werden.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[load,requestKey,retry]);
  const slides=useMemo(()=>report?reportSlides(report):[],[report]);
  const hasData=!!report&&(kind==="availability"?Object.values(report.availability?.total.counts??{}).some(c=>c.total>0):(report.competitor?.countedAnswers??0)>0);
  const changeKind=(value:ReportRequest["kind"])=>{setReport(null);setKind(value);setIds([]);setMappings([]);setMappingOpen(false);};
  function changePeriod(index:number,value:string){setIds(old=>{const next=[...old];next[index]=value;return next.filter(Boolean);});setMappings([]);}
  function updateMapping(questionId:string,patch:Partial<ReportMapping>){
    const current=mappings.find(m=>m.questionId===questionId)??report?.competitor?.catalog.find(q=>q.questionId===questionId);
    if(!current)return;
    const next:ReportMapping={questionId,kind:current.kind,brand:current.brand,excluded:current.excluded,...patch};
    setMappings(old=>[...old.filter(m=>m.questionId!==questionId),next]);
  }
  async function download(){
    if(!hasData||busy)return;setBusy(true);setError("");const controller=new AbortController();jobRef.current=controller;
    try{
      const fresh=await load(controller.signal);if(controller.signal.aborted)return;setReport(fresh);
      const {dashboardPptxBlob,downloadReportBlob,reportFilename}=await import("@/lib/exports/gmReportPptx");
      const blob=await dashboardPptxBlob(fresh,controller.signal);
      if(!controller.signal.aborted&&principal.current===actor())downloadReportBlob(blob,reportFilename(fresh));
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"PowerPoint konnte nicht erstellt werden.");}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const scopeParts=scope?[scope.region?`Region ${scope.region}`:"Alle Regionen",...(scope.chains?.length?scope.chains:scope.chain?[scope.chain]:[]),...(scope.marketIds?.length?[`${scope.marketIds.length} Märkte`]:scope.marketId?["1 Markt"]:[]),...(scope.gmId?["1 GM"]:[]),...(scope.stc?[scope.stc.toUpperCase()]:[])]:[];
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="gm-export-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <AdminFilterControlStyles/><AdminControlPortal container={portal}>
      <header className={styles.header}><div><span className={styles.eyebrow}>GM DASHBOARD</span><h2 id="gm-export-title" tabIndex={-1}>PowerPoint exportieren</h2><p>Berichte im gewohnten Coke-Layout.</p></div><button type="button" aria-label="Export schließen" className={styles.iconButton} onClick={onClose}><X size={17}/></button></header>
      <div className={styles.body}>
        <aside className={styles.controls}>
          <div className={styles.kindSwitch} aria-label="Bericht auswählen">{([['availability','Verfügbarkeit'],['competitor','Mitbewerb']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={kind===value} disabled={busy} onClick={()=>changeKind(value)}>{label}</button>)}</div>
          <div className={styles.scope}><span>Filter aus {kind==="availability"?"Verfügbarkeit":"Platzierungen"}</span><strong>{scopeParts.join(" · ")||"Filter werden geladen …"}</strong></div>
          {kind==="competitor"&&<section className={styles.section}><label>Vergleich</label><div className={styles.modeSwitch}>{([['month','Monate'],['quarter','Quartale']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setIds([]);setMappings([]);}}>{label}</button>)}</div><p className={styles.hint}>Die Zeiträume folgen dem hinterlegten RED-Kalender.</p></section>}
          <section className={styles.section}><label>{kind==="availability"?"RED-Monat":"Vergleichszeiträume"}</label>
            {Array.from({length:kind==="availability"?1:3},(_,index)=><div className={styles.period} key={index}><AdminDropdown ariaLabel={kind==="availability"?"RED-Monat für Bericht":`Vergleichszeitraum ${index+1}`} placeholder="Zeitraum wählen" value={ids[index]??""} disabled={busy||!choices.length} searchable options={[...(kind==="competitor"?[{value:"",label:"Nicht vergleichen"}]:[]),...choices.filter(p=>p.id===ids[index]||!ids.includes(p.id)).slice().reverse().map(p=>({value:p.id,label:p.label,description:`${fmt(p.start)} – ${fmt(p.end)}`}))]} onChange={value=>changePeriod(index,value)}/></div>)}
            {calendarError&&<p className={styles.error}>{calendarError}</p>}
          </section>
          <section className={styles.section}><label>Stand einschließlich</label><AdminDatePicker ariaLabel="Berichtsstichtag" value={cutoff} minDate={minDate} maxDate={maxDate} onChange={setCutoff}/><p className={styles.hint}>Für einen Zwischenstand einen früheren Stichtag wählen.</p></section>
          {report&&<div className={styles.dataStatus}><Check size={13}/><span>{report.visitCount} Besuche · {report.uniqueMarketCount} unterschiedliche Märkte{report.kind==="availability"?` · ${report.photos.filter(p=>p.url).length} Fotos`:""}</span></div>}
          {kind==="competitor"&&report?.competitor&&<section className={styles.mapping}><button type="button" className={styles.mappingToggle} aria-expanded={mappingOpen} onClick={()=>setMappingOpen(v=>!v)}><span>Datenzuordnung</span><small>{report.competitor.countedAnswers}/{report.competitor.eligibleAnswers} Mengen</small><ChevronDown size={13} style={{transform:mappingOpen?"rotate(180deg)":undefined}}/></button>
            {mappingOpen&&<div className={styles.mappingList}><p className={styles.hint}>Gilt für diesen Export. Physische Mengen bleiben von Punkten getrennt.</p>{report.competitor.catalog.map(q=><div className={styles.mappingRow} key={q.questionId}><strong>{q.text}</strong><AdminDropdown compact ariaLabel={`Platzierungstyp für ${q.text}`} placeholder="Typ zuordnen" value={q.excluded?"excluded":q.kind??""} disabled={busy||loading} options={[{value:"",label:"Typ zuordnen"},{value:"cooler",label:"Kühler"},{value:"placement",label:"Großplatzierung"},{value:"excluded",label:"Nicht auswerten"}]} onChange={v=>updateMapping(q.questionId,{kind:v==="cooler"||v==="placement"?v:null,excluded:v==="excluded"})}/><AdminDropdown compact ariaLabel={`Marke für ${q.text}`} placeholder="Marke aus Antwort" value={q.brand??""} disabled={busy||loading||q.excluded} options={[{value:"",label:"Marke aus Antwort"},...reportBrands.map(b=>({value:b,label:b}))]} onChange={v=>updateMapping(q.questionId,{brand:v||null})}/></div>)}</div>}
          </section>}
          {report?.warnings.map((warning,i)=><p className={styles.warning} key={i}><AlertCircle size={13}/><span>{warning}</span></p>)}
          {error&&<div role="alert" className={styles.errorBox}><p>{error}</p><button type="button" disabled={busy} onClick={()=>setRetry(v=>v+1)}><RefreshCw size={12}/>Erneut versuchen</button></div>}
        </aside>
        <section className={styles.preview} aria-label="Folienvorschau" aria-busy={loading||busy}>
          <div className={styles.previewTop}><span>VORSCHAU</span>{slides.length>0&&<span>{page+1} / {slides.length}</span>}</div>
          {loading||!requestKey?<div className={styles.previewState}><LoaderCircle className={styles.spinner} size={24}/><strong>{!scope?"Dashboard-Filter werden geladen":"Bericht wird vorbereitet"}</strong></div>:
            error&&!report?<div className={styles.previewState}><AlertCircle size={24}/><strong>Vorschau konnte nicht geladen werden</strong><p>Bitte versuche es erneut.</p></div>:
            report&&!hasData?<div className={styles.previewState}><Presentation size={29} strokeWidth={1.3}/><strong>{kind==="competitor"&&report.visitCount?"Keine eindeutig erfassten Mengen":"Keine auswertbaren Daten"}</strong><p>{kind==="competitor"&&report.visitCount?"Prüfe die Datenzuordnung oder wähle einen anderen Zeitraum.":"Wähle einen anderen Zeitraum oder passe die Filter auf der Dashboardkarte an."}</p></div>:
            slides[page]?<div className={styles.slideFrame}><ReportSlidePreview slide={slides[page]!} label={`Folie ${page+1}: ${slides[page]!.title}`}/></div>:null}
          {slides.length>0&&hasData&&<><div className={styles.previewCaption}><span>{slides[page]?.title}</span><div><button type="button" aria-label="Vorherige Folie" disabled={page===0} onClick={()=>setPage(v=>v-1)}><ChevronLeft size={15}/></button><button type="button" aria-label="Nächste Folie" disabled={page>=slides.length-1} onClick={()=>setPage(v=>v+1)}><ChevronRight size={15}/></button></div></div><nav className={styles.thumbnails} aria-label="Folien auswählen">{slides.map((s,i)=><button key={i} type="button" aria-label={`Folie ${i+1} anzeigen`} aria-current={page===i?"page":undefined} onClick={()=>setPage(i)}><ReportSlidePreview slide={s} label={`Miniatur ${i+1}`}/><span>{i+1}</span></button>)}</nav></>}
        </section>
      </div>
      <footer className={styles.footer}><button type="button" className={styles.excel} disabled={busy} onClick={()=>{setBusy(true);setError("");void onExcel().then(onClose).catch(e=>setError(e instanceof Error?e.message:"Excel konnte nicht erstellt werden.")).finally(()=>setBusy(false));}}><FileSpreadsheet size={14}/>Stattdessen Excel exportieren</button><button type="button" className={styles.primary} disabled={busy||loading||!hasData||!!error} onClick={()=>void download()}>{busy?<LoaderCircle size={14} className={styles.spinner}/>:<ArrowDownToLine size={14}/>} {busy?"Export wird erstellt …":"PowerPoint herunterladen"}</button></footer>
    </AdminControlPortal>
  </dialog>;
}
