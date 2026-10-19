"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Car, Check, ChevronDown, History, Plus, X } from "lucide-react";
import { AdminControlPortal, AdminDatePicker, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { applyMileageCorrection, fetchMileageContext, previewMileageCorrection } from "@/lib/api/backend";
import type { MileageContext, MileageCorrection as Correction, MileageDay, MileagePreview, MileageSnapshot } from "@/types/gmMileage";
import styles from "./MileageCorrection.module.css";

type Draft = { id: string; segments: { startKm: string; endKm: string }[] };
const km = (value: number | null) => value === null ? "—" : `${value.toLocaleString("de-AT")} km`;
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
const snapshotLabel = (snapshot: MileageSnapshot) => snapshot.mileage?.segments.map(s => `${km(s.startKm)} → ${km(s.endKm)}`).join(" / ") ?? `${km(snapshot.startKm)} → ${km(snapshot.endKm)}`;
const draftDay = (day: MileageDay): Draft => ({ id: day.id, segments: (day.mileage?.segments ?? [{ startKm: day.startKm, endKm: day.endKm }]).map(s => ({ startKm: s.startKm === null ? "" : String(s.startKm), endKm: s.endKm === null ? "" : String(s.endKm) })) });

export function MileageCorrectionButton({ sessionId, date, gmName, onSaved, openRequest = 0 }: { sessionId: string; date: string; gmName: string; onSaved: () => Promise<void>; openRequest?: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openRequest) setOpen(true); }, [openRequest]);
  return <><button className={styles.trigger} type="button" onClick={() => setOpen(true)}><Car size={13} />Fahrzeugwechsel nachtragen</button>
    {open && <MileageCorrectionDialog sessionId={sessionId} date={date} gmName={gmName} onClose={() => setOpen(false)} onSaved={onSaved} />}</>;
}

