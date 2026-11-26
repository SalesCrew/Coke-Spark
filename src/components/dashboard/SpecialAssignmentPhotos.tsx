"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ChevronLeft, ChevronRight, Clock, Image as ImageIcon, Loader2, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { fetchTimeEntryPhotoTags, fetchTimeTrackingPhotos, getAuthPrincipalKey, readAuthSession, removeTimeTrackingPhoto, setTimeTrackingPhotoTags, subscribeAuthSession } from "@/lib/api/backend";
import { deletePhotoJob, flushSpecialAssignmentPhotos, photoOwner, readPhotoDraftBinding, readPhotoJobs, savePhotoJob, SPECIAL_ASSIGNMENT_PHOTOS_CHANGED } from "@/lib/gm/specialAssignmentPhotoDraft";
import type { TimeEntryPhoto, TimeEntryPhotoTag } from "@/types/timeEntryPhotos";
import styles from "./SpecialAssignmentPhotos.module.css";

type Props = { groupKey: string; entryId?: string; compact?: boolean; disabled?: boolean; onBusyChange?: (busy: boolean) => void };
const fileUrl=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error("Foto konnte nicht gelesen werden."));r.readAsDataURL(file);});

export function SpecialAssignmentPhotos({ groupKey, entryId, compact = false, disabled = false, onBusyChange }: Props) {
  const [photos,setPhotos]=useState<TimeEntryPhoto[]>([]),[tags,setTags]=useState<TimeEntryPhotoTag[]>([]);
  const [open,setOpen]=useState(false),[activeId,setActiveId]=useState<string|null>(null),[tagPicker,setTagPicker]=useState(false),[search,setSearch]=useState("");
  const [error,setError]=useState<string|null>(null),[mutating,setMutating]=useState(false),[uploading,setUploading]=useState(false),[loading,setLoading]=useState(true);
  const [boundEntryId,setBoundEntryId]=useState<string|null>(entryId??null);
  const dialog=useRef<HTMLDialogElement>(null),gallery=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),sequence=useRef(0);
  const active=photos.find(p=>p.id===activeId),activeIndex=photos.findIndex(p=>p.id===activeId),busy=uploading||mutating;
  const hasPending=photos.some(p=>p.local);
  const load=useCallback(async()=>{
    const request=++sequence.current,owner=getAuthPrincipalKey(readAuthSession());
    if(!owner){setPhotos([]);setTags([]);setLoading(false);return;}
    const id=entryId??readPhotoDraftBinding(groupKey);
    try{
      const [jobs,result]=await Promise.all([readPhotoJobs(groupKey,id??undefined),id?fetchTimeTrackingPhotos(id):fetchTimeEntryPhotoTags().then(r=>({photos:[] as TimeEntryPhoto[],availableTags:r.tags}))]);
      const local=await Promise.all(jobs.filter(j=>!result.photos.some(p=>p.id===j.id)).map(async j=>({id:j.id,name:j.file.name,url:await fileUrl(j.file),uploadedAt:new Date(j.file.lastModified).toISOString(),revision:0,local:true,tags:j.tagIds.map(id=>result.availableTags.find(t=>t.id===id)).filter((t):t is TimeEntryPhotoTag=>!!t)})));
      if(request!==sequence.current||owner!==getAuthPrincipalKey(readAuthSession()))return;
      setPhotos([...result.photos,...local]);setTags(result.availableTags);setBoundEntryId(id);setLoading(false);
    }catch(e){if(request===sequence.current){setLoading(false);setError(e instanceof Error?e.message:"Fotos konnten nicht geladen werden.");}}
  },[groupKey,entryId]);
  const retry=useCallback(async()=>{
    const id=entryId??readPhotoDraftBinding(groupKey);if(!id){setError(null);await load();return;}
    setUploading(true);setError(null);
    try{await flushSpecialAssignmentPhotos(groupKey,id);await load();}catch(e){await load();setError(e instanceof Error?e.message:"Foto noch nicht übertragen. Bitte erneut versuchen.");}finally{setUploading(false);}
  },[groupKey,entryId,load]);
  useEffect(()=>{setLoading(true);void load();let principal=getAuthPrincipalKey(readAuthSession());const unsubscribe=subscribeAuthSession(()=>{const next=getAuthPrincipalKey(readAuthSession());if(next!==principal){principal=next;++sequence.current;setPhotos([]);setTags([]);close();void load();}});const refresh=()=>{void load();};window.addEventListener(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED,refresh);window.addEventListener("focus",refresh);return()=>{unsubscribe();++sequence.current;window.removeEventListener(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED,refresh);window.removeEventListener("focus",refresh);};},[load]);
  useEffect(()=>{
    if(!entryId)return;
    let current=true;const owner=getAuthPrincipalKey(readAuthSession());
    // Only resume actual queued uploads, not every historical photo collection.
    void readPhotoJobs(groupKey,entryId).then(jobs=>{if(current&&jobs.length&&owner===getAuthPrincipalKey(readAuthSession()))void retry();})
      .catch(e=>{if(current&&owner===getAuthPrincipalKey(readAuthSession()))setError(e instanceof Error?e.message:"Fotos konnten nicht geladen werden.");});
    return()=>{current=false;};
  },[entryId,groupKey,retry]);
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  function close(){setOpen(false);setActiveId(null);setTagPicker(false);setSearch("");}
  async function selectFiles(files:File[]){
    setError(null);setUploading(true);
    try{
      const owner=photoOwner();
      for(const file of files){
        if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)&&!(!file.type&&/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)))throw Error("Bitte ein JPG-, PNG-, WebP- oder HEIC-Foto auswählen.");
        if(!file.size||file.size>10*1024*1024)throw Error("Ein Foto darf maximal 10 MB groß sein.");
        const bytes=await file.arrayBuffer(),mime=file.type||(/\.png$/i.test(file.name)?"image/png":/\.webp$/i.test(file.name)?"image/webp":/\.hei[cf]$/i.test(file.name)?"image/heic":"image/jpeg");
        await savePhotoJob({id:crypto.randomUUID(),owner,draftKey:groupKey,...(boundEntryId?{entryId:boundEntryId}:{}),file:new File([bytes],file.name,{type:mime,lastModified:file.lastModified}),tagIds:[]});
      }
      await load();const id=entryId??readPhotoDraftBinding(groupKey);if(id)await flushSpecialAssignmentPhotos(groupKey,id);await load();
    }catch(e){await load();setError(e instanceof Error?e.message:"Foto konnte nicht gespeichert werden.");}finally{setUploading(false);if(gallery.current)gallery.current.value="";if(camera.current)camera.current.value="";}
  }
  async function toggleTag(id:string){
    if(!active||busy)return;setMutating(true);setError(null);
    try{
      const selected=active.tags.map(t=>t.id),tagIds=selected.includes(id)?selected.filter(t=>t!==id):[...selected,id];
      if(active.local){const job=(await readPhotoJobs(groupKey,boundEntryId??undefined)).find(j=>j.id===active.id);if(!job)throw Error("Bitte Foto erneut öffnen.");await savePhotoJob({...job,tagIds});}
      else{if(!boundEntryId)throw Error("Sondereinsatz nicht gefunden.");await setTimeTrackingPhotoTags(boundEntryId,active.id,active.revision,tagIds);}
      await load();
    }catch(e){await load();setError(e instanceof Error?e.message:"Tag konnte nicht gespeichert werden.");}finally{setMutating(false);}
  }
  async function remove(){
    if(!active||busy)return;setMutating(true);setError(null);
    try{if(active.local)await deletePhotoJob(active.id);else{if(!boundEntryId)throw Error("Sondereinsatz nicht gefunden.");await removeTimeTrackingPhoto(boundEntryId,active.id,active.revision);}setActiveId(null);setTagPicker(false);await load();}
    catch(e){setError(e instanceof Error?e.message:"Foto konnte nicht entfernt werden.");}finally{setMutating(false);}
  }
  function navigate(delta:number){if(!photos.length)return;setActiveId(photos[(activeIndex+delta+photos.length)%photos.length].id);setTagPicker(false);setSearch("");}

  return <>
    {compact ? <span role="button" tabIndex={0} className={styles.badge} aria-label={`Sondereinsatz: ${photos.length} Fotos öffnen`} onClick={e => { e.stopPropagation(); setOpen(true); void load(); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); void load(); } }}><Camera size={12} strokeWidth={1.7} /><span className={styles.count}>{loading ? "…" : photos.length || "+"}</span></span> : <button type="button" className={styles.entry} disabled={disabled} aria-label="Fotos zum Sondereinsatz öffnen" onClick={e => { e.stopPropagation(); setOpen(true); void load(); }}>
      <Camera size={13} strokeWidth={1.7} /><span>{photos.length ? "Fotos zum Einsatz" : "Fotos hinzufügen"}</span>
      {photos.some(p=>p.url) && <span className={styles.miniPhotos}>{photos.filter(p=>p.url).slice(0, 2).map(p => <img key={p.id} src={p.url!} alt="" />)}</span>}
      <span className={styles.count}>{loading ? "…" : photos.length || "Optional"}</span><ChevronRight size={12} className={styles.chevron} />
    </button>}
    {open && typeof document !== "undefined" && createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="special-assignment-photo-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }} onKeyDown={e => { if (e.target instanceof HTMLInputElement) return; if (e.key === "ArrowLeft" && active) navigate(-1); if (e.key === "ArrowRight" && active) navigate(1); }}>
      <div className={styles.shell}>
        <header className={styles.header}>
          {active && <button type="button" className={styles.iconButton} aria-label="Zur Fotoübersicht" onClick={() => { setActiveId(null); setTagPicker(false); }}><ChevronLeft size={16} /></button>}
          <div className={styles.heading}><span>Sondereinsatz</span><h2 id="special-assignment-photo-title">{active ? `Foto ${activeIndex + 1} von ${photos.length}` : "Fotos zum Einsatz"}</h2></div>
          <button type="button" className={styles.iconButton} aria-label="Fotoansicht schließen" onClick={close}><X size={16} /></button>
        </header>
        <div className={styles.body}>
          {error && <div className={styles.error} role="alert">{error}<button onClick={() => void retry()}>Erneut versuchen</button></div>}
          {photos.some(p=>p.previewError) && <div className={styles.error} role="status">Die Fotovorschau ist gerade nicht verfügbar. Der Fotoeintrag bleibt erhalten. Eine fehlende Vorschau verhindert den Abschluss nicht.<button type="button" disabled={busy} onClick={()=>void load()}>Vorschau erneut laden</button></div>}
          {!active ? <>
            <div className={styles.sources}>
              <button type="button" disabled={busy} onClick={() => camera.current?.click()}><Camera size={16} strokeWidth={1.7} /><span>Foto aufnehmen</span></button>
              <button type="button" disabled={busy} onClick={() => gallery.current?.click()}><ImageIcon size={16} strokeWidth={1.7} /><span>Aus Galerie</span><Plus size={13} /></button>
            </div>
            {loading ? <p className={styles.hint}>Fotos werden geladen…</p> : photos.length === 0 && <div className={styles.empty}><div><Camera size={23} strokeWidth={1.2} /></div><p>Den Einsatz mit Fotos dokumentieren.</p><span>Mehrere Fotos möglich · bis 10 MB pro Foto</span></div>}
            {(photos.length > 0) && <div className={styles.grid}>
              {photos.map((photo, index) => <button key={photo.id} type="button" className={styles.tile} onClick={() => { setActiveId(photo.id); setTagPicker(false); }}>
                <span className={styles.thumbnail}>{photo.url ? <img src={photo.url} alt={`Sondereinsatz, Foto ${index + 1}`} /> : <span className={styles.unavailablePreview}><Camera size={20} /><small>Vorschau nicht verfügbar</small></span>}<span className={styles.savedMark}>{photo.local ? <Clock size={10} /> : <Check size={10} strokeWidth={2.4} />}</span></span>
                <span className={styles.tileCaption}><span>Foto {index + 1}</span><span>{photo.tags.length ? <><Tag size={10} />{photo.tags.length}</> : <Tag size={10} />}</span></span>
                {photo.tags.length > 0 && <span className={styles.tileTags}>{photo.tags.map(t=>t.label).join(" · ")}</span>}
              </button>)}

            </div>}
          </> : <>
            <div className={styles.stage}>
              {active.url ? <img src={active.url} alt={`Sondereinsatz, Foto ${activeIndex + 1}`} /> : <span className={styles.unavailablePreview}><Camera size={24} /><small>Vorschau nicht verfügbar</small></span>}
              {photos.length > 1 && <><button className={styles.prev} aria-label="Vorheriges Foto" onClick={() => navigate(-1)}><ChevronLeft size={19} /></button><button className={styles.next} aria-label="Nächstes Foto" onClick={() => navigate(1)}><ChevronRight size={19} /></button></>}
            </div>
            <div className={styles.photoMeta}><span>{active.name}</span><button type="button" disabled={mutating} onClick={() => void remove()} aria-label="Dieses Foto entfernen"><Trash2 size={13} />Entfernen</button></div>
            <div className={styles.tagArea}>
              <div className={styles.tagHeading}><span>Tags <small>Optional</small></span><button type="button" aria-expanded={tagPicker} onClick={() => setTagPicker(current => !current)}><Plus size={12} />Tags auswählen</button></div>
              {active.tags.length > 0 && <div className={styles.selectedTags}>{active.tags.map(tag => <button type="button" key={tag.id} disabled={busy} onClick={() => void toggleTag(tag.id)} aria-label={`Tag ${tag.label} entfernen`}><Tag size={10} />{tag.label}<X size={10} /></button>)}</div>}
              {tagPicker && <div className={styles.tagPicker}><label className={styles.search}><Search size={12} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Tag suchen" aria-label="Tags durchsuchen" /></label><div className={styles.tagOptions}>{tags.filter(t => t.label.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).map(tag => <button type="button" key={tag.id} aria-pressed={active.tags.some(t=>t.id===tag.id)} disabled={busy} onClick={() => void toggleTag(tag.id)}>{tag.label}<span>{active.tags.some(t=>t.id===tag.id) ? <Check size={12} /> : <Plus size={12} />}</span></button>)}{!tags.some(t => t.label.toLowerCase().includes(search.toLowerCase())) && <p>Kein passender Tag.</p>}</div></div>}
            </div>
          </>}
        </div>
        <footer className={styles.footer}><span aria-live="polite">{busy ? <><Loader2 size={11} className={styles.spinner} />Wird gespeichert…</> : hasPending ? `${photos.length} ${photos.length === 1 ? "Foto" : "Fotos"} ${boundEntryId ? "noch nicht übertragen" : "ausgewählt"}` : photos.length ? <><Check size={12} />{photos.length === 1 ? "1 Foto gespeichert" : `${photos.length} Fotos gespeichert`}</> : "Fotos sind optional"}</span><button type="button" onClick={close}>Fertig<Check size={12} /></button></footer>
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={e => void selectFiles(Array.from(e.target.files ?? []))} aria-label="Fotos aus Galerie auswählen" />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => void selectFiles(Array.from(e.target.files ?? []))} aria-label="Foto mit Kamera aufnehmen" />
      </div>
    </dialog>, document.body)}
  </>;
}
