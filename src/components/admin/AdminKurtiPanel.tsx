"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Bot, ChevronLeft, Database, MessageCircle, Minimize2, SendHorizontal, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdminKurtiChart } from "@/components/admin/AdminKurtiChart";
import { AdminKurtiVisualization } from "@/components/admin/AdminKurtiVisualization";
import {
  AdminKurtiVisualizationSkeleton,
  type AdminKurtiVisualizationSkeletonKind,
} from "@/components/admin/kurti-visualizations/AdminKurtiVisualizationSkeleton";
import {
  fetchAdminKurtiMessages,
  fetchAdminKurtiWindowLayout,
  saveAdminKurtiWindowLayout,
  sendAdminKurtiMessage,
  type AdminKurtiMessage,
  type AdminKurtiWindowLayoutInput,
} from "@/lib/api/backend";

const KURTI_TALKING_VIDEO = "/kurti-talking.mp4";
const KURTI_THINKING_VIDEO = "/kurti-thinking.mp4";

type AdminKurtiPanelProps = {
  open: boolean;
  sidebarExpanded: boolean;
  adminUserId: string | null;
  onOpen: () => void;
  onClose: () => void;
};

type TypingState = {
  messageId: string;
  content: string;
  visibleLength: number;
};

type KurtiMotion = "idle" | "thinking" | "talking";

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type StoredWindowLayout = {
  panelRect: PanelRect;
  bubblePoint: Point;
  bubbleDismissed: boolean;
  isCollapsed: boolean;
  updatedAtMs: number;
};

type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

type WindowInteraction =
  | { kind: "move"; pointerId: number; startX: number; startY: number; startRect: PanelRect }
  | { kind: "resize"; pointerId: number; startX: number; startY: number; startRect: PanelRect; edge: ResizeEdge }
  | { kind: "bubble"; pointerId: number; startX: number; startY: number; startPoint: Point; moved: boolean };

const PANEL_MARGIN = 12;
const PANEL_MIN_WIDTH = 360;
const PANEL_MIN_HEIGHT = 340;
const PANEL_DEFAULT_WIDTH = 620;
const BUBBLE_SIZE = 52;
const LAYOUT_STORAGE_KEY = "admin-kurti-window-layout-v1";

const RESIZE_HANDLES: Array<{ edge: ResizeEdge; style: CSSProperties }> = [
  { edge: "n", style: { top: 0, left: 15, right: 15, height: 9, cursor: "ns-resize" } },
  { edge: "ne", style: { top: 0, right: 0, width: 16, height: 16, cursor: "nesw-resize" } },
  { edge: "e", style: { top: 15, right: 0, bottom: 15, width: 9, cursor: "ew-resize" } },
  { edge: "se", style: { right: 0, bottom: 0, width: 16, height: 16, cursor: "nwse-resize" } },
  { edge: "s", style: { right: 15, bottom: 0, left: 15, height: 9, cursor: "ns-resize" } },
  { edge: "sw", style: { bottom: 0, left: 0, width: 16, height: 16, cursor: "nesw-resize" } },
  { edge: "w", style: { top: 15, bottom: 15, left: 0, width: 9, cursor: "ew-resize" } },
  { edge: "nw", style: { top: 0, left: 0, width: 16, height: 16, cursor: "nwse-resize" } },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampPanelRect(rect: PanelRect): PanelRect {
  const availableWidth = Math.max(280, window.innerWidth - PANEL_MARGIN * 2);
  const availableHeight = Math.max(300, window.innerHeight - PANEL_MARGIN * 2);
  const minimumWidth = Math.min(PANEL_MIN_WIDTH, availableWidth);
  const minimumHeight = Math.min(PANEL_MIN_HEIGHT, availableHeight);
  const width = clamp(rect.width, minimumWidth, availableWidth);
  const height = clamp(rect.height, minimumHeight, availableHeight);
  return {
    x: clamp(rect.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)),
    y: clamp(rect.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
    width,
    height,
  };
}

function clampBubblePoint(point: Point): Point {
  return {
    x: clamp(point.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerWidth - BUBBLE_SIZE - PANEL_MARGIN)),
    y: clamp(point.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - BUBBLE_SIZE - PANEL_MARGIN)),
  };
}

