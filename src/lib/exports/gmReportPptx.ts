import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import type { DashboardReport } from "@/lib/gm-report.shared";
import { reportSlides, type ReportSlide, type SlideChart } from "./gmReportSlides";

export type ReportImages = Record<string, string>;
const inch = (points: number) => points / 72;
function pngAspect(data: string): number {
  const bytes = atob(data.slice(data.indexOf(",")+1, data.indexOf(",")+37));
  const uint32 = (offset: number) => (bytes.charCodeAt(offset)*16777216)+(bytes.charCodeAt(offset+1)*65536)+(bytes.charCodeAt(offset+2)*256)+bytes.charCodeAt(offset+3);
  const width=uint32(16),height=uint32(20);
  if (!width || !height || !Number.isFinite(width/height)) throw new Error("Foto konnte nicht vorbereitet werden.");
  return width/height;
}
export const reportArtwork = ["cover.png","summary.png","logo.png","availability-watermark.jpg","availability-legend.png","competitor-corner.png"] as const;
function background(pptx: PptxGenJS, s: PptxGenJS.Slide, model: ReportSlide, images: ReportImages) {
  const add = (name: string, x: number, y: number, w: number, h: number) => {
    const data = images[name]; if (!data) throw new Error(`Berichtsvorlage konnte nicht geladen werden: ${name}`);
    s.addImage({ data, x: inch(x), y: inch(y), w: inch(w), h: inch(h) });
  };
  s.background = { color: "FFFFFF" };
  if (model.background === "cover" || model.background === "summary") add(`${model.background}.png`,0,0,960,540);
  else {
    if (model.background === "availability") add("availability-watermark.jpg",524.32,0,435.68,540);
    else add("competitor-corner.png",0,0,81.474,540);
    add("logo.png",32.628,489.057,104.55,40.148);
  }
  if (model.footerLegend) add("availability-legend.png",155.21,475.797,400.99,50.585);
}
function addChart(pptx: PptxGenJS, slide: PptxGenJS.Slide, chart: SlideChart) {
  const line = chart.type === "line";
  const dataTableHeight = !line && chart.dataTable ? (chart.series.length + 1) * 12 : 0;
  const hasData = chart.series.some(series => series.values.some(value => value !== null));
  if (!hasData) {
    slide.addShape(pptx.ShapeType.rect,{x:inch(chart.x),y:inch(chart.y),w:inch(chart.w),h:inch(chart.h),fill:{color:"FAFAFA"},line:{color:line?"FF0000":"EEEEEE",width:.7}});
    slide.addText("Keine auswertbaren Daten",{x:inch(chart.x+16),y:inch(chart.y+chart.h/2-10),w:inch(chart.w-32),h:inch(22),fontFace:"Calibri",fontSize:11,color:"888888",align:"center",margin:0});
  } else {
    const data = chart.series.map(series => ({name:series.name,labels:chart.categories,values:series.values as number[]}));
    const opts: PptxGenJS.IChartOpts = {
      x:inch(chart.x),y:inch(chart.y),w:inch(chart.w),h:inch(chart.h-dataTableHeight),
      chartColors:chart.series.map(s=>s.color),chartArea:{fill:{color:"FFFFFF",transparency:5},border:{color:line?"FF0000":"FFFFFF",pt:line?.7:0},roundedCorners:false},plotArea:{fill:{color:"FFFFFF",transparency:80}},
      showTitle:!line,title:chart.caption,titleFontFace:"Calibri",titleFontSize:13,titleColor:"595959",showLegend:line,legendPos:"b",legendFontFace:"Calibri",legendFontSize:line?8:7,legendColor:"436D90",
      catAxisLabelFontFace:"Calibri",catAxisLabelFontSize:line?8:7,catAxisLabelColor:"4F81A6",catAxisLineColor:"D6E0EA",catAxisLineSize:.5,
      valAxisLabelFontFace:"Calibri",valAxisLabelFontSize:line?8:7,valAxisLabelColor:"4F81A6",valAxisLineColor:"FFFFFF",valAxisMinVal:0,
      showValue:true,dataLabelFontFace:"Calibri",dataLabelFontSize:line?8:7,dataLabelColor:"4F81A6",dataLabelPosition:line?"t":"outEnd",dataLabelFormatCode:line?"0%":"0",
      showSerName:false,showPercent:false,
      lineDataSymbol:"circle",lineDataSymbolSize:3,lineSize:1.6,lineSmooth:false,
      displayBlanksAs:"gap",showDataTable:false,showDataTableKeys:true,showDataTableHorzBorder:true,showDataTableVertBorder:true,showDataTableOutline:true,dataTableFontSize:6.5,dataTableFormatCode:"0",
      catGridLine:{color:"DCE5EE",size:.5,style:line?"solid":"none"},valGridLine:{color:"E0E8EF",size:.5,style:line?"none":"solid"},
      ...(line?{valAxisMaxVal:chart.max??1,valAxisMajorUnit:.1,valAxisLabelFormatCode:"0%",showCatAxisTitle:true,catAxisTitle:chart.caption,catAxisTitleFontFace:"Calibri",catAxisTitleFontSize:8 }:{catAxisHidden:true,barDir:"col",barGrouping:"clustered",gapSizePct:65,layout:{x:.12,y:.1,w:.87,h:.86}}),
    };
    slide.addChart(line?pptx.ChartType.line:pptx.ChartType.bar,data,opts);
  }
  if (dataTableHeight) {
    const rows = [[{text:"",options:{}}, ...chart.categories.map(text=>({text,options:{}}))], ...chart.series.map(series=>[
      {text:series.name,options:{color:series.color,bold:true}}, ...series.values.map(value=>({text:value===null?"—":String(value),options:{}})),
    ])];
    slide.addTable(rows,{x:inch(chart.x),y:inch(chart.y+chart.h-dataTableHeight),w:inch(chart.w),colW:[inch(65),...chart.categories.map(()=>inch((chart.w-65)/chart.categories.length))],rowH:inch(12),fontFace:"Calibri",fontSize:6.5,margin:0,color:"4F81A6",fill:{color:"FFFFFF"},border:{type:"solid",color:"CCDDEC",pt:.5},autoPage:false,align:"center",valign:"middle"});
  }
}

