"use client";

import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const RED = "#DC2626";
const CALENDAR_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export type AdminDropdownOption = {
  value: string;
  label: string;
  description?: string;
};

function parseDate(dateIso: string): Date {
  return new Date(`${dateIso}T12:00:00`);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdminDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  compact = false,
  searchable = false,
  disabled = false,
}: {
  value: string;
  options: AdminDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  compact?: boolean;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; openAbove: boolean; maxHeight: number } | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase("de-AT");
  const filteredOptions = normalizedQuery
    ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("de-AT").includes(normalizedQuery))
    : options;
  const active = value !== "all";
  const hasDescriptions = filteredOptions.some((option) => option.description);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const optionHeight = hasDescriptions ? 46 : 36;
    const desiredHeight = Math.min(300, 12 + (searchable ? 42 : 0) + Math.max(1, filteredOptions.length) * optionHeight);
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const roomAbove = rect.top - 8;
    const openAbove = roomBelow < Math.min(190, desiredHeight) && roomAbove > roomBelow;
    const maxHeight = Math.max(120, Math.min(desiredHeight, (openAbove ? roomAbove : roomBelow) - 4));
    const width = Math.max(rect.width, compact ? 164 : 220);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPosition({ top: openAbove ? rect.top - 4 : rect.bottom + 4, left, width, openAbove, maxHeight });
  }, [compact, filteredOptions.length, hasDescriptions, searchable]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleViewportChange = () => updatePosition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightedIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    if (searchable) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, options, searchable, value]);

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) setHighlightedIndex(Math.max(0, filteredOptions.length - 1));
  }, [filteredOptions.length, highlightedIndex]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((current) => filteredOptions.length ? (current + direction + filteredOptions.length) % filteredOptions.length : 0);
      return;
    }
    if (event.key === "Enter" && open && filteredOptions[highlightedIndex]) {
      event.preventDefault();
      choose(filteredOptions[highlightedIndex].value);
    }
  };

  const menu = !disabled && open && position && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label={ariaLabel}
      className="sm-plan-dropdown-menu"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        zIndex: 12000,
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        transform: position.openAbove ? "translateY(-100%)" : undefined,
      }}
    >
      {searchable ? (
        <label className="sm-plan-dropdown-search">
          <Search size={11} strokeWidth={2} color="rgba(0,0,0,.3)" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setHighlightedIndex(0); }}
            placeholder={`${placeholder} suchen…`}
          />
        </label>
      ) : null}
      <div className="sm-plan-dropdown-options">
        {filteredOptions.length ? filteredOptions.map((option, index) => {
          const selected = option.value === value;
          const highlighted = index === highlightedIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              className={`sm-plan-dropdown-option${selected ? " is-selected" : ""}${highlighted ? " is-highlighted" : ""}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => choose(option.value)}
            >
              <span style={{ minWidth: 0 }}>
                <span className="sm-plan-dropdown-option-label">{option.label}</span>
                {option.description ? <span className="sm-plan-dropdown-option-description">{option.description}</span> : null}
              </span>
              {selected ? <Check size={11} strokeWidth={2.5} color={RED} style={{ flexShrink: 0 }} /> : null}
            </button>
          );
        }) : <div className="sm-plan-dropdown-empty">Keine Treffer</div>}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ position: "relative", minWidth: 0, flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={disabled ? false : open}
        disabled={disabled}
        className={`sm-plan-dropdown-trigger${compact ? " is-compact" : ""}${active && compact ? " is-active" : ""}${open ? " is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown size={compact ? 10 : 11} strokeWidth={2} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .18s ease" }} />
      </button>
      {menu}
    </div>
  );
}

export function AdminDatePicker({
  value,
  onChange,
  ariaLabel,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  minDate?: string;
  maxDate?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseDate(value) : null;
  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [position, setPosition] = useState<{ top: number; left: number; openAbove: boolean } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 248;
    const estimatedHeight = 292;
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const roomAbove = rect.top - 8;
    const openAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPosition({ top: openAbove ? rect.top - 6 : rect.bottom + 6, left, openAbove });
  }, []);

  useEffect(() => {
    if (!open) return;
    const activeDate = value ? parseDate(value) : new Date();
    setViewYear(activeDate.getFullYear());
    setViewMonth(activeDate.getMonth());
    updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const handleViewportChange = () => updatePosition();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePosition, value]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let index = 0; index < startOffset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDate = (date: Date) => {
    const nextValue = toDateInputValue(date);
    if ((minDate && nextValue < minDate) || (maxDate && nextValue > maxDate)) return;
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const shiftMonth = (direction: -1 | 1) => {
    const next = new Date(viewYear, viewMonth + direction, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const displayValue = selectedDate
    ? new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(selectedDate)
    : "Datum wählen";
  const todayValue = toDateInputValue(today);
  const todayDisabled = Boolean((minDate && todayValue < minDate) || (maxDate && todayValue > maxDate));

  const panel = open && position && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${ariaLabel} auswählen`}
      className="sm-plan-calendar-panel"
      style={{
        position: "fixed",
        zIndex: 12000,
        top: position.top,
        left: position.left,
        width: 248,
        transform: position.openAbove ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="sm-plan-calendar-header">
        <button type="button" aria-label="Vorheriger Monat" onClick={() => shiftMonth(-1)} className="sm-plan-calendar-nav"><ChevronLeft size={13} strokeWidth={2}/></button>
        <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" aria-label="Nächster Monat" onClick={() => shiftMonth(1)} className="sm-plan-calendar-nav"><ChevronRight size={13} strokeWidth={2}/></button>
      </div>
      <div className="sm-plan-calendar-weekdays">
        {CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="sm-plan-calendar-grid">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const cellDate = new Date(viewYear, viewMonth, day, 12);
          const cellValue = toDateInputValue(cellDate);
          const isSelected = value === cellValue;
          const isToday = toDateInputValue(today) === cellValue;
          const disabled = Boolean((minDate && cellValue < minDate) || (maxDate && cellValue > maxDate));
          return <button
            key={cellValue}
            type="button"
            aria-label={new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(cellDate)}
            aria-pressed={isSelected}
            aria-current={isToday ? "date" : undefined}
            disabled={disabled}
            onClick={() => selectDate(cellDate)}
            className={`sm-plan-calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
          >{day}</button>;
        })}
      </div>
      <div className="sm-plan-calendar-footer">
        <button type="button" disabled={todayDisabled} onClick={() => selectDate(new Date())}>Heute</button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
        className={`sm-plan-date-trigger${open ? " is-open" : ""}`}
      >
        <span>{displayValue}</span>
        <Calendar size={12} strokeWidth={1.8}/>
      </button>
      {panel}
    </div>
  );
}

