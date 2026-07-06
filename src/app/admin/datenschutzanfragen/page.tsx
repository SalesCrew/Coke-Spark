"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  createDsarRequest,
  fetchAdminUsers,
  fetchCustomerAccessUsers,
  fetchDsarDataPackage,
  fetchDsarRequests,
  fetchGmUsers,
  fetchSmUsers,
  updateDsarRequest,
  type AdminUserRecord,
  type CustomerAccessUserRecord,
  type DsarDataPackage,
  type DsarRequestRecord,
  type DsarRequestStatus,
  type DsarRequestType,
} from "@/lib/api/backend";
import type { GMRecord } from "@/types/gebietsmanager";
import type { SMRecord } from "@/types/shelfmerchandiser";

type SubjectOption = {
  id: string;
  role: "gm" | "sm" | "admin" | "kunde";
  name: string;
  email: string;
  region?: string | null;
};

type DraftState = {
  status: DsarRequestStatus;
  assignedToUserId: string;
  extendedUntil: string;
  extensionReason: string;
  decisionSummary: string;
  legalBlockers: string;
  responseChannel: string;
};

type CreateFormState = {
  requestType: DsarRequestType;
  intakeChannel: string;
  subjectUserId: string;
  subjectName: string;
  subjectEmail: string;
  subjectRole: string;
  requesterName: string;
  requesterEmail: string;
  requestSummary: string;
};

const FONT_STACK = "var(--font-inter), Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const INLINE_RED_BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  height: 30,
  padding: "0 13px",
  fontSize: 10.5,
  fontWeight: 600,
  color: "#ffffff",
  background: "linear-gradient(to bottom, #DC2626, #b91c1c)",
  border: "none",
  borderRadius: 7,
  cursor: "pointer",
  transition: "all 0.15s ease",
  letterSpacing: "0.01em",
  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)",
};

const INLINE_SECONDARY_BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  height: 30,
  padding: "0 12px",
  fontSize: 10.5,
  fontWeight: 650,
  color: "rgba(0,0,0,0.62)",
  background: "linear-gradient(to bottom, #ffffff, #f5f5f5)",
  border: "none",
  borderRadius: 7,
  cursor: "pointer",
  transition: "all 0.15s ease",
  letterSpacing: "0.01em",
  boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
};

const INLINE_ICON_BUTTON_STYLE: CSSProperties = {
  ...INLINE_SECONDARY_BUTTON_STYLE,
  width: 30,
  padding: 0,
};

const TYPE_LABELS: Record<DsarRequestType, string> = {
  access: "Auskunft",
  rectification: "Berichtigung",
  erasure: "Löschung",
  restriction: "Einschränkung",
  portability: "Datenexport",
  objection: "Widerspruch",
  mixed: "Gemischt",
};

const STATUS_META: Record<DsarRequestStatus, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "Offen", color: "#dc2626", bg: "rgba(254,242,242,0.92)", border: "rgba(220,38,38,0.16)" },
  identity_check: { label: "Identität", color: "#d97706", bg: "rgba(255,251,235,0.96)", border: "rgba(217,119,6,0.18)" },
  collecting: { label: "Sammlung", color: "#2563eb", bg: "rgba(239,246,255,0.96)", border: "rgba(37,99,235,0.14)" },
  decision: { label: "Entscheidung", color: "#7c3aed", bg: "rgba(245,243,255,0.96)", border: "rgba(124,58,237,0.14)" },
  responded: { label: "Beantwortet", color: "#059669", bg: "rgba(236,253,245,0.94)", border: "rgba(5,150,105,0.16)" },
  closed: { label: "Geschlossen", color: "#334155", bg: "rgba(248,250,252,0.96)", border: "rgba(15,23,42,0.1)" },
  cancelled: { label: "Abgebrochen", color: "#64748b", bg: "rgba(248,250,252,0.96)", border: "rgba(15,23,42,0.08)" },
};

const createEmptyForm = (): CreateFormState => ({
  requestType: "access",
  intakeChannel: "email",
  subjectUserId: "",
  subjectName: "",
  subjectEmail: "",
  subjectRole: "",
  requesterName: "",
  requesterEmail: "",
  requestSummary: "",
});

