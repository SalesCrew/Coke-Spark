"use client";

import {
  AlertCircle,
  Ban,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
  RotateCcw,
  RefreshCw,
  Search,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  cancelSmPlanningAssignment,
  createSmPlanningAssignment,
  createSmPlanningSeries,
  fetchSmMarkets,
  fetchSmGlobalQuestionnaireConfiguration,
  fetchSmPlanningAssignments,
  fetchSmUsers,
  previewSmPlanningReassignment,
  reassignSmPlanningAssignment,
  rescheduleSmPlanningAssignment,
  restoreSmPlanningAssignment,
  updateSmPlanningAssignment,
  updateSmGlobalQuestionnaireAssignment,
} from "@/lib/api/backend";
import type { SmMarketRecord } from "@/types/smMarkets";
import type { SmGlobalQuestionnaireConfiguration, SmPlanningAssignment, SmPlanningFrequency, SmPlanningReassignmentScope, SmPlanningStatus } from "@/types/smPlanning";
import type { SMRecord } from "@/types/shelfmerchandiser";

const RED = "#DC2626";
const ROW_GRID = "132px minmax(150px, .8fr) minmax(110px, .65fr) minmax(230px, 1.35fr) 80px 118px 84px";

type DrawerMode = "single" | "series" | null;

type PlanningSubmitRequest =
  | {
      kind: "create_single";
      workDate: string;
      smMarketId: string;
      smUserId: string;
      plannedMinutes: number;
      idempotencyKey: string;
    }
  | {
      kind: "create_series";
      smMarketId: string;
      smUserId: string;
      plannedMinutes: number;
      frequency: SmPlanningFrequency;
      weekdays: number[];
      validFrom: string;
      validTo: string;
      idempotencyKey: string;
    }
  | {
      kind: "edit";
      assignment: SmPlanningAssignment;
      smMarketId: string;
      smUserId: string;
      plannedMinutes: number;
      workDate: string;
      reassignmentScope: SmPlanningReassignmentScope;
      cancellationAction: "none" | "cancel" | "restore";
      reason: string;
    };

type SmPlanDropdownOption = {
  value: string;
  label: string;
  description?: string;
};

const DURATION_OPTIONS: SmPlanDropdownOption[] = [45, 60, 75, 90, 105, 120, 150, 180].map((value) => ({ value: String(value), label: formatDuration(value) }));
const FREQUENCY_OPTIONS: SmPlanDropdownOption[] = [
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Alle zwei Wochen" },
];
const TYPE_FILTER_OPTIONS: SmPlanDropdownOption[] = [
  { value: "all", label: "Planungstyp" },
  { value: "single", label: "Einmalig" },
  { value: "series", label: "Serie" },
];
const STATUS_FILTER_OPTIONS: SmPlanDropdownOption[] = [
  { value: "all", label: "Status" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Offen" },
  { value: "cancelled", label: "Ausfall" },
  { value: "completed", label: "Erledigt" },
  { value: "missed", label: "Versäumt" },
  { value: "rescheduled", label: "Verschoben" },
  { value: "replaced", label: "Ersetzt" },
];

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const SHORT_DAYS = [{ key: 1, label: "Mo" }, { key: 2, label: "Di" }, { key: 3, label: "Mi" }, { key: 4, label: "Do" }, { key: 5, label: "Fr" }];
const CALENDAR_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} Min`;
  if (rest === 0) return `${hours} h`;
  if (rest === 15) return `${hours},25 h`;
  if (rest === 30) return `${hours},5 h`;
  if (rest === 45) return `${hours},75 h`;
  return `${hours} h ${rest} Min`;
}

function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${dateIso}T12:00:00`));
}

function statusMeta(status: SmPlanningStatus) {
  if (status === "confirmed") return { label: "Bestätigt", color: "#15803D", background: "rgba(22,163,74,.09)" };
  if (status === "open") return { label: "Offen", color: "#B45309", background: "rgba(245,158,11,.13)" };
  if (status === "cancelled") return { label: "Ausfall", color: "#B91C1C", background: "rgba(220,38,38,.09)" };
  if (status === "completed") return { label: "Erledigt", color: "#15803D", background: "rgba(22,163,74,.09)" };
  if (status === "in_progress") return { label: "In Arbeit", color: "#1D4ED8", background: "rgba(37,99,235,.09)" };
  if (status === "missed") return { label: "Versäumt", color: "#B91C1C", background: "rgba(220,38,38,.09)" };
  return { label: "Geplant", color: "#4B5563", background: "rgba(15,23,42,.055)" };
}

const RESCHEDULED_META = { label: "Verschoben", color: "#6D28D9", background: "rgba(124,58,237,.10)" };
const REPLACED_META = { label: "Ersetzt", color: "#1D4ED8", background: "rgba(37,99,235,.09)" };

function avatarColors(name: string) {
  const palettes = [
    { background: "#FEF3C7", color: "#B45309" },
    { background: "#DBEAFE", color: "#1D4ED8" },
    { background: "#DCFCE7", color: "#15803D" },
    { background: "#FCE7F3", color: "#BE185D" },
  ];
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

function parseDate(dateIso: string): Date {
  return new Date(`${dateIso}T12:00:00`);
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  const weekday = value.getDay() || 7;
  value.setDate(value.getDate() - weekday + 1);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function buildSeriesDates(input: { validFrom: string; validTo: string; weekdays: number[]; frequency: SmPlanningFrequency }): string[] {
  const dates: string[] = [];
  const start = parseDate(input.validFrom);
  const end = parseDate(input.validTo);
  const intervalWeeks = input.frequency === "biweekly" ? 2 : 1;
  const seriesWeekStart = startOfWeek(start);
  for (let cursor = new Date(start), guard = 0; cursor <= end && guard < 730; cursor = addDays(cursor, 1), guard += 1) {
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
    const weeksFromStart = Math.floor((startOfWeek(cursor).getTime() - seriesWeekStart.getTime()) / (7 * 86400000));
    if (input.weekdays.includes(weekday) && weeksFromStart % intervalWeeks === 0) dates.push(toDateInputValue(cursor));
  }
  return dates;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 6, color: "rgba(0,0,0,.42)", fontSize: 9, fontWeight: 700 }}>{children}</label>;
}

function SmPlanDropdown({
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
  options: SmPlanDropdownOption[];
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

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const optionHeight = filteredOptions.some((option) => option.description) ? 46 : 36;
    const desiredHeight = Math.min(300, 12 + (searchable ? 42 : 0) + Math.max(1, filteredOptions.length) * optionHeight);
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const roomAbove = rect.top - 8;
    const openAbove = roomBelow < Math.min(190, desiredHeight) && roomAbove > roomBelow;
    const maxHeight = Math.max(120, Math.min(desiredHeight, (openAbove ? roomAbove : roomBelow) - 4));
    const width = Math.max(rect.width, compact ? 164 : 220);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setPosition({ top: openAbove ? rect.top - 4 : rect.bottom + 4, left, width, openAbove, maxHeight });
  }, [compact, filteredOptions.length, searchable]);

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
            onKeyDown={handleKeyDown}
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

