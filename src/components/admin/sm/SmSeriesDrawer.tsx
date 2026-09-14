"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Ban, Check, LoaderCircle, Repeat2, X } from "lucide-react";
import { AdminDatePicker, AdminDropdown } from "@/components/admin/AdminFilterControls";
import { changeSmSeries, fetchSmSeriesDetails, previewSmSeriesChange } from "@/lib/api/backend";
import type { SmSeriesChange, SmSeriesDetails, SmSeriesPreview } from "@/types/smPlanning";
import type { SmMarketRecord } from "@/types/smMarkets";
import type { SMRecord } from "@/types/shelfmerchandiser";
import { recommendedUserFirst } from "@/lib/sm/planningView";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DATE_FORMAT = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDate = (value: string) => DATE_FORMAT.format(new Date(`${value}T12:00:00`));
const api = { load: fetchSmSeriesDetails, preview: previewSmSeriesChange, save: changeSmSeries };
type Props = { seriesId: string; selectedDate: string; markets: SmMarketRecord[]; users: SMRecord[];
  onBack: () => void; onClose: () => void; onSaved: (result: SmSeriesPreview, action: "edit" | "stop") => Promise<void>;
  service?: typeof api };

export function SmSeriesDrawer({ seriesId, selectedDate, markets, users, onBack, onClose, onSaved, service = api }: Props) {
  const [details, setDetails] = useState<SmSeriesDetails | null>(null);
  const [change, setChange] = useState<Extract<SmSeriesChange, { action: "edit" }> | null>(null);
  const [action, setAction] = useState<"edit" | "stop">("edit");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<SmSeriesPreview | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setPreview(null);
    service.load(seriesId).then((value) => {
      if (!active) return;
      setDetails(value);
      setChange({ action: "edit", effectiveFromDate: [value.today, selectedDate, value.effectiveFromDate].sort().at(-1)!,
        smMarketId: value.smMarketId, smUserId: value.smUserId, plannedMinutes: value.plannedMinutes,
        frequency: value.frequency, weekdays: value.weekdays, validTo: value.validTo });
    }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Serie konnte nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, selectedDate, seriesId, service]);

  const patch = (value: Partial<NonNullable<typeof change>>) => { setChange((current) => current ? { ...current, ...value } : current); setPreview(null); setError(null); };
  const stopped = details?.status !== "active";
  const invalid = !change || !details || stopped ? "" : change.effectiveFromDate < details.today ? "Das Datum darf nicht in der Vergangenheit liegen."
    : action === "edit" && change.effectiveFromDate < details.effectiveFromDate ? "Das Datum muss ab der neuesten Serienversion liegen."
    : action === "edit" && (!change.weekdays.length || change.validTo < change.effectiveFromDate || !change.smMarketId || !change.smUserId) ? "Bitte Markt, SM, Wochentage und Zeitraum vollständig wählen." : "";
  const selectedMarket = markets.find((market) => market.id === change?.smMarketId);
  const submit = async () => {
    if (!change || !details || invalid || stopped || busyRef.current || reason.trim().length < 3) return;
    busyRef.current = true; setBusy(true); setError(null);
    const input: SmSeriesChange = action === "stop" ? { action, effectiveFromDate: change.effectiveFromDate } : change;
    try {
      if (!preview) setPreview(await service.preview(seriesId, input));
      else {
        const result = await service.save(seriesId, { change: input, previewToken: preview.previewToken, reason: reason.trim() });
        await onSaved(result, action);
        onClose();
      }
    } catch (err) { setPreview(null); setError(err instanceof Error ? err.message : "Die Serienänderung konnte nicht gespeichert werden."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <aside className="sm-plan-drawer" aria-label="Serie verwalten" onKeyDown={(event) => { if (event.key === "Escape" && !busy) onBack(); }}>
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-black/[.06] bg-white px-[18px]">
      <div className="flex items-center gap-2.5"><button type="button" aria-label="Zurück zum Einsatz" onClick={onBack} disabled={busy} className="sm-plan-icon-button"><ArrowLeft size={14}/></button><div><h2 className="text-sm font-bold tracking-tight">Serie verwalten</h2><p className="mt-0.5 text-[10px] text-black/40">Nur zukünftige SM-Einsätze</p></div></div>
      <button type="button" aria-label="Schließen" onClick={onClose} disabled={busy} className="sm-plan-icon-button"><X size={14}/></button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4">
      {loading ? <div role="status" className="space-y-3"><span className="flex items-center gap-2 text-xs text-black/40"><LoaderCircle size={14} className="animate-spin"/>Serie wird geladen…</span>{[1,2,3,4].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-black/5"/>)}</div> : details && change ? <>
        <div className="mb-4 rounded-lg border border-black/[.06] bg-white p-3"><div className="flex items-center gap-2 text-[11px] font-semibold"><Repeat2 size={13}/>{selectedMarket?.name ?? "SM-Serie"}<span className="ml-auto text-[9px] font-normal text-black/35">Version {details.versionNumber}</span></div><p className="mt-1.5 text-[10px] text-black/40">{formatDate(details.validFrom)} – {formatDate(details.validTo)}{stopped ? " · Gestoppt" : ""}</p></div>
        {stopped ? <p role="status" className="rounded-lg border border-black/[.06] bg-white p-3 text-xs leading-relaxed text-black/50">Diese Serie wurde gestoppt. Die bisherigen Einsätze, Antworten und Zeiten bleiben erhalten. Einzeltermine können weiterhin separat geöffnet werden.</p> : <>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-black/[.04] p-1">{(["edit", "stop"] as const).map((mode) => <button key={mode} type="button" disabled={busy} aria-pressed={action === mode} onClick={() => { setAction(mode); setPreview(null); setError(null); }} className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-semibold transition-colors ${action === mode ? "bg-white text-red-600 shadow-sm" : "text-black/40"}`}>{mode === "edit" ? <Repeat2 size={12}/> : <Ban size={12}/>} {mode === "edit" ? "Ändern" : "Stoppen"}</button>)}</div>
          <fieldset disabled={busy} className="space-y-3.5">
            <div><Label>{action === "stop" ? "Stoppen ab (inklusive)" : "Änderungen ab (inklusive)"}</Label><AdminDatePicker ariaLabel={action === "stop" ? "Stoppen ab" : "Änderungen ab"} value={change.effectiveFromDate} minDate={action === "stop" ? details.today : [details.today, details.effectiveFromDate].sort().at(-1)!} onChange={(value) => patch({ effectiveFromDate: value })}/></div>
            {action === "edit" ? <>
              <div><Label>Markt · Stammnummer</Label><AdminDropdown placeholder="Markt wählen" ariaLabel="Serienmarkt" value={change.smMarketId} options={markets.map((market) => ({ value: market.id, label: market.name, description: `Stammnr. ${market.internalId} · ${market.address}` }))} onChange={(value) => patch({ smMarketId: value })} searchable/></div>
              <div><Label>Shelf Merchandiser</Label><AdminDropdown placeholder="SM wählen" ariaLabel="Serien-SM" value={change.smUserId} options={recommendedUserFirst(users, selectedMarket?.assignedSmUserId ?? null).map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim(), recommended: user.id === selectedMarket?.assignedSmUserId }))} onChange={(value) => patch({ smUserId: value })} searchable/></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Sollzeit (Minuten)</Label><input aria-label="Serien-Sollzeit" type="number" min={1} max={1440} value={change.plannedMinutes} onChange={(event) => patch({ plannedMinutes: Number(event.target.value) })} className="sm-plan-input w-full"/></div><div><Label>Wiederholung</Label><AdminDropdown placeholder="Wiederholung" ariaLabel="Serienrhythmus" value={change.frequency} options={[{ value: "weekly", label: "Wöchentlich" }, { value: "biweekly", label: "Alle zwei Wochen" }]} onChange={(value) => patch({ frequency: value as "weekly" | "biweekly" })}/></div></div>
              <div><Label>Wochentage</Label><div className="flex gap-1.5">{DAYS.map((label, index) => <button type="button" key={label} aria-pressed={change.weekdays.includes(index + 1)} onClick={() => patch({ weekdays: change.weekdays.includes(index + 1) ? change.weekdays.filter((day) => day !== index + 1) : [...change.weekdays, index + 1].sort() })} className={`sm-plan-weekday${change.weekdays.includes(index + 1) ? " is-active" : ""}`}>{label}</button>)}</div></div>
              <div><Label>Serienende</Label><AdminDatePicker ariaLabel="Serienende" value={change.validTo} minDate={change.effectiveFromDate} onChange={(value) => patch({ validTo: value })}/></div>
            </> : null}
            <div><Label>{action === "stop" ? "Grund für den Stopp" : "Änderungsgrund"}</Label><textarea aria-label="Serienänderungsgrund" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} placeholder="Kurze Begründung…" className="sm-plan-input min-h-[66px] w-full resize-y py-2"/></div>
          </fieldset>
          <p className="mt-3 text-[10px] leading-relaxed text-black/40">{action === "stop" ? "Noch nicht gestartete Einsätze ab diesem Datum werden abgesagt, nicht gelöscht." : "Der bestehende Wochenrhythmus bleibt verankert. Neue Termine berücksichtigen Feiertage; bestehende Datumsverschiebungen bleiben erhalten."} Abgeschlossene oder laufende Besuche, vorhandene Antworten und Zeiten bleiben unverändert.</p>
          {preview ? <section aria-label="Auswirkung der Serienänderung" className="mt-4 rounded-xl border border-red-600/15 bg-red-50/50 p-3"><h3 className="mb-2 text-[11px] font-semibold">Bitte vor dem Speichern prüfen</h3><div className="space-y-1.5 text-[11px]">{[[preview.updateCount,"werden aktualisiert"],[preview.createCount,"werden neu eingeplant"],[preview.cancelCount,"werden abgesagt"],[preview.restoreCount,"entfallene Serientermine werden wieder eingeplant"],[preview.protectedCount,"geschützte Einsätze bleiben unverändert"]].map(([count,text]) => <div key={String(text)} className="flex justify-between gap-3"><span className="text-black/50">{text}</span><strong className="tabular-nums">{count}</strong></div>)}</div>{preview.preservedDateCount ? <p className="mt-2 text-[10px] text-black/45">{preview.preservedDateCount} bestehende Datumsverschiebungen bleiben bestehen.</p> : null}{preview.blockedDateCount ? <p className="mt-2 text-[10px] text-amber-800">{preview.blockedDateCount} bereits durch verschobene Einsätze belegte Termine werden nicht doppelt angelegt.</p> : null}</section> : null}
        </>}
      </> : null}
      {error || invalid ? <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-600/15 bg-red-50 p-3 text-[11px] text-red-700"><AlertCircle size={13} className="shrink-0"/><span>{error ?? invalid}</span></div> : null}
      {!loading && !details ? <button type="button" className="sm-plan-secondary-button mt-3" onClick={() => setRetry((value) => value + 1)}>Erneut laden</button> : null}
    </div>
    <div className="flex min-h-[66px] shrink-0 items-center justify-between gap-2 border-t border-black/[.06] bg-white px-[18px] py-3.5"><button type="button" onClick={onBack} disabled={busy} className="sm-plan-secondary-button">Zurück</button>{details && !stopped ? <button type="button" disabled={loading || busy || Boolean(invalid) || reason.trim().length < 3} onClick={() => { void submit(); }} className="sm-plan-primary-button">{busy ? <LoaderCircle size={12} className="animate-spin"/> : preview ? <Check size={12}/> : null}{busy ? "Bitte warten…" : preview ? action === "stop" ? "Serie jetzt stoppen" : "Änderungen bestätigen" : "Auswirkung prüfen"}</button> : null}</div>
  </aside>;
}
function Label({ children }: { children: React.ReactNode }) { return <div className="mb-1.5 text-[10px] font-semibold text-black/45">{children}</div>; }
