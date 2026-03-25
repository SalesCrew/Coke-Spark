"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ClipboardList, Zap, Refrigerator, FlaskConical, ShoppingBag,
  Upload, Calendar, ChevronRight, Users, FileSpreadsheet,
} from "lucide-react";

// ── Colors ────────────────────────────────────────────────────
const R = "#DC2626";
const RD = "#b91c1c";
const R_BG = "rgba(220,38,38,0.06)";
const R_BORDER = "rgba(220,38,38,0.18)";

// ── Mock data ─────────────────────────────────────────────────
const MOCK_MARKETS = [
  { id: "m1",  name: "Billa Wien 10",          region: "Ost",  gm: "Thomas Maier" },
  { id: "m2",  name: "Billa Wien 12",          region: "Ost",  gm: "Thomas Maier" },
  { id: "m3",  name: "Merkur Graz Hauptplatz", region: "Süd",  gm: "Anna Gruber" },
  { id: "m4",  name: "Spar Linz Nord",         region: "West", gm: "Michael Huber" },
  { id: "m5",  name: "Billa Wien 6",           region: "Ost",  gm: "Thomas Maier" },
  { id: "m6",  name: "Billa Mödling",          region: "Ost",  gm: "Sandra Koch" },
  { id: "m7",  name: "Merkur Wien 22",         region: "Ost",  gm: "Thomas Maier" },
  { id: "m8",  name: "Spar Graz West",         region: "Süd",  gm: "Anna Gruber" },
  { id: "m9",  name: "Billa Baden",            region: "Ost",  gm: "Sandra Koch" },
  { id: "m10", name: "Merkur Salzburg",        region: "West", gm: "Peter Wimmer" },
  { id: "m11", name: "Billa Wien 15",          region: "Ost",  gm: "Thomas Maier" },
  { id: "m12", name: "Spar Wels",              region: "West", gm: "Michael Huber" },
  { id: "m13", name: "Billa Klagenfurt",       region: "Süd",  gm: "Anna Gruber" },
  { id: "m14", name: "Merkur Innsbruck",       region: "Nord", gm: "Klaus Berger" },
  { id: "m15", name: "Billa Wien 3",           region: "Ost",  gm: "Thomas Maier" },
  { id: "m16", name: "Spar St. Pölten",        region: "Ost",  gm: "Sandra Koch" },
  { id: "m17", name: "Billa Salzburg Mitte",   region: "West", gm: "Peter Wimmer" },
  { id: "m18", name: "Merkur Villach",         region: "Süd",  gm: "Anna Gruber" },
  { id: "m19", name: "Spar Innsbruck Ost",     region: "Nord", gm: "Klaus Berger" },
  { id: "m20", name: "Billa Bregenz",          region: "Nord", gm: "Klaus Berger" },
];

const FLEX_MARKETS_COUNT = 2800;

const CAMPAIGN_TYPES = [
  { id: "standart",    label: "Standartbesuch",  icon: ClipboardList, color: R,         bg: R_BG,                      border: R_BORDER,                      autoMarkets: false },
  { id: "flex",        label: "Flexbesuch",       icon: Zap,           color: "#84CC16", bg: "rgba(132,204,22,0.06)",   border: "rgba(132,204,22,0.2)",        autoMarkets: true  },
  { id: "kuehler",     label: "Kühlerinventur",   icon: Refrigerator,  color: "#D97706", bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.2)",        autoMarkets: false },
  { id: "mhd",         label: "MHD",              icon: FlaskConical,  color: "#7C3AED", bg: "rgba(124,58,237,0.06)",   border: "rgba(124,58,237,0.2)",        autoMarkets: false },
  { id: "billa",       label: "Billa",            icon: ShoppingBag,   color: "#0891B2", bg: "rgba(8,145,178,0.06)",    border: "rgba(8,145,178,0.2)",         autoMarkets: false },
];

const STEPS = [
  { id: 1, label: "Typ",       sub: "Kampagnentyp wählen"     },
  { id: 2, label: "Details",   sub: "Name & Zeitraum"          },
  { id: 3, label: "Märkte",    sub: "Märkte importieren"       },
  { id: 4, label: "Übersicht", sub: "Prüfen & erstellen"       },
];

