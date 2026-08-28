"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Copy, Check, UserCheck, Mail, Car, Eye, EyeOff, Save, ChevronDown } from "lucide-react";
import type { SMRecord } from "@/types/shelfmerchandiser";
import type { SmPlanningAssignment } from "@/types/smPlanning";
import { createSmUser, fetchSmPlanningAssignments, fetchSmUsers, readAuthSession, updateSmUser } from "@/lib/api/backend";
import { exportShelfMerchandiserExcel } from "@/lib/exports/masterDataExports";

// ── Constants ─────────────────────────────────────────────────
const R  = "#DC2626";
const RD = "#b91c1c";

function fmtDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function historyRanges(): Array<{ from: string; to: string }> {
  const today = new Date();
  const first = new Date(today);
  first.setFullYear(first.getFullYear() - 2);
  const last = new Date(today);
  last.setDate(last.getDate() + 92);
  const ranges: Array<{ from: string; to: string }> = [];
  const cursor = new Date(first);
  const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  while (cursor <= last) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 92);
    if (end > last) end.setTime(last.getTime());
    ranges.push({ from: ymd(cursor), to: ymd(end) });
    cursor.setDate(cursor.getDate() + 93);
  }
  return ranges;
}

async function fetchSmAssignmentHistory(): Promise<SmPlanningAssignment[]> {
  const chunks = await Promise.all(historyRanges().map((range) => fetchSmPlanningAssignments(range.from, range.to)));
  const byId = new Map(chunks.flat().map((assignment) => [assignment.id, assignment]));
  return Array.from(byId.values()).sort((a, b) => b.effective.workDate.localeCompare(a.effective.workDate));
}

function initials(gm: SMRecord) { return `${gm.firstName[0] ?? ""}${gm.lastName[0] ?? ""}`.toUpperCase(); }
function avatarColor(gm: SMRecord) {
  const palettes = [
    { bg: "rgba(220,38,38,0.10)",  text: R },
    { bg: "rgba(37,99,235,0.10)",  text: "#2563eb" },
    { bg: "rgba(22,163,74,0.10)",  text: "#16a34a" },
    { bg: "rgba(217,119,6,0.10)",  text: "#D97706" },
    { bg: "rgba(124,58,237,0.10)", text: "#7c3aed" },
  ];
  const hash = (gm.firstName + gm.lastName).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// ── Shared input style ─────────────────────────────────────────
function inp(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", height: 34, fontSize: 11, fontWeight: 500, padding: "0 10px",
    borderRadius: 7, border: "1px solid rgba(0,0,0,0.12)", outline: "none",
    color: "#1a1a1a", background: "#fff", fontFamily: "inherit",
    transition: "border 0.15s, box-shadow 0.15s", boxSizing: "border-box" as const,
    ...extra,
  };
}

function TravelTimeBadge({ enabled }: { enabled: boolean }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: enabled ? "rgba(22,163,74,0.09)" : "rgba(0,0,0,0.055)", color: enabled ? "#15803d" : "rgba(0,0,0,0.4)", whiteSpace: "nowrap" as const }}>
      {enabled ? "Ja" : "Nein"}
    </span>
  );
}

function TravelTimeToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 3, borderRadius: 9, background: "rgba(0,0,0,0.045)", border: "1px solid rgba(0,0,0,0.06)" }} role="group" aria-label="Fahrtzeiten">
      {[true, false].map(option => {
        const selected = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={selected}
            style={{ height: 30, borderRadius: 6, border: selected ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent", background: selected ? "#fff" : "transparent", boxShadow: selected ? "0 1px 4px rgba(0,0,0,0.07)" : "none", color: selected ? (option ? "#15803d" : "#374151") : "rgba(0,0,0,0.4)", fontSize: 11, fontWeight: selected ? 700 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.14s" }}
          >
            {option ? "Ja" : "Nein"}
          </button>
        );
      })}
    </div>
  );
}

