import { availabilityKinds, availabilityPercentages, type AvailabilityCounts, type AvailabilityKind } from "@/lib/availability.shared";
import type { DashboardReport, ReportCountRow } from "@/lib/gm-report.shared";

export type SlideText = { text: string; x: number; y: number; w: number; h: number; size: number; color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right" };
export type SlideCell = { text: string; color?: string; fill?: string; bold?: boolean; colspan?: number; rowspan?: number; align?: "left" | "center" | "right" };
export type SlideTable = { x: number; y: number; w: number; widths: number[]; rowHeights: number[]; rows: SlideCell[][]; size: number; border?: string };
export type SlideChart = { x: number; y: number; w: number; h: number; type: "line" | "bar"; categories: string[]; series: { name: string; color: string; values: Array<number | null> }[]; max?: number; caption: string; dataTable?: boolean };
export type SlidePhoto = { x: number; y: number; w: number; h: number; id: string | null; url: string | null; label: string; color: string };
export type ReportSlide = { title: string; background: "cover" | "summary" | "availability" | "competitor"; texts: SlideText[]; tables: SlideTable[]; charts: SlideChart[]; photos: SlidePhoto[]; footerLegend?: boolean };
export const REPORT_W = 960, REPORT_H = 540;
export const reportColors = { top: "63AEAB", mediocre: "FDC600", bad: "F41630", ink: "20313D", grid: "D7E2EA" };
const date = (value: string) => new Date(value + "T12:00:00Z").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna" });
const number = (n: number) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: 0 }).format(n);
const percent = (n: number, total: number) => total ? `${Math.round(n / total * 100)}%` : "—";
const cell = (text: string, options: Omit<SlideCell,"text"> = {}): SlideCell => ({ text, ...options });
const text = (value: string, x: number, y: number, w: number, h: number, size: number, options: Partial<SlideText> = {}): SlideText => ({ text: value, x, y, w, h, size, ...options });
const slide = (title: string, background: ReportSlide["background"]): ReportSlide => ({ title, background, texts: [], tables: [], charts: [], photos: [] });
function pctCells(counts: AvailabilityCounts): SlideCell[] {
  return [cell(number(counts.top), { bold: true }), cell(percent(counts.top, counts.total)), cell(number(counts.mediocre), { bold: true }), cell(percent(counts.mediocre, counts.total)), cell(number(counts.bad), { bold: true }), cell(percent(counts.bad, counts.total))];
}
function detailTable(rows: ReportCountRow[], label: string, y: number): SlideTable {
  const widths = [62, 26, 31, ...Array.from({ length: 30 }, () => (879 - 119) / 30)];
  const headers = [cell(label, { rowspan: 2, fill: "009C9E", color: "FFFFFF", bold: true, align: "left" }), cell("IN\ntotal", { rowspan: 2, fill: "009C9E", color: "FFFFFF", bold: true }), cell("%", { rowspan: 2, fill: "009C9E", color: "FFFFFF", bold: true }),
    ...availabilityKinds.map((kind, i) => cell(kind, { colspan: 6, fill: i % 2 ? "009C9E" : "595959", color: "FFFF00", bold: true }))];
  const sub = [...availabilityKinds.flatMap((_,i) => ["TOP","%","medio-\ncre","%","bad","%"].map(t => cell(t, { fill: i%2 ? "009C9E" : "595959", color: "FFFFFF", bold: true })))];
  const values = rows.map(row => [cell(row.label, { bold: true, align: "left", fill: "FFFFFF" }), cell(number(row.total), { fill: "E1F1D7" }), cell(row.total ? "100%" : "—", { fill: "E1F1D7", bold: true }), ...availabilityKinds.flatMap(kind => pctCells(row.counts[kind]))]);
  return { x: 41.5, y, w: 879, widths, rowHeights: [18, 43, ...rows.map(() => 15.5)], rows: [headers,sub,...values], size: 8.8, border: "202020" };
}
function chunks<T>(items: T[], size: number): T[][] { const out: T[][]=[]; for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size)); return out.length ? out : [[]]; }

