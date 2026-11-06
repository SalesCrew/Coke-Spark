"use client";
import { useId, useLayoutEffect, useRef } from "react";
import { REPORT_W, REPORT_H, reportColors, type ReportSlide, type SlideChart, type SlideTable } from "@/lib/exports/gmReportSlides";

function lines(value: string, width: number, size: number): string[] {
  const output: string[]=[];
  for(const paragraph of value.split("\n")){
    let line="";
    for(const word of paragraph.split(" ")){
      if(line && (line.length+word.length+1)*size*.47>width){output.push(line);line=word;}else line+=(line?" ":"")+word;
    }
    output.push(line);
  }
  return output;
}
function Table({ table }: { table: SlideTable }) {
  let y=table.y;
  const occupied=new Map<number,Set<number>>();
  return <g>{table.rows.map((row,ri)=>{
    const yy=y;y+=table.rowHeights[ri]??15.5;let col=0;
    return <g key={ri}>{row.map((c,ci)=>{
      while(occupied.get(ri)?.has(col))col++;
      for(let r=1;r<(c.rowspan??1);r++){const slots=occupied.get(ri+r)??new Set<number>();for(let j=0;j<(c.colspan??1);j++)slots.add(col+j);occupied.set(ri+r,slots);}
      const x=table.x+table.widths.slice(0,col).reduce((a,b)=>a+b,0),w=table.widths.slice(col,col+(c.colspan??1)).reduce((a,b)=>a+b,0);col+=c.colspan??1;
      const h=table.rowHeights.slice(ri,ri+(c.rowspan??1)).reduce((a,b)=>a+b,0),wrapped=lines(c.text,w-3,table.size),left=c.align==="left",right=c.align==="right";
      return <g key={ci}><rect x={x} y={yy} width={w} height={h} fill={`#${c.fill??"D9D9D9"}`} stroke={`#${table.border??"999999"}`} strokeWidth={.6}/><text x={left?x+2:right?x+w-2:x+w/2} y={yy+h/2-(wrapped.length-1)*table.size*.55+table.size*.34} textAnchor={left?"start":right?"end":"middle"} fill={`#${c.color??"000000"}`} fontWeight={c.bold?700:400} fontSize={table.size}>{wrapped.map((line,i)=><tspan key={i} x={left?x+2:right?x+w-2:x+w/2} dy={i?table.size*1.1:0}>{line}</tspan>)}</text></g>;
    })}</g>;
  })}</g>;
}
function Chart({chart}:{chart:SlideChart}){
  const line=chart.type==="line",max=chart.max??Math.max(1,...chart.series.flatMap(s=>s.values.filter((v):v is number=>v!==null)))*1.14;
  const dataTableHeight=line?0:(chart.series.length+1)*12;
  const x=chart.x+(line?30:chart.w*.12),y=chart.y+(line?12:(chart.h-dataTableHeight)*.1),w=line?chart.w-42:chart.w*.87,h=line?chart.h-70:(chart.h-dataTableHeight)*.86,count=chart.categories.length;
  const xx=(i:number)=>x+(line?(count<2?w/2:i*w/(count-1)):w*(i+.5)/Math.max(1,count));
  const yy=(value:number)=>y+h-value/max*h;
  const hasData=chart.series.some(s=>s.values.some(v=>v!==null));
  const ticks=Array.from({length:line?Math.round(max*10)+1:6},(_,i)=>i*max/(line?Math.round(max*10):5));
  return <g>
    <rect x={chart.x} y={chart.y} width={chart.w} height={chart.h} fill="#FFFFFF" fillOpacity={.94} stroke={line?"#FF0000":"none"} strokeWidth={.7}/>
    {!line&&<text x={chart.x+chart.w/2} y={chart.y+12} textAnchor="middle" fill="#595959" fontSize={12}>{chart.caption}</text>}
    {hasData?<>
      {ticks.map((t,i)=><g key={i}>{!line&&<line x1={x} x2={x+w} y1={yy(t)} y2={yy(t)} stroke="#E2EAF1" strokeWidth={.5}/>}<text x={x-5} y={yy(t)+2.5} textAnchor="end" fontSize={line?8:7} fill="#4F81A6">{line?`${Math.round(t*100)}%`:Math.round(t)}</text></g>)}
      {line&&chart.categories.map((category,i)=><g key={i}>{line&&<line x1={xx(i)} x2={xx(i)} y1={y} y2={y+h+20} stroke="#D6E0EA" strokeWidth={.5}/>}<text x={xx(i)} y={y+h+13} textAnchor="middle" fill="#4F81A6" fontSize={line?8:6.5}>{category}</text></g>)}
      {chart.series.map((series,si)=>{
        const barW=Math.min(15,w/Math.max(1,count)/(chart.series.length+1));
        let path="",open=false;
        if(line)series.values.forEach((v,i)=>{if(v===null){open=false;return;}path+=`${open?"L":"M"}${xx(i)},${yy(v)} `;open=true;});
        return <g key={si}>{line&&<path d={path} fill="none" stroke={`#${series.color}`} strokeWidth={1.6}/>}{series.values.map((v,i)=>v===null?null:<g key={i}>{line?<circle cx={xx(i)} cy={yy(v)} r={1.8} fill={`#${series.color}`}/>:<rect x={xx(i)+(si-chart.series.length/2)*barW} y={yy(v)} width={barW} height={Math.max(0,y+h-yy(v))} fill={`#${series.color}`}/>}<text x={line?xx(i):xx(i)+(si-chart.series.length/2+.5)*barW} y={yy(v)-5} textAnchor="middle" fill="#4F81A6" fontSize={line?8:6.5}>{line?`${Math.round(v*100)}%`:v}</text></g>)}</g>;
      })}
      {line?<><text x={chart.x+chart.w/2} y={chart.y+chart.h-29} textAnchor="middle" fontSize={8} fill="#4F81A6">{chart.caption}</text>{chart.series.map((s,i)=><g key={i} transform={`translate(${chart.x+chart.w/2-63+i*51},${chart.y+chart.h-12})`}><line x1={0} x2={16} y1={0} y2={0} stroke={`#${s.color}`} strokeWidth={1.6}/><circle cx={8} cy={0} r={1.8} fill={`#${s.color}`}/><text x={18} y={2.5} fill="#436D90" fontSize={7}>{s.name}</text></g>)}</>:
      <g>{[["",...chart.categories],...chart.series.map(s=>[s.name,...s.values.map(v=>v===null?"—":String(v))])].map((row,ri)=><g key={ri}>{row.map((value,i)=>{const cw=i===0?65:(chart.w-65)/Math.max(1,count),left=chart.x+(i===0?0:65+(i-1)*cw),top=chart.y+chart.h-dataTableHeight+ri*12;return <g key={i}><rect x={left} y={top} width={cw} height={12} fill="#FFFFFF" stroke="#CCDDEC" strokeWidth={.5}/><text x={left+cw/2} y={top+8} textAnchor="middle" fill={i===0&&ri>0?`#${chart.series[ri-1]!.color}`:"#4F81A6"} fontSize={6.5}>{value}</text></g>;})}</g>)}</g>}
    </>:<text x={chart.x+chart.w/2} y={chart.y+chart.h/2} textAnchor="middle" fontSize={11} fill="#888888">Keine auswertbaren Daten</text>}
  </g>;
}
export function ReportSlidePreview({slide, label}:{slide:ReportSlide;label?:string}){
  const id=useId().replace(/:/g,"");
  const svgRef=useRef<SVGSVGElement>(null);
  useLayoutEffect(()=>{
    // PowerPoint shrinks long headings to their text box. Match that constraint
    // in the browser even when Calibri falls back to a wider installed font.
    for(const span of svgRef.current?.querySelectorAll<SVGTSpanElement>("tspan[data-fit-width]")??[]){
      span.removeAttribute("textLength");span.removeAttribute("lengthAdjust");
      const width=Number(span.dataset.fitWidth);
      if(span.getComputedTextLength()>width){span.setAttribute("textLength",String(width));span.setAttribute("lengthAdjust","spacingAndGlyphs");}
    }
  },[slide]);
  return <svg ref={svgRef} role="img" aria-label={label??slide.title} viewBox={`0 0 ${REPORT_W} ${REPORT_H}`} width="100%" style={{display:"block",background:"#fff",fontFamily:"Calibri, Arial, sans-serif"}}>
    {(slide.background==="cover"||slide.background==="summary")?<image href={`/gm-reports/${slide.background}.png`} x={0} y={0} width={960} height={540}/>:<>
      {slide.background==="availability"?<image href="/gm-reports/availability-watermark.jpg" x={524.32} y={0} width={435.68} height={540}/>:<image href="/gm-reports/competitor-corner.png" x={0} y={0} width={81.474} height={540}/>}
      <image href="/gm-reports/logo.png" x={32.628} y={489.057} width={104.55} height={40.148}/>
    </>}
    {slide.footerLegend&&<image href="/gm-reports/availability-legend.png" x={155.21} y={475.797} width={400.99} height={50.585}/>}
    {slide.texts.map((t,i)=><text key={i} x={t.align==="center"?t.x+t.w/2:t.align==="right"?t.x+t.w:t.x} y={t.y+t.size*.8} fill={`#${t.color??reportColors.ink}`} fontSize={t.size} fontWeight={t.bold?700:400} fontStyle={t.italic?"italic":"normal"} textAnchor={t.align==="center"?"middle":t.align==="right"?"end":"start"}>{(t.bold&&t.size>=24?[t.text]:lines(t.text,t.w,t.size)).map((line,j)=><tspan key={j} data-fit-width={t.bold&&t.size>=24?t.w:undefined} x={t.align==="center"?t.x+t.w/2:t.align==="right"?t.x+t.w:t.x} dy={j?t.size*1.05:0}>{line}</tspan>)}</text>)}
    {slide.tables.map((t,i)=><Table key={i} table={t}/>)}
    {slide.charts.map((c,i)=><Chart key={i} chart={c}/>)}
    {slide.photos.map((p,i)=><g key={i}><defs><clipPath id={`${id}-${i}`}><rect x={p.x} y={p.y} width={p.w} height={p.h}/></clipPath></defs><rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#F7F8F8"/><text x={p.x+p.w/2} y={p.y+p.h/2} textAnchor="middle" fontSize={9} fill="#999999">{p.url?"Foto wird geladen …":p.label}</text>{p.url&&<image href={p.url} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-${i})`}/>}<rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={`#${p.color}`} strokeWidth={1}/></g>)}
  </svg>;
}