// ── GM Card ───────────────────────────────────────────────────
function SMCard({
  gm,
  isNew,
  onClick,
  active,
}: {
  gm: SMRecord;
  isNew?: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  const av = avatarColor(gm);
  const visitCount = gm.visitCount ?? 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? "rgba(220,38,38,0.03)" : "rgba(0,0,0,0.025)",
        border: active ? `1px solid rgba(220,38,38,0.25)` : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        animation: isNew ? "SMCardIn 0.3s cubic-bezier(0.4,0,0.2,1) both" : "none",
        transition: "border 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.025)"; }}
    >
      <style>{`@keyframes SMCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(220,38,38,0.12)" : av.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: active ? R : av.text, letterSpacing: "-0.02em" }}>{initials(gm)}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: active ? R : "#1a1a1a", letterSpacing: "-0.02em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}>
              {gm.firstName} {gm.lastName}
            </div>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.35)", marginTop: 1 }}>Shelf Merchandiser</div>
          </div>
        </div>
      </div>
      <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", textAlign: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 4 }}>Besuche</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{visitCount}</div>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Mail size={10} strokeWidth={1.8} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{gm.email}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Car size={10} strokeWidth={1.8} color="rgba(0,0,0,0.3)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>Fahrtzeiten</span>
            </div>
            <TravelTimeBadge enabled={gm.travelTimeEnabled} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ASSIGNMENT_STATUS: Record<SmPlanningAssignment["status"], { label: string; color: string; bg: string; border: string }> = {
  planned: { label: "Geplant", color: "#475569", bg: "rgba(71,85,105,.07)", border: "rgba(71,85,105,.14)" },
  confirmed: { label: "Bestätigt", color: "#15803d", bg: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.16)" },
  open: { label: "Offen", color: "#b45309", bg: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.16)" },
  in_progress: { label: "In Arbeit", color: "#2563eb", bg: "rgba(37,99,235,.08)", border: "rgba(37,99,235,.16)" },
  completed: { label: "Abgeschlossen", color: "#15803d", bg: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.16)" },
  cancelled: { label: "Ausfall", color: R, bg: "rgba(220,38,38,.07)", border: "rgba(220,38,38,.16)" },
  missed: { label: "Versäumt", color: "#7c3aed", bg: "rgba(124,58,237,.08)", border: "rgba(124,58,237,.16)" },
};

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} Min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

// ── Real SM assignment / visit card ──────────────────────────
function SmAssignmentCard({ assignment }: { assignment: SmPlanningAssignment }) {
  const [expanded, setExpanded] = useState(false);
  const status = ASSIGNMENT_STATUS[assignment.status];
  const duration = assignment.actualMinutes ?? assignment.effective.plannedMinutes;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", boxShadow: expanded ? "0 4px 18px rgba(0,0,0,0.07)" : "0 1px 5px rgba(0,0,0,0.04)", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.22s ease" }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 5px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: status.bg, color: status.color, border: `1px solid ${status.border}`, letterSpacing: "0.02em", flexShrink: 0, whiteSpace: "nowrap" as const }}>
          {status.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
            {assignment.effective.marketName}
          </div>
          <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(0,0,0,.34)", fontSize: 8 }}>{assignment.effective.address}</div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" as const }}>
            {fmtDate(assignment.effective.workDate)} · {formatMinutes(duration)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 8, color: "rgba(0,0,0,0.26)", fontWeight: 500 }}>{assignment.sourceType === "series" ? "Serie" : "Einmalig"}</span>
            <ChevronDown size={11} strokeWidth={2} color="rgba(0,0,0,0.28)" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
          </div>
        </div>
      </div>
      <div style={{ maxHeight: expanded ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.2s ease 0.06s, transform 0.2s ease 0.06s", borderTop: "1px solid rgba(0,0,0,0.05)", padding: "9px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["Fragebogen", assignment.visit?.questionnaireName ?? "Noch nicht gestartet"],
            ["Sollzeit", formatMinutes(assignment.effective.plannedMinutes)],
            ["Istzeit", formatMinutes(assignment.actualMinutes)],
            ["Fahrtzeit", formatMinutes(assignment.visit?.travelMinutes ?? null)],
            ["Modus", assignment.visit?.visitTimeMode === "timer" ? "Timer" : assignment.visit?.visitTimeMode === "manual" ? "Manuell" : "—"],
            ["Marktnummer", assignment.effective.marketInternalId],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.025)" }}>
              <span style={{ display: "block", color: "rgba(0,0,0,.3)", fontSize: 7.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
              <strong style={{ display: "block", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151", fontSize: 9.5, fontWeight: 650 }}>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────
function DrawerField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(0,0,0,0.3)" }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp() }}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.28)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.06)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function SMDetailDrawer({ gm, onClose, onSave, assignments }: { gm: SMRecord; onClose: () => void; onSave: (updated: SMRecord) => Promise<void> | void; assignments: SmPlanningAssignment[] }) {
  const [tab, setTab] = useState<"profil" | "besuche">("profil");
  const [draft, setDraft] = useState<SMRecord>({ ...gm });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password reveal state
  const [pwVisible, setPwVisible] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft when gm changes
  useEffect(() => { setDraft({ ...gm }); setDirty(false); setTab("profil"); }, [gm.id]);

  const set = (k: "firstName" | "lastName" | "email") => (v: string) => {
    setDraft(d => ({ ...d, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const setTravelTimeEnabled = (value: boolean) => {
    setDraft(d => ({ ...d, travelTimeEnabled: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await onSave(draft);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const revealPassword = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setPwVisible(true);
    revealTimerRef.current = setTimeout(() => { setPwVisible(false); }, 5000);
  };

  const hidePassword = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setPwVisible(false);
  };

  const copyPassword = () => {
    if (!gm.password) return;
    navigator.clipboard.writeText(gm.password).then(() => {
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 2000);
    });
  };

  const av = avatarColor(draft);

  const smAssignments = assignments
    .filter((assignment) => assignment.effective.smUserId === gm.id)
    .sort((a, b) => b.effective.workDate.localeCompare(a.effective.workDate));
  const visitCount = smAssignments.filter((assignment) => assignment.status === "completed").length;

  return createPortal(
    <>
      <style>{`
        @keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes drawerBdIn{from{opacity:0}to{opacity:1}}
      `}</style>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 799, background: "rgba(0,0,0,0.12)", animation: "drawerBdIn 0.2s ease both" }} />

      {/* Drawer */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, zIndex: 800, display: "flex", flexDirection: "column", background: "#f5f5f7", boxShadow: "-6px 0 32px rgba(0,0,0,0.12), -1px 0 0 rgba(0,0,0,0.06)", animation: "drawerIn 0.22s cubic-bezier(0.4,0,0.2,1) both" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "16px 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: av.text, letterSpacing: "-0.02em" }}>{initials(draft)}</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.025em", lineHeight: 1.2 }}>{draft.firstName} {draft.lastName}</div>
                <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 2 }}>Shelf Merchandiser</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.4)", transition: "all 0.12s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>

          {/* Visits + created */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)" }}>Besuche</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{visitCount}</div>
            </div>
            <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.07)" }} />
            <div>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)" }}>Erstellt</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.5)" }}>
                {new Date(draft.createdAt).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 18px", display: "flex", gap: 0, flexShrink: 0 }}>
          {(["profil", "besuche"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", fontSize: 11, fontWeight: tab === t ? 700 : 500, color: tab === t ? R : "rgba(0,0,0,0.45)", border: "none", background: "none", cursor: "pointer", borderBottom: tab === t ? `2px solid ${R}` : "2px solid transparent", transition: "all 0.12s", fontFamily: "inherit", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 5 }}>
              {t === "profil" ? "Profil" : "Marktbesuche"}
              {t === "besuche" && smAssignments.length > 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: tab === "besuche" ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.07)", color: tab === "besuche" ? R : "rgba(0,0,0,0.38)" }}>{smAssignments.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="map-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Section: Kontakt */}
          {tab === "profil" && (<>
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <DrawerField label="Vorname" value={draft.firstName} onChange={set("firstName")} />
                <DrawerField label="Nachname" value={draft.lastName} onChange={set("lastName")} />
              </div>
              <DrawerField label="E-Mail" value={draft.email} onChange={set("email")} />
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

          <div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 7 }}>Fahrtzeiten</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", lineHeight: 1.5, marginBottom: 9 }}>Dürfen Fahrtzeiten für diesen SM erfasst werden?</div>
            <TravelTimeToggle value={draft.travelTimeEnabled} onChange={setTravelTimeEnabled} />
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />

          {/* Section: Passwort */}
          <div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.28)", marginBottom: 10 }}>Passwort</div>
            {gm.password ? (
              <div style={{ background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.08)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", marginBottom: 5 }}>Einmalpasswort</div>
                  {pwVisible ? (
                    <div
                      onClick={copyPassword}
                      title="Klicken zum Kopieren"
                      style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.04em", fontFamily: "monospace", cursor: "pointer", userSelect: "all" as const, transition: "opacity 0.15s" }}
                    >
                      {gm.password}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(0,0,0,0.25)", letterSpacing: "0.1em", fontFamily: "monospace" }}>
                      {"•".repeat(Math.min(gm.password.length, 12))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {pwVisible && (
                    <button onClick={copyPassword}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: pwCopied ? "rgba(22,163,74,0.1)" : "rgba(0,0,0,0.05)", color: pwCopied ? "#16a34a" : "rgba(0,0,0,0.5)" }}>
                      {pwCopied ? <Check size={10} strokeWidth={2.5} /> : <Copy size={10} strokeWidth={2} />}
                      {pwCopied ? "Kopiert" : "Kopieren"}
                    </button>
                  )}
                  <button
                    onClick={pwVisible ? hidePassword : revealPassword}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: pwVisible ? "rgba(220,38,38,0.07)" : "rgba(0,0,0,0.05)", color: pwVisible ? R : "rgba(0,0,0,0.45)" }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {pwVisible ? <EyeOff size={10} strokeWidth={2} /> : <Eye size={10} strokeWidth={2} />}
                    {pwVisible ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)" }}>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>Kein Passwort gespeichert.</span>
              </div>
            )}
          </div>
          </>)}

          {/* Marktbesuche tab */}
          {tab === "besuche" && (
            smAssignments.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center" as const }}>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", lineHeight: 1.6 }}>Noch keine Marktbesuche für diesen SM.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {smAssignments.map((assignment) => <SmAssignmentCard key={assignment.id} assignment={assignment} />)}
              </div>
            )
          )}
        </div>

        {/* Save footer */}
        {tab === "profil" && (
        <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 18px", flexShrink: 0 }}>
          <button
            onClick={() => { void handleSave(); }}
            disabled={!dirty || saving}
            style={{ width: "100%", height: 36, borderRadius: 8, border: "none", cursor: dirty && !saving ? "pointer" : "default", fontSize: 11, fontWeight: 700, color: dirty && !saving ? "#fff" : "rgba(0,0,0,0.25)", fontFamily: "inherit", background: dirty && !saving ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.05)", boxShadow: dirty && !saving ? `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {saving ? <><Save size={11} strokeWidth={2} /> Speichern...</> : saved ? <><Check size={11} strokeWidth={2.5} /> Gespeichert</> : <><Save size={11} strokeWidth={2} /> Änderungen speichern</>}
          </button>
        </div>
        )}
      </div>
    </>,
    document.body,
  );
}