export function reportSlides(report: DashboardReport): ReportSlide[] {
  const periods = report.periods;
  const first = periods[0]!.label, last = periods[periods.length-1]!.label;
  const sameRedYear = first.startsWith("RED ") && last.startsWith("RED ") && first.slice(-4) === last.slice(-4);
  const rangeLabel = periods.length === 1 ? first : sameRedYear ? `${first.slice(0,-5)} bis ${last.slice(4)}` : `${first} bis ${last}`;
  const rangeDates = `${date(periods[0]!.start)} – ${date(periods[periods.length-1]!.end)}`;
  const cover = slide("Titel", "cover");
  if (report.kind === "availability") {
    cover.texts.push(text("Availability",47.16,44,840,140,110.06,{bold:true,color:"FFFFFF"}),text("query",47.16,143,840,140,110.06,{bold:true,color:"FFFFFF"}),text(rangeLabel,47.16,292,820,42,26.04,{bold:true,color:"FFFFFF"}));
  } else {
    cover.texts.push(text("Abfrage",47.16,44,840,140,110.06,{bold:true,color:"FFFFFF"}),text("Mitbewerber",47.16,152,865,140,110.06,{bold:true,color:"FFFFFF"}),text(`Vergleich ${rangeLabel}`,47.16,292,840,44,26.04,{bold:true,color:"FFFFFF"}));
  }
  const overview = slide("Überblick", "summary");
  if (report.kind === "availability") {
    overview.texts.push(text(`Performance ${rangeLabel}`,46.08,32,540,74,32.04,{bold:true}),
      text(`Total number of markets visited: ${number(report.uniqueMarketCount)}`,53.45,116,510,28,18.96,{bold:true}),
      text(`• Rewe: ${number(report.groups.rewe)}`,53.45,141,480,25,18.96,{bold:true}),text(`• Spar: ${number(report.groups.spar)}`,53.45,166,480,25,18.96,{bold:true}),
      text(`• Other markets: ${number(report.groups.other)}`,53.45,191,480,25,18.96,{bold:true}),text(`• Evaluation: ${rangeDates}`,53.45,216,590,25,18.96,{bold:true}),
      text("Query carried out for:",53.45,266,540,25,18.96,{italic:true}),text("• Cooler, SingleServe; MultiServe; Promos; Warehouse",53.45,291,570,30,18.96),
      text("Valuation in:",53.45,341,520,25,18.96,{italic:true}),text("• Top (ongoing availability ensured)",53.45,366,630,25,18.96),
      text("• Mediocre (availability guaranteed, could become scarce)",53.45,391,670,25,18.96),text("• Bad (availability poor, OOS present or imminent)",53.45,416,650,25,18.96));
  } else {
    overview.texts.push(text("Mitbewerbsanalyse",46.08,35,660,42,32.06,{bold:true,color:"7F7F7F"}),text(`Coca-Cola im Vergleich zum Mitbewerber – ${rangeLabel}`,46.08,75,710,23,14.06,{bold:true}),
      text(`Gesamtbesuche der Märkte: ${number(report.visitCount)}`,46.08,133,580,26,18,{bold:true,color:"595959"}),text(`Rewe: ${number(report.groups.rewe)}`,46.08,161,500,26,18,{bold:true,color:"63AEAB"}),
      text(`• Spar: ${number(report.groups.spar)}`,46.08,190,500,26,18,{bold:true,color:"595959"}),text(`• Sonstige Märkte: ${number(report.groups.other)}`,46.08,218,600,26,18,{bold:true,color:"595959"}),
      text(`• Zeitraum: ${rangeDates}`,46.08,246,610,26,18,{bold:true,color:"595959"}),text("Abfrage durchgeführt:",46.08,304,510,25,15.98,{italic:true,color:"595959"}),
      text("• Kühler-Platzierungen: physische Kühler von Coca-Cola und Mitbewerbern, nach Marke",46.08,331,575,48,15.96,{color:"595959"}),
      text("• Großplatzierungen: physische Sonderplatzierungen von Coca-Cola und Mitbewerbern im Markt",46.08,379,575,48,15.96,{color:"595959"}));
  }
  if (report.warnings.length) overview.texts.push(text(report.kind === "competitor" ? "— = physische Menge nicht vollständig erfasst oder nicht zuordenbar." : "Prozentwerte aus gültigen Antworten; fehlende Antworten sind kein Bad.",46,465,640,22,10,{color:"7F7F7F"}));
  const result = [cover,overview];
  if (report.kind === "competitor" && report.competitor) {
    for (const [index,type] of ["cooler","placement"].entries()) {
      const rows = report.competitor[type as "cooler" | "placement"];
      const title = index ? "Großplatzierung Mitbewerber" : "Kühler Mitbewerber";
      const s = slide(title,"competitor");
      s.texts.push(text(`${title} – Vergleich ${rangeLabel} Gesamt`,57,38,865,45,26,{bold:true,color:"7F7F7F"}));
      const colors = index ? ["F9DE4B","ED8D67","C15563"] : ["F55D73","87C1BF","F9DE4B"];
      const header = [cell(index ? "Gesamt\nGroßplatzierung" : "Kühler Gesamt",{fill:"A5A5A5",color:"FFFFFF",bold:true,align:"left"}),...periods.map((p,i) => cell(`${p.label}\nGesamt`,{fill:colors[i]!,color:"FFFFFF",bold:true}))];
      const rowsCells = rows.map(r => [cell(r.brand,{bold:r.brand==="Coke",align:"left"}),...r.values.map(n=>cell(n===null?"—":number(n),{bold:r.brand==="Coke"}))]);
      const tableY = index ? 169 : 125, tableW = index ? 312 : 300;
      s.tables.push({x:40,y:tableY,w:tableW,widths:[tableW*.3,...periods.map(()=>tableW*.7/periods.length)],rowHeights:[36,...rows.map(()=>22)],rows:[header,...rowsCells],size:9.5,border:"999999"});
      s.charts.push({x:380,y:118,w:545,h:330,type:"bar",caption:`${index?"Großplatzierung":"Kühler"} Mitbewerb – Vergleich ${rangeLabel} Gesamt`,categories:rows.map(r=>r.brand),
        series:periods.map((p,i)=>({name:p.label,color:colors[i]!,values:rows.map(r=>r.values[i]??null)})),dataTable:true});
      if (rows.some(r=>r.values.some(v=>v===null))) s.texts.push(text("— = Menge nicht erfasst / Zuordnung offen",40,465,700,20,10,{color:"7F7F7F"}));
      result.push(s);
    }
    return result;
  }
  const a=report.availability;
  if (!a) return result;
  const tableSlide=slide("Verfügbarkeit nach Kategorie, Region und Handelskette","availability");
  const totalHeader=["Implemen-\ntation","IN\ntotal","%","TOP","%","medio-\ncre","%","bad","%"].map((t,i)=>cell(t,{fill:["009C9E","009C9E","009C9E","595959","595959","009C9E","009C9E","595959","595959"][i]!,color:"FFFFFF",bold:true,align:i===0?"left":"center"}));
  tableSlide.tables.push({x:41.5,y:40.5,w:302,widths:[62,26,31,26,31,35,31,26,34],rowHeights:[45,...availabilityKinds.map(()=>15.5)],size:10,border:"202020",rows:[totalHeader,...availabilityKinds.map(k=>[cell(k,{bold:true,fill:"FFFFFF",align:"left"}),cell(number(a.total.counts[k].total),{fill:"E1F1D7"}),cell(a.total.counts[k].total?"100%":"—",{fill:"E1F1D7",bold:true}),...pctCells(a.total.counts[k])])]});
  tableSlide.tables.push(detailTable(a.regions.slice(0,4),"Area",180.5),detailTable(a.chains.slice(0,6),"Market",320));
  result.push(tableSlide);
  const overflowRegions=a.regions.slice(4),overflowChains=a.chains.slice(6);
  const extra=Math.max(Math.ceil(overflowRegions.length/4),Math.ceil(overflowChains.length/6));
  for(let i=0;i<extra;i++){
    const s=slide("Verfügbarkeit · weitere Regionen und Handelsketten","availability");
    s.texts.push(text("Verfügbarkeit · Fortsetzung",42,32,860,42,28,{bold:true}));
    if(overflowRegions.slice(i*4,i*4+4).length)s.tables.push(detailTable(overflowRegions.slice(i*4,i*4+4),"Area",120));
    if(overflowChains.slice(i*6,i*6+6).length)s.tables.push(detailTable(overflowChains.slice(i*6,i*6+6),"Market",300));
    result.push(s);
  }
  for(const [page,kinds] of [["Cooler / SingleServe / MultiServe",availabilityKinds.slice(0,3)],["Promos / Warehouse",availabilityKinds.slice(3)]] as const){
    const s=slide(page,"availability");s.footerLegend=true;
    const cols=kinds.length,w=cols===3?283:338,xs=cols===3?[34,338,642]:[84,478];
    for(const [gi,group] of ["rewe","spar"].entries())for(const [ki,kind] of kinds.entries()){
      const points=a.weeks[group as "rewe"|"spar"];
      // Keep full precision in the chart's workbook; only labels round to whole percentages.
      const series=(["bad","mediocre","top"] as const).map(category=>({name:category==="top"?"TOP":category,color:reportColors[category],values:points.map(p=>{const c=p.counts[kind as AvailabilityKind];return availabilityPercentages(c)[category]===null?null:availabilityPercentages(c)[category]!/100;})}));
      s.charts.push({x:xs[ki]!,y:gi===0?44:cols===3?258:257,w,h:cols===3?197:208,type:"line",caption:`${group.toUpperCase()} ${kind.toUpperCase()}`,categories:points.map(p=>p.label),series,
        max:kind==="Warehouse"?Math.min(1,Math.max(.8,Math.ceil(Math.max(0,...series.flatMap(s=>s.values.filter((v):v is number=>v!==null)))*10)/10)):1});
    }
    result.push(s);
  }
  const photoSlide=slide("Marktfotos","availability");
  const slots=[[17,23,167,223],[193,23,296,223],[497,23,147,223],[653,23,295,223],[17,259,167,222],[195,259,194,257],[400,259,327,260],[755,259,194,245]];
  photoSlide.photos=slots.map(([x,y,w,h],i)=>({x:x!,y:y!,w:w!,h:h!,id:report.photos[i]?.id??null,url:report.photos[i]?.url??null,label:report.photosAllowed?(report.photos[i]?.marketName||"Kein weiteres Foto im Zeitraum"):"Für diesen Zugang keine Fotofreigabe",color:["63AEAB","F41630","FDC600"][i%3]!}));
  result.push(photoSlide);
  return result;
}
