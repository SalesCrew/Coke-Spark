"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search, UserCheck } from "lucide-react";
import { fetchGmAssignedActiveCampaignMarkets } from "@/lib/api/backend";
import { useRedMonth } from "@/context/RedMonthContext";
import type { MarketRecord } from "@/types/markets";

interface Market {
  id: string;
  chain: string;
  address: string;
  visited: number;
  frequency: number;
  visitedThisMonth: boolean;
  nextSM?: string;
}

interface MarketListProps {
  visited?: number;
  total?: number;
}

const CARD_MENU_SPACE = 80;
const MIN_CARD_HEIGHT = 260;

function chainColors(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

function deriveChainLabel(record: MarketRecord): string {
  const source = `${record.name} ${record.dbName}`.toUpperCase();
  if (source.includes("BILLA+")) return "BILLA+";
  if (source.includes("BILLA")) return "BILLA";
  if (source.includes("SPAR")) return "SPAR";
  if (source.includes("ADEG")) return "ADEG";
  if (source.includes("PENNY")) return "PENNY";
  if (source.includes("HOFER")) return "HOFER";
  if (source.includes("MERKUR")) return "MERKUR";
  return record.name.split(" ")[0]?.toUpperCase() || "MARKT";
}

function toMarketListEntry(record: MarketRecord): Market {
  return {
    id: record.id,
    chain: deriveChainLabel(record),
    address: `${record.address}, ${record.postalCode} ${record.city}`.trim(),
    // Keep visit circle/numbers rendered; backend visit stats follow later.
    visited: 0,
    frequency: Math.max(1, record.visitFrequencyPerYear || 1),
    visitedThisMonth: false,
  };
}

export function MarketList({
  visited = 0,
  total,
}: MarketListProps) {
  const { current } = useRedMonth();
  const [search, setSearch] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [cardMaxH, setCardMaxH] = useState<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const daysLeft = current?.daysUntilEnd ?? 0;
  const totalMarkets = total ?? markets.length;
  const isDataEmpty = !isLoading && !loadError && markets.length === 0;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    void fetchGmAssignedActiveCampaignMarkets()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map(toMarketListEntry);
        const deduped = Array.from(new Map(mapped.map((entry) => [entry.id, entry])).values());
        setMarkets(deduped);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Märkte konnten nicht geladen werden.";
        setLoadError(message);
        setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function calc() {
      if (!cardRef.current) return;
      const top = cardRef.current.getBoundingClientRect().top;
      const available = Math.floor(window.innerHeight - top - CARD_MENU_SPACE);
      if (!Number.isFinite(available)) return;
      setCardMaxH(Math.max(MIN_CARD_HEIGHT, available));
    }
    requestAnimationFrame(() => requestAnimationFrame(calc));
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleReveal = useCallback((id: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRevealedId(id);
    setCountdown(5);
    let c = 5;
    intervalRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRevealedId(null);
        setCountdown(0);
      }
    }, 1000);
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
    <div
      ref={cardRef}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "20px",
        maxHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        minHeight: cardMaxH ? `${cardMaxH}px` : undefined,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
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
            {visited}/{totalMarkets}
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
        className="mt-3"
        style={{
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          flex: 1,
          minHeight: 0,
        }}
      >
        {!isLoading && !loadError && filtered.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center"
            style={{
              gap: 8,
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
            <div
              className="flex items-center gap-2 min-w-0"
              style={{ maxWidth: "calc(100% - 52px)" }}
            >
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

              {revealedId === m.id && m.nextSM ? (
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

            <div className="shrink-0 flex items-center gap-2">
              {m.nextSM && (
                <button
                  onClick={() => handleReveal(m.id)}
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: revealedId === m.id
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(220,38,38,0.08)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (revealedId !== m.id) e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    if (revealedId !== m.id) e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.08)";
                  }}
                >
                  {revealedId === m.id ? (
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
                  stroke={m.visitedThisMonth ? "#16a34a" : "#DC2626"}
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

        {isLoading && (
          <div className="text-center py-8">
            <span className="text-[10px] text-gray-400">Märkte werden geladen...</span>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="text-center py-8">
            <span className="text-[10px] text-gray-400">Märkte konnten nicht geladen werden</span>
          </div>
        )}

        {!isLoading && !loadError && markets.length === 0 && (
          <div className="text-center py-10">
            <div className="text-[11px] font-medium text-gray-500">Noch keine zugewiesenen Märkte</div>
            <div className="mt-1 text-[10px] text-gray-400">
              Sobald aktive Kampagnen-Märkte für dich zugewiesen sind, erscheinen sie hier.
            </div>
          </div>
        )}

        {!isLoading && !loadError && markets.length > 0 && filtered.length === 0 && (
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
