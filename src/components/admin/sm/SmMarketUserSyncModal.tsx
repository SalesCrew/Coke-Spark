"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, RefreshCw, Search, UserRound, X } from "lucide-react";
import { fetchSmUsers, manuallyMatchSmMarketUsers, syncSmMarketUsers } from "@/lib/api/backend";
import type { SmMarketRecord, SmMarketUserSyncResult, SmMarketUserSyncUnmatched } from "@/types/smMarkets";
import type { SMRecord } from "@/types/shelfmerchandiser";

const RED = "#DC2626";

function formatSmName(user: SMRecord): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("de-AT").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function SmUserSelect({ value, users, suggestionIds, onChange }: {
  value: string | null;
  users: SMRecord[];
  suggestionIds: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = users.find((user) => user.id === value);
  const suggestionOrder = useMemo(() => new Map(suggestionIds.map((id, index) => [id, index])), [suggestionIds]);
  const options = useMemo(() => {
    const normalizedQuery = normalize(query);
    return [...users]
      .filter((user) => !normalizedQuery || normalize(`${formatSmName(user)} ${user.email}`).includes(normalizedQuery))
      .sort((left, right) => {
        const leftSuggestion = suggestionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightSuggestion = suggestionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftSuggestion - rightSuggestion || formatSmName(left).localeCompare(formatSmName(right), "de-AT", { sensitivity: "base" });
      });
  }, [query, suggestionOrder, users]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(250, rect.width);
      setPosition({ top: rect.bottom + 5, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    update();
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return <>
    <button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} style={{ width: "100%", height: 32, padding: "0 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: `1px solid ${value ? "rgba(220,38,38,.22)" : "rgba(15,23,42,.1)"}`, borderRadius: 8, background: "#fff", color: selected ? "#17191d" : "rgba(15,23,42,.38)", fontFamily: "inherit", fontSize: 10, fontWeight: selected ? 700 : 550, cursor: "pointer" }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? formatSmName(selected) : "SM auswählen…"}</span><ChevronDown size={11} />
    </button>
    {open && position ? createPortal(<div ref={menuRef} role="listbox" style={{ position: "fixed", zIndex: 10020, top: position.top, left: position.left, width: position.width, padding: 6, border: "1px solid rgba(15,23,42,.1)", borderRadius: 10, background: "#fff", boxShadow: "0 12px 34px rgba(15,23,42,.18)" }}>
      <div style={{ height: 29, padding: "0 8px", display: "flex", alignItems: "center", gap: 6, borderRadius: 7, background: "rgba(15,23,42,.035)" }}><Search size={11} color="rgba(15,23,42,.32)"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SM suchen…" style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 10 }} /></div>
      <div style={{ maxHeight: 220, marginTop: 5, overflowY: "auto" }}>{options.length ? options.map((user) => {
        const suggested = suggestionOrder.has(user.id);
        return <button key={user.id} type="button" role="option" aria-selected={user.id === value} onClick={() => { onChange(user.id); setOpen(false); setQuery(""); }} style={{ width: "100%", minHeight: 36, padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, border: 0, borderRadius: 7, background: user.id === value ? "rgba(220,38,38,.055)" : "transparent", color: "#17191d", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}><span style={{ width: 25, height: 25, flex: "0 0 25px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "rgba(220,38,38,.06)", color: RED }}><UserRound size={11}/></span><span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", overflow: "hidden", fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatSmName(user)}</strong><small style={{ display: "block", marginTop: 2, overflow: "hidden", color: "rgba(15,23,42,.38)", fontSize: 8.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</small></span>{suggested ? <small style={{ padding: "2px 5px", borderRadius: 5, background: "rgba(8,145,178,.07)", color: "#0e7490", fontSize: 7.5, fontWeight: 800 }}>Vorschlag</small> : null}</button>;
      }) : <div style={{ padding: 14, color: "rgba(15,23,42,.4)", fontSize: 9.5, textAlign: "center" }}>Kein SM gefunden.</div>}</div>
    </div>, document.body) : null}
  </>;
}

export function SmMarketUserSyncModal({ initialUsers, onMarketsChange, onUsersChange, onClose }: {
  initialUsers: SMRecord[];
  onMarketsChange: (markets: SmMarketRecord[]) => void;
  onUsersChange: (users: SMRecord[]) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SmMarketUserSyncResult | null>(null);
  const [users, setUsers] = useState(initialUsers);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningMarketId, setAssigningMarketId] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runSync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const syncResult = await syncSmMarketUsers();
      setResult(syncResult);
      onMarketsChange(syncResult.markets);
      try {
        const freshUsers = await fetchSmUsers({ force: true });
        setUsers(freshUsers);
        onUsersChange(freshUsers);
      } catch {
        // The sync result is still authoritative; retain the already loaded directory for manual review.
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "SM-Synchronisierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [onMarketsChange, onUsersChange]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runSync();
  }, [runSync]);

  const assign = useCallback(async (row: SmMarketUserSyncUnmatched) => {
    const smUserId = selections[row.marketId];
    if (!smUserId || assigningMarketId) return;
    setAssigningMarketId(row.marketId);
    setError(null);
    try {
      const manual = await manuallyMatchSmMarketUsers({ marketIds: [row.marketId], smUserId });
      onMarketsChange(manual.markets);
      setResult((current) => current ? {
        ...current,
        markets: manual.markets,
        matched: [...current.matched, ...manual.matched],
        unmatched: current.unmatched.filter((entry) => entry.marketId !== row.marketId),
        summary: {
          ...current.summary,
          matched: current.summary.matched + manual.matched.length,
          unmatched: Math.max(0, current.summary.unmatched - 1),
          skippedAlreadyMatched: current.summary.skippedAlreadyMatched + manual.skippedAlreadyMatched,
        },
      } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manuelle SM-Zuordnung fehlgeschlagen.");
    } finally {
      setAssigningMarketId(null);
    }
  }, [assigningMarketId, onMarketsChange, selections]);

  const sortedUsersFor = useCallback((row: SmMarketUserSyncUnmatched) => {
    const ranks = new Map(row.suggestions.map((suggestion, index) => [suggestion.smUserId, index]));
    return [...users].sort((left, right) => (ranks.get(left.id) ?? 9999) - (ranks.get(right.id) ?? 9999) || formatSmName(left).localeCompare(formatSmName(right), "de-AT", { sensitivity: "base" }));
  }, [users]);

  const busy = loading || Boolean(assigningMarketId);
  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 10000, padding: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.25)", backdropFilter: "blur(5px)" }}>
    <div role="dialog" aria-modal="true" aria-labelledby="sm-sync-title" style={{ width: 720, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 48px)", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(15,23,42,.08)", borderRadius: 16, background: "#fff", boxShadow: "0 24px 70px rgba(15,23,42,.22)" }}>
      <header style={{ padding: "16px 18px 14px", display: "flex", alignItems: "flex-start", gap: 11, borderBottom: "1px solid rgba(15,23,42,.06)" }}><span style={{ width: 34, height: 34, flex: "0 0 34px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: "rgba(220,38,38,.065)", color: RED }}><RefreshCw size={15}/></span><div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "rgba(15,23,42,.34)", fontSize: 8, fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" }}>SM Marktstamm</div><h2 id="sm-sync-title" style={{ margin: "3px 0 0", color: "#111827", fontSize: 17, fontWeight: 850, letterSpacing: "-.03em" }}>Shelf Merchandiser synchronisieren</h2><div style={{ marginTop: 4, color: "rgba(15,23,42,.43)", fontSize: 10 }}>Importnamen werden mit aktiven SM-Accounts abgeglichen. Bestehende Zuordnungen bleiben unverändert.</div></div><button type="button" onClick={onClose} disabled={busy} aria-label="Fenster schließen" style={{ width: 28, height: 28, border: 0, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.035)", color: "rgba(15,23,42,.42)", cursor: busy ? "not-allowed" : "pointer" }}><X size={13}/></button></header>
      <div style={{ minHeight: 260, overflowY: "auto", padding: 18, background: "#f7f7f8" }}>
        {loading ? <div style={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(15,23,42,.42)" }}><span style={{ width: 28, height: 28, border: `2px solid rgba(220,38,38,.18)`, borderTopColor: RED, borderRadius: "50%", animation: "smSyncSpin .75s linear infinite" }}/><strong style={{ fontSize: 11 }}>SM-Namen werden abgeglichen…</strong></div> : null}
        {!loading && error && !result ? <div style={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}><AlertTriangle size={22} color={RED}/><strong style={{ color: "#17191d", fontSize: 12 }}>Synchronisierung fehlgeschlagen</strong><span style={{ maxWidth: 420, color: "rgba(15,23,42,.48)", fontSize: 10 }}>{error}</span><button type="button" onClick={() => void runSync()} style={{ height: 30, padding: "0 12px", border: 0, borderRadius: 8, background: RED, color: "#fff", fontFamily: "inherit", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Erneut versuchen</button></div> : null}
        {!loading && result ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>{[["Zugeordnet", result.summary.matched], ["Manuell offen", result.summary.unmatched], ["Bereits verknüpft", result.summary.skippedAlreadyMatched], ["Aktive SMs", result.summary.activeSmUsers]].map(([label, value]) => <div key={String(label)} style={{ padding: "10px 11px", border: "1px solid rgba(15,23,42,.065)", borderRadius: 9, background: "#fff" }}><span style={{ color: "rgba(15,23,42,.34)", fontSize: 7.5, fontWeight: 850, letterSpacing: ".07em", textTransform: "uppercase" }}>{label}</span><strong style={{ display: "block", marginTop: 3, color: "#17191d", fontSize: 17 }}>{value}</strong></div>)}</div>
          {result.matched.length ? <section style={{ overflow: "hidden", border: "1px solid rgba(22,163,74,.13)", borderRadius: 11, background: "rgba(22,163,74,.035)" }}><div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid rgba(22,163,74,.1)", color: "#166534" }}><Check size={12}/><strong style={{ fontSize: 10.5 }}>{result.matched.length} erfolgreich zugeordnet</strong></div><div style={{ maxHeight: 150, overflowY: "auto" }}>{result.matched.map((match) => <div key={match.marketId} style={{ padding: "7px 11px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 16px minmax(0,1fr)", gap: 7, alignItems: "center", borderBottom: "1px solid rgba(22,163,74,.07)", fontSize: 9.5 }}><div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", color: "#374151", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.importedName || "Kein Importname"}</strong><small style={{ display: "block", marginTop: 2, overflow: "hidden", color: "rgba(15,23,42,.36)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.marketName}</small></div><span style={{ color: "rgba(22,163,74,.45)", textAlign: "center" }}>→</span><strong style={{ overflow: "hidden", color: "#166534", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.smName}</strong></div>)}</div></section> : null}
          <section><div style={{ marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}><strong style={{ color: "#17191d", fontSize: 10.5 }}>Manuell prüfen</strong><span style={{ color: "rgba(15,23,42,.38)", fontSize: 9 }}>{result.unmatched.length} offen</span></div>{result.unmatched.length ? <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{result.unmatched.map((row) => <div key={row.marketId} style={{ padding: 10, display: "grid", gridTemplateColumns: "minmax(160px,.9fr) minmax(210px,1fr) auto", gap: 10, alignItems: "center", border: "1px solid rgba(217,119,6,.13)", borderRadius: 9, background: "#fff" }}><div style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", color: "#92400e", fontSize: 10.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.importedName || "Kein Importname"}</strong><small title={`${row.marketName} · ${row.marketAddress}`} style={{ display: "block", marginTop: 3, overflow: "hidden", color: "rgba(15,23,42,.4)", fontSize: 8.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.marketName} · {row.marketAddress}</small></div><SmUserSelect value={selections[row.marketId] ?? null} users={sortedUsersFor(row)} suggestionIds={row.suggestions.map((suggestion) => suggestion.smUserId)} onChange={(smUserId) => setSelections((current) => ({ ...current, [row.marketId]: smUserId }))}/><button type="button" onClick={() => void assign(row)} disabled={!selections[row.marketId] || Boolean(assigningMarketId)} style={{ height: 30, padding: "0 11px", border: 0, borderRadius: 7, background: selections[row.marketId] && !assigningMarketId ? `linear-gradient(${RED},#b91c1c)` : "rgba(15,23,42,.12)", color: "#fff", fontFamily: "inherit", fontSize: 9, fontWeight: 800, cursor: selections[row.marketId] && !assigningMarketId ? "pointer" : "not-allowed" }}>{assigningMarketId === row.marketId ? "Speichert…" : "Zuordnen"}</button></div>)}</div> : <div style={{ padding: 18, border: "1px solid rgba(22,163,74,.12)", borderRadius: 9, background: "rgba(22,163,74,.035)", color: "#166534", fontSize: 10, fontWeight: 700, textAlign: "center" }}>Alle verfügbaren Märkte sind zugeordnet.</div>}</section>
          {error ? <div role="alert" style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(220,38,38,.13)", borderRadius: 8, background: "rgba(220,38,38,.045)", color: RED, fontSize: 9.5, fontWeight: 700 }}><AlertTriangle size={11}/>{error}</div> : null}
        </div> : null}
      </div>
      <footer style={{ padding: "11px 18px", display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(15,23,42,.06)", background: "#fff" }}><button type="button" onClick={onClose} disabled={busy} style={{ height: 32, padding: "0 16px", border: 0, borderRadius: 8, background: `linear-gradient(${RED},#b91c1c)`, color: "#fff", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}>Fertig</button></footer>
      <style>{`@keyframes smSyncSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>, document.body);
}
