"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Star,
  HeartPulse,
  Wrench,
  Home,
  GraduationCap,
  Warehouse,
  Route,
  BedDouble,
  Clock,
  ChevronLeft,
  Check,
  Search,
} from "lucide-react";

interface Market {
  chain: string;
  address: string;
}

const tempMarkets: Market[] = [
  { chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien" },
  { chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien" },
  { chain: "ADEG", address: "Landstraße 45, 1030 Wien" },
  { chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien" },
  { chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien" },
  { chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien" },
  { chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien" },
  { chain: "ADEG", address: "Brünner Str. 130, 1210 Wien" },
];

function chainColor(chain: string): { bg: string; text: string } {
  const k = chain.toUpperCase();
  if (k.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (k.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (k.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (k.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (k.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

const activities = [
  { key: "sonderaufgabe", label: "Sonderaufgabe", icon: Star },
  { key: "arztbesuch", label: "Arztbesuch", icon: HeartPulse },
  { key: "werkstatt", label: "Werkstatt/Autoreinigung", icon: Wrench },
  { key: "homeoffice", label: "Homeoffice", icon: Home },
  { key: "schulung", label: "Schulung", icon: GraduationCap },
  { key: "lager", label: "Lager", icon: Warehouse },
  { key: "heimfahrt", label: "Heimfahrt", icon: Route },
  { key: "hotel", label: "Hotelübernachtung", icon: BedDouble },
] as const;

type View =
  | "idle"
  | "selectMarket"
  | "marketConfirmed";

function fmtTimer(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// ── Clock Picker ──────────────────────────────────────────────

interface ClockPickerProps {
  onSelect: (h: number, m: number) => void;
  onCancel: () => void;
}

function ClockPicker({ onSelect, onCancel }: ClockPickerProps) {
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const items = step === "hour" ? hours : minutes;
  const selected = step === "hour" ? hour : minute;

  const R = 76;
  const CENTER = 90;
  const NUM_R = 62;

  function angleFor(val: number): number {
    const count = step === "hour" ? 24 : 12;
    return (val / (step === "hour" ? 24 : 60)) * 360 - 90;
  }

  function posFor(val: number) {
    const inner = step === "hour" && val >= 12;
    const r = inner ? NUM_R - 22 : NUM_R;
    const displayVal = step === "hour" ? val : val;
    const count = step === "hour" ? 12 : 12;
    const idx = step === "hour" ? val % 12 : val / 5;
    const a = (idx / count) * 360 - 90;
    const rad = (a * Math.PI) / 180;
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
  }

  function handleTap(val: number) {
    if (step === "hour") {
      setHour(val);
      setTimeout(() => setStep("minute"), 200);
    } else {
      setMinute(val);
      setTimeout(() => onSelect(hour, val), 150);
    }
  }

  const selPos = posFor(selected);
  const selAngle = (() => {
    const count = 12;
    const idx = step === "hour" ? selected % 12 : selected / 5;
    return (idx / count) * 360 - 90;
  })();
  const selRad = (selAngle * Math.PI) / 180;
  const inner = step === "hour" && selected >= 12;
  const lineR = inner ? NUM_R - 22 : NUM_R;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(255,255,255,0.97)",
        borderRadius: 14,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        animation: "clockIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes clockIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <span
        className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400"
        style={{ marginBottom: 8 }}
      >
        {step === "hour" ? "Stunde" : "Minute"}
      </span>

      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />

        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER + lineR * Math.cos(selRad)}
          y2={CENTER + lineR * Math.sin(selRad)}
          stroke="#DC2626"
          strokeWidth={1.5}
          strokeLinecap="round"
          style={{ transition: "all 0.15s ease" }}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={3}
          fill="#DC2626"
        />

        {items.map((val) => {
          const p = posFor(val);
          const isSel = val === selected;
          const label = step === "hour"
            ? String(val)
            : String(val).padStart(2, "0");
          return (
            <g
              key={val}
              onClick={() => handleTap(val)}
              style={{ cursor: "pointer" }}
            >
              {isSel && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="#DC2626"
                  style={{ transition: "all 0.15s ease" }}
                />
              )}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={step === "hour" && val >= 12 ? 8 : 9}
                fontWeight={isSel ? 700 : 500}
                fill={isSel ? "#ffffff" : "rgba(0,0,0,0.55)"}
                style={{ transition: "fill 0.15s ease", userSelect: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <span
        className="text-[16px] font-semibold tabular-nums"
        style={{ marginTop: 6, color: "#DC2626" }}
      >
        {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
      </span>

      <button
        onClick={onCancel}
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 500,
          color: "rgba(0,0,0,0.35)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 12px",
        }}
      >
        Abbrechen
      </button>
    </div>
  );
}

// ── Accordion Row ─────────────────────────────────────────────

interface AccordionRowProps {
  activity: (typeof activities)[number];
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
  onRequestClock: (target: "von" | "bis", onSelect: (h: number, m: number) => void) => void;
}

function AccordionRow({ activity, isOpen, onToggle, isLast, onRequestClock }: AccordionRowProps) {
  const Icon = activity.icon;
  const [mode, setMode] = useState<"live" | "manual">("live");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [vonVal, setVonVal] = useState("");
  const [bisVal, setBisVal] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);

  const active = running && !paused;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentH(contentRef.current.scrollHeight);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      setRunning(false);
      setPaused(false);
      setSeconds(0);
    }
  }, [isOpen]);

  function formatTimeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  }

  function openClockFor(target: "von" | "bis") {
    onRequestClock(target, (h, m) => {
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (target === "von") setVonVal(val);
      else setBisVal(val);
    });
  }

  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center gap-3"
        style={{
          height: 38,
          padding: "0 2px",
          cursor: "pointer",
          transition: "background-color 0.12s ease",
          borderRadius: 7,
          borderBottom: !isLast && !isOpen ? "1px solid rgba(0,0,0,0.04)" : "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Icon size={13} strokeWidth={1.5} color="rgba(0,0,0,0.35)" />
        <span className="text-[11px] font-medium text-gray-700">{activity.label}</span>
      </div>

      <div
        style={{
          maxHeight: isOpen ? contentH : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        }}
      >
        <div ref={contentRef} style={{ padding: "6px 0 10px" }}>
          {/* Mode toggle */}
          <div className="flex gap-1.5" style={{ marginBottom: 10 }}>
            {(["live", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={(e) => { e.stopPropagation(); setMode(m); }}
                style={{
                  padding: "3px 14px",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: mode === m ? "rgba(220,38,38,0.08)" : "transparent",
                  color: mode === m ? "#DC2626" : "rgba(0,0,0,0.35)",
                }}
              >
                {m === "live" ? "Live" : "Manuell"}
              </button>
            ))}
          </div>

          {mode === "live" ? (
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[14px] font-semibold tabular-nums"
                  style={{ color: "#DC2626", letterSpacing: "0.04em" }}
                >
                  {fmtTimer(seconds)}
                </span>

                {running ? (
                  <div className="flex gap-1.5 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRunning(false);
                        setPaused(false);
                      }}
                      style={{
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: "#ffffff",
                        background: "linear-gradient(to bottom, #DC2626, #e84040)",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow:
                          "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                      }}
                    >
                      STOP
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaused((p) => !p);
                      }}
                      style={{
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: "#ffffff",
                        background: paused
                          ? "linear-gradient(to bottom, #059669, #0cb880)"
                          : "linear-gradient(to bottom, #ea580c, #f0722e)",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: paused
                          ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)"
                          : "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #d4500b, 0 1px 6px rgba(180,60,8,0.14)",
                      }}
                    >
                      {paused ? "RESUME" : "PAUSE"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRunning(true);
                      setPaused(false);
                      setSeconds(0);
                    }}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      color: "#ffffff",
                      background: "linear-gradient(to bottom, #059669, #0cb880)",
                      border: "none",
                      borderRadius: 7,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow:
                        "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #048560, 0 1px 6px rgba(5,80,50,0.14)",
                    }}
                  >
                    START
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-gray-400 font-medium">Von</span>
                  <input
                    type="text"
                    value={vonVal}
                    onChange={(e) => setVonVal(formatTimeInput(e.target.value))}
                    placeholder="HH:MM"
                    maxLength={5}
                    onClick={(e) => e.stopPropagation()}
                    className="outline-none text-[11px] tabular-nums text-gray-700"
                    style={{
                      width: 48,
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(0,0,0,0.08)",
                      border: "none",
                      borderBlockEnd: "1px solid rgba(0,0,0,0.08)",
                      background: "transparent",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); openClockFor("von"); }}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: "rgba(220,38,38,0.06)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Clock size={10} strokeWidth={1.8} color="#DC2626" />
                  </button>
                </div>

                <span className="text-[10px] text-gray-300">–</span>

                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-gray-400 font-medium">Bis</span>
                  <input
                    type="text"
                    value={bisVal}
                    onChange={(e) => setBisVal(formatTimeInput(e.target.value))}
                    placeholder="HH:MM"
                    maxLength={5}
                    onClick={(e) => e.stopPropagation()}
                    className="outline-none text-[11px] tabular-nums text-gray-700"
                    style={{
                      width: 48,
                      padding: "3px 0",
                      border: "none",
                      borderBlockEnd: "1px solid rgba(0,0,0,0.08)",
                      background: "transparent",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); openClockFor("bis"); }}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: "rgba(220,38,38,0.06)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Clock size={10} strokeWidth={1.8} color="#DC2626" />
                  </button>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVonVal("");
                  setBisVal("");
                }}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "5px 0",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "linear-gradient(to bottom, #DC2626, #e84040)",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow:
                    "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
                  letterSpacing: "0.02em",
                }}
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function ActivityLauncher() {
  const router = useRouter();
  const [view, setView] = useState<View>("idle");
  const [openActivity, setOpenActivity] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cardMaxH, setCardMaxH] = useState<number | undefined>(undefined);
  const [clockHandler, setClockHandler] = useState<((h: number, m: number) => void) | null>(null);
  const [marketSearch, setMarketSearch] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const filteredMarkets = useMemo(() => {
    if (!marketSearch.trim()) return tempMarkets;
    const q = marketSearch.toLowerCase();
    return tempMarkets.filter(
      (m) => m.chain.toLowerCase().includes(q) || m.address.toLowerCase().includes(q)
    );
  }, [marketSearch]);

  useEffect(() => {
    function calc() {
      if (!cardRef.current) return;
      const top = cardRef.current.getBoundingClientRect().top;
      const menuSpace = 80;
      setCardMaxH(window.innerHeight - top - menuSpace);
    }
    requestAnimationFrame(() => requestAnimationFrame(calc));
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const handleRequestClock = useCallback((_target: "von" | "bis", onSelect: (h: number, m: number) => void) => {
    setClockHandler(() => onSelect);
  }, []);

  const handleMarketSelect = useCallback((market: Market) => {
    setConfirmed(true);
    setMarketSearch("");
    setTimeout(() => {
      router.push(`/gm/marktbesuch?chain=${encodeURIComponent(market.chain)}&address=${encodeURIComponent(market.address)}`);
    }, 600);
  }, [router]);

  return (
    <div
      ref={cardRef}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
        overflow: "hidden",
        maxHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Idle View ── */}
      <div
        style={{
          opacity: view === "idle" ? 1 : 0,
          pointerEvents: view === "idle" ? "auto" : "none",
          transform: view === "idle" ? "translateY(0)" : "translateY(-6px)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Marktbesuch row */}
        <div
          className="flex items-center justify-between"
          style={{ paddingBottom: 12 }}
        >
          <div className="flex items-center gap-2.5">
            <Store size={14} strokeWidth={1.6} color="#DC2626" />
            <span className="text-[12px] font-semibold text-gray-800">
              Marktbesuch
            </span>
          </div>
          <button
            onClick={() => setView("selectMarket")}
            style={{
              padding: "4px 14px",
              fontSize: 10,
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(to bottom, #DC2626, #e84040)",
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              boxShadow:
                "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
              transition: "all 0.15s ease",
              letterSpacing: "0.01em",
            }}
          >
            Starten
          </button>
        </div>

        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />

        {/* Zusatzzeiterfassung */}
        <div style={{ marginTop: 12, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-gray-400 shrink-0">
            Zusatzzeiterfassung
          </span>

          <div
            style={{
              marginTop: 8,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {activities.map((a, i) => (
              <AccordionRow
                key={a.key}
                activity={a}
                isOpen={openActivity === a.key}
                onToggle={() =>
                  setOpenActivity((prev) => (prev === a.key ? null : a.key))
                }
                isLast={i === activities.length - 1}
                onRequestClock={handleRequestClock}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Market Selection View ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "18px 20px 16px",
          backgroundColor: "#ffffff",
          borderRadius: 14,
          opacity: view === "selectMarket" ? 1 : 0,
          pointerEvents: view === "selectMarket" ? "auto" : "none",
          transform:
            view === "selectMarket" ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflowY: "auto",
          scrollbarWidth: "none" as const,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <button
            onClick={() => setView("idle")}
            className="flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              backgroundColor: "rgba(0,0,0,0.04)",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            <ChevronLeft size={13} strokeWidth={1.8} color="rgba(0,0,0,0.4)" />
          </button>
          <span className="text-[12px] font-semibold text-gray-700">
            Markt auswählen
          </span>
        </div>

        <div className="relative" style={{ marginBottom: 8 }}>
          <Search
            size={11}
            strokeWidth={1.8}
            className="absolute"
            style={{ left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.25)" }}
          />
          <input
            type="text"
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Suchen..."
            className="w-full text-[10px] text-gray-600 placeholder-gray-300 outline-none"
            style={{
              padding: "5px 10px 5px 24px",
              backgroundColor: "transparent",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderRadius: 0,
            }}
          />
        </div>

        <div>
          {filteredMarkets.map((m, i) => {
            const cc = chainColor(m.chain);
            return (
              <div
                key={i}
                onClick={() => handleMarketSelect(m)}
                className="flex items-center gap-2"
                style={{
                  padding: "9px 6px",
                  borderRadius: 7,
                  cursor: "pointer",
                  borderBottom:
                    i < filteredMarkets.length - 1
                      ? "1px solid rgba(0,0,0,0.04)"
                      : "none",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span
                  className="shrink-0 text-[9px] font-semibold uppercase"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 5,
                    backgroundColor: cc.bg,
                    color: cc.text,
                    letterSpacing: "0.02em",
                  }}
                >
                  {m.chain}
                </span>
                <span className="text-[10px] font-medium text-gray-600 truncate">
                  {m.address}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Clock Picker (card-level overlay) ── */}
      {clockHandler && (
        <ClockPicker
          onSelect={(h, m) => {
            clockHandler(h, m);
            setClockHandler(null);
          }}
          onCancel={() => setClockHandler(null)}
        />
      )}

      {/* ── Confirmed flash ── */}
      {confirmed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            animation: "confirmIn 0.3s ease",
          }}
        >
          <style>{`
            @keyframes confirmIn {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "rgba(34,197,94,0.12)",
            }}
          >
            <Check size={18} strokeWidth={2.5} color="#16a34a" />
          </div>
          <span
            className="text-[11px] font-medium"
            style={{ marginTop: 8, color: "#16a34a" }}
          >
            Markt gestartet
          </span>
        </div>
      )}
    </div>
  );
}