// Shared by planning (including its drawer) and dashboard; popovers are portalled to avoid clipping.
export function AdminFilterControlStyles() {
  return <style>{`
        .sm-plan-dropdown-trigger{width:100%;height:32px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(0,0,0,.10);border-radius:7px;outline:0;background:linear-gradient(to bottom,#fff,#fafafa);color:#374151;font-family:inherit;font-size:10.5px;font-weight:550;text-align:left;cursor:pointer;box-shadow:inset 0 1px .6px rgba(255,255,255,.9),0 1px 3px rgba(0,0,0,.03);transition:border-color .14s,box-shadow .14s,background .14s}
        .sm-plan-dropdown-trigger:hover{border-color:rgba(0,0,0,.16);background:#fff}
        .sm-plan-dropdown-trigger.is-open{border-color:rgba(0,0,0,.18);box-shadow:0 0 0 2px rgba(0,0,0,.04)}
        .sm-plan-dropdown-trigger:disabled{cursor:not-allowed;opacity:.52;background:rgba(0,0,0,.028);box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
        .sm-plan-dropdown-trigger.is-compact{width:auto;height:29px;padding:0 9px;font-size:10px;font-weight:600;color:rgba(0,0,0,.55);white-space:nowrap}
        .sm-plan-dropdown-trigger.is-compact.is-active{border-color:rgba(220,38,38,.22);background:rgba(220,38,38,.035);color:${RED}}
        .sm-plan-dropdown-menu{padding:4px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.08);border-radius:9px;background:rgba(255,255,255,.99);box-shadow:0 9px 28px rgba(0,0,0,.13),0 1px 4px rgba(0,0,0,.06);animation:smPlanDropdownIn .14s ease both}
        .sm-plan-dropdown-search{height:32px;margin-bottom:3px;padding:0 8px;display:flex;align-items:center;gap:7px;border-radius:6px;background:rgba(0,0,0,.035)}
        .sm-plan-dropdown-search:focus-within{box-shadow:0 0 0 2px rgba(0,0,0,.04)}
        .sm-plan-dropdown-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#1a1a1a;font-family:inherit;font-size:10px}
        .sm-plan-dropdown-options{min-height:0;flex:1;overflow-y:auto;scrollbar-width:none}
        .sm-plan-dropdown-options::-webkit-scrollbar{display:none}
        .sm-plan-dropdown-option{width:100%;min-height:31px;padding:6px 9px;display:flex;align-items:center;justify-content:space-between;gap:9px;border:0;border-radius:5px;background:transparent;color:#374151;font-family:inherit;text-align:left;cursor:pointer}
        .sm-plan-dropdown-option.is-highlighted{background:rgba(0,0,0,.028)}
        .sm-plan-dropdown-option.is-selected{background:rgba(220,38,38,.055);color:${RED}}
        .sm-plan-dropdown-option-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;font-weight:550}
        .sm-plan-dropdown-option.is-selected .sm-plan-dropdown-option-label{font-weight:650}
        .sm-plan-dropdown-option-description{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(0,0,0,.35);font-size:8.8px;font-weight:500}
        .sm-plan-dropdown-empty{padding:14px 10px;color:rgba(0,0,0,.34);font-size:10px;text-align:center}
        .sm-plan-date-trigger{width:100%;height:32px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(0,0,0,.10);border-radius:7px;outline:0;background:linear-gradient(to bottom,#fff,#fafafa);color:#374151;font-family:inherit;font-size:10.5px;font-weight:550;text-align:left;cursor:pointer;box-shadow:inset 0 1px .6px rgba(255,255,255,.9),0 1px 3px rgba(0,0,0,.03);transition:border-color .14s,box-shadow .14s,background .14s}
        .sm-plan-date-trigger:hover{border-color:rgba(0,0,0,.16);background:#fff}
        .sm-plan-date-trigger.is-open{border-color:rgba(0,0,0,.18);box-shadow:0 0 0 2px rgba(0,0,0,.04)}
        .sm-plan-date-trigger.is-readonly{cursor:default;background:rgba(0,0,0,.025);color:rgba(0,0,0,.48);box-shadow:inset 0 0 0 1px rgba(0,0,0,.015)}
        .sm-plan-date-trigger.is-readonly:hover{border-color:rgba(0,0,0,.10);background:rgba(0,0,0,.025)}
        .sm-plan-date-trigger svg{flex-shrink:0;color:rgba(0,0,0,.30)}
        .sm-plan-date-trigger.is-open svg{color:rgba(0,0,0,.58)}
        .sm-plan-calendar-panel{padding:12px 12px 9px;border:1px solid rgba(0,0,0,.07);border-radius:12px;background:rgba(255,255,255,.995);box-shadow:0 10px 32px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.06);user-select:none;animation:smPlanDropdownIn .14s ease both}
        .sm-plan-calendar-header{height:26px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;color:#1a1a1a;font-size:11.5px;font-weight:650;letter-spacing:-.01em}
        .sm-plan-calendar-nav{width:27px;height:27px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:rgba(0,0,0,.42);cursor:pointer;transition:background .12s,color .12s}
        .sm-plan-calendar-nav:hover{background:rgba(0,0,0,.05);color:#1a1a1a}
        .sm-plan-calendar-weekdays,.sm-plan-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr)}
        .sm-plan-calendar-weekdays{margin-bottom:4px}
        .sm-plan-calendar-weekdays span{padding-bottom:4px;color:rgba(0,0,0,.27);font-size:8.5px;font-weight:700;letter-spacing:.04em;text-align:center}
        .sm-plan-calendar-grid{gap:2px 0}
        .sm-plan-calendar-grid>span,.sm-plan-calendar-day{aspect-ratio:1}
        .sm-plan-calendar-day{width:100%;padding:0;border:0;border-radius:7px;background:transparent;color:#1a1a1a;font-family:inherit;font-size:10.5px;font-weight:450;cursor:pointer;transition:background .1s,color .1s,box-shadow .1s}
        .sm-plan-calendar-day:hover:not(:disabled):not(.is-selected){background:rgba(0,0,0,.045)}
        .sm-plan-calendar-day.is-today:not(.is-selected){background:rgba(220,38,38,.07);color:${RED};font-weight:650}
        .sm-plan-calendar-day.is-selected{background:linear-gradient(to bottom,#DC2626,#b91c1c);color:#fff;font-weight:650;box-shadow:inset 0 1px .6px rgba(255,255,255,.33),0 0 0 1px #a91b1b,0 1px 4px rgba(180,20,20,.14)}
        .sm-plan-calendar-day:disabled{color:rgba(0,0,0,.17);cursor:not-allowed}
        .sm-plan-calendar-footer{margin-top:8px;padding-top:8px;display:flex;justify-content:flex-end;border-top:1px solid rgba(0,0,0,.05)}
        .sm-plan-calendar-footer button{padding:2px 4px;border:0;background:transparent;color:${RED};font-family:inherit;font-size:9.5px;font-weight:650;cursor:pointer}
        .sm-plan-calendar-footer button:disabled{color:rgba(0,0,0,.20);cursor:not-allowed}
        @keyframes smPlanDropdownIn{from{opacity:0}to{opacity:1}}
        .sm-plan-dropdown-trigger:focus-visible,.sm-plan-date-trigger:focus-visible,.sm-plan-calendar-nav:focus-visible,.sm-plan-calendar-day:focus-visible,.sm-plan-dropdown-option:focus-visible{outline:2px solid rgba(0,0,0,.15);outline-offset:-2px}
        @media(prefers-reduced-motion:reduce){.sm-plan-dropdown-menu,.sm-plan-calendar-panel{animation:none}}
  `}</style>;
}
