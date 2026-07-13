"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Clock,
  Home,
  LogOut,
  MessageCircle,
  SendHorizontal,
  SlidersHorizontal,
  Type,
  User,
} from "lucide-react";
import { useGmTextScale } from "@/components/dashboard/GmTextScaleProvider";
import {
  fetchGmKurtiMessages,
  sendGmKurtiMessage,
  type GmKurtiMessage,
} from "@/lib/api/backend";

export interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  action?: "navigate" | "logout";
  tone?: "default" | "danger";
  isNew?: boolean;
}

interface CollapsibleMenuProps {
  items: MenuItem[];
  defaultIndex?: number;
  onSelect?: (index: number, item: MenuItem) => void;
  onLogout?: () => void;
  enableKurti?: boolean;
}

const HOLD_DELAY = 300;
const ITEM_HEIGHT = 30;
const CARD_PADDING = 5;
const SETTINGS_PANEL_HEIGHT = 104;
const CHAT_PANEL_HEIGHT = 604;
const TEXT_SCALE_EFFECTIVE_FACTOR = 0.8;
const KURTI_TALKING_VIDEO = "/kurti-talking.mp4";
const KURTI_THINKING_VIDEO = "/kurti-thinking.mp4";

type KurtiTypingState = {
  messageId: string;
  content: string;
  visibleLength: number;
};

type KurtiMotion = "idle" | "thinking" | "talking";

