"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { QuestionType } from "@/types/fragebogen";
import { QUESTION_TYPES, typeLabel } from "@/utils/fragebogen";

interface QuestionTypeContextMenuProps {
  x: number;
  y: number;
  currentType: QuestionType;
  onSelect: (type: QuestionType) => void;
  onClose: () => void;
}

export function QuestionTypeContextMenu({ x, y, currentType, onSelect, onClose }: QuestionTypeContextMenuProps) {
  const options = useMemo(() => QUESTION_TYPES.filter((entry) => entry.key !== currentType), [currentType]);

  useEffect(() => {
    const handleMouseDown = () => onClose();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const menuWidth = 220;
  const menuHeight = Math.min(320, options.length * 34 + 14);
  const left = Math.max(8, Math.min(x, Math.max(8, viewportWidth - menuWidth - 8)));
  const top = Math.max(8, Math.min(y, Math.max(8, viewportHeight - menuHeight - 8)));

  return createPortal(
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: menuWidth,
        backgroundColor: "#ffffff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 10,
        boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
        padding: 6,
        zIndex: 9999,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {options.map((entry) => (
        <button
          key={entry.key}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(entry.key);
          }}
          style={{
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            color: "#111827",
            cursor: "pointer",
          }}
          onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = "rgba(220,38,38,0.08)")}
          onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = "transparent")}
        >
          {typeLabel(entry.key)}
        </button>
      ))}
    </div>,
    document.body,
  );
}