function SmPlanDatePicker({
  value,
  onChange,
  ariaLabel,
  minDate,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  minDate?: string;
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
    if (minDate && nextValue < minDate) return;
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
  const todayDisabled = Boolean(minDate && toDateInputValue(today) < minDate);

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
          const disabled = Boolean(minDate && cellValue < minDate);
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

function PlanningDrawer({
  mode,
  assignment,
  defaultDate,
  markets,
  users,
  onClose,
  onSubmit,
}: {
  mode: Exclude<DrawerMode, null>;
  assignment: SmPlanningAssignment | null;
  defaultDate: string;
  markets: SmMarketRecord[];
  users: SMRecord[];
  onClose: () => void;
  onSubmit: (request: PlanningSubmitRequest) => Promise<void>;
}) {
  const createsSeries = !assignment && mode === "series";
  const currentDate = assignment?.effective.workDate ?? defaultDate;
  const currentWeekday = parseDate(currentDate).getDay() || 7;
  const [workDate, setWorkDate] = useState(currentDate);
  const [smMarketId, setSmMarketId] = useState(assignment?.effective.smMarketId ?? markets[0]?.id ?? "");
  const [smUserId, setSmUserId] = useState(assignment?.effective.smUserId ?? users[0]?.id ?? "");
  const [plannedMinutes, setPlannedMinutes] = useState(String(assignment?.effective.plannedMinutes ?? 90));
  const [rescheduling, setRescheduling] = useState(false);
  const [frequency, setFrequency] = useState<SmPlanningFrequency>(assignment?.series?.frequency ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>([currentWeekday]);
  const [validFrom, setValidFrom] = useState(currentDate);
  const [validTo, setValidTo] = useState(() => toDateInputValue(addDays(parseDate(currentDate), 84)));
  const [reassignmentScope, setReassignmentScope] = useState<SmPlanningReassignmentScope>("occurrence");
  const [cancellationAction, setCancellationAction] = useState<"none" | "cancel" | "restore">("none");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `sm-plan:${crypto.randomUUID()}`);
  const [seriesPreview, setSeriesPreview] = useState<{ effectiveFromDate: string; affectedCount: number; skippedCount: number } | null>(null);
  const [seriesPreviewLoading, setSeriesPreviewLoading] = useState(false);
  const [seriesPreviewError, setSeriesPreviewError] = useState<string | null>(null);

  const isLocked = Boolean(assignment && ["in_progress", "completed", "missed"].includes(assignment.status));
  const isCancelled = assignment?.status === "cancelled";
  const marketOptions = useMemo<SmPlanDropdownOption[]>(() => markets.map((market) => ({
    value: market.id,
    label: market.name,
    description: `Stammnr. ${market.internalId} · ${market.address}, ${market.postalCode} ${market.city}`,
  })), [markets]);
  const userOptions = useMemo<SmPlanDropdownOption[]>(() => users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    description: user.email,
  })), [users]);
  const selectedMarket = markets.find((market) => market.id === smMarketId);
  const selectedUser = users.find((user) => user.id === smUserId);
  const selectedUserName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim() : assignment?.effective.smName ?? "Shelf Merchandiser";
  const smChanged = Boolean(assignment && smUserId !== assignment.effective.smUserId);
  const marketChanged = Boolean(assignment && smMarketId !== assignment.effective.smMarketId);
  const minutesChanged = Boolean(assignment && Number(plannedMinutes) !== assignment.effective.plannedMinutes);
  const dateChanged = Boolean(assignment && rescheduling && workDate !== assignment.effective.workDate);
  const hasOriginalDifference = Boolean(assignment && (
    assignment.replacement.workDate
    || assignment.replacement.smUserId
    || assignment.replacement.smMarketId
    || assignment.replacement.plannedMinutes
  ));
  const seriesRangeInvalid = createsSeries && parseDate(validTo).getTime() < parseDate(validFrom).getTime();
  const seriesOccurrenceCount = createsSeries && !seriesRangeInvalid && weekdays.length
    ? buildSeriesDates({ validFrom, validTo, weekdays, frequency }).length
    : 0;
  const requiresReason = smChanged || cancellationAction !== "none";
  const hasEditChange = marketChanged || minutesChanged || dateChanged || smChanged || cancellationAction !== "none";
  const validationMessage = !smMarketId || !smUserId
    ? "Ein aktiver Markt und Shelf Merchandiser sind erforderlich."
    : Number(plannedMinutes) < 1 || Number(plannedMinutes) > 1440
      ? "Die Sollzeit ist ungültig."
      : createsSeries && weekdays.length === 0
        ? "Wähle mindestens einen Wochentag aus."
        : seriesRangeInvalid
          ? "Das Serienende muss nach dem Beginn liegen."
          : createsSeries && seriesOccurrenceCount === 0
            ? "Im gewählten Zeitraum liegt kein passender Wochentag."
            : assignment && assignment.sourceType === "series" && smChanged && reassignmentScope === "series_future" && seriesPreviewLoading
              ? "Die Serienauswirkung wird noch berechnet."
              : assignment && assignment.sourceType === "series" && smChanged && reassignmentScope === "series_future" && (seriesPreviewError || !seriesPreview)
                ? seriesPreviewError ?? "Die Serienauswirkung konnte nicht geladen werden."
            : assignment && !hasEditChange
              ? "Es wurden noch keine Änderungen vorgenommen."
              : requiresReason && reason.trim().length < 3
                ? "Bitte gib einen kurzen Änderungsgrund an."
                : null;

  useEffect(() => {
    if (!assignment || assignment.sourceType !== "series" || !smChanged || reassignmentScope !== "series_future") {
      setSeriesPreview(null);
      setSeriesPreviewError(null);
      setSeriesPreviewLoading(false);
      return;
    }
    let active = true;
    setSeriesPreviewLoading(true);
    setSeriesPreviewError(null);
    previewSmPlanningReassignment(assignment.id, smUserId)
      .then((preview) => { if (active) setSeriesPreview(preview); })
      .catch((error: unknown) => { if (active) setSeriesPreviewError(error instanceof Error ? error.message : "Die Serienauswirkung konnte nicht geladen werden."); })
      .finally(() => { if (active) setSeriesPreviewLoading(false); });
    return () => { active = false; };
  }, [assignment, reassignmentScope, smChanged, smUserId]);

  const toggleWeekday = (weekday: number) => setWeekdays((current) => current.includes(weekday)
    ? current.filter((entry) => entry !== weekday)
    : [...current, weekday].sort((left, right) => left - right));

  const submit = async () => {
    if (validationMessage || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      if (!assignment) {
        await onSubmit(createsSeries ? {
          kind: "create_series",
          smMarketId,
          smUserId,
          plannedMinutes: Number(plannedMinutes),
          frequency,
          weekdays,
          validFrom,
          validTo,
          idempotencyKey,
        } : {
          kind: "create_single",
          workDate,
          smMarketId,
          smUserId,
          plannedMinutes: Number(plannedMinutes),
          idempotencyKey,
        });
      } else {
        await onSubmit({
          kind: "edit",
          assignment,
          smMarketId,
          smUserId,
          plannedMinutes: Number(plannedMinutes),
          workDate,
          reassignmentScope,
          cancellationAction,
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Die Änderung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="sm-plan-drawer" aria-label={assignment ? "Einsatz bearbeiten" : "Einsatz planen"} onKeyDown={(event) => { if (event.key === "Escape" && !saving) onClose(); }}>
      <style>{`@keyframes smPlanDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div style={{ height: 64, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid rgba(0,0,0,.06)", flexShrink: 0 }}>
        <div>
          <div style={{ color: "#1a1a1a", fontSize: 14, fontWeight: 750, letterSpacing: "-.02em" }}>{assignment ? "Einsatz bearbeiten" : createsSeries ? "Serie planen" : "Einsatz planen"}</div>
          <div style={{ marginTop: 3, color: "rgba(0,0,0,.35)", fontSize: 9.5 }}>{assignment ? "Originalplanung bleibt unverändert erhalten" : "Neue SM-Verplanung erstellen"}</div>
        </div>
        <button type="button" aria-label="Schließen" disabled={saving} onClick={onClose} className="sm-plan-icon-button"><X size={14} strokeWidth={2}/></button>
      </div>

      <div className="sm-plan-drawer-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 15, borderBottom: "1px solid rgba(0,0,0,.06)" }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: avatarColors(selectedUserName).background, color: avatarColors(selectedUserName).color, fontSize: 11, fontWeight: 800 }}>{initials(selectedUserName)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#1a1a1a", fontSize: 12, fontWeight: 700 }}>{selectedUserName}</div>
            <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,.38)", fontSize: 9.5 }}>{selectedMarket ? `${selectedMarket.name} · Stammnr. ${selectedMarket.internalId}` : "Markt auswählen"}</div>
          </div>
        </div>

        {hasOriginalDifference && assignment ? <div style={{ marginTop: 14, padding: "10px 11px", border: "1px solid rgba(37,99,235,.13)", borderRadius: 9, background: "rgba(37,99,235,.035)" }}>
          <div style={{ color: "#1D4ED8", fontSize: 8.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Originalplanung</div>
          <div style={{ marginTop: 6, color: "rgba(0,0,0,.50)", fontSize: 9.3, lineHeight: 1.6 }}>{formatDate(assignment.original.workDate)} · {assignment.original.smName}<br/>{assignment.original.marketName} · Stammnr. {assignment.original.marketInternalId} · {formatDuration(assignment.original.plannedMinutes)}</div>
        </div> : null}

        {isLocked ? <div role="status" style={{ marginTop: 14, padding: "10px 11px", display: "flex", gap: 8, border: "1px solid rgba(245,158,11,.18)", borderRadius: 9, background: "rgba(245,158,11,.05)", color: "#92400E", fontSize: 9.4, lineHeight: 1.5 }}><AlertCircle size={13} style={{ flexShrink: 0 }}/><span>Dieser Einsatz ist bereits {assignment?.status === "completed" ? "abgeschlossen" : assignment?.status === "in_progress" ? "in Arbeit" : "versäumt"} und kann nicht mehr umgeplant werden.</span></div> : null}

        <div style={{ marginTop: 17, display: "grid", gap: 14 }}>
          {!createsSeries ? <div>
            <FieldLabel>{assignment ? "Aktuelles Datum" : "Datum"}</FieldLabel>
            {assignment && !rescheduling ? <div className="sm-plan-date-trigger is-readonly"><span>{formatDate(assignment.effective.workDate)}</span><Calendar size={12} strokeWidth={1.8}/></div> : <SmPlanDatePicker ariaLabel={assignment ? "Neues Datum" : "Datum"} value={workDate} onChange={(nextDate) => { setWorkDate(nextDate); setValidFrom(nextDate); }} />}
            {assignment?.replacement.workDate ? <div style={{ marginTop: 7, padding: "7px 9px", display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(124,58,237,.18)", borderRadius: 7, background: "rgba(124,58,237,.045)", color: "#6D28D9", fontSize: 9.2, fontWeight: 650 }}><CalendarClock size={11.5}/><span>Verschoben: {formatDate(assignment.original.workDate)} → {formatDate(assignment.effective.workDate)}</span></div> : null}
          </div> : null}
          <div><FieldLabel>Markt · Stammnummer</FieldLabel><SmPlanDropdown disabled={isLocked || isCancelled || rescheduling} ariaLabel="Markt" value={smMarketId} options={marketOptions} onChange={setSmMarketId} placeholder="Markt auswählen" searchable /></div>
          <div><FieldLabel>Shelf Merchandiser</FieldLabel><SmPlanDropdown disabled={isLocked || isCancelled || rescheduling} ariaLabel="Shelf Merchandiser" value={smUserId} options={userOptions} onChange={setSmUserId} placeholder="Shelf Merchandiser auswählen" searchable /></div>
          <div><FieldLabel>Sollzeit</FieldLabel><SmPlanDropdown disabled={isLocked || isCancelled || rescheduling} ariaLabel="Sollzeit" value={plannedMinutes} options={DURATION_OPTIONS} onChange={setPlannedMinutes} placeholder="Sollzeit" /></div>
        </div>

        {!assignment ? <div style={{ marginTop: 18, paddingTop: 15, borderTop: "1px solid rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ color: "#1a1a1a", fontSize: 11, fontWeight: 700 }}>Wiederkehrender Einsatz</div><div style={{ marginTop: 2, color: "rgba(0,0,0,.35)", fontSize: 9 }}>Einsatz als eigenständige Serie anlegen</div></div>
            <button type="button" aria-label="Wiederkehrender Einsatz" aria-pressed={createsSeries} onClick={() => window.dispatchEvent(new CustomEvent(createsSeries ? "sm-verplanung:openSingle" : "sm-verplanung:openSeries"))} className={`sm-plan-switch${createsSeries ? " is-active" : ""}`}><span/></button>
          </div>
        </div> : null}

        {createsSeries ? <div className="sm-plan-series-fields" style={{ display: "grid", gap: 13, marginTop: 17 }}>
          <div><FieldLabel>Wiederholung</FieldLabel><SmPlanDropdown ariaLabel="Wiederholung" value={frequency} options={FREQUENCY_OPTIONS} onChange={(value) => setFrequency(value as SmPlanningFrequency)} placeholder="Wiederholung" /></div>
          <div style={{ display: "flex", gap: 7 }}>{SHORT_DAYS.map((weekday) => <button key={weekday.key} type="button" onClick={() => toggleWeekday(weekday.key)} className={`sm-plan-weekday${weekdays.includes(weekday.key) ? " is-active" : ""}`}>{weekday.label}</button>)}</div>
          <div><FieldLabel>Beginn</FieldLabel><SmPlanDatePicker ariaLabel="Beginn" value={validFrom} onChange={setValidFrom} /></div>
          <div><FieldLabel>Ende</FieldLabel><SmPlanDatePicker ariaLabel="Ende" value={validTo} minDate={validFrom} onChange={setValidTo} /></div>
          {!validationMessage || validationMessage === "Es wurden noch keine Änderungen vorgenommen." ? <div style={{ color: "rgba(0,0,0,.4)", fontSize: 9.5 }}>{seriesOccurrenceCount} {seriesOccurrenceCount === 1 ? "Einsatz wird" : "Einsätze werden"} materialisiert</div> : null}
        </div> : null}

        {assignment && !isLocked ? <>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: rescheduling ? "rgba(124,58,237,.09)" : "rgba(0,0,0,.035)", color: rescheduling ? "#6D28D9" : "rgba(0,0,0,.42)" }}><CalendarClock size={13}/></span><div><div style={{ color: "#1a1a1a", fontSize: 11, fontWeight: 700 }}>Einsatz verschieben</div><div style={{ marginTop: 2, color: "rgba(0,0,0,.38)", fontSize: 9.2, lineHeight: 1.45 }}>Ändert nur diesen Einsatz; die Serie bleibt unverändert.</div></div></div>
              <button type="button" disabled={isCancelled} aria-label="Einsatz verschieben" aria-pressed={rescheduling} onClick={() => { setRescheduling((current) => !current); setWorkDate(assignment.effective.workDate); }} className={`sm-plan-switch${rescheduling ? " is-active" : ""}`}><span/></button>
            </div>
          </div>

          {smChanged && assignment.sourceType === "series" ? <div style={{ marginTop: 16 }}>
            <FieldLabel>Umfang der SM-Änderung</FieldLabel>
            <div style={{ display: "grid", gap: 8 }}>
              <button type="button" onClick={() => setReassignmentScope("occurrence")} className={`sm-plan-scope-card${reassignmentScope === "occurrence" ? " is-active" : ""}`}><span className="sm-plan-radio"/><span><strong>Nur dieser Einsatz</strong><small>Alle anderen Termine der Serie behalten ihre aktuelle Besetzung.</small></span></button>
              <button type="button" onClick={() => setReassignmentScope("series_future")} className={`sm-plan-scope-card${reassignmentScope === "series_future" ? " is-active" : ""}`}><span className="sm-plan-radio"/><span><strong>Ab diesem Einsatz dauerhaft</strong><small>Alle zukünftigen änderbaren Termine erhalten den neuen SM. Laufende, erledigte und abgesagte Termine bleiben unberührt.</small></span></button>
            </div>
            {reassignmentScope === "series_future" ? <div style={{ marginTop: 8, padding: "9px 10px", border: "1px solid rgba(37,99,235,.13)", borderRadius: 8, background: "rgba(37,99,235,.035)", color: "rgba(0,0,0,.52)", fontSize: 9.1, lineHeight: 1.55 }}>
              {seriesPreviewLoading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LoaderCircle className="sm-plan-spinner" size={11}/>Auswirkung wird berechnet…</span> : seriesPreviewError ? <span style={{ color: RED }}>{seriesPreviewError}</span> : seriesPreview ? <><strong style={{ color: "#1D4ED8" }}>{assignment.effective.smName} → {selectedUserName}</strong><br/>Ab {formatDate(seriesPreview.effectiveFromDate)} werden <strong>{seriesPreview.affectedCount} Einsätze</strong> geändert{seriesPreview.skippedCount ? `; ${seriesPreview.skippedCount} gesperrte oder abgesagte Einsätze bleiben unverändert` : ""}.</> : null}
            </div> : null}
          </div> : null}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            {isCancelled ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}><div style={{ display: "flex", gap: 9 }}><span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(22,163,74,.08)", color: "#15803D" }}><RotateCcw size={13}/></span><div><div style={{ color: "#1a1a1a", fontSize: 11, fontWeight: 700 }}>Einsatz wiederherstellen</div><div style={{ marginTop: 2, color: "rgba(0,0,0,.38)", fontSize: 9.2 }}>Nur dieser Einsatz wird wieder aktiv.</div></div></div><button type="button" aria-label="Einsatz wiederherstellen" aria-pressed={cancellationAction === "restore"} onClick={() => setCancellationAction((current) => current === "restore" ? "none" : "restore")} className={`sm-plan-switch${cancellationAction === "restore" ? " is-active" : ""}`}><span/></button></div> : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}><div style={{ display: "flex", gap: 9 }}><span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: cancellationAction === "cancel" ? "rgba(220,38,38,.08)" : "rgba(0,0,0,.035)", color: cancellationAction === "cancel" ? RED : "rgba(0,0,0,.42)" }}><Ban size={13}/></span><div><div style={{ color: "#1a1a1a", fontSize: 11, fontWeight: 700 }}>Als Ausfall markieren</div><div style={{ marginTop: 2, color: "rgba(0,0,0,.38)", fontSize: 9.2 }}>{assignment.sourceType === "series" ? "Nur dieser Serientermin wird abgesagt." : "Der Einsatz bleibt vollständig nachvollziehbar."}</div></div></div><button type="button" aria-label="Als Ausfall markieren" aria-pressed={cancellationAction === "cancel"} onClick={() => setCancellationAction((current) => current === "cancel" ? "none" : "cancel")} className={`sm-plan-switch${cancellationAction === "cancel" ? " is-active" : ""}`}><span/></button></div>}
          </div>

          {(smChanged || cancellationAction !== "none" || marketChanged || minutesChanged || dateChanged) ? <div style={{ marginTop: 16 }}><FieldLabel>Änderungsgrund{requiresReason ? " *" : " (optional)"}</FieldLabel><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="sm-plan-input" style={{ height: 66, paddingTop: 8, resize: "vertical" }} placeholder="Kurze Begründung…"/></div> : null}
        </> : null}

        {validationMessage || submitError ? <div role="alert" style={{ marginTop: 14, padding: "8px 9px", display: "flex", gap: 7, border: "1px solid rgba(220,38,38,.14)", borderRadius: 7, background: "rgba(220,38,38,.045)", color: "#B91C1C", fontSize: 9.5, fontWeight: 600 }}><AlertCircle size={12} style={{ flexShrink: 0 }}/><span>{validationMessage ?? submitError}</span></div> : null}
      </div>

      <div style={{ minHeight: 66, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#fff", borderTop: "1px solid rgba(0,0,0,.06)", flexShrink: 0 }}>
        <button type="button" disabled={saving} onClick={onClose} className="sm-plan-secondary-button">Abbrechen</button>
        <button type="button" disabled={Boolean(validationMessage) || saving || isLocked} onClick={() => { void submit(); }} className="sm-plan-primary-button">{saving ? <LoaderCircle className="sm-plan-spinner" size={12}/> : null}{assignment ? cancellationAction === "restore" ? "Wiederherstellen" : cancellationAction === "cancel" ? "Ausfall speichern" : "Änderung speichern" : createsSeries ? "Serie planen" : "Einsatz planen"}</button>
      </div>
    </aside>
  );
}

export function SmVerplanungWorkspace() {
  const baseStart = useMemo(() => startOfWeek(new Date()), []);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [smFilter, setSmFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignments, setAssignments] = useState<SmPlanningAssignment[]>([]);
  const [markets, setMarkets] = useState<SmMarketRecord[]>([]);
  const [users, setUsers] = useState<SMRecord[]>([]);
  const [questionnaireConfiguration, setQuestionnaireConfiguration] = useState<SmGlobalQuestionnaireConfiguration | null>(null);
  const [questionnaireSelection, setQuestionnaireSelection] = useState("");
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<string[]>([]);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<SmPlanningAssignment | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  const weekStart = useMemo(() => { const value = new Date(baseStart); value.setDate(value.getDate() + weekOffset * 7); return value; }, [baseStart, weekOffset]);
  const weekEnd = useMemo(() => { const value = new Date(weekStart); value.setDate(value.getDate() + 6); return value; }, [weekStart]);
  const weekStartKey = toDateInputValue(weekStart);
  const weekEndKey = toDateInputValue(weekEnd);
  const weekNumber = useMemo(() => {
    const value = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()));
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
    return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }, [weekStart]);

  const reloadAssignments = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const rows = await fetchSmPlanningAssignments(weekStartKey, weekEndKey);
      setAssignments(rows);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Die Verplanung konnte nicht geladen werden.");
      throw error;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [weekEndKey, weekStartKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchSmUsers(), fetchSmMarkets(), fetchSmPlanningAssignments(weekStartKey, weekEndKey), fetchSmGlobalQuestionnaireConfiguration()])
      .then(([userRows, marketRows, assignmentRows, questionnaireRows]) => {
        if (!active) return;
        setUsers(userRows);
        setMarkets(marketRows.filter((market) => market.isActive && Boolean(market.internalId)));
        setAssignments(assignmentRows);
        setQuestionnaireConfiguration(questionnaireRows);
        setQuestionnaireSelection(questionnaireRows.assignment?.questionnaireTemplateId ?? "");
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Die Verplanung konnte nicht geladen werden.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weekEndKey, weekStartKey]);

  const normalizedSearch = search.trim().toLocaleLowerCase("de-AT");
  const rows = useMemo(() => assignments.filter((row) => {
    const matchesSearch = !normalizedSearch || [
      row.effective.smName,
      row.effective.marketName,
      row.effective.marketInternalId,
      row.effective.address,
      row.original.smName,
      row.original.marketInternalId,
    ].some((value) => value.toLocaleLowerCase("de-AT").includes(normalizedSearch));
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "rescheduled" ? Boolean(row.replacement.workDate) : statusFilter === "replaced" ? Boolean(row.replacement.smUserId) : row.status === statusFilter);
    return matchesSearch
      && (region === "all" || row.effective.region === region)
      && (smFilter === "all" || row.effective.smUserId === smFilter)
      && (typeFilter === "all" || row.sourceType === typeFilter)
      && matchesStatus;
  }), [assignments, normalizedSearch, region, smFilter, statusFilter, typeFilter]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, SmPlanningAssignment[]>();
    for (const row of rows) groups.set(row.effective.workDate, [...(groups.get(row.effective.workDate) ?? []), row]);
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [rows]);

  const totalMinutes = rows.reduce((sum, row) => sum + row.effective.plannedMinutes, 0);
  const activeSeries = new Set(rows.map((row) => row.seriesId).filter((value): value is string => Boolean(value))).size;
  const hasActiveFilters = Boolean(normalizedSearch) || region !== "all" || smFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";
  const regionFilterOptions = useMemo<SmPlanDropdownOption[]>(() => [
    { value: "all", label: "Region" },
    ...[...new Set(markets.map((market) => market.region).filter(Boolean))].sort().map((value) => ({ value, label: value })),
  ], [markets]);
  const smFilterOptions = useMemo<SmPlanDropdownOption[]>(() => [
    { value: "all", label: "Shelf Merchandiser" },
    ...users.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim() })),
  ], [users]);
  const questionnaireOptions = useMemo<SmPlanDropdownOption[]>(() => (questionnaireConfiguration?.options ?? []).map((option) => ({
    value: option.questionnaireTemplateId,
    label: option.name,
    description: `Version ${option.versionNumber}${option.description ? ` · ${option.description}` : ""}`,
  })), [questionnaireConfiguration]);

  const openDrawer = useCallback((mode: Exclude<DrawerMode, null>, assignment: SmPlanningAssignment | null = null) => {
    if (!assignment && !questionnaireConfiguration?.assignment?.questionnaire) {
      setNotice({ message: "Wähle zuerst den zentralen SM-Fragebogen für alle Einsätze aus", tone: "error" });
      return;
    }
    if (!assignment && (markets.length === 0 || users.length === 0)) {
      setNotice({ message: markets.length === 0 ? "Lege zuerst einen aktiven SM-Markt mit Stammnummer an" : "Lege zuerst einen aktiven Shelf Merchandiser an", tone: "error" });
      return;
    }
    setSelectedAssignment(assignment);
    setDrawerMode(mode);
  }, [markets.length, questionnaireConfiguration?.assignment?.questionnaire, users.length]);

  const saveQuestionnaireAssignment = useCallback(async () => {
    if (!questionnaireSelection) {
      setNotice({ message: "Bitte wähle einen SM-Fragebogen aus", tone: "error" });
      return;
    }
    setQuestionnaireSaving(true);
    try {
      const updated = await updateSmGlobalQuestionnaireAssignment(questionnaireSelection);
      setQuestionnaireConfiguration({ assignment: updated.assignment, options: updated.options });
      setQuestionnaireSelection(updated.assignment?.questionnaireTemplateId ?? questionnaireSelection);
      setNotice({ message: updated.replayed ? "Dieser Fragebogen gilt bereits für alle Einsätze" : "Fragebogen gilt jetzt für alle ungestarteten SM-Einsätze", tone: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Der zentrale Fragebogen konnte nicht gespeichert werden", tone: "error" });
    } finally {
      setQuestionnaireSaving(false);
    }
  }, [questionnaireSelection]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setRegion("all");
    setSmFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  }, []);

  const persistPlanning = useCallback(async (request: PlanningSubmitRequest) => {
    try {
      if (request.kind === "create_single") {
        await createSmPlanningAssignment(request);
        setNotice({ message: "Einsatz wurde eingeplant", tone: "success" });
      } else if (request.kind === "create_series") {
        const result = await createSmPlanningSeries(request);
        setNotice({ message: `${result.count} Einsätze wurden als Serie eingeplant`, tone: "success" });
      } else {
        const { assignment } = request;
        let expectedUpdatedAt = assignment.updatedAt;
        if (request.smMarketId !== assignment.effective.smMarketId || request.plannedMinutes !== assignment.effective.plannedMinutes) {
          const result = await updateSmPlanningAssignment(assignment.id, {
            ...(request.smMarketId !== assignment.effective.smMarketId ? { smMarketId: request.smMarketId } : {}),
            ...(request.plannedMinutes !== assignment.effective.plannedMinutes ? { plannedMinutes: request.plannedMinutes } : {}),
            expectedUpdatedAt,
            ...(request.reason ? { reason: request.reason } : {}),
          });
          expectedUpdatedAt = result.updatedAt;
        }
        if (request.workDate !== assignment.effective.workDate) {
          const result = await rescheduleSmPlanningAssignment(assignment.id, {
            workDate: request.workDate,
            expectedUpdatedAt,
            ...(request.reason ? { reason: request.reason } : {}),
          });
          expectedUpdatedAt = result.updatedAt;
        }
        if (request.smUserId !== assignment.effective.smUserId) {
          const result = await reassignSmPlanningAssignment(assignment.id, {
            smUserId: request.smUserId,
            scope: request.reassignmentScope,
            expectedUpdatedAt,
            reason: request.reason,
          });
          expectedUpdatedAt = result.updatedAt;
          if (request.reassignmentScope === "series_future") {
            setNotice({ message: `${result.affectedCount} zukünftige Einsätze aktualisiert${result.skippedCount ? ` · ${result.skippedCount} unverändert` : ""}`, tone: "success" });
          }
        }
        if (request.cancellationAction === "cancel") {
          const result = await cancelSmPlanningAssignment(assignment.id, { expectedUpdatedAt, reason: request.reason });
          expectedUpdatedAt = result.updatedAt;
        } else if (request.cancellationAction === "restore") {
          const result = await restoreSmPlanningAssignment(assignment.id, { expectedUpdatedAt, reason: request.reason });
          expectedUpdatedAt = result.updatedAt;
        }
        void expectedUpdatedAt;
        if (request.reassignmentScope !== "series_future" || request.smUserId === assignment.effective.smUserId) {
          setNotice({ message: request.cancellationAction === "cancel" ? "Einsatz wurde als Ausfall markiert" : request.cancellationAction === "restore" ? "Einsatz wurde wiederhergestellt" : "Änderung wurde gespeichert", tone: "success" });
        }
      }
      await reloadAssignments();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Die Änderung konnte nicht gespeichert werden", tone: "error" });
      throw error;
    }
  }, [reloadAssignments]);

  useEffect(() => {
    const openSingle = () => openDrawer("single");
    const openSeries = () => openDrawer("series");
    const resetToday = () => setWeekOffset(0);
    const exportExcel = async () => {
      try {
        setNotice({ message: "Excel-Export wird erstellt…", tone: "info" });
        const header = ["Tag", "Shelf Merchandiser", "Markt", "Adresse", "Sollzeit", "Planung", "Status"];
        const XLSX = await import("xlsx-js-style");
        const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows.map((row) => [
          formatDate(row.effective.workDate),
          row.effective.smName,
          `${row.effective.marketName} (${row.effective.marketInternalId})`,
          row.effective.address,
          row.effective.plannedMinutes,
          row.sourceType === "series" ? row.series?.frequency === "biweekly" ? "14-tägig" : "Wöchentlich" : "Einmalig",
          statusMeta(row.status).label,
        ])]);
        worksheet["!cols"] = [{ wch: 13 }, { wch: 24 }, { wch: 18 }, { wch: 42 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `KW ${weekNumber}`);
        XLSX.writeFile(workbook, `CokeSpark_SM_Verplanung_KW${weekNumber}.xlsx`);
        setNotice({ message: "Excel-Export wurde erstellt", tone: "success" });
      } catch {
        setNotice({ message: "Excel-Export konnte nicht erstellt werden", tone: "error" });
      }
    };
    window.addEventListener("sm-verplanung:openSingle", openSingle);
    window.addEventListener("sm-verplanung:openSeries", openSeries);
    window.addEventListener("sm-verplanung:today", resetToday);
    const exportHandler = () => { void exportExcel(); };
    window.addEventListener("admin:sm-verplanung:export", exportHandler);
    return () => {
      window.removeEventListener("sm-verplanung:openSingle", openSingle);
      window.removeEventListener("sm-verplanung:openSeries", openSeries);
      window.removeEventListener("sm-verplanung:today", resetToday);
      window.removeEventListener("admin:sm-verplanung:export", exportHandler);
    };
  }, [openDrawer, rows, weekNumber]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const label = `KW ${weekNumber} · ${new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(weekStart)} – ${new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(weekEnd)}`;
    const emitContext = () => window.dispatchEvent(new CustomEvent("sm-verplanung:weekContext", { detail: { label } }));
    emitContext();
    const deferredEmit = window.setTimeout(emitContext, 0);
    window.addEventListener("sm-verplanung:requestWeekContext", emitContext);
    return () => {
      window.clearTimeout(deferredEmit);
      window.removeEventListener("sm-verplanung:requestWeekContext", emitContext);
    };
  }, [weekEnd, weekNumber, weekStart]);

  const toggleDate = (date: string) => setCollapsedDates((current) => current.includes(date) ? current.filter((entry) => entry !== date) : [...current, date]);

  return (
    <div style={{ marginRight: drawerMode ? 408 : 0, transition: "margin-right .22s cubic-bezier(.4,0,.2,1)" }}>
      <style>{`
        @keyframes smPlanFadeIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        @keyframes smPlanNoticeIn{from{opacity:0;transform:translate(-50%,-5px)}to{opacity:1;transform:translate(-50%,0)}}
        .sm-plan-card{animation:smPlanFadeIn .24s ease both}
        .sm-plan-search:focus-within{box-shadow:0 0 0 2px rgba(0,0,0,.045)}
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
        .sm-plan-row{transition:background-color .12s ease}
        .sm-plan-row:hover{background:rgba(0,0,0,.018)}
        .sm-plan-row.is-selected{background:rgba(220,38,38,.045)}
        .sm-plan-icon-button{width:32px;height:32px;border:0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:rgba(0,0,0,.035);color:rgba(0,0,0,.45);cursor:pointer;transition:all .15s}
        .sm-plan-icon-button:hover{background:rgba(0,0,0,.07);color:#1a1a1a}
        .sm-plan-icon-button:focus-visible,.sm-plan-dropdown-trigger:focus-visible,.sm-plan-date-trigger:focus-visible,.sm-plan-calendar-nav:focus-visible,.sm-plan-calendar-day:focus-visible,.sm-plan-row:focus-visible,.sm-plan-day-toggle:focus-visible{outline:2px solid rgba(0,0,0,.15);outline-offset:-2px}
        .sm-plan-input{width:100%;height:32px;border:1px solid rgba(0,0,0,.10);border-radius:7px;padding:0 10px;outline:0;background:linear-gradient(to bottom,#fff,#fafafa);color:#374151;font-family:inherit;font-size:10.5px;font-weight:550;box-shadow:inset 0 1px .6px rgba(255,255,255,.9),0 1px 3px rgba(0,0,0,.03)}
        .sm-plan-input:focus{border-color:rgba(0,0,0,.18)!important;box-shadow:0 0 0 2px rgba(0,0,0,.04)!important}
        .sm-plan-switch{width:34px;height:20px;padding:2px;border:0;border-radius:999px;background:rgba(0,0,0,.14);cursor:pointer;transition:background .18s}
        .sm-plan-switch span{display:block;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:transform .18s}
        .sm-plan-switch.is-active{background:${RED}}.sm-plan-switch.is-active span{transform:translateX(14px)}
        .sm-plan-switch:disabled{cursor:not-allowed;opacity:.42}
        .sm-plan-weekday{width:35px;height:27px;border:1px solid rgba(0,0,0,.09);border-radius:6px;background:linear-gradient(to bottom,#fff,#f7f7f7);color:rgba(0,0,0,.48);font-family:inherit;font-size:9.5px;font-weight:650;cursor:pointer}
        .sm-plan-weekday.is-active{border-color:#b91c1c;background:linear-gradient(to bottom,#DC2626,#b91c1c);color:#fff;box-shadow:inset 0 1px .6px rgba(255,255,255,.28),0 1px 4px rgba(180,20,20,.15)}
        .sm-plan-primary-button,.sm-plan-secondary-button{height:32px;padding:0 15px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:7px;font-family:inherit;font-size:10.5px;font-weight:650;cursor:pointer;transition:opacity .15s}
        .sm-plan-primary-button{color:#fff;background:linear-gradient(to bottom,#DC2626,#b91c1c);box-shadow:inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.14)}
        .sm-plan-secondary-button{color:rgba(0,0,0,.56);background:linear-gradient(to bottom,#fff,#f5f5f5);box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.10),0 1px 4px rgba(0,0,0,.07)}
        .sm-plan-primary-button:hover,.sm-plan-secondary-button:hover{opacity:.84}
        .sm-plan-primary-button:disabled{cursor:not-allowed;opacity:.42;box-shadow:0 0 0 1px rgba(0,0,0,.08);background:#b8b8b8}
        .sm-plan-delete-button{height:32px;padding:0 8px;display:inline-flex;align-items:center;gap:5px;border:0;border-radius:7px;background:transparent;color:rgba(185,28,28,.68);font-family:inherit;font-size:9.8px;font-weight:650;cursor:pointer;transition:background .14s,color .14s}
        .sm-plan-delete-button:hover{background:rgba(220,38,38,.06);color:#B91C1C}
        .sm-plan-reset-filters{height:29px;padding:0 9px;display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(220,38,38,.12);border-radius:7px;background:rgba(220,38,38,.035);color:${RED};font-family:inherit;font-size:9.5px;font-weight:650;cursor:pointer;white-space:nowrap}
        .sm-plan-reset-filters:hover{background:rgba(220,38,38,.07)}
        .sm-plan-day-toggle:hover{background:rgba(0,0,0,.028)!important}
        .sm-plan-drawer{position:fixed;top:80px;right:0;bottom:0;width:408px;z-index:700;display:flex;flex-direction:column;background:#f7f7f8;box-shadow:-6px 0 28px rgba(0,0,0,.10),-1px 0 0 rgba(0,0,0,.06);animation:smPlanDrawerIn .22s cubic-bezier(.4,0,.2,1) both}
        .sm-plan-drawer-scroll::-webkit-scrollbar{width:4px}.sm-plan-drawer-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:6px}
        .sm-plan-series-fields{animation:smPlanFadeIn .18s ease both}
        .sm-plan-scope-card{width:100%;padding:9px 10px;display:grid;grid-template-columns:16px minmax(0,1fr);gap:8px;border:1px solid rgba(0,0,0,.08);border-radius:8px;background:#fff;color:#1a1a1a;font-family:inherit;text-align:left;cursor:pointer}
        .sm-plan-scope-card.is-active{border-color:rgba(220,38,38,.28);background:rgba(220,38,38,.035);box-shadow:0 0 0 2px rgba(220,38,38,.035)}
        .sm-plan-radio{width:12px;height:12px;margin-top:2px;border:1px solid rgba(0,0,0,.22);border-radius:50%;box-shadow:inset 0 0 0 3px #fff}
        .sm-plan-scope-card.is-active .sm-plan-radio{border-color:${RED};background:${RED}}
        .sm-plan-scope-card strong{display:block;font-size:10px;font-weight:720}.sm-plan-scope-card small{display:block;margin-top:3px;color:rgba(0,0,0,.40);font-size:8.8px;line-height:1.45}
        .sm-plan-spinner{animation:smPlanSpin .8s linear infinite}@keyframes smPlanSpin{to{transform:rotate(360deg)}}
        @keyframes smPlanDropdownIn{from{opacity:0}to{opacity:1}}
        @media(max-width:1180px){.sm-plan-card-scroll{overflow-x:auto}.sm-plan-card-inner{min-width:950px}.sm-plan-drawer{width:min(408px,calc(100vw - 56px))}}
      `}</style>

      {notice ? <div role="status" style={{ position: "fixed", top: 92, left: "50%", zIndex: 13000, transform: "translateX(-50%)", padding: "7px 14px", display: "flex", alignItems: "center", gap: 7, border: `1px solid ${notice.tone === "success" ? "rgba(22,163,74,.18)" : notice.tone === "error" ? "rgba(220,38,38,.18)" : "rgba(0,0,0,.09)"}`, borderRadius: 999, background: notice.tone === "success" ? "rgba(247,255,249,.97)" : notice.tone === "error" ? "rgba(255,247,247,.97)" : "rgba(255,255,255,.97)", boxShadow: "0 5px 18px rgba(0,0,0,.08)", animation: "smPlanNoticeIn .2s ease both" }}>{notice.tone === "error" ? <X size={11} strokeWidth={2.4} color={RED}/> : notice.tone === "success" ? <Check size={11} strokeWidth={2.4} color="#16A34A"/> : <RefreshCw size={11} strokeWidth={2} color="rgba(0,0,0,.48)"/>}<span style={{ color: notice.tone === "success" ? "#15803D" : notice.tone === "error" ? "#B91C1C" : "rgba(0,0,0,.58)", fontSize: 10, fontWeight: 650 }}>{notice.message}</span></div> : null}

      {loadError ? <div role="alert" style={{ marginBottom: 10, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid rgba(220,38,38,.16)", borderRadius: 9, background: "rgba(220,38,38,.045)", color: "#B91C1C", fontSize: 10, fontWeight: 600 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><AlertCircle size={13}/>{loadError}</span><button type="button" onClick={() => { void reloadAssignments(true).catch(() => undefined); }} className="sm-plan-secondary-button">Erneut laden</button></div> : null}

      <section className="sm-plan-card" style={{ marginBottom: 10, padding: "11px 12px", display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(300px,430px) auto", alignItems: "center", gap: 14, border: "1px solid rgba(0,0,0,.07)", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,.035)" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: "rgba(220,38,38,.065)", color: RED }}><ClipboardCheck size={15} strokeWidth={1.8}/></span>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", color: "#1a1a1a", fontSize: 11.5, fontWeight: 750 }}>Fragebogen für alle Einsätze</strong>
            <small style={{ display: "block", marginTop: 3, color: "rgba(0,0,0,.40)", fontSize: 9.1, lineHeight: 1.4 }}>Gilt für alle noch nicht gestarteten SM-Marktbesuche. Laufende und abgeschlossene Besuche behalten ihren gespeicherten Stand.</small>
          </span>
        </div>
        <SmPlanDropdown searchable ariaLabel="Zentralen SM-Fragebogen auswählen" value={questionnaireSelection} onChange={setQuestionnaireSelection} placeholder={questionnaireOptions.length ? "Fragebogen auswählen…" : "Kein veröffentlichter Fragebogen"} options={questionnaireOptions}/>
        <button type="button" disabled={!questionnaireSelection || questionnaireSaving || questionnaireSelection === questionnaireConfiguration?.assignment?.questionnaireTemplateId} onClick={() => { void saveQuestionnaireAssignment(); }} className="sm-plan-primary-button" style={{ minWidth: 100 }}>
          {questionnaireSaving ? <LoaderCircle className="sm-plan-spinner" size={12}/> : <Check size={12} strokeWidth={2.2}/>}Übernehmen
        </button>
      </section>

      <section className="sm-plan-card" style={{ overflow: "hidden", border: "1px solid rgba(0,0,0,.07)", borderRadius: 14, background: "rgba(0,0,0,.025)" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(0,0,0,.3)", fontSize: 9, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase" }}>Wochenplanung</span>
          <span style={{ color: "rgba(0,0,0,.48)", fontSize: 10.5, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{rows.length} Einsätze · {formatDuration(totalMinutes)} Sollstunden</span>
        </div>

        <div className="sm-plan-card-scroll" style={{ margin: "0 10px 10px", overflow: "hidden", border: "1px solid rgba(0,0,0,.06)", borderRadius: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
          <div className="sm-plan-card-inner">
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid rgba(0,0,0,.05)" }}>
              <label className="sm-plan-search" style={{ width: 220, height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 7, borderRadius: 7, background: "rgba(0,0,0,.035)", transition: "box-shadow .15s" }}>
                <Search size={11} strokeWidth={2} color="rgba(0,0,0,.3)"/>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Markt oder SM suchen…" style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", color: "#1a1a1a", fontFamily: "inherit", fontSize: 10.5 }}/>
              </label>
              <button type="button" aria-label="Vorherige Woche" onClick={() => setWeekOffset((current) => current - 1)} className="sm-plan-icon-button" style={{ width: 30, height: 30 }}><ChevronLeft size={12}/></button>
              <button type="button" onClick={() => setWeekOffset(0)} className="sm-plan-secondary-button" style={{ height: 30, padding: "0 12px", whiteSpace: "nowrap" }}>KW {weekNumber} · {new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit" }).format(weekStart)} – {new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit" }).format(weekEnd)}</button>
              <button type="button" aria-label="Nächste Woche" onClick={() => setWeekOffset((current) => current + 1)} className="sm-plan-icon-button" style={{ width: 30, height: 30 }}><ChevronRight size={12}/></button>
              <div style={{ flex: 1 }}/>
              <SmPlanDropdown compact ariaLabel="Region filtern" value={region} onChange={setRegion} placeholder="Region" options={regionFilterOptions} />
              <SmPlanDropdown compact searchable ariaLabel="Shelf Merchandiser filtern" value={smFilter} onChange={setSmFilter} placeholder="Shelf Merchandiser" options={smFilterOptions} />
              <SmPlanDropdown compact ariaLabel="Planungstyp filtern" value={typeFilter} onChange={setTypeFilter} placeholder="Planungstyp" options={TYPE_FILTER_OPTIONS} />
              <SmPlanDropdown compact ariaLabel="Status filtern" value={statusFilter} onChange={setStatusFilter} placeholder="Status" options={STATUS_FILTER_OPTIONS} />
              {hasActiveFilters ? <button type="button" className="sm-plan-reset-filters" onClick={clearFilters}><X size={10} strokeWidth={2.2} />Filter löschen</button> : null}
            </div>

            <div style={{ height: 50, padding: "0 18px", display: "flex", alignItems: "center", gap: 26, borderBottom: "1px solid rgba(0,0,0,.05)" }}>
              {[`${rows.length} Einsätze`, `${formatDuration(totalMinutes)} Sollstunden`, `${new Set(rows.map((row) => row.effective.smUserId)).size} SMs`, `${activeSeries} aktive Serien`].map((value, index) => <div key={value} style={{ paddingRight: index < 3 ? 26 : 0, borderRight: index < 3 ? "1px solid rgba(0,0,0,.08)" : 0, color: "rgba(0,0,0,.64)", fontSize: 11, fontWeight: 650, letterSpacing: "-.005em", fontVariantNumeric: "tabular-nums" }}>{value}</div>)}
            </div>

            <div style={{ height: 40, padding: "0 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: 12, alignItems: "center", borderBottom: "1px solid rgba(0,0,0,.05)", background: "rgba(0,0,0,.018)" }}>
              {["Tag", "Shelf Merchandiser", "Markt", "Adresse", "Sollzeit", "Planung", "Status"].map((label) => <span key={label} style={{ color: "rgba(0,0,0,.46)", fontSize: 9.25, fontWeight: 750, letterSpacing: ".055em", textTransform: "uppercase" }}>{label}</span>)}
            </div>

            <div style={{ minHeight: 500 }}>
              {loading ? <div style={{ minHeight: 500, display: "grid", placeItems: "center", color: "rgba(0,0,0,.38)" }}><div style={{ display: "grid", justifyItems: "center", gap: 9 }}><LoaderCircle className="sm-plan-spinner" size={22}/><span style={{ fontSize: 10, fontWeight: 600 }}>Verplanung wird geladen…</span></div></div> : groupedRows.length === 0 ? (
                <div style={{ minHeight: 500, padding: "64px 24px", display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div style={{ width: "min(100%, 360px)", display: "grid", justifyItems: "center" }}>
                    <span style={{ width: 42, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "rgba(220,38,38,.065)", color: RED }}>
                      <CalendarDays size={18} strokeWidth={1.65}/>
                    </span>
                    <div style={{ marginTop: 14, color: "#1a1a1a", fontSize: 13.5, fontWeight: 750, letterSpacing: "-.01em" }}>{hasActiveFilters ? "Keine Einsätze gefunden" : "Keine Einsätze in dieser Woche"}</div>
                    <div style={{ marginTop: 5, color: "rgba(0,0,0,.38)", fontSize: 10, lineHeight: 1.55 }}>{hasActiveFilters ? "Passe die Suche oder Filter an, um wieder Ergebnisse zu sehen." : "Plane einen neuen Einsatz oder navigiere zu einer anderen Kalenderwoche."}</div>
                    <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                      {hasActiveFilters ? <button type="button" onClick={clearFilters} className="sm-plan-secondary-button">Filter zurücksetzen</button> : <>
                        {weekOffset !== 0 ? <button type="button" onClick={() => setWeekOffset(0)} className="sm-plan-secondary-button">Zur aktuellen Woche</button> : null}
                        <button type="button" onClick={() => openDrawer("single")} className="sm-plan-primary-button">Einsatz planen</button>
                      </>}
                    </div>
                  </div>
                </div>
              ) : groupedRows.map(([date, dayRows]) => {
                const collapsed = collapsedDates.includes(date) && !hasActiveFilters;
                const dayDate = parseDate(date);
                const dayTotal = dayRows.reduce((sum, row) => sum + row.effective.plannedMinutes, 0);
                return <div key={date}>
                  <button type="button" aria-expanded={!collapsed} onClick={() => toggleDate(date)} className="sm-plan-day-toggle" style={{ width: "100%", height: 44, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: 0, borderBottom: "1px solid rgba(0,0,0,.05)", background: "rgba(0,0,0,.022)", fontFamily: "inherit", cursor: "pointer", transition: "background .12s" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(0,0,0,.60)", fontSize: 10.5, fontWeight: 750, letterSpacing: ".045em", textTransform: "uppercase" }}><ChevronRight size={12.5} strokeWidth={2} style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform .16s" }}/>{DAY_NAMES[dayDate.getDay()]} · {formatDate(date)}</span>
                    <span style={{ color: "rgba(0,0,0,.54)", fontSize: 10.25, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{dayRows.length} Einsätze · {formatDuration(dayTotal)}</span>
                  </button>
                  {!collapsed ? dayRows.map((row) => {
                    const meta = statusMeta(row.status);
                    const rescheduled = Boolean(row.replacement.workDate);
                    const replaced = Boolean(row.replacement.smUserId);
                    const displayMeta = rescheduled ? RESCHEDULED_META : replaced ? REPLACED_META : meta;
                    const isSelected = selectedAssignment?.id === row.id && drawerMode !== null;
                    const rescheduleAria = rescheduled ? `, verschoben von ${formatDate(row.original.workDate)} auf ${formatDate(row.effective.workDate)}` : "";
                    const replacementAria = replaced ? `, ursprünglich ${row.original.smName}` : "";
                    const hasReplacement = rescheduled || replaced || Boolean(row.replacement.smMarketId) || row.replacement.plannedMinutes !== null;
                    return <button key={row.id} type="button" aria-label={`${row.effective.smName}${replacementAria}, ${row.effective.marketName}, Stammnummer ${row.effective.marketInternalId}, ${formatDate(row.effective.workDate)}${rescheduleAria}, ${row.sourceType === "series" ? "Serie" : "Einmalig"}, ${meta.label} bearbeiten`} onClick={() => openDrawer(row.sourceType === "series" ? "series" : "single", row)} className={`sm-plan-row${isSelected ? " is-selected" : ""}`} style={{ position: "relative", width: "100%", minHeight: hasReplacement ? 64 : 52, padding: "0 18px", display: "grid", gridTemplateColumns: ROW_GRID, columnGap: 12, alignItems: "center", border: 0, borderBottom: "1px solid rgba(0,0,0,.045)", background: "transparent", color: "#374151", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
                      {isSelected ? <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2, background: RED }}/>: null}
                      <span style={{ minWidth: 0, display: "grid", gap: 3 }}>
                        <span style={{ color: "rgba(0,0,0,.42)", fontSize: 9.5, fontWeight: 650 }}>{formatDate(row.effective.workDate)}</span>
                        {rescheduled ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3.5, color: "#6D28D9", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap" }}><CalendarClock size={9.5} strokeWidth={2}/>{formatDate(row.original.workDate)} → {formatDate(row.effective.workDate)}</span> : null}
                      </span>
                      <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a1a1a", fontSize: 10.5, fontWeight: 650 }}>{row.effective.smName}</span>{replaced ? <span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1D4ED8", fontSize: 8.5, fontWeight: 650 }}>Original: {row.original.smName}</span> : null}</span>
                      <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151", fontSize: 10.5, fontWeight: 600 }}>{row.effective.marketName}</span><span style={{ display: "block", marginTop: 2, color: "rgba(0,0,0,.35)", fontSize: 8.3, fontWeight: 650 }}>Stammnr. {row.effective.marketInternalId}</span></span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,.46)", fontSize: 9.8 }}>{row.effective.address}</span>
                      <span style={{ minWidth: 0 }}><span style={{ display: "block", color: "#374151", fontSize: 10.5, fontWeight: 650 }}>{formatDuration(row.effective.plannedMinutes)}</span>{row.actualMinutes !== null ? <span style={{ display: "block", marginTop: 2, color: "#15803D", fontSize: 8.2, fontWeight: 650 }}>Ist {formatDuration(row.actualMinutes)}</span> : null}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(0,0,0,.54)", fontSize: 9.8 }}>{row.sourceType === "series" ? <RefreshCw size={11} strokeWidth={1.8}/> : null}{row.sourceType === "series" ? row.series?.frequency === "biweekly" ? "14-tägig" : "Wöchentlich" : "Einmalig"}</span>
                      <span title={rescheduled || replaced ? `Fachlicher Status: ${meta.label}` : undefined} style={{ justifySelf: "start", padding: "3px 7px", borderRadius: 999, background: displayMeta.background, color: displayMeta.color, fontSize: 8.5, fontWeight: 700 }}>{displayMeta.label}</span>
                    </button>;
                  }) : null}
                </div>;
              })}
            </div>
            <div style={{ height: 42, padding: "0 18px", display: "flex", alignItems: "center", color: "rgba(0,0,0,.50)", fontSize: 10, fontWeight: 650 }}>{rows.length} Einsätze gesamt</div>
          </div>
        </div>
      </section>

      {drawerMode ? <PlanningDrawer key={`${drawerMode}-${selectedAssignment?.id ?? "new"}-${weekStartKey}`} mode={drawerMode} assignment={selectedAssignment} defaultDate={weekStartKey} markets={markets} users={users} onClose={() => { setDrawerMode(null); setSelectedAssignment(null); }} onSubmit={persistPlanning}/> : null}
    </div>
  );
}