function KurtiMarkdown({ content, isTyping = false }: { content: string; isTyping?: boolean }) {
  return (
    <div className={`gm-kurti-markdown${isTyping ? " gm-kurti-markdown--typing" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="gm-kurti-table-wrap">
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

const KURTI_WELCOME_MESSAGE: GmKurtiMessage = {
  id: "kurti-welcome",
  role: "assistant",
  content: "Servus! Wobei kann ich dir heute helfen?",
  createdAt: "",
  expiresAt: "",
};

export const defaultMenuItems: MenuItem[] = [
  { label: "Home", icon: <Home size={11} strokeWidth={1.8} /> },
  { label: "Zeiterfassung", icon: <Clock size={11} strokeWidth={1.8} /> },
  { label: "Profil", icon: <User size={11} strokeWidth={1.8} /> },
];

export function CollapsibleMenu({
  items,
  defaultIndex = 0,
  onSelect,
  onLogout,
  enableKurti = false,
}: CollapsibleMenuProps) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<GmKurtiMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatConfigured, setChatConfigured] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatExpiresAt, setChatExpiresAt] = useState<string | null>(null);
  const [chatTyping, setChatTyping] = useState<KurtiTypingState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const kurtiVideoRef = useRef<HTMLVideoElement>(null);
  const isHolding = useRef(false);
  const [sliderPressed, setSliderPressed] = useState(false);
  const {
    previewPercent: textScalePercent,
    setPreviewPercent: setTextScalePreviewPercent,
    commitPreviewPercent: commitTextScalePreviewPercent,
    resetPreviewPercent: resetTextScalePreviewPercent,
  } = useGmTextScale();
  const textScaleProgress = Math.min(100, Math.max(0, textScalePercent * 2));
  const sliderDraftPercentRef = useRef(textScalePercent);
  const utilityPanelOpen = settingsOpen || chatOpen;

  useEffect(() => {
    if (!chatOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      const container = chatMessagesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [chatMessages, chatOpen, chatTyping?.visibleLength]);

  useEffect(() => {
    if (!chatOpen || !enableKurti) return;
    let cancelled = false;
    setChatLoading(true);
    setChatError(null);
    fetchGmKurtiMessages()
      .then((payload) => {
        if (cancelled) return;
        setChatMessages(payload.messages ?? []);
        setChatConfigured(payload.configured);
        setChatExpiresAt(payload.expiresAt);
      })
      .catch((error) => {
        if (cancelled) return;
        setChatError(error instanceof Error ? error.message : "Kurti konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatOpen, enableKurti]);

  useEffect(() => {
    if (!chatExpiresAt) return;
    const expiresAtMs = Date.parse(chatExpiresAt);
    if (!Number.isFinite(expiresAtMs)) return;
    const clearMemory = () => {
      setChatMessages([]);
      setChatExpiresAt(null);
      setChatTyping(null);
    };
    const delayMs = expiresAtMs - Date.now();
    if (delayMs <= 0) {
      clearMemory();
      return;
    }
    const timeoutId = window.setTimeout(clearMemory, delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [chatExpiresAt]);

  useEffect(() => {
    if (!chatTyping) return;
    if (chatTyping.visibleLength >= chatTyping.content.length) {
      const finishId = window.setTimeout(() => {
        setChatTyping((current) => current?.messageId === chatTyping.messageId ? null : current);
      }, 180);
      return () => window.clearTimeout(finishId);
    }

    const chunkSize = Math.max(1, Math.ceil(chatTyping.content.length / 420));
    const stepCount = Math.ceil(chatTyping.content.length / chunkSize);
    const typingDurationMs = Math.min(6_500, Math.max(2_400, chatTyping.content.length * 11));
    const baseDelay = Math.max(16, Math.round(typingDurationMs / stepCount));
    const nextLength = Math.min(chatTyping.content.length, chatTyping.visibleLength + chunkSize);
    const typedChunk = chatTyping.content.slice(chatTyping.visibleLength, nextLength);
    const delay = /[.!?,;:]\s*$/.test(typedChunk) ? baseDelay + 36 : baseDelay;
    const typeId = window.setTimeout(() => {
      setChatTyping((current) => current?.messageId === chatTyping.messageId
        ? { ...current, visibleLength: nextLength }
        : current);
    }, delay);
    return () => window.clearTimeout(typeId);
  }, [chatTyping]);

  const kurtiMotion: KurtiMotion = chatSending ? "thinking" : chatTyping ? "talking" : "idle";
  const kurtiVideoSource = kurtiMotion === "thinking" ? KURTI_THINKING_VIDEO : KURTI_TALKING_VIDEO;

  useEffect(() => {
    if (!chatOpen) return;
    const video = kurtiVideoRef.current;
    if (!video) return;

    const resetToFirstFrame = () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // The first frame is applied again once video metadata is ready.
      }
    };

    if (kurtiMotion === "idle") {
      resetToFirstFrame();
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        video.addEventListener("loadedmetadata", resetToFirstFrame, { once: true });
        return () => video.removeEventListener("loadedmetadata", resetToFirstFrame);
      }
      return;
    }

    const playVideo = () => {
      void video.play().catch(() => {
        // Muted inline playback may wait until the clip has buffered enough.
      });
    };
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      playVideo();
      return;
    }
    video.addEventListener("canplay", playVideo, { once: true });
    return () => video.removeEventListener("canplay", playVideo);
  }, [chatOpen, kurtiMotion, kurtiVideoSource]);

  useEffect(() => {
    if (!sliderPressed) {
      sliderDraftPercentRef.current = textScalePercent;
    }
  }, [sliderPressed, textScalePercent]);

  const updateTextScaleFromClientX = useCallback(
    (clientX: number) => {
      const track = sliderTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const nextPercent = Math.round((ratio * 50) / 5) * 5;
      sliderDraftPercentRef.current = nextPercent;
      setTextScalePreviewPercent(nextPercent);
    },
    [setTextScalePreviewPercent],
  );

  const onSliderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      let nextPercent: number | null = null;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        nextPercent = textScalePercent - 5;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        nextPercent = textScalePercent + 5;
      }
      if (event.key === "Home") {
        event.preventDefault();
        nextPercent = 0;
      }
      if (event.key === "End") {
        event.preventDefault();
        nextPercent = 50;
      }

      if (nextPercent !== null) {
        sliderDraftPercentRef.current = nextPercent;
        setTextScalePreviewPercent(nextPercent);
        commitTextScalePreviewPercent(nextPercent);
      }
    },
    [commitTextScalePreviewPercent, setTextScalePreviewPercent, textScalePercent],
  );

  const rows = React.useMemo(() => {
    const mapped = items.map((item, itemIndex) => ({ type: "item" as const, item, itemIndex }));
    const logoutRowIndex = mapped.findIndex((row) => row.item.action === "logout");

    if (logoutRowIndex < 0) {
      return mapped;
    }

    return [
      ...mapped.slice(0, logoutRowIndex),
      ...(enableKurti ? [{ type: "chat" as const }] : []),
      { type: "settings" as const },
      ...mapped.slice(logoutRowIndex),
    ];
  }, [enableKurti, items]);

  const collapsedHeight = ITEM_HEIGHT + CARD_PADDING * 2;
  const activeRowIndex = Math.max(
    0,
    rows.findIndex((row) => row.type === "item" && row.itemIndex === activeIndex)
  );
  const expandedHeight = chatOpen
    ? CHAT_PANEL_HEIGHT
    : settingsOpen
      ? SETTINGS_PANEL_HEIGHT
      : rows.length * ITEM_HEIGHT + CARD_PADDING * 2;

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const getIndexFromY = useCallback(
    (clientY: number) => {
      if (utilityPanelOpen) return null;
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top - CARD_PADDING;
      const idx = Math.floor(y / ITEM_HEIGHT);
      if (idx >= 0 && idx < rows.length) return idx;
      return null;
    },
    [rows.length, utilityPanelOpen]
  );

  const select = useCallback(
    (rowIndex: number | null) => {
      setHoveredIndex(null);
      isHolding.current = false;

      if (rowIndex === null) {
        setExpanded(false);
        setSettingsOpen(false);
        setChatOpen(false);
        return;
      }

      const selectedRow = rows[rowIndex];
      if (!selectedRow) {
        setExpanded(false);
        setSettingsOpen(false);
        setChatOpen(false);
        return;
      }

      if (selectedRow.type === "chat") {
        setExpanded(true);
        setSettingsOpen(false);
        setChatOpen(true);
        return;
      }

      if (selectedRow.type === "settings") {
        setExpanded(true);
        setChatOpen(false);
        setSettingsOpen(true);
        return;
      }

      const selectedItem = selectedRow.item;
      const selectedIndex = selectedRow.itemIndex;
      setExpanded(false);
      setSettingsOpen(false);
      setChatOpen(false);
      onSelect?.(selectedIndex, selectedItem);

      if (selectedItem.action === "logout") {
        if (!onSelect && typeof onLogout === "function") {
          onLogout();
        }
        return;
      }

      if (selectedIndex !== activeIndex) {
        setActiveIndex(selectedIndex);
      }
    },
    [activeIndex, onLogout, onSelect, rows]
  );

  // --- Mouse ---
  const onMouseDown = useCallback(() => {
    if (utilityPanelOpen) return;
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold, utilityPanelOpen]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isHolding.current) return;
      const idx = getIndexFromY(e.clientY);
      setHoveredIndex(idx);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isHolding.current) return;
      clearHold();
      const idx = getIndexFromY(e.clientY);
      select(idx);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [clearHold, getIndexFromY, select]);

  // --- Touch ---
  const onTouchStart = useCallback(() => {
    if (utilityPanelOpen) return;
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold, utilityPanelOpen]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isHolding.current) return;
      const idx = getIndexFromY(e.touches[0].clientY);
      setHoveredIndex(idx);
    },
    [getIndexFromY]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isHolding.current) return;
      clearHold();
      const touch = e.changedTouches[0];
      const idx = getIndexFromY(touch.clientY);
      select(idx);
    },
    [clearHold, getIndexFromY, select]
  );

  useEffect(() => clearHold, [clearHold]);

  const displayIndex = expanded && hoveredIndex !== null ? hoveredIndex : activeRowIndex;
  const renderedChatMessages = chatMessages.length > 0 ? chatMessages : [KURTI_WELCOME_MESSAGE];
  const chatInteractionLocked = chatLoading || chatSending || Boolean(chatTyping);
  const canSubmitKurtiMessage = Boolean(chatInput.trim()) && !chatInteractionLocked && chatConfigured;
  const submitKurtiMessage = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading || chatSending || chatTyping || !chatConfigured) return;
    const optimisticId = `user-pending-${Date.now()}`;
    setChatMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        expiresAt: "",
      },
    ]);
    setChatInput("");
    setChatSending(true);
    setChatError(null);
    try {
      const payload = await sendGmKurtiMessage(text);
      const nextMessages = payload.messages ?? [];
      const assistantMessage = payload.assistantMessage
        ?? [...nextMessages].reverse().find((message) => message.role === "assistant" && message.content.trim());
      setChatMessages(nextMessages);
      setChatExpiresAt(payload.expiresAt);
      if (assistantMessage?.content) {
        setChatTyping({
          messageId: assistantMessage.id,
          content: assistantMessage.content,
          visibleLength: 0,
        });
      }
    } catch (error) {
      setChatMessages((current) => current.filter((message) => message.id !== optimisticId));
      setChatInput(text);
      setChatError(error instanceof Error ? error.message : "Kurti konnte nicht antworten.");
    } finally {
      setChatSending(false);
    }
  }, [chatConfigured, chatInput, chatLoading, chatSending, chatTyping]);

  return (
    <>
      {settingsOpen && (
        <div
          data-gm-text-scale-ignore="true"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 86,
            minHeight: 178,
            borderRadius: 22,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(255,255,255,0.32)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72), 0 22px 70px rgba(15,23,42,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 45,
          }}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 0, lineHeight: 0.82 }}>
            {[8, 10, 12, 15, 18, 22, 27].map((size, index) => (
              <span
                key={size}
                style={{
                  fontSize: `${size * (1 + (textScalePercent * TEXT_SCALE_EFFECTIVE_FACTOR) / 100)}px`,
                  fontWeight: 900,
                  letterSpacing: 0,
                  color: `rgba(15,23,42,${0.12 + index * 0.075})`,
                  transition: "font-size 260ms cubic-bezier(0.32,0.72,0,1), color 220ms ease",
                }}
              >
                A
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="relative mx-auto px-6"
        style={{
          maxWidth: chatOpen ? 606 : 420,
          transition: "max-width 480ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          "gm-menu-scrollbars-hidden relative w-full overflow-hidden select-none",
          "transition-all duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        )}
        style={{
          height: expanded ? expandedHeight : collapsedHeight,
          borderRadius: 14,
          backgroundColor: "#ffffff",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: expanded
            ? "0 6px 24px rgba(0,0,0,0.06)"
            : "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div
          className="transition-transform duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: "200%",
            height: "100%",
            display: "flex",
            transform: utilityPanelOpen
              ? "translateX(-50%)"
              : expanded
                ? "translateX(0) translateY(0)"
                : `translateX(0) translateY(-${activeRowIndex * ITEM_HEIGHT}px)`,
          }}
        >
          <div style={{ width: "50%", paddingTop: CARD_PADDING, paddingBottom: CARD_PADDING }}>
            {rows.map((row, i) => {
              const item =
                row.type === "chat"
                  ? {
                      label: "Frag Kurti...",
                      icon: <MessageCircle size={11} strokeWidth={1.8} />,
                      tone: "default" as const,
                      action: undefined,
                    }
                  : row.type === "settings"
                  ? {
                      label: "Einstellungen",
                      icon: <SlidersHorizontal size={11} strokeWidth={1.8} />,
                      tone: "default" as const,
                      action: undefined,
                    }
                  : row.item;
              const isSelected = i === displayIndex;
              const isDanger = item.tone === "danger" || item.action === "logout";
              const dangerSoftBackground =
                "linear-gradient(180deg, rgba(254,242,242,0.96), rgba(254,226,226,0.94))";
              const dangerSoftShadow =
                "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(220,38,38,0.16), 0 1px 4px rgba(185,28,28,0.1)";

              return (
                <div
                  key={row.type === "chat" ? "gm-kurti-chat" : row.type === "settings" ? "gm-text-settings" : item.label}
                  className={cn(
                    "relative grid cursor-pointer items-center",
                    "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  )}
                  style={{
                    height: ITEM_HEIGHT,
                    borderRadius: 10,
                    marginLeft: CARD_PADDING,
                    marginRight: CARD_PADDING,
                    gridTemplateColumns: "1fr auto 8px auto 1fr",
                    backgroundColor: isSelected ? undefined : "transparent",
                    background: isSelected
                      ? "linear-gradient(to bottom, #DC2626, #e84040)"
                      : isDanger
                        ? dangerSoftBackground
                        : undefined,
                    boxShadow: isSelected
                      ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)"
                      : isDanger
                        ? dangerSoftShadow
                        : undefined,
                  }}
                >
                  <span style={{ gridColumn: 1 }} />
                  <span
                    className="transition-colors duration-200"
                    style={{
                      gridColumn: 2,
                      color: isSelected ? "#ffffff" : isDanger ? "#b91c1c" : "rgba(0,0,0,0.3)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ gridColumn: 3 }} />
                  <span
                    className={cn(
                      "text-[11px] tracking-[-0.01em] transition-colors duration-200 whitespace-nowrap",
                      isSelected ? "font-semibold" : "font-normal"
                    )}
                    style={{
                      gridColumn: 4,
                      color: isSelected ? "#ffffff" : isDanger ? "#b91c1c" : "rgba(0,0,0,0.45)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            style={{
              width: "50%",
              height: "100%",
              boxSizing: "border-box",
              padding: "10px 12px 11px",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            {chatOpen ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, position: "relative", isolation: "isolate", overflow: "hidden" }}>
                <video
                  ref={kurtiVideoRef}
                  src={kurtiVideoSource}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  autoPlay={kurtiMotion !== "idle"}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    zIndex: 0,
                    top: 66,
                    left: "50%",
                    width: 360,
                    height: 430,
                    transform: "translateX(-50%)",
                    objectFit: "contain",
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity: kurtiMotion === "idle" ? 0.1 : 0.16,
                    filter: "saturate(0.86) contrast(0.96)",
                    transition: "opacity 260ms ease",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    paddingBottom: 9,
                    borderBottom: "1px solid rgba(15,23,42,0.07)",
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setChatOpen(false);
                    }}
                    style={{
                      width: 26,
                      height: 26,
                      flex: "0 0 26px",
                      borderRadius: 9,
                      border: "1px solid rgba(15,23,42,0.08)",
                      background: "rgba(248,250,252,0.96)",
                      color: "rgba(15,23,42,0.58)",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 3px 8px rgba(15,23,42,0.05)",
                      cursor: "pointer",
                    }}
                    aria-label="Frag Kurti schließen"
                  >
                    <ChevronLeft size={15} strokeWidth={2.3} />
                  </button>
                  <div
                    style={{
                      width: 29,
                      height: 29,
                      flex: "0 0 29px",
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      color: "#dc2626",
                      background: "rgba(254,242,242,0.92)",
                      border: "1px solid rgba(220,38,38,0.12)",
                    }}
                  >
                    <MessageCircle size={14} strokeWidth={2.1} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.1, fontWeight: 850, color: "#111827" }}>
                      Frag Kurti...
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        color: "rgba(15,23,42,0.42)",
                        fontSize: 8,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: 5, height: 5, borderRadius: 999, background: "#22a06b" }}
                      />
                      Dein Spark Assistent
                    </div>
                  </div>
                </div>

                <div
                  ref={chatMessagesRef}
                  className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{
                    position: "relative",
                    zIndex: 2,
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "10px 1px 9px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                    overscrollBehavior: "contain",
                  }}
                >
                  {chatLoading ? (
                    <div
                      aria-label="Kurti lädt"
                      style={{
                        width: 84,
                        height: 28,
                        borderRadius: "12px 12px 12px 4px",
                        background: "rgba(248,250,252,0.44)",
                        border: "1px solid rgba(15,23,42,0.07)",
                        backdropFilter: "blur(1.5px)",
                        WebkitBackdropFilter: "blur(1.5px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="gm-kurti-loading-dot"
                          style={{ animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </div>
                  ) : renderedChatMessages.map((message) => {
                    const isUser = message.role === "user";
                    const isTypingMessage = !isUser && chatTyping?.messageId === message.id;
                    const visibleContent = isTypingMessage
                      ? chatTyping.content.slice(0, chatTyping.visibleLength)
                      : message.content;
                    return (
                      <div
                        key={message.id}
                        aria-label={isTypingMessage ? message.content : undefined}
                        style={{
                          maxWidth: "82%",
                          alignSelf: isUser ? "flex-end" : "flex-start",
                          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                          padding: "7px 9px",
                          color: isUser ? "#ffffff" : "rgba(15,23,42,0.84)",
                          background: isUser ? "rgba(220,38,38,0.72)" : "rgba(248,250,252,0.46)",
                          border: isUser ? "1px solid rgba(185,28,28,0.24)" : "1px solid rgba(15,23,42,0.08)",
                          boxShadow: isUser
                            ? "0 4px 11px rgba(185,28,28,0.12)"
                            : "0 3px 10px rgba(15,23,42,0.035)",
                          backdropFilter: "blur(1.5px)",
                          WebkitBackdropFilter: "blur(1.5px)",
                          fontSize: 10.75,
                          fontWeight: 600,
                          lineHeight: 1.5,
                          letterSpacing: 0,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {isUser ? visibleContent : <KurtiMarkdown content={visibleContent} isTyping={isTypingMessage} />}
                      </div>
                    );
                  })}
                  {chatSending && (
                    <div
                      aria-label="Kurti schreibt"
                      style={{
                        width: 54,
                        height: 28,
                        alignSelf: "flex-start",
                        borderRadius: "12px 12px 12px 4px",
                        background: "rgba(248,250,252,0.44)",
                        border: "1px solid rgba(15,23,42,0.07)",
                        backdropFilter: "blur(1.5px)",
                        WebkitBackdropFilter: "blur(1.5px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="gm-kurti-loading-dot"
                          style={{ animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </div>
                  )}
                  {!chatConfigured && !chatLoading && (
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: "8px 9px",
                        borderRadius: 10,
                        color: "rgba(127,29,29,0.78)",
                        background: "rgba(254,242,242,0.82)",
                        border: "1px solid rgba(220,38,38,0.1)",
                        fontSize: 8.5,
                        fontWeight: 650,
                        lineHeight: 1.4,
                      }}
                    >
                      Kurti wird gerade eingerichtet. Der Chat ist verfügbar, sobald der API-Zugang hinterlegt ist.
                    </div>
                  )}
                  {chatError && (
                    <div
                      role="alert"
                      style={{
                        alignSelf: "stretch",
                        padding: "8px 9px",
                        borderRadius: 10,
                        color: "rgba(127,29,29,0.82)",
                        background: "rgba(254,242,242,0.82)",
                        border: "1px solid rgba(220,38,38,0.1)",
                        fontSize: 8.5,
                        fontWeight: 650,
                        lineHeight: 1.4,
                      }}
                    >
                      {chatError}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={submitKurtiMessage}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: 4,
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.09)",
                    background: "rgba(248,250,252,0.9)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 4px 12px rgba(15,23,42,0.035)",
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    maxLength={1500}
                    disabled={chatInteractionLocked || !chatConfigured}
                    placeholder="Frag Kurti..."
                    aria-label="Nachricht an Kurti"
                    style={{
                      minWidth: 0,
                      flex: 1,
                      height: 29,
                      border: 0,
                      outline: 0,
                      padding: "0 7px",
                      background: "transparent",
                      color: "#111827",
                      fontFamily: "inherit",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!canSubmitKurtiMessage}
                    aria-label="Nachricht senden"
                    style={{
                      width: 29,
                      height: 29,
                      flex: "0 0 29px",
                      borderRadius: 9,
                      border: "1px solid rgba(185,28,28,0.24)",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff",
                      background: canSubmitKurtiMessage ? "#dc2626" : "rgba(220,38,38,0.3)",
                      boxShadow: canSubmitKurtiMessage ? "0 4px 10px rgba(185,28,28,0.16)" : "none",
                      cursor: canSubmitKurtiMessage ? "pointer" : "default",
                      transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                    }}
                  >
                    <SendHorizontal size={13} strokeWidth={2.2} />
                  </button>
                </form>
              </div>
            ) : (
              <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  resetTextScalePreviewPercent();
                  setSettingsOpen(false);
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "rgba(248,250,252,0.96)",
                  color: "rgba(15,23,42,0.58)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 3px 8px rgba(15,23,42,0.05)",
                  cursor: "pointer",
                }}
                aria-label="Einstellungen schließen"
              >
                <ChevronLeft size={15} strokeWidth={2.3} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "rgba(15,23,42,0.52)",
                    fontSize: 8,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  Textgröße
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 900,
                    lineHeight: 1.15,
                  }}
                >
                  <Type size={13} strokeWidth={2.4} />
                  {textScalePercent > 0 ? `+${textScalePercent}%` : "Normal"}
                </div>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={textScalePercent}
              onChange={(event) => {
                const nextPercent = Number(event.target.value);
                sliderDraftPercentRef.current = nextPercent;
                setTextScalePreviewPercent(nextPercent);
                commitTextScalePreviewPercent(nextPercent);
              }}
              aria-label="GM Textgröße"
              style={{
                width: "100%",
                display: "none",
                marginTop: 13,
                accentColor: "#dc2626",
                cursor: "pointer",
              }}
            />
            <div
              ref={sliderTrackRef}
              role="slider"
              tabIndex={0}
              aria-label="GM Textgröße"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={textScalePercent}
              onKeyDown={onSliderKeyDown}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setSliderPressed(true);
                updateTextScaleFromClientX(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!sliderPressed) return;
                event.stopPropagation();
                updateTextScaleFromClientX(event.clientX);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                commitTextScalePreviewPercent(sliderDraftPercentRef.current);
                setSliderPressed(false);
              }}
              onPointerCancel={() => {
                resetTextScalePreviewPercent();
                sliderDraftPercentRef.current = textScalePercent;
                setSliderPressed(false);
              }}
              style={{
                position: "relative",
                height: 24,
                marginTop: 10,
                cursor: "pointer",
                touchAction: "none",
                outline: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: 5,
                  borderRadius: 999,
                  transform: "translateY(-50%)",
                  background: "linear-gradient(90deg, rgba(15,23,42,0.09), rgba(15,23,42,0.045))",
                  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.08)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  width: `${textScaleProgress}%`,
                  height: 5,
                  borderRadius: 999,
                  transform: "translateY(-50%)",
                  background: "linear-gradient(90deg, rgba(248,113,113,0.78), rgba(220,38,38,0.94))",
                  boxShadow: "0 4px 14px rgba(220,38,38,0.18)",
                  transition: sliderPressed ? "none" : "width 260ms cubic-bezier(0.32,0.72,0,1)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${textScaleProgress}%`,
                  top: "50%",
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  transform: `translate(-50%, -50%) scale(${sliderPressed ? 1.16 : 1})`,
                  background: "#ffffff",
                  border: "1px solid rgba(220,38,38,0.48)",
                  boxShadow: sliderPressed
                    ? "0 8px 20px rgba(220,38,38,0.24), 0 0 0 5px rgba(220,38,38,0.08)"
                    : "0 5px 14px rgba(15,23,42,0.13), 0 0 0 3px rgba(220,38,38,0.05)",
                  transition: sliderPressed
                    ? "transform 120ms ease, box-shadow 120ms ease"
                    : "left 260ms cubic-bezier(0.32,0.72,0,1), transform 220ms ease, box-shadow 220ms ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "rgba(15,23,42,0.42)",
                fontSize: 9,
                fontWeight: 800,
                marginTop: 2,
              }}
            >
              <span>Normal</span>
              <span>+50%</span>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
      {typeof onLogout === "function" && (
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 w-full"
          style={{
            height: 34,
            borderRadius: 12,
            border: "1px solid rgba(220,38,38,0.18)",
            backgroundColor: "rgba(220,38,38,0.06)",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.01em",
            transition: "all 0.15s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.06)";
          }}
        >
          <LogOut size={12} strokeWidth={1.9} />
          Logout
        </button>
      )}
      </div>
      <style jsx>{`
        .gm-menu-scrollbars-hidden,
        .gm-menu-scrollbars-hidden * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .gm-menu-scrollbars-hidden::-webkit-scrollbar,
        .gm-menu-scrollbars-hidden *::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .gm-kurti-loading-dot {
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(71, 85, 105, 0.48);
          animation: gm-kurti-dot 900ms ease-in-out infinite;
        }

        @keyframes gm-kurti-dot {
          0%, 60%, 100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          30% {
            opacity: 0.9;
            transform: translateY(-2px);
          }
        }

      `}</style>
      <style jsx global>{`
        .gm-kurti-markdown {
          min-width: 0;
          white-space: normal;
        }

        .gm-kurti-markdown > :first-child {
          margin-top: 0;
        }

        .gm-kurti-markdown > :last-child {
          margin-bottom: 0;
        }

        .gm-kurti-markdown--typing > :last-child:not(ul):not(ol):not(blockquote):not(pre)::after,
        .gm-kurti-markdown--typing > :last-child:is(ul, ol) > li:last-child:not(:has(> p))::after,
        .gm-kurti-markdown--typing > :last-child:is(ul, ol) > li:last-child > p:last-child::after,
        .gm-kurti-markdown--typing > blockquote:last-child > :last-child::after,
        .gm-kurti-markdown--typing > pre:last-child code::after {
          content: "";
          display: inline-block;
          width: 1px;
          height: 0.92em;
          margin-left: 2px;
          border-radius: 999px;
          vertical-align: -0.06em;
          background: rgba(15,23,42,0.5);
          animation: gm-kurti-inline-cursor 640ms steps(1, end) infinite;
        }

        @keyframes gm-kurti-inline-cursor {
          0%, 48% { opacity: 1; }
          49%, 100% { opacity: 0; }
        }

        .gm-kurti-markdown p {
          margin: 0 0 0.58em;
        }

        .gm-kurti-markdown strong {
          font-weight: 850;
          color: rgba(15,23,42,0.94);
        }

        .gm-kurti-markdown em {
          font-style: italic;
        }

        .gm-kurti-markdown h1,
        .gm-kurti-markdown h2,
        .gm-kurti-markdown h3,
        .gm-kurti-markdown h4 {
          margin: 0.8em 0 0.38em;
          color: rgba(15,23,42,0.94);
          font-weight: 850;
          line-height: 1.25;
          letter-spacing: -0.015em;
        }

        .gm-kurti-markdown h1 { font-size: 1.28em; }
        .gm-kurti-markdown h2 { font-size: 1.18em; }
        .gm-kurti-markdown h3 { font-size: 1.1em; }
        .gm-kurti-markdown h4 { font-size: 1.02em; }

        .gm-kurti-markdown ul,
        .gm-kurti-markdown ol {
          margin: 0.35em 0 0.62em;
          padding-left: 1.55em;
        }

        .gm-kurti-markdown li {
          margin: 0.16em 0;
          padding-left: 0.08em;
        }

        .gm-kurti-markdown li > p {
          margin-bottom: 0.25em;
        }

        .gm-kurti-markdown blockquote {
          margin: 0.55em 0;
          padding: 0.3em 0 0.3em 0.72em;
          border-left: 2px solid rgba(220,38,38,0.42);
          color: rgba(15,23,42,0.62);
        }

        .gm-kurti-markdown a {
          color: #b91c1c;
          font-weight: 700;
          text-decoration: underline;
          text-decoration-color: rgba(185,28,28,0.3);
          text-underline-offset: 2px;
        }

        .gm-kurti-markdown hr {
          height: 1px;
          margin: 0.72em 0;
          border: 0;
          background: rgba(15,23,42,0.11);
        }

        .gm-kurti-markdown pre {
          max-width: 100%;
          margin: 0.55em 0;
          padding: 0.7em 0.8em;
          overflow-x: auto;
          border: 1px solid rgba(15,23,42,0.09);
          border-radius: 8px;
          background: rgba(15,23,42,0.055);
          white-space: pre;
        }

        .gm-kurti-markdown code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.9em;
        }

        .gm-kurti-markdown :not(pre) > code {
          padding: 0.12em 0.32em;
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 4px;
          background: rgba(15,23,42,0.055);
          color: #7f1d1d;
        }

        .gm-kurti-table-wrap {
          max-width: 100%;
          margin: 0.55em 0;
          overflow-x: auto;
          border: 1px solid rgba(15,23,42,0.09);
          border-radius: 8px;
        }

        .gm-kurti-markdown table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.92em;
        }

        .gm-kurti-markdown th,
        .gm-kurti-markdown td {
          padding: 0.42em 0.52em;
          border-right: 1px solid rgba(15,23,42,0.08);
          border-bottom: 1px solid rgba(15,23,42,0.08);
          text-align: left;
          vertical-align: top;
        }

        .gm-kurti-markdown th {
          background: rgba(15,23,42,0.045);
          font-weight: 800;
        }

        .gm-kurti-markdown tr:last-child td {
          border-bottom: 0;
        }

        .gm-kurti-markdown th:last-child,
        .gm-kurti-markdown td:last-child {
          border-right: 0;
        }

        .gm-kurti-markdown del {
          opacity: 0.62;
        }

        .gm-kurti-markdown input[type="checkbox"] {
          margin-right: 0.42em;
          accent-color: #dc2626;
        }

        .gm-kurti-markdown img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 0.55em 0;
          border-radius: 8px;
        }
      `}</style>
    </>
  );
}