/** The production runtime uses a browser-safe PPTX writer; validation imports the resulting native charts/tables into Artifact Tool. */
export function createDashboardPptx(report: DashboardReport, images: ReportImages): PptxGenJS {
  const pptx=new PptxGenJS();
  pptx.defineLayout({name:"COKE_TEMPLATE",width:960/72,height:540/72});pptx.layout="COKE_TEMPLATE";
  pptx.author="Coke Spark";pptx.subject=report.kind==="availability"?"Verfügbarkeitsauswertung":"Physische Kühler und Großplatzierungen";
  pptx.title=report.kind==="availability"?"Availability query":"Abfrage Mitbewerber";pptx.company="Coke Spark";
  pptx.theme={headFontFace:"Calibri",bodyFontFace:"Calibri"};
  const models=reportSlides(report);
  for(const model of models){
    const s=pptx.addSlide();background(pptx,s,model,images);
    for(const t of model.texts)s.addText(t.text,{x:inch(t.x),y:inch(t.y),w:inch(t.w),h:inch(t.h),fontFace:"Calibri",fontSize:t.size,bold:!!t.bold,italic:!!t.italic,color:t.color??"20313D",align:t.align??"left",valign:"top",margin:0,paraSpaceAfter:0,breakLine:false,fit:"shrink"});
    for(const table of model.tables){
      const rows=table.rows.map(row=>row.map(c=>({text:c.text,options:{fill:{color:c.fill??"D9D9D9"},color:c.color??"000000",bold:!!c.bold,align:c.align??"center",...(c.colspan?{colspan:c.colspan}:{}),...(c.rowspan?{rowspan:c.rowspan}:{})}})));
      s.addTable(rows,{x:inch(table.x),y:inch(table.y),w:inch(table.w),colW:table.widths.map(inch),rowH:table.rowHeights.map(inch),fontFace:"Calibri",fontSize:table.size,color:"000000",margin:0,
        border:{type:"solid",color:table.border??"999999",pt:.6},autoPage:false,verbose:false,valign:"middle"});
    }
    for(const c of model.charts)addChart(pptx,s,c);
    for(const photo of model.photos){
      const data=photo.id?images[`photo:${photo.id}`]:undefined;
      if(data)s.addImage({data,x:inch(photo.x),y:inch(photo.y),w:pngAspect(data),h:1,sizing:{type:"cover",w:inch(photo.w),h:inch(photo.h)},altText:photo.label});
      else{s.addShape(pptx.ShapeType.rect,{x:inch(photo.x),y:inch(photo.y),w:inch(photo.w),h:inch(photo.h),line:{color:"E6E8E9",width:.5},fill:{color:"F7F8F8"}});s.addText(photo.url?"Foto konnte nicht geladen werden":photo.label,{x:inch(photo.x+8),y:inch(photo.y+photo.h/2-15),w:inch(photo.w-16),h:inch(40),fontFace:"Calibri",fontSize:9,color:"999999",align:"center",margin:0});}
      s.addShape(pptx.ShapeType.rect,{x:inch(photo.x),y:inch(photo.y),w:inch(photo.w),h:inch(photo.h),line:{color:photo.color,width:1},fill:{color:"FFFFFF",transparency:100}});
    }
    s.addNotes(`Coke Spark · Datenstand ${report.generatedAt}\nZeiträume: ${JSON.stringify(report.periods)}\nFilter: ${JSON.stringify(report.scope)}\nReguläre GMs; Zusatz-GM-Arbeit ausgeschlossen.\n${report.kind==="availability"?"Gültige Verfügbarkeitsbeobachtungen je Besuch und Frage; Prozentnenner = gültige Antworten. Eindeutige Märkte und Besuche werden getrennt gezählt. Vorlage: 2026_Verfügbarkeitsabfrage RED Oktober.pdf.":"Physische Mengen, keine Bewertungspunkte. Letzter gespeicherter Stand je Markt/Frage/Zeitraum; unbekannte oder widersprüchliche Mengen bleiben leer. Vorlage: Abfrage Mitbewerb_Vergleich Q1-Q3_2026.pdf."}\nHinweise: ${report.warnings.join(" ")}\n${report.competitor?`Datenzuordnung: ${JSON.stringify(report.competitor.catalog)}\nOffene Mengen: ${JSON.stringify(report.competitor.issues)}`:""}`);
  }
  return pptx;
}
/** PptxGenJS 4 declares one master per slide but writes a single shared master.
 * Remove unused master declarations and flatten single-level category caches.
 * Keep true zeros in embedded worksheets and true missing observations as gaps.
 * No answer data is changed; all values come from the generated chart cache. */
