"use client";

import { Check, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSmMessages, markSmMessageRead } from "@/lib/api/backend";
import type { SmInboxMessage } from "@/types/smMessages";

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NachrichtenCard() {
  const [messages, setMessages] = useState<SmInboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchSmMessages();
      setMessages(rows);
      setSelectedId((current) => rows.some((message) => message.id === current)
        ? current
        : rows.find((message) => !message.readAt)?.id ?? rows[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nachrichten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => messages.find((message) => message.id === selectedId) ?? messages[0] ?? null,
    [messages, selectedId],
  );
  const unreadCount = messages.reduce((sum, message) => sum + (message.readAt ? 0 : 1), 0);
  const selectedIndex = selected ? messages.findIndex((message) => message.id === selected.id) : -1;
  const allRead = messages.length > 0 && unreadCount === 0;

  const selectRelative = (direction: -1 | 1) => {
    if (!allRead || selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= messages.length) return;
    setSelectedId(messages[nextIndex]!.id);
  };

  const markRead = async (message: SmInboxMessage) => {
    if (message.readAt || markingId) return;
    setMarkingId(message.id);
    try {
      const result = await markSmMessageRead(message.id);
      const updatedMessages = messages.map((entry) => entry.id === message.id ? { ...entry, readAt: result.readAt } : entry);
      const currentIndex = updatedMessages.findIndex((entry) => entry.id === message.id);
      const visibleMessages = message.visibleAfterReadDays === 0
        ? updatedMessages.filter((entry) => entry.id !== message.id)
        : updatedMessages;
      const nextUnread = [
        ...updatedMessages.slice(currentIndex + 1),
        ...updatedMessages.slice(0, currentIndex),
      ].find((entry) => !entry.readAt && visibleMessages.some((visible) => visible.id === entry.id));
      setMessages(visibleMessages);
      setSelectedId(nextUnread?.id ?? visibleMessages[0]?.id ?? null);
      setError(null);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Lesestatus konnte nicht gespeichert werden.");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <section style={{ backgroundColor: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,.04)", overflow: "hidden" }}>
      <header className="relative flex items-center justify-between" style={{ padding: "10px 14px 9px", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ background: "rgba(220,38,38,.07)", color: "#DC2626" }}><Mail size={12} strokeWidth={1.9} /></span>
          <div>
            <h2 className="text-[11px] font-semibold leading-tight text-gray-800">Nachrichten</h2>
            <p className="mt-0.5 text-[8px] leading-none text-gray-400">{unreadCount > 0 ? `${unreadCount} ungelesen` : "Alles gelesen"}</p>
          </div>
        </div>

        {messages.length > 1 ? <div className="absolute left-1/2 flex max-w-[112px] -translate-x-1/2 items-center justify-center gap-1" aria-label={`${selectedIndex + 1} von ${messages.length} Nachrichten`}>
          {messages.map((message, index) => <span key={message.id} className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors" style={{ background: index === selectedIndex ? "#DC2626" : message.readAt ? "rgba(0,0,0,.12)" : "rgba(220,38,38,.28)" }} />)}
        </div> : null}

        {allRead && messages.length > 1 ? <div className="flex items-center gap-1">
          <button type="button" onClick={() => selectRelative(-1)} disabled={selectedIndex <= 0} aria-label="Vorherige Nachricht" className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-gray-400 shadow-[0_1px_4px_rgba(15,23,42,.055)] transition-all hover:bg-black/[0.02] hover:text-gray-600 disabled:bg-black/[0.015] disabled:text-black/15 disabled:shadow-none"><ChevronLeft size={11} strokeWidth={2.2} /></button>
          <button type="button" onClick={() => selectRelative(1)} disabled={selectedIndex >= messages.length - 1} aria-label="Nächste Nachricht" className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-gray-400 shadow-[0_1px_4px_rgba(15,23,42,.055)] transition-all hover:bg-black/[0.02] hover:text-gray-600 disabled:bg-black/[0.015] disabled:text-black/15 disabled:shadow-none"><ChevronRight size={11} strokeWidth={2.2} /></button>
        </div> : <span className="w-1" />}
      </header>

      {error ? <p role="alert" className="mx-3 mt-2 rounded-[7px] bg-red-50 px-2.5 py-1.5 text-[8px] font-medium text-red-700">{error}</p> : null}

      {loading && messages.length === 0 ? (
        <div className="px-4 py-6 text-center text-[9px] text-gray-400">Nachrichten werden geladen…</div>
      ) : messages.length === 0 ? (
        <div className="px-5 py-6 text-center"><Mail size={16} strokeWidth={1.5} className="mx-auto text-gray-300" /><p className="mt-1.5 text-[9px] font-medium text-gray-500">Noch keine Nachrichten</p></div>
      ) : selected ? (
        <article style={{ padding: "10px 15px 11px" }}>
          <h3 className="text-[11px] font-semibold leading-snug text-gray-800">{selected.subject}</h3>
          <p className="mt-1 text-[8px] text-gray-400">Von {selected.sender} · {formatDateTime(selected.sentAt)}</p>
          <p className="mt-2 whitespace-pre-wrap text-[9.5px] leading-[1.45] text-gray-600">{selected.body}</p>
          <div className="mt-2.5 flex justify-end">
            <button type="button" disabled={Boolean(selected.readAt) || markingId !== null} onClick={() => void markRead(selected)} className={`flex h-7 min-w-[72px] items-center justify-center gap-1 rounded-[8px] bg-gradient-to-b px-2.5 text-[8.5px] font-bold text-white transition-[filter,transform,opacity] ${selected.readAt ? "from-emerald-500 to-emerald-600 opacity-55 shadow-[inset_0_1px_.6px_rgba(255,255,255,.28),0_0_0_1px_#048560,0_1px_5px_rgba(5,80,50,.12)]" : "from-[#DC2626] to-[#b91c1c] shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),inset_0_-1px_0_rgba(255,255,255,.15),0_0_0_1px_#a91b1b,0_1px_5px_rgba(180,20,20,.16)] hover:brightness-[1.03] active:translate-y-px disabled:opacity-45"}`}>
              <Check size={9} strokeWidth={2.4} /> {markingId === selected.id ? "Speichert…" : "Gelesen"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
