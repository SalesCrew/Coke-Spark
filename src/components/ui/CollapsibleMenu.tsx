"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Home, Clock, User, LogOut } from "lucide-react";

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHolding = useRef(false);

  const collapsedHeight = ITEM_HEIGHT + CARD_PADDING * 2;
  const expandedHeight = items.length * ITEM_HEIGHT + CARD_PADDING * 2;

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const getIndexFromY = useCallback(
    (clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top - CARD_PADDING;
      const idx = Math.floor(y / ITEM_HEIGHT);
      if (idx >= 0 && idx < items.length) return idx;
      return null;
    },
    [items.length]
  );

  const select = useCallback(
    (index: number | null) => {
      setExpanded(false);
      setHoveredIndex(null);
      isHolding.current = false;
      if (index !== null) {
        const selectedItem = items[index];
        onSelect?.(index, selectedItem);

        if (selectedItem.action === "logout") {
          if (!onSelect && typeof onLogout === "function") {
            onLogout();
          }
          return;
        }

        if (index !== activeIndex) {
          setActiveIndex(index);
        }
      }
    },
    [activeIndex, items, onLogout, onSelect]
  );

  // --- Mouse ---
  const onMouseDown = useCallback(() => {
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold]);

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
    isHolding.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (isHolding.current) {
        setExpanded(true);
      }
    }, HOLD_DELAY);
  }, [clearHold]);

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
      clearHold();
      const touch = e.changedTouches[0];
      const idx = getIndexFromY(touch.clientY);
      select(idx);
    },
    [clearHold, getIndexFromY, select]
  );

  useEffect(() => clearHold, [clearHold]);

  const displayIndex = expanded && hoveredIndex !== null ? hoveredIndex : activeIndex;

  return (
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
            paddingTop: CARD_PADDING,
            paddingBottom: CARD_PADDING,
            transform: expanded
              ? "translateY(0)"
              : `translateY(-${activeIndex * ITEM_HEIGHT}px)`,
          }}
        >
          {items.map((item, i) => {
            const isSelected = i === displayIndex;
            const isDanger = item.tone === "danger" || item.action === "logout";
            const isNew = item.isNew === true;
            const dangerSoftBackground = "linear-gradient(180deg, rgba(254,242,242,0.96), rgba(254,226,226,0.94))";
            const dangerSoftShadow = "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(220,38,38,0.16), 0 1px 4px rgba(185,28,28,0.1)";
            const newSoftBackground = "linear-gradient(90deg, rgba(220,38,38,0.075) 0%, rgba(220,38,38,0.035) 38%, rgba(255,255,255,0.18) 100%)";

            return (
              <div
                key={item.label}
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
                  backgroundColor: isSelected
                    ? undefined
                    : "transparent",
                  background: isSelected
                    ? "linear-gradient(to bottom, #DC2626, #e84040)"
                    : isDanger
                      ? dangerSoftBackground
                    : isNew
                      ? newSoftBackground
                    : undefined,
                  boxShadow: isSelected
                    ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)"
                    : isDanger
                      ? dangerSoftShadow
                    : isNew
                      ? "inset 0 1px 0 rgba(255,255,255,0.72), 0 0 0 1px rgba(220,38,38,0.055)"
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
                {isNew && (
                  <span
                    style={{
                      position: "absolute",
                      right: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      borderRadius: 999,
                      padding: "1px 5px",
                      fontSize: 7.5,
                      lineHeight: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.015em",
                      color: isSelected ? "rgba(255,255,255,0.92)" : "rgba(220,38,38,0.68)",
                      background: isSelected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)",
                      boxShadow: isSelected
                        ? "inset 0 0 0 1px rgba(255,255,255,0.18)"
                        : "inset 0 0 0 1px rgba(220,38,38,0.08)",
                      pointerEvents: "none",
                    }}
                  >
                    Neu
                  </span>
                )}
              </div>
            );
          })}
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
  );
}
