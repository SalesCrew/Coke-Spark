"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, LoaderCircle, MapPin, Repeat2, X } from "lucide-react";
import { AdminDropdown, AdminFilterControlStyles } from "@/components/admin/AdminFilterControls";
import { BackendApiError, deactivateSmMarket, fetchSmMarketDeactivationPreview, fetchSmMarkets } from "@/lib/api/backend";
import type { SmDeactivationResolution, SmMarketDeactivationPreview, SmMarketDeactivationResult, SmMarketRecord } from "@/types/smMarkets";

const date = (value: string) => new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const weekdays = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const button = "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";

export function SmMarketDeactivationModal({ marketId, onClose, onConfirmed }: {
  marketId: string; onClose: () => void; onConfirmed: (result: SmMarketDeactivationResult) => void;
}) {
  const [preview, setPreview] = useState<SmMarketDeactivationPreview | null>(null);
  const [markets, setMarkets] = useState<SmMarketRecord[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const live = useRef(true);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, options] = await Promise.all([fetchSmMarketDeactivationPreview(marketId), fetchSmMarkets()]);
      if (!live.current) return;
      setPreview(next); setMarkets(options); setChoices({});
    } catch (reason) {
      if (live.current) { setPreview(null); setError(reason instanceof Error ? reason.message : "Die betroffenen Einsätze konnten nicht geladen werden."); }
    } finally { if (live.current) setLoading(false); }
  }, [marketId]);
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; }; }, [load]);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="listbox"]')) return;
      if (event.key === "Escape" && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]') ?? []).filter((node) => node.getClientRects().length);
      const first = targets[0]; const last = targets.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); focused?.focus(); };
  }, []);
  const options = useMemo(() => [
    { value: "cancel", label: "Einsatz absagen", description: "Bleibt als abgesagt in der Planung sichtbar" },
    ...markets.filter((market) => market.id !== marketId && market.isActive && market.internalId?.trim()).map((market) => ({ value: market.id, label: `Ersatz: ${market.name} · ${market.internalId}`, description: `${market.address} · ${market.postalCode} ${market.city}` })),
  ], [markets, marketId]);
  const occurrences = preview?.groups.flatMap((group) => group.occurrences) ?? [];
  const allChosen = occurrences.every((row) => options.some((option) => option.value === choices[row.id]));
  const cancelled = occurrences.filter((row) => choices[row.id] === "cancel").length;
  const replaced = occurrences.filter((row) => choices[row.id] && choices[row.id] !== "cancel").length;
  const chooseMany = (ids: string[], value: string) => setChoices((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, value])) }));
  const save = async () => {
    if (!preview || !allChosen || savingRef.current || !preview.market.isActive) return;
    savingRef.current = true; setSaving(true); setError(null);
    const resolutions: SmDeactivationResolution[] = occurrences.map((row) => choices[row.id] === "cancel" ? { assignmentId: row.id, action: "cancel" } : { assignmentId: row.id, action: "replace", replacementMarketId: choices[row.id]! });
    try {
      const result = await deactivateSmMarket(marketId, { previewToken: preview.previewToken, resolutions });
      if (live.current) onConfirmed(result);
    } catch (reason) {
      if (!live.current) return;
      setError(reason instanceof Error ? reason.message : "Die Deaktivierung konnte nicht gespeichert werden.");
      if (reason instanceof BackendApiError && ["sm_market_deactivation_stale", "sm_market_replacement_unavailable"].includes(reason.code ?? "")) await load();
    } finally { savingRef.current = false; if (live.current) setSaving(false); }
  };

  return createPortal(<div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[3px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingRef.current) onClose(); }}>
    <AdminFilterControlStyles />
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sm-deactivation-title" aria-busy={loading || saving} className="flex max-h-[90dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-white/90 bg-[#f5f5f7] text-[#17191d] shadow-[0_24px_80px_rgba(0,0,0,.18)] outline-none">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[.06] bg-white p-5">
        <div><p className="text-[9px] font-bold uppercase tracking-[.09em] text-red-600">SM Markt · Deaktivierung</p><h2 id="sm-deactivation-title" className="mt-1 text-[19px] font-bold tracking-tight">Was passiert mit den Einsätzen?</h2><p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">Erst mit deiner Bestätigung wird der Markt inaktiv. Es wird nichts gelöscht.</p></div>
        <button type="button" aria-label="Deaktivierung abbrechen" disabled={saving} onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[.06] bg-white text-gray-400 hover:bg-gray-50"><X size={15} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {error ? <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-[12px] leading-relaxed text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div> : null}
        {loading ? <div role="status" className="space-y-3"><span className="sr-only">Betroffene Einsätze werden geladen</span>{[0, 1, 2].map((key) => <div key={key} className="h-24 rounded-xl bg-white motion-safe:animate-pulse" />)}</div> : preview ? <>
          <div className="rounded-xl border border-black/[.06] bg-white p-4"><p className="flex items-center gap-2 text-[13px] font-bold"><MapPin size={15} className="text-red-600" />{preview.market.name} · {preview.market.internalId}</p><p className="mt-1.5 text-[11px] text-gray-500">{preview.market.address} · {preview.market.postalCode} {preview.market.city}</p><p className="mt-3 text-[12px] font-semibold">{preview.affectedCount} betroffene Einsätze ab {date(preview.effectiveFrom)}</p></div>
          {!preview.market.isActive ? <p role="alert" className="mt-3 text-[12px] text-red-700">Der Markt ist bereits inaktiv. Schließe dieses Fenster und lade die Marktliste neu.</p> : null}
          {occurrences.length ? <div className="my-4 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-gray-500">Pro Einsatz oder für die ganze Serie entscheiden.</p><button type="button" disabled={saving} onClick={() => chooseMany(occurrences.map((row) => row.id), "cancel")} className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-red-600">Alle absagen</button></div> : <p className="my-4 text-[12px] leading-relaxed text-gray-500">Keine offenen Einsätze ab heute betroffen. Du kannst den Markt deaktivieren.</p>}
          <div className="space-y-3">{preview.groups.map((group) => {
            const first = group.occurrences[0]!; const last = group.occurrences.at(-1)!;
            const selected = new Set(group.occurrences.map((row) => choices[row.id] ?? "all"));
            const value = selected.size === 1 ? [...selected][0]! : "all";
            return <section key={group.id} className="rounded-xl border border-black/[.06] bg-white p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold">{group.seriesId ? <Repeat2 size={14} className="text-red-600" /> : <CalendarDays size={14} className="text-red-600" />}{group.seriesId ? `Serie · ${group.occurrences.length} Einsätze` : "Einzeleinsatz"}</div>
              <p className="mt-2 text-[12px] font-semibold tabular-nums">{date(first.workDate)}{last.workDate !== first.workDate ? ` – ${date(last.workDate)}` : ""}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{[...new Set(group.occurrences.map((row) => row.smName))].join(", ")}{group.seriesId ? ` · ${group.frequency === "biweekly" ? "Alle 2 Wochen" : "Wöchentlich"} ${group.weekdays.map((day) => weekdays[day]).join(", ")}` : ` · ${first.plannedMinutes} Min.`}</p>
              <div className="mt-3"><AdminDropdown value={value} options={options} onChange={(next) => chooseMany(group.occurrences.map((row) => row.id), next)} ariaLabel={group.seriesId ? "Entscheidung für die ganze Serie" : `Entscheidung für Einsatz am ${date(first.workDate)}`} placeholder={selected.size > 1 ? "Individuelle Entscheidungen — siehe Termine" : "Absagen oder Ersatzmarkt auswählen…"} searchable disabled={saving} /></div>
              {group.seriesId ? <details className="mt-3 border-t border-black/[.05] pt-3"><summary className="cursor-pointer text-[11px] font-semibold text-gray-500">Einzeltermine ansehen / individuell ersetzen</summary><div className="mt-3 space-y-3">{group.occurrences.map((row) => <div key={row.id} className="rounded-lg bg-gray-50 p-3"><p className="mb-2 text-[11px] font-semibold">{date(row.workDate)} · {row.smName} · {row.plannedMinutes} Min.</p><AdminDropdown value={choices[row.id] ?? "all"} options={options} onChange={(next) => chooseMany([row.id], next)} ariaLabel={`Entscheidung für ${row.smName} am ${date(row.workDate)}`} placeholder="Absagen oder Ersatz auswählen…" searchable disabled={saving} /></div>)}</div></details> : null}
            </section>;
          })}</div>
          {preview.endingSeriesCount ? <p className="mt-4 text-[11px] leading-relaxed text-gray-500">Serien laufen nicht mehr mit dem inaktiven Markt weiter. Ein einheitlicher Ersatz führt die Serie am neuen Markt fort; bei Absagen oder unterschiedlichen Ersatzmärkten endet die alte Serie. Bereits geplante Ersatztermine bleiben bestehen.</p> : null}
          {preview.protectedAssignments.length ? <details className="mt-4 rounded-xl border border-black/[.05] bg-white p-3"><summary className="cursor-pointer text-[11px] font-semibold text-gray-600">{preview.protectedAssignments.length} laufende / abgeschlossene Einsätze bleiben unverändert</summary><div className="mt-3 space-y-2">{preview.protectedAssignments.map((row) => <p key={row.id} className="text-[11px] text-gray-500">{date(row.workDate)} · {row.smName} · {row.status === "in_progress" ? "In Arbeit" : "Abgeschlossen"}</p>)}</div></details> : null}
        </> : <button type="button" className={`${button} border border-black/10 bg-white`} onClick={() => { setError(null); void load(); }}>Erneut laden</button>}
      </div>
      <footer className="shrink-0 border-t border-black/[.06] bg-white p-4 sm:px-5"><p className="mb-3 text-[11px] text-gray-500">{cancelled} absagen · {replaced} ersetzen{occurrences.length - cancelled - replaced > 0 ? ` · ${occurrences.length - cancelled - replaced} noch offen` : ""}. Historie und frühere Besuche bleiben erhalten.</p><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className={`${button} border border-black/[.08] bg-white text-gray-600 shadow-sm`}>Abbrechen</button><button type="button" disabled={loading || saving || !preview?.market.isActive || !allChosen} onClick={() => void save()} className={`${button} bg-gradient-to-b from-[#DC2626] to-[#b91c1c] text-white shadow-[inset_0_1px_.6px_rgba(255,255,255,.33),0_0_0_1px_#a91b1b,0_1px_6px_rgba(180,20,20,.18)]`}>{saving ? <LoaderCircle size={13} className="animate-spin" /> : null}{saving ? "Wird gespeichert…" : "Bestätigen & Markt deaktivieren"}</button></div></footer>
    </div>
  </div>, document.body);
}
