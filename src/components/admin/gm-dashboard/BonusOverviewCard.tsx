"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { IppMiniDropdown } from "@/components/admin/gm-dashboard/IppMiniDropdown";

type DemoGoal = { id: string; name: string; earnedEur: number; maxEur: number; pending?: boolean };
type DemoBonus = { id: string; name: string; earnedEur: number; maxEur: number; goals: DemoGoal[] };

const DEMO_BONUSES: DemoBonus[] = [
  {
    id: "demo-nord", name: "GM Demo Nord", earnedEur: 760, maxEur: 1100,
    goals: [
      { id: "placement", name: "Platzierung", earnedEur: 380, maxEur: 450 },
      { id: "distribution", name: "Distribution", earnedEur: 260, maxEur: 300 },
      { id: "flex", name: "Flexziel", earnedEur: 120, maxEur: 200 },
      { id: "quality", name: "Qualität", earnedEur: 0, maxEur: 150, pending: true },
    ],
  },
  {
    id: "demo-sued", name: "GM Demo Süd", earnedEur: 930, maxEur: 1100,
    goals: [
      { id: "placement", name: "Platzierung", earnedEur: 450, maxEur: 450 },
      { id: "distribution", name: "Distribution", earnedEur: 300, maxEur: 300 },
      { id: "flex", name: "Flexziel", earnedEur: 180, maxEur: 200 },
      { id: "quality", name: "Qualität", earnedEur: 0, maxEur: 150, pending: true },
    ],
  },
  {
    id: "demo-west", name: "GM Demo West", earnedEur: 440, maxEur: 1100,
    goals: [
      { id: "placement", name: "Platzierung", earnedEur: 260, maxEur: 450 },
      { id: "distribution", name: "Distribution", earnedEur: 180, maxEur: 300 },
      { id: "flex", name: "Flexziel", earnedEur: 0, maxEur: 200, pending: true },
      { id: "quality", name: "Qualität", earnedEur: 0, maxEur: 150, pending: true },
    ],
  },
];

const euro = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const demoGmOptions = DEMO_BONUSES.map((gm) => ({ value: gm.id, label: gm.name }));

function ringSegmentPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
  const point = (radius: number, angle: number) => {
    const radians = angle * Math.PI / 180;
    return { x: cx + Math.cos(radians) * radius, y: cy + Math.sin(radians) * radius };
  };
  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);
  const innerEnd = point(innerRadius, endAngle);
  const innerStart = point(innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
}