// ── Date Picker ───────────────────────────────────────────────
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function DatePicker({ value, onChange, placeholder = "Datum wählen", disabled = false, accentColor = R, accentBg = R_BG }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; accentColor?: string; accentBg?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function select(d: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }
  function prev() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function next() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }

  const display = parsed ? parsed.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
          background: disabled ? "rgba(0,0,0,0.015)" : "#fff",
          border: `1px solid ${open ? accentColor : "rgba(0,0,0,0.08)"}`,
          boxShadow: open ? `0 0 0 3px ${accentBg}` : "none",
          color: display ? "#111" : "rgba(0,0,0,0.25)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease", opacity: disabled ? 0.45 : 1,
        }}
      >
        <span style={{ fontWeight: display ? 500 : 400 }}>{display || placeholder}</span>
        <Calendar size={13} strokeWidth={1.6} color="rgba(0,0,0,0.3)" />
      </button>

      {open && !disabled && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
          background: "#fff", borderRadius: 12, userSelect: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          padding: "14px 14px 10px", width: 248,
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "rgba(0,0,0,0.4)", fontSize: 16, lineHeight: 1, transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={next} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "rgba(0,0,0,0.4)", fontSize: 16, lineHeight: 1, transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEKDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", paddingBottom: 6, letterSpacing: "0.04em" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isTdy = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSel = parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear();
              return (
                <button key={i} type="button" onClick={() => select(d)} style={{
                  width: "100%", aspectRatio: "1", borderRadius: 7, border: "none",
                  background: isSel ? `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))` : isTdy ? accentBg : "transparent",
                  color: isSel ? "#fff" : isTdy ? accentColor : "#1a1a1a",
                  fontSize: 11, fontWeight: isSel || isTdy ? 600 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: isSel ? `inset 0 1px 0.6px rgba(255,255,255,0.33), 0 0 0 1px ${accentColor}` : "none",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isTdy ? accentBg : "transparent"; }}
                >{d}</button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5 }} onMouseEnter={e => (e.currentTarget.style.color = accentColor)} onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,0,0,0.35)")}>Löschen</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 1: Type selection ────────────────────────────────────
