"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";
import { AdminDatePicker, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import type { Campaign } from "@/types/campaign";
import { BackendApiError, getCampaignOverlapConflicts } from "@/lib/api/backend";
import { campaignExtensionMinimum, campaignExtensionToday, formatCampaignEndDate } from "@/lib/campaign-extension";

export function CampaignExtensionDialog({ campaign, onSave, onClose }: {
  campaign: Campaign;
  onSave: (endDate: string) => Promise<void>;
  onClose: () => void;
}) {
  const [endDate, setEndDate] = useState(campaign.endDate ?? "");
  const minimum = campaignExtensionMinimum(campaign);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submitting = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const [dateField, setDateField] = useState<HTMLDivElement | null>(null);
  const unlimited = campaign.scheduleType === "always" || !campaign.endDate;
  const reactivating = campaign.status === "inactive";
  const futureStart = Boolean(campaign.startDate && campaign.startDate > campaignExtensionToday());
  const valid = !unlimited && endDate >= minimum;
  const overlaps = getCampaignOverlapConflicts(error);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dateTrigger = dialog.current?.querySelector<HTMLButtonElement>('[aria-label="Neues Enddatum"]:not(:disabled)');
    (dateTrigger ?? dialog.current?.querySelector<HTMLButtonElement>('button[aria-label="Schließen"]'))?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const buttonStyle = { border: "1px solid rgba(0,0,0,.08)", borderRadius: 8, background: "#fff", padding: "9px 12px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" };

  async function save() {
    if (!valid || submitting.current) return;
    submitting.current = true; setSaving(true); setError(null);
    try { await onSave(endDate); }
    catch (cause) { setError(cause); }
    finally { submitting.current = false; setSaving(false); }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9900, background: "rgba(15,23,42,.26)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting.current) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="campaign-extension-title" aria-busy={saving}
        style={{ width: "min(100%, 460px)", maxHeight: "calc(100dvh - 40px)", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 16px 56px rgba(0,0,0,.18)", padding: 24 }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!submitting.current) {
              const trigger = dateField?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
              if (trigger) { trigger.click(); trigger.focus(); }
              else onClose();
            }
          }
          if (event.key === "Tab") {
            const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
            const first = buttons[0], last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
          <div><h2 id="campaign-extension-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Kampagne verlängern</h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 20px", overflowWrap: "anywhere" }}>{campaign.name}</p></div>
          <button type="button" aria-label="Schließen" disabled={saving} onClick={onClose} style={{ ...buttonStyle, padding: 5, border: "none", color: "#9ca3af" }}><X size={17} /></button>
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Bisheriges Ende: <strong style={{ color: "#374151" }}>{formatCampaignEndDate(campaign.endDate)}</strong></div>
        <AdminFilterControlStyles />
        <style>{`
          .campaign-extension-date .sm-plan-date-trigger{height:auto;padding:9px 12px;border-color:rgba(0,0,0,.12);border-radius:8px;background:#fff;font-size:12px;font-weight:600;box-shadow:none}
          .campaign-extension-date .sm-plan-date-trigger.is-open{border-color:#dc2626}
          .campaign-extension-date .sm-plan-date-trigger svg{width:15px;height:15px;color:#9ca3af}
          .campaign-extension-date .sm-plan-calendar-day{font-size:12px;font-weight:500}
          .campaign-extension-date .sm-plan-calendar-day:disabled:not(.is-selected){color:#606975}
          .campaign-extension-date .sm-plan-calendar-day.is-selected{color:#fff;font-weight:650}
          .campaign-extension-action{height:34px;padding:0 14px;border:0;border-radius:8px;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s ease}
          .campaign-extension-action.is-secondary{background:linear-gradient(to bottom,#fff,#f7f7f8);color:rgba(0,0,0,.58);box-shadow:inset 0 1px .6px rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.09),0 1px 4px rgba(0,0,0,.06)}
          .campaign-extension-action.is-primary{padding:0 16px;background:linear-gradient(to bottom,#DC2626,#b91c1c);color:#fff;font-weight:700;box-shadow:inset 0 1px .6px rgba(255,255,255,.33),inset 0 -1px 0 rgba(255,255,255,.15),0 0 0 1px #a91b1b,0 1px 6px rgba(180,20,20,.14)}
          .campaign-extension-action:hover:not(:disabled){opacity:.9}
          .campaign-extension-action:focus-visible{outline:2px solid rgba(0,0,0,.2);outline-offset:3px}
          .campaign-extension-action:disabled{cursor:not-allowed}
          .campaign-extension-action.is-secondary:disabled{opacity:.7}
          .campaign-extension-action.is-primary:disabled{background:rgba(0,0,0,.12);color:rgba(0,0,0,.28);box-shadow:none}
        `}</style>
        <div ref={setDateField} className="campaign-extension-date">
          {saving || unlimited ? (
            <button type="button" aria-label="Neues Enddatum" disabled
              style={{ ...buttonStyle, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", borderColor: "rgba(0,0,0,.12)", fontWeight: 600 }}>
              {formatCampaignEndDate(endDate || null)}<Calendar size={15} color="#9ca3af" />
            </button>
          ) : (
            <AdminDatePicker
              ariaLabel="Neues Enddatum"
              value={endDate}
              minDate={minimum}
              portalContainer={dateField}
              onChange={(value) => { setEndDate(value); setError(null); }}
            />
          )}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.65, color: "#6b7280", margin: "16px 0" }}>
          {unlimited ? "Diese Kampagne läuft bereits unbefristet. Eine inaktive Kampagne kannst du über „Kampagne aktiv“ wieder aktivieren." : futureStart ? "Die Kampagne bleibt bis zum bisherigen Startdatum geplant." : reactivating ? "Mit dem neuen Enddatum wird diese Kampagne wieder aktiviert." : "Die aktive Kampagne läuft bis zum neuen Enddatum weiter."}
          {!unlimited && <> Bereits erledigte Besuche und bestehende Zuweisungen bleiben erhalten.</>}
        </p>
        {error != null && <div role="alert" style={{ padding: 10, borderRadius: 8, background: "rgba(220,38,38,.06)", color: "#991b1b", fontSize: 12, lineHeight: 1.6 }}>
          {error instanceof Error ? error.message : "Die Verlängerung konnte nicht gespeichert werden."}
          {overlaps.length > 0 && <ul style={{ paddingLeft: 16, margin: "6px 0 0" }}>{overlaps.slice(0, 8).map((conflict) => <li key={`${conflict.marketId}:${conflict.existingCampaignId}`}>{conflict.marketName} · {conflict.existingCampaignName} ({conflict.existingPeriodLabel})</li>)}</ul>}
          {error instanceof BackendApiError && error.code === "campaign_changed" && <div>Bitte diesen Dialog schließen und die Seite neu laden.</div>}
        </div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={saving} className="campaign-extension-action is-secondary">Abbrechen</button>
          <button type="button" onClick={() => void save()} disabled={!valid || saving} className="campaign-extension-action is-primary">
            {saving ? "Wird gespeichert …" : reactivating && !futureStart ? "Verlängern & aktivieren" : "Verlängern"}
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
