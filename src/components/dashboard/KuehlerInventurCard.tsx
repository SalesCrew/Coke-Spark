"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, CheckCircle2, Circle } from "lucide-react";

interface KuehlerMarket {
  chain: string;
  address: string;
  done: boolean;
  doneDate?: string;
}

const defaultKuehlerMarkets: KuehlerMarket[] = [
  { chain: "BILLA+", address: "Hauptstraße 12, 1010 Wien", done: true, doneDate: "12.01.2026" },
  { chain: "SPAR", address: "Mariahilfer Str. 88, 1060 Wien", done: true, doneDate: "15.01.2026" },
  { chain: "ADEG", address: "Landstraße 45, 1030 Wien", done: true, doneDate: "18.01.2026" },
  { chain: "BILLA+", address: "Favoritenstr. 22, 1100 Wien", done: true, doneDate: "22.01.2026" },
  { chain: "HOFER", address: "Gudrunstraße 18, 1100 Wien", done: true, doneDate: "25.01.2026" },
  { chain: "PENNY", address: "Simmeringer Hptstr. 5, 1110 Wien", done: true, doneDate: "28.01.2026" },
  { chain: "SPAR", address: "Laxenburger Str. 67, 1100 Wien", done: true, doneDate: "02.02.2026" },
  { chain: "ADEG", address: "Brünner Str. 130, 1210 Wien", done: true, doneDate: "05.02.2026" },
  { chain: "BILLA+", address: "Thaliastraße 90, 1160 Wien", done: true, doneDate: "08.02.2026" },
  { chain: "SPAR", address: "Hütteldorfer Str. 130, 1140 Wien", done: true, doneDate: "10.02.2026" },
  { chain: "PENNY", address: "Ottakringer Str. 44, 1170 Wien", done: false },
  { chain: "ADEG", address: "Hernalser Hauptstr. 77, 1170 Wien", done: false },
  { chain: "BILLA+", address: "Wiedner Hauptstr. 56, 1040 Wien", done: false },
  { chain: "HOFER", address: "Johnstraße 42, 1150 Wien", done: false },
  { chain: "SPAR", address: "Döblinger Hauptstr. 2, 1190 Wien", done: false },
  { chain: "BILLA+", address: "Prater Str. 31, 1020 Wien", done: false },
  { chain: "ADEG", address: "Grinzinger Allee 5, 1190 Wien", done: false },
  { chain: "SPAR", address: "Kärntner Str. 22, 1010 Wien", done: false },
  { chain: "HOFER", address: "Triester Str. 64, 1100 Wien", done: false },
  { chain: "PENNY", address: "Heiligenstädter Str. 80, 1190 Wien", done: false },
];

function chainColor(chain: string): { bg: string; text: string } {
  const key = chain.toUpperCase();
  if (key.includes("BILLA")) return { bg: "rgba(234,179,8,0.10)", text: "#a16207" };
  if (key.includes("SPAR")) return { bg: "rgba(220,38,38,0.06)", text: "#DC2626" };
  if (key.includes("ADEG")) return { bg: "rgba(34,197,94,0.08)", text: "#15803d" };
  if (key.includes("PENNY")) return { bg: "rgba(194,65,12,0.08)", text: "#c2410c" };
  if (key.includes("HOFER")) return { bg: "rgba(59,130,246,0.08)", text: "#2563eb" };
  return { bg: "rgba(0,0,0,0.04)", text: "#6b7280" };
}

interface KuehlerInventurCardProps {
  current?: number;
  total?: number;
  startDate?: string;
  endDate?: string;
  markets?: KuehlerMarket[];
}

