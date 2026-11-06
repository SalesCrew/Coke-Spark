import type { RedMonthPeriod } from "@/types/red-month";
import type { ReportPeriod } from "./gm-report.shared";

export function reportPeriodChoices(calendar: RedMonthPeriod[], mode: "month" | "quarter", today: string): ReportPeriod[] {
  const periods = calendar.filter(p => p.status !== "draft" && p.start <= today).sort((a,b)=>a.start.localeCompare(b.start));
  if(mode==="month")return periods.map(p=>({id:p.id,label:p.periodIndex<=12?`RED ${new Date(Date.UTC(p.year,p.periodIndex-1,15)).toLocaleString("de-AT",{month:"long",timeZone:"UTC"})} ${p.year}`:`RED ${p.periodIndex} · ${p.year}`,start:p.start,end:p.end}));
  const groups=new Map<string,ReportPeriod>();
  // Report quarters follow the configured RED calendar; no dates are generated or written.
  for(const p of periods){
    const quarter=Math.min(4,Math.ceil(p.periodIndex/3)),id=`red-quarter-${p.year}-${quarter}`,old=groups.get(id);
    groups.set(id,{id,label:`Q${quarter}/${p.year}`,start:old&&old.start<p.start?old.start:p.start,end:old&&old.end>p.end?old.end:p.end});
  }
  // Include later RED months in the current quarter's nominal end, even before they start.
  for(const p of calendar.filter(p=>p.status!=="draft")){
    const id=`red-quarter-${p.year}-${Math.min(4,Math.ceil(p.periodIndex/3))}`,old=groups.get(id);
    if(old&&p.end>old.end)old.end=p.end;
  }
  return [...groups.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
