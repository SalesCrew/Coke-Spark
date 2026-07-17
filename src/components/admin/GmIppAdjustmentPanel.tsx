"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, History, RotateCcw, Search, X } from "lucide-react";
import {
  clearAdminIppAdjustment,
  fetchAdminIppAdjustmentHistory,
  fetchAdminIppGmPeriods,
  saveAdminIppAdjustment,
  type AdminIppAdjustmentEvent,
  type AdminIppGmPeriodRow,
  type AdminIppPeriodOption,
} from "@/lib/api/backend";

const R = "#DC2626";
const GREEN = "#16a34a";

function fmtIpp(value: number): string {
  return value.toFixed(2);
}

function latestRevision(row: AdminIppGmPeriodRow): number | null {
  return row.adjustment?.revisionNumber ?? null;
}

function eventLabel(event: AdminIppAdjustmentEvent): string {
  return event.eventType === "set"
    ? `gesetzt auf ${fmtIpp(event.correctedIpp ?? 0)}`
    : "zurueckgesetzt";
}

function RedMonthSelect({
  periods,
  value,
  onChange,
}: {
  periods: AdminIppPeriodOption[];
  value: AdminIppPeriodOption | null;
  onChange: (period: AdminIppPeriodOption) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          height: 28,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          borderRadius: 7,
          padding: "0 9px",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 10,
          fontWeight: 700,
          color: "#1f2937",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {value.label}
        <ChevronDown size={12} strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.16s ease" }} />
      </button>
      {open && (
        <div
          className="map-scroll"
          style={{
            position: "absolute",
            zIndex: 40,
            top: 34,
            right: 0,
            width: 220,
            maxHeight: 260,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 9,
            padding: 5,
            boxShadow: "0 12px 34px rgba(15,23,42,0.16)",
          }}
        >
          {periods.map((period) => {
            const active = period.id === value.id;
            return (
              <button
                key={period.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(period);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 6,
                  background: active ? "rgba(220,38,38,0.07)" : "transparent",
                  color: active ? R : "#374151",
                  padding: "7px 9px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 650 }}>{period.label}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: active ? R : "rgba(0,0,0,0.32)" }}>
                  {period.isCurrent ? "aktuell" : `${period.startDate.slice(5)}-${period.endDate.slice(5)}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GmAdjustmentModal({
  row,
  onClose,
  onSaved,
}: {
  row: AdminIppGmPeriodRow;
  onClose: () => void;
  onSaved: (row: AdminIppGmPeriodRow) => void;
}) {
  const [value, setValue] = useState(String(row.effectiveIpp || row.calculatedIpp || ""));
  const [reason, setReason] = useState(row.adjustment?.reason ?? "");
  const [history, setHistory] = useState<AdminIppAdjustmentEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAdjustment = Boolean(row.adjustment);

  useEffect(() => {
    let mounted = true;
    setLoadingHistory(true);
    fetchAdminIppAdjustmentHistory(row.gmUserId, row.redPeriodId)
      .then((events) => {
        if (mounted) setHistory(events);
      })
      .catch(() => {
        if (mounted) setHistory([]);
      })
      .finally(() => {
        if (mounted) setLoadingHistory(false);
      });
    return () => {
      mounted = false;
    };
  }, [row.gmUserId, row.redPeriodId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Bitte einen gueltigen IPP-Wert eingeben.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Bitte kurz begruenden, warum der Wert korrigiert wird.");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveAdminIppAdjustment({
        gmUserId: row.gmUserId,
        redPeriodId: row.redPeriodId,
        correctedIpp: parsed,
        reason,
        requestId: crypto.randomUUID(),
        expectedBaseFingerprint: row.baseFingerprint,
        expectedLatestRevisionNumber: latestRevision(row),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Korrektur konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function clearAdjustment() {
    if (!row.adjustment || reason.trim().length < 3) {
      setError("Bitte auch fuer das Zuruecksetzen kurz begruenden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await clearAdminIppAdjustment({
        gmUserId: row.gmUserId,
        redPeriodId: row.redPeriodId,
        reason,
        requestId: crypto.randomUUID(),
        expectedBaseFingerprint: row.baseFingerprint,
        expectedLatestRevisionNumber: row.adjustment.revisionNumber,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Korrektur konnte nicht zurueckgesetzt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,23,42,0.18)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "min(560px, calc(100vw - 40px))", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 24px 70px rgba(15,23,42,0.24)", overflow: "hidden" }}>
        <div style={{ padding: "15px 16px 13px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(0,0,0,0.32)" }}>GL IPP korrigieren</div>
            <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800, color: "#111827" }}>{row.gmName}</div>
            <div style={{ marginTop: 2, fontSize: 10, fontWeight: 650, color: "rgba(0,0,0,0.45)" }}>{row.redPeriodLabel}</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.018)", padding: 10 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.34)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Berechnet</div>
              <div style={{ marginTop: 5, fontSize: 18, fontWeight: 850, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{fmtIpp(row.calculatedIpp)}</div>
            </div>
            <div style={{ borderRadius: 9, border: "1px solid rgba(22,163,74,0.18)", background: "rgba(22,163,74,0.04)", padding: 10 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.34)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Wirksam</div>
              <div style={{ marginTop: 5, fontSize: 18, fontWeight: 850, color: row.adjustment ? GREEN : "#111827", fontVariantNumeric: "tabular-nums" }}>{fmtIpp(row.effectiveIpp)}</div>
            </div>
            <div style={{ borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: 10 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.34)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Marktwerte</div>
              <div style={{ marginTop: 5, fontSize: 18, fontWeight: 850, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{row.marketSampleCount}</div>
            </div>
          </div>

          {row.adjustmentIsStale && (
            <div style={{ borderRadius: 8, border: "1px solid rgba(217,119,6,0.22)", background: "rgba(217,119,6,0.06)", padding: "8px 10px", fontSize: 10.5, fontWeight: 650, color: "#92400e" }}>
              Die echte IPP-Basis hat sich seit der letzten Korrektur veraendert. Bitte berechneten Wert und Korrektur kurz pruefen.
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Neuer GL IPP</span>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              disabled={row.marketSampleCount <= 0}
              style={{ height: 36, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 8, padding: "0 11px", fontSize: 14, fontWeight: 750, fontVariantNumeric: "tabular-nums", outline: "none", fontFamily: "inherit", background: row.marketSampleCount <= 0 ? "rgba(0,0,0,0.035)" : "#fff" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(0,0,0,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Begruendung</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.45, outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          {error && <div style={{ fontSize: 11, color: R, fontWeight: 650 }}>{error}</div>}

          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <History size={13} strokeWidth={2.3} color="rgba(0,0,0,0.38)" />
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(0,0,0,0.38)" }}>Historie</span>
            </div>
            <div className="map-scroll" style={{ maxHeight: 116, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {loadingHistory && <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)" }}>Historie wird geladen...</div>}
              {!loadingHistory && history.length === 0 && <div style={{ fontSize: 10, color: "rgba(0,0,0,0.38)" }}>Noch keine Korrektur.</div>}
              {history.map((event) => (
                <div key={event.id} style={{ borderRadius: 7, background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.045)", padding: "7px 8px", display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 750, color: "#111827" }}>{eventLabel(event)}</div>
                    <div style={{ marginTop: 2, fontSize: 9.5, color: "rgba(0,0,0,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.reason}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 9, color: "rgba(0,0,0,0.38)" }}>
                    <div>{new Date(event.createdAt).toLocaleDateString("de-AT")}</div>
                    <div>{event.createdByName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: 12, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8, justifyContent: "space-between", background: "rgba(0,0,0,0.012)" }}>
          <button type="button" onClick={clearAdjustment} disabled={!hasAdjustment || saving} style={{ height: 34, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, background: "#fff", color: hasAdjustment ? "#374151" : "rgba(0,0,0,0.25)", padding: "0 11px", fontSize: 11, fontWeight: 750, cursor: hasAdjustment ? "pointer" : "not-allowed", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RotateCcw size={13} strokeWidth={2.3} />
            Zuruecksetzen
          </button>
          <button type="submit" disabled={saving || row.marketSampleCount <= 0} style={{ height: 34, border: "none", borderRadius: 8, background: saving || row.marketSampleCount <= 0 ? "rgba(220,38,38,0.35)" : R, color: "#fff", padding: "0 13px", fontSize: 11, fontWeight: 800, cursor: saving || row.marketSampleCount <= 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: saving ? "none" : "0 7px 16px rgba(220,38,38,0.22)" }}>
            <Check size={13} strokeWidth={2.6} />
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}

export function GmIppAdjustmentPanel({ onRowsChange }: { onRowsChange?: (rows: AdminIppGmPeriodRow[]) => void }) {
  const [periods, setPeriods] = useState<AdminIppPeriodOption[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<AdminIppPeriodOption | null>(null);
  const [rows, setRows] = useState<AdminIppGmPeriodRow[]>([]);
  const [search, setSearch] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminIppGmPeriodRow | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchAdminIppGmPeriods(selectedPeriod?.startDate)
      .then((payload) => {
        if (!mounted) return;
        setPeriods(payload.periods);
        setSelectedPeriod(payload.selectedPeriod);
        setRows(payload.rows);
        setCanEdit(payload.canEdit);
        onRowsChange?.(payload.rows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "GL IPP konnte nicht geladen werden.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedPeriod?.startDate, onRowsChange]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.gmName.toLowerCase().includes(q) || row.region.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const correctedCount = rows.filter((row) => row.adjustment).length;
  const avgEffective = rows.filter((row) => row.marketSampleCount > 0);
  const average = avgEffective.length > 0
    ? avgEffective.reduce((sum, row) => sum + row.effectiveIpp, 0) / avgEffective.length
    : 0;

  function replaceRow(updated: AdminIppGmPeriodRow) {
    setRows((current) => {
      const next = current.map((row) => (row.gmUserId === updated.gmUserId && row.redPeriodId === updated.redPeriodId ? updated : row));
      onRowsChange?.(next);
      return next;
    });
  }

  return (
    <div className="ipp-main" style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(0,0,0,0.3)" }}>GL IPP Korrekturen</div>
          <div style={{ marginTop: 3, fontSize: 10.5, color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>Korrektur wirkt nur auf GL/RED-Monat, Markt- und Fragebogenwerte bleiben unveraendert.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RedMonthSelect periods={periods} value={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
      </div>
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "grid", gridTemplateColumns: "220px repeat(3, minmax(120px, 1fr))", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, height: 28, borderRadius: 7, background: "rgba(0,0,0,0.025)", padding: "0 9px" }}>
            <Search size={12} strokeWidth={2.2} color="rgba(0,0,0,0.33)" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="GL suchen..." style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, fontFamily: "inherit" }} />
          </div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 750 }}>GL: <span style={{ color: "#111827" }}>{rows.length}</span></div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 750 }}>Korrigiert: <span style={{ color: correctedCount > 0 ? R : "#111827" }}>{correctedCount}</span></div>
          <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 750 }}>Schnitt wirksam: <span style={{ color: average > 0 ? GREEN : "#111827" }}>{fmtIpp(average)}</span></div>
        </div>

        {error && <div style={{ padding: "10px 12px", fontSize: 11, color: R, fontWeight: 650 }}>{error}</div>}

        <div className="map-scroll" style={{ maxHeight: 330, overflowY: "auto" }}>
          {loading && Array.from({ length: 5 }).map((_, index) => (
            <div key={index} style={{ height: 48, borderBottom: "1px solid rgba(0,0,0,0.04)", display: "grid", gridTemplateColumns: "1.4fr .7fr .7fr .7fr .8fr 90px", gap: 10, alignItems: "center", padding: "0 12px" }}>
              {Array.from({ length: 6 }).map((__, cell) => <div key={cell} style={{ height: cell === 0 ? 14 : 11, width: cell === 0 ? "65%" : "48%", borderRadius: 6, background: "rgba(0,0,0,0.045)" }} />)}
            </div>
          ))}
          {!loading && filteredRows.map((row) => {
            const hasCorrection = Boolean(row.adjustment);
            return (
              <div key={`${row.gmUserId}:${row.redPeriodId}`} style={{ minHeight: 50, borderBottom: "1px solid rgba(0,0,0,0.04)", display: "grid", gridTemplateColumns: "1.4fr .7fr .7fr .7fr .8fr 90px", gap: 10, alignItems: "center", padding: "8px 12px", background: row.adjustmentIsStale ? "rgba(217,119,6,0.045)" : hasCorrection ? "rgba(22,163,74,0.025)" : "#fff" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.gmName}</div>
                  <div style={{ marginTop: 2, fontSize: 9.5, color: "rgba(0,0,0,0.42)", fontWeight: 650 }}>{row.region || "-"} · {row.calculationSource === "finalized" ? "finalisiert" : row.calculationSource === "no_data" ? "keine Werte" : "live"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.32)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Berechnet</div>
                  <div style={{ marginTop: 2, fontSize: 13, fontWeight: 850, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{fmtIpp(row.calculatedIpp)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.32)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Wirksam</div>
                  <div style={{ marginTop: 2, fontSize: 13, fontWeight: 850, color: hasCorrection ? GREEN : "#111827", fontVariantNumeric: "tabular-nums" }}>{fmtIpp(row.effectiveIpp)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(0,0,0,0.32)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Delta</div>
                  <div style={{ marginTop: 2, fontSize: 13, fontWeight: 850, color: row.difference === 0 ? "rgba(0,0,0,0.38)" : R, fontVariantNumeric: "tabular-nums" }}>{row.difference > 0 ? "+" : ""}{fmtIpp(row.difference)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(0,0,0,0.47)" }}>{row.marketSampleCount} Marktwerte</span>
                  {hasCorrection && <span style={{ fontSize: 8.5, fontWeight: 800, color: GREEN }}>Korrektur aktiv</span>}
                  {row.adjustmentIsStale && <span style={{ fontSize: 8.5, fontWeight: 800, color: "#b45309" }}>Basis geaendert</span>}
                </div>
                <button type="button" disabled={!canEdit || row.marketSampleCount <= 0} onClick={() => setEditing(row)} style={{ height: 28, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 7, background: canEdit && row.marketSampleCount > 0 ? "#fff" : "rgba(0,0,0,0.025)", color: canEdit && row.marketSampleCount > 0 ? R : "rgba(0,0,0,0.25)", fontSize: 10, fontWeight: 800, cursor: canEdit && row.marketSampleCount > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  Bearbeiten
                </button>
              </div>
            );
          })}
          {!loading && filteredRows.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontSize: 11, fontWeight: 650, color: "rgba(0,0,0,0.38)" }}>Keine GL-Zeilen gefunden.</div>
          )}
        </div>
      </div>
      {editing && <GmAdjustmentModal row={editing} onClose={() => setEditing(null)} onSaved={replaceRow} />}
    </div>
  );
}