export function BonusOverviewCard() {
  const [selectedId, setSelectedId] = useState(DEMO_BONUSES[0].id);
  const selected = DEMO_BONUSES.find((row) => row.id === selectedId) ?? DEMO_BONUSES[0];
  const percent = selected.maxEur > 0 ? Math.round(selected.earnedEur / selected.maxEur * 100) : 0;
  const remainingEur = selected.maxEur - selected.earnedEur;
  const maxGoalEur = Math.max(...selected.goals.map((goal) => goal.maxEur));
  const ringEndAngle = -90 + Math.min(percent * 3.6, 359.99);

  return (
    <section style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <header style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(220,38,38,0.07)", color: "#c5262b" }}><Award size={17} /></span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.36)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Boni Auswertung</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Dashboard-Boni</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#991b1b", background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.15)", borderRadius: 6, padding: "2px 6px" }}>DEMODATEN</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.42)" }}>Vorschau · nicht mit Echtdaten verbunden</span>
          <IppMiniDropdown label="GM" value={selectedId} placeholder="GM wählen" options={demoGmOptions} minWidth={180} onChange={(value) => setSelectedId(value ?? DEMO_BONUSES[0].id)} />
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: 10 }}>
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "11px 14px", background: "rgba(0,0,0,0.015)", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Chart</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Bonus nach Kategorie</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "#6b7280" }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, marginRight: 5, borderRadius: 3, background: "rgba(220,38,38,0.34)", border: "1px solid rgba(220,38,38,0.82)" }} />Erreicht</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, marginRight: 5, borderRadius: 3, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.32)" }} />Ziel</span>
            </div>
          </div>
          <div style={{ padding: "14px 18px 9px" }}>
            <svg viewBox="0 0 680 245" role="img" aria-label={`Demo-Bonus nach Kategorie für ${selected.name}`} style={{ display: "block", width: "100%", height: "auto", maxHeight: 260, fontFamily: "inherit" }}>
              {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = 187 - step * 150;
                return <g key={step}><line x1="49" x2="660" y1={y} y2={y} stroke="#e9ebef" strokeDasharray={step === 0 ? undefined : "3 5"} /><text x="37" y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{Math.round(step * maxGoalEur)}</text></g>;
              })}
              {selected.goals.map((goal, index) => {
                const x = 112 + index * 150;
                const targetHeight = goal.maxEur / maxGoalEur * 150;
                const earnedHeight = goal.maxEur > 0 ? goal.earnedEur / goal.maxEur * (targetHeight - 6) : 0;
                return <g key={goal.id}>
                  <title>{`${goal.name}: ${euro.format(goal.earnedEur)} von ${euro.format(goal.maxEur)}`}</title>
                  <rect x={x} y={187 - targetHeight} width="45" height={targetHeight} rx="5" fill="rgba(220,38,38,0.06)" stroke="rgba(220,38,38,0.32)" strokeWidth={1.5} />
                  {earnedHeight > 0 && <rect x={x + 3} y={184 - earnedHeight} width="39" height={earnedHeight} rx="4" fill="rgba(220,38,38,0.34)" stroke="rgba(220,38,38,0.82)" strokeWidth={1.5} />}
                  <text x={x + 22.5} y={177 - targetHeight} textAnchor="middle" fontSize="11" fontWeight="700" fill="#374151">{euro.format(goal.earnedEur)}</text>
                  <text x={x + 22.5} y="207" textAnchor="middle" fontSize="11" fontWeight="600" fill="#374151">{goal.name}</text>
                  <text x={x + 22.5} y="224" textAnchor="middle" fontSize="10" fill="#9ca3af">von {euro.format(goal.maxEur)}</text>
                </g>;
              })}
            </svg>
          </div>
          {selected.goals.some((goal) => goal.pending) && (
            <div style={{ padding: "0 18px 14px", fontSize: 10, color: "#9a6700" }}>
              {selected.goals.filter((goal) => goal.pending).map((goal) => goal.name).join(", ")}: Bewertung ausstehend
            </div>
          )}
        </section>

        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "11px 14px", background: "rgba(0,0,0,0.015)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Verteilung</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Bonusziel · {selected.name}</div>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexWrap: "wrap", minHeight: 236 }}>
            <div style={{ position: "relative", width: 174, height: 174, flex: "0 0 auto" }}>
              <svg viewBox="0 0 174 174" role="img" aria-label={`${percent}% des Demo-Bonusziels erreicht`} style={{ width: "100%", height: "100%", fontFamily: "inherit" }}>
                <path d={ringSegmentPath(87, 87, 69, 54, -90, 269.99)} fill="rgba(220,38,38,0.06)" stroke="rgba(220,38,38,0.32)" strokeWidth={1.5} />
                {percent > 0 && <path d={ringSegmentPath(87, 87, 66, 57, -90, ringEndAngle)} fill="rgba(220,38,38,0.34)" stroke="rgba(220,38,38,0.82)" strokeWidth={1.5} />}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#b91c1c", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{percent}%</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 5 }}>Erreicht</span>
              </div>
            </div>
            <div style={{ minWidth: 170, flex: "1 1 170px", maxWidth: 260 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Aktueller Bonus</div>
              <div style={{ fontSize: 29, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{euro.format(selected.earnedEur)}</div>
              <div style={{ height: 1, background: "#eceef1", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#6b7280" }}><span>Bonusziel</span><strong style={{ color: "#374151" }}>{euro.format(selected.maxEur)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#6b7280", marginTop: 8 }}><span>Noch offen</span><strong style={{ color: "#374151" }}>{euro.format(remainingEur)}</strong></div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 14 }}>Beispielwerte · keine Abrechnung</div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
