"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AdminControlPortal, AdminDropdown, AdminFilterControlStyles, SMDurcharbeitFilterTheme } from "@/components/admin/AdminFilterControls";
import type { SMDurcharbeitTransferInput, SMDurcharbeitTransferPreview, SMDurcharbeitTransferRow } from "@/types/smSMDurcharbeitTransfer";
import buttons from "./SMDurcharbeitCampaignWorkspace.module.css";
import styles from "./SMDurcharbeitOwnerTransfer.module.css";

function monthName(value: string) { return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

export function SMDurcharbeitOwnerTransfer({ context, campaignName, month, rows, people, onPreview, onSave, onClose }: {
  context: "campaign" | "default"; campaignName?: string; month?: string;
  rows: SMDurcharbeitTransferRow[]; people: Array<{ id: string; name: string }>;
  onPreview: (input: SMDurcharbeitTransferInput) => Promise<SMDurcharbeitTransferPreview>;
  onSave: (input: SMDurcharbeitTransferInput, token: string) => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), noteId = useId();
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<"selection" | "person">("person");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()), [query, setQuery] = useState("");
  const [source, setSource] = useState(""), [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SMDurcharbeitTransferPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPortal(dialog); dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  const sources = useMemo(() => {
    const byId = new Map<string, { value: string; label: string; count: number }>();
    rows.forEach(row => { if (row.smUserId) { const existing = byId.get(row.smUserId); byId.set(row.smUserId, { value: row.smUserId, label: row.smName || "SM nicht verfügbar", count: (existing?.count ?? 0) + 1 }); } });
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "de-AT")).map(person => ({ ...person, description: `${person.count} Märkte` }));
  }, [rows]);
  const chosen = useMemo(() => mode === "person" ? rows.filter(row => Boolean(source) && row.smUserId === source) : rows.filter(row => selectedIds.has(row.id)), [mode, rows, selectedIds, source]);
  const matchingRows = useMemo(() => rows.filter(row => `${row.name} ${row.detail} ${row.smName}`.toLocaleLowerCase("de-AT").includes(query.trim().toLocaleLowerCase("de-AT"))), [rows, query]);
  const destinationName = people.find(person => person.id === destination)?.name ?? "";
  const input = (): SMDurcharbeitTransferInput => ({ marketIds: chosen.map(row => row.id), ...(mode === "person" ? { sourceSmUserId: source } : {}), SMDurcharbeitSmUserId: destination, reason: reason.trim() });
  const change = (action: () => void) => { action(); setPreview(null); setError(null); };
  const perform = async (save: boolean) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (save && preview) await onSave(input(), preview.previewToken);
      else setPreview(await onPreview(input()));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Die Änderung konnte nicht gespeichert werden."); if (save) setPreview(null); }
    finally { pending.current = false; setBusy(false); }
  };
  const scopeNote = context === "default"
    ? "Ändert den Standard-SM im Durcharbeit-Marktbestand. Monatsvertretungen und begonnene oder abgeschlossene Besuche bleiben erhalten."
    : `Gilt nur für ${campaignName ?? "diese Kampagne"}${month ? ` · ${monthName(month)}` : ""}. Die Zuordnung im Marktbestand und alle anderen Monate bleiben unverändert.`;
  return <SMDurcharbeitFilterTheme enabled><AdminFilterControlStyles /><dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} aria-describedby={noteId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.header}><div><h2 id={titleId}>SM austauschen</h2><p>{context === "campaign" ? `${campaignName} · ${month ? monthName(month) : ""}` : "Durcharbeit Märkte · Standardzuordnung"}</p></div>
      <button type="button" className={styles.close} disabled={busy} aria-label="SM-Wechsel schließen" onClick={onClose}><X size={14} /></button></header>
    <AdminControlPortal container={portal}><div className={styles.body}>
      {!preview ? <>
        <div className={styles.modes} role="group" aria-label="Märkte für SM-Wechsel">
          <button type="button" aria-pressed={mode === "person"} disabled={busy} onClick={() => change(() => setMode("person"))}>Alle Märkte eines SM</button>
          <button type="button" aria-pressed={mode === "selection"} disabled={busy} onClick={() => change(() => setMode("selection"))}>Einzelne Märkte auswählen</button>
        </div>
        {mode === "person" ? <div className={styles.field}><span className={styles.label}>Bisheriger SM</span><AdminDropdown value={source} options={sources} onChange={value => change(() => setSource(value))} ariaLabel="Bisheriger SM für alle Märkte" placeholder="SM auswählen" searchable disabled={busy} /></div> : null}
        {mode === "selection" ? <div className={styles.picker}>
          <input className={styles.input} aria-label="Märkte im Austauschfenster suchen" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="Markt oder SM suchen…" />
          <div className={styles.marketList} role="group" aria-label="Märkte für den Austausch auswählen">{matchingRows.map(row => <label key={row.id} className={styles.marketOption}>
            <input type="checkbox" className={styles.checkbox} aria-label={`${row.name} für Austausch auswählen`} checked={selectedIds.has(row.id)} disabled={busy || Boolean(row.unavailableReason)} onChange={event => change(() => setSelectedIds(current => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; }))} />
            <span><strong>{row.name}</strong><small>{row.detail}</small></span><small>{row.unavailableReason || row.smName}</small>
          </label>)}{!matchingRows.length ? <p className={styles.note}>Keine passenden Märkte</p> : null}</div>
        </div> : null}
        <div className={styles.field}><span className={styles.label}>Neuer SM</span><AdminDropdown value={destination} options={people.map(person => ({ value: person.id, label: person.name }))} onChange={value => change(() => setDestination(value))} ariaLabel="Neuer SM für Durcharbeit-Märkte" placeholder="SM auswählen" searchable disabled={busy} /></div>
        <label className={styles.field}><span className={styles.label}>Begründung</span><input className={styles.input} aria-label="Begründung des SM-Wechsels" value={reason} maxLength={1000} disabled={busy} onChange={event => change(() => setReason(event.target.value))} placeholder="z. B. Vertretung während Abwesenheit" /></label>
        <div className={styles.summary}><strong>{chosen.length} {chosen.length === 1 ? "Markt ausgewählt" : "Märkte ausgewählt"}</strong>
          <ul>{chosen.slice(0, 4).map(row => <li key={row.id}><span title={`${row.name} · ${row.detail}`}>{row.name}</span><small>{row.smName}</small></li>)}</ul>
          {chosen.length > 4 ? <p className={styles.note}>und {chosen.length - 4} weitere Märkte</p> : null}
        </div>
      </> : <div className={styles.review}><strong>{preview.changedMarketCount} {preview.changedMarketCount === 1 ? "Markt" : "Märkte"} → {destinationName}</strong>
        <p>{context === "campaign" ? `${preview.changeCount} Monatszuordnungen werden geändert.` : `${preview.changeCount} Standardzuordnungen werden geändert.`}{preview.unchangedCount ? ` ${preview.unchangedCount} bereits passend.` : ""}</p>
        {preview.protected.length ? <details><summary>{preview.protected.length} geschützte oder ausgenommene Monatsziele bleiben unverändert</summary><ul>{preview.protected.map((row, index) => <li key={`${row.month}:${row.name}:${index}`}>{row.name}{row.month ? ` · ${monthName(row.month)}` : ""} — {row.reason}</li>)}</ul></details> : null}
        {!preview.changeCount ? <p>Für diese Auswahl ist keine Änderung möglich oder erforderlich.</p> : null}
      </div>}
      <p id={noteId} className={styles.note}>{scopeNote}</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div><footer className={styles.footer}>
      <button type="button" className={buttons.secondary} disabled={busy} onClick={() => preview ? setPreview(null) : onClose()}>{preview ? "Zurück" : "Abbrechen"}</button>
      <button type="button" className={buttons.primary} disabled={busy || !destination || !chosen.length || reason.trim().length < 3 || Boolean(preview && !preview.changeCount)} onClick={() => void perform(Boolean(preview))}>
        {busy ? "Bitte warten…" : preview ? "Austausch speichern" : "Änderung prüfen"}
      </button>
    </footer></AdminControlPortal>
  </dialog></SMDurcharbeitFilterTheme>;
}
