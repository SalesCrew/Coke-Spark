"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type IppMiniDropdownOption = {
  value: string;
  label: string;
  searchText?: string;
};

type IppMiniDropdownProps = {
  label?: string;
  value: string | null;
  placeholder: string;
  options: IppMiniDropdownOption[];
  minWidth?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onChange: (value: string | null) => void;
};

const OPTION_ROW_H = 34;
const OPTION_OVERSCAN = 6;

export function IppMiniDropdown({
  label,
  value,
  placeholder,
  options,
  minWidth = 140,
  searchable = false,
  searchPlaceholder = "Suchen...",
  onChange,
}: IppMiniDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [optionsViewportHeight, setOptionsViewportHeight] = useState(176);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionsViewportRef = useRef<HTMLDivElement | null>(null);
  const isStcDropdown = label?.trim().toLowerCase() === "stc";

  const optionToneClass = (optionValue: string | null): string => {
    if (!isStcDropdown || !optionValue) return "";
    const normalized = optionValue.trim().toLowerCase();
    if (normalized === "gold") return "ipp-mini-dropdown-option--gold";
    if (normalized === "silver") return "ipp-mini-dropdown-option--silver";
    if (normalized === "bronze") return "ipp-mini-dropdown-option--bronze";
    return "";
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearchQuery(searchQuery), 120);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) return;
    const viewport = optionsViewportRef.current;
    if (!viewport) return;
    setOptionsViewportHeight(viewport.clientHeight || 176);
    const onScroll = () => setScrollTop(viewport.scrollTop);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => setOptionsViewportHeight(viewport.clientHeight || 176));
    ro.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionsViewportRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [debouncedSearchQuery, open, options]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);
  const indexedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        _searchBlob: `${option.label} ${option.searchText ?? ""}`.toLowerCase(),
      })),
    [options],
  );
  const visibleOptions = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return indexedOptions;
    return indexedOptions.filter((option) => option._searchBlob.includes(q));
  }, [debouncedSearchQuery, indexedOptions]);
  const virtualStartIndex = Math.max(0, Math.floor(scrollTop / OPTION_ROW_H) - OPTION_OVERSCAN);
  const virtualEndIndex = Math.min(
    visibleOptions.length,
    Math.ceil((scrollTop + optionsViewportHeight) / OPTION_ROW_H) + OPTION_OVERSCAN,
  );
  const virtualPaddingTop = virtualStartIndex * OPTION_ROW_H;
  const virtualPaddingBottom = Math.max(0, (visibleOptions.length - virtualEndIndex) * OPTION_ROW_H);
  const virtualOptions = visibleOptions.slice(virtualStartIndex, virtualEndIndex);

  return (
    <div ref={containerRef} style={{ minWidth, position: "relative" }}>
      <style>{`
        .ipp-mini-dropdown-trigger:hover {
          box-shadow: inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.09) !important;
          transform: translateY(-1px);
        }
        .ipp-mini-dropdown-option:hover {
          background: rgba(0,0,0,0.06) !important;
          color: #111827 !important;
        }
        .ipp-mini-dropdown-option.ipp-mini-dropdown-option--gold:hover {
          background: rgba(234,179,8,0.22) !important;
          color: #92400e !important;
        }
        .ipp-mini-dropdown-option.ipp-mini-dropdown-option--silver:hover {
          background: rgba(148,163,184,0.24) !important;
          color: #334155 !important;
        }
        .ipp-mini-dropdown-option.ipp-mini-dropdown-option--bronze:hover {
          background: rgba(180,83,9,0.20) !important;
          color: #9a3412 !important;
        }
        .ipp-mini-dropdown-options-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ipp-mini-dropdown-options-viewport::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {label && (
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
          {label}
        </div>
      )}
      <button
        className="ipp-mini-dropdown-trigger"
        type="button"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              setSearchQuery("");
              setDebouncedSearchQuery("");
            }
            return next;
          });
        }}
        style={{
          width: "100%",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(to bottom,#fff,#f5f5f5)",
          color: "#111827",
          fontSize: 11,
          fontWeight: 700,
          padding: "6px 9px",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          cursor: "pointer",
          boxShadow: open
            ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)"
            : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          transition: "all 0.14s ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#111827" : "rgba(0,0,0,0.42)" }}>
          {selected?.label ?? placeholder}
        </span>
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: "auto",
            marginTop: 4,
            width: "max-content",
            minWidth,
            maxWidth: Math.max(minWidth, 320),
            zIndex: 70,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "#fff",
            boxShadow: "0 14px 32px rgba(0,0,0,0.15)",
            padding: 4,
          }}
        >
          {searchable && (
            <div style={{ padding: "2px 4px 6px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: "100%",
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,0.09)",
                  padding: "7px 9px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#111827",
                  outline: "none",
                  background: "#ffffff",
                  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.95)",
                }}
              />
            </div>
          )}
          <button
            className={`ipp-mini-dropdown-option ${optionToneClass(null)}`.trim()}
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            style={{
              width: "100%",
              minHeight: OPTION_ROW_H,
              border: "none",
              borderRadius: 7,
              background: value == null ? "rgba(0,0,0,0.08)" : "transparent",
              color: value == null ? "#111827" : "rgba(0,0,0,0.66)",
              fontSize: 11,
              fontWeight: 700,
              textAlign: "left",
              padding: "8px 9px",
              cursor: "pointer",
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            {placeholder}
          </button>
          <div
            ref={optionsViewportRef}
            className="ipp-mini-dropdown-options-viewport"
            style={{
              maxHeight: searchable ? 176 : 230,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <div style={{ paddingTop: virtualPaddingTop, paddingBottom: virtualPaddingBottom }}>
              {virtualOptions.map((option) => {
                const active = option.value === value;
                return (
                  <div
                    key={option.value}
                    style={{
                      height: OPTION_ROW_H,
                      display: "flex",
                      alignItems: "center",
                      paddingTop: 1,
                      paddingBottom: 1,
                    }}
                  >
                    <button
                      className={`ipp-mini-dropdown-option ${optionToneClass(option.value)}`.trim()}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        borderRadius: 7,
                        background: active ? "rgba(0,0,0,0.08)" : "transparent",
                        color: active ? "#111827" : "rgba(0,0,0,0.66)",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "left",
                        padding: "8px 9px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {option.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {visibleOptions.length === 0 && (
            <div
              style={{
                padding: "9px 10px",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(0,0,0,0.42)",
              }}
            >
              Keine Ergebnisse
            </div>
          )}
        </div>
      )}
    </div>
  );
}
