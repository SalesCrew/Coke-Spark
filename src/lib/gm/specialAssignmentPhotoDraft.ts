"use client";
import { fetchTimeTrackingPhotos, getAuthPrincipalKey, readAuthSession, setTimeTrackingPhotoTags, uploadTimeTrackingPhoto } from "@/lib/api/backend";
export type SpecialAssignmentPhotoJob = { id: string; owner: string; draftKey: string; entryId?: string; file: File; tagIds: string[] };
export const SPECIAL_ASSIGNMENT_PHOTOS_CHANGED = "gm:special-assignment-photos";
const active = new Map<string,Promise<void>>();
let database: Promise<IDBDatabase> | null = null;
export function photoOwner() { const owner=getAuthPrincipalKey(readAuthSession()); if(!owner)throw Error("Bitte erneut anmelden.");return owner; }
function assertOwner(owner:string){if(owner!==photoOwner())throw Error("Der angemeldete Zugang hat sich geändert.");}
function openDatabase(){
  database??=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("coke_special_assignment_photo_drafts_v1",1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore("jobs",{keyPath:"id"});store.createIndex("owner","owner");};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=null;reject(Error("Fotos können auf diesem Gerät gerade nicht zwischengespeichert werden."));};});
  return database;
}
async function transact<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction("jobs",mode),request=action(tx.objectStore("jobs"));let result:T;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error("Foto konnte nicht zwischengespeichert werden."));tx.onabort=()=>reject(Error("Foto konnte nicht zwischengespeichert werden."));});
}
export async function readPhotoJobs(draftKey:string,entryId?:string){const owner=photoOwner();const rows=await transact<SpecialAssignmentPhotoJob[]>("readonly",store=>store.index("owner").getAll(owner));assertOwner(owner);return rows.filter(j=>j.draftKey===draftKey||!!entryId&&j.entryId===entryId);}
export async function savePhotoJob(job:SpecialAssignmentPhotoJob){assertOwner(job.owner);await transact("readwrite",store=>store.put(job));assertOwner(job.owner);window.dispatchEvent(new Event(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED));}
export async function deletePhotoJob(id:string){const owner=photoOwner();const job=await transact<SpecialAssignmentPhotoJob|undefined>("readonly",store=>store.get(id));assertOwner(owner);if(job&&job.owner!==owner)throw Error("Keine Berechtigung für dieses Foto.");await transact("readwrite",store=>store.delete(id));window.dispatchEvent(new Event(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED));}
function bindingKey(key:string){return `gm:special-photo-entry:${photoOwner()}:${key}`;}
export function readPhotoDraftBinding(key:string){return sessionStorage.getItem(bindingKey(key));}
export function bindPhotoDraft(key:string,entryId:string){sessionStorage.setItem(bindingKey(key),entryId);window.dispatchEvent(new Event(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED));}
export function specialAssignmentDraftKey(mode:"live"|"manual",reset=false){const key=`gm:special-photo-draft:${photoOwner()}:${mode}`;let value=reset?null:sessionStorage.getItem(key);if(!value){value=crypto.randomUUID();sessionStorage.setItem(key,value);}return value;}
function retryable(error:unknown){const status=(error as {status?:number})?.status;return error instanceof TypeError||error instanceof Error&&["AbortError","BackendTimeoutError"].includes(error.name)||status===408||status===429||!!status&&status>=500;}
export async function flushSpecialAssignmentPhotos(draftKey:string,entryId:string):Promise<void>{
  const owner=photoOwner(),key=`${owner}:${entryId}:${draftKey}`,existing=active.get(key);if(existing)return existing;
  const operation=(async()=>{
    bindPhotoDraft(draftKey,entryId);
    const jobs=await readPhotoJobs(draftKey,entryId);
    for(const job of jobs){
      assertOwner(owner);if(job.entryId&&job.entryId!==entryId)throw Error("Diese Fotos gehören bereits zu einem anderen Sondereinsatz.");
      await savePhotoJob({...job,entryId});
      for(let attempt=0;;attempt++){
        try{
          assertOwner(owner);const result=await uploadTimeTrackingPhoto(entryId,job.id,job.file);assertOwner(owner);
          const photo=result.photos.find(p=>p.id===job.id);if(!photo)throw Error("Foto konnte nicht bestätigt werden.");
          if(job.tagIds.length&&photo.revision===1)await setTimeTrackingPhotoTags(entryId,photo.id,photo.revision,job.tagIds);
          await deletePhotoJob(job.id);break;
        }catch(error){if(attempt>=2||!retryable(error))throw error;await new Promise(resolve=>setTimeout(resolve,[750,2000][attempt]));}
      }
    }
    await fetchTimeTrackingPhotos(entryId);assertOwner(owner);
  })();active.set(key,operation);try{await operation;}finally{active.delete(key);window.dispatchEvent(new Event(SPECIAL_ASSIGNMENT_PHOTOS_CHANGED));}
}
