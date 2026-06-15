"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Copy, Eye, Loader2, PenLine, Plus, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "@/components/ui/adminNavigation";
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

const PAGE_CATALOG = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    pageKey: item.pageKey,
    groupLabel: group.label,
    label: item.label,
    route: item.href,
    icon: item.icon,
  })),
);

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "transparent",
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
                      {group.items.map((item) => {
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
    </div>
  );
}
