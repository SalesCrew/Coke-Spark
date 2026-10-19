"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { saveDayVehicleChange, type DaySession } from "@/lib/api/backend";
import styles from "./VehicleChangeDialog.module.css";

export function VehicleChangeDialog({ dayStartKm, onClose, onSaved }: { dayStartKm: number | null; onClose: () => void; onSaved: (session: DaySession) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [beforeWork, setBeforeWork] = useState(false);
  const [oldEnd, setOldEnd] = useState("");
  const [newStart, setNewStart] = useState(""), [newEnd, setNewEnd] = useState("");
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null), [discard, setDiscard] = useState(false);
  const close = () => { if (saving) return; if (oldEnd || newStart || newEnd) setDiscard(true); else onClose(); };
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const node = ref.current; node?.showModal(); return () => { node?.close(); previous?.focus(); }; }, []);
  async function save() {
    if (!/^\d+$/.test(newStart) || !/^\d+$/.test(newEnd) || !beforeWork && (dayStartKm === null || !/^\d+$/.test(oldEnd))) { setError("Bitte alle Kilometerstände ausfüllen."); return; }
    const segments = [...(!beforeWork ? [{ startKm: dayStartKm!, endKm: Number(oldEnd) }] : []), { startKm: Number(newStart), endKm: Number(newEnd) }];
    if (segments.some(part => part.endKm < part.startKm)) { setError("Der Endstand muss je Fahrzeug mindestens dem Startstand entsprechen."); return; }
    setSaving(true); setError(null);
    try { const result = await saveDayVehicleChange({ segments, beforeWork }); onSaved(result.session); }
    catch (e) { setError(e instanceof Error ? e.message : "Fahrzeugwechsel konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="vehicle-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header><div><span>MEIN ARBEITSTAG</span><h2 id="vehicle-title">Fahrzeug gewechselt?</h2></div><button aria-label="Schließen" onClick={close} disabled={saving}><X size={18} /></button></header>
    <div className={styles.content}>
      {discard ? <div className={styles.discard}><strong>Eingaben verwerfen?</strong><div><button onClick={() => setDiscard(false)}>Weiter bearbeiten</button><button onClick={onClose}>Verwerfen</button></div></div> : null}
      <div className={styles.switch} role="group" aria-label="Zeitpunkt des Fahrzeugwechsels"><button aria-pressed={!beforeWork} onClick={() => setBeforeWork(false)}>Während des Tages</button><button aria-pressed={beforeWork} onClick={() => setBeforeWork(true)}>Vor Arbeitsbeginn</button></div>
      {!beforeWork && <section><h3>Bisheriges Fahrzeug</h3><div className={styles.fields}><div className={styles.reading}><span>Start heute</span><strong>{dayStartKm?.toLocaleString("de-AT") ?? "—"} km</strong></div><label>Letzter KM-Stand<input autoFocus inputMode="numeric" value={oldEnd} onChange={e => setOldEnd(e.target.value.replace(/\D/g, ""))} /></label></div></section>}
      <section><h3>Neues Fahrzeug</h3><div className={styles.fields}><label>KM bei Übernahme<input inputMode="numeric" value={newStart} onChange={e => setNewStart(e.target.value.replace(/\D/g, ""))} /></label><label>KM am Tagesende<input inputMode="numeric" value={newEnd} onChange={e => setNewEnd(e.target.value.replace(/\D/g, ""))} /></label></div></section>
      <p>Die Strecken beider Fahrzeuge werden getrennt berechnet.</p>{error && <div className={styles.error} role="alert">{error}</div>}
    </div><footer><button onClick={close} disabled={saving}>Abbrechen</button><button className={styles.primary} onClick={() => void save()} disabled={saving}>{saving ? "Wird gespeichert…" : "Fahrzeugwechsel speichern"}</button></footer>
  </dialog>;
}