export function KuehlerInventurCard({
  current = 62,
  total = 120,
  startDate = "01.01.2026",
  endDate = "31.03.2026",
  markets = defaultKuehlerMarkets,
}: KuehlerInventurCardProps) {
  const percent = Math.round((current / total) * 100);
  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState("");

  const doneCount = markets.filter((m) => m.done).length;
  const openCount = markets.length - doneCount;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [collapsedH, setCollapsedH] = useState<number | undefined>(undefined);
  const [expandedH, setExpandedH] = useState(0);

  useEffect(() => {
    if (!wrapperRef.current) return;
    if (!showDetail && !collapsedH) {
      setCollapsedH(wrapperRef.current.offsetHeight);
    }
    if (showDetail) {
      const top = wrapperRef.current.getBoundingClientRect().top;
      const menuSpace = 80;
      setExpandedH(window.innerHeight - top - menuSpace);
    }
  }, [showDetail, collapsedH]);

  const filtered = useMemo(() => {
    let list = markets;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.chain.toLowerCase().includes(q) || m.address.toLowerCase().includes(q)
      );
    }
    const pending = list.filter((m) => !m.done);
    const done = list.filter((m) => m.done);
    return { pending, done };
  }, [search, markets]);

  return (
    <div style={{ position: "relative", height: collapsedH || "auto" }}>
      <div
        ref={wrapperRef}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 14,
          boxShadow: showDetail ? "0 8px 30px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
          padding: "20px",
          position: showDetail ? "absolute" : "relative",
          top: 0,
          left: 0,
          right: 0,
          zIndex: showDetail ? 20 : "auto",
          height: showDetail && expandedH ? expandedH : undefined,
          transition: "height 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
      {/* Summary View */}
      <div
        style={{
          opacity: showDetail ? 0 : 1,
          pointerEvents: showDetail ? "none" : "auto",
          transition: "opacity 0.2s ease",
          position: showDetail ? "absolute" : "relative",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.03)",
            borderRadius: 7,
            padding: "10px 12px",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700">
              Aktuelle Kühlerinventur
            </span>
            <span className="text-[10px] tabular-nums text-gray-400">
              {startDate} – {endDate}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex-1 overflow-hidden"
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: "#DC2626",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-gray-600 shrink-0">
              {current}/{total}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] tabular-nums text-gray-400">
            {percent}% abgeschlossen
          </span>
          <button
            onClick={() => setShowDetail(true)}
            style={{
              padding: 0,
              fontSize: 10,
              fontWeight: 600,
              color: "#DC2626",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
              letterSpacing: "0.01em",
            }}
          >
            Märkte anzeigen
          </button>
        </div>
      </div>

      {/* Detail View */}
      <div
        style={{
          opacity: showDetail ? 1 : 0,
          pointerEvents: showDetail ? "auto" : "none",
          transition: "opacity 0.25s ease 0.1s",
          display: showDetail ? "flex" : "none",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Summary bar (same as collapsed state) */}
        <div
          className="shrink-0"
          style={{
            backgroundColor: "rgba(0,0,0,0.03)",
            borderRadius: 7,
            padding: "10px 12px",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700">
              Aktuelle Kühlerinventur
            </span>
            <button
              onClick={() => { setShowDetail(false); setSearch(""); }}
              className="flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                backgroundColor: "rgba(0,0,0,0.04)",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              <X size={11} strokeWidth={2} color="rgba(0,0,0,0.35)" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex-1 overflow-hidden"
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: "#DC2626",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-gray-600 shrink-0">
              {current}/{total}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3 shrink-0">
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
            placeholder="Markt suchen..."
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

        {/* Market List */}
        <div
          className="mt-2"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {/* Pending Markets */}
          {filtered.pending.length > 0 && (
            <div>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.06em] block"
                style={{ color: "#DC2626", padding: "8px 0 4px" }}
              >
                Offen ({filtered.pending.length})
              </span>
              {filtered.pending.map((m, i) => {
                const cc = chainColor(m.chain);
                return (
                  <div
                    key={`p-${i}`}
                    className="flex items-center justify-between"
                    style={{
                      padding: "7px 4px",
                      borderBottom:
                        i < filtered.pending.length - 1
                          ? "1px solid rgba(0,0,0,0.04)"
                          : "none",
                      transition: "background-color 0.12s ease",
                      borderRadius: 5,
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle size={10} strokeWidth={2} color="rgba(220,38,38,0.4)" className="shrink-0" />
                      <span
                        className="shrink-0 text-[8px] font-semibold uppercase"
                        style={{
                          padding: "1px 6px",
                          borderRadius: 4,
                          backgroundColor: cc.bg,
                          color: cc.text,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {m.chain}
                      </span>
                      <span className="text-[9px] font-medium text-gray-500 truncate">
                        {m.address}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator */}
          {filtered.pending.length > 0 && filtered.done.length > 0 && (
            <div
              className="my-2"
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)",
              }}
            />
          )}

          {/* Done Markets */}
          {filtered.done.length > 0 && (
            <div>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.06em] block"
                style={{ color: "#059669", padding: "8px 0 4px" }}
              >
                Erledigt ({filtered.done.length})
              </span>
              {filtered.done.map((m, i) => {
                const cc = chainColor(m.chain);
                return (
                  <div
                    key={`d-${i}`}
                    className="flex items-center justify-between"
                    style={{
                      padding: "7px 4px",
                      borderBottom:
                        i < filtered.done.length - 1
                          ? "1px solid rgba(0,0,0,0.04)"
                          : "none",
                      transition: "background-color 0.12s ease",
                      borderRadius: 5,
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 size={10} strokeWidth={2} color="#059669" className="shrink-0" />
                      <span
                        className="shrink-0 text-[8px] font-semibold uppercase"
                        style={{
                          padding: "1px 6px",
                          borderRadius: 4,
                          backgroundColor: cc.bg,
                          color: cc.text,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {m.chain}
                      </span>
                      <span className="text-[9px] font-medium text-gray-500 truncate">
                        {m.address}
                      </span>
                    </div>
                    <span className="text-[8px] tabular-nums text-gray-400 shrink-0 ml-2">
                      {m.doneDate}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.pending.length === 0 && filtered.done.length === 0 && (
            <div className="text-center py-6">
              <span className="text-[10px] text-gray-400">Keine Märkte gefunden</span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

