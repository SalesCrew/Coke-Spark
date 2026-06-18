"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Warehouse } from "lucide-react";
import { createAdminLager, fetchAdminLager, fetchGmUsers, readAuthSession, updateAdminLager } from "@/lib/api/backend";
import { exportLagerExcel } from "@/lib/exports/masterDataExports";
import type { GMRecord } from "@/types/gebietsmanager";
import type { LagerRecord } from "@/types/lager";

const R = "#DC2626";
const R_D = "#b91c1c";
const TABLE_GRID = "1fr 1fr 1fr 1fr";

type LagerFormState = {
  address: string;
  postalCode: string;
  city: string;
  gmUserIds: string[];
};

type GmOption = {
  id: string;
  label: string;
  subLabel?: string;
};

type LagerContextMenu = {
  x: number;
  y: number;
  lagerId: string;
};

const EMPTY_FORM: LagerFormState = {
  address: "",
  postalCode: "",
  city: "",
  gmUserIds: [],
};

export default function LagerPage() {
  const [lagers, setLagers] = useState<LagerRecord[]>([]);
  const [gms, setGms] = useState<GMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingLager, setIsExportingLager] = useState(false);
  const [form, setForm] = useState<LagerFormState>(EMPTY_FORM);
  const [editingLagerId, setEditingLagerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LagerFormState>(EMPTY_FORM);
  const [gmDropdownOpen, setGmDropdownOpen] = useState(false);
  const [editGmDropdownOpen, setEditGmDropdownOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<LagerContextMenu | null>(null);
  const gmDropdownRef = useRef<HTMLDivElement | null>(null);
  const editGmDropdownRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lagerRows, gmRows] = await Promise.all([fetchAdminLager(), fetchGmUsers()]);
      setLagers(lagerRows);
      setGms(gmRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lager konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const gmOptions = useMemo<GmOption[]>(
    () =>
      gms.map((gm) => ({
        id: gm.id,
        label: `${gm.firstName} ${gm.lastName}`,
        subLabel: gm.region,
      })),
    [gms],
  );

  const buildSelectedLabel = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) return "Nicht zugewiesen";
      if (selectedIds.length === 1) {
        const selected = gms.find((gm) => gm.id === selectedIds[0]);
        return selected ? `${selected.firstName} ${selected.lastName}` : "1 GM ausgewählt";
      }
      return `${selectedIds.length} GMs ausgewählt`;
    },
    [gms],
  );

  const selectedCreateLabel = useMemo(() => buildSelectedLabel(form.gmUserIds), [buildSelectedLabel, form.gmUserIds]);
  const selectedEditLabel = useMemo(() => buildSelectedLabel(editForm.gmUserIds), [buildSelectedLabel, editForm.gmUserIds]);

  const editingLager = useMemo(() => {
    if (!editingLagerId) return null;
    return lagers.find((entry) => entry.id === editingLagerId) ?? null;
  }, [editingLagerId, lagers]);
  const contextMenuLager = useMemo(() => {
    if (!contextMenu) return null;
    return lagers.find((entry) => entry.id === contextMenu.lagerId) ?? null;
  }, [contextMenu, lagers]);

  useEffect(() => {
    if (!gmDropdownOpen && !editGmDropdownOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideCreate = gmDropdownRef.current?.contains(target) ?? false;
      const insideEdit = editGmDropdownRef.current?.contains(target) ?? false;
      if (insideCreate || insideEdit) return;
      setGmDropdownOpen(false);
      setEditGmDropdownOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [gmDropdownOpen, editGmDropdownOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const canSubmit = form.address.trim() && form.postalCode.trim() && form.city.trim();
  const canEditSubmit = editForm.address.trim() && editForm.postalCode.trim() && editForm.city.trim();

  const resetCreateForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setGmDropdownOpen(false);
  }, []);

  const resetEditForm = useCallback(() => {
    setEditingLagerId(null);
    setEditForm(EMPTY_FORM);
    setEditGmDropdownOpen(false);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAdminLager({
        address: form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        gmUserIds: form.gmUserIds,
      });
      setLagers((current) => [created, ...current]);
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lager konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, resetCreateForm, submitting]);

  const submitEdit = useCallback(async () => {
    if (!editingLagerId || !canEditSubmit || editSubmitting) return;
    setEditSubmitting(true);
    setError(null);
    try {
      const updated = await updateAdminLager({
        id: editingLagerId,
        address: editForm.address.trim(),
        postalCode: editForm.postalCode.trim(),
        city: editForm.city.trim(),
        gmUserIds: editForm.gmUserIds,
      });
      setLagers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      resetEditForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lager konnte nicht gespeichert werden.");
    } finally {
      setEditSubmitting(false);
    }
  }, [canEditSubmit, editForm, editSubmitting, editingLagerId, resetEditForm]);

  const startEdit = useCallback(
    (entry: LagerRecord) => {
      if (editingLagerId === entry.id) {
        resetEditForm();
        return;
      }
      setEditingLagerId(entry.id);
      setEditForm({
        address: entry.address,
        postalCode: entry.postalCode,
        city: entry.city,
        gmUserIds: [...entry.gmUserIds],
      });
      setContextMenu(null);
      setEditGmDropdownOpen(false);
      setCreateOpen(false);
      resetCreateForm();
    },
    [editingLagerId, resetCreateForm, resetEditForm],
  );

  const handleExportLager = useCallback(async () => {
    if (isExportingLager) return;
    setExportError(null);
    setIsExportingLager(true);
    try {
      await exportLagerExcel({
        lagers,
        gms,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExportingLager(false);
    }
  }, [gms, isExportingLager, lagers]);

  useEffect(() => {
    const handler = () => { void handleExportLager(); };
    window.addEventListener("admin:lager:export", handler);
    return () => window.removeEventListener("admin:lager:export", handler);
  }, [handleExportLager]);

  return (
    <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          margin: "8px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(220,38,38,0.08)", color: R, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Warehouse size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Lager</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)" }}>{lagers.length} gesamt</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (createOpen) {
                  setCreateOpen(false);
                  resetCreateForm();
                  return;
                }
                resetEditForm();
                setCreateOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                background: `linear-gradient(to bottom, ${R}, ${R_D})`,
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #a91b1b, 0 1px 6px rgba(180,20,20,0.14)",
              }}
            >
              <Plus size={12} />
              Neues Lager
            </button>
          </div>
        </div>

        {exportError ? (
          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.14)", fontSize: 10, color: R, fontWeight: 600 }}>
            Export fehlgeschlagen: {exportError}
          </div>
        ) : null}

        {createOpen && (
          <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.58)" }}>Lager erstellen</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr", gap: 8 }}>
              <InputField label="Adresse" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
              <InputField label="PLZ" value={form.postalCode} onChange={(value) => setForm((current) => ({ ...current, postalCode: value }))} />
              <InputField label="Ort" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
            </div>

            <GmMultiSelect
              selectedLabel={selectedCreateLabel}
              selectedIds={form.gmUserIds}
              options={gmOptions}
              open={gmDropdownOpen}
              onToggle={() => setGmDropdownOpen((open) => !open)}
              onSelectIds={(nextIds) => setForm((current) => ({ ...current, gmUserIds: nextIds }))}
              dropdownRef={gmDropdownRef}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "linear-gradient(to bottom, #fff, #f7f7f7)",
                  color: "rgba(0,0,0,0.55)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={() => void submitCreate()}
                style={{
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: canSubmit ? `linear-gradient(to bottom, ${R}, ${R_D})` : "rgba(0,0,0,0.15)",
                  color: canSubmit ? "#fff" : "rgba(0,0,0,0.3)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {submitting ? "Speichert..." : "Lager erstellen"}
              </button>
            </div>
          </div>
        )}

        {editingLagerId && (
          <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.58)" }}>
                Lager bearbeiten{editingLager ? ` - ${editingLager.address}, ${editingLager.city}` : ""}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr", gap: 8 }}>
              <InputField label="Adresse" value={editForm.address} onChange={(value) => setEditForm((current) => ({ ...current, address: value }))} />
              <InputField label="PLZ" value={editForm.postalCode} onChange={(value) => setEditForm((current) => ({ ...current, postalCode: value }))} />
              <InputField label="Ort" value={editForm.city} onChange={(value) => setEditForm((current) => ({ ...current, city: value }))} />
            </div>

            <GmMultiSelect
              selectedLabel={selectedEditLabel}
              selectedIds={editForm.gmUserIds}
              options={gmOptions}
              open={editGmDropdownOpen}
              onToggle={() => setEditGmDropdownOpen((open) => !open)}
              onSelectIds={(nextIds) => setEditForm((current) => ({ ...current, gmUserIds: nextIds }))}
              dropdownRef={editGmDropdownRef}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={resetEditForm}
                style={{
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "linear-gradient(to bottom, #fff, #f7f7f7)",
                  color: "rgba(0,0,0,0.55)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!canEditSubmit || editSubmitting}
                onClick={() => void submitEdit()}
                style={{
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: canEditSubmit ? `linear-gradient(to bottom, ${R}, ${R_D})` : "rgba(0,0,0,0.15)",
                  color: canEditSubmit ? "#fff" : "rgba(0,0,0,0.3)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: canEditSubmit ? "pointer" : "not-allowed",
                }}
              >
                {editSubmitting ? "Speichert..." : "Lager speichern"}
              </button>
            </div>
          </div>
        )}

        <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 0, padding: "8px 14px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            {["Adresse", "PLZ", "Ort", "GM"].map((label) => (
              <span key={label} style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
              </span>
            ))}
          </div>

          {loading ? (
            <LagerTableSkeleton />
          ) : lagers.length === 0 ? (
            <div style={{ padding: "24px 14px", fontSize: 12, color: "rgba(0,0,0,0.4)", textAlign: "center" }}>Noch keine Lager vorhanden.</div>
          ) : (
            lagers.map((entry, index) => (
              <div
                key={entry.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, lagerId: entry.id });
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: TABLE_GRID,
                  gap: 0,
                  padding: "10px 14px",
                  borderBottom: index < lagers.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: index % 2 === 0 ? "#fff" : "rgba(0,0,0,0.01)",
                  alignItems: "center",
                  cursor: "context-menu",
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.address}</span>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.postalCode}</span>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.city}</span>
                <span style={{ fontSize: 11, color: entry.gmNames.length > 0 ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.35)", fontWeight: entry.gmNames.length > 0 ? 600 : 500, paddingRight: 10 }}>
                  {entry.gmNames.length > 0 ? entry.gmNames.join(", ") : "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div style={{ marginTop: -4, fontSize: 10, color: "rgba(0,0,0,0.35)" }}>Rechtsklick auf ein Lager, um Aktionen zu sehen.</div>

        {error && (
          <div style={{ padding: "8px 10px", borderRadius: 8, fontSize: 11, color: "#b91c1c", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
            {error}
          </div>
        )}
      </div>
      {contextMenu && contextMenuLager && typeof document !== "undefined" && typeof window !== "undefined" &&
        createPortal(
          <div
            ref={contextMenuRef}
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 176)),
              top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 52)),
              zIndex: 5000,
              width: 168,
              background: "#fff",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.03)",
              padding: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                startEdit(contextMenuLager);
                setContextMenu(null);
              }}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                borderRadius: 6,
                textAlign: "left",
                padding: "8px 9px",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(0,0,0,0.78)",
                cursor: "pointer",
              }}
            >
              Bearbeiten
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function GmMultiSelect({
  selectedLabel,
  selectedIds,
  options,
  open,
  onToggle,
  onSelectIds,
  dropdownRef,
}: {
  selectedLabel: string;
  selectedIds: string[];
  options: GmOption[];
  open: boolean;
  onToggle: () => void;
  onSelectIds: (nextIds: string[]) => void;
  dropdownRef: { current: HTMLDivElement | null };
}) {
  return (
    <div ref={dropdownRef} style={{ position: "relative", width: 360, maxWidth: "100%" }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Gebietsmanager (optional)</div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          height: 34,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "#fff",
          color: "#1a1a1a",
          fontSize: 11,
          fontWeight: 500,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={13} color="rgba(0,0,0,0.4)" />
      </button>
      {open && (
        <div
          className="lagerGmDropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 9,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "#fff",
            boxShadow: "0 12px 34px rgba(0,0,0,0.14)",
            zIndex: 50,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`.lagerGmDropdown::-webkit-scrollbar{display:none}`}</style>
          <button
            type="button"
            onClick={() => onSelectIds([])}
            style={{
              width: "100%",
              border: "none",
              background: selectedIds.length === 0 ? "rgba(220,38,38,0.08)" : "#fff",
              padding: "8px 10px",
              textAlign: "left",
              cursor: "pointer",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: selectedIds.length === 0 ? 700 : 500, color: selectedIds.length === 0 ? R : "#1a1a1a" }}>Nicht zugewiesen</div>
          </button>
          {options.map((option) => (
            <DropdownItem
              key={option.id}
              label={option.label}
              subLabel={option.subLabel}
              selected={selectedIds.includes(option.id)}
              onClick={() => {
                const exists = selectedIds.includes(option.id);
                onSelectIds(exists ? selectedIds.filter((entry) => entry !== option.id) : [...selectedIds, option.id]);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)" }}>{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          height: 34,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "#fff",
          color: "#1a1a1a",
          fontSize: 11,
          fontWeight: 500,
          padding: "0 10px",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function DropdownItem({
  label,
  subLabel,
  selected,
  onClick,
}: {
  label: string;
  subLabel?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        border: "none",
        background: selected ? "rgba(220,38,38,0.08)" : "#fff",
        padding: "8px 10px",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: selected ? 700 : 500, color: selected ? R : "#1a1a1a" }}>{label}</div>
      {subLabel && <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>{subLabel}</div>}
    </button>
  );
}

function LagerTableSkeleton() {
  const shimmer = {
    backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 37%, rgba(0,0,0,0.04) 63%)",
    backgroundSize: "400% 100%",
    animation: "lagerSkeletonShimmer 1.25s ease-in-out infinite",
    borderRadius: 6,
  };

  return (
    <div style={{ padding: "8px 14px 10px" }}>
      <style>{`
        @keyframes lagerSkeletonShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={`lager-skeleton-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: TABLE_GRID,
            alignItems: "center",
            gap: 0,
            padding: "10px 0",
            borderBottom: index < 6 ? "1px solid rgba(0,0,0,0.03)" : "none",
          }}
        >
          <div style={{ ...shimmer, height: 10, width: `${64 + (index % 3) * 12}%` }} />
          <div style={{ ...shimmer, height: 10, width: `${52 + (index % 2) * 18}%` }} />
          <div style={{ ...shimmer, height: 10, width: `${60 + ((index + 1) % 2) * 16}%` }} />
          <div style={{ ...shimmer, height: 10, width: `${66 + (index % 2) * 14}%` }} />
        </div>
      ))}
    </div>
  );
}
