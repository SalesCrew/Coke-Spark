"use client";

import { Check, ChevronLeft, ChevronRight, Mail, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSmInbox, markSmMessageRead, getAuthPrincipalKey, readAuthSession } from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import type { SmInboxMessage } from "@/types/smMessages";

function messageTime(value: string): string {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(value));
}

export function SmMessagesPanel() {
  const [messages, setMessages] = useState<SmInboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState(false), [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mutationGeneration = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setLoadingMore(false); setError(null);
    try {
      const page = await fetchSmInbox();
      if (request !== generation.current) return;
      setMessages(page.messages); setNextCursor(page.nextCursor);
      setSelectedId(current => page.messages.some(message => message.id === current)
        ? current : page.messages.find(message => !message.readAt)?.id ?? page.messages[0]?.id ?? null);
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : "Nachrichten konnten nicht geladen werden.");
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const requests = generation, mutations = mutationGeneration;
    let principal = getAuthPrincipalKey(readAuthSession());
    const unsubscribe = subscribeToAuthSessionChanges(() => {
      const next = getAuthPrincipalKey(readAuthSession());
      if (next === principal) return;
      principal = next; ++requests.current; ++mutations.current; setMessages([]); setSelectedId(null); setNextCursor(null);
      setMarking(false); void load();
    });
    const visible = () => { if (!document.hidden) void load(); };
    window.addEventListener("focus", visible); window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(visible, 120_000);
    void load();
    return () => {
      ++requests.current; ++mutations.current; unsubscribe(); window.clearInterval(interval);
      window.removeEventListener("focus", visible); window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const selectedIndex = messages.findIndex(message => message.id === selectedId);
  const selected = messages[selectedIndex] ?? null;
  useEffect(() => {
    const expiry = messages.map(message => message.visibleUntil ? Date.parse(message.visibleUntil) : NaN)
      .filter(value => Number.isFinite(value) && value > Date.now()).sort((a, b) => a - b)[0];
    if (!expiry) return;
    const timer = window.setTimeout(() => void load(), Math.min(2_147_483_647, Math.max(1, expiry - Date.now() + 50)));
    return () => window.clearTimeout(timer);
  }, [messages, load]);
  const more = async () => {
    if (!nextCursor || loading || loadingMore || marking) return;
    const request = generation.current; setLoadingMore(true); setError(null);
    try {
      const page = await fetchSmInbox(nextCursor);
      if (request !== generation.current) return;
      setMessages(current => [...current, ...page.messages.filter(message => !current.some(entry => entry.id === message.id))]);
      setNextCursor(page.nextCursor);
      if (page.messages[0]) setSelectedId(page.messages[0].id);
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : "Weitere Nachrichten konnten nicht geladen werden.");
    } finally { if (request === generation.current) setLoadingMore(false); }
  };
  const markRead = async () => {
    if (!selected || selected.readAt || marking || loading || loadingMore) return;
    const request = ++mutationGeneration.current, message = selected;
    setMarking(true); setError(null);
    try {
      const result = await markSmMessageRead(message.id);
      if (request !== mutationGeneration.current) return;
      setMessages(current => current.map(entry => entry.id === message.id ? { ...entry, readAt: result.readAt } : entry)
        .filter(entry => entry.id !== message.id || entry.visibleAfterReadDays !== 0));
      setSelectedId(null);
      await load();
    } catch (reason) {
      if (request === mutationGeneration.current) setError(reason instanceof Error ? reason.message : "Lesestatus konnte nicht gespeichert werden.");
    } finally {
      if (request === mutationGeneration.current) setMarking(false);
    }
  };
  return <section aria-label="SM Nachrichten" className="flex h-full min-h-0 min-w-0 select-text flex-col">
    {error ? <div className="mt-2 rounded-lg bg-red-50 p-2.5"><p role="alert" className="text-[12px] leading-5 text-red-700">{error}</p><button type="button" disabled={marking} onClick={() => void load()} className="mt-2 flex items-center gap-1 min-h-10 text-[12px] font-semibold text-red-700"><RotateCcw size={11} />Erneut laden</button></div> : null}
    {loading && !messages.length ? <div className="space-y-3 py-5" aria-label="Nachrichten werden geladen">{[0, 1, 2].map(key => <div key={key} className="h-2 rounded bg-gray-100 motion-safe:animate-pulse" />)}</div>
      : !messages.length ? !error ? <div className="grid flex-1 place-content-center gap-2 text-center text-gray-400"><Mail size={20} className="mx-auto" /><p className="text-[12px]">Noch keine Nachrichten</p></div> : null
        : selected ? <>
          <div className="flex items-center justify-between gap-2 py-2.5">
            <span className="text-[11px] text-gray-600">{selectedIndex + 1} / {messages.length}{nextCursor ? "+" : ""} · {selected.readAt ? "Gelesen" : "Ungelesen"}</span>
            <div className="flex gap-1">
              <button type="button" aria-label="Vorherige Nachricht" disabled={selectedIndex === 0 || marking || loading}
                onClick={() => setSelectedId(messages[selectedIndex - 1]!.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-black/[.06] text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-25"><ChevronLeft size={13} /></button>
              <button type="button" aria-label="Nächste Nachricht" disabled={selectedIndex >= messages.length - 1 || marking || loading}
                onClick={() => setSelectedId(messages[selectedIndex + 1]!.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-black/[.06] text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-25"><ChevronRight size={13} /></button>
            </div>
          </div>
          <article className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain py-1 pr-1">
            <h3 className="break-words text-[14px] font-semibold leading-5 text-gray-900">{selected.subject}</h3>
            <p className="mt-1 text-[10px] leading-5 text-gray-600">Von {selected.sender} · {messageTime(selected.sentAt)}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-5 text-gray-700">{selected.body}</p>
          </article>
          <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-black/[.05] pt-3">
            {nextCursor ? <button type="button" disabled={loading || loadingMore || marking} onClick={() => void more()} className="text-[10px] font-medium text-gray-500 disabled:opacity-40">{loadingMore ? "Lädt…" : "Weitere Nachrichten"}</button> : <span />}
            <button type="button" disabled={Boolean(selected.readAt) || marking || loading || loadingMore} onClick={() => void markRead()}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-[#DC2626] to-[#b91c1c] px-3 text-[11px] font-semibold text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),0_0_0_1px_#a91b1b,0_1px_5px_rgba(180,20,20,.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40">
              <Check size={11} />{marking ? "Speichert…" : "Gelesen"}
            </button>
          </div>
        </> : null}
  </section>;
}
