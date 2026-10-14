"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { AdminDropdown, AdminFilterControlStyles, SMDurcharbeitFilterTheme } from "@/components/admin/AdminFilterControls";
import type { SMRecord } from "@/types/shelfmerchandiser";
import type { SmMarketRecord } from "@/types/smMarkets";

export function SMDurcharbeitMarketSmEditor({ market, users, canUpdate, onSave }: {
  market: SmMarketRecord; users: SMRecord[]; canUpdate: boolean;
  onSave: (id: string | null, expectedUpdatedAt: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false), [selected, setSelected] = useState(market.assignedSmUserId ?? "none");
  const [version, setVersion] = useState(market.updatedAt ?? ""), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const person = users.find(user => user.id === market.assignedSmUserId);
  const name = !market.assignedSmUserId ? "Nicht zugewiesen" : person ? `${person.firstName} ${person.lastName}`.trim() : market.shelfMerchandiserName || "SM nicht verfügbar";
  async function save() {
    if (saving || !version || !canUpdate) return;
    setSaving(true); setError(null);
    try { await onSave(selected === "none" ? null : selected, version); setEditing(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "SM konnte nicht geändert werden."); }
    finally { setSaving(false); }
  }
  return <SMDurcharbeitFilterTheme enabled><AdminFilterControlStyles />
    <div style={{ minWidth: 0, fontSize: 11 }}>
      {editing ? <>
        <AdminDropdown value={selected} options={[{ value: "none", label: "Nicht zugewiesen" }, ...users.filter(user => user.isActive || user.id === market.assignedSmUserId).map(user => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), description: user.email }))]} onChange={setSelected} ariaLabel="Standard-SM für Durcharbeit-Markt" placeholder="SM auswählen" searchable disabled={saving} />
        <p style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: "#6b7280" }}>Gilt als Marktstandard. Monatsvertretungen und begonnene Besuche bleiben erhalten.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
          <button type="button" className="sm-market-edit-button is-secondary" disabled={saving} onClick={() => { setEditing(false); setError(null); }}>Abbrechen</button>
          <button type="button" className="sm-market-edit-button is-primary" disabled={saving || !version || selected === (market.assignedSmUserId ?? "none")} onClick={() => void save()}>{saving ? "Speichert…" : "SM speichern"}</button>
        </div>
      </> : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{name}</span>
        {canUpdate ? <button type="button" className="sm-icon-button" aria-label="Standard-SM ändern" title="Standard-SM ändern" onClick={() => { setSelected(market.assignedSmUserId ?? "none"); setVersion(market.updatedAt ?? ""); setError(null); setEditing(true); }}><Pencil size={12} /></button> : null}
      </div>}
      {error ? <p role="alert" style={{ marginTop: 8, fontSize: 10, color: "#b91c1c" }}>{error}</p> : null}
    </div>
  </SMDurcharbeitFilterTheme>;
}
