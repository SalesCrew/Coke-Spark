import { fetchSmKurtiExport, getAuthPrincipalKey, readAuthSession, type SmKurtiExport } from "@/lib/api/backend";
import { appendMetaSheet, appendTableSheet, buildAndDownloadWorkbook, fileSafeName } from "./workbook";
export function describeSmKurtiExport(spec:SmKurtiExport):string[]{
 const f=spec.filters;
 return ["SM",f.scope==="SMDurcharbeit"?"Durcharbeit":f.scope==="standard"?"Standard":null,
 f.from&&f.to?f.from+" – "+f.to:f.month,f.chain,f.region,f.search].filter((s):s is string=>Boolean(s));
}
const labels:Record<string,string>={name:"Name",market:"Markt",smName:"SM",date:"Datum",status:"Status",actualMinutes:"Leistungsminuten",
 travelMinutes:"Fahrtminuten",startedAt:"Beginn",completedAt:"Ende",submittedAt:"Abgeschlossen",questionnaire:"Fragebogen",
 version:"Version",question:"Frage",value:"Antwort",outcome:"Zuordnung",observations:"Beobachtungen",visits:"Besuche",
 chain:"Handelskette",address:"Adresse",postalCode:"PLZ",city:"Ort",region:"Region",plannedMinutes:"Sollminuten",completed:"Erledigt",
 eligibility:"Zielstatus",campaignName:"Kampagne",month:"Monat",smUserId:"SM-ID",marketId:"Markt-ID",visitCount:"Besuche"};
export async function runSmKurtiExport(spec:SmKurtiExport){
 const owner=getAuthPrincipalKey(readAuthSession());
 const data=await fetchSmKurtiExport(spec);
 const keys=[...new Set(data.rows.flatMap(Object.keys))].filter(key=>key!=="totalMatches");
 await buildAndDownloadWorkbook({filename:fileSafeName(spec.title)+".xlsx",build:({XLSX,wb})=>{
  if(!owner || owner!==getAuthPrincipalKey(readAuthSession()))throw new Error("Der angemeldete Zugang hat sich geändert.");
  appendMetaSheet(XLSX,wb,[{label:"Auswertung",value:data.title},{label:"Bereich",value:"SM"},
   {label:"Erstellt",value:new Date(data.generatedAt).toLocaleString("de-AT",{timeZone:"Europe/Vienna"})},
   {label:"Filter",value:JSON.stringify(data.filters)},{label:"Zeilen",value:data.rows.length}]);
  appendTableSheet(XLSX,wb,{name:"SM Auszug",title:data.title,description:"Aktueller Datenstand beim Download",rows:data.rows,
   columns:keys.length?keys.map(key=>({header:labels[key]??key,width:24,value:(row:Record<string,unknown>)=>{
    const value=row[key];return value==null?null:typeof value==="string"||typeof value==="number"||typeof value==="boolean"?value:JSON.stringify(value);
   }})):[{header:"Keine Daten im gewählten Filter",value:()=>null}]});
 }});
}

