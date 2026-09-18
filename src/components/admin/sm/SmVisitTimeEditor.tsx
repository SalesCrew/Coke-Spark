"use client";

import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { correctAdminSmVisitTime } from "@/lib/api/backend";
import { fromViennaDateTimeInput, toViennaDateTimeInput } from "@/lib/sm/visitTimeCorrection";

type Save = typeof correctAdminSmVisitTime;

export function SmVisitTimeEditor({ assignmentId, visitId, startedAt, completedAt, onSaved, onCancel, save = correctAdminSmVisitTime }: {
  assignmentId: string; visitId: string; startedAt: string | null; completedAt: string | null;
  onSaved: () => Promise<void> | void; onCancel: () => void; save?: Save;
}) {
  const [start, setStart] = useState(() => toViennaDateTimeInput(startedAt));
  const [end, setEnd] = useState(() => toViennaDateTimeInput(completedAt));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStart = fromViennaDateTimeInput(start, startedAt ?? undefined);
  const nextEnd = fromViennaDateTimeInput(end, completedAt ?? undefined);
  const elapsed = nextStart && nextEnd ? new Date(nextEnd).getTime() - new Date(nextStart).getTime() : 0;
  const unchanged = Boolean(startedAt && completedAt)
    && nextStart === new Date(startedAt!).toISOString()
    && nextEnd === new Date(completedAt!).toISOString();
  const timeError = !nextStart || !nextEnd ? "Bitte gültige Start- und Endzeit eingeben."
    : elapsed < 60_000 || elapsed > 86_400_000 ? "Ende muss mindestens 1 Minute nach Start und höchstens 24 Stunden später liegen."
      : unchanged ? "Start und Ende sind unverändert." : null;
  const canSave = !busy && !timeError && reason.trim().length >= 3;
  const duration = elapsed > 0 ? Math.max(1, Math.round(elapsed / 60_000)) : null;
  const durationLabel = duration === null ? "—" : duration < 60 ? `${duration} Min` : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}min` : ""}`;

  const submit = async () => {
    if (!canSave || !nextStart || !nextEnd) return;
    setBusy(true); setError(null);
    try {
      await save(assignmentId, { expectedVisitId: visitId, expectedStartedAt: startedAt, expectedCompletedAt: completedAt,
        visitStartedAt: nextStart, visitCompletedAt: nextEnd, reason: reason.trim() });
      await onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Die Besuchszeit konnte nicht gespeichert werden.");
    } finally { setBusy(false); }
  };

  return <div className="sm-visit-time-editor" aria-label="Start und Endzeit bearbeiten">
    <style>{`
      .sm-visit-time-editor{display:grid;gap:10px;padding:12px;border:1px solid #eceef1;border-radius:9px;background:#fafbfc;font-size:11px}
      .sm-visit-time-fields{display:flex;flex-wrap:wrap;align-items:end;gap:10px}
      .sm-visit-time-fields label{min-width:165px;flex:1}
      .sm-visit-time-editor label span,.sm-visit-time-duration span{display:block;margin-bottom:5px;color:#858c98;font-size:9px;font-weight:650}
      .sm-visit-time-editor input{width:100%;box-sizing:border-box;height:32px;padding:5px 8px;border:1px solid #e1e4e9;border-radius:7px;background:#fff;color:#252a33;font:inherit;font-size:11px}
      .sm-visit-time-editor input:focus{outline:2px solid #dc262633;border-color:#dc262680}
      .sm-visit-time-duration{min-width:102px;padding-bottom:6px;font-variant-numeric:tabular-nums}
      .sm-visit-time-duration strong{font-size:11px}
      .sm-visit-time-hint,.sm-visit-time-error{margin:0;color:#858c98;font-size:10px}
      .sm-visit-time-error{color:#b91c1c}
      .sm-visit-time-actions{display:flex;justify-content:flex-end;gap:8px}
      .sm-visit-time-actions button{display:inline-flex;align-items:center;gap:5px;height:29px;padding:0 10px;border-radius:7px;font:inherit;font-size:10px;font-weight:650;cursor:pointer}
      .sm-visit-time-actions button:disabled{opacity:.45;cursor:not-allowed}
      .sm-visit-time-cancel{background:#fff;border:1px solid #e1e4e9;color:#5b6470}
      .sm-visit-time-save{background:#dc2626;border:1px solid #dc2626;color:#fff}
      .sm-visit-time-spinner{animation:smVisitTimeSpin .8s linear infinite}
      @keyframes smVisitTimeSpin{to{transform:rotate(360deg)}}
    `}</style>
    <div className="sm-visit-time-fields">
      <label><span>Start</span><input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} disabled={busy} /></label>
      <label><span>Ende</span><input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} disabled={busy} /></label>
      <div className="sm-visit-time-duration"><span>Besuchsdauer</span><strong>{durationLabel}</strong></div>
    </div>
    <label><span>Grund für die Korrektur *</span><input value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} disabled={busy} placeholder="Warum werden Start oder Ende geändert?" /></label>
    {timeError ? <p className="sm-visit-time-hint">{timeError}</p> : null}
    {error ? <p role="alert" className="sm-visit-time-error">{error}</p> : null}
    <div className="sm-visit-time-actions">
      <button type="button" className="sm-visit-time-cancel" onClick={onCancel} disabled={busy}><X size={12} /> Abbrechen</button>
      <button type="button" className="sm-visit-time-save" onClick={() => { void submit(); }} disabled={!canSave}>{busy ? <LoaderCircle size={12} className="sm-visit-time-spinner" /> : <Check size={12} />} Speichern</button>
    </div>
  </div>;
}
