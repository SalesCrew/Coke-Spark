"use client";

import { useLayoutEffect, useRef } from "react";
import { formatSmTravelTimeEdit } from "@/lib/sm/travelTimeInput";

export function SmTravelTimeInput({ value, onValueChange, className, label = "Fahrtzeit in Stunden und Minuten" }: {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursorRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
    cursorRef.current = null;
  }, [value]);

  return <input
    ref={inputRef}
    type="text"
    value={value}
    onChange={(event) => {
      const input = event.currentTarget;
      const next = formatSmTravelTimeEdit(input.value, value, input.selectionStart ?? input.value.length);
      cursorRef.current = next.cursor;
      onValueChange(next.value);
      // A filtered character may leave the controlled value unchanged (no rerender).
      if (next.value === value) {
        input.value = next.value;
        input.setSelectionRange(next.cursor, next.cursor);
        cursorRef.current = null;
      }
    }}
    inputMode="numeric"
    pattern="[0-9:]*"
    maxLength={5}
    autoComplete="off"
    spellCheck={false}
    placeholder="HH:MM"
    aria-label={label}
    className={className}
  />;
}