function createDefaultPanelRect(sidebarExpanded: boolean): PanelRect {
  const x = sidebarExpanded ? 208 : 64;
  return clampPanelRect({
    x,
    y: PANEL_MARGIN,
    width: Math.min(PANEL_DEFAULT_WIDTH, window.innerWidth - x - PANEL_MARGIN),
    height: window.innerHeight - PANEL_MARGIN * 2,
  });
}

function createWindowLayoutInput(
  panelRect: PanelRect,
  bubblePoint: Point,
  bubbleDismissed: boolean,
  isCollapsed: boolean,
): AdminKurtiWindowLayoutInput {
  return {
    panel: {
      x: Math.max(0, Math.round(panelRect.x)),
      y: Math.max(0, Math.round(panelRect.y)),
      width: Math.max(280, Math.round(panelRect.width)),
      height: Math.max(300, Math.round(panelRect.height)),
    },
    bubble: {
      x: Math.max(0, Math.round(bubblePoint.x)),
      y: Math.max(0, Math.round(bubblePoint.y)),
    },
    bubbleDismissed,
    isCollapsed,
  };
}

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

function inferVisualizationSkeletonKind(message: string): AdminKurtiVisualizationSkeletonKind | null {
  const visualizationIntent = /(chart|diagramm|grafik|visualis|dashboard|entwicklung|trend|verlauf|vergleich|ranking|rangliste|anteil|verteilung|zusammensetzung|korrelation|zusammenhang|heatmap|matrix|tabelle|kpi|kennzahl|donut|pie|funnel|scatter|bubble|radar|timeline|histogramm|boxplot|waterfall|wasserfall|treemap|top\s*\d*|höchste|hoechste|niedrigste|zeitreihe)/i;
  if (!visualizationIntent.test(message)) return null;
  if (/treemap|baumkarte|viele.*anteile|long.?tail/i.test(message)) return "treemap";
  if (/waterfall|wasserfall|brücke|bruecke|beitrag.*veränder|abweichung.*zerleg/i.test(message)) return "waterfall";
  if (/histogramm|box.?plot|quartil|median.*streu|ausrei[ßs]er|verteilung.*(ipp|wert|dauer|zeit|stunden|km|punkte)/i.test(message)) return "distribution";
  if (/heatmap|matrix|intensität|intensitaet|vollständigkeit|vollstaendigkeit/i.test(message)) return "heatmap";
  if (/scatter|streu.?diagramm|bubble|korrelation|zusammenhang.*zwischen/i.test(message)) return "scatter";
  if (/funnel|trichter|donut|pie|torte|kreis|anteil|zusammensetzung|verteilung/i.test(message)) return "composition";
  if (/timeline|zeitstrahl|ereignis|audit.*verlauf|chronolog/i.test(message)) return "timeline";
  if (/radar|spinnen.?diagramm|profil.*dimension/i.test(message)) return "radar";
  if (/dashboard|kpi|kennzahl|überblick|ueberblick|summary/i.test(message)) return "metrics";
  if (/tabelle|exakt|detailwerte|liste|drilldown/i.test(message)) return "table";
  return "series";
}

