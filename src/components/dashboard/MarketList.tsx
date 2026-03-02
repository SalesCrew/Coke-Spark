"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, UserCheck } from "lucide-react";

interface Market {
  chain: string;
  address: string;
  visited: number;
  frequency: number;
  nextSM?: string;
}

interface MarketListProps {
  visited?: number;
  total?: number;
  markets?: Market[];
}

const defaultMarkets: Market[] = [
  { chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien", visited: 2, frequency: 12, nextSM: "04.03.2026" },
  { chain: "ADEG", address: "Landstraße 45, 1030 Wien", visited: 1, frequency: 6 },
  { chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien", visited: 3, frequency: 12, nextSM: "06.03.2026" },
  { chain: "BILLA+", address: "Favoritenstr. 22, 1100 Wien", visited: 0, frequency: 4 },
  { chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien", visited: 2, frequency: 6, nextSM: "10.03.2026" },
  { chain: "ADEG", address: "Brünner Str. 130, 1210 Wien", visited: 4, frequency: 12 },
  { chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien", visited: 1, frequency: 4, nextSM: "12.03.2026" },
  { chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien", visited: 3, frequency: 12 },
  { chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien", visited: 2, frequency: 6, nextSM: "05.03.2026" },
  { chain: "PENNY", address: "Ottakringer Str. 44, 1170 Wien", visited: 1, frequency: 6 },
  { chain: "SPAR", address: "Hütteldorfer Str. 130, 1140 Wien", visited: 5, frequency: 12, nextSM: "08.03.2026" },
  { chain: "ADEG", address: "Hernalser Hauptstr. 77, 1170 Wien", visited: 0, frequency: 4 },
  { chain: "BILLA+", address: "Wiedner Hauptstr. 56, 1040 Wien", visited: 2, frequency: 12 },
  { chain: "HOFER", address: "Johnstraße 42, 1150 Wien", visited: 3, frequency: 6, nextSM: "11.03.2026" },
  { chain: "SPAR", address: "Döblinger Hauptstr. 2, 1190 Wien", visited: 1, frequency: 4 },
];

function chainColors(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function daysUntilEndOfMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

export function MarketList({
  visited = 40,
  total = 70,
  markets = defaultMarkets,
}: MarketListProps) {
  const [search, setSearch] = useState("");
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [listMaxH, setListMaxH] = useState<number | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const daysLeft = daysUntilEndOfMonth();

  const clearReveal = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRevealedIdx(null);
    setCountdown(0);
  }, []);

  const handleReveal = useCallback((idx: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRevealedIdx(idx);
    setCountdown(5);
    let c = 5;
    intervalRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRevealedIdx(null);
        setCountdown(0);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    function calc() {
      if (!listRef.current) return;
      const top = listRef.current.getBoundingClientRect().top;
      const menuSpace = 80;
      setListMaxH(window.innerHeight - top - menuSpace);
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return markets;
    const q = search.toLowerCase();
    return markets.filter(
      (m) =>
        m.chain.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q)
    );
  }, [search, markets]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span
          className="text-[11px] font-semibold"
          style={{ color: "#DC2626" }}
        >
          RED Monat endet in {daysLeft} Tagen
        </span>
        <span className="text-[11px] font-medium text-gray-500">
          Märkte besucht{" "}
          <span className="font-semibold text-gray-700">
            {visited}/{total}
          </span>
        </span>
      </div>

      {/* Search */}
      <div className="mt-2.5 relative">
        <Search
          size={11}
          strokeWidth={1.8}
          className="absolute"
          style={{ left: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(0,0,0,0.25)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* Market rows */}
      <div
        ref={listRef}
        className="mt-3"
        style={{
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          maxHeight: listMaxH ? `${listMaxH}px` : undefined,
        }}
      >
        {filtered.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between"
            style={{
              padding: "8px 10px",
              borderRadius: 7,
              borderBottom:
                i < filtered.length - 1
                  ? "1px solid rgba(0,0,0,0.04)"
                  : "none",
              transition: "background-color 0.12s ease",
              cursor: "default",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 text-[9px] font-semibold uppercase"
                style={{
                  padding: "2px 8px",
                  borderRadius: 5,
                  backgroundColor: chainColors(m.chain).bg,
                  color: chainColors(m.chain).text,
                  letterSpacing: "0.02em",
                }}
              >
                {m.chain}
              </span>

              {revealedIdx === i && m.nextSM ? (
                <span
                  className="text-[10px] font-medium truncate"
                  style={{ color: "#DC2626" }}
                >
                  Nächster SM: {m.nextSM}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-gray-600 truncate">
                  {m.address}
                </span>
              )}
            </div>

            <div className="shrink-0 ml-3 flex items-center gap-2">
              {m.nextSM && (
                <button
                  onClick={() => handleReveal(i)}
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: revealedIdx === i
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(220,38,38,0.08)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (revealedIdx !== i) e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    if (revealedIdx !== i) e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.08)";
                  }}
                >
                  {revealedIdx === i ? (
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#16a34a" }}>{countdown}</span>
                  ) : (
                    <UserCheck size={9} strokeWidth={2} color="#DC2626" />
                  )}
                </button>
              )}
            <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <svg viewBox="0 0 36 36" width={32} height={32} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
                <circle
                  cx={18} cy={18} r={15}
                  fill="none"
                  stroke="rgba(0,0,0,0.05)"
                  strokeWidth={2.5}
                />
                <circle
                  cx={18} cy={18} r={15}
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={`${(m.visited / m.frequency) * 94.25} 94.25`}
                />
              </svg>
              <span className="text-[8px] font-semibold text-gray-700 tabular-nums" style={{ position: "relative", zIndex: 1 }}>
                {m.visited}/{m.frequency}
              </span>
            </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-4">
            <span className="text-[10px] text-gray-400">
              Keine Märkte gefunden
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