// ── Create Modal form helpers ─────────────────────────────────
type FormState = {
  firstName: string; lastName: string;
  email: string;
  travelTimeEnabled: boolean;
};
const EMPTY_FORM: FormState = { firstName: "", lastName: "", email: "", travelTimeEnabled: false };
function isValidEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isFormValid(f: FormState) {
  return Boolean(f.firstName.trim() && f.lastName.trim() && f.email.trim() && isValidEmail(f.email));
}

function InputField({ label, value, onChange, placeholder, type = "text", error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: error ? R : "rgba(0,0,0,0.35)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inp(), borderColor: error ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.12)" }}
        onFocus={e => { e.currentTarget.style.borderColor = error ? R : "rgba(0,0,0,0.28)"; e.currentTarget.style.boxShadow = error ? "0 0 0 2px rgba(220,38,38,0.08)" : "0 0 0 2px rgba(0,0,0,0.06)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function SMCardsSkeleton() {
  return (
    <div style={{ padding: 14 }}>
      <style>{`
        @keyframes gmSkeletonPulse {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.07)",
              background: "rgba(0,0,0,0.018)",
              padding: 10,
              animation: "gmSkeletonPulse 1.25s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(0,0,0,0.08)" }} />
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ width: 84, height: 9, borderRadius: 5, background: "rgba(0,0,0,0.1)" }} />
                  <div style={{ width: 64, height: 7, borderRadius: 4, background: "rgba(0,0,0,0.08)" }} />
                </div>
              </div>
              <div style={{ width: 52, height: 16, borderRadius: 999, background: "rgba(0,0,0,0.09)" }} />
            </div>
            <div style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: 10, display: "grid", gap: 8 }}>
              <div style={{ width: "100%", height: 48, borderRadius: 8, background: "rgba(0,0,0,0.06)" }} />
              <div style={{ width: "100%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
              <div style={{ width: "86%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
              <div style={{ width: "72%", height: 8, borderRadius: 5, background: "rgba(0,0,0,0.08)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────
function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (form: FormState) => Promise<{ sm: SMRecord; password: string }>;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState<"form" | "success">("form");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isFormValid(form);
  const set = (k: "firstName" | "lastName" | "email") => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onCreate(form);
      setPassword(result.password);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erstellung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleCopy = () => { navigator.clipboard.writeText(password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const emailError = Boolean(form.email && !isValidEmail(form.email));

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", animation: "bdIn 0.18s ease both" }} />
      <style>{`@keyframes bdIn{from{opacity:0}to{opacity:1}} @keyframes modalIn{from{opacity:0;transform:scale(0.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes successIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ position: "relative", zIndex: 1, width: 440, background: "#fff", borderRadius: 16, boxShadow: "0 8px 48px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.1)", border: "1px solid rgba(0,0,0,0.07)", animation: "modalIn 0.22s cubic-bezier(0.4,0,0.2,1) both", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={14} strokeWidth={2} color={R} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{step === "form" ? "Shelf Merchandiser erstellen" : "SM erfolgreich erstellt"}</div>
              <div style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 1 }}>{step === "form" ? "Name, E-Mail und Fahrtzeiten festlegen" : `${form.firstName} ${form.lastName}`}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.45)", transition: "all 0.12s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.09)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}>
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
        {step === "form" ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <InputField label="Vorname *" value={form.firstName} onChange={set("firstName")} placeholder="Max" />
              <InputField label="Nachname *" value={form.lastName} onChange={set("lastName")} placeholder="Mustermann" />
            </div>
            <div>
              <InputField label="E-Mail *" value={form.email} onChange={set("email")} placeholder="m.mustermann@salescrew.at" type="email" error={!!emailError} />
            </div>
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.018)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Car size={12} strokeWidth={1.9} color="rgba(0,0,0,0.42)" />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Fahrtzeiten</div>
                  <div style={{ fontSize: 9, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>Fahrtzeiterfassung für diesen SM erlauben</div>
                </div>
              </div>
              <TravelTimeToggle value={form.travelTimeEnabled} onChange={travelTimeEnabled => setForm(current => ({ ...current, travelTimeEnabled }))} />
            </div>
            {error ? (
              <div style={{ fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>{error}</div>
            ) : null}
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, height: 36, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "linear-gradient(to bottom,#fff,#f5f5f5)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", fontFamily: "inherit", boxShadow: "inset 0 1px 0.6px rgba(255,255,255,0.9),0 0 0 1px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.12s" }}>Abbrechen</button>
              <button onClick={handleSubmit} disabled={!valid || submitting} style={{ flex: 2, height: 36, borderRadius: 8, border: "none", cursor: valid && !submitting ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "inherit", background: valid && !submitting ? `linear-gradient(to bottom,${R},${RD})` : "rgba(0,0,0,0.12)", boxShadow: valid && !submitting ? `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)` : "none", transition: "all 0.15s" }}>{submitting ? "Erstellt..." : "Erstellen"}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 18, alignItems: "center", animation: "successIn 0.25s ease both" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(22,163,74,0.09)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={22} strokeWidth={2.5} color="#16a34a" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 5 }}>{form.firstName} {form.lastName} wurde angelegt.</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", lineHeight: 1.6 }}>Das Passwort wird nur einmal angezeigt. Bitte jetzt kopieren.</div>
            </div>
            <div style={{ width: "100%", background: "rgba(0,0,0,0.025)", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "rgba(0,0,0,0.3)", marginBottom: 4 }}>Einmalpasswort</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", letterSpacing: "0.04em", fontFamily: "monospace", userSelect: "all" as const }}>{password}</div>
              </div>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: copied ? "rgba(22,163,74,0.1)" : `linear-gradient(to bottom,${R},${RD})`, color: copied ? "#16a34a" : "#fff", boxShadow: copied ? "none" : `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, flexShrink: 0 }}>
                {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            </div>
            <button onClick={onClose} style={{ width: "100%", height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "inherit", background: `linear-gradient(to bottom,${R},${RD})`, boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),inset 0 -1px 0 rgba(255,255,255,0.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, transition: "all 0.15s" }}>Fertig</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function ShelfMerchandiserPage() {
  const [gms, setGms] = useState<SMRecord[]>([]);
  const [assignments, setAssignments] = useState<SmPlanningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingGms, setIsExportingGms] = useState(false);
  const selectedGm = gms.find(g => g.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await fetchSmUsers();
        if (!active) return;
        setGms(rows);
        setBackendError(null);
        try {
          const history = await fetchSmAssignmentHistory();
          if (!active) return;
          setAssignments(history);
          setGms(rows.map((sm) => ({
            ...sm,
            visitCount: history.filter((assignment) => assignment.effective.smUserId === sm.id && assignment.status === "completed").length,
          })));
        } catch (historyError) {
          if (!active) return;
          setAssignments([]);
          setBackendError(historyError instanceof Error
            ? `SMs wurden geladen, aber die Einsatzhistorie nicht: ${historyError.message}`
            : "SMs wurden geladen, aber die Einsatzhistorie konnte nicht geladen werden.");
        }
      } catch (userError) {
        if (!active) return;
        setBackendError(userError instanceof Error ? userError.message : "SM-Liste konnte nicht geladen werden.");
        setGms([]);
        setAssignments([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener("shelfmerchandiser:openCreate", handler);
    return () => window.removeEventListener("shelfmerchandiser:openCreate", handler);
  }, []);


  const handleCreate = useCallback(async (form: FormState) => {
    const created = await createSmUser({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      travelTimeEnabled: form.travelTimeEnabled,
    });
    setGms((prev) => [created, ...prev]);
    setNewId(created.id);
    setTimeout(() => setNewId(null), 600);
    setBackendError(null);
    return { sm: created, password: created.password ?? "" };
  }, []);

  const handleSave = useCallback(async (updated: SMRecord) => {
    try {
      const saved = await updateSmUser(updated);
      setGms((prev) => prev.map((g) => (g.id === saved.id ? { ...saved, password: g.password, visitCount: g.visitCount } : g)));
      setBackendError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SM konnte nicht gespeichert werden.";
      setBackendError(msg);
    }
  }, []);


  const handleExportGms = useCallback(async () => {
    if (isExportingGms) return;
    setExportError(null);
    setIsExportingGms(true);
    try {
      await exportShelfMerchandiserExcel({
        sms: gms,
        assignments,
        exportedBy: readAuthSession()?.user.email ?? "",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export konnte nicht erstellt werden.");
    } finally {
      setIsExportingGms(false);
    }
  }, [assignments, gms, isExportingGms]);

  useEffect(() => {
    const handler = () => { void handleExportGms(); };
    window.addEventListener("admin:shelfmerchandiser:export", handler);
    return () => window.removeEventListener("admin:shelfmerchandiser:export", handler);
  }, [handleExportGms]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(0,0,0,0.3)" }}>Shelf Merchandiser</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {gms.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", fontVariantNumeric: "tabular-nums" }}>{gms.length} {gms.length === 1 ? "SM" : "SMs"}</span>}
          </div>
        </div>
        {backendError ? (
          <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
            {backendError}
          </div>
        ) : null}
        {exportError ? (
          <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
            Export fehlgeschlagen: {exportError}
          </div>
        ) : null}

        <div style={{ margin: "0 10px 10px", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {loading ? (
            <SMCardsSkeleton />
          ) : gms.length === 0 ? (
            <div style={{ padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={22} strokeWidth={1.5} color={R} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: 6 }}>Noch keine Shelf Merchandiser angelegt</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", maxWidth: 300, lineHeight: 1.6 }}>Erstelle den ersten SM, um Shelf-Merchandiser-Zugänge zu verwalten.</div>
              </div>
              <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(to bottom,${R},${RD})`, border: "none", borderRadius: 8, cursor: "pointer", boxShadow: `inset 0 1px 0.6px rgba(255,255,255,0.33),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,0.14)`, fontFamily: "inherit" }}>
                <Plus size={11} strokeWidth={2.5} /> SM erstellen
              </button>
            </div>
          ) : (
            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {gms.map(gm => (
                  <SMCard
                    key={gm.id} gm={gm} isNew={gm.id === newId}
                    active={gm.id === selectedId}
                    onClick={() => setSelectedId(selectedId === gm.id ? null : gm.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {selectedGm && <SMDetailDrawer gm={selectedGm} onClose={() => setSelectedId(null)} onSave={handleSave} assignments={assignments} />}
    </div>
  );
}
