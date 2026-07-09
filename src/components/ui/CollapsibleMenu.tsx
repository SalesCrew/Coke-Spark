"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, Clock, Home, LogOut, SlidersHorizontal, Type, User } from "lucide-react";
import { useGmTextScale } from "@/components/dashboard/GmTextScaleProvider";

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
}

const HOLD_DELAY = 300;
const ITEM_HEIGHT = 30;
const CARD_PADDING = 5;
const SETTINGS_PANEL_HEIGHT = 104;
const TEXT_SCALE_EFFECTIVE_FACTOR = 0.8;

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
}: CollapsibleMenuProps) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
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
      { type: "settings" as const },
      ...mapped.slice(logoutRowIndex),
    ];
  }, [items]);

  const collapsedHeight = ITEM_HEIGHT + CARD_PADDING * 2;
  const activeRowIndex = Math.max(
    0,
    rows.findIndex((row) => row.type === "item" && row.itemIndex === activeIndex)
  );
  const expandedHeight = settingsOpen
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
      if (settingsOpen) return null;
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top - CARD_PADDING;
      const idx = Math.floor(y / ITEM_HEIGHT);
      if (idx >= 0 && idx < rows.length) return idx;
      return null;
    },
    [rows.length, settingsOpen]
  );

  const select = useCallback(
    (rowIndex: number | null) => {
      setHoveredIndex(null);
      isHolding.current = false;

      if (rowIndex === null) {
        setExpanded(false);
        setSettingsOpen(false);
        return;
      }

      const selectedRow = rows[rowIndex];
      if (!selectedRow) {
        setExpanded(false);
        setSettingsOpen(false);
        return;
      }

      if (selectedRow.type === "settings") {
        setExpanded(true);
        setSettingsOpen(true);
        return;
      }

      const selectedItem = selectedRow.item;
      const selectedIndex = selectedRow.itemIndex;
      setExpanded(false);
      setSettingsOpen(false);
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
    if (settingsOpen) return;
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold, settingsOpen]);

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
    if (settingsOpen) return;
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold, settingsOpen]);

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

      <div className="relative mx-auto px-6" style={{ maxWidth: 420 }}>
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          "relative w-full overflow-hidden select-none",
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
            display: "flex",
            transform: settingsOpen
              ? "translateX(-50%)"
              : expanded
                ? "translateX(0) translateY(0)"
                : `translateX(0) translateY(-${activeRowIndex * ITEM_HEIGHT}px)`,
          }}
        >
          <div style={{ width: "50%", paddingTop: CARD_PADDING, paddingBottom: CARD_PADDING }}>
            {rows.map((row, i) => {
              const item =
                row.type === "settings"
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
                  key={row.type === "settings" ? "gm-text-settings" : item.label}
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
              padding: "10px 12px 11px",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
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
    </>
  );
}