function fullName(user: { firstName?: string; lastName?: string; email: string }): string {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

function toSubjectOption(user: GMRecord, role: "gm"): SubjectOption;
function toSubjectOption(user: SMRecord, role: "sm"): SubjectOption;
function toSubjectOption(user: AdminUserRecord, role: "admin"): SubjectOption;
function toSubjectOption(user: CustomerAccessUserRecord, role: "kunde"): SubjectOption;
function toSubjectOption(
  user: GMRecord | SMRecord | AdminUserRecord | CustomerAccessUserRecord,
  role: SubjectOption["role"],
): SubjectOption {
  return {
    id: user.id,
    role,
    name: fullName(user),
    email: user.email,
    region: "region" in user ? user.region : null,
  };
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:00.000+01:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInputDisplay(value: string): string {
  const date = parseDateInputValue(value);
  if (!date) return "Keine Verlängerung";
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function addCalendarMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

function buildCalendarCells(viewDate: Date): Array<{ date: Date; currentMonth: boolean }> {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12, 0, 0, 0);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstOfMonth.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return { date, currentMonth: date.getMonth() === viewDate.getMonth() };
  });
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function daysUntil(value: string): number {
  const target = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86_400_000);
}

function createDraftFromRequest(request: DsarRequestRecord): DraftState {
  return {
    status: request.status,
    assignedToUserId: request.assignedToUserId ?? "",
    extendedUntil: toDateInput(request.extendedUntil),
    extensionReason: request.extensionReason ?? "",
    decisionSummary: request.decisionSummary ?? "",
    legalBlockers: request.legalBlockers ?? "",
    responseChannel: request.responseChannel ?? "",
  };
}

function SmallPill({ children, tone }: { children: ReactNode; tone: DsarRequestStatus }) {
  const meta = STATUS_META[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "0 9px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.color,
        fontSize: 10,
        fontWeight: 720,
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "red" | "green" | "amber" }) {
  const color = tone === "green" ? "#059669" : tone === "amber" ? "#d97706" : tone === "red" ? "#dc2626" : "#0f172a";
  return (
    <div
      style={{
        minHeight: 88,
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,0.07)",
        background: "#fff",
        padding: "16px 18px",
        boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 25, lineHeight: "26px", fontWeight: 760, color }}>{value}</div>
      <div style={{ marginTop: 5, fontSize: 11, fontWeight: 650, color: "rgba(15,23,42,0.42)" }}>{sub}</div>
    </div>
  );
}

type SoftSelectOption = {
  value: string;
  label: string;
  detail?: string;
};

