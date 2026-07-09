"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchGmTextSettings, updateGmTextSettings } from "@/lib/api/backend";

const STORAGE_KEY = "coke-spark:gm-text-scale-percent";
const MIN_PERCENT = 0;
const MAX_PERCENT = 50;
const EFFECTIVE_SCALE_FACTOR = 0.8;

type GmTextScaleContextValue = {
  percent: number;
  previewPercent: number;
  scale: number;
  setPercent: (value: number) => void;
  setPreviewPercent: (value: number) => void;
  commitPreviewPercent: (value?: number) => void;
  resetPreviewPercent: () => void;
};

const GmTextScaleContext = createContext<GmTextScaleContextValue>({
  percent: 0,
  previewPercent: 0,
  scale: 1,
  setPercent: () => undefined,
  setPreviewPercent: () => undefined,
  commitPreviewPercent: () => undefined,
  resetPreviewPercent: () => undefined,
});

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}

function parseFontSize(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isScalableTextElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest("[data-gm-text-scale-ignore='true']")) return false;

  const tagName = element.tagName.toLowerCase();
  if (
    tagName === "svg" ||
    tagName === "path" ||
    tagName === "img" ||
    tagName === "video" ||
    tagName === "canvas" ||
    tagName === "picture" ||
    tagName === "source" ||
    tagName === "br"
  ) {
    return false;
  }

  return true;
}

export function useGmTextScale() {
  return useContext(GmTextScaleContext);
}

export function GmTextScaleProvider({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const serverLoadedRef = useRef(false);
  const [percent, setPercentState] = useState(0);
  const [previewPercent, setPreviewPercentState] = useState(0);

  const scale = useMemo(() => 1 + (percent * EFFECTIVE_SCALE_FACTOR) / 100, [percent]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const storedPercent = clampPercent(Number(stored));
        setPercentState(storedPercent);
        setPreviewPercentState(storedPercent);
      }
    } catch {
      // Local storage is a convenience only; the app must work without it.
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchGmTextSettings()
      .then((settings) => {
        if (!active) return;
        const serverPercent = clampPercent(settings.textScalePercent);
        setPercentState(serverPercent);
        setPreviewPercentState(serverPercent);
        serverLoadedRef.current = true;
      })
      .catch(() => {
        serverLoadedRef.current = true;
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(percent));
    } catch {
      // Ignore private-mode/storage failures.
    }
  }, [percent]);

  useEffect(() => {
    if (!serverLoadedRef.current) return;

    const timer = window.setTimeout(() => {
      updateGmTextSettings({ textScalePercent: percent }).catch(() => {
        // Local storage remains the fallback if the network is unavailable.
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [percent]);

  const setPercent = useCallback((value: number) => {
    const nextPercent = clampPercent(value);
    setPercentState(nextPercent);
    setPreviewPercentState(nextPercent);
  }, []);

  const setPreviewPercent = useCallback((value: number) => {
    setPreviewPercentState(clampPercent(value));
  }, []);

  const commitPreviewPercent = useCallback((value?: number) => {
    const nextPercent = clampPercent(value ?? previewPercent);
    setPercentState(nextPercent);
    setPreviewPercentState(nextPercent);
  }, [previewPercent]);

  const resetPreviewPercent = useCallback(() => {
    setPreviewPercentState(percent);
  }, [percent]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frameId = 0;

    const applyToElement = (element: HTMLElement) => {
      const computedSize = parseFontSize(window.getComputedStyle(element).fontSize);
      if (!computedSize) return;

      if (!element.dataset.gmOriginalFontSize) {
        element.dataset.gmOriginalFontSize = element.style.fontSize || "__empty__";
      }

      if (!element.dataset.gmBaseFontSize) {
        const originalInline = element.dataset.gmOriginalFontSize;
        const inlineSize =
          originalInline && originalInline !== "__empty__" ? parseFontSize(originalInline) : null;
        const inheritedBase = percent > 0 && !inlineSize ? computedSize / scale : computedSize;
        element.dataset.gmBaseFontSize = String(inlineSize ?? inheritedBase);
      }

      if (percent <= 0) {
        const original = element.dataset.gmOriginalFontSize;
        element.style.fontSize = original && original !== "__empty__" ? original : "";
        delete element.dataset.gmScaledFont;
        return;
      }

      const baseSize = Number(element.dataset.gmBaseFontSize);
      if (!Number.isFinite(baseSize) || baseSize <= 0) return;

      element.style.fontSize = `${baseSize * scale}px`;
      element.dataset.gmScaledFont = "true";
    };

    const applyScale = () => {
      frameId = 0;
      root.style.setProperty("--gm-text-scale", String(scale));

      if (isScalableTextElement(root)) {
        applyToElement(root);
      }

      root.querySelectorAll("*").forEach((element) => {
        if (isScalableTextElement(element)) {
          applyToElement(element);
        }
      });
    };

    const scheduleApply = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(applyScale);
    };

    scheduleApply();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [percent, scale]);

  const value = useMemo<GmTextScaleContextValue>(
    () => ({
      percent,
      previewPercent,
      scale,
      setPercent,
      setPreviewPercent,
      commitPreviewPercent,
      resetPreviewPercent,
    }),
    [commitPreviewPercent, percent, previewPercent, resetPreviewPercent, scale, setPercent, setPreviewPercent],
  );

  return (
    <GmTextScaleContext.Provider value={value}>
      <div ref={rootRef} data-gm-text-scale-root style={{ minHeight: "100%" }}>
        {children}
      </div>
    </GmTextScaleContext.Provider>
  );
}
