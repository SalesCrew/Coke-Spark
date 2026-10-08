"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AdminDatePicker, AdminDropdown } from "@/components/admin/AdminFilterControls";
import type { SmArchivePhotoFacets, SmPhotoArchiveApi, SmPhotoArchiveFilters } from "@/types/smPhotoArchive";
import styles from "./SmPhotoArchiveWorkspace.module.css";

const facetKey = (filters: SmPhotoArchiveFilters) => JSON.stringify({ from: filters.from, to: filters.to, SMDurcharbeitCatalogScope: filters.SMDurcharbeitCatalogScope });
const facetFields = [
  ["smUserId", "smName", "Shelf Merchandiser", "Alle SMs"],
  ["marketId", "marketName", "Markt", "Alle Märkte"],
  ["questionnaireId", "questionnaireName", "Fragebogen", "Alle Fragebögen"],
] as const;
const focusableSelector = 'button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]';

export function SmPhotoArchiveFilterDialog({ filters, initialFacets, api, owner, currentOwner, onClose, onApply, onReset }: {
  filters: SmPhotoArchiveFilters;
  initialFacets: SmArchivePhotoFacets | null;
  api: SmPhotoArchiveApi;
  owner: string;
  currentOwner: () => string | null;
  onClose: () => void;
  onApply: (filters: SmPhotoArchiveFilters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [facets, setFacets] = useState<{ key: string; value: SmArchivePhotoFacets } | null>(() => initialFacets ? { key: facetKey(filters), value: initialFacets } : null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const key = facetKey(draft);
  const currentFacets = facets?.key === key ? facets.value : null;
  const originalKey = facetKey(filters);

  useEffect(() => {
    if (key === originalKey && initialFacets) {
      setFacets({ key, value: initialFacets });
      setError(null);
      return;
    }
    let active = true;
    setError(null);
    void api.facets(JSON.parse(key)).then(value => {
      if (active && currentOwner() === owner) setFacets({ key, value });
    }).catch(failure => {
      if (active && currentOwner() === owner) setError(failure instanceof Error ? failure.message : "Filteroptionen konnten nicht geladen werden.");
    });
    return () => { active = false; };
  }, [api, currentOwner, initialFacets, key, originalKey, owner]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPortalContainer(dialog.current);
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const update = (field: keyof SmPhotoArchiveFilters, value: string) => setDraft(current => ({ ...current,
    [field]: (field !== "search" && value === "all") || !value ? undefined : value,
    ...(field === "SMDurcharbeitCatalogScope" ? { marketId: undefined, questionnaireId: undefined } : {}),
    ...(field === "from" && value && current.to && value > current.to ? { to: value } : {}),
    ...(field === "to" && value && current.from && value < current.from ? { from: value } : {}),
  }));
  const count = Object.values(draft).filter(value => value !== undefined && value !== "").length;

  return createPortal(
    <div className={styles.filterBackdrop} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sm-photo-filter-title" className={styles.filterDialog} onKeyDown={event => {
        const popover = dialog.current?.querySelector(".sm-plan-dropdown-menu,.sm-plan-calendar-panel");
        if (event.key === "Escape" && !popover) { event.preventDefault(); onClose(); }
        if (event.key === "Tab") {
          const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])].filter(node => node.getClientRects().length > 0);
          if (!nodes.length) return;
          const index = nodes.indexOf(document.activeElement as HTMLElement);
          event.preventDefault();
          const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
          nodes[next].focus();
        }
      }}>
        <button type="button" className={`${styles.icon} ${styles.filterClose}`} aria-label="Fotofilter schließen" onClick={onClose}><X size={15} /></button>
        <header className={styles.filterHeading}>
          <p className={styles.eyebrow}>Fotoarchiv filtern</p>
          <div><h2 id="sm-photo-filter-title">Bilder aus Foto-Fragen</h2><span className={styles.filterCount}>{count} aktiv</span></div>
        </header>
        <div className={styles.filters}>
          <div className={styles.period}>
            <div className={styles.field}><span>Besuchszeitraum von</span><AdminDatePicker value={draft.from ?? ""} ariaLabel="Besuchszeitraum von" portalContainer={portalContainer} onChange={value => update("from", value)} /></div>
            <div className={styles.field}><span>Besuchszeitraum bis</span><AdminDatePicker value={draft.to ?? ""} ariaLabel="Besuchszeitraum bis" portalContainer={portalContainer} onChange={value => update("to", value)} /></div>
            <button type="button" className={styles.filterReset} onClick={() => { setDraft({}); onReset(); }}>Alle Filter zurücksetzen</button>
          </div>
          <div className={styles.filterRow}>
            <div className={styles.field}><span>Fragebogentyp</span><AdminDropdown value={draft.SMDurcharbeitCatalogScope ?? "all"} options={[{ value: "all", label: "Alle Fragebogentypen" }, { value: "standard", label: "Standardfragebogen" }, { value: "SMDurcharbeit", label: "Durcharbeit" }]} ariaLabel="Fragebogentyp" placeholder="Alle Fragebogentypen" portalContainer={portalContainer} onChange={value => update("SMDurcharbeitCatalogScope", value)} /></div>
            {facetFields.map(([field, name, label, all]) => {
              const values = new Map((currentFacets?.facets ?? []).map(facet => [facet[field], facet[name]]));
              const options = [{ value: "all", label: all }, ...Array.from(values, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "de-AT"))];
              return <div className={styles.field} key={field}><span>{label}</span><AdminDropdown value={draft[field] ?? "all"} options={options} ariaLabel={label} placeholder={all} searchable disabled={!currentFacets} portalContainer={portalContainer} onChange={value => update(field, value)} /></div>;
            })}
          </div>
          <label className={styles.field}><span>Markt / SM / Frage</span><span className={styles.search}><input type="search" aria-label="Fotofilter Suche" value={draft.search ?? ""} maxLength={200} placeholder="Suchen …" onChange={event => update("search", event.target.value)} /></span></label>
          {error ? <p role="alert" className={styles.filterError}>{error}</p> : null}
          {currentFacets?.truncated ? <p className={styles.muted}>Viele Filteroptionen: Nutze die Suche oder grenze den Zeitraum ein.</p> : null}
        </div>
        <footer className={styles.filterFooter}>
          <button type="button" className={styles.button} onClick={onClose}>Schließen</button>
          <button type="button" className={styles.primary} onClick={() => { onApply(draft); onClose(); }}>Filter anwenden</button>
        </footer>
      </div>
    </div>, document.body,
  );
}
