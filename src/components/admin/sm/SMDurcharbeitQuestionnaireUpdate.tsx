"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { requestSMDurcharbeitCampaign } from "@/lib/api/backend";
import type { SMDurcharbeitQuestionnaireUpdatePreview } from "@/types/smSMDurcharbeitCampaign";
import styles from "./SMDurcharbeitCampaignWorkspace.module.css";

const monthName = (month: string) => new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));

export function SMDurcharbeitQuestionnaireUpdate({ campaignId, campaignName, month, revision, canUpdate, onUpdated, onBusyChange }: {
  campaignId: string; campaignName: string; month: string; revision: number; canUpdate: boolean;
  onUpdated: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<SMDurcharbeitQuestionnaireUpdatePreview | null>(null);
  const [error, setError] = useState<string | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), mounted = useRef(false), generation = useRef(0), saving = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await requestSMDurcharbeitCampaign<SMDurcharbeitQuestionnaireUpdatePreview>(`/${campaignId}/questionnaire-update?month=${encodeURIComponent(month)}`);
      if (mounted.current && request === generation.current) { setPreview(next); setError(null); if (next.available) setSuccess(false); }
    } catch (failure) {
      if (mounted.current && request === generation.current) setError(failure instanceof Error ? failure.message : "Der Fragebogenstand konnte nicht geprüft werden.");
    }
  }, [campaignId, month]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const visible = () => { if (!document.hidden && !saving.current) void refresh(); };
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", visible); window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, revision]);
  const close = () => { if (!saving.current) setOpen(false); };
  const confirm = async () => {
    if (!preview?.available || !canUpdate || saving.current) return;
    saving.current = true; setBusy(true); onBusyChange(true); setError(null);
    try {
      await requestSMDurcharbeitCampaign(`/${campaignId}/questionnaire-update`, {
        month, expectedRevision: preview.campaignRevision, previewToken: preview.previewToken,
      }, "PATCH");
      if (mounted.current) { setOpen(false); setSuccess(true); setPreview(null); onUpdated(); }
    } catch (failure) {
      if (mounted.current) { setError(failure instanceof Error ? failure.message : "Die neue Fassung konnte nicht übernommen werden."); }
    } finally { saving.current = false; if (mounted.current) setBusy(false); onBusyChange(false); }
  };
  if (!preview?.available && !error && !success) return null;
  return <>
    <div className={styles.questionnaireNotice} aria-label="Fragebogenstand">
      <div className="min-w-0">
        <p className={styles.questionnaireNoticeTitle}>{success ? "Neue Fragebogenfassung übernommen" : error && !preview ? "Fragebogenstand nicht erreichbar" : "Neue Fragebogenfassung verfügbar"}</p>
        {preview?.available ? <p className={styles.questionnaireNoticeDetail}>{preview.current.name} · {preview.current.questionCount} → {preview.next.questionCount} Fragen</p> : null}
        {success ? <p role="status" className={styles.questionnaireNoticeDetail}>Neue Besuche in {monthName(month)} verwenden die aktualisierten Fragen.</p> : null}
        {!open && error ? <p role="alert" className={styles.questionnaireError}>{error}</p> : null}
      </div>
      {preview?.available && canUpdate ? <button ref={trigger} type="button" className={styles.secondary} disabled={busy} onClick={() => { setSuccess(false); setOpen(true); }}>Änderungen ansehen</button>
        : error ? <button type="button" className={styles.secondary} onClick={() => void refresh()}>Erneut prüfen</button> : null}
    </div>
    {open && preview ? <UpdateDialog preview={preview} campaignName={campaignName} busy={busy} error={error} returnFocus={trigger}
      onClose={close} onConfirm={() => void confirm()} onRefresh={() => void refresh()} /> : null}
  </>;
}

function UpdateDialog({ preview, campaignName, busy, error, returnFocus, onClose, onConfirm, onRefresh }: {
  preview: SMDurcharbeitQuestionnaireUpdatePreview; campaignName: string; busy: boolean; error: string | null;
  returnFocus: RefObject<HTMLButtonElement | null>;
  onClose: () => void; onConfirm: () => void; onRefresh: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId(), detailId = useId();
  useEffect(() => {
    const current = dialog.current, opener = returnFocus.current;
    current?.showModal();
    return () => { current?.close(); if (opener?.isConnected) opener.focus(); };
  }, [returnFocus]);
  const changes = [preview.changes.added ? `${preview.changes.added} hinzugefügt` : "", preview.changes.removed ? `${preview.changes.removed} entfernt` : "", preview.changes.changed ? `${preview.changes.changed} geändert` : ""].filter(Boolean);
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={detailId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className={styles.questionnaireDialog}>
    <header className={styles.questionnaireDialogHeader}>
      <div><h2 id={titleId}>Fragebogen aktualisieren</h2><p>{campaignName} · {monthName(preview.month)}</p></div>
      <button type="button" aria-label="Dialog schließen" className={styles.questionnaireClose} disabled={busy} onClick={onClose}><X size={15} /></button>
    </header>
    <p className={styles.questionnaireName}>{preview.next.name}</p>
    <div className={styles.questionnaireComparison}>
      <section aria-label="Aktuell zugewiesene Fassung"><h3>Aktuell</h3><p><strong>{preview.current.questionCount}</strong> Fragen</p><span>Version {preview.current.versionNumber}</span></section>
      <ArrowRight size={17} className={styles.questionnaireArrow} aria-hidden="true" />
      <section aria-label="Neue Fragebogenfassung"><h3>Neue Fassung</h3><p><strong>{preview.next.questionCount}</strong> Fragen</p><span>Version {preview.next.versionNumber}</span></section>
    </div>
    <p className={styles.questionnaireChanges}>{changes.length ? changes.join(" · ") : "Aktualisierte Fassung des Fragebogens"}</p>
    <div id={detailId} className={styles.questionnaireScope}>
      <p>Für neue Besuche in <strong>{monthName(preview.month)}</strong> werden die aktuellen Fragen übernommen.</p>
      {preview.requiresPublication ? <p>Die gespeicherten Moduländerungen werden dabei als neue Fragebogenfassung veröffentlicht.</p> : null}
      <p>Bereits gestartete und abgeschlossene Besuche behalten ihre Fragen, Antworten und Fotos.</p>
      {preview.preserved.drafts || preview.preserved.completed ? <span>Laufende Besuche: {preview.preserved.drafts} · Abgeschlossene Besuche: {preview.preserved.completed}</span> : null}
    </div>
    {error ? <div className={styles.questionnaireError}><p role="alert">{error}</p><button type="button" disabled={busy} onClick={onRefresh}>Stand erneut prüfen</button></div> : null}
    <footer className={styles.questionnaireDialogFooter}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>Beibehalten</button>
      <button type="button" className={styles.primary} disabled={busy || !preview.available || Boolean(error)} onClick={onConfirm}>{busy ? <LoaderCircle size={13} className="motion-safe:animate-spin" aria-hidden="true" /> : null}{busy ? "Wird übernommen…" : "Neue Fassung übernehmen"}</button>
    </footer>
  </dialog>;
}
