"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Warehouse } from "lucide-react";
import { createAdminLager, fetchAdminLager, fetchGmUsers } from "@/lib/api/backend";
import type { GMRecord } from "@/types/gebietsmanager";
import type { LagerRecord } from "@/types/lager";

const R = "#DC2626";
const R_D = "#b91c1c";

type LagerFormState = {
  address: string;
  postalCode: string;
  city: string;
  gmUserId: string | null;
};

const EMPTY_FORM: LagerFormState = {
  address: "",
  postalCode: "",
  city: "",
  gmUserId: null,
};

export default function LagerPage() {
  const [lagers, setLagers] = useState<LagerRecord[]>([]);
  const [gms, setGms] = useState<GMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LagerFormState>(EMPTY_FORM);
  const [gmDropdownOpen, setGmDropdownOpen] = useState(false);
  const [gmHighlightedIndex, setGmHighlightedIndex] = useState(0);
  const gmDropdownRef = useRef<HTMLDivElement | null>(null);

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

  const selectedGmLabel = useMemo(() => {
    if (!form.gmUserId) return "Nicht zugewiesen";
    const selected = gms.find((gm) => gm.id === form.gmUserId);
    return selected ? `${selected.firstName} ${selected.lastName}` : "Nicht zugewiesen";
  }, [form.gmUserId, gms]);

  const gmOptions = useMemo(
    () => [
      { id: null as string | null, label: "Nicht zugewiesen", subLabel: undefined as string | undefined },
      ...gms.map((gm) => ({
        id: gm.id,
        label: `${gm.firstName} ${gm.lastName}`,
        subLabel: gm.region,
      })),
    ],
    [gms],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!gmDropdownOpen) return;
    const selectedIndex = gmOptions.findIndex((option) => option.id === form.gmUserId);
    setGmHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [form.gmUserId, gmDropdownOpen, gmOptions]);

  useEffect(() => {
    if (!gmDropdownOpen) return;
    const applySelection = (index: number) => {
      const option = gmOptions[index];
      if (!option) return;
      setForm((current) => ({ ...current, gmUserId: option.id }));
      setGmDropdownOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if (event.key === "Escape") {
        event.preventDefault();
        setGmDropdownOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setGmHighlightedIndex((current) => Math.min(current + 1, gmOptions.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setGmHighlightedIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        applySelection(gmHighlightedIndex);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gmDropdownOpen, gmHighlightedIndex, gmOptions]);

  useEffect(() => {
    if (!gmDropdownOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!gmDropdownRef.current) return;
      if (gmDropdownRef.current.contains(event.target as Node)) return;
      setGmDropdownOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [gmDropdownOpen]);

  const canSubmit = form.address.trim() && form.postalCode.trim() && form.city.trim();

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setGmDropdownOpen(false);
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
        gmUserId: form.gmUserId,
      });
      setLagers((current) => [created, ...current]);
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lager konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, resetForm, submitting]);

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
          <button
            type="button"
            onClick={() => {
              if (createOpen) {
                setCreateOpen(false);
                resetForm();
                return;
              }
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

        {createOpen && (
          <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr", gap: 8 }}>
              <InputField label="Adresse" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
              <InputField label="PLZ" value={form.postalCode} onChange={(value) => setForm((current) => ({ ...current, postalCode: value }))} />
              <InputField label="Ort" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
            </div>

            <div ref={gmDropdownRef} style={{ position: "relative", width: 320, maxWidth: "100%" }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Gebietsmanager (optional)</div>
              <button
                type="button"
                onClick={() =>
                  setGmDropdownOpen((open) => {
                    const next = !open;
                    if (next) {
                      const selectedIndex = gmOptions.findIndex((option) => option.id === form.gmUserId);
                      setGmHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
                    }
                    return next;
                  })
                }
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
                <span>{selectedGmLabel}</span>
                <ChevronDown size={13} color="rgba(0,0,0,0.4)" />
              </button>
              {gmDropdownOpen && (
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
                  {gmOptions.map((option, index) => (
                    <DropdownItem
                      key={option.id ?? "__none__"}
                      label={option.label}
                      subLabel={option.subLabel}
                      selected={form.gmUserId === option.id}
                      highlighted={gmHighlightedIndex === index}
                      onMouseEnter={() => setGmHighlightedIndex(index)}
                      onClick={() => {
                        setForm((current) => ({ ...current, gmUserId: option.id }));
                        setGmDropdownOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
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

        <div style={{ borderRadius: 11, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.5fr 0.8fr 1fr", gap: 0, padding: "8px 14px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            {["Adresse", "PLZ", "Ort", "GM"].map((label) => (
              <span key={label} style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "18px 14px", fontSize: 11, color: "rgba(0,0,0,0.42)" }}>Lager werden geladen...</div>
          ) : lagers.length === 0 ? (
            <div style={{ padding: "24px 14px", fontSize: 12, color: "rgba(0,0,0,0.4)", textAlign: "center" }}>Noch keine Lager vorhanden.</div>
          ) : (
            lagers.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.5fr 0.8fr 1fr",
                  gap: 0,
                  padding: "10px 14px",
                  borderBottom: index < lagers.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: index % 2 === 0 ? "#fff" : "rgba(0,0,0,0.01)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.address}</span>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.postalCode}</span>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.56)" }}>{entry.city}</span>
                <span style={{ fontSize: 11, color: entry.gmName ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.35)", fontWeight: entry.gmName ? 600 : 500 }}>
                  {entry.gmName ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>

        {error && (
          <div style={{ padding: "8px 10px", borderRadius: 8, fontSize: 11, color: "#b91c1c", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
            {error}
          </div>
        )}
      </div>
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
  highlighted,
  onMouseEnter,
  onClick,
}: {
  label: string;
  subLabel?: string;
  selected: boolean;
  highlighted: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        width: "100%",
        border: "none",
        background: selected ? "rgba(220,38,38,0.08)" : highlighted ? "rgba(0,0,0,0.04)" : "#fff",
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
