"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, Database, SendHorizontal, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchAdminKurtiMessages,
  sendAdminKurtiMessage,
  type AdminKurtiMessage,
} from "@/lib/api/backend";

const KURTI_TALKING_VIDEO = "/kurti-talking.mp4";
const KURTI_THINKING_VIDEO = "/kurti-thinking.mp4";

type AdminKurtiPanelProps = {
  open: boolean;
  sidebarExpanded: boolean;
  onClose: () => void;
};

type TypingState = {
  messageId: string;
  content: string;
  visibleLength: number;
};

type KurtiMotion = "idle" | "thinking" | "talking";

const WELCOME_MESSAGE: AdminKurtiMessage = {
  id: "admin-kurti-welcome",
  role: "assistant",
  content: "Servus! Ich bin Kurti für die Admin-Seite. Was soll ich für dich über GMs, Märkte, Besuche oder Berechnungen herausfinden?",
  createdAt: "",
  expiresAt: "",
};

function AdminKurtiMarkdown({ content, isTyping }: { content: string; isTyping: boolean }) {
  return (
    <div className={`admin-kurti-markdown${isTyping ? " admin-kurti-markdown--typing" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="admin-kurti-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function AdminKurtiPanel({ open, sidebarExpanded, onClose }: AdminKurtiPanelProps) {
  const [messages, setMessages] = useState<AdminKurtiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<TypingState | null>(null);
  const [capabilityCount, setCapabilityCount] = useState(16);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminKurtiMessages()
      .then((payload) => {
        if (cancelled) return;
        setMessages(payload.messages ?? []);
        setConfigured(payload.configured);
        setExpiresAt(payload.expiresAt);
        setCapabilityCount(payload.capabilities?.toolCount ?? 16);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Admin-Kurti konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      const container = messageContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [messages, open, sending, typing?.visibleLength]);

  useEffect(() => {
    if (!open) return;
    const focusId = window.setTimeout(() => textareaRef.current?.focus(), 220);
    return () => window.clearTimeout(focusId);
  }, [open]);

  useEffect(() => {
    if (!expiresAt) return;
    const expiresAtMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtMs)) return;
    const clearMemory = () => {
      setMessages([]);
      setExpiresAt(null);
      setTyping(null);
    };
    const delayMs = expiresAtMs - Date.now();
    if (delayMs <= 0) {
      clearMemory();
      return;
    }
    const timeoutId = window.setTimeout(clearMemory, delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [expiresAt]);

  useEffect(() => {
    if (!typing) return;
    if (typing.visibleLength >= typing.content.length) {
      const finishId = window.setTimeout(() => {
        setTyping((current) => current?.messageId === typing.messageId ? null : current);
      }, 160);
      return () => window.clearTimeout(finishId);
    }
    const chunkSize = Math.max(1, Math.ceil(typing.content.length / 520));
    const stepCount = Math.ceil(typing.content.length / chunkSize);
    const durationMs = Math.min(7_500, Math.max(1_900, typing.content.length * 7));
    const baseDelay = Math.max(12, Math.round(durationMs / stepCount));
    const nextLength = Math.min(typing.content.length, typing.visibleLength + chunkSize);
    const typedChunk = typing.content.slice(typing.visibleLength, nextLength);
    const delay = /[.!?,;:]\s*$/.test(typedChunk) ? baseDelay + 24 : baseDelay;
    const timeoutId = window.setTimeout(() => {
      setTyping((current) => current?.messageId === typing.messageId
        ? { ...current, visibleLength: nextLength }
        : current);
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [typing]);

  const motion: KurtiMotion = sending ? "thinking" : typing ? "talking" : "idle";
  const videoSource = motion === "thinking" ? KURTI_THINKING_VIDEO : KURTI_TALKING_VIDEO;

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    const resetToFirstFrame = () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Re-applied once metadata is available.
      }
    };
    if (motion === "idle") {
      resetToFirstFrame();
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        video.addEventListener("loadedmetadata", resetToFirstFrame, { once: true });
        return () => video.removeEventListener("loadedmetadata", resetToFirstFrame);
      }
      return;
    }
    const play = () => void video.play().catch(() => undefined);
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      play();
      return;
    }
    video.addEventListener("canplay", play, { once: true });
    return () => video.removeEventListener("canplay", play);
  }, [motion, open, videoSource]);

  const renderedMessages = messages.length > 0 ? messages : [WELCOME_MESSAGE];
  const interactionLocked = loading || sending || Boolean(typing);
  const canSubmit = Boolean(input.trim()) && configured && !interactionLocked;

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || !configured || loading || sending || typing) return;
    const optimisticId = `admin-user-pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        expiresAt: "",
      },
    ]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const payload = await sendAdminKurtiMessage(text);
      const nextMessages = payload.messages ?? [];
      const assistantMessage = payload.assistantMessage
        ?? [...nextMessages].reverse().find((message) => message.role === "assistant" && message.content.trim());
      setMessages(nextMessages);
      setExpiresAt(payload.expiresAt);
      if (assistantMessage?.content) {
        setTyping({ messageId: assistantMessage.id, content: assistantMessage.content, visibleLength: 0 });
      }
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setInput(text);
      setError(caught instanceof Error ? caught.message : "Admin-Kurti konnte nicht antworten.");
    } finally {
      setSending(false);
    }
  }, [configured, input, loading, sending, typing]);

  if (!open) return null;

  return (
    <aside
      id="admin-kurti-panel"
      aria-label="Admin-Kurti Chat"
      style={{
        position: "fixed",
        zIndex: 110,
        top: 12,
        bottom: 12,
        left: sidebarExpanded ? 208 : 64,
        width: "min(620px, calc(100vw - 88px))",
        maxWidth: `calc(100vw - ${sidebarExpanded ? 220 : 76}px)`,
        borderRadius: 22,
        border: "1px solid rgba(15,23,42,0.1)",
        background: "rgba(255,255,255,0.88)",
        boxShadow: "0 26px 80px rgba(15,23,42,0.2), inset 0 1px 0 rgba(255,255,255,0.86)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        overflow: "hidden",
        isolation: "isolate",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
        transition: "left 240ms cubic-bezier(0.4,0,0.2,1), max-width 240ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <video
        ref={videoRef}
        src={videoSource}
        muted
        loop
        playsInline
        preload="auto"
        autoPlay={motion !== "idle"}
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 0,
          top: "17%",
          left: "50%",
          width: "min(500px, 88%)",
          height: "68%",
          transform: "translateX(-50%)",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          opacity: motion === "idle" ? 0.105 : 0.17,
          filter: "saturate(0.86) contrast(0.96)",
          transition: "opacity 240ms ease",
        }}
      />

      <header
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: 70,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 11,
          borderBottom: "1px solid rgba(15,23,42,0.075)",
          background: "rgba(255,255,255,0.5)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Admin-Kurti schließen"
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            border: "1px solid rgba(15,23,42,0.09)",
            background: "rgba(248,250,252,0.78)",
            color: "rgba(15,23,42,0.58)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(15,23,42,0.04)",
          }}
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            display: "grid",
            placeItems: "center",
            color: "#dc2626",
            background: "rgba(254,242,242,0.78)",
            border: "1px solid rgba(220,38,38,0.13)",
          }}
        >
          <Bot size={19} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, lineHeight: 1.15, fontWeight: 800, color: "#111827" }}>Kurti Admin</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 650, color: "rgba(15,23,42,0.46)" }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "#22a06b" }} />
            Dein Spark Daten-Assistent
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ height: 24, padding: "0 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(15,23,42,0.58)", background: "rgba(248,250,252,0.66)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 8.5, fontWeight: 750 }}>
            <Database size={11} /> {capabilityCount} Datenfunktionen
          </span>
          <span style={{ height: 24, padding: "0 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(15,23,42,0.58)", background: "rgba(248,250,252,0.66)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 8.5, fontWeight: 750 }}>
            <ShieldCheck size={11} /> Nur Lesen · 15 Min.
          </span>
        </div>
      </header>

      <div
        ref={messageContainerRef}
        className="admin-kurti-message-scroll"
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "18px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overscrollBehavior: "contain",
        }}
      >
        {loading ? <TypingBubble label="Kurti lädt" /> : renderedMessages.map((message) => {
          const isUser = message.role === "user";
          const isTypingMessage = !isUser && typing?.messageId === message.id;
          const visibleContent = isTypingMessage ? typing.content.slice(0, typing.visibleLength) : message.content;
          return (
            <div
              key={message.id}
              aria-label={isTypingMessage ? message.content : undefined}
              style={{
                maxWidth: isUser ? "78%" : "88%",
                alignSelf: isUser ? "flex-end" : "flex-start",
                borderRadius: isUser ? "16px 16px 5px 16px" : "16px 16px 16px 5px",
                padding: isUser ? "10px 13px" : "11px 13px",
                color: isUser ? "#ffffff" : "rgba(15,23,42,0.88)",
                background: isUser ? "rgba(220,38,38,0.72)" : "rgba(248,250,252,0.5)",
                border: isUser ? "1px solid rgba(185,28,28,0.23)" : "1px solid rgba(15,23,42,0.085)",
                boxShadow: isUser ? "0 6px 16px rgba(185,28,28,0.12)" : "0 5px 15px rgba(15,23,42,0.04)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                fontSize: 12.5,
                fontWeight: 550,
                lineHeight: 1.58,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {isUser ? visibleContent : <AdminKurtiMarkdown content={visibleContent} isTyping={isTypingMessage} />}
            </div>
          );
        })}
        {sending ? <TypingBubble label="Kurti analysiert" /> : null}
        {!configured && !loading ? (
          <div className="admin-kurti-notice">Admin-Kurti ist verfügbar, sobald der OpenAI API-Zugang serverseitig hinterlegt ist.</div>
        ) : null}
        {error ? <div role="alert" className="admin-kurti-notice">{error}</div> : null}
      </div>

      <div style={{ position: "relative", zIndex: 3, padding: "10px 12px 12px", borderTop: "1px solid rgba(15,23,42,0.065)", background: "rgba(255,255,255,0.55)" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: 5,
            borderRadius: 15,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "rgba(248,250,252,0.82)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 5px 15px rgba(15,23,42,0.035)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit) void submit();
              }
            }}
            rows={1}
            maxLength={4000}
            disabled={interactionLocked || !configured}
            placeholder="Frag Kurti über alle GMs, Märkte oder Berechnungen..."
            aria-label="Nachricht an Admin-Kurti"
            style={{
              minWidth: 0,
              flex: 1,
              minHeight: 38,
              maxHeight: 112,
              resize: "none",
              border: 0,
              outline: 0,
              padding: "10px 9px 7px",
              background: "transparent",
              color: "#111827",
              fontFamily: "inherit",
              fontSize: 11.5,
              fontWeight: 550,
              lineHeight: 1.4,
            }}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Nachricht senden"
            style={{
              width: 38,
              height: 38,
              flex: "0 0 38px",
              borderRadius: 12,
              border: "1px solid rgba(185,28,28,0.23)",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              background: canSubmit ? "#dc2626" : "rgba(220,38,38,0.28)",
              boxShadow: canSubmit ? "0 5px 12px rgba(185,28,28,0.16)" : "none",
              cursor: canSubmit ? "pointer" : "default",
              transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease",
            }}
          >
            <SendHorizontal size={16} strokeWidth={2.2} />
          </button>
        </form>
        <div style={{ marginTop: 6, textAlign: "center", fontSize: 8.5, fontWeight: 550, color: "rgba(15,23,42,0.36)" }}>
          Enter sendet · Shift + Enter macht eine neue Zeile · Kurti kann keine Daten ändern
        </div>
      </div>

      <style jsx global>{`
        .admin-kurti-message-scroll { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,0.14) transparent; }
        .admin-kurti-message-scroll::-webkit-scrollbar { width: 5px; }
        .admin-kurti-message-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(15,23,42,0.14); }
        .admin-kurti-loading-dot { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 999px; background: #dc2626; animation: admin-kurti-dot 920ms cubic-bezier(0.4,0,0.2,1) infinite; }
        @keyframes admin-kurti-dot { 0%, 60%, 100% { opacity: 0.26; transform: translateY(0) scale(0.74); } 30% { opacity: 1; transform: translateY(-2px) scale(1); } }
        .admin-kurti-notice { align-self: stretch; padding: 10px 12px; border-radius: 12px; color: rgba(127,29,29,0.82); background: rgba(254,242,242,0.68); border: 1px solid rgba(220,38,38,0.12); backdrop-filter: blur(3px); font-size: 10.5px; font-weight: 650; line-height: 1.45; }
        .admin-kurti-markdown { min-width: 0; white-space: normal; }
        .admin-kurti-markdown > :first-child { margin-top: 0; }
        .admin-kurti-markdown > :last-child { margin-bottom: 0; }
        .admin-kurti-markdown--typing > :last-child:not(ul):not(ol):not(blockquote):not(pre)::after,
        .admin-kurti-markdown--typing > :last-child:is(ul, ol) > li:last-child:not(:has(> p))::after,
        .admin-kurti-markdown--typing > :last-child:is(ul, ol) > li:last-child > p:last-child::after,
        .admin-kurti-markdown--typing > blockquote:last-child > :last-child::after,
        .admin-kurti-markdown--typing > pre:last-child code::after { content: ""; display: inline-block; width: 1px; height: 0.92em; margin-left: 2px; border-radius: 999px; vertical-align: -0.06em; background: rgba(15,23,42,0.52); animation: admin-kurti-cursor 640ms steps(1,end) infinite; }
        @keyframes admin-kurti-cursor { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } }
        .admin-kurti-markdown p { margin: 0 0 0.64em; }
        .admin-kurti-markdown strong { font-weight: 800; color: rgba(15,23,42,0.96); }
        .admin-kurti-markdown em { font-style: italic; }
        .admin-kurti-markdown h1, .admin-kurti-markdown h2, .admin-kurti-markdown h3, .admin-kurti-markdown h4 { margin: 0.9em 0 0.4em; color: rgba(15,23,42,0.96); font-weight: 800; line-height: 1.25; letter-spacing: -0.015em; }
        .admin-kurti-markdown h1 { font-size: 1.3em; } .admin-kurti-markdown h2 { font-size: 1.2em; } .admin-kurti-markdown h3 { font-size: 1.11em; } .admin-kurti-markdown h4 { font-size: 1.03em; }
        .admin-kurti-markdown ul, .admin-kurti-markdown ol { margin: 0.38em 0 0.68em; padding-left: 1.55em; }
        .admin-kurti-markdown li { margin: 0.18em 0; padding-left: 0.08em; }
        .admin-kurti-markdown li > p { margin-bottom: 0.28em; }
        .admin-kurti-markdown blockquote { margin: 0.6em 0; padding: 0.34em 0 0.34em 0.78em; border-left: 2px solid rgba(220,38,38,0.42); color: rgba(15,23,42,0.64); }
        .admin-kurti-markdown a { color: #b91c1c; font-weight: 700; text-decoration: underline; text-decoration-color: rgba(185,28,28,0.3); text-underline-offset: 2px; }
        .admin-kurti-markdown hr { height: 1px; margin: 0.78em 0; border: 0; background: rgba(15,23,42,0.11); }
        .admin-kurti-markdown pre { max-width: 100%; margin: 0.58em 0; padding: 0.75em 0.85em; overflow-x: auto; border: 1px solid rgba(15,23,42,0.09); border-radius: 9px; background: rgba(15,23,42,0.055); white-space: pre; }
        .admin-kurti-markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
        .admin-kurti-markdown :not(pre) > code { padding: 0.12em 0.34em; border: 1px solid rgba(15,23,42,0.08); border-radius: 4px; background: rgba(15,23,42,0.055); color: #7f1d1d; }
        .admin-kurti-table-wrap { max-width: 100%; margin: 0.6em 0; overflow-x: auto; border: 1px solid rgba(15,23,42,0.09); border-radius: 9px; }
        .admin-kurti-markdown table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
        .admin-kurti-markdown th, .admin-kurti-markdown td { padding: 0.46em 0.56em; border-right: 1px solid rgba(15,23,42,0.08); border-bottom: 1px solid rgba(15,23,42,0.08); text-align: left; vertical-align: top; }
        .admin-kurti-markdown th { background: rgba(15,23,42,0.045); font-weight: 800; }
        .admin-kurti-markdown tr:last-child td { border-bottom: 0; } .admin-kurti-markdown th:last-child, .admin-kurti-markdown td:last-child { border-right: 0; }
        .admin-kurti-markdown del { opacity: 0.62; }
        .admin-kurti-markdown input[type="checkbox"] { margin-right: 0.42em; accent-color: #dc2626; }
        .admin-kurti-markdown img { display: block; max-width: 100%; height: auto; margin: 0.58em 0; border-radius: 9px; }
      `}</style>
    </aside>
  );
}

function TypingBubble({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      style={{
        width: "fit-content",
        minWidth: 62,
        height: 36,
        alignSelf: "flex-start",
        padding: "0 14px",
        borderRadius: "15px 15px 15px 5px",
        background: "rgba(248,250,252,0.54)",
        border: "1px solid rgba(220,38,38,0.13)",
        boxShadow: "0 5px 14px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {[0, 1, 2].map((index) => (
        <span key={index} className="admin-kurti-loading-dot" style={{ animationDelay: `${index * 140}ms` }} />
      ))}
    </div>
  );
}
