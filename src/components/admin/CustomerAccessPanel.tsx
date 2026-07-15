"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Copy, Download, Eye, FileSpreadsheet, KeyRound, Loader2, PenLine, Plus, RefreshCw, Search, ShieldCheck, Upload, X } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "@/components/ui/adminNavigation";
import { buildPreviewGrid, excelColToIndex, getColHeader, getColSample, isValidColLetter, readWorkbook } from "@/utils/marketImport";
import {
  BackendApiError,
  createCustomerAccessUser,
  fetchCustomerAccessUsers,
  updateCustomerAccessUser,
  type CustomerAccessUserRecord,
} from "@/lib/api/backend";

type PermissionAction = "read" | "write" | "update";

type CustomerAccessUser = CustomerAccessUserRecord;

type CustomerAccessForm = {
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  permissions: Record<string, PermissionAction[]>;
};

type CustomerImportMappingKey = "fullName" | "email";

type CustomerImportMapping = Partial<Record<CustomerImportMappingKey, string>>;

type CustomerImportStep = "upload" | "mapping" | "result";

type CustomerImportResultRow = {
  id: string;
  rowNumber: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string | null;
  permissions: Record<string, PermissionAction[]>;
  status: "pending" | "creating" | "created" | "failed";
  error?: string | null;
  createdUserId?: string | null;
};

type CustomerAccessPanelProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
};

const PERMISSION_ACTIONS: Array<{ label: string; value: PermissionAction; icon: typeof Eye }> = [
  { label: "Lesen", value: "read", icon: Eye },
  { label: "Schreiben", value: "write", icon: PenLine },
  { label: "Update", value: "update", icon: RefreshCw },
];

const ADMIN_FONT_STACK = "var(--font-inter), Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const PAGE_CATALOG = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items
    .filter((item) => !item.adminOnly)
    .map((item) => ({
      pageKey: item.pageKey,
      groupLabel: group.label,
      label: item.label,
      route: item.href,
      icon: item.icon,
    })),
);

const CUSTOMER_IMPORT_FIELDS: Array<{ key: CustomerImportMappingKey; label: string; required: boolean; hint: string }> = [
  { key: "fullName", label: "Vollständiger Name", required: true, hint: "wird automatisch in Vor- und Nachname getrennt" },
  { key: "email", label: "Login E-Mail", required: true, hint: "wird als Login-Adresse verwendet" },
];

const emptyForm = (): CustomerAccessForm => ({
  firstName: "",
  lastName: "",
  email: "",
  isActive: true,
  permissions: {},
});

function formatName(customer: Pick<CustomerAccessUser, "firstName" | "lastName" | "email">): string {
  const fullName = `${customer.firstName} ${customer.lastName}`.trim();
  return fullName.length > 0 ? fullName : customer.email;
}

function normalizePermissionActions(value: unknown): PermissionAction[] {
  const next = new Set<PermissionAction>();
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (entry === "read" || entry === "write" || entry === "update") next.add(entry);
    });
  } else if (value === "read") {
    next.add("read");
  } else if (value === "read_export") {
    next.add("read");
    next.add("write");
  }
  return PERMISSION_ACTIONS.map((action) => action.value).filter((action) => next.has(action));
}

function normalizePermissions(value: unknown): Record<string, PermissionAction[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, PermissionAction[]>>((acc, [pageKey, rawActions]) => {
    const actions = normalizePermissionActions(rawActions);
    if (actions.length > 0) acc[pageKey] = actions;
    return acc;
  }, {});
}

