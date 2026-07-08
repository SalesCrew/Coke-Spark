"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";

interface DashboardLockOverlayProps {
  title: string;
  text: string;
  inset?: number | string;
  compact?: boolean;
  zIndex?: number;
  tone?: "locked" | "loading" | "ready";
  variant?: "card" | "row";
}

export function DashboardLockOverlay({
  title,
  text,
  inset = 10,
  compact = false,
  zIndex = 8,
  tone = "locked",
  variant = "card",
}: DashboardLockOverlayProps) {
  const isReady = tone === "ready";
  const isLoading = tone === "loading";
  const isRow = variant === "row";
  const radius = isRow ? 13 : compact ? 12 : 14;
  const padding = isRow ? "10px 12px" : compact ? "12px" : "18px";
  const gap = isRow ? 4 : compact ? 5 : 7;
  const iconSize = isRow ? 15 : compact ? 16 : 20;
  const titleSize = isRow ? 10 : compact ? 10 : 11;
  const textSize = isRow ? 8.5 : compact ? 9 : 10;
  const textWidth = isRow ? 260 : compact ? 220 : 270;
  const blur = isRow ? 7 : 9;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset,
        zIndex,
        borderRadius: radius,
        border: isReady ? "1px solid rgba(5,150,105,0.13)" : "1px solid rgba(15,23,42,0.07)",
        background: isReady
          ? "linear-gradient(180deg, rgba(236,253,245,0.78), rgba(255,255,255,0.66))"
          : "rgba(255,255,255,0.66)",
        boxShadow: isReady
          ? "inset 0 1px 0 rgba(255,255,255,0.76), 0 14px 30px rgba(5,150,105,0.08)"
          : "inset 0 1px 0 rgba(255,255,255,0.72), 0 12px 30px rgba(15,23,42,0.06)",
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        display: "grid",
        placeItems: "center",
        padding,
        pointerEvents: "auto",
        cursor: isLoading ? "wait" : "default",
        animation: isReady ? "gmGateReadyFade 2s ease forwards" : undefined,
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap, textAlign: "center", width: "100%" }}>
        {isReady ? (
          <Check
            size={iconSize}
            strokeWidth={2}
            color="rgba(5,150,105,0.74)"
            style={{ filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.72))" }}
          />
        ) : (
          <Lock
            size={iconSize}
            strokeWidth={1.8}
            color={isLoading ? "rgba(15,23,42,0.34)" : "rgba(15,23,42,0.28)"}
            style={{
              filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.72))",
              animation: isLoading ? "gmGateLockSpin 1.1s linear infinite" : undefined,
            }}
          />
        )}
        <div style={{ fontSize: titleSize, fontWeight: 800, color: isReady ? "rgba(5,120,85,0.72)" : "rgba(15,23,42,0.52)", letterSpacing: "0.01em", lineHeight: 1.1 }}>
          {title}
        </div>
        {!isRow ? (
          <div style={{ maxWidth: textWidth, fontSize: textSize, fontWeight: 650, color: "rgba(15,23,42,0.36)", lineHeight: 1.35 }}>
            {text}
          </div>
        ) : null}
      </div>
      <style jsx>{`
        @keyframes gmGateLockSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes gmGateReadyFade {
          0%,
          48% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.992);
          }
        }
      `}</style>
    </div>
  );
}

interface DashboardGateOverlayProps {
  loading: boolean;
  locked: boolean;
  lockTitle: string;
  lockText: string;
  loadingText?: string;
  readyTitle?: string;
  readyText?: string;
  inset?: number | string;
  compact?: boolean;
  zIndex?: number;
  variant?: "card" | "row";
}

export function DashboardGateOverlay({
  loading,
  locked,
  lockTitle,
  lockText,
  loadingText = "Lade Arbeitstag",
  readyTitle = "Arbeitstag geladen",
  readyText = "Du kannst jetzt fortfahren.",
  inset,
  compact,
  zIndex,
  variant,
}: DashboardGateOverlayProps) {
  const [dotIndex, setDotIndex] = useState(0);
  const [showReady, setShowReady] = useState(false);
  const hadLoadingRef = useRef(loading);

  useEffect(() => {
    if (!loading) return undefined;
    const id = window.setInterval(() => {
      setDotIndex((value) => (value + 1) % 3);
    }, 420);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (hadLoadingRef.current && !loading && !locked) {
      setShowReady(true);
      const id = window.setTimeout(() => setShowReady(false), 2000);
      hadLoadingRef.current = loading;
      return () => window.clearTimeout(id);
    }
    hadLoadingRef.current = loading;
    return undefined;
  }, [loading, locked]);

  if (loading) {
    const dots = ".".repeat(dotIndex + 1);
    return (
      <DashboardLockOverlay
        title={`${loadingText}${dots}`}
        text="Bitte kurz warten, wir prüfen deinen Arbeitstag."
        tone="loading"
        inset={inset}
        compact={compact}
        zIndex={zIndex}
        variant={variant}
      />
    );
  }

  if (locked) {
    return (
      <DashboardLockOverlay
        title={lockTitle}
        text={lockText}
        tone="locked"
        inset={inset}
        compact={compact}
        zIndex={zIndex}
        variant={variant}
      />
    );
  }

  if (showReady) {
    return (
      <DashboardLockOverlay
        title={readyTitle}
        text={readyText}
        tone="ready"
        inset={inset}
        compact={compact}
        zIndex={zIndex}
        variant={variant}
      />
    );
  }

  return null;
}
