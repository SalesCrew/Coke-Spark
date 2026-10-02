"use client";
import { useEffect, useState } from "react";

export function DecimalField({
  value,
  onChange,
  optional = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  optional?: boolean;
}) {
  const [text, setText] = useState(
      value === null ? "" : String(value).replace(".", ","),
    ),
    [focused, setFocused] = useState(false),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!focused)
      setText(value === null ? "" : String(value).replace(".", ","));
  }, [value, focused]);
  return (
    <input
      type="text"
      required={!optional}
      pattern="-?(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+)"
      inputMode="decimal"
      aria-invalid={invalid}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        if (!optional && text.trim() === "") { setInvalid(true); return; }
        const next =
          text.trim() === "" && optional
            ? null
            : Number(text.trim().replace(",", "."));
        if (next !== null && !Number.isFinite(next)) {
          setInvalid(true);
          return;
        }
        onChange(next);
        setFocused(false);
      }}
    />
  );
}