export function CustomerAccessPanel({ open, anchorRect, onClose }: CustomerAccessPanelProps) {
  const [customers, setCustomers] = useState<CustomerAccessUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerAccessForm>(() => emptyForm());
  const [searchTerm, setSearchTerm] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isExportingCustomers, setIsExportingCustomers] = useState(false);
  const [exportCustomersError, setExportCustomersError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || hasLoaded) return;
    setIsLoading(true);
    setError(null);
    fetchCustomerAccessUsers()
      .then((rows) => {
        setCustomers(rows);
        setSelectedId(rows[0]?.id ?? null);
        setHasLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof BackendApiError ? err.message : "Kundenzugänge konnten nicht geladen werden.");
      })
      .finally(() => setIsLoading(false));
  }, [hasLoaded, open]);

  useEffect(() => {
    if (!open) return;
    setEntered(false);
    const animationFrame = window.requestAnimationFrame(() => setEntered(true));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const selectedCustomer = useMemo(() => {
    if (!selectedId) return null;
    return customers.find((customer) => customer.id === selectedId) ?? null;
  }, [customers, selectedId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setForm(emptyForm());
      return;
    }
    setForm({
      firstName: selectedCustomer.firstName,
      lastName: selectedCustomer.lastName,
      email: selectedCustomer.email,
      isActive: selectedCustomer.isActive,
      permissions: { ...selectedCustomer.permissions },
    });
  }, [selectedCustomer]);

  const panelLayout = useMemo(() => {
    if (!anchorRect || typeof window === "undefined") {
      return { left: 86, top: 16, maxHeight: "calc(100vh - 32px)" };
    }
    const width = 820;
    const left = Math.max(72, Math.min(anchorRect.right + 16, window.innerWidth - width - 16));
    const top = Math.max(12, Math.min(anchorRect.top - 12, window.innerHeight - 560));
    const heightPx = Math.max(420, window.innerHeight - top - 16);
    return { left, top, maxHeight: `${heightPx}px` };
  }, [anchorRect]);

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...customers]
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .filter((customer) => {
        if (!query) return true;
        const haystack = `${customer.firstName} ${customer.lastName} ${customer.email}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [customers, searchTerm]);

  const permissionCount = Object.keys(form.permissions).length;
  const actionCount = Object.values(form.permissions).reduce((sum, actions) => sum + actions.length, 0);
  const canSave = form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && form.email.trim().length > 0 && !isSaving;

  const handleExportCustomers = useCallback(async () => {
    if (customers.length === 0 || isExportingCustomers) return;
    setIsExportingCustomers(true);
    setExportCustomersError(null);
    try {
      await exportCustomerAccessUsers(
        customers,
        oneTimePassword && selectedCustomer ? { userId: selectedCustomer.id, password: oneTimePassword } : null,
      );
    } catch {
      setExportCustomersError("Loginliste konnte nicht exportiert werden.");
    } finally {
      setIsExportingCustomers(false);
    }
  }, [customers, isExportingCustomers, oneTimePassword, selectedCustomer]);

  const togglePageAccess = useCallback((pageKey: string) => {
    setForm((prev) => {
      const permissions = { ...prev.permissions };
      if (permissions[pageKey]?.length) {
        delete permissions[pageKey];
      } else {
        permissions[pageKey] = ["read"];
      }
      return { ...prev, permissions };
    });
  }, []);

  const togglePermissionAction = useCallback((pageKey: string, action: PermissionAction) => {
    setForm((prev) => {
      const current = new Set(prev.permissions[pageKey] ?? []);
      if (current.has(action)) {
        current.delete(action);
      } else {
        current.add(action);
      }
      const permissions = { ...prev.permissions };
      const actions = PERMISSION_ACTIONS.map((entry) => entry.value).filter((entry) => current.has(entry));
      if (actions.length > 0) {
        permissions[pageKey] = actions;
      } else {
        delete permissions[pageKey];
      }
      return { ...prev, permissions };
    });
  }, []);

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setSavedPulse(false);
    setError(null);
    setOneTimePassword(null);
    setPasswordCopied(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    setOneTimePassword(null);
    setPasswordCopied(false);
    try {
      if (selectedCustomer) {
        const updated = await updateCustomerAccessUser({
          id: selectedCustomer.id,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          isActive: form.isActive,
          permissions: normalizePermissions(form.permissions),
        });
        setCustomers((prev) => prev.map((customer) => (customer.id === updated.id ? updated : customer)));
      } else {
        const created = await createCustomerAccessUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          isActive: form.isActive,
          permissions: normalizePermissions(form.permissions),
        });
        setCustomers((prev) => [created.user, ...prev]);
        setSelectedId(created.user.id);
        setOneTimePassword(created.oneTimePassword);
      }
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1400);
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : "Kundenzugang konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return (
    <div
      className="customer-access-root"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "transparent",
        fontFamily: ADMIN_FONT_STACK,
      }}
    >
      <div
        style={{
          position: "fixed",
          left: panelLayout.left,
          top: panelLayout.top,
          width: "min(820px, calc(100vw - 32px))",
          maxHeight: panelLayout.maxHeight,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          boxShadow: "0 18px 42px rgba(15,23,42,0.15), 0 3px 10px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.88)",
          display: "flex",
          flexDirection: "column",
          transform: entered ? "translateX(0)" : "translateX(-12px)",
          transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease",
          opacity: entered ? 1 : 0,
        }}
      >
        <style>{`
          .customer-access-root,
          .customer-access-root * {
            font-family: ${ADMIN_FONT_STACK};
          }
          .customer-access-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .customer-access-scroll::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
        `}</style>

        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(15,23,42,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 11,
                border: "1px solid rgba(220,38,38,0.14)",
                background: "linear-gradient(180deg, rgba(254,242,242,0.98), rgba(255,255,255,0.94))",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#dc2626",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(220,38,38,0.08)",
              }}
            >
              <Building2 size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Kundenzugang verwalten</div>
              <div style={{ fontSize: 11, color: "rgba(15,23,42,0.56)" }}>Coca-Cola Accounts und Seitenrechte</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "linear-gradient(180deg, #ffffff, #f8fafc)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(15,23,42,0.62)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "286px minmax(0, 1fr)", minHeight: 520, overflow: "hidden" }}>
          <aside style={{ padding: 16, borderRight: "1px solid rgba(15,23,42,0.06)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Kundenkonten</div>
                <div style={{ marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.52)" }}>
                  {isLoading ? "Wird geladen..." : `${customers.length} Kundenzugänge`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={handleExportCustomers}
                  disabled={customers.length === 0 || isExportingCustomers}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: customers.length === 0 ? "rgba(248,250,252,0.78)" : "linear-gradient(180deg, #ffffff, #f8fafc)",
                    cursor: customers.length === 0 || isExportingCustomers ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: customers.length === 0 ? "rgba(15,23,42,0.28)" : "#0f172a",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                    opacity: customers.length === 0 ? 0.72 : 1,
                  }}
                  aria-label="Loginliste exportieren"
                  title="Loginliste exportieren"
                >
                  {isExportingCustomers ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0f172a",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                  }}
                  aria-label="Kundenzugänge importieren"
                  title="Kundenzugänge importieren"
                >
                  <Upload size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNew}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0f172a",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                  }}
                  aria-label="Neuen Kundenzugang erstellen"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.09)",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
              }}
            >
              <Search size={13} color="rgba(15,23,42,0.42)" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name oder E-Mail suchen"
                style={{
                  minWidth: 0,
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 11,
                  color: "#0f172a",
                }}
              />
            </div>

            {exportCustomersError ? (
              <div
                style={{
                  marginTop: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(220,38,38,0.18)",
                  background: "rgba(254,242,242,0.82)",
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 750,
                  color: "#dc2626",
                }}
              >
                {exportCustomersError}
              </div>
            ) : null}

            <div className="customer-access-scroll" style={{ marginTop: 12, maxHeight: 430, overflowY: "auto", paddingRight: 4 }}>
              {isLoading ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(255,255,255,0.78)",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(15,23,42,0.58)",
                  }}
                >
                  <Loader2 size={13} className="animate-spin" />
                  Kundenzugänge werden geladen...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px dashed rgba(15,23,42,0.14)",
                    background: "rgba(255,255,255,0.72)",
                    padding: 14,
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: "rgba(15,23,42,0.58)",
                  }}
                >
                  Noch keine Kundenzugänge. Erstelle rechts den ersten Coca-Cola Account.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredCustomers.map((customer) => {
                    const isSelected = customer.id === selectedId;
                    const pages = Object.keys(customer.permissions).length;
                    const rights = Object.values(customer.permissions).reduce((sum, actions) => sum + actions.length, 0);
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(customer.id);
                          setOneTimePassword(null);
                          setPasswordCopied(false);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          borderRadius: 12,
                          border: isSelected ? "1px solid rgba(220,38,38,0.28)" : "1px solid rgba(15,23,42,0.08)",
                          background: isSelected
                            ? "linear-gradient(180deg, rgba(254,242,242,0.94), #ffffff)"
                            : customer.isActive
                            ? "#ffffff"
                            : "rgba(248,250,252,0.86)",
                          padding: 12,
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "0 5px 14px rgba(220,38,38,0.08), inset 0 1px 0 rgba(255,255,255,0.9)"
                            : "inset 0 1px 0 rgba(255,255,255,0.85)",
                          opacity: customer.isActive ? 1 : 0.7,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {formatName(customer)}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 10, color: "rgba(15,23,42,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {customer.email}
                            </div>
                          </div>
                          <span
                            style={{
                              alignSelf: "flex-start",
                              borderRadius: 999,
                              padding: "3px 7px",
                              fontSize: 9,
                              fontWeight: 800,
                              color: customer.isActive ? "#047857" : "#64748b",
                              background: customer.isActive ? "rgba(5,150,105,0.12)" : "rgba(100,116,139,0.14)",
                            }}
                          >
                            {customer.isActive ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                          <span style={{ borderRadius: 999, background: "rgba(15,23,42,0.05)", padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.66)" }}>
                            {pages} Seiten
                          </span>
                          <span style={{ borderRadius: 999, background: "rgba(15,23,42,0.05)", padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "rgba(15,23,42,0.66)" }}>
                            {rights} Rechte
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <form onSubmit={handleSave} style={{ minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                    {selectedCustomer ? "Kundenzugang bearbeiten" : "Neuen Kundenzugang erstellen"}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.55)" }}>
                    Rolle Kunde mit persistenten Seitenrechten.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNew}
                  style={{
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    padding: "0 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f172a",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                  }}
                >
                  <Plus size={12} />
                  Neu
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  style={{
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    padding: "0 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f172a",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
                  }}
                >
                  <Upload size={12} />
                  Importieren
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={form.firstName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Vorname"
                  autoComplete="given-name"
                  style={{
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.12)",
                    padding: "0 10px",
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                />
                <input
                  value={form.lastName}
                  onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Nachname"
                  autoComplete="family-name"
                  style={{
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.12)",
                    padding: "0 10px",
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                />
              </div>

              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 148px", gap: 8 }}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="E-Mail"
                  autoComplete="email"
                  style={{
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.12)",
                    padding: "0 10px",
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                />
                <div
                  style={{
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "#ffffff",
                    padding: 3,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 3,
                  }}
                >
                  {[
                    { label: "Aktiv", value: true },
                    { label: "Inaktiv", value: false },
                  ].map((option) => {
                    const active = form.isActive === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, isActive: option.value }))}
                        style={{
                          border: "none",
                          borderRadius: 7,
                          background: active ? "linear-gradient(180deg, #0f172a, #020617)" : "transparent",
                          color: active ? "#fff" : "rgba(15,23,42,0.55)",
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: "pointer",
                          boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 5px rgba(15,23,42,0.18)" : undefined,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 7 }}>
                {[
                  { label: `${permissionCount} Seiten`, icon: ShieldCheck },
                  { label: `${actionCount} Rechte`, icon: Check },
                  { label: form.isActive ? "Aktiv" : "Inaktiv", icon: Check },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <span
                      key={pill.label}
                      style={{
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,0.08)",
                        background: "linear-gradient(180deg, #ffffff, rgba(248,250,252,0.95))",
                        padding: "5px 9px",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "rgba(15,23,42,0.68)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                      }}
                    >
                      <Icon size={11} />
                      {pill.label}
                    </span>
                  );
                })}
              </div>

              {error ? (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(220,38,38,0.18)",
                    background: "rgba(254,242,242,0.92)",
                    color: "#b91c1c",
                    padding: "8px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {oneTimePassword ? (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(5,150,105,0.18)",
                    background: "linear-gradient(180deg, rgba(236,253,245,0.96), #ffffff)",
                    padding: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(5,95,70,0.62)" }}>
                      Einmalpasswort
                    </div>
                    <div style={{ marginTop: 3, fontSize: 13, fontWeight: 900, color: "#064e3b", letterSpacing: "0.02em" }}>
                      {oneTimePassword}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(oneTimePassword);
                        setPasswordCopied(true);
                        window.setTimeout(() => setPasswordCopied(false), 1400);
                      } catch {
                        setPasswordCopied(false);
                      }
                    }}
                    style={{
                      height: 30,
                      borderRadius: 9,
                      border: "1px solid rgba(5,150,105,0.18)",
                      background: "linear-gradient(180deg, #ffffff, rgba(236,253,245,0.9))",
                      cursor: "pointer",
                      color: "#047857",
                      fontSize: 10,
                      fontWeight: 900,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0 9px",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(5,150,105,0.08)",
                    }}
                  >
                    <Copy size={11} />
                    {passwordCopied ? "Kopiert" : "Kopieren"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="customer-access-scroll" style={{ padding: 16, overflowY: "auto", maxHeight: 360 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.45)" }}>
                    Seitenrechte
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10, color: "rgba(15,23,42,0.52)" }}>
                    Pro Seite Zugriff und Exportrecht festlegen.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, permissions: {} }))}
                  style={{
                    height: 28,
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                    cursor: "pointer",
                    color: "rgba(15,23,42,0.58)",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "0 9px",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  Alle abwählen
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ADMIN_NAV_GROUPS.map((group) => (
                  <section key={group.label}>
                    <div style={{ marginBottom: 7, fontSize: 10, fontWeight: 900, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {group.label}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {group.items.filter((item) => !item.adminOnly).map((item) => {
                        const page = PAGE_CATALOG.find((entry) => entry.route === item.href);
                        if (!page) return null;
                        const Icon = page.icon;
                        const currentActions = form.permissions[page.pageKey] ?? [];
                        const enabled = currentActions.length > 0;
                        return (
                          <div
                            key={page.pageKey}
                            style={{
                              borderRadius: 12,
                              border: enabled ? "1px solid rgba(220,38,38,0.18)" : "1px solid rgba(15,23,42,0.07)",
                              background: enabled ? "linear-gradient(180deg, rgba(254,242,242,0.76), #ffffff)" : "#ffffff",
                              padding: 10,
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) 236px 44px",
                              alignItems: "center",
                              gap: 10,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92)",
                            }}
                          >
                            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 9,
                                  background: enabled ? "rgba(220,38,38,0.1)" : "rgba(15,23,42,0.04)",
                                  color: enabled ? "#dc2626" : "rgba(15,23,42,0.45)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Icon size={14} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{page.label}</div>
                                <div style={{ marginTop: 2, fontSize: 10, color: "rgba(15,23,42,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {page.route}
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                height: 30,
                                borderRadius: 9,
                                border: "1px solid rgba(15,23,42,0.08)",
                                background: enabled ? "#ffffff" : "rgba(248,250,252,0.78)",
                                padding: 3,
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 3,
                                opacity: enabled ? 1 : 0.48,
                              }}
                            >
                              {PERMISSION_ACTIONS.map((option) => {
                                const OptionIcon = option.icon;
                                const active = currentActions.includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => togglePermissionAction(page.pageKey, option.value)}
                                    style={{
                                      border: "none",
                                      borderRadius: 7,
                                      background: active ? "linear-gradient(180deg, #0f172a, #020617)" : "transparent",
                                      color: active ? "#fff" : "rgba(15,23,42,0.55)",
                                      fontSize: 10,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 4,
                                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 5px rgba(15,23,42,0.18)" : undefined,
                                    }}
                                  >
                                    <OptionIcon size={10} />
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePageAccess(page.pageKey)}
                              aria-label={enabled ? `${page.label} deaktivieren` : `${page.label} aktivieren`}
                              style={{
                                width: 30,
                                height: 30,
                                justifySelf: "end",
                                borderRadius: 8,
                                border: "none",
                                background: enabled
                                  ? "linear-gradient(180deg, #10b981, #059669)"
                                  : "linear-gradient(180deg, #ef4444, #dc2626)",
                                color: "#ffffff",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: enabled
                                  ? "inset 0 1px 0 rgba(255,255,255,0.24), 0 4px 10px rgba(5,150,105,0.22)"
                                  : "inset 0 1px 0 rgba(255,255,255,0.24), 0 4px 10px rgba(220,38,38,0.22)",
                              }}
                            >
                              {enabled ? <Check size={12} strokeWidth={2.1} /> : <X size={12} strokeWidth={2.1} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(15,23,42,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: savedPulse ? "#047857" : "rgba(15,23,42,0.46)" }}>
                {savedPulse ? "Gespeichert." : "Rechte werden direkt im Backend gespeichert."}
              </div>
              <button
                type="submit"
                disabled={!canSave}
                style={{
                  height: 34,
                  minWidth: 158,
                  borderRadius: 9,
                  border: "none",
                  background: "linear-gradient(180deg, #ef4444, #dc2626)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: canSave ? "pointer" : "not-allowed",
                  opacity: canSave ? 1 : 0.58,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 4px 10px rgba(220,38,38,0.22)",
                }}
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                {selectedCustomer ? "Änderungen speichern" : "Kundenzugang erstellen"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {importOpen ? (
        <CustomerAccessImportModal
          onClose={() => setImportOpen(false)}
          onImported={(createdUsers) => {
            if (createdUsers.length === 0) return;
            setCustomers((prev) => {
              const existingIds = new Set(prev.map((customer) => customer.id));
              return [...createdUsers.filter((customer) => !existingIds.has(customer.id)), ...prev];
            });
            setHasLoaded(true);
          }}
        />
      ) : null}
    </div>
  );
}

function validateCustomerImportMapping(mapping: CustomerImportMapping) {
  const fieldErrors: Partial<Record<CustomerImportMappingKey, string>> = {};
  const duplicateErrors: Partial<Record<CustomerImportMappingKey, string>> = {};
  const seen = new Map<string, CustomerImportMappingKey>();

  CUSTOMER_IMPORT_FIELDS.forEach((field) => {
    const value = (mapping[field.key] ?? "").trim().toUpperCase();
    if (field.required && !value) {
      fieldErrors[field.key] = "Pflichtfeld";
      return;
    }
    if (value && !isValidColLetter(value)) {
      fieldErrors[field.key] = "Ungültige Spalte";
      return;
    }
    if (!value) return;
    const existing = seen.get(value);
    if (existing) {
      duplicateErrors[field.key] = `Selbe Spalte wie ${existing}`;
      duplicateErrors[existing] = `Selbe Spalte wie ${field.key}`;
      return;
    }
    seen.set(value, field.key);
  });

  return {
    fieldErrors,
    duplicateErrors,
    canImport: Object.keys(fieldErrors).length === 0 && Object.keys(duplicateErrors).length === 0,
  };
}

function splitFullNamePreview(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function getCustomerImportCell(row: string[] | undefined, colLetter: string | undefined): string {
  if (!row || !colLetter || !isValidColLetter(colLetter)) return "";
  return String(row[excelColToIndex(colLetter)] ?? "").trim();
}

function buildCustomerImportRows(rows: string[][], mapping: CustomerImportMapping): CustomerImportResultRow[] {
  return rows
    .slice(1)
    .map((row, index) => {
      const fullName = getCustomerImportCell(row, mapping.fullName);
      const { firstName, lastName } = splitFullNamePreview(fullName);
      const email = getCustomerImportCell(row, mapping.email);
      return {
        id: `customer-import-${index + 2}-${email || fullName || index}`,
        rowNumber: index + 2,
        fullName,
        firstName,
        lastName,
        email,
        password: null,
        permissions: {},
        status: "pending" as const,
        error: null,
        createdUserId: null,
      };
    })
    .filter((row) => row.fullName || row.email);
}

function countPermissionActions(permissions: Record<string, PermissionAction[]>): number {
  return Object.values(permissions).reduce((sum, actions) => sum + actions.length, 0);
}

function getPermissionActionLabel(action: PermissionAction): string {
  if (action === "read") return "Lesen";
  if (action === "write") return "Schreiben";
  return "Update";
}

function describePermissions(permissions: Record<string, PermissionAction[]>): string {
  const rows = Object.entries(permissions)
    .filter(([, actions]) => actions.length > 0)
    .map(([pageKey, actions]) => {
      const page = PAGE_CATALOG.find((entry) => entry.pageKey === pageKey);
      const label = page?.label ?? pageKey;
      return `${label}: ${actions.map(getPermissionActionLabel).join(", ")}`;
    });
  return rows.length > 0 ? rows.join(" | ") : "Keine Rechte";
}

async function exportCustomerImportRows(rows: CustomerImportResultRow[]) {
  const XLSX = await import("xlsx");
  const exportRows = rows.map((row) => ({
    Name: row.fullName,
    Vorname: row.firstName,
    Nachname: row.lastName,
    "E-Mail": row.email,
    Initialpasswort: row.password ?? "",
    Seiten: Object.keys(row.permissions).length,
    Rechte: countPermissionActions(row.permissions),
    Zugangsberechtigungen: describePermissions(row.permissions),
  }));
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 80 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kundenzugaenge");
  XLSX.writeFile(workbook, `kundenzugaenge-zugangsdaten-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportCustomerAccessUsers(
  rows: CustomerAccessUser[],
  latestPassword: { userId: string; password: string } | null,
) {
  const XLSX = await import("xlsx");
  const exportRows = rows
    .slice()
    .sort((a, b) => formatName(a).localeCompare(formatName(b), "de"))
    .map((row) => ({
      Name: formatName(row),
      Vorname: row.firstName,
      Nachname: row.lastName,
      Email: row.email,
      Login: row.email,
      Passwort:
        latestPassword?.userId === row.id
          ? latestPassword.password
          : "Nicht verfuegbar - nur beim Erstellen oder Import sichtbar",
      Status: row.isActive ? "Aktiv" : "Inaktiv",
      Seiten: Object.keys(row.permissions).length,
      Rechte: countPermissionActions(row.permissions),
      Zugriffe: describePermissions(row.permissions),
    }));
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 34 },
    { wch: 34 },
    { wch: 48 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 86 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kundenzugaenge");
  XLSX.writeFile(workbook, `kundenzugaenge-loginliste-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function CustomerAccessImportModal({ onClose, onImported }: { onClose: () => void; onImported: (createdUsers: CustomerAccessUser[]) => void }) {
  const [step, setStep] = useState<CustomerImportStep>("upload");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [workbookRows, setWorkbookRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CustomerImportMapping>({ fullName: "A", email: "B" });
  const [importRows, setImportRows] = useState<CustomerImportResultRow[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isReadingWorkbook, setIsReadingWorkbook] = useState(false);
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);
  const preview = useMemo(() => buildPreviewGrid(workbookRows), [workbookRows]);
  const validation = useMemo(() => validateCustomerImportMapping(mapping), [mapping]);
  const fullNameSample = getColSample(workbookRows, mapping.fullName ?? "");
  const emailSample = getColSample(workbookRows, mapping.email ?? "");
  const splitPreview = splitFullNamePreview(fullNameSample);
  const assignedRows = importRows.filter((row) => Object.keys(row.permissions).length > 0).length;
  const generatedPasswords = importRows.filter((row) => row.password).length;
  const createdRows = importRows.filter((row) => row.status === "created").length;
  const failedRows = importRows.filter((row) => row.status === "failed").length;
  const canCreateAccounts = importRows.length > 0 && !isCreatingAccounts && importRows.every((row) => row.email && row.firstName && row.lastName && Object.keys(row.permissions).length > 0);

  const handleWorkbookFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
      setParseError("Bitte eine Excel-Datei (.xlsx oder .xls) auswählen.");
      return;
    }
    setIsReadingWorkbook(true);
    setParseError(null);
    try {
      const parsed = await readWorkbook(file);
      if (parsed.rows.length < 2 || parsed.colCount < 1) {
        setParseError("Die Datei enthält keine Datenzeilen.");
        return;
      }
      setFileName(file.name);
      setSheetName(parsed.sheetName);
      setWorkbookRows(parsed.rows);
      setImportRows([]);
      setExpandedRowId(null);
      setExportError(null);
      setMapping({ fullName: "A", email: "B" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStep("mapping");
    } catch {
      setParseError("Excel-Datei konnte nicht gelesen werden.");
    } finally {
      setIsReadingWorkbook(false);
    }
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openResultStep = useCallback(() => {
    const rows = buildCustomerImportRows(workbookRows, mapping);
    setImportRows(rows);
    setExpandedRowId(rows[0]?.id ?? null);
    setExportError(null);
    setStep("result");
  }, [mapping, workbookRows]);

  const toggleImportedPageAccess = useCallback((rowId: string, pageKey: string) => {
    setImportRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const permissions = { ...row.permissions };
        if (permissions[pageKey]?.length) {
          delete permissions[pageKey];
        } else {
          permissions[pageKey] = ["read"];
        }
        return { ...row, permissions };
      }),
    );
  }, []);

  const toggleImportedPermissionAction = useCallback((rowId: string, pageKey: string, action: PermissionAction) => {
    setImportRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const current = new Set(row.permissions[pageKey] ?? []);
        if (current.has(action)) {
          current.delete(action);
        } else {
          current.add(action);
        }
        const actions = PERMISSION_ACTIONS.map((entry) => entry.value).filter((entry) => current.has(entry));
        const permissions = { ...row.permissions };
        if (actions.length > 0) {
          permissions[pageKey] = actions;
        } else {
          delete permissions[pageKey];
        }
        return { ...row, permissions };
      }),
    );
  }, []);

  const createAccountsAndExport = useCallback(async () => {
    if (!canCreateAccounts) return;
    setIsCreatingAccounts(true);
    setExportError(null);
    const workingRows = importRows.map((row) => ({ ...row }));
    const createdUsers: CustomerAccessUser[] = [];
    const createdCredentialRows: CustomerImportResultRow[] = [];

    for (let index = 0; index < workingRows.length; index += 1) {
      const row = workingRows[index];
      if (!row || row.status === "created") continue;

      workingRows[index] = { ...row, status: "creating", error: null };
      setImportRows([...workingRows]);

      try {
        const created = await createCustomerAccessUser({
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.trim(),
          isActive: true,
          permissions: normalizePermissions(row.permissions),
        });
        const createdRow: CustomerImportResultRow = {
          ...row,
          status: "created",
          password: created.oneTimePassword ?? "",
          error: null,
          createdUserId: created.user.id,
        };
        workingRows[index] = createdRow;
        createdUsers.push(created.user);
        createdCredentialRows.push(createdRow);
      } catch (err) {
        workingRows[index] = {
          ...row,
          status: "failed",
          error: err instanceof BackendApiError ? err.message : "Kundenzugang konnte nicht erstellt werden.",
        };
      }
      setImportRows([...workingRows]);
    }

    setIsCreatingAccounts(false);
    if (createdUsers.length > 0) onImported(createdUsers);

    const allCreated = workingRows.length > 0 && workingRows.every((row) => row.status === "created");
    const rowsToExport =
      createdCredentialRows.length > 0
        ? createdCredentialRows
        : workingRows.filter((row) => row.status === "created" && Boolean(row.password));

    if (rowsToExport.length > 0) {
      try {
        await exportCustomerImportRows(rowsToExport);
      } catch {
        setExportError("Accounts wurden erstellt, aber die Excel-Datei konnte nicht heruntergeladen werden. Erstellen erneut drücken, um den Export zu wiederholen.");
        return;
      }
    }

    if (!allCreated) {
      setExportError(
        rowsToExport.length > 0
          ? "Die Zugangsdaten der erstellten Accounts wurden heruntergeladen. Fehlgeschlagene Zeilen prüfen und erneut starten."
          : "Einige Accounts konnten nicht erstellt werden. Fehler prüfen und erneut starten.",
      );
    }
  }, [canCreateAccounts, importRows, onImported]);

  const modalWidth = step === "result" ? 1040 : step === "mapping" ? 860 : 520;
  const stepTitle = step === "upload" ? "Kundenzugänge importieren" : step === "mapping" ? "Spalten zuweisen" : "Import prüfen";
  const stepSubtitle =
    step === "upload"
      ? "Excel-Datei ziehen oder auswählen"
      : step === "mapping"
      ? `${fileName} · ${sheetName || "Tabelle 1"} · ${Math.max(0, workbookRows.length - 1)} Datenzeilen`
      : `${importRows.length} Logins · Rechte pro Person zuweisen · Backend-Accounts erstellen`;

  return (
    <div
      className="customer-import-root"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1360,
        background: "rgba(15,23,42,0.28)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: ADMIN_FONT_STACK,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: modalWidth,
          maxHeight: "92vh",
          borderRadius: 18,
          background: "#ffffff",
          boxShadow: "0 24px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "max-width 0.22s cubic-bezier(0.4,0,0.2,1)",
          fontFamily: "inherit",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <style>{`
          .customer-import-root,
          .customer-import-root * {
            font-family: ${ADMIN_FONT_STACK};
          }
          @keyframes customerImportIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          .customer-import-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
          .customer-import-scroll::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.14); border-radius: 4px; }
          .customer-import-scroll::-webkit-scrollbar-track { background: transparent; }
          .customer-import-input:focus { outline: none; border-color: rgba(220,38,38,0.42) !important; background: #fff !important; }
        `}</style>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileSpreadsheet size={16} strokeWidth={1.8} color="#DC2626" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
              {stepTitle}
            </div>
            <div style={{ marginTop: 1, fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>
              {stepSubtitle}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 8 }}>
            {(["upload", "mapping", "result"] as CustomerImportStep[]).map((item) => {
              const active = item === step;
              const done = (step === "mapping" && item === "upload") || (step === "result" && item !== "result");
              return <div key={item} style={{ width: active ? 18 : 6, height: 6, borderRadius: 99, transition: "all 0.2s ease", background: done ? "#16a34a" : active ? "#DC2626" : "rgba(0,0,0,0.12)" }} />;
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.4)", flexShrink: 0, transition: "background 0.12s ease" }}
            onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {step === "upload" ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(event) => void handleWorkbookFile(event.target.files?.[0])}
            />
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleWorkbookFile(event.dataTransfer.files?.[0]);
              }}
              onClick={openFilePicker}
              style={{
                border: `2px dashed ${dragging ? "#DC2626" : "rgba(0,0,0,0.10)"}`,
                borderRadius: 12,
                padding: "42px 20px",
                background: dragging ? "rgba(220,38,38,0.03)" : "rgba(0,0,0,0.012)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: "pointer",
                transition: "all 0.18s ease",
                textAlign: "center",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: dragging ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.045)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                {isReadingWorkbook ? <Loader2 size={22} strokeWidth={1.6} color="#DC2626" className="animate-spin" /> : <FileSpreadsheet size={22} strokeWidth={1.5} color={dragging ? "#DC2626" : "rgba(0,0,0,0.28)"} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? "#DC2626" : "#1a1a1a", marginBottom: 4 }}>
                  {isReadingWorkbook ? "Excel-Datei wird gelesen..." : "Excel-Datei hier ablegen"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>oder klicken zum Auswählen · .xlsx, .xls</div>
              </div>
            </div>
            <div style={{ borderRadius: 10, border: "1px solid rgba(15,23,42,0.07)", background: "rgba(15,23,42,0.018)", padding: "10px 12px", fontSize: 10, color: "rgba(15,23,42,0.52)", lineHeight: 1.5 }}>
              Erste Zeile ist die Überschrift. Die Spalte für vollständigen Namen wird später automatisch in Vorname und Nachname getrennt.
            </div>
            {parseError ? (
              <div style={{ borderRadius: 10, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(254,242,242,0.92)", padding: "9px 11px", fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>
                {parseError}
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : step === "mapping" ? (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "0 0 218px", overflow: "auto", borderBottom: "1px solid rgba(0,0,0,0.06)" }} className="customer-import-scroll">
              <table style={{ borderCollapse: "collapse", fontSize: 10, fontVariantNumeric: "tabular-nums", tableLayout: "fixed", minWidth: "max-content" }}>
                <colgroup>
                  <col style={{ width: 36 }} />
                  {preview.colLetters.map((letter) => <col key={letter} style={{ width: 130 }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)", width: 36, minWidth: 36 }} />
                    {preview.colLetters.map((letter) => (
                      <th key={letter} style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8f8f8", borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "rgba(0,0,0,0.45)", fontSize: 9, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{letter}</th>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ position: "sticky", left: 0, zIndex: 2, background: "#f8f8f8", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "4px 6px", textAlign: "right", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.28)", whiteSpace: "nowrap" }}>1</td>
                    {preview.headerRow.map((header, index) => (
                      <td key={index} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.04)", padding: "4px 8px", fontWeight: 600, color: "#1a1a1a", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{header}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, rowIndex) => (
                    <tr key={preview.rowNumbers[rowIndex]} style={{ background: rowIndex % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)" }}>
                      <td style={{ position: "sticky", left: 0, zIndex: 1, background: rowIndex % 2 === 0 ? "#f8f8f8" : "#f3f3f3", borderRight: "1px solid rgba(0,0,0,0.06)", padding: "3px 6px", textAlign: "right", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>{preview.rowNumbers[rowIndex]}</td>
                      {row.map((cell, index) => (
                        <td key={index} style={{ borderRight: "1px solid rgba(0,0,0,0.03)", padding: "3px 8px", color: cell ? "#374151" : "rgba(0,0,0,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{cell || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }} className="customer-import-scroll">
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)", marginBottom: 12 }}>Spaltenzuweisung</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
                {CUSTOMER_IMPORT_FIELDS.map((field) => (
                  <CustomerImportMappingRow
                    key={field.key}
                    field={field}
                    value={mapping[field.key] ?? ""}
                    rows={workbookRows}
                    fieldError={validation.fieldErrors[field.key]}
                    duplicateError={validation.duplicateErrors[field.key]}
                    onChange={(value) => setMapping((prev) => ({ ...prev, [field.key]: value.toUpperCase() }))}
                  />
                ))}
              </div>
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ borderRadius: 10, border: "1px solid rgba(15,23,42,0.07)", background: "rgba(15,23,42,0.018)", padding: "10px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(15,23,42,0.38)" }}>Namenssplit</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#1a1a1a", fontWeight: 700 }}>
                    {splitPreview.firstName || "—"} <span style={{ color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>→ Vorname</span>
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: "#1a1a1a", fontWeight: 700 }}>
                    {splitPreview.lastName || "—"} <span style={{ color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>→ Nachname</span>
                  </div>
                </div>
                <div style={{ borderRadius: 10, border: "1px solid rgba(15,23,42,0.07)", background: "rgba(15,23,42,0.018)", padding: "10px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(15,23,42,0.38)" }}>Login</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#1a1a1a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emailSample || "—"}</div>
                  <div style={{ marginTop: 3, fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>wird später als Login-E-Mail verwendet</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", marginTop: 12 }}>
                Spaltenangabe als Excel-Buchstaben · <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>A = 1. Spalte · Z = 26. · AA = 27.</span>
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setStep("upload")}
                style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}
              >
                ← Zurück
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!validation.canImport ? (
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.38)", fontWeight: 500 }}>Pflichtfelder und doppelte Spalten prüfen</span>
                ) : (
                  <span style={{ fontSize: 10, color: "rgba(22,163,74,0.82)", fontWeight: 700 }}>{Math.max(0, workbookRows.length - 1)} Zeilen bereit</span>
                )}
                <button
                  type="button"
                  disabled={!validation.canImport}
                  onClick={openResultStep}
                  style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: "none", cursor: validation.canImport ? "pointer" : "not-allowed", color: "#fff", background: validation.canImport ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(0,0,0,0.15)", boxShadow: validation.canImport ? "inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)" : "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s ease", opacity: validation.canImport ? 1 : 0.7, fontFamily: "inherit" }}
                >
                  <Upload size={11} strokeWidth={2} />
                  Import prüfen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {[
                { label: "Logins", value: importRows.length, muted: "aus Import" },
                { label: "Zugewiesen", value: assignedRows, muted: `${importRows.length - assignedRows} offen` },
                { label: "Erstellt", value: createdRows, muted: failedRows ? `${failedRows} Fehler` : "Backend" },
                { label: "Export", value: generatedPasswords, muted: canCreateAccounts || createdRows === importRows.length ? "Excel" : "offen" },
              ].map((card) => (
                <div key={card.label} style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.07)", background: "linear-gradient(180deg,#ffffff,#f8fafc)", padding: "10px 12px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div style={{ fontSize: 8, fontWeight: 900, color: "rgba(15,23,42,0.38)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{card.label}</div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{card.value}</div>
                  <div style={{ marginTop: 1, fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.42)" }}>{card.muted}</div>
                </div>
              ))}
            </div>

            <div className="customer-import-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 20, background: "linear-gradient(180deg,rgba(248,250,252,0.72),#ffffff)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {importRows.map((row) => {
                  const expanded = row.id === expandedRowId;
                  const pageCount = Object.keys(row.permissions).length;
                  const actionCount = countPermissionActions(row.permissions);
                  const statusLabel =
                    row.status === "created" ? "erstellt" : row.status === "creating" ? "wird erstellt" : row.status === "failed" ? "Fehler" : "wartet";
                  const statusColor =
                    row.status === "created" ? "#047857" : row.status === "creating" ? "#0f172a" : row.status === "failed" ? "#dc2626" : "rgba(15,23,42,0.48)";
                  return (
                    <div key={row.id} style={{ borderRadius: 14, border: expanded ? "1px solid rgba(220,38,38,0.20)" : "1px solid rgba(15,23,42,0.08)", background: "#ffffff", boxShadow: expanded ? "0 10px 24px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" : "inset 0 1px 0 rgba(255,255,255,0.9)", overflow: "hidden" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedRowId(expanded ? null : row.id)}
                        style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "12px 14px", display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(160px,0.7fr) minmax(140px,0.55fr) 30px", alignItems: "center", gap: 14, textAlign: "left", fontFamily: "inherit" }}
                      >
                        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 10, background: pageCount ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.08)", color: pageCount ? "#047857" : "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {pageCount ? <ShieldCheck size={14} /> : <KeyRound size={14} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.fullName || row.email || `Zeile ${row.rowNumber}`}</div>
                            <div style={{ marginTop: 2, fontSize: 10, color: "rgba(15,23,42,0.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Zeile {row.rowNumber} · {row.email || "E-Mail fehlt"}</div>
                          </div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)" }}>Rechte</div>
                          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 800, color: pageCount ? "#0f172a" : "#dc2626" }}>{pageCount ? `${pageCount} Seiten · ${actionCount} Rechte` : "noch zuweisen"}</div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.34)" }}>Status</div>
                          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 800, color: statusColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.password ?? statusLabel}</div>
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(15,23,42,0.045)", color: "rgba(15,23,42,0.45)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
                        </div>
                      </button>

                      {expanded ? (
                        <div style={{ borderTop: "1px solid rgba(15,23,42,0.06)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                          {row.error ? (
                            <div style={{ borderRadius: 10, border: "1px solid rgba(220,38,38,0.16)", background: "rgba(254,242,242,0.88)", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>
                              {row.error}
                            </div>
                          ) : null}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            {[
                              { label: "Vorname", value: row.firstName || "—" },
                              { label: "Nachname", value: row.lastName || "—" },
                              { label: "Login", value: row.email || "—" },
                            ].map((item) => (
                              <div key={item.label} style={{ borderRadius: 10, border: "1px solid rgba(15,23,42,0.06)", background: "rgba(248,250,252,0.74)", padding: "8px 10px" }}>
                                <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.35)" }}>{item.label}</div>
                                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                            {ADMIN_NAV_GROUPS.map((group) => (
                              <section key={`${row.id}-${group.label}`} style={{ minWidth: 0 }}>
                                <div style={{ marginBottom: 7, fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.38)" }}>{group.label}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                  {group.items.filter((item) => !item.adminOnly).map((item) => {
                                    const currentActions = row.permissions[item.pageKey] ?? [];
                                    const enabled = currentActions.length > 0;
                                    const Icon = item.icon;
                                    return (
                                      <div key={`${row.id}-${item.pageKey}`} style={{ borderRadius: 11, border: enabled ? "1px solid rgba(220,38,38,0.16)" : "1px solid rgba(15,23,42,0.07)", background: enabled ? "linear-gradient(180deg,rgba(254,242,242,0.74),#fff)" : "#fff", padding: 8, display: "grid", gridTemplateColumns: "minmax(0,1fr) 210px 30px", alignItems: "center", gap: 8 }}>
                                        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                          <div style={{ width: 26, height: 26, borderRadius: 8, background: enabled ? "rgba(220,38,38,0.09)" : "rgba(15,23,42,0.04)", color: enabled ? "#dc2626" : "rgba(15,23,42,0.42)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <Icon size={13} />
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                                            <div style={{ marginTop: 1, fontSize: 9, color: "rgba(15,23,42,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.href}</div>
                                          </div>
                                        </div>
                                        <div style={{ height: 28, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: enabled ? "#fff" : "rgba(248,250,252,0.78)", padding: 3, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, opacity: enabled ? 1 : 0.48 }}>
                                          {PERMISSION_ACTIONS.map((option) => {
                                            const OptionIcon = option.icon;
                                            const active = currentActions.includes(option.value);
                                            return (
                                              <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => toggleImportedPermissionAction(row.id, item.pageKey, option.value)}
                                                style={{ border: "none", borderRadius: 6, background: active ? "linear-gradient(180deg,#0f172a,#020617)" : "transparent", color: active ? "#fff" : "rgba(15,23,42,0.55)", fontSize: 9, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.20),0 2px 4px rgba(15,23,42,0.14)" : undefined }}
                                              >
                                                <OptionIcon size={9} />
                                                {option.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleImportedPageAccess(row.id, item.pageKey)}
                                          aria-label={enabled ? `${item.label} deaktivieren` : `${item.label} aktivieren`}
                                          style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", color: "#fff", background: enabled ? "linear-gradient(180deg,#10b981,#059669)" : "linear-gradient(180deg,#ef4444,#dc2626)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: enabled ? "inset 0 1px 0 rgba(255,255,255,0.24),0 3px 8px rgba(5,150,105,0.18)" : "inset 0 1px 0 rgba(255,255,255,0.24),0 3px 8px rgba(220,38,38,0.18)" }}
                                        >
                                          {enabled ? <Check size={11} strokeWidth={2.2} /> : <X size={11} strokeWidth={2.2} />}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setStep("mapping")}
                style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.05)", fontFamily: "inherit" }}
              >
                ← Mapping
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ minWidth: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: canCreateAccounts ? "#047857" : "#dc2626" }}>
                    {canCreateAccounts ? "Bereit zum Erstellen und Exportieren" : "Jeder Login braucht Name, E-Mail und mindestens eine Seite"}
                  </div>
                  {exportError ? <div style={{ marginTop: 2, fontSize: 9, fontWeight: 700, color: "#dc2626" }}>{exportError}</div> : null}
                </div>
                <button
                  type="button"
                  disabled={!canCreateAccounts}
                  onClick={createAccountsAndExport}
                  style={{ height: 34, padding: "0 16px", fontSize: 11, fontWeight: 800, borderRadius: 9, border: "none", cursor: canCreateAccounts ? "pointer" : "not-allowed", color: "#fff", background: canCreateAccounts ? "linear-gradient(to bottom,#DC2626,#b91c1c)" : "rgba(0,0,0,0.15)", boxShadow: canCreateAccounts ? "inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)" : "none", display: "inline-flex", alignItems: "center", gap: 7, opacity: canCreateAccounts ? 1 : 0.7, fontFamily: "inherit" }}
                >
                  {isCreatingAccounts ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Download size={12} strokeWidth={2} />}
                  {isCreatingAccounts ? "Accounts werden erstellt..." : "Accounts erstellen & Excel exportieren"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerImportMappingRow({
  field,
  value,
  rows,
  fieldError,
  duplicateError,
  onChange,
}: {
  field: { key: CustomerImportMappingKey; label: string; required: boolean; hint: string };
  value: string;
  rows: string[][];
  fieldError?: string;
  duplicateError?: string;
  onChange: (value: string) => void;
}) {
  const error = fieldError || duplicateError;
  const header = value && !error ? getColHeader(rows, value) : "";
  const sample = value && !error ? getColSample(rows, value) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: error ? "#DC2626" : "rgba(0,0,0,0.5)", letterSpacing: "0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.label}</span>
        {field.required ? <span style={{ fontSize: 7, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.07)", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>P</span> : null}
      </div>
      <input
        className="customer-import-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
        placeholder="A"
        maxLength={3}
        style={{ height: 30, borderRadius: 7, border: `1px solid ${error ? "rgba(220,38,38,0.35)" : "rgba(0,0,0,0.10)"}`, background: error ? "rgba(220,38,38,0.035)" : "rgba(0,0,0,0.018)", padding: "0 9px", fontSize: 12, fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", fontFamily: "inherit", transition: "all 0.12s ease" }}
      />
      <div style={{ minHeight: 28 }}>
        {error ? (
          <div style={{ fontSize: 9, color: "#DC2626", fontWeight: 600 }}>{error}</div>
        ) : value ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 8.5, color: "rgba(0,0,0,0.32)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{header || "Keine Überschrift"}</span>
            <span style={{ fontSize: 8.5, color: "rgba(0,0,0,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sample || "Kein Beispielwert"}</span>
          </div>
        ) : (
          <div style={{ fontSize: 8.5, color: "rgba(0,0,0,0.28)", fontWeight: 500 }}>{field.hint}</div>
        )}
      </div>
    </div>
  );
}
