"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type IppMiniDropdownOption = {
  value: string;
  label: string;
};

type IppMiniDropdownProps = {
  label?: string;
  value: string | null;
  placeholder: string;
  options: IppMiniDropdownOption[];
  minWidth?: number;
  onChange: (value: string | null) => void;
};

export function IppMiniDropdown({
  label,
  value,
  placeholder,
  options,
  minWidth = 140,
  onChange,
}: IppMiniDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      `}</style>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
          {label}
        </div>
      )}
      <button
        className="ipp-mini-dropdown-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          borderRadius: 9,
          border: "none",
          background: "linear-gradient(to bottom,#fff,#f5f5f5)",
          color: "#111827",
          fontSize: 12,
          fontWeight: 700,
          padding: "8px 10px",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          boxShadow: open
            ? "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08), 0 0 0 3px rgba(220,38,38,0.08)"
            : "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
          transition: "all 0.14s ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#111827" : "rgba(0,0,0,0.42)" }}>
          {selected?.label ?? placeholder}
        </span>
        <span style={{ color: "rgba(0,0,0,0.45)", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>
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
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          <button
            className="ipp-mini-dropdown-option"
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 7,
              background: value == null ? "rgba(0,0,0,0.08)" : "transparent",
              color: value == null ? "#111827" : "rgba(0,0,0,0.66)",
              fontSize: 11,
              fontWeight: 700,
              textAlign: "left",
              padding: "8px 9px",
              cursor: "pointer",
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                className="ipp-mini-dropdown-option"
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 7,
                  background: active ? "rgba(0,0,0,0.08)" : "transparent",
                  color: active ? "#111827" : "rgba(0,0,0,0.66)",
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: "left",
                  padding: "8px 9px",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