function StepTyp({ selected, onSelect, onNext, onCancel, accentColor, accentBg }: {
  selected: string; onSelect: (id: string) => void;
  onNext: () => void; onCancel: () => void;
  accentColor: string; accentBg: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Kampagnentyp wählen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0, fontWeight: 400 }}>Wähle den Typ der Kampagne, die du erstellen möchtest.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {CAMPAIGN_TYPES.map((t) => {
          const Icon = t.icon;
          const isSel = selected === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: "20px 18px",
                borderRadius: 12,
                border: `1.5px solid ${isSel ? t.color : "rgba(0,0,0,0.07)"}`,
                backgroundColor: isSel ? t.bg : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: isSel ? `0 0 0 3px ${t.bg}, 0 2px 8px rgba(0,0,0,0.06)` : "0 1px 4px rgba(0,0,0,0.04)",
                position: "relative",
              }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.14)"; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.07)"; }}
            >
              {isSel && (
                <div style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderRadius: "50%", backgroundColor: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={10} strokeWidth={2.5} color="#fff" />
                </div>
              )}
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isSel ? t.color : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                <Icon size={18} strokeWidth={1.8} color={isSel ? "#fff" : "rgba(0,0,0,0.4)"} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.015em", marginBottom: 4 }}>{t.label}</div>
                {t.autoMarkets && (
                  <div style={{ fontSize: 10, color: t.color, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: t.color }} />
                    Alle Märkte automatisch
                  </div>
                )}
                {!t.autoMarkets && (
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>Märkte manuell importieren</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom buttons inside the card */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 20, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
            fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
            background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: "rgba(0,0,0,0.5)",
            boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          }}
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onNext}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 22px",
            fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
            background: `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`,
            color: "#fff",
            boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${accentColor}, 0 1px 6px ${accentColor}44`,
            transition: "all 0.25s ease",
          }}
        >
          Weiter
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Details ───────────────────────────────────────────
function StepDetails({ name, setName, startDate, setStartDate, endDate, setEndDate, startNow, setStartNow, accentColor = R, accentBg = R_BG }: {
  name: string; setName: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  startNow: boolean; setStartNow: (v: boolean) => void;
  accentColor?: string; accentBg?: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [nameFocused, setNameFocused] = useState(false);

  function fmt(iso: string) {
    if (!iso) return null;
    return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", letterSpacing: "-0.03em", margin: "0 0 5px" }}>Details festlegen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.36)", margin: 0, fontWeight: 400, letterSpacing: "-0.005em" }}>Name und Zeitraum der Kampagne</p>
      </div>

      {/* Name field */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 9 }}>Kampagnenname</div>
        <div style={{
          borderRadius: 9,
          border: `1px solid ${nameFocused ? accentColor : "rgba(0,0,0,0.08)"}`,
          boxShadow: nameFocused ? `0 0 0 3px ${accentBg}` : "none",
          background: "#fff",
          transition: "border-color 0.15s, box-shadow 0.15s",
          overflow: "hidden",
        }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="z. B. Standartbesuch KW14"
            style={{
              fontSize: 13, fontWeight: 500, color: "#111",
              padding: "10px 14px", width: "100%", boxSizing: "border-box",
              background: "transparent", border: "none", outline: "none",
              fontFamily: "inherit", letterSpacing: "-0.01em",
            }}
          />
        </div>
        {name && (
          <div style={{ marginTop: 7, fontSize: 11, color: "rgba(0,0,0,0.32)", fontWeight: 400, paddingLeft: 2, letterSpacing: "-0.005em" }}>
            Kampagne wird als <span style={{ fontWeight: 600, color: "rgba(0,0,0,0.55)" }}>&ldquo;{name}&rdquo;</span> gespeichert
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.05)", margin: "28px 0" }} />

      {/* Zeitraum */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase" }}>Zeitraum</div>

          {/* Jetzt starten toggle */}
          <button
            type="button"
            onClick={() => { setStartNow(!startNow); if (!startNow) setStartDate(today); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 8px",
              borderRadius: 20, border: `1px solid ${startNow ? accentColor : "rgba(0,0,0,0.09)"}`,
              background: startNow ? accentBg : "#fff",
              cursor: "pointer", transition: "all 0.18s ease",
              boxShadow: startNow ? `0 0 0 2px ${accentBg}` : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: startNow ? `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))` : "rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s",
              boxShadow: startNow ? `0 1px 4px ${accentColor}55` : "none",
              flexShrink: 0,
            }}>
              {startNow && <Check size={9} strokeWidth={3} color="#fff" />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: startNow ? accentColor : "rgba(0,0,0,0.4)", transition: "color 0.15s", letterSpacing: "-0.005em" }}>Jetzt starten</span>
          </button>
        </div>

        {/* Date pickers row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em" }}>Von</span>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Startdatum wählen" disabled={startNow} accentColor={accentColor} accentBg={accentBg} />
            {startNow && (
              <span style={{ fontSize: 10, color: accentColor, fontWeight: 600, letterSpacing: "-0.005em", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: accentColor, flexShrink: 0 }} />
                Startet heute
              </span>
            )}
          </div>

          {/* Arrow between */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "30px 16px 0" }}>
            <svg width="16" height="2" viewBox="0 0 16 2" fill="none"><line x1="0" y1="1" x2="16" y2="1" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.3)", letterSpacing: "0.04em" }}>Bis</span>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="Enddatum wählen" accentColor={accentColor} accentBg={accentBg} />
          </div>
        </div>

        {/* Duration hint */}
        {startDate && endDate && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2"/><path d="M6.5 3.5v3l2 1.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontWeight: 500, letterSpacing: "-0.005em" }}>
              {fmt(startDate)} &nbsp;→&nbsp; {fmt(endDate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Markets ───────────────────────────────────────────
function StepMaerkte({ typeId, markets, onLoad }: {
  typeId: string;
  markets: typeof MOCK_MARKETS;
  onLoad: (m: typeof MOCK_MARKETS) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const isAuto = CAMPAIGN_TYPES.find(t => t.id === typeId)?.autoMarkets ?? false;
  const hasMarkets = markets.length > 0;

  const regionCounts = { Nord: 0, Ost: 0, Süd: 0, West: 0 } as Record<string, number>;
  markets.forEach(m => { regionCounts[m.region] = (regionCounts[m.region] || 0) + 1; });

  const gmMap: Record<string, number> = {};
  markets.forEach(m => { gmMap[m.gm] = (gmMap[m.gm] || 0) + 1; });
  const gms = Object.entries(gmMap).sort((a, b) => b[1] - a[1]);

  const uniqueGms = Object.keys(gmMap).length;
  const uniqueRegions = Object.values(regionCounts).filter(v => v > 0).length;

  const regionColors: Record<string, string> = { Nord: "#0891B2", Ost: "#DC2626", Süd: "#16a34a", West: "#D97706" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Märkte importieren</h3>
          <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0 }}>
            {isAuto ? "Alle Märkte sind automatisch enthalten." : hasMarkets ? `${markets.length} Märkte geladen · ${uniqueGms} GMs · ${uniqueRegions} Regionen` : "Importiere die Märkte per Excel oder lade Testmärkte."}
          </p>
        </div>
        {hasMarkets && !isAuto && (
          <button
            type="button"
            onClick={() => onLoad([])}
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: "none",
              cursor: "pointer", color: "rgba(0,0,0,0.4)",
              background: "rgba(0,0,0,0.04)", transition: "all 0.15s",
              flexShrink: 0, marginTop: 2,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = R; (e.currentTarget as HTMLButtonElement).style.background = R_BG; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}
          >
            Ändern
          </button>
        )}
      </div>

      {isAuto ? (
        <div style={{
          padding: "20px 22px", borderRadius: 12, border: "1.5px solid rgba(132,204,22,0.25)",
          backgroundColor: "rgba(132,204,22,0.05)", display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(132,204,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={18} strokeWidth={1.8} color="#65a30d" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.015em", marginBottom: 2 }}>
              {FLEX_MARKETS_COUNT.toLocaleString("de-AT")} Märkte automatisch enthalten
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontWeight: 400 }}>Bei Flexbesuchen werden alle aktiven Märkte automatisch zugewiesen.</div>
          </div>
        </div>
      ) : !hasMarkets ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); }}
            style={{
              border: `2px dashed ${dragging ? R : "rgba(0,0,0,0.10)"}`,
              borderRadius: 14, padding: "40px 24px",
              backgroundColor: dragging ? R_BG : "rgba(0,0,0,0.012)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              cursor: "pointer", transition: "all 0.18s ease", textAlign: "center",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: dragging ? R_BG : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              <FileSpreadsheet size={22} strokeWidth={1.5} color={dragging ? R : "rgba(0,0,0,0.28)"} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? R : "#1a1a1a", letterSpacing: "-0.012em", marginBottom: 4 }}>Excel-Datei hier ablegen</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.32)", fontWeight: 400, letterSpacing: "0.005em" }}>oder klicken zum Auswählen · .xlsx, .xls</div>
            </div>
            <button
              type="button"
              style={{
                marginTop: 2, padding: "8px 20px", fontSize: 11, fontWeight: 600, borderRadius: 8,
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", cursor: "pointer",
                border: "none", color: "rgba(0,0,0,0.48)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
                letterSpacing: "0.005em",
              }}
            >
              <Upload size={10} strokeWidth={2} style={{ marginRight: 6, display: "inline", verticalAlign: "middle" }} />
              Datei auswählen
            </button>
          </div>

          {/* Divider + fake data */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "rgba(0,0,0,0.055)" }} />
            <button
              type="button"
              onClick={() => onLoad(MOCK_MARKETS)}
              style={{
                padding: "6px 16px", fontSize: 10, fontWeight: 600, borderRadius: 7,
                backgroundColor: "transparent", border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer",
                color: "rgba(0,0,0,0.38)", transition: "all 0.15s", letterSpacing: "0.02em",
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = R; b.style.color = R; b.style.backgroundColor = R_BG; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(0,0,0,0.09)"; b.style.color = "rgba(0,0,0,0.38)"; b.style.backgroundColor = "transparent"; }}
            >
              Testmärkte laden
            </button>
            <div style={{ flex: 1, height: 1, backgroundColor: "rgba(0,0,0,0.055)" }} />
          </div>
        </>
      ) : (
        // ── Imported state ────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>


          {/* Region breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Regionen</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["Nord", "Ost", "Süd", "West"] as const).map(name => {
                const count = regionCounts[name] || 0;
                const pct = markets.length > 0 ? Math.round((count / markets.length) * 100) : 0;
                const c = regionColors[name];
                return (
                  <div key={name} style={{
                    padding: "12px 14px", borderRadius: 10, border: `1px solid ${c}22`,
                    backgroundColor: `${c}08`, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c, letterSpacing: "0.01em" }}>{name}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, backgroundColor: `${c}20` }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: c, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{pct}% aller Märkte</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GMs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gebietsmanager</span>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.055)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
              {gms.map(([gm, count], i) => {
                const pct = Math.round((count / markets.length) * 100);
                return (
                  <div key={gm} style={{
                    display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
                    borderBottom: i < gms.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    backgroundColor: "#fff",
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.03))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Users size={13} strokeWidth={1.7} color="rgba(0,0,0,0.32)" />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{gm}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 64, height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.18)", transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 500, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count} {count === 1 ? "Markt" : "Märkte"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Märkte</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>{markets.length} gesamt</span>
            </div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.055)", overflow: "hidden", maxHeight: 240, overflowY: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", scrollbarWidth: "none" } as React.CSSProperties}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 140px", padding: "7px 16px", backgroundColor: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.055)" }}>
                {["Markt", "Region", "GM"].map(h => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>
              {markets.map((m, i) => (
                <div key={m.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 60px 140px",
                  alignItems: "center", padding: "9px 16px",
                  borderBottom: i < markets.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  backgroundColor: i % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{m.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: regionColors[m.region], letterSpacing: "0.01em" }}>{m.region}</span>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 400 }}>{m.gm}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────
function StepUebersicht({ typeId, name, startDate, endDate, startNow, markets }: {
  typeId: string; name: string; startDate: string; endDate: string; startNow: boolean;
  markets: typeof MOCK_MARKETS;
}) {
  const t = CAMPAIGN_TYPES.find(c => c.id === typeId);
  const isAuto = t?.autoMarkets ?? false;
  const count = isAuto ? FLEX_MARKETS_COUNT : markets.length;

  function fmt(iso: string) {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const durationDays = startDate && endDate
    ? Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000)
    : null;

  const gmMap: Record<string, number> = {};
  markets.forEach(m => { gmMap[m.gm] = (gmMap[m.gm] || 0) + 1; });
  const regionCounts = { Nord: 0, Ost: 0, Süd: 0, West: 0 } as Record<string, number>;
  markets.forEach(m => { regionCounts[m.region] = (regionCounts[m.region] || 0) + 1; });
  const regionColors: Record<string, string> = { Nord: "#0891B2", Ost: "#DC2626", Süd: "#16a34a", West: "#D97706" };

  const rows = [
    { label: "Typ", custom: t ? (
      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: t.bg, color: t.color }}>{t.label}</span>
    ) : null },
    { label: "Name", value: name || "—" },
    { label: "Startdatum", value: startNow ? "Sofort" : fmt(startDate) },
    { label: "Enddatum", value: fmt(endDate) },
    ...(durationDays !== null && durationDays > 0 ? [{ label: "Laufzeit", value: `${durationDays} Tage` }] : []),
    { label: "Märkte", value: `${count.toLocaleString("de-AT")} Märkte` },
    ...(!isAuto && Object.keys(gmMap).length > 0 ? [{ label: "GMs", value: `${Object.keys(gmMap).length} Gebietsmanager` }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 6px" }}>Kampagne prüfen</h3>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", margin: 0 }}>Überprüfe alle Angaben bevor du die Kampagne erstellst.</p>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{
            display: "flex", alignItems: "center", padding: "13px 18px", gap: 16,
            borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
            backgroundColor: i % 2 === 0 ? "#fff" : "rgba(0,0,0,0.01)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.35)", width: 100, flexShrink: 0, letterSpacing: "0.01em" }}>{row.label}</span>
            {row.custom ?? <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{row.value}</span>}
          </div>
        ))}
      </div>

      {/* Region + GM breakdown — only if markets imported */}
      {!isAuto && markets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Region cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Regionen</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["Nord", "Ost", "Süd", "West"] as const).map(rname => {
                const c = regionCounts[rname] || 0;
                const pct = Math.round(c / markets.length * 100);
                const col = regionColors[rname];
                return (
                  <div key={rname} style={{
                    padding: "12px 14px", borderRadius: 10, border: `1px solid ${col}20`,
                    backgroundColor: `${col}07`, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: col, letterSpacing: "0.03em" }}>{rname}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: c > 0 ? "#1a1a1a" : "rgba(0,0,0,0.18)", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{c}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, backgroundColor: `${col}18` }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: col }} />
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{pct}% der Märkte</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GM list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gebietsmanager</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>{Object.keys(gmMap).length} gesamt</span>
            </div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {Object.entries(gmMap).sort((a, b) => b[1] - a[1]).map(([gm, cnt], i, arr) => {
                const pct = Math.round(cnt / markets.length * 100);
                return (
                  <div key={gm} style={{
                    display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    backgroundColor: "#fff",
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={12} strokeWidth={1.7} color="rgba(0,0,0,0.32)" />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.008em" }}>{gm}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 56, height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.06)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.18)" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 500, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cnt} {cnt === 1 ? "Markt" : "Märkte"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Flex — fixed region stats for all 2 800 markets */}
      {isAuto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Region cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Regionen (alle Märkte)</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {([
                { name: "Nord", count: 420,  pct: 15, col: "#0891B2" },
                { name: "Ost",  count: 980,  pct: 35, col: "#DC2626" },
                { name: "Süd",  count: 700,  pct: 25, col: "#16a34a" },
                { name: "West", count: 700,  pct: 25, col: "#D97706" },
              ]).map(r => (
                <div key={r.name} style={{
                  padding: "12px 14px", borderRadius: 10, border: `1px solid ${r.col}20`,
                  backgroundColor: `${r.col}07`, display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: r.col, letterSpacing: "0.03em" }}>{r.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{r.count.toLocaleString("de-AT")}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, backgroundColor: `${r.col}18` }}>
                    <div style={{ height: "100%", width: `${r.pct}%`, borderRadius: 99, backgroundColor: r.col }} />
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontWeight: 500 }}>{r.pct}% der Märkte</span>
                </div>
              ))}
            </div>
          </div>

          {/* GM summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gebietsmanager</span>
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>ca. 140 gesamt</span>
            </div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", padding: "14px 18px", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Users size={16} strokeWidth={1.6} color="rgba(0,0,0,0.3)" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em", marginBottom: 2 }}>Alle GMs automatisch enthalten</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", fontWeight: 400 }}>Bei Flexbesuchen werden sämtliche aktiven Gebietsmanager einbezogen.</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Warnings */}
      {(!name || (!isAuto && markets.length === 0)) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!name && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#b45309", fontWeight: 500 }}>Kampagnenname fehlt</span>
            </div>
          )}
          {!isAuto && markets.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#b45309", fontWeight: 500 }}>Keine Märkte importiert</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function NeuKampagnePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [typeId, setTypeId] = useState("standart");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [markets, setMarkets] = useState<typeof MOCK_MARKETS>([]);

  const activetype = CAMPAIGN_TYPES.find(t => t.id === typeId) ?? CAMPAIGN_TYPES[0];
  const AC = activetype.color;                           // accent color
  const AC_BG = activetype.bg;                          // accent bg tint
  const AC_BORDER = activetype.border;                  // accent border
  const AC_DARK = AC.replace(/^#/, "");                 // used for shadow hex
  const isAuto = activetype.autoMarkets;

  const canProceed = (() => {
    if (step === 1) return !!typeId;
    if (step === 2) return !!name;
    if (step === 3) return isAuto || markets.length > 0;
    return true;
  })();

  const canCreate = !!name && (isAuto || markets.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "calc(100vh - 80px)" }}>

      {/* Inner layout */}
      <div style={{ display: "flex", flex: 1, gap: 0 }}>

        {/* Stepper sidebar */}
        <div style={{
          width: 220, flexShrink: 0,
          backgroundColor: "#ffffff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          padding: "28px 16px",
          display: "flex", flexDirection: "column", gap: 4,
          alignSelf: "flex-start",
          position: "sticky", top: 28,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", padding: "0 8px", marginBottom: 10, display: "block" }}>Schritte</span>
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            return (
              <div
                key={s.id}
                onClick={() => isDone && setStep(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 10px",
                  borderRadius: 9, cursor: isDone ? "pointer" : "default",
                  backgroundColor: isCurrent ? AC_BG : "transparent",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={e => { if (isDone && !isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: isDone || isCurrent ? AC : "rgba(0,0,0,0.07)",
                  border: `1.5px solid ${isDone || isCurrent ? "transparent" : "rgba(0,0,0,0.1)"}`,
                  transition: "all 0.25s ease",
                }}>
                  {isDone
                    ? <Check size={11} strokeWidth={2.5} color="#fff" />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? "#fff" : "rgba(0,0,0,0.4)" }}>{s.id}</span>
                  }
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? "#1a1a1a" : isDone ? "#1a1a1a" : "rgba(0,0,0,0.4)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 400, marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}

          {/* Progress line */}
          <div style={{ margin: "16px 10px 0", height: 3, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, backgroundColor: AC, width: `${((step - 1) / (STEPS.length - 1)) * 100}%`, transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background-color 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", fontWeight: 500, padding: "4px 10px 0" }}>Schritt {step} von {STEPS.length}</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Content card */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: 14,
            border: `1px solid ${step > 1 ? AC_BORDER : "rgba(0,0,0,0.06)"}`,
            boxShadow: step > 1 ? `0 2px 12px rgba(0,0,0,0.05), 0 0 0 3px ${AC_BG}` : "0 2px 12px rgba(0,0,0,0.05)",
            padding: "32px 36px",
            flex: 1,
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          }}>
            {step === 1 && <StepTyp selected={typeId} onSelect={setTypeId} onNext={() => setStep(2)} onCancel={() => router.push("/admin/fbmanagement")} accentColor={AC} accentBg={AC_BG} />}
            {step === 2 && (
              <StepDetails
                name={name} setName={setName}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                startNow={startNow} setStartNow={setStartNow}
                accentColor={AC} accentBg={AC_BG}
              />
            )}
            {step === 3 && <StepMaerkte typeId={typeId} markets={markets} onLoad={setMarkets} />}
            {step === 4 && (
              <StepUebersicht
                typeId={typeId} name={name}
                startDate={startDate} endDate={endDate}
                startNow={startNow} markets={markets}
              />
            )}
          </div>

          {/* Navigation buttons — hidden on step 1 (buttons live inside the card) */}
          {step > 1 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/admin/fbmanagement")}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer",
                background: "linear-gradient(to bottom, #ffffff, #f5f5f5)", color: "rgba(0,0,0,0.5)",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
            >
              <ArrowLeft size={13} strokeWidth={2} />
              {step === 1 ? "Abbrechen" : "Zurück"}
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => canProceed && setStep(s => s + 1)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 22px",
                  fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none",
                  cursor: canProceed ? "pointer" : "not-allowed",
                  background: canProceed ? `linear-gradient(to bottom, ${AC}, color-mix(in srgb, ${AC} 80%, black))` : "rgba(0,0,0,0.08)",
                  color: canProceed ? "#fff" : "rgba(0,0,0,0.3)",
                  boxShadow: canProceed ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${AC}, 0 1px 6px ${AC}44` : "none",
                  transition: "all 0.25s ease", opacity: canProceed ? 1 : 0.6,
                }}
              >
                Weiter
                <ChevronRight size={13} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!canCreate) return;
                  const regionCounts = { Nord: 0, Ost: 0, Süd: 0, West: 0 } as Record<string, number>;
                  if (isAuto) {
                    regionCounts["Nord"] = 420; regionCounts["Ost"] = 980; regionCounts["Süd"] = 700; regionCounts["West"] = 700;
                  } else {
                    markets.forEach(m => { regionCounts[m.region] = (regionCounts[m.region] || 0) + 1; });
                  }
                  const total = isAuto ? 2800 : markets.length;
                  const newCampaign = {
                    id: `new-${Date.now()}`,
                    name,
                    type: typeId,
                    color: AC,
                    inactive: false,
                    filled: 0,
                    total,
                    todayNew: 0,
                    thisWeek: 0,
                    regions: ["Nord", "Ost", "Süd", "West"].map(r => ({ name: r, pct: 0 })),
                  };
                  try {
                    const existing = JSON.parse(localStorage.getItem("fbm_new_campaigns") || "[]");
                    localStorage.setItem("fbm_new_campaigns", JSON.stringify([newCampaign, ...existing]));
                  } catch {}
                  router.push("/admin/fbmanagement");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 28px",
                  fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none",
                  cursor: canCreate ? "pointer" : "not-allowed",
                  background: canCreate ? `linear-gradient(to bottom, ${AC}, color-mix(in srgb, ${AC} 80%, black))` : "rgba(0,0,0,0.08)",
                  color: canCreate ? "#fff" : "rgba(0,0,0,0.3)",
                  boxShadow: canCreate ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${AC}, 0 2px 8px ${AC}55` : "none",
                  transition: "all 0.25s ease", letterSpacing: "-0.01em",
                }}
              >
                <Check size={14} strokeWidth={2.5} />
                Kampagne erstellen
              </button>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
}