export function AdminKurtiPanel({ open, sidebarExpanded, adminUserId, onOpen, onClose }: AdminKurtiPanelProps) {
  const [messages, setMessages] = useState<AdminKurtiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<TypingState | null>(null);
  const [pendingVisualizationKind, setPendingVisualizationKind] = useState<AdminKurtiVisualizationSkeletonKind | null>(null);
  const [capabilityCount, setCapabilityCount] = useState(28);
  const [memoryMinutes, setMemoryMinutes] = useState(480);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const [bubblePoint, setBubblePoint] = useState<Point | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [serverLayoutLoaded, setServerLayoutLoaded] = useState(false);
  const [windowInteracting, setWindowInteracting] = useState(false);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const interactionRef = useRef<WindowInteraction | null>(null);
  const layoutReadyRef = useRef(false);
  const storedLayoutRef = useRef<StoredWindowLayout | null>(null);
  const panelRectRef = useRef<PanelRect | null>(null);
  const bubblePointRef = useRef<Point | null>(null);
  const collapsedRef = useRef(false);
  const bubbleDismissedRef = useRef(false);
  const serverLayoutLoadedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const openRef = useRef(open);
  const ignoreBubbleClickRef = useRef(false);
  const layoutSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const layoutStorageKey = `${LAYOUT_STORAGE_KEY}:${adminUserId ?? "unknown-admin"}`;

  const enqueueLayoutSave = useCallback((layout: AdminKurtiWindowLayoutInput) => {
    layoutSaveChainRef.current = layoutSaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveAdminKurtiWindowLayout(layout);
      });
  }, []);

  useEffect(() => {
    if (!layoutReadyRef.current) {
      let storedRect: PanelRect | null = null;
      let storedBubble: Point | null = null;
      let storedBubbleDismissed = false;
      let storedCollapsed = false;
      let storedUpdatedAtMs = 0;
      try {
        const rawLayout = window.localStorage.getItem(layoutStorageKey);
        if (rawLayout) {
          const parsed = JSON.parse(rawLayout) as {
            panelRect?: Partial<PanelRect>;
            bubblePoint?: Partial<Point>;
            bubbleDismissed?: boolean;
            isCollapsed?: boolean;
            updatedAt?: string;
          };
          if (
            parsed.panelRect
            && [parsed.panelRect.x, parsed.panelRect.y, parsed.panelRect.width, parsed.panelRect.height]
              .every((value) => typeof value === "number" && Number.isFinite(value))
          ) {
            storedRect = parsed.panelRect as PanelRect;
          }
          if (
            parsed.bubblePoint
            && [parsed.bubblePoint.x, parsed.bubblePoint.y]
              .every((value) => typeof value === "number" && Number.isFinite(value))
          ) {
            storedBubble = parsed.bubblePoint as Point;
          }
          storedBubbleDismissed = parsed.bubbleDismissed === true;
          storedCollapsed = parsed.isCollapsed === true;
          const parsedUpdatedAtMs = Date.parse(parsed.updatedAt ?? "");
          storedUpdatedAtMs = Number.isFinite(parsedUpdatedAtMs) ? parsedUpdatedAtMs : 0;
        }
      } catch {
        // Invalid local layout data falls back to the default window position.
      }
      const initialRect = storedRect ? clampPanelRect(storedRect) : createDefaultPanelRect(sidebarExpanded);
      const initialBubblePoint = storedBubble
        ? clampBubblePoint(storedBubble)
        : clampBubblePoint({ x: initialRect.x + initialRect.width - BUBBLE_SIZE, y: initialRect.y });
      const initialCollapsed = !open && storedCollapsed && !storedBubbleDismissed;
      if (storedRect && storedBubble) {
        storedLayoutRef.current = {
          panelRect: initialRect,
          bubblePoint: initialBubblePoint,
          bubbleDismissed: storedBubbleDismissed,
          isCollapsed: initialCollapsed,
          updatedAtMs: storedUpdatedAtMs,
        };
      }
      panelRectRef.current = initialRect;
      bubblePointRef.current = initialBubblePoint;
      bubbleDismissedRef.current = storedBubbleDismissed;
      collapsedRef.current = initialCollapsed;
      setPanelRect(initialRect);
      setBubblePoint(initialBubblePoint);
      setBubbleDismissed(storedBubbleDismissed);
      setCollapsed(initialCollapsed);
      layoutReadyRef.current = true;
      return;
    }

    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      collapsedRef.current = false;
      setCollapsed(false);
      wasOpenRef.current = true;
    }

    setPanelRect((current) => {
      const next = current ? clampPanelRect(current) : createDefaultPanelRect(sidebarExpanded);
      panelRectRef.current = next;
      return next;
    });
    setBubblePoint((current) => {
      const next = current ? clampBubblePoint(current) : current;
      bubblePointRef.current = next;
      return next;
    });
  }, [layoutStorageKey, open, sidebarExpanded]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!layoutReadyRef.current || !serverLayoutLoaded || !panelRect || !bubblePoint) return;
    try {
      window.localStorage.setItem(layoutStorageKey, JSON.stringify({
        panelRect,
        bubblePoint,
        bubbleDismissed,
        isCollapsed: collapsed,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      // The layout remains usable even when browser storage is unavailable.
    }
  }, [bubbleDismissed, bubblePoint, collapsed, layoutStorageKey, panelRect, serverLayoutLoaded]);

  useEffect(() => {
    if (!layoutReadyRef.current) return;
    let cancelled = false;
    setServerLayoutLoaded(false);
    fetchAdminKurtiWindowLayout()
      .then((payload) => {
        if (cancelled) return;
        const serverUpdatedAtMs = Date.parse(payload.layout?.updatedAt ?? "");
        const storedLayout = storedLayoutRef.current;
        const useStoredLayout = Boolean(
          storedLayout
          && storedLayout.updatedAtMs > (Number.isFinite(serverUpdatedAtMs) ? serverUpdatedAtMs : 0),
        );
        if (payload.layout && !useStoredLayout) {
          const nextPanelRect = clampPanelRect(payload.layout.panel);
          const nextBubblePoint = clampBubblePoint(payload.layout.bubble);
          const nextBubbleDismissed = payload.layout.bubbleDismissed;
          const nextCollapsed = !openRef.current && payload.layout.isCollapsed && !nextBubbleDismissed;
          panelRectRef.current = nextPanelRect;
          bubblePointRef.current = nextBubblePoint;
          bubbleDismissedRef.current = nextBubbleDismissed;
          collapsedRef.current = nextCollapsed;
          setPanelRect(nextPanelRect);
          setBubblePoint(nextBubblePoint);
          setBubbleDismissed(nextBubbleDismissed);
          setCollapsed(nextCollapsed);
        } else if (storedLayout) {
          const nextCollapsed = !openRef.current && storedLayout.isCollapsed && !storedLayout.bubbleDismissed;
          panelRectRef.current = storedLayout.panelRect;
          bubblePointRef.current = storedLayout.bubblePoint;
          bubbleDismissedRef.current = storedLayout.bubbleDismissed;
          collapsedRef.current = nextCollapsed;
          setPanelRect(storedLayout.panelRect);
          setBubblePoint(storedLayout.bubblePoint);
          setBubbleDismissed(storedLayout.bubbleDismissed);
          setCollapsed(nextCollapsed);
        }
        serverLayoutLoadedRef.current = true;
        setServerLayoutLoaded(true);
      })
      .catch(() => {
        // Local layout remains available when the preference endpoint cannot be reached.
        if (!cancelled) {
          serverLayoutLoadedRef.current = true;
          setServerLayoutLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!serverLayoutLoaded || !panelRect || !bubblePoint) return;
    const timeoutId = window.setTimeout(() => {
      enqueueLayoutSave(createWindowLayoutInput(panelRect, bubblePoint, bubbleDismissed, collapsed));
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [bubbleDismissed, bubblePoint, collapsed, enqueueLayoutSave, panelRect, serverLayoutLoaded]);

  useEffect(() => {
    if (!open) return;
    const keepInsideViewport = () => {
      setPanelRect((current) => {
        const next = current ? clampPanelRect(current) : current;
        panelRectRef.current = next;
        return next;
      });
      setBubblePoint((current) => {
        const next = current ? clampBubblePoint(current) : current;
        bubblePointRef.current = next;
        return next;
      });
    };
    window.addEventListener("resize", keepInsideViewport);
    return () => window.removeEventListener("resize", keepInsideViewport);
  }, [open]);

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
        setCapabilityCount(payload.capabilities?.toolCount ?? 28);
        setMemoryMinutes(payload.capabilities?.memoryMinutes ?? 480);
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
    if (!open || collapsed) return;
    const focusId = window.setTimeout(() => textareaRef.current?.focus(), 220);
    return () => window.clearTimeout(focusId);
  }, [collapsed, open]);

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
      }, 100);
      return () => window.clearTimeout(finishId);
    }
    const chunkSize = Math.max(1, Math.ceil(typing.content.length / 520));
    const stepCount = Math.ceil(typing.content.length / chunkSize);
    const durationMs = Math.min(5_000, Math.max(1_200, typing.content.length * 4.5));
    const baseDelay = Math.max(8, Math.round(durationMs / stepCount));
    const nextLength = Math.min(typing.content.length, typing.visibleLength + chunkSize);
    const typedChunk = typing.content.slice(typing.visibleLength, nextLength);
    const delay = /[.!?,;:]\s*$/.test(typedChunk) ? baseDelay + 16 : baseDelay;
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

  const startPanelMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !panelRect) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setWindowInteracting(true);
    interactionRef.current = {
      kind: "move",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: panelRect,
    };
  }, [panelRect]);

  const startPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    if (event.button !== 0 || !panelRect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setWindowInteracting(true);
    interactionRef.current = {
      kind: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: panelRect,
      edge,
    };
  }, [panelRect]);

  const startBubbleMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !bubblePoint) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setWindowInteracting(true);
    interactionRef.current = {
      kind: "bubble",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPoint: bubblePoint,
      moved: false,
    };
  }, [bubblePoint]);

  const moveWindowInteraction = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.kind === "bubble") {
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) interaction.moved = true;
      const nextBubblePoint = clampBubblePoint({
        x: interaction.startPoint.x + deltaX,
        y: interaction.startPoint.y + deltaY,
      });
      bubblePointRef.current = nextBubblePoint;
      setBubblePoint(nextBubblePoint);
      return;
    }

    if (interaction.kind === "move") {
      const nextPanelRect = clampPanelRect({
        ...interaction.startRect,
        x: interaction.startRect.x + deltaX,
        y: interaction.startRect.y + deltaY,
      });
      panelRectRef.current = nextPanelRect;
      setPanelRect(nextPanelRect);
      return;
    }

    const { startRect, edge } = interaction;
    const viewportRight = window.innerWidth - PANEL_MARGIN;
    const viewportBottom = window.innerHeight - PANEL_MARGIN;
    const minimumWidth = Math.min(PANEL_MIN_WIDTH, viewportRight - PANEL_MARGIN);
    const minimumHeight = Math.min(PANEL_MIN_HEIGHT, viewportBottom - PANEL_MARGIN);
    let left = startRect.x;
    let top = startRect.y;
    let right = startRect.x + startRect.width;
    let bottom = startRect.y + startRect.height;

    if (edge.includes("e")) right = clamp(right + deltaX, left + minimumWidth, viewportRight);
    if (edge.includes("w")) left = clamp(left + deltaX, PANEL_MARGIN, right - minimumWidth);
    if (edge.includes("s")) bottom = clamp(bottom + deltaY, top + minimumHeight, viewportBottom);
    if (edge.includes("n")) top = clamp(top + deltaY, PANEL_MARGIN, bottom - minimumHeight);

    const nextPanelRect = { x: left, y: top, width: right - left, height: bottom - top };
    panelRectRef.current = nextPanelRect;
    setPanelRect(nextPanelRect);
  }, []);

  const endWindowInteraction = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.kind === "bubble" && interaction.moved && event.type === "pointerup") {
      ignoreBubbleClickRef.current = true;
    }
    interactionRef.current = null;
    setWindowInteracting(false);
    const currentPanelRect = panelRectRef.current;
    const currentBubblePoint = bubblePointRef.current;
    if (serverLayoutLoadedRef.current && currentPanelRect && currentBubblePoint) {
      enqueueLayoutSave(createWindowLayoutInput(
        currentPanelRect,
        currentBubblePoint,
        bubbleDismissedRef.current,
        collapsedRef.current,
      ));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [enqueueLayoutSave]);

  const collapsePanel = useCallback(() => {
    if (!panelRect || !bubblePoint) return;
    bubblePointRef.current = bubblePoint;
    bubbleDismissedRef.current = false;
    collapsedRef.current = true;
    setBubbleDismissed(false);
    setCollapsed(true);
    enqueueLayoutSave(createWindowLayoutInput(panelRect, bubblePoint, false, true));
  }, [bubblePoint, enqueueLayoutSave, panelRect]);

  const expandPanel = useCallback(() => {
    const currentPanelRect = panelRectRef.current;
    if (!bubblePoint || !currentPanelRect) return;
    onOpen();
    const nextPanelRect = clampPanelRect({
      ...currentPanelRect,
      x: bubblePoint.x + BUBBLE_SIZE - currentPanelRect.width,
      y: bubblePoint.y,
    });
    panelRectRef.current = nextPanelRect;
    setPanelRect(nextPanelRect);
    enqueueLayoutSave(createWindowLayoutInput(nextPanelRect, bubblePoint, false, false));
    bubbleDismissedRef.current = false;
    collapsedRef.current = false;
    setCollapsed(false);
  }, [bubblePoint, enqueueLayoutSave, onOpen]);

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
    setPendingVisualizationKind(inferVisualizationSkeletonKind(text));
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
      setPendingVisualizationKind(null);
    }
  }, [configured, input, loading, sending, typing]);

  const shouldRender = open || (serverLayoutLoaded && collapsed && !bubbleDismissed);
  if (!shouldRender || !panelRect || !bubblePoint) return null;

  const activeWindowRect = collapsed
    ? { x: bubblePoint.x, y: bubblePoint.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE }
    : panelRect;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: collapsed ? 115 : 110,
        top: activeWindowRect.y,
        left: activeWindowRect.x,
        width: activeWindowRect.width,
        height: activeWindowRect.height,
        transformOrigin: "top right",
        willChange: windowInteracting ? undefined : "top, left, width, height",
        transition: windowInteracting
          ? "none"
          : "top 340ms cubic-bezier(0.22,1,0.36,1), left 340ms cubic-bezier(0.22,1,0.36,1), width 340ms cubic-bezier(0.22,1,0.36,1), height 340ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <button
        type="button"
        aria-label="Admin-Kurti öffnen"
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        title="Admin-Kurti öffnen – ziehen zum Verschieben, Rechtsklick zum Ausblenden"
        onPointerDown={startBubbleMove}
        onPointerMove={moveWindowInteraction}
        onPointerUp={endWindowInteraction}
        onPointerCancel={endWindowInteraction}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          bubbleDismissedRef.current = true;
          setBubbleDismissed(true);
          enqueueLayoutSave(createWindowLayoutInput(panelRect, bubblePoint, true, true));
          onClose();
        }}
        onClick={() => {
          if (ignoreBubbleClickRef.current) {
            ignoreBubbleClickRef.current = false;
            return;
          }
          expandPanel();
        }}
        style={{
          position: "absolute",
          zIndex: 5,
          top: 0,
          right: 0,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          padding: 0,
          borderRadius: 999,
          border: "1px solid rgba(153,27,27,0.28)",
          display: "grid",
          placeItems: "center",
          color: "#ffffff",
          background: "linear-gradient(145deg, #ef4444 0%, #dc2626 56%, #b91c1c 100%)",
          boxShadow: "0 12px 30px rgba(185,28,28,0.3), inset 0 1px 0 rgba(255,255,255,0.28)",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
          opacity: collapsed ? 1 : 0,
          transform: collapsed ? "scale(1)" : "scale(0.72)",
          pointerEvents: collapsed ? "auto" : "none",
          transition: collapsed
            ? "opacity 150ms ease 90ms, transform 240ms cubic-bezier(0.22,1,0.36,1) 70ms"
            : "opacity 90ms ease, transform 160ms ease",
        }}
      >
        <MessageCircle size={23} strokeWidth={2.25} fill="rgba(255,255,255,0.12)" />
      </button>

    <aside
      id="admin-kurti-panel"
      aria-label="Admin-Kurti Chat"
      aria-hidden={collapsed}
      inert={collapsed ? true : undefined}
      style={{
        position: "absolute",
        zIndex: 1,
        inset: 0,
        width: "100%",
        height: "100%",
        borderRadius: collapsed ? 999 : 22,
        border: "1px solid rgba(15,23,42,0.1)",
        background: "rgba(255,255,255,0.88)",
        boxShadow: "0 26px 80px rgba(15,23,42,0.2), inset 0 1px 0 rgba(255,255,255,0.86)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        overflow: "hidden",
        isolation: "isolate",
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        transition: collapsed
          ? "opacity 110ms ease, border-radius 260ms ease"
          : "opacity 170ms ease 90ms, border-radius 300ms ease",
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
        onPointerDown={startPanelMove}
        onPointerMove={moveWindowInteraction}
        onPointerUp={endWindowInteraction}
        onPointerCancel={endWindowInteraction}
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
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
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
        <div className="admin-kurti-capabilities" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ height: 24, padding: "0 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(15,23,42,0.58)", background: "rgba(248,250,252,0.66)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 8.5, fontWeight: 750 }}>
            <Database size={11} /> {capabilityCount} Datenfunktionen
          </span>
          <span style={{ height: 24, padding: "0 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(15,23,42,0.58)", background: "rgba(248,250,252,0.66)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 8.5, fontWeight: 750 }}>
            <ShieldCheck size={11} /> Nur Lesen · {memoryMinutes >= 60 ? `${memoryMinutes / 60} Std.` : `${memoryMinutes} Min.`}
          </span>
        </div>
        <button
          type="button"
          onClick={collapsePanel}
          aria-label="Admin-Kurti einklappen"
          title="Als Chatblase einklappen"
          style={{
            width: 32,
            height: 32,
            flex: "0 0 32px",
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.09)",
            background: "rgba(248,250,252,0.76)",
            color: "rgba(15,23,42,0.6)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Minimize2 size={16} strokeWidth={2.1} />
        </button>
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
          const showCharts = !isUser && !isTypingMessage && Boolean(message.charts?.length);
          const showVisualizations = !isUser && !isTypingMessage && Boolean(message.visualizations?.length);
          const visibleContent = isTypingMessage ? typing.content.slice(0, typing.visibleLength) : message.content;
          return (
            <div
              key={message.id}
              aria-label={isTypingMessage ? message.content : undefined}
              style={{
                maxWidth: isUser ? "78%" : showCharts || showVisualizations ? "96%" : "88%",
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
              {isUser ? visibleContent : (
                <>
                  <AdminKurtiMarkdown content={visibleContent} isTyping={isTypingMessage} />
                  {showCharts ? message.charts?.map((chart, index) => (
                    <AdminKurtiChart key={`${message.id}-${index}-${chart.title}`} chart={chart} />
                  )) : null}
                  {showVisualizations ? message.visualizations?.map((visualization, index) => (
                    <AdminKurtiVisualization key={`${message.id}-${index}-${visualization.kind}-${visualization.title}`} visualization={visualization} />
                  )) : null}
                </>
              )}
            </div>
          );
        })}
        {sending ? (
          <>
            <TypingBubble label="Kurti analysiert" />
            {pendingVisualizationKind ? <AdminKurtiVisualizationSkeleton kind={pendingVisualizationKind} /> : null}
          </>
        ) : null}
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
      </div>

      {RESIZE_HANDLES.map(({ edge, style }) => (
        <div
          key={edge}
          className="admin-kurti-resize-handle"
          data-edge={edge}
          aria-hidden="true"
          onPointerDown={(event) => startPanelResize(event, edge)}
          onPointerMove={moveWindowInteraction}
          onPointerUp={endWindowInteraction}
          onPointerCancel={endWindowInteraction}
          style={{
            position: "absolute",
            zIndex: 20,
            touchAction: "none",
            ...style,
          }}
        />
      ))}

      <style jsx global>{`
        @container (max-width: 500px) { .admin-kurti-capabilities { display: none !important; } }
        .admin-kurti-message-scroll { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,0.14) transparent; }
        .admin-kurti-message-scroll::-webkit-scrollbar { width: 5px; }
        .admin-kurti-message-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(15,23,42,0.14); }
        .admin-kurti-resize-handle::after { content: ""; position: absolute; opacity: 0; background: rgba(220,38,38,0.38); transition: opacity 120ms ease; }
        .admin-kurti-resize-handle:hover::after { opacity: 1; }
        .admin-kurti-resize-handle[data-edge="n"]::after, .admin-kurti-resize-handle[data-edge="s"]::after { right: 8px; left: 8px; height: 2px; border-radius: 999px; }
        .admin-kurti-resize-handle[data-edge="n"]::after { top: 1px; } .admin-kurti-resize-handle[data-edge="s"]::after { bottom: 1px; }
        .admin-kurti-resize-handle[data-edge="e"]::after, .admin-kurti-resize-handle[data-edge="w"]::after { top: 8px; bottom: 8px; width: 2px; border-radius: 999px; }
        .admin-kurti-resize-handle[data-edge="e"]::after { right: 1px; } .admin-kurti-resize-handle[data-edge="w"]::after { left: 1px; }
        .admin-kurti-loading-dot { display: block; width: 5px; height: 5px; flex: 0 0 5px; border-radius: 999px; background: #dc2626; box-shadow: 0 0 0 1px rgba(185,28,28,0.08); animation: admin-kurti-dot 920ms cubic-bezier(0.4,0,0.2,1) infinite; }
        @keyframes admin-kurti-dot { 0%, 60%, 100% { opacity: 0.28; transform: translateY(0) scale(0.74); } 30% { opacity: 1; transform: translateY(-2px) scale(1); } }
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
    </div>
  );
}

function TypingBubble({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        width: "fit-content",
        minWidth: 54,
        height: 30,
        flex: "0 0 30px",
        alignSelf: "flex-start",
        boxSizing: "border-box",
        padding: "0 12px",
        borderRadius: "13px 13px 13px 5px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,250,252,0.58))",
        border: "1px solid rgba(220,38,38,0.13)",
        boxShadow: "0 4px 12px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.72)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
      }}
    >
      {[0, 1, 2].map((index) => (
        <span key={index} className="admin-kurti-loading-dot" style={{ animationDelay: `${index * 140}ms` }} />
      ))}
    </div>
  );
}