export async function writeDashboardPptx(report: DashboardReport, images: ReportImages): Promise<Uint8Array> {
  const draft = await createDashboardPptx(report, images).write({outputType:"uint8array"}) as Uint8Array;
  const zip = await JSZip.loadAsync(draft);
  const manifest = zip.file("[Content_Types].xml");
  if (!manifest) throw new Error("PowerPoint-Datei konnte nicht vollständig erstellt werden.");
  const xml = await manifest.async("string");
  zip.file("[Content_Types].xml", xml.replace(/<Override\b[^>]*PartName="(\/ppt\/slideMasters\/slideMaster\d+\.xml)"[^>]*\/>/g, (entry, target: string) => zip.file(target.slice(1)) ? entry : ""));
  await Promise.all(Object.keys(zip.files).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name)).map(async name => {
    const chart = await zip.file(name)!.async("string");
    const compatible = chart.replace(/<c:multiLvlStrRef>\s*(<c:f>[\s\S]*?<\/c:f>)\s*<c:multiLvlStrCache>\s*(<c:ptCount[^>]*\/>)\s*<c:lvl>([\s\S]*?)<\/c:lvl>\s*<\/c:multiLvlStrCache>\s*<\/c:multiLvlStrRef>/g,
      "<c:strRef>$1<c:strCache>$2$3</c:strCache></c:strRef>")
      // Sparse numeric caches encode genuine missing observations as gaps.
      .replace(/<c:pt idx="\d+"><c:v>\s*<\/c:v><\/c:pt>/g, "");
    zip.file(name, compatible);
    // The writer emits numeric 0 correctly in chart caches but leaves its XLSX
    // cell blank. Reconcile exactly those cells; never fill a missing observation.
    const zeros = new Set<string>();
    for (const match of chart.matchAll(/<c:val>\s*<c:numRef><c:f>Sheet1!\$([A-Z]+)\$(\d+):\$[A-Z]+\$\d+<\/c:f>([\s\S]*?)<\/c:numRef>\s*<\/c:val>/g)) {
      for (const point of match[3]!.matchAll(/<c:pt idx="(\d+)"><c:v>0<\/c:v><\/c:pt>/g)) zeros.add(`${match[1]}${Number(match[2])+Number(point[1])}`);
    }
    if (zeros.size) {
      const relationName = name.replace(/([^/]+)$/, "_rels/$1.rels");
      const relations = await zip.file(relationName)?.async("string");
      const target = relations?.match(/Target="\.\.\/embeddings\/([^"]+\.xlsx)"/)?.[1];
      if (!target) throw new Error("Diagrammdaten konnten nicht vollständig erstellt werden.");
      const workbookPath = `ppt/embeddings/${target}`;
      const workbook = await JSZip.loadAsync(await zip.file(workbookPath)!.async("uint8array"));
      const sheet = await workbook.file("xl/worksheets/sheet1.xml")!.async("string");
      const fixed = sheet.replace(/<c r="([A-Z]+\d+)"([^>]*)><v>\s*<\/v><\/c>/g, (cell, address: string, attributes: string) => zeros.has(address) ? `<c r="${address}"${attributes}><v>0</v></c>` : cell);
      workbook.file("xl/worksheets/sheet1.xml", fixed);
      zip.file(workbookPath, await workbook.generateAsync({type:"uint8array",compression:"DEFLATE"}));
    }
  }));
  return zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
}
async function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Bild konnte nicht gelesen werden."));reader.readAsDataURL(blob);});
}
async function photoData(url: string, signal?: AbortSignal): Promise<string> {
  const response=await fetch(url,{credentials:"omit",cache:"no-store",...(signal?{signal}:{})});
  if(!response.ok)throw new Error("Foto konnte nicht geladen werden.");
  const blob=await response.blob();
  if(blob.size>25*1024*1024)throw new Error("Foto ist für den Export zu groß.");
  const bitmap=await createImageBitmap(blob);
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");if(!context){bitmap.close();throw new Error("Bild konnte nicht vorbereitet werden.");}
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL("image/png");
}
export async function dashboardPptxBlob(report: DashboardReport, signal?: AbortSignal): Promise<Blob> {
  const images: ReportImages={};
  await Promise.all(reportArtwork.map(async name=>{const response=await fetch(`/gm-reports/${name}`,{...(signal?{signal}:{})});if(!response.ok)throw new Error("Berichtsvorlage konnte nicht geladen werden.");images[name]=await asDataUrl(await response.blob());}));
  await Promise.all(report.photos.filter(p=>p.url).map(async p=>{try{images[`photo:${p.id}`]=await photoData(p.url!,signal);}catch(error){if(signal?.aborted)throw error;}}));
  if(signal?.aborted)throw new DOMException("Abgebrochen","AbortError");
  const bytes = await writeDashboardPptx(report,images);
  return new Blob([bytes as Uint8Array<ArrayBuffer>],{type:"application/vnd.openxmlformats-officedocument.presentationml.presentation"});
}
export function reportFilename(report: DashboardReport): string {
  const name=report.kind==="availability"?"Verfuegbarkeit":"Mitbewerb";
  const period=report.periods.map(p=>p.label).join("_").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_");
  return `CokeSpark_${name}_${period}_Stand_${report.cutoff}.pptx`;
}
export function downloadReportBlob(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