function SoftSelect({
  value,
  options,
  onChange,
  placeholder = "Auswählen",
}: {
  value: string;
  options: SoftSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div
      tabIndex={-1}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setOpen(false);
      }}
      style={{ position: "relative", minWidth: 0 }}
    >
      <button
        className="dsar-control-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.09)",
          background: "linear-gradient(180deg,#ffffff,#fafafa)",
          boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 1px 3px rgba(15,23,42,0.04)",
          padding: "0 10px 0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          color: "#111827",
          outline: "none",
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 650 }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          style={{ flexShrink: 0, color: "rgba(15,23,42,0.36)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.14s ease" }}
        />
      </button>

      {open ? (
        <div
          className="dsar-soft-popover"
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            top: "calc(100% + 6px)",
            zIndex: 80,
            boxSizing: "border-box",
            borderRadius: 13,
            border: "1px solid rgba(15,23,42,0.10)",
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 18px 42px rgba(15,23,42,0.13), 0 1px 4px rgba(15,23,42,0.08)",
            padding: 5,
            maxHeight: 238,
            overflowY: "auto",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "__empty"}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = isSelected ? "rgba(220,38,38,0.075)" : "rgba(15,23,42,0.045)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = isSelected ? "rgba(220,38,38,0.055)" : "transparent";
                }}
                style={{
                  width: "100%",
                  minHeight: 32,
                  border: "none",
                  borderRadius: 9,
                  background: isSelected ? "rgba(220,38,38,0.055)" : "transparent",
                  color: isSelected ? "#b91c1c" : "#1f2937",
                  cursor: "pointer",
                  padding: option.detail ? "7px 9px" : "0 9px",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2,
                  fontFamily: "inherit",
                  transition: "background 0.12s ease, color 0.12s ease",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: isSelected ? 740 : 640, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{option.label}</span>
                {option.detail ? (
                  <span style={{ fontSize: 9.5, fontWeight: 560, color: isSelected ? "rgba(185,28,28,0.58)" : "rgba(15,23,42,0.40)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {option.detail}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SoftDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedDate = parseDateInputValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12, 0, 0, 0));
  }, [value]);

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const monthLabel = new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(viewDate);

  return (
    <div
      tabIndex={-1}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setOpen(false);
      }}
      style={{ position: "relative", minWidth: 0 }}
    >
      <button
        className="dsar-control-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.09)",
          background: "linear-gradient(180deg,#ffffff,#fafafa)",
          boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9), 0 1px 3px rgba(15,23,42,0.04)",
          padding: "0 10px 0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          color: value ? "#111827" : "rgba(15,23,42,0.42)",
          outline: "none",
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 650 }}>
          {formatDateInputDisplay(value)}
        </span>
        <CalendarClock size={14} strokeWidth={2.1} style={{ flexShrink: 0, color: "rgba(15,23,42,0.34)" }} />
      </button>

      {open ? (
        <div
          className="dsar-soft-popover"
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 6px)",
            zIndex: 90,
            width: 244,
            borderRadius: 15,
            border: "1px solid rgba(15,23,42,0.10)",
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 18px 42px rgba(15,23,42,0.13), 0 1px 4px rgba(15,23,42,0.08)",
            padding: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" onClick={() => setViewDate((date) => addCalendarMonths(date, -1))} style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", cursor: "pointer", color: "rgba(15,23,42,0.54)" }}>
              ‹
            </button>
            <div style={{ fontSize: 12, fontWeight: 720, color: "#111827", textTransform: "capitalize" }}>{monthLabel}</div>
            <button type="button" onClick={() => setViewDate((date) => addCalendarMonths(date, 1))} style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", cursor: "pointer", color: "rgba(15,23,42,0.54)" }}>
              ›
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <div key={day} style={{ height: 20, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 740, color: "rgba(15,23,42,0.34)" }}>
                {day}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((cell) => {
              const inputValue = toDateInputString(cell.date);
              const active = inputValue === value;
              return (
                <button
                  key={inputValue}
                  type="button"
                  onClick={() => {
                    onChange(inputValue);
                    setOpen(false);
                  }}
                  onMouseEnter={(event) => {
                    if (!active) event.currentTarget.style.background = "rgba(15,23,42,0.045)";
                  }}
                  onMouseLeave={(event) => {
                    if (!active) event.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    border: active ? "1px solid rgba(220,38,38,0.22)" : "1px solid transparent",
                    background: active ? "rgba(220,38,38,0.08)" : "transparent",
                    color: active ? "#b91c1c" : cell.currentMonth ? "#111827" : "rgba(15,23,42,0.24)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: active ? 780 : 620,
                    transition: "background 0.12s ease, color 0.12s ease",
                  }}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={{ marginTop: 9, width: "100%", height: 28, borderRadius: 9, border: "none", background: "rgba(15,23,42,0.04)", color: "rgba(15,23,42,0.48)", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 680 }}
            >
              Verlängerung entfernen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function DatenschutzAnfragenPage() {
  const [requests, setRequests] = useState<DsarRequestRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(() => createEmptyForm());
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dataPackage, setDataPackage] = useState<DsarDataPackage | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);

  const selected = useMemo(() => requests.find((request) => request.id === selectedId) ?? requests[0] ?? null, [requests, selectedId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestRows, gmRows, smRows, adminRows, customerRows] = await Promise.all([
        fetchDsarRequests(),
        fetchGmUsers(),
        fetchSmUsers(),
        fetchAdminUsers(),
        fetchCustomerAccessUsers(),
      ]);
      const subjectRows = [
        ...gmRows.map((user) => toSubjectOption(user, "gm")),
        ...smRows.map((user) => toSubjectOption(user, "sm")),
        ...adminRows.map((user) => toSubjectOption(user, "admin")),
        ...customerRows.map((user) => toSubjectOption(user, "kunde")),
      ].sort((a, b) => a.name.localeCompare(b.name, "de-AT"));
      setRequests(requestRows);
      setSubjects(subjectRows);
      setAdmins(adminRows);
      setSelectedId((current) => current ?? requestRows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datenschutzanfragen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setDraft(selected ? createDraftFromRequest(selected) : null);
    setDataPackage(null);
  }, [selected?.id]);

  const stats = useMemo(() => {
    const open = requests.filter((request) => !["responded", "closed", "cancelled"].includes(request.status)).length;
    const overdue = requests.filter((request) => !["responded", "closed", "cancelled"].includes(request.status) && daysUntil(request.dueAt) < 0).length;
    const dueSoon = requests.filter((request) => {
      const days = daysUntil(request.extendedUntil ?? request.dueAt);
      return !["responded", "closed", "cancelled"].includes(request.status) && days >= 0 && days <= 7;
    }).length;
    const answered = requests.filter((request) => request.status === "responded" || request.status === "closed").length;
    return { open, overdue, dueSoon, answered };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((request) =>
      [
        request.subjectNameSnapshot,
        request.subjectEmailSnapshot,
        request.requesterName,
        request.requesterEmail,
        request.requestSummary,
        TYPE_LABELS[request.requestType],
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [requests, search]);

  const handleSubjectChange = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId);
    setCreateForm((prev) => ({
      ...prev,
      subjectUserId: subjectId,
      subjectName: subject?.name ?? prev.subjectName,
      subjectEmail: subject?.email ?? prev.subjectEmail,
      subjectRole: subject?.role ?? prev.subjectRole,
      requesterName: prev.requesterName || subject?.name || "",
      requesterEmail: prev.requesterEmail || subject?.email || "",
    }));
  };

  const handleCreate = async () => {
    if (!createForm.subjectName.trim() || !createForm.subjectEmail.trim() || !createForm.requesterName.trim() || !createForm.requesterEmail.trim()) {
      setError("Bitte betroffene Person und Antragsteller vollständig ausfüllen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createDsarRequest({
        requestType: createForm.requestType,
        intakeChannel: createForm.intakeChannel,
        subjectUserId: createForm.subjectUserId || null,
        subjectName: createForm.subjectName,
        subjectEmail: createForm.subjectEmail,
        subjectRole: createForm.subjectRole || null,
        requesterName: createForm.requesterName,
        requesterEmail: createForm.requesterEmail,
        requestSummary: createForm.requestSummary,
      });
      setRequests((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateForm(createEmptyForm());
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datenschutzanfrage konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDsarRequest(selected.id, {
        status: draft.status,
        assignedToUserId: draft.assignedToUserId || null,
        extendedUntil: dateInputToIso(draft.extendedUntil),
        extensionReason: draft.extensionReason || null,
        decisionSummary: draft.decisionSummary || null,
        legalBlockers: draft.legalBlockers || null,
        responseChannel: draft.responseChannel || null,
      });
      setRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datenschutzanfrage konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyIdentity = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDsarRequest(selected.id, { identityVerified: true });
      setRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identitätsprüfung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkResponded = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDsarRequest(selected.id, {
        status: "responded",
        responseSentAt: new Date().toISOString(),
        responseChannel: draft?.responseChannel || "email",
      });
      setRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Antwortstatus konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPackage = async () => {
    if (!selected) return;
    setPackageLoading(true);
    setError(null);
    try {
      const nextPackage = await fetchDsarDataPackage(selected.id);
      setDataPackage(nextPackage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datenpaket konnte nicht berechnet werden.");
    } finally {
      setPackageLoading(false);
    }
  };

  return (
    <div
      className="dsar-page"
      style={{
        fontFamily: FONT_STACK,
        color: "#0f172a",
      }}
    >
      <style>{`
        .dsar-page input,
        .dsar-page textarea,
        .dsar-page button {
          -webkit-font-smoothing: antialiased;
        }

        .dsar-page input:focus,
        .dsar-page textarea:focus,
        .dsar-control-button:focus-visible {
          outline: none;
          box-shadow:
            inset 0 1px 0.6px rgba(255,255,255,0.9),
            0 0 0 2px rgba(220,38,38,0.09),
            0 0 0 1px rgba(220,38,38,0.18),
            0 6px 16px rgba(15,23,42,0.06) !important;
        }

        .dsar-soft-popover {
          scrollbar-width: thin;
          scrollbar-color: rgba(15,23,42,0.22) transparent;
        }

        .dsar-soft-popover::-webkit-scrollbar {
          width: 5px;
        }

        .dsar-soft-popover::-webkit-scrollbar-thumb {
          background: rgba(15,23,42,0.20);
          border-radius: 999px;
        }

        .dsar-soft-popover::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "center",
            gap: 18,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.07)",
            background: "linear-gradient(180deg,#ffffff 0%,#fbfbfc 100%)",
            boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
            padding: "16px 18px",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                background: "linear-gradient(180deg,rgba(220,38,38,0.10),rgba(220,38,38,0.035))",
                border: "1px solid rgba(220,38,38,0.13)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={18} strokeWidth={2.2} color="#dc2626" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>
                DSGVO Prozess
              </div>
              <h2 style={{ margin: "4px 0 0", fontSize: 19, letterSpacing: "-0.03em", lineHeight: 1.1, fontWeight: 720 }}>
                Anfragen kontrolliert bearbeiten
              </h2>
              <p style={{ margin: "5px 0 0", color: "rgba(15,23,42,0.50)", fontSize: 12, fontWeight: 550 }}>
                Auskunft, Berichtigung, Löschung und Einschränkung mit Frist, Entscheidung und Datenpaket.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              aria-label="Datenschutzanfragen neu laden"
              onClick={() => void loadData()}
              style={INLINE_ICON_BUTTON_STYLE}
              onMouseEnter={(event) => { event.currentTarget.style.opacity = "0.82"; }}
              onMouseLeave={(event) => { event.currentTarget.style.opacity = "1"; }}
            >
              <RefreshCw size={13} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              style={INLINE_RED_BUTTON_STYLE}
              onMouseEnter={(event) => { event.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(event) => { event.currentTarget.style.opacity = "1"; }}
            >
              <Plus size={12} strokeWidth={2.2} />
              Neue Anfrage
            </button>
          </div>
        </section>

        <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ background: "#fff", margin: "8px 8px 8px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", padding: 14 }}>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
              <StatCard label="Offen" value={String(stats.open)} sub="laufende Verfahren" tone={stats.open > 0 ? "red" : undefined} />
              <StatCard label="Fällig bald" value={String(stats.dueSoon)} sub="innerhalb von 7 Tagen" tone={stats.dueSoon > 0 ? "amber" : undefined} />
              <StatCard label="Überfällig" value={String(stats.overdue)} sub="sofort prüfen" tone={stats.overdue > 0 ? "red" : undefined} />
              <StatCard label="Beantwortet" value={String(stats.answered)} sub="inkl. geschlossen" tone="green" />
            </section>

        {error ? (
          <div
            style={{
              border: "1px solid rgba(220,38,38,0.18)",
              background: "rgba(254,242,242,0.94)",
              color: "#b91c1c",
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            {error}
          </div>
        ) : null}

        {createOpen ? (
          <section
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#fff",
              boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>
                  Intake
                </div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 760, letterSpacing: "-0.03em" }}>Neue Datenschutzanfrage</div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                style={{
                  border: "none",
                  background: "rgba(15,23,42,0.04)",
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(15,23,42,0.58)",
                  padding: 0,
                  outline: "none",
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Betroffene Person</span>
                <SoftSelect
                  value={createForm.subjectUserId}
                  onChange={handleSubjectChange}
                  options={[
                    { value: "", label: "Manuell / externe Anfrage", detail: "Name und E-Mail frei erfassen" },
                    ...subjects.map((subject) => ({
                      value: subject.id,
                      label: subject.name,
                      detail: `${subject.email} · ${subject.role.toUpperCase()}${subject.region ? ` · ${subject.region}` : ""}`,
                    })),
                  ]}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Art</span>
                <SoftSelect
                  value={createForm.requestType}
                  onChange={(value) => setCreateForm((prev) => ({ ...prev, requestType: value as DsarRequestType }))}
                  options={(Object.keys(TYPE_LABELS) as DsarRequestType[]).map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Kanal</span>
                <input
                  value={createForm.intakeChannel}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, intakeChannel: event.target.value }))}
                  style={{ height: 38, borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", padding: "0 10px", fontFamily: "inherit", fontWeight: 650 }}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              {[
                ["subjectName", "Name betroffen"],
                ["subjectEmail", "E-Mail betroffen"],
                ["requesterName", "Name Antragsteller"],
                ["requesterEmail", "E-Mail Antragsteller"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                  <input
                    value={String(createForm[key as keyof CreateFormState] ?? "")}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    style={{ height: 38, borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", padding: "0 10px", fontFamily: "inherit", fontWeight: 650 }}
                  />
                </label>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Zusammenfassung</span>
              <textarea
                value={createForm.requestSummary}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, requestSummary: event.target.value }))}
                rows={3}
                style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", padding: 12, fontFamily: "inherit", fontWeight: 560, resize: "vertical" }}
                placeholder="Was wurde verlangt? Über welchen Kanal kam die Anfrage? Gibt es Anhänge?"
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                style={{ ...INLINE_RED_BUTTON_STYLE, height: 32, borderRadius: 8, padding: "0 14px", fontWeight: 700 }}
              >
                {saving ? "Speichert..." : "Anfrage anlegen"}
              </button>
            </div>
          </section>
        ) : null}

        <section style={{ display: "grid", gridTemplateColumns: "390px minmax(0, 1fr)", gap: 16 }}>
          <aside style={{ borderRadius: 20, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", minHeight: 620, overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "rgba(15,23,42,0.35)" }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, E-Mail oder Inhalt suchen..."
                  style={{ width: "100%", height: 38, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "0 12px 0 34px", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 620, overflow: "auto", padding: 10 }}>
              {loading ? (
                <div style={{ height: 320, display: "grid", placeItems: "center", color: "rgba(15,23,42,0.42)", fontSize: 12, fontWeight: 700 }}>
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div style={{ height: 260, display: "grid", placeItems: "center", textAlign: "center", color: "rgba(15,23,42,0.42)", fontSize: 12, fontWeight: 750 }}>
                  Keine Datenschutzanfragen gefunden.
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const active = selected?.id === request.id;
                  const dueDays = daysUntil(request.extendedUntil ?? request.dueAt);
                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedId(request.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderRadius: 15,
                        border: active ? "1px solid rgba(220,38,38,0.22)" : "1px solid rgba(15,23,42,0.06)",
                        background: active ? "linear-gradient(180deg,rgba(254,242,242,0.82),#fff)" : "#fff",
                        boxShadow: active ? "0 6px 16px rgba(220,38,38,0.06)" : undefined,
                        padding: 13,
                        marginBottom: 9,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 760, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {request.subjectNameSnapshot}
                          </div>
                          <div style={{ marginTop: 3, fontSize: 10, fontWeight: 650, color: "rgba(15,23,42,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {request.subjectEmailSnapshot}
                          </div>
                        </div>
                        <SmallPill tone={request.status}>{STATUS_META[request.status].label}</SmallPill>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 720, color: "#0f172a" }}>{TYPE_LABELS[request.requestType]}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: dueDays < 0 ? "#dc2626" : dueDays <= 7 ? "#d97706" : "rgba(15,23,42,0.42)" }}>
                          {dueDays < 0 ? `${Math.abs(dueDays)} Tage überfällig` : `${dueDays} Tage offen`}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section style={{ minWidth: 0 }}>
            {!selected || !draft ? (
              <div style={{ height: 620, borderRadius: 20, border: "1px dashed rgba(15,23,42,0.14)", background: "#fff", display: "grid", placeItems: "center", color: "rgba(15,23,42,0.42)", fontWeight: 700 }}>
                Keine Anfrage ausgewählt.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(360px, 0.85fr)", gap: 16 }}>
                <article style={{ borderRadius: 20, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", overflow: "hidden" }}>
                  <div style={{ padding: 18, borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>
                        Anfrage
                      </div>
                      <h2 style={{ margin: "5px 0 0", fontSize: 24, lineHeight: 1.05, letterSpacing: "-0.04em", fontWeight: 760 }}>
                        {selected.subjectNameSnapshot}
                      </h2>
                      <p style={{ margin: "7px 0 0", fontSize: 12, color: "rgba(15,23,42,0.48)", fontWeight: 650 }}>
                        {TYPE_LABELS[selected.requestType]} · Eingang {formatDate(selected.receivedAt)} · Frist {formatDate(selected.extendedUntil ?? selected.dueAt)}
                      </p>
                    </div>
                    <SmallPill tone={draft.status}>{STATUS_META[draft.status].label}</SmallPill>
                  </div>

                  <div style={{ padding: 18, display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                      {[
                        { label: "Betroffen", value: selected.subjectEmailSnapshot, icon: UserRound },
                        { label: "Antragsteller", value: selected.requesterEmail, icon: FileText },
                        { label: "Frist", value: formatDate(selected.extendedUntil ?? selected.dueAt), icon: CalendarClock },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.07)", background: "#f8fafc", padding: 13 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, fontWeight: 760, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>
                              <Icon size={12} />
                              {item.label}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.value}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</span>
                        <SoftSelect
                          value={draft.status}
                          onChange={(value) => setDraft((prev) => (prev ? { ...prev, status: value as DsarRequestStatus } : prev))}
                          options={(Object.keys(STATUS_META) as DsarRequestStatus[]).map((status) => ({ value: status, label: STATUS_META[status].label }))}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Verantwortlich</span>
                        <SoftSelect
                          value={draft.assignedToUserId}
                          onChange={(value) => setDraft((prev) => (prev ? { ...prev, assignedToUserId: value } : prev))}
                          options={[
                            { value: "", label: "Nicht zugewiesen" },
                            ...admins.map((admin) => ({ value: admin.id, label: fullName(admin), detail: admin.email })),
                          ]}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Verlängerung bis</span>
                        <SoftDateField
                          value={draft.extendedUntil}
                          onChange={(value) => setDraft((prev) => (prev ? { ...prev, extendedUntil: value } : prev))}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Grund der Verlängerung</span>
                        <input
                          value={draft.extensionReason}
                          onChange={(event) => setDraft((prev) => (prev ? { ...prev, extensionReason: event.target.value } : prev))}
                          style={{ height: 38, borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", padding: "0 10px", fontFamily: "inherit", fontWeight: 650 }}
                        />
                      </label>
                    </div>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Entscheidung / Bearbeitung</span>
                      <textarea
                        value={draft.decisionSummary}
                        onChange={(event) => setDraft((prev) => (prev ? { ...prev, decisionSummary: event.target.value } : prev))}
                        rows={5}
                        style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", padding: 12, fontFamily: "inherit", fontWeight: 560, resize: "vertical" }}
                        placeholder="Welche Daten wurden geprüft, welche Maßnahmen werden gesetzt, was wird beantwortet?"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 760, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rechtliche Grenzen</span>
                      <textarea
                        value={draft.legalBlockers}
                        onChange={(event) => setDraft((prev) => (prev ? { ...prev, legalBlockers: event.target.value } : prev))}
                        rows={3}
                        style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", padding: 12, fontFamily: "inherit", fontWeight: 560, resize: "vertical" }}
                        placeholder="z.B. gesetzliche Aufbewahrung, Rechte Dritter, Kundengeheimnisse."
                      />
                    </label>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid rgba(15,23,42,0.06)", paddingTop: 14 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={Boolean(selected.identityVerifiedAt) || saving}
                          onClick={() => void handleVerifyIdentity()}
                          style={{ height: 36, borderRadius: 11, border: "1px solid rgba(5,150,105,0.18)", background: selected.identityVerifiedAt ? "rgba(236,253,245,0.8)" : "#fff", color: "#059669", fontSize: 11, fontWeight: 720, padding: "0 12px", cursor: "pointer" }}
                        >
                          {selected.identityVerifiedAt ? "Identität geprüft" : "Identität geprüft markieren"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleMarkResponded()}
                          style={{ height: 36, borderRadius: 11, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", color: "#0f172a", fontSize: 11, fontWeight: 720, padding: "0 12px", cursor: "pointer" }}
                        >
                          Antwort versendet
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSave()}
                        style={{ ...INLINE_RED_BUTTON_STYLE, height: 32, borderRadius: 8, padding: "0 14px", fontWeight: 700 }}
                      >
                        {saving ? "Speichert..." : "Speichern"}
                      </button>
                    </div>
                  </div>
                </article>

                <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <section style={{ borderRadius: 20, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>
                          Datenpaket
                        </div>
                        <div style={{ marginTop: 4, fontSize: 17, fontWeight: 760, letterSpacing: "-0.03em" }}>Prüfübersicht</div>
                      </div>
                      <button
                        type="button"
                        disabled={packageLoading}
                        onClick={() => void handleLoadPackage()}
                        style={{ height: 34, borderRadius: 11, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", fontSize: 11, fontWeight: 720, padding: "0 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
                      >
                        {packageLoading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        Prüfen
                      </button>
                    </div>
                    {!dataPackage ? (
                      <div style={{ marginTop: 14, borderRadius: 14, border: "1px dashed rgba(15,23,42,0.14)", background: "#f8fafc", padding: 18, display: "flex", gap: 10, color: "rgba(15,23,42,0.48)", fontSize: 12, fontWeight: 700 }}>
                        <AlertTriangle size={16} />
                        Datenpaket berechnen, danach manuell prüfen und nur freigegebene Inhalte herausgeben.
                      </div>
                    ) : (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                        {dataPackage.categories.map((category) => (
                          <div key={category.key} style={{ borderRadius: 13, border: "1px solid rgba(15,23,42,0.07)", background: "#fff", padding: 11 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 760, color: "#0f172a" }}>{category.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 780, color: "#dc2626" }}>{category.count}</div>
                            </div>
                            <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.45, fontWeight: 650, color: "rgba(15,23,42,0.48)" }}>{category.retention}</div>
                          </div>
                        ))}
                        <div style={{ marginTop: 4, borderRadius: 13, background: "rgba(255,251,235,0.88)", border: "1px solid rgba(217,119,6,0.16)", padding: 11 }}>
                          {dataPackage.limitations.map((item) => (
                            <div key={item} style={{ display: "flex", gap: 7, fontSize: 10, lineHeight: 1.45, color: "#92400e", fontWeight: 750, marginBottom: 5 }}>
                              <Clock3 size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section style={{ borderRadius: 20, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 760, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.36)" }}>
                      Workflow
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gap: 9 }}>
                      {[
                        { done: true, label: "Anfrage erfassen", text: "Eingang, Art, betroffene Person und Frist dokumentieren." },
                        { done: Boolean(selected.identityVerifiedAt), label: "Identität prüfen", text: "Nur bei plausibler Identität personenbezogene Details herausgeben." },
                        { done: Boolean(dataPackage), label: "Daten sammeln", text: "Kategorien prüfen, gesetzliche Grenzen und Dritte beachten." },
                        { done: selected.status === "responded" || selected.status === "closed", label: "Antwort dokumentieren", text: "Antwortkanal, Datum und Entscheidung speichern." },
                      ].map((step) => (
                        <div key={step.label} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 9 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 999, background: step.done ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.04)", color: step.done ? "#059669" : "rgba(15,23,42,0.28)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            {step.done ? <CheckCircle2 size={13} /> : <Clock3 size={12} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 760, color: "#0f172a" }}>{step.label}</div>
                            <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.45, color: "rgba(15,23,42,0.46)", fontWeight: 650 }}>{step.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            )}
          </section>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}

