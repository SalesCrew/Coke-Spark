"use client";

import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import styles from "./praemien.module.css";

type Option = { value: string; label: string; disabled: boolean };
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== "option") return optionsFrom(child.props.children);
    return [{ value: String(child.props.value ?? ""), label: Children.toArray(child.props.children).join(""), disabled: !!child.props.disabled }];
  });
}

/** Shared Coke Spark control; popup stays inside the dialog's DOM/focus boundary. */
export function BoniSelect({ value, children, onChange, disabled = false, "aria-label": label }: {
  value: string | number;
  children: ReactNode;
  onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const options = optionsFrom(children), selected = options.find((o) => o.value === String(value));
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [name, setName] = useState(label);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number }>({ left: 0, top: 0, width: 200, maxHeight: 260 });
  const visible = options.filter((o) => o.label.toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")));
  useEffect(() => {
    if (label) return;
    const parent = root.current?.closest("label");
    setName(parent ? Array.from(parent.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim() : "Auswahl");
  }, [label]);
  useLayoutEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(options.length > 8 ? "input" : '[aria-selected="true"], [role="option"]:not(:disabled)')?.focus({ preventScroll: true });
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const scroll = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, options.length]);
  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
    const flip = below < 180 && above > below;
    const estimated = options.length * 37 + 10 + (options.length > 8 ? 46 : 0);
    const height = Math.min(300, estimated, flip ? above : below);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: flip ? undefined : rect.bottom + 6, bottom: flip ? window.innerHeight - rect.top + 6 : undefined, width, maxHeight: height });
    setQuery(""); setOpen(true);
  }
  function choose(o: Option) {
    if (o.disabled) return;
    onChange({ target: { value: o.value } }); setOpen(false); trigger.current?.focus({ preventScroll: true });
  }
  return <div ref={root} className={styles.selectRoot} onKeyDown={(e) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    if (e.key === "Tab" && open) { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    if (!open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const rows = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
    if (!rows.length) return;
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : index < 0 ? (e.key === "ArrowDown" ? 0 : rows.length - 1) : (index + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
    const row = rows[next];
    row?.focus({ preventScroll: true });
    const list = row?.parentElement;
    if (row && list) {
      const bounds = list.getBoundingClientRect(), item = row.getBoundingClientRect();
      if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
      else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
    }
  }}>
    <button ref={trigger} type="button" className={styles.selectTrigger} role="combobox" aria-label={name} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox" disabled={disabled} onClick={() => open ? setOpen(false) : show()} onKeyDown={(e) => {
      if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); show(); }
    }} title={selected?.label}>
      <span>{selected?.label || "Auswählen …"}</span><ChevronDown size={14} className={open ? styles.rotated : undefined} />
    </button>
    {open && <div className={styles.selectPopup} style={position}>
      {options.length > 8 && <div className={styles.selectSearch}><Search size={14} /><input aria-label={`${name} suchen`} placeholder="Suchen …" value={query} onChange={(e) => setQuery(e.target.value)} /></div>}
      <div id={id} role="listbox" aria-label={name} className={styles.selectOptions}>
        {visible.map((o) => <button key={o.value} type="button" role="option" tabIndex={-1} aria-selected={o.value === String(value)} disabled={o.disabled} className={styles.selectOption} onClick={() => choose(o)}><span>{o.label}</span>{o.value === String(value) && <Check size={14} />}</button>)}
        {!visible.length && <p className={styles.listEmpty}>Keine Treffer</p>}
      </div>
    </div>}
  </div>;
}