function MileageCorrectionDialog({ sessionId, date, gmName, onClose, onSaved }: { sessionId: string; date: string; gmName: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const [from, setFrom] = useState(date), [to, setTo] = useState(date);
  const [context, setContext] = useState<MileageContext | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [reason, setReason] = useState("Leihwagen");
  const [newStart, setNewStart] = useState("");
  const [breakBefore, setBreakBefore] = useState(true), [returnAfter, setReturnAfter] = useState(true);
  const [preview, setPreview] = useState<MileagePreview | null>(null);
  const [operationId, setOperationId] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(false), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false);
  const [pendingRange, setPendingRange] = useState<{from:string;to:string} | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const close = () => { if (busy) return; if (dirty && success === null) setDiscard(true); else onClose(); };
  useEffect(() => { const node = dialog.current; const focused = document.activeElement as HTMLElement | null; node?.showModal(); setContainer(node); return () => { node?.close(); focused?.focus(); }; }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(null); setPreview(null);
    try { const data = await fetchMileageContext({ sessionId, from, to }); setContext(data); setDrafts(data.selected.map(draftDay)); setNewStart(""); setBreakBefore(data.selected[0]?.mileage?.breakBefore ?? true); setReturnAfter(data.selected.at(-1)?.mileage?.breakAfter ?? true); setDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Arbeitstage konnten nicht geladen werden."); setContext(null); }
    finally { setLoading(false); }
  }, [sessionId, from, to]);
  useEffect(() => { let active = true; setLoading(true); setContext(null); setPreview(null); setError(null);
    fetchMileageContext({ sessionId, from, to }).then(data => { if (active) { setContext(data); setDrafts(data.selected.map(draftDay)); setNewStart(""); setBreakBefore(data.selected[0]?.mileage?.breakBefore ?? true); setReturnAfter(data.selected.at(-1)?.mileage?.breakAfter ?? true); setDirty(false); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Arbeitstage konnten nicht geladen werden."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; }; }, [sessionId, from, to]);
  const changeRange = (range: {from:string;to:string}) => { if (dirty) { setPendingRange(range); setDiscard(true); } else { setFrom(range.from); setTo(range.to); } };
  const discardChanges = () => { if (pendingRange) { setFrom(pendingRange.from); setTo(pendingRange.to); setPendingRange(null); setDiscard(false); setDirty(false); } else onClose(); };
  const changed = () => { setPreview(null); setDirty(true); setError(null); };
  const edit = (id: string, index: number, field: "startKm" | "endKm", value: string) => { changed(); setDrafts(rows => rows.map(row => row.id === id ? { ...row, segments: row.segments.map((part, i) => i === index ? { ...part, [field]: value.replace(/\D/g, "") } : part) } : row)); };
  const applyOffset = () => {
    const first = context?.selected[0];
    if (!first || first.startKm === null || !/^\d+$/.test(newStart)) { setError("Bitte den korrekten Startstand des ersten Tages eingeben."); return; }
    if (context?.selected.some(day => (day.mileage?.segments.length ?? 1) > 1 || day.startKm === null || day.endKm === null)) { setError("Tage mit mehreren Fahrzeugen oder fehlenden Ständen bitte einzeln bearbeiten."); return; }
    const offset = Number(newStart) - first.startKm;
    const rows = context.selected.map(day => ({ id: day.id, segments: [{ startKm: String(day.startKm! + offset), endKm: String(day.endKm! + offset) }] }));
    if (rows.some(row => Number(row.segments[0].startKm) < 0)) { setError("Die Verschiebung würde negative Kilometerstände ergeben."); return; }
    changed(); setDrafts(rows);
  };
  const payload = (): Correction => {
    if (drafts.some(row => row.segments.some(part => !/^\d+$/.test(part.startKm) || !/^\d+$/.test(part.endKm)))) throw new Error("Bitte alle Kilometerstände ausfüllen.");
    return { sessionId, from, to, reason, breakBefore, returnAfter, edits: drafts.map(row => ({ id: row.id, segments: row.segments.map(part => ({ startKm: Number(part.startKm), endKm: Number(part.endKm) })) })) };
  };
  const review = async () => { setBusy(true); setError(null); try { const data = await previewMileageCorrection(payload()); setPreview(data); setOperationId(crypto.randomUUID()); } catch (e) { setError(e instanceof Error ? e.message : "Vorschau nicht möglich."); } finally { setBusy(false); } };
  const save = async () => { if (!preview) return; setBusy(true); setError(null); try { const result = await applyMileageCorrection({ ...payload(), fingerprint: preview.fingerprint, operationId }); setSuccess(result.count); setDirty(false); await onSaved(); } catch (e) { setError(e instanceof Error ? e.message : "Korrektur konnte nicht gespeichert werden."); } finally { setBusy(false); } };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="mileage-title" onCancel={e => { e.preventDefault(); close(); }}>
    <AdminControlPortal container={container}><AdminFilterControlStyles />
      <header className={styles.header}><div><div className={styles.eyebrow}>ZEITERFASSUNG · {gmName}</div><h2 id="mileage-title">Fahrzeugwechsel nachtragen</h2></div><button className={styles.iconButton} aria-label="Schließen" disabled={busy} onClick={close}><X size={18} /></button></header>
      {success !== null ? <div className={styles.success} role="status"><Check size={24} /><h3>{success} {success === 1 ? "Arbeitstag korrigiert" : "Arbeitstage korrigiert"}</h3><p>Neue Stände sind aktiv. Die bisherigen Werte bleiben im Verlauf.</p><button className={styles.primary} onClick={onClose}>Fertig</button></div> : <>
      <fieldset disabled={busy} className={styles.body}>
        {discard ? <div className={styles.discard}><strong>Änderungen verwerfen?</strong><span>Die Korrektur wurde noch nicht gespeichert.</span><div><button className={styles.secondary} onClick={() => { setDiscard(false); setPendingRange(null); }}>Weiter bearbeiten</button><button className={styles.primary} onClick={discardChanges}>{pendingRange ? "Zeitraum wechseln" : "Verwerfen"}</button></div></div> : null}
        <div className={styles.range}><label>Von<AdminDatePicker value={from} maxDate={to} ariaLabel="Fahrzeugkorrektur von" onChange={value => changeRange({from:value,to})} /></label><label>Bis<AdminDatePicker value={to} minDate={from} ariaLabel="Fahrzeugkorrektur bis" onChange={value => changeRange({from,to:value})} /></label><label className={styles.reason}>Grund<input value={reason} maxLength={500} onChange={e => { setReason(e.target.value); changed(); }} /></label></div>
        {loading ? <div className={styles.state} role="status">Arbeitstage werden geladen…</div> : context ? <>
          {context.selected.length === 0 ? <div className={styles.state}>Keine Arbeitstage in diesem Zeitraum.</div> : <>
          <div className={styles.offset}><div><strong>Stände für den Zeitraum ersetzen</strong><p>Ein Startwert verschiebt alle Stände. Tagesstrecken bleiben gleich.</p></div><label className={styles.srOnly} htmlFor="mileage-new-start">Korrekter Startstand am ersten Tag</label><input id="mileage-new-start" inputMode="numeric" placeholder="Korrekter Start-KM" value={newStart} onChange={e => setNewStart(e.target.value.replace(/\D/g, ""))} /><button className={styles.secondary} onClick={applyOffset} disabled={busy || !newStart}>Anwenden</button></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Arbeitstag</th><th>Bisher</th><th>Neuer Start-KM</th><th>Neuer End-KM</th><th>Dienstlich</th><th><span className={styles.srOnly}>Fahrzeugabschnitt</span></th></tr></thead><tbody>{drafts.map((row, rowIndex) => { const day = context.selected[rowIndex]; const distance = row.segments.reduce((sum, part) => sum + Number(part.endKm) - Number(part.startKm), 0); return row.segments.map((part, index) => <tr key={`${row.id}-${index}`} className={index ? styles.continuation : ""}>
            <td>{index === 0 ? <><strong>{dateLabel(day.workDate)}</strong><span>{row.segments.length > 1 ? "Fahrzeug 1" : ""}</span></> : <span>Fahrzeug {index + 1}</span>}</td><td className={styles.oldValue}>{index === 0 ? <>{km(day.startKm)}<span>{km(day.endKm)}</span></> : "—"}</td>
            {(["startKm", "endKm"] as const).map(field => <td key={field}><input aria-label={`${field === "startKm" ? "Start-KM" : "End-KM"} ${day.workDate} Fahrzeug ${index + 1}`} inputMode="numeric" value={part[field]} onChange={e => edit(row.id, index, field, e.target.value)} disabled={busy} /></td>)}
            <td className={styles.distance}>{index === 0 ? km(distance) : ""}</td><td>{index === 0 ? <button className={styles.iconButton} title="Zweites Fahrzeug am selben Tag" aria-label={`Fahrzeugabschnitt hinzufügen ${day.workDate}`} disabled={busy || row.segments.length >= 8} onClick={() => { changed(); if (rowIndex === 0) setBreakBefore(false); setDrafts(rows => rows.map(r => r.id === row.id ? { ...r, segments: [...r.segments, { startKm: "", endKm: "" }] } : r)); }}><Plus size={14} /></button> : <button className={styles.iconButton} aria-label={`Fahrzeugabschnitt entfernen ${day.workDate} ${index + 1}`} disabled={busy} onClick={() => { changed(); setDrafts(rows => rows.map(r => r.id === row.id ? { ...r, segments: r.segments.filter((_, i) => i !== index) } : r)); }}><X size={13} /></button>}</td>
          </tr>); })}</tbody></table></div>
          <div className={styles.boundaries}><label><input type="checkbox" checked={breakBefore} onChange={e => { setBreakBefore(e.target.checked); changed(); }} />Anderes Fahrzeug ab erstem Tag</label><label><input type="checkbox" checked={returnAfter} onChange={e => { setReturnAfter(e.target.checked); changed(); }} />Rückwechsel nach letztem Tag</label></div>
          {preview && <div className={styles.preview} aria-live="polite"><div><span>Privatkilometer im Vergleich</span><strong><del>{km(preview.before.privateKm)}</del><ArrowRight size={16} />{km(preview.after.privateKm)}</strong></div><div><span>Dienstliche Kilometer</span><strong>{km(preview.before.businessKm)}<ArrowRight size={16} />{km(preview.after.businessKm)}</strong></div><p>Zeitraum einschließlich angrenzender Arbeitstage. Fahrzeuggrenzen werden nicht als Privatfahrt gerechnet.</p></div>}
          </>}
          <button className={styles.historyToggle} onClick={() => setHistory(value => !value)} aria-expanded={history}><History size={13} />Verlauf dieses Arbeitstags · {context.history.length}<ChevronDown size={13} style={{ transform: history ? "rotate(180deg)" : undefined }} /></button>
          {history && <div className={styles.history}>{context.history.length === 0 ? <p>Noch keine Fahrzeugkorrekturen.</p> : context.history.map(event => <article key={event.id}><div><strong>{event.reason}</strong><span>{event.actor} · {new Date(event.createdAt).toLocaleString("de-AT")}</span></div><p><span>{snapshotLabel(event.before)}</span><ArrowRight size={13} /><strong>{snapshotLabel(event.after)}</strong></p></article>)}</div>}
        </> : <button className={styles.secondary} onClick={() => void load()}>Erneut laden</button>}
        {error && <div role="alert" className={styles.error}>{error}</div>}
      </fieldset>
      <footer className={styles.footer}><span>Originalwerte bleiben im Verlauf erhalten.</span><div><button className={styles.secondary} onClick={close} disabled={busy}>Abbrechen</button>{preview ? <button className={styles.primary} onClick={() => void save()} disabled={busy}>{busy ? "Wird gespeichert…" : `${preview.days.length} ${preview.days.length === 1 ? "Tag" : "Tage"} korrigieren`}</button> : <button className={styles.primary} onClick={() => void review()} disabled={busy || loading || !context?.selected.length || reason.trim().length < 2}>{busy ? "Wird geprüft…" : "Vorschau prüfen"}</button>}</div></footer>
      </>}
    </AdminControlPortal>
  </dialog>;
}
